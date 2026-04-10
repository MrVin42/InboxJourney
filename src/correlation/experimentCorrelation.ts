import { randomUUID } from "node:crypto";

import { analyzeEmail } from "../analyzers/emailAnalyzer.ts";
import type {
  AccountProfile,
  EmailAnalysis,
  ExperimentIdentity,
  ScenarioRun,
  SiteAction,
  SiteName,
} from "../domain/models.ts";
import type { PulledInboxMessage } from "../mail/gmailIngest.ts";
import {
  createScenarioRun,
  findZillowScenarioDefinition,
  materializeScenarioActions,
} from "../scenarios/zillow.ts";

export interface CorrelatedExperimentEmail {
  alias: string;
  site: SiteName;
  brand: string;
  scenarioKey: string;
  runId: string;
  ownerUserId?: string;
  ownerUserLabel?: string;
  inboxId?: string;
  inboxLabel?: string;
  configuredTestId?: string;
  configuredTestLabel?: string;
  identity: ExperimentIdentity;
  account: AccountProfile;
  run: ScenarioRun;
  actions: SiteAction[];
  analysis: EmailAnalysis;
  pulled: PulledInboxMessage;
}

export function correlateAndAnalyzeMessages(
  messages: PulledInboxMessage[],
  emailDomain: string,
): CorrelatedExperimentEmail[] {
  return messages.flatMap((message) => {
    return message.matchedAliases.flatMap((alias) => {
      const parsed = parseExperimentAlias(alias, emailDomain);
      if (!parsed) {
        return [];
      }

      const scenarioDefinition = findScenarioDefinition(parsed.site, parsed.scenarioKey);
      const normalizedScenarioKey = scenarioDefinition?.key ?? parsed.scenarioKey;
      const plannedActionCount = scenarioDefinition?.plannedActions.length ?? 0;

      const inferredStartedAt = inferRunStartedAt(message.normalized.receivedAt, plannedActionCount);
      const identity = createIdentity(parsed.site, normalizedScenarioKey, parsed.runId, alias);
      const account = createAccount(identity, inferredStartedAt);
      const run = scenarioDefinition
        ? createScenarioRun(account.id, scenarioDefinition, inferredStartedAt)
        : createGenericScenarioRun(account.id, parsed.site, normalizedScenarioKey, inferredStartedAt);
      const actions = scenarioDefinition ? materializeScenarioActions(run.id, scenarioDefinition, run.startedAt) : [];
      const normalizedEmail = {
        ...message.normalized,
        runId: run.id,
      };
      const analysis = analyzeEmail(normalizedEmail, actions);

      return [
        {
          alias,
          site: parsed.site,
          brand: parsed.site,
          scenarioKey: normalizedScenarioKey,
          runId: parsed.runId,
          identity,
          account,
          run,
          actions,
          analysis,
          pulled: {
            ...message,
            normalized: normalizedEmail,
          },
        },
      ];
    });
  });
}

interface ParsedExperimentAlias {
  site: SiteName;
  scenarioKey: string;
  runId: string;
}

export function parseExperimentAlias(alias: string, emailDomain: string): ParsedExperimentAlias | null {
  const normalizedAlias = alias.toLowerCase();
  const normalizedDomain = emailDomain.toLowerCase();
  const suffix = `@${normalizedDomain}`;

  if (!normalizedAlias.endsWith(suffix)) {
    return null;
  }

  const localPart = normalizedAlias.slice(0, -suffix.length);
  const segments = localPart.split(".");

  if (segments.length < 3) {
    return null;
  }

  const [siteSegment, ...rest] = segments;
  const runId = rest.at(-1);
  const scenarioSegments = rest.slice(0, -1);

  if (!siteSegment || !runId || scenarioSegments.length === 0) {
    return null;
  }

  return {
    site: siteSegment,
    scenarioKey: scenarioSegments.join("."),
    runId,
  };
}

function findScenarioDefinition(site: SiteName, scenarioKey: string) {
  switch (site) {
    case "zillow":
      return findZillowScenarioDefinition(scenarioKey);
    default:
      return undefined;
  }
}

function createIdentity(
  site: SiteName,
  scenarioKey: string,
  runId: string,
  emailAddress: string,
): ExperimentIdentity {
  return {
    id: randomUUID(),
    site,
    scenarioKey,
    runId,
    mode: "custom-domain-catchall",
    emailAddress,
    createdAt: new Date().toISOString(),
    tags: ["live-inbox", "correlated"],
  };
}

function createAccount(identity: ExperimentIdentity, createdAt: string): AccountProfile {
  return {
    id: randomUUID(),
    site: identity.site,
    identityId: identity.id,
    signupUrl: "https://www.zillow.com/",
    createdAt,
  };
}

function inferRunStartedAt(emailReceivedAt: string, actionCount: number): string {
  const receivedTime = new Date(emailReceivedAt).getTime();
  const leadMinutes = Math.max(actionCount * 12, 90);
  return new Date(receivedTime - leadMinutes * 60_000).toISOString();
}

function createGenericScenarioRun(
  accountId: string,
  site: SiteName,
  scenarioKey: string,
  startedAt: string,
): ScenarioRun {
  return {
    id: randomUUID(),
    site,
    scenarioKey,
    accountId,
    startedAt,
    status: "planned",
    market: "unknown",
    notes: `Generic inferred scenario for ${site}`,
  };
}
