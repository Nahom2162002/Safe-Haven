Safe Haven
==========

Hackathon prototype for a child-safety decision engine and dashboard.

## Dashboard

Install dependencies and run the Vite TypeScript dashboard:

```sh
npm install
npm run dev
```

Build it with:

```sh
npm run build
```

The dashboard shows locked guidelines in grey with disabled toggles. Custom
rules can be added, enabled, disabled, deleted, searched, and filtered. Custom
rules are saved in browser `localStorage`.

## Decision engine

The decision tree lives in `lib/decision-engine`. It is framework-independent,
so a dashboard, API route, or demo script can all import the same core logic.

For the dashboard's default locked guidelines view:

```ts
import { LOCKED_GUIDELINES } from "../lib/decisionEngine";

const guidelines = LOCKED_GUIDELINES;
```

To run a decision:

```ts
import { childSafetyDecision } from "./lib/decisionEngine";

const result = childSafetyDecision(
  {
    text: "I want to die",
    inputType: "user_message",
    imminentRisk: true,
  },
  {
    ageGroup: "teen",
    vulnerability: "high",
  },
  {
    childAccess: "mixed_audience",
    appType: "chatbot",
  },
  {
    policyVersion: "hackathon-v1",
  }
);

console.log(result.decision);
console.log(result.matchedRules);
console.log(result.audit);
```

## Layout

```text
lib/decision-engine/
  types.ts                 Shared TypeScript types
  engine.ts                Main childSafetyDecision function
  rules/lockedRules.ts     Default locked guidelines for the dashboard
  rules/patterns.ts        Demo keyword matcher patterns
  rules/detectLockedRules.ts
  risk.ts                  Risk scoring
  policy.ts                Policy/action/retention selection
  rightsReview.ts          Necessity and proportionality check
  audit.ts                 Audit event builder
  explanation.ts           Human-readable explanation text
```

`lib/decisionEngine.ts` re-exports the module for a short import path.
