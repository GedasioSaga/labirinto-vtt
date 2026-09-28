import { Color, type Graphics } from 'pixi.js'
import type { Point } from './world'
import type { DrawingCap, DrawingDash } from '../types/map'
import { SELECTION_COLOR } from './constants'
import { buildStairFromDraft } from '../lib/stairs'
import { drawStairs } from './drawStairs'
import { computeMarkerStroke, computePencilSegments, type BrushTexture } from '../lib/brushTexture'
import { computeDashSegments, dashGeometry } from '../lib/dashPattern'
import { tracadoDaSalaLivre } from '../lib/tracadoDaSalaLivre'
import type { RoomFreeKind } from '../types/tools'

/** A ponta que os drafts de linha e curva usam — ver `drawLineDraft` abaixo:
 *  o preview sempre foi `round` e continua sendo, então o padrão do traço
 *  interrompido tem de ser calculado com essa mesma ponta, senão o preview
 *  mostraria um vão que o desenho final não tem. */
const PONTA_DO_DRAFT: DrawingCap = 'round'

/** Abre os pedacinhos do traço interrompido sem fechar o `stroke()` — quem
 *  chama decide cor/espessura/alpha uma vez só (mesma regra de `pixi/grid.ts`). */
function traceDashedPolyline(graphics: Graphics, points: Point[], width: number, dash: DrawingDash): boolean {
  const geometria = dashGeometry(dash, width, PONTA_DO_DRAFT)
  if (!geometria) return false
  for (const { from, to } of computeDashSegments(points, geometria)) {
    graphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
  }
  return true
}

export function drawWallDraft(graphics: Graphics, start: Point, end: Point): void {
  graphics.clear()
  graphics.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 4, color: SELECTION_COLOR, alpha: 0.8 })
}

/**
 * Opacidade da prévia da escada: a mesma de `drawPathDraft` ("a MESMA faixa
 * que vai nascer, só que translúcida"). Fica acima de `SECRET_ITEM_ALPHA`
 * (0,5) de propósito, para o rascunho não se ler como escada secreta.
 */
export const STAIR_DRAFT_ALPHA = 0.7

/** Id da escada de mentira que a prévia pinta; nunca vai para o mapa nem é selecionada. */
const STAIR_DRAFT_ID = 'rascunho-da-escada'

/**
 * Prévia do arrasto da Escada: `start` é o clique, `end` o ponto atual do
 * arrasto. Monta a escada com o MESMO `buildStairFromDraft` que o pointerup do
 * PixiCanvas grava e pinta com o MESMO `drawStairs` do mapa, só mais apagada
 * (`STAIR_DRAFT_ALPHA`): o que o mestre vê arrastando é o que fica ao soltar.
 * `cameraScale` e `rendererResolution` são os do mapa, para o traço fino sair
 * igual ao da gravada em qualquer zoom. `drawStairs` já limpa o Graphics, e
 * arrasto de comprimento zero não desenha nada, como a gravada.
 */
export function drawStairDraft(
  graphics: Graphics,
  start: Point,
  end: Point,
  stepWidth: number,
  cameraScale = 1,
  rendererResolution = 1,
): void {
  const stair = buildStairFromDraft(STAIR_DRAFT_ID, start, end, stepWidth)
  drawStairs(graphics, [stair], null, cameraScale, rendererResolution, STAIR_DRAFT_ALPHA)
}

/**
 * Preview do traçado ponto a ponto (Região e Sala livre): linha aberta até o
 * cursor e um ponto grudável em cada clique.
 *
 * `salaLivre` com "Arredondar" ligado troca a linha pelo contorno que o fim do
 * traçado GRAVA — `tracadoDaSalaLivre`, a mesma função que PixiCanvas usa ao
 * terminar —, com o cursor valendo como o próximo canto. Na Sala o contorno já
 * aparece fechado, com o canto do primeiro clique em curva, porque é assim que
 * ela nasce; na Parede ele fecha quando o cursor encaixa no primeiro clique.
 * Os pontos continuam nos cliques, que é onde a pessoa mira o próximo.
 * Sem Arredondar (e na Região), é a linha aberta de sempre.
 */
