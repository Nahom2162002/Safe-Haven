#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2024-11-05";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const DEFAULT_AUDIT_PATH = path.join(REPO_ROOT, "audit-trail", "decisions.jsonl");
const DEFAULT_POLICY_VERSION = "safe-haven-mcp-0.1.0";

let compiledEngine;
let buffer = Buffer.alloc(0);

const tools = [
  {
    name: "safe_haven_classify_prompt",
    description:
      "Run the Safe Haven child-safety decision tree for a prompt without storing full conversation content by default.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Prompt, message, AI output, or developer setting to classify.",
        },
        inputType: {
          type: "string",
          enum: ["user_message", "ai_output", "developer_setting", "guardian_setting"],
          default: "user_message",
        },
        ageGroup: {
          type: "string",
          enum: ["child", "teen", "unknown", "verified_adult"],
          default: "unknown",
        },
        vulnerability: {
          type: "string",
          enum: ["none", "moderate", "high"],
          default: "none",
        },
        childAccess: {
          type: "string",
          enum: ["child_directed", "mixed_audience", "unknown", "verified_adult_only"],
          default: "mixed_audience",
        },
        appType: {
          type: "string",
          enum: [
            "chatbot",
            "education",
            "social",
            "gaming",
            "mental_health",
            "adult_platform",
            "general",
          ],
          default: "chatbot",
        },
        repeatedAttempts: { type: "boolean", default: false },
        imminentRisk: { type: "boolean", default: false },
        involvesTrustedAdult: { type: "boolean", default: false },
        involvesPrivateImages: { type: "boolean", default: false },
        involvesLocationOrPII: { type: "boolean", default: false },
        couldEnableHarm: { type: "boolean", default: false },
        requestedRetention: {
          type: "string",
          enum: [
            "NO_CONTENT",
            "METADATA_ONLY",
            "REDACTED_EXCERPT",
            "FULL_CONTENT_REQUIRES_JUSTIFICATION",
          ],
        },
        semanticSignals: {
          type: "array",
          description:
            "Optional external context signals from an LLM or classifier. Final action remains controlled by locked rules.",
          items: {
            type: "object",
            properties: {
              ruleId: { type: "string" },
              label: { type: "string" },
              source: {
                type: "string",
                enum: ["semantic_classifier", "llm_backend"],
              },
              confidence: { type: "number" },
              evidence: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["ruleId"],
          },
        },
        appendAudit: {
          type: "boolean",
          default: false,
          description:
            "Append a metadata-only governance entry to audit-trail/decisions.jsonl. Full prompt text is not stored.",
        },
        includePromptPreviewInAudit: {
          type: "boolean",
          default: false,
          description:
            "Include a short prompt preview in the audit entry. Keep false for sensitive child conversations.",
        },
        policyVersion: {
          type: "string",
          default: DEFAULT_POLICY_VERSION,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "safe_haven_review_feature_plan",
    description:
      "Review a proposed AI/chat feature for child-safety, privacy, retention, escalation, oversight, and audit guardrails before implementation.",
    inputSchema: {
      type: "object",
      properties: {
        featurePlan: {
          type: "string",
          description: "Developer's proposed feature, architecture, or implementation plan.",
        },
        ageGroup: {
          type: "string",
          enum: ["child", "teen", "unknown", "verified_adult"],
          default: "unknown",
        },
        childAccess: {
          type: "string",
          enum: ["child_directed", "mixed_audience", "unknown", "verified_adult_only"],
          default: "mixed_audience",
        },
        appType: {
          type: "string",
          enum: [
            "chatbot",
            "education",
            "social",
            "gaming",
            "mental_health",
            "adult_platform",
            "general",
          ],
          default: "chatbot",
        },
      },
      required: ["featurePlan"],
    },
  },
  {
    name: "safe_haven_review_code_diff",
    description:
      "Review a code diff for missing child-safety defaults, retention controls, escalation logic, audit logging, tests, and rights-sensitive behavior.",
    inputSchema: {
      type: "object",
      properties: {
        diff: {
          type: "string",
          description: "Code diff or patch text to review.",
        },
        childAccess: {
          type: "string",
          enum: ["child_directed", "mixed_audience", "unknown", "verified_adult_only"],
          default: "mixed_audience",
        },
        appType: {
          type: "string",
          enum: [
            "chatbot",
            "education",
            "social",
            "gaming",
            "mental_health",
            "adult_platform",
            "general",
          ],
          default: "chatbot",
        },
      },
      required: ["diff"],
    },
  },
  {
    name: "safe_haven_review_retention_policy",
    description:
      "Review a proposed data-retention policy for child-safety chat systems and recommend minimization controls.",
    inputSchema: {
      type: "object",
      properties: {
        policyText: {
          type: "string",
          description: "Retention, logging, analytics, training-data, or audit-storage proposal.",
        },
        requestedRetention: {
          type: "string",
          enum: [
            "NO_CONTENT",
            "METADATA_ONLY",
            "REDACTED_EXCERPT",
            "FULL_CONTENT_REQUIRES_JUSTIFICATION",
          ],
        },
        childAccess: {
          type: "string",
          enum: ["child_directed", "mixed_audience", "unknown", "verified_adult_only"],
          default: "mixed_audience",
        },
      },
      required: ["policyText"],
    },
  },
  {
    name: "safe_haven_generate_required_tests",
    description:
      "Generate child-safety governance tests for a proposed AI/chat feature or matched rule set.",
    inputSchema: {
      type: "object",
      properties: {
        featurePlan: { type: "string" },
        matchedRules: {
          type: "array",
          items: { type: "string" },
        },
        appType: {
          type: "string",
          enum: [
            "chatbot",
            "education",
            "social",
            "gaming",
            "mental_health",
            "adult_platform",
            "general",
          ],
          default: "chatbot",
        },
      },
    },
  },
  {
    name: "safe_haven_generate_audit_finding",
    description:
      "Create a metadata-only audit finding for a developer governance decision, suitable for the Safe Haven paper trail.",
    inputSchema: {
      type: "object",
      properties: {
        decision: {
          type: "string",
          description: "Developer decision or feature choice being recorded.",
        },
        riskLevel: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        matchedRules: {
          type: "array",
          items: { type: "string" },
        },
        retentionMode: {
          type: "string",
          enum: [
            "NO_CONTENT",
            "METADATA_ONLY",
            "REDACTED_EXCERPT",
            "FULL_CONTENT_REQUIRES_JUSTIFICATION",
          ],
          default: "METADATA_ONLY",
        },
        humanOversight: {
          type: "string",
          description: "Human oversight requirement or rationale.",
        },
        appendAudit: {
          type: "boolean",
          default: false,
          description: "Append the finding to audit-trail/decisions.jsonl.",
        },
      },
      required: ["decision"],
    },
  },
  {
    name: "safe_haven_list_locked_rules",
    description:
      "List locked, non-disableable Safe Haven governance and harm rules with source-backed references.",
    inputSchema: {
      type: "object",
      properties: {
        includeReferences: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "safe_haven_validate_audit_trail",
    description:
      "Validate the Safe Haven JSONL paper trail and any hash-chain fields added by the MCP server.",
    inputSchema: {
      type: "object",
      properties: {
        auditPath: {
          type: "string",
          default: "audit-trail/decisions.jsonl",
        },
      },
    },
  },
  {
    name: "safe_haven_summarize_audit_trail",
    description:
      "Summarize the audit trail for a human-readable report without exposing full prompt content.",
    inputSchema: {
      type: "object",
      properties: {
        auditPath: {
          type: "string",
          default: "audit-trail/decisions.jsonl",
        },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "safe_haven_evaluate_jsonl",
    description:
      "Evaluate a JSONL dataset with prompt and is_safe fields through the decision tree and return confusion-matrix metrics.",
    inputSchema: {
      type: "object",
      properties: {
        inputPath: {
          type: "string",
          description: "Path to a JSONL file containing prompt and is_safe boolean fields.",
        },
        sample: { type: "number", default: 200 },
        threshold: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        ageGroup: {
          type: "string",
          enum: ["child", "teen", "unknown", "verified_adult"],
          default: "teen",
        },
        childAccess: {
          type: "string",
          enum: ["child_directed", "mixed_audience", "unknown", "verified_adult_only"],
          default: "mixed_audience",
        },
        appType: {
          type: "string",
          enum: [
            "chatbot",
            "education",
            "social",
            "gaming",
            "mental_health",
            "adult_platform",
            "general",
          ],
          default: "chatbot",
        },
      },
      required: ["inputPath"],
    },
  },
];

const resources = [
  {
    uri: "safe-haven://rules/locked",
    name: "Safe Haven locked rules",
    description: "Source-backed locked child-safety and governance rules.",
    mimeType: "application/json",
  },
  {
    uri: "safe-haven://audit/summary",
    name: "Safe Haven audit summary",
    description: "Metadata-only summary of audit-trail/decisions.jsonl.",
    mimeType: "application/json",
  },
  {
    uri: "safe-haven://docs/architecture",
    name: "Safe Haven architecture",
    description: "Architecture notes if docs/architecture.md is present.",
    mimeType: "text/markdown",
  },
];

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  parseMessages();
});

process.stdin.on("end", () => {
  if (buffer.length > 0) {
    parseNewlineMessages(true);
  }
});

function parseMessages() {
  while (buffer.length > 0) {
    const framing = findHeaderEnd(buffer);

    if (!framing) {
      if (looksLikeNewlineJsonMessage(buffer)) {
        parseNewlineMessages(false);
      }
      return;
    }

    const headerText = buffer.subarray(0, framing.headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(headerText);

    if (!match) {
      if (looksLikeNewlineJsonMessage(buffer)) {
        parseNewlineMessages(false);
        continue;
      }
      throw new Error(`Invalid MCP header: ${headerText}`);
      return;
    }

    const contentLength = Number(match[1]);
    const messageStart = framing.bodyStart;
    const messageEnd = messageStart + contentLength;

    if (buffer.length < messageEnd) return;

    const body = buffer.subarray(messageStart, messageEnd).toString("utf8");
    buffer = buffer.subarray(messageEnd);
    handleMessage(JSON.parse(body));
  }
}

function findHeaderEnd(input) {
  const crlfEnd = input.indexOf("\r\n\r\n");
  const lfEnd = input.indexOf("\n\n");

  if (crlfEnd === -1 && lfEnd === -1) return null;

  if (crlfEnd !== -1 && (lfEnd === -1 || crlfEnd < lfEnd)) {
    return { headerEnd: crlfEnd, bodyStart: crlfEnd + 4 };
  }

  return { headerEnd: lfEnd, bodyStart: lfEnd + 2 };
}

function looksLikeNewlineJsonMessage(input) {
  const trimmed = input.toString("utf8").trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseNewlineMessages(flush) {
  while (buffer.length > 0) {
    const newline = buffer.indexOf("\n");

    if (newline === -1) {
      if (!flush) return;
      const line = buffer.toString("utf8").trim();
      buffer = Buffer.alloc(0);
      if (line) handleMessage(JSON.parse(line));
      return;
    }

    const line = buffer.subarray(0, newline).toString("utf8").trim();
    buffer = buffer.subarray(newline + 1);
    if (line) handleMessage(JSON.parse(line));
  }
}

function handleMessage(message) {
  if (!message || typeof message !== "object") return;

  if (!("id" in message)) {
    return;
  }

  Promise.resolve()
    .then(() => dispatch(message))
    .then((result) => send({ jsonrpc: "2.0", id: message.id, result }))
    .catch((error) => {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    });
}

async function dispatch(message) {
  const params = message.params ?? {};

  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
        },
        serverInfo: {
          name: "safe-haven",
          version: SERVER_VERSION,
        },
      };
    case "tools/list":
      return { tools };
    case "tools/call":
      return callTool(params.name, params.arguments ?? {});
    case "resources/list":
      return { resources };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "resources/read":
      return readResource(params.uri);
    case "prompts/list":
      return { prompts: [] };
    case "ping":
      return {};
    default:
      throw new Error(`Unsupported MCP method: ${message.method}`);
  }
}

function callTool(name, args) {
  switch (name) {
    case "safe_haven_classify_prompt":
      return classifyPrompt(args);
    case "safe_haven_review_feature_plan":
      return reviewFeaturePlan(args);
    case "safe_haven_review_code_diff":
      return reviewCodeDiff(args);
    case "safe_haven_review_retention_policy":
      return reviewRetentionPolicy(args);
    case "safe_haven_generate_required_tests":
      return generateRequiredTests(args);
    case "safe_haven_generate_audit_finding":
      return generateAuditFinding(args);
    case "safe_haven_list_locked_rules":
      return listLockedRules(args);
    case "safe_haven_validate_audit_trail":
      return validateAuditTrail(args);
    case "safe_haven_summarize_audit_trail":
      return summarizeAuditTrail(args);
    case "safe_haven_evaluate_jsonl":
      return evaluateJsonl(args);
    default:
      throw new Error(`Unknown Safe Haven tool: ${name}`);
  }
}

function classifyPrompt(args) {
  assertString(args.prompt, "prompt");
  const engine = loadDecisionEngine();
  const result = engine.childSafetyDecision(
    {
      text: args.prompt,
      inputType: args.inputType ?? "user_message",
      repeatedAttempts: Boolean(args.repeatedAttempts),
      imminentRisk: Boolean(args.imminentRisk),
      involvesTrustedAdult: Boolean(args.involvesTrustedAdult),
      involvesPrivateImages: Boolean(args.involvesPrivateImages),
      involvesLocationOrPII: Boolean(args.involvesLocationOrPII),
      couldEnableHarm: Boolean(args.couldEnableHarm),
      requestedRetention: args.requestedRetention,
    },
    {
      ageGroup: args.ageGroup ?? "unknown",
      vulnerability: args.vulnerability ?? "none",
    },
    {
      childAccess: args.childAccess ?? "mixed_audience",
      appType: args.appType ?? "chatbot",
    },
    {
      policyVersion: args.policyVersion ?? DEFAULT_POLICY_VERSION,
    },
    {
      enableSemanticClassifier: true,
      semanticSignals: normalizeSignals(args.semanticSignals),
    }
  );

  const response = {
    decision: result.decision,
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    appliedPolicy: result.appliedPolicy,
    retentionMode: result.retentionMode,
    humanReviewRequired: result.humanReviewRequired,
    auditRequired: result.auditRequired,
    matchedRules: result.matchedRules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      category: rule.category,
      baseRisk: rule.baseRisk,
      riskType: rule.riskType,
      whyRisk: rule.whyRisk,
      userGuidance: rule.userGuidance,
      matchReason: rule.matchReason,
      detectionSources: rule.detectionSources ?? [],
      sources: sourceChips(rule),
    })),
    detectionSignals: result.detectionSignals,
    context: result.context,
    explanation: result.explanation,
    decisionTrace: result.decisionTrace,
    auditEvent: {
      ...result.audit,
      promptHash: sha256(args.prompt),
      promptStored: false,
    },
  };

  if (args.appendAudit) {
    response.appendedAudit = appendGovernanceAuditEntry(result, args);
  }

  return jsonContent(response);
}

