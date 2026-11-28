import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'
import type { MaterialDasDeslizantes } from '../tipos'

/**
 * OS SONS DAS PEÇAS DESLIZANTES (28/11), sintetizados no mesmo Web Audio dos
 * outros puzzles (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   desliza  a peça corre no sulco: o raspão abafado (madeira) ou o chiado fino
 *            (bronze) que sobe e para, e o toque surdo de quando assenta
 *   presa    a peça que não tem para onde ir: um toque seco, sem eco
 *   acerto   o tabuleiro cede: a última peça assenta, a trava solta embaixo e
 *            um acorde quente sobe, por pouco mais de 1 s
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDasDeslizantes = 'desliza' | 'presa' | 'acerto'

const ACORDE: readonly Voz[] = [
  { fonte: 'osc', forma: 'sine', hzIni: 70, hzFim: 42, inicio: 0, ataque: 0.003, duracao: 0.3, pico: 0.12 },
  { fonte: 'ruido', inicio: 0.01, ataque: 0.001, duracao: 0.03, pico: 0.07, filtro: { tipo: 'bandpass', hz: 1800, q: 3 } },
  { fonte: 'osc', forma: 'sine', hzIni: 349.23, inicio: 0.12, ataque: 0.008, duracao: 1.2, pico: 0.038 },
  { fonte: 'osc', forma: 'sine', hzIni: 440, inicio: 0.2, ataque: 0.008, duracao: 1.1, pico: 0.03 },
  { fonte: 'osc', forma: 'sine', hzIni: 523.25, inicio: 0.28, ataque: 0.008, duracao: 1.0, pico: 0.026 },
  { fonte: 'osc', forma: 'sine', hzIni: 698.46, inicio: 0.36, ataque: 0.008, duracao: 0.9, pico: 0.012 },
]

export const RECEITAS_DAS_DESLIZANTES: Readonly<Record<MaterialDasDeslizantes, Readonly<Record<SomDasDeslizantes, readonly Voz[]>>>> = {
  madeira: {
    desliza: [
      { fonte: 'ruido', inicio: 0, ataque: 0.02, duracao: 0.12, pico: 0.05, filtro: { tipo: 'bandpass', hz: 520, q: 0.9 } },
      { fonte: 'ruido', inicio: 0.02, ataque: 0.03, duracao: 0.09, pico: 0.03, filtro: { tipo: 'bandpass', hz: 1500, q: 1.4 } },
      { fonte: 'osc', forma: 'sine', hzIni: 170, hzFim: 90, inicio: 0.12, ataque: 0.002, duracao: 0.08, pico: 0.07 },
    ],
    presa: [
      { fonte: 'osc', forma: 'sine', hzIni: 150, hzFim: 110, inicio: 0, ataque: 0.002, duracao: 0.06, pico: 0.06 },
      { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.025, pico: 0.03, filtro: { tipo: 'lowpass', hz: 900 } },
    ],
    acerto: ACORDE,
  },
  bronze: {
    desliza: [
      { fonte: 'ruido', inicio: 0, ataque: 0.015, duracao: 0.12, pico: 0.035, filtro: { tipo: 'bandpass', hz: 2400, q: 2.2 } },
      { fonte: 'ruido', inicio: 0, ataque: 0.02, duracao: 0.11, pico: 0.03, filtro: { tipo: 'bandpass', hz: 700, q: 1 } },
      { fonte: 'osc', forma: 'sine', hzIni: 210, hzFim: 120, inicio: 0.12, ataque: 0.002, duracao: 0.07, pico: 0.06 },
      { fonte: 'osc', forma: 'triangle', hzIni: 1320, inicio: 0.121, ataque: 0.002, duracao: 0.16, pico: 0.008, filtro: { tipo: 'lowpass', hz: 3000 } },
    ],
    presa: [
      { fonte: 'osc', forma: 'sine', hzIni: 190, hzFim: 140, inicio: 0, ataque: 0.002, duracao: 0.05, pico: 0.05 },
      { fonte: 'osc', forma: 'triangle', hzIni: 980, inicio: 0, ataque: 0.002, duracao: 0.07, pico: 0.006 },
    ],
    acerto: ACORDE,
  },
}

/** O mesmo som não repete antes disto (a rede repetindo a vista, dois jogadores no mesmo instante). */
const INTERVALO_MS = 60
const ultimoToque = new Map<string, number>()

/** Toca um som do tabuleiro agora. Devolve se tocou. */
export function tocarSomDasDeslizantes(id: SomDasDeslizantes, material: MaterialDasDeslizantes): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DAS_DESLIZANTES[material][id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
