# Auth Integration Plan

Inbox Journey should separate three concerns clearly:

- user authentication
- account and workspace authorization
- inbox provider authorization

## Recommended hosted stack

- `Clerk` for authentication, sessions, invites, and organization switching
- `Postgres` for accounts, workspaces, inbox connections, tests, and analyses
- Gmail OAuth stored as a separate provider connection per inbox

## Mapping

- Clerk user -> Inbox Journey person
- Clerk organization -> Inbox Journey account or tenant
- Inbox Journey workspace -> scoped analysis surface inside an account
- Gmail OAuth connection -> proof that a workspace member can analyze a specific inbox

## Why keep auth and inbox access separate

User auth answers:

- who is signed in
- which account they belong to
- which workspaces they can access

Inbox OAuth answers:

- whether that workspace can read from a specific mailbox
- when the connection last synced
- whether reauthorization is needed

Those are different lifecycles and should not share the same tables or token model.

## Current local scaffold

The local app now includes:

- a cookie-based demo auth session
- a `/login` screen
- a protected `/app` shell
- workspace-aware active session context

This is intentionally provider-agnostic so the local flow can be replaced by Clerk later without rewriting the workspace and inbox domain model.

## Planned Clerk migration

1. Add Clerk middleware to the hosted app.
2. Replace local demo sign-in with Clerk sign-in and sign-up.
3. Persist Clerk `user.id` in a `auth_identities` table.
4. Map Clerk `organization.id` to `accounts.external_auth_org_id`.
5. Derive the active account from the active Clerk organization.
6. Authorize workspace access from local membership tables scoped to that account.
7. Keep Gmail OAuth connections under `inbox_connections`.

## Local route targets

- `/login`
- `/api/auth/demo-signin`
- `/api/auth/signout`
- `/api/auth/session`
- `/app`
- `/app/report`

## Hosted route targets

- `/sign-in`
- `/sign-up`
- `/app`
- `/api/me`
- `/api/accounts/:accountId/workspaces`
- `/api/workspaces/:workspaceId/inbox-connections`
- `/api/workspaces/:workspaceId/inbox-connections/:inboxId/connect`

## Guardrails

- never use Gmail OAuth identity as application sign-in
- never scope authorization by email domain alone
- always keep account membership checks server-side
- keep auth provider ids as references, not as the primary business model
