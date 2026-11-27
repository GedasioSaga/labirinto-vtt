'use strict'
// Confere o som.wav com a régua da casa (scripts/som/medidas.cjs): LUFS, pico verdadeiro, cortes, cliques, DC.
// É a segunda opinião sobre as medidas do som.py (que tem a sua própria K-ponderação e pico com 4x).
// Uso (da raiz do repo): node docs/design/mascara-baldwin-fogo/medir-som.cjs <som.wav> [saida.json]
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..', '..', '..')
const medidas = require(path.join(RAIZ, 'scripts', 'som', 'medidas.cjs'))

function lerWav16(arquivo) {
  const buf = fs.readFileSync(arquivo)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('não é WAV')
  let pos = 12
  let fmt = null
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const tam = buf.readUInt32LE(pos + 4)
    if (id === 'fmt ') fmt = { canais: buf.readUInt16LE(pos + 10), taxa: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) }
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error('só PCM 16 bits')
      const n = tam / (2 * fmt.canais)
      const canais = Array.from({ length: fmt.canais }, () => new Float64Array(n))
      for (let i = 0; i < n; i++) for (let c = 0; c < fmt.canais; c++) canais[c][i] = buf.readInt16LE(pos + 8 + (i * fmt.canais + c) * 2) / 32768
      return { canais, taxa: fmt.taxa }
    }
    pos += 8 + tam + (tam % 2)
  }
  throw new Error('WAV sem bloco data')
}

const [arquivo, saida] = process.argv.slice(2)
if (!arquivo) {
  console.error('uso: node medir-som.cjs <som.wav> [saida.json]')
  process.exit(2)
}
const { canais, taxa } = lerWav16(arquivo)
const m = medidas.medirTudo(canais, taxa)
const motivos = medidas.julgar(m, null)
const resultado = { ...m, motivos, passou: motivos.length === 0 }
delete resultado.centroideHzPorSegundo
if (saida) fs.writeFileSync(saida, JSON.stringify(resultado, null, 1))
console.log(JSON.stringify({ lufs: m.lufsIntegrado, picoVerdadeiroDbtp: m.picoVerdadeiroDbtp, cortes: m.cortes, cliques: m.cliques, ataques: m.ataques, dcPct: m.dcPct, motivos }, null, 1))
process.exit(motivos.length === 0 ? 0 : 1)
