import fs from "node:fs";

const auditPath = "audit-trail/decisions.jsonl";
const requiredFields = [
  "eventId",
  "timestamp",
  "type",
  "decision",
  "tradeoffs",
  "retentionMode",
  "humanOversight",
  "references",
];

if (!fs.existsSync(auditPath)) {
  throw new Error(`${auditPath} is missing.`);
}

const lines = fs
  .readFileSync(auditPath, "utf8")
  .split("\n")
  .filter((line) => line.trim());

if (lines.length === 0) {
  throw new Error(`${auditPath} must contain at least one audit entry.`);
}

lines.forEach((line, index) => {
  const entry = JSON.parse(line);

  for (const field of requiredFields) {
    if (!(field in entry)) {
      throw new Error(`Line ${index + 1} is missing required field: ${field}`);
    }
  }
});

console.log(`Audit JSONL OK: ${lines.length} entr${lines.length === 1 ? "y" : "ies"}.`);
