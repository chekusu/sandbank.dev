import { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'

export default function CodeBlock({ filename, children, lang = 'typescript' }: { filename: string; children: string; lang?: string }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    codeToHtml(children.trim(), {
      lang,
      theme: 'vitesse-dark',
    }).then(setHtml)
  }, [children, lang])

  return (
    <div className="relative">
      <span className="absolute -top-3 left-4 px-2 bg-surface text-[0.6rem] font-mono uppercase tracking-widest text-text-muted z-10">
        {filename}
      </span>
      {html ? (
        <div
          className="code-block-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="!rounded-xl border border-sand-400/10 !bg-surface-raised !px-6 !py-6">
          <code className="text-[0.8rem] leading-[1.8] text-text-secondary">{children}</code>
        </pre>
      )}
    </div>
  )
}
