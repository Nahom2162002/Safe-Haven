import type { DecisionAction, RetentionMode, RightsReview, RiskLevel } from "./types";

export function isRightsSensitiveAction(action: DecisionAction): boolean {
  return (
    action === "HUMAN_REVIEW" ||
    action === "URGENT_ESCALATION" ||
    action === "REQUIRE_RIGHTS_REVIEW" ||
    action === "BLOCK_AND_AUDIT" ||
    action === "REQUIRE_DEVELOPER_JUSTIFICATION"
  );
}

export function runRightsReview(
  action: DecisionAction,
  riskLevel: RiskLevel,
  retentionMode: RetentionMode
): RightsReview {
  const rightsSensitive = isRightsSensitiveAction(action);

  if (!rightsSensitive) {
    return {
      rightsSensitive: false,
      necessary: true,
      proportionate: true,
      dataMinimized: true,
      explainable: true,
      auditable: true,
      passes: true,
      notes: ["Action is not rights-sensitive."],
    };
  }

  const necessary =
    riskLevel === "high" ||
    riskLevel === "critical" ||
    action === "REQUIRE_RIGHTS_REVIEW";
  const proportionate = retentionMode !== "FULL_CONTENT_REQUIRES_JUSTIFICATION";
  const dataMinimized =
    retentionMode === "NO_CONTENT" ||
    retentionMode === "METADATA_ONLY" ||
    retentionMode === "REDACTED_EXCERPT";
  const explainable = true;
  const auditable = true;
  const passes =
    necessary && proportionate && dataMinimized && explainable && auditable;
  const notes: string[] = [];

  if (!necessary) notes.push("Action may be too intrusive for the risk level.");
  if (!proportionate) {
    notes.push("Full-content retention requires explicit justification.");
  }
  if (!dataMinimized) {
    notes.push("Retention choice does not satisfy data minimization.");
  }
  if (passes) {
    notes.push("Rights-sensitive action passed necessity and proportionality.");
  }

  return {
    rightsSensitive,
    necessary,
    proportionate,
    dataMinimized,
    explainable,
    auditable,
    passes,
    notes,
  };
}
