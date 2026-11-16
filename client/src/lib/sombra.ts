import type { Periodo } from '../types/map'

/**
 * A SOMBRA DO MAPA, num lugar só (Fase 6, 16/11/2026; decisão do mestre de 12/11:
 * a sombra fica FIXA, de cima à esquerda para baixo à direita). Antes eram sete
 * famílias, cada uma com os seus números (carimbo 28%, móvel e telhado e parede
 * 25%, cor do telhado quase preta, deslocamento do telhado 6 × 8). Agora:
 * UMA direção, UMA cor e UMA força para a sombra que um objeto joga no chão, e a
 * força cai à tarde e à noite (o sol baixo e a noite apagam a sombra dura).
 *
 * Quem lê: o carimbo (Atual e Desenhado), o móvel do Desenhado, o telhado e a
 * parede do Desenhado. O relevo e o penhasco seguem a mesma direção e a mesma cor,
 * com a força dele (é a sombra de um rochedo, não de um objeto). Ficam de fora,
 * de propósito: o móvel do Atual (a sombra vem pintada no desenho, `texturas/
 * meioTermo/moveis/motor.ts`), as faixas do barranco (é o declive, não sombra
 * jogada) e a nuvem (é a sombra do céu, com a cor dela).
 *
 * MUDA A CARA DO MAPA: espera o mestre ver a folha antes/depois
 * (`tmp/melhorias-2026-11-15/fase-6/`).
 */

/** O vetor de sempre do relevo (7, 11), de comprimento 1: de cima à esquerda para baixo à direita. */
export const DIRECAO_DA_SOMBRA: { readonly x: number; readonly y: number } = { x: 7 / Math.hypot(7, 11), y: 11 / Math.hypot(7, 11) }

/** `#0a1c28`: o azul-noite do protótipo Diorama, já usado pelo carimbo e pelo móvel. */
export const COR_DA_SOMBRA = 0x0a1c28
export const COR_DA_SOMBRA_RGB: readonly [number, number, number] = [10, 28, 40]

/** A força da sombra de objeto ao meio-dia (entre os 28% do carimbo e os 25% do resto). */
export const FORCA_DA_SOMBRA = 0.26

/** Quanto da força fica em cada período: à tarde o sol está baixo, à noite a sombra quase some. */
export const FATOR_DA_SOMBRA_NO_PERIODO: Readonly<Record<Periodo, number>> = { dia: 1, tarde: 0.7, noite: 0.4 }

/** A força no período; `base` = a força de uma família que não é a do objeto (o relevo). */
export function forcaDaSombra(periodo: Periodo, base: number = FORCA_DA_SOMBRA): number {
  return base * FATOR_DA_SOMBRA_NO_PERIODO[periodo]
}

// ---------------------------------------------------------------------------
// O período que a tela mostra agora (editor ou jogador: cada janela tem o seu).

let periodoNaTela: Periodo = 'dia'
const ouvintes = new Set<() => void>()

export function periodoDaSombra(): Periodo {
  return periodoNaTela
}

/** A força da sombra de objeto no período que a tela mostra agora. */
export function forcaDaSombraAgora(base: number = FORCA_DA_SOMBRA): number {
  return forcaDaSombra(periodoNaTela, base)
}

/** Chamado pelo quadro que pinta a tinta do período (`PixiCanvas`, `PlayerView`); só avisa quando muda. */
export function definirPeriodoDaSombra(periodo: Periodo): void {
  if (periodo === periodoNaTela) return
  periodoNaTela = periodo
  for (const ouvinte of ouvintes) ouvinte()
}

/** Avisa quando o período muda; devolve quem desliga. */
export function assinarPeriodoDaSombra(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}
