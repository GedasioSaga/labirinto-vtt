/**
 * O SOM DA ALAVANCA DA PONTE, sintetizado (Web Audio): o bloco SOM do
 * protótipo aprovado (`docs/design/minigames/alavanca-da-ponte.html`), com os
 * mesmos timbres, ganhos e tempos. As provas mediram este som renderizado
 * offline (`provas-alavanca/som/medidas.json`): pico, cortes, cliques e LUFS.
 * O canhão do chão tem a voz dele sobre o mesmo mecanismo (protótipo de
 * 20/11/2026, `provas-canhao/som/medidas.json`): rangido mais grave, a pedra
 * raspando no poço, as folhas do alçapão e o clangor da trava no topo.
 */
import type { CenaAlavanca } from './tipos'

/** s da ponte voltando a subir quando o tempo acaba. */
export const QUEDA = 0.65
/** s de "Prontos…" antes do "Já!". */
export const CONTAGEM = 0.8
/** Ganho geral: a rodada fica perto dos -19 LUFS do tiro. */
export const VOLUME = 0.85
/** Canhão: as folhas do alçapão terminam de abrir aqui (fração da subida). */
export const FOLHAS = 0.2

/** A voz de cada cena: a ponte range madeira; o canhão range mais grave e a plataforma de pedra raspa nas paredes do poço. */
interface PerfilDeSom {
  f1: number
  f2: number
  filtro: number
  rangido: number
  raspa: number
}

const PERFIS: Readonly<Record<CenaAlavanca, PerfilDeSom>> = {
  ponte: { f1: 88, f2: 133, filtro: 700, rangido: 0.22, raspa: 0 },
  canhao: { f1: 62, f2: 95, filtro: 470, rangido: 0.15, raspa: 0.34 },
}

export interface CadeiaDeSom {
  ctx: BaseAudioContext
  mestre: GainNode
  mec: StereoPannerNode
  ponte: StereoPannerNode
  centro: StereoPannerNode
  rangido: { g: GainNode; f1: AudioParam; f2: AudioParam; filtro: AudioParam }
  corrente: { g: GainNode }
  /** A pedra raspando nas paredes do poço (muda na ponte). */
  raspa: GainNode
  cena: CenaAlavanca
  perfil: PerfilDeSom
}

/** Eventos que só a cena do canhão tem, tirados da posição: as folhas batem abertas, e o alçapão fecha. */
export type EventoDaCena = 'folhasBatem' | 'alcapaoFecha'

export type EventoDeSom = 'dente' | 'volta' | 'giro' | 'soltou' | 'pegou' | 'prontos' | 'ja' | 'relogio' | EventoDaCena

/** O detector dos eventos da cena: recebe a posição a cada quadro e devolve o que aconteceu nele. Na ponte, nunca nada. */
export function criarDetector(cena: CenaAlavanca): (p: number) => EventoDaCena[] {
  let aberto = false
  let longe = false
  return (p) => {
    const ev: EventoDaCena[] = []
    if (cena !== 'canhao') return ev
    if (!aberto && p >= FOLHAS) {
      aberto = true
      ev.push('folhasBatem')
    } else if (aberto && p < FOLHAS - 0.03) aberto = false
    if (p >= 0.05) longe = true
    else if (longe && p < 0.015) {
      longe = false
      ev.push('alcapaoFecha')
    }
    return ev
  }
}

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

/** A cadeia inteira: mestre, compressor, os três lados do palco e os sons contínuos (rangido, corrente, fundo, pedra). */
export function cadeia(ctx: BaseAudioContext, destino: AudioNode, inicio = 0, cena: CenaAlavanca = 'ponte'): CadeiaDeSom {
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
  // pedra raspando nas paredes do poço: ruído grave, só quando a plataforma anda (mudo na ponte)
  const rs = ctx.createBufferSource()
  rs.buffer = ruido(ctx)
  rs.loop = true
  rs.playbackRate.value = 0.7
  const rsf = ctx.createBiquadFilter()
  rsf.type = 'bandpass'
  rsf.frequency.value = 240
  rsf.Q.value = 0.9
  const rsg = ctx.createGain()
  rsg.gain.value = 0
  rs.connect(rsf)
  rsf.connect(rsg)
  rsg.connect(ponte)
  rs.start(inicio)
  return {
    ctx,
    mestre,
    mec,
    ponte,
    centro,
    rangido: { g: rg, f1: r1.frequency, f2: r2.frequency, filtro: rf.frequency },
    corrente: { g: cg },
    raspa: rsg,
    cena,
    perfil: PERFIS[cena],
  }
}

