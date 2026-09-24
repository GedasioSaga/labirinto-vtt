import type { MapData, Token } from '../types/map'
import { measureCells } from './measurement'

/**
 * VULTO — "Rostos só de perto: N casas". Com a opção ligada na cena, a ficha
 * que não é do jogador e está além de N casas de TODAS as fichas dele chega a
 * ele sem rosto. Quem aplica é o recorte (`lib/fogFilter.ts`), no host: o nome
 * nunca vai no pacote, então nenhuma tela do jogador consegue mostrá-lo.
 */

/** O rótulo que a mesa lê embaixo da ficha sem rosto. */
export const VULTO_NAME = 'Vulto'

/** Cinza chapado do disco sem rosto: fora da paleta do painel, para não se confundir com uma cor escolhida. */
export const VULTO_COLOR = '#6f747c'

export const FACE_RANGE_MIN_CELLS = 1
export const FACE_RANGE_MAX_CELLS = 99
/** O que a caixa "Rostos só de perto" liga quando o mestre a marca. */
export const FACE_RANGE_DEFAULT_CELLS = 3

/** Folga de ponto flutuante: ficha exatamente a N casas ainda é "perto". */
const CELL_EPSILON = 1e-6

/**
 * O valor da opção, se ele for um inteiro de 1 a 99; senão `null` (desligada).
 * Aceita `unknown` porque o mapa vem do disco cru (`lib/mapFile.ts`).
 */
export function faceRangeCellsOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  return value >= FACE_RANGE_MIN_CELLS && value <= FACE_RANGE_MAX_CELLS ? value : null
}

/**
 * A ficha está a até `cells` casas de alguma das fichas de quem olha? A
 * distância é a da régua da cena (`measureCells`, no modo de medição do mapa).
 * Grade sem tamanho não sabe medir: ninguém está perto — na dúvida, sem rosto.
 */
export function isFaceInReach(token: Pick<Token, 'x' | 'y'>, viewers: readonly Pick<Token, 'x' | 'y'>[], map: Pick<MapData, 'grid' | 'gridShape' | 'measurementMode'>, cells: number): boolean {
  if (!(map.grid > 0)) return false
  return viewers.some((v) => measureCells({ x: v.x, y: v.y }, { x: token.x, y: token.y }, map.grid, map.gridShape, map.measurementMode) <= cells + CELL_EPSILON)
}

/**
 * A ficha sem rosto. Montada campo a campo a partir do que NÃO identifica
 * ninguém (lugar, tamanho e para onde está virada), e não copiando a ficha e
 * apagando o resto: campo novo que um dia entrar em `Token` fica de fora
 * sozinho, em vez de vazar pelo vulto.
 */
export function tokenAsVulto(token: Token): Token {
  const vulto: Token = {
    id: token.id,
    characterId: null,
    name: VULTO_NAME,
    x: token.x,
    y: token.y,
    size: token.size,
    image: null,
    imageData: null,
    color: VULTO_COLOR,
  }
  if (token.rotation !== undefined) vulto.rotation = token.rotation
  return vulto
}
