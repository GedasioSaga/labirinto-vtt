import type { FloorPiece, LayerId, MapData } from '../types/map'
import { selectEntitiesInArea, type AreaRect } from './areaSelection'
import type { Bloco } from './floorBlocks'
import { apagarBlocosDoChao, baldeNoPonto, findFloorPieceAt } from './floorTool'
import { resolveHoverHit, type HoverHit, type HoverHitInput } from './hoverHitTest'
import { comPiso, mapaDoPiso, pisoDe } from './pisos'
import { findLockedLayerAt, type Point } from './selectionHitTest'
import { selectionFromAreaSelection, type SelectionSet } from './selectionModel'

/**
 * PISOS NA MESMA CENA — as ferramentas do editor que MIRAM o mapa agem só no
 * piso em edição. O mestre vê um piso por vez (`mapaDoPiso`); o que está em
 * outro piso no mesmo lugar não aparece, então não pode ser pego pelo laço,
 * furado pela borracha de blocos, nem contar como "já tem chão" para o balde.
 */

/** Laço (arrasto no vazio com Selecionar): só o que está no piso em edição. */
export function selecaoDoLacoNoPiso(map: MapData, piso: number, rect: AreaRect): SelectionSet {
  return selectionFromAreaSelection(selectEntitiesInArea(mapaDoPiso(map, piso), rect))
}

/**
 * Hover ocioso (anel e cursor "clicável"): só o que está no piso em edição.
 * O item de outro piso no mesmo lugar não aparece na tela e o clique
 * (`clickSelectMap`) não o pega — o hover não pode prometer esse clique.
 */
export function hoverNoPiso(input: HoverHitInput, piso: number): HoverHit {
  return resolveHoverHit({ ...input, map: mapaDoPiso(input.map, piso) })
}

/**
 * Camada travada sob o ponto, olhando só o piso em edição: o item de cima que
 * barra o gesto tem de ser um que o mestre vê. Uma ficha do térreo em camada
 * travada não impede de pegar a parede do 1º piso no mesmo lugar.
 */
export function camadaTravadaNoPiso(map: MapData, piso: number, point: Point): LayerId | null {
  return findLockedLayerAt(mapaDoPiso(map, piso), point)
}

/** Balde: a área fechada e o "já tem chão" são os do piso em edição. */
export function baldeNoPiso(map: MapData, piso: number, point: Point, novoId: () => string): FloorPiece | null {
  return baldeNoPonto(mapaDoPiso(map, piso), point, novoId)
}

/** Peça de chão sob o ponto, só entre as do piso em edição. */
export function pecaDeChaoNoPiso(map: MapData, piso: number, point: Point): FloorPiece | null {
  return findFloorPieceAt(mapaDoPiso(map, piso), point)
}

/**
 * Borracha do pincel de blocos (botão direito ou Subtrair) no piso em edição:
 * as células saem só das peças DESTE piso, e o buraco que precisar nascer
 * nasce nele. As peças dos outros pisos ficam intocadas e na mesma posição da
 * lista — a ordem das peças é a ordem em que o chão se soma e se subtrai.
 * Nada apagado: o próprio mapa (quem chama não gasta Ctrl+Z).
 */
export function apagarBlocosNoPiso(map: MapData, piso: number, blocos: readonly Bloco[], cell: number, novoId: () => string): MapData {
  const doPiso = map.floor.filter((peca) => pisoDe(peca) === piso)
  const depois = apagarBlocosDoChao(doPiso, blocos, cell, novoId)
  if (depois === null) return map
  const porId = new Map(depois.map((peca) => [peca.id, peca]))
  const existiam = new Set(doPiso.map((peca) => peca.id))
  const mantidas = map.floor.flatMap((peca) => {
    if (pisoDe(peca) !== piso) return [peca]
    const nova = porId.get(peca.id)
    return nova === undefined ? [] : [nova]
  })
  const nascidas = depois.filter((peca) => !existiam.has(peca.id)).map((peca) => comPiso(peca, piso))
  return { ...map, floor: [...mantidas, ...nascidas] }
}
