import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const env = {
  DEFAULT_NODE_ID: 'tyo-1',
  DEFAULT_NODE_ORIGIN: 'https://tyo-1.node.sandbank.dev',
  NODE_ORIGINS_JSON: JSON.stringify({
    'tyo-1': 'https://tyo-1.node.sandbank.dev',
    'tyo-2': 'https://tyo-2.node.sandbank.dev',
  }),
  SCHEDULER_ORIGIN: 'https://tyo-1.node.sandbank.dev/__scheduler',
}

type FakeD1Value = string | number | boolean | null

type FakeRow = Record<string, unknown>

class FakeD1 {
  tenants = new Map<string, FakeRow>()
  projects = new Map<string, FakeRow>()
  apiKeys = new Map<string, FakeRow>()
  billing = new Map<string, FakeRow>()
  ledger = new Map<string, FakeRow>()

  prepare(query: string) {
    return new FakeD1Statement(this, query)
  }

  async batch(statements: FakeD1Statement[]) {
    return Promise.all(statements.map((statement) => statement.run()))
  }
}

class FakeD1Statement {
  private values: FakeD1Value[] = []

  constructor(
    private readonly db: FakeD1,
    private readonly query: string,
  ) {}

  bind(...values: FakeD1Value[]) {
    this.values = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    const query = normalizeSql(this.query)

    if (query.includes('from tenant_api_keys') && query.includes('where key_hash')) {
      const keyHash = this.values[0]
      return (Array.from(this.db.apiKeys.values()).find((row) => (
        row.key_hash === keyHash && !row.revoked_at
      )) ?? null) as T | null
    }

    if (query.includes('from tenant_projects') && query.includes('where tenant_id')) {
      const tenantId = this.values[0]
      const projects = Array.from(this.db.projects.values())
        .filter((row) => row.tenant_id === tenantId)
        .sort((a, b) => String(a.slug === 'default' ? '0' : '1').localeCompare(String(b.slug === 'default' ? '0' : '1')))
      return (projects[0] ?? null) as T | null
    }

    if (query.includes('from tenant_balance_ledger') && query.includes('where id')) {
      return (this.db.ledger.get(String(this.values[0])) ?? null) as T | null
    }

    if (query.includes('from tenant_billing_accounts')) {
      return (this.db.billing.get(String(this.values[0])) ?? null) as T | null
    }

    throw new Error(`Unhandled first query: ${this.query}`)
  }

