import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import { rasterizeMinimap, hexToRgb } from '../lib/minimapRaster'
import type { Rgb } from '../lib/minimapRaster'
import { compileFloor } from '../lib/floorSdf'
import { countExploredCells, forEachExploredRun } from '../lib/exploration'
import type { Exploration } from '../lib/exploration'
import { computeAlignedGridLines } from '../lib/gridAlign'
import { visibleDrawings, visibleRegions, visibleStairs } from '../lib/layers'
import { fitCamera, panBy, zoomAt } from '../pixi/world'
import type { Camera } from '../pixi/world'
import { drawGrid } from '../pixi/drawGrid'
import { drawHexGrid } from '../pixi/drawHexGrid'
import { drawTriGrid } from '../pixi/drawTriGrid'
import { computeVisibleHexCenters } from '../pixi/hexGrid'
import { computeVisibleTriEdges } from '../pixi/triGrid'
import { createFloorRenderer } from '../pixi/drawFloor'
import { drawMapLines, drawMapMarkers } from '../pixi/drawMapLines'
import { createRegionsRenderer } from '../pixi/drawRegions'
import { drawDrawings } from '../pixi/drawDrawings'
import { drawStairs } from '../pixi/drawStairs'
import { createRoomNamesRenderer } from '../pixi/drawRoomNames'
import { createTextLabelsRenderer } from '../pixi/drawTextLabels'
import { isDegenerateRegion } from '../pixi/shapes'
import type { PlayerViewSettings } from './PlayerPanel'

interface PlayerViewProps {
  map: MapData
  vision: RegionPoint[][]
  /** Memória do que o jogador já viu; ausente = nada explorado além da visão atual. */
  explored?: Exploration
  ownTokens: string[]
  settings: PlayerViewSettings
  /** Token a centralizar. `focusSeq` muda a cada pedido, para repetir o mesmo token. */
  focusTokenId: string | null
  focusSeq: number
  onMove: (tokenId: string, x: number, y: number) => void
}

const RASTER_SAMPLES = 4
const FIT_MARGIN = 24
/** Fundo do mapa, igual ao do canvas do editor. */
const MAP_BACKGROUND = 0x2b2b2b
const MAP_BACKGROUND_RGB: Rgb = [0x2b, 0x2b, 0x2b]
/** Fora do retângulo do mapa: mais escuro que o fundo, para a borda do mapa ler. */
const OUTSIDE_BACKGROUND = 0x111111
export const OWN_TOKEN_COLOR = 0x3b82f6
const OTHER_TOKEN_COLOR = 0x9ca3af
const TOKEN_OUTLINE = 0xffffff
const LABEL_FONT_SIZE = 12
const DEFAULT_FLOOR: Rgb = [200, 200, 200]
const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

type Drag =
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'token'; tokenId: string; offsetX: number; offsetY: number; x: number; y: number }

function safeRgb(hex: string | null, fallback: Rgb): Rgb {
  return hex && HEX_COLOR.test(hex) ? hexToRgb(hex) : fallback
}

function isRasterMode(map: MapData): boolean {
  return map.floorStyle.renderMode === 'raster'
}

/** Chave do chão: snapshot novo chega como objeto novo, então a igualdade é por conteúdo. */
function floorKey(map: MapData): string {
  return JSON.stringify([map.width, map.height, map.grid, map.floor, map.lines, map.markers, map.floorStyle, map.hiddenLayers])
}

function rasterizeMap(map: MapData): Texture | null {
  const width = Math.round(map.width * map.grid)
  const height = Math.round(map.height * map.grid)
  if (width <= 0 || height <= 0) return null
  const style = map.floorStyle
  const hidden = map.hiddenLayers
  const rgba = rasterizeMinimap(
    {
      originX: 0,
      originY: 0,
      width,
      height,
      floor: !hidden.includes('salas') && map.floor.length > 0 ? compileFloor(map.floor) : null,
      lines: hidden.includes('paredes') ? [] : map.lines,
      markers: hidden.includes('portas') ? [] : map.markers,
    },
    {
      // Mesmo fundo do mapa: com preto aqui o chão explorado lia como névoa.
      background: MAP_BACKGROUND_RGB,
      floor: safeRgb(style.fillColor, DEFAULT_FLOOR),
      stroke: style.strokeColor && HEX_COLOR.test(style.strokeColor) ? hexToRgb(style.strokeColor) : null,
      strokeAlpha: style.strokeAlpha ?? 1,
      strokeWidth: style.strokeWidth,
      lineAlpha: style.lineAlpha ?? 1,
      samples: RASTER_SAMPLES,
      pattern: 'analytic',
    },
  )
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
  return Texture.from(canvas)
}

