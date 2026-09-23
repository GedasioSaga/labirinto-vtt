import type { RoomMeta } from '../types/map'

/**
 * TEXTO DA SALA: o que o jogador lê ao entrar num cômodo
 * (`RoomMeta.textoAoEntrar`). O teto vale para o campo do mestre, para o
 * recorte do jogador (`lib/fogFilter.ts`) e para a mensagem `room.text`
 * (`net/protocol.ts`), em unidades UTF-16 — a mesma conta do `maxLength`.
 */
export const ROOM_TEXT_MAX_LENGTH = 2000

/** A Sala tem texto de entrada de verdade: só espaço não conta como texto. */
export function hasEnterText(room: RoomMeta | undefined): boolean {
  return room?.textoAoEntrar !== undefined && room.textoAoEntrar.trim().length > 0
}

/**
 * Corta no teto sem deixar meia letra no fim: um emoji partido (surrogate alto
 * sozinho) viraria um losango de erro na tela do jogador.
 */
export function clampRoomText(text: string): string {
  if (text.length <= ROOM_TEXT_MAX_LENGTH) return text
  const cut = text.slice(0, ROOM_TEXT_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}
