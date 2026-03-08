import { useSyncExternalStore } from 'react'
import { subscribe, getLocale, t as translate, type Locale, type TranslationKey } from '@/i18n'

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale)
}

export function useT() {
  useLocale() // subscribe to changes
  return (key: TranslationKey) => translate(key)
}