/** Espessura em px de mundo por `wall.thickness` (`undefined` === 'medium', ver types/map.ts). */
const WALL_WIDTH: Record<NonNullable<Wall['thickness']>, number> = { thin: 2, medium: 4, thick: 6 }
// Mesmo cinza das linhas do minimapa: #333333 sumia contra a borda da névoa.
const WALL_COLOR = 0x858585
const DOOR_COLOR = 0xd08c3a
const DOOR_LOCKED_COLOR = 0xc0392b
const DOOR_DASH = 8
const DOOR_GAP = 6

// Não reaproveita pixi/drawWalls.ts: lá a espessura é ~1px, feita para edição
// de perto; o jogador vê de longe e precisa das portas em laranja.
function drawDashedLine(g: Graphics, wall: Wall): void {
  const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  if (length === 0) return
  const ux = (wall.x2 - wall.x1) / length
  const uy = (wall.y2 - wall.y1) / length
  for (let start = 0; start < length; start += DOOR_DASH + DOOR_GAP) {
    const end = Math.min(start + DOOR_DASH, length)
    g.moveTo(wall.x1 + ux * start, wall.y1 + uy * start).lineTo(wall.x1 + ux * end, wall.y1 + uy * end)
  }
}

/** Paredes visíveis ao jogador, respeitando as camadas ocultas do mestre (mesma regra do raster). */
function visibleWalls(map: MapData): Wall[] {
  const hidden = map.hiddenLayers
  return map.walls.filter((w) => (w.door === null ? !hidden.includes('paredes') : !hidden.includes('portas')))
}

function drawPlayerWalls(g: Graphics, walls: Wall[]): void {
  g.clear()
  for (const wall of walls) {
    const width = WALL_WIDTH[wall.thickness ?? 'medium']
    if (wall.door === null) {
      g.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2).stroke({ width, color: WALL_COLOR, cap: 'round' })
    } else if (wall.door.open) {
      drawDashedLine(g, wall)
      g.stroke({ width, color: DOOR_COLOR, cap: 'butt' })
    } else {
      const color = wall.door.locked ? DOOR_LOCKED_COLOR : DOOR_COLOR
      g.moveTo(wall.x1, wall.y1).lineTo(wall.x2, wall.y2).stroke({ width, color, cap: 'butt' })
    }
  }
}

/** Grade inteira do mapa: o viewport é o próprio retângulo do mapa, e a máscara corta o que a hex/tri passa da borda. */
function drawPlayerGrid(g: Graphics, map: MapData): void {
  g.clear()
  const viewport = { left: 0, top: 0, right: map.width * map.grid, bottom: map.height * map.grid }
  if (map.gridShape === 'hex') {
    drawHexGrid(g, computeVisibleHexCenters(map.grid, viewport), map.grid, map.gridSettings)
  } else if (map.gridShape === 'triangle') {
    drawTriGrid(g, computeVisibleTriEdges(map.grid, viewport), map.gridSettings)
  } else {
    drawGrid(g, computeAlignedGridLines(map.grid, map.gridOffset ?? { x: 0, y: 0 }, viewport), viewport, map.gridSettings)
  }
}

interface TokenView {
  wrapper: Container
  body: Graphics
  label: Text
  key: string
}

function tokenRadius(token: Token, grid: number): number {
  return Math.max((grid / 2) * token.size, 4)
}

