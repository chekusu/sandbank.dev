// Runs after `vite build`: writes each public page's HTML into the built index.html (see src/entry-prerender.tsx).
import { build } from 'vite'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'node_modules/.prerender')
rmSync(outDir, { recursive: true, force: true })
await build({ root, logLevel: 'warn', build: { ssr: 'src/entry-prerender.tsx', outDir, emptyOutDir: true } })
const { render, paths } = await import(pathToFileURL(join(outDir, 'entry-prerender.js')).href)

const template = readFileSync(join(root, 'dist/index.html'), 'utf8')
if (!template.includes('<div id="root"></div>')) throw new Error('dist/index.html has no empty #root to fill')
for (const path of paths) {
  const html = template.replace('<div id="root"></div>', `<div id="root">${render(path)}</div>`)
  const file = path === '/' ? join(root, 'dist/index.html') : join(root, 'dist', `${path}.html`)  // /cloud → cloud.html, served at /cloud with no redirect
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  console.log(`prerender: ${path} → ${file.slice(root.length + 1)} (${html.length} bytes)`)
}
