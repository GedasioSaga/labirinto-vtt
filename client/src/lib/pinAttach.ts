import type { MapData, Token } from '../types/map'

/**
 * PINO PRESO A UMA FICHA (navio, carroça, elevador): o pino guarda o id da
 * ficha em `Pin.presoA` e anda o mesmo tanto que ela. Puro: sem DOM, sem store.
 *
 * O pino guarda só QUAL ficha, não a distância até ela: quem move a ficha
 * aplica o mesmo deslocamento ao pino. Assim o mestre ainda arrasta o pino
 * para outro ponto do navio sem precisar soltar e prender de novo.
 */

/** Rótulo da ficha sem nome na lista "Preso à ficha". */
export const UNNAMED_TOKEN_LABEL = 'Ficha sem nome'

/**
 * Leva junto os pinos presos à ficha `tokenId`, deslocando-os por (dx, dy).
 * Sem pino preso a ela, ou sem deslocamento, devolve o MESMO mapa — o arrasto
 * da ficha chama isto a cada pointermove e nenhum render deve acordar à toa.
 */
export function carryAttachedPins(map: MapData, tokenId: string, dx: number, dy: number): MapData {
  if (dx === 0 && dy === 0) return map
  if (!map.pins.some((p) => p.presoA === tokenId)) return map
  return { ...map, pins: map.pins.map((p) => (p.presoA === tokenId ? { ...p, x: p.x + dx, y: p.y + dy } : p)) }
}

/**
 * Leitura do disco: só texto não vazio vale. O resto (número, objeto, texto
 * vazio de arquivo editado à mão) volta AUSENTE — o pino abre parado, que é o
 * de sempre, em vez de acompanhar uma ficha que não existe.
 */
export function readPinAttachment(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export interface PinAttachOption {
  id: string
  label: string
}

/** As fichas do mapa, na ordem dele, como a lista "Preso à ficha" as mostra. */
export function pinAttachOptions(tokens: readonly Token[]): PinAttachOption[] {
  return tokens.map((t) => ({ id: t.id, label: t.name.trim() === '' ? UNNAMED_TOKEN_LABEL : t.name.trim() }))
}
