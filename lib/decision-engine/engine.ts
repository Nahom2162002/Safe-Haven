import { createAuditEvent, createEventId as defaultCreateEventId } from "./audit";
import { buildExplanation } from "./explanation";
import {
  chooseAction,
  chooseRetentionMode,
  determineAppliedPolicy,
  isHumanReviewRequired,
} from "./policy";
import { calculateRiskScore, mapScoreToRiskLevel } from "./risk";
import { detectLockedRules } from "./rules/detectLockedRules";
import { runRightsReview } from "./rightsReview";
import type {
  DecisionEngineOptions,
  DecisionResult,
  DecisionTraceStep,
  DeveloperPolicy,
  InputEvent,
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
  const matchedRules = detectLockedRules(input, user, service);
  const riskScore = calculateRiskScore(matchedRules, input, user);
  const riskLevel = mapScoreToRiskLevel(riskScore);

  let action = matchedRules.length
    ? chooseAction(matchedRules, riskLevel, appliedPolicy)
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
    user,
    service,
    appliedPolicy,
    matchedRules,
    riskScore,
    riskLevel,
    action,
    retentionMode,
    rightsReviewPasses: rightsReview.passes,
    humanReviewRequired,
    auditRequired: matchedRules.length > 0,
  });

  return {
    decision: action,
    appliedPolicy,
    matchedRules,
    riskScore,
    riskLevel,
    retentionMode,
    humanReviewRequired,
    auditRequired: matchedRules.length > 0,
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

function buildDecisionTrace({
  input,
  user,
  service,
  appliedPolicy,
  matchedRules,
  riskScore,
  riskLevel,
  action,
  retentionMode,
  rightsReviewPasses,
  humanReviewRequired,
  auditRequired,
}: {
  input: InputEvent;
  user: UserContext;
  service: ServiceContext;
  appliedPolicy: string;
  matchedRules: DecisionResult["matchedRules"];
  riskScore: number;
  riskLevel: DecisionResult["riskLevel"];
  action: DecisionResult["decision"];
  retentionMode: DecisionResult["retentionMode"];
  rightsReviewPasses: boolean;
  humanReviewRequired: boolean;
  auditRequired: boolean;
}): DecisionTraceStep[] {
  const matchedRuleIds = matchedRules.map((rule) => rule.id).join(", ");
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
      detail: `${appliedPolicy} selected for ${user.ageGroup} user in ${service.childAccess} ${service.appType} service.`,
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
      id: "risk",
      label: "3. Risk scoring",
      status: riskLevel === "high" || riskLevel === "critical" ? "review" : "pass",
      detail: `Risk score ${riskScore}/100 mapped to ${riskLevel}. ${
        activeFlags.length ? `Active flags: ${activeFlags.join(", ")}.` : "No extra risk flags."
      }`,
    },
    {
      id: "action",
      label: "4. Action selection",
      status:
        action === "ALLOW" || action === "ALLOW_WITH_GUIDANCE" ? "pass" : "stop",
      detail: `${action} selected from matched rules, risk level, and applied policy.`,
    },
    {
      id: "retention",
      label: "5. Retention selection",
      status:
        retentionMode === "NO_CONTENT" || retentionMode === "METADATA_ONLY"
          ? "pass"
          : "review",
      detail: `${retentionMode} selected for audit and data-minimization needs.`,
    },
    {
      id: "rights-review",
      label: "6. Rights review",
      status: rightsReviewPasses ? "pass" : "stop",
      detail: rightsReviewPasses
        ? "Rights review passed necessity, proportionality, minimization, explainability, and auditability checks."
        : "Rights review failed, so the action was changed to require developer justification.",
    },
    {
      id: "oversight",
      label: "7. Oversight and audit",
      status: humanReviewRequired || auditRequired ? "review" : "pass",
      detail: `Human review ${humanReviewRequired ? "required" : "not required"}; audit ${
        auditRequired ? "required" : "not required"
      }.`,
    },
  ];
}
