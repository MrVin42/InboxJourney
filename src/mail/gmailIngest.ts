import type { gmail_v1 } from "googleapis";

import type { EmailCategory, EmailMessage, GmailTabCategory } from "../domain/models.ts";

export interface PullInboxOptions {
  alias?: string;
  emailDomain: string;
  lookbackDays: number;
  maxResults: number;
}

export interface PulledInboxMessage {
  gmailId: string;
  threadId?: string | null;
  historyId?: string | null;
  internalDate?: string | null;
  labelIds: string[];
  from: string;
  to: string;
  deliveredTo?: string;
  subject: string;
  date?: string;
  matchedAliases: string[];
  links: string[];
  snippet?: string;
  normalized: EmailMessage;
}

export async function listLabels(gmail: gmail_v1.Gmail): Promise<string[]> {
  const response = await gmail.users.labels.list({ userId: "me" });
  return (response.data.labels ?? []).map((label) => label.name ?? "").filter(Boolean);
}

export async function pullInboxMessages(
  gmail: gmail_v1.Gmail,
  options: PullInboxOptions,
): Promise<PulledInboxMessage[]> {
  const query = buildQuery(options);
  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: options.maxResults,
  });

  const messageIds = (listResponse.data.messages ?? []).map((message) => message.id).filter(Boolean) as string[];
  const hydrated = await Promise.all(
    messageIds.map((messageId) =>
      gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      }),
    ),
  );

  return hydrated
    .map((response) => response.data)
    .map((message) => normalizeMessage(message, options.emailDomain))
    .filter((message): message is PulledInboxMessage => Boolean(message))
    .filter((message) => {
      if (!options.alias) {
        return message.matchedAliases.length > 0;
      }
      return message.matchedAliases.some((alias) => alias.toLowerCase() === options.alias?.toLowerCase());
    });
}

function buildQuery(options: PullInboxOptions): string {
  return `newer_than:${options.lookbackDays}d`;
}

function normalizeMessage(
  message: gmail_v1.Schema$Message,
  emailDomain: string,
): PulledInboxMessage | null {
  const payload = message.payload;
  const headers = payload?.headers ?? [];
  const from = readHeader(headers, "from");
  const to = readHeader(headers, "to");
  const deliveredTo = readHeader(headers, "delivered-to");
  const subject = readHeader(headers, "subject");
  const date = readHeader(headers, "date");
  const labelIds = (message.labelIds ?? []).filter(Boolean);
  const matchedAliases = extractExperimentAliases(headers, emailDomain);
  const bodies = extractBodies(payload);
  const links = extractLinks([bodies.html, bodies.text, message.snippet].filter(Boolean).join("\n"));

  if (!from && !to && !subject) {
    return null;
  }

  const normalized: EmailMessage = {
    id: message.id ?? cryptoRandomId(),
    runId: "unmatched",
    messageId: readHeader(headers, "message-id") || message.id || cryptoRandomId(),
    receivedAt: toIsoTimestamp(message.internalDate, date),
    from,
    subject,
    category: categorizeEmail(subject, from),
    gmailTab: detectGmailTab(labelIds),
    gmailLabelIds: labelIds,
    html: bodies.html,
    text: bodies.text,
    links,
    rawStorageKey: undefined,
  };

  return {
    gmailId: message.id ?? "",
    threadId: message.threadId,
    historyId: message.historyId,
    internalDate: message.internalDate,
    labelIds,
    from,
    to,
    deliveredTo,
    subject,
    date,
    matchedAliases,
    links,
    snippet: message.snippet ?? undefined,
    normalized,
  };
}

function readHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find((header) => header.name?.toLowerCase() === name)?.value?.trim() ?? "";
}

function extractExperimentAliases(
  headers: gmail_v1.Schema$MessagePartHeader[],
  emailDomain: string,
): string[] {
  const domain = emailDomain.replace(/\./g, "\\.");
  const pattern = new RegExp(`[a-z0-9._%+-]+@${domain}`, "gi");
  const headerValues = headers
    .filter((header) =>
      ["to", "delivered-to", "x-forwarded-to", "x-original-to", "cc"].includes(header.name?.toLowerCase() ?? ""),
    )
    .map((header) => header.value ?? "");

  return [...new Set(headerValues.flatMap((value) => value.match(pattern) ?? []).map((alias) => alias.toLowerCase()))];
}

function extractBodies(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { html?: string; text?: string } {
  const result: { html?: string; text?: string } = {};

  visitPart(payload, result);
  return result;
}

function visitPart(
  part: gmail_v1.Schema$MessagePart | undefined,
  result: { html?: string; text?: string },
): void {
  if (!part) {
    return;
  }

  const mimeType = part.mimeType ?? "";
  const data = part.body?.data ? decodeBase64Url(part.body.data) : undefined;

  if (mimeType === "text/html" && data && !result.html) {
    result.html = data;
  }

  if (mimeType === "text/plain" && data && !result.text) {
    result.text = data;
  }

  for (const child of part.parts ?? []) {
    visitPart(child, result);
  }
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractLinks(content: string): string[] {
  return [...new Set(content.match(/https?:\/\/[^\s"'<>]+/g) ?? [])];
}

function categorizeEmail(subject: string, from: string): EmailCategory {
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();
  const combined = `${fromLower} ${subjectLower}`;

  if (subjectLower.includes("verify") || subjectLower.includes("verification")) {
    return "verification";
  }

  if (subjectLower.includes("welcome")) {
    return "welcome";
  }

  if (combined.includes("verify") || combined.includes("confirmation")) {
    return "verification";
  }

  if (combined.includes("saved search") || combined.includes("new listing")) {
    return "saved-search-alert";
  }

  if (combined.includes("digest")) {
    return "digest";
  }

  if (combined.includes("come back") || combined.includes("still interested")) {
    return "re-engagement";
  }

  if (combined.includes("recommend") || combined.includes("you may like")) {
    return "recommendation";
  }

  return "unknown";
}

function detectGmailTab(labelIds: string[]): GmailTabCategory {
  if (labelIds.includes("CATEGORY_PROMOTIONS")) {
    return "promotions";
  }

  if (labelIds.includes("CATEGORY_SOCIAL")) {
    return "social";
  }

  if (labelIds.includes("CATEGORY_UPDATES")) {
    return "updates";
  }

  if (labelIds.includes("CATEGORY_FORUMS")) {
    return "forums";
  }

  if (labelIds.includes("CATEGORY_PERSONAL")) {
    return "primary";
  }

  return "unknown";
}

function toIsoTimestamp(internalDate: string | null | undefined, headerDate: string): string {
  if (internalDate) {
    const timestamp = Number(internalDate);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  const fallback = headerDate ? new Date(headerDate) : new Date();
  return fallback.toISOString();
}

function cryptoRandomId(): string {
  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}
