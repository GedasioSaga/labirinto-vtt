import type { Drawing, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import { dentroDoPoligono, formaDoBalde, type RecorteDoBalde } from './baldeDeTextura'
import type { Caixa } from './texturas'

/**
 * O CHÃO PINTADO NUM PONTO (CONTRATO.md 11.11, a borda do penhasco do
 * continente no Desenhado): o id da textura que a ferramenta Texturas deixou
 * por cima naquele ponto, ou `null` (nada pintado, a borracha passou, ou uma
 * sala foi posta por cima). É o "chão do lado alto" que escolhe a linha de
 * cima da borda: grama, terra ou neve; `null` = a primeira (a grama).
 *
 * Os passos valem na ordem, o de depois por cima (como `pixi/texturasRaster.ts`
 * pinta): a resposta é a do ÚLTIMO passo que cobre o ponto. A força não conta:
 * a pincelada fraca ainda é o chão que o mestre escolheu ali.
 *
 * Puro: sem DOM nem Pixi. Cada tela pergunta com os passos que ELA recebeu.
 */

export type ConsultaDoChao = (p: RegionPoint) => string | null

interface Passo {
  readonly caixa: Caixa
  readonly cobre: (p: RegionPoint) => boolean
  /** O que fica no ponto quando este passo o cobre (`null` = a borracha, a sala). */
  readonly textura: string | null
}

const NADA: ConsultaDoChao = () => null

/** A consulta dos passos (`MapData.texturas`); sem passos, sempre `null`. */
export function consultaDoChaoPintado(
  passos: readonly PinceladaDeTextura[] | undefined,
  regioes: readonly Region[],
  desenhos: readonly Drawing[],
): ConsultaDoChao {
  if (passos === undefined || passos.length === 0) return NADA
  const lista: Passo[] = []
  for (const item of passos) {
    const passo = passoDe(item, regioes, desenhos)
    if (passo !== null) lista.push(passo)
  }
  if (lista.length === 0) return NADA
  return (p) => {
    for (let i = lista.length - 1; i >= 0; i -= 1) {
      const { caixa, cobre, textura } = lista[i]
      if (p.x < caixa.minX || p.x > caixa.maxX || p.y < caixa.minY || p.y > caixa.maxY) continue
      if (cobre(p)) return textura
    }
    return null
  }
}

function passoDe(item: PinceladaDeTextura, regioes: readonly Region[], desenhos: readonly Drawing[]): Passo | null {
  switch (item.tipo) {
    case 'pincel':
    case 'borracha': {
      if (item.pontos.length === 0 || !(item.raio > 0)) return null
      const { pontos, raio } = item
      return { caixa: caixaDe(pontos, raio), cobre: (p) => distanciaAoCaminho(p, pontos, false) <= raio, textura: item.tipo === 'pincel' ? item.textura : null }
    }
    case 'balde': {
      const forma = formaDoBalde(item.alvo, regioes, desenhos)
      if (forma === null) return null
      const { contorno, recortes } = forma
      return { caixa: forma.caixa, cobre: (p) => dentroDoPoligono(p, contorno) && !recortes.some((r) => recorteCobre(r, p)), textura: item.textura }
    }
    case 'sala': {
      const regiao = regioes.find((r) => r.id === item.regiao)
      if (regiao === undefined || regiao.points.length < 3) return null
      const pontos = regiao.points
      return { caixa: caixaDe(pontos, 0), cobre: (p) => dentroDoPoligono(p, pontos), textura: null }
    }
  }
}

function recorteCobre(r: RecorteDoBalde, p: RegionPoint): boolean {
  return r.tipo === 'area' ? dentroDoPoligono(p, r.pontos) : distanciaAoCaminho(p, r.pontos, r.fechada) <= r.largura / 2
}

function caixaDe(pontos: readonly RegionPoint[], folga: number): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const q of pontos) {
    minX = Math.min(minX, q.x)
    minY = Math.min(minY, q.y)
    maxX = Math.max(maxX, q.x)
    maxY = Math.max(maxY, q.y)
  }
  return { minX: minX - folga, minY: minY - folga, maxX: maxX + folga, maxY: maxY + folga }
}

/** A menor distância do ponto ao caminho (um ponto só = a distância a ele). */
function distanciaAoCaminho(p: RegionPoint, pontos: readonly RegionPoint[], fechado: boolean): number {
  if (pontos.length === 1) return Math.hypot(p.x - pontos[0].x, p.y - pontos[0].y)
  let menor = Infinity
  const lados = fechado ? pontos.length : pontos.length - 1
  for (let i = 0; i < lados; i += 1) menor = Math.min(menor, distanciaAoSegmento(p, pontos[i], pontos[(i + 1) % pontos.length]))
  return menor
}

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const u = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u))
}