export function drawRegionDraft(
  graphics: Graphics,
  points: Point[],
  cursor: Point | null,
  salaLivre: { modo: RoomFreeKind; arredondar: boolean } | null = null,
): void {
  graphics.clear()
  if (points.length === 0) return

  const cliques = cursor ? [...points, cursor] : points
  const { pontos, fechado } = salaLivre?.arredondar
    ? tracadoDaSalaLivre(cliques, salaLivre.modo, true)
    : { pontos: cliques, fechado: false }
  const [first, ...rest] = pontos
  graphics.moveTo(first.x, first.y)
  for (const point of rest) {
    graphics.lineTo(point.x, point.y)
  }
  if (fechado) graphics.closePath()
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: SELECTION_COLOR })
  }
}

// cap: preferência de ferramenta (Bug B2, "ponta reta/arredondada"). Opcional
// com default 'round' — mesmo valor que estava hardcoded antes desta mudança
// — pra não exigir que o call site em PixiCanvas.tsx (fora do meu escopo)
// passe o parâmetro novo; a aparência do draft não muda pra quem ainda não
// tem a preferência ligada. Ver CONTRATO no relatório do agente B2 pra como
// ligar isso na preferência real de "próxima forma" da store.
// texture: preferência de ferramenta (N1, "pincel: caneta/lápis/marcador").
// Opcional com default 'pen' — mesmo comportamento de antes desta mudança —
// pra não exigir que o call site em PixiCanvas.tsx (fora do meu escopo)
// passe o parâmetro novo; o preview do pincel não muda pra quem ainda não
// tem a preferência ligada. Ver CONTRATO no relatório do agente pra como
// ligar isso na preferência real de "próxima textura" da store.
export function drawFreehandDraft(graphics: Graphics, points: Point[], color: string, width: number, cap: DrawingCap = 'round', texture: BrushTexture = 'pen'): void {
  graphics.clear()
  if (points.length < 2) return
  const numericColor = new Color(color).toNumber()

  if (texture === 'pencil') {
    for (const segment of computePencilSegments(points, width)) {
      graphics.moveTo(segment.from.x, segment.from.y).lineTo(segment.to.x, segment.to.y)
      graphics.stroke({ width: segment.width, color: numericColor, alpha: segment.alpha, cap, join: 'round' })
    }
    return
  }

  if (texture === 'marker') {
    const { width: markerWidth, alpha } = computeMarkerStroke(width)
    const [first, ...rest] = points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) graphics.lineTo(point.x, point.y)
    graphics.stroke({ width: markerWidth, color: numericColor, alpha, cap, join: 'round' })
    return
  }

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.stroke({ width, color: numericColor, alpha: 0.8, cap, join: 'round' })
}

// dash: preferência de ferramenta ("estilo do traço", `Drawing.dash`).
// Opcional com default 'solid' — o traço inteiriço de sempre — pra não exigir
// nada dos call sites que ainda não passam o parâmetro.
export function drawCurveDraft(graphics: Graphics, points: Point[], color: string, width: number, cap: DrawingCap = 'round', dash: DrawingDash = 'solid'): void {
  graphics.clear()
  if (points.length < 2) return
  // O draft da curva já desenhava polilinha (não Bézier): o traço
  // interrompido usa a MESMA polilinha, então preview e preview continuam
  // batendo entre si.
  if (!traceDashedPolyline(graphics, points, width, dash)) {
    const [first, ...rest] = points
    graphics.moveTo(first.x, first.y)
    for (const point of rest) graphics.lineTo(point.x, point.y)
  }
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap, join: 'round' })
}

export function drawLineDraft(graphics: Graphics, start: Point, end: Point, color: string, width: number, cap: DrawingCap = 'round', dash: DrawingDash = 'solid'): void {
  graphics.clear()
  if (!traceDashedPolyline(graphics, [start, end], width, dash)) {
    graphics.moveTo(start.x, start.y).lineTo(end.x, end.y)
  }
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8, cap })
}

export function drawCircleDraft(graphics: Graphics, center: Point, radius: number, color: string, width: number, filled: boolean): void {
  graphics.clear()
  graphics.circle(center.x, center.y, radius)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: 0.35 })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

// start/end = os dois cantos do arrasto (qualquer ordem) — mesma normalização
// de buildRectDrawing. fillAlpha vem da preferência "próxima forma"
// (drawFillAlpha), pra o preview já mostrar a opacidade real do resultado.
export function drawRectDraft(graphics: Graphics, start: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)
  graphics.rect(x, y, w, h)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: fillAlpha })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

