import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CorrelatedExperimentEmail } from "../correlation/experimentCorrelation.ts";
import type { WorkspaceSummary } from "../config.ts";

export interface ReportArtifact {
  generatedAt: string;
  reportDir: string;
  indexPath: string;
  previewCount: number;
  screenshotCount: number;
}

interface ReportOptions {
  workspaceId?: string;
  workspaceName?: string;
  availableWorkspaces?: WorkspaceSummary[];
  currentInboxId?: string;
  availableInboxes?: Array<{ id: string; label: string; userId: string }>;
}

export function generateTimelineReport(results: CorrelatedExperimentEmail[], options: ReportOptions = {}): ReportArtifact {
  const generatedAt = new Date().toISOString();
  const reportDir = path.resolve("reports", "latest");
  const previewsDir = path.join(reportDir, "previews");
  const screenshotsDir = path.join(reportDir, "screenshots");
  const browserProfileDir = mkdtempSync(path.join(tmpdir(), "inbox-journey-browser-"));
  const legacyBrowserProfileDir = path.resolve("reports", ".browser-profile-temp");

  removeDirectoryBestEffort(reportDir);
  removeDirectoryBestEffort(legacyBrowserProfileDir);
  mkdirSync(previewsDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });

  let screenshotCount = 0;
  const items = results
    .sort((a, b) => new Date(a.pulled.normalized.receivedAt).getTime() - new Date(b.pulled.normalized.receivedAt).getTime())
    .map((result, index) => {
      const safeName = `${String(index + 1).padStart(2, "0")}-${slugify(result.pulled.subject || result.alias)}`;
      const previewFile = `${safeName}.html`;
      const screenshotFile = `${safeName}.png`;
      const previewPath = path.join(previewsDir, previewFile);
      const screenshotPath = path.join(screenshotsDir, screenshotFile);

      writeFileSync(previewPath, renderPreviewDocument(result), "utf8");
      const screenshotGenerated = tryGenerateScreenshot(previewPath, screenshotPath, browserProfileDir);
      if (screenshotGenerated) {
        screenshotCount += 1;
      }

      return {
        id: result.pulled.gmailId,
        userId: result.ownerUserId ?? "unknown-user",
        userLabel: result.ownerUserLabel ?? "Unknown User",
        inboxId: result.inboxId ?? "unknown-inbox",
        inboxLabel: result.inboxLabel ?? "Unknown Inbox",
        configuredTestId: result.configuredTestId ?? null,
        configuredTestLabel: result.configuredTestLabel ?? "Unassigned Test",
        brand: result.brand,
        alias: result.alias,
        subject: result.pulled.subject,
        from: result.pulled.from,
        category: result.pulled.normalized.category,
        gmailTab: result.pulled.normalized.gmailTab,
        gmailLabelIds: result.pulled.labelIds,
        receivedAt: result.pulled.normalized.receivedAt,
        qualityScore: result.analysis.qualityScore,
        relevanceScore: result.analysis.relevanceScore,
        issueCount: result.analysis.issues.length,
        metrics: result.analysis.metrics,
        suggestions: result.analysis.suggestions,
        variants: result.analysis.variants,
        issues: result.analysis.issues,
        scenarioKey: result.run.scenarioKey,
        previewPath: absoluteWebPath(path.relative(reportDir, previewPath)),
        screenshotPath: screenshotGenerated ? absoluteWebPath(path.relative(reportDir, screenshotPath)) : null,
      };
    });

  const indexPath = path.join(reportDir, "index.html");
  writeFileSync(
    indexPath,
    renderReportDocument(
      items,
      generatedAt,
      options.workspaceName ?? "Inbox Journey Workspace",
      options.workspaceId ?? "environment-default",
      options.availableWorkspaces ?? [],
      options.currentInboxId ?? null,
      options.availableInboxes ?? [],
    ),
    "utf8",
  );
  removeDirectoryBestEffort(browserProfileDir);

  return {
    generatedAt,
    reportDir,
    indexPath,
    previewCount: items.length,
    screenshotCount,
  };
}

