import { estaCalado, useSomStore } from '../../stores/somStore'
import { obterSaidaDeSom } from './contexto'
import type { Voz } from './receitas'
import { tocarReceita } from './sintetizador'

/**
 * D5 (decisão 5 do plano de unificação do combate, 10/11/2026): os SONS DO
 * COMBATE, sintetizados aqui, no mesmo Web Audio dos sons de clima e das
 * aberturas (`contexto.ts`, `sintetizador.ts`). Nada baixado. Curtos (nenhum
 * passa de 0,4 s) e baixos: papel, madeira e latão, a mesma matéria da tela.
 *
 *   mover       o estalo de papel ao andar no menu (seta, mouse)
 *   confirmar   a batida dupla de madeira ao escolher
 *   corte       o rasgo de papel do corte do golpe
 *   impacto     o baque, em três tamanhos (leve, médio, forte), como o tremor
 *   dado        o chocalho curto do d20
 *   suaVez      duas notas de latão (uma quinta) na faixa SUA VEZ
 *
 * Respeita o mudo e o volume gerais do app (`somStore`) e tem o mudo PRÓPRIO
 * do combate, ligado por padrão e lembrado neste computador. Não toca antes
 * do primeiro gesto destravar o áudio, e o mesmo som não repete em rajada.
 */

export type SomDoCombate = 'mover' | 'confirmar' | 'corte' | 'impactoLeve' | 'impactoMedio' | 'impactoForte' | 'dado' | 'suaVez'

/** O baque do golpe: um grave que cai, o ruído abafado do choque e a batida de madeira (que o alto-falante pequeno toca). */
function baque(pico: number, duracao: number): Voz[] {
  return [
    { fonte: 'osc', forma: 'sine', hzIni: 120, hzFim: 46, inicio: 0, ataque: 0.004, duracao, pico },
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: duracao * 0.4, pico: pico * 0.55, filtro: { tipo: 'lowpass', hz: 800, q: 0 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 340, hzFim: 210, inicio: 0, ataque: 0.002, duracao: 0.07, pico: pico * 0.22 },
  ]
}

