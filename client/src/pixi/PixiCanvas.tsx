import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { MapData } from '../types/map'
import { useMapStore, DOOR_LENGTH } from '../stores/mapStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { subscribeToBackgroundRedraw } from '../stores/backgroundSubscription'
import { panBy, zoomAt, constrainToAngleStep, angleDegrees, type Camera, type Point } from './world'
import { computeVisibleGridLines } from './grid'
import { drawGrid } from './drawGrid'
import { computeVisibleHexCenters } from './hexGrid'
import { drawHexGrid } from './drawHexGrid'
import { snapToHexGrid } from './hexGrid'
import { drawWalls } from './drawWalls'
import { drawLights } from './drawLights'
import { createRegionsRenderer } from './drawRegions'
import { drawTokens } from './drawTokens'
import { drawWallDraft, drawRegionDraft, drawFreehandDraft, drawLineDraft, drawCircleDraft, drawCurveDraft, drawRoomDraft, drawRegularPolygonDraft, drawLightDraft } from './drawDraft'
import { snapToGrid } from './tokenInteraction'
import {
  isValidWallDraft,
  buildWallFromDraft,
  buildLightAt,
  buildRegionFromPoints,
  isValidFreehandDraft,
  buildFreehandDrawing,
  isValidLineDraft,
  buildLineDrawing,
  isValidCircleDraft,
  buildCircleDrawing,
  isValidCurveDraft,
  buildCurveDrawing,
  buildTextDrawing,
  isValidRoomDraft,
  buildRoomFromDraft,
  isValidRegularPolygonDraft,
  buildRegularPolygonRoomFromDraft,
} from '../lib/drawingFactory'
import { createPropsRenderer } from './drawProps'
import { createTextLabelsRenderer } from './drawTextLabels'
import { createAngleIndicatorRenderer } from './drawAngleIndicator'
import { subscribeToPropsRedraw } from '../stores/propsSubscription'
import { pickImageFile, importPropImage } from '../lib/imageImport'
import { mapDirFor } from '../lib/mapFileIO'
import { findSelectableAt, findCurveControlPointAt, findWallAt, findNearestExistingVertex } from '../lib/selectionHitTest'
import type { DrawingTool, SelectionKind } from '../types/tools'
import { drawDrawings } from './drawDrawings'
import { drawEditHandles } from './drawEditHandles'
import { regionEdgeMidpoints } from '../lib/roomLink'
import { computeAlignment } from '../lib/alignmentGuides'
import { drawGuides } from './drawGuides'

// "Sala Circular" é o mesmo poligono regular de "Poligono Regular", só que com
// segments fixo alto o bastante pra ler como círculo suave — não configurável
// pelo usuário (ver PolygonSidesControls, que só aparece pra 'roomPolygon').
const ROOM_CIRCLE_SIDES = 24

// Abaixo disso (em unidades de mundo) o pointerup da ferramenta "Luz" trata
// como clique simples (sem arrasto de verdade) e usa o raio padrao do grid,
// em vez do raio arrastado — evita que um micro-tremor do mouse vire luz
// minuscula sem querer.
const LIGHT_CLICK_THRESHOLD = 5

// Tolerância (em pixels de mundo) do "ímã" de vértice ao desenhar Parede ou
// Linha: se o ponto inicial ou final do arrasto cai dentro deste raio de um
// vértice já existente (ponta de outra parede, vértice de região, ponta de
// outra linha/curva — ver findNearestExistingVertex), gruda EXATAMENTE nesse
// vértice em vez de ficar solto perto dele. Mesmo valor usado como default
// em findNearestExistingVertex; repetido aqui só para o call site ficar
// explícito sobre qual tolerância está em jogo.
const VERTEX_MAGNET_TOLERANCE = 12

// Rótulo do indicador de ângulo durante o arrasto de Parede/Linha. Travado
// (Ctrl segurado) sempre cai num múltiplo exato de stepDegrees — arredondar
// pro inteiro mais próximo só limpa erro de ponto flutuante (ex.: 89.9999999
// vira "90°"), não perde precisão real. Livre (sem Ctrl) mostra 1 casa
// decimal (ex.: "87.3°") pra deixar claro que não está travado num valor exato.
function formatAngleLabel(degrees: number, locked: boolean): string {
  return locked ? `${Math.round(degrees)}°` : `${degrees.toFixed(1)}°`
}