function renderPreviewDocument(result: CorrelatedExperimentEmail): string {
  const html = result.pulled.normalized.html;
  const text = result.pulled.normalized.text;
  const body = html
    ? html
    : `<pre style="white-space: pre-wrap; font: 14px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; margin: 0;">${escapeHtml(text ?? "(No preview available)")}</pre>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(result.pulled.subject || result.alias)}</title>
  <style>
    body {
      margin: 0;
      background: #edf1f5;
      font-family: Georgia, "Times New Roman", serif;
    }
    .frame {
      width: min(1120px, calc(100vw - 48px));
      margin: 24px auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 30px 80px rgba(10, 24, 40, 0.18);
      overflow: hidden;
    }
    .meta {
      padding: 16px 20px;
      border-bottom: 1px solid #dde4ea;
      background: linear-gradient(180deg, #ffffff 0%, #f5f7fa 100%);
      font: 12px/1.4 "Segoe UI", Arial, sans-serif;
      color: #495867;
    }
    .body {
      padding: 0;
      background: white;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="meta">
      <strong>${escapeHtml(result.pulled.subject || "(No subject)")}</strong><br>
      ${escapeHtml(result.alias)}<br>
      ${escapeHtml(result.pulled.from)}
    </div>
    <div class="body">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

function renderReportDocument(
  items: ReportTimelineItem[],
  generatedAt: string,
  workspaceName: string,
  workspaceId: string,
  availableWorkspaces: WorkspaceSummary[],
  currentInboxId: string | null,
  availableInboxes: Array<{ id: string; label: string; userId: string }>,
): string {
  const data = JSON.stringify({
    workspaceId,
    workspaceName,
    availableWorkspaces,
    currentInboxId,
    availableInboxes,
    generatedAt,
    totals: summarize(items),
    users: summarizeUsers(items),
    inboxes: summarizeInboxes(items),
    brands: summarizeBrands(items),
    items,
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inbox Journey</title>
  <style>
    :root {
      --bg: #eef4f5;
      --panel: rgba(249, 253, 253, 0.84);
      --ink: #16313a;
      --muted: #5e7580;
      --line: #cbdcdf;
      --welcome: #276fbf;
      --verification: #c44536;
      --recommendation: #2a9d8f;
      --saved-search-alert: #8a5cf6;
      --digest: #f4a261;
      --re-engagement: #e76f51;
      --unknown: #7d8590;
      --good: #2a9d8f;
      --ok: #f4a261;
      --bad: #c44536;
      --accent: #0f766e;
      --accent-soft: rgba(15, 118, 110, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.92), transparent 30%),
        radial-gradient(circle at top right, rgba(176, 226, 220, 0.35), transparent 22%),
        linear-gradient(180deg, #f5fbfb 0%, #e6eff0 100%);
      min-height: 100vh;
    }
    .shell {
      display: grid;
      grid-template-columns: 500px 1fr;
      min-height: 100vh;
    }
    .sidebar, .detail {
      padding: 28px;
    }
    .sidebar {
      border-right: 1px solid rgba(49, 92, 101, 0.14);
      background: rgba(252, 255, 255, 0.82);
      backdrop-filter: blur(16px);
      overflow: auto;
    }
    .detail {
      overflow: auto;
    }
    h1 {
      margin: 0 0 8px;
      font: 700 38px/1.02 Georgia, "Times New Roman", serif;
      letter-spacing: -0.03em;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 8px;
    }
    .sync-control {
      display: grid;
      justify-items: end;
      gap: 8px;
      min-width: 164px;
    }
    .sync-button {
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      background: linear-gradient(135deg, #0f766e 0%, #276fbf 100%);
      color: white;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 12px 24px rgba(39, 111, 191, 0.18);
      transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
    }
    .sync-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 14px 28px rgba(39, 111, 191, 0.24);
    }
    .sync-button:disabled {
      cursor: not-allowed;
      opacity: 0.7;
      transform: none;
      box-shadow: none;
    }
    .sync-button.busy {
      cursor: wait;
      opacity: 0.7;
      transform: none;
      box-shadow: none;
    }
    .sync-status {
      min-height: 18px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      text-align: right;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .eyebrow::before {
      content: "";
      width: 28px;
      height: 1px;
      background: currentColor;
    }
    .lede {
      color: var(--muted);
      max-width: 36ch;
      margin-bottom: 20px;
    }
    .filters {
      margin: 0 0 20px;
      padding: 16px;
      background: var(--panel);
      border: 1px solid rgba(49, 92, 101, 0.12);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(22, 49, 58, 0.06);
    }
    .filter-title {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .brand-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .filter-note {
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .brand-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid rgba(49, 92, 101, 0.16);
      background: rgba(255,255,255,0.9);
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .brand-chip.active {
      background: var(--accent-soft);
      border-color: rgba(15, 118, 110, 0.32);
      box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.08);
    }
    .brand-chip:hover {
      transform: translateY(-1px);
    }
    .brand-chip.disabled {
      opacity: 0.65;
      cursor: default;
      transform: none;
    }
    .brand-chip.disabled:hover {
      transform: none;
    }
    .brand-swatch {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      box-shadow: 0 0 0 6px rgba(0,0,0,0.03);
    }
    .brand-count {
      color: var(--muted);
      font-size: 12px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .activity-panel {
      margin-bottom: 24px;
      padding: 16px;
      background: var(--panel);
      border: 1px solid rgba(49, 92, 101, 0.12);
      border-radius: 18px;
      box-shadow: 0 10px 30px rgba(22, 49, 58, 0.06);
    }
    .section-title {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .weekly-chart {
      display: flex;
      align-items: end;
      gap: 10px;
      min-height: 140px;
      margin-bottom: 14px;
    }
    .week-bar {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      background: transparent;
      border: 0;
      padding: 0;
    }
    .week-bar.disabled {
      cursor: default;
      opacity: 0.5;
    }
    .week-bar.active .bar-fill {
      background: linear-gradient(180deg, #0f766e 0%, #276fbf 100%);
      box-shadow: 0 10px 20px rgba(39, 111, 191, 0.18);
    }
    .bar-wrap {
      width: 100%;
      max-width: 48px;
      height: 110px;
      border-radius: 16px;
      background: rgba(22, 49, 58, 0.08);
      display: flex;
      align-items: end;
      overflow: hidden;
    }
    .bar-fill {
      width: 100%;
      min-height: 6px;
      background: linear-gradient(180deg, #80b8b3 0%, #2a9d8f 100%);
      border-radius: 16px;
      transition: height 160ms ease;
    }
    .bar-label {
      font-size: 12px;
      color: var(--muted);
      text-align: center;
    }
    .bar-count {
      font: 700 14px/1 Georgia, "Times New Roman", serif;
      color: var(--ink);
    }
    .intraday-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }
    .intraday-title {
      font: 700 18px/1.1 Georgia, "Times New Roman", serif;
      margin: 0;
    }
    .intraday-sub {
      font-size: 13px;
      color: var(--muted);
    }
    .intraday-chart {
      position: relative;
      height: 140px;
      border-radius: 18px;
      background:
        linear-gradient(90deg,
          rgba(22,49,58,0.05) 0%,
          rgba(22,49,58,0.05) 1px,
          transparent 1px,
          transparent 25%,
          rgba(22,49,58,0.05) 25%,
          rgba(22,49,58,0.05) calc(25% + 1px),
          transparent calc(25% + 1px),
          transparent 50%,
          rgba(22,49,58,0.05) 50%,
          rgba(22,49,58,0.05) calc(50% + 1px),
          transparent calc(50% + 1px),
          transparent 75%,
          rgba(22,49,58,0.05) 75%,
          rgba(22,49,58,0.05) calc(75% + 1px),
          transparent calc(75% + 1px)
        ),
        linear-gradient(180deg, rgba(255,255,255,0.9), rgba(241,248,248,0.9));
      border: 1px solid rgba(49, 92, 101, 0.12);
      overflow: hidden;
    }
    .time-dot {
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 0 6px rgba(255,255,255,0.65);
      border: 1px solid rgba(22, 49, 58, 0.12);
    }
    .time-axis {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11px;
      color: var(--muted);
    }
    .card {
      background: var(--panel);
      border: 1px solid rgba(111, 97, 79, 0.14);
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(22, 49, 58, 0.06);
    }
    .card .label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .card .value {
      margin-top: 8px;
      font: 700 28px/1 Georgia, "Times New Roman", serif;
    }
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .event {
      width: 100%;
      border: 1px solid rgba(111, 97, 79, 0.16);
      background: rgba(255,255,255,0.72);
      border-radius: 20px;
      padding: 16px;
      text-align: left;
      cursor: pointer;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }
    .event:hover, .event.active {
      transform: translateY(-2px);
      box-shadow: 0 18px 40px rgba(28, 42, 50, 0.1);
      border-color: rgba(15, 118, 110, 0.28);
    }
    .event-top, .event-bottom {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .event-top {
      margin-bottom: 10px;
    }
    .category {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      text-transform: capitalize;
      color: var(--muted);
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--unknown);
      box-shadow: 0 0 0 6px rgba(0,0,0,0.03);
    }
    .subject {
      margin: 0;
      font-weight: 700;
      font-size: 16px;
    }
    .meta {
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
    }
    .scorebar {
      width: 108px;
      height: 9px;
      background: rgba(30,42,50,0.08);
      border-radius: 999px;
      overflow: hidden;
    }
    .scorefill {
      height: 100%;
      background: var(--ok);
    }
    .detail-shell {
      max-width: 1100px;
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    .detail-header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: start;
    }
    .detail-title {
      margin: 0 0 8px;
      font: 700 38px/1.02 Georgia, "Times New Roman", serif;
      letter-spacing: -0.03em;
    }
    .detail-sub {
      color: var(--muted);
      max-width: 60ch;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .pill {
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(255,255,255,0.72);
      border: 1px solid rgba(49, 92, 101, 0.14);
      font-size: 13px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 18px;
      align-items: start;
    }
    .insight-hero {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .insight-card {
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(255,255,255,0.78);
      border: 1px solid rgba(49,92,101,0.14);
      box-shadow: 0 10px 30px rgba(22, 49, 58, 0.05);
    }
    .insight-card .kicker {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .insight-card .headline {
      font: 700 22px/1.05 Georgia, "Times New Roman", serif;
      margin-bottom: 6px;
    }
    .insight-card .copy {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .stack {
      display: grid;
      gap: 18px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .issue, .suggestion {
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid rgba(49,92,101,0.14);
      background: rgba(255,255,255,0.76);
    }
    .variant-grid {
      display: grid;
      gap: 12px;
    }
    .variant-card {
      padding: 0;
      border-radius: 20px;
      border: 1px solid rgba(49,92,101,0.14);
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,249,249,0.92));
      overflow: hidden;
      box-shadow: 0 14px 28px rgba(22, 49, 58, 0.06);
    }
    .variant-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      margin: 0;
      padding: 14px 16px 10px;
      border-bottom: 1px solid rgba(49,92,101,0.1);
      background: rgba(248, 253, 253, 0.92);
    }
    .variant-label {
      font-weight: 700;
      font-size: 14px;
    }
    .variant-angle {
      color: var(--muted);
      font-size: 12px;
    }
    .variant-line {
      font-size: 13px;
      line-height: 1.45;
      color: var(--ink);
    }
    .variant-line strong {
      display: inline-block;
      min-width: 76px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .variant-body {
      padding: 16px;
    }
    .variant-email {
      border-radius: 18px;
      background: white;
      border: 1px solid rgba(49,92,101,0.1);
      overflow: hidden;
    }
    .variant-email-top {
      padding: 14px 16px;
      background: linear-gradient(180deg, #f7fbfb 0%, #edf7f6 100%);
      border-bottom: 1px solid rgba(49,92,101,0.1);
    }
    .variant-subject {
      font: 700 18px/1.15 Georgia, "Times New Roman", serif;
      margin-bottom: 6px;
      color: var(--ink);
    }
    .variant-preheader {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.45;
    }
    .variant-email-main {
      padding: 16px;
    }
    .variant-copy {
      font-size: 14px;
      line-height: 1.55;
      color: var(--ink);
      margin-bottom: 14px;
    }
    .variant-cta-wrap {
      display: flex;
      justify-content: start;
      margin-bottom: 14px;
    }
    .variant-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: linear-gradient(135deg, #0f766e, #276fbf);
      color: white;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .variant-meta {
      padding-top: 12px;
      border-top: 1px dashed rgba(49,92,101,0.14);
      display: grid;
      gap: 8px;
    }
    .issue strong, .suggestion strong {
      display: block;
      margin-bottom: 4px;
    }
    .preview {
      border-radius: 24px;
      overflow: hidden;
      background: rgba(255,255,255,0.7);
      border: 1px solid rgba(49,92,101,0.14);
      min-height: 720px;
      box-shadow: 0 18px 50px rgba(28, 42, 50, 0.08);
    }
    .preview img, .preview iframe {
      width: 100%;
      min-height: 720px;
      display: block;
      border: 0;
      background: white;
    }
    .empty {
      color: var(--muted);
      padding: 40px;
      text-align: center;
    }
    @media (max-width: 1120px) {
      .shell, .detail-grid, .insight-hero {
        grid-template-columns: 1fr;
      }
      .sidebar {
        border-right: 0;
        border-bottom: 1px solid rgba(111, 97, 79, 0.18);
      }
      .title-row {
        flex-direction: column;
      }
      .sync-control {
        justify-items: start;
      }
      .sync-status {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="eyebrow">Inbox Journey</div>
      <div class="title-row">
        <h1>Workspace Timeline</h1>
        <div class="sync-control">
          <button class="sync-button" id="syncButton" type="button">Sync Inbox</button>
          <div class="sync-status" id="syncStatus"></div>
        </div>
      </div>
      <p class="lede">Compare onboarding and lifecycle email streams across users, inboxes, and brands, then drill into any individual message with a rendered preview.</p>
      <section class="filters">
        <div class="filter-title">Admin View</div>
        <div class="brand-grid" id="workspaceFilters"></div>
        <div class="filter-note" id="workspaceNote"></div>
      </section>
      <section class="filters">
        <div class="filter-title">Workspace Users</div>
        <div class="brand-grid" id="userFilters"></div>
        <div class="filter-note" id="userNote"></div>
      </section>
      <section class="filters">
        <div class="filter-title">Configured Inboxes</div>
        <div class="brand-grid" id="inboxFilters"></div>
        <div class="filter-note" id="inboxNote"></div>
      </section>
      <section class="filters">
        <div class="filter-title">Brands on timeline</div>
        <div class="brand-grid" id="brandFilters"></div>
        <div class="filter-note" id="filterNote"></div>
      </section>
      <section class="summary" id="summary"></section>
      <section class="activity-panel">
        <div class="section-title">Weekly Volume</div>
        <div class="weekly-chart" id="weeklyChart"></div>
        <div class="intraday-head">
          <div>
            <h2 class="intraday-title" id="intradayTitle">Landing Times</h2>
            <div class="intraday-sub" id="intradaySub"></div>
          </div>
        </div>
        <div class="intraday-chart" id="intradayChart"></div>
        <div class="time-axis">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
      </section>
      <section class="timeline" id="timeline"></section>
    </aside>
    <main class="detail">
      <div class="detail-shell" id="detail"></div>
    </main>
  </div>
  <script>
    const report = ${data};

    const summary = document.getElementById("summary");
    const timeline = document.getElementById("timeline");
    const detail = document.getElementById("detail");
    const workspaceFilters = document.getElementById("workspaceFilters");
    const workspaceNote = document.getElementById("workspaceNote");
    const userFilters = document.getElementById("userFilters");
    const userNote = document.getElementById("userNote");
    const inboxFilters = document.getElementById("inboxFilters");
    const inboxNote = document.getElementById("inboxNote");
    const brandFilters = document.getElementById("brandFilters");
    const filterNote = document.getElementById("filterNote");
    const weeklyChart = document.getElementById("weeklyChart");
    const intradayChart = document.getElementById("intradayChart");
    const intradayTitle = document.getElementById("intradayTitle");
    const intradaySub = document.getElementById("intradaySub");
    const syncButton = document.getElementById("syncButton");
    const syncStatus = document.getElementById("syncStatus");
    const selectedUsers = new Set(report.users.map((user) => user.id));
    const selectedInboxes = new Set(report.inboxes.map((inbox) => inbox.id));
    const selectedBrands = new Set(report.brands.map((brand) => brand.name));
    let allUsersToggled = false;
    let allInboxesToggled = false;
    let allBrandsToggled = false;
    let selectedDateKey = null;

    function scoreColor(score) {
      if (score >= 85) return "var(--good)";
      if (score >= 65) return "var(--ok)";
      return "var(--bad)";
    }

    function categoryColor(category) {
      return \`var(--\${category || "unknown"})\`;
    }

    function brandColor(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i += 1) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return \`hsl(\${hue} 62% 45%)\`;
    }

    function formatTime(value) {
      return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }

    function formatGmailTab(tab) {
      switch (tab) {
        case "primary":
          return "Primary";
        case "promotions":
          return "Promotions";
        case "social":
          return "Social";
        case "updates":
          return "Updates";
        case "forums":
          return "Forums";
        default:
          return "Unknown";
      }
    }

    function setSyncStatus(message) {
      syncStatus.textContent = message;
    }

    function setSyncBusy(isBusy) {
      syncButton.classList.toggle("busy", isBusy);
      syncButton.disabled = isBusy;
    }

    function buildSyncQueryString() {
      const params = new URLSearchParams();
      if (report.workspaceId) {
        params.set("workspace", report.workspaceId);
      }

      if (selectedUsers.size === 1) {
        params.set("user", [...selectedUsers][0]);
      }

      if (selectedInboxes.size === 1) {
        params.set("inbox", [...selectedInboxes][0]);
      }

      return params.toString();
    }

    async function syncInbox() {
      if (!syncButton || syncButton.disabled) {
        return;
      }

      setSyncBusy(true);
      const originalLabel = syncButton.textContent;
      syncButton.textContent = "Syncing...";
      setSyncStatus("Polling Gmail and rebuilding the report...");

      try {
        const query = buildSyncQueryString();
        const response = await fetch(\`/api/sync\${query ? \`?\${query}\` : ""}\`, { method: "POST" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Sync failed");
        }

        setSyncStatus(\`Synced \${payload.pulledCount} emails at \${formatTime(new Date().toISOString())}. Reloading...\`);
        window.location.reload();
      } catch (error) {
        setSyncStatus(error instanceof Error ? error.message : "Sync failed");
      } finally {
        setSyncBusy(false);
        syncButton.textContent = originalLabel;
      }
    }

    function navigateToAdminContext(nextWorkspaceId, nextInboxId) {
      const params = new URLSearchParams();
      if (nextWorkspaceId) {
        params.set("workspace", nextWorkspaceId);
      }
      if (nextInboxId) {
        params.set("inbox", nextInboxId);
      }
      window.location.href = \`/\${params.toString() ? \`?\${params.toString()}\` : ""}\`;
    }

    function getVisibleItems() {
      return report.items.filter(
        (item) =>
          selectedUsers.has(item.userId) &&
          selectedInboxes.has(item.inboxId) &&
          selectedBrands.has(item.brand),
      );
    }

    function visibleCountForInbox(inboxId) {
      return report.items.filter((item) => item.inboxId === inboxId).length;
    }

    function getWeeklyBuckets(items) {
      const buckets = new Map();
      for (const item of items) {
        const date = new Date(item.receivedAt);
        const key = date.toISOString().slice(0, 10);
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key).push(item);
      }

      return [...buckets.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([key, bucketItems]) => ({
          key,
          label: new Date(\`\${key}T00:00:00\`).toLocaleDateString([], { weekday: "short" }),
          fullLabel: new Date(\`\${key}T00:00:00\`).toLocaleDateString([], { month: "short", day: "numeric" }),
          count: bucketItems.length,
          items: bucketItems.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt)),
        }));
    }

    function ensureSelectedDate() {
      const buckets = getWeeklyBuckets(getVisibleItems());
      if (buckets.length === 0) {
        selectedDateKey = null;
        return buckets;
      }

      const exists = buckets.some((bucket) => bucket.key === selectedDateKey);
      if (!exists) {
        selectedDateKey = buckets[buckets.length - 1].key;
      }

      return buckets;
    }

    function renderWorkspaceFilters() {
      const workspaces = report.availableWorkspaces.length
        ? report.availableWorkspaces
        : [{ id: report.workspaceId, label: report.workspaceName, source: "environment" }];

      workspaceFilters.innerHTML = workspaces.map((workspace) => \`
        <button class="brand-chip \${workspace.id === report.workspaceId ? "active" : ""} \${window.location.protocol === "file:" ? "disabled" : ""}" data-workspace="\${workspace.id}">
          <span class="brand-swatch" style="background:\${brandColor(workspace.id)}"></span>
          <span>\${escapeHtml(workspace.label)}</span>
          <span class="brand-count">\${workspace.source === "workspace-file" ? "workspace" : "env"}</span>
        </button>
      \`).join("");

      if (window.location.protocol === "file:") {
        workspaceNote.textContent = "Workspace switching is available in the local app server view.";
      } else if (workspaces.length === 1) {
        workspaceNote.textContent = \`Viewing \${workspaces[0].label}. Add another *.workspace.json file under data/ to switch workspaces here.\`;
      } else {
        workspaceNote.textContent = "Switch between workspace configurations to review different user and inbox sets.";
      }

      workspaceFilters.querySelectorAll(".brand-chip").forEach((button) => {
        button.addEventListener("click", () => {
          const workspaceId = button.dataset.workspace;
          if (!workspaceId || button.classList.contains("disabled") || workspaceId === report.workspaceId) {
            return;
          }

          navigateToAdminContext(workspaceId);
        });
      });
    }

    function renderUserFilters() {
      const chips = [];

      if (report.users.length > 1) {
        chips.push(\`
          <button class="brand-chip" data-user="__all__">
            <span class="brand-swatch" style="background: linear-gradient(135deg, #0f766e, #276fbf)"></span>
            <span>All users</span>
            <span class="brand-count">\${report.users.length}</span>
          </button>
        \`);
      }

      chips.push(...report.users.map((user) => \`
        <button class="brand-chip active \${report.users.length === 1 ? "disabled" : ""}" data-user="\${user.id}">
          <span class="brand-swatch" style="background:\${brandColor(user.id)}"></span>
          <span>\${escapeHtml(user.label)}</span>
          <span class="brand-count">\${user.count}</span>
        </button>
      \`));

      userFilters.innerHTML = chips.join("");

      if (report.users.length === 1) {
        userNote.textContent = \`Only \${report.users[0].label} is configured right now. Add another user in the workspace file to compare owners side by side.\`;
      } else {
        userNote.textContent = "Choose one or more users to narrow the workspace timeline.";
      }

      userFilters.querySelectorAll(".brand-chip").forEach((button) => {
        button.addEventListener("click", () => {
          const userId = button.dataset.user;
          if (!userId || button.classList.contains("disabled")) {
            return;
          }

          if (userId === "__all__") {
            allUsersToggled = !allUsersToggled;
            selectedUsers.clear();
            if (allUsersToggled) {
              report.users.forEach((entry) => selectedUsers.add(entry.id));
            }
          } else {
            allUsersToggled = false;
            if (selectedUsers.has(userId)) {
              selectedUsers.delete(userId);
            } else {
              selectedUsers.add(userId);
            }
          }

          syncUserButtons();
          renderSummary();
          renderActivity();
          renderTimeline();
          renderDetail(getVisibleItems()[0]);
        });
      });
    }

    function syncUserButtons() {
      userFilters.querySelectorAll(".brand-chip").forEach((button) => {
        if (button.dataset.user === "__all__") {
          button.classList.toggle("active", allUsersToggled);
          return;
        }

        button.classList.toggle("active", selectedUsers.has(button.dataset.user));
      });
    }

    function renderInboxFilters() {
      const inboxes = report.availableInboxes.length
        ? report.availableInboxes
        : report.inboxes.map((inbox) => ({ id: inbox.id, label: inbox.label, userId: "unknown-user" }));
      const chips = [];

      if (inboxes.length > 1) {
        chips.push(\`
          <button class="brand-chip \${!report.currentInboxId ? "active" : ""} \${window.location.protocol === "file:" ? "disabled" : ""}" data-inbox="__all__">
            <span class="brand-swatch" style="background: linear-gradient(135deg, #276fbf, #8a5cf6)"></span>
            <span>All inboxes</span>
            <span class="brand-count">\${inboxes.length}</span>
          </button>
        \`);
      }

      chips.push(...inboxes.map((inbox) => \`
        <button class="brand-chip \${report.currentInboxId === inbox.id || (inboxes.length === 1 && !report.currentInboxId) ? "active" : ""} \${window.location.protocol === "file:" ? "disabled" : ""}" data-inbox="\${inbox.id}">
          <span class="brand-swatch" style="background:\${brandColor(inbox.id)}"></span>
          <span>\${escapeHtml(inbox.label)}</span>
          <span class="brand-count">\${visibleCountForInbox(inbox.id)}</span>
        </button>
      \`));

      inboxFilters.innerHTML = chips.join("");

      if (window.location.protocol === "file:") {
        inboxNote.textContent = "Inbox switching is available in the local app server view.";
      } else if (inboxes.length === 1) {
        inboxNote.textContent = \`Viewing \${inboxes[0].label}. Add more inboxes in the workspace file to switch contexts here.\`;
      } else {
        inboxNote.textContent = "Switch inbox contexts here. Use the brand chips below for comparison inside the current context.";
      }

      inboxFilters.querySelectorAll(".brand-chip").forEach((button) => {
        button.addEventListener("click", () => {
          const inboxId = button.dataset.inbox;
          if (!inboxId || button.classList.contains("disabled")) {
            return;
          }

          navigateToAdminContext(report.workspaceId, inboxId === "__all__" ? undefined : inboxId);
        });
      });
    }

    function syncInboxButtons() {
      return;
    }

    function renderBrandFilters() {
      const chips = [];

      if (report.brands.length > 1) {
        chips.push(\`
          <button class="brand-chip" data-brand="__all__">
            <span class="brand-swatch" style="background: linear-gradient(135deg, #0f766e, #276fbf)"></span>
            <span>All brands</span>
            <span class="brand-count">\${report.items.length}</span>
          </button>
        \`);
      }

      chips.push(...report.brands.map((brand) => \`
        <button class="brand-chip active \${report.brands.length === 1 ? "disabled" : ""}" data-brand="\${brand.name}">
          <span class="brand-swatch" style="background:\${brandColor(brand.name)}"></span>
          <span>\${escapeHtml(brand.label)}</span>
          <span class="brand-count">\${brand.count}</span>
        </button>
      \`));

      brandFilters.innerHTML = chips.join("");

      if (report.brands.length === 1) {
        filterNote.textContent = \`Only \${report.brands[0].label} is present in this report window, so the brand filter will start to matter once a second brand arrives.\`;
      } else {
        filterNote.textContent = "Choose one or more brands to focus the timeline, or use All brands to compare everything together.";
      }

      brandFilters.querySelectorAll(".brand-chip").forEach((button) => {
        button.addEventListener("click", () => {
          const brand = button.dataset.brand;
          if (!brand || button.classList.contains("disabled")) {
            return;
          }

          if (brand === "__all__") {
            allBrandsToggled = !allBrandsToggled;
            selectedBrands.clear();

            if (allBrandsToggled) {
              report.brands.forEach((entry) => selectedBrands.add(entry.name));
            }
          } else {
            allBrandsToggled = false;
            if (selectedBrands.has(brand)) {
              selectedBrands.delete(brand);
            } else {
              selectedBrands.add(brand);
            }
          }

          syncBrandButtons();
          renderSummary();
          renderActivity();
          renderTimeline();
          const first = getVisibleItems()[0];
          renderDetail(first);
        });
      });
    }

    function syncBrandButtons() {
      brandFilters.querySelectorAll(".brand-chip").forEach((button) => {
        if (button.dataset.brand === "__all__") {
          button.classList.toggle("active", allBrandsToggled);
          return;
        }

        button.classList.toggle("active", selectedBrands.has(button.dataset.brand));
      });
    }

    function renderSummary() {
      const visibleItems = getVisibleItems();
      const totals = summarize(visibleItems);
      const cards = [
        { label: "Workspace", value: report.workspaceName },
        { label: "Visible Emails", value: totals.totalEmails },
        { label: "Selected Users", value: selectedUsers.size },
        { label: "Selected Inboxes", value: selectedInboxes.size },
        { label: "Selected Brands", value: selectedBrands.size },
        { label: "Avg Quality", value: totals.avgQualityScore },
        { label: "Avg Relevance", value: totals.avgRelevanceScore },
        { label: "Generated", value: formatTime(report.generatedAt) },
      ];

      summary.innerHTML = cards.map((card) => \`
        <article class="card">
          <div class="label">\${card.label}</div>
          <div class="value">\${card.value}</div>
        </article>
      \`).join("");
    }

    function renderActivity() {
      const buckets = ensureSelectedDate();
      if (buckets.length === 0) {
        weeklyChart.innerHTML = '<div class="empty">No activity for the selected brands.</div>';
        intradayChart.innerHTML = "";
        intradayTitle.textContent = "Landing Times";
        intradaySub.textContent = "Select one or more brands to see activity.";
        return;
      }

      const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
      weeklyChart.innerHTML = buckets.map((bucket) => \`
        <button class="week-bar \${bucket.key === selectedDateKey ? "active" : ""}" data-date="\${bucket.key}">
          <div class="bar-count">\${bucket.count}</div>
          <div class="bar-wrap">
            <div class="bar-fill" style="height:\${Math.max(8, Math.round((bucket.count / maxCount) * 110))}px"></div>
          </div>
          <div class="bar-label">\${bucket.label}<br>\${bucket.fullLabel}</div>
        </button>
      \`).join("");

      weeklyChart.querySelectorAll(".week-bar").forEach((button) => {
        button.addEventListener("click", () => {
          const dateKey = button.dataset.date;
          if (!dateKey) {
            return;
          }

          selectedDateKey = dateKey;
          renderActivity();
        });
      });

      const selectedBucket = buckets.find((bucket) => bucket.key === selectedDateKey) ?? buckets[buckets.length - 1];
      intradayTitle.textContent = \`Landing Times • \${selectedBucket.fullLabel}\`;
      intradaySub.textContent = \`\${selectedBucket.count} email\${selectedBucket.count === 1 ? "" : "s"} landed on this day for the selected brands.\`;

      const rows = buildIntradayRows(selectedBucket.items);
      intradayChart.innerHTML = rows.map((entry) => {
        const minutes = timeOfDayMinutes(entry.receivedAt);
        const left = (minutes / 1440) * 100;
        const top = 24 + entry.row * 24;
        return \`<div class="time-dot" title="\${escapeHtml(entry.subject || "(No subject)")} • \${formatTime(entry.receivedAt)}" style="left:\${left}%; top:\${top}px; background:\${brandColor(entry.brand)}"></div>\`;
      }).join("");
    }

    function renderTimeline() {
      const visibleItems = getVisibleItems();
      if (visibleItems.length === 0) {
        timeline.innerHTML = '<div class="empty">No emails match the selected brands.</div>';
        return;
      }

      timeline.innerHTML = visibleItems.map((item, index) => \`
        <button class="event \${index === 0 ? "active" : ""}" data-id="\${item.id}">
          <div class="event-top">
            <span class="category">
              <span class="dot" style="background:\${categoryColor(item.category)}"></span>
              \${item.category.replaceAll("-", " ")}
            </span>
            <span class="meta">\${formatTime(item.receivedAt)}</span>
          </div>
          <p class="subject">\${escapeHtml(item.subject || "(No subject)")}</p>
          <div class="meta"><span style="display:inline-block;width:9px;height:9px;border-radius:999px;background:\${brandColor(item.brand)};margin-right:8px;"></span>\${escapeHtml(item.userLabel)} • \${escapeHtml(item.inboxLabel)} • \${escapeHtml(item.brand)} • Gmail: \${formatGmailTab(item.gmailTab)}</div>
          <div class="event-bottom">
            <div class="scorebar"><div class="scorefill" style="width:\${item.qualityScore}%; background:\${scoreColor(item.qualityScore)}"></div></div>
            <div class="meta">Q \${item.qualityScore} / R \${item.relevanceScore}</div>
          </div>
        </button>
      \`).join("");

      timeline.querySelectorAll(".event").forEach((button) => {
        button.addEventListener("click", () => selectItem(button.dataset.id));
      });
    }

    function renderDetail(item) {
      if (!item) {
        detail.innerHTML = '<div class="empty">No email selected. Turn on one or more brands on the left to populate the detail pane.</div>';
        return;
      }

      const issues = item.issues.length
        ? item.issues.map((issue) => \`
          <div class="issue">
            <strong>\${escapeHtml(issue.code)}</strong>
            <div>\${escapeHtml(issue.summary)}</div>
          </div>
        \`).join("")
        : '<div class="issue"><strong>No major issues</strong><div>This email passed the current heuristic checks.</div></div>';

      const suggestions = item.suggestions.length
        ? item.suggestions.map((suggestion) => \`
          <div class="suggestion">
            <strong>\${escapeHtml(suggestion.title)}</strong>
            <div>\${escapeHtml(suggestion.rationale)}</div>
          </div>
        \`).join("")
        : '<div class="suggestion"><strong>No immediate suggestions</strong><div>The current rules did not flag an obvious improvement opportunity.</div></div>';

      const variants = item.variants.length
        ? item.variants.map((variant) => \`
          <div class="variant-card">
            <div class="variant-head">
              <div class="variant-label">\${escapeHtml(variant.label)}</div>
              <div class="variant-angle">\${escapeHtml(variant.angle)}</div>
            </div>
            <div class="variant-body">
              <div class="variant-email">
                <div class="variant-email-top">
                  <div class="variant-subject">\${escapeHtml(variant.subject)}</div>
                  <div class="variant-preheader">\${escapeHtml(variant.preheader)}</div>
                </div>
                <div class="variant-email-main">
                  <div class="variant-copy">\${escapeHtml(variant.body)}</div>
                  <div class="variant-cta-wrap">
                    <div class="variant-cta">\${escapeHtml(variant.cta)}</div>
                  </div>
                  <div class="variant-meta">
                    <div class="variant-line"><strong>Subject</strong> \${escapeHtml(variant.subject)}</div>
                    <div class="variant-line"><strong>Preheader</strong> \${escapeHtml(variant.preheader)}</div>
                    <div class="variant-line"><strong>CTA</strong> \${escapeHtml(variant.cta)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        \`).join("")
        : '<div class="variant-card"><div class="variant-label">No variants generated</div></div>';

      const preview = item.screenshotPath
        ? \`<img src="\${item.screenshotPath}" alt="Email screenshot preview">\`
        : \`<iframe src="\${item.previewPath}" title="Rendered email preview"></iframe>\`;

      const topIssue = item.issues[0];
      const topSuggestion = item.suggestions[0];
      const insightSummary = topIssue
        ? topIssue.summary
        : "This email passed the current heuristic checks without a major issue.";
      const nextBestAction = topSuggestion
        ? topSuggestion.title
        : "No immediate optimization suggested.";

      detail.innerHTML = \`
        <div class="detail-header">
          <div>
            <h2 class="detail-title">\${escapeHtml(item.subject || "(No subject)")}</h2>
            <div class="detail-sub">\${escapeHtml(item.from)} to \${escapeHtml(item.alias)} on \${formatTime(item.receivedAt)}</div>
          </div>
          <div class="pill-row">
            <div class="pill">User: \${escapeHtml(item.userLabel)}</div>
            <div class="pill">Inbox: \${escapeHtml(item.inboxLabel)}</div>
            <div class="pill">Test: \${escapeHtml(item.configuredTestLabel)}</div>
            <div class="pill">Category: \${escapeHtml(item.category)}</div>
            <div class="pill">Gmail tab: \${formatGmailTab(item.gmailTab)}</div>
            <div class="pill">Brand: \${escapeHtml(item.brand)}</div>
            <div class="pill">Quality: \${item.qualityScore}</div>
            <div class="pill">Relevance: \${item.relevanceScore}</div>
            <div class="pill">Scenario: \${escapeHtml(item.scenarioKey)}</div>
          </div>
        </div>
        <div class="insight-hero">
          <article class="insight-card">
            <div class="kicker">Primary Insight</div>
            <div class="headline">\${item.issues.length ? escapeHtml(item.issues[0].code.replaceAll("-", " ")) : "Healthy send"}</div>
            <div class="copy">\${escapeHtml(insightSummary)}</div>
          </article>
          <article class="insight-card">
            <div class="kicker">Recommended Move</div>
            <div class="headline">\${escapeHtml(nextBestAction)}</div>
            <div class="copy">\${escapeHtml(topSuggestion ? topSuggestion.rationale : "This message is in a solid state under the current heuristics.")}</div>
          </article>
          <article class="insight-card">
            <div class="kicker">Timing Signal</div>
            <div class="headline">\${item.metrics.minutesFromLastAction ?? "n/a"} min</div>
            <div class="copy">Estimated minutes from the last known scenario action to the email arrival.</div>
          </article>
        </div>
        <div class="detail-grid">
          <div class="stack">
            <article class="card">
              <div class="label">Metrics</div>
              <div class="list">
                <div class="pill">Minutes from last action: \${item.metrics.minutesFromLastAction ?? "n/a"}</div>
                <div class="pill">Links: \${item.metrics.totalLinks}</div>
                <div class="pill">Has unsubscribe: \${item.metrics.hasUnsubscribeLink}</div>
                <div class="pill">Has preferences: \${item.metrics.hasPreferenceLink}</div>
                <div class="pill">Has verification CTA: \${item.metrics.hasVerificationLink}</div>
                <div class="pill">Gmail tab: \${formatGmailTab(item.gmailTab)}</div>
                <div class="pill">Alias: \${escapeHtml(item.alias)}</div>
                <div class="pill">Test: \${escapeHtml(item.configuredTestLabel)}</div>
                <div class="pill">Gmail labels: \${item.gmailLabelIds.length ? escapeHtml(item.gmailLabelIds.join(", ")) : "none detected"}</div>
              </div>
            </article>
            <article class="card">
              <div class="label">Issues</div>
              <div class="list">\${issues}</div>
            </article>
            <article class="card">
              <div class="label">Suggestions</div>
              <div class="list">\${suggestions}</div>
            </article>
            <article class="card">
              <div class="label">CTR Variants</div>
              <div class="variant-grid">\${variants}</div>
            </article>
          </div>
          <article class="preview">
            \${preview}
          </article>
        </div>
      \`;
    }

    function selectItem(id) {
      const item = getVisibleItems().find((entry) => entry.id === id);
      timeline.querySelectorAll(".event").forEach((button) => {
        button.classList.toggle("active", button.dataset.id === id);
      });
      renderDetail(item);
    }

    function buildIntradayRows(items) {
      const sorted = [...items].sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
      return sorted.map((item, index) => ({
        ...item,
        row: index % 4,
      }));
    }

    function timeOfDayMinutes(value) {
      const date = new Date(value);
      return date.getHours() * 60 + date.getMinutes();
    }

    function summarize(items) {
      const totalEmails = items.length;
      const avgQualityScore = totalEmails
        ? Math.round(items.reduce((sum, item) => sum + item.qualityScore, 0) / totalEmails)
        : 0;
      const avgRelevanceScore = totalEmails
        ? Math.round(items.reduce((sum, item) => sum + item.relevanceScore, 0) / totalEmails)
        : 0;

      return {
        totalEmails,
        avgQualityScore,
        avgRelevanceScore,
      };
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    if (window.location.protocol === "file:") {
      syncButton.disabled = true;
      syncButton.title = "Start the local app server in PowerShell to enable syncing.";
      syncButton.textContent = "Start Local Server";
      setSyncStatus("Run npm.cmd run app:serve in this project, then open http://127.0.0.1:8787/app.");
    } else {
      syncButton.addEventListener("click", syncInbox);
      setSyncStatus(\`Last refreshed \${formatTime(report.generatedAt)}\`);
    }

    renderUserFilters();
    renderInboxFilters();
    renderBrandFilters();
    renderSummary();
    renderActivity();
    renderTimeline();
    renderDetail(getVisibleItems()[0]);
  </script>
</body>
</html>`;
}

