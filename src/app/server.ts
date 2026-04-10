import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { renderAppShell, renderLoginPage } from "./authSite.ts";
import { clearSession, createLocalDemoSession, getSessionView, setActiveWorkspace } from "../hosted/authStore.ts";
import { getHostedAdminOverview, getHostedInboxView, getHostedWorkspaceView } from "../hosted/workspaceStore.ts";
import { createSignupLead, listSignupLeads } from "../hosted/signupStore.ts";
import { renderHomepage } from "./marketingSite.ts";
import { syncInboxReport } from "./syncInbox.ts";

const PORT = Number(process.env.APP_PORT ?? "8787");
const HOST = "127.0.0.1";
const REPORT_DIR = path.resolve("reports", "latest");
const SESSION_COOKIE_NAME = "inbox_journey_session";

async function main(): Promise<void> {
  if (!existsSync(path.join(REPORT_DIR, "index.html"))) {
    await syncInboxReport();
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
      const sessionToken = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
      const currentSession = getSessionView(sessionToken);
      const syncOptions = {
        workspaceId: readQueryValue(url, "workspace"),
        userId: readQueryValue(url, "user"),
        inboxId: readQueryValue(url, "inbox"),
        testId: readQueryValue(url, "test"),
        alias: readQueryValue(url, "alias"),
        lookbackDays: readNumberQuery(url, "days"),
        maxResults: readNumberQuery(url, "max-results"),
      };

      if (request.method === "POST" && url.pathname === "/api/sync") {
        const result = await syncInboxReport(syncOptions);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/signup") {
        const payload = await readJsonBody(request);
        const lead = createSignupLead({
          name: requirePayloadValue(payload, "name"),
          email: requirePayloadValue(payload, "email"),
          company: readPayloadValue(payload, "company"),
          workspaceName: readPayloadValue(payload, "workspaceName"),
          useCase: readPayloadValue(payload, "useCase"),
        });
        sendJson(response, 201, { lead });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/demo-signin") {
        const payload = await readJsonBody(request);
        const sessionView = createLocalDemoSession(
          requirePayloadValue(payload, "email"),
          readPayloadValue(payload, "workspaceId"),
        );
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Set-Cookie": serializeCookie(SESSION_COOKIE_NAME, sessionView.session.token),
        });
        response.end(JSON.stringify({
          session: sessionView.session,
          user: sessionView.user,
          redirectTo: `/app?workspace=${encodeURIComponent(sessionView.session.activeWorkspaceId)}`,
        }, null, 2));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/signout") {
        clearSession(sessionToken);
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Set-Cookie": clearCookie(SESSION_COOKIE_NAME),
        });
        response.end(JSON.stringify({ signedOut: true }, null, 2));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/auth/session") {
        sendJson(response, 200, { session: currentSession });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/signup-leads") {
        sendJson(response, 200, { leads: listSignupLeads() });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/hosted/admin/overview") {
        sendJson(response, 200, getHostedAdminOverview());
        return;
      }

      const pathMatch = matchHostedPath(url.pathname);
      if (request.method === "GET" && pathMatch?.kind === "workspace") {
        sendJson(response, 200, getHostedWorkspaceView(pathMatch.workspaceId));
        return;
      }

      if (request.method === "GET" && pathMatch?.kind === "inbox") {
        sendJson(response, 200, getHostedInboxView(pathMatch.workspaceId, pathMatch.inboxId));
        return;
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        sendHtml(response, 200, renderHomepage());
        return;
      }

      if (request.method === "GET" && (url.pathname === "/login" || url.pathname === "/login/")) {
        sendHtml(response, 200, renderLoginPage());
        return;
      }

      if (request.method === "GET" && (url.pathname === "/app" || url.pathname === "/app/")) {
        if (!currentSession) {
          sendHtml(response, 200, renderLoginPage());
          return;
        }

        const requestedWorkspaceId = syncOptions.workspaceId;
        const sessionView = requestedWorkspaceId && requestedWorkspaceId !== currentSession.session.activeWorkspaceId
          ? setActiveWorkspace(sessionToken, requestedWorkspaceId) ?? currentSession
          : currentSession;
        const activeWorkspaceId = requestedWorkspaceId ?? sessionView.session.activeWorkspaceId;
        const workspaceView = getHostedWorkspaceView(activeWorkspaceId);
        const reportUrl = buildReportUrl(url, activeWorkspaceId);

        sendHtml(response, 200, renderAppShell({
          sessionView,
          currentWorkspace: workspaceView,
          reportUrl,
        }));
        return;
      }

      if (request.method === "GET" && (url.pathname === "/app/report" || url.pathname === "/app/report/")) {
        if (!currentSession) {
          sendHtml(response, 200, renderLoginPage({ error: "Please sign in to view the app." }));
          return;
        }

        const activeWorkspaceId = syncOptions.workspaceId ?? currentSession.session.activeWorkspaceId;
        if (
          activeWorkspaceId ||
          syncOptions.userId ||
          syncOptions.inboxId ||
          syncOptions.testId ||
          syncOptions.alias ||
          syncOptions.lookbackDays ||
          syncOptions.maxResults
        ) {
          await syncInboxReport({
            ...syncOptions,
            workspaceId: activeWorkspaceId,
          });
        }
        serveFile(response, path.join(REPORT_DIR, "index.html"));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/previews/")) {
        serveFile(response, path.join(REPORT_DIR, url.pathname));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/app/previews/")) {
        const relativePath = url.pathname.replace(/^\/app/, "");
        serveFile(response, path.join(REPORT_DIR, relativePath));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/screenshots/")) {
        serveFile(response, path.join(REPORT_DIR, url.pathname));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/app/screenshots/")) {
        const relativePath = url.pathname.replace(/^\/app/, "");
        serveFile(response, path.join(REPORT_DIR, relativePath));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Inbox Journey app running at http://${HOST}:${PORT}`);
  });
}

