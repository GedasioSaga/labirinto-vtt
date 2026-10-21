// Monta o protótipo da vila num arquivo só (vai para o Artifact):
// - o telhado do app (client/src/lib/telhado + client/src/texturas/telhado.ts), empacotado pelo esbuild da raiz;
// - o pintor de objetos aprovado (docs/design/objetos/prototipo/objetos.js), com as formas abertas em Objetos._i;
// - vila.js (o desenho da vila) e pagina.js (a página), colados nas marcas do fonte.html.
// Rodar da raiz do repo: node docs/design/vila/prototipo/montar.cjs
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const OBJETOS = path.join(RAIZ, 'docs', 'design', 'objetos', 'prototipo', 'objetos.js')
const ALVO_DO_OBJETOS = 'gerarSprite, gerarAmostra, nivel, acertou,'
const ABERTURA = `${ALVO_DO_OBJETOS}
    // Aberto pelo montar.cjs da vila: as mesmas formas, materiais e pintura, para as peças novas.
    _i: { P, caixa, elipse, capsula, poligono, uniao, menos, anel, barra, pintarCena, MATERIAIS, contato, rgb, escalar, misturar, hash, ruido, unir, SOMBRA_X, SOMBRA_Y },`

function semFimDeScript(nome, codigo) {
  if (/<\/script/i.test(codigo)) throw new Error(`${nome} tem "</script" no texto; o HTML montado quebraria.`)
  return codigo
}

function montar() {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const pacote = esbuild.buildSync({
    entryPoints: [path.join(PASTA, 'entrada.js')],
    bundle: true,
    format: 'iife',
    globalName: 'TelhadoLab',
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
  })
  const telhado = `// Gerado por montar.cjs (esbuild ${esbuild.version}) a partir de client/src. Não edite aqui.\n${pacote.outputFiles[0].text}`
  const objetosOriginal = fs.readFileSync(OBJETOS, 'utf8')
  if (objetosOriginal.split(ALVO_DO_OBJETOS).length !== 2) throw new Error('objetos.js mudou: a lista exportada não está mais onde o montar.cjs espera')
  const objetos = objetosOriginal.replace(ALVO_DO_OBJETOS, () => ABERTURA)
  const ler = (nome) => fs.readFileSync(path.join(PASTA, nome), 'utf8')
  const pecas = {
    '/*__TELHADO__*/': semFimDeScript('telhado', telhado),
    '/*__OBJETOS__*/': semFimDeScript('objetos.js', objetos),
    '/*__VILA__*/': semFimDeScript('vila.js', ler('vila.js')),
    '/*__PAGINA__*/': semFimDeScript('pagina.js', ler('pagina.js')),
  }
  let html = ler('fonte.html')
  for (const [marca, codigo] of Object.entries(pecas)) {
    if (!html.includes(marca)) throw new Error(`fonte.html sem a marca ${marca}`)
    html = html.replace(marca, () => codigo)
  }
  fs.writeFileSync(path.join(PASTA, 'index.html'), html)
  return { bytes: Buffer.byteLength(html), esbuild: esbuild.version }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`index.html: ${(r.bytes / 1024).toFixed(1)} KB (telhado com esbuild ${r.esbuild})`)
}
