import { useCallback, useSyncExternalStore } from 'react'
import { getLocale, subscribe, t as translate, type TranslationKey } from '@/i18n'

export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale)
}

export function useT() {
  const locale = useLocale()
  return useCallback((key: TranslationKey) => translate(key), [locale])
}
