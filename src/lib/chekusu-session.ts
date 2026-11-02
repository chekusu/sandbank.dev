import { useCallback, useEffect, useState } from 'react'

/**
 * Sign-in with the Chekusu account. The API Worker (api.sandbank.dev/auth/*) runs the sign-in and keeps
 * the session in an HttpOnly cookie, so the panel only asks who is signed in and sends its API calls with
 * `credentials: 'include'`.
 */
export type ChekusuUser = { cid: string; email: string | null; name: string | null }
export type ChekusuSessionState =
  | { status: 'loading'; user: null }
  | { status: 'signed-in'; user: ChekusuUser }
  | { status: 'signed-out'; user: null }

export const ACCOUNT_URL = 'https://login.chekusu.com/user'

export function signInUrl(apiBase: string, returnTo: string, lang?: string): string {
  const url = new URL('/auth/login', apiBase)
  url.searchParams.set('return_to', new URL(returnTo, window.location.origin).toString())
  if (lang) url.searchParams.set('lang', lang)
  return url.toString()
}

export function accountUrl(lang?: string): string {
  const url = new URL(ACCOUNT_URL)
  if (lang) url.searchParams.set('lang', lang)
  url.searchParams.set('redirect_url', window.location.href)
  return url.toString()
}

export function useChekusuSession(apiBase: string) {
  const [state, setState] = useState<ChekusuSessionState>({ status: 'loading', user: null })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/auth/me`, { credentials: 'include' })
      if (!res.ok) {
        setState({ status: 'signed-out', user: null })
        return
      }
      setState({ status: 'signed-in', user: (await res.json()) as ChekusuUser })
    } catch {
      setState({ status: 'signed-out', user: null })
    }
  }, [apiBase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined)
    setState({ status: 'signed-out', user: null })
  }, [apiBase])

  return { ...state, refresh, signOut }
}
