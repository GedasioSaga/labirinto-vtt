import { limitar } from './curvas'
import type { DificuldadeDanca, LetraDanca } from './tipos'

/**
 * REGRAS DA DANÇA: janelas de julgamento, vida, precisão, nota e pontos.
 * Números do protótipo aprovado (README, tabela "Números finais"); mudar um
 * deles muda o jogo para todos, então eles moram só aqui.
 */

export type Julgamento = 'perfeito' | 'bom' | 'ok' | 'errou'
/** Divisão do tempo de uma posição da grade: semínima, colcheia, semicolcheia. */
export type SubdivisaoDanca = 4 | 8 | 16

export interface RegrasDaDificuldade {
  id: DificuldadeDanca
  nome: string
  /** Meia-janela de cada julgamento, em ms (borda inclusiva). */
  janelas: { perfeito: number; bom: number; ok: number }
  /** Toque até este tanto de ms ANTES da seta conta Errou; 0 = toque cedo é ignorado. */
  errouCedo: number
  /** Segundos que a seta leva do topo da pista ao receptor. */
  tela: number
  /** Expert tem barra de vida; na Diversão Errou não derruba. */
  vida: boolean
  /** Intervalo mínimo entre duas setas, em s. */
  gapMin: number
}

export interface RegrasDaDiversao extends RegrasDaDificuldade {
  /** No máximo tantas setas por compasso. */
  porCompasso: number
  /** Força mínima do ataque para virar seta; a Diversão só usa a semínima. */
  limiar: { 4: number }
}

export interface RegrasDoExpert extends RegrasDaDificuldade {
  /** No máximo tantas semicolcheias seguidas. */
  corrida: number
  limiar: Record<SubdivisaoDanca, number>
}

export const DIF: { readonly diversao: RegrasDaDiversao; readonly expert: RegrasDoExpert } = {
  diversao: {
    id: 'diversao',
    nome: 'Diversão',
    janelas: { perfeito: 60, bom: 110, ok: 160 },
    errouCedo: 0,
    tela: 1.9,
    vida: false,
    gapMin: 0.45,
    porCompasso: 3,
    limiar: { 4: 0.5 },
  },
  expert: {
    id: 'expert',
    nome: 'Expert',
    janelas: { perfeito: 30, bom: 60, ok: 100 },
    errouCedo: 160,
    tela: 1.25,
    vida: true,
    gapMin: 0.1,
    corrida: 8,
    limiar: { 4: 0.3, 8: 0.5, 16: 0.62 },
  },
}

/** Quanto cada julgamento vale na precisão (segurada inteira vale 100). */
export const PESO: Readonly<Record<Julgamento, number>> = { perfeito: 100, bom: 75, ok: 40, errou: 0 }
export const PESO_SEGURADA = 100

/** Vida do Expert: começa em 60, vai até 100; zero encerra com "Falhou". */
export const VIDA: Readonly<Record<Julgamento | 'inicio' | 'max' | 'soltou', number>> = {
  inicio: 60,
  max: 100,
  perfeito: 2,
  bom: 1,
  ok: 0,
  errou: -9,
  soltou: -6,
}

/** Corte de cada nota, da melhor para a pior. */
export const LETRAS: readonly (readonly [LetraDanca, number])[] = [
  ['S', 0.95],
  ['A', 0.88],
  ['B', 0.78],
  ['C', 0.65],
  ['D', 0],
]

/** Soltar a segurada até 120 ms antes do fim ainda conta como segurada inteira. */
export const SOLTAR_TOLERANCIA = 0.12
export const PONTOS_MAX = 1000000

/** Folga de ponto flutuante: 60 ms medidos como 60,0000001 ainda são Perfeito. */
const FOLGA_DA_BORDA_MS = 1e-6
const FOLGA_DA_LETRA = 1e-9

/** Julga um toque: delta em ms (negativo = cedo). Borda inclusiva: 60 ms ainda é Perfeito. */
export function julgar(deltaMs: number, dif: DificuldadeDanca): Julgamento | null {
  const d = DIF[dif]
  const a = Math.abs(deltaMs) - FOLGA_DA_BORDA_MS
  if (a <= d.janelas.perfeito) return 'perfeito'
  if (a <= d.janelas.bom) return 'bom'
  if (a <= d.janelas.ok) return 'ok'
  if (deltaMs < 0 && a <= d.errouCedo) return 'errou'
  return null
}

