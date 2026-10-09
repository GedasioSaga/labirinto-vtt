'use strict'
// Testes da parte pura do conferir-som, sobre sinais sintéticos de resposta
// conhecida. Rodar: node --test scripts/som/
const test = require('node:test')
const assert = require('node:assert/strict')
const m = require('./medidas.cjs')

const TAXA = 48000

function seno(freq, amplitude, segundos, fase = 0, taxa = TAXA) {
  const x = new Float32Array(Math.round(segundos * taxa))
  for (let i = 0; i < x.length; i++) x[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / taxa + fase)
  return x
}

/** Ruído branco determinístico (mesma sequência a cada execução). */
function ruido(segundos, amplitude, semente = 1) {
  let s = semente
  const x = new Float32Array(Math.round(segundos * TAXA))
  for (let i = 0; i < x.length; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    x[i] = amplitude * ((s / 2147483648) * 2 - 1)
  }
  return x
}

/** Só os saltos classificados como defeito (ataque e trem de pulsos são esperados). */
const cliques = (canais) => m.detectarCliques(canais, TAXA).filter((s) => s.tipo === 'clique')

test('LUFS: seno de 1 kHz a -20 dBFS num canal ≈ -23 LUFS', () => {
  const v = m.lufsIntegrado([seno(1000, 0.1, 5)], TAXA)
  assert.ok(Math.abs(v - -23) <= 0.5, `deu ${v}`)
})

test('LUFS: o mesmo seno nos dois canais soma +3 LU; em 44,1 kHz dá o mesmo', () => {
  const s = seno(1000, 0.1, 5)
  assert.ok(Math.abs(m.lufsIntegrado([s, s], TAXA) - -20) <= 0.5)
  assert.ok(Math.abs(m.lufsIntegrado([seno(1000, 0.1, 5, 0, 44100)], 44100) - -23) <= 0.5)
})

test('LUFS: o gating ignora silêncio longo (som + silêncio = só o som)', () => {
  const s = seno(1000, 0.1, 3)
  const comSilencio = new Float32Array(s.length * 3)
  comSilencio.set(s, s.length)
  const v = m.lufsIntegrado([comSilencio], TAXA)
  assert.ok(Math.abs(v - -23) <= 0.6, `deu ${v}`)
  assert.equal(m.lufsIntegrado([new Float32Array(TAXA * 2)], TAXA), -Infinity)
})

test('LUFS curto prazo: máximo pega a parte alta', () => {
  const x = new Float32Array(TAXA * 8)
  x.set(seno(1000, 0.01, 4))
  x.set(seno(1000, 0.1, 4), TAXA * 4)
  const v = m.lufsCurtoPrazoMax([x], TAXA)
  assert.ok(Math.abs(v - -23) <= 0.5, `deu ${v}`)
})

test('pico verdadeiro: seno em fs/4 com fase de 45° tem amostras a -3 dB e pico real em 0 dB', () => {
  const x = seno(TAXA / 4, 1, 0.5, Math.PI / 4)
  const amostra = m.db(m.picoDeAmostra([x]))
  const verdadeiro = m.db(m.picoVerdadeiro([x]))
  assert.ok(Math.abs(amostra - -3.01) < 0.05, `amostra ${amostra}`)
  assert.ok(Math.abs(verdadeiro) <= 0.3, `verdadeiro ${verdadeiro}`)
})

test('pico verdadeiro: seno grave fica igual ao pico de amostra', () => {
  const x = seno(100, 0.5, 0.5)
  assert.ok(Math.abs(m.db(m.picoVerdadeiro([x])) - m.db(0.5)) < 0.05)
})

test('corte: conta |x| >= 1', () => {
  const x = new Float32Array([0, 0.5, 1, -1.2, 0.999])
  assert.equal(m.contarCortes([x]), 2)
})

test('DC: offset de 1% aparece; seno puro não', () => {
  const x = seno(440, 0.5, 1).map((v) => v + 0.01)
  assert.ok(Math.abs(m.offsetDC([x]) - 1) < 0.01)
  assert.ok(Math.abs(m.offsetDC([seno(440, 0.5, 1)])) < 0.01)
})

test('clique: impulso isolado no silêncio é clique (um só evento)', () => {
  const x = new Float32Array(TAXA)
  x[TAXA / 2] = 0.2
  const c = m.detectarCliques([x], TAXA)
  assert.equal(c.length, 1)
  assert.equal(c[0].tipo, 'clique')
  assert.ok(Math.abs(c[0].t - 0.5) < 0.001)
})

test('clique: impulso no meio de um seno grave é clique; o mesmo nos dois canais conta uma vez', () => {
  const x = seno(80, 0.3, 1)
  x[TAXA / 4] += 0.05
  assert.equal(cliques([x, x]).length, 1)
})

test('clique: seno cortado de repente (degrau) é clique', () => {
  const x = seno(200, 0.5, 1, Math.PI / 2)
  x.fill(0, TAXA / 2)
  assert.equal(cliques([x]).length, 1)
})

test('não é clique: seno liso, seno com ataque de 5 ms, rajada de ruído com ataque seco, silêncio', () => {
  assert.equal(cliques([seno(1000, 0.9, 1)]).length, 0)
  const ataque = seno(300, 0.8, 1)
  for (let i = 0; i < ataque.length; i++) ataque[i] *= Math.min(1, i / (0.005 * TAXA))
  assert.equal(cliques([ataque]).length, 0)
  // Passo/baque: ruído que começa seco e some em 80 ms (ataque esperado).
  const passo = new Float32Array(TAXA)
  const r = ruido(0.08, 0.6)
  for (let i = 0; i < r.length; i++) passo[TAXA / 4 + i] = r[i] * Math.exp((-i / TAXA) * 40)
  assert.equal(cliques([passo]).length, 0)
  assert.equal(cliques([new Float32Array(TAXA)]).length, 0)
})

