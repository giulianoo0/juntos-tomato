const NS = 'http://www.w3.org/2000/svg'

// The juntos.lol lettering, the same strokes as the site's SmallWordmark.
const STROKES = [
  'M 12 -42 L 12 0 A 12 12 0 0 1 0 12',
  'M 34 -42 L 34 -18 A 18 18 0 0 0 70 -18',
  'M 70 -42 L 70 -6',
  'M 92 -42 L 92 -6',
  'M 92 -24 A 18 18 0 0 1 128 -24 L 128 -6',
  'M 161 -62 L 161 -6',
  'M 150 -42 L 172 -42',
  'M 213 -43.5 A 19 19.5 0 1 1 212.98 -43.5',
  'M 277.93 -37.1 A 12 10.5 0 1 0 266 -25.5 A 12 10.5 0 1 1 254.88 -11.07',
  'M 336 -68 L 336 -6',
  'M 377 -43.5 A 19 19.5 0 1 1 376.98 -43.5',
  'M 418 -68 L 418 -6',
]
const ARROW = 'M 299 -33 L 313 -24 L 299 -15 Z'

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

export function wordmark(className: string): SVGElement {
  const svg = el('svg', { viewBox: '-8 -80 440 108', class: className, role: 'img', 'aria-label': 'juntos.lol' })
  const letters = el('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': '12', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  for (const d of STROKES) letters.append(el('path', { d }))
  svg.append(letters, el('circle', { cx: '12', cy: '-58', r: '6.5', fill: 'currentColor' }), el('path', { d: ARROW, class: 'wordmark-arrow' }))
  return svg
}
