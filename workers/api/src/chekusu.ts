/**
 * Sign-in with the Chekusu account (https://clerk.chekusu.com, the one account every Chekusu product
 * shares; chekusu/accounts docs/integrate.md). The panel at sandbank.dev sends the browser to
 * `api.sandbank.dev/auth/login`; this Worker runs the OIDC code flow against the unified instance and
 * keeps its own session in an HttpOnly cookie on api.sandbank.dev. Panel API calls then carry that
 * cookie (`credentials: 'include'`) instead of a Clerk bearer token.
 *
 * Kept in step with accounts/packages/auth/src/{cid,oidc}.ts:
 * - cid = ck_ + Crockford base32 of sha256("chekusu:" + user_id), first 100 bits; an explicit `cid`
 *   claim or `public_metadata.cid` wins over the derived value;
 * - authorization code + PKCE S256 + nonce, client_secret_basic, RS256 ID token from the issuer's JWKS.
 */

export type ChekusuEnv = {
  CHEKUSU_CLIENT_ID?: string
  CHEKUSU_CLIENT_SECRET?: string
  CHEKUSU_ISSUER?: string
  CHEKUSU_SIGN_IN_URL?: string
  /** At least 32 random characters; signs the session and sign-in cookies. */
  SESSION_SECRET?: string
  /** Where the panel lives, e.g. https://sandbank.dev. Sign-in only returns to these origins. */
  PANEL_ORIGINS?: string
  /** JSON {cid: legacy Clerk user_id} for people whose tenants were created before the switch. */
  CHEKUSU_LEGACY_USERS?: string
}

export type ChekusuConfig = {
  issuer: string
  clientId: string
  clientSecret: string
  signInUrl: string
  sessionSecret: string
  panelOrigins: string[]
  legacyUsers: Record<string, string>
}

export type ChekusuSession = { cid: string; sub: string; email: string | null; name: string | null; exp: number }

export const DEFAULT_ISSUER = 'https://clerk.chekusu.com'
export const DEFAULT_SIGN_IN_URL = 'https://login.chekusu.com/sign-in'
export const SESSION_COOKIE = 'sb_session'
const FLOW_COOKIE = 'sb_signin'
const SESSION_TTL_S = 30 * 24 * 3600
const FLOW_TTL_S = 15 * 60
const SCOPES = 'openid email profile public_metadata'

/** Off unless the client id, client secret and session secret are all set. */
export function chekusuConfig(env: ChekusuEnv): ChekusuConfig | null {
  const clientId = env.CHEKUSU_CLIENT_ID?.trim()
  const clientSecret = env.CHEKUSU_CLIENT_SECRET?.trim()
  const sessionSecret = env.SESSION_SECRET?.trim()
  if (!clientId || !clientSecret || !sessionSecret || sessionSecret.length < 32) return null
  let legacyUsers: Record<string, string> = {}
  try {
    const parsed = JSON.parse(env.CHEKUSU_LEGACY_USERS || '{}')
    if (parsed && typeof parsed === 'object') {
      legacyUsers = Object.fromEntries(
        Object.entries(parsed).filter(([cid, id]) => isChekusuId(cid) && typeof id === 'string' && id),
      ) as Record<string, string>
    }
  } catch {
    legacyUsers = {}
  }
  return {
    issuer: new URL(env.CHEKUSU_ISSUER?.trim() || DEFAULT_ISSUER).origin,
    clientId,
    clientSecret,
    signInUrl: env.CHEKUSU_SIGN_IN_URL?.trim() || DEFAULT_SIGN_IN_URL,
    sessionSecret,
    panelOrigins: (env.PANEL_ORIGINS || 'https://sandbank.dev')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean),
    legacyUsers,
  }
}

/** The user id the TYO backend knows this person by: their old Clerk id if they had one, else the cid. */
export function panelUserId(config: ChekusuConfig, session: ChekusuSession): string {
  return config.legacyUsers[session.cid] || session.cid
}

// ---------- Chekusu ID ----------
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const CID = /^ck_[0-9a-hjkmnp-tv-z]{20}$/
export const isChekusuId = (value: unknown): value is string => typeof value === 'string' && CID.test(value)

export async function chekusuIdFor(userId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`chekusu:${userId}`)))
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of digest) {
    value = ((value << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 5 && out.length < 20) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    if (out.length >= 20) break
  }
  return `ck_${out}`
}

export async function resolveChekusuId(claims: Record<string, unknown>): Promise<string> {
  if (isChekusuId(claims.cid)) return claims.cid
  const meta = claims.public_metadata as Record<string, unknown> | undefined
  if (meta && typeof meta === 'object' && isChekusuId(meta.cid)) return meta.cid
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('no sub')
  return chekusuIdFor(claims.sub)
}

