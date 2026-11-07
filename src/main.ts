import '@fontsource-variable/geist'
import './styles.css'
import { createApp } from './app'
import { mountHcaptcha } from './captcha'

function localStorageOrMemory(): Storage {
  try {
    const k = '__tomato_probe'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return localStorage
  } catch {
    const m = new Map<string, string>()
    return {
      get length() { return m.size },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => { m.delete(k) },
      setItem: (k, v) => { m.set(k, String(v)) },
    }
  }
}

async function boot() {
  if (import.meta.env.DEV && !window.juntos) {
    const { installDevSdk } = await import('./sdk-dev')
    installDevSdk()
  }
  const root = document.getElementById('app')!
  const juntos = window.juntos
  if (!juntos) {
    root.textContent = 'Abra a Tomato pelo juntos'
    return
  }
  createApp({
    root,
    juntos,
    storage: localStorageOrMemory(),
    fetch: window.fetch.bind(window),
    captcha: mountHcaptcha,
  })
}

void boot()
