import type {
  AnalysisIssue,
  EmailAnalysis,
  EmailCategory,
  EmailMessage,
  EmailVariantMock,
  ImprovementSuggestion,
  SiteAction,
} from "../domain/models.ts";
import {
  countListingOverlap,
  hasPreferenceLink,
  hasUnsubscribeLink,
  hasVerificationLink,
  minutesSinceLastAction,
} from "../domain/metrics.ts";

export function analyzeEmail(email: EmailMessage, actions: SiteAction[]): EmailAnalysis {
  const minutesFromLastAction = minutesSinceLastAction(email, actions);
  const unsubscribe = hasUnsubscribeLink(email);
  const preferences = hasPreferenceLink(email);
  const verification = hasVerificationLink(email);
  const overlapScore = countListingOverlap(email, actions);

  const issues: AnalysisIssue[] = [];
  const suggestions: ImprovementSuggestion[] = [];

  applyCategoryRules(email.category, {
    email,
    minutesFromLastAction,
    unsubscribe,
    preferences,
    verification,
    overlapScore,
    issues,
    suggestions,
  });

  ensureEngagementSuggestions(email.category, suggestions);
  const variants = buildVariants(email, suggestions);

  const qualityPenalty = issues.reduce((score, issue) => score - severityWeight(issue.severity), 100);
  const relevanceScore = Math.round(overlapScore * 100);

  return {
    emailId: email.id,
    relevanceScore,
    qualityScore: Math.max(0, qualityPenalty),
    issues,
    suggestions,
    variants,
    metrics: {
      minutesFromLastAction,
      hasUnsubscribeLink: unsubscribe,
      hasPreferenceLink: preferences,
      hasVerificationLink: verification,
      totalLinks: email.links.length,
      subjectCharacterCount: email.subject.length,
      viewedListingOverlapScore: overlapScore,
    },
  };
}

function severityWeight(severity: AnalysisIssue["severity"]): number {
  switch (severity) {
    case "low":
      return 8;
    case "medium":
      return 18;
    case "high":
      return 30;
  }
}

function applyCategoryRules(
  category: EmailCategory,
  context: {
    email: EmailMessage;
    minutesFromLastAction: number | null;
    unsubscribe: boolean;
    preferences: boolean;
    verification: boolean;
    overlapScore: number;
    issues: AnalysisIssue[];
    suggestions: ImprovementSuggestion[];
  },
): void {
  switch (category) {
    case "verification":
      analyzeVerification(context);
      return;
    case "welcome":
      analyzeWelcome(context);
      return;
    case "recommendation":
    case "saved-search-alert":
      analyzeBehavioralEmail(context);
      return;
    case "digest":
    case "re-engagement":
    case "unknown":
      analyzeGeneralLifecycle(context);
      return;
  }
}

function analyzeVerification(context: {
  email: EmailMessage;
  minutesFromLastAction: number | null;
  verification: boolean;
  preferences: boolean;
  issues: AnalysisIssue[];
  suggestions: ImprovementSuggestion[];
}): void {
  if (!context.verification) {
    context.issues.push({
      code: "link-gap",
      severity: "high",
      summary: "The verification email did not expose an obvious verification action link.",
    });
    context.suggestions.push({
      title: "Make the verification CTA unmistakable",
      rationale: "Verification emails should make the primary action obvious and easy to complete.",
    });
  }

  if (context.minutesFromLastAction !== null && context.minutesFromLastAction > 30) {
    context.issues.push({
      code: "slow-follow-up",
      severity: "medium",
      summary: "The verification email arrived more than 30 minutes after the likely signup session.",
    });
    context.suggestions.push({
      title: "Deliver verification faster",
      rationale: "Verification mail feels most reliable when it lands immediately after signup.",
    });
  }

  if (!context.preferences) {
    context.suggestions.push({
      title: "Add a clear support or preference escape hatch",
      rationale: "Verification emails benefit from an obvious fallback path if the user is confused or didn't initiate the flow.",
    });
  }
}

function analyzeWelcome(context: {
  email: EmailMessage;
  preferences: boolean;
  issues: AnalysisIssue[];
  suggestions: ImprovementSuggestion[];
}): void {
  if (!context.preferences) {
    context.issues.push({
      code: "missing-personalization",
      severity: "low",
      summary: "The welcome email does not appear to guide the user into setting preferences or tailoring future mail.",
    });
    context.suggestions.push({
      title: "Guide the user into preferences early",
      rationale: "A strong welcome email should help the user configure alerts and personalize future content.",
    });
  }

  if (context.email.subject.length < 18) {
    context.suggestions.push({
      title: "Strengthen the welcome subject",
      rationale: "A more descriptive subject can better signal what value the user gets next from the product.",
    });
  }
}

