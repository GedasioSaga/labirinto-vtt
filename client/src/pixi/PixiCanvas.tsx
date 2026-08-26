import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useMapStore } from '../stores/mapStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { subscribeToBackgroundRedraw } from '../stores/backgroundSubscription'
import { panBy, zoomAt, type Camera, type Point } from './world'
import { computeVisibleGridLines } from './grid'
import { drawGrid } from './drawGrid'
import { computeVisibleHexCenters } from './hexGrid'
import { drawHexGrid } from './drawHexGrid'
import { snapToHexGrid } from './hexGrid'
import { drawWalls } from './drawWalls'
import { drawLights } from './drawLights'
import { drawRegions } from './drawRegions'
import { drawTokens } from './drawTokens'
import { drawWallDraft, drawRegionDraft, drawFreehandDraft, drawLineDraft, drawCircleDraft, drawCurveDraft } from './drawDraft'
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
} from '../lib/drawingFactory'
import { createPropsRenderer } from './drawProps'
import { createTextLabelsRenderer } from './drawTextLabels'
import { subscribeToPropsRedraw } from '../stores/propsSubscription'
import { pickImageFile, importPropImage } from '../lib/imageImport'
import { mapDirFor } from '../lib/mapFileIO'
import { findSelectableAt, findCurveControlPointAt } from '../lib/selectionHitTest'
import { drawDrawings } from './drawDrawings'
import { computeAlignment } from '../lib/alignmentGuides'
import { drawGuides } from './drawGuides'

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
      const regionsGraphics = new Graphics()
      const wallsGraphics = new Graphics()
      const drawingsGraphics = new Graphics()
      const textLabelsContainer = new Container()
      const propsContainer = new Container()
      const lightsGraphics = new Graphics()
      const tokensContainer = new Container()
      const draftGraphics = new Graphics()
      const guidesGraphics = new Graphics()
      world.addChild(
        backgroundSprite,
        gridGraphics,
        regionsGraphics,
        wallsGraphics,
        drawingsGraphics,
        textLabelsContainer,
        propsContainer,
        lightsGraphics,
        tokensContainer,
        draftGraphics,
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
        const { map, selection } = useMapStore.getState()
        drawRegions(regionsGraphics, map.regions, selection?.kind === 'region' ? selection.id : null)
        drawWalls(wallsGraphics, map.walls, selection?.kind === 'wall' ? selection.id : null)
        drawLights(lightsGraphics, map.lights, selection?.kind === 'light' ? selection.id : null)
        drawDrawings(drawingsGraphics, map.drawings, selection?.kind === 'drawing' ? selection.id : null)
        textLabelsRenderer.draw(textLabelsContainer, map.drawings, selection?.kind === 'drawing' ? selection.id : null)
      }

      const redrawTokens = () => {
        const { map, selection } = useMapStore.getState()
        drawTokens(tokensContainer, map.tokens, map.grid, selection?.kind === 'token' ? selection.id : null)
      }

      const propsRenderer = createPropsRenderer()
      const textLabelsRenderer = createTextLabelsRenderer()

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

      let mode: 'idle' | 'panning' | 'dragging-token' | 'dragging-prop' | 'drawing-wall' | 'drawing-freehand' | 'drawing-line' | 'drawing-circle' | 'drawing-curve' | 'dragging-curve-point' = 'idle'
      let lastPoint = { x: 0, y: 0 }
      let draggingTokenId: string | null = null
      let draggingPropId: string | null = null
      let wallDraftStart: Point | null = null
      let regionDraftPoints: Point[] = []
      let freehandDraftPoints: Point[] = []
      let lineDraftStart: Point | null = null
      let circleDraftCenter: Point | null = null
      let curveDraftPoints: Point[] = []
      let draggingCurveId: string | null = null
      let draggingCurvePointIndex = 0

      const toWorldPoint = (globalX: number, globalY: number) => ({
        x: (globalX - camera.x) / camera.scale,
        y: (globalY - camera.y) / camera.scale,
      })

      const applySnap = (point: Point, gridSize: number): Point => {
        if (!useMapStore.getState().snapEnabled) return point
        const { map } = useMapStore.getState()
        return map.gridShape === 'hex' ? snapToHexGrid(point.x, point.y, gridSize) : snapToGrid(point.x, point.y, gridSize)
      }

      const clearDrafts = () => {
        wallDraftStart = null
        regionDraftPoints = []
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        curveDraftPoints = []
        draftGraphics.clear()
      }

      const unsubscribeActiveTool = useMapStore.subscribe((state) => state.activeTool, () => {
        clearDrafts()
      })

      app.stage.on('pointerdown', (event) => {
        const worldPoint = toWorldPoint(event.global.x, event.global.y)
        const { map, activeTool, selection, setSelection, addLight } = useMapStore.getState()

        if (activeTool === 'wall') {
          mode = 'drawing-wall'
          wallDraftStart = applySnap(worldPoint, map.grid)
          return
        }

        if (activeTool === 'light') {
          const point = applySnap(worldPoint, map.grid)
          addLight(buildLightAt(crypto.randomUUID(), point, map.grid))
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
          lineDraftStart = applySnap(worldPoint, map.grid)
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
          const { addDrawing, drawColor, drawFontSize, setSelection: select } = useMapStore.getState()
          addDrawing(buildTextDrawing(id, point, drawColor, drawFontSize))
          select({ kind: 'drawing', id })
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
              return
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
          const end = applySnap(worldPoint, map.grid)
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
          const end = applySnap(worldPoint, map.grid)
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

        if (mode === 'drawing-curve') {
          const { addDrawing, drawColor, drawWidth } = useMapStore.getState()
          if (isValidCurveDraft(curveDraftPoints)) {
            addDrawing(buildCurveDrawing(crypto.randomUUID(), curveDraftPoints, drawColor, drawWidth))
          }
          curveDraftPoints = []
          draftGraphics.clear()
        }
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingCurveId = null
        guidesGraphics.clear()
      })

      app.stage.on('pointerupoutside', () => {
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingCurveId = null
        guidesGraphics.clear()
        if (wallDraftStart) {
          wallDraftStart = null
          draftGraphics.clear()
        }
        if (freehandDraftPoints.length > 0 || lineDraftStart || circleDraftCenter || curveDraftPoints.length > 0) {
          draftGraphics.clear()
        }
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        curveDraftPoints = []
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

        if (mode === 'dragging-curve-point' && draggingCurveId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid)
          useMapStore.getState().updateCurvePoint(draggingCurveId, draggingCurvePointIndex, p.x, p.y)
          return
        }

        if (mode === 'drawing-wall' && wallDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid)
          drawWallDraft(draftGraphics, wallDraftStart, end)
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
          const end = applySnap(worldPoint, map.grid)
          drawLineDraft(draftGraphics, lineDraftStart, end, drawColor, drawWidth)
          return
        }

        if (mode === 'drawing-circle' && circleDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { drawColor, drawWidth, drawFilled } = useMapStore.getState()
          const radius = Math.hypot(worldPoint.x - circleDraftCenter.x, worldPoint.y - circleDraftCenter.y)
          drawCircleDraft(draftGraphics, circleDraftCenter, radius, drawColor, drawWidth, drawFilled)
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

      const onDblClick = () => {
        const { activeTool, addRegion } = useMapStore.getState()
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

        addRegion(buildRegionFromPoints(crypto.randomUUID(), regionDraftPoints))
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
