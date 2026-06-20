import type {
  AuditEvent,
  DecisionAction,
  InputEvent,
  MatchedRule,
  RetentionMode,
  RightsReview,
  RiskLevel,
  RuleId,
  ServiceContext,
  UserContext,
} from "./types";

export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAuditEvent(params: {
  eventId: string;
  timestamp: string;
  input: InputEvent;
  user: UserContext;
  service: ServiceContext;
  appliedPolicy: string;
  matchedRules: MatchedRule[];
  riskScore: number;
  riskLevel: RiskLevel;
  action: DecisionAction;
  humanReviewRequired: boolean;
  retentionMode: RetentionMode;
  rightsReview: RightsReview;
  policyVersion: string;
}): AuditEvent {
  return {
    eventId: params.eventId,
    timestamp: params.timestamp,
    inputType: params.input.inputType,
    serviceChildAccess: params.service.childAccess,
    userAgeGroup: params.user.ageGroup,
    appliedPolicy: params.appliedPolicy,
    matchedRules: params.matchedRules.map((rule) => rule.id as RuleId),
    harmCategories: params.matchedRules.map((rule) => rule.category),
    riskScore: params.riskScore,
    riskLevel: params.riskLevel,
    action: params.action,
    humanReviewRequired: params.humanReviewRequired,
    retentionMode: params.retentionMode,
    rightsReview: params.rightsReview,
    policyVersion: params.policyVersion,
  };
}
