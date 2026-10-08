import * as mapFactory from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData, MarcaNoLugar } from '../types/map'
import { openPinLock } from '../lib/pinLock'
import { adicionarMarca, apagarMarca } from '../lib/marcas'
import { comFichaNoPiso } from '../lib/pisos'
import { comMovimentoRemoto } from '../lib/movimentoRemoto'
import { boardVehicle, leaveVehicle } from '../lib/vehicle'
import { hopVehicleSeated } from '../lib/vehicleHop'
import type { SeatHold } from '../lib/gatherParty'
import type { Personagem } from '../lib/personagem'
import type { AppliedLock, AppliedMark, AppliedPersonagem, AppliedPiso, AppliedTokenEdit, AppliedVehicle } from './hostSession'

/**
 * O que o JOGADOR muda no mapa do mestre (movimento, porta, nome/foto da
 * própria ficha), já validado pela sessão, entra por aqui — e nunca pelas
 * actions de edição do mestre (`setTokenPosition`, `setWallDoor`,
 * `renameToken`, `setTokenImage`), que passam por `withHistory` e virariam
 * passo do Ctrl+Z do mestre.
 *
 * Cada mudança é uma transformação pura e reaplicável: ela entra no mapa E em
 * todo passo do desfazer da cena (`applyPlayerChange` na cena aberta,
 * `applyPlayerChangeToBackgroundScene` numa de fundo). Devolve o próprio mapa
 * quando não muda nada — num passo antigo a ficha ou a porta pode nem existir.
 */

export type MapTransform = (map: MapData) => MapData

function moveToken(tokenId: string, x: number, y: number): MapTransform {
  return (map) => {
    const token = map.tokens.find((t) => t.id === tokenId)
    if (token === undefined || (token.x === x && token.y === y)) return map
    return mapFactory.setTokenPosition(map, tokenId, x, y)
  }
}

function setDoorOpen(wallId: string, open: boolean): MapTransform {
  return (map) => {
    const wall = map.walls.find((w) => w.id === wallId)
    // Trancada só o mestre abre: recusa defensiva se o mapa mudou entre a validação e aqui.
    if (!wall?.door || wall.door.open === open || (open && wall.door.locked)) return map
    return mapFactory.setWallDoor(map, wallId, { ...wall.door, open })
  }
}

/**
 * `image` chega como referência embutida: ela vira a cópia que viaja, e o
 * caminho do disco do mestre (se havia um) deixa de valer para este token.
 */
function editToken({ tokenId, name, image }: AppliedTokenEdit): MapTransform {
  return (map) => {
    const token = map.tokens.find((t) => t.id === tokenId)
    if (token === undefined) return map
    const renamed = name === undefined || token.name === name ? map : mapFactory.renameToken(map, tokenId, name)
    const sameImage = token.image === null && (token.imageData ?? null) === image
    return image === undefined || sameImage ? renamed : mapFactory.setTokenImage(renamed, tokenId, null, image)
  }
}

/** FECHADURA COM SEGREDO: o jogador acertou — abre o pino e destranca a porta ligada (`openPinLock`). */
function openLock(pinId: string): MapTransform {
  return (map) => openPinLock(map, pinId)
}

/**
 * BILHETE NO LUGAR: a marca entra (ou sai, pelo "Apagar" do aviso) fora do
 * Ctrl+Z do mestre, como o resto do que vem do jogador — desfazer um passo do
 * mestre não pode sumir com o bilhete que um jogador deixou depois.
 */
function placeMark(marca: MarcaNoLugar): MapTransform {
  return (map) => adicionarMarca(map, marca)
}

function removeMark(markId: string): MapTransform {
  return (map) => apagarMarca(map, markId)
}

/** PISOS NA MESMA CENA: a ficha sobe ou desce pela escada, no mesmo ponto. Térreo tira o campo. */
function setTokenPiso(tokenId: string, piso: number): MapTransform {
  return (map) => comFichaNoPiso(map, tokenId, piso)
}

/**
 * VEÍCULO: o jogador subiu (`boardVehicle`, que recusa de novo se o mapa
 * mudou entre a validação e aqui — encheu, ela se afastou) ou desceu: sai da
 * lista ANTES de andar até o ponto que a sessão escolheu — `setTokenPosition`
 * leva então só ela (com a tocha e quem ela leva), e o veículo fica.
 */
function applyVehicleChange(change: AppliedVehicle): MapTransform {
  return (map) => {
    if (change.op === 'board') {
      const result = boardVehicle(map, change.vehicleId, change.tokenId)
      return result.ok ? result.map : map
    }
    const off = leaveVehicle(map, change.tokenId)
    const token = off.tokens.find((t) => t.id === change.tokenId)
    if (token === undefined || (token.x === change.x && token.y === change.y)) return off
    return mapFactory.setTokenPosition(off, change.tokenId, change.x, change.y)
  }
}

/**
 * FICHA DE PERSONAGEM: a ficha (token) que o jogador escolheu no "Criar minha
 * ficha" passa a apontar para o personagem novo. Fora do Ctrl+Z, como o resto
 * do que vem do jogador: desfazer um passo do mestre não desliga a ficha.
 */
function ligarAoPersonagem(tokenId: string, personagemId: string): MapTransform {
  return (map) => {
    const token = map.tokens.find((t) => t.id === tokenId)
    if (token === undefined || token.characterId === personagemId) return map
    return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, characterId: personagemId } : t)) }
  }
}

/** `sceneId` ausente = a cena aberta no editor; presente = uma cena de fundo. */
function applyToScene(sceneId: string | undefined, transform: MapTransform): void {
  if (sceneId === undefined) useMapStore.getState().applyPlayerChange(transform)
  else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneId, transform)
}

