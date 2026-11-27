// Mede um WAV PCM de 16 bits com o scripts/som/medidas.cjs da casa e imprime o JSON do medirTudo.
//   node docs/design/portao-madeira/ferramentas/medir-wav.cjs <arquivo.wav>
'use strict'
const fs = require('fs')
const path = require('path')

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..')
const medidas = require(path.join(RAIZ, 'scripts', 'som', 'medidas.cjs'))

function lerWav16(caminho) {
  const buf = fs.readFileSync(caminho)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('não é WAV')
  let pos = 12
  let fmt = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const tam = buf.readUInt32LE(pos + 4)
    const corpo = pos + 8
    if (id === 'fmt ') {
      fmt = { formato: buf.readUInt16LE(corpo), canais: buf.readUInt16LE(corpo + 2), taxa: buf.readUInt32LE(corpo + 4), bits: buf.readUInt16LE(corpo + 14) }
    } else if (id === 'data') {
      if (!fmt || fmt.formato !== 1 || fmt.bits !== 16) throw new Error('só PCM de 16 bits')
      const n = Math.floor(tam / (2 * fmt.canais))
      const canais = Array.from({ length: fmt.canais }, () => new Float32Array(n))
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < fmt.canais; c++) canais[c][i] = buf.readInt16LE(corpo + (i * fmt.canais + c) * 2) / 32768
      }
      return { canais, taxa: fmt.taxa }
    }
    pos = corpo + tam + (tam % 2)
  }
  throw new Error('WAV sem bloco data')
}

const { canais, taxa } = lerWav16(process.argv[2])
process.stdout.write(JSON.stringify(medidas.medirTudo(canais, taxa)))