/** Parâmetros contínuos: velocidade da ponte (fração/s), tensão 0..1, catraca solta 0..1. */
export function continuo(C: CadeiaDeSom, quando: number, vel: number, tensao: number, solta: number): void {
  const mov = Math.min(1, Math.abs(vel) / 0.3)
  const P = C.perfil
  C.rangido.g.gain.setTargetAtTime(P.rangido * mov, quando, 0.03)
  C.rangido.f1.setTargetAtTime(P.f1 + 64 * tensao, quando, 0.08)
  C.rangido.f2.setTargetAtTime(P.f2 + 96 * tensao, quando, 0.08)
  C.rangido.filtro.setTargetAtTime(P.filtro + 560 * tensao, quando, 0.08)
  C.corrente.g.gain.setTargetAtTime(0.5 * solta * Math.min(1, Math.max(0, -vel) / 0.12), quando, 0.03)
  C.raspa.gain.setTargetAtTime(P.raspa * mov, quando, 0.04)
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
    case 'folhasBatem': // canhão: as duas folhas do alçapão caem abertas nas lajes, uma logo depois da outra
      tom(C, C.ponte, quando, { f: 150, f2: 92, varre: 0.1, ganho: 0.42, ataque: 0.003, dur: 0.16 })
      chiado(C, C.ponte, quando, { f: 650, q: 0.7, filtro: 'lowpass', ganho: 0.32, ataque: 0.003, dur: 0.14 })
      tom(C, C.ponte, quando + 0.06, { f: 138, f2: 88, varre: 0.1, ganho: 0.34, ataque: 0.003, dur: 0.14 })
      break
    case 'alcapaoFecha': // canhão: as folhas voltam e batem fechadas
      tom(C, C.ponte, quando, { f: 128, f2: 80, varre: 0.12, ganho: 0.45, ataque: 0.003, dur: 0.2 })
      chiado(C, C.ponte, quando, { f: 520, q: 0.7, filtro: 'lowpass', ganho: 0.34, ataque: 0.003, dur: 0.18 })
      break
  }
}

/** Os parciais do clangor do ferrolho e do bronze do cano (frequência, ganho, duração). */
const CLANGOR: readonly (readonly [number, number, number])[] = [
  [523, 0.2, 1.1],
  [1290, 0.12, 0.8],
  [2140, 0.07, 0.55],
  [3010, 0.04, 0.4],
]
const BRONZE_RESSOA: readonly (readonly [number, number])[] = [
  [196, 0.1],
  [466, 0.05],
  [755, 0.03],
]
/** Os cliques do cano baixando até a ameia, em s depois da trava (os mesmos dentes do desenho). */
export const DENTES_DO_CANO: readonly number[] = [0.14, 0.24, 0.34, 0.44]

/** O fim do canhão: trava no topo com um clangor e baixa o cano até a ameia (baixou), ou despenca no poço (subiu). */
function finalCanhao(C: CadeiaDeSom, quando: number, tipo: 'baixou' | 'subiu'): void {
  const at = tipo === 'subiu' ? quando + QUEDA : quando
  if (tipo === 'subiu') {
    C.corrente.g.gain.setTargetAtTime(0.55, quando, 0.03)
    C.corrente.g.gain.setTargetAtTime(0, at, 0.05)
    C.raspa.gain.setTargetAtTime(0.34, quando, 0.04)
    C.raspa.gain.setTargetAtTime(0, at, 0.05)
    C.rangido.g.gain.setTargetAtTime(0.14, quando, 0.05)
    C.rangido.g.gain.setTargetAtTime(0, at, 0.05)
    tom(C, C.ponte, at, { f: 72, f2: 36, varre: 0.4, ganho: 0.8, ataque: 0.004, dur: 0.75 }) // a plataforma bate no fundo
    chiado(C, C.ponte, at, { f: 220, q: 0.7, filtro: 'lowpass', ganho: 0.55, ataque: 0.004, dur: 0.4 })
    evento(C, 'alcapaoFecha', at + 0.09)
    return
  }
  C.rangido.g.gain.setTargetAtTime(0, quando, 0.04)
  C.corrente.g.gain.setTargetAtTime(0, quando, 0.04)
  C.raspa.gain.setTargetAtTime(0, quando, 0.04)
  tom(C, C.ponte, at, { f: 88, f2: 48, varre: 0.25, ganho: 0.6, ataque: 0.004, dur: 0.45 }) // a pedra assenta
  chiado(C, C.ponte, at, { f: 300, q: 0.7, filtro: 'lowpass', ganho: 0.4, ataque: 0.003, dur: 0.22 })
  chiado(C, C.mec, at, { f: 3400, q: 3, ganho: 0.35, ataque: 0.0015, dur: 0.05 }) // o ferrolho entra
  for (const [f, gn, d] of CLANGOR) tom(C, C.ponte, at, { f, ganho: gn, ataque: 0.002, dur: d }) // o clangor
  for (const [f, gn] of BRONZE_RESSOA) tom(C, C.ponte, at + 0.02, { f, ganho: gn, ataque: 0.004, dur: 1.4 }) // o bronze do cano ressoa
  for (const dente of DENTES_DO_CANO) chiado(C, C.mec, at + dente, { f: 2500, q: 4, ganho: 0.4, ataque: 0.0015, dur: 0.03 }) // o cano baixa dente a dente
  tom(C, C.mec, at + 0.56, { f: 1400, ganho: 0.16, ataque: 0.002, dur: 0.06, tipo: 'triangle' })
}

/** O fim: a ponte assenta (baixou) ou volta a subir e bate no portão (subiu). O canhão tem o dele. */
export function final(C: CadeiaDeSom, quando: number, tipo: 'baixou' | 'subiu'): void {
  if (C.cena === 'canhao') {
    finalCanhao(C, quando, tipo)
    return
  }
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
