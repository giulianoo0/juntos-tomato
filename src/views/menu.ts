import { h } from '../dom'
import { icon } from './common'

const CLOSE_MS = 360

export interface MenuOption<T extends string> {
  id: T
  label: string
}

/**
 * A spring popover born from `trigger`: scale 0 + blur to rest on
 * --ease-spring-pop, back on --ease-spring-settle (styles.css `.popover`).
 */
function attachPopover(trigger: HTMLButtonElement, label: string, build: (close: () => void) => HTMLButtonElement[]) {
  let pop: HTMLElement | null = null

  trigger.setAttribute('aria-haspopup', 'menu')
  trigger.setAttribute('aria-expanded', 'false')

  function close(focusTrigger = false) {
    const el = pop
    if (!el) return
    pop = null
    trigger.setAttribute('aria-expanded', 'false')
    trigger.removeAttribute('data-popup-open')
    document.removeEventListener('pointerdown', onOutside, true)
    el.dataset.state = 'closed'
    setTimeout(() => el.remove(), CLOSE_MS)
    if (focusTrigger) trigger.focus()
  }

  function onOutside(e: Event) {
    if (pop && !pop.contains(e.target as Node) && !trigger.contains(e.target as Node)) close()
  }

  function open() {
    const items = build(() => close(true))
    const el = h('div', { class: 'popover', role: 'menu', 'aria-label': label, 'data-state': 'closed' }, ...items)
    el.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
      else if (e.key === 'Tab') close()
    })
    const r = trigger.getBoundingClientRect()
    el.style.top = `${r.bottom + 6}px`
    el.style.right = `${Math.max(8, document.documentElement.clientWidth - r.right)}px`
    document.body.append(el)
    pop = el
    trigger.setAttribute('aria-expanded', 'true')
    trigger.setAttribute('data-popup-open', '')
    document.addEventListener('pointerdown', onOutside, true)
    // One frame at scale 0, then the spring takes it to rest.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (pop === el) el.dataset.state = 'open' }))
    ;(items.find((b) => b.getAttribute('aria-checked') === 'true') ?? items[0])?.focus({ preventScroll: true })
  }

  trigger.addEventListener('click', () => (pop ? close() : open()))
  return { close }
}

/** A menu that picks one of `options`. */
export function attachMenu<T extends string>(
  trigger: HTMLButtonElement,
  label: string,
  options: () => MenuOption<T>[],
  current: () => T,
  pick: (id: T) => void,
) {
  return attachPopover(trigger, label, (close) => options().map((o) =>
    h('button', {
      class: 'menu-item', type: 'button', role: 'menuitemradio',
      'aria-checked': o.id === current() ? 'true' : 'false',
      onclick: () => { pick(o.id); close() },
    }, h('span', {}, o.label), o.id === current() ? icon('check', 14) : null),
  ))
}

/** A menu of actions. */
export function attachActions(trigger: HTMLButtonElement, label: string, actions: Array<{ label: string; run: () => void }>) {
  return attachPopover(trigger, label, (close) => actions.map((a) =>
    h('button', {
      class: 'menu-item', type: 'button', role: 'menuitem',
      onclick: () => { close(); a.run() },
    }, a.label),
  ))
}
