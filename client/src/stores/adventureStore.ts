import { create } from 'zustand'
import type { MapData } from '../types/map'
import * as mapFactory from '../lib/mapFactory'
import { ADVENTURE_VERSION, baseName, cleanSceneName, newSceneId, sceneFileFor, type Adventure, type SceneEntry } from '../lib/adventure'
import { mapDirFor, saveAdventureToDisk, scenePath, type OpenedMapFile } from '../lib/mapFileIO'
import { dirname } from '@tauri-apps/api/path'
import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'

/**
 * AVENTURA COM VÁRIAS CENAS, do lado do editor do mestre.
 *
 * A cena ABERTA mora no `useMapStore`, como qualquer mapa sempre morou — o
 * canvas, o desfazer e a rede continuam lendo de lá sem saber de aventura. As
 * OUTRAS cenas moram aqui, em `cache`, cada uma com o próprio histórico de
 * desfazer: trocar de cena guarda o `{ map, past, future }` da que sai e
 * devolve o da que entra. Por isso mudança numa cena de fundo nunca entra no
 * desfazer da cena aberta (`updateBackgroundScene` não toca no `useMapStore`).
 *
 * `adventure === null` é o mapa solto de sempre: nada aqui interfere nele. A
 * aventura nasce na primeira `createScene`.
 *
 * Gravar é `flush`: escreve a cena aberta, as de fundo com mudança pendente e
 * por último o `adventure.json`. Trocar de cena NÃO grava no disco — só no
 * cache —, então a troca funciona igual sem Tauri e nunca falha no meio.
 */

/** Cena de fundo: o mapa e o desfazer dela, ou o motivo de não ter aberto. */
export type SceneSlot =
  | { status: 'ok'; map: MapData; past: MapData[]; future: MapData[] }
  | { status: 'indisponivel'; reason: string }

/** Uma linha da lista "Cenas". */
export interface SceneListItem {
  id: string
  name: string
  /** `null` quando a cena não abriu (arquivo sumido): não há mapa para contar. */
  tokenCount: number | null
  available: boolean
  active: boolean
  /** Mapa solto não tem nome de cena para trocar: o nome dele é o do arquivo. */
  renamable: boolean
}

interface AdventureState {
  adventure: Adventure | null
  /** Pasta da aventura. `null` enquanto ela ainda não foi gravada nenhuma vez. */
  dir: string | null
  /** Arquivo do mapa solto que virou a primeira cena; resolve `dir` no primeiro `flush`. */
  rootPath: string | null
  /** Id do mapa da primeira cena; resolve `dir` quando o mapa solto nunca foi salvo. */
  rootMapId: string | null
  activeSceneId: string | null
  /** De onde se veio na última troca: é para lá que o Voltar leva. */
  previousSceneId: string | null
  /** Cenas FORA de edição. A aberta está no `useMapStore`. */
  cache: Record<string, SceneSlot>
  /** Cenas cujo conteúdo em memória ainda não foi gravado. */
  dirty: Record<string, true>
  /** A lista de cenas (nome, cena nova) mudou desde a última gravação. */
  structureDirty: boolean

  /** Mapa novo ou solto: esquece qualquer aventura anterior. */
  reset: () => void
  /** Assume o que `openMapFile` leu e põe a cena pedida no editor. */
  open: (opened: OpenedMapFile) => void
  /** Cria a cena, já aberta. `loosePath` é o arquivo do mapa solto, quando a aventura nasce agora. */
  createScene: (name: string, loosePath: string | null) => string
  renameScene: (sceneId: string, name: string) => void
  /** Troca a cena aberta. `false` quando não há o que trocar (mesma cena, cena indisponível). */
  switchScene: (sceneId: string) => boolean
  /** Muda uma cena de FUNDO sem passar pelo desfazer da cena aberta. */
  updateBackgroundScene: (sceneId: string, updater: (map: MapData) => MapData) => void
  /** Há cena de fundo ou lista de cenas esperando gravação? (A cena aberta é o `useSessionStore` que diz.) */
  hasPendingScenes: () => boolean
  /** Grava a aventura inteira e devolve o caminho da cena aberta. */
  flush: () => Promise<string>
}

