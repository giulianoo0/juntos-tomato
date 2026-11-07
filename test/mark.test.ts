import { describe, expect, it } from 'vitest'
import { mark } from '../src/views/login'

describe('marca', () => {
  it('usa o wordmark juntos.lol, sem a bolinha', () => {
    const el = mark()
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('juntos.lol')
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(10)
    expect(el.querySelector('.brand-dot')).toBeNull()
    expect(el.textContent).toContain('tomato')
  })
})
