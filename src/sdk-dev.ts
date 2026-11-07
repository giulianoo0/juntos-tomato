// Dev only: stands in for /_juntos/sdk.js when the page runs outside juntos
// (npm run dev, dev/harness.html). Never part of the build's behaviour.
import type { ExtSource, InitMessage, Juntos, ThemeTokens } from './juntos'

function devToast(text: string) {
  const el = document.createElement('div')
  el.className = 'dev-toast'
  el.textContent = text
  document.body.append(el)
  setTimeout(() => el.remove(), 4000)
}

export function installDevSdk() {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  const theme: ThemeTokens = { mode: dark ? 'dark' : 'light', vars: {} }
  const params = new URLSearchParams(location.search)
  const init: InitMessage = { theme, locale: 'pt-BR', canPlay: params.get('canPlay') !== '0' }
  let onInit: ((m: InitMessage) => void) | null = null
  let onRefresh: ((ref: string) => Promise<ExtSource | null>) | null = null
  document.documentElement.dataset.theme = theme.mode

  const juntos: Juntos = {
    onInit: (cb) => { onInit = cb },
    onTheme: () => {},
    onRefresh: (cb) => { onRefresh = cb },
    ready: () => { setTimeout(() => onInit?.(init), 0) },
    play: (p) => {
      console.info('[juntos dev] play', p)
      devToast(`play: ${p.title}${p.subtitle ? ` — ${p.subtitle}` : ''}`)
    },
    close: () => console.info('[juntos dev] close'),
    toast: (text) => devToast(text),
  }
  window.juntos = juntos
  // From the console: await __juntosDev.refresh('15228')
  ;(window as unknown as { __juntosDev: unknown }).__juntosDev = {
    refresh: (ref: string) => onRefresh?.(ref) ?? Promise.resolve(null),
  }
}
