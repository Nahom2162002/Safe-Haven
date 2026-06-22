import type {
  DetectionSignal,
  DetectionSource,
  InputEvent,
  LockedRuleId,
  MatchedRule,
} from "../types";
import { LOCKED_RULES } from "./lockedRules";
import { LOCKED_RULE_PATTERNS } from "./patterns";

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function matchedRule(
  id: LockedRuleId,
  matchReason?: string,
  detectionSources: DetectionSource[] = []
): MatchedRule {
  return {
    ...LOCKED_RULES[id],
    matchReason,
    detectionSources,
  };
}

export function detectLockedRules(
  input: InputEvent,
  semanticSignals: DetectionSignal[] = []
): MatchedRule[] {
  const text = input.text.toLowerCase();
  const matches: MatchedRule[] = [];

  for (const [id, patterns] of Object.entries(LOCKED_RULE_PATTERNS)) {
    const ruleId = id as LockedRuleId;

    if (ruleId === "R0") continue;

    if (includesAny(text, patterns)) {
      matches.push(matchedRule(ruleId, "Keyword pattern matched.", ["keyword"]));
    }
  }

  if (input.involvesLocationOrPII) {
    matches.push(
      matchedRule("R9", "Input was marked as involving location or PII.", [
        "manual_flag",
      ])
    );
  }

  if (input.couldEnableHarm) {
    matches.push(
      matchedRule("R13", "Input was marked as potentially enabling harm.", [
        "manual_flag",
      ])
    );
  }

  if (input.requestedRetention === "FULL_CONTENT_REQUIRES_JUSTIFICATION") {
    matches.push(
      matchedRule("R15", "Full-content retention was requested.", [
        "retention_request",
      ])
    );
  }

  semanticSignals.forEach((signal) => {
    if (signal.ruleId === "R0") return;

    matches.push({
      ...matchedRule(
        signal.ruleId,
        `Semantic classifier signal: ${signal.rationale}`,
        [signal.source === "llm_backend" ? "llm_backend" : "semantic_classifier"]
      ),
      classifierSignal: signal,
    });
  });

  const unique = new Map<LockedRuleId, MatchedRule>();

  matches.forEach((rule) => {
    const existing = unique.get(rule.id as LockedRuleId);
    if (!existing) {
      unique.set(rule.id as LockedRuleId, rule);
      return;
    }

    unique.set(rule.id as LockedRuleId, {
      ...existing,
      matchReason: mergeText(existing.matchReason, rule.matchReason),
      detectionSources: mergeSources(
        existing.detectionSources,
        rule.detectionSources
      ),
      classifierSignal: existing.classifierSignal ?? rule.classifierSignal,
    });
  });

  return Array.from(unique.values());
}

function mergeText(first?: string, second?: string): string | undefined {
  if (!first) return second;
  if (!second || first === second) return first;
  return `${first} ${second}`;
}

function mergeSources(
  first: DetectionSource[] = [],
  second: DetectionSource[] = []
): DetectionSource[] {
  return Array.from(new Set([...first, ...second]));
}