interface ReportTimelineItem {
  id: string;
  userId: string;
  userLabel: string;
  inboxId: string;
  inboxLabel: string;
  configuredTestId: string | null;
  configuredTestLabel: string;
  brand: string;
  alias: string;
  subject: string;
  from: string;
  category: string;
  gmailTab: string;
  gmailLabelIds: string[];
  receivedAt: string;
  qualityScore: number;
  relevanceScore: number;
  issueCount: number;
  scenarioKey: string;
  metrics: {
    minutesFromLastAction: number | null;
    hasUnsubscribeLink: boolean;
    hasPreferenceLink: boolean;
    hasVerificationLink: boolean;
    totalLinks: number;
    subjectCharacterCount: number;
    viewedListingOverlapScore: number;
  };
  suggestions: Array<{ title: string; rationale: string }>;
  variants: Array<{ label: string; angle: string; subject: string; preheader: string; cta: string; body: string }>;
  issues: Array<{ code: string; severity: string; summary: string }>;
  previewPath: string;
  screenshotPath: string | null;
}

function summarize(items: ReportTimelineItem[]) {
  const totalEmails = items.length;
  const avgQualityScore = totalEmails
    ? Math.round(items.reduce((sum, item) => sum + item.qualityScore, 0) / totalEmails)
    : 0;
  const avgRelevanceScore = totalEmails
    ? Math.round(items.reduce((sum, item) => sum + item.relevanceScore, 0) / totalEmails)
    : 0;

  return {
    totalEmails,
    avgQualityScore,
    avgRelevanceScore,
  };
}

