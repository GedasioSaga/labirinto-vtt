import type { Graphics } from 'pixi.js'
import type { Perigo, Region, RegionPoint } from '../types/map'

/**
 * PERIGO QUE SE ALASTRA — a sala tomada ganha um preenchimento CHAPADO e
 * translúcido por cima do chão, no estilo minimapa (sem hachura, sem textura):
 * fogo laranja, água azul, cinza cinza. O mesmo desenho no editor e na tela do
 * jogador — ele só recebe as salas que vê agora (`lib/fogFilter.ts`).
 */
export const COR_DO_FOGO = 0xd2572a
export const COR_DA_AGUA = 0x3a78b8
export const COR_DA_CINZA = 0x6b6763
/** Translúcido o bastante para o chão e o nome da sala continuarem legíveis. */
export const ALPHA_DO_PERIGO = 0.45

export interface CamadaDePerigo {
  cor: number
  poligonos: RegionPoint[][]
}

/** Os polígonos de cada cor, na ordem cinza → água → fogo (o fogo por cima). Sala sem polígono usável fica de fora. */
export function camadasDosPerigos(regions: readonly Region[], perigos: readonly Perigo[]): CamadaDePerigo[] {
  const porId = new Map(regions.filter((r) => r.points.length >= 3).map((r) => [r.id, r.points]))
  const poligonosDe = (ids: readonly string[]): RegionPoint[][] =>
    [...new Set(ids)].flatMap((id) => {
      const pontos = porId.get(id)
      return pontos === undefined ? [] : [pontos]
    })
  const camadas: CamadaDePerigo[] = [
    { cor: COR_DA_CINZA, poligonos: poligonosDe(perigos.flatMap((p) => p.cinzas ?? [])) },
    { cor: COR_DA_AGUA, poligonos: poligonosDe(perigos.filter((p) => p.tipo === 'agua').flatMap((p) => p.salas)) },
    { cor: COR_DO_FOGO, poligonos: poligonosDe(perigos.filter((p) => p.tipo === 'fogo').flatMap((p) => p.salas)) },
  ]
  return camadas.filter((c) => c.poligonos.length > 0)
}

export function drawPerigos(graphics: Graphics, regions: readonly Region[], perigos: readonly Perigo[]): void {
  graphics.clear()
  for (const camada of camadasDosPerigos(regions, perigos)) {
    for (const poligono of camada.poligonos) graphics.poly(poligono, true)
    graphics.fill({ color: camada.cor, alpha: ALPHA_DO_PERIGO })
  }
}