  async run() {
    const query = normalizeSql(this.query)

    if (query.startsWith('insert into tenants')) {
      const [id, name, slug, ownerUserId, createdAt, updatedAt] = this.values
      this.db.tenants.set(String(id), {
        ...(this.db.tenants.get(String(id)) ?? {}),
        id,
        name,
        slug,
        owner_user_id: ownerUserId,
        created_at: createdAt || new Date(0).toISOString(),
        updated_at: updatedAt || new Date(0).toISOString(),
      })
      return { success: true, results: [] }
    }

    if (query.startsWith('insert into tenant_projects')) {
      const [id, tenantId, name, slug, nodeId, serverName, region, countryCode, createdAt, updatedAt] = this.values
      this.db.projects.set(String(id), {
        ...(this.db.projects.get(String(id)) ?? {}),
        id,
        tenant_id: tenantId,
        name,
        slug,
        node_id: nodeId,
        server_name: serverName,
        region,
        country_code: countryCode,
        created_at: createdAt || new Date(0).toISOString(),
        updated_at: updatedAt || new Date(0).toISOString(),
      })
      return { success: true, results: [] }
    }

    if (query.startsWith('insert into tenant_api_keys')) {
      const [id, tenantId, projectId, keyHash, prefix, name, createdAt, lastUsedAt, revokedAt] = this.values
      this.db.apiKeys.set(String(id), {
        ...(this.db.apiKeys.get(String(id)) ?? {}),
        id,
        tenant_id: tenantId,
        project_id: projectId,
        key_hash: keyHash,
        prefix,
        name,
        created_at: createdAt || new Date(0).toISOString(),
        last_used_at: lastUsedAt,
        revoked_at: revokedAt,
      })
      return { success: true, results: [] }
    }

    if (query.startsWith('insert into tenant_billing_accounts')) {
      const [
        tenantId,
        stripeCustomerId,
        stripePaymentMethodId,
        cardBrand,
        cardLast4,
        currency,
        balanceCents,
        autoTopupEnabled,
        autoTopupThresholdCents,
        autoTopupAmountCents,
        createdAt,
        updatedAt,
      ] = this.values
      this.db.billing.set(String(tenantId), {
        ...(this.db.billing.get(String(tenantId)) ?? {}),
        tenant_id: tenantId,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_method_id: stripePaymentMethodId,
        card_brand: cardBrand,
        card_last4: cardLast4,
        currency,
        balance_cents: balanceCents,
        auto_topup_enabled: autoTopupEnabled,
        auto_topup_threshold_cents: autoTopupThresholdCents,
        auto_topup_amount_cents: autoTopupAmountCents,
        created_at: createdAt || new Date(0).toISOString(),
        updated_at: updatedAt || new Date(0).toISOString(),
      })
      return { success: true, results: [] }
    }

    if (query.startsWith('insert into tenant_balance_ledger')) {
      const [id, tenantId, kindOrAmount, amountOrBalance, balanceOrBox, boxOrDescription, descriptionOrPaymentIntent, maybePaymentIntent, maybeCreatedAt] = this.values
      const row = query.includes("values (?, ?, 'debit'")
        ? {
            id,
            tenant_id: tenantId,
            kind: 'debit',
            amount_cents: kindOrAmount,
            balance_after_cents: amountOrBalance,
            box_id: balanceOrBox,
            description: boxOrDescription,
            stripe_payment_intent_id: null,
            created_at: new Date(0).toISOString(),
          }
        : {
            id,
            tenant_id: tenantId,
            kind: kindOrAmount,
            amount_cents: amountOrBalance,
            balance_after_cents: balanceOrBox,
            box_id: boxOrDescription,
            description: descriptionOrPaymentIntent,
            stripe_payment_intent_id: maybePaymentIntent,
            created_at: maybeCreatedAt || new Date(0).toISOString(),
          }
      this.db.ledger.set(String(id), row)
      return { success: true, results: [] }
    }

    if (query.startsWith('update tenant_api_keys')) {
      const projectId = query.includes('set project_id') ? this.values[0] : undefined
      const id = String(query.includes('set project_id') ? this.values[1] : this.values[0])
      const row = this.db.apiKeys.get(id)
      if (row) {
        if (projectId !== undefined) row.project_id = projectId
        row.last_used_at = new Date(0).toISOString()
      }
      return { success: true, results: [] }
    }

    if (query.startsWith('update tenant_billing_accounts')) {
      const [debit, tenantId, requiredBalance] = this.values
      const row = this.db.billing.get(String(tenantId))
      if (row && Number(row.balance_cents) >= Number(requiredBalance)) {
        row.balance_cents = Number(row.balance_cents) - Number(debit)
        row.updated_at = new Date(0).toISOString()
        return { success: true, results: [], meta: { changes: 1 } }
      }
      return { success: true, results: [], meta: { changes: 0 } }
    }

    throw new Error(`Unhandled run query: ${this.query}`)
  }

  async all<T = unknown>() {
    const query = normalizeSql(this.query)
    if (query.includes('from tenant_balance_ledger') && query.includes('where tenant_id')) {
      const tenantId = this.values[0]
      const limit = Number(this.values[1])
      return {
        success: true,
        results: Array.from(this.db.ledger.values())
          .filter((row) => row.tenant_id === tenantId)
          .slice(0, limit) as T[],
      }
    }
    throw new Error(`Unhandled all query: ${this.query}`)
  }
}

