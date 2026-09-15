import type { Wall, Light, Region, RegionPoint, Drawing, DrawingCap, FreehandTexture } from '../types/map'
import type { Point } from '../pixi/world'
import { simplifyToControlPoints } from './curveMath'

export function isValidWallDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

// wallKind: preferência de ferramenta (A6, "Parede interna/externa"). Omitido
// preserva o comportamento de hoje — `wallKind: undefined` === 'exterior',
// mesma convenção documentada em types/map.ts (Wall.wallKind).
export function buildWallFromDraft(id: string, start: Point, end: Point, wallKind?: Wall['wallKind']): Wall {
  return {
    id,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    blocksLight: true,
    blocksMove: true,
    door: null,
    wallKind,
  }
}

// Luz plena da tocha no D&D 5e: 20 ft = 4 células de 5 ft.
const LIGHT_RADIUS_IN_CELLS = 4
const DEFAULT_LIGHT_COLOR = '#ffaa33'
const DEFAULT_LIGHT_INTENSITY = 0.8

// radiusOverride: usado pelo arrasto da ferramenta "Luz" (PixiCanvas) — o
// usuario arrasta pra escolher o raio em vez do padrao proporcional ao grid.
// Omitido (clique simples, sem arrasto), cai no calculo de sempre.
export function buildLightAt(id: string, point: Point, gridSize: number, radiusOverride?: number): Light {
  return {
    id,
    x: point.x,
    y: point.y,
    radius: radiusOverride ?? gridSize * LIGHT_RADIUS_IN_CELLS,
    color: DEFAULT_LIGHT_COLOR,
    intensity: DEFAULT_LIGHT_INTENSITY,
  }
}

const DEFAULT_REGION_FILL_COLOR = '#3a7ad0'
const DEFAULT_REGION_FILL_PATTERN = 'solid'

// Nome padrão de uma Sala recém-criada (mesmo texto usado pelo botão da
// ferramenta em components/labels.ts:19, TOOL_LABELS.room) — editável depois
// via RoomControls/setRoomName. Compartilhado pelas 3 ferramentas de Sala
// (retângulo, Circular, Polígono Regular): as três produzem uma entidade
// "Sala", só a FORMA do contorno muda (RoomMeta.shape).
export const DEFAULT_ROOM_NAME = 'Sala'

export function buildRegionFromPoints(id: string, points: RegionPoint[], tag = 'region', fillColor = DEFAULT_REGION_FILL_COLOR, fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN): Region {
  return { id, points, tag, fillColor, fillPattern, data: {} }
}

export function isValidRoomDraft(start: Point, end: Point): boolean {
  return start.x !== end.x && start.y !== end.y
}

// D1 (ROADMAP.md): esta função é a única fábrica da ferramenta "Sala"
// (retângulo) — por isso `region.room` é setado incondicionalmente aqui, não
// como parâmetro opcional que o chamador pudesse esquecer de passar. Antes
// desta mudança a Region criada aqui era indistinguível de uma Região comum
// e RoomControls (nome + resize por canto, já implementado e testado)
// nunca aparecia na prática — ver ROADMAP.md, dívida D1.
export function buildRoomFromDraft(
  regionId: string,
  wallIds: [string, string, string, string],
  start: Point,
  end: Point,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
  roomName = DEFAULT_ROOM_NAME,
): { region: Region; walls: Wall[] } {
  const minX = Math.min(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxX = Math.max(start.x, end.x)
  const maxY = Math.max(start.y, end.y)

  // Sentido horário em coordenada de tela (y cresce pra baixo): topo, direita,
  // baixo, esquerda — casa com a convenção regionEdgeIndex 0..3 do vínculo Sala.
  const points: RegionPoint[] = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]

  const region: Region = {
    ...buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern),
    room: { shape: 'rect', name: roomName },
  }

  const walls: Wall[] = wallIds.map((wallId, edgeIndex) => {
    const from = points[edgeIndex]
    const to = points[(edgeIndex + 1) % points.length]
    return {
      id: wallId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: region.id,
      regionEdgeIndex: edgeIndex,
    }
  })

  return { region, walls }
}

// Abaixo desse raio (em px de mundo) o arrasto conta como "clique sem
// arrastar" — evita criar um poligono degenerado (todos os pontos colados)
// por causa de jitter de sub-pixel do próprio evento de mouse.
const MIN_POLYGON_RADIUS = 1

export function isValidRegularPolygonDraft(center: Point, radiusPoint: Point): boolean {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  return radius > MIN_POLYGON_RADIUS
}

