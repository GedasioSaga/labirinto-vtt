import type { MapData, Pin, PinPassage, Region, Stair, StairDirection, Wall } from '../types/map'
import type { TravelSceneOption } from './pinTravel'
import { ancestorsOf, findContainingRoom, pointOnPolygonBorder } from './roomNesting'

/**
 * O "Leva a…" da escada no painel do mestre: para qual andar (cena da
 * aventura) ela leva e como o jogador passa. Quem monta é
 * `stairTravelPanel` (`stores/adventureStore.ts`); quem desenha é
 * `components/StairControls.tsx`.
 */
export interface StairTravelProps {
  /** As outras cenas da aventura (`travelSceneOptions`). */
  scenes: readonly TravelSceneOption[]
  /** A cena para onde a escada leva hoje; `null` = não leva a lugar nenhum. */
  linkedSceneId: string | null
  /** Modo do pino da escada (só vale com a escada ligada). */
  passage: PinPassage
  /** Liga a escada a `sceneId` com o modo `passage`: nasce lá a escada par. */
  onLink: (sceneId: string, passage: PinPassage) => void
  /** "Nenhum outro andar". */
  onUnlink: () => void
  /** Troca o modo da escada já ligada. */
  onPassageChange: (passage: PinPassage) => void
  /**
   * "Criar andar de cima/de baixo": uma cena nova com o contorno do prédio da
   * escada e a escada par no mesmo ponto, já ligada com o modo `passage`.
   */
  onCreateFloor: (passage: PinPassage) => void
}

/**
 * ESCADA QUE LEVA A OUTRO ANDAR — as regras puras, sem store, sem DOM, sem Pixi.
 *
 * A escada não ganha máquina de viagem própria: ela ganha um PINO DE VIAGEM
 * INVISÍVEL (`Pin.escadaId`), e é esse pino que o resto do app já sabe ligar
 * em mão dupla (`lib/pinTravel.ts`), mandar ao jogador pelo recorte
 * (`lib/fogFilter.ts`) e atravessar com autoridade no host
 * (`net/hostSession.ts`). O pino não se desenha nem entra em lista nenhuma: o
 * mestre vê a escada, o jogador toca a escada.
 *
 * O pino mora na BOCA da escada — a ponta de chão (`x1, y1` do primeiro lance):
 * "Sobe" aponta o degrau para a ponta do arrasto e "Desce" para o começo
 * (`components/StairControls.tsx`), então nos dois sentidos o começo do lance é
 * a ponta que fica no nível do andar. Quem chega pela escada par aparece ali,
 * ao pé dela, e não no meio dos degraus.
 */

/** Onde o pino da escada fica: a boca do primeiro lance. `null` = escada sem lance. */
export function stairMouth(stair: Stair): { x: number; y: number } | null {
  const first = stair.segments[0]
  return first === undefined ? null : { x: first.x1, y: first.y1 }
}

/** O pino pertence a uma escada? Esse não se desenha como pino, em lugar nenhum. */
export function isStairPin(pin: Pin): boolean {
  return typeof pin.escadaId === 'string' && pin.escadaId.length > 0
}

/** O pino invisível da escada `stairId`, se ela leva a algum andar. */
export function stairPinOf(map: MapData, stairId: string): Pin | undefined {
  return map.pins.find((p) => p.escadaId === stairId)
}

/** O sentido da escada par, no outro andar: quem sobe por uma desce pela outra. */
export function oppositeStairDirection(direction: StairDirection): StairDirection {
  return direction === 'up' ? 'down' : 'up'
}

/** O que o jogador lê ao tocar a escada: o sentido, nunca o nome do andar. */
export function stairTravelLabel(direction: StairDirection): string {
  return direction === 'up' ? 'Subir' : 'Descer'
}

/**
 * Reassenta os pinos das escadas `stairIds` na boca delas. Devolve o MESMO
 * mapa quando nada muda — arrastar escada sem ligação não copia a lista de pinos.
 * É por aqui que "arrastar a escada leva a ligação": `moveStair` e
 * `updateStairPoint` (`lib/mapFactory.ts`) chamam depois de mexer nos lances.
 */
export function seatStairPins(map: MapData, stairIds: readonly string[]): MapData {
  let changed = false
  const pins = map.pins.map((pin) => {
    if (pin.escadaId === undefined || !stairIds.includes(pin.escadaId)) return pin
    const stair = map.stairs.find((s) => s.id === pin.escadaId)
    const mouth = stair === undefined ? null : stairMouth(stair)
    if (mouth === null || (mouth.x === pin.x && mouth.y === pin.y)) return pin
    changed = true
    return { ...pin, x: mouth.x, y: mouth.y }
  })
  return changed ? { ...map, pins } : map
}

