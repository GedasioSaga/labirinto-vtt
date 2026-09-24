import type { MapData, Pin, PinPassage, Stair, StairDirection } from '../types/map'

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