// ---------- encoding and signing ----------
const encoder = new TextEncoder()

export function b64url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** `payload.signature`, where payload is base64url JSON. `purpose` keeps the two cookies apart. */
export async function sealCookie(secret: string, purpose: string, data: object): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(data)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`${purpose}.${payload}`))
  return `${payload}.${b64url(new Uint8Array(signature))}`
}

export async function openCookie<T extends { exp: number }>(secret: string, purpose: string, value: string | null, now = Date.now()): Promise<T | null> {
  if (!value) return null
  const [payload, signature, extra] = value.split('.')
  if (!payload || !signature || extra !== undefined) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(signature), encoder.encode(`${purpose}.${payload}`))
    if (!ok) return null
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as T
    if (typeof data.exp !== 'number' || data.exp * 1000 < now) return null
    return data
  } catch {
    return null
  }
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

function cookie(name: string, value: string, maxAge: number, path = '/'): string {
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

// ---------- session ----------
export async function readSession(config: ChekusuConfig, request: Request): Promise<ChekusuSession | null> {
  const session = await openCookie<ChekusuSession>(config.sessionSecret, 'session', readCookie(request, SESSION_COOKIE))
  return session && isChekusuId(session.cid) ? session : null
}

// ---------- routes ----------
type Fetch = typeof fetch

function safeReturnTo(config: ChekusuConfig, raw: string | null): string {
  const fallback = `${config.panelOrigins[0] || 'https://sandbank.dev'}/panel`
  if (!raw) return fallback
  try {
    const url = new URL(raw)
    return config.panelOrigins.includes(url.origin) ? url.toString() : fallback
  } catch {
    return fallback
  }
}

function corsHeaders(config: ChekusuConfig, request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  if (!origin || !config.panelOrigins.includes(origin)) return {}
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' }
}

function json(config: ChekusuConfig, request: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(config, request), ...extra },
  })
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  cookies.forEach((value) => headers.append('Set-Cookie', value))
  return new Response(null, { status: 302, headers })
}

/** Handles /auth/*; returns null for any other path. */
export async function handleAuth(request: Request, url: URL, config: ChekusuConfig, doFetch: Fetch = fetch): Promise<Response | null> {
  if (!url.pathname.startsWith('/auth/')) return null
  const callback = `${url.origin}/auth/callback`

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(config, request), 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Max-Age': '600' },
    })
  }

  if (url.pathname === '/auth/login' && request.method === 'GET') {
    const state = randomToken()
    const nonce = randomToken()
    const verifier = randomToken()
    const lang = url.searchParams.get('lang')?.slice(0, 20) || null
    const returnTo = safeReturnTo(config, url.searchParams.get('return_to'))
    const flow = await sealCookie(config.sessionSecret, 'signin', { state, nonce, verifier, returnTo, exp: Math.floor(Date.now() / 1000) + FLOW_TTL_S })
    const authorize = new URL(`${config.issuer}/oauth/authorize`)
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: callback,
      scope: SCOPES,
      state,
      nonce,
      code_challenge: b64url(await sha256(verifier)),
      code_challenge_method: 'S256',
      ...(lang ? { ui_locales: lang } : {}),
    }).toString()
    const page = new URL(config.signInUrl)
    page.searchParams.set('redirect_url', authorize.toString())
    if (lang) page.searchParams.set('lang', lang)
    return redirect(page.toString(), [cookie(FLOW_COOKIE, flow, FLOW_TTL_S, '/auth/')])
  }

  if (url.pathname === '/auth/callback' && request.method === 'GET') {
    const flow = await openCookie<{ state: string; nonce: string; verifier: string; returnTo: string; exp: number }>(
      config.sessionSecret,
      'signin',
      readCookie(request, FLOW_COOKIE),
    )
    const clearFlow = cookie(FLOW_COOKIE, '', 0, '/auth/')
    const back = (reason: string) => {
      const to = new URL(flow?.returnTo || safeReturnTo(config, null))
      to.searchParams.set('auth_error', reason)
      return redirect(to.toString(), [clearFlow])
    }
    if (!flow || url.searchParams.get('state') !== flow.state) return back('expired')
    if (url.searchParams.get('error')) return back('denied')
    const code = url.searchParams.get('code')
    if (!code) return back('expired')
    try {
      const identity = await completeSignIn(config, { code, verifier: flow.verifier, nonce: flow.nonce, redirectUri: callback }, doFetch)
      const session: ChekusuSession = { ...identity, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }
      const sealed = await sealCookie(config.sessionSecret, 'session', session)
      return redirect(flow.returnTo, [clearFlow, cookie(SESSION_COOKIE, sealed, SESSION_TTL_S)])
    } catch (err) {
      console.warn(`[AUTH] Chekusu sign-in failed: ${err instanceof Error ? err.message : err}`)
      return back('failed')
    }
  }

  if (url.pathname === '/auth/me' && request.method === 'GET') {
    const session = await readSession(config, request)
    if (!session) return json(config, request, { error: 'Unauthorized' }, 401)
    return json(config, request, { cid: session.cid, email: session.email, name: session.name })
  }

  if (url.pathname === '/auth/logout' && request.method === 'POST') {
    return json(config, request, { ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) })
  }

  return json(config, request, { error: 'Not found' }, 404)
}

