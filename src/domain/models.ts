export type SiteName = string;

export type IdentityMode =
  | "custom-domain-catchall"
  | "gmail-plus-alias"
  | "dedicated-inbox";

export type ScenarioStatus =
  | "planned"
  | "running"
  | "awaiting-email"
  | "completed"
  | "failed";

export type SiteActionType =
  | "account-created"
  | "email-verified"
  | "search-performed"
  | "listing-viewed"
  | "listing-saved"
  | "search-saved"
  | "session-resumed";

export type EmailCategory =
  | "verification"
  | "welcome"
  | "recommendation"
  | "saved-search-alert"
  | "digest"
  | "re-engagement"
  | "unknown";

export type GmailTabCategory =
  | "primary"
  | "promotions"
  | "social"
  | "updates"
  | "forums"
  | "unknown";

export interface ExperimentIdentity {
  id: string;
  site: SiteName;
  scenarioKey: string;
  runId: string;
  mode: IdentityMode;
  emailAddress: string;
  createdAt: string;
  tags: string[];
}

export interface AccountProfile {
  id: string;
  site: SiteName;
  identityId: string;
  signupUrl: string;
  createdAt: string;
  verifiedAt?: string;
}

export interface ScenarioRun {
  id: string;
  site: SiteName;
  scenarioKey: string;
  accountId: string;
  startedAt: string;
  completedAt?: string;
  status: ScenarioStatus;
  market: string;
  notes?: string;
}

export interface SiteAction {
  id: string;
  runId: string;
  type: SiteActionType;
  occurredAt: string;
  details: Record<string, string | number | boolean>;
}

export interface EmailMessage {
  id: string;
  runId: string;
  messageId: string;
  receivedAt: string;
  from: string;
  subject: string;
  category: EmailCategory;
  gmailTab: GmailTabCategory;
  gmailLabelIds: string[];
  html?: string;
  text?: string;
  links: string[];
  rawStorageKey?: string;
}

export interface AnalysisIssue {
  code:
    | "missing-unsubscribe"
    | "missing-personalization"
    | "subject-duplication"
    | "weak-action-match"
    | "link-gap"
    | "slow-follow-up";
  severity: "low" | "medium" | "high";
  summary: string;
}

export interface ImprovementSuggestion {
  title: string;
  rationale: string;
}

export interface EmailVariantMock {
  label: string;
  angle: string;
  subject: string;
  preheader: string;
  cta: string;
  body: string;
}

export interface EmailMetrics {
  minutesFromLastAction: number | null;
  hasUnsubscribeLink: boolean;
  hasPreferenceLink: boolean;
  hasVerificationLink: boolean;
  totalLinks: number;
  subjectCharacterCount: number;
  viewedListingOverlapScore: number;
}

export interface EmailAnalysis {
  emailId: string;
  relevanceScore: number;
  qualityScore: number;
  issues: AnalysisIssue[];
  suggestions: ImprovementSuggestion[];
  variants: EmailVariantMock[];
  metrics: EmailMetrics;
}
