import { correlateAndAnalyzeMessages, type CorrelatedExperimentEmail } from "../correlation/experimentCorrelation.ts";
import {
  loadConfig,
  type AppUserConfig,
  type InboxConfig,
  type InboxTestConfig,
  type WorkspaceSummary,
} from "../config.ts";
import { createGmailClient } from "../mail/gmailClient.ts";
import { pullInboxMessages } from "../mail/gmailIngest.ts";
import { generateTimelineReport } from "../report/reportGenerator.ts";

export interface SyncInboxOptions {
  workspaceId?: string;
  userId?: string;
  inboxId?: string;
  testId?: string;
  alias?: string;
  lookbackDays?: number;
  maxResults?: number;
}

export interface SyncInboxResult {
  workspaceId: string;
  alias: string | null;
  userId: string | null;
  inboxId: string | null;
  testId: string | null;
  workspaceName: string;
  availableWorkspaces: WorkspaceSummary[];
  availableInboxes: Array<{ id: string; label: string; userId: string }>;
  inboxCount: number;
  userCount: number;
  pulledCount: number;
  analyzedCount: number;
  report: {
    generatedAt: string;
    reportDir: string;
    indexPath: string;
    previewCount: number;
    screenshotCount: number;
  };
}

export async function syncInboxReport(options: SyncInboxOptions = {}): Promise<SyncInboxResult> {
  const config = loadConfig({ workspaceId: options.workspaceId });
  const selectedInboxes = selectInboxes(config.inboxes, options);
  const correlatedResults: CorrelatedExperimentEmail[] = [];
  let pulledCount = 0;

  for (const inbox of selectedInboxes) {
    const owner = config.users.find((user) => user.id === inbox.userId);
    if (!owner) {
      throw new Error(`Inbox "${inbox.id}" references missing user "${inbox.userId}".`);
    }

    const lookbackDays = options.lookbackDays ?? inbox.gmailLookbackDays;
    const maxResults = options.maxResults ?? inbox.gmailMaxResults;
    const gmail = await createGmailClient(inbox.gmailCredentialsPath);
    const messages = await pullInboxMessages(gmail, {
      alias: options.alias,
      emailDomain: inbox.emailDomain,
      lookbackDays,
      maxResults,
    });

    pulledCount += messages.length;

    const correlated = correlateAndAnalyzeMessages(messages, inbox.emailDomain)
      .map((result) => attachWorkspaceContext(result, owner, inbox))
      .filter((result) => {
        if (!options.testId) {
          return true;
        }
        return result.configuredTestId === options.testId;
      });

    correlatedResults.push(...correlated);
  }

  const report = generateTimelineReport(correlatedResults, {
    workspaceId: config.workspaceId,
    workspaceName: config.workspaceName,
    availableWorkspaces: config.availableWorkspaces,
    currentInboxId: options.inboxId,
    availableInboxes: config.inboxes.map((inbox) => ({ id: inbox.id, label: inbox.label, userId: inbox.userId })),
  });

  return {
    workspaceId: config.workspaceId,
    alias: options.alias ?? null,
    userId: options.userId ?? null,
    inboxId: options.inboxId ?? null,
    testId: options.testId ?? null,
    workspaceName: config.workspaceName,
    availableWorkspaces: config.availableWorkspaces,
    availableInboxes: config.inboxes.map((inbox) => ({ id: inbox.id, label: inbox.label, userId: inbox.userId })),
    inboxCount: selectedInboxes.length,
    userCount: new Set(selectedInboxes.map((inbox) => inbox.userId)).size,
    pulledCount,
    analyzedCount: correlatedResults.length,
    report,
  };
}

function selectInboxes(inboxes: InboxConfig[], options: SyncInboxOptions): InboxConfig[] {
  const filtered = inboxes.filter((inbox) => {
    if (options.userId && inbox.userId !== options.userId) {
      return false;
    }

    if (options.inboxId && inbox.id !== options.inboxId) {
      return false;
    }

    if (options.testId && !inbox.tests.some((test) => test.id === options.testId)) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    throw new Error("No configured inboxes matched the requested user, inbox, or test filter.");
  }

  return filtered;
}

function attachWorkspaceContext(
  result: CorrelatedExperimentEmail,
  owner: AppUserConfig,
  inbox: InboxConfig,
): CorrelatedExperimentEmail {
  const matchedTest = findMatchedTest(inbox.tests, result.alias);

  return {
    ...result,
    ownerUserId: owner.id,
    ownerUserLabel: owner.label,
    inboxId: inbox.id,
    inboxLabel: inbox.label,
    configuredTestId: matchedTest?.id,
    configuredTestLabel: matchedTest?.label,
  };
}

function findMatchedTest(tests: InboxTestConfig[], alias: string): InboxTestConfig | undefined {
  const normalizedAlias = alias.toLowerCase();
  const localPart = normalizedAlias.split("@")[0] ?? normalizedAlias;

  return tests.find((test) => {
    if (test.aliasPrefixes.some((prefix) => localPart.startsWith(prefix))) {
      return true;
    }

    if (test.aliasIncludes.some((fragment) => normalizedAlias.includes(fragment))) {
      return true;
    }

    return false;
  });
}
