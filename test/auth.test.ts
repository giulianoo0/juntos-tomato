import { describe, expect, it } from 'vitest'
import { AuthError, login, register } from '../src/auth'
import { fakeFetch, json } from './helpers'

const API = 'https://prod-api.tomatoanimes.com'
const okLogin = {
  status: true,
  session_id: 's-1',
  access_token: 'acc-1',
  expires_in: 1800,
  account: { uuid: 'u-1', user_name: 'm4rquit', user_email: 'a@b.c', user_profile_picture: null },
}

describe('login', () => {
  it('posts the credentials with a fresh client-proposed refresh token', async () => {
    const { fetch, calls } = fakeFetch(json(200, okLogin))
    await login({ fetch, now: () => 0 }, { email: 'a@b.c', password: 'pw', verification: 'cap' })

    expect(calls[0].url).toBe(`${API}/v3/auth/login`)
    expect(calls[0].method).toBe('POST')
    const body = calls[0].body as Record<string, string>
    expect(Object.keys(body).sort()).toEqual(
      ['device_model', 'email', 'fingerprint', 'password', 'refresh_token', 'verification'],
    )
    expect(body).toMatchObject({ email: 'a@b.c', password: 'pw', verification: 'cap' })
    expect(body.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('returns a session holding the proposed refresh token and the expiry', async () => {
    const { fetch, calls } = fakeFetch(json(200, okLogin))
    const s = await login({ fetch, now: () => 1_000 }, { email: 'a@b.c', password: 'pw', verification: 'cap' })

    expect(s.accessToken).toBe('acc-1')
    expect(s.refreshToken).toBe((calls[0].body as { refresh_token: string }).refresh_token)
    expect(s.expiresAt).toBe(1_000 + 1800 * 1000)
    expect(s.account.user_name).toBe('m4rquit')
  })

  it('proposes a different refresh token every time', async () => {
    const { fetch, calls } = fakeFetch(json(200, okLogin), json(200, okLogin))
    await login({ fetch }, { email: 'a', password: 'b', verification: 'c' })
    await login({ fetch }, { email: 'a', password: 'b', verification: 'c' })
    expect((calls[0].body as { refresh_token: string }).refresh_token)
      .not.toBe((calls[1].body as { refresh_token: string }).refresh_token)
  })
})

describe('register', () => {
  it('posts the sign-up form with a refresh token', async () => {
    const { fetch, calls } = fakeFetch(json(201, okLogin))
    const s = await register({ fetch }, { username: 'nick', email: 'a@b.c', password: 'pw', verification: 'cap' })

    expect(calls[0].url).toBe(`${API}/v3/auth/register`)
    const body = calls[0].body as Record<string, string>
    expect(Object.keys(body).sort()).toEqual(
      ['device_model', 'email', 'fingerprint', 'password', 'refresh_token', 'username', 'verification'],
    )
    expect(body.username).toBe('nick')
    expect(body.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(s.refreshToken).toBe(body.refresh_token)
  })
})

describe('auth errors', () => {
  const cases: Array<[number, unknown, string]> = [
    [401, { status: false, error: { code: 'invalid_credentials', message: 'x' } }, 'Email ou senha incorretos'],
    [400, { status: false, error: { code: 'validation_error', message: 'x' } }, 'Confirme o captcha de novo'],
    [429, { status: false }, 'Muitas tentativas, espere um pouco'],
  ]
  it.each(cases)('status %i maps to a message', async (status, body, message) => {
    const { fetch } = fakeFetch(json(status, body))
    const err = await login({ fetch }, { email: 'a', password: 'b', verification: 'c' }).catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.message).toBe(message)
  })

  it('shows the server message for a 4xx it does not know', async () => {
    const { fetch } = fakeFetch(json(409, { status: false, error: { code: 'username_unavailable', message: 'Username unavailable.' } }))
    const err = await register({ fetch }, { username: 'n', email: 'a', password: 'b', verification: 'c' }).catch((e) => e)
    expect(err.message).toBe('Username unavailable.')
  })

  it('never puts the password in the error', async () => {
    const { fetch } = fakeFetch(json(500, 'boom'))
    const err = await login({ fetch }, { email: 'a', password: 'secret-pw', verification: 'c' }).catch((e) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect(String(err.message)).not.toContain('secret-pw')
  })
})