/**
 * Poligono regular inscrito num círculo — base compartilhada por "Sala
 * Circular" (sides=24 fixo) e "Poligono Regular" (sides configurável, 3..12).
 * O primeiro vértice fica sob `radiusPoint` (ângulo inicial = ângulo de
 * `radiusPoint` em relação a `center`), os demais seguem em passos iguais de
 * 2π/sides — mesma convenção de arrasto "centro pra fora" da ferramenta
 * Círculo de desenho já existente.
 *
 * `wallIds.length` deve ser exatamente `sides`: cada parede vincula à região
 * pelo mesmo par `regionId`/`regionEdgeIndex` (0..sides-1) que `buildRoomFromDraft`
 * usa pro retângulo — é essa convenção compartilhada (ver roomLink.ts) que faz
 * toda a edição de vértice já construída pra Sala funcionar de graça aqui.
 *
 * D1 (ROADMAP.md): igual a `buildRoomFromDraft`, `region.room` é setado
 * incondicionalmente aqui — só que `shape: 'polygon'`, não `'rect'`. É essa
 * distinção de `shape` (types/map.ts, `RoomMeta`) que faz o hit-test do
 * PixiCanvas escolher resize por canto (rect) vs. arrasto de vértice/inserção
 * de ponto médio livre (polygon, comportamento de sempre) — ver PixiCanvas.tsx,
 * bloco `if (region.room?.shape === 'rect') {...} else {...}`.
 */
export function buildRegularPolygonRoomFromDraft(
  regionId: string,
  wallIds: string[],
  center: Point,
  radiusPoint: Point,
  sides: number,
  fillColor = DEFAULT_REGION_FILL_COLOR,
  fillPattern: Region['fillPattern'] = DEFAULT_REGION_FILL_PATTERN,
  roomName = DEFAULT_ROOM_NAME,
): { region: Region; walls: Wall[] } {
  const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
  const angle0 = Math.atan2(radiusPoint.y - center.y, radiusPoint.x - center.x)

  const points: RegionPoint[] = Array.from({ length: sides }, (_, i) => {
    const angle = angle0 + (i * 2 * Math.PI) / sides
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  })

  const region: Region = {
    ...buildRegionFromPoints(regionId, points, 'region', fillColor, fillPattern),
    room: { shape: 'polygon', name: roomName },
  }

  const walls: Wall[] = wallIds.map((wallId, edgeIndex) => {
    const from = points[edgeIndex]
    const to = points[(edgeIndex + 1) % points.length]
    return {
      id: wallId,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      blocksLight: true,
      blocksMove: true,
      door: null,
      regionId: region.id,
      regionEdgeIndex: edgeIndex,
    }
  })

  return { region, walls }
}

export function isValidFreehandDraft(points: Point[]): boolean {
  return points.length >= 2
}

// cap: opcional de propósito (Bug B2) — omitido, o objeto retornado NÃO tem
// a chave `cap` (spread condicional abaixo), igual ao que já saía daqui antes
// desta mudança: mesma convenção de `undefined` === 'round' documentada em
// types/map.ts (DrawingCap) e respeitada por drawDrawings.ts. Mantém
// `buildFreehandDrawing('id', pts, color, width)` (sem 5º argumento)
// compilando e com o mesmo objeto de sempre — não quebra os call sites
// existentes em PixiCanvas.tsx nem os testes abaixo que comparam por igualdade
// estrutural sem a chave `cap`.
// texture: mesma convenção opcional, agora pro pincel (N1, "caneta/lápis/
// marcador" — Fase 4). `undefined` === 'pen', mesma regra de `readFreehandTexture`
// (lib/brushTexture.ts).
export function buildFreehandDrawing(id: string, points: Point[], color: string, width: number, cap?: DrawingCap, texture?: FreehandTexture): Drawing {
  return { id, kind: 'freehand', points, color, width, ...(cap !== undefined ? { cap } : {}), ...(texture !== undefined ? { texture } : {}) }
}

export function isValidLineDraft(start: Point, end: Point): boolean {
  return start.x !== end.x || start.y !== end.y
}

export function buildLineDrawing(id: string, start: Point, end: Point, color: string, width: number, cap?: DrawingCap): Drawing {
  return { id, kind: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, width, ...(cap !== undefined ? { cap } : {}) }
}

export function isValidCircleDraft(radius: number): boolean {
  return radius > 0
}

// fillAlpha: opcional de propósito — mantém compatível a assinatura já usada
// pelo call site existente (PixiCanvas) e por drawingFactory.test.ts, que não
// o passam. Omitido, cai na mesma regra de sempre (mesma da migração de
// círculo legado em mapFile.ts:51: círculo novo e círculo migrado nascem com
// o mesmo fillAlpha para o mesmo `filled`). Passado, é o valor de
// `drawFillAlpha` (preferência de "próxima forma" — ver DrawingStyleControls).
export function buildCircleDrawing(id: string, center: Point, radius: number, color: string, width: number, filled: boolean, fillAlpha?: number): Drawing {
  return { id, kind: 'circle', cx: center.x, cy: center.y, radius, color, width, filled, fillAlpha: fillAlpha ?? (filled ? 0.5 : 0) }
}

export function isValidRectDraft(start: Point, end: Point): boolean {
  return start.x !== end.x && start.y !== end.y
}

