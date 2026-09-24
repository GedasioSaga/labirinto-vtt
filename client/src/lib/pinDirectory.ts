import type { Pin } from '../types/map'
import { cleanPinName, pinMasterLabel } from './pins'
import { pinFocusPoint } from './pinTravel'

/**
 * LISTA "PINOS" do mestre: todos os pinos da aventura numa lista só, com
 * busca e filtro por cena. Puro: quem junta as cenas é
 * `stores/adventureStore.ts` (`pinScenesOf`), quem desenha é
 * `components/PinsSection.tsx`. Nada daqui vai ao jogador — o nome é só do
 * mestre, e a lista mostra pino de cena que o jogador nem sabe que existe.
 */

/** Uma cena como a lista a enxerga. `sceneId: null` = mapa solto (sem aventura). */
export interface PinDirectoryScene {
  sceneId: string | null
  sceneName: string
  pins: readonly Pin[]
}

/** Uma linha da lista. */
export interface PinDirectoryEntry {
  sceneId: string | null
  sceneName: string
  pinId: string
  /** O nome só do mestre, aparado; `''` = sem nome. */
  nome: string
  /** O que a linha mostra: o nome ou, sem nome, o resumo de sempre (`pinMasterLabel`). */
  label: string
  description: string
  /** Onde a câmera centraliza ao ir até o pino: o meio do desenho. */
  focus: { x: number; y: number }
}

/** Os pinos das cenas, na ordem das cenas e, dentro de cada uma, na ordem do mapa. */
export function pinDirectory(scenes: readonly PinDirectoryScene[]): PinDirectoryEntry[] {
  return scenes.flatMap((scene) =>
    scene.pins.map((pin) => ({
      sceneId: scene.sceneId,
      sceneName: scene.sceneName,
      pinId: pin.id,
      nome: cleanPinName(pin.nome),
      label: pinMasterLabel(pin),
      description: pin.description,
      focus: pinFocusPoint(pin),
    })),
  )
}

/** Sem caixa e sem acento: "LAMINA" acha "lâmina". */
function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * As linhas que batem com a busca (no nome, no rótulo ou na descrição) e, com
 * `sceneId` diferente de `null`, só as daquela cena. Busca em branco = tudo.
 */
export function searchPins(entries: readonly PinDirectoryEntry[], query: string, sceneId: string | null): PinDirectoryEntry[] {
  const needle = foldForSearch(query.trim())
  return entries.filter((entry) => {
    if (sceneId !== null && entry.sceneId !== sceneId) return false
    if (needle === '') return true
    return [entry.label, entry.nome, entry.description].some((text) => foldForSearch(text).includes(needle))
  })
}
