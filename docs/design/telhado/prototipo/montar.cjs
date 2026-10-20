// Monta o protótipo: empacota as funções do telhado do app (client/src/lib/telhado e
// client/src/texturas/telhado.ts) com o esbuild da raiz e cola o pacote dentro do index.html,
// entre as marcas do <script id="telhado-lib">. A página continua um arquivo só (vai para o Artifact).
// Rodar da raiz do repo: node docs/design/telhado/prototipo/montar.cjs
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const INDEX = path.join(PASTA, 'index.html')
const ENTRADA = path.join(PASTA, 'entrada.js')
const MARCA_INICIO = '<script id="telhado-lib">'
const MARCA_FIM = '</script><!-- /telhado-lib -->'

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const resultado = esbuild.buildSync({
    entryPoints: [ENTRADA],
    bundle: true,
    format: 'iife',
    globalName: 'TelhadoLab',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
  })
  const codigo = resultado.outputFiles[0].text
  // Um "</script" dentro do pacote fecharia a tag no meio da página.
  if (/<\/script/i.test(codigo)) throw new Error('o pacote tem "</script" e quebraria a página')
  const html = fs.readFileSync(INDEX, 'utf8')
  const inicio = html.indexOf(MARCA_INICIO)
  const fim = html.indexOf(MARCA_FIM)
  if (inicio < 0 || fim < inicio) throw new Error('marcas do telhado-lib não encontradas no index.html')
  const aviso = `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de client/src. Não edite aqui.\n`
  const novo = html.slice(0, inicio + MARCA_INICIO.length) + '\n' + aviso + codigo + html.slice(fim)
  if (novo !== html) fs.writeFileSync(INDEX, novo)
  return { bytes: Buffer.byteLength(codigo), mudou: novo !== html, esbuild: esbuild.version }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`telhado-lib: ${(r.bytes / 1024).toFixed(1)} KB com esbuild ${r.esbuild}${r.mudou ? ' (index.html atualizado)' : ' (sem mudança)'}`)
}
