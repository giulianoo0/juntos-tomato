import type { Api } from '../api'
import type { Session } from '../auth'
import type { Captcha } from '../captcha'
import type { EpisodeToPlay, Quality } from './player'

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'anime'; id: number }
  | { name: 'login' }
  | { name: 'register' }

/** What every view gets from the shell. */
export interface Ctx {
  api: Api
  open(route: Route): void
  play(ep: EpisodeToPlay): Promise<void>
  canPlay(): boolean
  quality(): Quality
  setQuality(q: Quality): void
  signedIn(s: Session): void
  login(f: { email: string; password: string; verification: string }): Promise<Session>
  register(f: { username: string; email: string; password: string; verification: string }): Promise<Session>
  captcha(host: HTMLElement): Captcha
}
