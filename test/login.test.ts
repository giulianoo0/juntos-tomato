import { describe, expect, it, vi } from 'vitest'
import { AuthError, type Session } from '../src/auth'
import { loginView } from '../src/views/login'
import { registerView } from '../src/views/register'
import { EVIL, settle, testCtx } from './ctx'

const session: Session = { accessToken: 'a', refreshToken: 'r', expiresAt: 1, account: { uuid: 'u', user_name: 'n' } }

function fill(el: HTMLElement, values: Record<string, string>) {
  for (const [name, v] of Object.entries(values)) {
    el.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value = v
  }
}
const submit = (el: HTMLElement) => el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
const byText = (el: HTMLElement, t: string) => [...el.querySelectorAll('button, a')].find((b) => b.textContent === t) as HTMLElement

describe('login', () => {
  it('signs in with the captcha token', async () => {
    const { ctx } = testCtx({}, { login: vi.fn(async () => session) })
    const el = loginView(ctx)
    fill(el, { email: 'a@b.c', password: 'pw' })
    submit(el)
    await settle()
    expect(ctx.login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw', verification: 'cap' })
    expect(ctx.signedIn).toHaveBeenCalledWith(session)
  })

  it('asks for the captcha before sending anything', async () => {
    const { ctx } = testCtx({}, { captcha: () => ({ token: () => null, reset: vi.fn() }) })
    const el = loginView(ctx)
    fill(el, { email: 'a@b.c', password: 'pw' })
    submit(el)
    await settle()
    expect(ctx.login).not.toHaveBeenCalled()
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('Confirme o captcha')
  })

  it('shows the error as text and resets the captcha', async () => {
    const reset = vi.fn()
    const { ctx } = testCtx({}, {
      login: vi.fn(async () => { throw new AuthError(401, 'x', EVIL) }),
      captcha: () => ({ token: () => 'cap', reset }),
    })
    const el = loginView(ctx)
    fill(el, { email: 'a@b.c', password: 'pw' })
    submit(el)
    await settle()
    expect(el.querySelector('[role="alert"]')!.textContent).toBe(EVIL)
    expect(el.querySelector('[role="alert"] img')).toBeNull()
    expect(reset).toHaveBeenCalled()
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false)
  })

  it('goes to sign-up', () => {
    const { ctx } = testCtx({})
    const el = loginView(ctx)
    byText(el, 'Criar conta').click()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'register' })
  })
})

describe('register', () => {
  it('creates the account with the captcha token and signs in', async () => {
    const { ctx } = testCtx({}, { register: vi.fn(async () => session) })
    const el = registerView(ctx)
    fill(el, { username: 'nick', email: 'a@b.c', password: 'pw123456' })
    submit(el)
    await settle()
    expect(ctx.register).toHaveBeenCalledWith({ username: 'nick', email: 'a@b.c', password: 'pw123456', verification: 'cap' })
    expect(ctx.signedIn).toHaveBeenCalledWith(session)
  })

  it('goes back to sign-in', () => {
    const { ctx } = testCtx({})
    const el = registerView(ctx)
    byText(el, 'Entrar').click()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'login' })
  })
})
