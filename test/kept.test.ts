import { describe, expect, it, vi } from 'vitest'
import { keptStorage } from '../src/kept'

function fakeStore(initial: Record<string, string> = {}) {
  const kept = new Map(Object.entries(initial))
  return {
    kept,
    store: {
      get: vi.fn(async (k: string) => kept.get(k) ?? null),
      set: vi.fn(async (k: string, v: string | null) => { if (v === null) kept.delete(k); else kept.set(k, v) }),
    },
  }
}

describe('keptStorage', () => {
  it('traz de volta o que o app guardou e grava cada mudança nele', async () => {
    const { kept, store } = fakeStore({ 'tomato.session': '{"s":1}' })
    const storage = keptStorage({ store })

    await storage.load(['tomato.session', 'tomato.quality'])
    expect(storage.getItem('tomato.session')).toBe('{"s":1}')
    expect(storage.getItem('tomato.quality')).toBeNull()

    storage.setItem('tomato.quality', 'mhd')
    storage.removeItem('tomato.session')
    await Promise.resolve()
    expect(Object.fromEntries(kept)).toEqual({ 'tomato.quality': 'mhd' })
  })

  it('o que foi escrito durante a leitura ganha do que estava guardado', async () => {
    let answer!: (v: string) => void
    const store = { get: vi.fn(() => new Promise<string>((r) => { answer = r })), set: vi.fn(async () => {}) }
    const storage = keptStorage({ store })

    const loading = storage.load(['tomato.session'])
    storage.setItem('tomato.session', 'novo')
    answer('velho')
    await loading
    expect(storage.getItem('tomato.session')).toBe('novo')
  })

  it('sem o cofre, ou com ele falhando, vale só para a visita', async () => {
    const plain = keptStorage({})
    await plain.load(['k'])
    plain.setItem('k', 'v')
    expect(plain.getItem('k')).toBe('v')

    const broken = keptStorage({ store: { get: async () => { throw new Error('x') }, set: async () => { throw new Error('x') } } })
    await broken.load(['k'])
    broken.setItem('k', 'v')
    expect(broken.getItem('k')).toBe('v')
  })

  it('não espera um cofre que não responde mais que 3 s', async () => {
    vi.useFakeTimers()
    const storage = keptStorage({ store: { get: () => new Promise(() => {}), set: async () => {} } })
    const loading = storage.load(['k'])
    await vi.advanceTimersByTimeAsync(3_000)
    await loading
    vi.useRealTimers()
  })
})
