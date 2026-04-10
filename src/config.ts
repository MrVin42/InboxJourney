import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export interface AppUserConfig {
  id: string;
  label: string;
  email?: string;
}

export interface InboxTestConfig {
  id: string;
  label: string;
  description?: string;
  aliasPrefixes: string[];
  aliasIncludes: string[];
}

export interface InboxConfig {
  id: string;
  userId: string;
  label: string;
  emailDomain: string;
  gmailForwardInbox: string;
  gmailCredentialsPath: string;
  gmailMaxResults: number;
  gmailLookbackDays: number;
  tests: InboxTestConfig[];
}

export interface WorkspaceSummary {
  id: string;
  label: string;
  configPath: string;
  source: "workspace-file" | "environment";
}

export interface AppConfig {
  workspaceId: string;
  workspaceName: string;
  users: AppUserConfig[];
  inboxes: InboxConfig[];
  source: "workspace-file" | "environment";
  configPath?: string;
  availableWorkspaces: WorkspaceSummary[];
}

interface RawWorkspaceConfig {
  workspaceName?: string;
  users?: RawWorkspaceUser[];
  inboxes?: RawWorkspaceInbox[];
}

interface RawWorkspaceUser {
  id?: string;
  label?: string;
  email?: string;
}

interface RawWorkspaceInbox {
  id?: string;
  userId?: string;
  label?: string;
  emailDomain?: string;
  gmailForwardInbox?: string;
  gmailCredentialsPath?: string;
  gmailMaxResults?: number;
  gmailLookbackDays?: number;
  tests?: RawInboxTest[];
}

interface RawInboxTest {
  id?: string;
  label?: string;
  description?: string;
  aliasPrefixes?: string[];
  aliasIncludes?: string[];
}

export interface LoadConfigOptions {
  workspaceId?: string;
}

export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  const explicitPath = process.env.INBOX_JOURNEY_CONFIG_PATH?.trim();
  const availableWorkspaces = listAvailableWorkspaces(explicitPath);
  const requestedWorkspaceId = options.workspaceId?.trim();

  if (requestedWorkspaceId) {
    const matchedWorkspace = availableWorkspaces.find((workspace) => workspace.id === requestedWorkspaceId);
    if (!matchedWorkspace) {
      throw new Error(`Unknown workspace "${requestedWorkspaceId}".`);
    }

    if (matchedWorkspace.source === "workspace-file") {
      return loadWorkspaceConfig(matchedWorkspace.configPath, matchedWorkspace.id, availableWorkspaces);
    }

    return loadEnvFallbackConfig(availableWorkspaces);
  }

  const preferredWorkspace = availableWorkspaces.find((workspace) => workspace.source === "workspace-file");
  if (preferredWorkspace) {
    return loadWorkspaceConfig(preferredWorkspace.configPath, preferredWorkspace.id, availableWorkspaces);
  }

  return loadEnvFallbackConfig(availableWorkspaces);
}

export function listAvailableWorkspaces(explicitPath?: string): WorkspaceSummary[] {
  if (explicitPath) {
    const workspacePath = path.resolve(explicitPath);
    if (!existsSync(workspacePath)) {
      throw new Error(`Configured workspace file does not exist: ${workspacePath}`);
    }

    return [
      {
        id: workspaceIdFromPath(workspacePath),
        label: workspaceLabelFromPath(workspacePath),
        configPath: workspacePath,
        source: "workspace-file",
      },
    ];
  }

  const dataDir = path.resolve("data");
  const discoveredWorkspaces = existsSync(dataDir)
    ? readdirSync(dataDir)
        .filter((entry) => entry.toLowerCase().endsWith(".workspace.json"))
        .sort((a, b) => a.localeCompare(b))
        .map((entry) => {
          const workspacePath = path.join(dataDir, entry);
          return {
            id: workspaceIdFromPath(workspacePath),
            label: workspaceLabelFromPath(workspacePath),
            configPath: workspacePath,
            source: "workspace-file" as const,
          };
        })
    : [];

  if (discoveredWorkspaces.length > 0) {
    return discoveredWorkspaces;
  }

  return [
    {
      id: "environment-default",
      label: "Environment Default",
      configPath: "",
      source: "environment",
    },
  ];
}

function loadWorkspaceConfig(
  workspacePath: string,
  workspaceId: string,
  availableWorkspaces: WorkspaceSummary[],
): AppConfig {
  const configDir = path.dirname(workspacePath);
  const raw = JSON.parse(readFileSync(workspacePath, "utf8")) as RawWorkspaceConfig;
  const users = (raw.users ?? []).map((user, index) => normalizeUser(user, index));
  const userIds = new Set(users.map((user) => user.id));

  if (users.length === 0) {
    throw new Error(`Workspace config must define at least one user: ${workspacePath}`);
  }

  const inboxes = (raw.inboxes ?? []).map((inbox, index) => normalizeInbox(inbox, index, configDir, userIds));
  if (inboxes.length === 0) {
    throw new Error(`Workspace config must define at least one inbox: ${workspacePath}`);
  }

  return {
    workspaceId,
    workspaceName: raw.workspaceName?.trim() || workspaceLabelFromPath(workspacePath),
    users,
    inboxes,
    source: "workspace-file",
    configPath: workspacePath,
    availableWorkspaces,
  };
}

