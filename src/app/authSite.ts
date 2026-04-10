import type { HostedAuthSessionView } from "../hosted/authModels.ts";
import type { HostedWorkspaceView } from "../hosted/models.ts";

interface RenderLoginPageOptions {
  error?: string;
}

interface RenderAppShellOptions {
  sessionView: HostedAuthSessionView;
  currentWorkspace: HostedWorkspaceView;
  reportUrl: string;
}

export function renderLoginPage(options: RenderLoginPageOptions = {}): string {
  const errorMarkup = options.error
    ? `<div class="auth-error">${escapeHtml(options.error)}</div>`
    : `<div class="auth-note">Use a workspace member email to start a local session. This auth layer is designed to swap to Clerk later without changing workspace data.</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inbox Journey Sign In</title>
  <style>
    :root {
      --bg: #f3f7f3;
      --ink: #19323b;
      --muted: #5d7480;
      --line: rgba(25, 50, 59, 0.12);
      --panel: rgba(255, 255, 255, 0.86);
      --accent: #0f766e;
      --accent-2: #2563eb;
      --shadow: 0 24px 70px rgba(25, 50, 59, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.94), transparent 28%),
        radial-gradient(circle at 82% 14%, rgba(37,99,235,0.12), transparent 22%),
        linear-gradient(180deg, #f8fbf9 0%, #e7f0ec 100%);
    }
    .page {
      width: min(1080px, calc(100vw - 40px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }
    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
      text-decoration: none;
      color: inherit;
      font: 700 20px/1.1 Georgia, "Times New Roman", serif;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 12px 24px rgba(37,99,235,0.24);
    }
    .nav-link {
      text-decoration: none;
      color: var(--muted);
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.72);
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 0.95fr;
      gap: 22px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 28px;
      background: var(--panel);
      backdrop-filter: blur(18px);
      box-shadow: var(--shadow);
    }
    .copy {
      padding: 30px;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-size: 12px;
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 16px;
      font: 700 clamp(44px, 8vw, 72px)/0.96 Georgia, "Times New Roman", serif;
      letter-spacing: -0.05em;
      max-width: 9ch;
    }
    p {
      margin: 0 0 16px;
      color: var(--muted);
      line-height: 1.65;
      font-size: 17px;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 20px;
    }
    .pill {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.72);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--muted);
    }
    .form-panel {
      padding: 28px;
      display: grid;
      gap: 16px;
    }
    .form-panel h2 {
      margin: 0;
      font: 700 34px/1 Georgia, "Times New Roman", serif;
      letter-spacing: -0.03em;
    }
    .auth-note, .auth-error {
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 14px;
      line-height: 1.55;
    }
    .auth-note {
      background: rgba(15,118,110,0.08);
      color: var(--muted);
      border: 1px solid rgba(15,118,110,0.14);
    }
    .auth-error {
      background: rgba(190, 24, 93, 0.08);
      color: #9d174d;
      border: 1px solid rgba(190, 24, 93, 0.14);
    }
    form {
      display: grid;
      gap: 14px;
    }
    label {
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 600;
    }
    input, select {
      width: 100%;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.86);
      padding: 14px 16px;
      font: inherit;
      color: var(--ink);
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      font: 700 14px/1 "Segoe UI", Arial, sans-serif;
      color: white;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      cursor: pointer;
      box-shadow: 0 18px 30px rgba(37,99,235,0.22);
    }
    .helper {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }
    .status {
      min-height: 20px;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 940px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="nav">
      <a class="brand" href="/">
        <span class="brand-mark"></span>
        <span>Inbox Journey</span>
      </a>
      <a class="nav-link" href="/">Back to homepage</a>
    </header>

    <section class="grid">
      <article class="panel copy">
        <div class="eyebrow">Secure Workspace Access</div>
        <h1>Sign in to the inbox timeline.</h1>
        <p>Inbox Journey is moving toward a hosted account model where each team can manage workspaces, inbox connections, and brand tests under one account.</p>
        <p>This local auth flow gives us the same shape now: user identity, active workspace context, and a protected dashboard entrypoint.</p>
        <div class="pill-row">
          <div class="pill">Workspace-aware sessions</div>
          <div class="pill">Ready for Clerk org mapping</div>
          <div class="pill">Separate inbox connections per workspace</div>
        </div>
      </article>

      <aside class="panel form-panel">
        <h2>Continue with email</h2>
        ${errorMarkup}
        <form id="signInForm">
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="you@company.com" required>
          </label>
          <label>
            <span>Workspace</span>
            <input name="workspaceId" placeholder="Optional workspace id">
          </label>
          <button type="submit">Sign In</button>
          <div class="status" id="signInStatus"></div>
        </form>
        <div class="helper">For now, sign in with an email that already exists in a configured workspace file. In the hosted version this endpoint will be replaced by Clerk sign-in and organization switching.</div>
      </aside>
    </section>
  </div>

  <script>
    const form = document.getElementById("signInForm");
    const status = document.getElementById("signInStatus");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "Signing in...";
      const formData = new FormData(form);
      const payload = {
        email: String(formData.get("email") || "").trim(),
        workspaceId: String(formData.get("workspaceId") || "").trim() || undefined,
      };

      try {
        const response = await fetch("/api/auth/demo-signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to sign in.");
        }

        status.textContent = "Redirecting...";
        window.location.href = result.redirectTo || "/app";
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Unable to sign in.";
      }
    });
  </script>
</body>
</html>`;
}

