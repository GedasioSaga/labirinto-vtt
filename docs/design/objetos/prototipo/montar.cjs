// Monta o protótipo num arquivo só: fonte.html com objetos.js e pagina.js
// colados no lugar das marcas. Rodar: node docs/design/objetos/prototipo/montar.cjs
const fs = require('node:fs')
const path = require('node:path')

const aqui = __dirname
const ler = (nome) => fs.readFileSync(path.join(aqui, nome), 'utf8')

function semFimDeScript(nome, codigo) {
  if (/<\/script/i.test(codigo)) throw new Error(`${nome} tem "</script" no texto; o HTML montado quebraria.`)
  return codigo
}

const fonte = ler('fonte.html')
const pecas = {
  '/*__OBJETOS__*/': semFimDeScript('objetos.js', ler('objetos.js')),
  '/*__PAGINA__*/': semFimDeScript('pagina.js', ler('pagina.js')),
}
let html = fonte
for (const [marca, codigo] of Object.entries(pecas)) {
  if (!html.includes(marca)) throw new Error(`fonte.html sem a marca ${marca}`)
  // Função no lugar da string: "$&" e "$'" dentro do código não viram padrão de troca.
  html = html.replace(marca, () => codigo)
}
fs.writeFileSync(path.join(aqui, 'index.html'), html)
console.log(`index.html: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`)