// center = clique inicial (fixo); end = ponto de arrasto atual — rx/ry
// calculados aqui dentro (ao contrário de buildEllipseDrawing, que já os
// recebe prontos) porque o chamador do draft só tem os dois pontos brutos,
// ainda sem checagem de validade.
export function drawEllipseDraft(graphics: Graphics, center: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  const rx = Math.abs(end.x - center.x)
  const ry = Math.abs(end.y - center.y)
  graphics.ellipse(center.x, center.y, rx, ry)
  if (filled) graphics.fill({ color: new Color(color).toNumber(), alpha: fillAlpha })
  graphics.stroke({ width, color: new Color(color).toNumber(), alpha: 0.8 })
}

/**
 * Preview do polígono livre (Drawing, não Region) durante o clique-por-vértice
 * — mesmo esqueleto de drawRegionDraft (contorno aberto até o cursor + pontos
 * grudáveis), mas com a cor/espessura do desenho em vez de SELECTION_COLOR, e
 * com preview de preenchimento (fechado) quando `filled` e já há 3+ vértices,
 * igual ao restante das formas preenchíveis deste arquivo.
 */
export function drawPolygonDraft(graphics: Graphics, points: Point[], cursor: Point | null, color: string, width: number, filled: boolean, fillAlpha: number): void {
  graphics.clear()
  if (points.length === 0) return
  const numericColor = new Color(color).toNumber()

  if (filled && points.length >= 3) {
    graphics.poly(points).fill({ color: numericColor, alpha: fillAlpha })
  }

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  if (cursor) graphics.lineTo(cursor.x, cursor.y)
  graphics.stroke({ width, color: numericColor, alpha: 0.8, cap: 'round', join: 'round' })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: SELECTION_COLOR })
  }
}

/**
 * Preview do Caminho durante o clique-ponto-a-ponto: a MESMA faixa que vai
 * nascer (cor e largura escolhidas antes do primeiro ponto), só que
 * translúcida e com um ponto grudável em cada canto já cravado — assim a
 * pessoa vê a grossura e a cor reais antes de fechar, e não descobre no fim
 * que a trilha ficou fina demais.
 */
export function drawPathDraft(graphics: Graphics, points: Point[], cursor: Point | null, color: string, width: number): void {
  graphics.clear()
  if (points.length === 0) return
  const numericColor = new Color(color).toNumber()

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  if (cursor) graphics.lineTo(cursor.x, cursor.y)
  graphics.stroke({ width, color: numericColor, alpha: 0.7, cap: 'round', join: 'round' })

  for (const point of points) {
    graphics.circle(point.x, point.y, 4).fill({ color: SELECTION_COLOR })
  }
}

/**
 * Preview do raio da ferramenta "Luz" durante o arrasto — mesmo estilo visual
 * de drawCircleDraft (fill translúcido + stroke), sem os parâmetros de cor/
 * largura de desenho porque a luz não tem esses controles no toolbar; usa
 * SELECTION_COLOR, igual ao restante dos drafts de forma nesse arquivo.
 */
export function drawLightDraft(graphics: Graphics, center: Point, radius: number): void {
  graphics.clear()
  graphics.circle(center.x, center.y, radius)
  graphics.fill({ color: SELECTION_COLOR, alpha: 0.2 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}

/**
 * Preview do poligono regular inscrito no círculo definido por `center` (fixo,
 * clique inicial) e `radiusPoint` (cursor atual) — mesma trigonometria de
 * `buildRegularPolygonRoomFromDraft`, só que sem materializar Region/Wall
 * ainda. `sides=24` (Sala Circular) já aproxima um círculo suave; `sides`
 * baixo (Polígono Regular) mostra o polígono de fato.
 */
export function drawRegularPolygonDraft(graphics: Graphics, center: Point, radiusPoint: Point, sides: number, fillColor: string): void {
  graphics.clear()
  if (sides < 3) return

  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  const angle0 = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x)
  const points: Point[] = Array.from({ length: sides }, (_, i) => {
    const angle = angle0 + (i * 2 * Math.PI) / sides
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })

  const [first, ...rest] = points
  graphics.moveTo(first.x, first.y)
  for (const point of rest) graphics.lineTo(point.x, point.y)
  graphics.closePath()
  graphics.fill({ color: new Color(fillColor).toNumber(), alpha: 0.35 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}

export function drawRoomDraft(graphics: Graphics, start: Point, end: Point, fillColor: string): void {
  graphics.clear()
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)
  graphics.rect(minX, minY, width, height)
  graphics.fill({ color: new Color(fillColor).toNumber(), alpha: 0.35 })
  graphics.stroke({ width: 2, color: SELECTION_COLOR, alpha: 0.8 })
}