function reviewFeaturePlan(args) {
  assertString(args.featurePlan, "featurePlan");
  const review = buildDeveloperGovernanceReview({
    text: args.featurePlan,
    reviewType: "feature_plan",
    ageGroup: args.ageGroup ?? "unknown",
    childAccess: args.childAccess ?? "mixed_audience",
    appType: args.appType ?? "chatbot",
  });

  return jsonContent(review);
}

function reviewCodeDiff(args) {
  assertString(args.diff, "diff");
  const review = buildDeveloperGovernanceReview({
    text: args.diff,
    reviewType: "code_diff",
    ageGroup: "unknown",
    childAccess: args.childAccess ?? "mixed_audience",
    appType: args.appType ?? "chatbot",
  });
  const diffFindings = inferDiffFindings(args.diff);

  return jsonContent({
    ...review,
    diff_findings: diffFindings,
    copilot_instruction: [
      review.copilot_instruction,
      diffFindings.required_changes.length
        ? `Before merging, address: ${diffFindings.required_changes.join("; ")}.`
        : "No obvious code-diff guardrail gaps were detected, but retain tests and audit validation.",
    ].join(" "),
  });
}

function reviewRetentionPolicy(args) {
  assertString(args.policyText, "policyText");
  const review = buildDeveloperGovernanceReview({
    text: args.policyText,
    reviewType: "retention_policy",
    ageGroup: "unknown",
    childAccess: args.childAccess ?? "mixed_audience",
    appType: "chatbot",
    requestedRetention: args.requestedRetention,
  });
  const lower = args.policyText.toLowerCase();
  const proposesFullRetention =
    /\b(full|entire|raw|complete)\b.*\b(chat|conversation|message|transcript|history|log)s?\b/.test(
      lower
    ) ||
    /\b(store|save|retain|keep)\b.*\b(all|every|raw)\b/.test(lower) ||
    args.requestedRetention === "FULL_CONTENT_REQUIRES_JUSTIFICATION";

  return jsonContent({
    ...review,
    retention_review: {
      requestedRetention: args.requestedRetention ?? "unspecified",
      default_recommendation: proposesFullRetention
        ? "Do not store full child conversations by default. Use METADATA_ONLY by default and REDACTED_EXCERPT only for justified review."
        : "Prefer METADATA_ONLY by default, with REDACTED_EXCERPT for high-risk human review.",
      requires_justification: proposesFullRetention,
      minimum_controls: [
        "Document retention purpose and deletion window.",
        "Hash or omit prompt content where possible.",
        "Use redacted excerpts for high-risk case review.",
        "Restrict access to trained reviewers.",
        "Log retention decisions in the audit trail.",
      ],
    },
  });
}

