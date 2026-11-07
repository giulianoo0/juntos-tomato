export interface Captcha {
  /** The solved token, or null while the challenge is open. */
  token(): string | null
  reset(): void
}

// The Tomato app's key; it is not bound to a domain.
export const HCAPTCHA_SITEKEY = 'd0706611-1d89-4b8c-af79-3caf0f14feba'
// The script's `load` comes before the api is usable; hCaptcha calls `onload` when it is.
const ONLOAD = 'tomatoHcaptchaReady'
const SCRIPT = `https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off&hl=pt&onload=${ONLOAD}`

interface HcaptchaApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  reset(id?: string): void
}

let script: HTMLScriptElement | null = null
let loading: Promise<HcaptchaApi> | null = null

function load(): Promise<HcaptchaApi> {
  if (loading && script?.isConnected) return loading
  const s = document.createElement('script')
  s.src = SCRIPT
  s.async = true
  script = s
  loading = new Promise((resolve, reject) => {
    ;(window as unknown as Record<string, unknown>)[ONLOAD] = () => {
      const api = (window as { hcaptcha?: HcaptchaApi }).hcaptcha
      if (api) resolve(api)
      else reject(new Error('hCaptcha indisponível'))
    }
    s.addEventListener('error', () => {
      s.remove()
      reject(new Error('hCaptcha indisponível'))
    }, { once: true })
  })
  document.head.append(s)
  return loading
}

export function mountHcaptcha(host: HTMLElement, theme: 'dark' | 'light'): Captcha {
  let token: string | null = null
  let widget: string | null = null
  let api: HcaptchaApi | null = null
  load().then((a) => {
    api = a
    widget = a.render(host, {
      sitekey: HCAPTCHA_SITEKEY,
      theme,
      callback: (t: string) => { token = t },
      'expired-callback': () => { token = null },
      'error-callback': () => { token = null },
    })
  }, () => {
    host.textContent = 'Não deu para carregar o captcha'
  })
  return {
    token: () => token,
    reset() {
      token = null
      if (api && widget !== null) api.reset(widget)
    },
  }
}
