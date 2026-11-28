import { obterSaidaDeSom } from '../../lib/sons/contexto'
import type { Voz } from '../../lib/sons/receitas'
import { tocarReceita } from '../../lib/sons/sintetizador'
import { estaCalado, useSomStore } from '../../stores/somStore'
import type { MaterialDasCamadas } from '../tipos'

/**
 * OS SONS DA MESA DE LUZ (28/11), sintetizados no mesmo Web Audio dos outros
 * painéis (`lib/sons`): nada baixado, curtos e baixos.
 *
 *   pousar  a lâmina assenta no vidro da mesa: no vidro, um tinido alto e
 *           curto (dois parciais que não batem, como vidro de verdade); no
 *           papel, o farfalhar da folha; no ferro, um baque seco e grave
 *   girar   a lâmina arrasta um quarto de volta: um raspado curto e o estalo
 *           do pino de registro no fim
 *   mover   ela escorrega por baixo da outra: um raspado mais longo e abafado
 *   tirar   ela sai da mesa: o raspado subindo de tom
 *   acerto  a figura fecha: um baque surdo e um acorde claro que sobe, por
 *           pouco mais de 1 s (a luz da mesa acende junto)
 *
 * Respeita o mudo e o volume gerais da mesa (`somStore`). Não toca antes de um
 * gesto destravar o áudio, e o mesmo som não repete em rajada.
 */
export type SomDasCamadas = 'pousar' | 'girar' | 'mover' | 'tirar' | 'acerto'

const POUSAR: Readonly<Record<MaterialDasCamadas, readonly Voz[]>> = {
  vidro: [
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.025, pico: 0.05, filtro: { tipo: 'bandpass', hz: 4200, q: 2.4 } },
    { fonte: 'osc', forma: 'sine', hzIni: 2093, inicio: 0.004, ataque: 0.002, duracao: 0.34, pico: 0.035 },
    { fonte: 'osc', forma: 'sine', hzIni: 3341, inicio: 0.004, ataque: 0.002, duracao: 0.22, pico: 0.018 },
    { fonte: 'osc', forma: 'sine', hzIni: 5120, inicio: 0.006, ataque: 0.002, duracao: 0.1, pico: 0.008 },
  ],
  papel: [
    { fonte: 'ruido', inicio: 0, ataque: 0.012, duracao: 0.16, pico: 0.05, filtro: { tipo: 'bandpass', hz: 3400, q: 0.8 } },
    { fonte: 'ruido', inicio: 0.05, ataque: 0.01, duracao: 0.12, pico: 0.03, filtro: { tipo: 'highpass', hz: 2200 } },
    { fonte: 'ruido', inicio: 0.13, ataque: 0.004, duracao: 0.05, pico: 0.03, filtro: { tipo: 'lowpass', hz: 900 } },
  ],
  ferro: [
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.09, pico: 0.07, filtro: { tipo: 'lowpass', hz: 900 } },
    { fonte: 'osc', forma: 'sine', hzIni: 196, hzFim: 160, inicio: 0, ataque: 0.002, duracao: 0.26, pico: 0.08 },
    { fonte: 'osc', forma: 'triangle', hzIni: 622, inicio: 0.004, ataque: 0.002, duracao: 0.18, pico: 0.02 },
  ],
}

const COMUNS: Readonly<Record<Exclude<SomDasCamadas, 'pousar'>, readonly Voz[]>> = {
  girar: [
    { fonte: 'ruido', inicio: 0, ataque: 0.02, duracao: 0.16, pico: 0.03, filtro: { tipo: 'bandpass', hz: 1700, q: 1.2 } },
    { fonte: 'osc', forma: 'sine', hzIni: 1760, inicio: 0.17, ataque: 0.002, duracao: 0.06, pico: 0.03 },
    { fonte: 'ruido', inicio: 0.17, ataque: 0.001, duracao: 0.02, pico: 0.03, filtro: { tipo: 'bandpass', hz: 3800, q: 2 } },
  ],
  mover: [
    { fonte: 'ruido', inicio: 0, ataque: 0.04, duracao: 0.24, pico: 0.035, filtro: { tipo: 'lowpass', hz: 1300 } },
    { fonte: 'ruido', inicio: 0.02, ataque: 0.03, duracao: 0.18, pico: 0.015, filtro: { tipo: 'bandpass', hz: 2600, q: 1.1 } },
  ],
  tirar: [
    { fonte: 'ruido', inicio: 0, ataque: 0.03, duracao: 0.18, pico: 0.03, filtro: { tipo: 'bandpass', hz: 1500, q: 1 } },
    { fonte: 'osc', forma: 'sine', hzIni: 520, hzFim: 880, inicio: 0.02, ataque: 0.02, duracao: 0.14, pico: 0.014 },
  ],
  acerto: [
    { fonte: 'osc', forma: 'sine', hzIni: 82, hzFim: 55, inicio: 0, ataque: 0.004, duracao: 0.32, pico: 0.1 },
    { fonte: 'ruido', inicio: 0, ataque: 0.004, duracao: 0.06, pico: 0.03, filtro: { tipo: 'lowpass', hz: 700 } },
    { fonte: 'osc', forma: 'sine', hzIni: 659.25, inicio: 0.12, ataque: 0.03, duracao: 1.15, pico: 0.03 },
    { fonte: 'osc', forma: 'sine', hzIni: 830.61, inicio: 0.22, ataque: 0.03, duracao: 1.05, pico: 0.026 },
    { fonte: 'osc', forma: 'sine', hzIni: 987.77, inicio: 0.32, ataque: 0.03, duracao: 0.95, pico: 0.022 },
    { fonte: 'osc', forma: 'sine', hzIni: 1318.5, inicio: 0.42, ataque: 0.03, duracao: 0.85, pico: 0.012 },
    { fonte: 'osc', forma: 'sine', hzIni: 2637, inicio: 0.46, ataque: 0.01, duracao: 0.5, pico: 0.004 },
  ],
}

/** As receitas de cada som num material (o `pousar` muda com ele; os outros, não). */
export function receitaDasCamadas(id: SomDasCamadas, material: MaterialDasCamadas): readonly Voz[] {
  return id === 'pousar' ? POUSAR[material] : COMUNS[id]
}

/** O mesmo som não repete antes disto (a rede repetindo a vista). */
const INTERVALO_MS = 60
const ultimoToque = new Map<SomDasCamadas, number>()

/** Toca um som da mesa agora. Devolve se tocou. */
export function tocarSomDasCamadas(id: SomDasCamadas, material: MaterialDasCamadas = 'vidro'): boolean {
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, receitaDasCamadas(id, material), preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}
