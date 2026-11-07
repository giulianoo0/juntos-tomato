// Protocol v1 as the extension sees it, through the SDK at /_juntos/sdk.js.

export interface ExtSource {
  kind: 'hls' | 'file'
  url: string
}

export interface ThemeTokens {
  mode: 'dark' | 'light'
  vars: Record<string, string>
}

export interface InitMessage {
  theme: ThemeTokens
  locale: string
  canPlay: boolean
}

export interface PlayRequest {
  title: string
  subtitle?: string
  poster?: string
  ref: string
  source: ExtSource
}

export interface Juntos {
  onInit(cb: (init: InitMessage) => void): void
  onTheme(cb: (theme: ThemeTokens) => void): void
  onRefresh(cb: (ref: string) => Promise<ExtSource | null>): void
  ready(): void
  play(p: PlayRequest): void
  close(): void
  toast(text: string): void
}

declare global {
  interface Window {
    juntos?: Juntos
  }
}