/** Atualiza no lugar: nunca destrói `Text`, que em Pixi 8.20 quebra em TexturePool.returnTexture. */
function paintTokenView(view: TokenView, token: Token, grid: number, own: boolean): void {
  const radius = tokenRadius(token, grid)
  // Imagem do token é caminho local da máquina do mestre: o jogador vê o círculo.
  const color = own ? OWN_TOKEN_COLOR : OTHER_TOKEN_COLOR
  view.body.clear().circle(0, 0, radius).fill({ color }).stroke({ width: 2, color: TOKEN_OUTLINE })
  view.label.text = token.name
  view.label.position.set(0, radius + 2)
}

function createTokenView(token: Token, grid: number, own: boolean): TokenView {
  const wrapper = new Container()
  const body = new Graphics()
  const label = new Text({ text: token.name, style: { fontSize: LABEL_FONT_SIZE, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } })
  label.anchor.set(0.5, 0)
  wrapper.addChild(body, label)
  wrapper.eventMode = 'static'
  wrapper.cursor = 'grab'
  const view: TokenView = { wrapper, body, label, key: tokenViewKey(token, grid, own) }
  paintTokenView(view, token, grid, own)
  return view
}

/** O que exige repintar a view: posição muda sem repintar. */
function tokenViewKey(token: Token, grid: number, own: boolean): string {
  return JSON.stringify([token.name, token.size, grid, own])
}

interface Scene {
  app: Application
  world: Container
  mapBackground: Graphics
  grid: Graphics
  gridMask: Graphics
  lastGridKey: string | null
  raster: Sprite
  floor: Graphics
  mapLines: Graphics
  lastFloorKey: string | null
  floorRenderer: ReturnType<typeof createFloorRenderer>
  regions: Container
  regionsRenderer: ReturnType<typeof createRegionsRenderer>
  drawings: Graphics
  stairs: Graphics
  lastDrawingsKey: string | null
  walls: Graphics
  lastWallsKey: string | null
  wallsCount: number
  roomNames: Container
  roomNamesRenderer: ReturnType<typeof createRoomNamesRenderer>
  textLabels: Container
  textLabelsRenderer: ReturnType<typeof createTextLabelsRenderer>
  /** Nunca visto: preto opaco fora de (explorado ∪ visão). */
  fogUnknown: Graphics
  knownMask: Graphics
  /** Explorado fora da visão: escurecido fora da visão. */
  fogDim: Graphics
  visionMask: Graphics
  lastExplored: Exploration | undefined
  lastVision: RegionPoint[][] | null
  exploredCells: number
  tokens: Container
  tokenViews: Map<string, TokenView>
  camera: Camera
  fitted: boolean
  drag: Drag | null
}

function applyCamera(scene: Scene): void {
  scene.world.position.set(scene.camera.x, scene.camera.y)
  scene.world.scale.set(scene.camera.scale)
}

function redrawFloor(scene: Scene, map: MapData): void {
  const key = floorKey(map)
  if (key === scene.lastFloorKey) return
  scene.lastFloorKey = key
  const hidden = map.hiddenLayers
  const old = scene.raster.texture
  scene.mapLines.clear()
  if (isRasterMode(map)) {
    scene.floor.clear()
    scene.raster.texture = rasterizeMap(map) ?? Texture.EMPTY
  } else {
    scene.raster.texture = Texture.EMPTY
    // Mesma regra do editor (PixiCanvas redrawShapes): chão na camada 'salas'.
    scene.floorRenderer.draw(scene.floor, hidden.includes('salas') ? [] : map.floor, map.floorStyle)
    if (!hidden.includes('paredes')) drawMapLines(scene.mapLines, map.lines)
    if (!hidden.includes('portas')) drawMapMarkers(scene.mapLines, map.markers)
  }
  if (old !== Texture.EMPTY && old !== scene.raster.texture) old.destroy(true)
}

/**
 * Névoa em 2 camadas. Máscara inversa em vez de `cut()`: `cut` falha com
 * buracos sobrepostos ou saindo do retângulo (Graphics.d.ts), e visões de
 * vários tokens se sobrepõem entre si e com o explorado.
 */
