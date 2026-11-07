import { describe, expect, it } from 'vitest'
import { animeView } from '../src/views/anime'
import { COVER, EVIL, imgs, settle, testCtx } from './ctx'

const anime = {
  anime_details: {
    anime_id: 1320, anime_name: EVIL, anime_description: '"><script>alert(1)</script>',
    anime_parental_rating: 'A12', anime_date: '2021', anime_genre: 'Drama, Sobrenatural',
    anime_cover_url: COVER, anime_banner_url: 'javascript:alert(1)', dub_available: true,
  },
  anime_seasons: [
    { season_id: 685, season_name: '(Legendado) Season I', season_number: 1, season_dubbed: 0 },
    { season_id: 686, season_name: '(Dublado) Season I', season_number: 1, season_dubbed: 1 },
    { season_id: 1042, season_name: '(Legendado) Season II', season_number: 2, season_dubbed: 0 },
  ],
}

const ep = (n: number, extra: Record<string, unknown> = {}) => ({
  id: 15227 + n, number: n, name: `Ep ${n}`, thumbnail: 'https://cdn.tomatoanimes.com/t/x.jpg', duration_minutes: 23, ...extra,
})

function episodesFor(path: string) {
  const u = new URL(`https://x${path}`)
  const season = u.pathname.split('/')[3]
  const offset = Number(u.searchParams.get('offset'))
  if (season === '685') {
    const all = Array.from({ length: 30 }, (_, i) => ep(i + 1))
    return { episodes: all.slice(offset, offset + 25), pagination: { has_more: offset + 25 < all.length, total: 30 } }
  }
  return { episodes: [ep(1, { id: 9000 + Number(season), name: `season ${season}` })], pagination: { has_more: false } }
}

const routes = { '/v2/anime/1320': anime, '/v3/seasons/685/episodes': episodesFor, '/v3/seasons/686/episodes': episodesFor, '/v3/seasons/1042/episodes': episodesFor }

const buttons = (el: Element, text: string) => [...el.querySelectorAll('button, [role="tab"]')].filter((b) => b.textContent?.trim() === text) as HTMLElement[]

describe('anime', () => {
  it('shows the API text as text and refuses unsafe art', async () => {
    const { ctx } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()

    expect(el.querySelector('h1')!.textContent).toBe(EVIL)
    expect(el.textContent).toContain('"><script>alert(1)</script>')
    expect(el.querySelector('script')).toBeNull()
    expect(imgs(el)).not.toContain('javascript:alert(1)')
    expect(imgs(el)).toContain(COVER)
  })

  it('a cover outside the image host stays a placeholder', async () => {
    const bad = { ...anime, anime_details: { ...anime.anime_details, anime_cover_url: 'http://cdn.tomatoanimes.com/c.jpg' } }
    const { ctx } = testCtx({ ...routes, '/v2/anime/1320': bad })
    const el = animeView(ctx, 1320)
    await settle()
    expect(imgs(el).every((s) => s?.startsWith('https://cdn.tomatoanimes.com/'))).toBe(true)
    expect(el.querySelector('.art.cover img')).toBeNull()
  })

  it('an answer without details offers to try again', async () => {
    const { ctx } = testCtx({ ...routes, '/v2/anime/1320': {} })
    const el = animeView(ctx, 1320)
    await settle()
    expect(el.textContent).toContain('Anime não encontrado')
    expect(buttons(el, 'Tentar de novo')).toHaveLength(1)
  })

  it('switching language keeps the same season when it exists', async () => {
    const { ctx, calls } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()
    buttons(el, 'Season II')[0].click()
    await settle()
    buttons(el, 'Dublado')[0].click()
    await settle()
    buttons(el, 'Legendado')[0].click()
    await settle()
    expect(calls.at(-1)!.url).toContain('/v3/seasons/685/')
  })

  it('splits subtitled and dubbed, and lists the first season episodes', async () => {
    const { ctx } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()

    expect(buttons(el, 'Legendado')).toHaveLength(1)
    expect(buttons(el, 'Dublado')).toHaveLength(1)
    const tabs = [...el.querySelectorAll('[role="tab"][data-season]')].map((t) => t.textContent)
    expect(tabs).toEqual(['Season I', 'Season II'])
    expect(el.querySelectorAll('[data-episode]')).toHaveLength(25)
  })

  it('switching to dubbed loads the dubbed season', async () => {
    const { ctx } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()
    buttons(el, 'Dublado')[0].click()
    await settle()
    expect(el.textContent).toContain('season 686')
    expect(el.querySelectorAll('[data-episode]')).toHaveLength(1)
  })

  it('loads 25 more episodes on demand', async () => {
    const { ctx, calls } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()
    buttons(el, 'Carregar mais')[0].click()
    await settle()

    expect(calls.some((c) => c.url.includes('/v3/seasons/685/episodes?order=asc&limit=25&offset=25'))).toBe(true)
    expect(el.querySelectorAll('[data-episode]')).toHaveLength(30)
    expect(buttons(el, 'Carregar mais')).toHaveLength(0)
  })

  it('plays an episode with the anime name and cover', async () => {
    const { ctx } = testCtx(routes)
    const el = animeView(ctx, 1320)
    await settle()
    el.querySelector<HTMLElement>('[data-episode="15228"]')!.click()
    expect(ctx.play).toHaveBeenCalledWith({ id: 15228, title: EVIL, poster: COVER })
  })

  it('episodes cannot be played by someone who cannot play', async () => {
    const { ctx } = testCtx(routes, { canPlay: () => false })
    const el = animeView(ctx, 1320)
    await settle()
    const b = el.querySelector<HTMLButtonElement>('[data-episode="15228"]')!
    expect(b.disabled).toBe(true)
  })

  it('changes the quality from its menu', async () => {
    const { ctx } = testCtx(routes)
    const el = animeView(ctx, 1320)
    document.body.append(el)
    await settle()
    buttons(el, '1080p')[0].click()
    const option = [...document.querySelectorAll('[role="menuitemradio"]')].find((o) => o.textContent === '480p') as HTMLElement
    option.click()
    expect(ctx.setQuality).toHaveBeenCalledWith('shd')
    el.remove()
  })
})
