import '@fontsource-variable/geist'
import './styles.css'
import { createApp } from './app'
import { mountHcaptcha } from './captcha'
import { keptStorage } from './kept'

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
  const storage = keptStorage(juntos)
  createApp({
    root,
    juntos,
    storage,
    load: (keys) => storage.load(keys),
    fetch: (juntos.fetch?.bind(juntos) ?? window.fetch.bind(window)) as typeof fetch,
    captcha: mountHcaptcha,
  })
}

void boot()
