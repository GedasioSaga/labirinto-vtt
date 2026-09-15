import type { Wall } from '../types/map'

/**
 * Constantes do visual "Dyson Logos / one-page dungeon" (passo 3, BAR): piso
 * claro, parede preta grossa e faixa de hachura por fora. Medidas em FRAÇÃO DE
 * CÉLULA, para escalar junto com `map.grid` (32/64/128).
 */
export const WALL_EXTERIOR_CELLS = 0.25
export const WALL_INTERIOR_CELLS = 0.125
export const HATCH_BAND_CELLS = 0.5

export const WALL_EXTERIOR_COLOR = 0x1f1b16
export const WALL_INTERIOR_COLOR = 0x3a342c
/** Base do tile de hachura: o mesmo pergaminho do piso novo (#e9e1cf). */
export const PARCHMENT_COLOR = 0xe9e1cf
export const HATCH_INK_COLOR = 0x1f1b16
/** Faixa lisa no lugar da hachura quando o traço do tile ficaria abaixo de 1 px de tela. */
export const HATCH_FLAT_COLOR = 0x8c857a

/** Lado do tile procedural, potência de 2 (mipmap sem costura). */
export const HATCH_TILE_SIZE = 256
/** Grade em que o tile sai 1:1 (1 texel = 1 px de mundo); outras grades escalam o padrão. */
export const HATCH_TILE_REFERENCE_GRID = 64
/** Largura do traço dentro do tile, em texels. 3 × 0,35 = 1,05 px de tela no limite do LOD. */
export const HATCH_TILE_STROKE_PX = 3
/** Abaixo desta escala efetiva do tile (zoom × grid / 64), a faixa vira cor lisa. */
export const HATCH_MIN_TILE_SCALE = 0.35

/**
 * Multiplicador do preset de espessura (fina/média/grossa) — mesma escala
 * 0.5/1/2 de `STAIR_SIZE_PRESET_RATIO` (`lib/stairs.ts`). Vale por cima da
 * largura base por `wallKind`.
 */
export const THICKNESS_RATIO: Record<NonNullable<Wall['thickness']>, number> = { thin: 0.5, medium: 1, thick: 2 }

export function isInteriorWall(wall: Pick<Wall, 'wallKind'>): boolean {
  return wall.wallKind === 'interior'
}

/** Largura de MUNDO da parede: fração de célula por `wallKind` × preset de `thickness`. */
export function wallWidthFor(wall: Pick<Wall, 'wallKind' | 'thickness'>, grid: number): number {
  const cells = isInteriorWall(wall) ? WALL_INTERIOR_CELLS : WALL_EXTERIOR_CELLS
  return grid * cells * THICKNESS_RATIO[wall.thickness ?? 'medium']
}

export function wallColorFor(wall: Pick<Wall, 'wallKind'>): number {
  return isInteriorWall(wall) ? WALL_INTERIOR_COLOR : WALL_EXTERIOR_COLOR
}

/** Largura de MUNDO da faixa de hachura, medida a partir da face externa da parede. */
export function hatchBandWidth(grid: number): number {
  return grid * HATCH_BAND_CELLS
}

/** `true` quando a faixa deve ser lisa: o traço do tile não chegaria a 1 px de tela. */
export function hatchUsesFlatBand(cameraScale: number, grid: number): boolean {
  return cameraScale * (grid / HATCH_TILE_REFERENCE_GRID) < HATCH_MIN_TILE_SCALE
}
