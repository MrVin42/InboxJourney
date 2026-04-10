import type { HostedWorkspaceRole } from "./models.ts";

export type HostedAuthProvider = "local-demo" | "clerk";

export interface HostedWorkspaceAccess {
  workspaceId: string;
  workspaceName: string;
  accountId: string;
  accountName: string;
  role: HostedWorkspaceRole;
  inboxIds: string[];
}

export interface HostedAuthUserProfile {
  id: string;
  email: string;
  displayName: string;
  authProvider: HostedAuthProvider;
  externalUserId?: string;
  defaultWorkspaceId: string;
  workspaces: HostedWorkspaceAccess[];
}

export interface HostedAuthSession {
  id: string;
  userId: string;
  token: string;
  authProvider: HostedAuthProvider;
  activeWorkspaceId: string;
  createdAt: string;
  expiresAt: string;
}

export interface HostedAuthSessionView {
  session: HostedAuthSession;
  user: HostedAuthUserProfile;
}
