import type { SearchItem } from '../api'
import { clear, h, image } from '../dom'
import { failed, icon, id, shimmer, str } from './common'
import type { Ctx } from './ctx'

const DEBOUNCE_MS = 400

function resultCard(ctx: Ctx, it: SearchItem): HTMLElement | null {
  const animeId = id(it.id)
  if (!animeId || (typeof it.type === 'string' && it.type !== 'anime')) return null
  return h('button', {
    class: 'card result', type: 'button', role: 'listitem', 'data-anime': animeId,
    onclick: () => ctx.open({ name: 'anime', id: animeId }),
  }, image(it.image, 'poster'), h('span', { class: 'card-title' }, str(it.name)))
}

export function searchView(ctx: Ctx): HTMLElement {
  const input = h('input', {
    class: 'search-input', type: 'search', name: 'q', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'Buscar anime', 'aria-label': 'Buscar anime', maxlength: 100,
  })
  const form = h('form', { class: 'search-bar', role: 'search' }, icon('search'), input)
  const out = h('div', { class: 'results', 'aria-live': 'polite' })
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  const run = () => {
    clearTimeout(timer)
    const text = input.value.trim()
    const mine = ++seq
    clear(out)
    if (!text) return
    out.append(shimmer('sk-posters grid', 8))
    ctx.api.search(text, 0).then(
      (page) => {
        if (mine !== seq) return
        clear(out)
        const cards = (Array.isArray(page?.result) ? page.result : [])
          .map((it) => (it && typeof it === 'object' ? resultCard(ctx, it) : null))
          .filter((c) => !!c)
        out.append(cards.length
          ? h('div', { class: 'poster-grid', role: 'list' }, ...cards)
          : h('p', { class: 'empty' }, 'Nada encontrado'))
      },
      (e: unknown) => {
        if (mine !== seq) return
        clear(out)
        out.append(failed(e instanceof Error ? e.message : '', run))
      },
    )
  }

  input.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(run, DEBOUNCE_MS)
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    run()
  })
  queueMicrotask(() => input.focus({ preventScroll: true }))

  return h('div', { class: 'view search' }, form, out)
}
