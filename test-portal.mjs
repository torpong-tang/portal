import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:4080";
const results = [];
let passed = 0;
let failed = 0;

const fetch_ = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json: () => { try { return JSON.parse(body); } catch { return null; } },
        });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });

const test = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    passed++;
    results.push({ name, status: "PASS", ms, error: null });
  } catch (e) {
    const ms = Date.now() - start;
    failed++;
    results.push({ name, status: "FAIL", ms, error: e.message });
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected)
    throw new Error(`${label}: expected "${expected}", got "${actual}"`);
};

// ─── STATIC FILE SERVING TESTS ───

await test("GET / returns index.html with correct content-type", async () => {
  const res = await fetch_(`${BASE}/`);
  assertEqual(res.status, 200, "status");
  assert(res.headers["content-type"].includes("text/html"), "content-type should be text/html");
  assert(res.body.includes("Projects Portal"), "body should contain Projects Portal");
});

await test("GET /index.html returns 200", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  assertEqual(res.status, 200, "status");
  assert(res.body.includes("<!doctype html>"), "should return HTML content");
});

await test("GET /index.css returns CSS with correct content-type", async () => {
  const res = await fetch_(`${BASE}/index.css`);
  assertEqual(res.status, 200, "status");
  assert(res.headers["content-type"].includes("text/css"), "content-type should be text/css");
  assert(res.body.includes(":root"), "should contain CSS variables");
});

await test("GET /projects.json returns valid JSON array", async () => {
  const res = await fetch_(`${BASE}/projects.json`);
  assertEqual(res.status, 200, "status");
  assert(res.headers["content-type"].includes("application/json"), "content-type should be application/json");
  const data = res.json();
  assert(Array.isArray(data), "should be an array");
  assert(data.length > 0, "should have at least one project");
});

await test("GET /nonexistent returns 404", async () => {
  const res = await fetch_(`${BASE}/nonexistent-file.txt`);
  assertEqual(res.status, 404, "status");
});

await test("Path traversal blocked (/../etc/passwd)", async () => {
  const res = await fetch_(`${BASE}/../../../etc/passwd`);
  assert(res.status === 403 || res.status === 404, `should be 403 or 404, got ${res.status}`);
});

// ─── MIME TYPE TESTS ───

await test("PNG logo served with correct MIME type (image/png)", async () => {
  const res = await fetch_(`${BASE}/assets/logos/appfund.png`);
  assertEqual(res.status, 200, "status");
  assert(
    res.headers["content-type"] === "image/png",
    `MIME should be image/png, got "${res.headers["content-type"]}"`
  );
});

await test("JPG logo served with correct MIME type (image/jpeg)", async () => {
  const res = await fetch_(`${BASE}/assets/logos/appfund.jpg`);
  assertEqual(res.status, 200, "status");
  assert(
    res.headers["content-type"] === "image/jpeg",
    `MIME should be image/jpeg, got "${res.headers["content-type"]}"`
  );
});

await test("SVG logo served with correct MIME type (image/svg+xml)", async () => {
  const res = await fetch_(`${BASE}/assets/logos/appfund.svg`);
  assertEqual(res.status, 200, "status");
  assert(
    res.headers["content-type"] === "image/svg+xml",
    `MIME should be image/svg+xml, got "${res.headers["content-type"]}"`
  );
});

// ─── PNG FILE VALIDITY TEST ───

