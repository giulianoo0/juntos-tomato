export interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A fetch that records every call and answers with the next queued response. */
export function fakeFetch(...responses: Array<Response | ((call: Call) => Response)>) {
  const calls: Call[] = []
  const fn = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((v, k) => { headers[k] = v })
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      headers,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const next = responses.shift()
    if (!next) throw new Error(`unexpected request ${call.method} ${call.url}`)
    return typeof next === 'function' ? next(call) : next
  }
  return { fetch: fn as typeof fetch, calls }
}

export function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}
