import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'

/**
 * OS SONS DA MISTURA (28/11), sintetizados no mesmo Web Audio dos outros
 * painéis (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   despejar  o gorgolejo de um no outro: o fio de água (ruído abafado) e três
 *             bolhas que sobem de tom, cada uma mais aguda (o vidro enchendo)
 *   encher    a torneira abre: o jato mais claro e longo, com o tom subindo
 *   esvaziar  o ralo engole: um ruído grave que desce e duas bolhas no fim
 *   plop      o ingrediente cai no frasco: uma gota curta que sobe de tom
 *   turvou    a mistura estraga: um borbulhar baixo e escuro
 *   acerto    o receptáculo aceita: a mistura desce pelo funil (o gorgolejo
 *             grave) e um acorde de vidro sobe, por pouco mais de 1 s
 *
 * Bolha de verdade sobe de tom (a bolha encolhe ao subir): por isso cada
 * gota vai de um tom baixo a um alto em poucos centésimos.
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDaMistura = 'despejar' | 'encher' | 'esvaziar' | 'plop' | 'turvou' | 'acerto'

/** Uma bolha: um seno que sobe de `de` a `ate` Hz em `dura` segundos. */
function bolha(inicio: number, de: number, ate: number, pico: number, dura = 0.045): Voz {
  return { fonte: 'osc', forma: 'sine', hzIni: de, hzFim: ate, inicio, ataque: 0.004, duracao: dura, pico }
}

export const RECEITAS_DA_MISTURA: Readonly<Record<SomDaMistura, readonly Voz[]>> = {
  despejar: [
    { fonte: 'ruido', inicio: 0, ataque: 0.03, duracao: 0.34, pico: 0.05, filtro: { tipo: 'lowpass', hz: 900 } },
    { fonte: 'ruido', inicio: 0.02, ataque: 0.02, duracao: 0.26, pico: 0.02, filtro: { tipo: 'bandpass', hz: 2400, q: 1.4 } },
    bolha(0.04, 240, 420, 0.06),
    bolha(0.13, 300, 520, 0.05),
    bolha(0.23, 360, 640, 0.042),
  ],
  encher: [
    { fonte: 'ruido', inicio: 0, ataque: 0.02, duracao: 0.46, pico: 0.05, filtro: { tipo: 'bandpass', hz: 1800, q: 0.9 } },
    { fonte: 'ruido', inicio: 0, ataque: 0.05, duracao: 0.44, pico: 0.035, filtro: { tipo: 'lowpass', hz: 700 } },
    { fonte: 'osc', forma: 'sine', hzIni: 180, hzFim: 420, inicio: 0.02, ataque: 0.06, duracao: 0.42, pico: 0.016 },
    bolha(0.34, 420, 700, 0.03),
  ],
  esvaziar: [
    { fonte: 'ruido', inicio: 0, ataque: 0.03, duracao: 0.4, pico: 0.06, filtro: { tipo: 'lowpass', hz: 520 } },
    { fonte: 'osc', forma: 'sine', hzIni: 170, hzFim: 70, inicio: 0, ataque: 0.02, duracao: 0.36, pico: 0.03 },
    bolha(0.3, 150, 300, 0.05, 0.06),
    bolha(0.38, 190, 360, 0.04, 0.05),
  ],
  plop: [
    bolha(0, 260, 820, 0.08, 0.05),
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.03, pico: 0.03, filtro: { tipo: 'bandpass', hz: 3000, q: 2 } },
    bolha(0.09, 520, 900, 0.025, 0.035),
  ],
  turvou: [
    { fonte: 'ruido', inicio: 0, ataque: 0.06, duracao: 0.5, pico: 0.045, filtro: { tipo: 'lowpass', hz: 360 } },
    bolha(0.05, 90, 150, 0.06, 0.08),
    bolha(0.18, 80, 130, 0.05, 0.08),
    bolha(0.32, 70, 115, 0.045, 0.09),
  ],
  acerto: [
    { fonte: 'ruido', inicio: 0, ataque: 0.04, duracao: 0.5, pico: 0.05, filtro: { tipo: 'lowpass', hz: 640 } },
    bolha(0.06, 160, 300, 0.07, 0.06),
    bolha(0.2, 200, 360, 0.05, 0.06),
    { fonte: 'osc', forma: 'sine', hzIni: 70, hzFim: 44, inicio: 0.3, ataque: 0.004, duracao: 0.3, pico: 0.11 },
    { fonte: 'osc', forma: 'sine', hzIni: 523.25, inicio: 0.36, ataque: 0.004, duracao: 1.1, pico: 0.034 },
    { fonte: 'osc', forma: 'sine', hzIni: 659.25, inicio: 0.44, ataque: 0.004, duracao: 1.0, pico: 0.028 },
    { fonte: 'osc', forma: 'sine', hzIni: 783.99, inicio: 0.52, ataque: 0.004, duracao: 0.9, pico: 0.024 },
    { fonte: 'osc', forma: 'sine', hzIni: 1046.5, inicio: 0.6, ataque: 0.004, duracao: 0.8, pico: 0.012 },
  ],
}

/** O mesmo som não repete antes disto (a rede repetindo a vista). */
const INTERVALO_MS = 60
const ultimoToque = new Map<SomDaMistura, number>()

/** Toca um som da bancada agora. Devolve se tocou. */
export function tocarSomDaMistura(id: SomDaMistura): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DA_MISTURA[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
