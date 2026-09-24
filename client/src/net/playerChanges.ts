import * as mapFactory from '../lib/mapFactory'
import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { comFichaNoPiso } from '../lib/pisos'
import type { MapData } from '../types/map'
import type { AppliedPiso, AppliedTokenEdit } from './hostSession'

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

type MapTransform = (map: MapData) => MapData

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

/** PISOS NA MESMA CENA: a ficha sobe ou desce pela escada, no mesmo ponto. Térreo tira o campo. */
function setTokenPiso(tokenId: string, piso: number): MapTransform {
  return (map) => comFichaNoPiso(map, tokenId, piso)
}

/** `sceneId` ausente = a cena aberta no editor; presente = uma cena de fundo. */
function applyToScene(sceneId: string | undefined, transform: MapTransform): void {
  if (sceneId === undefined) useMapStore.getState().applyPlayerChange(transform)
  else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneId, transform)
}

/** Os retornos da ponte do host (`createHostBridge`) para as mudanças do jogador. */
export const hostPlayerChanges = {
  applyMove: (tokenId: string, x: number, y: number, sceneId?: string): void => applyToScene(sceneId, moveToken(tokenId, x, y)),
  applyDoor: (wallId: string, open: boolean, sceneId?: string): void => applyToScene(sceneId, setDoorOpen(wallId, open)),
  applyTokenEdit: (edit: AppliedTokenEdit): void => applyToScene(edit.sceneId, editToken(edit)),
  applyPiso: ({ tokenId, piso, sceneId }: AppliedPiso): void => applyToScene(sceneId, setTokenPiso(tokenId, piso)),
}
