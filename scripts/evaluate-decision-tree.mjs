import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const datasetPath = path.resolve(
  root,
  process.argv[2] ?? "datasets/decision-tree-evaluation.jsonl"
);
const tempDir = path.join(os.tmpdir(), "safe-haven-decision-eval");
const compiledEntry = path.join(tempDir, "lib", "decisionEngine.js");
const require = createRequire(import.meta.url);

const severityOrder = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

if (!fs.existsSync(datasetPath)) {
  throw new Error(`Dataset not found: ${datasetPath}`);
}

compileDecisionEngine();

const { childSafetyDecision } = require(compiledEntry);
const rows = readJsonl(datasetPath);
const results = rows.map((row) => evaluateRow(row, childSafetyDecision));
const stats = summarize(results);

printSummary(datasetPath, stats, results);

if (stats.falsePositive > 0 || stats.falseNegative > 0) {
  process.exitCode = 1;
}

function compileDecisionEngine() {
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const tscPath = path.join(root, "node_modules", "typescript", "bin", "tsc");

  execFileSync(
    process.execPath,
    [
      tscPath,
      "--target",
      "ES2021",
      "--module",
      "CommonJS",
      "--moduleResolution",
      "node",
      "--rootDir",
      root,
      "--outDir",
      tempDir,
      "--skipLibCheck",
      "--strict",
      "lib/decisionEngine.ts",
    ],
    {
      cwd: root,
      stdio: "pipe",
    }
  );
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return validateRow(JSON.parse(line), index + 1);
      } catch (error) {
        throw new Error(`Invalid dataset line ${index + 1}: ${error.message}`);
      }
    });
}

function validateRow(row, lineNumber) {
  const required = [
    "id",
    "prompt",
    "expectedClassification",
    "expectedSeverity",
    "context",
  ];

  for (const field of required) {
    if (!(field in row)) {
      throw new Error(`missing ${field}`);
    }
  }

  if (!["concerning", "safe"].includes(row.expectedClassification)) {
    throw new Error("expectedClassification must be concerning or safe");
  }

  if (!(row.expectedSeverity in severityOrder)) {
    throw new Error("expectedSeverity must be low, medium, high, or critical");
  }

  if (!row.context || typeof row.context !== "object") {
    throw new Error("context must be an object");
  }

  for (const field of ["inputType", "ageGroup", "childAccess", "appType"]) {
    if (!row.context[field]) {
      throw new Error(`context.${field} is required`);
    }
  }

  return {
    ...row,
    lineNumber,
  };
}

function evaluateRow(row, childSafetyDecision) {
  const result = childSafetyDecision(
    {
      text: row.prompt,
      inputType: row.context.inputType,
      repeatedAttempts: row.context.repeatedAttempts,
      imminentRisk: row.context.imminentRisk,
      involvesTrustedAdult: row.context.involvesTrustedAdult,
      involvesPrivateImages: row.context.involvesPrivateImages,
      involvesLocationOrPII: row.context.involvesLocationOrPII,
      couldEnableHarm: row.context.couldEnableHarm,
      requestedRetention: row.context.requestedRetention,
    },
    {
      ageGroup: row.context.ageGroup,
      vulnerability: row.context.vulnerability ?? "none",
    },
    {
      childAccess: row.context.childAccess,
      appType: row.context.appType,
    },
    {
      policyVersion: "evaluation-dataset",
    },
    {
      createEventId: () => `eval-${row.id}`,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    }
  );
  const expectedConcerning = row.expectedClassification === "concerning";
  const actualFlagged = result.auditRequired;
  const outcome = getOutcome(expectedConcerning, actualFlagged);

  return {
    id: row.id,
    safetyLabel: row.safetyLabel ?? "unspecified",
    expectedClassification: row.expectedClassification,
    actualClassification: actualFlagged ? "concerning" : "safe",
    expectedSeverity: row.expectedSeverity,
    actualSeverity: result.riskLevel,
    severityExact: row.expectedSeverity === result.riskLevel,
    severityDistance: Math.abs(
      severityOrder[row.expectedSeverity] - severityOrder[result.riskLevel]
    ),
    outcome,
    decision: result.decision,
    matchedRules: result.matchedRules.map((rule) => rule.id),
    riskScore: result.riskScore,
  };
}

function getOutcome(expectedConcerning, actualFlagged) {
  if (expectedConcerning && actualFlagged) return "truePositive";
  if (!expectedConcerning && !actualFlagged) return "trueNegative";
  if (!expectedConcerning && actualFlagged) return "falsePositive";

  return "falseNegative";
}

function summarize(results) {
  const stats = {
    total: results.length,
    truePositive: 0,
    trueNegative: 0,
    falsePositive: 0,
    falseNegative: 0,
    severityExact: 0,
    severityDistanceTotal: 0,
  };

  for (const result of results) {
    stats[result.outcome] += 1;
    if (result.severityExact) stats.severityExact += 1;
    stats.severityDistanceTotal += result.severityDistance;
  }

  stats.classificationAccuracy = ratio(
    stats.truePositive + stats.trueNegative,
    stats.total
  );
  stats.precision = ratio(stats.truePositive, stats.truePositive + stats.falsePositive);
  stats.recall = ratio(stats.truePositive, stats.truePositive + stats.falseNegative);
  stats.severityAccuracy = ratio(stats.severityExact, stats.total);
  stats.averageSeverityDistance = stats.total
    ? stats.severityDistanceTotal / stats.total
    : 0;

  return stats;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function printSummary(filePath, stats, results) {
  console.log(`Decision tree evaluation: ${path.relative(root, filePath)}`);
  console.log("");
  console.log("Classification");
  console.log(`  True Positive:  ${stats.truePositive}`);
  console.log(`  True Negative:  ${stats.trueNegative}`);
  console.log(`  False Positive: ${stats.falsePositive}`);
  console.log(`  False Negative: ${stats.falseNegative}`);
  console.log(`  Accuracy:       ${percent(stats.classificationAccuracy)}`);
  console.log(`  Precision:      ${percent(stats.precision)}`);
  console.log(`  Recall:         ${percent(stats.recall)}`);
  console.log("");
  console.log("Severity");
  console.log(`  Exact matches:  ${stats.severityExact}/${stats.total}`);
  console.log(`  Accuracy:       ${percent(stats.severityAccuracy)}`);
  console.log(
    `  Avg distance:   ${stats.averageSeverityDistance.toFixed(2)} severity levels`
  );
  console.log("");
  console.log("Cases");

  for (const result of results) {
    console.log(
      [
        `  ${result.id}`,
        result.safetyLabel,
        result.outcome,
        `expected=${result.expectedClassification}/${result.expectedSeverity}`,
        `actual=${result.actualClassification}/${result.actualSeverity}`,
        `decision=${result.decision}`,
        `rules=${result.matchedRules.join(",") || "none"}`,
      ].join(" | ")
    );
  }
}