function serveFile(response: import("node:http").ServerResponse, filePath: string): void {
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(REPORT_DIR) || !existsSync(normalizedPath)) {
    sendJson(response, 404, { error: "File not found" });
    return;
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const contentType = mimeType(ext);
  const file = readFileSync(normalizedPath);
  response.writeHead(200, { "Content-Type": contentType });
  response.end(file);
}

function sendHtml(response: import("node:http").ServerResponse, status: number, html: string): void {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function sendJson(response: import("node:http").ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function serializeCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function mimeType(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function matchHostedPath(
  pathname: string,
):
  | { kind: "workspace"; workspaceId: string }
  | { kind: "inbox"; workspaceId: string; inboxId: string }
  | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 4 && segments[0] === "api" && segments[1] === "hosted" && segments[2] === "workspaces") {
    return {
      kind: "workspace",
      workspaceId: decodeURIComponent(segments[3]),
    };
  }

  if (
    segments.length === 6 &&
    segments[0] === "api" &&
    segments[1] === "hosted" &&
    segments[2] === "workspaces" &&
    segments[4] === "inboxes"
  ) {
    return {
      kind: "inbox",
      workspaceId: decodeURIComponent(segments[3]),
      inboxId: decodeURIComponent(segments[5]),
    };
  }

  return null;
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function requirePayloadValue(payload: Record<string, unknown>, key: string): string {
  const value = readPayloadValue(payload, key);
  if (!value) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

function readPayloadValue(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const [rawName, ...rawValueParts] = segment.trim().split("=");
    if (rawName !== name) {
      continue;
    }

    return decodeURIComponent(rawValueParts.join("="));
  }

  return undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function readQueryValue(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

function readNumberQuery(url: URL, key: string): number | undefined {
  const rawValue = readQueryValue(url, key);
  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric query param "${key}" but received "${rawValue}"`);
  }

  return parsed;
}

function buildReportUrl(url: URL, workspaceId: string): string {
  const reportUrl = new URL("/app/report", `http://${HOST}:${PORT}`);
  reportUrl.searchParams.set("workspace", workspaceId);

  const passthroughKeys = ["user", "inbox", "test", "alias", "days", "max-results"];
  for (const key of passthroughKeys) {
    const value = url.searchParams.get(key)?.trim();
    if (value) {
      reportUrl.searchParams.set(key, value);
    }
  }

  return `${reportUrl.pathname}${reportUrl.search}`;
}