function redrawFog(scene: Scene, map: MapData, vision: RegionPoint[][], explored: Exploration | undefined, brightness: number): void {
  const width = map.width * map.grid
  const height = map.height * map.grid
  scene.fogUnknown.clear().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 1 })
  scene.fogDim.clear().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 1 - brightness })

  // As máscaras só mudam com snapshot novo; o slider de brilho só repinta a camada acima.
  if (vision === scene.lastVision && explored === scene.lastExplored) return
  scene.lastVision = vision
  scene.lastExplored = explored

  const polygons = vision.filter((poly) => poly.length >= 3)
  scene.visionMask.clear()
  scene.knownMask.clear()
  for (const poly of polygons) {
    scene.visionMask.poly(poly, true).fill({ color: 0xffffff })
    scene.knownMask.poly(poly, true).fill({ color: 0xffffff })
  }
  let runs = 0
  if (explored) {
    const cell = explored.cell
    // colEnd exclusivo (lib/exploration.ts): largura = (colEnd - colStart) * cell.
    forEachExploredRun(explored, (row, colStart, colEnd) => {
      scene.knownMask.rect(colStart * cell, row * cell, (colEnd - colStart) * cell, cell)
      runs += 1
    })
    if (runs > 0) scene.knownMask.fill({ color: 0xffffff })
  }
  scene.exploredCells = explored ? countExploredCells(explored) : 0

  if (polygons.length > 0) scene.fogDim.setMask({ mask: scene.visionMask, inverse: true })
  else scene.fogDim.mask = null
  scene.visionMask.visible = polygons.length > 0

  const hasKnown = polygons.length > 0 || runs > 0
  if (hasKnown) scene.fogUnknown.setMask({ mask: scene.knownMask, inverse: true })
  else scene.fogUnknown.mask = null
  scene.knownMask.visible = hasKnown
}

function centerCameraOn(scene: Scene, x: number, y: number): void {
  const { scale } = scene.camera
  scene.camera = { scale, x: scene.app.screen.width / 2 - x * scale, y: scene.app.screen.height / 2 - y * scale }
  applyCamera(scene)
}

