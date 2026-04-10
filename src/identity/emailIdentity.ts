import { randomUUID } from "node:crypto";

import type { ExperimentIdentity, IdentityMode, SiteName } from "../domain/models.ts";

export interface IdentityPolicy {
  mode: IdentityMode;
  domain?: string;
  gmailBase?: string;
  dedicatedInbox?: string;
}

export interface IdentitySeed {
  site: SiteName;
  scenarioKey: string;
  runId?: string;
  tags?: string[];
}

export function createExperimentIdentity(
  seed: IdentitySeed,
  policy: IdentityPolicy,
): ExperimentIdentity {
  const runId = seed.runId ?? shortRunId();
  const emailAddress = buildEmailAddress(seed.site, seed.scenarioKey, runId, policy);

  return {
    id: randomUUID(),
    site: seed.site,
    scenarioKey: seed.scenarioKey,
    runId,
    mode: policy.mode,
    emailAddress,
    createdAt: new Date().toISOString(),
    tags: seed.tags ?? [],
  };
}

function buildEmailAddress(
  site: SiteName,
  scenarioKey: string,
  runId: string,
  policy: IdentityPolicy,
): string {
  const normalizedScenario = sanitize(scenarioKey);
  const localPart = `${site}.${normalizedScenario}.${runId}`;

  switch (policy.mode) {
    case "custom-domain-catchall":
      if (!policy.domain) {
        throw new Error("custom-domain-catchall requires a domain");
      }
      return `${localPart}@${policy.domain}`;
    case "gmail-plus-alias":
      if (!policy.gmailBase) {
        throw new Error("gmail-plus-alias requires a gmailBase");
      }
      return `${policy.gmailBase}+${localPart}@gmail.com`;
    case "dedicated-inbox":
      if (!policy.dedicatedInbox) {
        throw new Error("dedicated-inbox requires a dedicatedInbox");
      }
      return policy.dedicatedInbox;
  }
}

function shortRunId(): string {
  return `r${Math.random().toString(36).slice(2, 6)}`;
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
