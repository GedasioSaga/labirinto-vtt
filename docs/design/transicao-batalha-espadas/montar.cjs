// Monta o protótipo da abertura de batalha "Espadas cruzadas" num arquivo só (abre direto no navegador):
// a cena do módulo (client/src/animacoes/batalha/espadas-cruzadas.ts) e o .json dela, empacotados pelo
// esbuild da raiz num IIFE (AberturasDeBatalha), colados na marca do fonte.html. three@0.186.1 vem da CDN,
// a mesma versão do app, como nos protótipos das transições de local.
// Rodar da raiz do repo: node docs/design/transicao-batalha-espadas/montar.cjs
'use strict'
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..')
const BATALHA = path.join(RAIZ, 'client', 'src', 'animacoes', 'batalha').split(path.sep).join('/')

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const entrada = [
    `export { default as espadasCruzadas, NOME_PADRAO, NOME_MAX_LETRAS } from '${BATALHA}/espadas-cruzadas.ts'`,
    `export { default as metaEspadasCruzadas } from '${BATALHA}/espadas-cruzadas.json'`,
  ].join('\n')
  const pacote = esbuild.buildSync({
    stdin: { contents: entrada, resolveDir: RAIZ, sourcefile: 'entrada.js', loader: 'js' },
    bundle: true,
    format: 'iife',
    globalName: 'AberturasDeBatalha',
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
  const html = fonte.replace(MARCA, () => `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de client/src. Não edite aqui.\n${codigo}`)
  fs.writeFileSync(path.join(PASTA, 'prototipo.html'), html)
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`prototipo.html: ${(r.bytes / 1024).toFixed(1)} KB (esbuild ${r.esbuild})`)
}