export function PlayerView({ map, vision, explored, ownTokens, settings, focusTokenId, focusSeq, onMove }: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const latestRef = useRef({ map, vision, explored, ownTokens, settings, onMove })
  latestRef.current = { map, vision, explored, ownTokens, settings, onMove }

  function redraw(scene: Scene): void {
    const { map: currentMap, vision: currentVision, explored: currentExplored, ownTokens: own, settings: currentSettings } = latestRef.current
    const hidden = currentMap.hiddenLayers
    const worldWidth = currentMap.width * currentMap.grid
    const worldHeight = currentMap.height * currentMap.grid

    const showGrid = currentMap.showGrid && currentSettings.showGrid
    const gridKey = JSON.stringify([worldWidth, worldHeight, currentMap.grid, currentMap.gridOffset, currentMap.gridShape, currentMap.gridSettings, showGrid])
    if (gridKey !== scene.lastGridKey) {
      scene.lastGridKey = gridKey
      scene.mapBackground.clear().rect(0, 0, worldWidth, worldHeight).fill({ color: MAP_BACKGROUND })
      scene.gridMask.clear().rect(0, 0, worldWidth, worldHeight).fill({ color: 0xffffff })
      if (showGrid) drawPlayerGrid(scene.grid, currentMap)
      else scene.grid.clear()
    }

    redrawFloor(scene, currentMap)

    const regions = visibleRegions(currentMap.regions, hidden)
    scene.regionsRenderer.draw(scene.regions, regions)

    const drawings = visibleDrawings(currentMap.drawings, hidden)
    const stairs = visibleStairs(currentMap.stairs, hidden)
    const drawingsKey = JSON.stringify([drawings, stairs])
    if (drawingsKey !== scene.lastDrawingsKey) {
      scene.lastDrawingsKey = drawingsKey
      drawDrawings(scene.drawings, drawings)
      drawStairs(scene.stairs, stairs)
    }

    const walls = visibleWalls(currentMap)
    const wallsKey = JSON.stringify(walls)
    if (wallsKey !== scene.lastWallsKey) {
      scene.lastWallsKey = wallsKey
      scene.wallsCount = walls.length
      drawPlayerWalls(scene.walls, walls)
    }

    scene.roomNamesRenderer.draw(scene.roomNames, regions, currentMap.grid)
    scene.textLabelsRenderer.draw(scene.textLabels, drawings)
    scene.roomNames.visible = currentSettings.showNames
    scene.textLabels.visible = currentSettings.showNames

    redrawFog(scene, currentMap, currentVision, currentExplored, currentSettings.exploredBrightness)

    // Reaproveita a view por id e NUNCA destrói `Text` durante a sessão: Text
    // destruído antes de ser renderizado (3 redraws por movimento: otimista,
    // accepted, snapshot; ou token saindo da visão) derruba o Pixi 8.20 em
    // TexturePool.returnTexture — exceção no efeito desmonta o React. Token que
    // sai da visão só fica invisível; se voltar, a mesma view é reusada. A
    // memória fica limitada ao número de tokens já vistos; tudo morre no app.destroy.
    const ownSet = new Set(own)
    const currentIds = new Set(currentMap.tokens.map((t) => t.id))
    for (const [id, view] of scene.tokenViews) {
      if (!currentIds.has(id)) view.wrapper.visible = false
    }
    for (const token of currentMap.tokens) {
      const isOwn = ownSet.has(token.id)
      const key = tokenViewKey(token, currentMap.grid, isOwn)
      let view = scene.tokenViews.get(token.id)
      if (!view) {
        const tokenId = token.id
        view = createTokenView(token, currentMap.grid, isOwn)
        view.wrapper.on('pointerdown', (event: FederatedPointerEvent) => startTokenDrag(scene, tokenId, event))
        scene.tokens.addChild(view.wrapper)
        scene.tokenViews.set(tokenId, view)
      } else if (view.key !== key) {
        view.key = key
        paintTokenView(view, token, currentMap.grid, isOwn)
      }
      view.label.visible = currentSettings.showNames
      view.wrapper.visible = true
      view.wrapper.position.set(token.x, token.y)
    }
    // Snapshot chegou no meio do arrasto: o token arrastado fica sob o dedo.
    const drag = scene.drag
    if (drag?.kind === 'token') scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(drag.x, drag.y)

    // Contagens para o e2e: canvas WebGL não é legível pelo DOM.
    const el = containerRef.current
    if (el) {
      el.dataset.wallsCount = String(scene.wallsCount)
      el.dataset.tokensCount = String(currentMap.tokens.length)
      el.dataset.regionsCount = String(regions.filter((r) => !isDegenerateRegion(r.points)).length)
      el.dataset.labelsCount = String(drawings.filter((d) => d.kind === 'text').length)
      el.dataset.exploredCells = String(scene.exploredCells)
      el.dataset.ownTokens = own.join(',')
    }

    if (!scene.fitted) {
      scene.fitted = true
      const bounds = { minX: 0, minY: 0, maxX: worldWidth, maxY: worldHeight }
      scene.camera = fitCamera(bounds, { width: scene.app.screen.width, height: scene.app.screen.height }, FIT_MARGIN)
      applyCamera(scene)
    }
  }

  function startTokenDrag(scene: Scene, tokenId: string, event: FederatedPointerEvent): void {
    event.stopPropagation()
    const view = scene.tokenViews.get(tokenId)?.wrapper
    if (!view) return
    const world = scene.world.toLocal(event.global)
    scene.drag = { kind: 'token', tokenId, offsetX: view.x - world.x, offsetY: view.y - world.y, x: view.x, y: view.y }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let destroyed = false
    let initialized = false
    const app = new Application()
    let removeWheel: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null

    const setup = async () => {
      await app.init({ backgroundColor: OUTSIDE_BACKGROUND, resizeTo: el, antialias: true })
      if (destroyed) {
        app.destroy(true, { children: true })
        return
      }
      initialized = true
      el.appendChild(app.canvas)

      const world = new Container()
      const mapBackground = new Graphics()
      const grid = new Graphics()
      const gridMask = new Graphics()
      grid.mask = gridMask
      const raster = new Sprite(Texture.EMPTY)
      const floor = new Graphics()
      const mapLines = new Graphics()
      const regions = new Container()
      const drawings = new Graphics()
      const stairs = new Graphics()
      const walls = new Graphics()
      const roomNames = new Container()
      const textLabels = new Container()
      const fogUnknown = new Graphics()
      const knownMask = new Graphics()
      const fogDim = new Graphics()
      const visionMask = new Graphics()
      const tokens = new Container()
      // Mesma ordem do editor, de baixo para cima; tudo da planta fica sob a
      // névoa, e só os tokens (que já chegam filtrados pela visão) ficam acima.
      world.addChild(
        mapBackground,
        grid,
        gridMask,
        raster,
        floor,
        mapLines,
        regions,
        drawings,
        stairs,
        walls,
        roomNames,
        textLabels,
        fogUnknown,
        knownMask,
        fogDim,
        visionMask,
        tokens,
      )
      app.stage.addChild(world)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      const scene: Scene = {
        app,
        world,
        mapBackground,
        grid,
        gridMask,
        lastGridKey: null,
        raster,
        floor,
        mapLines,
        lastFloorKey: null,
        floorRenderer: createFloorRenderer(),
        regions,
        regionsRenderer: createRegionsRenderer(),
        drawings,
        stairs,
        lastDrawingsKey: null,
        walls,
        lastWallsKey: null,
        wallsCount: 0,
        roomNames,
        roomNamesRenderer: createRoomNamesRenderer(),
        textLabels,
        textLabelsRenderer: createTextLabelsRenderer(),
        fogUnknown,
        knownMask,
        fogDim,
        visionMask,
        lastExplored: undefined,
        lastVision: null,
        exploredCells: 0,
        tokens,
        tokenViews: new Map(),
        camera: { x: 0, y: 0, scale: 1 },
        fitted: false,
        drag: null,
      }
      sceneRef.current = scene

      app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
        if (scene.drag) return
        scene.drag = { kind: 'pan', lastX: event.global.x, lastY: event.global.y }
      })
      app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
        const drag = scene.drag
        if (!drag) return
        if (drag.kind === 'pan') {
          scene.camera = panBy(scene.camera, event.global.x - drag.lastX, event.global.y - drag.lastY)
          drag.lastX = event.global.x
          drag.lastY = event.global.y
          applyCamera(scene)
          return
        }
        const world = scene.world.toLocal(event.global)
        drag.x = world.x + drag.offsetX
        drag.y = world.y + drag.offsetY
        scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(drag.x, drag.y)
      })
      const endDrag = () => {
        const drag = scene.drag
        scene.drag = null
        if (drag?.kind !== 'token') return
        const token = latestRef.current.map.tokens.find((t) => t.id === drag.tokenId)
        const x = Math.round(drag.x)
        const y = Math.round(drag.y)
        if (!token || (token.x === x && token.y === y)) {
          scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(token?.x ?? drag.x, token?.y ?? drag.y)
          return
        }
        latestRef.current.onMove(drag.tokenId, x, y)
      }
      app.stage.on('pointerup', endDrag)
      app.stage.on('pointerupoutside', endDrag)

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        const rect = app.canvas.getBoundingClientRect()
        scene.camera = zoomAt(scene.camera, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaY)
        applyCamera(scene)
      }
      app.canvas.addEventListener('wheel', onWheel, { passive: false })
      removeWheel = () => app.canvas.removeEventListener('wheel', onWheel)
      // ResizePlugin só escuta 'resize' da janela: acompanha o container também.
      resizeObserver = new ResizeObserver(() => {
        if (!destroyed) app.resize()
      })
      resizeObserver.observe(el)

      redraw(scene)
    }
    setup().catch((error: unknown) => {
      console.error('Falha ao iniciar o canvas do jogador', error)
    })

    return () => {
      destroyed = true
      sceneRef.current = null
      removeWheel?.()
      resizeObserver?.disconnect()
      if (initialized) app.destroy(true, { children: true })
    }
    // Monta uma vez; mapa e visão chegam pelo efeito abaixo via latestRef.
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (scene) redraw(scene)
  }, [map, vision, explored, ownTokens, settings])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || focusTokenId === null) return
    const token = latestRef.current.map.tokens.find((t) => t.id === focusTokenId)
    if (token) centerCameraOn(scene, token.x, token.y)
    // Só um pedido novo (focusSeq) move a câmera; snapshot com o token andando não.
  }, [focusSeq])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
}