function generateRequiredTests(args) {
  const matchedRules = Array.isArray(args.matchedRules)
    ? args.matchedRules.map(String)
    : inferDeveloperRuleIds(args.featurePlan ?? "", {
        childAccess: "mixed_audience",
        appType: args.appType ?? "chatbot",
      });
  const tests = buildRequiredTests(matchedRules, args.featurePlan ?? "");

  return jsonContent({
    matched_rules: unique(matchedRules),
    recommended_tests: tests,
    minimum_assertions: [
      "High-risk outcomes require humanReviewRequired=true.",
      "Critical outcomes select URGENT_ESCALATION or BLOCK_AND_AUDIT.",
      "Child-accessible contexts do not default to adult policy for unknown age.",
      "Retention is NO_CONTENT or METADATA_ONLY for low-risk cases.",
      "High-risk review stores only REDACTED_EXCERPT unless explicit justification exists.",
      "Audit events include policy, matched rules, action, retention, and oversight.",
    ],
  });
}

function generateAuditFinding(args) {
  assertString(args.decision, "decision");
  const finding = {
    eventId: `mcp_finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: "developer_governance_finding",
    decision: args.decision,
    tradeoffs: inferAuditTradeoffs(args.decision),
    retentionMode: args.retentionMode ?? "METADATA_ONLY",
    humanOversight:
      args.humanOversight ??
      (args.riskLevel === "high" || args.riskLevel === "critical"
        ? "Human review required for high-risk or rights-sensitive child-safety outcomes."
        : "Human review not required unless additional risk signals appear."),
    references: referencesForRuleIds(args.matchedRules ?? []),
    matchedRules: Array.isArray(args.matchedRules) ? args.matchedRules : [],
    riskLevel: args.riskLevel ?? "medium",
  };

  const response = { finding, appendedAudit: null };

  if (args.appendAudit) {
    const previousHash = lastAuditHash(DEFAULT_AUDIT_PATH);
    const entry = { ...finding, previousHash };
    entry.entryHash = hashAuditEntry(entry);
    fs.mkdirSync(path.dirname(DEFAULT_AUDIT_PATH), { recursive: true });
    fs.appendFileSync(DEFAULT_AUDIT_PATH, `${JSON.stringify(entry)}\n`);
    response.appendedAudit = {
      auditPath: path.relative(REPO_ROOT, DEFAULT_AUDIT_PATH),
      eventId: entry.eventId,
      previousHash: entry.previousHash,
      entryHash: entry.entryHash,
    };
  }

  return jsonContent(response);
}

function buildDeveloperGovernanceReview({
  text,
  reviewType,
  ageGroup,
  childAccess,
  appType,
  requestedRetention,
}) {
  const engine = loadDecisionEngine();
  const ruleIds = inferDeveloperRuleIds(text, { childAccess, appType, requestedRetention });
  const rules = ruleIds.map((id) => engine.LOCKED_RULES[id]).filter(Boolean);
  const riskLevel = deriveDeveloperRiskLevel(ruleIds, text);
  const governanceRequired = shouldRequireGovernance(text, childAccess, appType, ruleIds);
  const retentionMode = recommendDeveloperRetention(text, riskLevel, requestedRetention);
  const requiredControls = buildRequiredControls(ruleIds, text, {
    governanceRequired,
    retentionMode,
    childAccess,
  });
  const blockedDesignChoices = buildBlockedDesignChoices(text, ruleIds);
  const recommendedTests = buildRequiredTests(ruleIds, text);

  return {
    governance_required: governanceRequired,
    review_type: reviewType,
    reason: buildGovernanceReason({ text, childAccess, appType, governanceRequired }),
    matched_rules: ruleIds,
    matched_rule_details: rules.map((rule) => ({
      id: rule.id,
      label: rule.label,
      riskType: rule.riskType,
      whyRisk: rule.whyRisk,
      sources: sourceChips(rule),
    })),
    risk_level: riskLevel,
    recommended_retention: retentionMode,
    human_oversight_required: ["high", "critical"].includes(riskLevel),
    required_controls: requiredControls,
    blocked_design_choices: blockedDesignChoices,
    recommended_tests: recommendedTests,
    source_references: unique(
      rules.flatMap((rule) =>
        (rule.complianceReferences ?? []).map((reference) => ({
          publisher: reference.publisher,
          title: reference.title,
          url: reference.url,
          principle: reference.principle,
        }))
      )
    ),
    copilot_instruction:
      "Before implementing, add child-safe policy config, retention minimization, audit logging, high-risk escalation, and tests for false positives and false negatives.",
  };
}

function inferDeveloperRuleIds(text, context) {
  const lower = String(text).toLowerCase();
  const ids = new Set();
  const childAccessible =
    context.childAccess !== "verified_adult_only" ||
    /\b(child|children|kid|kids|minor|teen|teens|student|school|guardian|parent)\b/.test(
      lower
    );

  if (childAccessible || context.appType === "chatbot") ids.add("R0");
  if (/\b(chatbot|companion|ai chat|prompt|moderation|classifier|llm|model|agent)\b/.test(lower)) {
    ids.add("R15");
  }
  if (/\b(self[- ]?harm|suicid|crisis|distress|mental health|depress|cutting)\b/.test(lower)) {
    ids.add("R5");
  }
  if (/\b(groom|sextortion|coerc|secret|private contact|dm|direct message)\b/.test(lower)) {
    ids.add("R2");
  }
  if (/\b(nude|intimate|sexual image|explicit image|deepfake|revenge porn|private image)\b/.test(lower)) {
    ids.add("R3");
  }
  if (/\b(bully|harass|humiliat|impersonat|threaten|peer)\b/.test(lower)) {
    ids.add("R4");
  }
  if (/\b(abuse|neglect|traffick|exploit|unsafe home|violence|guardian notification)\b/.test(lower)) {
    ids.add("R6");
  }
  if (/\b(porn|sexual|graphic|adult content|age[- ]?inappropriate)\b/.test(lower)) {
    ids.add("R7");
  }
  if (/\b(discriminat|fairness|bias|race|gender|sex|disability|dialect|culture|language)\b/.test(lower)) {
    ids.add("R8");
  }
  if (/\b(location|address|phone|email|pii|personal data|privacy|dox|school name)\b/.test(lower)) {
    ids.add("R9");
  }
  if (
    /\b(store|save|retain|log|history|transcript|analytics|train|fine[- ]?tune|dataset)\b/.test(
      lower
    ) ||
    context.requestedRetention === "FULL_CONTENT_REQUIRES_JUSTIFICATION"
  ) {
    ids.add("R10");
  }
  if (/\b(guardian|parent|notify|notification|report to|escalat|human review|moderator)\b/.test(lower)) {
    ids.add("R11");
  }
  if (/\b(age gate|age assurance|verify age|unknown age|adult only|under 18)\b/.test(lower)) {
    ids.add("R12");
  }
  if (/\b(weapon|explosive|poison|biohazard|biochemical|kill|attack|harm people)\b/.test(lower)) {
    ids.add("R13");
  }
  if (/\b(steal|bypass|evade|illegal|crime|fraud|stalk|blackmail|dox)\b/.test(lower)) {
    ids.add("R14");
  }

  return Array.from(ids);
}

function deriveDeveloperRiskLevel(ruleIds, text) {
  const lower = String(text).toLowerCase();
  if (ruleIds.some((id) => ["R1", "R2", "R5", "R6", "R13"].includes(id))) {
    return "critical";
  }
  if (
    ruleIds.some((id) => ["R3", "R7", "R9", "R10", "R11", "R14", "R15"].includes(id)) ||
    /\b(full|raw|entire)\b.*\b(chat|conversation|transcript|history)\b/.test(lower)
  ) {
    return "high";
  }
  if (ruleIds.some((id) => ["R0", "R4", "R8", "R12"].includes(id))) return "medium";
  return "low";
}

function shouldRequireGovernance(text, childAccess, appType, ruleIds) {
  return (
    childAccess !== "verified_adult_only" ||
    appType !== "adult_platform" ||
    ruleIds.length > 0 ||
    /\b(child|teen|student|school|chatbot|moderation|ai|llm|message|retention)\b/i.test(text)
  );
}

function recommendDeveloperRetention(text, riskLevel, requestedRetention) {
  const lower = String(text).toLowerCase();
  if (requestedRetention === "FULL_CONTENT_REQUIRES_JUSTIFICATION") {
    return "FULL_CONTENT_REQUIRES_JUSTIFICATION";
  }
  if (/\b(full|raw|entire|complete)\b.*\b(chat|conversation|transcript|history|log)\b/.test(lower)) {
    return "FULL_CONTENT_REQUIRES_JUSTIFICATION";
  }
  if (riskLevel === "critical" || riskLevel === "high") return "REDACTED_EXCERPT";
  if (riskLevel === "medium") return "METADATA_ONLY";
  return "NO_CONTENT";
}

function buildGovernanceReason({ text, childAccess, appType, governanceRequired }) {
  if (!governanceRequired) return "No obvious child-safety governance trigger was detected.";
  if (childAccess === "child_directed") {
    return "Feature is child-directed, so child-safe defaults apply regardless of claimed user age.";
  }
  if (childAccess === "mixed_audience" || childAccess === "unknown") {
    return `Feature is a ${childAccess} ${appType} service and may be accessed by children or unknown-age users.`;
  }
  if (/\b(child|teen|student|school|guardian|parent)\b/i.test(text)) {
    return "Feature text mentions children, teens, school, or guardians, so child-rights review is required.";
  }
  return "Feature affects AI/chat safety, retention, escalation, or audit behavior.";
}

function buildRequiredControls(ruleIds, text, context) {
  const controls = new Set();

  if (context.governanceRequired) {
    controls.add("Apply child-safe defaults for child-directed, mixed-audience, and unknown-age contexts.");
    controls.add("Separate context policy from harm-rule matching.");
  }
  if (ruleIds.includes("R5")) {
    controls.add("Add self-harm crisis escalation with trained human review and urgent support routing.");
  }
  if (ruleIds.includes("R2") || ruleIds.includes("R6")) {
    controls.add("Add safeguarding escalation for grooming, coercion, abuse, neglect, trafficking, or exploitation.");
  }
  if (ruleIds.includes("R3")) {
    controls.add("Block sharing or storing non-consensual intimate images and route cases to trained review.");
  }
  if (ruleIds.includes("R7")) {
    controls.add("Refuse or redirect age-inappropriate sexual or graphic content in child-safe contexts.");
  }
  if (ruleIds.includes("R9")) {
    controls.add("Minimize and redact location, school, contact, and personal data.");
  }
  if (ruleIds.includes("R10") || /\b(store|retain|log|history|transcript|train|analytics)\b/i.test(text)) {
    controls.add(`Use ${context.retentionMode} retention unless a documented rights review justifies more.`);
    controls.add("Add deletion windows, access controls, and audit entries for retention decisions.");
  }
  if (ruleIds.includes("R11")) {
    controls.add("Make guardian notification necessary and proportionate; avoid blanket surveillance.");
  }
  if (ruleIds.includes("R15")) {
    controls.add("Log decisions with matched rules, risk, action, retention, oversight, and source references.");
  }

  controls.add("Add tests for high-risk true positives, benign false positives, and child/adult context differences.");

  return Array.from(controls);
}

function buildBlockedDesignChoices(text, ruleIds) {
  const choices = new Set([
    "Do not store full child conversations by default.",
    "Do not silently escalate or notify guardians without a visible, source-backed reason.",
    "Do not treat unknown age as harm evidence by itself.",
  ]);

  if (/\b(train|fine[- ]?tune|analytics|dataset)\b/i.test(text) || ruleIds.includes("R10")) {
    choices.add("Do not train models on child conversations without explicit governance review and minimization.");
  }
  if (/\bguardian|parent|notify|notification\b/i.test(text) || ruleIds.includes("R11")) {
    choices.add("Do not notify guardians for all medium-risk messages without necessity and proportionality review.");
  }
  if (ruleIds.includes("R3")) {
    choices.add("Do not store, display, or forward intimate images as ordinary audit evidence.");
  }

  return Array.from(choices);
}

function buildRequiredTests(ruleIds, text) {
  const tests = new Set([
    "Unknown-age user in a mixed-audience chatbot asks for adult content.",
    "Benign child-safe message does not trigger high-risk escalation.",
    "High-risk decision emits an audit event with matched rules, retention, and oversight.",
  ]);

  if (ruleIds.includes("R5") || /mental health|self[- ]?harm|crisis/i.test(text)) {
    tests.add("Teen expresses suicidal ideation and receives urgent escalation plus human review.");
  }
  if (ruleIds.includes("R2")) {
    tests.add("Adult attempts secrecy or private contact with a teen and triggers grooming escalation.");
  }
  if (ruleIds.includes("R3")) {
    tests.add("Teen threatens to share nude images of a classmate and triggers image-abuse escalation.");
  }
  if (ruleIds.includes("R4")) {
    tests.add("Peer bullying message triggers a medium-risk review without over-retaining content.");
  }
  if (ruleIds.includes("R6")) {
    tests.add("Message suggests trafficking, abuse, neglect, or unsafe home conditions and triggers safeguarding escalation.");
  }
  if (ruleIds.includes("R9")) {
    tests.add("Child shares school name, address, or phone number and retention redacts personal data.");
  }
  if (ruleIds.includes("R10")) {
    tests.add("Full conversation storage request requires developer justification and rights review.");
  }
  if (ruleIds.includes("R11")) {
    tests.add("Guardian notification is sent only for necessary and proportionate high-risk cases.");
  }
  if (ruleIds.includes("R13") || ruleIds.includes("R14")) {
    tests.add("Dangerous or illegal instruction request is refused and audited.");
  }

  return Array.from(tests);
}

function inferDiffFindings(diff) {
  const lower = String(diff).toLowerCase();
  const requiredChanges = [];
  const presentControls = [];

  if (/\b(retention|store|save|log|history|transcript)\b/.test(lower)) {
    if (!/\b(metadata|redact|redacted|no_content|delete|ttl|retentionmode)\b/.test(lower)) {
      requiredChanges.push("Add explicit retention mode, redaction, and deletion controls.");
    } else {
      presentControls.push("Retention or redaction language detected.");
    }
  }
  if (/\b(escalat|human review|moderator|guardian|notify)\b/.test(lower)) {
    if (!/\b(threshold|critical|high|necessary|proportionate)\b/.test(lower)) {
      requiredChanges.push("Tie escalation or guardian notification to risk thresholds and proportionality checks.");
    } else {
      presentControls.push("Escalation threshold language detected.");
    }
  }
  if (/\b(child|teen|minor|unknown age|mixed audience|childaccess)\b/.test(lower)) {
    if (!/\b(child_safe|child-safe|unknownage|agegroup|age assurance)\b/.test(lower)) {
      requiredChanges.push("Add child-safe defaults and explicit age/context handling.");
    } else {
      presentControls.push("Child context handling detected.");
    }
  }
  if (/\b(decision|risk|moderation|classifier|prompt)\b/.test(lower)) {
    if (!/\b(audit|event|jsonl|trace|explanation)\b/.test(lower)) {
      requiredChanges.push("Add audit events and human-readable explanations for risk decisions.");
    } else {
      presentControls.push("Audit or trace language detected.");
    }
  }
  if (!/\b(test|expect|it\(|describe\()\b/.test(lower)) {
    requiredChanges.push("Add tests for child-safe defaults, high-risk escalation, and benign false positives.");
  } else {
    presentControls.push("Test code detected.");
  }

  return {
    present_controls: presentControls,
    required_changes: requiredChanges,
  };
}

function inferAuditTradeoffs(decision) {
  const lower = String(decision).toLowerCase();
  const tradeoffs = [
    "Safety vs privacy",
    "False positives vs false negatives",
    "Automation vs human oversight",
  ];

  if (/\b(store|retain|log|history|transcript|train|analytics)\b/.test(lower)) {
    tradeoffs.push("Data minimization vs model improvement");
  }
  if (/\b(fairness|bias|race|gender|disability|language|dialect|culture)\b/.test(lower)) {
    tradeoffs.push("Fairness across age, language, disability, culture, dialect, and writing style");
  }
  if (/\b(security|access|credential|pii|personal data)\b/.test(lower)) {
    tradeoffs.push("Cybersecurity and access control for sensitive child-safety records");
  }

  return tradeoffs;
}

function referencesForRuleIds(ruleIds) {
  const engine = loadDecisionEngine();
  const rules = Array.isArray(ruleIds)
    ? ruleIds.map((id) => engine.LOCKED_RULES[id]).filter(Boolean)
    : [];

  return unique(
    rules.flatMap((rule) =>
      (rule.complianceReferences ?? []).map(
        (reference) => `${reference.publisher}: ${reference.title}`
      )
    )
  );
}

function listLockedRules(args) {
  const engine = loadDecisionEngine();
  const rules = Object.values(engine.LOCKED_RULES).map((rule) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    category: rule.category,
    baseRisk: rule.baseRisk,
    riskType: rule.riskType,
    whyRisk: rule.whyRisk,
    userGuidance: rule.userGuidance,
    locked: rule.locked,
    enabled: rule.enabled,
    references:
      args.includeReferences === false ? undefined : rule.complianceReferences ?? [],
  }));

  return jsonContent({ count: rules.length, rules });
}

function validateAuditTrail(args) {
  const auditPath = resolveRepoPath(args.auditPath ?? "audit-trail/decisions.jsonl");
  const lines = readJsonlLines(auditPath);
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
  const issues = [];
  let previousHash = null;
  let hashChecked = 0;

  lines.forEach((entry, index) => {
    for (const field of requiredFields) {
      if (!(field in entry)) {
        issues.push(`Line ${index + 1} is missing required field: ${field}`);
      }
    }

    if ("previousHash" in entry || "entryHash" in entry) {
      hashChecked += 1;
      if (entry.previousHash !== previousHash) {
        issues.push(`Line ${index + 1} has unexpected previousHash.`);
      }

      const expected = hashAuditEntry(entry);
      if (entry.entryHash !== expected) {
        issues.push(`Line ${index + 1} has invalid entryHash.`);
      }
    }

    previousHash = entry.entryHash ?? sha256(stableStringify(entry));
  });

  return jsonContent({
    ok: issues.length === 0,
    auditPath: path.relative(REPO_ROOT, auditPath),
    entries: lines.length,
    hashChecked,
    issues,
  });
}

function summarizeAuditTrail(args) {
  const auditPath = resolveRepoPath(args.auditPath ?? "audit-trail/decisions.jsonl");
  const limit = Math.max(1, Math.min(Number(args.limit ?? 20), 100));
  const entries = readJsonlLines(auditPath);
  const byType = countBy(entries, "type");
  const byRetention = countBy(entries, "retentionMode");
  const recent = entries.slice(-limit).map((entry) => ({
    eventId: entry.eventId,
    timestamp: entry.timestamp,
    type: entry.type,
    decision: entry.decision,
    retentionMode: entry.retentionMode,
    humanOversight: entry.humanOversight,
    references: entry.references,
  }));

  return jsonContent({
    auditPath: path.relative(REPO_ROOT, auditPath),
    entries: entries.length,
    byType,
    byRetention,
    recent,
  });
}

function evaluateJsonl(args) {
  assertString(args.inputPath, "inputPath");
  const inputPath = resolveRepoPath(args.inputPath);
  const rows = readJsonlLines(inputPath).slice(0, Number(args.sample ?? 200));
  const engine = loadDecisionEngine();
  const threshold = args.threshold ?? "medium";
  const stats = { total: 0, tp: 0, fp: 0, tn: 0, fn: 0 };
  const examples = { falsePositives: [], falseNegatives: [] };

  rows.forEach((row, index) => {
    if (typeof row.is_safe !== "boolean" || typeof row.prompt !== "string") return;

    const context = row.context ?? {};
    const result = engine.childSafetyDecision(
      {
        text: row.prompt,
        inputType: "user_message",
      },
      {
        ageGroup: args.ageGroup ?? context.ageGroup ?? "teen",
        vulnerability: context.vulnerability ?? "none",
      },
      {
        childAccess: args.childAccess ?? context.childAccess ?? "mixed_audience",
        appType: args.appType ?? context.appType ?? "chatbot",
      },
      {
        policyVersion: DEFAULT_POLICY_VERSION,
      },
      {
        enableSemanticClassifier: true,
        createEventId: () => `mcp-eval-${index}`,
        now: () => new Date("2026-06-22T00:00:00.000Z"),
      }
    );

    const actualUnsafe = row.is_safe === false;
    const predictedUnsafe = isUnsafePrediction(result.riskLevel, threshold);
    const bucket = bucketName(actualUnsafe, predictedUnsafe);
    stats.total += 1;
    stats[bucket] += 1;

    if (bucket === "fp" && examples.falsePositives.length < 5) {
      examples.falsePositives.push(exampleRecord(index, row, result));
    }
    if (bucket === "fn" && examples.falseNegatives.length < 5) {
      examples.falseNegatives.push(exampleRecord(index, row, result));
    }
  });

  return jsonContent({
    inputPath: path.relative(REPO_ROOT, inputPath),
    threshold,
    confusion: {
      TP: stats.tp,
      FP: stats.fp,
      TN: stats.tn,
      FN: stats.fn,
    },
    metrics: calculateMetrics(stats),
    examples,
  });
}

function readResource(uri) {
  if (uri === "safe-haven://rules/locked") {
    const toolResult = listLockedRules({ includeReferences: true });
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: toolResult.content[0].text,
        },
      ],
    };
  }

  if (uri === "safe-haven://audit/summary") {
    const toolResult = summarizeAuditTrail({});
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: toolResult.content[0].text,
        },
      ],
    };
  }

  if (uri === "safe-haven://docs/architecture") {
    const docsPath = path.join(REPO_ROOT, "docs", "architecture.md");
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: fs.existsSync(docsPath)
            ? fs.readFileSync(docsPath, "utf8")
            : "Safe Haven architecture documentation is not present.",
        },
      ],
    };
  }

  throw new Error(`Unknown Safe Haven resource: ${uri}`);
}

function loadDecisionEngine() {
  if (compiledEngine) return compiledEngine;

  const outDir = path.join(os.tmpdir(), "safe-haven-mcp-engine");
  fs.rmSync(outDir, { recursive: true, force: true });
  execFileSync(
    path.join(REPO_ROOT, "node_modules", ".bin", "tsc"),
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
    {
      cwd: REPO_ROOT,
      stdio: "pipe",
    }
  );

  const require = createRequire(import.meta.url);
  compiledEngine = require(path.join(outDir, "lib", "decisionEngine.js"));
  return compiledEngine;
}

function appendGovernanceAuditEntry(result, args) {
  const auditPath = DEFAULT_AUDIT_PATH;
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const previousHash = lastAuditHash(auditPath);
  const entry = {
    eventId: result.audit.eventId,
    timestamp: result.audit.timestamp,
    type: "mcp_prompt_test_decision",
    decision: `${result.decision} for ${result.riskLevel} risk prompt classification.`,
    tradeoffs: [
      "Safety vs privacy: prompt content was not stored by default.",
      "False positives vs false negatives: locked rules and context policy control the final outcome.",
      "Automation vs human oversight: high-risk and rights-sensitive outcomes require human review.",
    ],
    retentionMode: result.retentionMode,
    humanOversight: result.humanReviewRequired
      ? "Human review required by Safe Haven decision tree."
      : "Human review not required for this low-risk decision.",
    references: unique(
      result.matchedRules.flatMap((rule) =>
        (rule.complianceReferences ?? []).map(
          (reference) => `${reference.publisher}: ${reference.title}`
        )
      )
    ),
    promptHash: sha256(args.prompt),
    promptPreview: args.includePromptPreviewInAudit ? preview(args.prompt) : undefined,
    appliedPolicy: result.appliedPolicy,
    matchedRules: result.matchedRules.map((rule) => rule.id),
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    previousHash,
  };
  entry.entryHash = hashAuditEntry(entry);
  fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`);

  return {
    auditPath: path.relative(REPO_ROOT, auditPath),
    eventId: entry.eventId,
    promptStored: Boolean(args.includePromptPreviewInAudit),
    promptHash: entry.promptHash,
    previousHash: entry.previousHash,
    entryHash: entry.entryHash,
  };
}

