import { API, APP_VERSION, AuthError, authPost, refreshSession, type Session, type SessionStore } from './auth'

const RENEW_BEFORE_MS = 2 * 60_000
export const EPISODE_PAGE = 25

// Shapes of the Tomato API as measured; every field is still checked where it is used.
// Feed rows are typed by `type` (3 banner, 5 posters, 6 highlight, 7 new episodes…).
export interface Feed { data?: unknown[] }

export interface Season { season_id: number; season_name: string; season_number: number; season_dubbed: number }
export interface AnimePage {
  anime_details?: {
    anime_id: number; anime_name?: string; anime_description?: string; anime_parental_rating?: string
    anime_date?: string; anime_genre?: string; anime_cover_url?: string; anime_cape_url?: string
    anime_banner_url?: string; anime_episodes?: number; dub_available?: boolean
  }
  anime_seasons?: Season[]
}

export interface Episode { id: number; number?: number; name?: string | null; thumbnail?: string | null; duration_minutes?: number | null }
export interface EpisodePage { episodes?: Episode[]; pagination?: { has_more?: boolean; total?: number } }

export interface Stream {
  streams?: { shd?: string | null; mhd?: string | null; fhd?: string | null } | null
  episodeName?: string
  nextEpisodeID?: number
}

export interface SearchItem { id?: number; type?: string; name?: string; image?: string; episodes?: number }
export interface SearchPage { result?: SearchItem[] }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message = 'O Tomato não respondeu, tente de novo') {
    super(message)
    this.status = status
  }
}

export interface ApiDeps {
  fetch: typeof fetch
  store: SessionStore
  now?: () => number
}

export type Api = ReturnType<typeof createApi>

/**
 * The Tomato API as the signed-in person: renews the token before it expires
 * and once more on a 401; when the refresh token is refused, the session is
 * dropped and `onSignedOut` listeners run.
 */
export function createApi(deps: ApiDeps) {
  const now = deps.now ?? Date.now
  const listeners = new Set<() => void>()
  let renewing: Promise<Session> | null = null

  function signOut() {
    deps.store.set(null)
    for (const l of listeners) l()
  }

  function renew(s: Session): Promise<Session> {
    renewing ??= refreshSession({ fetch: deps.fetch, now }, s)
      .then((next) => {
        deps.store.set(next)
        return next
      })
      .catch((e: unknown) => {
        const refused = e instanceof AuthError && e.status >= 400 && e.status < 500 && e.status !== 429
        if (refused) signOut()
        throw new ApiError(e instanceof AuthError ? e.status : 0, e instanceof Error ? e.message : undefined)
      })
      .finally(() => { renewing = null })
    return renewing
  }

  async function send(method: string, path: string, body: unknown, token: string): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'x-app': APP_VERSION }
    if (body !== undefined) headers['content-type'] = 'application/json'
    try {
      return await deps.fetch(`${API}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'Sem conexão com o Tomato')
    }
  }

  async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    let s = deps.store.get()
    if (!s) {
      signOut()
      throw new ApiError(401, 'Entre de novo')
    }
    if (now() >= s.expiresAt - RENEW_BEFORE_MS) s = await renew(s)
    let res = await send(method, path, body, s.accessToken)
    if (res.status === 401) {
      s = await renew(s)
      res = await send(method, path, body, s.accessToken)
    }
    if (!res.ok) {
      throw new ApiError(res.status, res.status === 429 ? 'Muitas tentativas, espere um pouco' : undefined)
    }
    return (await res.json().catch(() => {
      throw new ApiError(res.status)
    })) as T
  }

  async function logout(): Promise<void> {
    const s = deps.store.get()
    deps.store.set(null)
    if (!s) return
    await authPost({ fetch: deps.fetch, now }, '/v3/auth/logout', { refresh_token: s.refreshToken }, s.accessToken)
      .catch(() => {})
  }

  return {
    request,
    logout,
    feed: () => request<Feed>('GET', '/v2/animes/feed'),
    anime: (id: number) => request<AnimePage>('GET', `/v2/anime/${id}`),
    episodes: (seasonId: number, offset: number) =>
      request<EpisodePage>('GET', `/v3/seasons/${seasonId}/episodes?order=asc&limit=${EPISODE_PAGE}&offset=${offset}`),
    stream: (episodeId: number) => request<Stream>('GET', `/v2/anime/episode/${episodeId}/stream`),
    search: (text: string, page: number) =>
      request<SearchPage>('POST', '/v2/content/search', { search: text, content_type: 'anime', page }),
    session: () => deps.store.get(),
    signIn: (s: Session) => deps.store.set(s),
    onSignedOut(cb: () => void) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
  }
}
