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
 * Leva os pinos presos a cada ficha de `ids` pelo passo REAL dela: de onde
 * estava em `before` até onde está em `map`. É o caso da ficha LEVADA
 * (`lib/carry.ts`): ela não anda o delta de quem a leva quando a parede a
 * barra, então o pino dela anda o que ela andou — zero, se ficou.
 */
export function carryPinsByTokenSteps(map: MapData, before: readonly Token[], ids: ReadonlySet<string>): MapData {
  let next = map
  for (const antes of before) {
    if (!ids.has(antes.id)) continue
    const agora = map.tokens.find((t) => t.id === antes.id)
    // Ficha que sumiu no caminho não tem passo a dar ao pino.
    if (agora !== undefined) next = carryAttachedPins(next, antes.id, agora.x - antes.x, agora.y - antes.y)
  }
  return next
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
