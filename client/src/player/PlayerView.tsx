import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import { rasterizeMinimap, hexToRgb } from '../lib/minimapRaster'
import type { Rgb } from '../lib/minimapRaster'
import { compileFloor } from '../lib/floorSdf'
import { fitCamera, panBy, zoomAt } from '../pixi/world'
import type { Camera } from '../pixi/world'

interface PlayerViewProps {
  map: MapData
  vision: RegionPoint[][]
  onMove: (tokenId: string, x: number, y: number) => void
}

const RASTER_SAMPLES = 4
const FOG_ALPHA = 0.85
const FIT_MARGIN = 24
const TOKEN_COLOR = 0x3b82f6
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

/** Chave do que entra no raster: snapshot novo chega como objeto novo, então a igualdade é por conteúdo. */
function rasterKey(map: MapData): string {
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
      background: [0, 0, 0],
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

// Não reaproveita pixi/drawWalls.ts: lá a cor é clara (feita para fundo escuro
// do editor) e a espessura é ~1px; aqui o chão é cinza claro e o jogador vê de longe.
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
function paintTokenView(view: TokenView, token: Token, grid: number): void {
  const radius = tokenRadius(token, grid)
  // Imagem do token é caminho local da máquina do mestre: o jogador vê o círculo.
  view.body.clear().circle(0, 0, radius).fill({ color: TOKEN_COLOR }).stroke({ width: 2, color: TOKEN_OUTLINE })
  view.label.text = token.name
  view.label.position.set(0, radius + 2)
}

function createTokenView(token: Token, grid: number): TokenView {
  const wrapper = new Container()
  const body = new Graphics()
  const label = new Text({ text: token.name, style: { fontSize: LABEL_FONT_SIZE, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } })
  label.anchor.set(0.5, 0)
  wrapper.addChild(body, label)
  wrapper.eventMode = 'static'
  wrapper.cursor = 'grab'
  const view: TokenView = { wrapper, body, label, key: tokenViewKey(token, grid) }
  paintTokenView(view, token, grid)
  return view
}

/** O que exige repintar a view: posição muda sem repintar. */
function tokenViewKey(token: Token, grid: number): string {
  return JSON.stringify([token.name, token.size, grid])
}

interface Scene {
  app: Application
  world: Container
  raster: Sprite
  walls: Graphics
  lastWallsKey: string | null
  wallsCount: number
  fog: Graphics
  visionMask: Graphics
  tokens: Container
  tokenViews: Map<string, TokenView>
  camera: Camera
  lastRasterKey: string | null
  fitted: boolean
  drag: Drag | null
}

function applyCamera(scene: Scene): void {
  scene.world.position.set(scene.camera.x, scene.camera.y)
  scene.world.scale.set(scene.camera.scale)
}

function drawFog(scene: Scene, map: MapData, vision: RegionPoint[][]): void {
  const width = map.width * map.grid
  const height = map.height * map.grid
  scene.fog.clear().rect(0, 0, width, height).fill({ color: 0x000000, alpha: FOG_ALPHA })
  scene.visionMask.clear()
  const polygons = vision.filter((poly) => poly.length >= 3)
  for (const poly of polygons) scene.visionMask.poly(poly, true).fill({ color: 0xffffff })
  // Máscara inversa em vez de `cut()`: `cut` falha com buracos sobrepostos ou
  // saindo do retângulo (Graphics.d.ts), e visões de vários tokens se sobrepõem.
  if (polygons.length > 0) scene.fog.setMask({ mask: scene.visionMask, inverse: true })
  else scene.fog.mask = null
  scene.visionMask.visible = polygons.length > 0
}

export function PlayerView({ map, vision, onMove }: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const latestRef = useRef({ map, vision, onMove })
  latestRef.current = { map, vision, onMove }

  function redraw(scene: Scene): void {
    const { map: currentMap, vision: currentVision } = latestRef.current
    const key = rasterKey(currentMap)
    if (key !== scene.lastRasterKey) {
      scene.lastRasterKey = key
      const old = scene.raster.texture
      scene.raster.texture = rasterizeMap(currentMap) ?? Texture.EMPTY
      if (old !== Texture.EMPTY) old.destroy(true)
    }
    const walls = visibleWalls(currentMap)
    const wallsKey = JSON.stringify(walls)
    if (wallsKey !== scene.lastWallsKey) {
      scene.lastWallsKey = wallsKey
      scene.wallsCount = walls.length
      drawPlayerWalls(scene.walls, walls)
    }
    drawFog(scene, currentMap, currentVision)

    // Reaproveita a view por id e NUNCA destrói `Text` durante a sessão: Text
    // destruído antes de ser renderizado (3 redraws por movimento: otimista,
    // accepted, snapshot; ou token saindo da visão) derruba o Pixi 8.20 em
    // TexturePool.returnTexture — exceção no efeito desmonta o React. Token que
    // sai da visão só fica invisível; se voltar, a mesma view é reusada. A
    // memória fica limitada ao número de tokens já vistos; tudo morre no app.destroy.
    const currentIds = new Set(currentMap.tokens.map((t) => t.id))
    for (const [id, view] of scene.tokenViews) {
      if (!currentIds.has(id)) view.wrapper.visible = false
    }
    for (const token of currentMap.tokens) {
      const key = tokenViewKey(token, currentMap.grid)
      let view = scene.tokenViews.get(token.id)
      if (!view) {
        const tokenId = token.id
        view = createTokenView(token, currentMap.grid)
        view.wrapper.on('pointerdown', (event: FederatedPointerEvent) => startTokenDrag(scene, tokenId, event))
        scene.tokens.addChild(view.wrapper)
        scene.tokenViews.set(tokenId, view)
      } else if (view.key !== key) {
        view.key = key
        paintTokenView(view, token, currentMap.grid)
      }
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
    }

    if (!scene.fitted) {
      scene.fitted = true
      const bounds = { minX: 0, minY: 0, maxX: currentMap.width * currentMap.grid, maxY: currentMap.height * currentMap.grid }
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

    const setup = async () => {
      await app.init({ backgroundColor: 0x111111, resizeTo: el, antialias: true })
      if (destroyed) {
        app.destroy(true, { children: true })
        return
      }
      initialized = true
      el.appendChild(app.canvas)

      const world = new Container()
      const raster = new Sprite(Texture.EMPTY)
      const walls = new Graphics()
      const fog = new Graphics()
      const visionMask = new Graphics()
      const tokens = new Container()
      // Paredes sob a névoa: fora da visão ficam escurecidas como o chão.
      world.addChild(raster, walls, fog, visionMask, tokens)
      app.stage.addChild(world)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      const scene: Scene = {
        app,
        world,
        raster,
        walls,
        lastWallsKey: null,
        wallsCount: 0,
        fog,
        visionMask,
        tokens,
        tokenViews: new Map(),
        camera: { x: 0, y: 0, scale: 1 },
        lastRasterKey: null,
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

      redraw(scene)
    }
    setup().catch((error: unknown) => {
      console.error('Falha ao iniciar o canvas do jogador', error)
    })

    return () => {
      destroyed = true
      sceneRef.current = null
      removeWheel?.()
      if (initialized) app.destroy(true, { children: true })
    }
    // Monta uma vez; mapa e visão chegam pelo efeito abaixo via latestRef.
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (scene) redraw(scene)
  }, [map, vision])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
}
