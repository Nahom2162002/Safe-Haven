import type { LockedRuleId, RuleDefinition } from "../types";

const UNICEF_AI_CHILDREN = {
  title: "Guidance on AI and children, Version 3.0",
  publisher: "UNICEF Innocenti",
  url: "https://www.unicef.org/innocenti/reports/policy-guidance-ai-children",
};

const UNICEF_AI_FRIEND_POLICY = {
  title:
    "When AI becomes a friend: Child rights risks, harms, and regulatory responses to AI chatbots and companions",
  publisher: "UNICEF",
  url: "https://www.unicef.org/media/181131/file/UNICEF-When-AI-becomes-friend-policy-brief-2026.pdf",
};

const UNICEF_AI_FRIEND_BUSINESS = {
  title:
    "When AI becomes a friend: UNICEF recommendations for business on AI chatbots and companions",
  publisher: "UNICEF",
  url: "https://www.unicef.org/media/181136/file/UNICEF-When-AI-becomes-friend-Business-recommendations-2026.pdf",
};

const UNICEF_DCRIA = {
  title:
    "D-CRIA: Assessing child rights impacts in relation to the digital environment",
  publisher: "UNICEF",
  url: "https://www.unicef.org/childrightsandbusiness/workstreams/responsible-technology/D-CRIA",
};

const UNICEF_DIGITAL_STRATEGY = {
  title:
    "10 Principles on children in the digital environment, Digital Transformation Strategy",
  publisher: "UNICEF",
  url: "https://www.unicef.org/digitalimpact/media/1391/file/UNICEF%20DX%20Strategy_Final.pdf",
};

const UNESCO_AI_ETHICS = {
  title: "Recommendation on the Ethics of Artificial Intelligence",
  publisher: "UNESCO",
  url: "https://www.unesco.org/en/artificial-intelligence/recommendation-ethics",
};

const AESIA_GUIDES = {
  title: "Guides for compliance with the EU AI Act",
  publisher: "AESIA",
  url: "https://aesia.digital.gob.es/en/guides",
};

const GOOGLE_MODEL_CARDS = {
  title: "Model cards",
  publisher: "Google DeepMind",
  url: "https://modelcards.withgoogle.com/about",
};

