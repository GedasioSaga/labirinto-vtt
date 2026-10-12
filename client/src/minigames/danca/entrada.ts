import type { TrilhaDanca } from './tipos'

/**
 * ENTRADA DA DANÇA: teclado (por `event.code`, vale em qualquer layout),
 * controle (Gamepad API, mapeamento padrão) e o controle de quem está
 * segurando cada trilha, para teclado, toque e controle não se atropelarem.
 */

/** Setas sempre valem; o segundo jeito é WASD ou DFJK, escolhido no convite. */
export type ModoTeclas = 'setas' | 'dfjk'

export const TECLAS: Readonly<Record<ModoTeclas, Readonly<Record<string, TrilhaDanca>>>> = {
  setas: { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyA: 0, KeyS: 1, KeyW: 2, KeyD: 3 },
  dfjk: { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 },
}

/** Letra mostrada em cada botão da pista (← ↓ ↑ →). */
export const ROTULO_TECLA: Readonly<Record<ModoTeclas, readonly [string, string, string, string]>> = {
  setas: ['A', 'S', 'W', 'D'],
  dfjk: ['D', 'F', 'J', 'K'],
}

/** Trilha da tecla, ou -1 se a tecla não é do jogo. */
export function laneDaTecla(code: string, modo: ModoTeclas): TrilhaDanca | -1 {
  const mapa = TECLAS[modo]
  return Object.prototype.hasOwnProperty.call(mapa, code) ? mapa[code] : -1
}

/** O pedaço do `Gamepad` que o jogo lê; um controle de verdade serve, e o teste monta um de mentira. */
export interface ControleLido {
  /** Controle com menos botões deixa a posição vazia. */
  readonly buttons: readonly ({ readonly pressed: boolean } | null | undefined)[]
  readonly axes: readonly number[]
}

/** Analógico além de meio curso conta como direção apertada. */
const ZONA_DO_ANALOGICO = 0.5
/** Start (mapeamento padrão): pausa e continua. */
export const BOTAO_START = 9

const apertado = (pad: ControleLido, i: number): boolean => pad.buttons[i]?.pressed === true

/** Controle no mapeamento padrão: direcional, analógico esquerdo e o losango de botões na mesma posição das setas; LB/RB também valem ← →. */
export function lanesDoControle(pad: ControleLido): [boolean, boolean, boolean, boolean] {
  const ax = pad.axes[0] || 0
  const ay = pad.axes[1] || 0
  return [
    apertado(pad, 14) || apertado(pad, 2) || apertado(pad, 4) || ax < -ZONA_DO_ANALOGICO,
    apertado(pad, 13) || apertado(pad, 0) || ay > ZONA_DO_ANALOGICO,
    apertado(pad, 12) || apertado(pad, 3) || ay < -ZONA_DO_ANALOGICO,
    apertado(pad, 15) || apertado(pad, 1) || apertado(pad, 5) || ax > ZONA_DO_ANALOGICO,
  ]
}

export function startApertado(pad: ControleLido): boolean {
  return apertado(pad, BOTAO_START)
}

const TRILHAS: readonly TrilhaDanca[] = [0, 1, 2, 3]

/** O que mudou entre duas leituras do controle: trilhas que desceram e que subiram. */
export function bordasDoControle(
  antes: readonly boolean[],
  agora: readonly boolean[],
): { apertou: TrilhaDanca[]; soltou: TrilhaDanca[] } {
  const apertou: TrilhaDanca[] = []
  const soltou: TrilhaDanca[] = []
  for (const lane of TRILHAS) {
    if (agora[lane] && !antes[lane]) apertou.push(lane)
    else if (!agora[lane] && antes[lane]) soltou.push(lane)
  }
  return { apertou, soltou }
}


/**
 * Quem segura cada trilha: tecla, dedo ou controle (`id` = 'k' + code,
 * 'p' + pointerId, 'g' + índice do controle). A mesma fonte apertando de novo
 * não conta (auto-repetição, pointerdown duplicado); a trilha só solta quando
 * a última fonte solta, senão soltar o teclado derrubaria a segurada do controle.
 */
export interface FontesDasTrilhas {
  /** true = fonte nova nesta trilha: julgue o toque. */
  apertou(lane: TrilhaDanca, id: string): boolean
  /** true = era a última fonte: a trilha soltou. */
  soltou(lane: TrilhaDanca, id: string): boolean
  /** Solta tudo (janela perdeu o foco, pausa); devolve as trilhas que estavam seguras. */
  limpar(): TrilhaDanca[]
}

export function criarFontesDasTrilhas(): FontesDasTrilhas {
  const fontes: Set<string>[] = [new Set(), new Set(), new Set(), new Set()]
  return {
    apertou(lane, id) {
      if (fontes[lane].has(id)) return false
      fontes[lane].add(id)
      return true
    },
    soltou(lane, id) {
      if (!fontes[lane].delete(id)) return false
      return fontes[lane].size === 0
    },
    limpar() {
      const seguras = TRILHAS.filter((lane) => fontes[lane].size > 0)
      for (const f of fontes) f.clear()
      return seguras
    },
  }
}
