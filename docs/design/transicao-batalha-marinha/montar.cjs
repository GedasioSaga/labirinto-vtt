// Monta o protótipo da abertura de batalha "Bandeira da Marinha" num arquivo só (abre direto no navegador).
// A cena mora em src/animacoes/batalha/ desta pasta, que espelha client/src: os imports '../../transicoes/...'
// dela são resolvidos aqui para client/src/transicoes (o mesmo código do app, sem cópia). As Espadas cruzadas
// entram do próprio client/src, para comparar lado a lado. Tudo vai num IIFE (AberturasDeBatalha) colado na
// marca do fonte.html; three@0.186.1 vem da CDN, a mesma versão do app, como no protótipo das Espadas.
// Rodar da raiz do repo: node docs/design/transicao-batalha-marinha/montar.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..')
const barra = (p) => p.split(path.sep).join('/')
const ESPELHO = path.join(PASTA, 'src')
const SRC_DO_APP = path.join(RAIZ, 'client', 'src')
const MARINHA = barra(path.join(ESPELHO, 'animacoes', 'batalha'))
const TRANSICOES_DO_APP = path.join(SRC_DO_APP, 'transicoes')
const BATALHA_DO_APP = barra(path.join(SRC_DO_APP, 'animacoes', 'batalha'))

/**
 * Import relativo de dentro do espelho que não existe aqui vai para o mesmo
 * caminho em client/src (o que o rootDirs do tsconfig.json desta pasta faz
 * para o tsc): '../../transicoes/curvas' vira client/src/transicoes/curvas.ts.
 */
const espelhoDoApp = {
  name: 'espelho-do-app',
  setup(build) {
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (!args.importer || !path.resolve(args.importer).startsWith(ESPELHO + path.sep)) return undefined
      const alvo = path.resolve(args.resolveDir, args.path)
      const relativo = path.relative(ESPELHO, alvo)
      if (relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error(`import sai do espelho: ${args.path}`)
      if ([alvo, `${alvo}.ts`, `${alvo}.json`].some((p) => fs.existsSync(p))) return undefined
      const noApp = path.join(SRC_DO_APP, relativo)
      const arquivo = [`${noApp}.ts`, `${noApp}.tsx`, noApp].find((p) => fs.existsSync(p))
      if (!arquivo) throw new Error(`nem no espelho nem em client/src: ${args.path}`)
      return { path: arquivo }
    })
  },
}

async function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const entrada = [
    `export { default as bandeiraDaMarinha, NOME_PADRAO, NOME_MAX_LETRAS, ROTEIRO_DA_MARINHA, desenharSimboloDaMarinha } from '${MARINHA}/bandeira-da-marinha.ts'`,
    `export { default as metaBandeiraDaMarinha } from '${MARINHA}/bandeira-da-marinha.json'`,
    `export { default as espadasCruzadas } from '${BATALHA_DO_APP}/espadas-cruzadas.ts'`,
    `export { default as metaEspadasCruzadas } from '${BATALHA_DO_APP}/espadas-cruzadas.json'`,
  ].join('\n')
  if (!fs.existsSync(TRANSICOES_DO_APP)) throw new Error(`sem ${TRANSICOES_DO_APP}`)
  // Plugin só roda na API assíncrona do esbuild.
  const pacote = await esbuild.build({
    stdin: { contents: entrada, resolveDir: RAIZ, sourcefile: 'entrada.js', loader: 'js' },
    bundle: true,
    format: 'iife',
    globalName: 'AberturasDeBatalha',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    minify: true,
    write: false,
    plugins: [espelhoDoApp],
  })
  const codigo = pacote.outputFiles[0].text
  if (/<\/script/i.test(codigo)) throw new Error('o pacote tem "</script" no texto; o HTML montado quebraria.')
  const fonte = fs.readFileSync(path.join(PASTA, 'fonte.html'), 'utf8')
  const MARCA = '/*__CENAS__*/'
  if (fonte.split(MARCA).length !== 2) throw new Error(`fonte.html sem a marca ${MARCA} (ou com mais de uma)`)
  const html = fonte.replace(MARCA, () => `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de src/ desta pasta e de client/src. Não edite aqui.\n${codigo}`)
  fs.writeFileSync(path.join(PASTA, 'prototipo.html'), html)
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version }
}

module.exports = { montar }

if (require.main === module) {
  montar().then(
    (r) => console.log(`prototipo.html: ${(r.bytes / 1024).toFixed(1)} KB (esbuild ${r.esbuild})`),
    (e) => {
      console.error(e)
      process.exitCode = 1
    },
  )
}