test('ataque: seno grave que começa seco no pico (baque) é ataque, não clique', () => {
  const x = new Float32Array(TAXA)
  // 0,7 s: a cauda já está abaixo de -40 dBFS quando o trecho acaba (senão o corte seria clique, com razão).
  const baque = seno(60, 0.7, 0.7, Math.PI / 2)
  for (let i = 0; i < baque.length; i++) baque[i] *= Math.exp((-i / TAXA) * 8)
  x.set(baque, TAXA / 4)
  const s = m.detectarCliques([x], TAXA)
  assert.ok(s.length >= 1 && s.every((v) => v.tipo === 'ataque'), JSON.stringify(s))
})

test('trem: rangido em dente de serra a 30 pulsos/s é textura, não clique; um impulso solto no meio do silêncio depois dele é clique', () => {
  const x = new Float32Array(TAXA * 2)
  for (let i = 0; i < TAXA; i++) {
    const fase = ((i * 30) / TAXA) % 1
    const env = Math.sin((Math.PI * i) / TAXA) // sobe e desce liso em 1 s
    x[i] = 0.4 * env * (2 * fase - 1)
  }
  x[Math.round(TAXA * 1.5)] = 0.1
  const s = m.detectarCliques([x], TAXA)
  assert.ok(s.filter((v) => v.tipo === 'trem').length > 10)
  const c = s.filter((v) => v.tipo === 'clique')
  assert.equal(c.length, 1, JSON.stringify(c))
  assert.ok(Math.abs(c[0].t - 1.5) < 0.001)
})

test('silêncio no meio: acha o buraco, ignora o silêncio da ponta', () => {
  const x = new Float32Array(TAXA * 2)
  x.set(seno(440, 0.5, 0.5), TAXA * 0.25)
  x.set(seno(440, 0.5, 0.5), TAXA * 1.25)
  const s = m.silenciosNoMeio([x], TAXA)
  assert.equal(s.length, 1)
  assert.ok(Math.abs(s[0].inicio - 0.75) < 0.01 && Math.abs(s[0].fim - 1.25) < 0.01)
})

test('equilíbrio L/R: esquerdo com o dobro da amplitude = +6 dB; mono = null', () => {
  assert.ok(Math.abs(m.equilibrioLR([seno(440, 0.5, 1), seno(440, 0.25, 1)]) - 6.02) < 0.05)
  assert.equal(m.equilibrioLR([seno(440, 0.5, 1)]), null)
})

test('centróide: seno de 2 kHz fica perto de 2 kHz; segundo mudo = null', () => {
  const x = new Float32Array(TAXA * 2)
  // Para em 0,8 s: o quadro de 2048 em volta de t = 1 s não alcança mais o seno.
  x.set(seno(2000, 0.5, 0.8))
  const c = m.centroidePorSegundo([x], TAXA)
  assert.ok(Math.abs(c[0] - 2000) < 60, `deu ${c[0]}`)
  assert.equal(c[1], null)
})

test('espectrograma: o seno de 1 kHz acende a linha certa a ~-6 dBFS (amplitude 0,5)', () => {
  const e = m.espectrograma([seno(1000, 0.5, 1)], TAXA, { colunas: 20, linhas: 100 })
  const meio = e.db[10]
  const linha = meio.indexOf(Math.max(...meio))
  const fLinha = e.fMin * Math.pow(e.fMax / e.fMin, (linha + 0.5) / 100)
  assert.ok(fLinha > 900 && fLinha < 1100, `linha em ${fLinha} Hz`)
  assert.ok(Math.abs(meio[linha] - -6.02) < 1, `nível ${meio[linha]}`)
})

test('julgar: aprova o normal e reprova cada critério com motivo em português', () => {
  const base = { picoVerdadeiroDbtp: -3, cortes: 0, cliques: [], dcPct: 0.01, lufsIntegrado: -20 }
  assert.deepEqual(m.julgar(base, -21), [])
  assert.match(m.julgar({ ...base, picoVerdadeiroDbtp: -0.5 }, -21)[0], /pico verdadeiro/)
  assert.match(m.julgar({ ...base, cortes: 3 }, -21)[0], /cortada/)
  assert.match(m.julgar({ ...base, cliques: [{ t: 1.2 }] }, -21)[0], /clique/)
  assert.match(m.julgar({ ...base, dcPct: 0.8 }, -21)[0], /DC/)
  assert.match(m.julgar({ ...base, lufsIntegrado: -14 }, -21)[0], /ACIMA/)
  assert.match(m.julgar({ ...base, lufsIntegrado: -28 }, -21)[0], /ABAIXO/)
})

test('wav16: cabeçalho certo e amostra em 16 bits', () => {
  const w = m.wav16([new Float32Array([0, 1, -1]), new Float32Array([0.5, 0, 0])], 48000)
  assert.equal(w.toString('ascii', 0, 4), 'RIFF')
  assert.equal(w.readUInt16LE(22), 2)
  assert.equal(w.readUInt32LE(40), 12)
  assert.equal(w.readInt16LE(46), Math.round(0.5 * 32767))
  assert.equal(w.readInt16LE(48), 32767)
})
