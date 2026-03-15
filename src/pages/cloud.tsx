import { useState, useEffect } from 'react'
import CustomCursor from '@/components/custom-cursor'
import AsciiCanvas from '@/components/ascii-canvas'
import CodeBlock from '@/components/code-block'
import { useT, useLocale } from '@/hooks/use-i18n'
import { setLocale, locales, localeLabels, type Locale } from '@/i18n'
import { Link } from 'react-router'

function LangSwitcher() {
  const current = useLocale()
  return (
    <div className="flex items-center gap-1">
      {locales.map((loc: Locale) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          className={`font-mono text-[0.6rem] uppercase tracking-[0.1em] px-2 py-1 transition-colors ${
            loc === current
              ? 'text-sand-400'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {localeLabels[loc]}
        </button>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="font-mono text-[0.6rem] uppercase tracking-[0.1em] px-3 py-1.5 border border-sand-400/20 rounded-lg text-sand-400 hover:bg-sand-400/10 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function StatusBadge() {
  const t = useT()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    const check = () => {
      fetch('https://cloud.sandbank.dev/health', { mode: 'cors' })
        .then(r => r.ok ? setStatus('online') : setStatus('offline'))
        .catch(() => setStatus('offline'))
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  const color = status === 'online' ? 'bg-emerald-400' : status === 'offline' ? 'bg-red-400' : 'bg-text-muted'
  const label = status === 'online' ? t('cloudStatusOnline') : status === 'offline' ? t('cloudStatusOffline') : t('cloudStatusChecking')

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color} ${status === 'online' ? 'animate-pulse' : ''}`} />
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-muted opacity-60">{label}</span>
    </span>
  )
}

const SKILL_LINE = 'Read https://cloud.sandbank.dev/skill.md and follow instructions'

export default function Cloud() {
  const t = useT()

  const features = [
    { label: 'KVM', value: t('cloudFeatureKvm') },
    { label: 'Warm Pool', value: t('cloudFeatureWarmPool') },
    { label: 'Browser', value: t('cloudFeatureBrowser') },
    { label: 'DB9', value: t('cloudFeatureDb9') },
    { label: 'WebSocket', value: t('cloudFeatureWs') },
    { label: 'x402', value: t('cloudFeatureX402') },
  ]

  const endpoints = [
    { method: 'POST', path: '/v1/boxes', desc: t('cloudEndpointCreate'), price: '$0.02' },
    { method: 'GET', path: '/v1/boxes', desc: t('cloudEndpointList') },
    { method: 'GET', path: '/v1/boxes/:id', desc: t('cloudEndpointGet') },
    { method: 'POST', path: '/v1/boxes/:id/exec', desc: t('cloudEndpointExec') },
    { method: 'POST', path: '/v1/boxes/:id/keep', desc: t('cloudEndpointKeep'), price: '$0.02' },
    { method: 'PUT', path: '/v1/boxes/:id/files?path=/', desc: t('cloudEndpointUpload') },
    { method: 'GET', path: '/v1/boxes/:id/files?path=/', desc: t('cloudEndpointDownload') },
    { method: 'DELETE', path: '/v1/boxes/:id', desc: t('cloudEndpointDestroy') },
    { method: 'ALL', path: '/v1/boxes/:id/proxy/:port/*', desc: t('cloudEndpointProxy') },
  ]

  return (
    <>
      <CustomCursor />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 sm:px-12 h-16">
          <Link to="/" className="font-mono text-xs uppercase tracking-[0.15em] text-sand-400">sandbank</Link>
          <div className="flex items-center gap-6">
            <a href="#agent" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">{t('cloudAgent')}</a>
            <a href="#browser" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">{t('cloudBrowser')}</a>
            <a href="#db9" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">DB9</a>
            <a href="#pricing" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">{t('cloudPricing')}</a>
            <a href="#api" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">{t('cloudApiRef')}</a>
            <a href="https://github.com/chekusu/sandbank" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">GitHub</a>
            <LangSwitcher />
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-muted mb-6">
            {t('cloudBadge')}
          </p>
          <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05] tracking-[-0.03em] mb-4">
            Sandbank
            <br />
            <span className="text-sand-400">Cloud</span>
          </h1>
          <p className="font-mono text-[0.8rem] text-text-muted max-w-lg leading-relaxed opacity-60 mb-8">
            {t('cloudHeroDesc1')}
            <br />
            {t('cloudHeroDesc2')}
          </p>
          <div className="flex gap-4 mb-10">
            <a
              href="#agent"
              className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-sand-400 border border-sand-400/30 px-6 py-2.5 rounded-full hover:bg-sand-400/10 transition-colors"
            >
              {t('cloudForAgents')}
            </a>
            <a
              href="#pricing"
              className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-muted border border-text-muted/20 px-6 py-2.5 rounded-full hover:bg-text-muted/5 transition-colors"
            >
              {t('cloudPricing')}
            </a>
          </div>

          {/* Speed + Price callout */}
          <div className="flex items-center gap-8">
            <div className="text-center">
              <span className="block font-mono text-2xl text-sand-400 tracking-tight">{t('cloudSpeed')}</span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-muted opacity-50">{t('cloudSpeedLabel')}</span>
            </div>
            <div className="w-px h-8 bg-sand-400/20" />
            <div className="text-center">
              <span className="block font-mono text-2xl text-sand-400 tracking-tight">$0.02</span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-muted opacity-50">{t('cloudPerSandbox')}</span>
            </div>
          </div>
        </div>

        {/* Waves — pinned to bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none">
          <AsciiCanvas />
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted opacity-40 z-10">
          {t('scroll')}
        </div>
      </section>

      {/* ── Content ── */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10">

        {/* ── AI Agents ── */}
        <section id="agent" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudAgent')}
          </p>

          <div className="border border-sand-400/20 rounded-2xl p-8 sm:p-12 bg-sand-400/[0.03]">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand-400 mb-4">
              {t('cloudAgentLabel')}
            </p>
            <p className="text-[1.1rem] leading-relaxed mb-6">
              {t('cloudAgentDesc')}
            </p>
            <div className="border border-sand-400/15 rounded-xl bg-surface-raised p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-muted">{t('cloudAgentInstruction')}</p>
                <CopyButton text={SKILL_LINE} />
              </div>
              <code className="font-mono text-[0.9rem] text-sand-400 break-all">
                {SKILL_LINE}
              </code>
            </div>
            <p className="font-mono text-[0.7rem] text-text-muted opacity-60 leading-relaxed">
              {t('cloudAgentNote')}
            </p>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('cloudPricing')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            <span className="text-sand-400">{t('cloudPricingTitle1')}</span>
            <br />
            <span className="text-text-muted">{t('cloudPricingTitle2')}</span>
          </h2>

          <div className="space-y-0 mb-8">
            <div className="border-t border-sand-400/10 py-5 flex items-baseline justify-between">
              <div>
                <span className="text-lg font-light">{t('cloudPricingCreate')}</span>
                <span className="font-mono text-[0.65rem] text-text-muted ml-3">{t('cloudPricingIncludes')}</span>
              </div>
              <span className="font-mono text-xl text-sand-400">{t('cloudPricingCreatePrice')}</span>
            </div>
            <div className="border-t border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="text-lg font-light">{t('cloudPricingKeep')}</span>
              <span className="font-mono text-xl text-sand-400">{t('cloudPricingKeepPrice')}</span>
            </div>
            <div className="border-t border-b border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="text-lg font-light">{t('cloudPricingExec')}</span>
              <span className="font-mono text-xl text-emerald-400/70">{t('cloudPricingFree')}</span>
            </div>
          </div>

          <p className="font-mono text-[0.75rem] text-text-muted leading-relaxed mb-6">
            {t('cloudPricingDesc')}
          </p>

          <p className="font-mono text-[0.6rem] text-text-muted opacity-40">
            {t('cloudPricingProtocol')}
          </p>
        </section>

        {/* ── Resource Limits ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudLimits')}
          </p>

          <div className="space-y-0">
            <div className="border-t border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="font-mono text-[0.75rem] text-text-muted">CPU</span>
              <span className="font-mono text-lg text-text-secondary">{t('cloudLimitsCpu')}</span>
            </div>
            <div className="border-t border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="font-mono text-[0.75rem] text-text-muted">Memory</span>
              <span className="font-mono text-lg text-text-secondary">{t('cloudLimitsMem')}</span>
            </div>
            <div className="border-t border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="font-mono text-[0.75rem] text-text-muted">Session</span>
              <span className="font-mono text-lg text-text-secondary">{t('cloudLimitsSession')}</span>
            </div>
            <div className="border-t border-b border-sand-400/10 py-5 flex items-baseline justify-between">
              <span className="font-mono text-[0.75rem] text-text-muted">Disk</span>
              <span className="font-mono text-lg text-text-secondary">{t('cloudLimitsDisk')}</span>
            </div>
          </div>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('cloudLimitsNote')}
          </p>
        </section>

        {/* ── Default Image ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudImage')}
          </p>

          <div className="border border-sand-400/20 rounded-2xl p-8 sm:p-12 bg-sand-400/[0.03]">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-mono text-2xl text-sand-400 tracking-tight">{t('cloudImageName')}</span>
              <div className="flex gap-2">
                <span className="font-mono text-[0.6rem] px-2 py-0.5 rounded border border-sand-400/20 text-sand-400">Claude Code</span>
                <span className="font-mono text-[0.6rem] px-2 py-0.5 rounded border border-sand-400/20 text-sand-400">Codex</span>
              </div>
            </div>
            <p className="text-[1rem] text-text-muted leading-relaxed mt-4 mb-6">
              {t('cloudImageDesc')}
            </p>
            <div className="space-y-0">
              <div className="border-t border-sand-400/10 py-3 flex items-baseline gap-3">
                <span className="font-mono text-[0.65rem] text-sand-400 uppercase w-16">7681</span>
                <span className="font-mono text-[0.75rem] text-text-muted">{t('cloudImageTerminal')}</span>
              </div>
              <div className="border-t border-b border-sand-400/10 py-3 flex items-baseline gap-3">
                <span className="font-mono text-[0.65rem] text-sand-400 uppercase w-16">8080</span>
                <span className="font-mono text-[0.75rem] text-text-muted">{t('cloudImageWeb')}</span>
              </div>
            </div>
            <p className="font-mono text-[0.6rem] text-text-muted opacity-30 mt-6 leading-relaxed">
              {t('cloudImageDetail')}
            </p>
            <p className="font-mono text-[0.6rem] text-text-muted opacity-30 mt-2">
              {t('cloudImageNote')}
            </p>
          </div>
        </section>

        {/* ── Browser Automation ── */}
        <section id="browser" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('cloudBrowser')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            <span className="text-sand-400">{t('cloudBrowserTitle1')}</span>
            <br />
            <span className="text-text-muted">{t('cloudBrowserTitle2')}</span>
          </h2>

          {/* Two modes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            <div className="border border-sand-400/20 rounded-2xl p-6 sm:p-8 bg-sand-400/[0.03]">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-lg text-sand-400">Lightpanda</span>
                <span className="font-mono text-[0.6rem] px-2 py-0.5 rounded border border-emerald-400/30 text-emerald-400/70">{t('cloudBrowserDefault')}</span>
              </div>
              <p className="font-mono text-[0.75rem] text-text-muted leading-relaxed mb-4">
                {t('cloudBrowserLightpandaDesc')}
              </p>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserLpFast')}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserLpLight')}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-text-muted/40">–</span>
                  <span className="font-mono text-[0.65rem] text-text-muted opacity-50">{t('cloudBrowserLpLimit')}</span>
                </div>
              </div>
            </div>

            <div className="border border-sand-400/20 rounded-2xl p-6 sm:p-8 bg-sand-400/[0.03]">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-lg text-sand-400">Browserbox</span>
                <span className="font-mono text-[0.6rem] px-2 py-0.5 rounded border border-sand-400/20 text-sand-400">--chrome</span>
              </div>
              <p className="font-mono text-[0.75rem] text-text-muted leading-relaxed mb-4">
                {t('cloudBrowserBoxDesc')}
              </p>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserBoxFull')}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserBoxSnap')}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserBoxAuth')}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.6rem] text-emerald-400/70">+</span>
                  <span className="font-mono text-[0.65rem] text-text-muted">{t('cloudBrowserBoxShot')}</span>
                </div>
              </div>
            </div>
          </div>

          <CodeBlock filename="browser-automation.sh" lang="bash">{`# Default: Lightpanda (fast, in-sandbox)
browser open https://docs.example.com
browser snapshot -i              # accessibility tree with refs
browser click @e2                # interact by ref
browser screenshot               # save PNG to /tmp/screenshot.png

# Chrome mode: real browser for complex sites
browser open --chrome https://app.example.com/login
browser fill @e1 "user@email.com"
browser fill @e2 "password"
browser click @e3                # submit login
browser screenshot               # visual confirmation
browser save logged-in           # snapshot VM state
browser destroy                  # back to Lightpanda`}</CodeBlock>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('cloudBrowserNote')}
          </p>
        </section>

        {/* ── DB9 ── */}
        <section id="db9" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('cloudDb9')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            <span className="text-sand-400">{t('cloudDb9Title1')}</span>
            <br />
            <span className="text-text-muted">{t('cloudDb9Title2')}</span>
          </h2>

          <div className="border border-sand-400/20 rounded-2xl p-8 sm:p-12 bg-sand-400/[0.03] mb-8">
            <div className="flex items-baseline gap-4 mb-2">
              <span className="font-mono text-2xl text-sand-400 tracking-tight">db9</span>
              <a href="https://db9.ai" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.6rem] px-2 py-0.5 rounded border border-sand-400/20 text-sand-400 hover:bg-sand-400/10 transition-colors">db9.ai</a>
            </div>
            <p className="text-[1rem] text-text-muted leading-relaxed mt-4 mb-6">
              {t('cloudDb9Desc')}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.65rem] text-text-muted opacity-50">
              <span>PostgreSQL 17</span>
              <span>pgvector</span>
              <span>pg_cron</span>
              <span>fs9</span>
              <span>HTTP ext</span>
              <span>{t('cloudDb9Fts')}</span>
            </div>
          </div>

          <CodeBlock filename="db9-in-sandbox.sh" lang="bash">{`# db9 CLI is pre-installed in every codebox

# Create a database (zero-setup trial on first use)
db9 db create --name myapp

# Execute SQL
db9 db sql myapp -q "CREATE TABLE users (id serial, name text, email text)"
db9 db sql myapp -q "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com')"

# Vector search with pgvector
db9 db sql myapp -q "CREATE EXTENSION vector"
db9 db sql myapp -q "ALTER TABLE users ADD COLUMN embedding vector(1536)"

# Branch a database for isolated testing
db9 branch create myapp --name experiment

# Or connect directly with psql
psql $DATABASE_URL -c "SELECT * FROM users"`}</CodeBlock>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('cloudDb9Note')}
          </p>
        </section>

        {/* ── Features ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudFeatures')}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0">
            {features.map((f, i) => (
              <div
                key={f.label}
                className={`py-5 px-1 ${i < features.length - (features.length % 3 || 3) ? 'border-b border-sand-400/10' : ''}`}
              >
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-sand-400 block mb-1">{f.label}</span>
                <span className="font-mono text-[0.75rem] text-text-muted">{f.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Quick Start ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('quickStart')}
          </p>

          <CodeBlock filename="create.sh" lang="bash">{`# Create a sandbox — x402 payment is handled automatically
# The server returns 402 with payment details, your x402 client pays and retries
curl -X POST https://cloud.sandbank.dev/v1/boxes \\
  -H "Content-Type: application/json" \\
  -d '{"image": "codebox", "cpu": 2, "memory_mb": 1024}'

# → {"id": "aQscOYX87tSq", "status": "running", ...}`}</CodeBlock>

          <div className="h-8" />

          <CodeBlock filename="exec.sh" lang="bash">{`# Execute a command (free after sandbox is created)
curl -X POST https://cloud.sandbank.dev/v1/boxes/aQscOYX87tSq/exec \\
  -H "Content-Type: application/json" \\
  -d '{"cmd": ["echo", "Hello from the sandbox"]}'

# → {"exit_code": 0, "stdout": "Hello from the sandbox\\n", ...}`}</CodeBlock>

          <div className="h-8" />

          <CodeBlock filename="destroy.sh" lang="bash">{`# Destroy when done (free)
curl -X DELETE https://cloud.sandbank.dev/v1/boxes/aQscOYX87tSq`}</CodeBlock>
        </section>

        {/* ── With SDK ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudSdk')}
          </p>

          <CodeBlock filename="sandbox.ts">{`import { createProvider } from '@sandbank.dev/core'
import { SandbankCloudAdapter } from '@sandbank.dev/cloud'

const provider = createProvider(
  new SandbankCloudAdapter({
    // x402: pay $0.02/sandbox with USDC on Base
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY,

    // Or use API token (bypasses x402 payment)
    // apiToken: process.env.SANDBANK_API_TOKEN,
  })
)

const sandbox = await provider.create({
  image: 'codebox',
  resources: { cpu: 2, memory: 1024 },
  ports: [[0, 7681], [0, 8080]],
})

const { stdout } = await sandbox.exec('node -e "console.log(42)"')
console.log(stdout) // 42

await provider.destroy(sandbox.id)`}</CodeBlock>
        </section>

        {/* ── API Reference ── */}
        <section id="api" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('cloudApiRef')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            {t('cloudApiTitle1')}
            <br />
            <span className="text-text-muted">{t('cloudApiTitle2')}</span>
          </h2>

          <div className="space-y-0">
            {endpoints.map((ep, i) => (
              <div
                key={`${ep.method}-${ep.path}`}
                className={`py-4 ${i < endpoints.length - 1 ? 'border-b border-sand-400/10' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  <span className={`font-mono text-[0.65rem] uppercase tracking-wider w-12 ${
                    ep.method === 'POST' ? 'text-sand-400' :
                    ep.method === 'DELETE' ? 'text-red-400/70' :
                    ep.method === 'GET' ? 'text-emerald-400/70' :
                    ep.method === 'PUT' ? 'text-blue-400/70' :
                    'text-text-muted'
                  }`}>{ep.method}</span>
                  <code className="font-mono text-[0.8rem] text-text-secondary">{ep.path}</code>
                  {ep.price && (
                    <span className="font-mono text-[0.6rem] text-sand-400/60">{ep.price}</span>
                  )}
                </div>
                <p className="font-mono text-[0.65rem] text-text-muted opacity-50 ml-[3.75rem] mt-1">{ep.desc}</p>
              </div>
            ))}
          </div>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('cloudBaseUrl')}: https://cloud.sandbank.dev
          </p>
        </section>

        {/* ── Port Forwarding ── */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('cloudPorts')}
          </p>

          <CodeBlock filename="ports.sh" lang="bash">{`# Create sandbox with port forwarding
curl -X POST https://cloud.sandbank.dev/v1/boxes \\
  -H "Content-Type: application/json" \\
  -d '{"image": "codebox", "ports": [[0, 8080], [0, 7681]]}'

# → {"id": "abc", "ports": {"8080": 10042, "7681": 10043}, ...}

# Access guest port 8080 via HTTP proxy
curl https://cloud.sandbank.dev/v1/boxes/abc/proxy/8080/

# Or connect directly to host port
curl http://cloud.sandbank.dev:10042/`}</CodeBlock>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-sand-400/8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-4 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted opacity-40">
              <span>sandbank cloud · {t('cloudFooter')}</span>
              <StatusBadge />
            </span>
            <Link to="/" className="link-underline font-mono text-[0.6rem] uppercase tracking-[0.1em]">
              sandbank.dev →
            </Link>
          </div>
        </footer>
      </div>
    </>
  )
}
