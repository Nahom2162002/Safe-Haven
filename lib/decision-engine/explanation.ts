import type { DecisionAction, MatchedRule, RetentionMode, RiskLevel } from "./types";

export function buildExplanation(
  matchedRules: MatchedRule[],
  riskScore: number,
  riskLevel: RiskLevel,
  action: DecisionAction,
  retentionMode: RetentionMode
): string {
  if (matchedRules.length === 0) {
    return "No locked harm category was detected. Normal response allowed.";
  }

  const ruleLabels = matchedRules.map((rule) => rule.label).join(", ");

  return `Matched locked rule(s): ${ruleLabels}. Risk score is ${riskScore}/100, classified as ${riskLevel}. Recommended action: ${action}. Retention mode: ${retentionMode}.`;
}
