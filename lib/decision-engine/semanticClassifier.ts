import type {
  DetectionSignal,
  InputEvent,
  LockedRuleId,
  ServiceContext,
  UserContext,
} from "./types";

type SemanticRule = {
  ruleId: LockedRuleId;
  label: string;
  confidence: number;
  rationale: string;
  patterns: RegExp[];
};

const SEMANTIC_RULES: SemanticRule[] = [
  {
    ruleId: "R1",
    label: "Possible child sexual exploitation",
    confidence: 0.9,
    rationale:
      "The message refers to sexualized content or sexual contact involving a child, teen, classmate, student, or other minor.",
    patterns: [
      /\b(sex|sexual|consensual sex|sleep with|hook up with)\b.*\b(1[0-7][ -]?(year[ -]?old|yo|y\/o)|minor|underage|child|kid|teen|teenager)\b/i,
      /\b(1[0-7][ -]?(year[ -]?old|yo|y\/o)|minor|underage|child|kid|teen|teenager)\b.*\b(sex|sexual|consensual sex|sleep with|hook up with)\b/i,
      /\b(kid|child|minor|underage|teen|classmate|student|someone at school)\b.*\bnude\s+(pic|pics|picture|pictures|photo|photos|image|images)\b/i,
      /\bnude\s+(pic|pics|picture|pictures|photo|photos|image|images)\b.*\b(kid|child|minor|underage|teen|classmate|student|someone at school)\b/i,
    ],
  },
  {
    ruleId: "R3",
    label: "Non-consensual intimate image sharing",
    confidence: 0.88,
    rationale:
      "The message asks how to post, leak, or distribute nude/private images, which can create privacy, dignity, coercion, and safety harms.",
    patterns: [
      /\b(post|share|upload|leak|send)\b.*\bnude\s+(pic|pics|picture|pictures|photo|photos|image|images)\b/i,
      /\bnude\s+(pic|pics|picture|pictures|photo|photos|image|images)\b.*\b(post|share|upload|leak|send)\b/i,
      /\b(post|share|upload|leak)\b.*\b(pictures|photos|images)\b.*\b(make them feel bad|embarrass|humiliate|revenge|get back at)\b/i,
    ],
  },
  {
    ruleId: "R4",
    label: "Peer harm, bullying, or physical aggression",
    confidence: 0.78,
    rationale:
      "The message describes possible peer harassment, humiliation, threat, or physical assault.",
    patterns: [
      /\b(they|he|she|someone|kids?|classmates?|friends?)\s+(kicked|punched|hit|slapped|shoved|pushed|jumped|attacked|threatened)\s+me\b/i,
      /\bkeeps?\s+(calling|texting|following|mocking|teasing|harassing)\s+me\b/i,
      /\bmade\s+(everyone|people|my friends|the class)\s+(hate|laugh at|turn against)\s+me\b/i,
      /\b(spread|spreading|posted|posting|shared|sharing)\s+(rumors?|lies|embarrassing|private)\b/i,
      /\b(they|someone|kids?|classmates?)\s+(won'?t stop|keep)\s+(making fun|laughing|messaging|posting)\b/i,
    ],
  },
  {
    ruleId: "R5",
    label: "Severe distress or self-harm concern",
    confidence: 0.86,
    rationale:
      "The message suggests severe distress or possible self-harm risk that should not be handled by automation alone.",
    patterns: [
      /\b(can'?t do this anymore|done with everything|want it all to stop)\b/i,
      /\b(i feel|i am|i'?m)\s+(hopeless|worthless|empty|trapped|done)\b/i,
      /\b(no one would care|everyone would be better without me)\b/i,
    ],
  },
  {
    ruleId: "R2",
    label: "Grooming, coercion, or secrecy pressure",
    confidence: 0.82,
    rationale:
      "The message includes secrecy, isolation, coercion, or private-image pressure that can indicate grooming or sextortion.",
    patterns: [
      /\b(our|this)\s+secret\b/i,
      /\b(don'?t|do not)\s+(tell|show)\s+(your parents|your mom|your dad|anyone|a teacher)\b/i,
      /\b(send|show)\s+(a|me|your)?\s*(pic|photo|image|selfie)\b/i,
      /\bmeet\s+(alone|in private|after school|without anyone)\b/i,
    ],
  },
  {
    ruleId: "R6",
    label: "Abuse, neglect, or unsafe home concern",
    confidence: 0.84,
    rationale:
      "The message describes possible abuse, neglect, coercion, or an unsafe living situation.",
    patterns: [
      /\b(my|a)\s+(parent|mom|dad|teacher|coach|guardian)\s+(hit|hits|hurt|hurts|touch|touches|threatened|threatens)\b/i,
      /\b(i'?m|i am)\s+(scared|afraid|unsafe)\s+(at home|to go home|around them)\b/i,
      /\b(no food|locked me out|left me alone|forced me to work)\b/i,
    ],
  },
  {
    ruleId: "R7",
    label: "Age-inappropriate sexual content in child-safe context",
    confidence: 0.8,
    rationale:
      "The message asks about sexual activity or explicit sexual content in a child-safe context.",
    patterns: [
      /\bsexual activity\b/i,
      /\bsex act\b/i,
      /\bsexual boundaries\b/i,
      /\bwhat .* sexual .* off limits\b/i,
      /\b(porn|explicit sexual|graphic sexual|sexual content)\b/i,
    ],
  },
  {
    ruleId: "R9",
    label: "Personal data or location exposure",
    confidence: 0.74,
    rationale:
      "The message may expose location, school, credentials, or personal contact information.",
    patterns: [
      /\b(my|their)\s+(address|phone|password|login|school|location)\b/i,
      /\b(where\s+i\s+live|come\s+to\s+my\s+house|near\s+my\s+school)\b/i,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    ],
  },
];

export function detectSemanticSignals(
  input: InputEvent,
  user: UserContext,
  service: ServiceContext
): DetectionSignal[] {
  const text = input.text.trim();
  if (!text) return [];

  return SEMANTIC_RULES.flatMap((rule) => {
    const pattern = rule.patterns.find((item) => item.test(text));
    if (!pattern) return [];

    const confidence = adjustConfidence(rule.confidence, user, service);
    return [
      {
        ruleId: rule.ruleId,
        label: rule.label,
        source: "semantic_classifier",
        confidence,
        evidence: summarizeEvidence(text),
        rationale: rule.rationale,
      },
    ];
  });
}

function adjustConfidence(
  baseConfidence: number,
  user: UserContext,
  service: ServiceContext
): number {
  let confidence = baseConfidence;

  if (user.ageGroup === "child" || user.ageGroup === "teen") confidence += 0.05;
  if (user.vulnerability === "high") confidence += 0.04;
  if (service.childAccess === "child_directed") confidence += 0.03;

  return Math.min(0.98, Number(confidence.toFixed(2)));
}

function summarizeEvidence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 137)}...`;
}
