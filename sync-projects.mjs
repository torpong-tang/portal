import { promises as fs } from "node:fs";
import path from "node:path";

const projectsRoot = "/home/johnson/projects";
const outputPath = path.join(projectsRoot, "portal", "projects.json");

const hasFile = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const detectPackageManager = async (projectPath) => {
  if (await hasFile(path.join(projectPath, "bun.lockb"))) {
    return "bun";
  }
  if (await hasFile(path.join(projectPath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (await hasFile(path.join(projectPath, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
};

const readScriptCommand = (scripts) => [scripts.dev, scripts.start].filter(Boolean).join(" ").trim();

const detectFramework = (scripts) => {
  const command = readScriptCommand(scripts);
  if (!command) return null;
  if (/\bnext\b/i.test(command)) return "next";
  if (/\bvite\b/i.test(command)) return "vite";
  return null;
};

const extractPort = (scripts) => {
  const command = readScriptCommand(scripts);
  if (!command) {
    return null;
  }

  const portMatch = command.match(/(?:--port|-p)\s*(?:=)?\s*(\d{2,5})/i);
  return portMatch ? Number.parseInt(portMatch[1], 10) : null;
};

const buildRunCommand = (manager, scripts, absPath, assignedPort) => {
  const addPrefix = (command) => `cd ${absPath} && ${command}`;
  const framework = detectFramework(scripts);
  const portArgs = framework && assignedPort ? ` -- --port ${assignedPort}` : "";

  if (scripts.dev) {
    if (manager === "pnpm") return addPrefix(`pnpm install && pnpm dev${portArgs}`);
    if (manager === "yarn") return addPrefix(`yarn && yarn dev${portArgs}`);
    if (manager === "bun") return addPrefix(`bun install && bun run dev${portArgs}`);
    return addPrefix(`npm install && npm run dev${portArgs}`);
  }

  if (scripts.start) {
    if (manager === "pnpm") return addPrefix(`pnpm install && pnpm start${portArgs}`);
    if (manager === "yarn") return addPrefix(`yarn && yarn start${portArgs}`);
    if (manager === "bun") return addPrefix(`bun install && bun run start${portArgs}`);
    return addPrefix(`npm install && npm start${portArgs}`);
  }

  if (scripts.test) {
    if (manager === "pnpm") return addPrefix("pnpm install && pnpm test");
    if (manager === "yarn") return addPrefix("yarn && yarn test");
    if (manager === "bun") return addPrefix("bun install && bun test");
    return addPrefix("npm install && npm test");
  }

  return addPrefix("ls");
};

const inferAppUrl = (scripts, assignedPort) => {
  const command = readScriptCommand(scripts);
  if (!command) {
    return null;
  }

  const framework = detectFramework(scripts);
  const port = framework && assignedPort ? assignedPort : extractPort(scripts);

  if (port) {
    return `http://localhost:${port}`;
  }

  if (/\bnext\b/i.test(command)) {
    return "http://localhost:3000";
  }

  if (/\bvite\b/i.test(command)) {
    return "http://localhost:5173";
  }

  return null;
};

const readProjectData = async (entryName, assignedPort) => {
  const absPath = path.join(projectsRoot, entryName);
  const packageJsonPath = path.join(absPath, "package.json");
  let scripts = {};

  if (await hasFile(packageJsonPath)) {
    try {
      const packageContent = await fs.readFile(packageJsonPath, "utf8");
      const parsed = JSON.parse(packageContent);
      scripts = parsed.scripts || {};
    } catch {
      scripts = {};
    }
  }

  const manager = await detectPackageManager(absPath);
  return {
    name: entryName,
    href: `../${entryName}/`,
    path: absPath,
    runCommand: buildRunCommand(manager, scripts, absPath, assignedPort),
    appUrl: inferAppUrl(scripts, assignedPort),
  };
};

const main = async () => {
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const projectDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => name !== "portal")
    .sort((a, b) => a.localeCompare(b));

  const projects = [];
  let nextPort = 3000;
  for (const name of projectDirs) {
    projects.push(await readProjectData(name, nextPort));
    nextPort += 1;
  }

  await fs.writeFile(outputPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  console.log(`Synced ${projects.length} project(s) to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