// start/end = os dois cantos arrastados (qualquer ordem) — normaliza pro
// canto superior-esquerdo (x, y) + largura/altura positivas, mesma convenção
// de buildRoomFromDraft.
export function buildRectDrawing(id: string, start: Point, end: Point, color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const w = Math.abs(end.x - start.x)
  const h = Math.abs(end.y - start.y)
  return { id, kind: 'rect', x, y, w, h, color, width, filled, fillAlpha }
}

export function isValidEllipseDraft(rx: number, ry: number): boolean {
  return rx > 0 && ry > 0
}

// center = clique inicial (fixo); rx/ry = já calculados pelo chamador a
// partir do ponto de arrasto (Math.abs(dx), Math.abs(dy)) — mesma convenção
// de isValidCircleDraft, que recebe o raio já calculado, não os dois pontos.
export function buildEllipseDrawing(id: string, center: Point, rx: number, ry: number, color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  return { id, kind: 'ellipse', cx: center.x, cy: center.y, rx, ry, color, width, filled, fillAlpha }
}

export function isValidPolygonDraft(points: Point[]): boolean {
  return points.length >= 3
}

// Polígono livre (clique por vértice, fecha no duplo clique) — mesmo fluxo de
// buildRegionFromPoints, mas produzindo um Drawing em vez de uma Region.
export function buildPolygonDrawing(id: string, points: Point[], color: string, width: number, filled: boolean, fillAlpha: number): Drawing {
  return { id, kind: 'polygon', points, color, width, filled, fillAlpha }
}

export function isValidCurveDraft(points: Point[]): boolean {
  return points.length >= 2
}

export function buildCurveDrawing(id: string, rawPoints: Point[], color: string, width: number, cap?: DrawingCap): Drawing {
  return { id, kind: 'curve', points: simplifyToControlPoints(rawPoints), color, width, ...(cap !== undefined ? { cap } : {}) }
}

// Leitura B do pedido do usuário ("dobrar essa linha") — caminho mais barato
// encontrado: reaproveitar a Curva já existente (edição de vértice/inserção de
// ponto médio pronta em mapStore.ts: insertCurvePoint/updateCurvePoint) em vez
// de inventar edição de ponto de controle nova para `line`. Preserva id/cor/
// espessura/cap; os dois extremos viram os dois pontos de controle da curva —
// sozinhos ainda desenham reta (catmullRomToBezierSegments de 2 pontos não tem
// pra onde curvar), é arrastar o midpoint que a Curva já expõe (drawDrawings.ts
// desenha o midpoint vazado só quando selecionada, PixiCanvas.tsx:719 já trata
// esse gesto) que efetivamente "dobra" — ver CONTRATO. Não-`line` retorna o
// MESMO objeto (===), sem cópia: chamador não precisa checar o kind antes de
// chamar, e o caso "nada a converter" não aloca nem perde identidade.
export function convertLineToCurve(drawing: Drawing): Drawing {
  if (drawing.kind !== 'line') return drawing
  const points: Point[] = [{ x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }]
  return { id: drawing.id, kind: 'curve', points, color: drawing.color, width: drawing.width, ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}) }
}

// Sentido inverso de convertLineToCurve (Fase 4, Agente B — CONTRATO item 2:
// "entregue se for barata e sem perda destrutiva surpreendente"). SÓ é segura
// quando a curve tem EXATAMENTE 2 pontos de controle (os dois extremos, sem
// nenhum midpoint jamais inserido — ver PixiCanvas.tsx:719, insertCurvePoint):
// nesse caso os 2 pontos SÃO literalmente x1,y1/x2,y2, zero perda. Uma curve
// com 3+ pontos (usuário já arrastou o midpoint pelo menos uma vez) SEMPRE
// perderia os pontos intermediários virando line — por isso o retorno é a
// MESMA referência (no-op), no mesmo padrão do caso "não é line" acima:
// destruir dado em silêncio é proibido, e uma função pura não tem como avisar
// o usuário — quem decide avisar/desabilitar é a UI (LineShapeControls só
// oferece "Reta" quando `curve.points.length === 2`, ver CONTRATO).
export function convertCurveToLine(drawing: Drawing): Drawing {
  if (drawing.kind !== 'curve') return drawing
  if (drawing.points.length !== 2) return drawing
  const [p1, p2] = drawing.points
  return {
    id: drawing.id,
    kind: 'line',
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    color: drawing.color,
    width: drawing.width,
    ...(drawing.cap !== undefined ? { cap: drawing.cap } : {}),
  }
}

export function isValidTextDraft(): boolean {
  return true
}

// Mesmo default do PIXI.TextStyle (ver drawTextLabels.ts e o fallback de
// leitura em App.tsx) — mantém a aparência de rótulo já existente antes
// deste campo existir.
export const DEFAULT_TEXT_FONT_FAMILY = 'Arial'

export function buildTextDrawing(id: string, point: Point, color: string, fontSize: number, fontFamily = DEFAULT_TEXT_FONT_FAMILY): Drawing {
  return { id, kind: 'text', x: point.x, y: point.y, text: 'Rótulo', color, fontSize, fontFamily }
}
