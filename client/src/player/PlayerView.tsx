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
import { visibleDrawings, visibleLights, visibleRegions, visibleStairs } from '../lib/layers'
import { visionSegments } from '../lib/visibility'
import { findDoorAt, tokenReachesDoor } from '../lib/doorReach'
import { findPinAt } from '../lib/pins'
import { visiblePins } from '../lib/layers'
import { createPinsRenderer } from '../pixi/drawPins'
import { fitCamera, panBy, zoomAt } from '../pixi/world'
import { createDebouncedTask, syncWorldTextResolution } from '../pixi/textResolution'
import type { Camera } from '../pixi/world'
import { drawGrid } from '../pixi/drawGrid'
import { currentRendererResolution, watchDevicePixelRatio } from '../pixi/rendererResolution'
import { drawHexGrid } from '../pixi/drawHexGrid'
import { drawTriGrid } from '../pixi/drawTriGrid'
import { computeVisibleHexCenters } from '../pixi/hexGrid'
import { computeVisibleTriEdges } from '../pixi/triGrid'
import { createFloorRenderer } from '../pixi/drawFloor'
import { drawWalls } from '../pixi/drawWalls'
import { drawDoors } from '../pixi/drawDoors'
import { drawMapLines, drawMapMarkers } from '../pixi/drawMapLines'
import { createRegionsRenderer } from '../pixi/drawRegions'
import { createLightsRenderer } from '../pixi/drawLights'
import { drawDrawings } from '../pixi/drawDrawings'
import { drawStairs } from '../pixi/drawStairs'
import { buildFloorMask } from '../pixi/floorMask'
import { pixelGrid, snapToPhysicalPixel, type PixelGrid } from '../pixi/pixelAlign'
import { screenLabelSizing } from '../pixi/screenLabel'
import { TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH } from '../pixi/constants'
import { fitPhotoSprite, textureFromDataUrl } from '../pixi/tokenPhotoSprite'
import { isTokenPhotoData, tokenPhotoRef } from '../lib/tokenPhoto'
import { createRoomNamesRenderer } from '../pixi/drawRoomNames'
import { createTextLabelsRenderer } from '../pixi/drawTextLabels'
import { isDegenerateRegion } from '../pixi/shapes'
import { createSignalsRenderer } from '../pixi/drawSignals'
import { SIGNAL_LONG_PRESS_MS, SIGNAL_LONG_PRESS_TOLERANCE_PX, type SignalMark } from '../lib/signals'
import { createLaserRenderer } from '../pixi/drawLaser'
import type { LaserTrail } from '../lib/laser'
import type { PlayerViewSettings } from './PlayerPanel'

