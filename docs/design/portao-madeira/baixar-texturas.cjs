// Baixa da Poly Haven (CC0) as texturas do portão, em 2k JPG, para fora do repo:
//   ~/Animações/referencias/portao-madeira/texturas/<id>/<id>_<mapa>_2k.jpg
// Rodar da raiz do repo: node docs/design/portao-madeira/baixar-texturas.cjs
// Os arquivos baixados são dado não confiável: o Blender só os lê como imagem.
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')

const DESTINO = path.join(os.homedir(), 'Animações', 'referencias', 'portao-madeira', 'texturas')
/** id da Poly Haven -> mapas que a cena usa (nome da chave na API /files). */
const TEXTURAS = {
  medieval_wood: ['Diffuse', 'nor_gl', 'Rough', 'Displacement'],
  dark_wooden_planks: ['Diffuse', 'nor_gl', 'Rough'],
  rust_coarse_01: ['Diffuse', 'nor_gl', 'Rough'],
  medieval_blocks_03: ['Diffuse', 'nor_gl', 'Rough'],
}
const RESOLUCAO = '2k'
const AGENTE = { 'User-Agent': 'asset-fetch' }

function baixar(url, destino) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: AGENTE }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        baixar(res.headers.location, destino).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`${url}: HTTP ${res.statusCode}`))
        return
      }
      const partes = []
      res.on('data', (p) => partes.push(p))
      res.on('end', () => {
        if (destino) fs.writeFileSync(destino, Buffer.concat(partes))
        resolve(Buffer.concat(partes))
      })
    }).on('error', reject)
  })
}

async function principal() {
  for (const [id, mapas] of Object.entries(TEXTURAS)) {
    const pasta = path.join(DESTINO, id)
    fs.mkdirSync(pasta, { recursive: true })
    const arquivos = JSON.parse((await baixar(`https://api.polyhaven.com/files/${id}`)).toString('utf8'))
    for (const mapa of mapas) {
      const entrada = arquivos[mapa] && arquivos[mapa][RESOLUCAO] && arquivos[mapa][RESOLUCAO].jpg
      if (!entrada) throw new Error(`${id}: sem ${mapa} ${RESOLUCAO} jpg`)
      const nome = `${id}_${mapa}_${RESOLUCAO}.jpg`
      const alvo = path.join(pasta, nome)
      if (!fs.existsSync(alvo)) await baixar(entrada.url, alvo)
      console.log(`${nome}  ${(fs.statSync(alvo).size / 1024).toFixed(0)} KB`)
    }
  }
}

principal().catch((erro) => {
  console.error(erro.message)
  process.exit(1)
})
