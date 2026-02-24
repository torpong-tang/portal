import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "node:url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const portalDir = "/home/johnson/projects/portal";
const projectsFile = path.join(portalDir, "projects.json");

const app = next({ dev, hostname: host, port, dir: portalDir });
const handle = app.getRequestHandler();

const running = new Map();

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const loadProjects = async () => {
  const raw = await fs.readFile(projectsFile, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const getRuntimeStatus = async () => {
  const projects = await loadProjects();
  const status = {};

  for (const project of projects) {
    const item = running.get(project.name);
    if (!item) {
      status[project.name] = {
        running: false,
        message: "Not running",
        logs: [],
        error: false,
        appUrl: null,
      };
      continue;
    }

    status[project.name] = {
      running: !item.exited,
      message: item.exited
        ? `Exited (code ${item.exitCode ?? 0})`
        : `Running (pid ${item.process.pid})`,
      logs: item.logs,
      error: Boolean(item.exitCode && item.exitCode !== 0),
      appUrl: item.detectedUrl || null,
    };
  }
  return status;
};

const addLog = (record, chunk) => {
  const lines = chunk
    .toString("utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    record.logs.push(line);
    const urlMatch = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{2,5})?(?:\/[^\s]*)?/i);
    if (urlMatch) {
      record.detectedUrl = urlMatch[0];
    }
  }
  if (record.logs.length > 30) {
    record.logs.splice(0, record.logs.length - 30);
  }
};

const startProject = async (name) => {
  const projects = await loadProjects();
  const project = projects.find((item) => item.name === name);
  if (!project) {
    throw new Error(`Unknown project: ${name}`);
  }

  const existing = running.get(name);
  if (existing && !existing.exited) {
    return { alreadyRunning: true, pid: existing.process.pid, appUrl: existing.detectedUrl || null };
  }

  const child = spawn("bash", ["-lc", project.runCommand], {
    cwd: "/home/johnson/projects",
    env: process.env,
    detached: true,
  });

  const record = {
    process: child,
    logs: [],
    exitCode: null,
    exited: false,
    detectedUrl: null,
  };
  running.set(name, record);

  child.stdout.on("data", (chunk) => addLog(record, chunk));
  child.stderr.on("data", (chunk) => addLog(record, chunk));
  child.on("close", (code) => {
    record.exitCode = code;
    record.exited = true;
  });

  return { alreadyRunning: false, pid: child.pid, appUrl: record.detectedUrl || null };
};

const stopProject = async (name) => {
  const item = running.get(name);
  if (!item || item.exited) {
    return { stopped: false };
  }
  const pid = item.process.pid;
  if (!pid) {
    return { stopped: false };
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    item.process.kill("SIGTERM");
  }

  setTimeout(() => {
    if (item.exited) {
      return;
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      item.process.kill("SIGKILL");
    }
  }, 4000);

  return { stopped: true };
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      if (req.method === "GET" && parsedUrl.pathname === "/api/status") {
        const status = await getRuntimeStatus();
        sendJson(res, 200, status);
        return;
      }

      if (req.method === "POST" && parsedUrl.pathname === "/api/run") {
        const body = await readJsonBody(req);
        const name = String(body.name || "");
        if (!name) {
          sendJson(res, 400, { error: "Project name is required" });
          return;
        }
        const result = await startProject(name);
        const message = result.alreadyRunning
          ? `${name} is already running (pid ${result.pid})`
          : `Started ${name} (pid ${result.pid})`;
        sendJson(res, 200, { message, appUrl: result.appUrl });
        return;
      }

      if (req.method === "POST" && parsedUrl.pathname === "/api/stop") {
        const body = await readJsonBody(req);
        const name = String(body.name || "");
        if (!name) {
          sendJson(res, 400, { error: "Project name is required" });
          return;
        }
        const result = await stopProject(name);
        const message = result.stopped ? `Stopping ${name}` : `${name} is not running`;
        sendJson(res, 200, { message });
        return;
      }

      // If it's not our API routes, let Next.js handle it
      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: error.message || "Internal server error" });
    }
  });

  const shutdown = () => {
    for (const item of running.values()) {
      if (!item.exited) {
        item.process.kill("SIGTERM");
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, host, () => {
    console.log(`Portal server with Next.js running at http://${host}:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Start with a different port.`);
      process.exit(1);
    }
    console.error(error);
    process.exit(1);
  });
});
