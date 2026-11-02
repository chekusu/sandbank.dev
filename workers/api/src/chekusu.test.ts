import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'
import { b64url, chekusuIdFor, SESSION_COOKIE } from './chekusu'

const ISSUER = 'https://clerk.chekusu.com'
const CLIENT_ID = 'sandbank-client'
const LEGACY_SUB = 'user_new_for_legacy'

const baseEnv = {
  DEFAULT_NODE_ID: 'tyo-1',
  DEFAULT_NODE_ORIGIN: 'https://tyo-1.node.sandbank.dev',
  NODE_ORIGINS_JSON: JSON.stringify({ 'tyo-1': 'https://tyo-1.node.sandbank.dev' }),
  PANEL_AUTH_FORWARDING_SECRET: 'forwarding-secret',
  CHEKUSU_CLIENT_ID: CLIENT_ID,
  CHEKUSU_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'x'.repeat(48),
  PANEL_ORIGINS: 'https://sandbank.dev',
}

type Grant = { sub: string; email: string; nonce: string; publicMetadata?: Record<string, unknown> }

async function fakeChekusu() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
  const codes = new Map<string, Grant>()
  const kid = `k-${Math.random().toString(36).slice(2)}`
  const enc = new TextEncoder()
  const sign = async (claims: Record<string, unknown>) => {
    const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })))
    const body = b64url(enc.encode(JSON.stringify(claims)))
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, enc.encode(`${head}.${body}`)))
    return `${head}.${body}.${b64url(sig)}`
  }
  const nodeCalls: Request[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(request.url)
    if (url.href === `${ISSUER}/.well-known/jwks.json`) {
      return Response.json({ keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] })
    }
    if (url.href === `${ISSUER}/oauth/token`) {
      expect(request.headers.get('authorization')).toBe(`Basic ${btoa(`${CLIENT_ID}:client-secret`)}`)
      const form = new URLSearchParams(await request.text())
      const grant = codes.get(form.get('code') || '')
      if (!grant) return Response.json({ error: 'invalid_grant' }, { status: 400 })
      codes.delete(form.get('code') || '')
      const now = Math.floor(Date.now() / 1000)
      const idToken = await sign({
        iss: ISSUER, aud: CLIENT_ID, sub: grant.sub, nonce: grant.nonce, exp: now + 300, iat: now,
        email: grant.email, email_verified: true, name: 'Test Person', public_metadata: grant.publicMetadata ?? {},
      })
      return Response.json({ access_token: 'at', id_token: idToken, token_type: 'Bearer' })
    }
    nodeCalls.push(request)
    return Response.json({ ok: true, upstream: url.href })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    nodeCalls,
    issue(grant: Grant) {
      const code = `code-${codes.size + 1}-${Math.random()}`
      codes.set(code, grant)
      return code
    },
  }
}

function setCookies(response: Response): Record<string, string> {
  const out: Record<string, string> = {}
  const all = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const line of all) {
    const [pair] = line.split(';')
    const [name, ...rest] = pair!.split('=')
    out[name!] = rest.join('=')
  }
  return out
}

