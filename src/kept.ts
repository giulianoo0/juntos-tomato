import type { Juntos } from './juntos'

const LOAD_WAIT_MS = 3_000

export interface KeptStorage extends Storage {
  /** Brings `keys` back from `juntos.store`; what was written meanwhile wins. */
  load(keys: string[]): Promise<void>
}

/**
 * Storage in memory that writes through to `juntos.store`, which the desktop
 * app keeps sealed on disk with the key in the system keychain. Without the
 * store it lasts as long as the page.
 */
export function keptStorage(juntos: Pick<Juntos, 'store'>): KeptStorage {
  const m = new Map<string, string>()
  const touched = new Set<string>()
  const keep = (k: string, v: string | null) => {
    touched.add(k)
    juntos.store?.set(k, v).catch(() => { /* only for this visit */ })
  }
  return {
    get length() { return m.size },
    clear() { for (const k of m.keys()) this.removeItem(k) },
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem(k) { m.delete(k); keep(k, null) },
    setItem(k, v) { m.set(k, String(v)); keep(k, String(v)) },
    async load(keys) {
      const store = juntos.store
      if (!store) return
      const read = Promise.all(keys.map(async (k) => {
        const v = await store.get(k).catch(() => null)
        if (v !== null && !touched.has(k)) m.set(k, v)
      }))
      await Promise.race([read, new Promise((r) => setTimeout(r, LOAD_WAIT_MS))])
    },
  }
}
