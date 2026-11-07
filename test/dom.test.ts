import { describe, expect, it } from 'vitest'
import { h, image, safeImageUrl } from '../src/dom'

const EVIL = '<img src=x onerror=alert(1)>'

describe('h', () => {
  it('puts strings in as text, never as markup', () => {
    const el = h('p', { class: 'x' }, EVIL, '"><script>alert(1)</script>')
    expect(el.querySelector('img, script')).toBeNull()
    expect(el.textContent).toBe(`${EVIL}"><script>alert(1)</script>`)
    expect(el.className).toBe('x')
  })

  it('refuses event handler attributes', () => {
    expect(() => h('div', { onclick: 'alert(1)' })).toThrow()
  })
})

describe('safeImageUrl', () => {
  it.each([
    ['https://cdn.tomatoanimes.com/cover/a.jpg', true],
    ['http://cdn.tomatoanimes.com/cover/a.jpg', false],
    ['https://cdn.tomatoanimes.com.evil.com/a.jpg', false],
    ['https://evil.com/a.jpg?https://cdn.tomatoanimes.com/', false],
    ['javascript:alert(1)', false],
    ['data:image/png;base64,AAAA', false],
    ['//cdn.tomatoanimes.com/a.jpg', false],
    ['', false],
  ])('%s → %s', (url, ok) => {
    expect(safeImageUrl(url) !== null).toBe(ok)
  })

  it('accepts only strings', () => {
    expect(safeImageUrl(undefined)).toBeNull()
    expect(safeImageUrl({ toString: () => 'https://cdn.tomatoanimes.com/a.jpg' })).toBeNull()
  })
})

describe('image', () => {
  it('loads an allowed URL', () => {
    const el = image('https://cdn.tomatoanimes.com/cover/a.jpg', 'poster')
    const img = el instanceof HTMLImageElement ? el : el.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://cdn.tomatoanimes.com/cover/a.jpg')
  })

  it('leaves a placeholder for any other URL', () => {
    const el = image('https://evil.com/a.jpg', 'poster')
    expect(el.querySelector('img')).toBeNull()
    expect(el.tagName).not.toBe('IMG')
  })
})
