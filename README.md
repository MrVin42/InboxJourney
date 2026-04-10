# Email Experiment Platform

This repo is a Zillow-first MVP for a system that:

- creates or manages experiment identities
- supports multiple users and multiple configured inboxes per workspace
- signs up for a site and performs scripted activity
- ingests the follow-up emails
- analyzes quality, relevance, cadence, and issues
- produces metrics and improvement suggestions

## Recommended Identity Strategy

The most durable approach is a custom domain with catch-all routing. That lets us generate a unique address per site, scenario, and run, for example:

`zillow.saved-search.r001@signals.example.com`

Why this is the best long-term option:

- each scenario gets an isolated inbox identity
- signup verification emails can be correlated to a specific run
- raw MIME, links, and headers can be stored without mixing with personal mail
- a copy can still be forwarded to Gmail for manual review

Fallback options:

- Gmail plus addressing for quick prototyping
- a dedicated Gmail mailbox for early manual testing

## Zillow MVP Scope

The first scenario pack is intentionally narrow and reproducible:

1. create an account
2. search a metro area with explicit filters
3. view a handful of listings
4. save some homes
5. save a search
6. wait for resulting emails and analyze them

We should avoid flows that contact real agents or create noisy marketplace behavior unless we have an explicit testing policy for that.

## Project Layout

- `docs/` architecture and MVP notes
- `docs/web-hosted-architecture.md` hosted multi-tenant product plan
- `docs/auth-integration-plan.md` auth and account model plan
- `docs/hosted-api-shape.md` hosted admin and workspace API contract
- `docs/hosted-schema.sql` first-pass hosted Postgres schema
- `data/inbox-journey.workspace.example.json` example multi-user workspace config
- `data/inbox-journey.workspace.json` real local admin workspace config
- `src/identity/` address generation and identity policy
- `src/domain/` shared entities and metrics
- `src/scenarios/` website-specific scenario packs
- `src/analyzers/` heuristic analysis and suggestions
- `src/index.ts` sample assembly entrypoint

## Multi-User Inbox Setup

Inbox Journey can now run in two modes:

- environment fallback mode:
  - uses the existing `.env` values for one default inbox
- workspace config mode:
  - uses a JSON file that defines users, inboxes, and inbox-scoped tests

To enable workspace config mode:

1. copy `data/inbox-journey.workspace.example.json` to `data/inbox-journey.workspace.json`
2. update each user entry
3. update each inbox entry with:
   - the owner `userId`
   - the forwarded Gmail inbox
   - the Gmail OAuth client JSON path for that inbox
   - the email domain used for alias correlation
4. optionally define tests using:
   - `aliasPrefixes`
   - `aliasIncludes`
5. run commands as usual, or target a specific inbox:

```powershell
npm.cmd run gmail:report -- --user alex --inbox alex-gmail
npm.cmd run gmail:analyze -- --test zillow-new-user
```

Notes:

- each configured inbox uses its own persisted Gmail OAuth token
- users provide and own their own inbox connection
- tests are attached to inboxes so separate users can run different experiment sets

## Hosted Direction

The repo now also includes a hosted-product architecture plan in:

- `docs/web-hosted-architecture.md`

Recommended first hosted version:

- users sign into a web app
- each account can create multiple workspaces
- each workspace can connect one or more user-owned inboxes
- Gmail is the first inbox provider
- Inbox Journey stores syncs, analyses, screenshots, and metrics centrally
- the admin view can switch between workspace and inbox context

Current local hosted-style routes:

- `/` marketing homepage with signup CTA
- `/login` auth entrypoint for the protected app shell
- `/app` analysis dashboard
- `/app/report` raw report route used by the authenticated shell
- `/api/auth/demo-signin` local auth session creation
- `/api/auth/session` current local session
- `/api/signup` local signup capture
- `/api/hosted/admin/overview` hosted admin summary

## Local App Startup

The easiest way to open the app locally is:

```powershell
npm.cmd run app:open
```

That launcher will:

- start the local server in a dedicated PowerShell window if it is not already running
- wait for the app to respond
- open the browser to `/login`

If you want the old manual flow, this still works:

```powershell
npm.cmd run app:serve
```

Recommended later version:

- Inbox Journey provisions managed custom inboxes per workspace or test

## Next Build Steps

1. wire a real mail source:
   - inbound provider webhook, or
   - Gmail API polling for a dedicated mailbox
2. add Playwright automation for Zillow account creation and browsing
3. persist runs, actions, emails, and analysis in Postgres
4. add HTML snapshotting and CTA validation
