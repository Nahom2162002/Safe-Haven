import { createAuditEvent, createEventId as defaultCreateEventId } from "./audit";
import { buildExplanation } from "./explanation";
import {
  chooseAction,
  chooseRetentionMode,
  determineAppliedPolicy,
  isHumanReviewRequired,
} from "./policy";
import { calculateRiskScore, getHarmRules, mapScoreToRiskLevel } from "./risk";
import { detectLockedRules } from "./rules/detectLockedRules";
import { runRightsReview } from "./rightsReview";
import { detectSemanticSignals } from "./semanticClassifier";
import type {
  DecisionContext,
  DecisionEngineOptions,
  DecisionResult,
  DecisionTraceStep,
  DeveloperPolicy,
  InputEvent,
  MatchedRule,
  RuleDefinition,
  ServiceContext,
  UserContext,
} from "./types";

export function childSafetyDecision(
  input: InputEvent,
  user: UserContext,
  service: ServiceContext,
  developerPolicy: DeveloperPolicy,
  options: DecisionEngineOptions = {}
): DecisionResult {
  const now = options.now ?? (() => new Date());
  const makeEventId = options.createEventId ?? defaultCreateEventId;
  const appliedPolicy = determineAppliedPolicy(user, service);
  const context = buildDecisionContext(user, service, appliedPolicy);
  const detectionSignals =
    options.semanticSignals ??
    (options.enableSemanticClassifier === false
      ? []
      : detectSemanticSignals(input, user, service));
  const lockedRuleMatches = detectLockedRules(input, detectionSignals);
  const customRuleMatches = detectCustomRules(input, options.customRules ?? []);
  const matchedRules = filterRulesForContext(
    [...lockedRuleMatches, ...customRuleMatches],
    input,
    appliedPolicy
  );
  const harmRules = getHarmRules(matchedRules);
  const riskScore = calculateRiskScore(matchedRules, input, user);
  const riskLevel = mapScoreToRiskLevel(riskScore);

  let action = harmRules.length
    ? chooseAction(matchedRules, riskLevel, appliedPolicy)
    : appliedPolicy === "child_safe_default"
      ? "ALLOW_WITH_GUIDANCE"
      : "ALLOW";

  let retentionMode = chooseRetentionMode(
    matchedRules,
    riskLevel,
    action,
    developerPolicy
  );

  let rightsReview = runRightsReview(action, riskLevel, retentionMode);

  if (!rightsReview.passes) {
    action = "REQUIRE_DEVELOPER_JUSTIFICATION";
    retentionMode = "METADATA_ONLY";
    rightsReview = runRightsReview(action, riskLevel, retentionMode);
  }

  const humanReviewRequired = isHumanReviewRequired(action);
  const audit = createAuditEvent({
    eventId: makeEventId(),
    timestamp: now().toISOString(),
    input,
    user,
    service,
    appliedPolicy,
    matchedRules,
    riskScore,
    riskLevel,
    action,
    humanReviewRequired,
    retentionMode,
    rightsReview,
    policyVersion: developerPolicy.policyVersion,
  });
  const decisionTrace = buildDecisionTrace({
    input,
    context,
    appliedPolicy,
    matchedRules,
    detectionSignals,
    riskScore,
    riskLevel,
    action,
    retentionMode,
    rightsReviewPasses: rightsReview.passes,
    humanReviewRequired,
    auditRequired: harmRules.length > 0,
  });

  return {
    decision: action,
    appliedPolicy,
    context,
    detectionSignals,
    matchedRules,
    riskScore,
    riskLevel,
    retentionMode,
    humanReviewRequired,
    auditRequired: harmRules.length > 0,
    audit,
    explanation: buildExplanation(
      matchedRules,
      riskScore,
      riskLevel,
      action,
      retentionMode
    ),
    decisionTrace,
  };
}

function filterRulesForContext(
  matchedRules: DecisionResult["matchedRules"],
  input: InputEvent,
  appliedPolicy: string
): DecisionResult["matchedRules"] {
  const childSafeContext =
    appliedPolicy === "child_safe_policy" ||
    appliedPolicy === "child_safe_default";
  const textMentionsChild = mentionsChildOrTeen(input.text);

  return matchedRules.filter((rule) => {
    if (rule.id === "R7") {
      return childSafeContext;
    }

    if (rule.id === "R2") {
      return childSafeContext || textMentionsChild;
    }

    return true;
  });
}

function mentionsChildOrTeen(text: string): boolean {
  return /\b(child|children|kid|kids|minor|underage|teen|teenager|young person)\b/i.test(
    text
  );
}

function detectCustomRules(
  input: InputEvent,
  customRules: RuleDefinition[]
): MatchedRule[] {
  const normalizedPrompt = normalizeForMatch(input.text);

  if (!normalizedPrompt) return [];

  return customRules
    .filter((rule) => !rule.locked && rule.enabled)
    .flatMap((rule) => {
      const keywords = extractCustomRuleKeywords(rule);
      const matchedKeywords = keywords.filter((keyword) =>
        normalizedPrompt.includes(keyword)
      );

      if (matchedKeywords.length < 2) return [];

      return [
        {
          ...rule,
          matchReason: `Custom guardian rule matched keywords: ${matchedKeywords
            .slice(0, 5)
            .join(", ")}.`,
          detectionSources: ["custom_rule"],
        },
      ];
    });
}

