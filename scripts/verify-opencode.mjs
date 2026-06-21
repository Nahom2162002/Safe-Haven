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

if (!Array.isArray(config.agents) || config.agents.length === 0) {
  throw new Error("opencode.json must define at least one agent.");
}

if (!Array.isArray(config.instructions) || config.instructions.length === 0) {
  throw new Error("opencode.json must define at least one instruction file.");
}

for (const instruction of config.instructions) {
  if (!instruction.file) {
    throw new Error("Every instruction entry must include a file field.");
  }

  assertFile(instruction.file, "Instruction file");
}

for (const agent of config.agents) {
  if (!agent.name || !agent.mode || !agent.description) {
    throw new Error("Every agent must include name, mode, and description.");
  }

  if (!agent.systemPromptFile) {
    throw new Error(`Agent ${agent.name} must include systemPromptFile.`);
  }

  assertFile(agent.systemPromptFile, `Agent ${agent.name} system prompt`);
}

console.log(
  `OpenCode config OK: ${config.agents.length} agents, ${config.instructions.length} instruction file(s).`
);
