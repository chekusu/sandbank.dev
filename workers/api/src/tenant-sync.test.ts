import { describe, expect, it } from 'vitest'
import worker from './index'

type SqlValue = string | number | null

// The worker tsconfig only has Workers types, so load the Node built-ins this
// test needs untyped and describe the small part of node:sqlite it uses.
interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): {
    run(...values: SqlValue[]): { changes: number | bigint }
    get(...values: SqlValue[]): unknown
    all(...values: SqlValue[]): unknown[]
  }
}
const { DatabaseSync } = await import('node:sqlite' as string) as { DatabaseSync: new (path: string) => SqliteDatabase }
const { readFileSync } = await import('node:fs' as string) as { readFileSync(path: URL, encoding: 'utf8'): string }

/** D1 stand-in over real SQLite, so the sync SQL is exercised as written. */
class SqliteD1 {
  constructor(readonly sqlite: SqliteDatabase) {}

  prepare(sql: string) {
    return new SqliteStatement(this.sqlite, sql)
  }

  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec('BEGIN')
    try {
      const results = statements.map((statement) => statement.runNow())
      this.sqlite.exec('COMMIT')
      return results
    } catch (err) {
      this.sqlite.exec('ROLLBACK')
      throw err
    }
  }
}

class SqliteStatement {
  private values: SqlValue[] = []

  constructor(private readonly sqlite: SqliteDatabase, private readonly sql: string) {}

  bind(...values: SqlValue[]) {
    this.values = values
    return this
  }

  runNow() {
    const result = this.sqlite.prepare(this.sql).run(...this.values)
    return { success: true, results: [], meta: { changes: Number(result.changes) } }
  }

  async run() {
    return this.runNow()
  }

  async first<T = unknown>(): Promise<T | null> {
    return (this.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null
  }

  async all<T = unknown>() {
    return { success: true, results: this.sqlite.prepare(this.sql).all(...this.values) as T[] }
  }
}

function authorityEnv() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../migrations/0001_tenant_authority.sql', import.meta.url), 'utf8'))
  return {
    sqlite,
    env: {
      DEFAULT_NODE_ID: 'tyo-1',
      DEFAULT_NODE_ORIGIN: 'https://tyo-1.node.sandbank.dev',
      TENANT_AUTHORITY_TOKEN: 'test-authority-token',
      TENANT_DB: new SqliteD1(sqlite),
    },
  }
}

async function post(env: Record<string, unknown>, path: string, body: Record<string, unknown>) {
  const res = await worker.fetch(new Request(`https://api.sandbank.dev${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-authority-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), env as never)
  return { status: res.status, body: await res.json() as Record<string, unknown> }
}

const tenant = { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', owner_user_id: 'user-1' }

function balanceOf(sqlite: SqliteDatabase): number {
  return Number((sqlite.prepare('SELECT balance_cents FROM tenant_billing_accounts WHERE tenant_id = ?').get('tenant-1') as { balance_cents: number }).balance_cents)
}

describe('tenant authority sync billing', () => {
  it('keeps the authority balance when a node later syncs a stale one', async () => {
    const { sqlite, env } = authorityEnv()
    await post(env, '/internal/tenant/sync', { tenants: [tenant], billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 1000 }] })
    await post(env, '/internal/tenant/billing/debit', { ledger_id: 'debit-1', tenant_id: 'tenant-1', amount_cents: 36 })
    expect(balanceOf(sqlite)).toBe(964)

    const resync = await post(env, '/internal/tenant/sync', {
      tenants: [tenant],
      billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 0, auto_topup_enabled: 1, updated_at: '2026-11-02 18:16:48' }],
    })
    expect(resync.status).toBe(200)
    expect(balanceOf(sqlite)).toBe(964)
    const account = sqlite.prepare('SELECT auto_topup_enabled, updated_at FROM tenant_billing_accounts WHERE tenant_id = ?').get('tenant-1') as Record<string, unknown>
    expect(account.auto_topup_enabled).toBe(1)
    expect(account.updated_at).not.toBe('2026-11-02 18:16:48')
  })

  it('applies a top-up recorded on the node exactly once', async () => {
    const { sqlite, env } = authorityEnv()
    await post(env, '/internal/tenant/sync', { tenants: [tenant], billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 964 }] })
    const topup = { id: 'topup-1', tenant_id: 'tenant-1', kind: 'credit', amount_cents: 2000, balance_after_cents: 2000, description: 'balance top up' }

    await post(env, '/internal/tenant/sync', { tenants: [tenant], billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 2000 }], ledger: [topup] })
    await post(env, '/internal/tenant/sync', { tenants: [tenant], billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 2000 }], ledger: [topup] })

    expect(balanceOf(sqlite)).toBe(2964)
    const row = sqlite.prepare('SELECT amount_cents, balance_after_cents FROM tenant_balance_ledger WHERE id = ?').get('topup-1') as Record<string, unknown>
    expect(row).toEqual({ amount_cents: 2000, balance_after_cents: 2964 })
  })

  it('leaves ledger rows the authority already has untouched', async () => {
    const { sqlite, env } = authorityEnv()
    await post(env, '/internal/tenant/sync', { tenants: [tenant], billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 100 }] })
    await post(env, '/internal/tenant/billing/debit', { ledger_id: 'debit-1', tenant_id: 'tenant-1', amount_cents: 7 })

    await post(env, '/internal/tenant/sync', {
      tenants: [tenant],
      ledger: [{ id: 'debit-1', tenant_id: 'tenant-1', kind: 'debit', amount_cents: -7, balance_after_cents: -7 }],
    })
    expect(balanceOf(sqlite)).toBe(93)
    expect((sqlite.prepare('SELECT balance_after_cents FROM tenant_balance_ledger WHERE id = ?').get('debit-1') as Record<string, unknown>).balance_after_cents).toBe(93)
  })

  it("takes a new account's balance and history as they are", async () => {
    const { sqlite, env } = authorityEnv()
    await post(env, '/internal/tenant/sync', {
      tenants: [tenant],
      billing_accounts: [{ tenant_id: 'tenant-1', balance_cents: 500 }],
      ledger: [{ id: 'topup-1', tenant_id: 'tenant-1', kind: 'credit', amount_cents: 500, balance_after_cents: 500 }],
    })
    expect(balanceOf(sqlite)).toBe(500)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM tenant_balance_ledger').get()).toEqual({ n: 1 })
  })
})
