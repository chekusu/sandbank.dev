import { useSyncExternalStore } from 'react'
import { getLocale, subscribe, t as translate, type TranslationKey } from '@/i18n'

export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale)
}

export function useT() {
  useLocale() // subscribe to changes
  return (key: TranslationKey) => translate(key)
}
