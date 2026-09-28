import type { RoomMeta } from '../types/map'

/**
 * ESTILO DO TÍTULO DA SALA — plaquinha, tamanho, cor e orientação do nome.
 *
 * Os quatro campos moram em `RoomMeta` e são todos opcionais: `undefined` é o
 * visual de sempre (plaquinha clara, fonte do grid, grafite, horizontal), então
 * mapa salvo antes deles abre igual. Aqui fica só a régua pura; quem desenha é
 * `pixi/drawRoomNames.ts`, quem grava é `mapFactory.setRoomLabelStyle`.
 */

/** Menor multiplicador da fonte. Abaixo disso o piso de 11 px de tela de
 *  `pixi/screenLabel.ts` já seguraria o nome no zoom 100%. */
export const ROOM_LABEL_SCALE_MIN = 0.5
export const ROOM_LABEL_SCALE_MAX = 1.5
/** A tinta de sempre do título: o quase-preto do fundo do app (`--lb-color-ink`). */
export const ROOM_LABEL_DEFAULT_COLOR = '#121214'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export interface RoomLabelStyle {
  plate: boolean
  scale: number
  color: string
  vertical: boolean
}

export type RoomLabelStylePatch = Partial<RoomLabelStyle>

export function isRoomLabelColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function clampRoomLabelScale(scale: number): number {
  return Math.min(ROOM_LABEL_SCALE_MAX, Math.max(ROOM_LABEL_SCALE_MIN, scale))
}

/** Os quatro valores já resolvidos, com o padrão no lugar do que falta. */
export function roomLabelStyleOf(room: RoomMeta | undefined): RoomLabelStyle {
  const scale = room?.labelScale
  const color = room?.labelColor
  return {
    plate: room?.labelPlate !== false,
    scale: typeof scale === 'number' && Number.isFinite(scale) ? clampRoomLabelScale(scale) : 1,
    color: isRoomLabelColor(color) ? color.toLowerCase() : ROOM_LABEL_DEFAULT_COLOR,
    vertical: room?.labelVertical === true,
  }
}

/**
 * Aplica `patch` à sala. Valor igual ao padrão APAGA o campo em vez de gravar o
 * padrão: o arquivo continua enxuto e a sala volta a ser igual a uma que nunca
 * teve estilo. Valor inválido no patch é ignorado.
 */
export function withRoomLabelStyle(room: RoomMeta, patch: RoomLabelStylePatch): RoomMeta {
  const next: RoomMeta = { ...room }
  if (patch.plate !== undefined) {
    if (patch.plate) delete next.labelPlate
    else next.labelPlate = false
  }
  if (patch.scale !== undefined && Number.isFinite(patch.scale)) {
    const scale = Math.round(clampRoomLabelScale(patch.scale) * 100) / 100
    if (scale === 1) delete next.labelScale
    else next.labelScale = scale
  }
  if (patch.color !== undefined && isRoomLabelColor(patch.color)) {
    const color = patch.color.toLowerCase()
    if (color === ROOM_LABEL_DEFAULT_COLOR) delete next.labelColor
    else next.labelColor = color
  }
  if (patch.vertical !== undefined) {
    if (patch.vertical) next.labelVertical = true
    else delete next.labelVertical
  }
  return next
}

/** Arquivo aberto: descarta o campo de estilo que não tem forma válida. */
export function sanitizeRoomLabelStyle(room: RoomMeta): RoomMeta {
  const next: RoomMeta = { ...room }
  if (next.labelPlate !== undefined && typeof next.labelPlate !== 'boolean') delete next.labelPlate
  if (next.labelScale !== undefined) {
    if (typeof next.labelScale !== 'number' || !Number.isFinite(next.labelScale)) delete next.labelScale
    else next.labelScale = clampRoomLabelScale(next.labelScale)
  }
  if (next.labelColor !== undefined && !isRoomLabelColor(next.labelColor)) delete next.labelColor
  if (next.labelVertical !== undefined && typeof next.labelVertical !== 'boolean') delete next.labelVertical
  return next
}