function analyzeBehavioralEmail(context: {
  email: EmailMessage;
  minutesFromLastAction: number | null;
  unsubscribe: boolean;
  overlapScore: number;
  issues: AnalysisIssue[];
  suggestions: ImprovementSuggestion[];
}): void {
  if (!context.unsubscribe) {
    context.issues.push({
      code: "missing-unsubscribe",
      severity: "high",
      summary: "No unsubscribe or preference-management link was detected.",
    });
    context.suggestions.push({
      title: "Add a visible unsubscribe path",
      rationale: "Behavior-triggered lifecycle email should provide a compliant and easy-to-find preference option.",
    });
  }

  if (context.minutesFromLastAction !== null && context.minutesFromLastAction > 1440) {
    context.issues.push({
      code: "slow-follow-up",
      severity: "medium",
      summary: "The follow-up arrived more than 24 hours after the latest relevant user action.",
    });
    context.suggestions.push({
      title: "Shorten the trigger delay",
      rationale: "Recommendation and saved-search emails usually feel more relevant when they arrive closer to the session that triggered them.",
    });
  }

  if (context.overlapScore < 0.25) {
    context.issues.push({
      code: "weak-action-match",
      severity: "medium",
      summary: "The email content appears weakly matched to recently viewed or saved listings.",
    });
    context.suggestions.push({
      title: "Increase listing relevance",
      rationale: "Use recently viewed or saved homes more aggressively when selecting properties for recommendation emails.",
    });
  }

  if (context.email.subject.length < 20) {
    context.suggestions.push({
      title: "Strengthen the subject line",
      rationale: "Short subjects can miss context like market, alert type, or the specific value of opening.",
    });
  }
}

function analyzeGeneralLifecycle(context: {
  email: EmailMessage;
  unsubscribe: boolean;
  preferences: boolean;
  issues: AnalysisIssue[];
  suggestions: ImprovementSuggestion[];
}): void {
  if (!context.unsubscribe && !context.preferences) {
    context.suggestions.push({
      title: "Offer clearer email controls",
      rationale: "General lifecycle messages should still make it easy to control frequency and preferences.",
    });
  }

  if (context.email.subject.length < 16) {
    context.suggestions.push({
      title: "Increase subject clarity",
      rationale: "Short subjects can hide the purpose of the email and reduce open intent.",
    });
  }
}

function ensureEngagementSuggestions(
  category: EmailCategory,
  suggestions: ImprovementSuggestion[],
): void {
  const existingTitles = new Set(suggestions.map((suggestion) => suggestion.title));

  const maybeAdd = (title: string, rationale: string): void => {
    if (!existingTitles.has(title)) {
      suggestions.push({ title, rationale });
      existingTitles.add(title);
    }
  };

  switch (category) {
    case "verification":
      maybeAdd(
        "Increase verification completion",
        "Reduce friction by making the verify CTA dominant and reinforcing why completing verification matters right now.",
      );
      maybeAdd(
        "Improve trust around the action",
        "A short trust cue can increase clicks by clarifying that the action is secure and expected.",
      );
      return;
    case "welcome":
      maybeAdd(
        "Drive the first meaningful click",
        "Welcome emails perform better when they point to a single next step instead of several equal-weight options.",
      );
      maybeAdd(
        "Tie the click to immediate value",
        "Explain what the user gets right after clicking so the action feels rewarding, not administrative.",
      );
      return;
    case "recommendation":
    case "saved-search-alert":
      maybeAdd(
        "Sharpen click-through intent",
        "Recommendation emails can earn more clicks by highlighting why these options are relevant now, not just that they exist.",
      );
      maybeAdd(
        "Lead with the strongest content hook",
        "Use the highest-interest benefit in the subject and CTA so the email feels worth opening and acting on.",
      );
      return;
    default:
      maybeAdd(
        "Create a stronger primary action",
        "Clarify the one action the reader should take next so the message feels more purposeful and clickable.",
      );
      maybeAdd(
        "Increase open-to-click momentum",
        "Connect the subject, first sentence, and CTA more tightly so interest carries through the whole message.",
      );
    }
}

