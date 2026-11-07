import type { AnimePage, Episode, Season } from '../api'
import { clear, h, image, safeImageUrl } from '../dom'
import { failed, icon, id, loadInto, shimmer, str } from './common'
import type { Ctx } from './ctx'
import { attachMenu } from './menu'
import { QUALITIES } from './player'

type Lang = 'sub' | 'dub'

function seasonLabel(s: Season): string {
  return str(s.season_name, 80).replace(/^\((Legendado|Dublado)\)\s*/i, '') || `Temporada ${s.season_number}`
}

function validSeasons(raw: unknown): Season[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is Season => !!s && typeof s === 'object' && id((s as Season).season_id) !== null)
}

function qualityButton(ctx: Ctx): HTMLButtonElement {
  const label = () => QUALITIES.find((q) => q.id === ctx.quality())?.label ?? '1080p'
  const text = h('span', {}, label())
  const btn = h('button', { class: 'pill', type: 'button', 'aria-label': 'Qualidade', title: 'Qualidade' },
    text, icon('chevron', 14))
  attachMenu(btn, 'Qualidade', () => QUALITIES, () => ctx.quality(), (q) => {
    ctx.setQuality(q)
    text.textContent = label()
  })
  return btn
}

function episodeRow(ctx: Ctx, ep: Episode, title: string, poster: string | null): HTMLElement | null {
  const epId = id(ep.id)
  if (!epId) return null
  const canPlay = ctx.canPlay()
  const num = typeof ep.number === 'number' ? ep.number : null
  const mins = typeof ep.duration_minutes === 'number' && ep.duration_minutes > 0 ? ep.duration_minutes : null
  const btn = h('button', {
    class: 'episode', type: 'button', 'data-episode': epId, disabled: !canPlay,
    title: canPlay ? null : 'Só quem pode trocar o vídeo da sala escolhe o episódio',
  },
  h('span', { class: 'thumb' },
    image(ep.thumbnail, 'still'),
    mins ? h('span', { class: 'duration' }, `${mins} min`) : null,
    h('span', { class: 'play-chip', 'aria-hidden': 'true' }, icon('play', 14)),
  ),
  h('span', { class: 'episode-name' },
    num !== null ? h('span', { class: 'episode-number' }, String(num)) : null,
    h('span', {}, str(ep.name) || (num !== null ? `Episódio ${num}` : 'Episódio')),
  ),
  )
  btn.addEventListener('click', () => {
    const req: { id: number; title: string; poster?: string } = { id: epId, title }
    if (poster) req.poster = poster
    btn.dataset.loading = ''
    void ctx.play(req).finally(() => { delete btn.dataset.loading })
  })
  return btn
}

function episodesList(ctx: Ctx, seasonId: number, title: string, poster: string | null): HTMLElement {
  const root = h('div', { class: 'episodes' })
  const grid = h('div', { class: 'episode-grid' })
  const more = h('div', { class: 'more' })
  root.append(grid, more)
  let offset = 0

  const page = () => ctx.api.episodes(seasonId, offset)
  const show = (p: Awaited<ReturnType<typeof page>>) => {
    const eps = Array.isArray(p?.episodes) ? p.episodes : []
    offset += eps.length
    for (const ep of eps) {
      const row = episodeRow(ctx, ep, title, poster)
      if (row) grid.append(row)
    }
    clear(more)
    if (p?.pagination?.has_more === true && eps.length > 0) {
      more.append(h('button', { class: 'btn btn-soft', type: 'button', onclick: loadMore }, 'Carregar mais'))
    } else if (offset === 0) {
      more.append(h('p', { class: 'empty' }, 'Sem episódios ainda'))
    }
  }
  function loadMore(ev?: Event) {
    if (ev?.currentTarget instanceof HTMLButtonElement) ev.currentTarget.disabled = true
    page().then(show, (e: unknown) => {
      clear(more)
      more.append(failed(e instanceof Error ? e.message : '', () => loadMore()))
    })
  }
  loadInto(grid, () => shimmer('sk-episodes', 8), page, (p) => { show(p); return null })
  return root
}

