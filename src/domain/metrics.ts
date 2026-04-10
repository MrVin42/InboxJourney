import type { EmailMessage, SiteAction } from "./models.ts";

export function minutesSinceLastAction(email: EmailMessage, actions: SiteAction[]): number | null {
  if (actions.length === 0) {
    return null;
  }

  const emailTime = new Date(email.receivedAt).getTime();
  const latestActionTime = actions
    .map((action) => new Date(action.occurredAt).getTime())
    .filter((time) => time <= emailTime)
    .sort((a, b) => b - a)[0];

  if (!latestActionTime) {
    return null;
  }

  return Math.round((emailTime - latestActionTime) / 60000);
}

export function countListingOverlap(email: EmailMessage, actions: SiteAction[]): number {
  const listingIds = actions
    .filter((action) => action.type === "listing-viewed" || action.type === "listing-saved")
    .map((action) => String(action.details.listingId));

  if (listingIds.length === 0 || !email.html) {
    return 0;
  }

  const hits = listingIds.filter((listingId) => email.html?.includes(listingId)).length;
  return Math.min(1, hits / listingIds.length);
}

export function hasUnsubscribeLink(email: EmailMessage): boolean {
  return email.links.some((link) => /unsubscribe|email-preferences|optout/i.test(link));
}

export function hasPreferenceLink(email: EmailMessage): boolean {
  return email.links.some((link) => /preferences|subscriptions|settings/i.test(link));
}

export function hasVerificationLink(email: EmailMessage): boolean {
  return email.links.some((link) => /verify|verification|confirm|email-verification/i.test(link));
}
