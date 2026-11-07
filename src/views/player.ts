import type { Api, Stream } from '../api'
import { safeImageUrl } from '../dom'
import type { ExtSource, Juntos, PlayRequest } from '../juntos'

export type Quality = 'fhd' | 'mhd' | 'shd'
export const QUALITIES: Array<{ id: Quality; label: string }> = [
  { id: 'fhd', label: '1080p' },
  { id: 'mhd', label: '720p' },
  { id: 'shd', label: '480p' },
]

const ORDER: Quality[] = ['fhd', 'mhd', 'shd']
const MEDIA_SUFFIX = '.vv-vrv.co'

function mediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname.endsWith(MEDIA_SUFFIX) && !u.username ? u.href : null
  } catch {
    return null
  }
}

/** The chosen quality, else the next lower one, else the next higher one. */
export function pickStream(streams: Stream['streams'] | undefined, preferred: Quality = 'fhd'): string | null {
  if (!streams || typeof streams !== 'object') return null
  const start = ORDER.indexOf(preferred)
  const order = [...ORDER.slice(start), ...ORDER.slice(0, start).reverse()]
  for (const q of order) {
    const url = mediaUrl(streams[q])
    if (url) return url
  }
  return null
}

export interface EpisodeToPlay {
  id: number
  title: string
  poster?: string
}

/**
 * The stream's signature lasts 30 s, so juntos gets it in the same task the
 * response arrives in: nothing is awaited between the two.
 */
export async function playEpisode(
  deps: { api: Api; juntos: Juntos },
  ep: EpisodeToPlay,
  quality: Quality = 'fhd',
): Promise<void> {
  const s = await deps.api.stream(ep.id)
  const url = pickStream(s?.streams, quality)
  if (!url) throw new Error('Episódio indisponível')
  const req: PlayRequest = { title: ep.title.slice(0, 300), ref: String(ep.id), source: { kind: 'hls', url } }
  if (typeof s.episodeName === 'string' && s.episodeName) req.subtitle = s.episodeName.slice(0, 300)
  const poster = safeImageUrl(ep.poster)
  if (poster) req.poster = poster
  deps.juntos.play(req)
}

/** A fresh source for a room resuming its preparation; `ref` is the episode id. */
export async function refreshSource(api: Api, ref: string, quality: Quality = 'fhd'): Promise<ExtSource | null> {
  if (!/^\d{1,12}$/.test(ref)) return null
  try {
    const s = await api.stream(Number(ref))
    const url = pickStream(s?.streams, quality)
    return url ? { kind: 'hls', url } : null
  } catch {
    return null
  }
}