function renderAnime(ctx: Ctx, page: AnimePage): HTMLElement {
  const d = page?.anime_details
  if (!d || typeof d !== 'object') throw new Error('Anime não encontrado')
  const title = str(d.anime_name)
  const poster = safeImageUrl(d.anime_cover_url)
  const seasons = validSeasons(page.anime_seasons)
  const byLang: Record<Lang, Season[]> = {
    sub: seasons.filter((s) => s.season_dubbed !== 1),
    dub: seasons.filter((s) => s.season_dubbed === 1),
  }
  let lang: Lang = byLang.sub.length ? 'sub' : 'dub'
  let current: Season | undefined = byLang[lang][0]

  const meta = [str(d.anime_date, 8), str(d.anime_parental_rating, 8), str(d.anime_genre, 80)].filter(Boolean)
  const description = str(d.anime_description, 2000)
  const desc = description ? h('p', { class: 'synopsis' }, description) : null
  if (desc) {
    desc.tabIndex = 0
    desc.addEventListener('click', () => desc.classList.toggle('open'))
    desc.addEventListener('keydown', (e) => { if (e.key === 'Enter') desc.classList.toggle('open') })
  }

  const langBar = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Áudio' })
  const seasonBar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Temporada' })
  const list = h('div', { class: 'season-body' })

  const drawLang = () => {
    clear(langBar)
    if (!byLang.sub.length || !byLang.dub.length) { langBar.hidden = true; return }
    for (const [k, label] of [['sub', 'Legendado'], ['dub', 'Dublado']] as const) {
      langBar.append(h('button', {
        class: 'segment', type: 'button', role: 'tab', 'aria-selected': lang === k ? 'true' : 'false',
        onclick: () => {
          if (lang === k) return
          lang = k
          // The same season in the other language, when it exists.
          const same = current ? seasonLabel(current) : ''
          current = byLang[k].find((s) => seasonLabel(s) === same) ?? byLang[k][0]
          drawAll()
        },
      }, label))
    }
  }
  const drawSeasons = () => {
    clear(seasonBar)
    const list = byLang[lang]
    seasonBar.hidden = list.length < 2
    for (const s of list) {
      seasonBar.append(h('button', {
        class: 'tab', type: 'button', role: 'tab', 'data-season': s.season_id,
        'aria-selected': s === current ? 'true' : 'false',
        onclick: () => { if (s !== current) { current = s; drawAll() } },
      }, seasonLabel(s)))
    }
  }
  const drawList = () => {
    clear(list)
    if (current) list.append(episodesList(ctx, current.season_id, title, poster))
    else list.append(h('p', { class: 'empty' }, 'Sem episódios ainda'))
  }
  const drawAll = () => { drawLang(); drawSeasons(); drawList() }
  drawAll()

  return h('article', { class: 'anime' },
    h('div', { class: 'backdrop', 'aria-hidden': 'true' }, image(d.anime_banner_url ?? d.anime_cape_url, 'backdrop-art')),
    h('header', { class: 'anime-head' },
      image(d.anime_cover_url, 'cover', title),
      h('div', { class: 'anime-info' },
        h('h1', { class: 'anime-title' }, title),
        meta.length ? h('p', { class: 'chips' }, ...meta.map((m) => h('span', { class: 'chip' }, m))) : null,
        desc,
      ),
    ),
    h('div', { class: 'season-bar' }, langBar, seasonBar, h('span', { class: 'spacer' }), qualityButton(ctx)),
    list,
  )
}

export function animeView(ctx: Ctx, animeId: number): HTMLElement {
  const root = h('div', { class: 'view anime-view' })
  loadInto(root,
    () => h('div', { class: 'anime-skeleton' }, shimmer('sk-head'), shimmer('sk-episodes', 6)),
    () => ctx.api.anime(animeId),
    (page) => renderAnime(ctx, page))
  return root
}
