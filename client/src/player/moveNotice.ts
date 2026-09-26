import type { DoorToggleRejection } from '../net/protocol'
import type { TokenMoveLanding, TokenMoveRejection } from '../lib/moveValidation'
import { MOVE_NOTICE_TEXT as LANDING_NOTICE_TEXT } from './playerConnection'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  wrong_side: 'Não dá para abrir por este lado',
  blocked: 'Tem alguém no vão da porta',
}

/**
 * Recusa do host ao movimento, em uma linha curta. Sem ela a ficha só voltava
 * para trás, calada, e o jogador não sabia se foi parede, chão ou posse.
 */
const MOVE_NOTICE_TEXT: Record<TokenMoveRejection, string> = {
  wall: 'Parede no caminho',
  outside_floor: 'Fora do chão',
  not_owner: 'Essa ficha não é sua',
  // FICHA SEGURADA PELO MESTRE: a jogadora achava que o app tinha travado.
  // O cadeado na própria ficha (`pixi/drawTokenLock.ts`) diz o mesmo antes do arrasto.
  locked: 'O mestre segurou sua ficha',
  outside_map: 'Fora do mapa',
  unknown_token: 'Essa ficha não está mais aqui',
  // "Fichas ocupam espaço": não diz QUEM está lá.
  occupied: 'Lugar ocupado',
  // A vez da iniciativa tem aviso próprio (`turnNotice`, "Espere sua vez"); o
  // CONFRONTO na cena (`lib/confronto.ts`) usa este mesmo texto.
  not_your_turn: 'Espere sua vez',
  too_far: 'Além do seu passo',
}

export function moveNoticeText(reason: TokenMoveRejection): string {
  return MOVE_NOTICE_TEXT[reason]
}

/**
 * Porta e movimento avisam no mesmo lugar da tela (rodapé): dois avisos juntos
 * se sobreporiam. Vale o mais novo — o `id` dos dois sai do mesmo contador.
 */
function isLanding(reason: TokenMoveRejection | TokenMoveLanding): reason is TokenMoveLanding {
  return reason === 'nearest_floor'
}

/** Texto do motivo do movimento: recusa (não moveu) ou pouso aceito em outro lugar (moveu, mas não onde pedido). */
function moveActionText(reason: TokenMoveRejection | TokenMoveLanding): string {
  return isLanding(reason) ? LANDING_NOTICE_TEXT[reason] : MOVE_NOTICE_TEXT[reason]
}

export function latestActionNotice(
  door: { id: number; reason: DoorToggleRejection } | undefined,
  move: { id: number; reason: TokenMoveRejection | TokenMoveLanding } | undefined,
): { id: number; text: string } | null {
  if (move !== undefined && (door === undefined || move.id > door.id)) return { id: move.id, text: moveActionText(move.reason) }
  if (door !== undefined) return { id: door.id, text: DOOR_NOTICE_TEXT[door.reason] }
  return null
}
