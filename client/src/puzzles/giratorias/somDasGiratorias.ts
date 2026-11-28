import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'

/**
 * OS SONS DAS PEÇAS GIRATÓRIAS (28/11), sintetizados no mesmo Web Audio do
 * painel em relevo (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   giro     o anel arrasta na pedra (um raspão curto) e cai no dente da
 *            catraca: o estalo seco e o baque surdo do peso
 *   alinhou  o último anel no lugar: a trava solta (baque grave e estalo) e o
 *            medalhão inteiro ressoa num acorde aberto, por pouco mais de 1 s
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDasGiratorias = 'giro' | 'alinhou'

export const RECEITAS_DAS_GIRATORIAS: Readonly<Record<SomDasGiratorias, readonly Voz[]>> = {
  giro: [
    { fonte: 'ruido', inicio: 0, ataque: 0.012, duracao: 0.08, pico: 0.05, filtro: { tipo: 'bandpass', hz: 760, q: 1.4 } },
    { fonte: 'ruido', inicio: 0.075, ataque: 0.001, duracao: 0.02, pico: 0.1, filtro: { tipo: 'bandpass', hz: 3100, q: 5 } },
    { fonte: 'osc', forma: 'sine', hzIni: 132, hzFim: 70, inicio: 0.075, ataque: 0.002, duracao: 0.09, pico: 0.08 },
    { fonte: 'osc', forma: 'triangle', hzIni: 880, hzFim: 860, inicio: 0.077, ataque: 0.001, duracao: 0.07, pico: 0.014, filtro: { tipo: 'lowpass', hz: 2400 } },
  ],
  alinhou: [
    { fonte: 'osc', forma: 'sine', hzIni: 88, hzFim: 44, inicio: 0, ataque: 0.003, duracao: 0.32, pico: 0.13 },
    { fonte: 'ruido', inicio: 0.012, ataque: 0.001, duracao: 0.03, pico: 0.09, filtro: { tipo: 'bandpass', hz: 2000, q: 4 } },
    { fonte: 'osc', forma: 'sine', hzIni: 330, inicio: 0.07, ataque: 0.005, duracao: 1.3, pico: 0.045 },
    { fonte: 'osc', forma: 'sine', hzIni: 330 * 2.76, inicio: 0.07, ataque: 0.003, duracao: 0.6, pico: 0.014 },
    { fonte: 'osc', forma: 'sine', hzIni: 495, inicio: 0.16, ataque: 0.005, duracao: 1.15, pico: 0.035 },
    { fonte: 'osc', forma: 'sine', hzIni: 660, inicio: 0.25, ataque: 0.005, duracao: 1.05, pico: 0.028 },
  ],
}

/** O mesmo som não repete antes disto (dois anéis na mesma vista, a rede repetindo). */
const INTERVALO_MS = 60
const ultimoToque = new Map<SomDasGiratorias, number>()

/** Toca um som do medalhão agora. Devolve se tocou. */
export function tocarSomDasGiratorias(id: SomDasGiratorias): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DAS_GIRATORIAS[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
