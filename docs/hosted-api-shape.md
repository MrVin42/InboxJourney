# Hosted API Shape

This repo now exposes a first-pass hosted admin API surface from the local app server.

## Current endpoints

### `POST /api/auth/demo-signin`

Creates a local demo session for a configured workspace member email and sets a cookie-backed session.

### `POST /api/auth/signout`

Clears the current local auth session.

### `GET /api/auth/session`

Returns the current signed-in user and active workspace context, if any.

### `GET /api/hosted/admin/overview`

Returns a multi-tenant admin summary:

- accounts
- workspaces
- users
- workspace members
- inbox connections
- test definitions

### `GET /api/hosted/workspaces/:workspaceId`

Returns a single workspace view:

- account
- workspace
- members with embedded user records
- inbox connections with owner and attached tests

### `GET /api/hosted/workspaces/:workspaceId/inboxes/:inboxId`

Returns a single inbox connection view:

- account
- workspace
- inbox connection

### `POST /api/sync?workspace=:workspaceId&inbox=:inboxId`

Runs an inbox sync scoped to the selected workspace and optionally the selected inbox.

## Intended hosted evolution

The current API is a scaffold and should evolve toward:

- `POST /api/accounts`
- `POST /api/workspaces`
- `POST /api/workspaces/:workspaceId/inbox-connections`
- `POST /api/workspaces/:workspaceId/inbox-connections/:inboxId/tests`
- `POST /api/workspaces/:workspaceId/inbox-connections/:inboxId/sync`
- `GET /api/workspaces/:workspaceId/email-messages`
- `GET /api/workspaces/:workspaceId/email-messages/:emailId`
- `GET /api/workspaces/:workspaceId/reports/timeline`

## Current implementation note

Right now these endpoints are backed by the local workspace JSON config, a lightweight cookie session, and the live Gmail sync flow. The intended next step is to back them with Postgres plus a hosted auth provider such as Clerk.
