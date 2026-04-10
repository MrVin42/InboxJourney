import { loadConfig, type AppConfig, type InboxConfig } from "../config.ts";
import type {
  HostedAccount,
  HostedAdminOverview,
  HostedInboxConnection,
  HostedTestDefinition,
  HostedUser,
  HostedWorkspace,
  HostedWorkspaceMember,
  HostedWorkspaceView,
} from "./models.ts";

const CREATED_AT = "2026-04-01T00:00:00.000Z";

export function getHostedAdminOverview(): HostedAdminOverview {
  const registry = loadConfig().availableWorkspaces;
  const workspaces = registry.map((workspaceRef) =>
    loadConfig({ workspaceId: workspaceRef.id }),
  );

  const accounts = dedupeById(workspaces.map(toHostedAccount));
  const hostedWorkspaces = workspaces.map(toHostedWorkspace);
  const users = dedupeById(workspaces.flatMap((workspace) => workspace.users.map((user) => toHostedUser(workspace, user))));
  const members = dedupeById(workspaces.flatMap(toHostedWorkspaceMembers));
  const inboxConnections = dedupeById(workspaces.flatMap(toHostedInboxConnections));
  const tests = dedupeById(workspaces.flatMap(toHostedTests));

  return {
    accounts,
    workspaces: hostedWorkspaces,
    users,
    inboxConnections,
    tests,
    workspaceMembers: members,
  };
}

export function getHostedWorkspaceView(workspaceId: string): HostedWorkspaceView {
  const config = loadConfig({ workspaceId });
  const account = toHostedAccount(config);
  const workspace = toHostedWorkspace(config);
  const users = config.users.map((user) => toHostedUser(config, user));
  const userById = new Map(users.map((user) => [user.id, user]));
  const members = toHostedWorkspaceMembers(config).map((member) => ({
    ...member,
    user: requireMapValue(userById, member.userId, `Unknown member user "${member.userId}"`),
  }));
  const tests = toHostedTests(config);
  const testsByInboxId = groupBy(tests, (test) => test.inboxConnectionId);
  const inboxConnections = toHostedInboxConnections(config).map((inbox) => ({
    ...inbox,
    owner: requireMapValue(userById, inbox.ownerUserId, `Unknown inbox owner "${inbox.ownerUserId}"`),
    tests: testsByInboxId.get(inbox.id) ?? [],
  }));

  return {
    account,
    workspace,
    members,
    inboxConnections,
  };
}

export function getHostedInboxView(workspaceId: string, inboxId: string) {
  const workspaceView = getHostedWorkspaceView(workspaceId);
  const inbox = workspaceView.inboxConnections.find((entry) => entry.id === inboxId);
  if (!inbox) {
    throw new Error(`Inbox "${inboxId}" was not found in workspace "${workspaceId}".`);
  }

  return {
    account: workspaceView.account,
    workspace: workspaceView.workspace,
    inboxConnection: inbox,
  };
}

function toHostedAccount(config: AppConfig): HostedAccount {
  return {
    id: `${config.workspaceId}-account`,
    slug: config.workspaceId,
    name: `${config.workspaceName} Account`,
    createdAt: CREATED_AT,
  };
}

function toHostedWorkspace(config: AppConfig): HostedWorkspace {
  return {
    id: config.workspaceId,
    accountId: `${config.workspaceId}-account`,
    slug: config.workspaceId,
    name: config.workspaceName,
    createdAt: CREATED_AT,
  };
}

function toHostedUser(config: AppConfig, user: AppConfig["users"][number]): HostedUser {
  return {
    id: `${config.workspaceId}:${user.id}`,
    email: user.email,
    displayName: user.label,
    createdAt: CREATED_AT,
  };
}

function toHostedWorkspaceMembers(config: AppConfig): HostedWorkspaceMember[] {
  return config.users.map((user, index) => ({
    id: `${config.workspaceId}:member:${user.id}`,
    workspaceId: config.workspaceId,
    userId: `${config.workspaceId}:${user.id}`,
    role: index === 0 ? "account_admin" : "workspace_admin",
    joinedAt: CREATED_AT,
  }));
}

function toHostedInboxConnections(config: AppConfig): HostedInboxConnection[] {
  return config.inboxes.map((inbox) => ({
    id: hostedInboxId(config, inbox),
    workspaceId: config.workspaceId,
    ownerUserId: `${config.workspaceId}:${inbox.userId}`,
    label: inbox.label,
    provider: "gmail",
    providerEmail: inbox.gmailForwardInbox,
    emailDomain: inbox.emailDomain,
    status: "connected",
    oauthScopes: ["gmail.readonly"],
    lastSyncedAt: undefined,
    createdAt: CREATED_AT,
  }));
}

function toHostedTests(config: AppConfig): HostedTestDefinition[] {
  return config.inboxes.flatMap((inbox) =>
    inbox.tests.map((test) => ({
      id: `${config.workspaceId}:test:${test.id}`,
      inboxConnectionId: hostedInboxId(config, inbox),
      label: test.label,
      description: test.description,
      aliasPrefixes: test.aliasPrefixes,
      aliasIncludes: test.aliasIncludes,
      createdAt: CREATED_AT,
    })),
  );
}

function hostedInboxId(config: AppConfig, inbox: InboxConfig): string {
  return `${config.workspaceId}:inbox:${inbox.id}`;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
      continue;
    }
    map.set(key, [item]);
  }
  return map;
}

function requireMapValue<T>(map: Map<string, T>, key: string, errorMessage: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}
