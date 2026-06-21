# Child-Safety Governance Report

## System Identification

- Name: Safe Haven
- Version: Hackathon prototype
- Date: 2026-06-21
- Case study: Child safety and safeguarding in AI-powered chat systems
- Challenge: Hackathon UN Tech Over 2026 — SpainGov Challenge, Safety,
  Supervision and Governance in the Agentic World

## Purpose

Safe Haven demonstrates a governance layer for AI-powered chat systems that may
detect bullying, grooming, self-harm, abuse, distress, privacy risk, or urgent
safety concerns in children’s messages.

The system is intended to show how safeguarding decisions can be made explicit,
reviewable, and source-backed.

It is not a production classifier and must not be used as the sole basis for
real-world safeguarding, disciplinary, medical, legal, or law-enforcement action.

## Data Assumptions

The prototype uses synthetic prompts and rubric cases. This avoids collecting or
storing real child conversations for the hackathon demo.

Production development would require:

- lawful basis and child-rights impact assessment
- strict minimization of sensitive child conversation data
- secure storage and access controls
- disaggregated evaluation
- trained human reviewers
- jurisdiction-specific legal review

## Governance Logic

The system separates:

- context policy: age group, child access, app type, and vulnerability
- harm rules: matched child-safety, privacy, exploitation, or governance risks
- risk scoring: low, medium, high, critical
- action: allow, redirect, refusal, human review, urgent escalation
- retention: no content, metadata only, redacted excerpt, full content requiring
  justification
- rights review: necessity, proportionality, minimization, explainability, and
  auditability

## Human Rights Framing

The UNICEF case study identifies possible impacts under the UN Convention on the
Rights of the Child, including:

- Article 3: best interests of the child
- Article 12: right to be heard and participate
- Article 16: privacy and dignity
- Article 19: protection from violence, abuse, neglect, and exploitation
- Article 34: protection from sexual exploitation and abuse

## AI Act Framing

Depending on context of use, a child-safety classifier may be high-risk or
safety-sensitive, especially when used in safeguarding, education, essential
services, or decisions affecting children.

Safe Haven therefore emphasizes:

- human oversight
- data governance
- cybersecurity
- transparency
- auditability
- risk management

## Foreseeable Risks

- False negatives may miss urgent child-safety risks.
- False positives may create unnecessary surveillance or intervention.
- Excessive retention may expose sensitive child data.
- Automated escalation without trained human review may harm dignity, privacy,
  or access to support.
- Keyword matching may fail across languages, dialects, disabilities, slang, or
  cultural writing styles.

## Human Oversight

High-risk, critical, and rights-sensitive outcomes should route to trained
human reviewers or safeguarding professionals. Urgent self-harm, abuse,
exploitation, or physical-danger scenarios require immediate escalation
protocols.

## Traceability

Technical decision records are represented in:

```text
audit-trail/decisions.jsonl
```

The committed file contains seed governance decisions. The live dashboard also
records every Prompt Tester run in browser localStorage and exposes an **Export
audit JSONL** button. This lets reviewers download a prompt-level paper trail
without requiring a backend server.

The decision engine emits structured audit events containing:

- event ID and timestamp
- policy context
- matched rules
- risk score and level
- action
- retention mode
- human-review requirement
- rights-review result
- policy version

## Source Families

Safe Haven locked rules cite:

- UNICEF Guidance on AI and Children
- UNICEF AI chatbots and companions policy brief
- UNICEF business recommendations for AI chatbots and companions
- UNICEF D-CRIA
- UNICEF Digital Transformation Strategy
- UNESCO Recommendation on the Ethics of Artificial Intelligence
- AESIA EU AI Act guides
- Google DeepMind Model Cards
