import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from '@clerk/clerk-react'
import { localeLabels, localeNames, locales, setLocale, type Locale } from '@/i18n'
import { useLocale, useT } from '@/hooks/use-i18n'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const API_BASE = (import.meta.env.VITE_SANDBANK_API_BASE as string | undefined) || 'https://api.sandbank.dev'
const PANEL_ROOT = '/panel'

type PanelSection = 'overview' | 'boxes' | 'relay' | 'billing' | 'api-keys' | 'project-settings'

interface BootstrapResponse {
  tenant: { id: string; name: string; slug: string; created_at?: string }
  projects: Project[]
  project_nodes?: ProjectNode[]
  current_project: Project | null
  billing: BillingAccount
  api_keys: ApiKey[]
  initial_api_key: string | null
}

interface SummaryResponse {
  current_project?: Project
  projects?: Project[]
  billing: BillingAccount
  counts: {
    boxes: number
    running: number
    stopped: number
    error: number
    addons: number
    relay_links: number
  }
  recent_boxes: PanelBox[]
  relay_graph: RelayGraph
}

interface BillingDetailResponse {
  billing: BillingAccount
  ledger: LedgerEntry[]
  topups: TopupRecord[]
  prices: {
    box_create_cents: number
    box_keep_cents: number
  }
}

interface Project {
  id: string
  tenant_id?: string
  name: string
  slug: string
  node_id?: string
  server_name?: string
  region?: string
  country_code?: string
  flag_emoji?: string
  placement?: {
    node_id?: string
    server_name?: string
    region?: string
    country_code?: string
    flag_emoji?: string
  }
  created_at?: string
}

interface ProjectNode {
  node_id: string
  server_name: string
  region: string
  country_code: string
  flag_emoji?: string
}

interface BillingAccount {
  has_card: boolean
  card_brand: string | null
  card_last4: string | null
  currency: string
  balance_cents: number
  auto_topup_enabled: boolean
  auto_topup_threshold_cents: number
  auto_topup_amount_cents: number
}

interface LedgerEntry {
  id: string
  kind: string
  amount_cents: number
  balance_after_cents: number
  box_id: string | null
  description: string | null
  created_at: string
}

interface TopupRecord {
  id: string
  amount_cents: number
  status: string
  reason: string
  error: string | null
  created_at: string
}

