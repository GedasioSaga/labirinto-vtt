import { create } from 'zustand'
import type { MapData, Pin, PinDestination, Token } from '../types/map'
import { singleSceneWorld, type HostScene, type HostWorld } from '../net/hostSession'
import type { Camera, Point } from '../pixi/world'
import * as mapFactory from '../lib/mapFactory'
import { ADVENTURE_VERSION, baseName, cleanSceneName, newSceneId, sceneFileFor, type Adventure, type SceneEntry } from '../lib/adventure'
import {
  arrivalPoint,
  linkBack,
  pinFocusPoint,
  resolvePinTravel,
  sameDestination,
  travelLinkChanges,
  travelPinOptions,
  unlinkBack,
  type PinTravel,
  type TravelPinOption,
  type TravelScene,
  type TravelSceneOption,
} from '../lib/pinTravel'
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

/**
 * Cena de fundo: o mapa, o desfazer e a câmera dela, ou o motivo de não ter
 * aberto. `camera: null` = cena ainda não vista nesta sessão: ao entrar, ela
 * é enquadrada. A câmera só vive em memória, nunca vai ao disco.
 */
export type SceneSlot =
  | { status: 'ok'; map: MapData; past: MapData[]; future: MapData[]; camera: Camera | null }
  | { status: 'indisponivel'; reason: string }

/**
 * O que o canvas deve fazer com a câmera depois de uma troca de cena: voltar
 * a `camera`, ou enquadrar o conteúdo quando `null`. Um objeto novo por troca
 * — o canvas reage à identidade, como ao contador do reset de zoom.
 */
export interface CameraRequest {
  camera: Camera | null
  /**
   * Chegada por um pino de viagem: o ponto do mundo que fica no centro da
   * tela, com o zoom de `camera` (ou o de agora, na cena nunca vista). Ausente
   * na troca comum pela lista de Cenas.
   */
  focus?: Point
  /**
   * `focus` vai ao centro da parte do canvas que os painéis NÃO cobrem, em vez
   * do centro do canvas inteiro. É o do "Seguir" (G7): a ficha seguida anda
   * para os lados, e no centro do canvas ela some sob o painel à esquerda.
   */
  focusInFreeArea?: true
}

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
  /** Último pedido de câmera da troca de cena; `null` até a primeira troca. */
  cameraRequest: CameraRequest | null

  /** Mapa novo ou solto: esquece qualquer aventura anterior. */
  reset: () => void
  /** Assume o que `openMapFile` leu e põe a cena pedida no editor. */
  open: (opened: OpenedMapFile) => void
  /** Cria a cena, já aberta. `loosePath` é o arquivo do mapa solto, quando a aventura nasce agora. */
  createScene: (name: string, loosePath: string | null) => string
  renameScene: (sceneId: string, name: string) => void
  /**
   * Troca a cena aberta. `false` quando não há o que trocar (mesma cena, cena
   * indisponível). `focus` centraliza a câmera nesse ponto da cena que entra.
   */
  switchScene: (sceneId: string, focus?: Point, focusInFreeArea?: boolean) => boolean
  /**
   * "Ir lá": o editor mostra `point` da cena `sceneId` no centro da tela. Se a
   * cena já está aberta (ou é o mapa solto, `null`), só a câmera anda — a
   * troca de cena recusaria "mesma cena" e o clique não faria nada.
   */
  goToPoint: (sceneId: string | null, point: Point, focusInFreeArea?: boolean) => boolean
  /** Muda uma cena de FUNDO sem passar pelo desfazer da cena aberta. */
  updateBackgroundScene: (sceneId: string, updater: (map: MapData) => MapData) => void
  /**
   * Liga o pino de viagem `pinId` (da cena aberta) a um pino de chegada NOVO,
   * que nasce no centro de `sceneId`. A volta é gravada pelo guardião da mão
   * dupla (ver `syncTravelLinks`). Devolve o id da chegada, ou `null` se não
   * deu para ligar.
   */
  linkPinToNewArrival: (pinId: string, sceneId: string) => string | null
  /** Liga o pino de viagem `pinId` ao pino de viagem `partnerId`, que já existe em `sceneId`. */
  linkPinToExisting: (pinId: string, sceneId: string, partnerId: string) => boolean
  /** Desliga o pino e, pelo guardião, o par dele. Entra no desfazer da cena aberta. */
  unlinkPin: (pinId: string) => void
  /**
   * Leva a visão do mestre pelo pino ligado: abre a cena de destino com o par
   * no centro da tela e aberto no painel. `false` quando o pino não leva a
   * lugar nenhum.
   */
  travelThroughPin: (pinId: string) => boolean
  /**
   * O jogador atravessou: tira o token `tokenId` da cena `fromSceneId` e o
   * põe em (`x`, `y`) da cena `toSceneId`. FORA DO DESFAZER nas duas pontas —
   * ver `transferToken` abaixo. `false` quando não deu (cena fora do ar,
   * token que já não está lá, mesma cena).
   */
  transferToken: (tokenId: string, fromSceneId: string, toSceneId: string, x: number, y: number) => boolean
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
  cameraRequest: null,
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

