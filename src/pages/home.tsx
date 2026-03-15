import CustomCursor from '@/components/custom-cursor'
import AsciiCanvas from '@/components/ascii-canvas'
import CodeBlock from '@/components/code-block'
import { useT, useLocale } from '@/hooks/use-i18n'
import { setLocale, locales, localeLabels, type Locale } from '@/i18n'
import { Link } from 'react-router'

const providers = [
  { name: 'Sandbank Cloud', arch: 'Managed KVM', cold: '< 1 s', caps: 'exec · port.expose · snapshot · browser' },
  { name: 'Daytona', arch: 'Full VM', cold: '~10 s', caps: 'port.expose · terminal · volumes' },
  { name: 'Fly.io', arch: 'Firecracker microVM', cold: '~3-5 s', caps: 'exec.stream · port.expose' },
  { name: 'Cloudflare', arch: 'V8 isolate + container', cold: '~1 s', caps: 'exec.stream · snapshot · sleep · port.expose' },
  { name: 'BoxLite', arch: 'Bare-metal KVM', cold: '~2-5 s', caps: 'exec.stream · snapshot · sleep' },
  { name: 'DB9', arch: 'OrbStack microVM', cold: '~1-2 s', caps: 'exec · port.expose · snapshot' },
]

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

export default function Home() {
  const t = useT()

  return (
    <>
      <CustomCursor />

      {/* ── First screen: Hero + Waves ── */}
      <section className="relative h-screen flex flex-col overflow-hidden">
        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 sm:px-12 h-16">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-sand-400">sandbank</span>
          <div className="flex items-center gap-6">
            <Link to="/cloud" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-sand-400 hover:text-sand-400/80 transition-colors">{t('cloud')}</Link>
            <a href="#start" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">{t('docs')}</a>
            <a href="https://github.com/chekusu/sandbank" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">GitHub</a>
            <LangSwitcher />
          </div>
        </nav>

        {/* Hero — centered */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-muted mb-6">
            {t('badge')}
          </p>
          <h1 className="hero-title text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05] tracking-[-0.03em] mb-4">
            {t('heroTitle1')}
            <br />
            <span className="text-sand-400">{t('heroTitle2')}</span>
          </h1>
          <p className="font-mono text-[0.8rem] text-text-muted max-w-md leading-relaxed opacity-60 mb-8">
            {t('heroDesc1')}
            <br />
            {t('heroDesc2')}
          </p>
          <a
            href="#start"
            className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-sand-400 border border-sand-400/30 px-6 py-2.5 rounded-full hover:bg-sand-400/10 transition-colors"
          >
            {t('getStarted')}
          </a>
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

      {/* ── Content below fold ── */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10">

        {/* Quick Start */}
        <section id="start" className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('quickStart')}
          </p>

          <div className="border-t border-sand-400/10 py-6 mb-8">
            <code className="font-mono text-[0.85rem] text-text-secondary">
              pnpm add @sandbank.dev/core @sandbank.dev/daytona
            </code>
          </div>

          <CodeBlock filename="sandbox.ts">{`import { createProvider } from '@sandbank.dev/core'
import { DaytonaAdapter } from '@sandbank.dev/daytona'

const provider = createProvider(
  new DaytonaAdapter({ apiKey: process.env.DAYTONA_API_KEY })
)

const sandbox = await provider.create({ image: 'node:22' })
const result = await sandbox.exec('echo "Hello from the sandbox"')
console.log(result.stdout) // Hello from the sandbox

await provider.destroy(sandbox.id)`}</CodeBlock>
        </section>

        {/* Adapters */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('adapters')}
          </p>

          <div className="space-y-0">
            {providers.map((p, i) => (
              <div
                key={p.name}
                className={`py-5 ${i < providers.length - 1 ? 'border-b border-sand-400/10' : ''}`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xl font-light tracking-[-0.02em]">{p.name}</span>
                  <span className="font-mono text-[0.7rem] text-text-muted">{p.cold}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[0.7rem] text-text-muted opacity-50">{p.arch}</span>
                  <span className="font-mono text-[0.6rem] text-text-muted opacity-40">{p.caps}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('adapterNote')}
          </p>
        </section>

        {/* Swap Provider */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('providerSwap')}
          </p>

          <CodeBlock filename="swap.ts">{`// Switch from Daytona to Fly.io — zero code change
import { FlyioAdapter } from '@sandbank.dev/flyio'

const provider = createProvider(
  new FlyioAdapter({
    apiToken: process.env.FLY_API_TOKEN,
    appName: 'my-sandbox-pool',
  })
)

// Same API — create, exec, destroy
const sandbox = await provider.create({ image: 'python:3.12' })
await sandbox.exec('pip install numpy && python -c "import numpy; print(numpy.__version__)"')`}</CodeBlock>
        </section>

        {/* Capabilities */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('capabilityDetection')}
          </p>

          <CodeBlock filename="capabilities.ts">{`import { withStreaming, withPortExpose, withSnapshot } from '@sandbank.dev/core'

// Check capabilities at runtime
if (provider.capabilities.has('port.expose')) {
  const portSandbox = withPortExpose(sandbox)!
  const { url } = await portSandbox.exposePort(3000)
  console.log(\`Preview: \${url}\`)
}

// Safe narrowing — returns null if unsupported
const streamable = withStreaming(sandbox)
if (streamable) {
  const stream = await streamable.execStream('tail -f /var/log/app.log')
}`}</CodeBlock>
        </section>

        {/* Multi-Agent */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('multiAgent')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            {t('multiTitle1')}
            <br />
            <span className="text-text-muted">{t('multiTitle2')}</span>
          </h2>

          <CodeBlock filename="orchestrate.ts">{`import { createSession } from '@sandbank.dev/core'

const session = await createSession({
  provider,
  relay: { type: 'memory' },
})

const architect = await session.spawn('architect', { image: 'node:22' })
const developer = await session.spawn('developer', { image: 'node:22' })

// Shared context — visible to all sandboxes
await session.context.set('spec', {
  endpoints: ['/users', '/posts'],
  database: 'postgresql',
})

// Wait for all agents to complete
const results = await session.waitForAll()
console.log(results) // [{ name: 'architect', status: 'success' }, ...]`}</CodeBlock>

          <div className="flex gap-8 mt-10 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted opacity-50">
            <span>{t('relay')}</span>
            <span>{t('context')}</span>
            <span>{t('skills')}</span>
          </div>
        </section>

        {/* Agent Client */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('insideSandbox')}
          </p>

          <CodeBlock filename="agent.ts">{`// Code running inside the sandbox
import { connect } from '@sandbank.dev/agent'

const session = await connect() // auto-reads env vars

session.on('message', async (msg) => {
  if (msg.type === 'task') {
    const result = await executeTask(msg.payload)
    await session.send(msg.from, 'task_result', result)
  }
})

// Signal completion
await session.complete({ status: 'success', summary: 'Built 3 endpoints' })`}</CodeBlock>
        </section>

        {/* Install */}
        <section className="py-24">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('packages')}
          </p>

          <div className="space-y-4 font-mono text-[0.8rem] text-text-secondary">
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">core</span>
              pnpm add @sandbank.dev/core
            </div>
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">cloud</span>
              pnpm add @sandbank.dev/cloud
            </div>
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">daytona</span>
              pnpm add @sandbank.dev/daytona
            </div>
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">flyio</span>
              pnpm add @sandbank.dev/flyio
            </div>
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">cloudflare</span>
              pnpm add @sandbank.dev/cloudflare
            </div>
            <div className="border-t border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">boxlite</span>
              pnpm add @sandbank.dev/boxlite
            </div>
            <div className="border-t border-b border-sand-400/10 py-4">
              <span className="text-text-muted text-[0.65rem] mr-4">db9</span>
              pnpm add @sandbank.dev/db9
            </div>
          </div>

          <div className="flex gap-6 mt-12">
            <a
              href="https://github.com/chekusu/sandbank"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline font-mono text-[0.7rem] uppercase tracking-[0.1em]"
            >
              GitHub →
            </a>
            <a
              href="https://www.npmjs.com/package/sandbank"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline font-mono text-[0.7rem] uppercase tracking-[0.1em] !text-text-muted"
            >
              npm →
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-sand-400/8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted opacity-40">
              {t('footerMit')}
            </span>
            <span className="font-mono text-[0.6rem] text-text-muted opacity-30">
              v0.2.0
            </span>
          </div>
        </footer>
      </div>
    </>
  )
}