interface PlayerViewProps {
  map: MapData
  vision: RegionPoint[][]
  /** Memória do que o jogador já viu; ausente = nada explorado além da visão atual. */
  explored?: Exploration
  /** Zonas ocultas ativas do mestre: pintadas de preto por cima da planta. */
  concealed?: RegionPoint[][]
  ownTokens: string[]
  settings: PlayerViewSettings
  /** Token a centralizar. `focusSeq` muda a cada pedido, para repetir o mesmo token. */
  focusTokenId: string | null
  focusSeq: number
  onMove: (tokenId: string, x: number, y: number) => void
  /** Sinais recebidos do mestre (inclui o eco dos próprios). */
  signals?: readonly SignalMark[]
  /** Botão "Sinalizar" ligado: o próximo toque no mapa vira sinal em vez de arrasto. */
  signalArmed?: boolean
  onSignal?: (x: number, y: number) => void
  /** Toque curto numa porta: pede ao mestre para abrir/fechar (o mestre valida). */
  onDoorToggle?: (wallId: string) => void
  /** Toque curto num pino: abre o cartão do ponto de interesse. */
  onPinOpen?: (pinId: string) => void
  /** Rastro do laser do mestre; o ticker esmaece cada ponto pela idade. */
  laser?: LaserTrail
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
/** Destaque da porta que o token alcança: sem ele ninguém descobre que dá para tocar na porta. */
const DOOR_HINT_COLOR = 0xe8c170
const DOOR_HINT_ALPHA = 0.45
const DOOR_HINT_WIDTH_PX = 10
/** Raio do toque na porta, em px de TELA: dedo em celular erra por alguns px. */
const DOOR_TAP_TOLERANCE_PX = 18
const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

type Drag =
  // `startX`/`startY`: onde o gesto começou — se ele terminar sem andar, é um toque (porta), não um arrasto de câmera.
  | { kind: 'pan'; lastX: number; lastY: number; startX: number; startY: number }
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

/** Paredes visíveis ao jogador, respeitando as camadas ocultas do mestre (mesma regra do raster). */
function visibleWalls(map: MapData): Wall[] {
  const hidden = map.hiddenLayers
  return map.walls.filter((w) => (w.door === null ? !hidden.includes('paredes') : !hidden.includes('portas')))
}

/** Grade inteira do mapa: o viewport é o próprio retângulo do mapa, e a máscara (silhueta do piso) corta o resto.
 *  Quadrada com `pixel`: traço de `lineWidth` px de tela no pixel físico inteiro. */
function drawPlayerGrid(g: Graphics, map: MapData, pixel: PixelGrid): void {
  g.clear()
  const viewport = { left: 0, top: 0, right: map.width * map.grid, bottom: map.height * map.grid }
  if (map.gridShape === 'hex') {
    drawHexGrid(g, computeVisibleHexCenters(map.grid, viewport), map.grid, map.gridSettings)
  } else if (map.gridShape === 'triangle') {
    drawTriGrid(g, computeVisibleTriEdges(map.grid, viewport), map.gridSettings)
  } else {
    drawGrid(g, computeAlignedGridLines(map.grid, map.gridOffset ?? { x: 0, y: 0 }, viewport), viewport, map.gridSettings, pixel)
  }
}

interface TokenView {
  wrapper: Container
  body: Graphics
  /** Foto do token, recortada no círculo por `photoMask`; invisível quando o token não tem foto. */
  photo: Sprite
  photoMask: Graphics
  label: Text
  key: string
  /** Referência já carregada em `photo`: sem isto, todo snapshot recarregaria a mesma foto. */
  loadedPhoto: string | null
  /** Contador do carregamento em curso — o mesmo guard de pixi/tokensRenderer.ts, para a foto antiga não vencer a nova. */
  loadSeq: number
}

function tokenRadius(token: Token, grid: number): number {
  return Math.max((grid / 2) * token.size, 4)
}

/**
 * Atualiza no lugar: nunca destrói `Text`, que em Pixi 8.20 quebra em
 * TexturePool.returnTexture. Só a GEOMETRIA (círculo chapado ou moldura +
 * máscara da foto); a textura chega depois e é assunto de `syncTokenPhoto`.
 */
function paintTokenView(view: TokenView, token: Token, grid: number, own: boolean): void {
  const radius = tokenRadius(token, grid)
  const color = own ? OWN_TOKEN_COLOR : OTHER_TOKEN_COLOR
  view.body.clear()
  if (tokenPhotoRef(token) === null) {
    view.photo.visible = false
    view.body.circle(0, 0, radius).fill({ color }).stroke({ width: 2, color: TOKEN_OUTLINE })
  } else {
    // Só referência auto-contida chega aqui: lib/fogFilter.ts apaga o caminho
    // do disco do mestre antes de o mapa sair da máquina dele.
    const photoRadius = Math.max(1, radius - TOKEN_FRAME_WIDTH)
    view.photoMask.clear().circle(0, 0, photoRadius).fill({ color: 0xffffff })
    view.photo.visible = true
    fitPhotoSprite(view.photo, photoRadius)
    // Moldura da cor do dono: com a foto ocupando o disco, é ela que continua
    // dizendo qual token é o seu sem depender do nome estar ligado.
    view.body.circle(0, 0, radius - TOKEN_FRAME_WIDTH / 2).stroke({ width: TOKEN_FRAME_WIDTH, color: own ? TOKEN_FRAME_COLOR : OTHER_TOKEN_COLOR })
  }
  view.label.text = token.name
  view.label.position.set(0, radius + 2)
}

/** Carrega a foto nova, se mudou, e reencaixa no círculo quando a textura chega. */
function syncTokenPhoto(view: TokenView, token: Token, grid: number): void {
  const ref = tokenPhotoRef(token)
  if (ref === null || !isTokenPhotoData(ref)) {
    view.loadedPhoto = null
    return
  }
  if (view.loadedPhoto === ref) return
  view.loadedPhoto = ref
  view.loadSeq += 1
  const seq = view.loadSeq
  const photoRadius = Math.max(1, tokenRadius(token, grid) - TOKEN_FRAME_WIDTH)
  void textureFromDataUrl(ref)
    .then((texture) => {
      // Trocou de foto de novo (ou a cena morreu) durante o carregamento: a antiga não vence.
      if (view.loadSeq !== seq || view.photo.destroyed) return
      view.photo.texture = texture
      fitPhotoSprite(view.photo, photoRadius)
    })
    .catch(() => {
      // Foto que não decodifica deixa o token com a moldura e o disco vazio —
      // a mesa não cai por causa de uma imagem ruim. Solta o guard para uma
      // tentativa nova no próximo snapshot.
      if (view.loadSeq === seq) view.loadedPhoto = null
    })
}

function createTokenView(token: Token, grid: number, own: boolean): TokenView {
  const wrapper = new Container()
  const body = new Graphics()
  const photo = new Sprite(Texture.EMPTY)
  photo.anchor.set(0.5)
  // A máscara precisa estar na árvore de exibição para o Pixi recortá-la; ela não aparece por si.
  const photoMask = new Graphics()
  photo.mask = photoMask
  const label = new Text({ text: token.name, style: { fontSize: LABEL_FONT_SIZE, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } })
  label.anchor.set(0.5, 0)
  wrapper.addChild(photoMask, photo, body, label)
  wrapper.eventMode = 'static'
  wrapper.cursor = 'grab'
  const view: TokenView = { wrapper, body, photo, photoMask, label, key: tokenViewKey(token, grid, own), loadedPhoto: null, loadSeq: 0 }
  paintTokenView(view, token, grid, own)
  return view
}

/** Nome do token: nunca abaixo de 11 px na tela e escondido abaixo de 30% de zoom (screenLabel.ts). */
function sizeTokenLabel(label: Text, cameraScale: number, showNames: boolean): void {
  const sizing = screenLabelSizing(LABEL_FONT_SIZE, cameraScale)
  label.scale.set(sizing.scale)
  label.visible = showNames && sizing.visible
}

/**
 * O que exige repintar a view: posição muda sem repintar. A FOTO entra como
 * "tem ou não tem", não pelo conteúdo: a referência tem dezenas de milhares de
 * caracteres e entraria nesta chave a cada quadro — a troca de uma foto por
 * outra é tratada em `syncTokenPhoto`, que compara a referência uma vez só.
 */
function tokenViewKey(token: Token, grid: number, own: boolean): string {
  return JSON.stringify([token.name, token.size, grid, own, tokenPhotoRef(token) !== null])
}

interface Scene {
  app: Application
  world: Container
  mapBackground: Graphics
  grid: Graphics
  /** Silhueta do piso: a grade do jogador só existe dentro dele. */
  gridMask: Graphics
  lastGridKey: string | null
  lastGridMaskKey: string | null
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
  /** Escadas dependem do zoom e da resolução (linha central alinhada ao pixel). */
  lastStairsKey: string | null
  walls: Graphics
  /** Portas do mesmo renderer do editor (drawDoors.ts): trancada continua visível. */
  doors: Graphics
  /** Halo nas portas destrancadas que o token do jogador alcança (abaixo do desenho da porta). */
  doorHints: Graphics
  lastDoorHintsKey: string | null
  doorHintsCount: number
  /** Paredes e portas têm espessura em px de tela: a chave inclui zoom e resolução. */
  lastWallsKey: string | null
  wallsCount: number
  roomNames: Container
  roomNamesRenderer: ReturnType<typeof createRoomNamesRenderer>
  textLabels: Container
  textLabelsRenderer: ReturnType<typeof createTextLabelsRenderer>
  /** Halos das luzes do mestre, recortados pelas paredes; sob a névoa. */
  lights: Container
  lightsRenderer: ReturnType<typeof createLightsRenderer>
  lastLightsKey: string | null
  /** Nunca visto: preto opaco fora de (explorado ∪ visão). */
  fogUnknown: Graphics
  knownMask: Graphics
  /** Explorado fora da visão: escurecido fora da visão. */
  fogDim: Graphics
  visionMask: Graphics
  lastExplored: Exploration | undefined
  lastVision: RegionPoint[][] | null
  exploredCells: number
  /** Pinos de ponto de interesse, acima da névoa: o jogador toca para ler o cartão. */
  pins: Container
  pinsRenderer: ReturnType<typeof createPinsRenderer>
  lastPinsKey: string | null
  /** Zonas ocultas: preto opaco acima da névoa e abaixo dos tokens. */
  concealed: Graphics
  lastConcealed: RegionPoint[][] | null
  concealedCount: number
  tokens: Container
  tokenViews: Map<string, TokenView>
  camera: Camera
  /** Escala para a qual grade, escadas e rótulos foram ajustados por último. */
  zoomScale: number
  /** Ajusta o que depende só do zoom (grade, escadas, rótulos); montado no setup. */
  onZoom: () => void
  fitted: boolean
  drag: Drag | null
  /** Espaço de tela, acima do `world`: ondas e seta de borda com tamanho fixo. */
  signalsLayer: Container
  signalsRenderer: ReturnType<typeof createSignalsRenderer>
  /** Resolução dos Text do mundo acompanhando o zoom (pixi/textResolution.ts). */
  textResolution: ReturnType<typeof createDebouncedTask>
}

/** Referência estável para o padrão da prop: sem sinais, nada muda entre renders. */
const NO_SIGNALS: readonly SignalMark[] = []

function applyCamera(scene: Scene): void {
  const res = scene.app.renderer.resolution
  // Pixel físico inteiro: traço fino alinhado (pixelAlign.ts) não depende do pan.
  scene.world.position.set(snapToPhysicalPixel(scene.camera.x, res), snapToPhysicalPixel(scene.camera.y, res))
  scene.world.scale.set(scene.camera.scale)
  if (scene.camera.scale !== scene.zoomScale) {
    scene.zoomScale = scene.camera.scale
    scene.onZoom()
  }
  scene.textResolution.schedule()
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
  let memoryRings = 0
  if (explored) {
    // O contorno lembrado vem com a MESMA borda que o jogador viu ao vivo; sem
    // ele a memória sairia recortada em degrau de célula, faltando a faixa que
    // o bitset perde por só marcar célula inteira (lib/exploration.ts).
    for (const ring of explored.rings) {
      scene.knownMask.poly(ring.points, true).fill({ color: 0xffffff })
      memoryRings += 1
    }
    const cell = explored.cell
    // colEnd exclusivo (lib/exploration.ts): largura = (colEnd - colStart) * cell.
    // Continua valendo: é a memória de "Revelar planta" e a de perto de área
    // proibida, que não tem contorno guardado.
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

  const hasKnown = polygons.length > 0 || runs > 0 || memoryRings > 0
  if (hasKnown) scene.fogUnknown.setMask({ mask: scene.knownMask, inverse: true })
  else scene.fogUnknown.mask = null
  scene.knownMask.visible = hasKnown
}

/**
 * Preto opaco sobre cada zona oculta ativa. A visão continua passando por ela
 * (a zona esconde conteúdo, não bloqueia), então o recorte do mestre já veio
 * sem nada lá dentro; o preto só tira a planta de fundo (chão, parede de
 * sala meio escondida) do olho do jogador.
 */
function redrawConcealed(scene: Scene, concealed: RegionPoint[][]): void {
  if (concealed === scene.lastConcealed) return
  scene.lastConcealed = concealed
  const polygons = concealed.filter((poly) => poly.length >= 3)
  scene.concealed.clear()
  for (const poly of polygons) scene.concealed.poly(poly, true)
  if (polygons.length > 0) scene.concealed.fill({ color: 0x000000, alpha: 1 })
  scene.concealedCount = polygons.length
}

function centerCameraOn(scene: Scene, x: number, y: number): void {
  const { scale } = scene.camera
  scene.camera = { scale, x: scene.app.screen.width / 2 - x * scale, y: scene.app.screen.height / 2 - y * scale }
  applyCamera(scene)
}

/** Referência estável: sem zonas, o redesenho não repinta a camada a cada snapshot. */
const NO_CONCEALED: RegionPoint[][] = []

export function PlayerView({
  map,
  vision,
  explored,
  concealed = NO_CONCEALED,
  ownTokens,
  settings,
  focusTokenId,
  focusSeq,
  onMove,
  signals = NO_SIGNALS,
  signalArmed = false,
  onSignal,
  onDoorToggle,
  onPinOpen,
  laser,
}: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const latestRef = useRef({ map, vision, explored, concealed, ownTokens, settings, onMove, signals, signalArmed, onSignal, onDoorToggle, onPinOpen, laser })
  latestRef.current = { map, vision, explored, concealed, ownTokens, settings, onMove, signals, signalArmed, onSignal, onDoorToggle, onPinOpen, laser }

  function redrawGridLayer(scene: Scene): void {
    const { map: currentMap, settings: currentSettings } = latestRef.current
    const worldWidth = currentMap.width * currentMap.grid
    const worldHeight = currentMap.height * currentMap.grid
    const showGrid = currentMap.showGrid && currentSettings.showGrid
    const pixel = pixelGrid(scene.camera.scale, scene.app.renderer.resolution, currentMap.gridSettings.lineWidth)
    const gridKey = JSON.stringify([worldWidth, worldHeight, currentMap.grid, currentMap.gridOffset, currentMap.gridShape, currentMap.gridSettings, showGrid, pixel])
    if (gridKey === scene.lastGridKey) return
    scene.lastGridKey = gridKey
    scene.mapBackground.clear().rect(0, 0, worldWidth, worldHeight).fill({ color: MAP_BACKGROUND })
    if (showGrid) drawPlayerGrid(scene.grid, currentMap, pixel)
    else scene.grid.clear()
  }

  function redrawStairsLayer(scene: Scene): void {
    const currentMap = latestRef.current.map
    const stairs = visibleStairs(currentMap.stairs, currentMap.hiddenLayers)
    const { scale } = scene.camera
    const res = scene.app.renderer.resolution
    const key = JSON.stringify([stairs, scale, res])
    if (key === scene.lastStairsKey) return
    scene.lastStairsKey = key
    drawStairs(scene.stairs, stairs, null, scale, res)
  }

  /** Mesmo desenho do editor (linha clara fina, porta retângulo), em px de tela. */
  function redrawWallsLayer(scene: Scene): void {
    const walls = visibleWalls(latestRef.current.map)
    const { scale } = scene.camera
    const res = scene.app.renderer.resolution
    const key = JSON.stringify([walls, scale, res])
    if (key === scene.lastWallsKey) return
    scene.lastWallsKey = key
    scene.wallsCount = walls.length
    drawWalls(scene.walls, walls, null, scale, res)
    drawDoors(scene.doors, walls, null, scale, res)
  }

  /**
   * Luz do mestre na tela do jogador: o halo para na parede em vez de
   * atravessar. O recorte é o MESMO raycast da visão (`visionSegments` +
   * `computeVisibility`, dentro de `drawLights`), sobre as paredes que o
   * jogador enxerga — parede de camada oculta não projeta sombra inexplicável.
   * Sem marcador: o ponto da origem é ferramenta de edição do mestre.
   *
   * Nada aqui depende do zoom (o gradiente acompanha o círculo em coordenadas
   * de mundo), então fica fora de `redrawZoomLayers`.
   */
  function redrawLights(scene: Scene): void {
    const currentMap = latestRef.current.map
    const lights = visibleLights(currentMap.lights, currentMap.hiddenLayers)
    const walls = visibleWalls(currentMap)
    // `lastFloorKey` já resume o chão (redrawFloor roda antes): evita um
    // JSON.stringify do chão inteiro a cada snapshot só para esta camada.
    const key = JSON.stringify([lights, walls, scene.lastFloorKey])
    if (key === scene.lastLightsKey) return
    scene.lastLightsKey = key
    scene.lightsRenderer.draw(scene.lights, lights, {
      occluders: visionSegments({ ...currentMap, walls }),
      showMarkers: false,
    })
  }

  /**
   * Halo nas portas que o token do jogador alcança (mesmo alcance que o mestre
   * valida, `lib/doorReach.ts`). Trancada não ganha halo: ela não abre com
   * toque — o toque nela responde "Trancada".
   */
  function redrawDoorHints(scene: Scene): void {
    const { map: currentMap, ownTokens: own } = latestRef.current
    const ownSet = new Set(own)
    const tokens = currentMap.tokens.filter((t) => ownSet.has(t.id))
    const doors = visibleWalls(currentMap).filter(
      (w) => w.door !== null && !w.door.locked && tokens.some((t) => tokenReachesDoor(t, w, currentMap.grid)),
    )
    const { scale } = scene.camera
    const key = JSON.stringify([doors.map((w) => [w.id, w.x1, w.y1, w.x2, w.y2, w.door?.open]), scale])
    if (key === scene.lastDoorHintsKey) return
    scene.lastDoorHintsKey = key
    scene.doorHints.clear()
    for (const door of doors) {
      scene.doorHints
        .moveTo(door.x1, door.y1)
        .lineTo(door.x2, door.y2)
        .stroke({ width: DOOR_HINT_WIDTH_PX / scale, color: DOOR_HINT_COLOR, alpha: DOOR_HINT_ALPHA, cap: 'round' })
    }
    scene.doorHintsCount = doors.length
    // Para o e2e: canvas WebGL não é legível pelo DOM.
    const el = containerRef.current
    if (el) el.dataset.doorHints = String(doors.length)
  }

  /** Porta sob o ponto da TELA, dentro da tolerância do toque; `null` se não tem porta ali. */
  function doorAtScreen(scene: Scene, screenX: number, screenY: number): Wall | null {
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    return findDoorAt(visibleWalls(latestRef.current.map), point, DOOR_TAP_TOLERANCE_PX / scene.camera.scale)
  }

  /** Pino sob o ponto da TELA, com a mesma folga de dedo da porta. */
  function pinAtScreen(scene: Scene, screenX: number, screenY: number): string | null {
    const map = latestRef.current.map
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    const pin = findPinAt(visiblePins(map.pins ?? [], map.hiddenLayers), point, DOOR_TAP_TOLERANCE_PX / scene.camera.scale)
    return pin === null ? null : pin.id
  }

  /** Só o zoom (ou a resolução) mudou: nada de chão ou névoa. */
  function redrawZoomLayers(scene: Scene): void {
    redrawGridLayer(scene)
    redrawStairsLayer(scene)
    redrawWallsLayer(scene)
    redrawDoorHints(scene)
    scene.roomNamesRenderer.setCameraScale(scene.camera.scale)
    const { showNames } = latestRef.current.settings
    for (const view of scene.tokenViews.values()) sizeTokenLabel(view.label, scene.camera.scale, showNames)
  }

  function redraw(scene: Scene): void {
    const {
      map: currentMap,
      vision: currentVision,
      explored: currentExplored,
      concealed: currentConcealed,
      ownTokens: own,
      settings: currentSettings,
    } = latestRef.current
    const hidden = currentMap.hiddenLayers
    const worldWidth = currentMap.width * currentMap.grid
    const worldHeight = currentMap.height * currentMap.grid

    redrawGridLayer(scene)
    redrawFloor(scene, currentMap)

    const regions = visibleRegions(currentMap.regions, hidden)
    scene.regionsRenderer.draw(scene.regions, regions)

    const drawings = visibleDrawings(currentMap.drawings, hidden)
    const drawingsKey = JSON.stringify(drawings)
    if (drawingsKey !== scene.lastDrawingsKey) {
      scene.lastDrawingsKey = drawingsKey
      drawDrawings(scene.drawings, drawings)
    }
    redrawStairsLayer(scene)

    redrawWallsLayer(scene)
    redrawDoorHints(scene)
    const walls = visibleWalls(currentMap)
    const wallsKey = JSON.stringify([walls, currentMap.grid])
    const raster = isRasterMode(currentMap)
    const floorPolygons = raster || hidden.includes('salas') ? [] : scene.floorRenderer.polygons()
    const regionsKey = JSON.stringify(regions.map((r) => [r.id, r.points]))

    // Grade só dentro do piso (salas com parede + chão por peças): fora dele o
    // jogador não vê grade. Render fiel não tem contorno vetorial: vale o mapa.
    const gridMaskKey = raster ? JSON.stringify(['raster', worldWidth, worldHeight]) : JSON.stringify([wallsKey, scene.lastFloorKey, regionsKey])
    if (gridMaskKey !== scene.lastGridMaskKey) {
      scene.lastGridMaskKey = gridMaskKey
      const hasFloor = raster
        ? (scene.gridMask.clear().rect(0, 0, worldWidth, worldHeight).fill({ color: 0xffffff }), true)
        : buildFloorMask(scene.gridMask, regions, walls, floorPolygons)
      scene.grid.visible = hasFloor
    }

    scene.roomNamesRenderer.draw(scene.roomNames, regions, currentMap.grid, scene.camera.scale)
    scene.textLabelsRenderer.draw(scene.textLabels, drawings)
    scene.roomNames.visible = currentSettings.showNames
    scene.textLabels.visible = currentSettings.showNames

    redrawLights(scene)
    redrawFog(scene, currentMap, currentVision, currentExplored, currentSettings.exploredBrightness)
    redrawConcealed(scene, currentConcealed)

    // O recorte do mestre já tirou daqui todo pino que este jogador não pode
    // ver (lib/fogFilter.ts): o que chegou é o que ele pode tocar.
    const pins = visiblePins(currentMap.pins ?? [], hidden)
    const pinsKey = JSON.stringify(pins)
    if (pinsKey !== scene.lastPinsKey) {
      scene.lastPinsKey = pinsKey
      scene.pinsRenderer.draw(scene.pins, pins, null)
    }

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
      // Fora do `if` de propósito: trocar uma foto por outra não muda a chave.
      syncTokenPhoto(view, token, currentMap.grid)
      sizeTokenLabel(view.label, scene.camera.scale, currentSettings.showNames)
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
      el.dataset.concealedCount = String(scene.concealedCount)
      el.dataset.pinsCount = String(pins.length)
      el.dataset.ownTokens = own.join(',')
    }

    if (!scene.fitted) {
      scene.fitted = true
      const bounds = { minX: 0, minY: 0, maxX: worldWidth, maxY: worldHeight }
      scene.camera = fitCamera(bounds, { width: scene.app.screen.width, height: scene.app.screen.height }, FIT_MARGIN)
      applyCamera(scene)
    }
    // Nomes e rótulos novos nascem na resolução do renderer: ajusta ao zoom atual.
    scene.textResolution.flush()
  }

  function startTokenDrag(scene: Scene, tokenId: string, event: FederatedPointerEvent): void {
    // Alt+clique ou modo Sinalizar sobre um token: deixa o evento subir para o palco sinalizar.
    if (event.altKey || latestRef.current.signalArmed) return
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
      // Densidade do monitor/celular: backbuffer em pixels físicos, canvas no tamanho CSS.
      await app.init({
        backgroundColor: OUTSIDE_BACKGROUND,
        resizeTo: el,
        resolution: currentRendererResolution(),
        autoDensity: true,
        antialias: true,
      })
      if (destroyed) {
        app.destroy({ removeView: true }, { children: true }) // `true` limparia o TexturePool GLOBAL e quebraria Text de outro app vivo
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
      const doorHints = new Graphics()
      const doors = new Graphics()
      const roomNames = new Container()
      const textLabels = new Container()
      const lights = new Container()
      const fogUnknown = new Graphics()
      const knownMask = new Graphics()
      const fogDim = new Graphics()
      const visionMask = new Graphics()
      const concealed = new Graphics()
      const pins = new Container()
      const tokens = new Container()
      // Mesma ordem do editor, de baixo para cima; tudo da planta fica sob a
      // névoa, e só os tokens (que já chegam filtrados pela visão) ficam acima.
      // Grade acima do chão e das salas, abaixo de paredes e portas.
      world.addChild(
        mapBackground,
        raster,
        floor,
        mapLines,
        regions,
        gridMask,
        grid,
        drawings,
        stairs,
        walls,
        doorHints,
        doors,
        roomNames,
        textLabels,
        // Luz acima da planta e ABAIXO da névoa: o que o jogador não vê segue
        // escuro mesmo com uma tocha acesa do outro lado.
        lights,
        fogUnknown,
        knownMask,
        fogDim,
        visionMask,
        concealed,
        pins,
        tokens,
      )
      const signalsLayer = new Container()
      signalsLayer.eventMode = 'none'
      // Laser do mestre acima dos sinais: é a mão de quem conduz a mesa.
      const laserLayer = new Container()
      laserLayer.eventMode = 'none'
      app.stage.addChild(world, signalsLayer, laserLayer)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      const scene: Scene = {
        app,
        world,
        mapBackground,
        grid,
        gridMask,
        lastGridKey: null,
        lastGridMaskKey: null,
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
        lastStairsKey: null,
        walls,
        doors,
        doorHints,
        lastDoorHintsKey: null,
        doorHintsCount: 0,
        lastWallsKey: null,
        wallsCount: 0,
        roomNames,
        roomNamesRenderer: createRoomNamesRenderer(),
        textLabels,
        textLabelsRenderer: createTextLabelsRenderer(),
        lights,
        lightsRenderer: createLightsRenderer(),
        lastLightsKey: null,
        fogUnknown,
        knownMask,
        fogDim,
        visionMask,
        lastExplored: undefined,
        lastVision: null,
        exploredCells: 0,
        pins,
        pinsRenderer: createPinsRenderer(),
        lastPinsKey: null,
        concealed,
        lastConcealed: null,
        concealedCount: 0,
        tokens,
        tokenViews: new Map(),
        camera: { x: 0, y: 0, scale: 1 },
        zoomScale: 1,
        onZoom: () => {},
        fitted: false,
        drag: null,
        signalsLayer,
        signalsRenderer: createSignalsRenderer(),
        // Texto rasterizado a 1x e esticado pelo zoom sai mole: resolução em degraus.
        textResolution: createDebouncedTask(() => {
          if (destroyed) return
          el.dataset.textResolution = String(syncWorldTextResolution(world, scene.camera.scale, app.renderer.resolution))
        }),
      }
      scene.onZoom = () => redrawZoomLayers(scene)
      sceneRef.current = scene

      let signalsDrawn = 0
      const tickSignals = () => {
        const current = latestRef.current.signals
        // Sem sinal agora nem no quadro anterior: nada a limpar, poupa o quadro.
        if (current.length === 0 && signalsDrawn === 0) return
        const viewport = { width: app.screen.width, height: app.screen.height }
        const drawn = scene.signalsRenderer.draw(signalsLayer, current, scene.camera, viewport, Date.now())
        // Para o e2e: quantos sinais o renderer desenhou de fato (o estado sozinho não prova o desenho).
        if (drawn !== signalsDrawn) el.dataset.signalsDrawn = String(drawn)
        signalsDrawn = drawn
      }
      app.ticker.add(tickSignals)

      const laserRenderer = createLaserRenderer()
      let laserDrawn = 0
      el.dataset.laserDrawn = '0'
      const tickLaser = () => {
        const current = latestRef.current.laser
        if (current === undefined && laserDrawn === 0) return
        const drawn = laserRenderer.draw(laserLayer, current, scene.camera, Date.now())
        // Para o e2e: quantos pontos do rastro estão na tela agora (0 = sumiu).
        if (drawn !== laserDrawn) el.dataset.laserDrawn = String(drawn)
        laserDrawn = drawn
      }
      app.ticker.add(tickLaser)

      const sendSignalAt = (screenX: number, screenY: number) => {
        const point = scene.world.toLocal({ x: screenX, y: screenY })
        latestRef.current.onSignal?.(point.x, point.y)
      }
      /** "Segurar parado": dispara depois de `SIGNAL_LONG_PRESS_MS` se o ponteiro não andou. */
      let longPress: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null
      const cancelLongPress = () => {
        if (longPress === null) return
        clearTimeout(longPress.timer)
        longPress = null
      }

      app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
        if (scene.drag) return
        const { x, y } = event.global
        if (event.altKey || latestRef.current.signalArmed) {
          sendSignalAt(x, y)
          return
        }
        scene.drag = { kind: 'pan', lastX: x, lastY: y, startX: x, startY: y }
        cancelLongPress()
        // Dedo em cima de um PINO não arma o sinal. O pino é um controle: quem
        // aperta ali quer ler o cartão, e demorar meio segundo para soltar não
        // muda a intenção — sem esta guarda, a mesma pressão virava ping de
        // mapa e o cartão nunca abria (medido no toque lento).
        if (pinAtScreen(scene, x, y) !== null) return
        const timer = setTimeout(() => {
          longPress = null
          // Virou sinal: o gesto não continua como arrasto de câmera.
          if (scene.drag?.kind === 'pan') scene.drag = null
          sendSignalAt(x, y)
        }, SIGNAL_LONG_PRESS_MS)
        longPress = { timer, x, y }
      })
      app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
        if (longPress !== null && Math.hypot(event.global.x - longPress.x, event.global.y - longPress.y) > SIGNAL_LONG_PRESS_TOLERANCE_PX) {
          cancelLongPress()
        }
        const drag = scene.drag
        if (!drag) {
          // Mouse parado sobre porta: cursor de mão (no celular não existe hover).
          const overTappable =
            !latestRef.current.signalArmed &&
            (pinAtScreen(scene, event.global.x, event.global.y) !== null || doorAtScreen(scene, event.global.x, event.global.y) !== null)
          app.stage.cursor = overTappable ? 'pointer' : 'default'
          return
        }
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
        cancelLongPress()
        const drag = scene.drag
        scene.drag = null
        if (drag?.kind === 'pan') {
          // Toque curto e parado: primeiro o pino (desenhado por cima de tudo),
          // depois a porta. Segurar mais que `SIGNAL_LONG_PRESS_MS` já virou
          // sinal de mapa lá em cima e nem chega aqui — abrir o cartão é o
          // toque RÁPIDO, não o demorado.
          if (Math.hypot(drag.lastX - drag.startX, drag.lastY - drag.startY) > SIGNAL_LONG_PRESS_TOLERANCE_PX) return
          const pinId = pinAtScreen(scene, drag.startX, drag.startY)
          if (pinId !== null) {
            latestRef.current.onPinOpen?.(pinId)
            return
          }
          const door = doorAtScreen(scene, drag.startX, drag.startY)
          if (door !== null) latestRef.current.onDoorToggle?.(door.id)
          return
        }
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
        // applyCamera chama onZoom → redrawZoomLayers: paredes e portas refazem a largura de tela.
        applyCamera(scene)
      }
      app.canvas.addEventListener('wheel', onWheel, { passive: false })
      // Outro monitor ou zoom do navegador: resolução nova e resize (textos se refazem sozinhos).
      const stopWatchingResolution = watchDevicePixelRatio((resolution) => {
        if (destroyed) return
        app.renderer.resolution = resolution
        app.resize()
        // Pixel físico mudou: world, grade e escadas realinham à resolução nova.
        applyCamera(scene)
        redrawZoomLayers(scene)
        // Text com resolução fixa não segue o runner resolutionChange do Pixi.
        scene.textResolution.flush()
      })
      removeWheel = () => {
        stopWatchingResolution()
        scene.textResolution.cancel()
        app.canvas.removeEventListener('wheel', onWheel)
        cancelLongPress()
        app.ticker.remove(tickSignals)
        app.ticker.remove(tickLaser)
        // Antes do app.destroy: os gradientes de luz não são filhos da cena.
        scene.lightsRenderer.destroy()
      }
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
      if (initialized) app.destroy({ removeView: true }, { children: true }) // `true` limparia o TexturePool GLOBAL e quebraria Text de outro app vivo
    }
    // Monta uma vez; mapa e visão chegam pelo efeito abaixo via latestRef.
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (scene) redraw(scene)
  }, [map, vision, explored, concealed, ownTokens, settings])

  useEffect(() => {
    // Contagem para o e2e (o desenho em si é do ticker); muda quando chega ou expira um sinal.
    const el = containerRef.current
    if (el) el.dataset.signalsCount = String(signals.length)
  }, [signals])

  useEffect(() => {
    // Estado do laser para o e2e, fora do ticker: sob carga os quadros do Pixi
    // espaçam e `data-laser-drawn` sozinho não prova a ordem ligado → off → sumiu.
    const el = containerRef.current
    if (!el) return
    el.dataset.laserOn = String(laser?.on ?? false)
    el.dataset.laserPoints = String(laser?.points.length ?? 0)
  }, [laser])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || focusTokenId === null) return
    const token = latestRef.current.map.tokens.find((t) => t.id === focusTokenId)
    if (token) centerCameraOn(scene, token.x, token.y)
    // Só um pedido novo (focusSeq) move a câmera; snapshot com o token andando não.
  }, [focusSeq])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, touchAction: 'none', cursor: signalArmed ? 'crosshair' : undefined }} />
}
