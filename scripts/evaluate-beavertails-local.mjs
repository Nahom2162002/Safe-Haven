import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ?? "data/beavertails-30k-test.jsonl";
const sampleLimit = args.sample ? Number(args.sample) : Infinity;
const textMode = args.text ?? "prompt";
const threshold = args.threshold ?? "medium";
const outputPath = args.output;
const signalsPath = args.signals;
const ageGroupOverride = args["age-group"];
const childAccessOverride = args["child-access"];
const appTypeOverride = args["app-type"];

if (!fs.existsSync(inputPath)) {
  throw new Error(
    `${inputPath} does not exist. Export first: python3 scripts/export-beavertails.py`
  );
}

const { childSafetyDecision } = loadDecisionEngine();
const rows = readJsonl(inputPath).slice(0, sampleLimit);
const externalSignals = signalsPath ? loadSignals(signalsPath) : new Map();
const stats = {
  total: 0,
  tp: 0,
  fp: 0,
  tn: 0,
  fn: 0,
};
const examples = {
  falsePositives: [],
  falseNegatives: [],
  truePositives: [],
  trueNegatives: [],
};
const predictions = [];

rows.forEach((row, index) => {
  if (typeof row.is_safe !== "boolean") return;

  const text = buildInputText(row, textMode);
  const rowSignals = externalSignals.get(index) ?? [];
  const context = buildContext(row);
  const result = childSafetyDecision(
    {
      text,
      inputType: "user_message",
    },
    {
      ageGroup: context.ageGroup,
      vulnerability: context.vulnerability,
    },
    {
      childAccess: context.childAccess,
      appType: context.appType,
    },
    {
      policyVersion: "beavertails-local-eval",
    },
    {
      enableSemanticClassifier: true,
      semanticSignals: rowSignals.length ? rowSignals : undefined,
      createEventId: () => `beavertails-${index}`,
      now: () => new Date("2026-06-22T00:00:00.000Z"),
    }
  );

  const actualUnsafe = row.is_safe === false;
  const predictedUnsafe = isUnsafePrediction(result.riskLevel, threshold);
  const bucket = bucketName(actualUnsafe, predictedUnsafe);

  stats.total += 1;
  stats[bucket] += 1;

  const record = {
    index,
    actualUnsafe,
    predictedUnsafe,
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    decision: result.decision,
    matchedRules: result.matchedRules.map((rule) => rule.id),
    semanticSignals: rowSignals.map((signal) => signal.ruleId),
    context,
    category: row.category,
    prompt: row.prompt,
  };

  predictions.push(record);
  storeExample(examples, bucket, record);
});

const metrics = calculateMetrics(stats);

console.log("\nSafe Haven local evaluation");
console.log("==========================");
console.log(`Input: ${inputPath}`);
console.log(`Rows evaluated: ${stats.total}`);
console.log(`Text mode: ${textMode}`);
console.log(`Unsafe threshold: ${threshold}+`);
console.log(`External signals: ${signalsPath ?? "none"}`);
console.log(
  `Context: ${ageGroupOverride || childAccessOverride || appTypeOverride ? "CLI overrides" : "row context or teen/mixed default"}`
);
console.log("");
console.table({
  TP: stats.tp,
  FP: stats.fp,
  TN: stats.tn,
  FN: stats.fn,
});
console.table(metrics);

printExamples("False positives", examples.falsePositives);
printExamples("False negatives", examples.falseNegatives);

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    predictions.map((item) => JSON.stringify(item)).join("\n") + "\n"
  );
  console.log(`Wrote predictions to ${outputPath}`);
}

function loadDecisionEngine() {
  const outDir = path.join(os.tmpdir(), "safe-haven-eval-engine");
  fs.rmSync(outDir, { recursive: true, force: true });
  execFileSync(
    path.join("node_modules", ".bin", "tsc"),
    [
      "lib/decisionEngine.ts",
      "--target",
      "ES2021",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--outDir",
      outDir,
      "--rootDir",
      ".",
      "--skipLibCheck",
    ],
    { stdio: "pipe" }
  );

  const require = createRequire(import.meta.url);
  return require(path.join(outDir, "lib", "decisionEngine.js"));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function loadSignals(filePath) {
  const signalRows = readJsonl(filePath);
  const byIndex = new Map();

  signalRows.forEach((row) => {
    if (typeof row.index !== "number" || !Array.isArray(row.signals)) return;
    byIndex.set(
      row.index,
      row.signals
        .filter((signal) => signal.ruleId)
        .map((signal) => ({
          ruleId: signal.ruleId,
          label: signal.label ?? signal.ruleId,
          source: "semantic_classifier",
          confidence: Number(signal.confidence ?? 0.5),
          evidence: signal.evidence ?? "",
          rationale: signal.rationale ?? "Local Hugging Face context signal.",
        }))
    );
  });

  return byIndex;
}

function buildInputText(row, mode) {
  if (mode === "prompt_response") {
    return `${row.prompt ?? ""}\n\nResponse:\n${row.response ?? ""}`.trim();
  }

  return String(row.prompt ?? "");
}

function buildContext(row) {
  const rowContext = row.context ?? {};

  return {
    ageGroup: ageGroupOverride ?? rowContext.ageGroup ?? "teen",
    vulnerability: rowContext.vulnerability ?? "none",
    childAccess: childAccessOverride ?? rowContext.childAccess ?? "mixed_audience",
    appType: appTypeOverride ?? rowContext.appType ?? "chatbot",
  };
}

function isUnsafePrediction(riskLevel, unsafeThreshold) {
  const order = ["low", "medium", "high", "critical"];
  return order.indexOf(riskLevel) >= order.indexOf(unsafeThreshold);
}

function bucketName(actualUnsafe, predictedUnsafe) {
  if (actualUnsafe && predictedUnsafe) return "tp";
  if (!actualUnsafe && predictedUnsafe) return "fp";
  if (!actualUnsafe && !predictedUnsafe) return "tn";
  return "fn";
}

function calculateMetrics({ total, tp, fp, tn, fn }) {
  const precision = divide(tp, tp + fp);
  const recall = divide(tp, tp + fn);
  const f1 = divide(2 * precision * recall, precision + recall);

  return {
    accuracy: round(divide(tp + tn, total)),
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    falsePositiveRate: round(divide(fp, fp + tn)),
    falseNegativeRate: round(divide(fn, fn + tp)),
  };
}

function divide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function round(value) {
  return Number(value.toFixed(4));
}

function storeExample(examplesByType, bucket, record) {
  const keyByBucket = {
    tp: "truePositives",
    fp: "falsePositives",
    tn: "trueNegatives",
    fn: "falseNegatives",
  };
  const key = keyByBucket[bucket];

  if (examplesByType[key].length < 5) {
    examplesByType[key].push(record);
  }
}

function printExamples(title, items) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));

  if (items.length === 0) {
    console.log("None in sampled examples.");
    return;
  }

  items.forEach((item) => {
    console.log(
      `#${item.index} risk=${item.riskLevel} score=${item.riskScore} rules=${
        item.matchedRules.join(",") || "none"
      }`
    );
    console.log(`prompt: ${String(item.prompt).slice(0, 220)}`);
  });
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];
    parsed[key] = next && !next.startsWith("--") ? next : "true";
    if (parsed[key] === next) index += 1;
  }

  return parsed;
}
