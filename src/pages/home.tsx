import GridBackground from '@/components/grid-background'
import CodeBlock from '@/components/code-block'
import { useT, useLocale } from '@/hooks/use-i18n'
import { setLocale, locales, localeLabels, type Locale } from '@/i18n'

const providers = [
  { name: 'Daytona', arch: 'Full VM', cold: '~10s' },
  { name: 'Fly.io', arch: 'Firecracker microVM', cold: '~3-5s' },
  { name: 'Cloudflare', arch: 'V8 isolate + container', cold: '~1s' },
  { name: 'BoxLite', arch: 'Self-hosted Docker', cold: '~2-5s' },
]

function Mask({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative z-10 bg-surface/80 backdrop-blur-sm rounded-2xl px-6 py-5 -mx-6 ${className}`}>
      {children}
    </div>
  )
}

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
      <GridBackground />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10">
        <div className="flex items-center justify-between h-16">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-sand-400">sandbank</span>
          <div className="flex items-center gap-6">
            <a href="#start" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">Docs</a>
            <a href="https://github.com/chekusu/sandbank" target="_blank" rel="noopener noreferrer" className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors">GitHub</a>
            <LangSwitcher />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-end px-6 sm:px-10 pb-16">
        <Mask className="max-w-4xl space-y-6">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-text-muted">
            {t('badge')}
          </p>

          <h1 className="text-[clamp(2.5rem,7vw,5.5rem)] font-light leading-[1.05] tracking-[-0.03em]">
            {t('heroTitle1')}
            <br />
            <span className="text-sand-400">{t('heroTitle2')}</span>
          </h1>

          <p className="font-mono text-[0.8rem] text-text-muted max-w-md leading-relaxed opacity-60">
            {t('heroDesc1')}
            <br />
            {t('heroDesc2')}
          </p>
        </Mask>

        <div className="absolute bottom-6 right-6 sm:right-10 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted opacity-40">
          {t('scroll')}
        </div>
      </section>

      {/* Code */}
      <section className="px-6 sm:px-10 py-24">
        <Mask className="max-w-2xl">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('quickStart')}
          </p>

          <CodeBlock filename="sandbox.ts">{`import { createProvider } from '@sandbank/core'
import { DaytonaAdapter } from '@sandbank/daytona'

const provider = createProvider(
  new DaytonaAdapter({ apiKey: process.env.DAYTONA_API_KEY })
)

const sandbox = await provider.create({ image: 'node:22' })
const result = await sandbox.exec('echo "Hello from the sandbox"')
console.log(result.stdout) // Hello from the sandbox`}</CodeBlock>
        </Mask>
      </section>

      {/* Providers */}
      <section className="px-6 sm:px-10 py-24">
        <Mask className="max-w-2xl">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('adapters')}
          </p>

          <div className="space-y-0">
            {providers.map((p, i) => (
              <div
                key={p.name}
                className={`flex items-baseline justify-between py-5 ${i < providers.length - 1 ? 'border-b border-sand-400/10' : ''}`}
              >
                <div className="flex items-baseline gap-6">
                  <span className="text-xl font-light tracking-[-0.02em]">{p.name}</span>
                  <span className="font-mono text-[0.7rem] text-text-muted opacity-50">{p.arch}</span>
                </div>
                <span className="font-mono text-[0.7rem] text-text-muted">{p.cold}</span>
              </div>
            ))}
          </div>

          <p className="font-mono text-[0.65rem] text-text-muted opacity-40 mt-8">
            {t('adapterNote')}
          </p>
        </Mask>
      </section>

      {/* Multi-agent */}
      <section className="px-6 sm:px-10 py-24">
        <Mask className="max-w-2xl">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-4 opacity-50">
            {t('multiAgent')}
          </p>

          <h2 className="text-[clamp(1.5rem,4vw,2.8rem)] font-light leading-[1.1] tracking-[-0.02em] mb-12">
            {t('multiTitle1')}
            <br />
            <span className="text-text-muted">{t('multiTitle2')}</span>
          </h2>

          <CodeBlock filename="orchestrate.ts">{`const session = await createSession({
  provider,
  relay: { type: 'memory' }
})

const architect = await session.spawn('architect', { image: 'node:22' })
const developer = await session.spawn('developer', { image: 'node:22' })

await session.context.set('spec', {
  endpoints: ['/users', '/posts']
})

await session.waitForAll()`}</CodeBlock>

          <div className="flex gap-8 mt-10 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-text-muted opacity-50">
            <span>{t('relay')}</span>
            <span>{t('context')}</span>
            <span>{t('skills')}</span>
          </div>
        </Mask>
      </section>

      {/* Install */}
      <section id="start" className="px-6 sm:px-10 py-24">
        <Mask className="max-w-2xl">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted mb-12 opacity-50">
            {t('install')}
          </p>

          <div className="border-t border-sand-400/10 py-6">
            <code className="font-mono text-[0.85rem] text-text-secondary">
              pnpm add @sandbank/core @sandbank/daytona
            </code>
          </div>

          <div className="flex gap-6 mt-12">
            <a
              href="https://github.com/chekusu/sandbank"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-sand-400 hover:text-sand-300 transition-colors"
            >
              GitHub →
            </a>
            <a
              href="https://www.npmjs.com/org/sandbank"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary transition-colors"
            >
              npm →
            </a>
          </div>
        </Mask>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-10 border-t border-sand-400/8">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-text-muted opacity-40">
            sandbank · MIT
          </span>
          <span className="font-mono text-[0.6rem] text-text-muted opacity-30">
            v0.1.0
          </span>
        </div>
      </footer>
    </>
  )
}
