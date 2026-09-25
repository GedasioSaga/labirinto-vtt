import type { DoorToggleRejection } from '../net/protocol'
import type { TokenMoveRejection } from '../lib/moveValidation'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  wrong_side: 'Não dá para abrir por este lado',
}

/**
 * Recusa do host ao movimento, em uma linha curta. Sem ela a ficha só voltava
 * para trás, calada, e o jogador não sabia se foi parede, chão ou posse.
 */
const MOVE_NOTICE_TEXT: Record<TokenMoveRejection, string> = {
  wall: 'Parede no caminho',
  outside_floor: 'Fora do chão',
  not_owner: 'Essa ficha não é sua',
  locked: 'O mestre travou essa ficha',
  outside_map: 'Fora do mapa',
  unknown_token: 'Essa ficha não está mais aqui',
  // "Fichas ocupam espaço": não diz QUEM está lá.
  occupied: 'Lugar ocupado',
  // A vez tem aviso próprio (`turnNotice`, "Espere sua vez"); este texto só
  // existe porque o registro cobre todo motivo.
  not_your_turn: 'Espere sua vez',
}

export function moveNoticeText(reason: TokenMoveRejection): string {
  return MOVE_NOTICE_TEXT[reason]
}

/**
 * Porta e movimento avisam no mesmo lugar da tela (rodapé): dois avisos juntos
 * se sobreporiam. Vale o mais novo — o `id` dos dois sai do mesmo contador.
 */
export function latestActionNotice(
  door: { id: number; reason: DoorToggleRejection } | undefined,
  move: { id: number; reason: TokenMoveRejection } | undefined,
): { id: number; text: string } | null {
  if (move !== undefined && (door === undefined || move.id > door.id)) return { id: move.id, text: MOVE_NOTICE_TEXT[move.reason] }
  if (door !== undefined) return { id: door.id, text: DOOR_NOTICE_TEXT[door.reason] }
  return null
}