await test("PNG files are valid PNG format (not renamed JPEG)", async () => {
  const res = await fetch_(`${BASE}/assets/logos/eqinfo.png`);
  assertEqual(res.status, 200, "status");
  // PNG files start with magic bytes: 0x89 0x50 0x4E 0x47 (‰PNG)
  const raw = await new Promise((resolve, reject) => {
    const u = new URL(`${BASE}/assets/logos/eqinfo.png`);
    http.get({ hostname: u.hostname, port: u.port, path: u.pathname }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
  const header = raw.slice(0, 4);
  assert(
    header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47,
    `eqinfo.png should have PNG magic bytes, got [${header[0]}, ${header[1]}, ${header[2]}, ${header[3]}]`
  );
});

// ─── API TESTS ───

await test("GET /api/status returns JSON object", async () => {
  const res = await fetch_(`${BASE}/api/status`);
  assertEqual(res.status, 200, "status");
  const data = res.json();
  assert(data !== null && typeof data === "object", "should return an object");
});

await test("GET /api/status contains all projects from projects.json", async () => {
  const projRes = await fetch_(`${BASE}/projects.json`);
  const projects = projRes.json();
  const statusRes = await fetch_(`${BASE}/api/status`);
  const status = statusRes.json();
  for (const p of projects) {
    assert(p.name in status, `status should contain project "${p.name}"`);
    assert("running" in status[p.name], `${p.name} should have "running" field`);
    assert("message" in status[p.name], `${p.name} should have "message" field`);
    assert("logs" in status[p.name], `${p.name} should have "logs" field`);
    assert("error" in status[p.name], `${p.name} should have "error" field`);
  }
});

await test("POST /api/run without name returns 400", async () => {
  const res = await fetch_(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEqual(res.status, 400, "status");
  const data = res.json();
  assert(data.error, "should have error message");
});

await test("POST /api/run with unknown project returns 500", async () => {
  const res = await fetch_(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "__nonexistent_project__" }),
  });
  assertEqual(res.status, 500, "status");
});

await test("POST /api/stop without name returns 400", async () => {
  const res = await fetch_(`${BASE}/api/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEqual(res.status, 400, "status");
  const data = res.json();
  assert(data.error, "should have error message");
});

await test("POST /api/stop on non-running project returns 200 with not-running message", async () => {
  const res = await fetch_(`${BASE}/api/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "appfund" }),
  });
  assertEqual(res.status, 200, "status");
  const data = res.json();
  assert(data.message.includes("not running"), `message should say not running, got "${data.message}"`);
});