const temMarca = (map: MapData, markId: string): boolean => (map.marcas ?? []).some((m) => m.id === markId)

/**
 * Onde a marca `markId` está AGORA, no formato de `applyToScene`: `undefined`
 * na cena aberta, o id da cena de fundo, ou `null` se não está em cena
 * nenhuma. Buscar na hora (e não guardar a cena de quando a marca chegou) é o
 * que deixa o mestre trocar de cena entre o aviso e o "Apagar": a cena aberta
 * vira de fundo, e a de fundo aberta sai do cache.
 */
function cenaComMarca(markId: string): string | undefined | null {
  if (temMarca(useMapStore.getState().map, markId)) return undefined
  const { activeSceneId, cache } = useAdventureStore.getState()
  for (const [sceneId, slot] of Object.entries(cache)) {
    // A cena aberta vive no editor; uma cópia dela no cache não é onde apagar.
    if (sceneId !== activeSceneId && slot.status === 'ok' && temMarca(slot.map, markId)) return sceneId
  }
  return null
}

/**
 * Para onde vão as mudanças do jogador: as stores do editor (o jogo de
 * verdade, `hostPlayerChanges`) ou a camada da VISÃO DE JOGADOR, que guarda o
 * que o teste mudou sem tocar no mapa do mestre (`net/visaoDeTeste/camadaDeTeste.ts`).
 */
export interface DestinoDasMudancas {
  /**
   * Aplica `transform` na cena `sceneId` (ausente = a aberta no editor).
   * `passoDe`: a mudança é só o passo da ficha com esse id — quem guarda as
   * mudanças em lista pode trocar o passo anterior dela por este.
   */
  aplicar(sceneId: string | undefined, transform: MapTransform, passoDe?: string): void
  /** Onde a marca `markId` está AGORA, no formato de `aplicar`; `null` = em cena nenhuma. */
  cenaComMarca(markId: string): string | undefined | null
  /** Em volta do passo do jogador (o editor marca a ficha para deslizar). Ausente = só aplica. */
  emVoltaDoPasso?: (tokenId: string, aplicar: () => void) => void
  /** FICHA DE PERSONAGEM: grava o personagem inteiro (troca o de mesmo id, ou entra no fim). */
  salvarPersonagem(personagem: Personagem): void
}

/** Os retornos da ponte do host (`createHostBridge`) para as mudanças do jogador, gravados em `destino`. */
export function createPlayerChanges(destino: DestinoDasMudancas) {
  const emVoltaDoPasso = destino.emVoltaDoPasso ?? ((_tokenId: string, aplicar: () => void) => aplicar())
  return {
    applyMove: (tokenId: string, x: number, y: number, sceneId?: string): void =>
      emVoltaDoPasso(tokenId, () => destino.aplicar(sceneId, moveToken(tokenId, x, y), tokenId)),
    // VEÍCULO no ATALHO NA MESMA CENA: salta com todos a bordo, sem deslizar — é
    // passagem, não passo —, e cada um assenta numa casa livre (`hopVehicleSeated`).
    applyVehicleHop: (vehicleId: string, x: number, y: number, sceneId?: string, hold?: SeatHold): void =>
      destino.aplicar(sceneId, (map) => hopVehicleSeated(map, vehicleId, x, y, hold)),
    applyDoor: (wallId: string, open: boolean, sceneId?: string): void => destino.aplicar(sceneId, setDoorOpen(wallId, open)),
    applyTokenEdit: (edit: AppliedTokenEdit): void => destino.aplicar(edit.sceneId, editToken(edit)),
    applyLock: (lock: AppliedLock): void => destino.aplicar(lock.sceneId, openLock(lock.pinId)),
    applyMark: (mark: AppliedMark): void => destino.aplicar(mark.sceneId, placeMark(mark.marca)),
    /** Tira a marca da cena que a tem hoje. `false` quando ela já não estava em cena nenhuma. */
    removeMark: (markId: string): boolean => {
      const sceneId = destino.cenaComMarca(markId)
      if (sceneId === null) return false
      destino.aplicar(sceneId, removeMark(markId))
      return true
    },
    applyPiso: ({ tokenId, piso, sceneId }: AppliedPiso): void => destino.aplicar(sceneId, setTokenPiso(tokenId, piso)),
    applyVehicle: (change: AppliedVehicle): void => destino.aplicar(change.sceneId, applyVehicleChange(change)),
    // O personagem ANTES da ligação: a ficha nunca aponta para um personagem que ainda não existe.
    applyPersonagem: ({ personagem, ligarTokenId, sceneId }: AppliedPersonagem): void => {
      destino.salvarPersonagem(personagem)
      if (ligarTokenId !== undefined) destino.aplicar(sceneId, ligarAoPersonagem(ligarTokenId, personagem.id))
    },
  }
}

export type PlayerChanges = ReturnType<typeof createPlayerChanges>

/** As mudanças do jogador no jogo de verdade: no mapa do mestre, fora do Ctrl+Z dele. */
export const hostPlayerChanges = createPlayerChanges({
  aplicar: applyToScene,
  cenaComMarca,
  // Mapa solto não tem onde guardar personagem; a sessão nem oferece a ficha sem aventura (`HostWorld.rpg`).
  salvarPersonagem: (personagem) => {
    useAdventureStore.getState().salvarPersonagem(personagem)
  },
  // A marca vem ANTES de aplicar: o redraw das fichas roda dentro do `set` da
  // store, e é nele que o editor decide que esta ficha desliza (lib/movimentoRemoto.ts).
  emVoltaDoPasso: comMovimentoRemoto,
})
