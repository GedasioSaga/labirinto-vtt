import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'
import { RECEITAS_DOS_INTERRUPTORES } from '../interruptores/somDosInterruptores'

/**
 * OS SONS DA COOPERAÇÃO (28/11), sintetizados no Web Audio da mesa
 * (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   alavanca  a alavanca grande desce na fenda (a mesma oficina dos interruptores)
 *   placa     a placa de pressão afunda: o raspão da pedra, o baque do contrapeso
 *             e o estalo da trava lá embaixo
 *   painel    o botão do painel: o clique seco e o "tim" do contato
 *   acende    o gás pega no lampião deste ponto
 *   longe     o lampião de OUTRO ponto acendeu: um sino abafado, de longe, para
 *             quem está aqui saber que o colega acionou
 *   apaga     a janela fechou: o registro corta o gás
 *   acerto    todos acesos: a trava cede e o acorde dos lampiões sobe
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDaCooperacao = 'alavanca' | 'placa' | 'painel' | 'acende' | 'longe' | 'apaga' | 'acerto'

export const RECEITAS_DA_COOPERACAO: Readonly<Record<SomDaCooperacao, readonly Voz[]>> = {
  alavanca: RECEITAS_DOS_INTERRUPTORES.alavanca,
  placa: [
    { fonte: 'ruido', inicio: 0, ataque: 0.02, duracao: 0.16, pico: 0.05, filtro: { tipo: 'lowpass', hz: 520 } },
    { fonte: 'osc', forma: 'sine', hzIni: 110, hzFim: 46, inicio: 0.09, ataque: 0.003, duracao: 0.22, pico: 0.13 },
    { fonte: 'ruido', inicio: 0.17, ataque: 0.001, duracao: 0.02, pico: 0.07, filtro: { tipo: 'bandpass', hz: 1900, q: 4 } },
  ],
  painel: [
    { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.012, pico: 0.09, filtro: { tipo: 'bandpass', hz: 3200, q: 5 } },
    { fonte: 'osc', forma: 'sine', hzIni: 180, hzFim: 90, inicio: 0, ataque: 0.002, duracao: 0.06, pico: 0.06 },
    { fonte: 'osc', forma: 'sine', hzIni: 1318.5, inicio: 0.03, ataque: 0.002, duracao: 0.34, pico: 0.016 },
  ],
  acende: RECEITAS_DOS_INTERRUPTORES.acende,
  longe: [
    { fonte: 'osc', forma: 'sine', hzIni: 659.25, inicio: 0, ataque: 0.01, duracao: 0.9, pico: 0.022, filtro: { tipo: 'lowpass', hz: 1400 } },
    { fonte: 'osc', forma: 'sine', hzIni: 987.77, inicio: 0.02, ataque: 0.01, duracao: 0.6, pico: 0.009, filtro: { tipo: 'lowpass', hz: 1400 } },
  ],
  apaga: RECEITAS_DOS_INTERRUPTORES.apaga,
  acerto: RECEITAS_DOS_INTERRUPTORES.acerto,
}

/** O mesmo som não repete antes disto (a rede repetindo a vista). */
const INTERVALO_MS = 60
const ultimoToque = new Map<SomDaCooperacao, number>()

/** Toca um som da cooperação agora. Devolve se tocou. */
export function tocarSomDaCooperacao(id: SomDaCooperacao): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DA_COOPERACAO[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
