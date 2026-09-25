import type { DoorToggleRejection } from '../net/protocol'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
export const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  // Porta de um lado: não diz de que lado abre, só que deste não.
  wrong_side: 'Não abre deste lado',
}
