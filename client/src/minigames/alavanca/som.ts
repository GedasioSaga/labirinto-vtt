/**
 * O SOM DA ALAVANCA DA PONTE, sintetizado (Web Audio): o bloco SOM do
 * protótipo aprovado (`docs/design/minigames/alavanca-da-ponte.html`), com os
 * mesmos timbres, ganhos e tempos. As provas mediram este som renderizado
 * offline (`provas-alavanca/som/medidas.json`): pico, cortes, cliques e LUFS.
 */

/** s da ponte voltando a subir quando o tempo acaba. */
export const QUEDA = 0.65
/** s de "Prontos…" antes do "Já!". */
export const CONTAGEM = 0.8
/** Ganho geral: a rodada fica perto dos -19 LUFS do tiro. */
export const VOLUME = 0.85

export interface CadeiaDeSom {
  ctx: BaseAudioContext
  mestre: GainNode
  mec: StereoPannerNode
  ponte: StereoPannerNode
  centro: StereoPannerNode
  rangido: { g: GainNode; f1: AudioParam; f2: AudioParam; filtro: AudioParam }
  corrente: { g: GainNode }
}

export type EventoDeSom = 'dente' | 'volta' | 'giro' | 'soltou' | 'pegou' | 'prontos' | 'ja' | 'relogio'

interface Tom {
  f: number
  f2?: number
  varre?: number
  ganho: number
  ataque?: number
  dur: number
  tipo?: OscillatorType
}

interface Chiado {
  f: number
  q?: number
  filtro?: BiquadFilterType
  ganho: number
  ataque?: number
  dur: number
}

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>()

function ruido(ctx: BaseAudioContext): AudioBuffer {
  const pronto = ruidos.get(ctx)
  if (pronto !== undefined) return pronto
  const n = ctx.sampleRate * 2
  const b = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = b.getChannelData(0)
  let s = 20261120
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    d[i] = ((s >>> 8) / 16777216) * 2 - 1
  }
  ruidos.set(ctx, b)
  return b
}

function env(g: GainNode, quando: number, pico: number, ataque: number, queda: number): void {
  g.gain.setValueAtTime(0, quando)
  g.gain.linearRampToValueAtTime(pico, quando + ataque)
  g.gain.setTargetAtTime(0, quando + ataque, queda / 4)
}

function tom(C: CadeiaDeSom, destino: AudioNode, quando: number, o: Tom): void {
  const osc = C.ctx.createOscillator()
  const g = C.ctx.createGain()
  osc.type = o.tipo ?? 'sine'
  osc.frequency.setValueAtTime(o.f, quando)
  if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(o.f2, quando + (o.varre ?? o.dur))
  env(g, quando, o.ganho, o.ataque ?? 0.004, o.dur)
  osc.connect(g)
  g.connect(destino)
  osc.start(quando)
  osc.stop(quando + o.dur * 1.6 + 0.05)
}

function chiado(C: CadeiaDeSom, destino: AudioNode, quando: number, o: Chiado): void {
  const src = C.ctx.createBufferSource()
  const f = C.ctx.createBiquadFilter()
  const g = C.ctx.createGain()
  src.buffer = ruido(C.ctx)
  f.type = o.filtro ?? 'bandpass'
  f.frequency.value = o.f
  f.Q.value = o.q ?? 1
  env(g, quando, o.ganho, o.ataque ?? 0.002, o.dur)
  src.connect(f)
  f.connect(g)
  g.connect(destino)
  const off = (quando * 7.919) % 1.7
  src.start(quando, off)
  src.stop(quando + o.dur * 1.6 + 0.05)
}

