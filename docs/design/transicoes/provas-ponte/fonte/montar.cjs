// Monta o protótipo da "Ponte levadiça" num arquivo só (docs/design/transicoes/ponte-levadica.html):
// as duas cenas (entrando e saindo), no mesmo contrato das transições do pacote (CriarCena), empacotadas
// pelo esbuild da raiz num IIFE (PonteLevadica) e coladas na marca do fonte.html. three@0.186.1 vem da CDN,
// como nos protótipos do Campo ensolarado e da Trilha do pinheiral.
// Rodar da raiz do repo: node docs/design/transicoes/provas-ponte/fonte/montar.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..', '..')
const SAIDA = path.resolve(PASTA, '..', '..', 'ponte-levadica.html')
const barra = (p) => p.split(path.sep).join('/')

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const entrada = [
    `export { default as entrando } from '${barra(PASTA)}/ponte-levadica-entrando.ts'`,
    `export { default as saindo } from '${barra(PASTA)}/ponte-levadica-saindo.ts'`,
  ].join('\n')
  const pacote = esbuild.buildSync({
    stdin: { contents: entrada, resolveDir: RAIZ, sourcefile: 'entrada.js', loader: 'js' },
    bundle: true,
    format: 'iife',
    globalName: 'PonteLevadica',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    minify: true,
    write: false,
  })
  const codigo = pacote.outputFiles[0].text
  if (/<\/script/i.test(codigo)) throw new Error('o pacote tem "</script" no texto; o HTML montado quebraria.')
  const fonte = fs.readFileSync(path.join(PASTA, 'fonte.html'), 'utf8')
  const MARCA = '/*__CENAS__*/'
  if (fonte.split(MARCA).length !== 2) throw new Error(`fonte.html sem a marca ${MARCA} (ou com mais de uma)`)
  const html = fonte.replace(MARCA, () => `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de provas-ponte/fonte. Não edite aqui.\n${codigo}`)
  fs.writeFileSync(SAIDA, html)
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`${barra(path.relative(RAIZ, SAIDA))}: ${(r.bytes / 1024).toFixed(1)} KB (esbuild ${r.esbuild})`)
}
