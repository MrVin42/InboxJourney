# Inbox Journey Web-Hosted Architecture

## Goal

Turn Inbox Journey from a local report generator into a hosted multi-tenant product where each customer can:

- create one or more workspaces
- connect one or more inboxes they already own
- assign tests and scenarios to those inboxes
- sync and analyze email streams in a shared web app
- let admins switch across customer workspaces and inboxes safely

The first hosted version should assume:

- users provide and manage their own inboxes
- Inbox Journey does not provision mailboxes yet
- Gmail is the first-class inbox connection
- additional providers can be added later

## Product Model

### Tenant hierarchy

1. `account`
   - billing and top-level organization
2. `workspace`
   - analysis boundary for a team, brand family, or experiment set
3. `user`
   - human member of the account
4. `inbox_connection`
   - a user-owned inbox connected to a workspace
5. `test_definition`
   - alias patterns and scenario metadata attached to an inbox
6. `sync_run`
   - one inbox poll / import job
7. `email_event`
   - normalized inbound email
8. `analysis_result`
   - scores, issues, suggestions, variants, screenshots

### Recommended permissions

- `account_admin`
  - can create workspaces, invite users, connect inboxes, and view every workspace
- `workspace_admin`
  - can manage inboxes and tests inside a workspace
- `analyst`
  - can view results and run syncs
- `viewer`
  - read-only access

## Hosted MVP

### What to build first

- hosted web app with login
- account + workspace creation
- Gmail OAuth connection flow per inbox
- inbox/test configuration UI
- sync button per inbox and per workspace
- admin view for switching workspace and inbox context
- persisted reports instead of regenerated static-only reports

### What to defer

- automatic mailbox provisioning
- outbound email sending
- fully automated site-interaction agents
- non-Gmail providers until the inbox model is stable

## Recommended stack

### App

- `Next.js` or `Remix`
- server-rendered dashboard pages plus API routes
- background jobs for inbox sync and screenshot rendering

### Data

- `Postgres`
- object storage for HTML snapshots and screenshots
- queue for sync and rendering jobs

### Auth

- hosted auth provider such as Clerk, Auth0, or NextAuth-compatible identity
- Gmail OAuth per inbox connection

### Jobs

- queue-backed workers for:
  - Gmail polling
  - analysis
  - screenshot generation
  - recurring sync schedules

## Inbox connection strategy

### Phase 1: user-owned inboxes

Each user connects an inbox they already control.

Recommended first provider:

- Gmail via OAuth with `gmail.readonly`

Connection record should store:

- provider
- provider account email
- refresh token or provider-managed token reference
- workspace id
- owner user id
- sync settings
- last sync state

Benefits:

- fast to ship
- low infrastructure complexity
- no mailbox lifecycle management

Tradeoffs:

- user onboarding depends on external inbox setup
- aliases and forwarding still need to be configured by the customer

### Phase 2: managed custom inboxes

Later, Inbox Journey can provision mailbox identities per workspace or per test run.

Recommended path:

- dedicated domain pool under Inbox Journey control
- automatic alias generation per workspace/test/run
- inbound processing via webhook or email routing provider
- optional forwarding copies to a customer inbox

Good providers to evaluate later:

- Cloudflare Email Routing + Email Workers
- Mailgun routes
- SendGrid inbound parse
- Postmark inbound
- AWS SES inbound

## Data model sketch

### Core tables

- `accounts`
- `account_users`
- `workspaces`
- `workspace_members`
- `inbox_connections`
- `test_definitions`
- `sync_runs`
- `email_messages`
- `email_analysis`
- `email_assets`
- `site_runs`
- `site_actions`

### Important columns

`inbox_connections`

- `id`
- `workspace_id`
- `owner_user_id`
- `provider`
- `provider_email`
- `status`
- `oauth_scopes`
- `last_synced_at`

`test_definitions`

- `id`
- `inbox_connection_id`
- `label`
- `description`
- `alias_prefixes`
- `alias_includes`

`email_messages`

- `id`
- `workspace_id`
- `inbox_connection_id`
- `test_definition_id`
- `provider_message_id`
- `received_at`
- `from_address`
- `to_alias`
- `gmail_tab`
- `gmail_label_ids`
- `subject`
- `html_storage_key`
- `text_storage_key`

## Admin view behavior

The hosted admin view should support:

- switching account
- switching workspace
- switching inbox
- seeing connection health
- seeing last sync time
- re-running sync
- viewing configured tests attached to the active inbox

Recommended layout:

- top global workspace switcher
- left rail inbox switcher
- center timeline and report
- right panel selected message detail

## Suggested delivery phases

### Phase 1

- move config from JSON files into Postgres
- add hosted auth
- add Gmail inbox connection flow
- persist email imports and analyses
- basic admin dashboard

### Phase 2

- recurring sync schedules
- workspace invitations and RBAC
- comparison views across inboxes and brands
- webhook/event-driven ingestion where possible

### Phase 3

- managed inbox provisioning
- agent-driven site interaction
- benchmark datasets and account-level reporting

## Recommendation

For now, build the hosted product around `user-managed inbox connections`.

That gives you:

- the cleanest legal and operational boundary
- the fastest path to multi-tenant value
- a scalable architecture that can later absorb Inbox Journey-managed inboxes without a rewrite

The right sequence is:

1. hosted auth + workspace model
2. Gmail connection per inbox
3. persisted analysis and admin switching
4. scheduled syncs
5. managed inbox provisioning later
