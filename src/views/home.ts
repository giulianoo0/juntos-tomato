import type { Feed } from '../api'
import { h, image } from '../dom'
import { icon, id, loadInto, shimmer, str } from './common'
import type { Ctx } from './ctx'

type Rec = Record<string, unknown>

function items(row: Rec): Rec[] {
  return Array.isArray(row.data) ? row.data.filter((x): x is Rec => !!x && typeof x === 'object') : []
}

function rail(title: string, cls: string, cards: HTMLElement[]): HTMLElement | null {
  if (!cards.length) return null
  return h('section', { class: `rail ${cls}` },
    h('h2', { class: 'rail-title' }, title),
    h('div', { class: 'rail-track', role: 'list' }, ...cards),
  )
}

function animeCard(ctx: Ctx, it: Rec, cls: string): HTMLElement | null {
  const animeId = id(it.anime_id)
  if (!animeId) return null
  return h('button', {
    class: `card ${cls}`, type: 'button', role: 'listitem', 'data-anime': animeId, 'aria-label': 'Abrir anime',
    onclick: () => ctx.open({ name: 'anime', id: animeId }),
  }, image(it.thumbnail, cls))
}

function episodeCard(ctx: Ctx, it: Rec): HTMLElement | null {
  const epId = id(it.ep_id)
  const animeId = id(it.ep_anime_id)
  if (!epId || !animeId) return null
  const name = str(it.anime_name)
  return h('button', {
    class: 'card episode-card', type: 'button', role: 'listitem', 'data-episode': epId,
    onclick: () => {
      if (ctx.canPlay()) void ctx.play({ id: epId, title: name })
      else ctx.open({ name: 'anime', id: animeId })
    },
  },
  h('span', { class: 'thumb' },
    image(it.thumbnail, 'still'),
    it.dubbed === true ? h('span', { class: 'badge' }, 'Dublado') : null,
    h('span', { class: 'play-chip', 'aria-hidden': 'true' }, icon('play', 14)),
  ),
  h('span', { class: 'card-title' }, name),
  h('span', { class: 'card-meta' }, str(it.ep_name)),
  )
}

function hero(ctx: Ctx, row: Rec): HTMLElement | null {
  const animeId = id(row.anime_id)
  if (!animeId) return null
  const tags = str(row.tags).split(',').map((t) => t.trim()).filter(Boolean)
  const meta = [str(row.year, 8), ...tags.slice(0, 3)].filter(Boolean)
  return h('section', { class: 'hero', 'data-hero': '' },
    image(row.banner, 'hero-art'),
    h('div', { class: 'hero-body' },
      str(row.hyper_title) ? h('p', { class: 'kicker' }, str(row.hyper_title)) : null,
      h('h1', { class: 'hero-title' }, str(row.title)),
      meta.length ? h('p', { class: 'hero-meta' }, meta.join(' · ')) : null,
      str(row.text) ? h('p', { class: 'hero-text' }, str(row.text, 600)) : null,
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn btn-tomato', type: 'button', onclick: () => ctx.open({ name: 'anime', id: animeId }) },
          icon('play'), 'Ver episódios'),
      ),
    ),
  )
}

function renderFeed(ctx: Ctx, feed: Feed): HTMLElement {
  const rows = (Array.isArray(feed?.data) ? feed.data : []).filter((r): r is Rec => !!r && typeof r === 'object')
  const out = h('div', { class: 'feed' })
  for (const row of rows) {
    const title = str(row.title, 80)
    let el: HTMLElement | null = null
    switch (row.type) {
      case 3:
        el = rail(title, 'rail-banners', items(row).map((it) => animeCard(ctx, it, 'banner')).filter((c) => !!c))
        break
      case 5:
        el = rail(title, 'rail-posters', items(row).map((it) => animeCard(ctx, it, 'poster')).filter((c) => !!c))
        break
      case 6:
        el = hero(ctx, row)
        break
      case 7:
        el = rail(title, 'rail-episodes', items(row).map((it) => episodeCard(ctx, it)).filter((c) => !!c))
        break
    }
    if (el) out.append(el)
  }
  return out
}

export function homeView(ctx: Ctx): HTMLElement {
  const root = h('div', { class: 'view home' })
  loadInto(root,
    () => h('div', {}, shimmer('sk-banners', 3), shimmer('sk-posters', 6)),
    () => ctx.api.feed(),
    (feed) => renderFeed(ctx, feed))
  return root
}
