import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchView } from '../src/views/search'
import { COVER, EVIL, imgs, settle, testCtx } from './ctx'

afterEach(() => { vi.useRealTimers() })

const results = {
  status: true,
  result: [
    { id: 1320, type: 'anime', name: EVIL, image: COVER, episodes: 12 },
    { id: 77, type: 'manga', name: 'Um mangá', image: COVER },
    { id: 9, type: 'anime', name: 'Sem capa', image: 'https://evil.com/x.jpg' },
  ],
}

function type(input: HTMLInputElement, text: string) {
  input.value = text
  input.dispatchEvent(new Event('input'))
}

describe('search', () => {
  it('searches animes a moment after typing stops', async () => {
    vi.useFakeTimers()
    const { ctx, calls } = testCtx({ '/v2/content/search': results })
    const el = searchView(ctx)
    const input = el.querySelector('input')!
    type(input, 'li')
    type(input, 'link click')
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(500)

    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].body).toEqual({ search: 'link click', content_type: 'anime', page: 0 })
  })

  it('shows anime results as text with only allowed images', async () => {
    const { ctx } = testCtx({ '/v2/content/search': results })
    const el = searchView(ctx)
    const form = el.querySelector('form')!
    el.querySelector('input')!.value = 'link'
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()

    const cards = el.querySelectorAll('[data-anime]')
    expect(cards).toHaveLength(2)
    expect(el.textContent).toContain(EVIL)
    expect(el.textContent).not.toContain('Um mangá')
    expect(imgs(el)).toEqual([COVER])
    ;(cards[0] as HTMLElement).click()
    expect(ctx.open).toHaveBeenCalledWith({ name: 'anime', id: 1320 })
  })

  it('says when nothing matched', async () => {
    const { ctx } = testCtx({ '/v2/content/search': { result: [] } })
    const el = searchView(ctx)
    el.querySelector('input')!.value = 'zzz'
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    expect(el.textContent).toContain('Nada encontrado')
  })

  it('an older answer never replaces a newer one', async () => {
    let release!: () => void
    const slow = new Promise<void>((r) => { release = r })
    const { ctx } = testCtx({})
    const search = vi.fn()
      .mockImplementationOnce(async () => { await slow; return { result: [{ id: 1, type: 'anime', name: 'velho' }] } })
      .mockImplementationOnce(async () => ({ result: [{ id: 2, type: 'anime', name: 'novo' }] }))
    ctx.api.search = search
    const el = searchView(ctx)
    const input = el.querySelector('input')!
    const form = el.querySelector('form')!
    input.value = 'a'
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    input.value = 'b'
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    await settle()
    release()
    await settle()
    expect(el.textContent).toContain('novo')
    expect(el.textContent).not.toContain('velho')
  })
})
