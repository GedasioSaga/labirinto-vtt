/**
 * MINHAS NOTAS — a anotação pessoal do jogador ("baú trancado aqui") num ponto
 * de um mapa. É DELE e de mais ninguém: o host guarda as notas por jogador
 * (pelo nome, como o resto da mesa guardada, `lib/savedTable.ts`) e as
 * devolve só a ele, em qualquer cena, em qualquer sessão. Nenhum colega as
 * recebe; o mestre só as guarda no arquivo da mesa, não as lê na tela.
 *
 * Aqui mora a regra pura que o jogador, o host e o arquivo da mesa dividem:
 * a forma de uma nota, os tetos e a leitura do que vem de fora.
 */

/** Uma linha curta: o que cabe no balão da nota no mapa. */
export const PERSONAL_NOTE_MAX_LENGTH = 40
/**
 * Teto de notas de um jogador: bem acima de uma campanha, abaixo de um cliente
 * hostil enchendo o host. No pior caso (ids e texto no teto, emoji) a lista
 * inteira ainda cabe em `PLAYER_MESSAGE_MAX_BYTES` (64 KiB).
 */
export const MY_NOTES_MAX = 120
/** Teto do id da nota (o jogador inventa: `nota-<tempo>-<n>-<sorteio>`). */
export const MY_NOTE_ID_MAX_LENGTH = 64
/** Teto do id do mapa onde a nota mora (`MapData.id`). */
export const MY_NOTE_MAP_ID_MAX_LENGTH = 128
/** Coordenada de mundo além disto não é ponto de mapa nenhum: é lixo. */
export const MY_NOTE_COORD_MAX = 1_000_000
/** Uma lista nova por jogador nesta janela; a de dentro dela volta como `too_soon` e o jogador reenvia. */
export const MY_NOTES_MIN_INTERVAL_MS = 500

export interface PersonalNote {
  id: string
  /** Mapa (cena) onde a nota foi posta: cada cena mostra só as dela. */
  mapId: string
  /** Ponto em px de mundo. */
  x: number
  y: number
  text: string
}

/** Uma linha só, sem espaço sobrando, no máximo `PERSONAL_NOTE_MAX_LENGTH` caracteres. Vazio = nada a anotar. */
export function cleanNoteText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, PERSONAL_NOTE_MAX_LENGTH).trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedId(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function isCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MY_NOTE_COORD_MAX
}

/**
 * Uma nota do que vem de fora (rede ou arquivo), com o texto limpo. Fora de
 * forma, texto acima do teto ou vazio depois de limpo: `null`, nunca lança.
 */
export function readPersonalNote(value: unknown): PersonalNote | null {
  if (!isRecord(value)) return null
  const { id, mapId, x, y, text } = value
  if (!isBoundedId(id, MY_NOTE_ID_MAX_LENGTH) || !isBoundedId(mapId, MY_NOTE_MAP_ID_MAX_LENGTH)) return null
  if (!isCoord(x) || !isCoord(y)) return null
  if (typeof text !== 'string' || text.length > PERSONAL_NOTE_MAX_LENGTH) return null
  const clean = cleanNoteText(text)
  return clean === '' ? null : { id, mapId, x, y, text: clean }
}

/**
 * A lista inteira que o JOGADOR manda ao host. Rígida, como as outras
 * mensagens: uma nota torta, id repetido ou mais de `MY_NOTES_MAX` recusam a
 * lista toda (`null`) — gravar metade mudaria o caderno dele sem ele saber.
 */
export function parsePersonalNoteList(value: unknown): PersonalNote[] | null {
  if (!Array.isArray(value) || value.length > MY_NOTES_MAX) return null
  const ids = new Set<string>()
  const notes: PersonalNote[] = []
  for (const item of value) {
    const note = readPersonalNote(item)
    if (note === null || ids.has(note.id)) return null
    ids.add(note.id)
    notes.push(note)
  }
  return notes
}

/**
 * A lista do arquivo da mesa: tolerante, como o resto do que o mestre
 * guarda. Nota torta ou repetida cai sozinha; passou do teto, ficam as mais
 * novas (a lista vai da mais antiga à mais nova).
 */
export function readPersonalNoteList(value: unknown): PersonalNote[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  const notes: PersonalNote[] = []
  for (const item of value.slice(-MY_NOTES_MAX)) {
    const note = readPersonalNote(item)
    if (note === null || ids.has(note.id)) continue
    ids.add(note.id)
    notes.push(note)
  }
  return notes
}

/**
 * A tela manda no máximo uma lista a cada intervalo destes — o dobro do do
 * host, para o atraso da rede não fazer duas listas seguidas caírem dentro da
 * janela dele. Apagar cinco notas seguidas vira uma lista só.
 */
export const MY_NOTES_SEND_INTERVAL_MS = 2 * MY_NOTES_MIN_INTERVAL_MS