async function signIn(env: Record<string, unknown>, chekusu: Awaited<ReturnType<typeof fakeChekusu>>, sub: string, returnTo = 'https://sandbank.dev/panel/boxes') {
  const login = await worker.fetch(new Request(`https://api.sandbank.dev/auth/login?return_to=${encodeURIComponent(returnTo)}&lang=ja`), env as never)
  expect(login.status).toBe(302)
  const page = new URL(login.headers.get('location')!)
  expect(page.origin + page.pathname).toBe('https://login.chekusu.com/sign-in')
  expect(page.searchParams.get('lang')).toBe('ja')
  const authorize = new URL(page.searchParams.get('redirect_url')!)
  expect(authorize.origin + authorize.pathname).toBe(`${ISSUER}/oauth/authorize`)
  expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID)
  expect(authorize.searchParams.get('redirect_uri')).toBe('https://api.sandbank.dev/auth/callback')
  expect(authorize.searchParams.get('code_challenge_method')).toBe('S256')
  expect(authorize.searchParams.get('ui_locales')).toBe('ja')
  const flow = setCookies(login).sb_signin!
  const code = chekusu.issue({ sub, email: 'Person@Example.com', nonce: authorize.searchParams.get('nonce')! })
  const callback = await worker.fetch(
    new Request(`https://api.sandbank.dev/auth/callback?code=${code}&state=${authorize.searchParams.get('state')}`, { headers: { cookie: `sb_signin=${flow}` } }),
    env as never,
  )
  return { callback, authorize, flow }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Chekusu sign-in', () => {
  it('signs in, reports the person, and forwards panel calls as their legacy user id', async () => {
    const chekusu = await fakeChekusu()
    const cid = await chekusuIdFor(LEGACY_SUB)
    const env = { ...baseEnv, CHEKUSU_LEGACY_USERS: JSON.stringify({ [cid]: 'user_old_clerk_id' }) }
    const { callback } = await signIn(env, chekusu, LEGACY_SUB)
    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).toBe('https://sandbank.dev/panel/boxes')
    const session = setCookies(callback)[SESSION_COOKIE]!
    expect(session).toBeTruthy()

    const me = await worker.fetch(new Request('https://api.sandbank.dev/auth/me', { headers: { cookie: `${SESSION_COOKIE}=${session}`, origin: 'https://sandbank.dev' } }), env as never)
    expect(me.status).toBe(200)
    expect(me.headers.get('access-control-allow-origin')).toBe('https://sandbank.dev')
    expect(me.headers.get('access-control-allow-credentials')).toBe('true')
    expect(await me.json()).toEqual({ cid, email: 'person@example.com', name: 'Test Person' })

    const panel = await worker.fetch(new Request('https://api.sandbank.dev/v1/panel/bootstrap', { headers: { cookie: `${SESSION_COOKIE}=${session}` } }), env as never)
    expect(panel.status).toBe(200)
    const forwarded = chekusu.nodeCalls.at(-1)!
    expect(forwarded.headers.get('x-sandbank-panel-auth-user-id')).toBe('user_old_clerk_id')
    expect(forwarded.headers.get('x-sandbank-panel-auth-email')).toBe('person@example.com')
    expect(forwarded.headers.get('x-sandbank-panel-auth-signature')).toBeTruthy()
    expect(forwarded.headers.get('cookie')).toBeNull()
  })

  it('uses the Chekusu ID for people new to Sandbank', async () => {
    const chekusu = await fakeChekusu()
    const { callback } = await signIn(baseEnv, chekusu, 'user_brand_new')
    const session = setCookies(callback)[SESSION_COOKIE]!
    await worker.fetch(new Request('https://api.sandbank.dev/v1/panel/bootstrap', { headers: { cookie: `${SESSION_COOKIE}=${session}` } }), baseEnv as never)
    expect(chekusu.nodeCalls.at(-1)!.headers.get('x-sandbank-panel-auth-user-id')).toBe(await chekusuIdFor('user_brand_new'))
  })

  it('refuses a forged or missing session, a bad state, and returns only to the panel', async () => {
    const chekusu = await fakeChekusu()
    const noSession = await worker.fetch(new Request('https://api.sandbank.dev/v1/panel/bootstrap'), baseEnv as never)
    expect(noSession.status).toBe(401)
    const forged = await worker.fetch(new Request('https://api.sandbank.dev/v1/panel/bootstrap', { headers: { cookie: `${SESSION_COOKIE}=eyJjaWQiOiJ4In0.bad` } }), baseEnv as never)
    expect(forged.status).toBe(401)
    expect(chekusu.nodeCalls).toHaveLength(0)

    const login = await worker.fetch(new Request(`https://api.sandbank.dev/auth/login?return_to=${encodeURIComponent('https://evil.example/x')}`), baseEnv as never)
    const authorize = new URL(new URL(login.headers.get('location')!).searchParams.get('redirect_url')!)
    const flow = setCookies(login).sb_signin!
    const badState = await worker.fetch(
      new Request(`https://api.sandbank.dev/auth/callback?code=x&state=wrong`, { headers: { cookie: `sb_signin=${flow}` } }),
      baseEnv as never,
    )
    expect(badState.headers.get('location')).toBe('https://sandbank.dev/panel?auth_error=expired')
    const code = chekusu.issue({ sub: 'user_a', email: 'a@example.com', nonce: authorize.searchParams.get('nonce')! })
    const ok = await worker.fetch(
      new Request(`https://api.sandbank.dev/auth/callback?code=${code}&state=${authorize.searchParams.get('state')}`, { headers: { cookie: `sb_signin=${flow}` } }),
      baseEnv as never,
    )
    expect(ok.headers.get('location')).toBe('https://sandbank.dev/panel')
  })

  it('logs out and stays off when not configured', async () => {
    const logout = await worker.fetch(new Request('https://api.sandbank.dev/auth/logout', { method: 'POST', headers: { origin: 'https://sandbank.dev' } }), baseEnv as never)
    expect(logout.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=; Path=/; Max-Age=0`)
    const off = await worker.fetch(new Request('https://api.sandbank.dev/auth/login'), { ...baseEnv, CHEKUSU_CLIENT_ID: '' } as never)
    expect(off.status).toBe(404)
  })
})