/** A cadeia inteira: mestre, compressor, os três lados do palco e os sons contínuos (rangido, corrente, fundo). */
export function cadeia(ctx: BaseAudioContext, destino: AudioNode, inicio = 0): CadeiaDeSom {
  const mestre = ctx.createGain()
  mestre.gain.value = VOLUME
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 8
  comp.ratio.value = 6
  comp.attack.value = 0.003
  comp.release.value = 0.15
  mestre.connect(comp)
  comp.connect(destino)
  const pan = (v: number) => {
    const p = ctx.createStereoPanner()
    p.pan.value = v
    p.connect(mestre)
    return p
  }
  const mec = pan(-0.3)
  const ponte = pan(0.12)
  const centro = pan(0)
  // rangido: madeira e eixo; sobe de tom com a tensão da corrente
  const r1 = ctx.createOscillator()
  const r2 = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  r1.type = 'sawtooth'
  r2.type = 'sawtooth'
  r1.frequency.value = 92
  r2.frequency.value = 139
  lfo.frequency.value = 6.3
  lfoG.gain.value = 11
  lfo.connect(lfoG)
  lfoG.connect(r1.frequency)
  lfoG.connect(r2.frequency)
  const rf = ctx.createBiquadFilter()
  rf.type = 'bandpass'
  rf.frequency.value = 760
  rf.Q.value = 4
  const rg = ctx.createGain()
  rg.gain.value = 0
  r1.connect(rf)
  r2.connect(rf)
  rf.connect(rg)
  rg.connect(mec)
  r1.start(inicio)
  r2.start(inicio)
  lfo.start(inicio)
  // corrente correndo: chiado metálico com tremor, quando a catraca solta
  const cs = ctx.createBufferSource()
  cs.buffer = ruido(ctx)
  cs.loop = true
  const cf = ctx.createBiquadFilter()
  cf.type = 'bandpass'
  cf.frequency.value = 1650
  cf.Q.value = 1.3
  const trem = ctx.createGain()
  trem.gain.value = 0.55
  const tl = ctx.createOscillator()
  const tlG = ctx.createGain()
  tl.frequency.value = 23
  tlG.gain.value = 0.45
  tl.connect(tlG)
  tlG.connect(trem.gain)
  const cg = ctx.createGain()
  cg.gain.value = 0
  cs.connect(cf)
  cf.connect(trem)
  trem.connect(cg)
  cg.connect(ponte)
  cs.start(inicio)
  tl.start(inicio)
  // fundo: água do fosso e vento, bem baixo, para o silêncio não ser buraco
  const as = ctx.createBufferSource()
  as.buffer = ruido(ctx)
  as.loop = true
  as.playbackRate.value = 0.5
  const af = ctx.createBiquadFilter()
  af.type = 'lowpass'
  af.frequency.value = 380
  af.Q.value = 0.5
  const ag = ctx.createGain()
  ag.gain.value = 0.07
  as.connect(af)
  af.connect(ag)
  ag.connect(centro)
  as.start(inicio)
  return {
    ctx,
    mestre,
    mec,
    ponte,
    centro,
    rangido: { g: rg, f1: r1.frequency, f2: r2.frequency, filtro: rf.frequency },
    corrente: { g: cg },
  }
}

/** Parâmetros contínuos: velocidade da ponte (fração/s), tensão 0..1, catraca solta 0..1. */
export function continuo(C: CadeiaDeSom, quando: number, vel: number, tensao: number, solta: number): void {
  const mov = Math.min(1, Math.abs(vel) / 0.3)
  C.rangido.g.gain.setTargetAtTime(0.22 * mov, quando, 0.03)
  C.rangido.f1.setTargetAtTime(88 + 64 * tensao, quando, 0.08)
  C.rangido.f2.setTargetAtTime(133 + 96 * tensao, quando, 0.08)
  C.rangido.filtro.setTargetAtTime(700 + 560 * tensao, quando, 0.08)
  C.corrente.g.gain.setTargetAtTime(0.5 * solta * Math.min(1, Math.max(0, -vel) / 0.12), quando, 0.03)
}