await test("POST /api/run with invalid JSON body returns 500", async () => {
  const res = await fetch_(`${BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "this is not json{{{",
  });
  assertEqual(res.status, 500, "status");
});

// ─── PROJECTS.JSON STRUCTURE TESTS ───

await test("Each project in projects.json has required fields", async () => {
  const res = await fetch_(`${BASE}/projects.json`);
  const projects = res.json();
  for (const p of projects) {
    assert(typeof p.name === "string" && p.name.length > 0, `project should have a name`);
    assert(typeof p.path === "string" && p.path.length > 0, `${p.name} should have a path`);
    assert(typeof p.runCommand === "string" && p.runCommand.length > 0, `${p.name} should have a runCommand`);
    assert("appUrl" in p, `${p.name} should have appUrl field`);
  }
});

await test("Project paths in projects.json point to existing directories", async () => {
  const res = await fetch_(`${BASE}/projects.json`);
  const projects = res.json();
  for (const p of projects) {
    try {
      const stat = await fs.stat(p.path);
      assert(stat.isDirectory(), `${p.path} should be a directory`);
    } catch {
      throw new Error(`${p.name}: path "${p.path}" does not exist`);
    }
  }
});

// ─── FRONTEND HTML STRUCTURE TESTS ───

await test("index.html contains search input", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  assert(res.body.includes('id="search"'), "should have search input");
});

await test("index.html contains grid section", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  assert(res.body.includes('id="grid"'), "should have grid section");
});

await test("index.html contains refresh button", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  assert(res.body.includes('id="refreshNow"'), "should have refresh button");
});

await test("index.html contains toast container", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  assert(res.body.includes('id="toast-container"'), "should have toast container");
});

await test("index.html JS references correct logo order (PNG first)", async () => {
  const res = await fetch_(`${BASE}/index.html`);
  const pngIdx = res.body.indexOf("logoSlug}.png");
  const jpgIdx = res.body.indexOf("logoSlug}.jpg");
  assert(pngIdx > 0, "should contain .png logo reference");
  assert(jpgIdx > 0, "should contain .jpg logo reference");
  assert(pngIdx < jpgIdx, "PNG should come before JPG in candidates array");
});

// ─── CSS VALIDATION TESTS ───

await test("index.css has no invalid CSS syntax (group-hover)", async () => {
  const res = await fetch_(`${BASE}/index.css`);
  const hasInvalid = res.body.includes("group-hover:");
  assert(!hasInvalid, "CSS contains invalid 'group-hover:' syntax (Tailwind-only, not valid in raw CSS)");
});

// ─── GENERATE RESULTS ───

console.log("\n═══════════════════════════════════════════");
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
console.log("═══════════════════════════════════════════\n");
for (const r of results) {
  const icon = r.status === "PASS" ? "✓" : "✗";
  const line = `  ${icon} ${r.name} (${r.ms}ms)`;
  console.log(line);
  if (r.error) console.log(`    → ${r.error}`);
}
console.log("");

// Write HTML report
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portal Test Results</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0f172a;
      --card: rgba(30,41,59,0.5);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --green: #22c55e;
      --red: #ef4444;
      --border: rgba(255,255,255,0.08);
    }
    * { box-sizing: border-box; margin: 0; }
    body { font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 0.5rem;
      background: linear-gradient(to right, #fff, #bae6fd);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .summary { display: flex; gap: 1rem; margin: 1.5rem 0 2rem; flex-wrap: wrap; }
    .stat { padding: 1rem 1.5rem; border-radius: 12px; font-weight: 600; font-size: 1.1rem;
      backdrop-filter: blur(12px); border: 1px solid var(--border); }
    .stat.total { background: rgba(56,189,248,0.1); color: #38bdf8; border-color: rgba(56,189,248,0.2); }
    .stat.pass { background: rgba(34,197,94,0.1); color: var(--green); border-color: rgba(34,197,94,0.2); }
    .stat.fail { background: rgba(239,68,68,0.1); color: var(--red); border-color: rgba(239,68,68,0.2); }
    .test-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .test-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.2rem;
      background: var(--card); border: 1px solid var(--border); border-radius: 10px;
      transition: all 0.2s ease; }
    .test-item:hover { background: rgba(51,65,85,0.6); }
    .test-item.pass { border-left: 3px solid var(--green); }
    .test-item.fail { border-left: 3px solid var(--red); }
    .icon { font-size: 1.1rem; flex-shrink: 0; width: 24px; text-align: center; }
    .icon.pass { color: var(--green); }
    .icon.fail { color: var(--red); }
    .test-name { flex: 1; font-size: 0.95rem; }
    .test-time { font-family: 'Fira Code', monospace; font-size: 0.8rem; color: var(--muted); }
    .test-error { font-family: 'Fira Code', monospace; font-size: 0.8rem; color: var(--red);
      margin-top: 0.4rem; padding: 0.5rem 0.75rem; background: rgba(239,68,68,0.08);
      border-radius: 6px; grid-column: 1 / -1; word-break: break-word; }
    .test-item.fail .detail { display: flex; flex-direction: column; flex: 1; }
    .timestamp { color: var(--muted); font-size: 0.85rem; margin-bottom: 1.5rem; }
    a.back { display: inline-block; margin-top: 2rem; color: #38bdf8; text-decoration: none;
      padding: 0.6rem 1.2rem; border: 1px solid rgba(56,189,248,0.3); border-radius: 8px;
      transition: all 0.2s ease; }
    a.back:hover { background: rgba(56,189,248,0.1); }
  </style>
</head>
<body>
  <div class="container">
    <h1>Portal Test Results</h1>
    <p class="timestamp">Run at: ${new Date().toLocaleString()}</p>
    <div class="summary">
      <div class="stat total">${results.length} Total</div>
      <div class="stat pass">${passed} Passed</div>
      <div class="stat fail">${failed} Failed</div>
    </div>
    <div class="test-list">
      ${results
        .map(
          (r) => `
        <div class="test-item ${r.status.toLowerCase()}">
          <span class="icon ${r.status.toLowerCase()}">${r.status === "PASS" ? "&#10003;" : "&#10007;"}</span>
          ${
            r.error
              ? `<div class="detail">
                  <span class="test-name">${r.name}</span>
                  <div class="test-error">${r.error.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                </div>`
              : `<span class="test-name">${r.name}</span>`
          }
          <span class="test-time">${r.ms}ms</span>
        </div>`
        )
        .join("")}
    </div>
    <a class="back" href="/">Back to Portal</a>
  </div>
</body>
</html>`;

await fs.writeFile(path.join("/home/johnson/projects/portal", "test-results.html"), html, "utf8");
console.log("Test report written to test-results.html");
