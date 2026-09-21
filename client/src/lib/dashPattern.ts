/**
 * Geometria PURA do traço interrompido (`Drawing.dash`, types/map.ts) — sem
 * Pixi e sem React, no mesmo espírito de `lib/brushTexture.ts`: aqui só sai a
 * lista de pedacinhos a desenhar; quem chama `stroke()` é o render
 * (`pixi/drawDrawings.ts`, `pixi/drawDraft.ts`).
 *
 * POR QUE NÃO REUSAR `pixi/grid.ts` (`strokeDashedSegment`): a grade desenha
 * com traço de 1 px e ponta reta, então lá dá para cravar 10/6 e 2/6 px de
 * mundo e pronto. O traço de desenho tem Espessura de 1 a 20 px e Ponta
 * arredondada/quadrada, e as duas coisas comem o vão:
 *
 * - a ponta arredondada/quadrada estende a tinta em `width / 2` PARA FORA de
 *   cada extremidade do pedacinho, ou seja `width` por pedacinho. Com
 *   Espessura 7 e o 2/6 da grade, cada "ponto" viraria uma cápsula de 9 px
 *   dentro de um período de 8: o pontilhado sairia CONTÍNUO na tela — o
 *   mesmo traço cheio de sempre, que é exatamente o que esta feature veio
 *   resolver;
 * - o padrão precisa acompanhar a espessura, senão o mesmo 10/6 fica ralo
 *   demais num traço de 1 px e grudado num traço de 20 px.
 *
 * Por isso o período e a tinta são MÚLTIPLOS da espessura, e o comprimento
 * geométrico desconta a extensão da ponta.
 */
import type { DrawingCap, DrawingDash, DrawingPoint } from '../types/map'
import { catmullRomToBezierSegments } from './curveMath'

/** Um pedacinho reto do traço, em coordenadas de mundo. */
export interface DashSegment {
  from: DrawingPoint
  to: DrawingPoint
}

/** Resultado de `dashGeometry`, em px de mundo. */
export interface DashGeometry {
  /** Comprimento GEOMÉTRICO do pedacinho (antes de a ponta estendê-lo). */
  length: number
  /** Distância entre o começo de um pedacinho e o começo do próximo. */
  period: number
}

/**
 * Período e tinta de cada estilo, em múltiplos da espessura. "Tinta" é o que
 * se enxerga na tela (já incluindo a ponta), não o comprimento geométrico:
 * `dashed` cobre 3/5 do caminho (traço claramente maior que o vão, lê-se como
 * "limite"), `dotted` cobre 1,4/2,8 = metade em pontos curtos e vãos largos.
 */
const PADRAO: Record<Exclude<DrawingDash, 'solid'>, { periodo: number; tinta: number }> = {
  dashed: { periodo: 5, tinta: 3 },
  dotted: { periodo: 2.8, tinta: 1.4 },
}

/** Teto de pedacinhos por traço: linha gigante com espessura 1 não pode virar
 *  dezenas de milhares de `moveTo`/`lineTo` num frame de arrasto. */
const MAX_PEDACINHOS = 4000

/** Amostras por trecho de Bézier ao achatar uma curva em polilinha. 12 mantém
 *  o desvio bem abaixo de 1 px nas curvaturas que o editor produz (pontos de
 *  controle a partir de 24 px, `simplifyToControlPoints`) e o custo baixo. */
const AMOSTRAS_POR_BEZIER = 12

/** Espessura mínima considerada — evita período zero/negativo. */
const ESPESSURA_MINIMA = 0.5

/** Quanto a ponta estende a tinta além da geometria, somando as duas pontas. */
function extensaoDaPonta(cap: DrawingCap, width: number): number {
  return cap === 'butt' ? 0 : width
}

/** `undefined` === 'solid' — mapa salvo antes desta feature abre igual. */
export function readDash(drawing: { dash?: DrawingDash }): DrawingDash {
  return drawing.dash ?? 'solid'
}

/**
 * Geometria do padrão, ou `null` quando o traço é contínuo — `null` é o sinal
 * para o render seguir pelo caminho de sempre, sem passar por aqui.
 */
export function dashGeometry(dash: DrawingDash, width: number, cap: DrawingCap): DashGeometry | null {
  if (dash === 'solid') return null
  const espessura = Math.max(width, ESPESSURA_MINIMA)
  const { periodo, tinta } = PADRAO[dash]
  // Piso de 15% da espessura: descontada a ponta arredondada, o pontilhado
  // ficaria com comprimento 0, e segmento degenerado é geometria que o Pixi
  // pode descartar — o ponto sumiria em vez de virar bolinha.
  const length = Math.max(tinta * espessura - extensaoDaPonta(cap, espessura), espessura * 0.15)
  return { length, period: periodo * espessura }
}

/**
 * Quebra uma polilinha (2 pontos = uma reta) nos pedacinhos do padrão. O
 * comprimento acumulado ATRAVESSA os vértices: o padrão não reinicia a cada
 * canto, senão a cadência quebraria em toda dobra da curva.
 */
export function computeDashSegments(points: DrawingPoint[], geometry: DashGeometry): DashSegment[] {
  const { length, period } = geometry
  if (points.length < 2 || period <= 0 || length <= 0) return []

  const pedacinhos: DashSegment[] = []
  let percorrido = 0

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const trecho = Math.hypot(dx, dy)
    if (trecho === 0) continue
    const ux = dx / trecho
    const uy = dy / trecho
    const fimDoTrecho = percorrido + trecho

    let k = Math.floor(percorrido / period)
    while (k * period < fimDoTrecho) {
      const de = Math.max(k * period, percorrido)
      const ate = Math.min(k * period + length, fimDoTrecho)
      if (ate > de) {
        pedacinhos.push({
          from: { x: a.x + ux * (de - percorrido), y: a.y + uy * (de - percorrido) },
          to: { x: a.x + ux * (ate - percorrido), y: a.y + uy * (ate - percorrido) },
        })
        if (pedacinhos.length >= MAX_PEDACINHOS) return pedacinhos
      }
      k += 1
    }

    percorrido = fimDoTrecho
  }

  return pedacinhos
}

/**
 * Achata a mesma curva que `drawDrawings.ts` desenha (Catmull-Rom → Bézier)
 * numa polilinha, para o padrão poder ser medido por comprimento de arco.
 * Só é chamada quando o traço NÃO é contínuo: a curva contínua continua indo
 * para a tela como Bézier de verdade, sem perder nada.
 */
export function flattenCurve(points: DrawingPoint[]): DrawingPoint[] {
  if (points.length < 2) return points
  const achatada: DrawingPoint[] = [{ x: points[0].x, y: points[0].y }]
  let atual = points[0]
  for (const { c1, c2, end } of catmullRomToBezierSegments(points)) {
    for (let passo = 1; passo <= AMOSTRAS_POR_BEZIER; passo += 1) {
      const t = passo / AMOSTRAS_POR_BEZIER
      const u = 1 - t
      achatada.push({
        x: u * u * u * atual.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
        y: u * u * u * atual.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
      })
    }
    atual = end
  }
  return achatada
}
