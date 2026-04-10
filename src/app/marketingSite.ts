export function renderHomepage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inbox Journey</title>
  <style>
    :root {
      --bg: #f5f7f3;
      --ink: #19323b;
      --muted: #617682;
      --panel: rgba(255,255,255,0.78);
      --line: rgba(25,50,59,0.12);
      --accent: #0d9488;
      --accent-2: #2563eb;
      --warm: #f59e0b;
      --shadow: 0 24px 80px rgba(20, 35, 46, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 28%),
        radial-gradient(circle at 85% 15%, rgba(37,99,235,0.12), transparent 20%),
        linear-gradient(180deg, #f7fbf8 0%, #eaf0ec 100%);
    }
    a { color: inherit; text-decoration: none; }
    .page {
      width: min(1180px, calc(100vw - 40px));
      margin: 0 auto;
      padding: 24px 0 56px;
    }
    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font: 700 20px/1.1 Georgia, "Times New Roman", serif;
      letter-spacing: -0.02em;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.24);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .nav-link, .nav-cta, .hero-cta, .hero-secondary, .signup-submit {
      border-radius: 999px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 700;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }
    .nav-link, .hero-secondary {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.72);
    }
    .nav-cta, .hero-cta, .signup-submit {
      border: 0;
      color: white;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      box-shadow: 0 16px 30px rgba(37, 99, 235, 0.24);
      cursor: pointer;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      align-items: stretch;
      margin-bottom: 26px;
    }
    .hero-copy, .hero-card, .section-card, .signup-card {
      border: 1px solid var(--line);
      background: var(--panel);
      backdrop-filter: blur(18px);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .hero-copy {
      padding: 34px;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
      font-size: 12px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.16em;
    }
    .eyebrow::before {
      content: "";
      width: 28px;
      height: 1px;
      background: currentColor;
    }
    h1 {
      margin: 0 0 16px;
      font: 700 clamp(46px, 8vw, 78px)/0.96 Georgia, "Times New Roman", serif;
      letter-spacing: -0.05em;
      max-width: 11ch;
    }
    .hero-copy p {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.6;
      max-width: 36ch;
    }
    .cta-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .proof {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .proof-pill {
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.74);
      font-size: 13px;
      color: var(--muted);
    }
    .hero-card {
      padding: 24px;
      display: grid;
      gap: 16px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.92), rgba(243,249,249,0.84)),
        radial-gradient(circle at top right, rgba(13,148,136,0.12), transparent 28%);
    }
    .hero-metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .metric {
      padding: 16px;
      border-radius: 20px;
      border: 1px solid rgba(25,50,59,0.08);
      background: rgba(255,255,255,0.8);
    }
    .metric-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .metric-value {
      font: 700 32px/1 Georgia, "Times New Roman", serif;
      margin-bottom: 8px;
    }
    .metric-copy {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .story {
      padding: 18px;
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(13,148,136,0.08), rgba(245,158,11,0.12));
      border: 1px solid rgba(25,50,59,0.08);
    }
    .story h2 {
      margin: 0 0 8px;
      font: 700 28px/1.05 Georgia, "Times New Roman", serif;
    }
    .story p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.6;
    }
    .section-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 22px;
    }
    .section-card {
      padding: 22px;
    }
    .section-card h3 {
      margin: 0 0 10px;
      font: 700 28px/1.05 Georgia, "Times New Roman", serif;
    }
    .section-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }
    .signup-card {
      display: grid;
      grid-template-columns: 0.95fr 1.05fr;
      gap: 0;
      overflow: hidden;
    }
    .signup-copy, .signup-form-wrap {
      padding: 28px;
    }
    .signup-copy {
      background: linear-gradient(180deg, rgba(244,247,243,0.9), rgba(232,240,236,0.95));
      border-right: 1px solid var(--line);
    }
    .signup-copy h2, .signup-form-wrap h2 {
      margin: 0 0 12px;
      font: 700 36px/1 Georgia, "Times New Roman", serif;
      letter-spacing: -0.03em;
    }
    .signup-copy p, .signup-form-wrap p {
      margin: 0 0 12px;
      color: var(--muted);
      line-height: 1.6;
    }
    .signup-list {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }
    .signup-list div {
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.72);
      border: 1px solid rgba(25,50,59,0.08);
      color: var(--muted);
      font-size: 14px;
    }
    .signup-form {
      display: grid;
      gap: 14px;
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    label {
      display: grid;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    input, textarea {
      width: 100%;
      border-radius: 16px;
      border: 1px solid rgba(25,50,59,0.12);
      padding: 14px 16px;
      font: inherit;
      color: var(--ink);
      background: rgba(255,255,255,0.88);
    }
    textarea {
      min-height: 110px;
      resize: vertical;
    }
    .signup-status {
      min-height: 22px;
      color: var(--muted);
      font-size: 13px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      padding: 20px 4px 0;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 980px) {
      .hero, .signup-card, .section-grid {
        grid-template-columns: 1fr;
      }
      .signup-copy {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .field-grid {
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
      <div class="nav-links">
        <a class="nav-link" href="/login">Sign In</a>
        <a class="nav-cta" href="#signup">Sign Up</a>
      </div>
    </header>

    <section class="hero">
      <article class="hero-copy">
        <div class="eyebrow">Inbox Intelligence</div>
        <h1>See how brands behave in the inbox before your customers do.</h1>
        <p>Inbox Journey turns live inboxes into a timeline of onboarding, recommendation, and re-engagement signals so teams can catch weak email experiences, compare brands, and improve conversion faster.</p>
        <div class="cta-row">
          <a class="hero-cta" href="#signup">Sign Up for Early Access</a>
          <a class="hero-secondary" href="/login">Open the Analysis App</a>
        </div>
        <div class="proof">
          <div class="proof-pill">Connect your own inbox first</div>
          <div class="proof-pill">Compare workspaces, inboxes, and brands</div>
          <div class="proof-pill">Track Gmail tab placement and timing</div>
        </div>
      </article>
      <aside class="hero-card">
        <div class="hero-metric-grid">
          <article class="metric">
            <div class="metric-label">Inbox Visibility</div>
            <div class="metric-value">Live</div>
            <div class="metric-copy">See welcome, verification, alert, and recommendation mail as it lands.</div>
          </article>
          <article class="metric">
            <div class="metric-label">Analysis</div>
            <div class="metric-value">Scored</div>
            <div class="metric-copy">Quality, relevance, timing, CTA friction, and tab placement in one workflow.</div>
          </article>
          <article class="metric">
            <div class="metric-label">Admin View</div>
            <div class="metric-value">Multi</div>
            <div class="metric-copy">Switch workspaces and inboxes without losing the thread of the timeline.</div>
          </article>
          <article class="metric">
            <div class="metric-label">Next Step</div>
            <div class="metric-value">Action</div>
            <div class="metric-copy">Generate improvements, CTR variants, and concrete next moves for each email.</div>
          </article>
        </div>
        <div class="story">
          <h2>Built for teams studying lifecycle email in the real world.</h2>
          <p>Start by connecting an inbox your team already owns. Later, scale into fully managed inbox identities per workspace, campaign, or experiment.</p>
        </div>
      </aside>
    </section>

    <section class="section-grid">
      <article class="section-card">
        <h3>Audit onboarding flows</h3>
        <p>Measure speed to first email, verification friction, welcome clarity, and whether the first-click path actually moves the user forward.</p>
      </article>
      <article class="section-card">
        <h3>Compare brands and inboxes</h3>
        <p>Run multiple brands through separate inboxes, then compare timing, quality, Gmail tab placement, and lifecycle pacing from one admin surface.</p>
      </article>
      <article class="section-card">
        <h3>Improve what converts</h3>
        <p>Turn every message into issues, recommendations, mock variants, and sharper CTA ideas instead of relying on intuition alone.</p>
      </article>
    </section>

    <section class="signup-card" id="signup">
      <div class="signup-copy">
        <div class="eyebrow">Sign Up</div>
        <h2>Start your first workspace.</h2>
        <p>Tell us who you are, the inbox you want to analyze, and what kind of email journey you want to study first.</p>
        <div class="signup-list">
          <div>Bring your own Gmail inbox today.</div>
          <div>Set up one workspace with one or more inboxes.</div>
          <div>Attach tests like Zillow New User or Redfin Follow-up.</div>
        </div>
      </div>
      <div class="signup-form-wrap">
        <h2>Create your request</h2>
        <p>This signup stores your request locally for now so we can turn the hosted flow on top of a real workspace model.</p>
        <form class="signup-form" id="signupForm">
          <div class="field-grid">
            <label>
              <span>Name</span>
              <input name="name" placeholder="Your name" required>
            </label>
            <label>
              <span>Email</span>
              <input name="email" type="email" placeholder="you@company.com" required>
            </label>
          </div>
          <div class="field-grid">
            <label>
              <span>Company</span>
              <input name="company" placeholder="Company or team">
            </label>
            <label>
              <span>Workspace Name</span>
              <input name="workspaceName" placeholder="Growth Email Lab">
            </label>
          </div>
          <label>
            <span>Use Case</span>
            <textarea name="useCase" placeholder="What brands or email journeys do you want to analyze?"></textarea>
          </label>
          <button class="signup-submit" type="submit">Sign Up</button>
          <div class="signup-status" id="signupStatus"></div>
        </form>
      </div>
    </section>

    <footer class="footer">
      <div>Inbox Journey helps teams analyze real email behavior across brands, workspaces, and inboxes.</div>
        <div><a href="/login">Open the app</a></div>
    </footer>
  </div>
  <script>
    const form = document.getElementById("signupForm");
    const status = document.getElementById("signupStatus");

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector("button[type='submit']");
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
      }
      status.textContent = "Saving your signup request...";

      try {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Signup failed");
        }

        form.reset();
        status.textContent = "You’re on the list. Open the app or keep expanding your workspace setup.";
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Signup failed";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Sign Up";
        }
      }
    });
  </script>
</body>
</html>`;
}
