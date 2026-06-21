export type AgeGroup = "child" | "teen" | "unknown" | "verified_adult";

export type ServiceChildAccess =
  | "child_directed"
  | "mixed_audience"
  | "unknown"
  | "verified_adult_only";

export type InputType =
  | "user_message"
  | "ai_output"
  | "developer_setting"
  | "guardian_setting";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type DecisionAction =
  | "ALLOW"
  | "ALLOW_WITH_GUIDANCE"
  | "SAFE_REDIRECT"
  | "AGE_APPROPRIATE_REFUSAL"
  | "UNIVERSAL_REFUSAL"
  | "HUMAN_REVIEW"
  | "URGENT_ESCALATION"
  | "BLOCK_AND_AUDIT"
  | "REQUIRE_DEVELOPER_JUSTIFICATION"
  | "REQUIRE_RIGHTS_REVIEW";

export type RetentionMode =
  | "NO_CONTENT"
  | "METADATA_ONLY"
  | "REDACTED_EXCERPT"
  | "FULL_CONTENT_REQUIRES_JUSTIFICATION";

export type LockedRuleId =
  | "R0"
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13"
  | "R14"
  | "R15";

export type RuleId = LockedRuleId | `CUSTOM_${string}`;

export interface InputEvent {
  text: string;
  inputType: InputType;
  repeatedAttempts?: boolean;
  imminentRisk?: boolean;
  involvesTrustedAdult?: boolean;
  involvesPrivateImages?: boolean;
  involvesLocationOrPII?: boolean;
  couldEnableHarm?: boolean;
  requestedRetention?: RetentionMode;
}

export interface UserContext {
  ageGroup: AgeGroup;
  vulnerability?: "none" | "moderate" | "high";
}

export interface ServiceContext {
  childAccess: ServiceChildAccess;
  appType:
    | "chatbot"
    | "education"
    | "social"
    | "gaming"
    | "mental_health"
    | "adult_platform"
    | "general";
}

export interface DeveloperPolicy {
  policyVersion: string;
  allowFullConversationStorage?: boolean;
  humanReviewThreshold?: number;
  urgentEscalationThreshold?: number;
}

export interface RuleDefinition {
  id: RuleId;
  label: string;
  description: string;
  riskType?: string;
  whyRisk?: string;
  userGuidance?: string;
  complianceReferences?: ComplianceReference[];
  baseRisk: RiskLevel;
  category: string;
  locked: boolean;
  enabled: boolean;
  universal?: boolean;
}

export interface ComplianceReference {
  title: string;
  publisher: string;
  url: string;
  principle: string;
  relevance: string;
}

export interface MatchedRule extends RuleDefinition {
  matchReason?: string;
}

export interface RightsReview {
  rightsSensitive: boolean;
  necessary: boolean;
  proportionate: boolean;
  dataMinimized: boolean;
  explainable: boolean;
  auditable: boolean;
  passes: boolean;
  notes: string[];
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  inputType: InputType;
  serviceChildAccess: ServiceChildAccess;
  userAgeGroup: AgeGroup;
  appliedPolicy: string;
  matchedRules: RuleId[];
  harmCategories: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  action: DecisionAction;
  humanReviewRequired: boolean;
  retentionMode: RetentionMode;
  rightsReview: RightsReview;
  policyVersion: string;
}

export interface DecisionTraceStep {
  id: string;
  label: string;
  status: "pass" | "review" | "stop";
  detail: string;
}

export interface DecisionContext {
  ageGroup: AgeGroup;
  vulnerability: UserContext["vulnerability"];
  serviceChildAccess: ServiceChildAccess;
  appType: ServiceContext["appType"];
  appliedPolicy: string;
  childSafeDefaultApplied: boolean;
  childSafePolicyApplied: boolean;
  adultPolicyApplied: boolean;
}

export interface DecisionResult {
  decision: DecisionAction;
  appliedPolicy: string;
  context: DecisionContext;
  matchedRules: MatchedRule[];
  riskScore: number;
  riskLevel: RiskLevel;
  retentionMode: RetentionMode;
  humanReviewRequired: boolean;
  auditRequired: boolean;
  audit: AuditEvent;
  explanation: string;
  decisionTrace: DecisionTraceStep[];
}

export interface DecisionEngineOptions {
  now?: () => Date;
  createEventId?: () => string;
}