const EMPTY = {
  adventure: null,
  dir: null,
  rootPath: null,
  rootMapId: null,
  activeSceneId: null,
  previousSceneId: null,
  cache: {},
  dirty: {},
  structureDirty: false,
} satisfies Partial<AdventureState>

/** Lista pronta para a tela: a cena aberta conta os tokens do mapa vivo. */
export function sceneList(state: Pick<AdventureState, 'adventure' | 'activeSceneId' | 'cache'>, liveMap: MapData): SceneListItem[] {
  if (state.adventure === null) {
    return [{ id: '', name: liveMap.name, tokenCount: liveMap.tokens.length, available: true, active: true, renamable: false }]
  }
  return state.adventure.scenes.map((entry) => {
    const active = entry.id === state.activeSceneId
    const slot = state.cache[entry.id]
    const base = { id: entry.id, name: entry.name, active, renamable: true }
    if (active) return { ...base, tokenCount: liveMap.tokens.length, available: true }
    if (slot === undefined || slot.status !== 'ok') return { ...base, tokenCount: null, available: false }
    return { ...base, tokenCount: slot.map.tokens.length, available: true }
  })
}

/** Põe um mapa no editor com o desfazer que ele já tinha, e marca esse ponto como "igual ao cache". */
function showInEditor(map: MapData, past: MapData[], future: MapData[]): void {
  useMapStore.getState().loadMap(map)
  useMapStore.setState({ past, future })
  useSessionStore.getState().markSaved()
}