type SceneState = Pick<AdventureState, 'adventure' | 'activeSceneId' | 'cache'>

/**
 * As cenas da aventura como a ligação dos pinos de viagem as enxerga: a
 * aberta pelo mapa vivo, as de fundo pelo cache. Cena fora da aventura é `null`.
 */
function sceneLookup(state: SceneState, liveMap: MapData): (sceneId: string) => TravelScene | null {
  return (sceneId) => {
    const entry = state.adventure?.scenes.find((scene) => scene.id === sceneId)
    if (entry === undefined) return null
    if (sceneId === state.activeSceneId) return { name: entry.name, map: liveMap }
    const slot = state.cache[sceneId]
    return { name: entry.name, map: slot !== undefined && slot.status === 'ok' ? slot.map : null }
  }
}

/** Para onde o pino da cena aberta leva — o que o painel diz e o que o clique faz. */
export function pinTravelOf(state: SceneState, liveMap: MapData, pin: Pin): PinTravel {
  return resolvePinTravel(pin, state.activeSceneId, sceneLookup(state, liveMap))
}

/** Pinos de viagem da cena aberta que não levam a lugar nenhum: o canvas os desenha apagados. */
export function unlinkedTravelPinIds(state: SceneState, liveMap: MapData): Set<string> {
  const ids = new Set<string>()
  const lookup = sceneLookup(state, liveMap)
  for (const pin of liveMap.pins) {
    if (pin.kind === 'viagem' && resolvePinTravel(pin, state.activeSceneId, lookup).status !== 'ligado') ids.add(pin.id)
  }
  return ids
}

/** As cenas para onde um pino da cena aberta pode levar: todas as outras. */
export function travelSceneOptions(state: SceneState): TravelSceneOption[] {
  if (state.adventure === null) return []
  return state.adventure.scenes
    .filter((entry) => entry.id !== state.activeSceneId)
    .map((entry) => {
      const slot = state.cache[entry.id]
      return { id: entry.id, name: entry.name, available: slot !== undefined && slot.status === 'ok' }
    })
}

/** Os pinos de viagem de `sceneId` que o pino `pinId` da cena aberta pode escolher como par. */
export function pinTravelOptions(state: SceneState, liveMap: MapData, sceneId: string, pinId: string): TravelPinOption[] {
  return travelPinOptions(sceneId, state.activeSceneId, pinId, sceneLookup(state, liveMap))
}

/**
 * O que o host serve (`net/hostSession.ts`): a cena aberta pelo mapa vivo e as
 * de fundo que abriram, cada uma com o nome da lista. Sem aventura, o mapa
 * solto sozinho — e aí todo jogador vê a cena aberta, como sempre.
 */
