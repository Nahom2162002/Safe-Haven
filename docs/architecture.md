# Architecture

## Decision engine

The hackathon decision tree is implemented as a small domain module at
`lib/decision-engine`. Keep this logic outside dashboard components so the same
rules can later be reused by an API endpoint, background audit worker, or test
suite.

The current flow is:

1. Determine the applied policy from user age and service child access.
2. Match enabled locked rules.
3. Calculate a numeric risk score and risk level.
4. Choose the safety action.
5. Choose the retention mode.
6. Run a rights review for sensitive actions.
7. Emit a structured audit event and human-readable explanation.

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