export const useAdventureStore = create<AdventureState>()((set, get) => ({
  ...EMPTY,

  reset: () => set({ ...EMPTY }),

  open: (opened) => {
    if (opened.adventure === null || opened.activeSceneId === null) {
      set({ ...EMPTY })
      showInEditor(opened.map, [], [])
      return
    }
    const cache: Record<string, SceneSlot> = {}
    for (const load of opened.scenes) {
      if (load.entry.id === opened.activeSceneId) continue
      cache[load.entry.id] = load.status === 'ok' ? { status: 'ok', map: load.map, past: [], future: [] } : { status: 'indisponivel', reason: load.reason }
    }
    const dirty: Record<string, true> = {}
    for (const id of opened.changedSceneIds) dirty[id] = true
    set({
      ...EMPTY,
      adventure: opened.adventure,
      dir: opened.adventureDir,
      activeSceneId: opened.activeSceneId,
      cache,
      dirty,
      structureDirty: opened.adventureChanged,
    })
    showInEditor(opened.map, [], [])
  },

  createScene: (name, loosePath) => {
    const live = useMapStore.getState().map
    const state = get()
    let adventure = state.adventure
    let activeSceneId = state.activeSceneId
    const born = adventure === null || activeSceneId === null
    if (adventure === null || activeSceneId === null) {
      const root: SceneEntry = { id: newSceneId(), name: live.name, file: loosePath ? baseName(loosePath) : 'map.json' }
      adventure = { version: ADVENTURE_VERSION, id: `adv_${crypto.randomUUID()}`, name: live.name, startSceneId: root.id, scenes: [root] }
      activeSceneId = root.id
    }
    const id = newSceneId()
    const sceneName = cleanSceneName(name)
    const map = mapFactory.createEmptyMap(`map_${crypto.randomUUID()}`, sceneName, live.width, live.height, live.grid)
    set({
      adventure: { ...adventure, scenes: [...adventure.scenes, { id, name: sceneName, file: sceneFileFor(id) }] },
      activeSceneId,
      ...(born ? { rootPath: loosePath, rootMapId: live.id, dir: null } : {}),
      cache: { ...state.cache, [id]: { status: 'ok', map, past: [], future: [] } },
      dirty: { ...state.dirty, [id]: true },
      structureDirty: true,
    })
    get().switchScene(id)
    return id
  },

  renameScene: (sceneId, name) => {
    const { adventure } = get()
    if (adventure === null) return
    const sceneName = cleanSceneName(name)
    set({
      adventure: { ...adventure, scenes: adventure.scenes.map((entry) => (entry.id === sceneId ? { ...entry, name: sceneName } : entry)) },
      structureDirty: true,
    })
  },

  switchScene: (sceneId) => {
    const { activeSceneId, cache, dirty } = get()
    if (activeSceneId === null || sceneId === activeSceneId) return false
    const target = cache[sceneId]
    if (target === undefined || target.status !== 'ok') return false

    const { map, past, future } = useMapStore.getState()
    const leavingDirty = useSessionStore.getState().isDirty || dirty[activeSceneId] === true
    const nextCache: Record<string, SceneSlot> = { ...cache, [activeSceneId]: { status: 'ok', map, past, future } }
    delete nextCache[sceneId]
    const nextDirty: Record<string, true> = { ...dirty }
    if (leavingDirty) nextDirty[activeSceneId] = true

    set({ cache: nextCache, dirty: nextDirty, activeSceneId: sceneId, previousSceneId: activeSceneId })
    showInEditor(target.map, target.past, target.future)
    return true
  },

  updateBackgroundScene: (sceneId, updater) => {
    const { cache, dirty } = get()
    const slot = cache[sceneId]
    if (slot === undefined || slot.status !== 'ok') return
    const map = updater(slot.map)
    if (map === slot.map) return
    set({ cache: { ...cache, [sceneId]: { ...slot, map } }, dirty: { ...dirty, [sceneId]: true } })
  },

  hasPendingScenes: () => {
    const { adventure, dirty, structureDirty } = get()
    return adventure !== null && (structureDirty || Object.keys(dirty).length > 0)
  },

  flush: async () => {
    const state = get()
    const { adventure, activeSceneId } = state
    if (adventure === null || activeSceneId === null) throw new Error('Não há aventura aberta para gravar.')

    let dir = state.dir
    if (dir === null) {
      if (state.rootPath !== null) dir = await dirname(state.rootPath)
      else if (state.rootMapId !== null) dir = await mapDirFor(state.rootMapId)
      else throw new Error('A aventura não tem pasta para gravar.')
    }

    const live = useMapStore.getState().map
    const writes: { file: string; map: MapData }[] = []
    let activeFile: string | null = null
    for (const entry of adventure.scenes) {
      if (entry.id === activeSceneId) {
        activeFile = entry.file
        writes.push({ file: entry.file, map: live })
        continue
      }
      const slot = state.cache[entry.id]
      if (slot !== undefined && slot.status === 'ok' && state.dirty[entry.id] === true) writes.push({ file: entry.file, map: slot.map })
    }
    if (activeFile === null) throw new Error('A cena aberta não está na lista da aventura.')

    await saveAdventureToDisk(dir, adventure, writes)
    // Só o que foi escrito sai de "pendente": mudança feita enquanto o disco
    // gravava continua pendente na próxima conta (o mapa vivo é comparado de
    // novo pelo `markSaved` abaixo, que ancora no mapa que acabou de ir).
    set({ dir, rootPath: null, rootMapId: null, dirty: {}, structureDirty: false })
    if (useMapStore.getState().map === live) useSessionStore.getState().markSaved()
    return scenePath(dir, activeFile)
  },
}))

/** Leitura síncrona para quem pergunta "há trabalho não salvo?" (fechar janela, trocar de mapa). */
export function hasUnsavedWork(): boolean {
  return useSessionStore.getState().isDirty || useAdventureStore.getState().hasPendingScenes()
}
