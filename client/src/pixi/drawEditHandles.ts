import type { Graphics } from 'pixi.js'
import type { MapData, RegionPoint, Drawing, Region } from '../types/map'
import type { Selection, DrawingTool } from '../types/tools'
import type { Point } from './world'
import { regionEdgeMidpoints } from '../lib/roomLink'
import { isAxisAlignedRect } from '../lib/roomOps'
import { roomRotateHandle, roomRotationOf } from '../lib/roomRotation'
import { isLocked } from '../lib/itemTransform'
import { drawRoomHandles } from './drawRoomHandles'
import { drawingBoundingBox, tokenBoundingBox, propBoundingBox } from '../lib/objectTransform'
import { drawBoxResizeHandles } from './drawResizeHandles'
import { alignToPixel, pixelGrid, strokeWidthInWorld } from './pixelAlign'
import { selectionOutlineWidth } from './drawWalls'
import {
  SELECTION_COLOR, STROKE_WEIGHT, HANDLE_VISUAL_RADIUS, HANDLE_MIDPOINT_RADIUS, CORNER_HANDLE_KEYLINE_COLOR,
} from './constants'

/** Tolerância de clique/arrasto sobre a alça de raio da Luz, em px de mundo —
 *  mesma ordem de grandeza de VERTEX_MAGNET_TOLERANCE (12) usada pros outros
 *  ímãs de vértice do app. */
export const LIGHT_RADIUS_HANDLE_TOLERANCE = 10

/**
 * Forma mínima que a alça de raio precisa pra desenhar/hit-testar: um centro
 * e um raio. `Light` a satisfaz nativamente (`x`/`y`/`radius`) — generalizado
 * de `Light` pra este tipo estrutural (item 18 do plano) pra a MESMA alça
 * servir também o Drawing 'circle', que guarda o centro em `cx`/`cy` em vez
 * de `x`/`y`; quem chama com um Drawing circle passa um objeto adaptado
 * (ver `circleDrawingRadiusHandle` abaixo) em vez desta função ganhar uma
 * segunda versão. Todo call site existente (`PixiCanvas.tsx`,
 * `lib/hoverHitTest.ts`) já passa um `Light` de verdade, que satisfaz este
 * tipo estruturalmente — nenhum deles precisa mudar.
 */
export interface RadiusHandleTarget {
  x: number
  y: number
  radius: number
}

/**
 * Ponto onde a alça de raio é desenhada e onde o arrasto de raio deve
 * responder — sempre sobre a borda do círculo, no eixo +x a partir do centro.
 * Função pura: usada tanto pelo desenho abaixo quanto pelo hit-test do
 * PixiCanvas (que não reimporta pixi.js, só matemática).
 */
export function lightRadiusHandlePosition(target: RadiusHandleTarget): Point {
  return { x: target.x + target.radius, y: target.y }
}

/**
 * Hit-test da alça de raio — usado no pointerdown da ferramenta Selecionar
 * (com a Luz, ou o Drawing 'circle', já selecionado) pra decidir se o clique
 * começou um arrasto de raio em vez de mover a seleção/fazer pan.
 */
export function findLightRadiusHandleAt(target: RadiusHandleTarget, point: Point, tolerance = LIGHT_RADIUS_HANDLE_TOLERANCE): boolean {
  const handle = lightRadiusHandlePosition(target)
  return Math.hypot(point.x - handle.x, point.y - handle.y) <= tolerance
}

/**
 * Contorno do alcance atual (vazado, sem fill — mesma convenção de ponto
 * médio usada por drawRegionHandles) + a alça preenchida na borda, arrastável
 * pra redimensionar o raio.
 */
