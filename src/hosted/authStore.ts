import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { HostedAuthSession, HostedAuthSessionView, HostedAuthUserProfile, HostedWorkspaceAccess } from "./authModels.ts";
import { getHostedAdminOverview, getHostedWorkspaceView } from "./workspaceStore.ts";

const DATA_DIR = path.resolve("data");
const SESSIONS_PATH = path.join(DATA_DIR, "auth-sessions.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

interface PersistedSessionRecord {
  id: string;
  userId: string;
  token: string;
  authProvider: "local-demo" | "clerk";
  activeWorkspaceId: string;
  createdAt: string;
  expiresAt: string;
}

export function createLocalDemoSession(email: string, requestedWorkspaceId?: string): HostedAuthSessionView {
  const profile = requireAuthProfileByEmail(email);
  const activeWorkspaceId = selectWorkspace(profile, requestedWorkspaceId);
  const session: PersistedSessionRecord = {
    id: `session:${randomUUID()}`,
    userId: profile.id,
    token: randomUUID(),
    authProvider: "local-demo",
    activeWorkspaceId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };

  const sessions = readSessions().filter((entry) => entry.userId !== session.userId);
  sessions.push(session);
  writeSessions(sessions);

  return toSessionView(session, profile);
}

export function getSessionView(token: string | undefined): HostedAuthSessionView | null {
  if (!token) {
    return null;
  }

  const sessions = pruneExpiredSessions(readSessions());
  const session = sessions.find((entry) => entry.token === token);
  if (!session) {
    return null;
  }

  const profile = getAuthProfiles().find((entry) => entry.id === session.userId);
  if (!profile) {
    return null;
  }

  return toSessionView(session, profile);
}

export function clearSession(token: string | undefined): void {
  if (!token) {
    return;
  }

  const sessions = readSessions().filter((entry) => entry.token !== token);
  writeSessions(sessions);
}

export function setActiveWorkspace(token: string | undefined, workspaceId: string): HostedAuthSessionView | null {
  if (!token) {
    return null;
  }

  const sessions = pruneExpiredSessions(readSessions());
  const sessionIndex = sessions.findIndex((entry) => entry.token === token);
  if (sessionIndex < 0) {
    return null;
  }

  const profile = getAuthProfiles().find((entry) => entry.id === sessions[sessionIndex].userId);
  if (!profile) {
    return null;
  }

  selectWorkspace(profile, workspaceId);
  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    activeWorkspaceId: workspaceId,
  };
  writeSessions(sessions);

  return toSessionView(sessions[sessionIndex], profile);
}

export function getAuthProfiles(): HostedAuthUserProfile[] {
  const overview = getHostedAdminOverview();
  const workspacesById = new Map(overview.workspaces.map((workspace) => [workspace.id, workspace]));
  const accountsById = new Map(overview.accounts.map((account) => [account.id, account]));
  const profilesByEmail = new Map<string, HostedAuthUserProfile>();

  for (const user of overview.users) {
    if (!user.email) {
      continue;
    }

    const normalizedEmail = user.email.toLowerCase();
    const memberships = overview.workspaceMembers
      .filter((member) => member.userId === user.id)
      .map((member) => {
        const workspace = requireMapValue(workspacesById, member.workspaceId, `Unknown workspace "${member.workspaceId}".`);
        const account = requireMapValue(accountsById, workspace.accountId, `Unknown account "${workspace.accountId}".`);
        const workspaceView = getHostedWorkspaceView(workspace.id);

        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          accountId: account.id,
          accountName: account.name,
          role: member.role,
          inboxIds: workspaceView.inboxConnections
            .filter((inbox) => inbox.owner.id === user.id)
            .map((inbox) => inbox.id),
        } satisfies HostedWorkspaceAccess;
      });

    if (memberships.length === 0) {
      continue;
    }

    const existingProfile = profilesByEmail.get(normalizedEmail);
    if (existingProfile) {
      existingProfile.workspaces.push(...memberships.filter((membership) =>
        !existingProfile.workspaces.some((entry) => entry.workspaceId === membership.workspaceId)
      ));
      continue;
    }

    profilesByEmail.set(normalizedEmail, {
      id: `auth:${normalizedEmail}`,
      email: user.email,
      displayName: user.displayName,
      authProvider: "local-demo",
      defaultWorkspaceId: memberships[0].workspaceId,
      workspaces: memberships,
    });
  }

  return [...profilesByEmail.values()];
}

function requireAuthProfileByEmail(email: string): HostedAuthUserProfile {
  const normalizedEmail = email.trim().toLowerCase();
  const profile = getAuthProfiles().find((entry) => entry.email.toLowerCase() === normalizedEmail);
  if (!profile) {
    throw new Error(`No workspace member exists for "${normalizedEmail}". Add the user to a workspace before signing in.`);
  }
  return profile;
}

function selectWorkspace(profile: HostedAuthUserProfile, requestedWorkspaceId?: string): string {
  if (!requestedWorkspaceId) {
    return profile.defaultWorkspaceId;
  }

  const hasAccess = profile.workspaces.some((workspace) => workspace.workspaceId === requestedWorkspaceId);
  if (!hasAccess) {
    throw new Error(`User "${profile.email}" does not have access to workspace "${requestedWorkspaceId}".`);
  }

  return requestedWorkspaceId;
}

function toSessionView(session: PersistedSessionRecord, profile: HostedAuthUserProfile): HostedAuthSessionView {
  const activeWorkspaceId = profile.workspaces.some((entry) => entry.workspaceId === session.activeWorkspaceId)
    ? session.activeWorkspaceId
    : profile.defaultWorkspaceId;

  return {
    session: {
      id: session.id,
      userId: session.userId,
      token: session.token,
      authProvider: session.authProvider,
      activeWorkspaceId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    } satisfies HostedAuthSession,
    user: {
      ...profile,
      defaultWorkspaceId: activeWorkspaceId,
    },
  };
}

function readSessions(): PersistedSessionRecord[] {
  ensureDataDir();
  if (!existsSync(SESSIONS_PATH)) {
    return [];
  }

  const raw = JSON.parse(readFileSync(SESSIONS_PATH, "utf8")) as PersistedSessionRecord[];
  return Array.isArray(raw) ? raw : [];
}

function pruneExpiredSessions(sessions: PersistedSessionRecord[]): PersistedSessionRecord[] {
  const now = Date.now();
  const activeSessions = sessions.filter((entry) => Date.parse(entry.expiresAt) > now);
  if (activeSessions.length !== sessions.length) {
    writeSessions(activeSessions);
  }
  return activeSessions;
}

function writeSessions(sessions: PersistedSessionRecord[]): void {
  ensureDataDir();
  writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}

function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

function requireMapValue<T>(map: Map<string, T>, key: string, errorMessage: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}