function loadEnvFallbackConfig(availableWorkspaces: WorkspaceSummary[]): AppConfig {
  return {
    workspaceId: "environment-default",
    workspaceName: "Inbox Journey Workspace",
    users: [
      {
        id: "local-owner",
        label: "Local Owner",
        email: process.env.GMAIL_FORWARD_INBOX?.trim() || undefined,
      },
    ],
    inboxes: [
      {
        id: "default-inbox",
        userId: "local-owner",
        label: "Default Inbox",
        emailDomain: requireEnv("EMAIL_DOMAIN"),
        gmailForwardInbox: requireEnv("GMAIL_FORWARD_INBOX"),
        gmailCredentialsPath: resolveCredentialsPath(),
        gmailMaxResults: parseNumber(process.env.GMAIL_MAX_RESULTS, 10),
        gmailLookbackDays: parseNumber(process.env.GMAIL_LOOKBACK_DAYS, 14),
        tests: [],
      },
    ],
    source: "environment",
    availableWorkspaces,
  };
}

function normalizeUser(raw: RawWorkspaceUser, index: number): AppUserConfig {
  const id = raw.id?.trim() || `user-${index + 1}`;
  const label = raw.label?.trim();
  if (!label) {
    throw new Error(`Workspace user "${id}" is missing a label.`);
  }

  return {
    id,
    label,
    email: raw.email?.trim() || undefined,
  };
}

function normalizeInbox(
  raw: RawWorkspaceInbox,
  index: number,
  configDir: string,
  userIds: Set<string>,
): InboxConfig {
  const id = raw.id?.trim() || `inbox-${index + 1}`;
  const userId = raw.userId?.trim();
  const label = raw.label?.trim();
  const emailDomain = raw.emailDomain?.trim();
  const gmailForwardInbox = raw.gmailForwardInbox?.trim();

  if (!userId || !userIds.has(userId)) {
    throw new Error(`Inbox "${id}" must reference a valid userId.`);
  }

  if (!label) {
    throw new Error(`Inbox "${id}" is missing a label.`);
  }

  if (!emailDomain) {
    throw new Error(`Inbox "${id}" is missing an emailDomain.`);
  }

  if (!gmailForwardInbox) {
    throw new Error(`Inbox "${id}" is missing a gmailForwardInbox.`);
  }

  const gmailCredentialsPath = resolveWorkspaceCredentialsPath(raw.gmailCredentialsPath, configDir);
  const tests = (raw.tests ?? []).map((test, testIndex) => normalizeTest(test, testIndex));

  return {
    id,
    userId,
    label,
    emailDomain,
    gmailForwardInbox,
    gmailCredentialsPath,
    gmailMaxResults: parseNumber(raw.gmailMaxResults?.toString(), 10),
    gmailLookbackDays: parseNumber(raw.gmailLookbackDays?.toString(), 14),
    tests,
  };
}

function normalizeTest(raw: RawInboxTest, index: number): InboxTestConfig {
  const id = raw.id?.trim() || `test-${index + 1}`;
  const label = raw.label?.trim();
  if (!label) {
    throw new Error(`Inbox test "${id}" is missing a label.`);
  }

  return {
    id,
    label,
    description: raw.description?.trim() || undefined,
    aliasPrefixes: normalizeStringList(raw.aliasPrefixes),
    aliasIncludes: normalizeStringList(raw.aliasIncludes),
  };
}

function normalizeStringList(value: string[] | undefined): string[] {
  return (value ?? []).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
}

function resolveWorkspaceCredentialsPath(rawPath: string | undefined, configDir: string): string {
  if (!rawPath?.trim()) {
    throw new Error("Workspace inbox is missing gmailCredentialsPath.");
  }

  const resolvedPath = path.resolve(configDir, rawPath.trim());
  if (!existsSync(resolvedPath)) {
    throw new Error(`Configured Gmail credentials file does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}

function workspaceIdFromPath(workspacePath: string): string {
  const fileName = path.basename(workspacePath).replace(/\.workspace\.json$/i, "").replace(/\.json$/i, "");
  return fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
}

function workspaceLabelFromPath(workspacePath: string): string {
  const fileName = path.basename(workspacePath).replace(/\.workspace\.json$/i, "").replace(/\.json$/i, "");
  return fileName
    .split(/[-._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseNumber(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric configuration value but received "${rawValue}"`);
  }

  return parsed;
}

function resolveCredentialsPath(): string {
  const explicitPath = process.env.GMAIL_CREDENTIALS_PATH?.trim();
  if (explicitPath) {
    const absolute = path.resolve(explicitPath);
    if (!existsSync(absolute)) {
      throw new Error(`Configured Gmail credentials file does not exist: ${absolute}`);
    }
    return absolute;
  }

  const credsDir = path.resolve("Creds");
  if (!existsSync(credsDir)) {
    throw new Error("Creds directory not found. Put your Google OAuth client JSON in Creds/.");
  }

  const credentialFiles = readdirSync(credsDir)
    .filter((entry) => entry.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(credsDir, entry));

  if (credentialFiles.length === 1) {
    return credentialFiles[0];
  }

  if (credentialFiles.length === 0) {
    throw new Error("No Gmail OAuth JSON file found in Creds/.");
  }

  throw new Error(
    `Multiple Gmail OAuth JSON files found in Creds/. Set GMAIL_CREDENTIALS_PATH explicitly. Found: ${credentialFiles.join(", ")}`,
  );
}
