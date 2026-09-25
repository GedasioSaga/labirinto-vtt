import { sceneTrail } from '../lib/adventure'
import type { SceneSearchSource } from '../lib/buscaNaAventura'
import { applyGatherPlan, planGather } from '../lib/gatherParty'
import { mapObjectOf } from '../lib/mapObjects'
import { partyMembers } from '../lib/party'
import type { PlayerInfo } from '../net/hostSession'
import type { Point } from '../pixi/world'
import type { MapData } from '../types/map'
import { hostWorldOf, useAdventureStore, type SceneSlot } from './adventureStore'
import { goToMapObject } from './mapObjectNavigation'
import { useMapStore } from './mapStore'

/**
 * BUSCA DO MESTRE (Ctrl+K em todas as cenas), do lado das stores: de onde a
 * busca lê as outras cenas, o "Ir lá" que abre a cena do achado, e o "Mandar
 * ficha para cá", que leva a ficha de um jogador até a sala ou o pino achado.
 *
 * O jogador não recebe nada disto além do que a travessia de sempre já manda
 * (`sendPlayer`, sem nome de cena): a busca, os nomes e os caminhos são do mestre.
 */

interface SceneState {
  adventure: { scenes: readonly { id: string; name: string; parentId?: string }[] } | null
  activeSceneId: string | null
  cache: Record<string, SceneSlot>
}

/**
 * As OUTRAS cenas da aventura, onde a busca procura além da aberta: a aberta
 * já tem a lista dela, e a cena que não abriu fica de fora (não há mapa). O
 * caminho é o das pastas de fora mais o nome dela ("Andar 9 › Blocos").
 */
export function fontesDaBusca(state: SceneState): SceneSearchSource[] {
  const adventure = state.adventure
  if (adventure === null) return []
  const sources: SceneSearchSource[] = []
  for (const entry of adventure.scenes) {
    if (entry.id === state.activeSceneId) continue
    const slot = state.cache[entry.id]
    if (slot === undefined || slot.status !== 'ok') continue
    sources.push({ sceneId: entry.id, path: [...sceneTrail(adventure.scenes, entry.id), entry.name], map: slot.map })
  }
  return sources
}

/** Onde o achado mora: a cena (`null` = a aberta) e o `tipo:id` dele na lista Objetos do mapa. */
export interface AlvoDaBusca {
  sceneId: string | null
  objectKey: string
}

/** O mapa de `sceneId` como está agora: a aberta pelo editor, a de fundo pelo cache. */
function mapaDaCena(sceneId: string | null): MapData | null {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === null || sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  return slot !== undefined && slot.status === 'ok' ? slot.map : null
}

/**
 * "Ir lá" de um achado: abre a cena dele (se não é a aberta) e faz o "Ir até
 * lá" da lista Objetos do mapa — seleciona e leva a câmera do editor até ele.
 * `false`, sem trocar de cena, quando o achado saiu do mapa desde a busca.
 */
export function irAoAchado(alvo: AlvoDaBusca): boolean {
  const mapa = mapaDaCena(alvo.sceneId)
  if (mapa === null || mapObjectOf(mapa, alvo.objectKey) === null) return false
  const adventure = useAdventureStore.getState()
  if (alvo.sceneId !== null && alvo.sceneId !== adventure.activeSceneId && !adventure.switchScene(alvo.sceneId)) return false
  const entry = mapObjectOf(useMapStore.getState().map, alvo.objectKey)
  if (entry === null) return false
  goToMapObject(entry)
  return true
}

/** O que o "Mandar ficha" precisa da ponte do mestre. O App passa a ponte de verdade. */
export interface PonteDeMandar {
  players(): PlayerInfo[]
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, gatherAt?: Point): boolean
}

export interface AlvoDeMandar extends AlvoDaBusca {
  /** Nome do achado, para o aviso "Ana foi para Cozinha". */
  name: string
}

export interface ResultadoDeMandar {
  ok: boolean
  /** O que a seção mostra ao mestre, dando certo ou não. */
  mensagem: string
}

/** O ponto em volta do qual a ficha assenta: o meio da sala, a ponta do pino, a casa da ficha. */
function pontoDeChegada(map: MapData, objectKey: string): Point | null {
  const entry = mapObjectOf(map, objectKey)
  if (entry === null) return null
  if (entry.kind === 'pin') {
    const pin = map.pins.find((p) => p.id === entry.id)
    return pin === undefined ? null : { x: pin.x, y: pin.y }
  }
  if (entry.kind === 'token') {
    const token = map.tokens.find((t) => t.id === entry.id)
    return token === undefined ? null : { x: token.x, y: token.y }
  }
  return entry.focus
}

/**
 * "Mandar ficha para cá": leva a ficha do jogador `playerId` até o achado.
 * Primeiro o mestre VAI lá (`irAoAchado`), e aí é o "Reunir o grupo aqui" de
 * um jogador só, em volta do achado: a casa livre mais perto dele, sem parede
 * no caminho (`planGather`). Quem está em outra cena atravessa pela ponte
 * (`sendPlayer`, o mesmo do "Mandar para…"); quem já está na cena só anda,
 * num passo do desfazer.
 */
export function mandarFichaPara(playerId: string, alvo: AlvoDeMandar, ponte: PonteDeMandar): ResultadoDeMandar {
  const player = ponte.players().find((p) => p.playerId === playerId)
  if (player === undefined) return { ok: false, mensagem: 'Esse jogador não está mais na sala.' }
  const [membro] = partyMembers([player], hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map))
  // Sem ficha, nem vai lá: o mestre não troca de cena por um envio que não acontece.
  if (membro === undefined || membro.token === null) return { ok: false, mensagem: `${player.name} não tem ficha em cena.` }
  if (!irAoAchado(alvo)) return { ok: false, mensagem: `${alvo.name} não está mais no mapa.` }

  const map = useMapStore.getState().map
  const ponto = pontoDeChegada(map, alvo.objectKey)
  if (ponto === null) return { ok: false, mensagem: `${alvo.name} não está mais no mapa.` }
  const world = hostWorldOf(useAdventureStore.getState(), map)
  const plan = planGather(partyMembers([player], world), world, ponto)
  if (plan.moves.length === 0) return { ok: false, mensagem: `Sem casa livre perto de ${alvo.name} para ${player.name}. A ficha ficou onde estava.` }
  const falhou = applyGatherPlan(plan, {
    sceneId: world.open.sceneId,
    bringFromOtherScene: (id, sceneId, at) => ponte.sendPlayer(id, sceneId, null, at),
    placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
  })
  if (falhou.length > 0) return { ok: false, mensagem: `Não deu para mandar ${player.name}. A cena ou a ficha mudou; tente de novo.` }
  return { ok: true, mensagem: `${player.name} foi para ${alvo.name}.` }
}
