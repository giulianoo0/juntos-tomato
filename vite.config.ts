import { defineConfig, type Plugin } from 'vitest/config'

// juntos.json stays at the repository root and points at dist/index.html;
// the host serves the committed build straight from GitHub.
function juntosExtension(): Plugin {
  return {
    name: 'juntos-extension',
    configureServer(server) {
      // In dev there is no host; src/sdk-dev.ts stands in for the SDK.
      server.middlewares.use('/_juntos/sdk.js', (_req, res) => {
        res.setHeader('content-type', 'text/javascript')
        res.end('')
      })
    },
  }
}

// Served by the extension host at /@<version>/, so every path in the build is relative.
export default defineConfig({
  base: './',
  plugins: [juntosExtension()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'happy-dom',
    // Third-party scripts never load in tests; a script tag just reports `load`.
    environmentOptions: { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } } },
    include: ['test/**/*.test.ts'],
  },
})