interface ApiKey {
  id: string
  project_id: string | null
  prefix: string
  name: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

interface PanelBox {
  id: string
  type: string
  status: string
  image: string
  cpu: number
  memory_mb: number
  created_at: string
  last_active: string
  relay_name: string | null
  owner_box_id: string | null
  addon_type: string | null
  ports: Record<string, number> | null
  terminal?: { publisherConnected: boolean; viewerCount: number }
}

interface RelayGraph {
  nodes: Array<{ id: string; label: string; type: string; status: string; relay_name: string | null }>
  edges: Array<{ from: string | null; to: string; type: string; relay_name: string | null }>
}

type RelayCatalogKind = 'functional' | 'public-node'
type RelayCanvasNodeKind = 'project' | 'functional' | 'public-node' | 'empty'
type RelayCanvasEdgeKind = 'live' | 'available'

interface RelayCatalogItem {
  id: string
  kind: RelayCatalogKind
  title: string
  description: string
  relation: string
  meta: string
}

interface RelayCanvasNode {
  id: string
  kind: RelayCanvasNodeKind
  title: string
  subtitle: string
  eyebrow: string
  meta: string
  status?: string
  x: number
  y: number
  width: number
  height: number
}

interface RelayCanvasEdge {
  id: string
  from: string
  to: string
  label: string
  kind: RelayCanvasEdgeKind
}

export default function Panel() {
  const t = useT()
  const redirectUrl = getPanelRedirectUrl()

  if (!CLERK_KEY) {
    return (
      <PanelFrame>
        <div className="flex min-h-screen flex-col px-5 py-6 sm:px-8">
          <AuthTopbar />
          <div className="flex flex-1 items-center">
            <div className="max-w-xl border border-sand-400/20 bg-sand-400/[0.03] p-8">
              <p className="mb-4 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sand-400">
                {t('panelSetup')}
              </p>
              <h1 className="mb-4 text-3xl font-normal">{t('panelClerkMissing')}</h1>
              <p className="font-mono text-[0.75rem] leading-relaxed text-text-muted">
                {t('panelClerkMissingDesc')}
              </p>
            </div>
          </div>
        </div>
      </PanelFrame>
    )
  }

  return (
    <PanelFrame>
      <SignedOut>
        <div className="flex min-h-screen flex-col px-5 py-6 sm:px-8">
          <AuthTopbar />
          <div className="flex flex-1 items-center">
            <div className="max-w-xl">
              <p className="mb-5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">
                Sandbank {t('panel')}
              </p>
              <h1 className="mb-5 text-[clamp(2rem,5vw,4rem)] font-normal leading-tight">
                {t('panelSignedOutTitle')}
              </h1>
              <p className="mb-8 font-mono text-[0.78rem] leading-relaxed text-text-muted">
                {t('panelSignedOutDesc')}
              </p>
              <div className="flex flex-wrap gap-3">
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={redirectUrl}
                  fallbackRedirectUrl={redirectUrl}
                  signUpForceRedirectUrl={redirectUrl}
                  signUpFallbackRedirectUrl={redirectUrl}
                >
                  <button className="panel-button-primary">{t('panelSignIn')}</button>
                </SignInButton>
                <SignUpButton
                  mode="modal"
                  forceRedirectUrl={redirectUrl}
                  fallbackRedirectUrl={redirectUrl}
                  signInForceRedirectUrl={redirectUrl}
                  signInFallbackRedirectUrl={redirectUrl}
                >
                  <button className="panel-button-secondary">{t('panelCreateTenant')}</button>
                </SignUpButton>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <PanelDashboard />
      </SignedIn>
    </PanelFrame>
  )
}

function PanelDashboard() {
  const t = useT()
  const locale = useLocale()
  const location = useLocation()
  const { getToken, isSignedIn } = useAuth()
  const section = sectionFromPath(location.pathname)
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [boxes, setBoxes] = useState<PanelBox[]>([])
  const [billingDetail, setBillingDetail] = useState<BillingDetailResponse | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('sandbank.panel.projectId')
  })
  const [projectName, setProjectName] = useState('')
  const [projectNodeId, setProjectNodeId] = useState('tyo-1')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken()
    if (!token) throw new Error(t('panelErrorMissingToken'))
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    })
  }, [getToken, t])

  const requestJson = useCallback(async <T,>(path: string, errorKey: Parameters<typeof t>[0], init?: RequestInit): Promise<T> => {
    const res = await authedFetch(path, init)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = typeof data?.error === 'string' ? panelApiErrorMessage(data.error, t) : `${t(errorKey)}: ${res.status}`
      throw new Error(message)
    }
    return data as T
  }, [authedFetch, t])

  const withProject = useCallback((path: string, projectId = selectedProjectId) => (
    projectId ? appendProjectId(path, projectId) : path
  ), [selectedProjectId])

  const refresh = useCallback(async (projectId = selectedProjectId) => {
    if (!isSignedIn) return
    setLoading(true)
    setError(null)
    try {
      const nextBootstrap = await requestJson<BootstrapResponse>(
        withProject('/v1/panel/bootstrap', projectId),
        'panelErrorBootstrap',
      )
      setBootstrap(nextBootstrap)
      const currentProjectId = nextBootstrap.current_project?.id ?? null

      if (!currentProjectId) {
        setSummary(null)
        setBoxes([])
        setSelectedProjectId(null)
        const nextBilling = await requestJson<BillingDetailResponse>('/v1/panel/billing', 'panelErrorBilling')
        setBillingDetail(nextBilling)
        return
      }

      const [nextSummary, boxesBody, nextBilling] = await Promise.all([
        requestJson<SummaryResponse>(withProject('/v1/panel/summary', currentProjectId), 'panelErrorSummary'),
        requestJson<{ boxes: PanelBox[] }>(withProject('/v1/panel/boxes', currentProjectId), 'panelErrorBoxes'),
        requestJson<BillingDetailResponse>('/v1/panel/billing', 'panelErrorBilling'),
      ])
      setSummary(nextSummary)
      setBoxes(boxesBody.boxes)
      setBillingDetail(nextBilling)
      if (currentProjectId !== selectedProjectId) {
        setSelectedProjectId(currentProjectId)
      }
      if (nextBootstrap.initial_api_key) setNewSecret(nextBootstrap.initial_api_key)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, requestJson, selectedProjectId, withProject])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedProjectId) {
      window.localStorage.setItem('sandbank.panel.projectId', selectedProjectId)
    } else {
      window.localStorage.removeItem('sandbank.panel.projectId')
    }
  }, [selectedProjectId])

  const billing = billingDetail?.billing ?? summary?.billing ?? bootstrap?.billing
  const keys = bootstrap?.api_keys ?? []
  const graph = summary?.relay_graph
  const projects = bootstrap?.projects ?? summary?.projects ?? []
  const projectNodes = useMemo(() => normalizeProjectNodes(bootstrap?.project_nodes), [bootstrap?.project_nodes])
  const currentProject = bootstrap?.current_project
    ?? summary?.current_project
    ?? projects.find((project) => project.id === selectedProjectId)
    ?? projects[0]
  const showProjectOnboarding = Boolean(bootstrap && projects.length === 0)

  useEffect(() => {
    if (projectNodes.some((node) => node.node_id === projectNodeId)) return
    setProjectNodeId(projectNodes[0]?.node_id ?? 'tyo-1')
  }, [projectNodeId, projectNodes])

  const createApiKey = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await requestJson<{ secret?: string; error?: string }>(withProject('/v1/panel/api-keys'), 'panelErrorCreateKey', {
        method: 'POST',
        body: JSON.stringify({ name: 'Panel key', project_id: selectedProjectId }),
      })
      if (!data.secret) throw new Error(t('panelErrorCreateKey'))
      setNewSecret(data.secret)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    const name = projectName.trim()
    if (!name) return false
    setLoading(true)
    setError(null)
    try {
      const data = await requestJson<{
        project: Project
        projects: Project[]
        initial_api_key?: string | null
        api_key?: ApiKey
      }>('/v1/panel/projects', 'panelErrorCreateProject', {
        method: 'POST',
        body: JSON.stringify({ name, node_id: projectNodeId }),
      })
      setProjectName('')
      setSelectedProjectId(data.project.id)
      setBootstrap((prev) => prev ? {
        ...prev,
        projects: data.projects,
        current_project: data.project,
        api_keys: data.api_key ? [data.api_key] : [],
      } : prev)
      if (data.initial_api_key) setNewSecret(data.initial_api_key)
      await refresh(data.project.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateProjectName = async (name: string) => {
    const project = currentProject
    const nextName = name.trim()
    if (!project || !nextName) return false
    setLoading(true)
    setError(null)
    try {
      const data = await requestJson<{
        project: Project
        projects: Project[]
      }>(`/v1/panel/projects/${project.id}`, 'panelErrorUpdateProject', {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName }),
      })
      setBootstrap((prev) => prev ? {
        ...prev,
        projects: data.projects,
        current_project: data.project,
      } : prev)
      setSummary((prev) => prev ? {
        ...prev,
        projects: data.projects,
        current_project: data.project,
      } : prev)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setLoading(false)
    }
  }

  const deleteProject = async () => {
    const project = currentProject
    if (!project) return false
    setLoading(true)
    setError(null)
    try {
      const data = await requestJson<{
        deleted_project_id: string
        projects: Project[]
        current_project: Project
      }>(withProject(`/v1/panel/projects/${project.id}`), 'panelErrorDeleteProject', {
        method: 'DELETE',
      })
      setSelectedProjectId(data.current_project.id)
      setBootstrap((prev) => prev ? {
        ...prev,
        projects: data.projects,
        current_project: data.current_project,
        api_keys: [],
      } : prev)
      setSummary((prev) => prev ? {
        ...prev,
        projects: data.projects,
        current_project: data.current_project,
      } : prev)
      await refresh(data.current_project.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setLoading(false)
    }
  }

  const revokeApiKey = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch(`/v1/panel/api-keys/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`${t('panelErrorRevokeKey')}: ${res.status}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const setupCard = async () => {
    setError(null)
    try {
      const data = await requestJson<{ url?: string }>('/v1/panel/billing/setup-card', 'panelErrorCard', {
        method: 'POST',
        body: JSON.stringify({
          successUrl: `${window.location.origin}/panel/billing?card=added`,
          cancelUrl: `${window.location.origin}/panel/billing`,
        }),
      })
      if (!data.url) throw new Error(t('panelErrorCard'))
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const openBillingPortal = async () => {
    setError(null)
    try {
      const data = await requestJson<{ url?: string }>('/v1/panel/billing/portal', 'panelErrorCard', {
        method: 'POST',
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/panel/billing`,
        }),
      })
      if (!data.url) throw new Error(t('panelErrorCard'))
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const topUp = async (amountCents = billing?.auto_topup_amount_cents || 2000) => {
    setLoading(true)
    setError(null)
    try {
      await requestJson('/v1/panel/billing/top-up', 'panelErrorTopUp', {
        method: 'POST',
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const updateAutoTopUp = async (enabled: boolean, thresholdCents: number, amountCents: number) => {
    setLoading(true)
    setError(null)
    try {
      await requestJson('/v1/panel/billing/auto-top-up', 'panelErrorAutoTopUp', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          threshold_cents: thresholdCents,
          amount_cents: amountCents,
        }),
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (showProjectOnboarding) {
    return (
      <div className="min-h-screen">
        <PanelHeader
          loading={loading}
          active={section}
          projects={projects}
          projectNodes={projectNodes}
          currentProject={currentProject}
          setSelectedProjectId={setSelectedProjectId}
          projectName={projectName}
          setProjectName={setProjectName}
          projectNodeId={projectNodeId}
          setProjectNodeId={setProjectNodeId}
          createProject={createProject}
        />
        <main className="px-5 py-8 sm:px-8">
          {error && (
            <div className="mb-6 border border-red-400/30 bg-red-400/5 px-4 py-3 font-mono text-[0.72rem] text-red-300">
              {error}
            </div>
          )}
          {newSecret && (
            <SecretBanner secret={newSecret} onDismiss={() => setNewSecret(null)} />
          )}
          <ProjectOnboarding
            projectName={projectName}
            setProjectName={setProjectName}
            projectNodeId={projectNodeId}
            setProjectNodeId={setProjectNodeId}
            projectNodes={projectNodes}
            createProject={createProject}
            loading={loading}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PanelHeader
        loading={loading}
        active={section}
        projects={projects}
        projectNodes={projectNodes}
        currentProject={currentProject}
        setSelectedProjectId={setSelectedProjectId}
        projectName={projectName}
        setProjectName={setProjectName}
        projectNodeId={projectNodeId}
        setProjectNodeId={setProjectNodeId}
        createProject={createProject}
      />
      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <PanelNav active={section} />
        <section className="min-w-0 px-5 py-7 sm:px-8">
          <PageHeading section={section} tenantName={bootstrap?.tenant.name} />
          {error && (
            <div className="mb-6 border border-red-400/30 bg-red-400/5 px-4 py-3 font-mono text-[0.72rem] text-red-300">
              {error}
            </div>
          )}
          {newSecret && (
            <SecretBanner secret={newSecret} onDismiss={() => setNewSecret(null)} />
          )}
          {section === 'overview' && (
            <OverviewPage
              summary={summary}
              billing={billing}
              boxes={boxes}
              graph={graph}
              locale={locale}
            />
          )}
          {section === 'boxes' && (
            <BoxesPage boxes={boxes} locale={locale} />
          )}
          {section === 'relay' && (
            <RelayPage graph={graph} boxes={boxes} />
          )}
          {section === 'billing' && (
            <BillingPage
              billing={billing}
              detail={billingDetail}
              setupCard={setupCard}
              openBillingPortal={openBillingPortal}
              topUp={topUp}
              updateAutoTopUp={updateAutoTopUp}
              locale={locale}
            />
          )}
          {section === 'api-keys' && (
            <ApiKeysPage
              keys={keys}
              currentProject={currentProject}
              createApiKey={createApiKey}
              revokeApiKey={revokeApiKey}
              locale={locale}
            />
          )}
          {section === 'project-settings' && (
            <ProjectSettingsPage
              currentProject={currentProject}
              projectCount={projects.length}
              loading={loading}
              updateProjectName={updateProjectName}
              deleteProject={deleteProject}
            />
          )}
        </section>
      </main>
    </div>
  )
}

function PanelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {children}
    </div>
  )
}

function AuthTopbar() {
  const t = useT()
  return (
    <div className="flex items-center justify-between">
      <Link to="/cloud" className="font-mono text-xs uppercase tracking-[0.15em] text-sand-400">
        sandbank
      </Link>
      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.14em] text-text-muted sm:inline">
          {t('panel')}
        </span>
        <PanelLanguageSwitcher className="w-44" placement="down" />
      </div>
    </div>
  )
}

function PanelHeader({
  loading,
  active,
  projects,
  projectNodes,
  currentProject,
  setSelectedProjectId,
  projectName,
  setProjectName,
  projectNodeId,
  setProjectNodeId,
  createProject,
}: {
  loading: boolean
  active: PanelSection
  projects: Project[]
  projectNodes: ProjectNode[]
  currentProject?: Project
  setSelectedProjectId: (id: string) => void
  projectName: string
  setProjectName: (name: string) => void
  projectNodeId: string
  setProjectNodeId: (nodeId: string) => void
  createProject: () => Promise<boolean>
}) {
  const t = useT()
  return (
    <header className="sticky top-0 z-20 border-b border-sand-400/10 bg-surface/90 backdrop-blur-sm">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/cloud" className="font-mono text-xs uppercase tracking-[0.15em] text-sand-400">
            sandbank
          </Link>
          <ProjectSwitcher
            projects={projects}
            projectNodes={projectNodes}
            currentProject={currentProject}
            setSelectedProjectId={setSelectedProjectId}
            projectName={projectName}
            setProjectName={setProjectName}
            projectNodeId={projectNodeId}
            setProjectNodeId={setProjectNodeId}
            createProject={createProject}
            loading={loading}
          />
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/panel/billing"
            aria-label={t('panelNavBilling')}
            title={t('panelNavBilling')}
            className={`grid h-9 w-9 place-items-center border transition-colors ${
              active === 'billing'
                ? 'border-sand-400/35 bg-sand-400/[0.08] text-sand-400'
                : 'border-sand-400/14 text-text-muted hover:border-sand-400/30 hover:text-sand-400'
            }`}
          >
            <BillingIcon className="h-5 w-5" />
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  )
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <path d="M13 16H8m6-8H8m8 4H8M4 3a1 1 0 0 1 1-1a1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1a1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2a1 1 0 0 1-1-1z" />
    </PanelSvgIcon>
  )
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </PanelSvgIcon>
  )
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7l8.7 5l8.7-5M12 22V12" />
    </PanelSvgIcon>
  )
}

function RelayIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <rect width="6" height="6" x="16" y="16" rx="1" />
      <rect width="6" height="6" x="2" y="16" rx="1" />
      <rect width="6" height="6" x="9" y="2" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3m-7-4V8" />
    </PanelSvgIcon>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" stroke="none" />
    </PanelSvgIcon>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <PanelSvgIcon className={className}>
      <path d="M14 17H5M19 7h-9" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </PanelSvgIcon>
  )
}

function PanelSvgIcon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {children}
    </svg>
  )
}

function PanelLanguageSwitcher({
  className = '',
  placement = 'up',
}: {
  className?: string
  placement?: 'up' | 'down'
}) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuPosition = placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border border-sand-400/14 bg-surface-raised px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-text-primary transition-colors hover:border-sand-400/30 hover:text-sand-400"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-sand-400">{localeLabels[locale]}</span>
          <span className="truncate normal-case tracking-normal text-text-muted">{localeNames[locale]}</span>
        </span>
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 border-b border-r border-current text-text-muted transition-transform ${
            open ? (placement === 'up' ? 'rotate-45' : 'rotate-[225deg]') : (placement === 'up' ? 'rotate-[225deg]' : 'rotate-45')
          }`}
        />
      </button>
      {open && (
        <div className={`absolute left-0 z-30 max-h-64 w-full overflow-y-auto border border-sand-400/14 bg-surface-raised shadow-2xl ${menuPosition}`}>
          {locales.map((loc: Locale) => {
            const active = loc === locale
            return (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  setLocale(loc)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between border-b border-sand-400/8 px-3 py-2 text-left font-mono transition-colors last:border-b-0 ${
                  active
                    ? 'bg-sand-400/[0.07] text-sand-400'
                    : 'text-text-muted hover:bg-sand-400/[0.04] hover:text-text-primary'
                }`}
              >
                <span className="min-w-0 truncate text-[0.7rem]">{localeNames[loc]}</span>
                <span className="text-[0.58rem] uppercase tracking-[0.12em]">{localeLabels[loc]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PanelNav({ active }: { active: PanelSection }) {
  const t = useT()
  const items = useMemo(() => ([
    { key: 'overview' as const, path: '/panel', label: t('panelNavOverview'), icon: OverviewIcon },
    { key: 'boxes' as const, path: '/panel/boxes', label: t('panelNavBoxes'), icon: BoxIcon },
    { key: 'relay' as const, path: '/panel/relay', label: t('panelNavRelay'), icon: RelayIcon },
    { key: 'api-keys' as const, path: '/panel/api-keys', label: t('panelNavApiKeys'), icon: KeyIcon },
    { key: 'project-settings' as const, path: '/panel/project-settings', label: t('panelNavProjectSettings'), icon: SettingsIcon },
  ]), [t])

  return (
    <aside className="flex flex-col border-b border-sand-400/10 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
      <nav className="flex overflow-x-auto px-5 py-3 lg:block lg:flex-1 lg:px-6 lg:py-6">
        {items.map((item) => (
          <Link
            key={item.key}
            to={item.path}
            className={`mr-2 inline-flex items-center gap-2 whitespace-nowrap border px-3 py-2 font-mono text-[0.66rem] uppercase tracking-[0.1em] transition-colors lg:mb-2 lg:mr-0 lg:flex ${
              active === item.key
                ? 'border-sand-400/30 bg-sand-400/[0.07] text-sand-400'
                : 'border-transparent text-text-muted hover:border-sand-400/15 hover:text-text-primary'
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-sand-400/10 px-5 py-4 lg:px-6">
        <p className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">
          {t('panelLanguage')}
        </p>
        <PanelLanguageSwitcher className="w-full" />
      </div>
    </aside>
  )
}

function ProjectOnboarding({
  projectName,
  setProjectName,
  projectNodeId,
  setProjectNodeId,
  projectNodes,
  createProject,
  loading,
}: {
  projectName: string
  setProjectName: (name: string) => void
  projectNodeId: string
  setProjectNodeId: (nodeId: string) => void
  projectNodes: ProjectNode[]
  createProject: () => Promise<boolean>
  loading: boolean
}) {
  const t = useT()
  const selectedNode = projectNodes.find((node) => node.node_id === projectNodeId) ?? projectNodes[0]

  return (
    <section className="mx-auto grid max-w-4xl gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0">
        <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-sand-400">
          {t('panelOnboardingEyebrow')}
        </p>
        <h1 className="max-w-2xl text-[clamp(1.75rem,3vw,2.45rem)] font-medium leading-[1.18]">
          {t('panelOnboardingTitle')}
        </h1>
        <p className="mt-3 max-w-xl font-mono text-[0.76rem] leading-relaxed text-text-muted">
          {t('panelOnboardingSubtitle')}
        </p>
        <div className="mt-6 grid gap-2 font-mono text-[0.68rem] leading-relaxed text-text-muted sm:grid-cols-3">
          <div className="border border-sand-400/12 bg-sand-400/[0.025] p-3">
            <p className="mb-1.5 text-sand-400">{t('panelProject')}</p>
            <p>{t('panelOnboardingProjectHint')}</p>
          </div>
          <div className="border border-sand-400/12 bg-sand-400/[0.025] p-3">
            <p className="mb-1.5 text-sand-400">{t('panelNavApiKeys')}</p>
            <p>{t('panelOnboardingApiKeyHint')}</p>
          </div>
          <div className="border border-sand-400/12 bg-sand-400/[0.025] p-3">
            <p className="mb-1.5 text-sand-400">{t('panelNavRelay')}</p>
            <p>{t('panelOnboardingRelayHint')}</p>
          </div>
        </div>
      </div>

      <form
        className="border border-sand-400/14 bg-surface-raised p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void createProject()
        }}
      >
        <p className="mb-4 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-text-muted">
          {t('panelCreateProject')}
        </p>
        <label className="block">
          <span className="mb-2 block font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
            {t('panelProjectName')}
          </span>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder={t('panelOnboardingProjectPlaceholder')}
            className="w-full border border-sand-400/14 bg-surface px-3 py-3 font-mono text-[0.78rem] text-text-primary outline-none placeholder:text-text-muted/60 focus:border-sand-400/45"
            autoFocus
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-2 block font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
            {t('panelNodeRegion')}
          </span>
          <select
            value={projectNodeId}
            onChange={(event) => setProjectNodeId(event.target.value)}
            className="w-full border border-sand-400/14 bg-surface px-3 py-3 font-mono text-[0.78rem] text-text-primary outline-none focus:border-sand-400/45"
          >
            {projectNodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>
                {formatProjectNodeOption(node)}
              </option>
            ))}
          </select>
        </label>

        {selectedNode && (
          <div className="mt-4 border border-sand-400/10 bg-sand-400/[0.025] px-3 py-3 font-mono text-[0.7rem] text-text-muted">
            <p className="text-text-primary">
              {selectedNode.flag_emoji ? `${selectedNode.flag_emoji} ` : ''}
              {selectedNode.server_name}
            </p>
            <p className="mt-1">{selectedNode.region}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !projectName.trim() || projectNodes.length === 0}
          className="mt-5 w-full border border-sand-400/30 bg-sand-400 px-4 py-3 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-black transition-colors hover:bg-sand-400/90 disabled:cursor-not-allowed disabled:border-sand-400/12 disabled:bg-sand-400/10 disabled:text-text-muted"
        >
          {loading ? t('panelSyncing') : t('panelOnboardingCreate')}
        </button>
      </form>
    </section>
  )
}

function ProjectSwitcher({
  projects,
  projectNodes,
  currentProject,
  setSelectedProjectId,
  projectName,
  setProjectName,
  projectNodeId,
  setProjectNodeId,
  createProject,
  loading,
}: {
  projects: Project[]
  projectNodes: ProjectNode[]
  currentProject?: Project
  setSelectedProjectId: (id: string) => void
  projectName: string
  setProjectName: (name: string) => void
  projectNodeId: string
  setProjectNodeId: (nodeId: string) => void
  createProject: () => Promise<boolean>
  loading: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const currentNodeLabel = formatProjectNodeBadge(currentProject)

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-w-0 max-w-[15rem] items-center gap-2 border border-sand-400/14 bg-surface-raised px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-text-primary transition-colors hover:border-sand-400/30 hover:text-sand-400 sm:max-w-[20rem]"
      >
        <span className="text-text-muted">{t('panelProject')}</span>
        <span className="truncate">{currentProject?.name || t('panelNoProjects')}</span>
        {currentProject && (
          <span className="hidden max-w-[7rem] truncate border-l border-sand-400/12 pl-2 text-[0.58rem] text-text-muted sm:inline">
            {currentNodeLabel}
          </span>
        )}
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 border-b border-r border-current text-text-muted transition-transform ${
            open ? 'rotate-[225deg]' : 'rotate-45'
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-3 w-[min(22rem,calc(100vw-2rem))] border border-sand-400/14 bg-surface-raised shadow-2xl">
          <div className="border-b border-sand-400/10 px-4 py-3">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
              {t('panelProjects')}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {projects.map((project) => {
              const active = project.id === currentProject?.id
              const nodeBadge = formatProjectNodeBadge(project)
              const regionBadge = formatProjectRegionBadge(project)
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(project.id)
                    setOpen(false)
                  }}
                  className={`w-full border px-3 py-2 text-left font-mono transition-colors ${
                    active
                      ? 'border-sand-400/30 bg-sand-400/[0.07] text-sand-400'
                      : 'border-transparent text-text-muted hover:border-sand-400/15 hover:text-text-primary'
                  }`}
                >
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="truncate text-[0.74rem]">{project.name}</span>
                    <span className="shrink-0 text-[0.58rem] text-text-muted">{nodeBadge}</span>
                  </span>
                  <span className="mt-1 block truncate text-[0.58rem] text-text-muted">{project.slug}</span>
                  <span className="mt-1 block truncate text-[0.58rem] text-text-muted">
                    {regionBadge}
                  </span>
                </button>
              )
            })}
            {projects.length === 0 && (
              <div className="border border-dashed border-sand-400/12 px-3 py-3 font-mono text-[0.68rem] text-text-muted">
                {t('panelNoProjects')}
              </div>
            )}
          </div>
          <form
            className="grid gap-2 border-t border-sand-400/10 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              void createProject().then((created) => {
                if (created) setOpen(false)
              })
            }}
          >
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder={t('panelProjectName')}
              className="min-w-0 border border-sand-400/14 bg-surface px-2 py-2 font-mono text-[0.68rem] text-text-primary outline-none placeholder:text-text-muted/60 focus:border-sand-400/45"
            />
            <select
              value={projectNodeId}
              onChange={(event) => setProjectNodeId(event.target.value)}
              aria-label={t('panelNodeRegion')}
              className="min-w-0 border border-sand-400/14 bg-surface px-2 py-2 font-mono text-[0.68rem] text-text-primary outline-none focus:border-sand-400/45"
            >
              {projectNodes.map((node) => (
                <option key={node.node_id} value={node.node_id}>
                  {formatProjectNodeOption(node)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="border border-sand-400/20 px-3 py-2 font-mono text-[0.62rem] uppercase text-sand-400 transition-colors hover:bg-sand-400/[0.07] disabled:cursor-not-allowed disabled:text-text-muted"
              disabled={loading || !projectName.trim() || projectNodes.length === 0}
            >
              {t('panelCreate')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function PageHeading({ section, tenantName }: { section: PanelSection; tenantName?: string }) {
  const t = useT()
  const copy = {
    overview: [t('panelOverviewTitle'), t('panelOverviewSubtitle')],
    boxes: [t('panelBoxesTitle'), t('panelBoxesSubtitle')],
    relay: [t('panelRelayTitle'), t('panelRelaySubtitle')],
    billing: [t('panelBillingTitle'), t('panelBillingSubtitle')],
    'api-keys': [t('panelApiKeysTitle'), t('panelApiKeysSubtitle')],
    'project-settings': [t('panelProjectSettingsTitle'), t('panelProjectSettingsSubtitle')],
  } satisfies Record<PanelSection, [string, string]>

  return (
    <div className="mb-7 border-b border-sand-400/10 pb-7">
      <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-text-muted">
        {tenantName || t('panel')}
      </p>
      <h1 className="text-[clamp(2rem,5vw,3.7rem)] font-normal leading-tight">
        {copy[section][0]}
      </h1>
      <p className="mt-3 max-w-2xl font-mono text-[0.76rem] leading-relaxed text-text-muted">
        {copy[section][1]}
      </p>
    </div>
  )
}

function OverviewPage({ summary, billing, boxes, graph, locale }: {
  summary: SummaryResponse | null
  billing?: BillingAccount
  boxes: PanelBox[]
  graph?: RelayGraph
  locale: Locale
}) {
  const t = useT()
  const relayCatalog = useRelayCatalog()
  const metrics = useMemo(() => [
    { label: t('panelRunningBoxes'), value: summary?.counts.running ?? 0 },
    { label: t('panelTotalBoxes'), value: summary?.counts.boxes ?? boxes.length },
    { label: t('panelRelayLinks'), value: summary?.counts.relay_links ?? 0 },
    { label: t('panelBalance'), value: formatMoney(billing?.balance_cents ?? 0) },
  ], [billing?.balance_cents, boxes.length, summary, t])

  return (
    <div className="space-y-6">
      <MetricGrid metrics={metrics} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
        <BoxesTable
          title={t('panelRecentBoxes')}
          boxes={boxes.slice(0, 8)}
          compact
          locale={locale}
        />
        <RelayGraphPanel graph={graph} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <BillingSummaryPanel billing={billing} />
        <ApiKeysSummaryPanel />
        <AvailableRelationsMiniPanel catalog={relayCatalog} />
      </div>
    </div>
  )
}

function BoxesPage({ boxes, locale }: { boxes: PanelBox[]; locale: Locale }) {
  const t = useT()
  return <BoxesTable title={t('panelAllBoxes')} boxes={boxes} locale={locale} />
}

function RelayPage({ graph, boxes }: { graph?: RelayGraph; boxes: PanelBox[] }) {
  const t = useT()
  const relayCatalog = useRelayCatalog()
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const boxById = new Map(boxes.map((box) => [box.id, box]))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <RelayCanvas graph={graph} boxes={boxes} catalog={relayCatalog} />
      <RelayCatalogPanel catalog={relayCatalog} />
      <section className="border border-sand-400/12 bg-sand-400/[0.025]">
        <PanelTitle title={t('panelEdgeList')} detail={`${edges.length}`} />
        <div className="divide-y divide-sand-400/10">
          {edges.map((edge) => (
            <div key={`${edge.from}-${edge.to}-${edge.type}`} className="px-4 py-4 font-mono text-[0.72rem]">
              <p className="text-text-secondary">{edge.from || t('panelNotAvailable')}{' -> '}{edge.to}</p>
              <p className="mt-2 text-text-muted">
                {edge.type} · {edge.relay_name || t('panelNotAvailable')} · {boxById.get(edge.to)?.image || t('panelNotAvailable')}
              </p>
            </div>
          ))}
          {edges.length === 0 && (
            <EmptyState>{t('panelNoRelay')}</EmptyState>
          )}
        </div>
      </section>
      {nodes.length > 0 && (
        <section className="border border-sand-400/12 bg-sand-400/[0.025] xl:col-span-2">
          <PanelTitle title={t('panelLinkedAddons')} detail={`${nodes.length}`} />
          <div className="grid gap-px bg-sand-400/10 md:grid-cols-2 xl:grid-cols-3">
            {nodes.map((node) => (
              <div key={node.id} className="bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[0.76rem] text-sand-400">{node.type}</p>
                    <p className="mt-2 break-all font-mono text-[0.68rem] text-text-muted">{node.id}</p>
                  </div>
                  <StatusPill status={node.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BillingPage({ billing, detail, setupCard, openBillingPortal, topUp, updateAutoTopUp, locale }: {
  billing?: BillingAccount
  detail: BillingDetailResponse | null
  setupCard: () => void
  openBillingPortal: () => void
  topUp: (amountCents?: number) => void
  updateAutoTopUp: (enabled: boolean, thresholdCents: number, amountCents: number) => void
  locale: Locale
}) {
  const t = useT()
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="border border-sand-400/12 bg-sand-400/[0.025]">
        <PanelTitle title={t('panelCard')} detail={billing?.has_card ? `${billing.card_brand} **** ${billing.card_last4}` : t('panelNoCard')} />
        <div className="grid gap-px bg-sand-400/10 font-mono text-[0.74rem]">
          <InfoRow label={t('panelBalance')} value={formatMoney(billing?.balance_cents ?? 0)} />
          <InfoRow label={t('panelAutoTopUp')} value={billing?.auto_topup_enabled ? t('panelEnabled') : t('panelDisabled')} />
          <InfoRow label={t('panelThreshold')} value={formatMoney(billing?.auto_topup_threshold_cents ?? 0)} />
          <InfoRow label={t('panelAmount')} value={formatMoney(billing?.auto_topup_amount_cents ?? 0)} />
        </div>
        <div className="flex flex-wrap gap-3 p-4">
          <button onClick={billing?.has_card ? openBillingPortal : setupCard} className="panel-button-primary">
            {billing?.has_card ? t('panelManageCard') : t('panelAddCard')}
          </button>
          <button onClick={() => topUp()} className="panel-button-secondary" disabled={!billing?.has_card}>
            {t('panelTopUp')}
          </button>
        </div>
      </section>
      <AutoTopupPanel billing={billing} updateAutoTopUp={updateAutoTopUp} />
      <LedgerPanel ledger={detail?.ledger ?? []} locale={locale} />
      <TopupsPanel topups={detail?.topups ?? []} locale={locale} />
    </div>
  )
}

function ApiKeysPage({ keys, currentProject, createApiKey, revokeApiKey, locale }: {
  keys: ApiKey[]
  currentProject?: Project
  createApiKey: () => void
  revokeApiKey: (id: string) => void
  locale: Locale
}) {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle
        title={t('panelApiKeysTitle')}
        detail={`${keys.filter((key) => !key.revoked_at).length} ${t('panelActive')} · ${currentProject?.name ?? t('panelProject')}`}
      />
      <p className="border-b border-sand-400/10 px-4 pb-4 font-mono text-[0.72rem] leading-relaxed text-text-muted">
        {t('panelApiKeysSubtitle')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse font-mono text-[0.72rem]">
          <thead className="text-left text-text-muted">
            <tr className="border-b border-sand-400/10">
              {[t('panelKeyName'), t('panelStatus'), t('panelCreated'), t('panelLastUsed'), ''].map((head) => (
                <th key={head} className="px-4 py-3 font-normal uppercase">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="border-b border-sand-400/8 last:border-b-0">
                <td className="px-4 py-3">
                  <p className="text-text-secondary">{apiKeyNameLabel(key.name, t)}</p>
                  <p className="mt-1 text-text-muted">{key.prefix}...</p>
                </td>
                <td className="px-4 py-3">
                  <span className={key.revoked_at ? 'text-red-300' : 'text-emerald-300'}>
                    {key.revoked_at ? t('panelRevoked') : t('panelActive')}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">{shortTime(key.created_at, locale)}</td>
                <td className="px-4 py-3 text-text-muted">{key.last_used_at ? shortTime(key.last_used_at, locale) : t('panelNever')}</td>
                <td className="px-4 py-3 text-right">
                  {!key.revoked_at && (
                    <button onClick={() => revokeApiKey(key.id)} className="panel-button-secondary">
                      {t('panelRevoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {keys.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState>{t('panelNoKeys')}</EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-sand-400/10 p-4">
        <button onClick={createApiKey} className="panel-button-primary">{t('panelIssueKey')}</button>
      </div>
    </section>
  )
}

function ProjectSettingsPage({
  currentProject,
  projectCount,
  loading,
  updateProjectName,
  deleteProject,
}: {
  currentProject?: Project
  projectCount: number
  loading: boolean
  updateProjectName: (name: string) => Promise<boolean>
  deleteProject: () => Promise<boolean>
}) {
  const t = useT()
  const [name, setName] = useState(currentProject?.name ?? '')
  const [deleteName, setDeleteName] = useState('')

  useEffect(() => {
    setName(currentProject?.name ?? '')
    setDeleteName('')
  }, [currentProject?.id, currentProject?.name])

  if (!currentProject) {
    return <EmptyState>{t('panelNoProjects')}</EmptyState>
  }

  const canRename = name.trim().length > 0 && name.trim() !== currentProject.name
  const canDelete = projectCount > 1 && deleteName.trim() === currentProject.name
  const nodeBadge = formatProjectNodeBadge(currentProject)
  const regionBadge = formatProjectRegionBadge(currentProject)
  const nodeId = formatProjectNodeId(currentProject)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="border border-sand-400/12 bg-sand-400/[0.025]">
        <PanelTitle title={t('panelRenameProject')} detail={currentProject.slug} />
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void updateProjectName(name)
          }}
        >
          <label className="block">
            <span className="mb-2 block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
              {t('panelProjectName')}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border border-sand-400/14 bg-surface px-3 py-3 font-mono text-[0.76rem] text-text-primary outline-none placeholder:text-text-muted/60 focus:border-sand-400/45"
            />
          </label>
          <button
            type="submit"
            className="panel-button-primary"
            disabled={loading || !canRename}
          >
            {t('panelSaveProject')}
          </button>
        </form>
      </section>

      <section className="border border-sand-400/12 bg-sand-400/[0.025]">
        <PanelTitle title={t('panelProjectDetails')} detail={t('panelProject')} />
        <div className="grid gap-px bg-sand-400/10 font-mono text-[0.74rem]">
          <InfoRow label={t('panelProjectName')} value={currentProject.name} />
          <InfoRow label={t('panelProjectServer')} value={nodeBadge} />
          <InfoRow label={t('panelServerRegion')} value={regionBadge} />
          <InfoRow label={t('panelServerNode')} value={nodeId} />
          <InfoRow label={t('panelProjectSlug')} value={currentProject.slug} />
          <InfoRow label={t('panelProjectId')} value={currentProject.id} />
        </div>
        <p className="border-t border-sand-400/10 px-4 py-3 font-mono text-[0.68rem] leading-relaxed text-text-muted">
          {t('panelServerLocked')}
        </p>
      </section>

      <section className="border border-red-400/25 bg-red-400/[0.035] xl:col-span-2">
        <PanelTitle title={t('panelDeleteProject')} detail={projectCount <= 1 ? t('panelCannotDeleteLastProject') : currentProject.name} />
        <div className="space-y-4 p-4">
          <p className="max-w-2xl font-mono text-[0.72rem] leading-relaxed text-text-muted">
            {t('panelDeleteProjectDesc')}
          </p>
          <label className="block max-w-lg">
            <span className="mb-2 block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
              {t('panelDeleteProjectConfirm')}
            </span>
            <input
              value={deleteName}
              onChange={(event) => setDeleteName(event.target.value)}
              placeholder={currentProject.name}
              className="w-full border border-red-400/20 bg-surface px-3 py-3 font-mono text-[0.76rem] text-text-primary outline-none placeholder:text-text-muted/45 focus:border-red-300/50"
              disabled={projectCount <= 1}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              void deleteProject()
            }}
            className="border border-red-400/35 bg-red-400/10 px-4 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-red-300 transition-colors hover:bg-red-400/15 disabled:pointer-events-none disabled:opacity-40"
            disabled={loading || !canDelete}
          >
            {t('panelDeleteProject')}
          </button>
        </div>
      </section>
    </div>
  )
}

function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-sand-400/10 bg-sand-400/10 md:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-surface px-4 py-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">{metric.label}</p>
          <p className="mt-3 font-mono text-2xl text-sand-400">{metric.value}</p>
        </div>
      ))}
    </div>
  )
}

function BoxesTable({ title, boxes, locale, compact = false }: {
  title: string
  boxes: PanelBox[]
  locale: Locale
  compact?: boolean
}) {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={title} detail={`${boxes.length}`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse font-mono text-[0.72rem]">
          <thead className="text-left text-text-muted">
            <tr className="border-b border-sand-400/10">
              {[t('panelBox'), t('panelType'), t('panelStatus'), t('panelRelayName'), t('panelCpu'), t('panelMemory'), t('panelPorts'), t('panelTerminal'), t('panelLastActive')].map((head) => (
                <th key={head} className="px-4 py-3 font-normal uppercase">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => (
              <tr key={box.id} className="border-b border-sand-400/8 last:border-b-0">
                <td className="px-4 py-3">
                  <p className="text-text-secondary">{box.id.slice(0, compact ? 10 : 16)}</p>
                  {!compact && <p className="mt-1 max-w-[15rem] truncate text-text-muted">{box.image}</p>}
                </td>
                <td className="px-4 py-3 text-sand-400">{box.type}</td>
                <td className="px-4 py-3"><StatusPill status={box.status} /></td>
                <td className="px-4 py-3 text-text-muted">{box.relay_name || t('panelNotAvailable')}</td>
                <td className="px-4 py-3 text-text-muted">{box.cpu}</td>
                <td className="px-4 py-3 text-text-muted">{box.memory_mb} MB</td>
                <td className="px-4 py-3 text-text-muted">{formatPorts(box.ports) || t('panelNotAvailable')}</td>
                <td className="px-4 py-3 text-text-muted">
                  {box.terminal?.publisherConnected ? t('panelActive') : t('panelDisabled')}
                </td>
                <td className="px-4 py-3 text-text-muted">{shortTime(box.last_active, locale)}</td>
              </tr>
            ))}
            {boxes.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState>{t('panelNoBoxes')}</EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function RelayGraphPanel({ graph }: { graph?: RelayGraph }) {
  const t = useT()
  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelRelayTitle')} detail={`${edges.length} ${t('panelRelayLinks')}`} />
      <div className="space-y-3 p-4">
        {nodes.map((node) => {
          const children = edges.filter((edge) => edge.from === node.id)
          return (
            <div key={node.id} className="border border-sand-400/10 bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.75rem] text-sand-400">{node.type}</span>
                <StatusPill status={node.status} />
              </div>
              <p className="mt-2 break-all font-mono text-[0.68rem] text-text-muted">{node.id}</p>
              <p className="mt-1 font-mono text-[0.66rem] text-text-muted">{node.relay_name || t('panelNotAvailable')}</p>
              {children.map((edge) => (
                <p key={`${edge.from}-${edge.to}`} className="mt-2 border-t border-sand-400/8 pt-2 font-mono text-[0.66rem] text-text-muted">
                  {edge.type}{' -> '}{edge.to.slice(0, 12)}
                </p>
              ))}
            </div>
          )
        })}
        {nodes.length === 0 && <EmptyState>{t('panelNoRelay')}</EmptyState>}
      </div>
    </section>
  )
}

function AvailableRelationsMiniPanel({ catalog }: { catalog: RelayCatalogItem[] }) {
  const t = useT()
  const functionalCount = catalog.filter((item) => item.kind === 'functional').length
  const publicCount = catalog.length - functionalCount

  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelAvailableRelationsTitle')} detail={`${functionalCount}/${publicCount}`} />
      <div className="space-y-4 p-4">
        <p className="font-mono text-[0.72rem] leading-relaxed text-text-muted">
          {t('panelAvailableRelationsSubtitle')}
        </p>
        <div className="grid gap-2">
          {catalog.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 border border-sand-400/10 bg-surface px-3 py-2 font-mono">
              <span className="min-w-0 truncate text-[0.7rem] text-text-secondary">{item.title}</span>
              <span className="shrink-0 text-[0.58rem] uppercase tracking-[0.1em] text-text-muted">
                {item.kind === 'functional' ? t('panelFunctionalBoxes') : t('panelPublicNodes')}
              </span>
            </div>
          ))}
        </div>
        <Link to="/panel/relay" className="panel-button-secondary inline-block">{t('panelOpenRelayCanvas')}</Link>
      </div>
    </section>
  )
}

function RelayCatalogPanel({ catalog }: { catalog: RelayCatalogItem[] }) {
  const t = useT()
  const groups: Array<{ kind: RelayCatalogKind; title: string }> = [
    { kind: 'functional', title: t('panelFunctionalBoxes') },
    { kind: 'public-node', title: t('panelPublicNodes') },
  ]

  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelAvailableRelationsTitle')} detail={`${catalog.length}`} />
      <div className="divide-y divide-sand-400/10">
        {groups.map((group) => (
          <div key={group.kind} className="p-4">
            <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-muted">
              {group.title}
            </p>
            <div className="space-y-3">
              {catalog.filter((item) => item.kind === group.kind).map((item) => (
                <div key={item.id} className="border border-sand-400/10 bg-surface px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[0.76rem] text-text-secondary">{item.title}</p>
                      <p className="mt-1 font-mono text-[0.64rem] text-sand-400">{item.relation}</p>
                    </div>
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sand-400" />
                  </div>
                  <p className="mt-3 font-mono text-[0.68rem] leading-relaxed text-text-muted">{item.description}</p>
                  <p className="mt-3 border-t border-sand-400/8 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-muted">{item.meta}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RelayCanvas({ graph, boxes, catalog }: { graph?: RelayGraph; boxes: PanelBox[]; catalog: RelayCatalogItem[] }) {
  const t = useT()
  const model = useMemo(() => buildRelayCanvasModel(graph, boxes, catalog, t), [boxes, catalog, graph, t])
  const [viewport, setViewport] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const dragRef = useRef<{
    mode: 'pan' | 'node'
    nodeId?: string
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const nodeIds = useMemo(() => model.nodes.map((node) => node.id).join('|'), [model.nodes])

  useEffect(() => {
    setNodePositions((current) => {
      const allowed = new Set(model.nodes.map((node) => node.id))
      return Object.fromEntries(Object.entries(current).filter(([id]) => allowed.has(id)))
    })
  }, [nodeIds, model.nodes])

  const nodes = model.nodes.map((node) => ({
    ...node,
    ...(nodePositions[node.id] ?? {}),
  }))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const canvasSize = getRelayCanvasSize(nodes)

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    dragRef.current = {
      mode: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.mode !== 'pan') return
    setViewport({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  const startNodeDrag = (node: RelayCanvasNode, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    dragRef.current = {
      mode: 'node',
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveNode = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.mode !== 'node' || !drag.nodeId) return
    event.stopPropagation()
    setNodePositions((current) => ({
      ...current,
      [drag.nodeId!]: {
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      },
    }))
  }

  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025] xl:row-span-2">
      <PanelTitle title={t('panelRelayCanvasTitle')} detail={`${model.edges.length} ${t('panelSuggestedRelations')}`} />
      <div
        className="relative min-h-[34rem] overflow-hidden bg-[linear-gradient(rgba(212,168,83,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(212,168,83,0.06)_1px,transparent_1px)] bg-[size:32px_32px] touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ height: canvasSize.height }}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute left-0 top-0"
          style={{ width: canvasSize.width, height: canvasSize.height, transform: `translate(${viewport.x}px, ${viewport.y}px)` }}
        >
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            {model.edges.map((edge) => {
              const from = nodeMap.get(edge.from)
              const to = nodeMap.get(edge.to)
              if (!from || !to) return null
              const x1 = from.x + from.width
              const y1 = from.y + from.height / 2
              const x2 = to.x
              const y2 = to.y + to.height / 2
              const path = `M ${x1} ${y1} C ${x1 + 90} ${y1}, ${x2 - 90} ${y2}, ${x2} ${y2}`
              const labelX = (x1 + x2) / 2
              const labelY = (y1 + y2) / 2 - 8
              const live = edge.kind === 'live'
              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={live ? 'rgba(212,168,83,0.76)' : 'rgba(197,189,175,0.38)'}
                    strokeDasharray={live ? undefined : '7 8'}
                    strokeWidth={live ? 1.6 : 1.2}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    className="fill-text-muted font-mono text-[10px] uppercase tracking-[0.12em]"
                  >
                    {edge.label}
                  </text>
                </g>
              )
            })}
          </svg>
          {nodes.map((node) => (
            <RelayCanvasNodeCard
              key={node.id}
              node={node}
              onPointerDown={(event) => startNodeDrag(node, event)}
              onPointerMove={moveNode}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 font-mono text-[0.62rem] uppercase tracking-[0.1em]">
          <span className="border border-sand-400/25 bg-surface/90 px-2 py-1 text-sand-400">{t('panelLiveRelations')}</span>
          <span className="border border-text-muted/20 bg-surface/90 px-2 py-1 text-text-muted">{t('panelAvailableRelations')}</span>
        </div>
      </div>
    </section>
  )
}

function RelayCanvasNodeCard({
  node,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  node: RelayCanvasNode
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void
}) {
  const tone = node.kind === 'project'
    ? 'border-sand-400/35 bg-sand-400/[0.075]'
    : node.kind === 'functional'
      ? 'border-emerald-300/20 bg-emerald-300/[0.045]'
      : node.kind === 'public-node'
        ? 'border-sky-300/20 bg-sky-300/[0.045]'
        : 'border-text-muted/20 bg-surface-raised'

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`absolute cursor-grab border px-4 py-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition-colors active:cursor-grabbing ${tone}`}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <span className="block truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-text-muted">{node.eyebrow}</span>
      <span className="mt-2 block truncate font-mono text-[0.82rem] text-text-primary">{node.title}</span>
      <span className="mt-1 block truncate font-mono text-[0.66rem] text-text-muted">{node.subtitle}</span>
      <span className="mt-3 flex items-center justify-between gap-3 border-t border-sand-400/10 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-muted">
        <span className="min-w-0 truncate">{node.meta}</span>
        {node.status && <StatusPill status={node.status} />}
      </span>
    </button>
  )
}

function BillingSummaryPanel({ billing }: { billing?: BillingAccount }) {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelBillingTitle')} detail={billing?.has_card ? `${billing.card_brand} **** ${billing.card_last4}` : t('panelNoCard')} />
      <div className="grid gap-px bg-sand-400/10 font-mono text-[0.74rem]">
        <InfoRow label={t('panelBalance')} value={formatMoney(billing?.balance_cents ?? 0)} />
        <InfoRow label={t('panelAutoTopUp')} value={billing?.auto_topup_enabled ? t('panelEnabled') : t('panelDisabled')} />
      </div>
    </section>
  )
}

function ApiKeysSummaryPanel() {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelApiKeysTitle')} detail={t('panelNavApiKeys')} />
      <div className="p-4 font-mono text-[0.74rem] leading-relaxed text-text-muted">
        {t('panelApiKeysSubtitle')}
      </div>
      <div className="border-t border-sand-400/10 p-4">
        <Link to="/panel/api-keys" className="panel-button-secondary inline-block">{t('panelIssueKey')}</Link>
      </div>
    </section>
  )
}

function AutoTopupPanel({ billing, updateAutoTopUp }: {
  billing?: BillingAccount
  updateAutoTopUp: (enabled: boolean, thresholdCents: number, amountCents: number) => void
}) {
  const t = useT()
  const [enabled, setEnabled] = useState(Boolean(billing?.auto_topup_enabled))
  const [threshold, setThreshold] = useState((billing?.auto_topup_threshold_cents ?? 500) / 100)
  const [amount, setAmount] = useState((billing?.auto_topup_amount_cents ?? 2000) / 100)

  useEffect(() => {
    setEnabled(Boolean(billing?.auto_topup_enabled))
    setThreshold((billing?.auto_topup_threshold_cents ?? 500) / 100)
    setAmount((billing?.auto_topup_amount_cents ?? 2000) / 100)
  }, [billing])

  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelAutoTopUp')} detail={enabled ? t('panelEnabled') : t('panelDisabled')} />
      <div className="space-y-4 p-4">
        <label className="flex items-center justify-between gap-3 font-mono text-[0.74rem] text-text-secondary">
          {t('panelAutoTopUp')}
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 accent-[#D4A853]"
          />
        </label>
        <MoneyInput label={t('panelThreshold')} value={threshold} setValue={setThreshold} />
        <MoneyInput label={t('panelAmount')} value={amount} setValue={setAmount} />
        <button
          onClick={() => updateAutoTopUp(enabled, dollarsToCents(threshold), dollarsToCents(amount))}
          className="panel-button-primary"
          disabled={!billing?.has_card}
        >
          {t('panelSaveAutoTopUp')}
        </button>
      </div>
    </section>
  )
}

function MoneyInput({ label, value, setValue }: {
  label: string
  value: number
  setValue: (value: number) => void
}) {
  return (
    <label className="block font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
      {label}
      <input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="mt-2 w-full border border-sand-400/14 bg-surface px-3 py-2 font-mono text-[0.82rem] text-text-primary outline-none focus:border-sand-400/45"
      />
    </label>
  )
}

function LedgerPanel({ ledger, locale }: { ledger: LedgerEntry[]; locale: Locale }) {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelLedger')} detail={`${ledger.length}`} />
      <div className="divide-y divide-sand-400/10">
        {ledger.map((entry) => (
          <div key={entry.id} className="grid gap-2 px-4 py-3 font-mono text-[0.72rem] sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-text-secondary">{ledgerEntryLabel(entry, t)}</p>
              <p className="mt-1 text-text-muted">{shortTime(entry.created_at, locale)} · {entry.box_id || t('panelNotAvailable')}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className={entry.amount_cents >= 0 ? 'text-emerald-300' : 'text-red-300'}>{signedMoney(entry.amount_cents)}</p>
              <p className="mt-1 text-text-muted">{formatMoney(entry.balance_after_cents)}</p>
            </div>
          </div>
        ))}
        {ledger.length === 0 && <EmptyState>{t('panelNoLedger')}</EmptyState>}
      </div>
    </section>
  )
}

function TopupsPanel({ topups, locale }: { topups: TopupRecord[]; locale: Locale }) {
  const t = useT()
  return (
    <section className="border border-sand-400/12 bg-sand-400/[0.025]">
      <PanelTitle title={t('panelTopUps')} detail={`${topups.length}`} />
      <div className="divide-y divide-sand-400/10">
        {topups.map((topup) => (
          <div key={topup.id} className="grid gap-2 px-4 py-3 font-mono text-[0.72rem] sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-text-secondary">{topupReasonLabel(topup, t)}</p>
              <p className="mt-1 text-text-muted">{shortTime(topup.created_at, locale)} · {topup.error || topupStatusLabel(topup.status, t)}</p>
            </div>
            <p className="text-sand-400 sm:text-right">{formatMoney(topup.amount_cents)}</p>
          </div>
        ))}
        {topups.length === 0 && <EmptyState>{t('panelNoTopups')}</EmptyState>}
      </div>
    </section>
  )
}

function SecretBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="mb-6 border border-sand-400/30 bg-sand-400/[0.04] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-sand-400">{t('panelNewApiKey')}</p>
          <p className="mt-1 font-mono text-[0.66rem] text-text-muted">{t('panelSecretHint')}</p>
          <code className="mt-2 block break-all font-mono text-[0.78rem] text-text-secondary">{secret}</code>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="panel-button-primary">{copied ? t('panelCopied') : t('panelCopy')}</button>
          <button onClick={onDismiss} className="panel-button-secondary">{t('panelHide')}</button>
        </div>
      </div>
    </div>
  )
}

function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-sand-400/10 px-4 py-3">
      <h2 className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-sand-400">{title}</h2>
      <span className="font-mono text-[0.65rem] text-text-muted">{detail}</span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
      <span className="text-text-muted">{label}</span>
      <span className="text-right text-text-secondary">{value}</span>
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center font-mono text-[0.72rem] text-text-muted">
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const t = useT()
  const tone = status === 'running'
    ? 'text-emerald-300'
    : status === 'error'
      ? 'text-red-300'
      : status === 'creating'
        ? 'text-sand-400'
        : 'text-text-muted'
  return <span className={`font-mono text-[0.68rem] uppercase ${tone}`}>{statusLabel(status, t)}</span>
}

function useRelayCatalog(): RelayCatalogItem[] {
  const t = useT()
  return useMemo(() => ([
    {
      id: 'wechatbox',
      kind: 'functional' as const,
      title: t('panelCatalogWechatTitle'),
      description: t('panelCatalogWechatDesc'),
      relation: t('panelRelationAddon'),
      meta: t('panelCatalogMessaging'),
    },
    {
      id: 'logbox',
      kind: 'functional' as const,
      title: t('panelCatalogLogboxTitle'),
      description: t('panelCatalogLogboxDesc'),
      relation: t('panelRelationAddon'),
      meta: t('panelCatalogObservability'),
    },
    {
      id: 'browserbox',
      kind: 'functional' as const,
      title: t('panelCatalogBrowserboxTitle'),
      description: t('panelCatalogBrowserboxDesc'),
      relation: t('panelRelationAddon'),
      meta: t('panelCatalogBrowserAutomation'),
    },
    {
      id: 'mailsbox',
      kind: 'functional' as const,
      title: t('panelCatalogMailsboxTitle'),
      description: t('panelCatalogMailsboxDesc'),
      relation: t('panelRelationAddon'),
      meta: t('panelCatalogInboxRelay'),
    },
    {
      id: 'runnerbox',
      kind: 'functional' as const,
      title: t('panelCatalogRunnerboxTitle'),
      description: t('panelCatalogRunnerboxDesc'),
      relation: t('panelRelationAddon'),
      meta: t('panelCatalogJobRunner'),
    },
    {
      id: 'public-compute',
      kind: 'public-node' as const,
      title: t('panelCatalogPublicComputeTitle'),
      description: t('panelCatalogPublicComputeDesc'),
      relation: t('panelRelationPublicNode'),
      meta: t('panelCatalogWarmPool'),
    },
    {
      id: 'public-browser-relay',
      kind: 'public-node' as const,
      title: t('panelCatalogPublicBrowserTitle'),
      description: t('panelCatalogPublicBrowserDesc'),
      relation: t('panelRelationPublicNode'),
      meta: t('panelCatalogRelayNode'),
    },
    {
      id: 'public-data-relay',
      kind: 'public-node' as const,
      title: t('panelCatalogPublicDataTitle'),
      description: t('panelCatalogPublicDataDesc'),
      relation: t('panelRelationPublicNode'),
      meta: t('panelCatalogDataPlane'),
    },
    {
      id: 'public-edge',
      kind: 'public-node' as const,
      title: t('panelCatalogPublicEdgeTitle'),
      description: t('panelCatalogPublicEdgeDesc'),
      relation: t('panelRelationPublicNode'),
      meta: t('panelCatalogIngress'),
    },
  ]), [t])
}

function buildRelayCanvasModel(
  graph: RelayGraph | undefined,
  boxes: PanelBox[],
  catalog: RelayCatalogItem[],
  t: ReturnType<typeof useT>,
): { nodes: RelayCanvasNode[]; edges: RelayCanvasEdge[] } {
  const rootBoxes = boxes.filter((box) => !box.owner_box_id)
  const addonBoxes = boxes.filter((box) => box.owner_box_id)
  const visibleBoxes = [...rootBoxes, ...addonBoxes].slice(0, 6)
  const currentNodes: RelayCanvasNode[] = visibleBoxes.map((box, index) => ({
    id: box.id,
    kind: 'project',
    title: box.type || t('panelBox'),
    subtitle: box.id,
    eyebrow: t('panelCurrentProject'),
    meta: box.relay_name || box.image,
    status: box.status,
    x: 56,
    y: 54 + index * 108,
    width: 250,
    height: 92,
  }))

  if (currentNodes.length === 0) {
    currentNodes.push({
      id: 'new-sandbox',
      kind: 'empty',
      title: t('panelCanvasNewSandbox'),
      subtitle: t('panelProjectScopedHint'),
      eyebrow: t('panelCurrentProject'),
      meta: t('panelSuggestedRelations'),
      x: 56,
      y: 254,
      width: 250,
      height: 102,
    })
  }

  const functionalNodes = catalog
    .filter((item) => item.kind === 'functional')
    .map((item, index) => ({
      id: `catalog-${item.id}`,
      kind: 'functional' as const,
      title: item.title,
      subtitle: item.description,
      eyebrow: t('panelFunctionalBoxes'),
      meta: item.meta,
      x: 430,
      y: 38 + index * 118,
      width: 250,
      height: 96,
    }))

  const publicNodes = catalog
    .filter((item) => item.kind === 'public-node')
    .map((item, index) => ({
      id: `catalog-${item.id}`,
      kind: 'public-node' as const,
      title: item.title,
      subtitle: item.description,
      eyebrow: t('panelPublicNodes'),
      meta: item.meta,
      x: 828,
      y: 92 + index * 126,
      width: 250,
      height: 96,
    }))

  const nodes = [...currentNodes, ...functionalNodes, ...publicNodes]
  const nodeIds = new Set(nodes.map((node) => node.id))
  const primarySource = currentNodes[0]!
  const existingEdges: RelayCanvasEdge[] = (graph?.edges ?? [])
    .filter((edge) => edge.from && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge) => ({
      id: `live-${edge.from}-${edge.to}-${edge.type}`,
      from: edge.from!,
      to: edge.to,
      label: edge.type,
      kind: 'live',
    }))

  const availableEdges: RelayCanvasEdge[] = [...functionalNodes, ...publicNodes].map((node) => ({
    id: `available-${primarySource.id}-${node.id}`,
    from: primarySource.id,
    to: node.id,
    label: node.kind === 'functional' ? t('panelRelationAddon') : t('panelRelationPublicNode'),
    kind: 'available',
  }))

  return { nodes, edges: [...existingEdges, ...availableEdges] }
}

function getRelayCanvasSize(nodes: RelayCanvasNode[]): { width: number; height: number } {
  const padding = 88
  const width = Math.max(1180, ...nodes.map((node) => node.x + node.width + padding))
  const height = Math.max(544, ...nodes.map((node) => node.y + node.height + padding))
  return { width, height }
}

function panelApiErrorMessage(message: string, t: ReturnType<typeof useT>): string {
  if (message === 'Unauthorized') return t('panelApiErrorUnauthorized')
  if (message === 'Project required') return t('panelApiErrorProjectRequired')
  if (message === 'Project name is required') return t('panelApiErrorProjectNameRequired')
  if (message === 'Project not found') return t('panelApiErrorProjectNotFound')
  if (message === 'Project node not found') return t('panelApiErrorProjectNodeNotFound')
  if (message === 'Cannot delete the last project') return t('panelApiErrorCannotDeleteLastProject')
  if (message === 'Project still has boxes') return t('panelApiErrorProjectHasBoxes')
  if (message === 'Stripe is not configured') return t('panelApiErrorStripeNotConfigured')
  if (message === 'Card required') return t('panelApiErrorCardRequired')
  return message
}

function apiKeyNameLabel(name: string, t: ReturnType<typeof useT>): string {
  if (name === 'Panel key') return t('panelDefaultApiKeyName')
  if (name === 'Default key') return t('panelInitialApiKeyName')
  return name
}

function ledgerEntryLabel(entry: LedgerEntry, t: ReturnType<typeof useT>): string {
  if (entry.description === 'balance top up') return t('panelLedgerBalanceTopUp')
  if (entry.description === 'top up') return t('panelLedgerBalanceTopUp')
  if (entry.description === 'box create') return t('panelLedgerBoxCreate')
  if (entry.description === 'box keep-alive') return t('panelLedgerBoxKeepAlive')
  if (entry.description) return entry.description
  if (entry.kind === 'credit') return t('panelLedgerCredit')
  if (entry.kind === 'debit') return t('panelLedgerDebit')
  if (entry.kind === 'adjustment') return t('panelLedgerAdjustment')
  return entry.kind
}

function topupReasonLabel(topup: TopupRecord, t: ReturnType<typeof useT>): string {
  if (topup.reason) return topup.reason
  return t('panelManualTopUp')
}

function topupStatusLabel(status: string, t: ReturnType<typeof useT>): string {
  if (status === 'pending') return t('panelTopupPending')
  if (status === 'succeeded') return t('panelTopupSucceeded')
  if (status === 'failed') return t('panelTopupFailed')
  return status
}

function sectionFromPath(pathname: string): PanelSection {
  if (pathname === '/panel/boxes') return 'boxes'
  if (pathname === '/panel/relay') return 'relay'
  if (pathname === '/panel/billing') return 'billing'
  if (pathname === '/panel/api-keys') return 'api-keys'
  if (pathname === '/panel/project-settings') return 'project-settings'
  return 'overview'
}

function getPanelRedirectUrl(): string {
  if (typeof window === 'undefined') return PANEL_ROOT
  if (!window.location.pathname.startsWith(PANEL_ROOT)) return PANEL_ROOT
  return `${window.location.pathname}${window.location.search}`
}

function normalizeProjectNodes(nodes: ProjectNode[] | undefined): ProjectNode[] {
  const source = nodes && nodes.length > 0
    ? nodes
    : [{ node_id: 'tyo-1', server_name: 'TYO-1', region: 'Tokyo', country_code: 'JP' }]
  return source.map((node) => ({
    node_id: node.node_id || 'tyo-1',
    server_name: (node.server_name || node.node_id || 'tyo-1').toUpperCase(),
    region: node.region || 'Tokyo',
    country_code: normalizeCountryCode(node.country_code) || 'JP',
    flag_emoji: node.flag_emoji || countryCodeToFlag(node.country_code || 'JP'),
  }))
}

function formatProjectNodeOption(node: ProjectNode): string {
  return `${formatProjectNodeName(node)} ${node.flag_emoji || countryCodeToFlag(node.country_code)} ${node.region}`
}

function formatProjectNodeBadge(project: Project | undefined): string {
  return `${formatProjectNodeName(project)} ${formatProjectFlag(project)}`
}

function formatProjectRegionBadge(project: Project | undefined): string {
  return `${formatProjectFlag(project)} ${project?.region || project?.placement?.region || 'Tokyo'}`
}

function formatProjectNodeName(project: Project | ProjectNode | undefined): string {
  const placement = project && 'placement' in project ? project.placement : undefined
  return (project?.server_name || placement?.server_name || project?.node_id || placement?.node_id || 'tyo-1').toUpperCase()
}

function formatProjectNodeId(project: Project | undefined): string {
  return project?.node_id || project?.placement?.node_id || 'tyo-1'
}

function formatProjectFlag(project: Project | undefined): string {
  return project?.flag_emoji
    || project?.placement?.flag_emoji
    || countryCodeToFlag(project?.country_code || project?.placement?.country_code || 'JP')
}

function normalizeCountryCode(countryCode: string | undefined): string {
  const normalized = countryCode?.trim().toUpperCase() ?? ''
  return /^[A-Z]{2}$/.test(normalized) ? normalized : ''
}

function countryCodeToFlag(countryCode: string): string {
  const normalized = normalizeCountryCode(countryCode)
  if (!normalized) return ''
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)))
}

function statusLabel(status: string, t: ReturnType<typeof useT>): string {
  if (status === 'running') return t('panelStatusRunning')
  if (status === 'stopped') return t('panelStatusStopped')
  if (status === 'error') return t('panelStatusError')
  if (status === 'terminated') return t('panelStatusTerminated')
  if (status === 'creating') return t('panelStatusCreating')
  return status
}

function formatPorts(ports: Record<string, number> | null): string {
  if (!ports) return ''
  return Object.entries(ports)
    .map(([guest, host]) => `${guest}->${host}`)
    .join(', ')
}

function appendProjectId(path: string, projectId: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}project_id=${encodeURIComponent(projectId)}`
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function signedMoney(cents: number): string {
  const prefix = cents > 0 ? '+' : ''
  return `${prefix}${formatMoney(cents)}`
}

function dollarsToCents(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value * 100 : 0))
}

function shortTime(value: string | null, locale: Locale): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(localeToBCP47(locale), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function localeToBCP47(locale: Locale): string {
  if (locale === 'zh') return 'zh-CN'
  if (locale === 'ja') return 'ja-JP'
  return 'en-US'
}
