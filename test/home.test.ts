import { describe, expect, it } from 'vitest'
import { homeView } from '../src/views/home'
import { COVER, EVIL, imgs, settle, testCtx } from './ctx'

const feed = {
  data: [
    { type: 3, title: 'Em alta', data: [{ anime_id: 1320, thumbnail: 'https://cdn.tomatoanimes.com/banner/b.jpg' }] },
    { type: 2, episode_id: 0 },
    { type: 8, title: 'Seu histórico', data: [] },
    {
      type: 7, title: 'Novos episódios',
      data: [{ ep_id: 37973, ep_anime_id: 6947, anime_name: EVIL, ep_name: '6. "><script>x</script>', dubbed: true, thumbnail: 'https://cdn.tomatoanimes.com/t/1.jpg' }],
    },
    {
      type: 5, title: 'Recém adicionados',
      data: [
        { anime_id: 6949, thumbnail: COVER },
        { anime_id: 6950, thumbnail: 'http://cdn.tomatoanimes.com/cape/x.jpg' },
        { anime_id: 6951, thumbnail: 'https://evil.com/x.jpg' },
      ],
    },
  ],
}

describe('home', () => {
  it('renders the rows by title', async () => {
    const { ctx } = testCtx({ '/v2/animes/feed': feed })
    const el = homeView(ctx)
    await settle()
    const titles = [...el.querySelectorAll('h2')].map((h) => h.textContent)
    expect(titles).toEqual(['Em alta', 'Novos episódios', 'Recém adicionados'])
  })

  it('shows API strings as text and loads only allowed images', async () => {
    const { ctx } = testCtx({ '/v2/animes/feed': feed })
    const el = homeView(ctx)
    await settle()

    expect(el.textContent).toContain(EVIL)
    expect(el.querySelector('script')).toBeNull()
    expect(imgs(el)).toEqual([
      'https://cdn.tomatoanimes.com/banner/b.jpg',
      'https://cdn.tomatoanimes.com/t/1.jpg',
      COVER,
    ])
  })

  it('opens the anime from a poster', async () => {
    const { ctx } = testCtx({ '/v2/animes/feed': feed })
    const el = homeView(ctx)
    await settle()
    el.querySelector<HTMLElement>('[data-anime="6949"]')!.click()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'anime', id: 6949 })
  })

  it('plays a new episode straight from the row', async () => {
    const { ctx } = testCtx({ '/v2/animes/feed': feed })
    const el = homeView(ctx)
    await settle()
    el.querySelector<HTMLElement>('[data-episode="37973"]')!.click()
    expect(ctx.play).toHaveBeenCalledWith({ id: 37973, title: EVIL })
  })

  it('opens the anime from a new episode when this person cannot play', async () => {
    const { ctx } = testCtx({ '/v2/animes/feed': feed }, { canPlay: () => false })
    const el = homeView(ctx)
    await settle()
    el.querySelector<HTMLElement>('[data-episode="37973"]')!.click()
    expect(ctx.play).not.toHaveBeenCalled()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'anime', id: 6947 })
  })

  it('shows the highlight with its text and opens its anime', async () => {
    const hero = { type: 6, title: EVIL, hyper_title: 'Terceira Temporada', banner: 'https://cdn.tomatoanimes.com/banner/h.jpg', text: 'Sinopse', tags: 'Comédia,  Romance', year: '2019', anime_id: 1093 }
    const { ctx } = testCtx({ '/v2/animes/feed': { data: [hero] } })
    const el = homeView(ctx)
    await settle()
    const h = el.querySelector('[data-hero]')!
    expect(h.querySelector('h1')!.textContent).toBe(EVIL)
    expect(h.textContent).toContain('Terceira Temporada')
    expect(imgs(el)).toEqual(['https://cdn.tomatoanimes.com/banner/h.jpg'])
    ;[...h.querySelectorAll('button')].find((b) => b.textContent === 'Ver episódios')!.click()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'anime', id: 1093 })
  })

  it('offers to try again when the feed fails', async () => {
    let n = 0
    const { ctx } = testCtx({
      '/v2/animes/feed': () => {
        n++
        if (n === 1) throw new Error('down')
        return feed
      },
    })
    const el = homeView(ctx)
    await settle()
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Tentar de novo')
    expect(retry).toBeTruthy()
    retry!.click()
    await settle()
    expect(el.querySelectorAll('h2').length).toBe(3)
  })
})
