import { vi } from 'vitest'
import { createApi } from '../src/api'
import { sessionStore } from '../src/auth'
import type { Ctx } from '../src/views/ctx'
import { fakeFetch, memoryStorage } from './helpers'

export const NOW = 10_000_000
export const EVIL = '<img src=x onerror=alert(1)>'
export const COVER = 'https://cdn.tomatoanimes.com/cover/a.jpg'

/** A view context over a fake API that answers by path. */
export function testCtx(routes: Record<string, unknown | ((url: string, body: unknown) => unknown)>, over: Partial<Ctx> = {}) {
  const store = sessionStore(memoryStorage())
  store.set({ accessToken: 'a', refreshToken: 'r', expiresAt: NOW + 3_600_000, account: { uuid: 'u', user_name: 'nick' } })
  const answer = (call: { url: string; body: unknown }) => {
    const path = call.url.replace('https://prod-api.tomatoanimes.com', '')
    const key = Object.keys(routes).find((k) => path === k || path.startsWith(`${k}?`))
    if (!key) return new Response('{}', { status: 404 })
    const r = routes[key]
    const body = typeof r === 'function' ? (r as (u: string, b: unknown) => unknown)(path, call.body) : r
    return new Response(JSON.stringify(body), { status: 200 })
  }
  const f = fakeFetch(...Array.from({ length: 50 }, () => answer))
  const ctx: Ctx = {
    api: createApi({ fetch: f.fetch, store, now: () => NOW }),
    open: vi.fn(),
    play: vi.fn(async () => {}),
    canPlay: () => true,
    quality: () => 'fhd',
    setQuality: vi.fn(),
    signedIn: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    captcha: () => ({ token: () => 'cap', reset: vi.fn() }),
    ...over,
  }
  return { ctx, calls: f.calls }
}

export async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
}

/** Every <img> in the tree, by src. */
export function imgs(root: Element) {
  return [...root.querySelectorAll('img')].map((i) => i.getAttribute('src'))
}
