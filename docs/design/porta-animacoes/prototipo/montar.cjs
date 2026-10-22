// Monta o protótipo num arquivo só (vai para o Artifact): empacota entrada.ts com o esbuild da
// raiz (pixi.js, os módulos novos, e o código REAL do app que eles usam: animacoesDePorta.ts,
// drawWalls.ts, pixelAlign.ts, constants.ts, curvas.ts) e cola o pacote na marca do fonte.html.
// Rodar da raiz do repo: node docs/design/porta-animacoes/prototipo/montar.cjs
const fs = require('node:fs')
const path = require('node:path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const MARCA = '/*__PROTOTIPO__*/'

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const pacote = esbuild.buildSync({
    entryPoints: [path.join(PASTA, 'entrada.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    minify: true,
    legalComments: 'none',
    metafile: true,
    write: false,
    logLevel: 'warning',
  })
  // Um "</script" dentro do pacote fecharia a tag no meio da página.
  const codigo = pacote.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
  const fonte = fs.readFileSync(path.join(PASTA, 'fonte.html'), 'utf8')
  if (fonte.split(MARCA).length !== 2) throw new Error(`fonte.html precisa ter a marca ${MARCA} uma vez`)
  const html = fonte.replace(MARCA, () => codigo)
  fs.writeFileSync(path.join(PASTA, 'index.html'), html)
  const doApp = Object.keys(pacote.metafile.inputs)
    .filter((f) => f.includes('client/src'))
    .map((f) => f.replace(/^.*client\/src\//, ''))
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version, doApp }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`index.html: ${(r.bytes / 1024).toFixed(1)} KB (esbuild ${r.esbuild}); do app: ${r.doApp.join(', ')}`)
}
