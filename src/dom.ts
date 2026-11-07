// Every node is built here: strings always become text, never markup.

export type Child = Node | string | number | null | undefined | false
type AttrValue = string | number | boolean | null | undefined | ((ev: Event) => void)

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on')) {
      if (typeof value !== 'function') throw new Error(`event attribute ${name} needs a function`)
      el.addEventListener(name.slice(2), value)
      continue
    }
    if (value === null || value === undefined || value === false) continue
    if (typeof value === 'function') throw new Error(`attribute ${name} cannot be a function`)
    el.setAttribute(name, value === true ? '' : String(value))
  }
  append(el, ...children)
  return el
}

export function append(el: Element, ...children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === 'number' ? String(c) : c)
  }
}

const IMAGE_HOSTS = new Set(['cdn.tomatoanimes.com'])

/** The URL, if it is https on a host the manifest lists for images. */
export function safeImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('https://')) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname) && !u.username && !u.password ? u.href : null
  } catch {
    return null
  }
}

/** A frame for artwork; an unsafe or missing URL leaves it as a plain placeholder. */
export function image(raw: unknown, cls: string, alt = ''): HTMLElement {
  const frame = h('div', { class: `art ${cls}` })
  const url = safeImageUrl(raw)
  if (!url) return frame
  const img = h('img', { src: url, alt, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' })
  img.addEventListener('load', () => frame.classList.add('loaded'), { once: true })
  img.addEventListener('error', () => img.remove(), { once: true })
  frame.append(img)
  return frame
}

export function clear(el: Element) {
  while (el.firstChild) el.firstChild.remove()
}
