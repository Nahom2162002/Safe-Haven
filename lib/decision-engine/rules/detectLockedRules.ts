import type {
  InputEvent,
  LockedRuleId,
  MatchedRule,
  ServiceContext,
  UserContext,
} from "../types";
import { LOCKED_RULES } from "./lockedRules";
import { LOCKED_RULE_PATTERNS } from "./patterns";

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function matchedRule(id: LockedRuleId, matchReason?: string): MatchedRule {
  return {
    ...LOCKED_RULES[id],
    matchReason,
  };
}

export function detectLockedRules(
  input: InputEvent,
  user: UserContext,
  service: ServiceContext
): MatchedRule[] {
  const text = input.text.toLowerCase();
  const matches: MatchedRule[] = [];

  if (
    user.ageGroup === "unknown" &&
    service.childAccess !== "verified_adult_only"
  ) {
    matches.push(matchedRule("R0", "Unknown-age user in child-accessible service."));
  }

  for (const [id, patterns] of Object.entries(LOCKED_RULE_PATTERNS)) {
    const ruleId = id as LockedRuleId;

    if (ruleId === "R0") continue;

    if (includesAny(text, patterns)) {
      matches.push(matchedRule(ruleId, "Keyword pattern matched."));
    }
  }

  if (input.involvesLocationOrPII) {
    matches.push(matchedRule("R9", "Input was marked as involving location or PII."));
  }

  if (input.couldEnableHarm) {
    matches.push(matchedRule("R13", "Input was marked as potentially enabling harm."));
  }

  if (input.requestedRetention === "FULL_CONTENT_REQUIRES_JUSTIFICATION") {
    matches.push(matchedRule("R15", "Full-content retention was requested."));
  }

  const unique = new Map(matches.map((rule) => [rule.id, rule]));
  return Array.from(unique.values());
}