export function renderAppShell(options: RenderAppShellOptions): string {
  const { sessionView, currentWorkspace, reportUrl } = options;
  const workspaceButtons = sessionView.user.workspaces
    .map((workspace) => {
      const isActive = workspace.workspaceId === sessionView.session.activeWorkspaceId;
      return `<a class="workspace-pill${isActive ? " active" : ""}" href="/app?workspace=${encodeURIComponent(workspace.workspaceId)}">${escapeHtml(workspace.workspaceName)}</a>`;
    })
    .join("");

  const inboxButtons = currentWorkspace.inboxConnections
    .map((inbox) => `<a class="inbox-pill" href="/app?workspace=${encodeURIComponent(currentWorkspace.workspace.id)}&inbox=${encodeURIComponent(inbox.id.split(":inbox:").pop() ?? inbox.id)}">${escapeHtml(inbox.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inbox Journey App</title>
  <style>
    :root {
      --bg: #eef3ef;
      --ink: #173039;
      --muted: #637682;
      --line: rgba(23,48,57,0.12);
      --panel: rgba(255,255,255,0.82);
      --accent: #0f766e;
      --accent-2: #2563eb;
      --shadow: 0 18px 48px rgba(17, 24, 39, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 0%, rgba(255,255,255,0.94), transparent 26%),
        radial-gradient(circle at 84% 12%, rgba(37,99,235,0.10), transparent 24%),
        linear-gradient(180deg, #f6faf8 0%, #e7efeb 100%);
    }
    .shell {
      width: min(1380px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 16px 0 24px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 14px;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font: 700 20px/1.1 Georgia, "Times New Roman", serif;
    }
    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 12px 24px rgba(37,99,235,0.22);
    }
    .meta {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .workspace-row, .inbox-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .workspace-pill, .inbox-pill, .link-button, .signout-button {
      text-decoration: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.8);
      color: var(--muted);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
    }
    .workspace-pill.active {
      background: linear-gradient(135deg, rgba(15,118,110,0.12), rgba(37,99,235,0.14));
      color: var(--ink);
      border-color: rgba(15,118,110,0.18);
    }
    .signout-button {
      color: white;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      cursor: pointer;
    }
    .frame-card {
      border: 1px solid var(--line);
      border-radius: 26px;
      overflow: hidden;
      background: rgba(255,255,255,0.62);
      box-shadow: var(--shadow);
    }
    iframe {
      width: 100%;
      min-height: calc(100vh - 186px);
      border: 0;
      display: block;
      background: white;
    }
    @media (max-width: 960px) {
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }
      iframe {
        min-height: calc(100vh - 240px);
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div>
        <div class="brand">
          <span class="brand-mark"></span>
          <span>Inbox Journey</span>
        </div>
        <div class="meta">Signed in as ${escapeHtml(sessionView.user.displayName)} (${escapeHtml(sessionView.user.email)})</div>
        <div class="meta">Account context: ${escapeHtml(currentWorkspace.account.name)} · Active workspace: ${escapeHtml(currentWorkspace.workspace.name)}</div>
      </div>
      <div class="actions">
        <a class="link-button" href="/">Homepage</a>
        <button class="signout-button" id="signOutButton" type="button">Sign Out</button>
      </div>
    </header>

    <div class="workspace-row">${workspaceButtons}</div>
    <div class="inbox-row">${inboxButtons}</div>

    <section class="frame-card">
      <iframe title="Inbox Journey report" src="${escapeHtml(reportUrl)}"></iframe>
    </section>
  </div>

  <script>
    const signOutButton = document.getElementById("signOutButton");
    signOutButton?.addEventListener("click", async () => {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.href = "/login";
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
