export type HostedInboxProvider = "gmail";

export type HostedInboxConnectionStatus =
  | "connected"
  | "attention-needed"
  | "disconnected";

export type HostedWorkspaceRole =
  | "account_admin"
  | "workspace_admin"
  | "analyst"
  | "viewer";

export interface HostedAccount {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface HostedWorkspace {
  id: string;
  accountId: string;
  slug: string;
  name: string;
  createdAt: string;
}

export interface HostedWorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: HostedWorkspaceRole;
  joinedAt: string;
}

export interface HostedUser {
  id: string;
  email?: string;
  displayName: string;
  createdAt: string;
}

export interface HostedInboxConnection {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  label: string;
  provider: HostedInboxProvider;
  providerEmail: string;
  emailDomain: string;
  status: HostedInboxConnectionStatus;
  oauthScopes: string[];
  lastSyncedAt?: string;
  createdAt: string;
}

export interface HostedTestDefinition {
  id: string;
  inboxConnectionId: string;
  label: string;
  description?: string;
  aliasPrefixes: string[];
  aliasIncludes: string[];
  createdAt: string;
}

export interface HostedAdminOverview {
  accounts: HostedAccount[];
  workspaces: HostedWorkspace[];
  users: HostedUser[];
  inboxConnections: HostedInboxConnection[];
  tests: HostedTestDefinition[];
  workspaceMembers: HostedWorkspaceMember[];
}

export interface HostedWorkspaceView {
  account: HostedAccount;
  workspace: HostedWorkspace;
  members: Array<HostedWorkspaceMember & { user: HostedUser }>;
  inboxConnections: Array<HostedInboxConnection & { owner: HostedUser; tests: HostedTestDefinition[] }>;
}
