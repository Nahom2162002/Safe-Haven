import type { LockedRuleId, RuleDefinition } from "../types";

export const LOCKED_RULES: Record<LockedRuleId, RuleDefinition> = {
  R0: {
    id: "R0",
    label: "Child-safe default for unknown age",
    description:
      "Treat unknown-age users as child-safe by default in child-accessible services.",
    baseRisk: "medium",
    category: "governance",
    locked: true,
    enabled: true,
  },
  R1: {
    id: "R1",
    label: "Child sexual exploitation and abuse",
    description:
      "Block, escalate, and audit suspected child sexual exploitation, abuse, or CSAM-related content.",
    baseRisk: "critical",
    category: "sexual_exploitation",
    locked: true,
    enabled: true,
  },
  R2: {
    id: "R2",
    label: "Grooming, coercion, and sextortion",
    description:
      "Escalate attempts to isolate, coerce, threaten, or sexually exploit a child.",
    baseRisk: "critical",
    category: "grooming",
    locked: true,
    enabled: true,
  },
  R3: {
    id: "R3",
    label: "Non-consensual intimate images / image-based abuse",
    description:
      "Flag threats, leaks, deepfakes, or sharing of intimate images without consent.",
    baseRisk: "high",
    category: "image_based_abuse",
    locked: true,
    enabled: true,
  },
  R4: {
    id: "R4",
    label: "Cyberbullying and peer-to-peer violence",
    description:
      "Identify bullying, harassment, humiliation, impersonation, or threats between peers.",
    baseRisk: "medium",
    category: "cyberbullying",
    locked: true,
    enabled: true,
  },
  R5: {
    id: "R5",
    label: "Self-harm, suicidal ideation, and severe distress",
    description:
      "Escalate imminent self-harm, suicidal ideation, and severe emotional distress.",
    baseRisk: "critical",
    category: "self_harm",
    locked: true,
    enabled: true,
  },
  R6: {
    id: "R6",
    label: "Abuse, violence, neglect, trafficking, and exploitation",
    description:
      "Detect physical abuse, neglect, trafficking, unsafe homes, or exploitation by adults.",
    baseRisk: "critical",
    category: "abuse_exploitation",
    locked: true,
    enabled: true,
  },
  R7: {
    id: "R7",
    label: "Age-inappropriate sexual or violent content",
    description:
      "Refuse or redirect sexual, pornographic, graphic, or violent content for child-safe contexts.",
    baseRisk: "high",
    category: "age_inappropriate_content",
    locked: true,
    enabled: true,
  },
  R8: {
    id: "R8",
    label: "Hate, discrimination, and identity-based abuse",
    description:
      "Detect hate speech, slurs, discrimination, and identity-based harassment.",
    baseRisk: "medium",
    category: "hate_discrimination",
    locked: true,
    enabled: true,
  },
  R9: {
    id: "R9",
    label: "Privacy, personal data exposure, and doxxing",
    description:
      "Protect addresses, school names, passwords, locations, private information, and doxxing targets.",
    baseRisk: "high",
    category: "privacy_pii",
    locked: true,
    enabled: true,
  },
  R10: {
    id: "R10",
    label: "Manipulative design, exploitative marketing, and dark patterns",
    description:
      "Flag exploitative product patterns such as pressure purchases, hidden cancellation, or child-targeted manipulation.",
    baseRisk: "medium",
    category: "manipulation_dark_patterns",
    locked: true,
    enabled: true,
  },
  R11: {
    id: "R11",
    label: "Economic exploitation and digital child labour",
    description:
      "Detect child labor, forced content production, scams, and economic exploitation.",
    baseRisk: "medium",
    category: "economic_exploitation",
    locked: true,
    enabled: true,
  },
  R12: {
    id: "R12",
    label: "Recruitment into armed conflict or violent exploitation",
    description:
      "Escalate recruitment into gangs, armed groups, criminal networks, or violent exploitation.",
    baseRisk: "critical",
    category: "violent_recruitment",
    locked: true,
    enabled: true,
  },
  R13: {
    id: "R13",
    label: "Weapons, explosives, biochemical harm, and severe physical danger",
    description:
      "Universally refuse instructions that enable weapons, explosives, poison, or severe physical harm.",
    baseRisk: "critical",
    category: "weapons_severe_danger",
    locked: true,
    enabled: true,
    universal: true,
  },
  R14: {
    id: "R14",
    label: "Harmful misinformation or unsafe advice affecting child safety",
    description:
      "Flag unsafe medical, legal, emergency, or safety advice that could harm a child.",
    baseRisk: "high",
    category: "harmful_misinformation",
    locked: true,
    enabled: true,
  },
  R15: {
    id: "R15",
    label: "Audit, explanation, reporting, and human oversight for high-risk cases",
    description:
      "Require auditable explanations, review, and data-minimized governance for high-risk safety actions.",
    baseRisk: "medium",
    category: "governance_failure",
    locked: true,
    enabled: true,
  },
};

export const LOCKED_GUIDELINES = Object.values(LOCKED_RULES);