export const RECEITAS_DO_COMBATE: Readonly<Record<SomDoCombate, readonly Voz[]>> = {
  mover: [
    { fonte: 'ruido', inicio: 0, ataque: 0.002, duracao: 0.028, pico: 0.12, filtro: { tipo: 'bandpass', hz: 2600, q: 5 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 900, hzFim: 820, inicio: 0, ataque: 0.002, duracao: 0.03, pico: 0.025 },
  ],
  confirmar: [
    { fonte: 'osc', forma: 'triangle', hzIni: 392, inicio: 0, ataque: 0.003, duracao: 0.07, pico: 0.1, filtro: { tipo: 'lowpass', hz: 2600 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 587.33, inicio: 0.055, ataque: 0.003, duracao: 0.09, pico: 0.09, filtro: { tipo: 'lowpass', hz: 2600 } },
    { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.02, pico: 0.06, filtro: { tipo: 'bandpass', hz: 1800, q: 3 } },
  ],
  corte: [
    { fonte: 'ruido', inicio: 0, ataque: 0.05, duracao: 0.24, pico: 0.16, filtro: { tipo: 'bandpass', hz: 1700, q: 1.1 } },
    { fonte: 'ruido', inicio: 0.03, ataque: 0.02, duracao: 0.14, pico: 0.08, filtro: { tipo: 'highpass', hz: 3800 } },
    { fonte: 'osc', forma: 'sawtooth', hzIni: 180, hzFim: 90, inicio: 0, ataque: 0.03, duracao: 0.2, pico: 0.025, filtro: { tipo: 'lowpass', hz: 700 } },
  ],
  impactoLeve: baque(0.22, 0.16),
  impactoMedio: baque(0.34, 0.24),
  impactoForte: baque(0.5, 0.36),
  dado: [
    { fonte: 'ruido', inicio: 0, ataque: 0.001, duracao: 0.022, pico: 0.1, filtro: { tipo: 'bandpass', hz: 3200, q: 4 } },
    { fonte: 'ruido', inicio: 0.045, ataque: 0.001, duracao: 0.022, pico: 0.08, filtro: { tipo: 'bandpass', hz: 2900, q: 4 } },
    { fonte: 'ruido', inicio: 0.1, ataque: 0.001, duracao: 0.022, pico: 0.07, filtro: { tipo: 'bandpass', hz: 3400, q: 4 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 620, inicio: 0.16, ataque: 0.002, duracao: 0.05, pico: 0.05 },
  ],
  suaVez: [
    { fonte: 'osc', forma: 'triangle', hzIni: 293.66, inicio: 0, ataque: 0.012, sustentar: 0.05, duracao: 0.24, pico: 0.1, filtro: { tipo: 'lowpass', hz: 2200 } },
    { fonte: 'osc', forma: 'triangle', hzIni: 440, inicio: 0.1, ataque: 0.012, sustentar: 0.08, duracao: 0.3, pico: 0.1, filtro: { tipo: 'lowpass', hz: 2200 } },
    { fonte: 'osc', forma: 'sine', hzIni: 880, inicio: 0.1, ataque: 0.01, duracao: 0.22, pico: 0.02 },
  ],
}

/** O mesmo som não repete antes disto (ms): seta segurada não vira metralhadora. */
const INTERVALO_MS: Readonly<Record<SomDoCombate, number>> = {
  mover: 45,
  confirmar: 90,
  corte: 200,
  impactoLeve: 60,
  impactoMedio: 60,
  impactoForte: 60,
  dado: 150,
  suaVez: 600,
}

const CHAVE_DO_MUDO = 'labirinto:batalha:somMudo'
/** O mudo desta sessão (vale mesmo sem armazenamento: janela privada). */
let mudoNaSessao: boolean | null = null
const ultimoToque = new Map<SomDoCombate, number>()
const ouvintes = new Set<() => void>()

/** O som do combate está ligado? Ligado por padrão; o mudo fica guardado neste computador. */
export function somDoCombateLigado(): boolean {
  if (mudoNaSessao !== null) return !mudoNaSessao
  try {
    return window.localStorage.getItem(CHAVE_DO_MUDO) !== 'sim'
  } catch {
    return true
  }
}

export function ligarSomDoCombate(ligado: boolean) {
  mudoNaSessao = !ligado
  try {
    if (ligado) window.localStorage.removeItem(CHAVE_DO_MUDO)
    else window.localStorage.setItem(CHAVE_DO_MUDO, 'sim')
  } catch {
    // Sem armazenamento: vale só até fechar o app.
  }
  for (const ouvinte of ouvintes) ouvinte()
}

/** Avisa quem mostra o botão de mudo (há um em cada tela da batalha). */
export function ouvirMudoDoCombate(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Toca um som do combate agora (no mesmo quadro do efeito). Devolve se tocou. */
export function tocarSomDoCombate(id: SomDoCombate): boolean {
  if (!somDoCombateLigado()) return false
  const preferencia = useSomStore.getState()
  if (estaCalado(preferencia)) return false
  const agora = performance.now()
  const anterior = ultimoToque.get(id)
  if (anterior !== undefined && agora - anterior < INTERVALO_MS[id]) return false
  const saida = obterSaidaDeSom()
  if (saida === null || saida.ctx.state !== 'running') return false
  const tocou = tocarReceita(saida, RECEITAS_DO_COMBATE[id], preferencia.volume)
  if (tocou) ultimoToque.set(id, agora)
  return tocou
}

/** O impacto do tamanho do tremor (3, 7 ou 12 px). */
export function somDoImpacto(tremorPx: number): SomDoCombate {
  return tremorPx <= 3 ? 'impactoLeve' : tremorPx <= 7 ? 'impactoMedio' : 'impactoForte'
}
