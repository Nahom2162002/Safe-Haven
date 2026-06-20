import type {
  DecisionAction,
  DeveloperPolicy,
  MatchedRule,
  RetentionMode,
  RiskLevel,
  ServiceContext,
  UserContext,
} from "./types";

export function determineAppliedPolicy(
  user: UserContext,
  service: ServiceContext
): string {
  const childAccessible =
    service.childAccess === "child_directed" ||
    service.childAccess === "mixed_audience" ||
    service.childAccess === "unknown";

  if (childAccessible && user.ageGroup === "unknown") {
    return "child_safe_default";
  }

  if (
    childAccessible &&
    (user.ageGroup === "child" || user.ageGroup === "teen")
  ) {
    return "child_safe_policy";
  }

  if (user.ageGroup === "verified_adult") {
    return "adult_policy_plus_universal_safety";
  }

  return "general_ai_safety";
}

export function chooseAction(
  matchedRules: MatchedRule[],
  riskLevel: RiskLevel,
  appliedPolicy: string
): DecisionAction {
  const ids = matchedRules.map((rule) => rule.id);

  if (ids.includes("R13")) {
    return riskLevel === "critical" ? "UNIVERSAL_REFUSAL" : "SAFE_REDIRECT";
  }

  if (ids.includes("R1") || ids.includes("R2") || ids.includes("R12")) {
    return "URGENT_ESCALATION";
  }

  if (ids.includes("R5") && riskLevel === "critical") {
    return "URGENT_ESCALATION";
  }

  if (ids.includes("R6") && riskLevel === "critical") {
    return "URGENT_ESCALATION";
  }

  if (ids.includes("R3")) {
    return riskLevel === "critical" ? "URGENT_ESCALATION" : "HUMAN_REVIEW";
  }

  if (
    ids.includes("R7") &&
    (appliedPolicy === "child_safe_policy" ||
      appliedPolicy === "child_safe_default")
  ) {
    return "AGE_APPROPRIATE_REFUSAL";
  }

  if (ids.includes("R15")) {
    return "REQUIRE_RIGHTS_REVIEW";
  }

  if (riskLevel === "critical") return "URGENT_ESCALATION";
  if (riskLevel === "high") return "HUMAN_REVIEW";
  if (riskLevel === "medium") return "SAFE_REDIRECT";

  return "ALLOW_WITH_GUIDANCE";
}

export function isHumanReviewRequired(action: DecisionAction): boolean {
  return (
    action === "HUMAN_REVIEW" ||
    action === "URGENT_ESCALATION" ||
    action === "REQUIRE_RIGHTS_REVIEW"
  );
}

export function chooseRetentionMode(
  matchedRules: MatchedRule[],
  riskLevel: RiskLevel,
  action: DecisionAction,
  developerPolicy: DeveloperPolicy
): RetentionMode {
  const ids = matchedRules.map((rule) => rule.id);

  if (action === "ALLOW") {
    return "NO_CONTENT";
  }

  if (riskLevel === "low" || riskLevel === "medium") {
    return "METADATA_ONLY";
  }

  if (
    action === "HUMAN_REVIEW" ||
    action === "URGENT_ESCALATION" ||
    ids.includes("R1") ||
    ids.includes("R2") ||
    ids.includes("R3") ||
    ids.includes("R5") ||
    ids.includes("R6") ||
    ids.includes("R12")
  ) {
    return "REDACTED_EXCERPT";
  }

  if (developerPolicy.allowFullConversationStorage) {
    return "FULL_CONTENT_REQUIRES_JUSTIFICATION";
  }

  return "METADATA_ONLY";
}
