import { describe, expect, it } from 'vitest'
import { animeView } from '../src/views/anime'
import { homeView } from '../src/views/home'
import { searchView } from '../src/views/search'
import { settle, testCtx } from './ctx'

// What a hostile (or hacked) Tomato API could send in every text and url field.
const HTML = '"><img src=x onerror="top.__pwned=1"><script>top.__pwned=1</script>'
const URLS = [
  'javascript:top.__pwned=1',
  '//evil.example/x.jpg',
  'data:image/svg+xml,<svg onload="top.__pwned=1"/>',
  'http://cdn.tomatoanimes.com/x.jpg',
  'https://cdn.tomatoanimes.com.evil.example/x.jpg',
  'https://user:pw@cdn.tomatoanimes.com/x.jpg',
  'https://evil.example/x.jpg',
]
const url = (i: number) => URLS[i % URLS.length]

/** Nothing the API said became markup, a handler, or an image off the declared host. */
function expectInert(root: Element) {
  expect(root.querySelectorAll('script, iframe, object, embed, link, meta, style, a[href]')).toHaveLength(0)
  for (const el of root.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      expect(attr.name.startsWith('on'), `${el.tagName} ${attr.name}`).toBe(false)
      expect(attr.value).not.toMatch(/^\s*(javascript|data):/i)
    }
  }
  for (const img of root.querySelectorAll('img')) {
    expect(img.getAttribute('src')).toMatch(/^https:\/\/cdn\.tomatoanimes\.com\//)
  }
  expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined()
}

describe('API hostil', () => {
  it('a home fica inerte com HTML e URLs hostis em todos os campos', async () => {
    const row = (type: number) => ({
      type, title: HTML,
      data: URLS.map((_, i) => ({
        anime_id: i + 1, anime_name: HTML, ep_id: i + 1, ep_anime_id: i + 1, ep_name: HTML,
        thumbnail: url(i), anime_cover_url: url(i + 1), anime_cape_url: url(i + 2), dubbed: true,
      })),
    })
    const { ctx } = testCtx({ '/v2/animes/feed': { data: [row(3), row(5), row(6), row(7), row(8)] } })
    const el = homeView(ctx)
    await settle()

    expect(el.textContent).toContain(HTML)
    expectInert(el)
  })

  it('a página do anime e os episódios ficam inertes', async () => {
    const { ctx } = testCtx({
      '/v2/anime/1': {
        anime_details: {
          anime_id: 1, anime_name: HTML, anime_description: HTML, anime_parental_rating: HTML, anime_date: HTML,
          anime_genre: HTML, anime_cover_url: url(0), anime_cape_url: url(1), anime_banner_url: url(2),
        },
        anime_seasons: [{ season_id: 10, season_name: HTML, season_number: 1, season_dubbed: 0 }],
      },
      '/v3/seasons/10/episodes': {
        episodes: URLS.map((_, i) => ({ id: i + 1, number: i + 1, name: HTML, thumbnail: url(i), duration_minutes: HTML })),
        pagination: { has_more: false },
      },
    })
    const el = animeView(ctx, 1)
    await settle()

    expect(el.textContent).toContain(HTML)
    expectInert(el)
  })

  it('a busca fica inerte', async () => {
    const { ctx } = testCtx({
      '/v2/content/search': { result: URLS.map((_, i) => ({ id: i + 1, type: 'anime', name: HTML, image: url(i), episodes: HTML })) },
    })
    const el = searchView(ctx)
    const input = el.querySelector('input')!
    input.value = 'x'
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()

    expect(el.textContent).toContain(HTML)
    expectInert(el)
  })
})
