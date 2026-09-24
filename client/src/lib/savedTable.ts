/**
 * RETOMAR A MESA: o arquivo da mesa do mestre. Guarda, por NOME de jogador,
 * as fichas, o raio de visão ajustado e a cena em que ele estava, para a sala
 * reaberta devolver tudo a quem voltar com o mesmo nome — sem o mestre refazer
 * sete atribuições depois de fechar o app.
 *
 * É dado do MESTRE: mora no storage do app dele e nunca vai pela rede. A
 * sessão (`net/hostSession.ts`) só usa os assentos para decidir o dono de uma
 * ficha; o jogador recebe, como sempre, o recorte da própria cena.
 */

export const SAVED_TABLE_VERSION = 1

/** Um jogador da mesa guardada. `visionRadius`/`sceneKey` nulos = sem ajuste / sem cena. */
export interface SavedSeat {
  name: string
  tokenIds: string[]
  visionRadius: number | null
  /** Chave da cena na sessão (`MapData.id`): desempata quem tem ficha em duas cenas. */
  sceneKey: string | null
}

export interface SavedTable {
  version: typeof SAVED_TABLE_VERSION
  /** Código da sala em que a mesa foi gravada. */
  code: string
  seats: SavedSeat[]
}

/** O pedaço de `Storage` que a mesa usa: o `localStorage` real ou um dublê nos testes. */
export interface TableStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Teto de assentos lidos: arquivo adulterado não vira uma lista sem fim no painel. */
const MAX_SEATS = 64

export function savedTableKey(tableId: string): string {
  return `lb-mesa:${tableId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSeat(value: unknown): SavedSeat | null {
  if (!isRecord(value)) return null
  const { name, tokenIds, visionRadius, sceneKey } = value
  if (typeof name !== 'string' || name.trim() === '') return null
  if (!Array.isArray(tokenIds)) return null
  const ids = tokenIds.filter((id): id is string => typeof id === 'string' && id !== '')
  // Sem ficha não há o que devolver: o assento não serve para nada.
  if (ids.length === 0) return null
  return {
    name,
    tokenIds: ids,
    visionRadius: typeof visionRadius === 'number' && Number.isFinite(visionRadius) ? visionRadius : null,
    sceneKey: typeof sceneKey === 'string' && sceneKey !== '' ? sceneKey : null,
  }
}

/** Mesa válida com ao menos um assento, ou `null` (nada a retomar). */
export function parseSavedTable(raw: unknown): SavedTable | null {
  if (!isRecord(raw) || raw.version !== SAVED_TABLE_VERSION || typeof raw.code !== 'string' || !Array.isArray(raw.seats)) return null
  const seats = raw.seats
    .slice(0, MAX_SEATS)
    .map(parseSeat)
    .filter((seat): seat is SavedSeat => seat !== null)
  return seats.length === 0 ? null : { version: SAVED_TABLE_VERSION, code: raw.code, seats }
}

/** Storage bloqueado, cheio ou arquivo corrompido: não há mesa, e nada lança. */
export function loadSavedTable(storage: TableStorage | null, tableId: string): SavedTable | null {
  if (storage === null) return null
  try {
    const text = storage.getItem(savedTableKey(tableId))
    return text === null ? null : parseSavedTable(JSON.parse(text))
  } catch {
    return null
  }
}

export function storeSavedTable(storage: TableStorage | null, tableId: string, table: SavedTable): void {
  if (storage === null) return
  try {
    storage.setItem(savedTableKey(tableId), JSON.stringify(table))
  } catch {
    // Storage cheio ou bloqueado: a mesa desta vez não fica guardada, e a sala segue.
  }
}

/** "A", "A e B", "A, B e C". */
function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** Quem tem ficha guardada, para a pergunta "Retomar a mesa?". */
export function savedTableSummary(table: SavedTable): string {
  return listText(table.seats.map((seat) => seat.name))
}

/**
 * Formato do código de sala que o Rust sorteia (`CODE_ALPHABET`/`CODE_LEN` em
 * `desktop/src-tauri/src/net/commands.rs`): 6 caracteres, sem I, L, O, 0 e 1.
 * Código guardado fora dele (arquivo adulterado) não é pedido de volta.
 */
const ROOM_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/

/** O código guardado que dá para pedir de volta ao reabrir a sala, ou `null`. */
export function preferredRoomCode(table: SavedTable | null): string | null {
  return table !== null && ROOM_CODE_PATTERN.test(table.code) ? table.code : null
}

/** A sala retomada abriu com outro código: quem tinha o link antigo bate em `bad_code`. */
export function roomCodeChangedText(oldCode: string, newCode: string): string {
  return `O código da sala mudou: era ${oldCode}, agora é ${newCode}. Passe o novo código a quem já tinha o antigo.`
}

/** O aviso do mestre quando alguém reencontra a ficha: "Ana voltou: Lírio devolvida". */
export function reclaimText(playerName: string, tokenNames: readonly string[]): string {
  return `${playerName} voltou: ${listText(tokenNames)} ${tokenNames.length > 1 ? 'devolvidas' : 'devolvida'}`
}
