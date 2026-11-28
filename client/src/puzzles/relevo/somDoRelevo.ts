import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'

/**
 * OS SONS DO PAINEL EM RELEVO (28/11), sintetizados no mesmo Web Audio dos
 * sons de clima e do combate (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   encaixe    a placa de metal assenta: o toque seco, o baque do peso e o
 *              zunido curto do metal (parciais desafinados, como de sino)
 *   nao        a placa raspa na borda e não entra: grave e abafado
 *   completo   a última placa: a tranca cede (baque grave e o estalo da
 *              lingueta) e o painel inteiro ressoa por um segundo
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de
 * um gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDoRelevo = 'encaixe' | 'nao' | 'completo'

/** A nota do metal das placas: Dó 5 baixo, longe dos sinos de item (Sol 3 e Ré 4). */
const METAL_HZ = 523

export const RECEITAS_DO_RELEVO: Readonly<Record<SomDoRelevo, readonly Voz[]>> = {
  encaixe: [
    { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.03, pico: 0.12, filtro: { tipo: 'bandpass', hz: 3400, q: 3 } },
    { fonte: 'osc', forma: 'sine', hzIni: 150, hzFim: 78, inicio: 0, ataque: 0.002, duracao: 0.1, pico: 0.1 },
    { fonte: 'osc', forma: 'triangle', hzIni: METAL_HZ, hzFim: METAL_HZ * 0.985, inicio: 0.004, ataque: 0.002, duracao: 0.34, pico: 0.06, filtro: { tipo: 'lowpass', hz: 3000 } },
    { fonte: 'osc', forma: 'sine', hzIni: METAL_HZ * 2.76, inicio: 0.004, ataque: 0.002, duracao: 0.22, pico: 0.03 },
    { fonte: 'osc', forma: 'sine', hzIni: METAL_HZ * 5.4, inicio: 0.004, ataque: 0.001, duracao: 0.1, pico: 0.016 },
  ],
  nao: [
    { fonte: 'ruido', inicio: 0, ataque: 0.004, duracao: 0.09, pico: 0.08, filtro: { tipo: 'lowpass', hz: 900 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 200, hzFim: 160, inicio: 0, ataque: 0.003, duracao: 0.11, pico: 0.05, filtro: { tipo: 'lowpass', hz: 1200 } },
  ],
  completo: [
    { fonte: 'osc', forma: 'sine', hzIni: 96, hzFim: 48, inicio: 0, ataque: 0.003, duracao: 0.28, pico: 0.12 },
    { fonte: 'ruido', inicio: 0.01, ataque: 0.001, duracao: 0.03, pico: 0.09, filtro: { tipo: 'bandpass', hz: 2200, q: 4 } },
    { fonte: 'osc', forma: 'sine', hzIni: 392, inicio: 0.06, ataque: 0.004, duracao: 1.2, pico: 0.05 },
    { fonte: 'osc', forma: 'sine', hzIni: 392 * 2.76, inicio: 0.06, ataque: 0.003, duracao: 0.7, pico: 0.018 },
    { fonte: 'osc', forma: 'sine', hzIni: 587.33, inicio: 0.14, ataque: 0.004, duracao: 1.1, pico: 0.04 },
    { fonte: 'osc', forma: 'sine', hzIni: 784, inicio: 0.22, ataque: 0.004, duracao: 1.0, pico: 0.03 },
  ],
}

/** O mesmo som não repete antes disto (duas placas na mesma vista, a rede repetindo). */
const INTERVALO_MS = 70
const ultimoToque = new Map<SomDoRelevo, number>()

/** Toca um som do painel agora. Devolve se tocou. */
export function tocarSomDoRelevo(id: SomDoRelevo): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DO_RELEVO[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