/** Tira do mapa os pinos da escada `stairId`. Mesmo mapa quando ela não tinha nenhum. */
export function withoutStairPins(map: MapData, stairId: string): MapData {
  if (!map.pins.some((p) => p.escadaId === stairId)) return map
  return { ...map, pins: map.pins.filter((p) => p.escadaId !== stairId) }
}

/** O pino invisível de uma escada, na boca dela, ainda sem destino. */
export function buildStairPin(id: string, stair: Stair, passagem: PinPassage): Pin | null {
  const mouth = stairMouth(stair)
  if (mouth === null) return null
  return { id, x: mouth.x, y: mouth.y, kind: 'viagem', description: '', image: null, passagem, escadaId: stair.id }
}

/**
 * A escada PAR que nasce no outro andar: o mesmo desenho (forma, lances,
 * largura), o sentido contrário e a boca em `mouth`. Sem rotação, trava ou
 * segredo — é escada nova, o mestre ajeita depois.
 */
export function buildPartnerStair(id: string, source: Stair, mouth: { x: number; y: number }): Stair | null {
  const origin = stairMouth(source)
  if (origin === null) return null
  const dx = mouth.x - origin.x
  const dy = mouth.y - origin.y
  return {
    id,
    shape: source.shape,
    direction: oppositeStairDirection(source.direction),
    segments: source.segments.map((seg) => ({ x1: seg.x1 + dx, y1: seg.y1 + dy, x2: seg.x2 + dx, y2: seg.y2 + dy })),
    stepWidth: source.stepWidth,
  }
}

/*
 * CRIAR ANDAR DE CIMA (OU DE BAIXO) A PARTIR DO PRÉDIO. Torre de 3 andares era
 * redesenhar o contorno em cada andar e ligar 6 pinos à mão. Agora o andar novo
 * nasce com o contorno do PRÉDIO da escada — a Sala de fora de todas que tem a
 * boca dela, e a parede externa dessa Sala — e a escada par no mesmo ponto:
 * quem sobe chega onde estava, um andar acima.
 */

/** "de cima" para a escada que sobe, "de baixo" para a que desce. */
export type FloorSide = 'cima' | 'baixo'

export function floorSideOf(direction: StairDirection): FloorSide {
  return direction === 'up' ? 'cima' : 'baixo'
}

/** "Casa do prefeito – andar de cima". */
export function newFloorName(base: string, side: FloorSide): string {
  return `${base.trim()} – andar de ${side}`
}

/**
 * O prédio da escada: a Sala de FORA de todas (a casa, não o quarto) que tem a
 * boca dela dentro. `null` = escada solta, fora de qualquer Sala.
 */
export function buildingOfStair(map: MapData, stair: Stair): Region | null {
  const mouth = stairMouth(stair)
  if (mouth === null) return null
  const room = findContainingRoom(map.regions, [mouth])
  if (room === null) return null
  const ancestors = ancestorsOf(map.regions, room.id)
  return ancestors[ancestors.length - 1] ?? room
}

/**
 * A parede externa do prédio: as paredes da própria Sala e as soltas que correm
 * sobre o contorno dela (prédio desenhado parede por parede). Parede de cômodo
 * de dentro fica de fora, mesmo encostada no muro: ela é daquele andar.
 */
function outerWallsOf(map: MapData, building: Region): Wall[] {
  return map.walls.filter(
    (wall) =>
      wall.regionId === building.id ||
      (wall.regionId === undefined &&
        pointOnPolygonBorder({ x: wall.x1, y: wall.y1 }, building.points) &&
        pointOnPolygonBorder({ x: wall.x2, y: wall.y2 }, building.points)),
  )
}

/**
 * `target` (o andar novo, vazio) com o contorno do prédio de `source`: a Sala,
 * sem as de dentro, e a parede externa no mesmo lugar. A porta vira parede — a
 * porta da rua é do térreo; o mestre abre a do andar novo onde quiser. Tudo com
 * id novo (`newId`) e sem trava nem "oculto no editor": é desenho novo. O
 * "Oculto para jogadores" da Sala segue junto: prédio escondido embaixo não
 * aparece em cima por descuido.
 */
export function withBuildingContour(target: MapData, source: MapData, building: Region, newId: () => string): MapData {
  const regionId = newId()
  const { parentId: _parentId, locked: _locked, hidden: _hidden, ...kept } = building
  const region: Region = { ...kept, id: regionId, points: building.points.map((p) => ({ ...p })) }
  const walls = outerWallsOf(source, building).map((wall): Wall => {
    const { locked: _wallLocked, hidden: _wallHidden, ...rest } = wall
    return { ...rest, id: newId(), door: null, ...(wall.regionId === undefined ? {} : { regionId }) }
  })
  return { ...target, regions: [...target.regions, region], walls: [...target.walls, ...walls] }
}
