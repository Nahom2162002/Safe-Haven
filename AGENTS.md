# Safe Haven Agent Instructions

This repository is a submission-oriented prototype for the Hackathon UN Tech
Over 2026 SpainGov challenge: Safety, Supervision and Governance in the Agentic
World.

The project case study is child safety and safeguarding in AI-powered chat
systems. Treat requests in this repo as potentially involving children,
safeguarding, privacy, fairness, cybersecurity, auditability, and human-rights
impact.

## Required Governance Behavior

When a developer asks for code that affects the child-safety classifier,
dashboard, prompt tester, audit trail, or report:

1. Identify child-specific risks and rights impacts.
2. Distinguish context policy from harm-rule matching.
3. Preserve child-safe defaults for child-directed and mixed-audience contexts.
4. Make retention choices explicit: no content, metadata only, redacted excerpt,
   or full content with justification.
5. Require human oversight for high-risk, urgent, or rights-sensitive outcomes.
6. Prefer source-backed explanations using UNICEF, UNESCO, AESIA, and model-card
   documentation references already encoded in the locked rules.
7. Keep auditability in mind: decisions should be explainable and suitable for
   appending to `audit-trail/decisions.jsonl`.

## Tradeoffs To Surface

- Safety vs privacy
- False positives vs false negatives
- Automation vs human oversight
- Data minimization vs model improvement
- Fairness across age, language, disability, culture, dialect, and writing style
- Cybersecurity and access control for sensitive child-safety records

## Implementation Expectations

- Do not store full child conversations by default.
- Do not silently escalate without a visible reason.
- Do not treat unknown age as harm evidence by itself.
- Do treat child-directed services as child-safe contexts regardless of claimed
  user age.
- Keep locked rules source-backed and non-disableable.
- Keep custom rules separate from locked rules.
- Run `npm run build` after frontend or decision-engine changes.