function summarizeUsers(items: ReportTimelineItem[]) {
  const counts = new Map<string, { id: string; label: string; count: number }>();
  for (const item of items) {
    const existing = counts.get(item.userId);
    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(item.userId, {
      id: item.userId,
      label: item.userLabel,
      count: 1,
    });
  }

  return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function summarizeInboxes(items: ReportTimelineItem[]) {
  const counts = new Map<string, { id: string; label: string; count: number }>();
  for (const item of items) {
    const existing = counts.get(item.inboxId);
    if (existing) {
      existing.count += 1;
      continue;
    }

    counts.set(item.inboxId, {
      id: item.inboxId,
      label: item.inboxLabel,
      count: 1,
    });
  }

  return [...counts.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function summarizeBrands(items: ReportTimelineItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.brand, (counts.get(item.brand) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({
      name,
      label: labelize(name),
      count,
    }));
}

function tryGenerateScreenshot(previewPath: string, screenshotPath: string, browserProfileDir: string): boolean {
  const browserPath = findBrowserPath();
  if (!browserPath) {
    return false;
  }

  try {
    mkdirSync(browserProfileDir, { recursive: true });
    execFileSync(
      browserPath,
      [
        `--user-data-dir=${browserProfileDir}`,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        "--virtual-time-budget=5000",
        "--window-size=1280,1800",
        `--screenshot=${screenshotPath}`,
        toFileUrl(previewPath),
      ],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );

    return existsSync(screenshotPath);
  } catch {
    return false;
  }
}

function removeDirectoryBestEffort(targetPath: string): void {
  try {
    rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (isLockedPathError(error)) {
      return;
    }
    throw error;
  }
}

function isLockedPathError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const nodeError = error as NodeJS.ErrnoException;
  return nodeError.code === "EPERM" || nodeError.code === "EBUSY";
}

function findBrowserPath(): string | null {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function toFileUrl(filePath: string): string {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "email";
}

function absoluteWebPath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/${normalized}`;
}

function labelize(value: string): string {
  return value
    .split(/[-._]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
