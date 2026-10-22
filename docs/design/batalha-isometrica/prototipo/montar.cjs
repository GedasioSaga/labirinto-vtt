// Monta o protótipo num arquivo só (index.html autocontido; só a fonte Barlow vem de fora).
// Rodar da raiz do repo: node docs/design/batalha-isometrica/prototipo/montar.cjs
const fs = require('fs')
const path = require('path')

const PASTA = __dirname
const ler = (nome) => fs.readFileSync(path.join(PASTA, nome), 'utf8').replace(/\r\n/g, '\n')

function semFimDeScript(nome, codigo) {
  if (/<\/script/i.test(codigo)) throw new Error(`${nome} tem "</script" no texto; o HTML montado quebraria.`)
  return codigo
}

function montar() {
  const pecas = {
    '/*__NUCLEO__*/': ler('nucleo.js'),
    '/*__PINTOR__*/': ler('pintor.js'),
    '/*__PAGINA__*/': ler('pagina.js'),
  }
  let html = ler('fonte.html')
  for (const [marca, codigo] of Object.entries(pecas)) {
    if (!html.includes(marca)) throw new Error(`fonte.html sem a marca ${marca}`)
    html = html.replace(marca, () => semFimDeScript(marca, codigo))
  }
  fs.writeFileSync(path.join(PASTA, 'index.html'), html)
  return { bytes: Buffer.byteLength(html) }
}

module.exports = { montar }

if (require.main === module) {
  const r = montar()
  console.log(`index.html: ${(r.bytes / 1024).toFixed(1)} KB`)
}
