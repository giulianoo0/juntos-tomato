import { createApi } from './api'
import { login, register, sessionStore } from './auth'
import type { Captcha } from './captcha'
import { append, clear, h } from './dom'
import type { Juntos } from './juntos'
import { animeView } from './views/anime'
import { icon } from './views/common'
import type { Ctx, Route } from './views/ctx'
import { homeView } from './views/home'
import { loginView, mark } from './views/login'
import { attachActions } from './views/menu'
import { playEpisode, refreshSource, type Quality } from './views/player'
import { registerView } from './views/register'
import { searchView } from './views/search'

export interface AppDeps {
  root: HTMLElement
  juntos: Juntos
  storage: Storage
  fetch: typeof fetch
  now?: () => number
  captcha(host: HTMLElement, theme: 'dark' | 'light'): Captcha
}

const QUALITY_KEY = 'tomato.quality'
const INIT_WAIT_MS = 800

function readQuality(storage: Storage): Quality {
  try {
    const q = storage.getItem(QUALITY_KEY)
    return q === 'fhd' || q === 'mhd' || q === 'shd' ? q : 'fhd'
  } catch {
    return 'fhd'
  }
}

export function createApp(deps: AppDeps) {
  const { root, juntos, storage } = deps
  const store = sessionStore(storage)
  const api = createApi({ fetch: deps.fetch, store, now: deps.now })
  let canPlay = false
  let mode: 'dark' | 'light' = root.ownerDocument.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  let quality = readQuality(storage)
  // Each screen keeps its element, so going back finds it as it was left.
  let stack: Array<{ route: Route; el?: HTMLElement; scroll: number }> = []
  const win = root.ownerDocument.defaultView

  const stage = h('main', { class: 'stage' })
  const bar = h('header', { class: 'topbar' })
  root.append(bar, stage)

  const ctx: Ctx = {
    api,
    open: (route) => {
      const top = stack.at(-1)
      if (top) top.scroll = win?.scrollY ?? 0
      if (route.name === 'anime') stack.push({ route, scroll: 0 })
      else stack = [{ route, scroll: 0 }]
      render()
    },
    play: async (ep) => {
      if (!canPlay) return
      try {
        await playEpisode({ api, juntos }, ep, quality)
      } catch (e) {
        juntos.toast(e instanceof Error && e.message ? e.message : 'Não deu para abrir o episódio')
      }
    },
    canPlay: () => canPlay,
    quality: () => quality,
    setQuality: (q) => {
      quality = q
      try { storage.setItem(QUALITY_KEY, q) } catch { /* only for this visit */ }
    },
    signedIn: (s) => {
      api.signIn(s)
      ctx.open({ name: 'home' })
    },
    login: (f) => login({ fetch: deps.fetch, now: deps.now }, f),
    register: (f) => register({ fetch: deps.fetch, now: deps.now }, f),
    captcha: (host) => deps.captcha(host, mode),
  }

  function back() {
    if (stack.length > 1) stack.pop()
    render()
  }

  /** Builds the screens again, e.g. when whether this person may play changes. */
  function rebuild() {
    for (const entry of stack) entry.el = undefined
    render()
  }

  function drawBar(route: Route) {
    clear(bar)
    const authScreen = route.name === 'login' || route.name === 'register'
    bar.hidden = authScreen
    if (authScreen) return
    const tab = (name: 'home' | 'search', label: string, ic: 'home' | 'search') =>
      h('button', {
        class: 'nav-tab', type: 'button', 'aria-current': route.name === name ? 'page' : null,
        onclick: () => ctx.open({ name }),
      }, icon(ic), h('span', {}, label))
    const account = api.session()?.account
    const initial = (typeof account?.user_name === 'string' ? account.user_name.trim()[0] : '')?.toUpperCase() || '?'
    const accountBtn = h('button', { class: 'avatar', type: 'button', 'aria-label': 'Conta', title: 'Conta' }, initial)
    attachActions(accountBtn, 'Conta', [{
      label: 'Sair',
      run: () => { void api.logout().finally(() => ctx.open({ name: 'login' })) },
    }])
    append(bar,
      stack.length > 1
        ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Voltar', title: 'Voltar', onclick: back }, icon('back'))
        : null,
      mark(),
      h('nav', { class: 'nav', 'aria-label': 'Tomato' }, tab('home', 'Início', 'home'), tab('search', 'Buscar', 'search')),
      h('span', { class: 'spacer' }),
      accountBtn,
    )
  }

  function viewFor(route: Route): HTMLElement {
    switch (route.name) {
      case 'login': return loginView(ctx)
      case 'register': return registerView(ctx)
      case 'search': return searchView(ctx)
      case 'anime': return animeView(ctx, route.id)
      case 'home': return homeView(ctx)
    }
  }

  function render() {
    let entry = stack.at(-1)
    const name = entry?.route.name
    if (!entry || (!api.session() && name !== 'login' && name !== 'register')) {
      entry = { route: { name: 'login' }, scroll: 0 }
      stack = [entry]
    }
    drawBar(entry.route)
    clear(stage)
    entry.el ??= viewFor(entry.route)
    stage.append(entry.el)
    win?.scrollTo?.({ top: entry.scroll })
  }

  api.onSignedOut(() => {
    const at = stack.at(-1)?.route.name
    if (at !== 'login' && at !== 'register') ctx.open({ name: 'login' })
  })
  // The first screen waits for init (it says whether this person may play),
  // but not past INIT_WAIT_MS: outside juntos there is no init.
  let started = false
  const start = () => {
    if (started) return
    started = true
    clearTimeout(fallback)
    stack = [{ route: api.session() ? { name: 'home' } : { name: 'login' }, scroll: 0 }]
    render()
  }
  const fallback = setTimeout(start, INIT_WAIT_MS)
  juntos.onInit((m) => {
    const could = canPlay
    canPlay = m.canPlay === true
    mode = m.theme?.mode === 'light' ? 'light' : 'dark'
    if (!started) start()
    else if (could !== canPlay) rebuild()
  })
  juntos.onTheme((t) => { mode = t?.mode === 'light' ? 'light' : 'dark' })
  juntos.onRefresh((ref) => refreshSource(api, ref, quality))
  root.ownerDocument.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && !root.ownerDocument.querySelector('.popover')) juntos.close()
  })

  juntos.ready()
  return ctx
}