export const LOCKED_RULES: Record<LockedRuleId, RuleDefinition> = {
  R0: {
    id: "R0",
    label: "Child-safe default for unknown age",
    description:
      "Treat unknown-age users as child-safe by default in child-accessible services.",
    riskType: "Context and age-assurance risk",
    whyRisk:
      "If a service may be accessed by children and age is unknown, treating the user as adult can expose children to content, persuasion, or data practices that are not appropriate for them.",
    userGuidance:
      "Use child-safe defaults until age or platform access is reliably established.",
    complianceReferences: [
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Supports age assurance, access controls, child-risk assessment, and restrictions on harmful content for children.",
      },
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports child-centred AI requirements for safety, privacy, transparency, and child well-being.",
      },
    ],
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
    riskType: "Child sexual exploitation and abuse",
    whyRisk:
      "Sexual exploitation or abuse of children is severe child-safety harm and can involve illegal material, coercion, revictimization, and immediate safeguarding needs.",
    userGuidance:
      "Do not engage with or share the material. Escalate to trained safety staff and appropriate reporting channels.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Directly supports the requirements to ensure child safety and respect child rights in AI systems.",
      },
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Identifies sexualized children and harmful chatbot interactions as child-rights and safety risks.",
      },
      {
        ...UNICEF_DCRIA,
        relevance:
          "Supports identifying, preventing, and mitigating child-rights risks in digital products.",
      },
    ],
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
    riskType: "Grooming, coercion, and sextortion",
    whyRisk:
      "Requests for secrecy, private contact, images, threats, or blackmail can be grooming or sextortion patterns that isolate a child from trusted support.",
    userGuidance:
      "Do not continue privately. Save evidence if safe, block/report the person, and talk to a trusted guardian, teacher, counselor, or safety professional.",
    complianceReferences: [
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Supports safeguards for chatbot interactions that can mislead, sexualize, or harm children.",
      },
      {
        ...UNICEF_AI_FRIEND_BUSINESS,
        relevance:
          "Recommends testing risks to children's safety, autonomy, privacy, and mental well-being.",
      },
      {
        ...UNICEF_DIGITAL_STRATEGY,
        relevance:
          "Supports child protection and safety principles in the digital environment.",
      },
    ],
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
    riskType: "Image-based abuse and non-consensual intimate imagery",
    whyRisk:
      "Threats to share intimate images, deepfake sexual content, or non-consensual image distribution can cause serious privacy, dignity, safety, and coercion harms.",
    userGuidance:
      "Do not share or amplify the image. Report it, preserve evidence if safe, and seek support from a trusted adult or safety professional.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Highlights AI-generated child sexual abuse material and non-consensual intimate images as emerging AI risks.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports human dignity, human rights, do-no-harm, safety, and privacy principles.",
      },
    ],
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
    riskType: "Cyberbullying and peer violence",
    whyRisk:
      "Harassment, humiliation, impersonation, or threats can affect safety, mental well-being, participation, and dignity, especially for children and teens.",
    userGuidance:
      "Avoid retaliating. Save evidence if safe, block/report the abuse, and talk to a guardian, teacher, counselor, or trusted adult.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports children's safety, non-discrimination, inclusion, and well-being in AI systems.",
      },
      {
        ...UNICEF_DIGITAL_STRATEGY,
        relevance:
          "Supports children's rights and protection in the digital environment.",
      },
    ],
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
    riskType: "Self-harm and severe mental distress",
    whyRisk:
      "Self-harm or suicidal ideation can indicate immediate danger. AI systems should not minimize distress or replace urgent human support.",
    userGuidance:
      "If there is immediate danger, contact emergency services or a crisis hotline now. If the user is a child or teen, involve a trusted guardian, counselor, or trained safety responder.",
    complianceReferences: [
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Discusses reported failures around suicidal ideation in AI companion systems and the need for safeguards.",
      },
      {
        ...UNICEF_AI_FRIEND_BUSINESS,
        relevance:
          "Recommends testing risks to children's mental well-being and safety.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports do-no-harm, safety, human oversight, and protection of human rights.",
      },
    ],
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
    riskType: "Abuse, neglect, trafficking, and exploitation",
    whyRisk:
      "Reports of abuse, neglect, trafficking, or unsafe homes can indicate immediate safeguarding needs and power imbalance involving a child or vulnerable person.",
    userGuidance:
      "Prioritize safety. If immediate danger exists, contact emergency services. Otherwise involve a trusted guardian, safeguarding lead, counselor, or child protection professional.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports safety, child rights, best interests, and well-being requirements for AI systems.",
      },
      {
        ...UNICEF_DCRIA,
        relevance:
          "Supports identifying and mitigating child-rights risks from digital products and services.",
      },
    ],
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
    riskType: "Age-inappropriate sexual or graphic content",
    whyRisk:
      "Sexual, pornographic, graphic, or violent content can be inappropriate or harmful in child-directed or mixed-age environments even if similar content may be lawful for verified adults elsewhere.",
    userGuidance:
      "Use an age-appropriate redirect. If the user is a child or age is unknown, encourage talking with a guardian or trusted adult about confusing or upsetting content.",
    complianceReferences: [
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Highlights restrictions on content harmful to children and access-level protections for sexualized AI companion interactions.",
      },
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports safety, well-being, and best interests of children in AI systems.",
      },
    ],
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
    riskType: "Hate, discrimination, and identity-based abuse",
    whyRisk:
      "Identity-based abuse can undermine dignity, equality, inclusion, and safety, and can contribute to harassment or exclusion of children and adults.",
    userGuidance:
      "Do not repeat slurs or amplify abuse. Redirect to respectful language and report threats or targeted harassment.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports non-discrimination, fairness, inclusion, and child rights requirements.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports human dignity, diversity, inclusiveness, fairness, and non-discrimination.",
      },
    ],
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
    riskType: "Privacy, personal data, and doxxing",
    whyRisk:
      "Location, school, login, or personal data exposure can enable stalking, coercion, identity theft, doxxing, or offline harm.",
    userGuidance:
      "Remove or redact personal data. Do not share passwords, addresses, school names, or live location. Ask a guardian or trusted adult for help if private information was exposed.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Directly supports the requirement to protect children's data and privacy.",
      },
      {
        ...UNICEF_AI_FRIEND_BUSINESS,
        relevance:
          "Recommends testing privacy and autonomy risks to children.",
      },
      {
        ...AESIA_GUIDES,
        relevance:
          "Guide 7 on data governance is relevant to data quality, governance, and responsible handling under EU AI Act compliance practice.",
      },
    ],
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
    riskType: "Manipulative design and exploitative marketing",
    whyRisk:
      "Dark patterns and pressure tactics can undermine children's autonomy, exploit developmental vulnerabilities, and drive harmful or unfair choices.",
    userGuidance:
      "Avoid manipulative nudges. Use transparent, age-appropriate choices and ask a guardian before purchases or account changes.",
    complianceReferences: [
      {
        ...UNICEF_AI_FRIEND_POLICY,
        relevance:
          "Identifies exploitative design and misleading chatbots as regulatory concerns for child safety.",
      },
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports best interests, well-being, transparency, explainability, and accountability for children.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports transparency, human autonomy, proportionality, and do-no-harm principles.",
      },
    ],
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
    riskType: "Economic exploitation and digital child labour",
    whyRisk:
      "Forced content production, scams, or monetization pressure can exploit children economically and interfere with safety, education, development, and well-being.",
    userGuidance:
      "Do not pressure a child to produce content or work. Escalate suspected exploitation to a guardian, safeguarding lead, or appropriate authority.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Identifies child labour and harmful AI supply-chain practices as child-rights concerns.",
      },
      {
        ...UNICEF_DCRIA,
        relevance:
          "Supports child-rights impact assessment for digital business activities and AI products.",
      },
    ],
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
    riskType: "Violent recruitment and exploitation",
    whyRisk:
      "Recruiting or coercing children into armed groups, gangs, criminal networks, or violence can create severe physical danger and exploitation.",
    userGuidance:
      "Do not assist recruitment or planning. Escalate immediately to trained safety staff and appropriate safeguarding or emergency channels.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports child safety, protection from harm, and child-rights safeguards in AI systems.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports safety, security, human rights, and do-no-harm principles.",
      },
    ],
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
    riskType: "Weapons, explosives, and severe physical danger",
    whyRisk:
      "Instructions that enable weapons, explosives, poison, or severe physical harm can create immediate danger regardless of user age or platform context.",
    userGuidance:
      "Do not provide operational instructions. Redirect to safety, emergency help, or lawful educational high-level information where appropriate.",
    complianceReferences: [
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports do-no-harm, safety and security, risk assessment, and human-rights-centred AI governance.",
      },
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports ensuring safety for children and responsible AI practice.",
      },
    ],
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
    riskType: "Unsafe advice and harmful misinformation",
    whyRisk:
      "Unsafe medical, legal, emergency, or safety advice can lead to delayed care, physical harm, unsafe choices, or avoidable risk, especially for children.",
    userGuidance:
      "Encourage checking trusted sources and involving a guardian, qualified professional, doctor, counselor, or emergency service when safety is at stake.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports child safety, transparency, accountability, and child well-being requirements.",
      },
      {
        ...UNICEF_AI_FRIEND_BUSINESS,
        relevance:
          "Recommends testing risks to children's safety and mental well-being.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports transparency, explainability, safety, and do-no-harm principles.",
      },
    ],
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
    riskType: "Governance, auditability, and human oversight",
    whyRisk:
      "High-risk AI safety decisions need explanation, auditability, data minimization, and human oversight so harmful errors can be identified and corrected.",
    userGuidance:
      "Require a clear reason, minimal retained data, audit trail, and human review for high-impact safety or rights-sensitive actions.",
    complianceReferences: [
      {
        ...UNICEF_AI_CHILDREN,
        relevance:
          "Supports regulatory oversight, transparency, explainability, accountability, and responsible AI practice.",
      },
      {
        ...AESIA_GUIDES,
        relevance:
          "Guides 6, 7, and 11 are relevant to human supervision, data governance, and cybersecurity practices for EU AI Act compliance.",
      },
      {
        ...GOOGLE_MODEL_CARDS,
        relevance:
          "Supports structured documentation of model design, evaluation, limitations, and responsible use.",
      },
      {
        ...UNESCO_AI_ETHICS,
        relevance:
          "Supports human oversight, transparency, accountability, safety, and proportionality.",
      },
    ],
    baseRisk: "medium",
    category: "governance_failure",
    locked: true,
    enabled: true,
  },
};

export const LOCKED_GUIDELINES = Object.values(LOCKED_RULES);
