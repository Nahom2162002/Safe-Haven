import type { InputEvent, MatchedRule, RiskLevel, UserContext } from "./types";

export function isContextOnlyRule(rule: MatchedRule): boolean {
  return rule.id === "R0";
}

export function getHarmRules(matchedRules: MatchedRule[]): MatchedRule[] {
  return matchedRules.filter((rule) => !isContextOnlyRule(rule));
}

function riskLevelToScore(level: RiskLevel): number {
  switch (level) {
    case "low":
      return 15;
    case "medium":
      return 35;
    case "high":
      return 65;
    case "critical":
      return 85;
  }
}

export function mapScoreToRiskLevel(score: number): RiskLevel {
  if (score <= 20) return "low";
  if (score <= 40) return "medium";
  if (score <= 70) return "high";
  return "critical";
}

export function calculateRiskScore(
  matchedRules: MatchedRule[],
  input: InputEvent,
  user: UserContext
): number {
  const harmRules = getHarmRules(matchedRules);

  if (harmRules.length === 0) return 0;

  const highestBase = Math.max(
    ...harmRules.map((rule) => riskLevelToScore(rule.baseRisk))
  );

  let score = highestBase;

  if (user.ageGroup === "child") score += 8;
  if (user.ageGroup === "teen") score += 5;
  if (user.vulnerability === "moderate") score += 5;
  if (user.vulnerability === "high") score += 10;

  if (input.imminentRisk) score += 15;
  if (input.repeatedAttempts) score += 8;
  if (input.involvesTrustedAdult) score += 10;
  if (input.involvesPrivateImages) score += 10;
  if (input.involvesLocationOrPII) score += 8;
  if (input.couldEnableHarm) score += 12;

  return Math.max(0, Math.min(100, score));
}
