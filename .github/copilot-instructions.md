# Safe Haven Copilot Instructions

This repository builds child-safety governance for AI-powered chat systems.
Treat chatbot, moderation, retention, escalation, audit, age-assurance, guardian
notification, and model-evaluation work as rights-sensitive.

Before implementing or modifying any feature involving:

- chatbots or AI-generated responses
- prompt moderation or child-safety classification
- age gates, age assurance, or user-age inference
- storage of user messages, chat logs, transcripts, analytics, or training data
- guardian notifications, school reporting, escalation, or human review
- blocking, refusal, reporting, or redirection logic
- evaluation datasets or safety metrics using user conversations

use the `childSafetyGovernor` MCP tools to review the feature for:

1. child-safe default behavior,
2. locked harm categories,
3. risk level,
4. escalation requirements,
5. retention and data minimization,
6. human oversight,
7. audit logging,
8. child-friendly and source-backed explanations.

Prefer these tools:

- `safe_haven_review_feature_plan` before designing a new feature.
- `safe_haven_review_code_diff` before finalizing a patch.
- `safe_haven_review_retention_policy` before storing messages or analytics.
- `safe_haven_generate_required_tests` before or after implementation.
- `safe_haven_generate_audit_finding` when recording a governance decision.
- `safe_haven_classify_prompt` for concrete prompt examples.

Do not implement full child conversation retention by default. Prefer
`NO_CONTENT`, `METADATA_ONLY`, or `REDACTED_EXCERPT` unless the MCP review and a
documented rights review justify more.

Do not silently escalate, notify guardians, or share sensitive child-safety
records without a visible reason, proportionality check, and audit event.

When code is produced, include safe defaults, retention controls, audit event
generation, source-backed explanations, and tests for both high-risk cases and
benign false positives.
