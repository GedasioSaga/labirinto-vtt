import type { LeverPhase } from './playerConnection'

/**
 * O que o jogador lê depois de puxar a alavanca. Nenhum texto diz qual porta
 * ela move nem se abriu ou fechou: a porta pode estar fora da vista dele, e
 * quem a enxerga vê a mudança no próprio mapa.
 */
const LEVER_NOTICE_TEXT: Record<LeverPhase, string> = {
  pulled: 'Você puxou a alavanca',
  far: 'Chegue mais perto da alavanca',
  stuck: 'A alavanca não se move',
  unavailable: 'Não dá para usar isso agora',
}

export function leverNoticeText(phase: LeverPhase): string {
  return LEVER_NOTICE_TEXT[phase]
}
