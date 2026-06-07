import { verifyToken } from '@clerk/backend'

interface Env {
  CLERK_AUTHORIZED_PARTIES?: string
  CLERK_JWT_KEY?: string
  CLERK_SECRET_KEY?: string
  DEFAULT_NODE_ID?: string
  DEFAULT_NODE_ORIGIN?: string
  FALLBACK_NODE_ORIGIN?: string
  NODE_ORIGINS_JSON?: string
  PANEL_AUTH_FORWARDING_SECRET?: string
  SCHEDULER_ORIGIN?: string
  TENANT_AUTHORITY_TOKEN?: string
  TENANT_DB?: D1Database
}

type NodeTarget = {
  id: string
  origin: string
  kind?: 'node' | 'scheduler'
}

type PanelAuth = {
  userId: string
  email: string | null
}

type D1Value = string | number | boolean | null

type D1Result<T = unknown> = {
  results?: T[]
  success: boolean
  error?: string
  meta?: {
    changes?: number
  }
}

type D1PreparedStatement = {
  bind(...values: D1Value[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
}

type D1Database = {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

type TenantRow = {
  id: string
  name: string
  slug: string
  owner_user_id: string
  created_at?: string | null
  updated_at?: string | null
}

type TenantProjectRow = {
  id: string
  tenant_id: string
  name: string
  slug: string
  node_id?: string | null
  server_name?: string | null
  region?: string | null
  country_code?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type TenantApiKeyRow = {
  id: string
  tenant_id: string
  project_id?: string | null
  key_hash: string
  prefix: string
  name: string
  created_at?: string | null
  last_used_at?: string | null
  revoked_at?: string | null
}

type TenantBillingAccountRow = {
  tenant_id: string
  stripe_customer_id?: string | null
  stripe_payment_method_id?: string | null
  card_brand?: string | null
  card_last4?: string | null
  currency?: string | null
  balance_cents: number
  auto_topup_enabled?: number | boolean | null
  auto_topup_threshold_cents?: number | null
  auto_topup_amount_cents?: number | null
  created_at?: string | null
  updated_at?: string | null
}

type TenantLedgerRow = {
  id: string
  tenant_id: string
  kind: string
  amount_cents: number
  balance_after_cents: number
  box_id?: string | null
  description?: string | null
  stripe_payment_intent_id?: string | null
  created_at?: string | null
}

type TenantSyncBody = {
  tenants?: TenantRow[]
  projects?: TenantProjectRow[]
  api_keys?: TenantApiKeyRow[]
  billing_accounts?: TenantBillingAccountRow[]
  ledger?: TenantLedgerRow[]
}

const DEFAULT_NODE_ID = 'tyo-1'
const DEFAULT_NODE_ORIGIN = 'https://tyo-1.node.sandbank.dev'
const PANEL_AUTH_HEADER_USER_ID = 'x-sandbank-panel-auth-user-id'
const PANEL_AUTH_HEADER_EMAIL = 'x-sandbank-panel-auth-email'
const PANEL_AUTH_HEADER_TS = 'x-sandbank-panel-auth-ts'
const PANEL_AUTH_HEADER_SIGNATURE = 'x-sandbank-panel-auth-signature'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const nodes = readNodeOrigins(env)
    const selectedNode = selectNode(url, request, env, nodes)
    const target = selectProxyTarget(url, request, env, selectedNode)

    if (url.pathname.startsWith('/internal/tenant/')) {
      return handleTenantAuthority(request, url, env)
    }

    if (url.pathname === '/__worker/health') {
      return json({
        ok: true,
        service: 'sandbank-api-worker',
        node_id: selectedNode.id,
        node_origin: selectedNode.origin,
        proxy_target_id: target.id,
        proxy_target_origin: target.origin,
        proxy_target_kind: target.kind || 'node',
        scheduler_origin: normalizeOriginWithPath(env.SCHEDULER_ORIGIN || ''),
        node_count: nodes.length,
        nodes,
        clerk_jwt_key_configured: Boolean(env.CLERK_JWT_KEY?.trim()),
        clerk_secret_configured: Boolean(env.CLERK_SECRET_KEY?.trim()),
        panel_auth_forwarding_secret_configured: Boolean(env.PANEL_AUTH_FORWARDING_SECRET?.trim()),
        tenant_db_configured: Boolean(env.TENANT_DB),
        tenant_authority_configured: Boolean(env.TENANT_DB && env.TENANT_AUTHORITY_TOKEN?.trim()),
      })
    }

    if (url.pathname === '/__worker/nodes') {
      return json({
        ok: true,
        default_node_id: env.DEFAULT_NODE_ID || DEFAULT_NODE_ID,
        scheduler_origin: normalizeOriginWithPath(env.SCHEDULER_ORIGIN || ''),
        box_api_target: selectProxyTarget(new URL('/v1/boxes', url), request, env, selectedNode),
        selected_node: selectedNode,
        nodes,
      })
    }

    const panelAuth = await resolvePanelAuth(request, url, env)
    if (panelAuth instanceof Response) return panelAuth

    return proxyToNode(request, url, target, env, panelAuth)
  },
}

async function proxyToNode(
  request: Request,
  originalUrl: URL,
  node: NodeTarget,
  env: Env,
  panelAuth: PanelAuth | null,
): Promise<Response> {
  const fallbackOrigin = normalizeOrigin(env.FALLBACK_NODE_ORIGIN || '')
  const canFallback = !isUpgradeRequest(request) && fallbackOrigin && fallbackOrigin !== node.origin
  const fallbackSource = canFallback ? request.clone() : null

  try {
    return markResponse(await fetch(await buildNodeRequest(request, originalUrl, node.origin, env, panelAuth)), node, false)
  } catch (err) {
    if (!fallbackSource || !fallbackOrigin) {
      return upstreamError(err, node)
    }

    const fallbackNode = { id: `${node.id}-fallback`, origin: fallbackOrigin }
    try {
      return markResponse(
        await fetch(await buildNodeRequest(fallbackSource, originalUrl, fallbackOrigin, env, panelAuth)),
        fallbackNode,
        true,
      )
    } catch (fallbackErr) {
      return upstreamError(fallbackErr, fallbackNode)
    }
  }
}

async function handleTenantAuthority(request: Request, url: URL, env: Env): Promise<Response> {
  if (!isTenantAuthorityAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401)
  if (!env.TENANT_DB) return json({ error: 'Tenant authority database is not configured' }, 503)
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (url.pathname === '/internal/tenant/resolve-api-key') return resolveTenantApiKey(request, env.TENANT_DB)
  if (url.pathname === '/internal/tenant/billing/ensure') return ensureTenantBilling(request, env.TENANT_DB)
  if (url.pathname === '/internal/tenant/billing/debit') return debitTenantBilling(request, env.TENANT_DB)
  if (url.pathname === '/internal/tenant/billing/read') return readTenantBilling(request, env.TENANT_DB)
  if (url.pathname === '/internal/tenant/sync') return syncTenantAuthority(request, env.TENANT_DB)
  return json({ error: 'Not found' }, 404)
}

function isTenantAuthorityAuthorized(request: Request, env: Env): boolean {
  const token = env.TENANT_AUTHORITY_TOKEN?.trim()
  if (!token) return false
  return request.headers.get('authorization') === `Bearer ${token}`
    || request.headers.get('x-sandbank-scheduler-token') === token
}

async function resolveTenantApiKey(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson<{ api_key?: unknown }>(request)
  const apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''
  if (!apiKey) return json({ error: 'Unauthorized' }, 401)
  const keyHash = await sha256Hex(apiKey)
  const record = await db.prepare(`
    SELECT id, tenant_id, project_id
    FROM tenant_api_keys
    WHERE key_hash = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(keyHash).first<{ id: string; tenant_id: string; project_id: string | null }>()
  if (!record?.tenant_id) return json({ error: 'Unauthorized' }, 401)

  let projectId = record.project_id
  if (!projectId) {
    const project = await db.prepare(`
      SELECT id
      FROM tenant_projects
      WHERE tenant_id = ?
      ORDER BY CASE slug WHEN 'default' THEN 0 ELSE 1 END ASC, created_at ASC
      LIMIT 1
    `).bind(record.tenant_id).first<{ id: string }>()
    projectId = project?.id ?? record.tenant_id
    await db.prepare(`UPDATE tenant_api_keys SET project_id = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(projectId, record.id)
      .run()
  } else {
    await db.prepare(`UPDATE tenant_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(record.id)
      .run()
  }

  return json({ tenant_id: record.tenant_id, project_id: projectId, key_id: record.id })
}

async function ensureTenantBilling(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson<{ tenant_id?: unknown; required_cents?: unknown }>(request)
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const requiredCents = Number(body.required_cents)
  if (!tenantId || !Number.isFinite(requiredCents) || requiredCents < 0) {
    return json({ error: 'tenant_id and non-negative required_cents are required' }, 400)
  }
  const account = await getTenantBillingAccount(db, tenantId)
  if (!account) return json({ error: 'Billing account not found', code: 'billing_missing' }, 402)
  if (account.balance_cents >= Math.round(requiredCents)) return json({ ok: true })
  return json({
    error: 'Insufficient tenant balance',
    code: 'insufficient_balance',
    balance_cents: account.balance_cents,
    required_cents: Math.round(requiredCents),
    auto_topup_enabled: Boolean(account.auto_topup_enabled),
    has_card: Boolean(account.stripe_customer_id && account.stripe_payment_method_id),
  }, 402)
}

async function debitTenantBilling(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson<{
    ledger_id?: unknown
    tenant_id?: unknown
    amount_cents?: unknown
    box_id?: unknown
    description?: unknown
  }>(request)
  const ledgerId = typeof body.ledger_id === 'string' && body.ledger_id.trim() ? body.ledger_id.trim() : crypto.randomUUID()
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const amountCents = Number(body.amount_cents)
  const boxId = typeof body.box_id === 'string' && body.box_id.trim() ? body.box_id.trim() : null
  const description = typeof body.description === 'string' && body.description.trim() ? body.description.trim() : 'box usage'
  if (!tenantId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return json({ error: 'tenant_id and positive amount_cents are required' }, 400)
  }

  const existing = await db.prepare(`SELECT id, tenant_id FROM tenant_balance_ledger WHERE id = ? LIMIT 1`)
    .bind(ledgerId)
    .first<{ id: string; tenant_id: string }>()
  if (existing) {
    if (existing.tenant_id !== tenantId) return json({ error: 'Ledger id conflict' }, 409)
    return json({ ok: true, ledger_id: ledgerId, duplicate: true })
  }

  const debit = Math.round(amountCents)
  const account = await getTenantBillingAccount(db, tenantId)
  if (!account) return json({ error: 'Billing account not found', code: 'billing_missing' }, 402)
  if (account.balance_cents < debit) {
    return json({
      error: 'Insufficient tenant balance',
      code: 'insufficient_balance',
      balance_cents: account.balance_cents,
      required_cents: debit,
    }, 402)
  }

  const updated = await db.prepare(`
    UPDATE tenant_billing_accounts
    SET balance_cents = balance_cents - ?, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = ? AND balance_cents >= ?
  `).bind(debit, tenantId, debit).run()
  if ((updated.meta?.changes ?? 0) < 1) {
    const latest = await getTenantBillingAccount(db, tenantId)
    return json({
      error: 'Insufficient tenant balance',
      code: 'insufficient_balance',
      balance_cents: latest?.balance_cents ?? account.balance_cents,
      required_cents: debit,
    }, 402)
  }

  const chargedAccount = await getTenantBillingAccount(db, tenantId)
  const balanceAfter = chargedAccount?.balance_cents ?? (account.balance_cents - debit)
  await db.prepare(`
    INSERT INTO tenant_balance_ledger (
      id, tenant_id, kind, amount_cents, balance_after_cents, box_id, description
    ) VALUES (?, ?, 'debit', ?, ?, ?, ?)
  `).bind(ledgerId, tenantId, -debit, balanceAfter, boxId, description).run()
  return json({ ok: true, ledger_id: ledgerId, balance_cents: balanceAfter })
}

async function readTenantBilling(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson<{ tenant_id?: unknown; ledger_limit?: unknown }>(request)
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : ''
  const ledgerLimit = clampInteger(Number(body.ledger_limit), 0, 100, 50)
  if (!tenantId) return json({ error: 'tenant_id is required' }, 400)
  const billing = await getTenantBillingAccount(db, tenantId)
  const ledger = ledgerLimit > 0
    ? await db.prepare(`
      SELECT *
      FROM tenant_balance_ledger
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(tenantId, ledgerLimit).all<TenantLedgerRow>()
    : { results: [] as TenantLedgerRow[] }
  return json({ billing, ledger: ledger.results ?? [] })
}

async function syncTenantAuthority(request: Request, db: D1Database): Promise<Response> {
  const body = await readJson<TenantSyncBody>(request)
  const statements: D1PreparedStatement[] = []

  for (const tenant of body.tenants ?? []) {
    if (!tenant.id || !tenant.name || !tenant.slug || !tenant.owner_user_id) continue
    statements.push(db.prepare(`
      INSERT INTO tenants (id, name, slug, owner_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        owner_user_id = excluded.owner_user_id,
        updated_at = excluded.updated_at
    `).bind(tenant.id, tenant.name, tenant.slug, tenant.owner_user_id, tenant.created_at ?? null, tenant.updated_at ?? null))
  }

  for (const project of body.projects ?? []) {
    if (!project.id || !project.tenant_id || !project.name || !project.slug) continue
    statements.push(db.prepare(`
      INSERT INTO tenant_projects (
        id, tenant_id, name, slug, node_id, server_name, region, country_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        name = excluded.name,
        slug = excluded.slug,
        node_id = excluded.node_id,
        server_name = excluded.server_name,
        region = excluded.region,
        country_code = excluded.country_code,
        updated_at = excluded.updated_at
    `).bind(project.id, project.tenant_id, project.name, project.slug, project.node_id ?? 'tyo-1', project.server_name ?? 'TYO-1', project.region ?? 'Tokyo', project.country_code ?? 'JP', project.created_at ?? null, project.updated_at ?? null))
  }

  for (const key of body.api_keys ?? []) {
    if (!key.id || !key.tenant_id || !key.key_hash || !key.prefix || !key.name) continue
    statements.push(db.prepare(`
      INSERT INTO tenant_api_keys (
        id, tenant_id, project_id, key_hash, prefix, name, created_at, last_used_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        project_id = excluded.project_id,
        key_hash = excluded.key_hash,
        prefix = excluded.prefix,
        name = excluded.name,
        last_used_at = excluded.last_used_at,
        revoked_at = excluded.revoked_at
    `).bind(key.id, key.tenant_id, key.project_id ?? null, key.key_hash, key.prefix, key.name, key.created_at ?? null, key.last_used_at ?? null, key.revoked_at ?? null))
  }

  for (const account of body.billing_accounts ?? []) {
    if (!account.tenant_id || !Number.isFinite(account.balance_cents)) continue
    statements.push(db.prepare(`
      INSERT INTO tenant_billing_accounts (
        tenant_id, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4,
        currency, balance_cents, auto_topup_enabled, auto_topup_threshold_cents,
        auto_topup_amount_cents, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(tenant_id) DO UPDATE SET
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_payment_method_id = excluded.stripe_payment_method_id,
        card_brand = excluded.card_brand,
        card_last4 = excluded.card_last4,
        currency = excluded.currency,
        balance_cents = excluded.balance_cents,
        auto_topup_enabled = excluded.auto_topup_enabled,
        auto_topup_threshold_cents = excluded.auto_topup_threshold_cents,
        auto_topup_amount_cents = excluded.auto_topup_amount_cents,
        updated_at = excluded.updated_at
    `).bind(account.tenant_id, account.stripe_customer_id ?? null, account.stripe_payment_method_id ?? null, account.card_brand ?? null, account.card_last4 ?? null, account.currency ?? 'usd', Math.round(account.balance_cents), account.auto_topup_enabled ? 1 : 0, account.auto_topup_threshold_cents ?? 500, account.auto_topup_amount_cents ?? 2000, account.created_at ?? null, account.updated_at ?? null))
  }

  for (const ledger of body.ledger ?? []) {
    if (!ledger.id || !ledger.tenant_id || !ledger.kind || !Number.isFinite(ledger.amount_cents) || !Number.isFinite(ledger.balance_after_cents)) continue
    statements.push(db.prepare(`
      INSERT INTO tenant_balance_ledger (
        id, tenant_id, kind, amount_cents, balance_after_cents,
        box_id, description, stripe_payment_intent_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        kind = excluded.kind,
        amount_cents = excluded.amount_cents,
        balance_after_cents = excluded.balance_after_cents,
        box_id = excluded.box_id,
        description = excluded.description,
        stripe_payment_intent_id = excluded.stripe_payment_intent_id
    `).bind(ledger.id, ledger.tenant_id, ledger.kind, Math.round(ledger.amount_cents), Math.round(ledger.balance_after_cents), ledger.box_id ?? null, ledger.description ?? null, ledger.stripe_payment_intent_id ?? null, ledger.created_at ?? null))
  }

  if (statements.length > 0) await db.batch(statements)
  return json({ ok: true, synced: statements.length })
}

async function getTenantBillingAccount(db: D1Database, tenantId: string): Promise<TenantBillingAccountRow | null> {
  return await db.prepare(`SELECT * FROM tenant_billing_accounts WHERE tenant_id = ? LIMIT 1`)
    .bind(tenantId)
    .first<TenantBillingAccountRow>()
}

async function readJson<T extends Record<string, unknown>>(request: Request): Promise<T> {
  return await request.json().catch(() => ({})) as T
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

async function buildNodeRequest(
  request: Request,
  originalUrl: URL,
  origin: string,
  env: Env,
  panelAuth: PanelAuth | null,
): Promise<Request> {
  const upstream = new URL(originalUrl)
  const nodeOrigin = new URL(origin)
  upstream.protocol = nodeOrigin.protocol
  upstream.hostname = nodeOrigin.hostname
  upstream.port = nodeOrigin.port
  upstream.pathname = joinOriginPath(nodeOrigin.pathname, originalUrl.pathname)

  const headers = new Headers(request.headers)
  stripPanelAuthHeaders(headers)
  headers.set('x-sandbank-api-worker', '1')
  headers.set('x-forwarded-host', originalUrl.host)
  headers.set('x-forwarded-proto', originalUrl.protocol.replace(':', ''))
  headers.delete('host')

  if (panelAuth) {
    await setPanelAuthHeaders(headers, request.method, `${originalUrl.pathname}${originalUrl.search}`, panelAuth, env)
  }

  const init: RequestInit & { cf?: unknown; duplex?: 'half' } = {
    cf: (request as Request & { cf?: unknown }).cf,
    headers,
    method: request.method,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  return new Request(upstream, init)
}

async function resolvePanelAuth(request: Request, url: URL, env: Env): Promise<PanelAuth | Response | null> {
  if (!requiresPanelAuth(request, url)) return null

  const forwardingSecret = env.PANEL_AUTH_FORWARDING_SECRET?.trim()
  if (!forwardingSecret) {
    return json({ error: 'Panel auth forwarding secret is not configured' }, 500)
  }

  const token = getBearerToken(request.headers.get('authorization'))
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const secretKey = env.CLERK_SECRET_KEY?.trim()
  const jwtKey = env.CLERK_JWT_KEY?.trim()
  if (!secretKey && !jwtKey) {
    return json({ error: 'Clerk verifier is not configured' }, 500)
  }

  try {
    const authorizedParties = readCsv(env.CLERK_AUTHORIZED_PARTIES)
    const payload = await verifyToken(token, {
      secretKey: secretKey || undefined,
      jwtKey: jwtKey || undefined,
      authorizedParties: authorizedParties.length > 0 ? authorizedParties : undefined,
    })
    if (!payload.sub) return json({ error: 'Unauthorized' }, 401)

    const emailClaim = (payload as Record<string, unknown>).email
    return {
      userId: payload.sub,
      email: typeof emailClaim === 'string' ? emailClaim : null,
    }
  } catch (err) {
    console.warn(`[PANEL] Clerk worker auth failed: ${err instanceof Error ? err.message : err}`)
    return json({ error: 'Unauthorized' }, 401)
  }
}

function requiresPanelAuth(request: Request, url: URL): boolean {
  if (request.method === 'OPTIONS') return false
  if (url.pathname === '/v1/panel/billing/webhook') return false
  return url.pathname.startsWith('/v1/panel')
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token || null
}

async function setPanelAuthHeaders(
  headers: Headers,
  method: string,
  pathAndSearch: string,
  panelAuth: PanelAuth,
  env: Env,
): Promise<void> {
  const timestamp = Date.now().toString()
  const email = panelAuth.email || ''
  const signature = await signPanelAuth(env.PANEL_AUTH_FORWARDING_SECRET || '', {
    method,
    pathAndSearch,
    userId: panelAuth.userId,
    email,
    timestamp,
  })

  headers.set(PANEL_AUTH_HEADER_USER_ID, panelAuth.userId)
  headers.set(PANEL_AUTH_HEADER_EMAIL, email)
  headers.set(PANEL_AUTH_HEADER_TS, timestamp)
  headers.set(PANEL_AUTH_HEADER_SIGNATURE, signature)
}

async function signPanelAuth(secret: string, input: {
  method: string
  pathAndSearch: string
  userId: string
  email: string
  timestamp: string
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(panelAuthPayload(input)))
  return base64UrlEncode(new Uint8Array(signature))
}

function panelAuthPayload(input: {
  method: string
  pathAndSearch: string
  userId: string
  email: string
  timestamp: string
}): string {
  return [
    'v1',
    input.method.toUpperCase(),
    input.pathAndSearch,
    input.userId,
    input.email,
    input.timestamp,
  ].join('\n')
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function stripPanelAuthHeaders(headers: Headers): void {
  const keys: string[] = []
  headers.forEach((_value, key) => {
    if (key.toLowerCase().startsWith('x-sandbank-panel-auth-')) {
      keys.push(key)
    }
  })
  keys.forEach((key) => headers.delete(key))
}

function readCsv(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function readNodeOrigins(env: Env): NodeTarget[] {
  const configured = parseNodeOrigins(env.NODE_ORIGINS_JSON)
  const defaultOrigin = normalizeOrigin(env.DEFAULT_NODE_ORIGIN || DEFAULT_NODE_ORIGIN)
  const defaultId = (env.DEFAULT_NODE_ID || DEFAULT_NODE_ID).trim() || DEFAULT_NODE_ID

  if (configured.length > 0) {
    const hasDefault = configured.some((node) => node.id === defaultId)
    return hasDefault ? configured : [{ id: defaultId, origin: defaultOrigin }, ...configured]
  }

  return [{ id: defaultId, origin: defaultOrigin }]
}

function parseNodeOrigins(raw: string | undefined): NodeTarget[] {
  if (!raw?.trim()) return []

  try {
    const parsed = JSON.parse(raw) as Record<string, string> | Array<{ id?: string; node_id?: string; origin?: string; url?: string }>
    const entries = Array.isArray(parsed)
      ? parsed.map((item) => [item.id || item.node_id || '', item.origin || item.url || ''] as const)
      : Object.entries(parsed)

    return entries
      .map(([id, origin]) => ({ id: id.trim(), origin: normalizeOrigin(origin) }))
      .filter((node) => node.id && node.origin)
  } catch {
    return []
  }
}

function selectNode(url: URL, request: Request, env: Env, nodes: NodeTarget[]): NodeTarget {
  const requestedNodeId = request.headers.get('x-sandbank-node-id')
    || url.searchParams.get('node_id')
    || env.DEFAULT_NODE_ID
    || DEFAULT_NODE_ID
  return nodes.find((node) => node.id === requestedNodeId) || nodes[0]!
}

function selectProxyTarget(url: URL, request: Request, env: Env, selectedNode: NodeTarget): NodeTarget {
  const schedulerOrigin = normalizeOriginWithPath(env.SCHEDULER_ORIGIN || '')
  if (schedulerOrigin && isBoxControlPath(url.pathname) && !hasExplicitNodeOverride(url, request)) {
    return {
      id: 'scheduler',
      origin: schedulerOrigin,
      kind: 'scheduler',
    }
  }
  return {
    ...selectedNode,
    kind: 'node',
  }
}

function isBoxControlPath(pathname: string): boolean {
  return pathname === '/v1/boxes'
    || pathname.startsWith('/v1/boxes/')
    || pathname === '/v1/allocations'
    || pathname.startsWith('/v1/allocations/')
}

function hasExplicitNodeOverride(url: URL, request: Request): boolean {
  return Boolean(request.headers.get('x-sandbank-node-id') || url.searchParams.get('node_id'))
}

function markResponse(response: Response, node: NodeTarget, fallback: boolean): Response {
  const headers = new Headers(response.headers)
  headers.set('x-sandbank-api-worker', '1')
  headers.set('x-sandbank-api-target-id', node.id)
  headers.set('x-sandbank-api-target-kind', node.kind || 'node')
  if (!headers.has('x-sandbank-node-id')) {
    headers.set('x-sandbank-node-id', node.id)
  }
  if (fallback) headers.set('x-sandbank-upstream-fallback', '1')
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function upstreamError(err: unknown, node: NodeTarget): Response {
  return json({
    error: 'Upstream node unavailable',
    node_id: node.id,
    message: err instanceof Error ? err.message : String(err),
  }, 502)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-sandbank-api-worker': '1',
    },
    status,
  })
}

function normalizeOrigin(origin: string): string {
  if (!origin.trim()) return ''
  const url = new URL(origin)
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function normalizeOriginWithPath(origin: string): string {
  if (!origin.trim()) return ''
  const url = new URL(origin)
  url.pathname = normalizePathPrefix(url.pathname)
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function normalizePathPrefix(pathname: string): string {
  if (!pathname || pathname === '/') return ''
  return `/${pathname.split('/').filter(Boolean).join('/')}`
}

function joinOriginPath(prefixPath: string, pathname: string): string {
  const prefix = normalizePathPrefix(prefixPath)
  if (!prefix) return pathname
  return `${prefix}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

function isUpgradeRequest(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket'
}