function normalizeSql(query: string): string {
  return query.replace(/\s+/g, ' ').trim().toLowerCase()
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('sandbank api worker routing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports configured nodes and scheduler target', async () => {
    const res = await worker.fetch(new Request('https://api.sandbank.dev/__worker/health'), env)
    expect(res.status).toBe(200)
    const body = await res.json() as {
      node_count: number
      proxy_target_id: string
      scheduler_origin: string
      nodes: Array<{ id: string }>
    }
    expect(body.node_count).toBe(2)
    expect(body.proxy_target_id).toBe('tyo-1')
    expect(body.scheduler_origin).toBe('https://tyo-1.node.sandbank.dev/__scheduler')
    expect(body.nodes.map((node) => node.id)).toEqual(['tyo-1', 'tyo-2'])
  })

  it('routes box control API through the scheduler path prefix', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'box-1', status: 'running' }),
      {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'x-sandbank-node-id': 'tyo-2',
        },
      },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/v1/boxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'codebox' }),
    }), env)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-1.node.sandbank.dev/__scheduler/v1/boxes')
    expect(upstream.headers.get('x-sandbank-api-worker')).toBe('1')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('scheduler')
    expect(res.headers.get('x-sandbank-api-target-kind')).toBe('scheduler')
    expect(res.headers.get('x-sandbank-node-id')).toBe('tyo-2')
    expect(await res.json()).toMatchObject({ id: 'box-1' })
  })

  it('keeps non-box API calls on the selected node', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/health'), env)

    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-1.node.sandbank.dev/health')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('tyo-1')
    expect(res.headers.get('x-sandbank-api-target-kind')).toBe('node')
  })

  it('lets explicit node overrides bypass the scheduler', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'box-2', status: 'running' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/v1/boxes?node_id=tyo-2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'codebox' }),
    }), env)

    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-2.node.sandbank.dev/v1/boxes?node_id=tyo-2')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('tyo-2')
    expect(res.headers.get('x-sandbank-node-id')).toBe('tyo-2')
  })

  it('handles tenant authority sync, auth resolution, and idempotent billing debit', async () => {
    const tenantDb = new FakeD1()
    const authorityEnv = {
      ...env,
      TENANT_AUTHORITY_TOKEN: 'test-authority-token',
      TENANT_DB: tenantDb,
    }
    const apiKey = 'sb_test_key'

    const denied = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/resolve-api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    }), authorityEnv)
    expect(denied.status).toBe(401)

    const sync = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/sync', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenants: [{
          id: 'tenant-1',
          name: 'Tenant One',
          slug: 'tenant-one',
          owner_user_id: 'user-1',
        }],
        projects: [{
          id: 'project-1',
          tenant_id: 'tenant-1',
          name: 'Default',
          slug: 'default',
        }],
        api_keys: [{
          id: 'key-1',
          tenant_id: 'tenant-1',
          project_id: 'project-1',
          key_hash: await sha256Hex(apiKey),
          prefix: 'sb_test',
          name: 'Test key',
        }],
        billing_accounts: [{
          tenant_id: 'tenant-1',
          currency: 'usd',
          balance_cents: 100,
        }],
      }),
    }), authorityEnv)
    expect(sync.status).toBe(200)
    expect(await sync.json()).toMatchObject({ ok: true, synced: 4 })

    const resolved = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/resolve-api-key', {
      method: 'POST',
      headers: {
        'x-sandbank-scheduler-token': 'test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey }),
    }), authorityEnv)
    expect(resolved.status).toBe(200)
    expect(await resolved.json()).toMatchObject({
      tenant_id: 'tenant-1',
      project_id: 'project-1',
      key_id: 'key-1',
    })

    const ensured = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/billing/ensure', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tenant_id: 'tenant-1', required_cents: 7 }),
    }), authorityEnv)
    expect(ensured.status).toBe(200)
    expect(await ensured.json()).toMatchObject({ ok: true })

    const debit = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/billing/debit', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ledger_id: 'ledger-1',
        tenant_id: 'tenant-1',
        amount_cents: 7,
        box_id: 'box-1',
        description: 'test debit',
      }),
    }), authorityEnv)
    expect(debit.status).toBe(200)
    expect(await debit.json()).toMatchObject({ ok: true, ledger_id: 'ledger-1', balance_cents: 93 })

    const duplicateDebit = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/billing/debit', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ledger_id: 'ledger-1',
        tenant_id: 'tenant-1',
        amount_cents: 7,
      }),
    }), authorityEnv)
    expect(duplicateDebit.status).toBe(200)
    expect(await duplicateDebit.json()).toMatchObject({ ok: true, ledger_id: 'ledger-1', duplicate: true })

    const billing = await worker.fetch(new Request('https://api.sandbank.dev/internal/tenant/billing/read', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-authority-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tenant_id: 'tenant-1', ledger_limit: 10 }),
    }), authorityEnv)
    expect(billing.status).toBe(200)
    expect(await billing.json()).toMatchObject({
      billing: { tenant_id: 'tenant-1', balance_cents: 93 },
      ledger: [{ id: 'ledger-1', amount_cents: -7 }],
    })
  })
})
