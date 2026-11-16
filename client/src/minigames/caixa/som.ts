/**
 * SOM DA CAIXA: o rangido de tensão que sobe com a força, o estalo do racha,
 * o range curto do tranco fraco, o raspão e o clank do escorregão, a tábua
 * quebrando e caindo com pregos tilintando e o tom do tempo esgotado. Tudo
 * sintetizado com as peças de abrir/som.ts; todo ganho de saída nasce em 0.
 */
import { QUASE_ZERO, filtro, osc, rajada, tom, vca } from '../abrir/som'
import type { Evento, PassoDaSequencia } from '../abrir/tipos'
import { DIF, DURACAO_ABRIR, INTERVALO_TENSAO, forcaNoTempo } from './sim'
import type { NomeDoEvento } from './sim'

/**
 * Ganho do barramento de efeitos da caixa (os sons saem baixos, como os da pesca). 1,6 e não
 * 1,7: com 1,7 a pior de 8 partidas do robô (o último racha somado ao som de abrir) ficava a
 * só 0,15 dB do teto de −1 dBTP (medido no Edge offline em 15/11/2026).
 */
export const GANHO = 1.6

/** Um som da caixa; `v` é a força (tensão) ou o estágio (racha); os outros ignoram. */
export type SomDaCaixa = (ctx: BaseAudioContext, out: AudioNode, t: number, v?: number) => void

const lim01 = (k: number): number => Math.min(1, Math.max(0, k))

/** Ataque exponencial, platô que cai devagar e queda exponencial: som com corpo, sem estalo no começo. */
function envelopeLongo(p: AudioParam, t: number, pico: number, ataque: number, plato: number, queda: number): void {
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(pico, t + ataque)
  p.linearRampToValueAtTime(pico * 0.6, t + ataque + plato)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + ataque + plato + queda)
}

/**
 * Rangido de tensão: dente de serra lento (os solavancos da fibra) num
 * passa-banda. Com a força, os solavancos aceleram e a banda sobe: a madeira
 * "afina" antes de ceder. Sai um a cada INTERVALO_TENSAO s enquanto segura.
 */
export function tensao(ctx: BaseAudioContext, out: AudioNode, t: number, v = 0): void {
  const f = lim01(v)
  const pulsos = 55 + 85 * f
  const o = osc(ctx, 'sawtooth', pulsos)
  const banda = filtro(ctx, 'bandpass', 520 + 760 * f, 3)
  const g = vca(ctx)
  // Medido no Edge (15/11/2026): pico da voz 0,19 com força 0 e 0,40 com força 1, antes do GANHO.
  envelopeLongo(g.gain, t, 0.5 + 0.47 * f, 0.012, 0.05, 0.035)
  o.frequency.setValueAtTime(pulsos, t)
  o.frequency.linearRampToValueAtTime(pulsos * 1.08, t + 0.09)
  o.connect(banda).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.13)
}

/** Racha: estalo seco, a madeira abrindo e um baque surdo, mais forte a cada estágio (v = 1..3). */
export function racha(ctx: BaseAudioContext, out: AudioNode, t: number, v = 1): void {
  const k = lim01((v - 1) / 2)
  rajada(ctx, out, 'highpass', 2400, 0.7, t, 0.16 + 0.06 * k, 0.001, 0.035)
  // Escalonado em 12 e 20 ms: as três vozes não somam o pico no mesmo instante.
  const madeira = rajada(ctx, out, 'bandpass', 1500, 2.5, t + 0.012, 0.7 + 0.35 * k, 0.002, 0.14 + 0.06 * k)
  madeira.frequency.setValueAtTime(1500, t + 0.012)
  madeira.frequency.exponentialRampToValueAtTime(700, t + 0.2)
  const baque = tom(ctx, out, 'sine', 120, t + 0.02, 0.17 + 0.06 * k, 0.004, 0.2)
  baque.frequency.setValueAtTime(120, t + 0.02)
  baque.frequency.exponentialRampToValueAtTime(48, t + 0.22)
}

/** Tranco fraco: range curto e baixo, a tábua nem se mexe. */
export function fraco(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = osc(ctx, 'sawtooth', 42)
  const banda = filtro(ctx, 'bandpass', 360, 2.5)
  const g = vca(ctx)
  // 0,85 (era 1,0): o pico da voz passava de 0,45 antes do GANHO.
  envelopeLongo(g.gain, t, 0.85, 0.025, 0.08, 0.14)
  o.frequency.setValueAtTime(42, t)
  o.frequency.exponentialRampToValueAtTime(30, t + 0.24)
  o.connect(banda).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.28)
}

/** Escorregão: raspão metálico que desce e, logo depois, o clank do ferro (parciais fora da série harmônica). */
export function escorregou(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const raspao = rajada(ctx, out, 'bandpass', 4200, 6, t, 0.9, 0.006, 0.16)
  raspao.frequency.setValueAtTime(4200, t)
  raspao.frequency.exponentialRampToValueAtTime(1900, t + 0.16)
  tom(ctx, out, 'triangle', 830, t + 0.15, 0.16, 0.002, 0.3)
  tom(ctx, out, 'sine', 1385, t + 0.15, 0.09, 0.002, 0.24)
  tom(ctx, out, 'sine', 2210, t + 0.15, 0.05, 0.002, 0.16)
}

