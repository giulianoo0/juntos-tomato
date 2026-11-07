# juntos // tomato

Extensão do [juntos.lol](https://juntos.lol) para assistir animes da Tomato em grupo: catálogo, busca, login e cadastro com a sua própria conta da Tomato, e o episódio vai para a sala.

Roda isolada no subdomínio da extensão; o token da Tomato fica só nesse aparelho e nesse subdomínio, nunca passa pelo juntos.

## Desenvolvimento

```sh
npm ci
npm run dev     # vite com um SDK de mentira (src/sdk-dev.ts)
npm test
npm run build   # gera dist/, que vai commitado
```

O host de extensões serve os arquivos direto do GitHub pelo sha registrado e não roda build: **commite o `dist/`** junto com a mudança. O `juntos.json` fica na raiz e aponta para `dist/index.html`.