function extractCustomRuleKeywords(rule: RuleDefinition): string[] {
  const source = `${rule.label} ${rule.category} ${rule.description}`;
  const stopWords = new Set([
    "about",
    "after",
    "attempt",
    "attempts",
    "because",
    "browser",
    "could",
    "flag",
    "from",
    "guardian",
    "into",
    "rule",
    "school",
    "should",
    "that",
    "their",
    "this",
    "with",
  ]);

  return Array.from(
    new Set(
      normalizeForMatch(source)
        .split(" ")
        .filter((word) => word.length >= 4 && !stopWords.has(word))
    )
  );
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDecisionContext(
  user: UserContext,
  service: ServiceContext,
  appliedPolicy: string
): DecisionContext {
  return {
    ageGroup: user.ageGroup,
    vulnerability: user.vulnerability,
    serviceChildAccess: service.childAccess,
    appType: service.appType,
    appliedPolicy,
    childSafeDefaultApplied: appliedPolicy === "child_safe_default",
    childSafePolicyApplied: appliedPolicy === "child_safe_policy",
    adultPolicyApplied: appliedPolicy === "adult_policy_plus_universal_safety",
  };
}

function buildDecisionTrace({
  input,
  context,
  appliedPolicy,
  matchedRules,
  detectionSignals,
  riskScore,
  riskLevel,
  action,
  retentionMode,
  rightsReviewPasses,
  humanReviewRequired,
  auditRequired,
}: {
  input: InputEvent;
  context: DecisionContext;
  appliedPolicy: string;
  matchedRules: DecisionResult["matchedRules"];
  detectionSignals: DecisionResult["detectionSignals"];
  riskScore: number;
  riskLevel: DecisionResult["riskLevel"];
  action: DecisionResult["decision"];
  retentionMode: DecisionResult["retentionMode"];
  rightsReviewPasses: boolean;
  humanReviewRequired: boolean;
  auditRequired: boolean;
}): DecisionTraceStep[] {
  const matchedRuleIds = matchedRules.map((rule) => rule.id).join(", ");
  const signalLabels = detectionSignals
    .map((signal) => `${signal.label} (${Math.round(signal.confidence * 100)}%)`)
    .join(", ");
  const activeFlags = [
    input.repeatedAttempts && "repeated attempts",
    input.imminentRisk && "imminent risk",
    input.involvesTrustedAdult && "trusted adult",
    input.involvesPrivateImages && "private images",
    input.involvesLocationOrPII && "location or PII",
    input.couldEnableHarm && "could enable harm",
    input.requestedRetention && `requested retention: ${input.requestedRetention}`,
  ].filter(Boolean);

  return [
    {
      id: "context",
      label: "1. Context policy",
      status: "pass",
      detail: `${appliedPolicy} selected for ${context.ageGroup} user in ${context.serviceChildAccess} ${context.appType} service.`,
    },
    {
      id: "rule-match",
      label: "2. Locked rule matching",
      status: matchedRules.length ? "review" : "pass",
      detail: matchedRules.length
        ? `Matched ${matchedRuleIds}.`
        : "No locked harm category matched.",
    },
    {
      id: "signal-detection",
      label: "3. Hybrid signal detection",
      status: detectionSignals.length ? "review" : "pass",
      detail: detectionSignals.length
        ? `Classifier signals detected: ${signalLabels}. Final action still controlled by locked rules and policy.`
        : "No semantic classifier signals detected.",
    },
    {
      id: "risk",
      label: "4. Risk scoring",
      status: riskLevel === "high" || riskLevel === "critical" ? "review" : "pass",
      detail: `Risk score ${riskScore}/100 mapped to ${riskLevel}. ${
        activeFlags.length ? `Active flags: ${activeFlags.join(", ")}.` : "No extra risk flags."
      }`,
    },
    {
      id: "action",
      label: "5. Action selection",
      status:
        action === "ALLOW" || action === "ALLOW_WITH_GUIDANCE" ? "pass" : "stop",
      detail: `${action} selected from matched rules, risk level, and applied policy.`,
    },
    {
      id: "retention",
      label: "6. Retention selection",
      status:
        retentionMode === "NO_CONTENT" || retentionMode === "METADATA_ONLY"
          ? "pass"
          : "review",
      detail: `${retentionMode} selected for audit and data-minimization needs.`,
    },
    {
      id: "rights-review",
      label: "7. Rights review",
      status: rightsReviewPasses ? "pass" : "stop",
      detail: rightsReviewPasses
        ? "Rights review passed necessity, proportionality, minimization, explainability, and auditability checks."
        : "Rights review failed, so the action was changed to require developer justification.",
    },
    {
      id: "oversight",
      label: "8. Oversight and audit",
      status: humanReviewRequired || auditRequired ? "review" : "pass",
      detail: `Human review ${humanReviewRequired ? "required" : "not required"}; audit ${
        auditRequired ? "required" : "not required"
      }.`,
    },
  ];
}