function drawLightRadiusHandle(graphics: Graphics, target: RadiusHandleTarget): void {
  graphics.circle(target.x, target.y, target.radius).stroke({ width: STROKE_WEIGHT.hairline, color: SELECTION_COLOR, alpha: 0.6 })
  const handle = lightRadiusHandlePosition(target)
  graphics.circle(handle.x, handle.y, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
}

type CircleDrawing = Extract<Drawing, { kind: 'circle' }>

/**
 * Item 18 do plano: adapta um Drawing 'circle' (`cx`/`cy`/`radius`) pro
 * formato que a alça de raio espera (`x`/`y`/`radius`) — ponto de entrada de
 * uma linha só pro integrador, tanto pra desenhar (dentro de
 * `drawEditHandles`, abaixo) quanto pro hit-test no pointerdown de
 * `PixiCanvas.tsx`, espelhando exatamente o bloco que já existe pra Luz
 * (`findLightRadiusHandleAt(light, worldPoint)`, `PixiCanvas.tsx:1054`) —
 * ver CONTRATO no relatório do agente.
 */
export function circleDrawingRadiusHandle(drawing: CircleDrawing): RadiusHandleTarget {
  return { x: drawing.cx, y: drawing.cy, radius: drawing.radius }
}

/**
 * Vértice: círculo preenchido. Ponto médio de aresta: círculo vazado (só
 * stroke, sem fill) — mesma distinção visual usada pelo draft de Região
 * (`drawRegionDraft`) e pelos handles de Curva em `drawDrawings.ts`.
 */
function drawRegionHandles(graphics: Graphics, points: RegionPoint[]): void {
  for (const point of points) {
    graphics.circle(point.x, point.y, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
  }
  for (const midpoint of regionEdgeMidpoints(points)) {
    graphics.circle(midpoint.x, midpoint.y, HANDLE_MIDPOINT_RADIUS).stroke({ width: STROKE_WEIGHT.thin, color: SELECTION_COLOR })
  }
}

/**
 * RISCO Nº 7 do plano (docs/PLANO-FASES.md §5): `drawEditHandles` serve
 * Wall/Region/Line, e é o único lugar que decide "esta Região é uma Sala
 * retangular?" antes de desenhar. `region.room?.shape === 'rect'` → alças
 * quadradas de resize (`drawRoomHandles`); QUALQUER outro caso — sem `room`
 * (região comum) OU `room.shape === 'polygon'` (Sala Circular/Polígono
 * Regular) — mantém os handles redondos de sempre (`drawRegionHandles`).
 * Guard estreito de propósito (`=== 'rect'`, não `room !== undefined`): um
 * guard largo aqui quebraria a edição de região comum, não só de Sala — ver
 * `drawEditHandles.test.ts` para os 3 casos cobertos.
 */
function drawRegionOrRoomHandles(graphics: Graphics, region: { points: RegionPoint[]; room?: { shape: 'rect' | 'polygon' } }): void {
  if (region.room?.shape === 'rect') {
    // Torta (girada fora de 0/90/180/−90°): sem chip de canto. Puxar um canto
    // reconstruiria um retângulo reto no lugar dela (`isAxisAlignedRect`); os
    // chips voltam quando ela é girada de novo a um múltiplo de 90°.
    if (isAxisAlignedRect(region.points)) drawRoomHandles(graphics, region.points)
  } else {
    drawRegionHandles(graphics, region.points)
  }
}

/** O que o desenho das alças precisa saber da câmera e do gesto em curso — nada disso mora no mapa. */
export interface EditHandlesView {
  /** Zoom: a alça de girar tem tamanho fixo na TELA. Ausente = 1. */
  cameraScale?: number
  /** Resolução do renderer, para o traço fino da alça cair inteiro num pixel físico. Ausente = 1. */
  rendererResolution?: number
  /** A sala está sendo girada agora: a alça aparece acesa, "pega". */
  rotating?: boolean
}

/**
 * A alça de GIRAR SALA: bolinha acima do topo da sala, ligada a ele por um
 * traço fino. Linguagem do minimapa — linha clara e fina sobre fundo escuro: a
 * cabeça é o escuro das alças (`CORNER_HANDLE_KEYLINE_COLOR`) com um aro fino
 * amarelo, o negativo do chip de canto. É a única coisa redonda e oca do
 * canvas, então não se confunde com o vértice (bolinha amarela cheia) nem com
 * o canto (quadrado amarelo). Pega, durante o arrasto, a cabeça acende inteira.
 *
 * Sem animação de entrada, pelo mesmo motivo do chip de canto: o "dá para
 * pegar aqui" precisa estar na tela no mesmo quadro da seleção.
 *
 * Tamanho fixo na TELA em qualquer zoom, como o contorno de seleção. Sala
 * travada não tem alça — o gesto não existe, e controle que não faz nada é
 * pior que nenhum (o mesmo `canInteract` do pointerdown).
 */
function drawRoomRotateHandle(graphics: Graphics, region: Region, view: EditHandlesView): void {
  if (!region.room || isLocked(region)) return
  const scale = view.cameraScale ?? 1
  const handle = roomRotateHandle(region.points, roomRotationOf(region.room), scale)
  if (!handle) return
  let { base, knob } = handle
  // Traço fino nítido: com a sala reta o traço fica em pé (ou deitado) e,
  // centrado no meio do pixel físico, pinta 1 coluna forte em vez de 2 meio
  // apagadas (`pixi/pixelAlign.ts`). Torta, o traço é diagonal e o
  // antisserrilhado é inevitável.
  const grid = pixelGrid(scale, view.rendererResolution ?? 1, STROKE_WEIGHT.hairline)
  if (handle.up.x === 0) {
    const x = alignToPixel(knob.x, grid)
    base = { x, y: base.y }
    knob = { x, y: knob.y }
  } else if (handle.up.y === 0) {
    const y = alignToPixel(knob.y, grid)
    base = { x: base.x, y }
    knob = { x: knob.x, y }
  }
  graphics.moveTo(base.x, base.y).lineTo(knob.x, knob.y).stroke({ width: strokeWidthInWorld(grid), color: SELECTION_COLOR })
  // O aro tem o peso do contorno de seleção (2 px de tela): a alça é parte da
  // seleção. Com 1,5 px ela sumia ao lado dos chips de canto (medido na tela).
  graphics
    .circle(knob.x, knob.y, handle.radius)
    .fill({ color: view.rotating ? SELECTION_COLOR : CORNER_HANDLE_KEYLINE_COLOR })
    .stroke({ width: selectionOutlineWidth(scale), color: SELECTION_COLOR })
}

/**
 * Handles de edição de vértice/aresta/canto para Parede, Região, Drawing
 * (line / rect / ellipse / polygon), Token e Prop — só aparecem com a
 * ferramenta Selecionar ativa e algo relevante selecionado. Uma Parede
 * vinculada a uma Região (`wall.regionId` definido, caso da ferramenta Sala)
 * delega para os handles da região dona inteira, é assim que "clicar na
 * parede da sala mostra os vértices da sala inteira" se comporta — inclusive
 * quando essa região é uma Sala retangular (`drawRegionOrRoomHandles` decide
 * qual conjunto de alças usar). A Curva mantém seu próprio mecanismo de
 * handle em `drawDrawings.ts` — não mexer.
 *
 * Agente B3 (dossiê F4, bug3): `rect`/`ellipse`/`polygon` (Drawing), Token e
 * Prop ganharam alça de canto quadrada (`drawBoxResizeHandles`, mesma
 * linguagem visual de `drawRoomHandles` — quadrado preenchido = "isto
 * redimensiona"), via bounding box (`lib/objectTransform.ts`). `text`/
 * `freehand` (Drawing) e `curve` não ganham handle NENHUM aqui: têm move
 * (ver CONTRATO em relatório), mas sem resize nesta fase.
 *
 * Frente B, Onda 3 (item 18): `circle` (Drawing) ganhou a alça de raio
 * redonda (`drawLightRadiusHandle`, a mesma da Luz) — era o único Drawing
 * sem handle nenhum, o que parecia bug.
 *
 * Girar sala: toda Sala (qualquer forma) ganha a alça de girar acima dela
 * (`drawRoomRotateHandle`), selecionada por si ou pela parede. `view` traz o
 * zoom, porque essa alça tem tamanho fixo na tela; sem `view`, zoom 1.
 */
export function drawEditHandles(
  graphics: Graphics,
  map: MapData,
  selection: Selection | null,
  activeTool: DrawingTool,
  view: EditHandlesView = {},
): void {
  graphics.clear()
  if (activeTool !== 'select' || !selection) return

  if (selection.kind === 'region') {
    const region = map.regions.find((r) => r.id === selection.id)
    if (region) {
      drawRegionOrRoomHandles(graphics, region)
      drawRoomRotateHandle(graphics, region, view)
    }
    return
  }

  if (selection.kind === 'wall') {
    const wall = map.walls.find((w) => w.id === selection.id)
    if (!wall) return

    if (wall.regionId !== undefined) {
      const region = map.regions.find((r) => r.id === wall.regionId)
      if (region) {
        drawRegionOrRoomHandles(graphics, region)
        drawRoomRotateHandle(graphics, region, view)
      }
      return
    }

    graphics.circle(wall.x1, wall.y1, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
    graphics.circle(wall.x2, wall.y2, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
    return
  }

  if (selection.kind === 'drawing') {
    const drawing = map.drawings.find((d) => d.id === selection.id)
    if (!drawing) return

    if (drawing.kind === 'line') {
      graphics.circle(drawing.x1, drawing.y1, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
      graphics.circle(drawing.x2, drawing.y2, HANDLE_VISUAL_RADIUS).fill({ color: SELECTION_COLOR })
      return
    }

    // Item 18 do plano: círculo era o único Drawing sem alça NENHUMA
    // (drawingBoundingBox devolve null pra ele, de propósito — não é uma
    // bounding box que faça sentido redimensionar por canto). Reaproveita a
    // MESMA alça de raio da Luz (drawLightRadiusHandle, generalizada acima
    // de Light pra RadiusHandleTarget) em vez de duplicar a lógica — só
    // adapta cx/cy (nome do campo no Drawing) pra x/y (nome que a alça
    // espera), via circleDrawingRadiusHandle.
    if (drawing.kind === 'circle') {
      drawLightRadiusHandle(graphics, circleDrawingRadiusHandle(drawing))
      return
    }

    // rect/ellipse/polygon: alça de canto por bounding box. `drawingBoundingBox`
    // devolve null pros kinds restantes (text/freehand — circle já retornou
    // acima) — nenhum desenho nesse caso, mesmo padrão de "seleção órfã não
    // desenha nada" abaixo.
    const box = drawingBoundingBox(drawing)
    if (box) drawBoxResizeHandles(graphics, box)
    return
  }

  if (selection.kind === 'token') {
    const token = map.tokens.find((t) => t.id === selection.id)
    if (token) drawBoxResizeHandles(graphics, tokenBoundingBox(token, map.grid))
    return
  }

  if (selection.kind === 'prop') {
    const prop = map.props.find((p) => p.id === selection.id)
    if (prop) drawBoxResizeHandles(graphics, propBoundingBox(prop))
    return
  }

  if (selection.kind === 'light') {
    const light = map.lights.find((l) => l.id === selection.id)
    if (light) drawLightRadiusHandle(graphics, light)
  }
}
