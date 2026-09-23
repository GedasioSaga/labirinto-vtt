import { ROOM_TEXT_MAX_LENGTH, clampRoomText } from './roomText'

/**
 * MINHAS PISTAS: o que o jogador leu (cartão de pino, texto de Sala) e ficou no
 * caderno dele. Tetos da pista, valendo para o host (`net/hostSession.ts`), a
 * mensagem (`net/protocol.ts`) e a tela, em unidades UTF-16.
 */

/** Título da pista na lista do Caderno: a primeira linha do texto, cortada aqui. */
export const CLUE_TITLE_MAX_LENGTH = 60
/** Texto da pista: o mesmo teto do texto de Sala (o maior texto que o jogador lê num cartão). */
export const CLUE_TEXT_MAX_LENGTH = ROOM_TEXT_MAX_LENGTH
/** Quantas pistas o caderno de cada jogador guarda. Passou, sai a mais antiga. */
export const CLUEBOOK_MAX_CLUES = 30

/** Título quando o cartão só tem foto: sem texto não há primeira linha para nomear a pista. */
export const CLUE_TITLE_ONLY_IMAGE = 'Imagem do mestre'

/** Corta sem deixar meia letra no fim (emoji partido vira losango de erro na tela). */
function clampUtf16(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/**
 * Título da pista: a primeira linha com conteúdo de `text`, aparada. Longa
 * demais, termina em "…" dentro do teto. Sem linha nenhuma, `fallback`.
 */
export function clueTitleFrom(text: string, fallback: string): string {
  const first = text.split('\n').map((line) => line.trim()).find((line) => line !== '')
  if (first === undefined) return clampUtf16(fallback, CLUE_TITLE_MAX_LENGTH)
  if (first.length <= CLUE_TITLE_MAX_LENGTH) return first
  return `${clampUtf16(first, CLUE_TITLE_MAX_LENGTH - 1).trimEnd()}…`
}

/** Texto da pista dentro do teto. */
export function clampClueText(text: string): string {
  return clampRoomText(text)
}