/** Pregos tilintando ao saltar da tábua: [atraso em s, frequência em Hz]. */
const PREGOS: readonly (readonly [number, number])[] = [[0.2, 2637], [0.29, 3136], [0.41, 3520]]
/** Lascas estalando enquanto a tábua cede: [atraso em s, pico]. */
const LASCAS: readonly (readonly [number, number])[] = [[0.11, 0.1], [0.16, 0.08], [0.23, 0.07]]
/** Razão do segundo parcial de um prego (barra de metal: fora da série harmônica). */
const PARCIAL_DO_PREGO = 2.76

/**
 * Abriu: a tábua cede (sai 80 ms depois do estalo do terceiro racha, que toca
 * no mesmo instante), lascas, pregos tilintando e o baque da tábua no chão no
 * fim da queda.
 */
export function abriu(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const cede = rajada(ctx, out, 'lowpass', 2200, 0.8, t + 0.08, 0.55, 0.01, 0.32)
  cede.frequency.setValueAtTime(2200, t + 0.08)
  cede.frequency.exponentialRampToValueAtTime(500, t + 0.4)
  for (const [d, pico] of LASCAS) rajada(ctx, out, 'highpass', 3000, 0.7, t + d, pico, 0.001, 0.02)
  for (const [d, f] of PREGOS) {
    tom(ctx, out, 'sine', f, t + d, 0.09, 0.002, 0.25)
    tom(ctx, out, 'sine', f * PARCIAL_DO_PREGO, t + d, 0.03, 0.002, 0.12)
  }
  const chao = t + DURACAO_ABRIR
  const baque = tom(ctx, out, 'sine', 96, chao, 0.24, 0.004, 0.22)
  baque.frequency.setValueAtTime(96, chao)
  baque.frequency.exponentialRampToValueAtTime(44, chao + 0.22)
  rajada(ctx, out, 'lowpass', 700, 0.8, chao, 0.6, 0.003, 0.15)
}

/** Tempo esgotado: tom que desce uma oitava, com a oitava de baixo abafada por baixo. */
export function tempoEsgotado(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = osc(ctx, 'triangle', 392)
  const g = vca(ctx)
  envelopeLongo(g.gain, t, 0.3, 0.03, 0.42, 0.35)
  o.frequency.setValueAtTime(392, t)
  o.frequency.exponentialRampToValueAtTime(196, t + 0.7)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.83)
  const baixo = tom(ctx, out, 'square', 196, t, 0.05, 0.03, 0.7, 900)
  baixo.frequency.setValueAtTime(196, t)
  baixo.frequency.exponentialRampToValueAtTime(98, t + 0.7)
}

/** Um som por nome de evento da caixa. */
export const SONS: Readonly<Record<NomeDoEvento, SomDaCaixa>> = {
  tensao, racha, fraco, escorregou, abriu, tempo: tempoEsgotado,
}

const PELO_NOME = new Map<string, SomDaCaixa>(Object.entries(SONS))

/** Toca o som de um evento em `t` (s do relógio do contexto); nome sem som não toca nada. */
export function tocar(ctx: BaseAudioContext, out: AudioNode, ev: Readonly<Evento>, t: number): void {
  const som = PELO_NOME.get(ev.nome)
  if (som !== undefined) som(ctx, out, t, ev.v)
}

/** Rangidos de uma puxada de `segura` s a partir de `inicio`, com a força da curva do Normal. */
function puxada(seq: PassoDaSequencia[], inicio: number, segura: number): void {
  for (let s = 0; s < segura - 1e-9; s += INTERVALO_TENSAO) seq.push([inicio + s, { nome: 'tensao', v: forcaNoTempo(s, DIF.normal) }])
}

/** Uma partida comprimida: fraco, racha, escorregão, racha, racha e abriu; e o tempo esgotado no fim. */
function montarSequencia(): PassoDaSequencia[] {
  const seq: PassoDaSequencia[] = []
  puxada(seq, 0.1, 0.5)
  seq.push([0.6, { nome: 'fraco' }])
  puxada(seq, 0.95, 1.1)
  seq.push([2.05, { nome: 'racha', v: 1 }])
  puxada(seq, 2.4, 1.35)
  seq.push([3.75, { nome: 'escorregou' }])
  puxada(seq, 4.2, 1.1)
  seq.push([5.3, { nome: 'racha', v: 2 }])
  puxada(seq, 5.65, 1.15)
  seq.push([6.8, { nome: 'racha', v: 3 }], [6.8, { nome: 'abriu' }])
  seq.push([7.5, { nome: 'tempo' }])
  return seq
}

/** Sequência de prova com todos os sons da caixa, como numa partida. */
export const SEQUENCIA: readonly PassoDaSequencia[] = montarSequencia()
/** Duração da sequência, em s: o último som (tempo, 0,83 s) acaba antes. */
export const DURACAO_SEQUENCIA = 8.4