export function letraDe(precisao: number): LetraDanca {
  for (const [letra, minimo] of LETRAS) if (precisao >= minimo - FOLGA_DA_LETRA) return letra
  return 'D'
}

/** 0 = S, 4 = D: menor é melhor. */
export function ordemLetra(letra: LetraDanca): number {
  return LETRAS.findIndex(([l]) => l === letra)
}

export function passouDaNota(letra: LetraDanca, notaMin: LetraDanca): boolean {
  return ordemLetra(letra) <= ordemLetra(notaMin)
}

export interface PlacarDanca {
  perfeito: number
  bom: number
  ok: number
  errou: number
  /** Seguradas levadas até o fim e seguradas fechadas (inteiras ou soltas). */
  segOk: number
  segTotal: number
  combo: number
  comboMax: number
  /** Soma dos pesos já ganhos; a precisão é peso / (itens × 100). */
  peso: number
  /** Itens já julgados: cada seta é 1, a segurada conta mais 1 no fim. */
  julgadas: number
  vida: number
}

export function novoPlacar(): PlacarDanca {
  return { perfeito: 0, bom: 0, ok: 0, errou: 0, segOk: 0, segTotal: 0, combo: 0, comboMax: 0, peso: 0, julgadas: 0, vida: VIDA.inicio }
}

/**
 * Precisão de 0 a 1. Sem `total`, divide pelo que já foi julgado (placar ao
 * vivo); com `total`, pela música inteira (resultado de quem chegou ao fim).
 */
export function precisaoDe(placar: PlacarDanca, total?: number): number {
  const base = total !== undefined ? total : placar.julgadas
  return base ? placar.peso / (base * 100) : 0
}

/** Pontos de 0 a 1.000.000, sempre sobre a música inteira. */
export function pontosDe(placar: PlacarDanca, totalItens: number): number {
  return Math.round((PONTOS_MAX * placar.peso) / (Math.max(1, totalItens) * 100))
}

/** Itens da música: cada seta vale 1 e a segurada vale 2 (o toque e o fim). */
export function totalDeItens(notas: readonly { len: number }[]): number {
  return notas.reduce((soma, n) => soma + (n.len > 0 ? 2 : 1), 0)
}

/** Soma `delta` à vida, sem passar de 0 nem do máximo. */
export function mudarVida(placar: PlacarDanca, delta: number): void {
  placar.vida = limitar(placar.vida + delta, 0, VIDA.max)
}

/**
 * Conta um julgamento no placar (muda o placar recebido: o laço de quadros
 * guarda um só). `segurada` = a seta tinha cauda; um Errou nela fecha a cauda
 * junto, como perdida.
 */
export function contarJulgamento(placar: PlacarDanca, julg: Julgamento, dif: DificuldadeDanca, segurada: boolean): void {
  const comVida = DIF[dif].vida
  placar[julg] += 1
  placar.julgadas += 1
  placar.peso += PESO[julg]
  if (julg === 'errou') {
    placar.combo = 0
    if (segurada) {
      placar.segTotal += 1
      placar.julgadas += 1
    }
    if (comVida) mudarVida(placar, VIDA.errou)
    return
  }
  placar.combo += 1
  placar.comboMax = Math.max(placar.comboMax, placar.combo)
  if (comVida) mudarVida(placar, VIDA[julg])
}

/** Conta o fim de uma segurada: inteira vale 100; solta zera o combo e, no Expert, tira vida. */
export function contarSegurada(placar: PlacarDanca, inteira: boolean, dif: DificuldadeDanca): void {
  placar.segTotal += 1
  placar.julgadas += 1
  if (inteira) {
    placar.segOk += 1
    placar.peso += PESO_SEGURADA
    return
  }
  placar.combo = 0
  if (DIF[dif].vida) mudarVida(placar, VIDA.soltou)
}
