# Safe Haven

Safe Haven is a hackathon prototype for making AI-powered chat systems safer for
children and child-accessible platforms.

It is positioned for the **Hackathon UN Tech Over 2026 — SpainGov Challenge:
Safety, Supervision and Governance in the Agentic World**, using the additional
UNICEF problem on **child safety and safeguarding in AI-powered chat systems** as
the proxy case study.

It combines a configurable rules dashboard with a prompt tester that explains
how a message moves through a child-safety decision engine. The project is built
to make safety decisions understandable: it shows the selected policy context,
matched harm rules, risk score, action, retention mode, oversight requirement,
and the legal / ethics sources behind each rule.

## Goal

The goal is to help teams evaluate whether chatbot prompts, AI outputs, or
developer settings create child-safety, privacy, exploitation, or governance
risks.

The system demonstrates a governance layer that can sit around an AI-powered
chatbot, moderation model, or coding-agent-generated child-safety classifier. It
does not claim to be a production classifier. Instead, it shows how a system can
make safeguarding, privacy, escalation, retention, and human-oversight decisions
explicit, auditable, and explainable.

Safe Haven is designed around three questions:

1. What policy context applies?
2. Which harm or governance rules matched?
3. Why is this risky, and what source-backed guidance supports the decision?

## Challenge Alignment

The SpainGov challenge asks for an open-source tool that helps developers see
and audit fairness, privacy, cybersecurity, and human-rights implications when
building with AI coding agents.

Safe Haven maps that requirement to the UNICEF child-safety case:

| Challenge requirement | Safe Haven implementation |
| --- | --- |
| Detect fairness, privacy, cybersecurity, or rights tensions | Locked rules detect child-safety, privacy, exploitation, harmful-content, oversight, retention, and governance risks. |
| Present code/design options and tradeoffs | The prompt tester shows policy context, risk score, action, retention mode, oversight requirement, and decision path alternatives. |
| Store choices, test results, and implications | The engine emits structured audit events; `audit-trail/decisions.jsonl` provides the paper-trail format. |
| Produce a human-readable report | `reports/child-safety-governance-report.md` summarizes purpose, risks, oversight, limitations, and traceability. |
| Use open-source agent mechanisms | `AGENTS.md`, `opencode.json`, and `.opencode/agent/` describe OpenCode-compatible governance instructions and subagents. |

## UNICEF Case Study

The proxy system is an AI-powered child-safety chatbot or moderation layer. It
can inspect a child’s chat message for signs of:

- bullying
- grooming
- self-harm
- abuse or neglect
- distress
- privacy or doxxing risk
- urgent physical danger
- governance failures, such as excessive retention or missing human review

The key governance problem is not only classification accuracy. It is the
tradeoff between:

- **Safety vs privacy:** detecting risk may require processing sensitive
  conversations, but storing too much content can itself harm children.
- **False positives vs false negatives:** missing a serious risk can leave a
  child without support, while over-escalating can create unnecessary
  surveillance or intervention.
- **Human oversight vs automation:** urgent escalation can be fast, but
  high-impact actions need clear review protocols and trained humans.
- **Fairness and inclusion:** the system may perform differently across ages,
  languages, dialects, cultures, disabilities, and writing styles.

Relevant child-rights framing includes Articles 3, 12, 16, 19, and 34 of the UN
Convention on the Rights of the Child: best interests, participation, privacy,
protection from harm, and protection from sexual exploitation.

Depending on context of use, this may be high-risk or safety-sensitive under an
EU AI Act analysis, especially if used in safeguarding, education, essential
services, or decisions affecting children.

## What It Does

- Displays 16 locked child-safety guidelines.
- Shows locked rules as non-editable defaults.
- Lets users add, enable, disable, and delete custom rules.
- Confirms before deleting a custom rule.
- Provides a prompt tester for user messages, AI outputs, developer settings,
  and guardian settings.
- Separates platform/user context from matched harm rules.
- Shows a full-width decision-path graphic with possible branches and the path
  selected by the prompt.
- Displays source-backed explanations with UNICEF, UNICEF Innocenti, UNESCO,
  AESIA, and Google Model Cards references.
- Includes a rubric suite for demo/test scenarios.
- Provides OpenCode-compatible governance instructions and custom-agent prompts.
- Includes a paper-trail format and human-readable governance report.
- Records every prompt test in a browser-side audit log that can be exported as
  `.jsonl`.

## Run Locally

Install dependencies:

```sh
npm install
```