export function evento(C: CadeiaDeSom, nome: EventoDeSom, quando: number): void {
  switch (nome) {
    case 'dente': // a lingueta cai no próximo dente: o clique da catraca
      chiado(C, C.mec, quando, { f: 2900, q: 4, ganho: 0.85, ataque: 0.0015, dur: 0.035 })
      tom(C, C.mec, quando, { f: 1870, ganho: 0.12, ataque: 0.0015, dur: 0.03 })
      break
    case 'volta': // a catraca solta: os dentes passam por baixo da lingueta
      chiado(C, C.ponte, quando, { f: 1300, q: 5, ganho: 0.42, ataque: 0.002, dur: 0.03 })
      break
    case 'giro': // a mão empurra a manivela: um baque surdo de madeira
      tom(C, C.mec, quando, { f: 190, f2: 120, varre: 0.06, ganho: 0.3, ataque: 0.004, dur: 0.08 })
      break
    case 'soltou': // a lingueta escapa: estalo metálico de aviso
      tom(C, C.mec, quando, { f: 880, f2: 610, varre: 0.12, ganho: 0.3, ataque: 0.002, dur: 0.14, tipo: 'triangle' })
      chiado(C, C.mec, quando, { f: 2200, q: 2, ganho: 0.3, ataque: 0.002, dur: 0.08 })
      break
    case 'pegou':
      tom(C, C.mec, quando, { f: 1400, ganho: 0.18, ataque: 0.002, dur: 0.05, tipo: 'triangle' })
      break
    case 'prontos':
      tom(C, C.centro, quando, { f: 660, ganho: 0.22, ataque: 0.004, dur: 0.12 })
      break
    case 'ja':
      tom(C, C.centro, quando, { f: 990, ganho: 0.26, ataque: 0.004, dur: 0.2 })
      tom(C, C.centro, quando, { f: 1485, ganho: 0.1, ataque: 0.004, dur: 0.16 })
      break
    case 'relogio': // os últimos 3 segundos
      tom(C, C.centro, quando, { f: 1180, ganho: 0.16, ataque: 0.003, dur: 0.05, tipo: 'triangle' })
      break
  }
}

/** O fim: a ponte assenta (baixou) ou volta a subir e bate no portão (subiu). */
export function final(C: CadeiaDeSom, quando: number, tipo: 'baixou' | 'subiu'): void {
  const at = tipo === 'subiu' ? quando + QUEDA : quando
  if (tipo === 'subiu') {
    C.corrente.g.gain.setTargetAtTime(0.55, quando, 0.03)
    C.corrente.g.gain.setTargetAtTime(0, at, 0.05)
    C.rangido.g.gain.setTargetAtTime(0.18, quando, 0.05)
    C.rangido.g.gain.setTargetAtTime(0, at, 0.05)
  } else {
    C.rangido.g.gain.setTargetAtTime(0, quando, 0.04)
    C.corrente.g.gain.setTargetAtTime(0, quando, 0.04)
  }
  tom(C, C.ponte, at, { f: 96, f2: 40, varre: 0.35, ganho: 0.8, ataque: 0.004, dur: 0.6 })
  chiado(C, C.ponte, at, { f: 320, q: 0.7, filtro: 'lowpass', ganho: 0.6, ataque: 0.003, dur: 0.3 })
  tom(C, C.ponte, at, { f: 232, f2: 180, varre: 0.08, ganho: 0.3, ataque: 0.003, dur: 0.12 })
  if (tipo === 'subiu') {
    // ferro batendo no portão
    const parciais: readonly (readonly [number, number, number])[] = [
      [420, 0.24, 0.9],
      [1013, 0.14, 0.7],
      [1567, 0.09, 0.5],
      [2210, 0.05, 0.4],
    ]
    for (const [f, gn, d] of parciais) tom(C, C.ponte, at, { f, ganho: gn, ataque: 0.002, dur: d, tipo: 'sine' })
  } else {
    // poeira assentando
    chiado(C, C.ponte, at + 0.02, { f: 3200, q: 0.6, filtro: 'highpass', ganho: 0.08, ataque: 0.04, dur: 0.7 })
    tom(C, C.mec, at + 0.12, { f: 1400, ganho: 0.16, ataque: 0.002, dur: 0.06, tipo: 'triangle' }) // a trava da catraca
  }
}
