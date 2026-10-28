import type { DoorToggleRejection } from '../net/protocol'
import type { TokenMoveLanding, TokenMoveRejection } from '../lib/moveValidation'
import { TEXTO_CONGELADO } from '../lib/congelar'
import type { AvisoDoClique, MotivoDaCaminhada } from '../lib/cliqueParaAndar'
import { MOVE_NOTICE_TEXT as LANDING_NOTICE_TEXT, VEHICLE_NOTICE_TEXT, type MoveNoticeReason, type VehicleNotice } from './playerConnection'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  wrong_side: 'Não dá para abrir por este lado',
  blocked: 'Tem alguém no vão da porta',
  no_peek: 'Não dá para espiar aqui',
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
  // CONGELAR FICHA: a mesma frase do aviso fixo da tela e do floco na ficha.
  congelado: TEXTO_CONGELADO,
  outside_map: 'Fora do mapa',
  unknown_token: 'Essa ficha não está mais aqui',
  // "Fichas ocupam espaço": não diz QUEM está lá.
  occupied: 'Lugar ocupado',
  // VEÍCULO: passageiro que não dirige não anda — desce primeiro (ou espera o motorista).
  a_bordo: 'A bordo: desça para andar',
}

export function moveNoticeText(reason: TokenMoveRejection): string {
  return MOVE_NOTICE_TEXT[reason]
}

/** CLICAR PARA ANDAR: por que a caminhada não saiu (ou parou no host). O cercado reusa "Lugar ocupado". */
type AvisoDaCaminhada = MotivoDaCaminhada | Exclude<AvisoDoClique, 'occupied'>
const CAMINHADA_NOTICE_TEXT: Record<AvisoDaCaminhada, string> = {
  caminhada_desligada: 'O mestre desligou o clicar para andar nesta cena',
  // A mesma frase do item "Andar até aqui" esmaecido no menu do toque longo.
  caminho_desconhecido: 'Você não conhece o caminho',
  nevoa: 'Esse caminho passa por onde você não conhece',
}

function isAvisoDaCaminhada(reason: MoveNoticeReason): reason is AvisoDaCaminhada {
  return reason === 'caminhada_desligada' || reason === 'caminho_desconhecido' || reason === 'nevoa'
}

/**
 * Porta e movimento avisam no mesmo lugar da tela (rodapé): dois avisos juntos
 * se sobreporiam. Vale o mais novo — o `id` dos dois sai do mesmo contador.
 */
function isLanding(reason: MoveNoticeReason): reason is TokenMoveLanding {
  return reason === 'nearest_floor'
}

function isVehicleNotice(reason: MoveNoticeReason): reason is VehicleNotice {
  return reason === 'veiculo_cheio' || reason === 'veiculo_longe'
}

/**
 * Texto do motivo do movimento: recusa (não moveu), pouso aceito em outro
 * lugar (moveu, mas não onde pedido) ou a recusa do "Subir" no veículo.
 */
function moveActionText(reason: MoveNoticeReason): string {
  if (isLanding(reason)) return LANDING_NOTICE_TEXT[reason]
  if (isAvisoDaCaminhada(reason)) return CAMINHADA_NOTICE_TEXT[reason]
  return isVehicleNotice(reason) ? VEHICLE_NOTICE_TEXT[reason] : MOVE_NOTICE_TEXT[reason]
}

export function latestActionNotice(
  door: { id: number; reason: DoorToggleRejection } | undefined,
  move: { id: number; reason: MoveNoticeReason } | undefined,
): { id: number; text: string } | null {
  if (move !== undefined && (door === undefined || move.id > door.id)) return { id: move.id, text: moveActionText(move.reason) }
  if (door !== undefined) return { id: door.id, text: DOOR_NOTICE_TEXT[door.reason] }
  return null
}