export function hostWorldOf(state: SceneState, liveMap: MapData): HostWorld {
  if (state.adventure === null || state.activeSceneId === null) return singleSceneWorld(liveMap)
  const background: HostScene[] = []
  let openName = liveMap.name
  for (const entry of state.adventure.scenes) {
    if (entry.id === state.activeSceneId) {
      openName = entry.name
      continue
    }
    const slot = state.cache[entry.id]
    if (slot !== undefined && slot.status === 'ok') background.push({ sceneId: entry.id, name: entry.name, map: slot.map })
  }
  return { open: { sceneId: state.activeSceneId, name: openName, map: liveMap }, background }
}

/** Um mapa com o desfazer dele: a cena aberta (no `useMapStore`) ou uma de fundo (no cache). */
interface SceneHistory {
  map: MapData
  past: MapData[]
  future: MapData[]
}

/*
 * A TRAVESSIA NÃO ENTRA NO DESFAZER. Tirar o token só do mapa atual deixaria
 * o `past` inteiro com ele: um Ctrl+Z na cena de origem o traria de volta, e
 * o mesmo token estaria nas DUAS cenas. Por isso o token sai de todo passo do
 * histórico da origem (passado e futuro) e entra em todo passo do histórico
 * do destino: desfazer e refazer andam pelo resto da edição sem nunca
 * duplicar nem perder a ficha de um jogador.
 */
function withoutToken(history: SceneHistory, tokenId: string): SceneHistory {
  const drop = (map: MapData): MapData => (map.tokens.some((t) => t.id === tokenId) ? mapFactory.removeToken(map, tokenId) : map)
  return { map: drop(history.map), past: history.past.map(drop), future: history.future.map(drop) }
}

function withToken(history: SceneHistory, token: Token): SceneHistory {
  const put = (map: MapData): MapData =>
    map.tokens.some((t) => t.id === token.id) ? { ...map, tokens: map.tokens.map((t) => (t.id === token.id ? token : t)) } : mapFactory.addToken(map, token)
  return { map: put(history.map), past: history.past.map(put), future: history.future.map(put) }
}

/**
 * `true` enquanto uma cena ENTRA no editor. `loadMap` troca o mapa inteiro, e
 * isso não é edição: sem esta trava o guardião da mão dupla leria os pinos da
 * cena que saiu como "apagados" e desligaria todos os pares deles.
 */
let sceneLoading = false

/** Põe um mapa no editor com o desfazer que ele já tinha, e marca esse ponto como "igual ao cache". */
function showInEditor(map: MapData, past: MapData[], future: MapData[]): void {
  sceneLoading = true
  try {
    useMapStore.getState().loadMap(map)
    useMapStore.setState({ past, future })
  } finally {
    sceneLoading = false
  }
  useSessionStore.getState().markSaved()
}