function buildVariants(email: EmailMessage, suggestions: ImprovementSuggestion[]): EmailVariantMock[] {
  const suggestionTitles = suggestions.map((suggestion) => suggestion.title.toLowerCase());
  const emphasizeTrust = suggestionTitles.some((title) => title.includes("trust") || title.includes("verify"));
  const emphasizeValue = suggestionTitles.some((title) => title.includes("value") || title.includes("meaningful"));
  const emphasizeUrgency = suggestionTitles.some((title) => title.includes("faster") || title.includes("sharpen"));

  const base = categoryCopy(email.category, email.subject);

  return [
    {
      label: "Variant A",
      angle: emphasizeValue ? "Value-first" : "Clarity-first",
      subject: base.subjects[0],
      preheader: base.preheaders[0],
      cta: base.ctas[0],
      body: base.bodies[0],
    },
    {
      label: "Variant B",
      angle: emphasizeTrust ? "Trust and reassurance" : "Benefit-led",
      subject: base.subjects[1],
      preheader: base.preheaders[1],
      cta: base.ctas[1],
      body: base.bodies[1],
    },
    {
      label: "Variant C",
      angle: emphasizeUrgency ? "Momentum and urgency" : "Action-focused",
      subject: base.subjects[2],
      preheader: base.preheaders[2],
      cta: base.ctas[2],
      body: base.bodies[2],
    },
  ];
}

function categoryCopy(
  category: EmailCategory,
  subject: string,
): {
  subjects: [string, string, string];
  preheaders: [string, string, string];
  ctas: [string, string, string];
  bodies: [string, string, string];
} {
  switch (category) {
    case "verification":
      return {
        subjects: [
          "Verify your email to unlock your account",
          "One quick step to finish setting up your account",
          "Complete setup now so you don't miss updates",
        ],
        preheaders: [
          "Finish verification in one click and start receiving the right updates.",
          "Confirm your email address so your account is fully ready to use.",
          "Verify now to avoid missing alerts, saved searches, and account activity.",
        ],
        ctas: ["Verify my email", "Finish account setup", "Complete verification"],
        bodies: [
          "You're one click away from activating your account and getting the updates you signed up for.",
          "Confirm your email now so your account is ready and any future alerts reach you without interruption.",
          "Finish verification today so you can keep your account active and start receiving the most relevant updates.",
        ],
      };
    case "welcome":
      return {
        subjects: [
          "Start with one smart step in your new account",
          "Make your new account work for you today",
          "Get more value from your new account right away",
        ],
        preheaders: [
          "Choose your first action so future emails feel more useful and personal.",
          "Set preferences or explore your next step to get better recommendations faster.",
          "A quick first click can shape better alerts, recommendations, and follow-ups.",
        ],
        ctas: ["Set my preferences", "Get started", "Choose my next step"],
        bodies: [
          "Welcome in. Give the reader one high-value action that makes the next email feel more relevant and personal.",
          "Use this first message to show immediate value and guide the reader to the one click that improves the rest of the journey.",
          "Turn the welcome email into momentum by helping the user do the first small thing that unlocks better future communication.",
        ],
      };
    case "recommendation":
    case "saved-search-alert":
      return {
        subjects: [
          "New picks based on what you've been looking at",
          "Options worth a closer look today",
          "Fresh matches that fit your search",
        ],
        preheaders: [
          "See the options that best match your recent views and saved activity.",
          "Open the strongest matches first and compare what changed.",
          "These picks were chosen to feel more relevant, timely, and worth the click.",
        ],
        ctas: ["See matching options", "View the best matches", "Explore new matches"],
        bodies: [
          "Lead with the options most likely to win the click, and make the reason for each recommendation feel immediately relevant.",
          "Use stronger selection cues so the email feels less like a generic batch and more like a helpful update worth opening.",
          "Create urgency around freshness, fit, or change so the reader feels there is a timely reason to click now.",
        ],
      };
    default:
      return {
        subjects: [
          `A clearer next step after "${trimSubject(subject)}"`,
          "A stronger reason to click next",
          "A tighter follow-up with one clear action",
        ],
        preheaders: [
          "Clarify the main takeaway and the one action the reader should take next.",
          "Carry open interest into a more direct and valuable CTA.",
          "Use stronger message framing so the click feels obvious and worthwhile.",
        ],
        ctas: ["Take the next step", "See what's next", "Continue here"],
        bodies: [
          "This version focuses on one clear action so the reader knows exactly what to do next.",
          "This version links the promise in the subject to the value behind the click.",
          "This version adds more momentum so the email feels like the next step in a journey, not an isolated message.",
        ],
      };
  }
}

function trimSubject(subject: string): string {
  const cleaned = subject.trim();
  return cleaned.length > 32 ? `${cleaned.slice(0, 29)}...` : cleaned || "this email";
}