// ---------- OIDC ----------
const keyCache = new Map<string, { keys: Map<string, CryptoKey>; at: number }>()

async function signingKey(config: ChekusuConfig, kid: string, doFetch: Fetch): Promise<CryptoKey> {
  const url = `${config.issuer}/.well-known/jwks.json`
  const cached = keyCache.get(url)
  if (cached && Date.now() - cached.at < 600_000 && cached.keys.has(kid)) return cached.keys.get(kid)!
  const response = await doFetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`JWKS ${response.status}`)
  const keys = new Map<string, CryptoKey>()
  for (const jwk of ((await response.json()) as { keys?: JsonWebKey[] & { kid?: string }[] }).keys ?? []) {
    const k = jwk as JsonWebKey & { kid?: string; use?: string }
    if (k.kty !== 'RSA' || typeof k.kid !== 'string' || (k.use && k.use !== 'sig')) continue
    try {
      keys.set(k.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))
    } catch {
      // an unusable key is skipped
    }
  }
  keyCache.set(url, { keys, at: Date.now() })
  const key = keys.get(kid)
  if (!key) throw new Error('unknown signing key')
  return key
}

function jwtPart(value: string): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(fromB64url(value)))
  if (!parsed || typeof parsed !== 'object') throw new Error('malformed token')
  return parsed as Record<string, unknown>
}

export async function verifyIdToken(config: ChekusuConfig, token: string, nonce: string, doFetch: Fetch = fetch, now = Date.now()) {
  const pieces = token.split('.')
  if (pieces.length !== 3) throw new Error('not a JWT')
  const [h, p, s] = pieces as [string, string, string]
  const header = jwtPart(h)
  const claims = jwtPart(p)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('unexpected token header')
  if (claims.iss !== config.issuer) throw new Error('unexpected issuer')
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await signingKey(config, header.kid, doFetch), fromB64url(s), encoder.encode(`${h}.${p}`))
  if (!ok) throw new Error('bad signature')
  const seconds = now / 1000
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(config.clientId)) throw new Error('unexpected audience')
  if (typeof claims.exp !== 'number' || claims.exp + 5 < seconds) throw new Error('expired')
  if (typeof claims.nbf === 'number' && claims.nbf - 5 > seconds) throw new Error('not yet valid')
  if (claims.nonce !== nonce) throw new Error('nonce mismatch')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('no sub')
  return claims
}

async function completeSignIn(
  config: ChekusuConfig,
  input: { code: string; verifier: string; nonce: string; redirectUri: string },
  doFetch: Fetch,
): Promise<Omit<ChekusuSession, 'exp'>> {
  const response = await doFetch(`${config.issuer}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: input.code, code_verifier: input.verifier, redirect_uri: input.redirectUri }).toString(),
  })
  const tokens = (await response.json().catch(() => ({}))) as { access_token?: string; id_token?: string; error?: string }
  if (!response.ok || !tokens.access_token || !tokens.id_token) throw new Error(`token exchange failed: ${tokens.error ?? response.status}`)
  let claims = await verifyIdToken(config, tokens.id_token, input.nonce, doFetch)
  if (!claims.email || !claims.public_metadata) {
    const info = await doFetch(`${config.issuer}/oauth/userinfo`, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' } })
    if (!info.ok) throw new Error(`userinfo ${info.status}`)
    const data = (await info.json()) as Record<string, unknown>
    if (data.sub !== claims.sub) throw new Error('userinfo is for another user')
    claims = { ...data, ...claims, email: claims.email ?? data.email, email_verified: claims.email_verified ?? data.email_verified, public_metadata: claims.public_metadata ?? data.public_metadata }
  }
  const email = typeof claims.email === 'string' && claims.email ? claims.email.trim().toLowerCase() : null
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null
  return { cid: await resolveChekusuId(claims), sub: String(claims.sub), email, name }
}
