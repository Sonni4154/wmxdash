create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  org_id uuid not null,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists qbo_tokens (
  integration_id uuid primary key references integrations(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  realm_id text not null,
  version int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
