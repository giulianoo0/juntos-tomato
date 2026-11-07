import { afterEach, describe, expect, it, vi } from 'vitest'
import { HCAPTCHA_SITEKEY, mountHcaptcha } from '../src/captcha'

type Opts = { sitekey: string; theme: string; callback: (t: string) => void; 'expired-callback': () => void }

afterEach(() => {
  document.head.querySelectorAll('script').forEach((s) => s.remove())
  delete (window as { hcaptcha?: unknown }).hcaptcha
})

function fakeHcaptcha() {
  const api = { render: vi.fn((_el: HTMLElement, _o: Opts) => 'w1'), reset: vi.fn() }
  ;(window as { hcaptcha?: unknown }).hcaptcha = api
  return api
}

const settle = () => new Promise((r) => setTimeout(r, 0))

/** What hCaptcha does once its api is usable: calls the function named in `onload`. */
async function apiReady() {
  await settle()
  const name = new URL(document.head.querySelector('script')!.src).searchParams.get('onload')!
  ;(window as unknown as Record<string, () => void>)[name]()
  await settle()
}

describe('hcaptcha', () => {
  it('loads the explicit-render script once and renders with the sitekey and theme', async () => {
    const api = fakeHcaptcha()
    const host = document.createElement('div')
    mountHcaptcha(host, 'dark')
    mountHcaptcha(document.createElement('div'), 'dark')
    const scripts = document.head.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toMatch(/^https:\/\/js\.hcaptcha\.com\/1\/api\.js\?/)
    expect(scripts[0].src).toContain('render=explicit')

    await apiReady()
    expect(api.render).toHaveBeenCalledTimes(2)
    const [el, opts] = api.render.mock.calls[0]
    expect(el).toBe(host)
    expect(opts.sitekey).toBe(HCAPTCHA_SITEKEY)
    expect(opts.theme).toBe('dark')
  })

  it('renders only once the api says it is ready, not on the script load', async () => {
    const api = fakeHcaptcha()
    mountHcaptcha(document.createElement('div'), 'dark')
    await settle()
    expect(api.render).not.toHaveBeenCalled()
    await apiReady()
    expect(api.render).toHaveBeenCalledTimes(1)
  })

  it('holds the token until it expires or is reset', async () => {
    const api = fakeHcaptcha()
    const c = mountHcaptcha(document.createElement('div'), 'light')
    await apiReady()
    const opts = api.render.mock.calls[0][1]

    expect(c.token()).toBeNull()
    opts.callback('tok')
    expect(c.token()).toBe('tok')
    opts['expired-callback']()
    expect(c.token()).toBeNull()
    opts.callback('tok2')
    c.reset()
    expect(c.token()).toBeNull()
    expect(api.reset).toHaveBeenCalledWith('w1')
  })
})
