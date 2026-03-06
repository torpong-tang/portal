import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { getRuntimeStatus, startProject, stopProject } from "./lib/projectManager.mjs";

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const portalDir = "/home/johnson/projects/portal";

const app = next({ dev, hostname: host, port, dir: portalDir });
const handle = app.getRequestHandler();

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

      await handle(req, res, parsedUrl);
    } catch (error) {
      console.error(error);
      sendJson(res, 500, { error: error.message || "Internal server error" });
    }
  });

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
