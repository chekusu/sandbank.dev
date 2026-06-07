CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  node_id TEXT NOT NULL DEFAULT 'tyo-1',
  server_name TEXT NOT NULL DEFAULT 'TYO-1',
  region TEXT NOT NULL DEFAULT 'Tokyo',
  country_code TEXT NOT NULL DEFAULT 'JP',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT DEFAULT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT DEFAULT NULL,
  revoked_at TEXT DEFAULT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES tenant_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_billing_accounts (
  tenant_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT DEFAULT NULL,
  stripe_payment_method_id TEXT DEFAULT NULL,
  card_brand TEXT DEFAULT NULL,
  card_last4 TEXT DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  auto_topup_enabled INTEGER NOT NULL DEFAULT 0,
  auto_topup_threshold_cents INTEGER NOT NULL DEFAULT 500,
  auto_topup_amount_cents INTEGER NOT NULL DEFAULT 2000,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_balance_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  box_id TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  stripe_payment_intent_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_projects_tenant_id ON tenant_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_project_id ON tenant_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_key_hash ON tenant_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_ledger_tenant_created ON tenant_balance_ledger(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_stripe_customer ON tenant_billing_accounts(stripe_customer_id);
