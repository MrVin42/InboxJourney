create table accounts (
  id text primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id text primary key,
  email text,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table auth_identities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null check (provider in ('clerk')),
  provider_user_id text not null,
  provider_org_id text,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id),
  unique (provider, provider_org_id, user_id)
);

create table account_users (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('account_admin', 'workspace_admin', 'analyst', 'viewer')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table account_invitations (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  email text not null,
  role text not null check (role in ('account_admin', 'workspace_admin', 'analyst', 'viewer')),
  invited_by_user_id text references users(id) on delete set null,
  provider_invitation_id text,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table workspaces (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (account_id, slug)
);

create table workspace_members (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('account_admin', 'workspace_admin', 'analyst', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table inbox_connections (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text not null references users(id) on delete restrict,
  label text not null,
  provider text not null check (provider in ('gmail')),
  provider_email text not null,
  email_domain text not null,
  status text not null check (status in ('connected', 'attention-needed', 'disconnected')),
  oauth_scopes jsonb not null default '[]'::jsonb,
  encrypted_refresh_token text,
  provider_metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table test_definitions (
  id text primary key,
  inbox_connection_id text not null references inbox_connections(id) on delete cascade,
  label text not null,
  description text,
  alias_prefixes jsonb not null default '[]'::jsonb,
  alias_includes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table site_runs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  inbox_connection_id text references inbox_connections(id) on delete set null,
  test_definition_id text references test_definitions(id) on delete set null,
  site text not null,
  scenario_key text not null,
  run_id text not null,
  status text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table site_actions (
  id text primary key,
  site_run_id text not null references site_runs(id) on delete cascade,
  action_type text not null,
  occurred_at timestamptz not null,
  details jsonb not null default '{}'::jsonb
);

create table sync_runs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  inbox_connection_id text not null references inbox_connections(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  pulled_count integer not null default 0,
  analyzed_count integer not null default 0,
  error_message text
);

create table email_messages (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  inbox_connection_id text not null references inbox_connections(id) on delete cascade,
  sync_run_id text references sync_runs(id) on delete set null,
  test_definition_id text references test_definitions(id) on delete set null,
  site_run_id text references site_runs(id) on delete set null,
  provider_message_id text not null,
  provider_thread_id text,
  message_id_header text,
  from_address text not null,
  to_alias text not null,
  delivered_to text,
  subject text not null,
  received_at timestamptz not null,
  category text not null,
  gmail_tab text,
  gmail_label_ids jsonb not null default '[]'::jsonb,
  html_storage_key text,
  text_storage_key text,
  snippet text,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (inbox_connection_id, provider_message_id)
);

create table email_analysis (
  id text primary key,
  email_message_id text not null references email_messages(id) on delete cascade,
  relevance_score integer not null,
  quality_score integer not null,
  metrics jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (email_message_id)
);

create table email_assets (
  id text primary key,
  email_message_id text not null references email_messages(id) on delete cascade,
  asset_type text not null check (asset_type in ('html_preview', 'screenshot')),
  storage_key text not null,
  created_at timestamptz not null default now()
);

create index idx_workspaces_account_id on workspaces(account_id);
create index idx_auth_identities_user_id on auth_identities(user_id);
create index idx_workspace_members_workspace_id on workspace_members(workspace_id);
create index idx_inbox_connections_workspace_id on inbox_connections(workspace_id);
create index idx_test_definitions_inbox_connection_id on test_definitions(inbox_connection_id);
create index idx_sync_runs_inbox_connection_id on sync_runs(inbox_connection_id);
create index idx_email_messages_inbox_connection_id on email_messages(inbox_connection_id);
create index idx_email_messages_received_at on email_messages(received_at desc);
create index idx_site_runs_workspace_id on site_runs(workspace_id);
