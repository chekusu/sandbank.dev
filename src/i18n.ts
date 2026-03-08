export const locales = ['en', 'zh', 'ja'] as const
export type Locale = (typeof locales)[number]

export const localeLabels: Record<Locale, string> = {
  en: 'EN',
  zh: '中',
  ja: '日',
}

const translations = {
  en: {
    badge: 'v0.1.0 · Open Source · MIT',
    heroTitle1: 'Unified Sandbox SDK',
    heroTitle2: 'for AI Agents',
    heroDesc1: 'One TypeScript interface. Four cloud providers.',
    heroDesc2: 'Zero vendor lock-in.',
    scroll: 'Scroll ↓',
    quickStart: 'Quick Start',
    adapters: 'Adapters',
    adapterNote: 'Same interface. Swap with one line.',
    multiAgent: 'Multi-Agent',
    multiTitle1: 'Spawn. Communicate.',
    multiTitle2: 'Orchestrate.',
    relay: 'Real-time relay',
    context: 'Shared context',
    skills: 'Skill injection',
    install: 'Install',
  },
  zh: {
    badge: 'v0.1.0 · 开源 · MIT',
    heroTitle1: '统一沙箱 SDK',
    heroTitle2: '为 AI 智能体而生',
    heroDesc1: '一套 TypeScript 接口，四家云服务商。',
    heroDesc2: '零厂商锁定。',
    scroll: '向下滚动 ↓',
    quickStart: '快速开始',
    adapters: '适配器',
    adapterNote: '同一接口，一行代码切换。',
    multiAgent: '多智能体',
    multiTitle1: '创建。通信。',
    multiTitle2: '编排。',
    relay: '实时通信',
    context: '共享上下文',
    skills: '技能注入',
    install: '安装',
  },
  ja: {
    badge: 'v0.1.0 · オープンソース · MIT',
    heroTitle1: '統合サンドボックスSDK',
    heroTitle2: 'AIエージェントのための',
    heroDesc1: 'ひとつの TypeScript インターフェース、4つのクラウド。',
    heroDesc2: 'ベンダーロックインなし。',
    scroll: 'スクロール ↓',
    quickStart: 'クイックスタート',
    adapters: 'アダプター',
    adapterNote: '同じインターフェース。一行で切り替え。',
    multiAgent: 'マルチエージェント',
    multiTitle1: '生成。通信。',
    multiTitle2: 'オーケストレーション。',
    relay: 'リアルタイム通信',
    context: '共有コンテキスト',
    skills: 'スキル注入',
    install: 'インストール',
  },
} as const

export type TranslationKey = keyof (typeof translations)['en']

function detectLocale(): Locale {
  const stored = localStorage.getItem('lang') as Locale | null
  if (stored && locales.includes(stored)) return stored

  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('zh')) return 'zh'
  if (nav.startsWith('ja')) return 'ja'
  return 'en'
}

let currentLocale: Locale = 'en'
const listeners = new Set<() => void>()

export function initLocale() {
  currentLocale = detectLocale()
}

export function getLocale(): Locale {
  return currentLocale
}

export function setLocale(locale: Locale) {
  currentLocale = locale
  localStorage.setItem('lang', locale)
  listeners.forEach((fn) => fn())
}

export function t(key: TranslationKey): string {
  return translations[currentLocale][key]
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
