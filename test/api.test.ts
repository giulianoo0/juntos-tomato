import { describe, expect, it, vi } from 'vitest'
import { createApi } from '../src/api'
import { sessionStore, type Session } from '../src/auth'
import { fakeFetch, json, memoryStorage } from './helpers'

const API = 'https://prod-api.tomatoanimes.com'
const NOW = 10_000_000

function signedIn(over: Partial<Session> = {}) {
  const store = sessionStore(memoryStorage())
  store.set({
    accessToken: 'acc-1', refreshToken: 'ref-1', expiresAt: NOW + 30 * 60_000,
    account: { uuid: 'u', user_name: 'n' }, ...over,
  })
  return store
}

describe('api requests', () => {
  it('sends the bearer token, the app version and JSON', async () => {
    const { fetch, calls } = fakeFetch(json(200, { result: [] }))
    const api = createApi({ fetch, store: signedIn(), now: () => NOW })
    await api.request('POST', '/v2/content/search', { search: 'x' })

    expect(calls[0].url).toBe(`${API}/v2/content/search`)
    expect(calls[0].headers.authorization).toBe('Bearer acc-1')
    expect(calls[0].headers['x-app']).toBe('1.5.1')
    expect(calls[0].headers['content-type']).toBe('application/json')
    expect(calls[0].body).toEqual({ search: 'x' })
  })

  it('refreshes once on 401 and repeats the request with the new token', async () => {
    const { fetch, calls } = fakeFetch(
      json(401, { status: false, error: { code: 'invalid_token' } }),
      json(200, { access_token: 'acc-2', expires_in: 1800 }),
      json(200, { ok: 1 }),
    )
    const store = signedIn()
    const api = createApi({ fetch, store, now: () => NOW })
    const out = await api.request('GET', '/v2/animes/feed')

    expect(out).toEqual({ ok: 1 })
    expect(calls[1].url).toBe(`${API}/v3/auth/refresh`)
    expect(calls[1].body).toMatchObject({ refresh_token: 'ref-1' })
    expect(calls[2].headers.authorization).toBe('Bearer acc-2')
    expect(store.get()?.accessToken).toBe('acc-2')
    expect(store.get()?.refreshToken).toBe('ref-1')
  })

  it('does not loop when the retried request is also 401', async () => {
    const { fetch, calls } = fakeFetch(
      json(401, {}),
      json(200, { access_token: 'acc-2', expires_in: 1800 }),
      json(401, {}),
    )
    const api = createApi({ fetch, store: signedIn(), now: () => NOW })
    await expect(api.request('GET', '/v2/animes/feed')).rejects.toThrow()
    expect(calls).toHaveLength(3)
  })

  it('a failed refresh clears the session and signs out', async () => {
    const { fetch } = fakeFetch(
      json(401, {}),
      json(401, { status: false, error: { code: 'invalid_refresh_token' } }),
    )
    const store = signedIn()
    const signedOut = vi.fn()
    const api = createApi({ fetch, store, now: () => NOW })
    api.onSignedOut(signedOut)

    await expect(api.request('GET', '/v2/animes/feed')).rejects.toThrow()
    expect(store.get()).toBeNull()
    expect(signedOut).toHaveBeenCalledOnce()
  })

  it('keeps the session when the refresh only failed to reach the server', async () => {
    const { fetch } = fakeFetch(
      json(401, {}),
      () => { throw new TypeError('Failed to fetch') },
    )
    const store = signedIn()
    const signedOut = vi.fn()
    const api = createApi({ fetch, store, now: () => NOW })
    api.onSignedOut(signedOut)

    await expect(api.request('GET', '/v2/animes/feed')).rejects.toThrow()
    expect(store.get()?.refreshToken).toBe('ref-1')
    expect(signedOut).not.toHaveBeenCalled()
  })

  it('renews two minutes before the token expires, before the request', async () => {
    const { fetch, calls } = fakeFetch(
      json(200, { access_token: 'acc-2', expires_in: 1800 }),
      json(200, {}),
    )
    const api = createApi({ fetch, store: signedIn({ expiresAt: NOW + 90_000 }), now: () => NOW })
    await api.request('GET', '/v2/animes/feed')

    expect(calls[0].url).toBe(`${API}/v3/auth/refresh`)
    expect(calls[1].headers.authorization).toBe('Bearer acc-2')
  })

  it('shares one refresh between requests that need it at the same time', async () => {
    const { fetch, calls } = fakeFetch(
      json(200, { access_token: 'acc-2', expires_in: 1800 }),
      json(200, {}),
      json(200, {}),
    )
    const api = createApi({ fetch, store: signedIn({ expiresAt: NOW }), now: () => NOW })
    await Promise.all([api.request('GET', '/a'), api.request('GET', '/b')])
    expect(calls.filter((c) => c.url.endsWith('/v3/auth/refresh'))).toHaveLength(1)
  })

  it('without a session it signs out instead of calling the API', async () => {
    const { fetch, calls } = fakeFetch()
    const signedOut = vi.fn()
    const api = createApi({ fetch, store: sessionStore(memoryStorage()), now: () => NOW })
    api.onSignedOut(signedOut)
    await expect(api.request('GET', '/v2/animes/feed')).rejects.toThrow()
    expect(calls).toHaveLength(0)
    expect(signedOut).toHaveBeenCalledOnce()
  })
})

describe('logout', () => {
  it('revokes the refresh token and forgets the session', async () => {
    const { fetch, calls } = fakeFetch(json(200, {}))
    const store = signedIn()
    const api = createApi({ fetch, store, now: () => NOW })
    await api.logout()

    expect(calls[0].url).toBe(`${API}/v3/auth/logout`)
    expect(calls[0].body).toMatchObject({ refresh_token: 'ref-1' })
    expect(store.get()).toBeNull()
  })

  it('forgets the session even when the revoke fails', async () => {
    const { fetch } = fakeFetch(json(500, {}))
    const store = signedIn()
    await createApi({ fetch, store, now: () => NOW }).logout()
    expect(store.get()).toBeNull()
  })
})

describe('session store', () => {
  it('ignores a corrupted entry', () => {
    const storage = memoryStorage()
    storage.setItem('tomato.session', '{nope')
    expect(sessionStore(storage).get()).toBeNull()
  })

  it('ignores an entry without tokens', () => {
    const storage = memoryStorage()
    storage.setItem('tomato.session', JSON.stringify({ accessToken: 1 }))
    expect(sessionStore(storage).get()).toBeNull()
  })
})
