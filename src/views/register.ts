import type { Ctx } from './ctx'
import { authForm } from './login'

export function registerView(ctx: Ctx): HTMLElement {
  return authForm(ctx, {
    title: 'Criar conta no Tomato',
    fields: [
      { name: 'username', label: 'Nome de usuário', type: 'text', autocomplete: 'username', minlength: 3, maxlength: 32 },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
      { name: 'password', label: 'Senha', type: 'password', autocomplete: 'new-password', minlength: 6 },
    ],
    submit: 'Criar conta',
    switchTo: { label: 'Entrar', route: { name: 'login' } },
    send: (v, verification) =>
      ctx.register({ username: v.username, email: v.email, password: v.password, verification }),
  })
}
