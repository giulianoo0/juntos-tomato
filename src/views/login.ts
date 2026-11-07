import type { Session } from '../auth'
import { h } from '../dom'
import { wordmark } from '../wordmark'
import type { Ctx, Route } from './ctx'

interface Field {
  name: string
  label: string
  type: string
  autocomplete: string
  minlength?: number
  maxlength?: number
}

export interface AuthFormSpec {
  title: string
  fields: Field[]
  submit: string
  switchTo: { label: string; route: Route }
  send(values: Record<string, string>, verification: string): Promise<Session>
}

export function mark(): HTMLElement {
  return h('span', { class: 'brand' },
    wordmark('brand-juntos'),
    h('span', { class: 'brand-slash', 'aria-hidden': 'true' }, '//'),
    h('span', { class: 'brand-name' }, 'tomato'),
  )
}

export function authForm(ctx: Ctx, spec: AuthFormSpec): HTMLElement {
  const inputs = spec.fields.map((f) => h('input', {
    class: 'field', id: `f-${f.name}`, name: f.name, type: f.type, autocomplete: f.autocomplete,
    required: true, minlength: f.minlength ?? null, maxlength: f.maxlength ?? 200,
  }))
  const captchaHost = h('div', { class: 'captcha' })
  const error = h('p', { class: 'form-error', role: 'alert' })
  const submit = h('button', { class: 'btn btn-tomato btn-block', type: 'submit' }, spec.submit)
  const form = h('form', { class: 'auth-form', novalidate: true },
    ...spec.fields.map((f, i) => h('label', { class: 'label', for: `f-${f.name}` }, h('span', {}, f.label), inputs[i])),
    captchaHost,
    error,
    submit,
  )
  const captcha = ctx.captcha(captchaHost)

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (submit.disabled) return
    error.textContent = ''
    const values: Record<string, string> = {}
    for (const input of inputs) values[input.name] = input.name === 'password' ? input.value : input.value.trim()
    const missing = inputs.find((i) => !values[i.name])
    if (missing) {
      error.textContent = 'Preencha todos os campos'
      missing.focus()
      return
    }
    const verification = captcha.token()
    if (!verification) {
      error.textContent = 'Confirme o captcha'
      return
    }
    submit.disabled = true
    form.setAttribute('aria-busy', 'true')
    spec.send(values, verification).then(
      (s) => ctx.signedIn(s),
      (err: unknown) => {
        error.textContent = err instanceof Error && err.message ? err.message : 'Não deu certo, tente de novo'
        captcha.reset()
        submit.disabled = false
        form.removeAttribute('aria-busy')
      },
    )
  })

  return h('div', { class: 'view auth' },
    h('div', { class: 'auth-card' },
      mark(),
      h('h1', { class: 'auth-title' }, spec.title),
      form,
      h('div', { class: 'auth-switch' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => ctx.open(spec.switchTo.route) }, spec.switchTo.label),
      ),
    ),
  )
}

export function loginView(ctx: Ctx): HTMLElement {
  return authForm(ctx, {
    title: 'Entrar no Tomato',
    fields: [
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
      { name: 'password', label: 'Senha', type: 'password', autocomplete: 'current-password' },
    ],
    submit: 'Entrar',
    switchTo: { label: 'Criar conta', route: { name: 'register' } },
    send: (v, verification) => ctx.login({ email: v.email, password: v.password, verification }),
  })
}
