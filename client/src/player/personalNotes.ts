import type { StorageLike } from './playerConnection'
import type { Camera, Point } from '../pixi/world'

/**
 * ANOTAÇÃO PESSOAL do jogador: "baú trancado aqui" num ponto do próprio mapa.
 *
 * Mora SÓ no aparelho (`localStorage`) e nunca vai pelo socket: o mestre e os
 * colegas não sabem que ela existe. Por isso não passa por `playerConnection`,
 * e por isso o id do mapa (e não o nome da cena) é a chave de cada nota — o
 * jogador nunca recebe nome de outra cena, e a nota não precisa dele.
 */

export const PERSONAL_NOTE_MAX_LENGTH = 40
export const PERSONAL_NOTES_KEY = 'labirinto.jogador.notas'
/** Raio do toque em cima da nota, em px de TELA: o mesmo perdão do dedo na porta e no pino. */
export const PERSONAL_NOTE_TAP_RADIUS_PX = 18

export interface PersonalNote {
  id: string
  /** Mapa (cena) onde a nota foi posta: cada cena mostra só as dela. */
  mapId: string
  /** Ponto em px de mundo. */
  x: number
  y: number
  text: string
}

/** Uma linha só, sem espaço sobrando, no máximo 40 caracteres. Vazio = nada a anotar. */
export function cleanNoteText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, PERSONAL_NOTE_MAX_LENGTH).trim()
}

/** Nota nova no fim da lista. Texto que sobra vazio depois de limpo não cria nada (mesma lista). */
export function addPersonalNote(notes: readonly PersonalNote[], note: PersonalNote): readonly PersonalNote[] {
  const text = cleanNoteText(note.text)
  if (text === '') return notes
  return [...notes, { ...note, text }]
}

export function removePersonalNote(notes: readonly PersonalNote[], id: string): readonly PersonalNote[] {
  return notes.filter((note) => note.id !== id)
}

export function notesOnMap(notes: readonly PersonalNote[], mapId: string): PersonalNote[] {
  return notes.filter((note) => note.mapId === mapId)
}

/**
 * A nota sob o dedo, pelo ponto de TELA e a câmera de agora: a mais perto,
 * dentro de `radiusPx`. O raio é de tela para valer igual em qualquer zoom.
 */
export function personalNoteAtScreen(
  notes: readonly PersonalNote[],
  screen: Point,
  camera: Camera,
  radiusPx: number = PERSONAL_NOTE_TAP_RADIUS_PX,
): string | null {
  let best: string | null = null
  let bestDistance = radiusPx
  for (const note of notes) {
    const distance = Math.hypot(note.x * camera.scale + camera.x - screen.x, note.y * camera.scale + camera.y - screen.y)
    if (distance <= bestDistance) {
      best = note.id
      bestDistance = distance
    }
  }
  return best
}

let idCounter = 0

/**
 * Id local da nota. Sem `crypto.randomUUID`: a página do jogador abre em
 * `http://` na rede local, que não é contexto seguro, e lá ele não existe.
 */
export function newPersonalNoteId(): string {
  idCounter += 1
  return `nota-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readNote(value: unknown): PersonalNote | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const { id, mapId, x, y, text } = value as Record<string, unknown> // objeto não-nulo e não-array conferido acima; cada campo é checado abaixo
  if (typeof id !== 'string' || id === '' || typeof mapId !== 'string') return null
  if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) return null
  if (typeof text !== 'string') return null
  const clean = cleanNoteText(text)
  return clean === '' ? null : { id, mapId, x, y, text: clean }
}

/** O que está no aparelho vem de fora do código: item fora do formato cai fora, nunca lança. */
export function loadPersonalNotes(storage: StorageLike | null): PersonalNote[] {
  let raw: string | null
  try {
    raw = storage?.getItem(PERSONAL_NOTES_KEY) ?? null
  } catch {
    return []
  }
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((item: unknown) => {
    const note = readNote(item)
    return note === null ? [] : [note]
  })
}

/** Armazenamento cheio ou bloqueado (aba anônima): a nota vale só enquanto a página estiver aberta. */
export function savePersonalNotes(storage: StorageLike | null, notes: readonly PersonalNote[]): void {
  try {
    storage?.setItem(PERSONAL_NOTES_KEY, JSON.stringify(notes))
  } catch {
    // Sem persistência: nada a fazer além de não derrubar a partida.
  }
}
