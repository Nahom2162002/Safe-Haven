# Safe Haven Architecture

Safe Haven is a child-safety governance prototype for the Hackathon UN Tech Over
2026 SpainGov challenge. It uses the UNICEF child-safety chatbot problem as a
proxy case study for AI systems that classify children’s messages, assign risk
scores, escalate cases, and decide how much sensitive conversation data to
retain.

## System Diagram

```text
Developer request / prompt
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenCode governance layer                                   │
│ - AGENTS.md instructions                                    │
│ - fairness-advisor subagent                                 │
│ - doc-generator subagent                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Vite TypeScript frontend                                    │
│ - Rules tab                                                 │
│ - Prompt Tester tab                                         │
│ - Decision path visualizer                                  │
│ - Source-backed explanation UI                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Decision engine                                             │
│ lib/decision-engine                                         │
│                                                             │
│ context → rules → risk → action → retention → rights review │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Governance outputs                                          │
│ - structured audit event                                    │
│ - audit-trail/decisions.jsonl                               │
│ - reports/child-safety-governance-report.md                 │
└─────────────────────────────────────────────────────────────┘
```

## Decision Engine

The decision tree is implemented as a small domain module at
`lib/decision-engine`. Keeping it outside dashboard components allows the same
logic to be reused by an API endpoint, background audit worker, coding-agent
plugin, or test suite.

The current flow is:

1. Determine the applied policy from user age and service child access.
2. Match locked harm/governance rules against the input.
3. Calculate a numeric risk score and risk level.
4. Choose the safety action.
5. Choose the retention mode.
6. Run a rights review for sensitive actions.
7. Emit a structured audit event, source-backed explanation, and decision path.

## Context Policy

Context is not treated as harm evidence. The engine first decides the policy
context:

```text
child_directed platform + any user age → child_safe_policy
unknown age + mixed/unknown child access → child_safe_default
verified adult + verified_adult_only → adult_policy_plus_universal_safety
other contexts → general_ai_safety
```

This distinction prevents harmless unknown-age prompts from being overflagged
while ensuring that child-directed platforms apply child-safe rules to everyone.

## Governance Tradeoffs

Safe Haven exposes the tradeoffs the hackathon asks participants to consider:

- **Safety vs privacy:** retention defaults to no content or metadata-only
  unless higher-risk review needs a redacted excerpt.
- **False positives vs false negatives:** risk score, matched rules, and action
  are visible so escalation choices can be reviewed.
- **Fairness and inclusion:** the prompt tester surfaces age, service context,
  vulnerability, and flags so teams can create disaggregated synthetic tests.
- **Human oversight vs automation:** high-risk and rights-sensitive cases route
  to human review, urgent escalation, or rights review instead of silent action.

## Paper Trail

The technical audit format is `audit-trail/decisions.jsonl`. Each entry should
record the decision, matched rules, tradeoffs, selected retention mode, oversight
choice, and references to source-backed reasoning.

The human-readable report is
`reports/child-safety-governance-report.md`. It summarizes purpose, intended use,
known limitations, foreseeable risks, human oversight, and traceability.

## Dashboard integration

The hackathon dashboard is a Vite TypeScript frontend. The entry points are
`index.html`, `src/main.ts`, and `src/styles.css`. It renders the locked
guidelines in grey with disabled toggles, while custom rules can be created,
enabled, disabled, and deleted.

Use `LOCKED_GUIDELINES` from the decision engine when this dashboard is moved
into a framework app. Each rule already has `locked: true` and `enabled: true`,
which gives the future dashboard a stable shape for showing disabled toggles on
locked rules and editable toggles on custom rules.

```ts
import { LOCKED_GUIDELINES, childSafetyDecision } from "../lib/decisionEngine";
```

When custom rules are added later, keep them separate from locked rules in
storage. Locked rules should remain always-on; custom rules can use the same
`RuleDefinition` shape with `locked: false`.
