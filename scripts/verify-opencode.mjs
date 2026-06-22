import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "opencode.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFile(relativePath, label) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${relativePath}`);
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    throw new Error(`${label} is not a file: ${relativePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8").trim();

  if (!content) {
    throw new Error(`${label} is empty: ${relativePath}`);
  }
}

const config = readJson(configPath);

if (!config.agent || typeof config.agent !== "object") {
  throw new Error("opencode.json must define an agent object.");
}

if (!Array.isArray(config.instructions) || config.instructions.length === 0) {
  throw new Error("opencode.json must define at least one instruction file.");
}

for (const instruction of config.instructions) {
  if (typeof instruction !== "string") {
    throw new Error("Every instruction entry must be a file path string.");
  }

  assertFile(instruction, "Instruction file");
}

const agents = Object.entries(config.agent);

if (agents.length === 0) {
  throw new Error("opencode.json must define at least one agent.");
}

for (const [name, agent] of agents) {
  if (!agent || typeof agent !== "object") {
    throw new Error(`Agent ${name} must be an object.`);
  }

  if (!agent.mode || !agent.description) {
    throw new Error(`Agent ${name} must include mode and description.`);
  }

  const fileReference = agent.prompt?.match(/^\{file:(.+)\}$/);

  if (!fileReference) {
    throw new Error(`Agent ${name} must include a prompt file reference.`);
  }

  assertFile(fileReference[1], `Agent ${name} prompt`);
}

console.log(
  `OpenCode config OK: ${agents.length} agents, ${config.instructions.length} instruction file(s).`
);