export function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let destroyed = false
    let initialized = false
    const app = new Application()

    const setup = async () => {
      await app.init({ backgroundColor: 0x2b2b2b, resizeTo: el })
      if (destroyed) {
        app.destroy(true, { children: true })
        return
      }
      initialized = true
      el.appendChild(app.canvas)

      const world = new Container()
      app.stage.addChild(world)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      const backgroundSprite = new Sprite(Texture.EMPTY)
      const gridGraphics = new Graphics()
      const regionsContainer = new Container()
      const wallsGraphics = new Graphics()
      const drawingsGraphics = new Graphics()
      const textLabelsContainer = new Container()
      const propsContainer = new Container()
      const lightsGraphics = new Graphics()
      const tokensContainer = new Container()
      const handlesGraphics = new Graphics()
      const draftGraphics = new Graphics()
      const angleIndicatorContainer = new Container()
      const guidesGraphics = new Graphics()
      world.addChild(
        backgroundSprite,
        gridGraphics,
        regionsContainer,
        wallsGraphics,
        drawingsGraphics,
        textLabelsContainer,
        propsContainer,
        lightsGraphics,
        tokensContainer,
        handlesGraphics,
        draftGraphics,
        angleIndicatorContainer,
        guidesGraphics,
      )

      let camera: Camera = useMapStore.getState().camera
      world.position.set(camera.x, camera.y)
      world.scale.set(camera.scale)

      const computeViewport = () => ({
        left: -camera.x / camera.scale,
        top: -camera.y / camera.scale,
        right: (app.screen.width - camera.x) / camera.scale,
        bottom: (app.screen.height - camera.y) / camera.scale,
      })

      const redrawGrid = () => {
        const { map } = useMapStore.getState()
        if (!map.showGrid) {
          gridGraphics.clear()
          return
        }
        const viewport = {
          left: -camera.x / camera.scale,
          top: -camera.y / camera.scale,
          right: (app.screen.width - camera.x) / camera.scale,
          bottom: (app.screen.height - camera.y) / camera.scale,
        }
        if (map.gridShape === 'hex') {
          drawHexGrid(gridGraphics, computeVisibleHexCenters(map.grid, viewport), map.grid)
        } else {
          drawGrid(gridGraphics, computeVisibleGridLines(map.grid, viewport), viewport)
        }
      }

      const redrawShapes = () => {
        const { map, selection, activeTool } = useMapStore.getState()
        regionsRenderer.draw(regionsContainer, map.regions, selection?.kind === 'region' ? selection.id : null)
        drawWalls(wallsGraphics, map.walls, selection?.kind === 'wall' ? selection.id : null)
        drawLights(lightsGraphics, map.lights, selection?.kind === 'light' ? selection.id : null)
        drawDrawings(drawingsGraphics, map.drawings, selection?.kind === 'drawing' ? selection.id : null)
        textLabelsRenderer.draw(textLabelsContainer, map.drawings, selection?.kind === 'drawing' ? selection.id : null)
        drawEditHandles(handlesGraphics, map, selection, activeTool)
      }

      const redrawTokens = () => {
        const { map, selection } = useMapStore.getState()
        drawTokens(tokensContainer, map.tokens, map.grid, selection?.kind === 'token' ? selection.id : null)
      }

      const propsRenderer = createPropsRenderer()
      const textLabelsRenderer = createTextLabelsRenderer()
      const angleIndicatorRenderer = createAngleIndicatorRenderer()
      const regionsRenderer = createRegionsRenderer()

      const redrawProps = () => {
        const { map, selection } = useMapStore.getState()
        propsRenderer.draw(propsContainer, map.props, selection?.kind === 'prop' ? selection.id : null)
      }

      let backgroundLoadToken = 0

      const redrawBackground = async () => {
        const { map } = useMapStore.getState()
        const loadToken = (backgroundLoadToken += 1)

        if (map.background.type !== 'image' || !map.background.src) {
          backgroundSprite.texture = Texture.EMPTY
          return
        }

        try {
          const url = convertFileSrc(map.background.src)
          const texture = await Assets.load(url)
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = texture
        } catch {
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = Texture.EMPTY
        }
      }

      redrawGrid()
      redrawShapes()
      redrawTokens()
      redrawProps()
      void redrawBackground()
      const unsubscribeGrid = subscribeToGridRedraw(redrawGrid)
      const unsubscribeShapes = subscribeToShapesRedraw(redrawShapes)
      const unsubscribeTokens = subscribeToTokensRedraw(redrawTokens)
      const unsubscribeProps = subscribeToPropsRedraw(redrawProps)
      const unsubscribeBackground = subscribeToBackgroundRedraw(() => {
        void redrawBackground()
      })

      let mode:
        | 'idle'
        | 'panning'
        | 'dragging-token'
        | 'dragging-prop'
        | 'drawing-wall'
        | 'drawing-freehand'
        | 'drawing-line'
        | 'drawing-circle'
        | 'drawing-light'
        | 'drawing-curve'
        | 'dragging-curve-point'
        | 'dragging-curve-body'
        | 'erasing'
        | 'drawing-room'
        | 'drawing-polygon-room'
        | 'dragging-wall-point'
        | 'dragging-region-point'
        | 'dragging-wall-body'
        | 'dragging-region-body'
        | 'dragging-line-point'
        | 'dragging-line-body' = 'idle'
      let lastPoint = { x: 0, y: 0 }
      let draggingTokenId: string | null = null
      let draggingPropId: string | null = null
      let wallDraftStart: Point | null = null
      let regionDraftPoints: Point[] = []
      let freehandDraftPoints: Point[] = []
      let lineDraftStart: Point | null = null
      let circleDraftCenter: Point | null = null
      let lightDraftCenter: Point | null = null
      // Ponto bruto (sem snap) do pointerdown da ferramenta Luz — usado SO para
      // medir dragDistance no pointerup. lightDraftCenter e sempre snapado (para
      // preview e para o centro final da luz); comparar worldPoint bruto do
      // pointerup contra um lightDraftCenter snapado inflava dragDistance em ate
      // ~metade da diagonal da celula, fazendo clique simples virar "arrasto".
      let lightDraftRawStart: Point | null = null
      let curveDraftPoints: Point[] = []
      let draggingCurveId: string | null = null
      let draggingCurvePointIndex = 0
      let draggingCurveBodyId: string | null = null
      // `map` capturado no pointerdown de um arrasto de ponto ou corpo de
      // Curva, ANTES de qualquer mutação do gesto — usado só pra fechar um
      // Ctrl+Z único no pointerup/pointerupoutside (ver commitDragHistory no
      // mapStore). Fica null quando o "arrasto" na verdade começou com um
      // insertCurvePoint (midpoint), que já empurra seu próprio snapshot de
      // undo no pointerdown; nesse caso o gesto de arrastar o ponto recém-
      // inserido não deve gerar uma SEGUNDA entrada de histórico.
      let curveDragSnapshot: MapData | null = null
      let roomDraftStart: Point | null = null
      let polygonDraftCenter: Point | null = null
      let polygonDraftSides = ROOM_CIRCLE_SIDES
      let draggingWallPointId: string | null = null
      let draggingWallPointIndex: 0 | 1 = 0
      let draggingRegionId: string | null = null
      let draggingRegionPointIndex = 0
      let draggingWallBodyId: string | null = null
      let draggingRegionBodyId: string | null = null
      let bodyDragLastPoint: Point | null = null
      let draggingLineId: string | null = null
      let draggingLinePointIndex: 0 | 1 = 0
      let draggingLineBodyId: string | null = null

      const toWorldPoint = (globalX: number, globalY: number) => ({
        x: (globalX - camera.x) / camera.scale,
        y: (globalY - camera.y) / camera.scale,
      })

      const applySnap = (point: Point, gridSize: number): Point => {
        if (!useMapStore.getState().snapEnabled) return point
        const { map } = useMapStore.getState()
        return map.gridShape === 'hex' ? snapToHexGrid(point.x, point.y, gridSize) : snapToGrid(point.x, point.y, gridSize)
      }

      /**
       * Hit-test da borracha: reaproveita a mesma cadeia de prioridade da
       * ferramenta "Selecionar" (token > prop > light > drawing > wall >
       * region — drawing já cobre texto/linha/círculo/curva/pincel) e remove
       * o que estiver mais "por cima" sob o cursor, se houver algo.
       */
      const eraseAt = (point: Point) => {
        const { map } = useMapStore.getState()
        const hit = findSelectableAt(map, point)
        if (!hit) return
        const removers: Record<SelectionKind, (id: string) => void> = {
          token: useMapStore.getState().removeToken,
          wall: useMapStore.getState().removeWall,
          light: useMapStore.getState().removeLight,
          region: useMapStore.getState().removeRegion,
          prop: useMapStore.getState().removeProp,
          drawing: useMapStore.getState().removeDrawing,
        }
        removers[hit.kind](hit.id)
      }

      const clearDrafts = () => {
        wallDraftStart = null
        regionDraftPoints = []
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        lightDraftCenter = null
        lightDraftRawStart = null
        curveDraftPoints = []
        roomDraftStart = null
        polygonDraftCenter = null
        draftGraphics.clear()
        angleIndicatorRenderer.hide()
      }

      const updateCursor = (tool: DrawingTool) => {
        el.style.cursor = tool === 'eraser' ? 'crosshair' : 'default'
      }
      updateCursor(useMapStore.getState().activeTool)

      const unsubscribeActiveTool = useMapStore.subscribe((state) => state.activeTool, (tool) => {
        clearDrafts()
        updateCursor(tool)
        redrawShapes()
      })

      app.stage.on('pointerdown', (event) => {
        // Botao do meio (scroll wheel) sempre faz pan, independente da ferramenta
        // ativa ou do que estiver sob o cursor. Precisa vir antes de qualquer
        // outro if de ferramenta e sair com "return" pra nao rodar selecao/desenho.
        if (event.button === 1) {
          mode = 'panning'
          lastPoint = { x: event.global.x, y: event.global.y }
          return
        }

        const worldPoint = toWorldPoint(event.global.x, event.global.y)
        const { map, activeTool, selection, setSelection } = useMapStore.getState()

        if (activeTool === 'wall') {
          mode = 'drawing-wall'
          // Ímã primeiro: se a ponta inicial cai perto de um vértice já
          // existente, usa ele direto (sem grid-snap por cima — o vértice
          // pode não estar exatamente numa célula da grade). Só cai no
          // applySnap normal quando não há vértice perto o bastante.
          wallDraftStart = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE) ?? applySnap(worldPoint, map.grid)
          return
        }

        if (activeTool === 'door') {
          // Tolerância maior que o padrão de seleção (8px, ver WALL_HIT_TOLERANCE
          // em selectionHitTest.ts): clicar exatamente em cima de uma linha fina é
          // difícil, e aqui não há preview de arrasto pra corrigir a mira.
          const wall = findWallAt(map.walls, worldPoint, 16)
          // Sem parede sob o clique: não cria porta flutuando no vazio.
          if (wall) useMapStore.getState().addDoorOnWall(wall.id, worldPoint, DOOR_LENGTH)
          return
        }

        if (activeTool === 'room') {
          mode = 'drawing-room'
          roomDraftStart = applySnap(worldPoint, map.grid)
          return
        }

        if (activeTool === 'roomCircle') {
          mode = 'drawing-polygon-room'
          polygonDraftCenter = applySnap(worldPoint, map.grid)
          polygonDraftSides = ROOM_CIRCLE_SIDES
          return
        }

        if (activeTool === 'roomPolygon') {
          mode = 'drawing-polygon-room'
          polygonDraftCenter = applySnap(worldPoint, map.grid)
          polygonDraftSides = useMapStore.getState().polygonSides
          return
        }

        if (activeTool === 'light') {
          mode = 'drawing-light'
          lightDraftCenter = applySnap(worldPoint, map.grid)
          lightDraftRawStart = worldPoint
          return
        }

        if (activeTool === 'prop') {
          const point = applySnap(worldPoint, map.grid)
          void (async () => {
            const sourcePath = await pickImageFile()
            if (!sourcePath) return
            const propId = crypto.randomUUID()
            const mapDir = await mapDirFor(map.id)
            const imported = await importPropImage(sourcePath, mapDir, propId)
            useMapStore.getState().addProp({
              id: propId,
              src: imported.destPath,
              x: point.x,
              y: point.y,
              width: imported.width,
              height: imported.height,
              linkedMapPath: null,
            })
          })()
          return
        }

        if (activeTool === 'brush') {
          mode = 'drawing-freehand'
          freehandDraftPoints = [worldPoint]
          return
        }

        if (activeTool === 'line') {
          mode = 'drawing-line'
          // Mesmo ímã do bloco de Parede acima — ver comentário lá.
          lineDraftStart = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE) ?? applySnap(worldPoint, map.grid)
          return
        }

        if (activeTool === 'circle') {
          mode = 'drawing-circle'
          circleDraftCenter = applySnap(worldPoint, map.grid)
          return
        }

        if (activeTool === 'curve') {
          mode = 'drawing-curve'
          curveDraftPoints = [worldPoint]
          return
        }

        if (activeTool === 'region') {
          const point = applySnap(worldPoint, map.grid)
          regionDraftPoints = [...regionDraftPoints, point]
          drawRegionDraft(draftGraphics, regionDraftPoints, null)
          return
        }

        if (activeTool === 'text') {
          const point = applySnap(worldPoint, map.grid)
          const id = crypto.randomUUID()
          const { addDrawing, drawColor, drawFontSize, drawFontFamily, setSelection: select } = useMapStore.getState()
          addDrawing(buildTextDrawing(id, point, drawColor, drawFontSize, drawFontFamily))
          select({ kind: 'drawing', id })
          return
        }

        if (activeTool === 'eraser') {
          mode = 'erasing'
          eraseAt(worldPoint)
          return
        }

        if (activeTool === 'select' && selection?.kind === 'drawing') {
          const drawing = map.drawings.find((d) => d.id === selection.id)
          if (drawing && drawing.kind === 'curve') {
            const index = findCurveControlPointAt(drawing.points, worldPoint)
            if (index !== null) {
              mode = 'dragging-curve-point'
              draggingCurveId = selection.id
              draggingCurvePointIndex = index
              curveDragSnapshot = map
              return
            }

            // Ponto médio de cada trecho consecutivo (i, i+1) — Curva NÃO fecha
            // como polígono, então são length-1 midpoints, não length. Achou um
            // perto do clique: insere o ponto ali (mapFactory.insertCurvePoint)
            // e já entra arrastando ele, mesmo padrão "insere e já arrasta" do
            // midpoint de aresta de Região logo abaixo.
            const midpoints: Point[] = []
            for (let i = 0; i < drawing.points.length - 1; i += 1) {
              const a = drawing.points[i]
              const b = drawing.points[i + 1]
              midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
            }
            const midpointIndex = findCurveControlPointAt(midpoints, worldPoint)
            if (midpointIndex !== null) {
              const midpoint = midpoints[midpointIndex]
              useMapStore.getState().insertCurvePoint(selection.id, midpointIndex, midpoint.x, midpoint.y)
              mode = 'dragging-curve-point'
              draggingCurveId = selection.id
              draggingCurvePointIndex = midpointIndex + 1
              // insertCurvePoint acima já empurrou seu próprio snapshot (o `map`
              // de antes da inserção) pro `past` — o drag do ponto recém-criado
              // que começa agora não deve commitar um segundo, senão um Ctrl+Z
              // só desfaria o arrasto e deixaria o ponto inserido (sem forma) pra
              // trás, exigindo um segundo Ctrl+Z pra remover a inserção em si.
              curveDragSnapshot = null
              return
            }
          }

          if (drawing && drawing.kind === 'line') {
            const index = findCurveControlPointAt(
              [{ x: drawing.x1, y: drawing.y1 }, { x: drawing.x2, y: drawing.y2 }],
              worldPoint,
            )
            if (index !== null) {
              mode = 'dragging-line-point'
              draggingLineId = selection.id
              // findCurveControlPointAt é genérico sobre number; o array de entrada
              // tem exatamente 2 pontos (x1,y1 e x2,y2), então o índice retornado
              // só pode ser 0 ou 1 — o mesmo par que updateLinePoint espera.
              draggingLinePointIndex = index as 0 | 1
              return
            }
          }
        }

        if (activeTool === 'select' && selection?.kind === 'wall') {
          const wall = map.walls.find((w) => w.id === selection.id)
          if (wall && wall.regionId === undefined) {
            const index = findCurveControlPointAt(
              [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }],
              worldPoint,
            )
            if (index !== null) {
              mode = 'dragging-wall-point'
              draggingWallPointId = wall.id
              // findCurveControlPointAt é genérico sobre number; o array de entrada
              // tem exatamente 2 pontos (x1,y1 e x2,y2), então o índice retornado
              // só pode ser 0 ou 1 — o mesmo par que updateWallPoint espera.
              draggingWallPointIndex = index as 0 | 1
              return
            }
          }
        }

        if (activeTool === 'select') {
          let editRegionId: string | null = null
          if (selection?.kind === 'region') {
            editRegionId = selection.id
          } else if (selection?.kind === 'wall') {
            const wall = map.walls.find((w) => w.id === selection.id)
            if (wall && wall.regionId !== undefined) editRegionId = wall.regionId
          }

          if (editRegionId !== null) {
            const region = map.regions.find((r) => r.id === editRegionId)
            if (region) {
              const vertexIndex = findCurveControlPointAt(region.points, worldPoint)
              if (vertexIndex !== null) {
                mode = 'dragging-region-point'
                draggingRegionId = editRegionId
                draggingRegionPointIndex = vertexIndex
                return
              }

              const midpoints = regionEdgeMidpoints(region.points)
              const midpointIndex = findCurveControlPointAt(midpoints, worldPoint)
              if (midpointIndex !== null) {
                const midpoint = midpoints[midpointIndex]
                useMapStore.getState().insertRegionPoint(editRegionId, midpointIndex, midpoint.x, midpoint.y, crypto.randomUUID())
                mode = 'dragging-region-point'
                draggingRegionId = editRegionId
                draggingRegionPointIndex = midpointIndex + 1
                return
              }
            }
          }
        }

        const hit = findSelectableAt(map, worldPoint)
        if (hit) {
          setSelection({ kind: hit.kind, id: hit.id })
          if (hit.kind === 'token') {
            mode = 'dragging-token'
            draggingTokenId = hit.id
          } else if (hit.kind === 'prop') {
            mode = 'dragging-prop'
            draggingPropId = hit.id
          } else if (hit.kind === 'wall') {
            mode = 'dragging-wall-body'
            draggingWallBodyId = hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid)
          } else if (hit.kind === 'region') {
            mode = 'dragging-region-body'
            draggingRegionBodyId = hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid)
          } else if (hit.kind === 'drawing') {
            const drawing = map.drawings.find((d) => d.id === hit.id)
            if (drawing && drawing.kind === 'line') {
              mode = 'dragging-line-body'
              draggingLineBodyId = hit.id
              bodyDragLastPoint = applySnap(worldPoint, map.grid)
            } else if (drawing && drawing.kind === 'curve') {
              mode = 'dragging-curve-body'
              draggingCurveBodyId = hit.id
              bodyDragLastPoint = applySnap(worldPoint, map.grid)
              curveDragSnapshot = map
            } else {
              mode = 'idle'
            }
          } else {
            mode = 'idle'
          }
        } else {
          mode = 'panning'
          setSelection(null)
        }
        lastPoint = { x: event.global.x, y: event.global.y }
      })

      app.stage.on('pointerup', (event) => {
        if (mode === 'drawing-wall' && wallDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addWall } = useMapStore.getState()
          // Ímã primeiro (mesma lógica do preview em pointermove, ver lá): se a
          // ponta final cai perto de um vértice já existente, gruda nele direto,
          // ignorando trava de ângulo e grid-snap — senão cai na lógica normal.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          if (magnet) {
            end = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(wallDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — ver nota
            // completa no bloco de preview (pointermove) mais abaixo, mesma lógica.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid)
          }
          if (isValidWallDraft(wallDraftStart, end)) {
            addWall(buildWallFromDraft(crypto.randomUUID(), wallDraftStart, end))
          }
          wallDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-freehand') {
          const { addDrawing, drawColor, drawWidth } = useMapStore.getState()
          if (isValidFreehandDraft(freehandDraftPoints)) {
            addDrawing(buildFreehandDrawing(crypto.randomUUID(), freehandDraftPoints, drawColor, drawWidth))
          }
          freehandDraftPoints = []
          draftGraphics.clear()
        }

        if (mode === 'drawing-line' && lineDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addDrawing, drawColor, drawWidth } = useMapStore.getState()
          // Ímã primeiro — mesma lógica do bloco de Parede acima, ver lá.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          if (magnet) {
            end = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(lineDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — ver nota
            // completa no bloco de preview (pointermove) mais abaixo, mesma lógica.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid)
          }
          if (isValidLineDraft(lineDraftStart, end)) {
            addDrawing(buildLineDrawing(crypto.randomUUID(), lineDraftStart, end, drawColor, drawWidth))
          }
          lineDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-circle' && circleDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { addDrawing, drawColor, drawWidth, drawFilled } = useMapStore.getState()
          const radius = Math.hypot(worldPoint.x - circleDraftCenter.x, worldPoint.y - circleDraftCenter.y)
          if (isValidCircleDraft(radius)) {
            addDrawing(buildCircleDrawing(crypto.randomUUID(), circleDraftCenter, radius, drawColor, drawWidth, drawFilled))
          }
          circleDraftCenter = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-light' && lightDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addLight } = useMapStore.getState()
          // Compara contra o ponto bruto do pointerdown (lightDraftRawStart), nao
          // contra lightDraftCenter (que pode estar snapado) — senao, com "Travar
          // na grade" ativo, um clique simples ja nasce com dragDistance inflado
          // pelo proprio offset de snap e perde o raio padrao por engano.
          // O "??" aqui é só pra TS aceitar o tipo (lightDraftRawStart é sempre
          // setado junto com lightDraftCenter no mesmo pointerdown, nunca um sem
          // o outro) — não é fallback pra ausência real; se algum dia divergirem,
          // cair no centro snapado no pior caso ainda é o comportamento antigo.
          const dragOrigin = lightDraftRawStart ?? lightDraftCenter
          const dragDistance = Math.hypot(worldPoint.x - dragOrigin.x, worldPoint.y - dragOrigin.y)
          // Clique simples (sem arrasto de verdade): mantem o comportamento de
          // hoje, raio padrao proporcional ao grid. Arrasto real: usa a
          // distancia arrastada como raio novo.
          const light = dragDistance < LIGHT_CLICK_THRESHOLD
            ? buildLightAt(crypto.randomUUID(), lightDraftCenter, map.grid)
            : buildLightAt(crypto.randomUUID(), lightDraftCenter, map.grid, dragDistance)
          addLight(light)
          lightDraftCenter = null
          lightDraftRawStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-curve') {
          const { addDrawing, drawColor, drawWidth } = useMapStore.getState()
          if (isValidCurveDraft(curveDraftPoints)) {
            addDrawing(buildCurveDrawing(crypto.randomUUID(), curveDraftPoints, drawColor, drawWidth))
          }
          curveDraftPoints = []
          draftGraphics.clear()
        }

        if (mode === 'drawing-room' && roomDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addRoom, regionFillColor, regionFillPattern } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid)
          if (isValidRoomDraft(roomDraftStart, end)) {
            const wallIds: [string, string, string, string] = [
              crypto.randomUUID(),
              crypto.randomUUID(),
              crypto.randomUUID(),
              crypto.randomUUID(),
            ]
            const result = buildRoomFromDraft(crypto.randomUUID(), wallIds, roomDraftStart, end, regionFillColor, regionFillPattern)
            addRoom(result.region, result.walls)
          }
          roomDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-polygon-room' && polygonDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addRoom, regionFillColor, regionFillPattern } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid)
          if (isValidRegularPolygonDraft(polygonDraftCenter, end)) {
            const wallIds = Array.from({ length: polygonDraftSides }, () => crypto.randomUUID())
            const result = buildRegularPolygonRoomFromDraft(
              crypto.randomUUID(),
              wallIds,
              polygonDraftCenter,
              end,
              polygonDraftSides,
              regionFillColor,
              regionFillPattern,
            )
            addRoom(result.region, result.walls)
          }
          polygonDraftCenter = null
          draftGraphics.clear()
        }
        // Fecha o gesto de arrasto de Curva (ponto ou corpo) num Ctrl+Z só:
        // curveDragSnapshot é o `map` de ANTES do gesto (capturado no
        // pointerdown), e os pointermoves do meio usaram updateCurvePointLive/
        // moveCurveLive, que não tocam `past`. Fica null quando o gesto na
        // verdade já teve seu snapshot commitado pelo insertCurvePoint do
        // pointerdown (midpoint) — nesse caso não commita de novo.
        if ((mode === 'dragging-curve-point' || mode === 'dragging-curve-body') && curveDragSnapshot) {
          useMapStore.getState().commitDragHistory(curveDragSnapshot)
        }
        curveDragSnapshot = null
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingCurveId = null
        draggingCurveBodyId = null
        draggingWallPointId = null
        draggingRegionId = null
        draggingWallBodyId = null
        draggingRegionBodyId = null
        draggingLineId = null
        draggingLineBodyId = null
        bodyDragLastPoint = null
        guidesGraphics.clear()
        angleIndicatorRenderer.hide()
      })

      app.stage.on('pointerupoutside', () => {
        // Mesmo fechamento de gesto do pointerup acima — o mouse pode sair do
        // canvas no meio de um arrasto de Curva, e o gesto ainda precisa virar
        // uma entrada de undo só (senão as mudanças aplicadas via *Live ficam
        // sem NENHUMA entrada de histórico, e um Ctrl+Z pula direto pra antes
        // do gesto ainda mais anterior).
        if ((mode === 'dragging-curve-point' || mode === 'dragging-curve-body') && curveDragSnapshot) {
          useMapStore.getState().commitDragHistory(curveDragSnapshot)
        }
        curveDragSnapshot = null
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingCurveId = null
        draggingCurveBodyId = null
        draggingWallPointId = null
        draggingRegionId = null
        draggingWallBodyId = null
        draggingRegionBodyId = null
        draggingLineId = null
        draggingLineBodyId = null
        bodyDragLastPoint = null
        guidesGraphics.clear()
        if (wallDraftStart) {
          wallDraftStart = null
          draftGraphics.clear()
        }
        if (roomDraftStart) {
          roomDraftStart = null
          draftGraphics.clear()
        }
        if (polygonDraftCenter) {
          polygonDraftCenter = null
          draftGraphics.clear()
        }
        if (freehandDraftPoints.length > 0 || lineDraftStart || circleDraftCenter || lightDraftCenter || curveDraftPoints.length > 0) {
          draftGraphics.clear()
        }
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        lightDraftCenter = null
        lightDraftRawStart = null
        curveDraftPoints = []
        angleIndicatorRenderer.hide()
      })

      app.stage.on('pointermove', (event) => {
        if (mode === 'panning') {
          const dx = event.global.x - lastPoint.x
          const dy = event.global.y - lastPoint.y
          lastPoint = { x: event.global.x, y: event.global.y }
          camera = panBy(camera, dx, dy)
          world.position.set(camera.x, camera.y)
          useMapStore.getState().setCamera(camera)
          return
        }

        if (mode === 'dragging-token' && draggingTokenId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveToken } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid)
          const candidates = map.tokens
            .filter((token) => token.id !== draggingTokenId)
            .map((token) => ({ x: token.x, y: token.y }))
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          moveToken(draggingTokenId, result.point.x, result.point.y)
          return
        }

        if (mode === 'dragging-prop' && draggingPropId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveProp } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid)
          const candidates = map.props
            .filter((prop) => prop.id !== draggingPropId)
            .flatMap((prop) => [
              { x: prop.x, y: prop.y },
              { x: prop.x - prop.width / 2, y: prop.y },
              { x: prop.x + prop.width / 2, y: prop.y },
              { x: prop.x, y: prop.y - prop.height / 2 },
              { x: prop.x, y: prop.y + prop.height / 2 },
            ])
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          moveProp(draggingPropId, result.point.x, result.point.y)
          return
        }

        if (mode === 'erasing') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          eraseAt(worldPoint)
          return
        }

        if (mode === 'dragging-curve-point' && draggingCurveId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          useMapStore.getState().updateCurvePointLive(draggingCurveId, draggingCurvePointIndex, p.x, p.y)
          return
        }

        if (mode === 'dragging-wall-point' && draggingWallPointId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid)
          const candidates = map.walls
            .filter((wall) => wall.id !== draggingWallPointId)
            .flatMap((wall) => [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }])
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          useMapStore.getState().updateWallPoint(draggingWallPointId, draggingWallPointIndex, result.point.x, result.point.y)
          return
        }

        if (mode === 'dragging-region-point' && draggingRegionId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid)
          const candidates = map.regions
            .filter((region) => region.id !== draggingRegionId)
            .flatMap((region) => region.points)
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          useMapStore.getState().updateRegionPoint(draggingRegionId, draggingRegionPointIndex, result.point.x, result.point.y)
          return
        }

        if (mode === 'dragging-wall-body' && draggingWallBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveWall } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            const wall = map.walls.find((w) => w.id === draggingWallBodyId)
            if (wall) {
              // Ancora a trave inteira no primeiro ponto (x1,y1): aplica o delta bruto
              // do cursor pra achar a posicao tentativa, alinha SO essa ancora contra
              // os outros objetos, e converte de volta pra delta antes de mover a
              // parede — moveWall e delta-based (preserva a forma), nao aceita ponto
              // absoluto como updateWallPoint/moveToken/moveProp aceitam.
              const tentativeAnchor = { x: wall.x1 + dx, y: wall.y1 + dy }
              // Quando a parede pertence a uma sala (regionId definido), moveWall
              // move a REGIAO inteira (todas as paredes vinculadas) — exclui todas
              // elas, nao so a clicada, senao o canto compartilhado com a parede
              // vizinha da mesma sala vira candidato e "gruda" a arrasto na propria
              // posicao original (distancia 0 do canto adjacente da mesma sala).
              const candidates = map.walls
                .filter((w) => w.id !== draggingWallBodyId && (wall.regionId === undefined || w.regionId !== wall.regionId))
                .flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }])
              const result = computeAlignment(tentativeAnchor, candidates)
              drawGuides(guidesGraphics, result.guides, computeViewport())
              moveWall(draggingWallBodyId, result.point.x - wall.x1, result.point.y - wall.y1)
            }
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-region-body' && draggingRegionBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveRegion } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            const region = map.regions.find((r) => r.id === draggingRegionBodyId)
            if (region) {
              // Mesma ancoragem do wall-body acima, no primeiro ponto da regiao.
              const anchor = region.points[0]
              const tentativeAnchor = { x: anchor.x + dx, y: anchor.y + dy }
              const candidates = map.regions
                .filter((r) => r.id !== draggingRegionBodyId)
                .flatMap((r) => r.points)
              const result = computeAlignment(tentativeAnchor, candidates)
              drawGuides(guidesGraphics, result.guides, computeViewport())
              moveRegion(draggingRegionBodyId, result.point.x - anchor.x, result.point.y - anchor.y)
            }
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-line-point' && draggingLineId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          useMapStore.getState().updateLinePoint(draggingLineId, draggingLinePointIndex, p.x, p.y)
          return
        }

        if (mode === 'dragging-line-body' && draggingLineBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveDrawing } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            moveDrawing(draggingLineBodyId, dx, dy)
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-curve-body' && draggingCurveBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveCurveLive } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            moveCurveLive(draggingCurveBodyId, dx, dy)
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'drawing-wall' && wallDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          // Ímã primeiro: perto de um vértice já existente, o preview gruda nele
          // direto — ignora trava de ângulo (Ctrl) e grid-snap por completo, pois
          // o vértice já É a posição final desejada. Preview e commit (pointerup
          // acima) usam a MESMA checagem, então o que se vê arrastando é
          // exatamente o que fica ao soltar.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          let angleReference: Point
          if (magnet) {
            end = magnet
            angleReference = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(wallDraftStart, worldPoint) : worldPoint
            // Grade quadrada: `end` ainda passa por `applySnap` depois de travar o
            // ângulo. `snapToGrid` arredonda x/y de forma independente, e como o
            // ponto travado sempre cai com dx=dy em módulo (diagonais) ou um dos
            // dois exatamente 0 (eixos), o arredondamento independente preserva o
            // múltiplo de 45° — e ainda deixa `end` exato em cima de um vértice de
            // grade (provado por varredura de milhares de combinações dx/dy,
            // revisão da task T2-indicador-graus-snap-amplo).
            //
            // Grade hexagonal: `snapToHexGrid` arredonda em coordenadas AXIAIS, que
            // não são ortogonais entre si — em geral não existe vértice hexagonal a
            // exatamente 45° de outro. Reaplicar esse snap depois de travar o
            // ângulo desloca a direção pra fora do múltiplo de 45° (medido na mesma
            // revisão: até ~3° de desvio). A garantia "com Ctrl, o ângulo final é
            // SEMPRE múltiplo de 45°" tem prioridade sobre "o ponto cai num vértice
            // hex", então aqui `end` PULA o snap de grade e fica igual a
            // `constrained` — o segmento desenhado/commitado fica exato no ângulo,
            // só não necessariamente alinhado ao hexágono.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid)
            angleReference = constrained
          }
          drawWallDraft(draftGraphics, wallDraftStart, end)
          // Ângulo a partir de `angleReference` (não de `end`): em grade quadrada
          // `end` ainda pode diferir de `angleReference` pelo snap acima (diferença
          // cosmética no rótulo, "90°" limpo). Em grade hexagonal com Ctrl,
          // `end === angleReference` (ver comentário acima) — rótulo e segmento
          // desenhado sempre concordam, sem mais divergência. Sem Ctrl,
          // `angleReference` é o próprio worldPoint bruto — mesma coisa, ângulo
          // livre. Com ímã, `angleReference === end === magnet`.
          angleIndicatorRenderer.show(
            angleIndicatorContainer,
            end,
            formatAngleLabel(angleDegrees(wallDraftStart, angleReference), event.ctrlKey),
          )
          return
        }

        if (mode === 'drawing-room' && roomDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, regionFillColor } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid)
          drawRoomDraft(draftGraphics, roomDraftStart, end, regionFillColor)
          return
        }

        if (mode === 'drawing-polygon-room' && polygonDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, regionFillColor } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid)
          drawRegularPolygonDraft(draftGraphics, polygonDraftCenter, end, polygonDraftSides, regionFillColor)
          return
        }

        if (mode === 'drawing-freehand') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          freehandDraftPoints = [...freehandDraftPoints, worldPoint]
          const { drawColor, drawWidth } = useMapStore.getState()
          drawFreehandDraft(draftGraphics, freehandDraftPoints, drawColor, drawWidth)
          return
        }

        if (mode === 'drawing-line' && lineDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth } = useMapStore.getState()
          // Ímã primeiro — mesma lógica do bloco de preview de Parede acima, ver
          // lá. Preview e commit (pointerup acima) usam a MESMA checagem.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          let angleReference: Point
          if (magnet) {
            end = magnet
            angleReference = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(lineDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — mesma lógica
            // do bloco de preview de Parede logo acima (`end` PULA o snap pra
            // preservar o múltiplo de 45°; ver comentário completo lá).
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid)
            angleReference = constrained
          }
          drawLineDraft(draftGraphics, lineDraftStart, end, drawColor, drawWidth)
          angleIndicatorRenderer.show(
            angleIndicatorContainer,
            end,
            formatAngleLabel(angleDegrees(lineDraftStart, angleReference), event.ctrlKey),
          )
          return
        }

        if (mode === 'drawing-circle' && circleDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { drawColor, drawWidth, drawFilled } = useMapStore.getState()
          const radius = Math.hypot(worldPoint.x - circleDraftCenter.x, worldPoint.y - circleDraftCenter.y)
          drawCircleDraft(draftGraphics, circleDraftCenter, radius, drawColor, drawWidth, drawFilled)
          return
        }

        if (mode === 'drawing-light' && lightDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const radius = Math.hypot(worldPoint.x - lightDraftCenter.x, worldPoint.y - lightDraftCenter.y)
          drawLightDraft(draftGraphics, lightDraftCenter, radius)
          return
        }

        if (mode === 'drawing-curve') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          curveDraftPoints = [...curveDraftPoints, worldPoint]
          const { drawColor, drawWidth } = useMapStore.getState()
          drawCurveDraft(draftGraphics, curveDraftPoints, drawColor, drawWidth)
          return
        }

        if (useMapStore.getState().activeTool === 'region' && regionDraftPoints.length > 0) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const cursor = applySnap(worldPoint, map.grid)
          drawRegionDraft(draftGraphics, regionDraftPoints, cursor)
        }
      })

      const onDblClick = (event: MouseEvent) => {
        const { activeTool, addRegion, selection, map } = useMapStore.getState()

        if (activeTool === 'select') {
          let editRegionId: string | null = null
          if (selection?.kind === 'region') {
            editRegionId = selection.id
          } else if (selection?.kind === 'wall') {
            const wall = map.walls.find((w) => w.id === selection.id)
            if (wall && wall.regionId !== undefined) editRegionId = wall.regionId
          }

          if (editRegionId !== null) {
            const region = map.regions.find((r) => r.id === editRegionId)
            if (region) {
              const rect = el.getBoundingClientRect()
              const worldPoint = toWorldPoint(event.clientX - rect.left, event.clientY - rect.top)
              const index = findCurveControlPointAt(region.points, worldPoint)
              if (index !== null) {
                useMapStore.getState().removeRegionPoint(editRegionId, index)
              }
            }
          } else if (selection?.kind === 'drawing') {
            const drawing = map.drawings.find((d) => d.id === selection.id)
            if (drawing && drawing.kind === 'curve') {
              const rect = el.getBoundingClientRect()
              const worldPoint = toWorldPoint(event.clientX - rect.left, event.clientY - rect.top)
              const index = findCurveControlPointAt(drawing.points, worldPoint)
              if (index !== null) {
                useMapStore.getState().removeCurvePoint(selection.id, index)
              }
            }
          }
          return
        }

        if (activeTool !== 'region') return

        const last = regionDraftPoints[regionDraftPoints.length - 1]
        const secondToLast = regionDraftPoints[regionDraftPoints.length - 2]
        if (last && secondToLast && last.x === secondToLast.x && last.y === secondToLast.y) {
          regionDraftPoints = regionDraftPoints.slice(0, -1)
        }

        if (regionDraftPoints.length < 3) {
          clearDrafts()
          return
        }

        addRegion(buildRegionFromPoints(crypto.randomUUID(), regionDraftPoints, 'region', useMapStore.getState().regionFillColor, useMapStore.getState().regionFillPattern))
        regionDraftPoints = []
        draftGraphics.clear()
      }
      el.addEventListener('dblclick', onDblClick)

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          clearDrafts()
          return
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const target = event.target as HTMLElement | null
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
          useMapStore.getState().removeSelected()
        }
      }
      window.addEventListener('keydown', onKeyDown)

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        const rect = el.getBoundingClientRect()
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        camera = zoomAt(camera, pointer, event.deltaY)
        world.position.set(camera.x, camera.y)
        world.scale.set(camera.scale)
        useMapStore.getState().setCamera(camera)
      }
      el.addEventListener('wheel', onWheel, { passive: false })

      return () => {
        unsubscribeGrid()
        unsubscribeShapes()
        unsubscribeTokens()
        unsubscribeProps()
        unsubscribeBackground()
        unsubscribeActiveTool()
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('dblclick', onDblClick)
        window.removeEventListener('keydown', onKeyDown)
      }
    }

    const cleanupPromise = setup()

    return () => {
      destroyed = true
      void cleanupPromise.then((cleanup) => cleanup?.())
      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
