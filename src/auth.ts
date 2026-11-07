export const API = 'https://prod-api.tomatoanimes.com'
export const APP_VERSION = '1.5.1'

// The Android app sends `<release>/<manufacturer>/<model>`; same shape, honest values.
const FINGERPRINT = '1/juntos/web'
const DEVICE_MODEL = 'juntos web'

export interface Account {
  uuid: string
  user_name: string
  user_email?: string
  user_profile_picture?: string | null
}

export interface Session {
  accessToken: string
  refreshToken: string
  /** Epoch ms when the access token stops working. */
  expiresAt: number
  account: Account
}

export interface AuthDeps {
  fetch: typeof fetch
  now?: () => number
}

export class AuthError extends Error {
  readonly status: number
  readonly code: string | null
  constructor(status: number, code: string | null, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function errorMessage(status: number, code: string | null, serverMessage?: unknown): string {
  if (status === 429) return 'Muitas tentativas, espere um pouco'
  if (code === 'invalid_credentials') return 'Email ou senha incorretos'
  if (code === 'validation_error') return 'Confirme o captcha de novo'
  if (status === 0) return 'Sem conexão com o Tomato'
  if (status >= 400 && status < 500 && typeof serverMessage === 'string' && serverMessage && serverMessage.length <= 160) {
    return serverMessage
  }
  return 'O Tomato não respondeu, tente de novo'
}

/** 32 random bytes in unpadded base64url: the refresh token the client proposes. */
export function newRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function authPost(deps: AuthDeps, path: string, body: unknown, token?: string): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-app': APP_VERSION }
  if (token) headers.authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await deps.fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new AuthError(0, null, errorMessage(0, null))
  }
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data as { error?: { code?: unknown; message?: unknown } } | null)?.error
    const c = typeof err?.code === 'string' ? err.code : null
    throw new AuthError(res.status, c, errorMessage(res.status, c, err?.message))
  }
  return data
}

function toSession(data: unknown, refreshToken: string, now: number): Session {
  const d = data as { access_token?: unknown; expires_in?: unknown; account?: unknown } | null
  if (!d || typeof d.access_token !== 'string' || !d.account || typeof d.account !== 'object') {
    throw new AuthError(500, null, errorMessage(500, null))
  }
  const expiresIn = typeof d.expires_in === 'number' ? d.expires_in : 1800
  return { accessToken: d.access_token, refreshToken, expiresAt: now + expiresIn * 1000, account: d.account as Account }
}

export async function login(
  deps: AuthDeps,
  f: { email: string; password: string; verification: string },
): Promise<Session> {
  const refresh_token = newRefreshToken()
  const data = await authPost(deps, '/v3/auth/login', {
    email: f.email, password: f.password, verification: f.verification,
    fingerprint: FINGERPRINT, device_model: DEVICE_MODEL, refresh_token,
  })
  return toSession(data, refresh_token, (deps.now ?? Date.now)())
}

export async function register(
  deps: AuthDeps,
  f: { username: string; email: string; password: string; verification: string },
): Promise<Session> {
  const refresh_token = newRefreshToken()
  const data = await authPost(deps, '/v3/auth/register', {
    username: f.username, email: f.email, password: f.password, verification: f.verification,
    fingerprint: FINGERPRINT, device_model: DEVICE_MODEL, refresh_token,
  })
  return toSession(data, refresh_token, (deps.now ?? Date.now)())
}

export async function refreshSession(deps: AuthDeps, s: Session): Promise<Session> {
  const data = await authPost(deps, '/v3/auth/refresh', { refresh_token: s.refreshToken, device_model: DEVICE_MODEL })
  const d = data as { access_token?: unknown; expires_in?: unknown; refresh_token?: unknown } | null
  if (!d || typeof d.access_token !== 'string') throw new AuthError(500, null, errorMessage(500, null))
  const expiresIn = typeof d.expires_in === 'number' ? d.expires_in : 1800
  return {
    ...s,
    accessToken: d.access_token,
    refreshToken: typeof d.refresh_token === 'string' && d.refresh_token ? d.refresh_token : s.refreshToken,
    expiresAt: (deps.now ?? Date.now)() + expiresIn * 1000,
  }
}

export interface SessionStore {
  get(): Session | null
  set(s: Session | null): void
}

/** The session lives only in this extension's origin. */
export function sessionStore(storage: Storage, key = 'tomato.session'): SessionStore {
  return {
    get() {
      try {
        const s = JSON.parse(storage.getItem(key) ?? 'null') as Session | null
        if (!s || typeof s.accessToken !== 'string' || typeof s.refreshToken !== 'string') return null
        if (typeof s.expiresAt !== 'number' || !s.account || typeof s.account !== 'object') return null
        return s
      } catch {
        return null
      }
    },
    set(s) {
      try {
        if (s) storage.setItem(key, JSON.stringify(s))
        else storage.removeItem(key)
      } catch { /* storage blocked: the session lasts as long as the page */ }
    },
  }
}
