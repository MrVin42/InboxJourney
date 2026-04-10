import { syncInboxReport } from "./app/syncInbox.ts";
import { correlateAndAnalyzeMessages } from "./correlation/experimentCorrelation.ts";
import { loadConfig } from "./config.ts";
import { createGmailClient } from "./mail/gmailClient.ts";
import { listLabels, pullInboxMessages } from "./mail/gmailIngest.ts";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const config = loadConfig();
  const userId = readArgValue(args, "--user");
  const inboxId = readArgValue(args, "--inbox");
  const testId = readArgValue(args, "--test");

  switch (command) {
    case "gmail:labels": {
      const inbox = resolveInbox(config, userId, inboxId, testId);
      const gmail = await createGmailClient(inbox.gmailCredentialsPath);
      const labels = await listLabels(gmail);
      console.log(JSON.stringify({ userId: inbox.userId, inboxId: inbox.id, labels }, null, 2));
      return;
    }
    case "gmail:pull": {
      const alias = readArgValue(args, "--alias");
      const inbox = resolveInbox(config, userId, inboxId, testId);
      const lookbackDays = readNumberArg(args, "--days") ?? inbox.gmailLookbackDays;
      const maxResults = readNumberArg(args, "--max-results") ?? inbox.gmailMaxResults;
      const gmail = await createGmailClient(inbox.gmailCredentialsPath);
      const messages = await pullInboxMessages(gmail, {
        alias,
        emailDomain: inbox.emailDomain,
        lookbackDays,
        maxResults,
      });

      console.log(
        JSON.stringify(
          {
            alias: alias ?? null,
            userId: inbox.userId,
            inboxId: inbox.id,
            emailDomain: inbox.emailDomain,
            gmailForwardInbox: inbox.gmailForwardInbox,
            count: messages.length,
            messages,
          },
          null,
          2,
        ),
      );
      return;
    }
    case "gmail:analyze": {
      const alias = readArgValue(args, "--alias");
      const inbox = resolveInbox(config, userId, inboxId, testId);
      const lookbackDays = readNumberArg(args, "--days") ?? inbox.gmailLookbackDays;
      const maxResults = readNumberArg(args, "--max-results") ?? inbox.gmailMaxResults;
      const gmail = await createGmailClient(inbox.gmailCredentialsPath);
      const messages = await pullInboxMessages(gmail, {
        alias,
        emailDomain: inbox.emailDomain,
        lookbackDays,
        maxResults,
      });
      const correlated = correlateAndAnalyzeMessages(messages, inbox.emailDomain);

      console.log(
        JSON.stringify(
          {
            alias: alias ?? null,
            userId: inbox.userId,
            inboxId: inbox.id,
            testId: testId ?? null,
            emailDomain: inbox.emailDomain,
            gmailForwardInbox: inbox.gmailForwardInbox,
            pulledCount: messages.length,
            analyzedCount: correlated.length,
            results: correlated,
          },
          null,
          2,
        ),
      );
      return;
    }
    case "gmail:report": {
      const alias = readArgValue(args, "--alias");
      const lookbackDays = readNumberArg(args, "--days");
      const maxResults = readNumberArg(args, "--max-results");
      const result = await syncInboxReport({
        userId,
        inboxId,
        testId,
        alias,
        lookbackDays,
        maxResults,
      });

      console.log(JSON.stringify(result, null, 2));
      return;
    }
    default:
      printUsage();
  }
}

function readArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function readNumberArg(args: string[], flag: string): number | undefined {
  const value = readArgValue(args, flag);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a numeric value after ${flag} but received "${value}"`);
  }

  return parsed;
}

function printUsage(): void {
  console.log(`Usage:
  node --env-file=.env src/cli.ts gmail:labels [--user user-id] [--inbox inbox-id]
  node --env-file=.env src/cli.ts gmail:pull [--user user-id] [--inbox inbox-id] [--test test-id] [--alias alias@domain] [--days 14] [--max-results 10]
  node --env-file=.env src/cli.ts gmail:analyze [--user user-id] [--inbox inbox-id] [--test test-id] [--alias alias@domain] [--days 14] [--max-results 10]
  node --env-file=.env src/cli.ts gmail:report [--user user-id] [--inbox inbox-id] [--test test-id] [--alias alias@domain] [--days 14] [--max-results 10]`);
}

function resolveInbox(
  config: ReturnType<typeof loadConfig>,
  userId?: string,
  inboxId?: string,
  testId?: string,
) {
  const matches = config.inboxes.filter((inbox) => {
    if (userId && inbox.userId !== userId) {
      return false;
    }

    if (inboxId && inbox.id !== inboxId) {
      return false;
    }

    if (testId && !inbox.tests.some((test) => test.id === testId)) {
      return false;
    }

    return true;
  });

  if (matches.length === 0) {
    throw new Error("No configured inbox matched the requested user, inbox, or test.");
  }

  if (matches.length > 1) {
    throw new Error("Multiple inboxes matched. Pass --inbox to target one inbox explicitly.");
  }

  return matches[0];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
