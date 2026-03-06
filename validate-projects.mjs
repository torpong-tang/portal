import { promises as fs } from "node:fs";
import path from "node:path";

const projectsFile = path.join("/home/johnson/projects/portal", "projects.json");
const validGroups = new Set(["general", "specific"]);

const fail = (message) => {
  console.error(`projects.json validation failed: ${message}`);
  process.exit(1);
};

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const main = async () => {
  const raw = await fs.readFile(projectsFile, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    fail("root value must be an array");
  }

  const names = new Set();

  parsed.forEach((item, index) => {
    const row = index + 1;
    if (!item || typeof item !== "object") {
      fail(`row ${row} must be an object`);
    }

    if (typeof item.name !== "string" || !item.name.trim()) {
      fail(`row ${row} has missing/invalid name`);
    }
    if (names.has(item.name)) {
      fail(`duplicate project name: ${item.name}`);
    }
    names.add(item.name);

    if (!validGroups.has(item.group)) {
      fail(`project ${item.name} has invalid group: ${item.group}`);
    }

    if (typeof item.runCommand !== "string" || !item.runCommand.trim()) {
      fail(`project ${item.name} has missing runCommand`);
    }

    if (typeof item.appUrl !== "string" || !isHttpUrl(item.appUrl)) {
      fail(`project ${item.name} has invalid appUrl`);
    }
  });

  console.log(`projects.json is valid (${parsed.length} projects)`);
};

main().catch((error) => fail(error.message || String(error)));
