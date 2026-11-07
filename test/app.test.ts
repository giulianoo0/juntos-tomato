import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import type { ExtSource, InitMessage, Juntos } from '../src/juntos'
import { memoryStorage } from './helpers'
import { NOW, settle } from './ctx'

const FHD = 'https://us-east-2.vv-vrv.co/1320/15228/1080p.m3u8?policy=p'

function fakeJuntos() {
  const h: { init?: (m: InitMessage) => void; refresh?: (ref: string) => Promise<ExtSource | null> } = {}
  const juntos: Juntos = {
    onInit: (cb) => { h.init = cb },
    onTheme: vi.fn(),
    onRefresh: (cb) => { h.refresh = cb },
    ready: vi.fn(),
    play: vi.fn(),
    close: vi.fn(),
    toast: vi.fn(),
  }
  return { juntos, h }
}

function apiFetch(routes: Record<string, unknown>) {
  const calls: string[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).replace('https://prod-api.tomatoanimes.com', '').split('?')[0]
    calls.push(path)
    if (!(path in routes)) return new Response('{}', { status: 404 })
    const r = routes[path]
    if (r instanceof Response) return r
    return new Response(JSON.stringify(r), { status: 200 })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

function signedInStorage() {
  const s = memoryStorage()
  s.setItem('tomato.session', JSON.stringify({
    accessToken: 'a', refreshToken: 'r', expiresAt: NOW + 3_600_000, account: { uuid: 'u', user_name: 'nick' },
  }))
  return s
}

const init = (canPlay: boolean): InitMessage => ({ theme: { mode: 'dark', vars: {} }, locale: 'pt-BR', canPlay })
const captcha = () => ({ token: () => 'cap', reset: () => {} })

let root: HTMLElement
afterEach(() => { vi.useRealTimers(); root?.remove(); document.body.querySelectorAll('.popover').forEach((p) => p.remove()) })

function mount(storage: Storage, routes: Record<string, unknown> = {}, canPlay: boolean | null = true) {
  root = document.createElement('div')
  document.body.append(root)
  const { juntos, h } = fakeJuntos()
  const f = apiFetch({ '/v2/animes/feed': { data: [] }, ...routes })
  createApp({ root, juntos, storage, fetch: f.fetch, now: () => NOW, captcha })
  if (canPlay !== null) h.init!(init(canPlay))
  return { juntos, h, calls: f.calls }
}

describe('app', () => {
  it('says ready and starts on sign-in without a session', async () => {
    const { juntos } = mount(memoryStorage())
    await settle()
    expect(juntos.ready).toHaveBeenCalledOnce()
    expect(root.querySelector('h1')!.textContent).toBe('Entrar no Tomato')
  })

  it('starts on the home with a session, loading it once', async () => {
    const { calls } = mount(signedInStorage())
    await settle()
    expect(calls.filter((c) => c === '/v2/animes/feed')).toHaveLength(1)
    expect(root.querySelector('.view.home')).not.toBeNull()
  })

  it('waits for init before the first screen, but not forever', async () => {
    vi.useFakeTimers()
    const { calls } = mount(signedInStorage(), {}, null)
    expect(root.querySelector('.view')).toBeNull()
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toContain('/v2/animes/feed')
    vi.useRealTimers()
  })

  it('answers a refresh with a fresh stream for the episode', async () => {
    const { h } = mount(signedInStorage(), { '/v2/anime/episode/15228/stream': { streams: { fhd: FHD } } })
    const src = await h.refresh!('15228')
    expect(src).toEqual({ kind: 'hls', url: FHD })
  })

  it('a refused session sends the person back to sign-in', async () => {
    mount(signedInStorage(), {
      '/v2/animes/feed': new Response('{}', { status: 401 }),
      '/v3/auth/refresh': new Response(JSON.stringify({ error: { code: 'invalid_refresh_token' } }), { status: 401 }),
    })
    await settle()
    expect(root.querySelector('h1')!.textContent).toBe('Entrar no Tomato')
  })

  it('does not play when juntos says this person cannot', async () => {
    const { juntos } = mount(signedInStorage(), {
      '/v2/animes/feed': { data: [{ type: 7, title: 'Novos', data: [{ ep_id: 5, ep_anime_id: 6, anime_name: 'A', ep_name: 'B' }] }] },
      '/v2/anime/6': { anime_details: { anime_id: 6, anime_name: 'A' }, anime_seasons: [] },
    }, false)
    await settle()
    root.querySelector<HTMLElement>('[data-episode="5"]')!.click()
    await settle()
    expect(juntos.play).not.toHaveBeenCalled()
    expect(root.querySelector('.anime')).not.toBeNull()
  })

  it('a failed play becomes a toast in juntos', async () => {
    const { juntos } = mount(signedInStorage(), {
      '/v2/animes/feed': { data: [{ type: 7, title: 'Novos', data: [{ ep_id: 5, ep_anime_id: 6, anime_name: 'A', ep_name: 'B' }] }] },
      '/v2/anime/episode/5/stream': { streams: { fhd: null, mhd: null, shd: null } },
    })
    await settle()
    root.querySelector<HTMLElement>('[data-episode="5"]')!.click()
    await settle()
    expect(juntos.play).not.toHaveBeenCalled()
    expect(juntos.toast).toHaveBeenCalledWith('Episódio indisponível')
  })

  it('goes back from an anime to where it came from', async () => {
    mount(signedInStorage(), {
      '/v2/animes/feed': { data: [{ type: 5, title: 'Novos', data: [{ anime_id: 6, thumbnail: '' }] }] },
      '/v2/anime/6': { anime_details: { anime_id: 6, anime_name: 'A' }, anime_seasons: [] },
    })
    await settle()
    root.querySelector<HTMLElement>('[data-anime="6"]')!.click()
    await settle()
    root.querySelector<HTMLElement>('button[aria-label="Voltar"]')!.click()
    await settle()
    expect(root.querySelector('.view.home')).not.toBeNull()
  })

  it('back keeps the search as it was, without searching again', async () => {
    const { calls } = mount(signedInStorage(), {
      '/v2/content/search': { result: [{ id: 6, type: 'anime', name: 'Achado' }] },
      '/v2/anime/6': { anime_details: { anime_id: 6, anime_name: 'A' }, anime_seasons: [] },
    })
    await settle()
    ;[...root.querySelectorAll<HTMLElement>('.nav-tab')].find((b) => b.textContent === 'Buscar')!.click()
    expect(root.querySelector('button[aria-label="Voltar"]')).toBeNull()
    root.querySelector('input')!.value = 'ach'
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    root.querySelector<HTMLElement>('[data-anime="6"]')!.click()
    await settle()
    root.querySelector<HTMLElement>('button[aria-label="Voltar"]')!.click()
    await settle()
    expect(root.querySelector('input')!.value).toBe('ach')
    expect(root.textContent).toContain('Achado')
    expect(calls.filter((c) => c === '/v2/content/search')).toHaveLength(1)
  })

  it('signs out from the account menu', async () => {
    const storage = signedInStorage()
    const { calls } = mount(storage, { '/v3/auth/logout': {} })
    await settle()
    root.querySelector<HTMLElement>('button[aria-label="Conta"]')!.click()
    ;[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((b) => b.textContent === 'Sair')!.click()
    await settle()
    expect(calls).toContain('/v3/auth/logout')
    expect(storage.getItem('tomato.session')).toBeNull()
    expect(root.querySelector('h1')!.textContent).toBe('Entrar no Tomato')
  })

  it('remembers the quality chosen', async () => {
    const storage = signedInStorage()
    storage.setItem('tomato.quality', 'shd')
    const { h } = mount(storage, { '/v2/anime/episode/1/stream': { streams: { fhd: FHD, shd: FHD.replace('1080', '480') } } })
    expect(await h.refresh!('1')).toEqual({ kind: 'hls', url: FHD.replace('1080', '480') })
  })
})
