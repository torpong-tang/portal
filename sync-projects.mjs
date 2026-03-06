import { promises as fs } from "node:fs";
import path from "node:path";

const projectsRoot = "/home/johnson/projects";
const outputPath = path.join(projectsRoot, "portal", "projects.json");

const MANAGED_PROJECTS = ["eqinfo", "roomie", "timesheet", "tika", "easypro", "kmiso"];

const PORT_OVERRIDES = {
  timesheet: 3001,
  roomie: 3002,
  tika: 3003,
  easypro: 3004,
  kmiso: 3005,
  eqinfo: 3006,
};

const RUN_COMMAND_OVERRIDES = {
  eqinfo:
    "cd /home/johnson/projects/eqinfo && npm install && NODE_PATH=./node_modules npx next dev --webpack -H 0.0.0.0 -p 3006",
  roomie: "cd /home/johnson/projects/roomie && npm install && npx next dev -H 0.0.0.0 -p 3002",
  timesheet:
    "cd /home/johnson/projects/timesheet && npm install && NEXTAUTH_SECRET=secret AUTH_SECRET=secret npm run dev -- --port 3001",
  tika: "cd /home/johnson/projects/tika && npm install && npx next dev -H 0.0.0.0 -p 3003",
  easypro: "cd /home/johnson/projects/easypro && npm install && npx next dev -H 0.0.0.0 -p 3004",
  kmiso: "cd /home/johnson/projects/kmiso && npm install && npx next dev -H 0.0.0.0 -p 3005",
};

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

const inferAppUrl = (name) => `http://localhost/${name}`;

const detectGroup = (name) => {
  const general = new Set(["eqinfo", "roomie"]);
  return general.has(name) ? "general" : "specific";
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
  const runCommandOverride = RUN_COMMAND_OVERRIDES[entryName];
  return {
    name: entryName,
    group: detectGroup(entryName),
    href: `../${entryName}/`,
    path: absPath,
    runCommand: runCommandOverride || buildRunCommand(manager, scripts, absPath, assignedPort),
    appUrl: inferAppUrl(entryName),
  };
};

const main = async () => {
  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const projectDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("."))
    .filter((name) => name !== "portal")
    .filter((name) => MANAGED_PROJECTS.includes(name))
    .sort((a, b) => MANAGED_PROJECTS.indexOf(a) - MANAGED_PROJECTS.indexOf(b));

  const projects = [];
  let nextPort = 3010;
  for (const name of projectDirs) {
    const assignedPort = PORT_OVERRIDES[name] || nextPort;
    projects.push(await readProjectData(name, assignedPort));
    if (!PORT_OVERRIDES[name]) {
      nextPort += 1;
    }
  }

  await fs.writeFile(outputPath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
  console.log(`Synced ${projects.length} project(s) to ${outputPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