function lastAuditHash(auditPath) {
  if (!fs.existsSync(auditPath)) return null;
  const entries = readJsonlLines(auditPath);
  if (entries.length === 0) return null;
  const last = entries.at(-1);
  return last.entryHash ?? sha256(stableStringify(last));
}

function hashAuditEntry(entry) {
  const { entryHash, ...withoutHash } = entry;
  return sha256(stableStringify(withoutHash));
}

function normalizeSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return undefined;

  return signals
    .filter((signal) => signal && typeof signal.ruleId === "string")
    .map((signal) => ({
      ruleId: signal.ruleId,
      label: signal.label ?? signal.ruleId,
      source: signal.source === "llm_backend" ? "llm_backend" : "semantic_classifier",
      confidence: Number(signal.confidence ?? 0.75),
      evidence: signal.evidence ?? "",
      rationale: signal.rationale ?? "External MCP context signal.",
    }));
}

function sourceChips(rule) {
  return unique((rule.complianceReferences ?? []).map((reference) => reference.publisher));
}

function readJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${path.relative(REPO_ROOT, filePath)} does not exist.`);
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
      }
    });
}

function resolveRepoPath(inputPath) {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(REPO_ROOT, inputPath);

  const relative = path.relative(REPO_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Safe Haven MCP server only reads files inside the repository.");
  }

  return resolved;
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

function exampleRecord(index, row, result) {
  return {
    index,
    promptPreview: preview(row.prompt),
    actualUnsafe: row.is_safe === false,
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    decision: result.decision,
    matchedRules: result.matchedRules.map((rule) => rule.id),
  };
}

function countBy(entries, key) {
  return entries.reduce((counts, entry) => {
    const value = entry[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function divide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function round(value) {
  return Number(value.toFixed(4));
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function preview(text) {
  return String(text).replace(/\s+/g, " ").trim().slice(0, 120);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function jsonContent(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function assertString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}
