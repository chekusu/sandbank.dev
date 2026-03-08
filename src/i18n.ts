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
    getStarted: 'Get Started',
    scroll: 'Scroll ↓',
    docs: 'Docs',
    quickStart: 'Quick Start',
    adapters: 'Adapters',
    adapterNote: 'Same interface. Swap with one line.',
    providerSwap: 'Provider Hot-Swap',
    capabilityDetection: 'Capability Detection',
    multiAgent: 'Multi-Agent',
    multiTitle1: 'Spawn. Communicate.',
    multiTitle2: 'Orchestrate.',
    relay: 'Real-time relay',
    context: 'Shared context',
    skills: 'Skill injection',
    insideSandbox: 'Inside the Sandbox',
    packages: 'Packages',
    footerMit: 'sandbank · MIT',
  },
  zh: {
    badge: 'v0.1.0 · 开源 · MIT',
    heroTitle1: '统一沙箱 SDK',
    heroTitle2: '为 AI 智能体而生',
    heroDesc1: '一套 TypeScript 接口，四家云服务商。',
    heroDesc2: '零厂商锁定。',
    getStarted: '开始使用',
    scroll: '向下滚动 ↓',
    docs: '文档',
    quickStart: '快速开始',
    adapters: '适配器',
    adapterNote: '同一接口，一行代码切换。',
    providerSwap: '热切换 Provider',
    capabilityDetection: '能力检测',
    multiAgent: '多智能体',
    multiTitle1: '创建。通信。',
    multiTitle2: '编排。',
    relay: '实时通信',
    context: '共享上下文',
    skills: '技能注入',
    insideSandbox: '沙箱内部',
    packages: '安装包',
    footerMit: 'sandbank · MIT',
  },
  ja: {
    badge: 'v0.1.0 · オープンソース · MIT',
    heroTitle1: '統合サンドボックスSDK',
    heroTitle2: 'AIエージェントのための',
    heroDesc1: 'ひとつの TypeScript インターフェース、4つのクラウド。',
    heroDesc2: 'ベンダーロックインなし。',
    getStarted: 'はじめる',
    scroll: 'スクロール ↓',
    docs: 'ドキュメント',
    quickStart: 'クイックスタート',
    adapters: 'アダプター',
    adapterNote: '同じインターフェース。一行で切り替え。',
    providerSwap: 'プロバイダーのホットスワップ',
    capabilityDetection: '機能検出',
    multiAgent: 'マルチエージェント',
    multiTitle1: '生成。通信。',
    multiTitle2: 'オーケストレーション。',
    relay: 'リアルタイム通信',
    context: '共有コンテキスト',
    skills: 'スキル注入',
    insideSandbox: 'サンドボックス内部',
    packages: 'パッケージ',
    footerMit: 'sandbank · MIT',
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
