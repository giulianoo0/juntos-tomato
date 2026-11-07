import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApi } from '../src/api'
import { sessionStore } from '../src/auth'
import type { Juntos, PlayRequest } from '../src/juntos'
import { pickStream, playEpisode, refreshSource } from '../src/views/player'
import { fakeFetch, json, memoryStorage } from './helpers'

const NOW = 10_000_000
const FHD = 'https://us-east-2.vv-vrv.co/1320/15228/1080p.m3u8?policy=p&signature=s'
const SHD = 'https://us-east-2.vv-vrv.co/1320/15228/480p.m3u8?policy=p&signature=s'

function apiWith(...responses: Response[]) {
  const store = sessionStore(memoryStorage())
  store.set({ accessToken: 'a', refreshToken: 'r', expiresAt: NOW + 3_600_000, account: { uuid: 'u', user_name: 'n' } })
  const f = fakeFetch(...responses)
  return { api: createApi({ fetch: f.fetch, store, now: () => NOW }), calls: f.calls }
}

function fakeJuntos() {
  const play = vi.fn<(p: PlayRequest) => void>()
  const juntos: Juntos = {
    onInit: vi.fn(), onTheme: vi.fn(), onRefresh: vi.fn(), ready: vi.fn(),
    play, close: vi.fn(), toast: vi.fn(),
  }
  return Object.assign(juntos, { play })
}

const streamBody = (streams: Record<string, string | null>) => ({
  streams, episodeName: '1. Emma', episodeAnimeID: 1320, nextEpisodeID: 15229,
})

afterEach(() => { vi.useRealTimers() })

describe('pickStream', () => {
  it('prefers fhd, then mhd, then shd', () => {
    expect(pickStream({ shd: SHD, mhd: 'https://a.vv-vrv.co/m.m3u8', fhd: FHD })).toBe(FHD)
    expect(pickStream({ shd: SHD, mhd: 'https://a.vv-vrv.co/m.m3u8', fhd: null })).toBe('https://a.vv-vrv.co/m.m3u8')
    expect(pickStream({ shd: SHD, mhd: null, fhd: null })).toBe(SHD)
  })

  it('starts from the chosen quality and falls to the next one available', () => {
    expect(pickStream({ shd: SHD, mhd: null, fhd: FHD }, 'mhd')).toBe(SHD)
    expect(pickStream({ shd: null, mhd: null, fhd: FHD }, 'shd')).toBe(FHD)
  })

  it('ignores anything that is not https on the media host', () => {
    expect(pickStream({ fhd: 'http://us-east-2.vv-vrv.co/a.m3u8', shd: SHD })).toBe(SHD)
    expect(pickStream({ fhd: 'https://vv-vrv.co.evil.com/a.m3u8', shd: null })).toBeNull()
    expect(pickStream({ fhd: 'javascript:alert(1)' })).toBeNull()
    expect(pickStream(null)).toBeNull()
  })
})

describe('playEpisode', () => {
  it('asks for the stream and hands it to juntos', async () => {
    const { api, calls } = apiWith(json(200, streamBody({ shd: SHD, mhd: null, fhd: FHD })))
    const juntos = fakeJuntos()
    await playEpisode({ api, juntos }, { id: 15228, title: 'Link Click', poster: 'https://cdn.tomatoanimes.com/c.jpg' })

    expect(calls[0].url).toBe('https://prod-api.tomatoanimes.com/v2/anime/episode/15228/stream')
    expect(juntos.play).toHaveBeenCalledWith({
      title: 'Link Click',
      subtitle: '1. Emma',
      poster: 'https://cdn.tomatoanimes.com/c.jpg',
      ref: '15228',
      source: { kind: 'hls', url: FHD },
    })
  })

  it('plays without waiting on any timer after the stream arrives', async () => {
    vi.useFakeTimers()
    const { api } = apiWith(json(200, streamBody({ fhd: FHD })))
    const juntos = fakeJuntos()
    await playEpisode({ api, juntos }, { id: 15228, title: 'Link Click' })
    expect(juntos.play).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('leaves out a poster that is not an allowed image', async () => {
    const { api } = apiWith(json(200, streamBody({ fhd: FHD })))
    const juntos = fakeJuntos()
    await playEpisode({ api, juntos }, { id: 1, title: 'X', poster: 'https://evil.com/p.jpg' })
    expect(juntos.play.mock.calls[0][0]).not.toHaveProperty('poster')
  })

  it('fails without calling juntos when no stream is usable', async () => {
    const { api } = apiWith(json(200, streamBody({ shd: null, mhd: null, fhd: null })))
    const juntos = fakeJuntos()
    await expect(playEpisode({ api, juntos }, { id: 1, title: 'X' })).rejects.toThrow('Episódio indisponível')
    expect(juntos.play).not.toHaveBeenCalled()
  })
})

describe('refreshSource', () => {
  it('asks the stream again for the ref and returns the source', async () => {
    const { api, calls } = apiWith(json(200, streamBody({ shd: SHD, fhd: FHD })))
    const src = await refreshSource(api, '15228')
    expect(calls[0].url).toBe('https://prod-api.tomatoanimes.com/v2/anime/episode/15228/stream')
    expect(src).toEqual({ kind: 'hls', url: FHD })
  })

  it('returns null for a ref that is not an episode id', async () => {
    const { api, calls } = apiWith()
    expect(await refreshSource(api, '../v3/auth/logout')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('returns null when the API fails', async () => {
    const { api } = apiWith(json(500, {}))
    expect(await refreshSource(api, '15228')).toBeNull()
  })
})
