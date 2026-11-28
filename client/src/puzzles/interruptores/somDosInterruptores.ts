import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'

/**
 * OS SONS DOS INTERRUPTORES (28/11), sintetizados no mesmo Web Audio das peças
 * giratórias (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   alavanca  a alavanca desce na fenda: o raspão do metal, o estalo da trava
 *             e o baque surdo do peso, com a mola zunindo um pouco no fim
 *   acende    o gás pega no lampião: a faísca e o sopro abafado da chama
 *   apaga     o registro fecha: um sopro curto que morre
 *   acerto    o painel inteiro cede: a trava solta (baque grave e estalo), os
 *             lampiões rugem juntos e um acorde quente sobe, por pouco mais de 1 s
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDosInterruptores = 'alavanca' | 'acende' | 'apaga' | 'acerto'

export const RECEITAS_DOS_INTERRUPTORES: Readonly<Record<SomDosInterruptores, readonly Voz[]>> = {
  alavanca: [
    { fonte: 'ruido', inicio: 0, ataque: 0.008, duracao: 0.06, pico: 0.045, filtro: { tipo: 'bandpass', hz: 640, q: 1.2 } },
    { fonte: 'ruido', inicio: 0.052, ataque: 0.001, duracao: 0.018, pico: 0.11, filtro: { tipo: 'bandpass', hz: 2600, q: 4.5 } },
    { fonte: 'osc', forma: 'sine', hzIni: 150, hzFim: 62, inicio: 0.052, ataque: 0.002, duracao: 0.12, pico: 0.1 },
    { fonte: 'osc', forma: 'triangle', hzIni: 540, hzFim: 520, inicio: 0.06, ataque: 0.002, duracao: 0.2, pico: 0.012, filtro: { tipo: 'lowpass', hz: 1600 } },
  ],
  acende: [
    { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.014, pico: 0.05, filtro: { tipo: 'bandpass', hz: 3400, q: 3 } },
    { fonte: 'ruido', inicio: 0.01, ataque: 0.05, duracao: 0.24, pico: 0.075, filtro: { tipo: 'lowpass', hz: 620 } },
    { fonte: 'osc', forma: 'sine', hzIni: 84, hzFim: 132, inicio: 0.02, ataque: 0.04, duracao: 0.2, pico: 0.028 },
  ],
  apaga: [
    { fonte: 'ruido', inicio: 0, ataque: 0.012, duracao: 0.13, pico: 0.05, filtro: { tipo: 'bandpass', hz: 880, q: 0.8 } },
    { fonte: 'osc', forma: 'sine', hzIni: 190, hzFim: 76, inicio: 0, ataque: 0.004, duracao: 0.1, pico: 0.018 },
  ],
  acerto: [
    { fonte: 'osc', forma: 'sine', hzIni: 76, hzFim: 40, inicio: 0, ataque: 0.003, duracao: 0.34, pico: 0.13 },
    { fonte: 'ruido', inicio: 0.012, ataque: 0.001, duracao: 0.03, pico: 0.085, filtro: { tipo: 'bandpass', hz: 2100, q: 4 } },
    { fonte: 'ruido', inicio: 0.06, ataque: 0.14, duracao: 0.62, pico: 0.05, filtro: { tipo: 'lowpass', hz: 760 } },
    { fonte: 'osc', forma: 'sine', hzIni: 392, inicio: 0.12, ataque: 0.006, duracao: 1.2, pico: 0.04 },
    { fonte: 'osc', forma: 'sine', hzIni: 493.88, inicio: 0.2, ataque: 0.006, duracao: 1.1, pico: 0.03 },
    { fonte: 'osc', forma: 'sine', hzIni: 587.33, inicio: 0.28, ataque: 0.006, duracao: 1.0, pico: 0.026 },
    { fonte: 'osc', forma: 'sine', hzIni: 783.99, inicio: 0.36, ataque: 0.006, duracao: 0.9, pico: 0.013 },
  ],
}

/** O mesmo som não repete antes disto (vários lampiões na mesma vista, a rede repetindo). */
const INTERVALO_MS = 60
const ultimoToque = new Map<SomDosInterruptores, number>()

/** Toca um som do painel agora. Devolve se tocou. */
export function tocarSomDosInterruptores(id: SomDosInterruptores): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DOS_INTERRUPTORES[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
