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
}

type NodeTarget = {
  id: string
  origin: string
}

type PanelAuth = {
  userId: string
  email: string | null
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

    if (url.pathname === '/__worker/health') {
      return json({
        ok: true,
        service: 'sandbank-api-worker',
        node_id: selectedNode.id,
        node_origin: selectedNode.origin,
        clerk_jwt_key_configured: Boolean(env.CLERK_JWT_KEY?.trim()),
        clerk_secret_configured: Boolean(env.CLERK_SECRET_KEY?.trim()),
        panel_auth_forwarding_secret_configured: Boolean(env.PANEL_AUTH_FORWARDING_SECRET?.trim()),
      })
    }

    const panelAuth = await resolvePanelAuth(request, url, env)
    if (panelAuth instanceof Response) return panelAuth

    return proxyToNode(request, url, selectedNode, env, panelAuth)
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

function markResponse(response: Response, node: NodeTarget, fallback: boolean): Response {
  const headers = new Headers(response.headers)
  headers.set('x-sandbank-api-worker', '1')
  headers.set('x-sandbank-node-id', node.id)
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

function isUpgradeRequest(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket'
}
