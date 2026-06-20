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
  };
}
