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
    // Cloud page
    cloudBadge: 'Managed · Bare-metal KVM · REST API',
    cloudHeroDesc1: 'Managed sandbox infrastructure for AI agents.',
    cloudHeroDesc2: 'Bare-metal KVM. Warm pool. Pay-per-use.',
    cloudForAgents: 'For AI Agents',
    cloudAgent: 'AI Agents',
    cloudAgentLabel: 'Autonomous Setup',
    cloudAgentDesc: 'Add this one line to your agent\'s system prompt. It will learn to create, execute, and manage sandboxes on its own.',
    cloudAgentInstruction: 'Add to your agent prompt',
    cloudAgentNote: 'The skill file contains complete API documentation, authentication setup, and usage examples. Your agent reads it once and operates autonomously.',
    cloudFeatures: 'Features',
    cloudSdk: 'TypeScript SDK',
    cloudApiTitle1: 'REST API.',
    cloudApiTitle2: 'Simple JSON. No SDK required.',
    cloudAuth: 'Pay-per-use',
    cloudAuthX402: 'No signup. No API key. Pay per request with USDC on Base via the x402 payment protocol. Fully automatic — your agent pays and retries in one round-trip.',
    cloudPorts: 'Port Forwarding',
    cloudFooter: 'Tokyo region',
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
    // Cloud page
    cloudBadge: '托管服务 · 裸金属 KVM · REST API',
    cloudHeroDesc1: '为 AI 智能体打造的托管沙箱基础设施。',
    cloudHeroDesc2: '裸金属 KVM 隔离，热池启动，按需付费。',
    cloudForAgents: 'AI 智能体',
    cloudAgent: 'AI 智能体',
    cloudAgentLabel: '自主配置',
    cloudAgentDesc: '在你的 Agent 系统提示词中加入这一行，它就能自主学会创建、执行和管理沙箱。',
    cloudAgentInstruction: '添加到 Agent 提示词',
    cloudAgentNote: 'Skill 文件包含完整的 API 文档、认证配置和使用示例。Agent 读取一次即可自主操作。',
    cloudFeatures: '特性',
    cloudSdk: 'TypeScript SDK',
    cloudApiTitle1: 'REST API',
    cloudApiTitle2: '简洁 JSON，无需 SDK。',
    cloudAuth: '按需付费',
    cloudAuthX402: '无需注册，无需 API Key。通过 x402 支付协议用 USDC 按次付费（Base 网络）。全自动 —— Agent 一次往返完成支付与请求。',
    cloudPorts: '端口转发',
    cloudFooter: '东京节点',
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
    // Cloud page
    cloudBadge: 'マネージド · ベアメタルKVM · REST API',
    cloudHeroDesc1: 'AIエージェントのためのマネージドサンドボックス。',
    cloudHeroDesc2: 'ベアメタルKVM。ウォームプール。従量課金。',
    cloudForAgents: 'AIエージェント',
    cloudAgent: 'AIエージェント',
    cloudAgentLabel: '自律セットアップ',
    cloudAgentDesc: 'エージェントのシステムプロンプトにこの1行を追加。サンドボックスの作成・実行・管理を自律的に学習します。',
    cloudAgentInstruction: 'エージェントプロンプトに追加',
    cloudAgentNote: 'Skillファイルには完全なAPIドキュメント、認証設定、使用例が含まれています。エージェントは一度読むだけで自律的に操作できます。',
    cloudFeatures: '特徴',
    cloudSdk: 'TypeScript SDK',
    cloudApiTitle1: 'REST API',
    cloudApiTitle2: 'シンプルなJSON。SDKは不要。',
    cloudAuth: '従量課金',
    cloudAuthX402: 'サインアップ不要。APIキー不要。x402支払いプロトコルでUSDCによる従量課金（Baseネットワーク）。完全自動 — エージェントが1往復で支払い・リクエストを完了。',
    cloudPorts: 'ポートフォワーディング',
    cloudFooter: '東京リージョン',
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
