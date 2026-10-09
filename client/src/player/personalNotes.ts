import type { Camera, Point } from '../pixi/world'
import { cleanNoteText, MY_NOTES_MAX, type PersonalNote } from '../lib/minhasNotas'

export { cleanNoteText, PERSONAL_NOTE_MAX_LENGTH, type PersonalNote } from '../lib/minhasNotas'

/**
 * ANOTAÇÃO PESSOAL do jogador: "baú trancado aqui" num ponto do próprio mapa.
 *
 * Fica FIXA AO JOGADOR: a lista inteira mora no host, por jogador
 * (`lib/minhasNotas.ts`), e volta a ele em qualquer cena, ao recarregar, ao
 * reconectar e na sessão seguinte. Nenhum colega a recebe. O id do mapa (e não
 * o nome da cena) é a chave de cada nota — o jogador nunca recebe nome de
 * outra cena, e a nota não precisa dele. Aqui ficam as regras da tela.
 */

/** Raio do toque em cima da nota, em px de TELA: o mesmo perdão do dedo na porta e no pino. */
export const PERSONAL_NOTE_TAP_RADIUS_PX = 18

/**
 * Nota nova no fim da lista. Texto que sobra vazio depois de limpo, ou o
 * caderno no teto (`MY_NOTES_MAX`, que o host recusaria), não cria nada (mesma lista).
 */
export function addPersonalNote(notes: readonly PersonalNote[], note: PersonalNote): readonly PersonalNote[] {
  const text = cleanNoteText(note.text)
  if (text === '' || notes.length >= MY_NOTES_MAX) return notes
  return [...notes, { ...note, text }]
}

export function removePersonalNote(notes: readonly PersonalNote[], id: string): readonly PersonalNote[] {
  return notes.filter((note) => note.id !== id)
}

export function notesOnMap(notes: readonly PersonalNote[], mapId: string): PersonalNote[] {
  return notes.filter((note) => note.mapId === mapId)
}

/** As notas de um mapa, para o Caderno: `here` = o mapa da tela agora (só delas a câmera vai até a nota). */
export interface NotesOfMap {
  mapId: string
  here: boolean
  /** Da mais nova para a mais antiga: a lista mostra a mais nova em cima. */
  notes: PersonalNote[]
}

/**
 * MINHAS NOTAS por mapa, para o Caderno: o mapa da tela primeiro; depois os
 * outros, o da nota mais nova antes. Nenhuma nota some por estar em outro
 * mapa — o caderno é do jogador, não da cena.
 */
export function groupNotesByMap(notes: readonly PersonalNote[], currentMapId: string | undefined): NotesOfMap[] {
  const groups = new Map<string, PersonalNote[]>()
  for (const note of [...notes].reverse()) groups.set(note.mapId, [...(groups.get(note.mapId) ?? []), note])
  const list = [...groups].map(([mapId, ofMap]) => ({ mapId, here: mapId === currentMapId, notes: ofMap }))
  return [...list.filter((group) => group.here), ...list.filter((group) => !group.here)]
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
