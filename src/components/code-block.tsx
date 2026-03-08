export default function CodeBlock({ filename, children }: { filename: string; children: string }) {
  return (
    <div className="relative">
      <span className="absolute -top-3 left-4 px-2 bg-surface text-[0.6rem] font-mono uppercase tracking-widest text-text-muted">
        {filename}
      </span>
      <pre className="!rounded-none !border-x-0 !border-t border-b border-sand-400/10 !bg-transparent !px-0 !py-6">
        <code className="text-[0.8rem] leading-[1.8] text-text-secondary">{children}</code>
      </pre>
    </div>
  )
}