Start the Vite TypeScript frontend:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         OpenCode / Agent Layer                       │
│  AGENTS.md + opencode.json + .opencode/agent/*.md                    │
│  - governance instructions                                            │
│  - child-safety advisor                                               │
│  - report generator                                                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              Browser UI                              │
│                                                                      │
│  ┌────────────────────────┐      ┌────────────────────────────────┐  │
│  │ Rules Dashboard        │      │ Prompt Tester                  │  │
│  │ - locked rules         │      │ - prompt/context inputs        │  │
│  │ - custom rules         │      │ - decision result              │  │
│  │ - source chips         │      │ - decision path graphic        │  │
│  │ - legal/ethics basis   │      │ - source-backed explanation    │  │
│  └───────────┬────────────┘      └───────────────┬────────────────┘  │
└──────────────┼───────────────────────────────────┼───────────────────┘
               │                                   │
               ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Decision Engine Module                         │
│                         lib/decision-engine                          │
│                                                                      │
│  Context policy → Rule matching → Risk scoring → Action selection    │
│         ↓              ↓               ↓              ↓              │
│  Retention mode → Rights review → Audit event → Explanation/path      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Paper Trail / Report                         │
│  audit-trail/decisions.jsonl + reports/child-safety-governance-report │
└──────────────────────────────────────────────────────────────────────┘
```

The frontend lives in:

```text
src/main.ts
src/styles.css
src/promptRubric.ts
```

The reusable decision engine lives in:

```text
lib/decision-engine/
```

`lib/decisionEngine.ts` re-exports the module for a short import path.

## Decision Tree

Safe Haven uses a staged decision tree rather than a single binary tree. The UI
shows all possible branches in each stage and highlights the branch selected by
the current prompt.

```text
1. Context Policy
   ├─ child_safe_default
   ├─ child_safe_policy
   ├─ adult_policy_plus_universal_safety
   └─ general_ai_safety

2. Rule Match
   ├─ no harm rules
   ├─ universal severe harm
   ├─ critical child safety
   ├─ age-inappropriate content
   ├─ governance review
   └─ other harm rule

3. Risk Level
   ├─ low
   ├─ medium
   ├─ high
   └─ critical

4. Action
   ├─ ALLOW
   ├─ ALLOW_WITH_GUIDANCE
   ├─ SAFE_REDIRECT
   ├─ AGE_APPROPRIATE_REFUSAL
   ├─ HUMAN_REVIEW
   ├─ URGENT_ESCALATION
   ├─ UNIVERSAL_REFUSAL
   ├─ REQUIRE_RIGHTS_REVIEW
   ├─ REQUIRE_DEVELOPER_JUSTIFICATION
   └─ BLOCK_AND_AUDIT

5. Retention
   ├─ NO_CONTENT
   ├─ METADATA_ONLY
   ├─ REDACTED_EXCERPT
   └─ FULL_CONTENT_REQUIRES_JUSTIFICATION

6. Oversight
   ├─ no audit
   ├─ audit only
   ├─ human review
   └─ urgent escalation
```

## Context vs Harm Rules

Safe Haven separates context from harm matching.

Context answers:

```text
Who is the user?
What kind of platform is this?
Which safety policy applies?
```

Harm rules answer:

```text
Did the prompt contain a risk?
What kind of risk is it?
What action should the system take?
```

Examples:

```text
verified_adult + verified_adult_only
→ adult_policy_plus_universal_safety
→ adult content may be allowed

verified_adult + child_directed
→ child_safe_policy
→ age-inappropriate content is refused

unknown age + mixed_audience
→ child_safe_default
→ harmless prompts are allowed with guidance
```

## Locked Rules

The locked rules are defined in:

```text
lib/decision-engine/rules/lockedRules.ts
```

Each locked rule includes:

```ts
riskType
whyRisk
userGuidance
complianceReferences
```

The compliance references include source links and legal / ethics principles,
which are rendered as source chips in both the rules dashboard and the prompt
tester.

Referenced sources include:

- UNICEF Guidance on AI and Children
- UNICEF AI chatbots and companions policy brief
- UNICEF business recommendations for AI chatbots and companions
- UNICEF D-CRIA
- UNICEF Digital Transformation Strategy
- UNESCO Recommendation on the Ethics of Artificial Intelligence
- AESIA EU AI Act compliance guides
- Google DeepMind Model Cards

## Governance Outputs

The repository includes the challenge-required governance surfaces:

```text
AGENTS.md
opencode.json
.opencode/agent/fairness-advisor.md
.opencode/agent/doc-generator.md
docs/architecture.md
audit-trail/decisions.jsonl
reports/child-safety-governance-report.md
```

The intended paper trail is:

```text
1. Developer asks for a child-safety classifier or chatbot feature.
2. Governance instructions identify child-specific risks.
3. The decision engine records policy context, matched rules, risk score,
   action, retention mode, oversight requirement, and source-backed rationale.
4. Prompt Tester runs are stored in browser localStorage and can be exported as
   JSONL from the UI.
5. A human-readable report summarizes purpose, risks, oversight, limitations,
   and traceability.
```

The committed `audit-trail/decisions.jsonl` file is a seed example of the paper
trail format. During a live demo, use the Prompt Tester’s **Export audit JSONL**
button to download audit entries for each tested prompt.

## Project Layout

```text
.
├── index.html
├── package.json
├── AGENTS.md
├── opencode.json
├── audit-trail/
│   └── decisions.jsonl
├── reports/
│   └── child-safety-governance-report.md
├── .opencode/
│   └── agent/
│       ├── doc-generator.md
│       └── fairness-advisor.md
├── src/
│   ├── main.ts              # Dashboard and prompt tester UI
│   ├── promptRubric.ts      # Built-in test/demo cases
│   └── styles.css           # App styles
├── lib/
│   ├── decisionEngine.ts    # Public re-export
│   └── decision-engine/
│       ├── audit.ts
│       ├── engine.ts
│       ├── explanation.ts
│       ├── policy.ts
│       ├── rightsReview.ts
│       ├── risk.ts
│       ├── types.ts
│       └── rules/
│           ├── detectLockedRules.ts
│           ├── lockedRules.ts
│           └── patterns.ts
└── docs/
    └── architecture.md
```

## Using The Engine

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
console.log(result.context);
console.log(result.matchedRules);
console.log(result.audit);
```

## Notes

This is a hackathon prototype. The current rule matcher uses demo keyword
patterns. For production use, replace the matcher with a validated classifier,
human-reviewed taxonomy, incident escalation workflow, and jurisdiction-specific
legal review.