/** Pedido de câmera com ponto no centro; o campo da área livre só existe quando pedido. */
function focusRequest(camera: Camera | null, focus: Point, focusInFreeArea: boolean | undefined): CameraRequest {
  return focusInFreeArea === true ? { camera, focus, focusInFreeArea: true } : { camera, focus }
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
      cache[load.entry.id] =
        load.status === 'ok' ? { status: 'ok', map: load.map, past: [], future: [], camera: null } : { status: 'indisponivel', reason: load.reason }
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
      cache: { ...state.cache, [id]: { status: 'ok', map, past: [], future: [], camera: null } },
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

  switchScene: (sceneId, focus, focusInFreeArea) => {
    const { activeSceneId, cache, dirty } = get()
    if (activeSceneId === null || sceneId === activeSceneId) return false
    const target = cache[sceneId]
    if (target === undefined || target.status !== 'ok') return false

    // A câmera da cena que sai fica com ela: voltar a essa cena devolve a vista de onde se saiu.
    const { map, past, future, camera } = useMapStore.getState()
    const leavingDirty = useSessionStore.getState().isDirty || dirty[activeSceneId] === true
    const nextCache: Record<string, SceneSlot> = { ...cache, [activeSceneId]: { status: 'ok', map, past, future, camera } }
    delete nextCache[sceneId]
    const nextDirty: Record<string, true> = { ...dirty }
    if (leavingDirty) nextDirty[activeSceneId] = true

    set({
      cache: nextCache,
      dirty: nextDirty,
      activeSceneId: sceneId,
      previousSceneId: activeSceneId,
      // Cena nunca vista nesta sessão (camera null) é enquadrada pelo canvas.
      // Chegada por pino: a câmera centraliza o pino par, no zoom da cena.
      cameraRequest: focus === undefined ? { camera: target.camera } : focusRequest(target.camera, focus, focusInFreeArea),
    })
    showInEditor(target.map, target.past, target.future)
    return true
  },

  goToPoint: (sceneId, point, focusInFreeArea) => {
    if (sceneId === null || sceneId === get().activeSceneId) {
      // `camera: null` com `focus`: o canvas centra no ponto com o zoom de agora.
      set({ cameraRequest: focusRequest(null, point, focusInFreeArea) })
      return true
    }
    return get().switchScene(sceneId, point, focusInFreeArea)
  },

  updateBackgroundScene: (sceneId, updater) => {
    const { cache, dirty } = get()
    const slot = cache[sceneId]
    if (slot === undefined || slot.status !== 'ok') return
    const map = updater(slot.map)
    if (map === slot.map) return
    set({ cache: { ...cache, [sceneId]: { ...slot, map } }, dirty: { ...dirty, [sceneId]: true } })
  },

  linkPinToNewArrival: (pinId, sceneId) => {
    const { activeSceneId, cache } = get()
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    const slot = cache[sceneId]
    if (pin === undefined || pin.kind !== 'viagem' || activeSceneId === null || sceneId === activeSceneId) return null
    if (slot === undefined || slot.status !== 'ok') return null
    // A chegada nasce SEM destino: quem grava a volta é o guardião, quando a
    // ida é gravada logo abaixo — o mesmo caminho do desfazer e do refazer.
    const arrival = mapFactory.buildPin(crypto.randomUUID(), arrivalPoint(slot.map), 'viagem')
    get().updateBackgroundScene(sceneId, (map) => mapFactory.addPin(map, arrival))
    useMapStore.getState().updatePin(pinId, { destino: { sceneId, pinId: arrival.id } })
    return arrival.id
  },

  linkPinToExisting: (pinId, sceneId, partnerId) => {
    const { activeSceneId, cache } = get()
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    const slot = cache[sceneId]
    if (pin === undefined || pin.kind !== 'viagem' || activeSceneId === null || sceneId === activeSceneId) return false
    if (slot === undefined || slot.status !== 'ok') return false
    const partner = slot.map.pins.find((p) => p.id === partnerId)
    if (partner === undefined || partner.kind !== 'viagem') return false
    const destino: PinDestination = { sceneId, pinId: partnerId }
    // Um par, uma volta: outro pino DESTA cena que chegava no mesmo par perde a
    // ligação antes — senão dois pinos daqui levariam ao lugar que só traz um de volta.
    for (const other of live.pins) {
      if (other.id !== pinId && sameDestination(other.destino, destino)) useMapStore.getState().updatePin(other.id, { destino: null })
    }
    useMapStore.getState().updatePin(pinId, { destino })
    return true
  },

  unlinkPin: (pinId) => {
    useMapStore.getState().updatePin(pinId, { destino: null })
  },

  travelThroughPin: (pinId) => {
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined) return false
    const travel = pinTravelOf(get(), live, pin)
    if (travel.status !== 'ligado') return false
    if (!get().switchScene(travel.sceneId, pinFocusPoint(travel.partner))) return false
    // O par aberto no painel: é ele que diz "leva de volta a …" e é nele que
    // o próximo clique atravessa de volta.
    useMapStore.getState().setSelectedPin(travel.partner.id)
    return true
  },

  transferToken: (tokenId, fromSceneId, toSceneId, x, y) => {
    const { activeSceneId, cache, dirty } = get()
    if (activeSceneId === null || fromSceneId === toSceneId) return false
    const read = (sceneId: string): SceneHistory | null => {
      if (sceneId === activeSceneId) {
        const { map, past, future } = useMapStore.getState()
        return { map, past, future }
      }
      const slot = cache[sceneId]
      return slot !== undefined && slot.status === 'ok' ? { map: slot.map, past: slot.past, future: slot.future } : null
    }
    const from = read(fromSceneId)
    const to = read(toSceneId)
    const token = from?.map.tokens.find((t) => t.id === tokenId)
    if (from === null || to === null || token === undefined) return false

    const leaving = withoutToken(from, tokenId)
    const arriving = withToken(to, { ...token, x, y })
    const nextCache: Record<string, SceneSlot> = { ...cache }
    const nextDirty: Record<string, true> = { ...dirty }
    let openScene: SceneHistory | null = null
    for (const [sceneId, history] of [
      [fromSceneId, leaving],
      [toSceneId, arriving],
    ] as const) {
      if (sceneId === activeSceneId) {
        openScene = history
        continue
      }
      const slot = cache[sceneId]
      if (slot === undefined || slot.status !== 'ok') return false
      nextCache[sceneId] = { ...slot, ...history }
      nextDirty[sceneId] = true
    }
    set({ cache: nextCache, dirty: nextDirty })
    // A cena aberta troca mapa E histórico juntos, sem `withHistory`: a
    // travessia não é um passo do mestre para o Ctrl+Z desfazer.
    if (openScene !== null) useMapStore.setState({ map: openScene.map, past: openScene.past, future: openScene.future })
    return true
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

/**
 * GUARDIÃO DA MÃO DUPLA do pino de viagem.
 *
 * O mestre só edita a cena ABERTA; o par de um pino de viagem mora sempre em
 * OUTRA cena. Então toda mudança de ligação vista aqui — ligar, desligar,
 * religar, apagar o pino, deixar de ser viagem, e também o Ctrl+Z e o Ctrl+Y
 * de qualquer uma delas — é espelhada no par, na cena de fundo, por
 * `updateBackgroundScene`: fora do desfazer da cena aberta, como toda mudança
 * de cena de fundo. Um lugar só, em vez de um remendo em cada botão, atalho e
 * borracha que tira pino do mapa.
 *
 * Só olha EDIÇÃO: troca de cena (`sceneLoading`) e mapa de outro id (abrir,
 * criar) não são mudança de pino, são outro mapa entrando.
 *
 * Liga-se UMA VEZ, na raiz do app, como `subscribeToDirtyFlag`:
 * `useEffect(() => subscribeToTravelLinks(), [])`. Devolve o cancelamento.
 */
export function subscribeToTravelLinks(): () => void {
  return useMapStore.subscribe((state) => state.map, syncTravelLinks)
}

function syncTravelLinks(after: MapData, before: MapData): void {
  if (sceneLoading || after.pins === before.pins || after.id !== before.id) return
  const { adventure, activeSceneId } = useAdventureStore.getState()
  if (adventure === null || activeSceneId === null) return
  for (const change of travelLinkChanges(before.pins, after.pins)) {
    const daqui: PinDestination = { sceneId: activeSceneId, pinId: change.pinId }
    // O par antigo, se ainda voltava para cá, fica sem destino.
    if (change.before !== null && change.before.sceneId !== activeSceneId) {
      const antigo = change.before
      useAdventureStore.getState().updateBackgroundScene(antigo.sceneId, (map) => unlinkBack(map, antigo.pinId, daqui))
    }
    // O par novo passa a voltar para cá — e quem ele trazia antes perde a volta.
    if (change.after !== null && change.after.sceneId !== activeSceneId) {
      const novo = change.after
      const slot = useAdventureStore.getState().cache[novo.sceneId]
      if (slot === undefined || slot.status !== 'ok') continue
      const { map, displaced } = linkBack(slot.map, novo.pinId, daqui)
      useAdventureStore.getState().updateBackgroundScene(novo.sceneId, () => map)
      if (displaced !== null && displaced.sceneId !== activeSceneId) {
        useAdventureStore.getState().updateBackgroundScene(displaced.sceneId, (outro) => unlinkBack(outro, displaced.pinId, novo))
      }
    }
  }
}
