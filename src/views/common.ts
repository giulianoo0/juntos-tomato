import { append, clear, h, type Child } from '../dom'

const SVG = 'http://www.w3.org/2000/svg'

// 16-unit grid, 1.4 stroke, like the juntos icon set.
const PATHS = {
  play: 'M5 3.5v9l7-4.5z',
  search: 'M7 12.2a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4zM10.8 10.8 14 14',
  back: 'M10 3 5 8l5 5',
  chevron: 'm4.5 6.5 3.5 3.5 3.5-3.5',
  check: 'm3.5 8.5 3 3 6-7',
  home: 'M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H9.5V10h-3v3.5H3a.5.5 0 0 1-.5-.5z',
  out: 'M6.5 2.5H3.5v11h3M10 5l3 3-3 3M13 8H6',
}
export type IconName = keyof typeof PATHS

export function icon(name: IconName, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', `icon icon-${name}`)
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', PATHS[name])
  svg.append(path)
  return svg
}

export function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export function id(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null
}

/** Skeleton while `load` runs, then `render`; a failure leaves a retry. */
export function loadInto<T>(host: HTMLElement, skeleton: () => Child, load: () => Promise<T>, render: (data: T) => Child) {
  const run = () => {
    clear(host)
    host.setAttribute('aria-busy', 'true')
    append(host, skeleton())
    load()
      .then((data) => {
        clear(host)
        host.removeAttribute('aria-busy')
        append(host, render(data))
      })
      .catch((e: unknown) => {
        clear(host)
        host.removeAttribute('aria-busy')
        host.append(failed(e instanceof Error ? e.message : '', run))
      })
  }
  run()
}

export function failed(message: string, retry: () => void): HTMLElement {
  return h('div', { class: 'failed', role: 'alert' },
    h('p', {}, message || 'Não deu para carregar'),
    h('button', { class: 'btn btn-soft', type: 'button', onclick: retry }, 'Tentar de novo'),
  )
}

export function shimmer(cls: string, n = 1): HTMLElement {
  const wrap = h('div', { class: `skeleton ${cls}`, 'aria-hidden': 'true' })
  for (let i = 0; i < n; i++) wrap.append(h('div', { class: 'shimmer' }))
  return wrap
}
