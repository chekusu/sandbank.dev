// Build-time only (scripts/prerender.mjs): renders the public pages to HTML in English, so search engines and AI
// crawlers that do not run JavaScript read the page's words instead of an empty <div id="root">. The browser still
// renders the app itself with createRoot (src/main.tsx), which replaces this HTML.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import Home from './pages/home'
import Cloud from './pages/cloud'

const pages: Record<string, () => JSX.Element> = { '/': Home, '/cloud': Cloud }

export const paths = Object.keys(pages)

export function render(path: string): string {
  const Page = pages[path]
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  )
}
