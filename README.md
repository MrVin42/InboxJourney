# Inbox Journey

Inbox Journey is a lifecycle email analysis tool for teams that want to understand what happens after a user signs up for a product.

It helps you:

- connect one or more inboxes to a workspace
- monitor onboarding and follow-up emails from brands like Zillow and Redfin
- analyze timing, quality, personalization, Gmail tab placement, and click-through opportunities
- review emails in a visual timeline with previews and screenshots
- compare brands, inboxes, and tests from an admin view

## Current Status

This repo is a working local MVP with:

- Gmail-powered inbox syncing
- workspace and inbox configuration
- a hosted-style marketing homepage and authenticated app shell
- timeline reporting with screenshots and analysis
- docs for the future hosted multi-tenant version

The current app is best thought of as a strong prototype and internal tool, not a finished hosted SaaS yet.

## What The App Does

Inbox Journey combines four core jobs:

1. identity management for experiment email addresses
2. inbox syncing and parsing
3. scoring and recommendations for each email
4. a visual workspace timeline for review

The first scenario pack is focused on real estate lifecycle emails, with Zillow as the original use case and Redfin now included in live analysis flows.

## Quick Start

### 1. Install dependencies

```powershell
npm.cmd install
```

### 2. Create local config

Use the provided examples as the starting point:

- `.env.example`
- `data/inbox-journey.workspace.example.json`

Your real local inbox config is intentionally ignored by git.

### 3. Authenticate Gmail

```powershell
npm.cmd run gmail:labels
```

That will walk through the Gmail OAuth flow for the configured inbox.

### 4. Start the app

```powershell
npm.cmd run app:open
```

That launcher will:

- restart the local server
- wait until the app responds
- open the browser to the sign-in page

You can also run the server manually:

```powershell
npm.cmd run app:serve
```

## Core Commands

```powershell
npm.cmd run app:open
npm.cmd run app:serve
npm.cmd run gmail:labels
npm.cmd run gmail:pull
npm.cmd run gmail:analyze
npm.cmd run gmail:report
npm.cmd run check
```

## Workspace Model

Inbox Journey currently supports:

- multiple users per workspace
- multiple inboxes per workspace
- inbox-scoped tests
- brand comparison across a shared timeline

The local JSON workspace config lets each user bring their own inbox while keeping tests and analysis grouped under one workspace.

## Project Layout

- `src/app/` local web app, auth shell, homepage, and sync server
- `src/mail/` Gmail auth and inbox ingestion
- `src/analyzers/` email scoring and recommendation logic
- `src/report/` timeline report generation and screenshot handling
- `src/hosted/` hosted multi-tenant domain models and local auth scaffolding
- `src/scenarios/` site-specific scenario packs
- `docs/` architecture, auth, schema, and hosted roadmap notes
- `data/` example workspace config and local runtime JSON data

## Hosted Direction

The intended hosted version of Inbox Journey looks like this:

- users sign into a web app
- each account can own multiple workspaces
- each workspace can connect one or more inboxes
- inbox connections remain separate from product auth
- analyses, screenshots, and metrics are stored centrally

Recommended docs for that next phase:

- [web-hosted-architecture](docs/web-hosted-architecture.md)
- [auth-integration-plan](docs/auth-integration-plan.md)
- [hosted-schema](docs/hosted-schema.sql)
- [hosted-api-shape](docs/hosted-api-shape.md)

## Notes About Git

This repo ignores:

- live credentials
- local Gmail auth tokens
- generated reports and screenshots
- local workspace config
- local signup and session data

That keeps the public repo safe while still letting the app run locally with private configuration.

## Next Steps

Natural next improvements are:

1. move workspace and auth data into Postgres
2. replace local auth with Clerk-backed auth
3. add hosted deployment for the app shell and marketing site
4. add Playwright-based site automation for scenario generation
