import type { Agua, FloorPiece, MapData, TipoDeAgua } from '../../types/map'
import { extractFloorRings, signedArea } from '../floorContour'
import { COR_PRONTA_DO_TIPO, corProntaDaAgua } from './dados'
import { decimarTraco } from './forma'

/**
 * "VIRAR ÁGUA" (decisão do mestre de 12/11/2026): a peça de Chão pintada com
 * a tinta Mar vira lago ou mar com o mesmo contorno. Cada anel de fora da
 * peça vira uma água (buraco na peça não vira ilha: a água cobre o anel).
 */

/** Pontos de controle a cada meia casa: a curva suave passa por eles. */
const PASSO_EM_CASAS = 0.5
/** Anel menor que isto (casas²) não vira água. */
const AREA_MINIMA = 0.25

export function aguasDaPeca(piece: FloorPiece, map: Pick<MapData, 'grid' | 'width' | 'height'>, tipo: TipoDeAgua): Agua[] {
  if (tipo === 'rio' || piece.op !== 'add') return []
  const grid = map.grid
  const aneis = extractFloorRings([{ ...piece, piso: undefined }], { step: Math.max(2, grid / 8), tolerance: grid * 0.05 })
  const cor = COR_PRONTA_DO_TIPO[tipo]
  // Só os anéis de fora: o buraco tem o sinal contrário ao do maior anel.
  const areas = aneis.map((anel) => signedArea(anel))
  let maior = 0
  for (const a of areas) if (Math.abs(a) > Math.abs(maior)) maior = a
  const aguas: Agua[] = []
  for (const [i, anel] of aneis.entries()) {
    if (Math.sign(areas[i]) !== Math.sign(maior) || Math.abs(areas[i]) < AREA_MINIMA * grid * grid) continue
    const fechado = anel.length > 1 && anel[0].x === anel[anel.length - 1].x && anel[0].y === anel[anel.length - 1].y ? anel.slice(0, -1) : anel
    const pontos = decimarTraco(fechado, grid * PASSO_EM_CASAS)
    if (pontos.length < 3) continue
    aguas.push({
      id: crypto.randomUUID(),
      tipo,
      pontos: pontos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      cor: corProntaDaAgua(cor),
      corPronta: cor,
      ...(piece.piso === undefined ? {} : { piso: piece.piso }),
    })
  }
  return aguas
}
