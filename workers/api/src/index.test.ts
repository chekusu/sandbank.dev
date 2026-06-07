import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index'

const env = {
  DEFAULT_NODE_ID: 'tyo-1',
  DEFAULT_NODE_ORIGIN: 'https://tyo-1.node.sandbank.dev',
  NODE_ORIGINS_JSON: JSON.stringify({
    'tyo-1': 'https://tyo-1.node.sandbank.dev',
    'tyo-2': 'https://tyo-2.node.sandbank.dev',
  }),
  SCHEDULER_ORIGIN: 'https://tyo-1.node.sandbank.dev/__scheduler',
}

describe('sandbank api worker routing', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports configured nodes and scheduler target', async () => {
    const res = await worker.fetch(new Request('https://api.sandbank.dev/__worker/health'), env)
    expect(res.status).toBe(200)
    const body = await res.json() as {
      node_count: number
      proxy_target_id: string
      scheduler_origin: string
      nodes: Array<{ id: string }>
    }
    expect(body.node_count).toBe(2)
    expect(body.proxy_target_id).toBe('tyo-1')
    expect(body.scheduler_origin).toBe('https://tyo-1.node.sandbank.dev/__scheduler')
    expect(body.nodes.map((node) => node.id)).toEqual(['tyo-1', 'tyo-2'])
  })

  it('routes box control API through the scheduler path prefix', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'box-1', status: 'running' }),
      {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'x-sandbank-node-id': 'tyo-2',
        },
      },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/v1/boxes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'codebox' }),
    }), env)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-1.node.sandbank.dev/__scheduler/v1/boxes')
    expect(upstream.headers.get('x-sandbank-api-worker')).toBe('1')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('scheduler')
    expect(res.headers.get('x-sandbank-api-target-kind')).toBe('scheduler')
    expect(res.headers.get('x-sandbank-node-id')).toBe('tyo-2')
    expect(await res.json()).toMatchObject({ id: 'box-1' })
  })

  it('keeps non-box API calls on the selected node', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/health'), env)

    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-1.node.sandbank.dev/health')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('tyo-1')
    expect(res.headers.get('x-sandbank-api-target-kind')).toBe('node')
  })

  it('lets explicit node overrides bypass the scheduler', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ id: 'box-2', status: 'running' }),
      { status: 201, headers: { 'content-type': 'application/json' } },
    ))

    const res = await worker.fetch(new Request('https://api.sandbank.dev/v1/boxes?node_id=tyo-2', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'codebox' }),
    }), env)

    const upstream = fetchMock.mock.calls[0]?.[0] as Request
    expect(upstream.url).toBe('https://tyo-2.node.sandbank.dev/v1/boxes?node_id=tyo-2')
    expect(res.headers.get('x-sandbank-api-target-id')).toBe('tyo-2')
    expect(res.headers.get('x-sandbank-node-id')).toBe('tyo-2')
  })
})
