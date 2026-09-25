import { useEffect, useRef } from 'react'
import { PlayerMeasureLabel, writeMeasureText } from './PlayerMeasureLabel'
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { MapData, Pin, Region, RegionPoint, Token, TokenCompanion, Wall } from '../types/map'
import type { RoofPeek } from '../lib/fogFilter'
import { rasterizeMinimap, hexToRgb } from '../lib/minimapRaster'
import type { Rgb } from '../lib/minimapRaster'
import { compileFloor } from '../lib/floorSdf'
import { countExploredCells, forEachExploredRun } from '../lib/exploration'
import type { Exploration } from '../lib/exploration'
import { computeAlignedGridLines } from '../lib/gridAlign'
import { roomHasRoof } from '../lib/roomOps'
import type { PlayerHazard } from '../lib/hazards'
import { drawHazardAreas } from '../pixi/drawHazards'
import type { PlayerAreaTrigger } from '../lib/areaTriggers'
import { drawAreaTriggers } from '../pixi/drawAreaTriggers'
import { visibleDrawings, visibleLights, visibleProps, visibleRegions, visibleStairs } from '../lib/layers'
import { visionSegments } from '../lib/visibility'
import { tokenReachesDoor } from '../lib/doorReach'
import { findStairPinAt } from '../lib/selectionHitTest'
import { findPinAt, pinSizeScale, pinTapTolerance } from '../lib/pins'
import { visiblePins } from '../lib/layers'
import { createPinsRenderer } from '../pixi/drawPins'
import { drawMarcas } from '../pixi/drawMarcas'
import { acharBilheteEm } from '../lib/marcas'
import { panBy, zoomAt } from '../pixi/world'
import { createDebouncedTask, syncWorldTextResolution } from '../pixi/textResolution'
import type { Bounds, Camera, Point } from '../pixi/world'
import { arrivalCamera, centeredCamera, firstOwnToken, type OwnDisc } from './playerCamera'
import { arrivalCamera as arrivalCameraForFloor } from './arrivalCamera'
import { fireLongPress } from './playerLongPress'
import { createPlayerCuller, type PlayerCuller } from './playerCulling'
import { cameraGlideFrame, edgeScrollCamera, recenterTarget, startCameraGlide, type CameraGlide } from './edgeFollow'
import { drawOwnerPulse, drawOwnerRing, ownerRingOuterPx } from './ownerMarker'
import { companionLabelText, drawCompanionRing } from './companionMarker'
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
import { drawPropSilhouettes } from '../pixi/drawPropSilhouettes'
import { createPropLooksRenderer, type PropLooksCount, type PropLooksRenderer } from '../pixi/drawPropLooks'
import { buildFloorMask } from '../pixi/floorMask'
import { pixelGrid, snapToPhysicalPixel, type PixelGrid } from '../pixi/pixelAlign'
import { screenLabelSizing } from '../pixi/screenLabel'
import { TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH, TOKEN_NAME_FILL_COLOR, TOKEN_NAME_OUTLINE_COLOR, TURN_RING_COLOR, TURN_RING_GAP, TURN_RING_WIDTH } from '../pixi/constants'
import { parseHexColor } from '../lib/tokenColor'
import { readTokenHealth } from '../lib/tokenHealth'
import { drawTokenHealthBar, HEALTH_BAR_LABEL, tokenLabelTop } from '../pixi/drawTokenHealth'
import { fitPhotoSprite, textureFromDataUrl } from '../pixi/tokenPhotoSprite'
import { isTokenPhotoData, tokenPhotoRef } from '../lib/tokenPhoto'
import { tokenConditionsOf } from '../lib/tokenConditions'
import { CONDITION_MARKS_LABEL, drawTokenConditions } from '../pixi/drawTokenConditions'
import { watchAlertOf } from '../lib/npcWatch'
import { WATCH_ALERT_LABEL, drawWatchAlert } from '../pixi/drawNpcWatch'
import { createRoomNamesRenderer, findRoomLabelAt, tokenLabelObstacles, type LabelObstacle } from '../pixi/drawRoomNames'
import { hasEnterText } from '../lib/roomText'
import { createTextLabelsRenderer } from '../pixi/drawTextLabels'
import { isDegenerateRegion } from '../pixi/shapes'
import { createDestinationsRenderer, createSignalsRenderer } from '../pixi/drawSignals'
import { SIGNAL_LONG_PRESS_MS, SIGNAL_LONG_PRESS_TOLERANCE_PX, type DestinationMark, type SignalMark } from '../lib/signals'
import { createLaserPool, createLaserRenderer } from '../pixi/drawLaser'
import { appendLaserPoints, pruneLaserTrail, type LaserTrail, type RemoteLaser } from '../lib/laser'
import { followsOwnToken, type PlayerViewSettings } from './PlayerPanel'
import {
  MEASURE_OFF,
  measurePointFromScreen,
  measureWorldToScreen,
  playerMeasureLabel,
  playerMeasureReducer,
  withMeasureArmed,
  type PlayerMeasureEvent,
  type PlayerMeasureState,
} from './playerMeasure'
import { drawPlayerMeasure, drawPlayerTokenDrag } from './drawPlayerMeasure'
import { resolveTokenRelease } from './tokenRelease'
import { findTapTarget, holdBecomesSignal, type TapTarget } from './tapTarget'
import { createTokenGlides, stepGlides, syncGlide, type TokenGlides } from './tokenGlide'
import { applyTokenTouch, prepareTokenLayer } from './tokenTouch'
import { findTappedOtherToken } from './tokenCard'
import {
  NO_TOUCH,
  NO_ZOOM_STEP,
  fingerDown,
  fingerMove,
  fingerUp,
  rebasePinch,
  zoomAnimationFrame,
  zoomLimits,
  zoomStepAnimation,
  zoomStepNow,
  type TouchState,
  type ZoomAnimation,
  type ZoomDirection,
  type ZoomLimits,
  type ZoomStepRequest,
} from './playerZoom'
import { drawFacingNib, facingLabelOffset, tokenFacing } from './facingMarker'
import { createTokenTurns, stepTurns, syncTurn, type TokenTurns } from './tokenTurn'
import { previewTokenDrag } from './playerTokenDrag'
import { reachOutline } from '../lib/movementRules'
import { personalNoteAtScreen, type PersonalNote } from './personalNotes'
import { createPersonalNotesRenderer } from './drawPersonalNotes'
import { applyRoofCut } from './roofCut'
import { rotuloDaFicha } from '../lib/encontroMarcado'
import { createRevisitMemory, observeRevisit } from './revisitChanges'
import { REVISIT_NOTE, REVISIT_PAD_PX, drawRevisitPulse } from './revisitPulse'

/** Pedido de "leve a câmera até este ponto" (Minhas notas e os pontos conhecidos da aba Lugares). */
export interface FocusPointRequest {
  x: number
  y: number
  seq: number
}

interface PlayerViewProps {
  map: MapData
  vision: RegionPoint[][]
  /** Memória do que o jogador já viu; ausente = nada explorado além da visão atual. */
  explored?: Exploration
  /** Zonas ocultas ativas do mestre: pintadas de preto por cima da planta. */
  concealed?: RegionPoint[][]
  /** ZONA DE PERIGO: salas tomadas que o jogador enxerga agora (o host já recortou). */
  hazards?: readonly PlayerHazard[]
  /** GATILHO DE ÁREA: armadilhas/alarmes que o mestre revelou (o host já recortou). */
  gatilhos?: readonly PlayerAreaTrigger[]
  /** Cone pelo vão de prédio com teto: o telhado abre só aqui (`roofCut.ts`). */
  glimpses?: RegionPoint[][]
  /** Espiada pela porta aberta: o telhado desses prédios sai recortado pela visão de quem está no vão. */
  peek?: RoofPeek
  ownTokens: string[]
  /** INICIATIVA: a ficha da vez (sempre uma de `map.tokens`), que ganha o anel da vez. */
  turnTokenId?: string | null
  /**
   * ENCONTRO MARCADO: fichas com a marca "esperando" (o nome ganha
   * "· esperando"). Já vem do recorte do mestre: só ficha que o jogador vê.
   */
  waitingTokens?: readonly string[]
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
  /** Marcas "vamos para cá" que o host deixou ver (a própria inclusa). Ficam até o host trocar a lista. */
  destinations?: readonly DestinationMark[]
  /** Botão "Marcar destino" ligado: o próximo toque no mapa põe a marca em vez de arrastar. */
  destinationArmed?: boolean
  onDestination?: (x: number, y: number) => void
  /**
   * AÇÕES NO PONTO: o toque longo venceu em (`x`, `y`) de mundo, com o dedo em
   * (`screenX`, `screenY`) de tela (px da janela). Quem monta abre ali o menu
   * Sinalizar/Procurar/Escutar/Espiar/Revistar (e "Andar até aqui") e decide
   * o sinal: com isto, o toque longo NÃO chama `onSignal`; sem isto, chama (o
   * sinal de sempre). Um gesto, um menu.
   */
  onLongPress?: (x: number, y: number, screenX: number, screenY: number) => void
  /** Qualquer toque no mapa: o menu do toque longo anterior fecha. */
  onMapPointerDown?: () => void
  /**
   * Botão "Medir" ligado: arrastar no mapa mede a distância em vez de mover a
   * câmera. A medida é só desta tela — nada vai pelo socket.
   */
  measureArmed?: boolean
  /** Toque curto numa porta: pede ao mestre para abrir/fechar (o mestre valida). */
  onDoorToggle?: (wallId: string) => void
  /** Toque curto num pino: abre o cartão do ponto de interesse. */
  onPinOpen?: (pinId: string) => void
  /** Toque curto numa ficha ALHEIA: abre o cartão dela, com as ações que viram pedido ao mestre. */
  onTokenOpen?: (tokenId: string) => void
  /** Toque curto no nome de uma Sala cujo texto já chegou: reabre o texto da sala. */
  onRoomOpen?: (regionId: string) => void
  /** BILHETE NO LUGAR: toque curto num bilhete deixado no chão abre o cartão dele. */
  onMarkOpen?: (markId: string) => void
  /** Rastro do laser do mestre; o ticker esmaece cada ponto pela idade. */
  laser?: LaserTrail
  /**
   * Botão "Laser" ligado: segurar e arrastar no mapa aponta (em vez de mover
   * a câmera). O rastro aparece aqui na hora e sai por `onLaserMove`.
   */
  laserArmed?: boolean
  /** Cor do próprio laser (`#rrggbb`): a da ficha, a mesma que os outros veem. */
  ownLaserColor?: string
  /** Ponto do próprio laser, em px de mundo. */
  onLaserMove?: (x: number, y: number) => void
  /** Soltou (ou desligou o modo no meio): fim do gesto. */
  onLaserEnd?: () => void
  /** Lasers dos outros jogadores da cena. */
  playerLasers?: readonly RemoteLaser[]
  /**
   * Caixas da interface que flutuam sobre o mapa (o painel do jogador), em px
   * da JANELA, lidas na hora: a câmera põe a própria ficha no centro do que
   * elas deixam livre, e nunca faz a ficha nascer debaixo delas.
   */
  focusObstacles?: () => Bounds[]
  /**
   * ANOTAÇÕES PESSOAIS desta cena (só deste aparelho): quadradinho com o
   * texto, em tamanho fixo de tela. Toque longo em cima de uma chama
   * `onNoteLongPress` (apagar) no lugar do sinal e do menu do ponto.
   */
  personalNotes?: readonly PersonalNote[]
  onNoteLongPress?: (noteId: string) => void
  /** Botão "Anotar" ligado: o próximo toque no mapa marca onde vai a nota, em vez de arrastar. */
  noteArmed?: boolean
  onNotePlace?: (x: number, y: number) => void
  /** Ponto (px de mundo) a centralizar, como `focusTokenId`; `seq` novo = um pedido novo. */
  focusPoint?: FocusPointRequest | null
  /** Degrau pedido pelos botões + e − (`PlayerZoomControls`): `seq` novo = um degrau, em volta do centro da tela. */
  zoomStep?: ZoomStepRequest
  /** Chegou ao zoom máximo ou mínimo, ou saiu dele: os botões mostram o que ainda dá para fazer. */
  onZoomLimitsChange?: (limits: ZoomLimits) => void
  /**
   * Espelho do "Ver tela" do mestre: ocupa o elemento pai (e não a janela) e
   * só mostra — nenhum gesto chega ao mapa, então nada anda na tela do jogador.
   */
  mirror?: boolean
}

const RASTER_SAMPLES = 4
const FIT_MARGIN = 24
/** Distância do rótulo da régua até a ponta, em px de tela: não cobre o próprio dedo/cursor. */
const MEASURE_LABEL_OFFSET_PX = 12
/** Fundo do mapa, igual ao do canvas do editor. */
const MAP_BACKGROUND = 0x2b2b2b

/** Movimento reduzido no sistema: a ficha vai direto ao ponto novo, sem deslizar. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}
const MAP_BACKGROUND_RGB: Rgb = [0x2b, 0x2b, 0x2b]
/** Fora do retângulo do mapa: mais escuro que o fundo, para a borda do mapa ler. */
const OUTSIDE_BACKGROUND = 0x111111
export const OWN_TOKEN_COLOR = 0x3b82f6
export const OWN_TOKEN_CSS = `#${OWN_TOKEN_COLOR.toString(16).padStart(6, '0')}`
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
/**
 * TETO DE CONSTRUÇÃO — o telhado visto de cima. Tom de madeira escura, bem
 * acima do preto da névoa (para o prédio ler como objeto, e não como buraco) e
 * bem abaixo do chão iluminado, porque teto não é lugar iluminado por lanterna.
 */
export const ROOF_COLOR = 0x52483f
/** Aresta do telhado: um passo mais claro, para o contorno do prédio ler contra a névoa. */
const ROOF_EDGE_COLOR = 0x6e6055
const ROOF_EDGE_WIDTH = 3

// `pointerId`: o dedo (ou mouse) dono do gesto. Com dois dedos na tela, o
// passo e o soltar do OUTRO dedo não mexem neste gesto.
type Drag =
  // `startX`/`startY`: onde o gesto começou — se ele terminar sem andar, é um toque (porta), não um arrasto de câmera.
  // `canTap` falso: o dedo que sobrou de uma pinça. Arrasta a câmera, mas soltá-lo não abre porta nem pino.
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number; startX: number; startY: number; canTap: boolean }
  // `origin`: onde a ficha estava ao começar (de onde se contam os quadrados);
  // `reach`: contorno do alcance em px de mundo, calculado uma vez por gesto
  // (`null` na cena sem passo máximo); `label`: "N quadrados" ou nada.
  // `screenStart`/`screenLast`: o dedo em px de TELA — soltar sem andar em cima de um pino é toque no pino, não arrasto.
  // `screenX`/`screenY`: onde o dedo está agora — a borda rola o mapa com o dedo parado, e a ficha
  // continua sob ele. `edgeArmed`: o dedo já andou mais que a tremida de um toque (pegar a ficha que
  // está na faixa da borda não rola nada). `edgeAt`: quadro anterior da rolagem; `null` = nenhum ainda.
  | {
      kind: 'token'
      pointerId: number
      tokenId: string
      offsetX: number
      offsetY: number
      x: number
      y: number
      origin: Point
      reach: Point[] | null
      label: string | null
      screenStart: Point
      screenLast: Point
      startX: number
      startY: number
      screenX: number
      screenY: number
      edgeArmed: boolean
      edgeAt: number | null
    }
  // Régua do jogador: o ponto vive em `scene.measure`, aqui só se marca que o gesto é dela.
  // `before`: a medida de antes do toque, que volta se o toque virar pinça.
  | { kind: 'measure'; pointerId: number; before: PlayerMeasureState }
  // Laser do jogador: o rastro vive em `scene.ownLaser`.
  | { kind: 'laser'; pointerId: number }

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
  return wallsOnVisibleLayers(map.walls, map.hiddenLayers)
}

function wallsOnVisibleLayers(walls: readonly Wall[], hidden: MapData['hiddenLayers']): Wall[] {
  return walls.filter((w) => (w.door === null ? !hidden.includes('paredes') : !hidden.includes('portas')))
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
  /** Aro de dono (ownerMarker.ts): só na ficha do próprio jogador, com espessura de TELA. */
  ring: Graphics
  /** Raio do disco em px de mundo e se a ficha é do jogador: o aro se refaz no zoom sem o token à mão. */
  radius: number
  own: boolean
  /** Raio e zoom do aro desenhado por último; `null` = sem aro. */
  ringKey: string | null
  /** Cor do aro de COMPANHEIRO (ficha de outro jogador, `companionMarker.ts`); `null` = NPC ou a própria ficha. */
  companionColor: number | null
  /** "Caio (jogador)" embaixo do nome do personagem; vazio e escondido fora da ficha de companheiro. */
  companionLabel: Text
  /** Bico da frente (facingMarker.ts), acima do aro e abaixo do nome; vazio e escondido na ficha sem frente. */
  facingNib: Graphics
  /** Para onde a ficha olha, em radianos (`tokenFacing`); `null` = sem frente. O ângulo DESENHADO é `facingNib.rotation`. */
  facing: number | null
  /** Raio, dono e zoom do bico desenhado por último; `null` = sem bico. */
  facingKey: string | null
  /** Barra de vida sob o disco, o mesmo desenho do mestre (`pixi/drawTokenHealth.ts`).
   *  Só chega vida que o mestre deixou os jogadores verem (`lib/fogFilter.ts`). */
  bar: Graphics
  /** Há barra de vida: o nome desce para baixo dela (`tokenLabelTop`), com ou sem bico. */
  hasHealth: boolean
  label: Text
  /** Marcas de condição que o mestre pôs na ficha (mesmo desenho do editor, `pixi/drawTokenConditions.ts`). */
  marks: Graphics
  /** Balão do guarda (?, !) — só chega a marca, nunca o cone (`lib/fogFilter.ts`). */
  alert: Graphics
  key: string
  /** Referência já carregada em `photo`: sem isto, todo snapshot recarregaria a mesma foto. */
  loadedPhoto: string | null
  /** Contador do carregamento em curso — o mesmo guard de pixi/tokensRenderer.ts, para a foto antiga não vencer a nova. */
  loadSeq: number
}

function tokenRadius(token: Token, grid: number): number {
  return Math.max((grid / 2) * token.size, 4)
}

/** Altura da linha do nome da ficha, em múltiplos da fonte: as letras e o contorno escuro em volta delas. */
const TOKEN_LABEL_LINE_PER_FONT = 1.5

/**
 * O que cada ficha à vista ocupa no mapa — o disco e a faixa do nome embaixo
 * dele —, para o nome da sala sair de baixo dela (`pixi/drawRoomNames.ts`). A
 * faixa do nome vai de onde ele começa sem frente até onde termina com frente
 * (o bico empurra o nome para baixo), medida no zoom 1: é a régua sem
 * compensação de zoom que escolhe o lugar do nome, que assim não anda enquanto
 * o jogador dá zoom. Desenho e toque usam esta mesma lista.
 */
function roomLabelObstacles(map: MapData): LabelObstacle[] {
  return map.tokens.flatMap((token) => {
    const radius = tokenRadius(token, map.grid)
    // O mesmo topo do nome que `syncFacingNib` usa: abaixo da barra de vida quando ela existe.
    const nameTop = tokenLabelTop(radius, readTokenHealth(token.health) !== null)
    return tokenLabelObstacles({
      x: token.x,
      y: token.y,
      radius,
      name: token.name,
      nameFontSize: LABEL_FONT_SIZE,
      nameTop,
      nameBottom: Math.max(facingLabelOffset(radius, 1, true), nameTop) + LABEL_FONT_SIZE * TOKEN_LABEL_LINE_PER_FONT,
    })
  })
}

/**
 * Atualiza no lugar: nunca destrói `Text`, que em Pixi 8.20 quebra em
 * TexturePool.returnTexture. Só a GEOMETRIA (círculo chapado ou moldura +
 * máscara da foto, e as marcas de condição); a textura chega depois e é
 * assunto de `syncTokenPhoto`. Exportada para o teste da condição na ficha.
 */
export function paintTokenView(view: TokenView, token: Token, grid: number, own: boolean, turn = false, waiting = false): void {
  const radius = tokenRadius(token, grid)
  // A cor que o MESTRE deu à ficha vale aqui também: a separação entre aliado
  // e inimigo não serve de nada se só o mestre a enxerga. Sem cor escolhida,
  // o azul do dono e o cinza dos outros de sempre — tela idêntica à de antes.
  const chosen = parseHexColor(token.color)
  const color = chosen ?? (own ? OWN_TOKEN_COLOR : OTHER_TOKEN_COLOR)
  // "Este é o seu" é o aro BRANCO de fora (`syncOwnerRing`), em qualquer cor
  // de ficha e nos dois ramos (disco e foto): o aro azul de antes sumia numa
  // ficha azul. A ficha dos outros segue com o contorno branco fino.
  view.radius = radius
  view.own = own
  view.body.clear()
  if (tokenPhotoRef(token) === null) {
    view.photo.visible = false
    view.body.circle(0, 0, radius).fill({ color })
    if (!own) view.body.stroke({ width: 2, color: TOKEN_OUTLINE })
  } else {
    // Só referência auto-contida chega aqui: lib/fogFilter.ts apaga o caminho
    // do disco do mestre antes de o mapa sair da máquina dele.
    const photoRadius = Math.max(1, radius - TOKEN_FRAME_WIDTH)
    view.photoMask.clear().circle(0, 0, photoRadius).fill({ color: 0xffffff })
    view.photo.visible = true
    fitPhotoSprite(view.photo, photoRadius)
    // Moldura da cor do dono: com a foto ocupando o disco, é ela que continua
    // dizendo qual token é o seu sem depender do nome estar ligado.
    view.body
      .circle(0, 0, radius - TOKEN_FRAME_WIDTH / 2)
      .stroke({ width: TOKEN_FRAME_WIDTH, color: chosen ?? (own ? TOKEN_FRAME_COLOR : OTHER_TOKEN_COLOR) })
  }
  // A ficha da vez: o mesmo anel solto do mapa do mestre (pixi/tokensRenderer.ts).
  if (turn) view.body.circle(0, 0, radius + TURN_RING_GAP + TURN_RING_WIDTH / 2).stroke({ width: TURN_RING_WIDTH, color: TURN_RING_COLOR })
  // Barra de vida: a mesma do mestre, e o nome desce para baixo dela.
  const health = readTokenHealth(token.health)
  drawTokenHealthBar(view.bar, radius, health)
  // A condição que o mestre marcou chega junto com a ficha (o recorte de
  // lib/fogFilter.ts só deixa passar ficha que este jogador pode ver).
  drawTokenConditions(view.marks, tokenConditionsOf(token), radius, grid)
  // OLHOS DO GUARDA: a marca que o recorte pôs no guarda que este jogador vê.
  drawWatchAlert(view.alert, watchAlertOf(token), radius)
  view.hasHealth = health !== null
  // Só o texto: onde o nome fica depende do bico, da barra e do zoom (`syncFacingNib`).
  // ENCONTRO MARCADO: a marca "esperando" vai no próprio nome — o mapa fica o
  // minimapa limpo de sempre, sem ícone novo por cima da ficha.
  view.label.text = rotuloDaFicha(token.name, waiting)
  paintCompanion(view, own ? undefined : token.companion)
}

/**
 * MARCA DE COMPANHEIRO: a ficha de outro jogador ganha o aro na cor dele e o
 * nome dele embaixo do nome do personagem. Cor fora de `#rrggbb` fica sem aro
 * (a etiqueta continua dizendo de quem é); `Text` nunca é destruído, só esvazia.
 */
function paintCompanion(view: TokenView, companion: TokenCompanion | undefined): void {
  view.companionColor = companion === undefined ? null : parseHexColor(companion.color)
  view.companionLabel.text = companion === undefined ? '' : companionLabelText(companion)
  view.companionLabel.style.fill = view.companionColor ?? TOKEN_NAME_FILL_COLOR
}

/** Aro de dono (ou de companheiro) no zoom atual; só refaz quando raio, dono, cor ou zoom mudam. */
function syncOwnerRing(view: TokenView, cameraScale: number): void {
  const key = view.own ? `${view.radius}@${cameraScale}` : view.companionColor !== null ? `${view.radius}@${cameraScale}@${view.companionColor}` : null
  if (key === view.ringKey) return
  view.ringKey = key
  if (key === null) view.ring.clear()
  else if (view.own) drawOwnerRing(view.ring, view.radius, cameraScale)
  else if (view.companionColor !== null) drawCompanionRing(view.ring, view.radius, cameraScale, view.companionColor)
}

/** A etiqueta do companheiro segue o nome: mesmo tamanho, mesma visibilidade, logo abaixo dele. */
function placeCompanionLabel(view: TokenView): void {
  const { label, companionLabel } = view
  companionLabel.visible = label.visible && companionLabel.text !== ''
  companionLabel.scale.copyFrom(label.scale)
  companionLabel.position.set(label.position.x, label.position.y + (label.text === '' ? 0 : label.height))
}

/**
 * Bico da frente e posição do nome no zoom atual. O bico só se redesenha
 * quando raio, dono ou zoom mudam: virar a ficha mexe só em `rotation`.
 */
function syncFacingNib(view: TokenView, cameraScale: number): void {
  const faced = view.facing !== null
  view.facingNib.visible = faced
  // Com frente, o nome desce para fora do alcance do bico, em qualquer direção:
  // assim o bico virado para baixo nunca entra nas letras, e o nome não pula
  // quando o mestre vira a ficha.
  // Com barra de vida, o nome fica abaixo dela também (`tokenLabelTop`).
  const belowBar = tokenLabelTop(view.radius, view.hasHealth)
  view.label.position.set(0, faced ? Math.max(facingLabelOffset(view.radius, cameraScale, view.own), belowBar) : belowBar)
  const key = faced ? `${view.radius}@${cameraScale}@${view.own}` : null
  if (key === view.facingKey) return
  view.facingKey = key
  if (key === null) view.facingNib.clear()
  else drawFacingNib(view.facingNib, view.radius, cameraScale, view.own)
}

interface FacingSync {
  /** Ângulo que o bico tinha na tela antes deste snapshot; `null` = não estava na tela. */
  shown: number | null
  now: number
  /** `false` = vai direto à frente nova (troca de cena, movimento reduzido). */
  animate: boolean
  cameraScale: number
}

/**
 * Frente da ficha vinda do mapa: o bico gira até ela (`tokenTurn.ts`), ou
 * some quando a ficha não tem frente. O recorte do mestre já tirou do pacote
 * toda ficha que este jogador não enxerga, então todo bico desenhado aqui é de
 * ficha que ele pode ver.
 */
function syncFacing(view: TokenView, token: Token, turns: TokenTurns, sync: FacingSync): void {
  const facing = tokenFacing(token.rotation)
  view.facing = facing
  if (facing === null) turns.delete(token.id)
  else view.facingNib.rotation = syncTurn(turns, token.id, { shown: sync.shown, target: facing, now: sync.now, animate: sync.animate })
  syncFacingNib(view, sync.cameraScale)
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

/** Exportada para o teste da condição na ficha (`PlayerView.condicoes.test.ts`). */
export function createTokenView(token: Token, grid: number, own: boolean, turn = false, waiting = false): TokenView {
  const wrapper = new Container()
  const body = new Graphics()
  const photo = new Sprite(Texture.EMPTY)
  photo.anchor.set(0.5)
  // A máscara precisa estar na árvore de exibição para o Pixi recortá-la; ela não aparece por si.
  const photoMask = new Graphics()
  photo.mask = photoMask
  const ring = new Graphics()
  // Acima do aro, para o branco do bico emendar no branco dele; abaixo do nome, que nunca some sob o bico.
  const facingNib = new Graphics()
  facingNib.visible = false
  const label = new Text({ text: token.name, style: { fontSize: LABEL_FONT_SIZE, fill: TOKEN_NAME_FILL_COLOR, stroke: { color: TOKEN_NAME_OUTLINE_COLOR, width: 3 } } })
  label.anchor.set(0.5, 0)
  const bar = new Graphics()
  bar.label = HEALTH_BAR_LABEL
  // Depois do nome, de propósito: o primeiro `Text` da ficha continua sendo o nome do personagem.
  const companionLabel = new Text({ text: '', style: { fontSize: LABEL_FONT_SIZE, fill: TOKEN_NAME_FILL_COLOR, stroke: { color: TOKEN_NAME_OUTLINE_COLOR, width: 3 } } })
  companionLabel.anchor.set(0.5, 0)
  companionLabel.visible = false
  // Por último: a marca de condição fica por cima do disco e da foto.
  const marks = new Graphics()
  marks.label = CONDITION_MARKS_LABEL
  const alert = new Graphics()
  alert.label = WATCH_ALERT_LABEL
  wrapper.addChild(photoMask, photo, body, ring, bar, facingNib, label, companionLabel, marks, alert)
  applyTokenTouch(wrapper, own)
  const view: TokenView = {
    wrapper,
    body,
    photo,
    photoMask,
    ring,
    radius: tokenRadius(token, grid),
    own,
    ringKey: null,
    companionColor: null,
    companionLabel,
    facingNib,
    facing: null,
    facingKey: null,
    bar,
    hasHealth: false,
    label,
    marks,
    alert,
    key: tokenViewKey(token, grid, own, turn, waiting),
    loadedPhoto: null,
    loadSeq: 0,
  }
  paintTokenView(view, token, grid, own, turn, waiting)
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
export function tokenViewKey(token: Token, grid: number, own: boolean, turn = false, waiting = false): string {
  // `token.color` entra na chave: sem isto, o mestre troca a cor e a tela do
  // jogador continua com a tinta velha até o token mudar de nome ou tamanho.
  // A vida também: a barra do jogador acompanha cada golpe que o mestre anota.
  const health = readTokenHealth(token.health)
  const healthKey = health === null ? null : [health.current, health.max]
  // As condições entram pelo mesmo motivo — já limpas, para lixo no campo não
  // mandar repintar nada. `turn` também: a vez andar repinta só as duas fichas
  // que ganham/perdem o anel.
  // A marca do guarda também: sem ela o "!" ficaria na tela depois de ele perder o jogador de vista.
  // `waiting` idem: a marca "esperando" (ENCONTRO MARCADO) entra e sai sem o nome mudar.
  // A marca de companheiro também: a ficha que deixa de ser de jogador (ou passa a ser) repinta na hora.
  return JSON.stringify([token.name, token.size, grid, own, tokenPhotoRef(token) !== null, token.color ?? null, healthKey, tokenConditionsOf(token), turn, watchAlertOf(token), waiting, token.companion ?? null])
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
  /**
   * Móveis e objetos como SILHUETA chapada (`pixi/drawPropSilhouettes.ts`): o
   * recorte do mestre só manda a geometria do objeto que o jogador enxerga
   * agora. O contorno tem espessura em px de tela: a chave inclui zoom e resolução.
   */
  props: Graphics
  lastPropsKey: string | null
  propsCount: number
  /**
   * OBJETO COM RÓTULO OU IMAGEM (`pixi/drawPropLooks.ts`): a cópia pequena da
   * imagem fica logo acima da silhueta (e abaixo da parede, pela mesma razão
   * dela); o rótulo, junto dos nomes de sala, obedece a "Mostrar nomes".
   */
  propImages: Container
  propLabels: Container
  propLooksRenderer: PropLooksRenderer
  propLooksCount: PropLooksCount
  walls: Graphics
  /** Portas do mesmo renderer do editor (drawDoors.ts): trancada continua visível. */
  doors: Graphics
  /** Halo nas portas destrancadas que o token do jogador alcança (abaixo do desenho da porta). */
  doorHints: Graphics
  lastDoorHintsKey: string | null
  doorHintsCount: number
  /** Paredes e portas têm espessura em px de tela: a chave inclui zoom e resolução. */
  lastWallsKey: string | null
  /** Paredes que CHEGARAM (camadas visíveis): o que os e2e contam. */
  wallsCount: number
  /**
   * CENA GRANDE NO CELULAR (`playerCulling.ts`): só vira desenho a planta perto
   * da ficha e a que o jogador já viu; o resto está debaixo da névoa preta.
   */
  culler: PlayerCuller
  /** Paredes que viraram traço no Pixi depois do recorte de desenho. */
  wallsDrawn: number
  /** Peças de chão que entraram no contorno depois do recorte de desenho. */
  floorDrawn: number
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
  /** ZONA DE PERIGO: cor chapada sob a névoa, recortada pela visão atual (`hazardsMask`). */
  hazards: Graphics
  hazardsMask: Graphics
  lastHazards: readonly PlayerHazard[] | null
  lastHazardsVision: RegionPoint[][] | null
  hazardsCount: number
  /** GATILHO DE ÁREA revelado: marca da área sob a névoa, sem máscara de visão (é anotação estática). */
  triggers: Graphics
  lastTriggers: readonly PlayerAreaTrigger[] | null
  triggersCount: number
  /** BILHETE NO LUGAR: bilhetes e setas de giz, logo abaixo dos pinos. */
  marks: Graphics
  lastMarksKey: string | null
  /** Fator de tamanho mínimo com que os pinos foram pintados por último (`pinSizeScale`). */
  pinsSizeScale: number
  /** Zonas ocultas: preto opaco acima da névoa e abaixo dos tokens. */
  concealed: Graphics
  lastConcealed: RegionPoint[][] | null
  concealedCount: number
  /** Silhueta dos prédios de teto fechado: chapada acima da névoa. */
  roofs: Graphics
  /** Telhado dos prédios espiados pela porta aberta, recortado por `peekMask` (máscara inversa). */
  peekedRoofs: Graphics
  /** A visão de quem espia: o buraco no telhado dos prédios espiados. */
  peekMask: Graphics
  lastRoofsKey: string | null
  roofsCount: number
  /** Máscara invertida do telhado: o cone pelo vão (`applyRoofCut`). */
  roofCut: Graphics
  lastRoofCut: RegionPoint[][] | null
  peekedRoofsCount: number
  tokens: Container
  tokenViews: Map<string, TokenView>
  /** Fichas deslizando do ponto antigo ao novo; o ticker as leva até lá. */
  tokenGlides: TokenGlides
  /** Bicos girando da frente antiga à nova (o mestre virou a ficha); o ticker os leva até lá. */
  tokenTurns: TokenTurns
  camera: Camera
  /** Escala para a qual grade, escadas e rótulos foram ajustados por último. */
  zoomScale: number
  /** Ajusta o que depende só do zoom (grade, escadas, rótulos); montado no setup. */
  onZoom: () => void
  /**
   * Mapa que a câmera já enquadrou (`null` = nenhum ainda). Por id, e não um
   * sim/não: o jogador que atravessa um pino de viagem recebe OUTRO mapa, de
   * outro tamanho, e a câmera do mapa de antes o deixaria olhando para o nada.
   */
  fittedMapId: string | null
  drag: Drag | null
  /** Dedos na tela e a pinça (playerZoom.ts). Só toque: mouse e caneta são um ponteiro só. */
  touch: TouchState
  /** Degrau dos botões + e − ainda andando; `null` = parado. O ticker o leva até o fim. */
  zoomAnimation: ZoomAnimation | null
  /** Recentrar na própria ficha solta perto da borda (edgeFollow.ts); `null` = parado. */
  cameraGlide: CameraGlide | null
  /** Espaço de tela, acima do `world`: ondas e seta de borda com tamanho fixo. */
  signalsLayer: Container
  signalsRenderer: ReturnType<typeof createSignalsRenderer>
  /** Bandeirinhas "vamos para cá", no mesmo espaço de tela dos sinais, abaixo das ondas. */
  destinationsLayer: Container
  destinationsRenderer: ReturnType<typeof createDestinationsRenderer>
  /**
   * Régua do jogador, em espaço de tela como os sinais. O estado mora aqui (e
   * não no React) de propósito: o arrasto atualiza a cada pointermove, e
   * re-renderizar a tela inteira por passo do dedo é o custo que não se paga.
   */
  measureLayer: Graphics
  measure: PlayerMeasureState
  /** Última medida desenhada (pontos de tela + rótulo); igual = nada a repintar. */
  lastMeasureKey: string | null
  /**
   * Rastro do PRÓPRIO laser, desenhado na hora (sem esperar a volta pela
   * rede). Mora aqui pela mesma razão da régua: muda a cada passo do dedo.
   */
  ownLaser: LaserTrail
  /**
   * Arrasto da própria ficha: trajeto, contorno do alcance e "N quadrados".
   * Camada própria (tela, como a régua), para o gesto nunca apagar a medida.
   */
  tokenDragLayer: Graphics
  /** Último arrasto desenhado; igual = nada a repintar. */
  lastTokenDragKey: string | null
  /** Resolução dos Text do mundo acompanhando o zoom (pixi/textResolution.ts). */
  textResolution: ReturnType<typeof createDebouncedTask>
  /** Pulso "você está aqui" (ownerMarker.ts), em espaço de TELA acima do mapa. */
  pulseLayer: Graphics
  /** Pulso em curso: qual ficha e desde quando (`performance.now()`); `null` = parado. */
  pulse: { tokenId: string; startedAt: number } | null
  /** MAPA LEMBRADO: o trecho que mudou desde a última visita pisca aqui, em espaço de TELA (`revisitPulse.ts`). */
  revisitLayer: Graphics
  /**
   * Piscar em curso: as áreas em px de MUNDO (a câmera pode andar durante o
   * piscar), a cena em que nasceram e desde quando; `null` = parado.
   */
  revisit: { areas: Bounds[]; mapId: string; startedAt: number; reducedMotion: boolean } | null
}

/** Referência estável para o padrão da prop: sem sinais, nada muda entre renders. */
const NO_SIGNALS: readonly SignalMark[] = []
const NO_DESTINATIONS: readonly DestinationMark[] = []
const NO_PERSONAL_NOTES: readonly PersonalNote[] = []
const NO_PLAYER_LASERS: readonly RemoteLaser[] = []
const NO_OWN_LASER: LaserTrail = { points: [], on: false }
/** Rótulo da ponta do próprio laser: o nome de quem aponta é o dos outros, o seu é "Você". */
const OWN_LASER_LABEL = 'Você'

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
 * ZONA DE PERIGO na tela do jogador. O host só manda a sala tomada que ele
 * enxerga agora; a máscara da visão ainda corta o desenho na borda do anel,
 * para o perigo aparecer SÓ onde ele enxerga — a parte da sala fora do alcance
 * da lanterna continua sem nada pintado.
 */
function redrawHazards(scene: Scene, hazards: readonly PlayerHazard[], vision: RegionPoint[][]): void {
  if (hazards === scene.lastHazards && vision === scene.lastHazardsVision) return
  scene.lastHazards = hazards
  scene.lastHazardsVision = vision
  drawHazardAreas(scene.hazards, hazards)
  scene.hazardsMask.clear()
  const rings = vision.filter((poly) => poly.length >= 3)
  for (const ring of rings) scene.hazardsMask.poly(ring, true).fill({ color: 0xffffff })
  scene.hazards.visible = hazards.length > 0 && rings.length > 0
  scene.hazardsCount = scene.hazards.visible ? hazards.length : 0
}

/**
 * GATILHO DE ÁREA na tela do jogador: só chega o que o mestre revelou numa
 * área que o jogador já conhece. É anotação da planta (como a própria sala),
 * então não é recortada pela visão — a névoa por cima escurece o que está
 * fora do alcance da lanterna, igual ao chão.
 */
function redrawTriggers(scene: Scene, triggers: readonly PlayerAreaTrigger[]): void {
  if (triggers === scene.lastTriggers) return
  scene.lastTriggers = triggers
  drawAreaTriggers(scene.triggers, triggers)
  scene.triggersCount = triggers.filter((t) => t.points.length >= 3).length
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

/**
 * TETO DE CONSTRUÇÃO — a silhueta do prédio, pintada CHAPADA acima da névoa.
 *
 * Sala com `room.roof` só chega aqui quando o teto está FECHADO para este
 * jogador: o recorte do mestre (`lib/fogFilter.ts`) manda o polígono e mais
 * nada de dentro — prop, desenho, escada, pino, luz, token alheio e o chão do
 * interior nem entram no pacote. Então este preenchimento não está ESCONDENDO
 * nada: debaixo dele não existe nada para esconder. Ele fica acima da névoa de
 * propósito, porque um prédio não some quando a lanterna não alcança o telhado:
 * quem está na rua vê a construção inteira.
 */
function redrawRoofs(scene: Scene, regions: Region[], peek: RoofPeek | undefined): void {
  const roofs = regions.filter((r) => roomHasRoof(r.room) && r.points.length >= 3)
  const peekedIds = new Set(peek?.roofIds ?? [])
  const peekVision = (peek?.vision ?? []).filter((poly) => poly.length >= 3)
  // Sem visão de quem espia não há o que recortar: o telhado sai inteiro.
  const peeked = peekVision.length === 0 ? [] : roofs.filter((r) => peekedIds.has(r.id))
  const whole = peeked.length === 0 ? roofs : roofs.filter((r) => !peekedIds.has(r.id))
  const key = JSON.stringify([whole.map((r) => r.points), peeked.map((r) => r.points), peeked.length === 0 ? [] : peekVision])
  if (key === scene.lastRoofsKey) return
  scene.lastRoofsKey = key
  paintRoofs(scene.roofs, whole)
  paintRoofs(scene.peekedRoofs, peeked)
  // VER PELA PORTA ABERTA: o telhado do prédio espiado continua lá, com um
  // buraco no formato da visão de quem está no vão — máscara INVERSA pelo
  // mesmo motivo da névoa (`redrawFog`): `cut` falha com buraco saindo da forma.
  scene.peekMask.clear()
  for (const poly of peeked.length === 0 ? [] : peekVision) scene.peekMask.poly(poly, true).fill({ color: 0xffffff })
  if (peeked.length > 0) scene.peekedRoofs.setMask({ mask: scene.peekMask, inverse: true })
  else scene.peekedRoofs.mask = null
  scene.peekMask.visible = peeked.length > 0
  scene.roofsCount = roofs.length
  scene.peekedRoofsCount = peeked.length
}

function paintRoofs(layer: Graphics, roofs: readonly Region[]): void {
  layer.clear()
  for (const region of roofs) layer.poly(region.points, true)
  if (roofs.length > 0) {
    layer.fill({ color: ROOF_COLOR, alpha: 1 })
    layer.stroke({ width: ROOF_EDGE_WIDTH, color: ROOF_EDGE_COLOR, alpha: 1 })
  }
}

/**
 * Liga o pulso "você está aqui" na ficha. Com movimento reduzido fica só o aro
 * branco, que já está sempre lá: o pulso é reforço, não a única pista.
 */
function startOwnerPulse(scene: Scene, tokenId: string): void {
  if (prefersReducedMotion()) return
  scene.pulse = { tokenId, startedAt: performance.now() }
}

/**
 * A câmera muda por pedido do app (enquadrar mapa novo, centralizar): o degrau
 * de zoom que andava para, e a pinça em curso segue da câmera nova em vez de
 * puxá-la de volta no próximo passo do dedo.
 */
function setCameraFromApp(scene: Scene, camera: Camera): void {
  scene.zoomAnimation = null
  scene.cameraGlide = null
  scene.camera = camera
  scene.touch = rebasePinch(scene.touch, camera)
  applyCamera(scene)
}

/**
 * Um degrau dos botões + e −, em volta do centro da tela. Animado para o
 * toque e o clique; inteiro de uma vez para o teclado e para quem pediu ao
 * sistema menos movimento.
 */
function stepZoom(scene: Scene, direction: ZoomDirection, animate: boolean): void {
  // Pinça em andamento manda na câmera: o botão tocado com outro dedo não disputa com ela.
  if (scene.touch.pinch !== null) return
  // O + assume a câmera: o recentrar que andava para onde está, senão a puxaria de volta.
  scene.cameraGlide = null
  const anchor = { x: scene.app.screen.width / 2, y: scene.app.screen.height / 2 }
  if (animate && !prefersReducedMotion()) {
    const animation = zoomStepAnimation(scene.camera, scene.zoomAnimation, anchor, direction, performance.now())
    // No limite não há degrau; o que já andava termina sozinho.
    if (animation !== null) scene.zoomAnimation = animation
    return
  }
  const camera = zoomStepNow(scene.camera, scene.zoomAnimation, anchor, direction)
  if (camera === null) return
  scene.zoomAnimation = null
  scene.camera = camera
  applyCamera(scene)
}

/** Referência estável: sem zonas, o redesenho não repinta a camada a cada snapshot. */
const NO_CONCEALED: RegionPoint[][] = []
/** Mesmo motivo, para a zona de perigo. */
const NO_HAZARDS: readonly PlayerHazard[] = []
/** Mesmo motivo, para o gatilho de área. */
const NO_TRIGGERS: readonly PlayerAreaTrigger[] = []
/** Referência estável: sem ninguém esperando, o redesenho não dispara à toa. */
const NO_WAITING: readonly string[] = []

export function PlayerView({
  map,
  vision,
  explored,
  concealed = NO_CONCEALED,
  hazards = NO_HAZARDS,
  gatilhos = NO_TRIGGERS,
  glimpses = NO_CONCEALED,
  peek,
  ownTokens,
  turnTokenId = null,
  waitingTokens = NO_WAITING,
  settings,
  focusTokenId,
  focusSeq,
  onMove,
  signals = NO_SIGNALS,
  signalArmed = false,
  onSignal,
  onLongPress,
  onMapPointerDown,
  destinations = NO_DESTINATIONS,
  destinationArmed = false,
  onDestination,
  measureArmed = false,
  onDoorToggle,
  onPinOpen,
  onTokenOpen,
  onRoomOpen,
  onMarkOpen,
  laser,
  laserArmed = false,
  ownLaserColor = OWN_TOKEN_CSS,
  onLaserMove,
  onLaserEnd,
  playerLasers = NO_PLAYER_LASERS,
  focusObstacles,
  personalNotes = NO_PERSONAL_NOTES,
  onNoteLongPress,
  noteArmed = false,
  onNotePlace,
  focusPoint = null,
  zoomStep = NO_ZOOM_STEP,
  onZoomLimitsChange,
  mirror = false,
}: PlayerViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const measureLabelRef = useRef<HTMLDivElement | null>(null)
  const tokenDragLabelRef = useRef<HTMLDivElement | null>(null)
  const measureAnnouncerRef = useRef<HTMLDivElement | null>(null)
  /** Aviso "Mudou desde a sua última visita", junto ao trecho que pisca. */
  const revisitNoteRef = useRef<HTMLDivElement | null>(null)
  /** O que esta tela já viu de cada cena, para saber o que mudou na volta (`revisitChanges.ts`). */
  const revisitMemoryRef = useRef(createRevisitMemory())
  const sceneRef = useRef<Scene | null>(null)
  const latest = {
    map,
    vision,
    explored,
    concealed,
    glimpses,
    hazards,
    gatilhos,
    peek,
    ownTokens,
    turnTokenId,
    waitingTokens,
    settings,
    onMove,
    signals,
    signalArmed,
    onSignal,
    onLongPress,
    onMapPointerDown,
    destinations,
    destinationArmed,
    onDestination,
    measureArmed,
    onDoorToggle,
    onPinOpen,
    onTokenOpen,
    onRoomOpen,
    onMarkOpen,
    laser,
    laserArmed,
    ownLaserColor,
    onLaserMove,
    onLaserEnd,
    playerLasers,
    focusObstacles,
    personalNotes,
    onNoteLongPress,
    noteArmed,
    onNotePlace,
    onZoomLimitsChange,
  }
  const latestRef = useRef(latest)
  latestRef.current = latest
  /** Último limite avisado aos botões; `null` = nenhum ainda (o primeiro sempre vai, até depois de remontar). */
  const reportedZoomLimitsRef = useRef<ZoomLimits | null>(null)
  /** Pedido dos botões já atendido: remontar com o mesmo `seq` não repete o degrau. */
  const handledZoomSeqRef = useRef(zoomStep.seq)

  /** Avisa os botões só quando o limite muda — a pinça chama isto a cada passo do dedo, e re-render por passo não se paga. */
  function reportZoomLimits(scale: number): void {
    const next = zoomLimits(scale)
    const last = reportedZoomLimitsRef.current
    if (last !== null && last.canZoomIn === next.canZoomIn && last.canZoomOut === next.canZoomOut) return
    reportedZoomLimitsRef.current = next
    latestRef.current.onZoomLimitsChange?.(next)
  }

  /** O que cobre o mapa agora, em px do CANVAS (a prop fala em px da janela). */
  function readObstacles(): Bounds[] {
    const read = latestRef.current.focusObstacles
    const el = containerRef.current
    if (!read || !el) return []
    const base = el.getBoundingClientRect()
    return read().map((b) => ({ minX: b.minX - base.left, minY: b.minY - base.top, maxX: b.maxX - base.left, maxY: b.maxY - base.top }))
  }

  /**
   * Pinta a régua (linha no canvas + rótulo no DOM) a partir de `scene.measure`.
   * Chamada no gesto e no ticker — este por causa do zoom e do arrasto de
   * câmera, que mudam a posição de tela sem mudar a medida. A chave evita
   * repintar e tocar no DOM quando nada mudou.
   *
   * O rótulo é TEXTO do DOM, não letra do Pixi: leitor de tela e busca por
   * texto o encontram, e ele fica nítido em qualquer zoom.
   */
  function syncMeasure(scene: Scene): void {
    const measure = scene.measure.measure
    const label = measureLabelRef.current
    const announcer = measureAnnouncerRef.current
    if (measure === null) {
      if (scene.lastMeasureKey === null) return
      scene.lastMeasureKey = null
      scene.measureLayer.clear()
      if (label && announcer) writeMeasureText({ label, announcer }, null)
      return
    }
    const start = measureWorldToScreen(scene.camera, measure.start)
    const end = measureWorldToScreen(scene.camera, measure.end)
    const text = playerMeasureLabel(latestRef.current.map, measure)
    const key = JSON.stringify([start, end, text])
    if (key === scene.lastMeasureKey) return
    scene.lastMeasureKey = key
    drawPlayerMeasure(scene.measureLayer, start, end)
    if (label && announcer) writeMeasureText({ label, announcer }, text)
    if (label) showScreenLabel(scene, label, text, end)
  }

  /** Escreve o rótulo acima e à direita de `end` (pontos de tela), como o do mestre, preso dentro da tela. */
  function showScreenLabel(scene: Scene, label: HTMLDivElement, text: string, end: Point): void {
    if (label.textContent !== text) label.textContent = text
    label.hidden = false
    const x = Math.min(Math.max(0, end.x + MEASURE_LABEL_OFFSET_PX), scene.app.screen.width - label.offsetWidth)
    const y = Math.min(Math.max(0, end.y - MEASURE_LABEL_OFFSET_PX - label.offsetHeight), scene.app.screen.height - label.offsetHeight)
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  /** Área de mundo em px de TELA, pela câmera de agora. */
  function revisitAreaOnScreen(scene: Scene, area: Bounds): Bounds {
    const min = scene.world.toGlobal({ x: area.minX, y: area.minY })
    const max = scene.world.toGlobal({ x: area.maxX, y: area.maxY })
    return { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y }
  }

  /** Aviso centrado acima da primeira área que pisca (px de tela), preso dentro da tela. */
  function placeRevisitNote(scene: Scene, label: HTMLDivElement, area: Bounds): void {
    const centerX = (area.minX + area.maxX) / 2
    const x = Math.min(Math.max(0, centerX - label.offsetWidth / 2), scene.app.screen.width - label.offsetWidth)
    const y = Math.min(Math.max(0, area.minY - REVISIT_PAD_PX - MEASURE_LABEL_OFFSET_PX - label.offsetHeight), scene.app.screen.height - label.offsetHeight)
    label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
  }

  /**
   * MAPA LEMBRADO: o que mudou desde a última visita começa a piscar. O aviso
   * é TEXTO do DOM (como o rótulo da régua), para o leitor de tela anunciar.
   * No espelho do mestre o aviso fica de fora: ele é `fixed` na janela, e o
   * espelho é um quadro dentro da tela do mestre — só o piscar aparece lá.
   */
  function startRevisitPulse(scene: Scene, areas: Bounds[], mapId: string): void {
    scene.revisit = { areas, mapId, startedAt: performance.now(), reducedMotion: prefersReducedMotion() }
    const label = revisitNoteRef.current
    if (!label || mirror) return
    label.textContent = REVISIT_NOTE
    label.hidden = false
    placeRevisitNote(scene, label, revisitAreaOnScreen(scene, areas[0]))
  }

  function stopRevisitPulse(scene: Scene): void {
    scene.revisit = null
    scene.revisitLayer.clear()
    const label = revisitNoteRef.current
    if (label) {
      // Texto vazio, e não só escondido: o aviso que acabou não fica legível para ninguém.
      label.textContent = ''
      label.hidden = true
    }
    const el = containerRef.current
    if (el) el.dataset.revisitPulses = '0'
  }

  /**
   * Pinta o arrasto da própria ficha: trajeto desde onde ela saiu, contorno do
   * alcance (cena com passo máximo) e "N quadrados" junto ao dedo — o mesmo
   * rótulo e o mesmo traço da régua Medir. Sem arrasto de ficha, apaga tudo.
   * Chamada no gesto e no ticker (zoom pela roda no meio do arrasto).
   */
  function syncTokenDrag(scene: Scene): void {
    const drag = scene.drag
    const label = tokenDragLabelRef.current
    if (drag?.kind !== 'token' || drag.label === null) {
      if (scene.lastTokenDragKey === null) return
      scene.lastTokenDragKey = null
      scene.tokenDragLayer.clear()
      if (label) {
        label.textContent = ''
        label.hidden = true
      }
      return
    }
    const start = measureWorldToScreen(scene.camera, drag.origin)
    const end = measureWorldToScreen(scene.camera, { x: drag.x, y: drag.y })
    // A câmera entra na chave: o contorno é refeito só quando a tela muda.
    const key = JSON.stringify([start, end, drag.label, scene.camera.scale, drag.reach === null])
    if (key === scene.lastTokenDragKey) return
    scene.lastTokenDragKey = key
    const reach = drag.reach?.map((p) => measureWorldToScreen(scene.camera, p)) ?? null
    drawPlayerTokenDrag(scene.tokenDragLayer, start, end, reach)
    if (label) showScreenLabel(scene, label, drag.label, end)
  }

  function applyMeasureEvent(scene: Scene, event: PlayerMeasureEvent): void {
    scene.measure = playerMeasureReducer(scene.measure, event)
    syncMeasure(scene)
  }

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

  /** Cada objeto na visão vira um retângulo chapado com o tamanho e a rotação do mestre. */
  function redrawPropsLayer(scene: Scene): void {
    const currentMap = latestRef.current.map
    const props = visibleProps(currentMap.props, currentMap.hiddenLayers)
    const { scale } = scene.camera
    const res = scene.app.renderer.resolution
    const key = JSON.stringify([props, scale, res, currentMap.grid])
    if (key === scene.lastPropsKey) return
    scene.lastPropsKey = key
    scene.propsCount = drawPropSilhouettes(scene.props, props, scale, res)
    scene.propLooksCount = scene.propLooksRenderer.draw(scene.propImages, scene.propLabels, props, currentMap.grid, scale)
  }

  /** Mesmo desenho do editor (linha clara fina, porta retângulo), em px de tela. */
  function redrawWallsLayer(scene: Scene): void {
    const { map: currentMap, vision: currentVision, explored: currentExplored } = latestRef.current
    // Só a planta perto da ficha e a já vista: o resto está debaixo do preto
    // (`playerCulling.ts`). Mesma entrada devolve o mesmo recorte: o zoom não refaz.
    const drawn = scene.culler.cull(currentMap, currentVision, currentExplored).walls
    const walls = wallsOnVisibleLayers(drawn, currentMap.hiddenLayers)
    const { scale } = scene.camera
    const res = scene.app.renderer.resolution
    const key = JSON.stringify([walls, scale, res])
    if (key === scene.lastWallsKey) return
    scene.lastWallsKey = key
    scene.wallsDrawn = walls.length
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
    // Sem luz não há sombra a recortar: nada de contornar o chão da cena
    // inteira (numa cidade de milhares de salas, isso travava o celular).
    if (lights.length === 0) {
      const key = JSON.stringify([lights])
      if (key === scene.lastLightsKey) return
      scene.lastLightsKey = key
      scene.lightsRenderer.draw(scene.lights, lights, { occluders: [], showMarkers: false })
      return
    }
    const walls = visibleWalls(currentMap)
    // A sombra usa o chão INTEIRO, não o recortado da tela (`lastFloorKey`
    // muda a cada pedaço explorado e refaria o contorno da cena toda a cada passo).
    const key = JSON.stringify([lights, walls, currentMap.floor])
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

  /** Pino ou porta sob o ponto da TELA, dentro da folga do dedo; `map` se é chão. Só o que o jogador vê. */
  function tapTargetAtScreen(scene: Scene, screenX: number, screenY: number): TapTarget {
    const map = latestRef.current.map
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    return findTapTarget(visiblePins(map.pins ?? [], map.hiddenLayers), visibleWalls(map), point, DOOR_TAP_TOLERANCE_PX / scene.camera.scale)
  }

  /**
   * Pino sob o ponto da TELA: o pino como está desenhado (crescido no zoom
   * afastado, `pinSizeScale`), com a folga de dedo da porta limitada ao
   * tamanho dele — de longe, um toque ao lado não abre pino que não aparece.
   */
  function pinAtScreen(scene: Scene, screenX: number, screenY: number): string | null {
    const map = latestRef.current.map
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    const scale = scene.camera.scale
    // O pino à vista (no tamanho desenhado) ou, no lance de uma escada que leva a outro
    // andar, o pino invisível dela ("Subir"/"Descer"). Escada sem ligação não tem pino no recorte.
    const pin =
      findPinAt(visiblePins(map.pins ?? [], map.hiddenLayers), point, pinTapTolerance(DOOR_TAP_TOLERANCE_PX, scale), pinSizeScale(scale)) ??
      findStairPinAt({ stairs: map.stairs, pins: map.pins ?? [], hiddenLayers: map.hiddenLayers }, point, DOOR_TAP_TOLERANCE_PX / scale)
    return pin === null ? null : pin.id
  }

  /** BILHETE NO LUGAR: bilhete sob o ponto da TELA, com a mesma folga de dedo do pino. A seta não abre nada. */
  function markAtScreen(scene: Scene, screenX: number, screenY: number): string | null {
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    const marca = acharBilheteEm(latestRef.current.map.marcas ?? [], point, DOOR_TAP_TOLERANCE_PX / scene.camera.scale)
    return marca === null ? null : marca.id
  }

  /**
   * Ficha ALHEIA sob o ponto da TELA, com a mesma folga de dedo do pino. Só
   * quando alguém ouve o toque: no espelho do mestre ("Ver tela") não há
   * cartão, e a ficha não pode virar alvo de cursor à toa. Porta sob o mesmo
   * dedo: a ficha só ganha no miolo dela (`findTappedOtherToken`) — senão a
   * porta ao lado de um NPC nunca mais abria pelo toque.
   */
  function otherTokenAtScreen(scene: Scene, screenX: number, screenY: number): string | null {
    const { map, ownTokens: own, onTokenOpen: open } = latestRef.current
    if (open === undefined) return null
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    const token = findTappedOtherToken(map.tokens, own, visibleWalls(map), point, map.grid, DOOR_TAP_TOLERANCE_PX / scene.camera.scale)
    return token === null ? null : token.id
  }

  /**
   * Pinta os pinos no tamanho deste zoom. `pins` já vem do recorte do mestre
   * (lib/fogFilter.ts) e das camadas ocultas: o que chega é o que se toca.
   */
  function paintPins(scene: Scene, pins: readonly Pin[]): void {
    const sizeScale = pinSizeScale(scene.camera.scale)
    scene.pinsSizeScale = sizeScale
    scene.pinsRenderer.draw(scene.pins, pins, null, undefined, sizeScale)
  }

  /** Zoom: os pinos só repintam quando o fator de tamanho mínimo muda (de perto ele é sempre 1). */
  function redrawPinsForZoom(scene: Scene): void {
    if (pinSizeScale(scene.camera.scale) === scene.pinsSizeScale) return
    const map = latestRef.current.map
    paintPins(scene, visiblePins(map.pins ?? [], map.hiddenLayers))
  }

  /**
   * TEXTO DA SALA: Sala cujo NOME está sob o ponto da tela e cujo texto já
   * chegou ao jogador. A caixa do rótulo é medida com todas as Salas (o rótulo
   * desvia das filhas) e com as fichas (o rótulo sai de baixo delas), como no
   * desenho; só depois se pergunta se aquela tem texto.
   */
  function roomTextAtScreen(scene: Scene, screenX: number, screenY: number): string | null {
    const map = latestRef.current.map
    const point = scene.world.toLocal({ x: screenX, y: screenY })
    const region = findRoomLabelAt(visibleRegions(map.regions, map.hiddenLayers), point, map.grid, scene.camera.scale, roomLabelObstacles(map))
    return region !== null && hasEnterText(region.room) ? region.id : null
  }

  /** Só o zoom (ou a resolução) mudou: nada de chão ou névoa. */
  function redrawZoomLayers(scene: Scene): void {
    redrawGridLayer(scene)
    redrawPropsLayer(scene)
    redrawStairsLayer(scene)
    redrawWallsLayer(scene)
    redrawDoorHints(scene)
    redrawPinsForZoom(scene)
    scene.roomNamesRenderer.setCameraScale(scene.camera.scale)
    const { showNames } = latestRef.current.settings
    for (const view of scene.tokenViews.values()) {
      sizeTokenLabel(view.label, scene.camera.scale, showNames)
      syncOwnerRing(view, scene.camera.scale)
      syncFacingNib(view, scene.camera.scale)
      placeCompanionLabel(view)
    }
  }

  function redraw(scene: Scene): void {
    const {
      map: currentMap,
      vision: currentVision,
      explored: currentExplored,
      concealed: currentConcealed,
      hazards: currentHazards,
      gatilhos: currentTriggers,
      glimpses: currentGlimpses,
      peek: currentPeek,
      ownTokens: own,
      turnTokenId: currentTurn,
      waitingTokens: waiting,
      settings: currentSettings,
    } = latestRef.current
    const hidden = currentMap.hiddenLayers
    const worldWidth = currentMap.width * currentMap.grid
    const worldHeight = currentMap.height * currentMap.grid

    redrawGridLayer(scene)
    // Chão só da vizinhança conhecida: o contorno (caro) sai de dezenas de
    // peças, não das milhares da cena. Ordem preservada (peça que apaga).
    // Render fiel fica com o chão INTEIRO: ele rasteriza o mapa todo de uma
    // vez, e recortar faria a chave do chão mudar a cada pedaço explorado —
    // o mapa inteiro rasterizado de novo a cada passo.
    const drawnFloor = isRasterMode(currentMap)
      ? currentMap.floor
      : scene.culler.cull(currentMap, currentVision, currentExplored).floor
    scene.floorDrawn = drawnFloor.length
    redrawFloor(scene, { ...currentMap, floor: drawnFloor })

    const regions = visibleRegions(currentMap.regions, hidden)
    scene.regionsRenderer.draw(scene.regions, regions)

    const drawings = visibleDrawings(currentMap.drawings, hidden)
    const drawingsKey = JSON.stringify(drawings)
    if (drawingsKey !== scene.lastDrawingsKey) {
      scene.lastDrawingsKey = drawingsKey
      drawDrawings(scene.drawings, drawings)
    }
    redrawPropsLayer(scene)
    redrawStairsLayer(scene)

    redrawWallsLayer(scene)
    redrawDoorHints(scene)
    const walls = visibleWalls(currentMap)
    scene.wallsCount = walls.length
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

    scene.roomNamesRenderer.draw(scene.roomNames, regions, currentMap.grid, scene.camera.scale, roomLabelObstacles(currentMap))
    scene.textLabelsRenderer.draw(scene.textLabels, drawings)
    scene.roomNames.visible = currentSettings.showNames
    scene.textLabels.visible = currentSettings.showNames
    scene.propLabels.visible = currentSettings.showNames

    redrawLights(scene)
    redrawHazards(scene, currentHazards, currentVision)
    redrawTriggers(scene, currentTriggers)
    redrawFog(scene, currentMap, currentVision, currentExplored, currentSettings.exploredBrightness)
    redrawConcealed(scene, currentConcealed)
    redrawRoofs(scene, regions, currentPeek)
    if (currentGlimpses !== scene.lastRoofCut) {
      scene.lastRoofCut = currentGlimpses
      applyRoofCut(scene.roofs, scene.roofCut, currentGlimpses)
    }

    // O recorte do mestre já tirou daqui todo pino que este jogador não pode
    // ver (lib/fogFilter.ts): o que chegou é o que ele pode tocar.
    const marcas = currentMap.marcas ?? []
    const marksKey = JSON.stringify(marcas)
    if (marksKey !== scene.lastMarksKey) {
      scene.lastMarksKey = marksKey
      drawMarcas(scene.marks, marcas)
    }

    const pins = visiblePins(currentMap.pins ?? [], hidden)
    const pinsKey = JSON.stringify(pins)
    if (pinsKey !== scene.lastPinsKey || pinSizeScale(scene.camera.scale) !== scene.pinsSizeScale) {
      scene.lastPinsKey = pinsKey
      paintPins(scene, pins)
    }

    // Reaproveita a view por id e NUNCA destrói `Text` durante a sessão: Text
    // destruído antes de ser renderizado (3 redraws por movimento: otimista,
    // accepted, snapshot; ou token saindo da visão) derruba o Pixi 8.20 em
    // TexturePool.returnTexture — exceção no efeito desmonta o React. Token que
    // sai da visão só fica invisível; se voltar, a mesma view é reusada. A
    // memória fica limitada ao número de tokens já vistos; tudo morre no app.destroy.
    const ownSet = new Set(own)
    const waitingSet = new Set(waiting)
    const currentIds = new Set(currentMap.tokens.map((t) => t.id))
    for (const [id, view] of scene.tokenViews) {
      if (currentIds.has(id)) continue
      view.wrapper.visible = false
      scene.tokenGlides.delete(id)
      scene.tokenTurns.delete(id)
    }
    // Deslize só dentro da MESMA cena: a ficha que chega a outra cena (ou a
    // primeira desenhada) aparece no lugar, sem atravessar a tela.
    const sameScene = scene.fittedMapId === currentMap.id
    const reducedMotion = prefersReducedMotion()
    const draggedId = scene.drag?.kind === 'token' ? scene.drag.tokenId : null
    const now = performance.now()
    let facingCount = 0
    let companionsCount = 0
    for (const token of currentMap.tokens) {
      const isOwn = ownSet.has(token.id)
      const isTurn = token.id === currentTurn
      const isWaiting = waitingSet.has(token.id)
      const key = tokenViewKey(token, currentMap.grid, isOwn, isTurn, isWaiting)
      let view = scene.tokenViews.get(token.id)
      // Onde a ficha está desenhada agora; `null` = não estava na tela (nova, ou
      // voltando para a visão): aparece no lugar, sem vir de onde estava escondida.
      const shown = view?.wrapper.visible === true ? { x: view.wrapper.x, y: view.wrapper.y } : null
      // Idem para a frente: a ficha que volta à visão já chega virada, sem girar na frente do jogador.
      const shownFacing = view?.wrapper.visible === true && view.facing !== null ? view.facingNib.rotation : null
      if (!view) {
        const tokenId = token.id
        view = createTokenView(token, currentMap.grid, isOwn, isTurn, isWaiting)
        view.wrapper.on('pointerdown', (event: FederatedPointerEvent) => startTokenDrag(scene, tokenId, event))
        scene.tokens.addChild(view.wrapper)
        scene.tokenViews.set(tokenId, view)
      } else if (view.key !== key) {
        view.key = key
        paintTokenView(view, token, currentMap.grid, isOwn, isTurn, isWaiting)
      }
      // Fora do `if` de propósito: trocar uma foto por outra não muda a chave.
      syncTokenPhoto(view, token, currentMap.grid)
      // A posse muda sem a view nascer de novo (o mestre atribui ou tira a ficha).
      applyTokenTouch(view.wrapper, isOwn)
      sizeTokenLabel(view.label, scene.camera.scale, currentSettings.showNames)
      syncOwnerRing(view, scene.camera.scale)
      syncFacing(view, token, scene.tokenTurns, { shown: shownFacing, now, animate: sameScene && !reducedMotion, cameraScale: scene.camera.scale })
      placeCompanionLabel(view)
      if (view.facing !== null) facingCount += 1
      if (view.companionColor !== null || view.companionLabel.text !== '') companionsCount += 1
      view.wrapper.visible = true
      // A ficha sob o dedo é do arrasto (abaixo): não desliza atrás dele.
      const animate = sameScene && !reducedMotion && token.id !== draggedId
      const at = syncGlide(scene.tokenGlides, token.id, { shown, target: { x: token.x, y: token.y }, now, animate })
      view.wrapper.position.set(at.x, at.y)
    }
    // Já, e não no próximo quadro: o toque que chega antes dele acharia a ordem velha.
    scene.tokens.sortChildren()
    // Snapshot chegou no meio do arrasto: o token arrastado fica sob o dedo.
    const drag = scene.drag
    if (drag?.kind === 'token') scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(drag.x, drag.y)

    // MAPA LEMBRADO: a volta a um trecho que mudou desde a última visita pisca.
    // Só com o que chegou no pacote: nada que a névoa ou o mestre escondem entra na conta.
    if (scene.revisit !== null && scene.revisit.mapId !== currentMap.id) stopRevisitPulse(scene)
    const changed = observeRevisit(revisitMemoryRef.current, {
      map: currentMap,
      vision: currentVision,
      explored: currentExplored,
      concealed: currentConcealed,
    })
    if (changed.length > 0) startRevisitPulse(scene, changed, currentMap.id)

    // Contagens para o e2e: canvas WebGL não é legível pelo DOM.
    const el = containerRef.current
    if (el) {
      el.dataset.revisitPulses = String(scene.revisit?.areas.length ?? 0)
      el.dataset.wallsCount = String(scene.wallsCount)
      el.dataset.wallsDrawn = String(scene.wallsDrawn)
      el.dataset.floorDrawn = String(scene.floorDrawn)
      el.dataset.tokensCount = String(currentMap.tokens.length)
      el.dataset.facingCount = String(facingCount)
      el.dataset.companionsCount = String(companionsCount)
      el.dataset.regionsCount = String(regions.filter((r) => !isDegenerateRegion(r.points)).length)
      el.dataset.labelsCount = String(drawings.filter((d) => d.kind === 'text').length)
      el.dataset.exploredCells = String(scene.exploredCells)
      el.dataset.concealedCount = String(scene.concealedCount)
      el.dataset.hazardsCount = String(scene.hazardsCount)
      el.dataset.triggersCount = String(scene.triggersCount)
      el.dataset.peekedRoofsCount = String(scene.peekedRoofsCount)
      el.dataset.pinsCount = String(pins.length)
      el.dataset.propsCount = String(scene.propsCount)
      el.dataset.propLabelsCount = String(scene.propLooksCount.labels)
      el.dataset.propImagesCount = String(scene.propLooksCount.images)
      el.dataset.ownTokens = own.join(',')
      el.dataset.waitingTokens = currentMap.tokens.filter((t) => waitingSet.has(t.id)).map((t) => t.id).join(',')
    }

    if (scene.fittedMapId !== currentMap.id) {
      scene.fittedMapId = currentMap.id
      // Mapa novo (viagem): a medida era em pontos do mapa de antes e mentiria aqui. O modo continua ligado.
      scene.measure = withMeasureArmed(MEASURE_OFF, scene.measure.armed)
      syncMeasure(scene)
      // O próprio rastro também era do mapa de antes.
      scene.ownLaser = { points: [], on: scene.ownLaser.on }
      const viewport = { width: scene.app.screen.width, height: scene.app.screen.height }
      // Enquadra o andar, mas nunca deixa a própria ficha fora da tela (andar enorme travava em 10%)
      // — e, sobre esse enquadramento, nunca deixa a ficha debaixo do painel flutuante.
      const fitted = arrivalCameraForFloor(currentMap, own, viewport, FIT_MARGIN)
      const mine = firstOwnToken(currentMap.tokens, own)
      const disc = mine === null ? null : { x: mine.x, y: mine.y, radius: tokenRadius(mine, currentMap.grid) }
      const arrival = arrivalCamera(fitted, disc, viewport, readObstacles())
      // Pelo caminho do app: o degrau do + do mapa de antes para aqui, e a pinça recomeça da câmera nova.
      setCameraFromApp(scene, arrival)
      // Pulso só quando a câmera foi atrás da ficha: é a resposta a "onde estou?".
      if (mine !== null && arrival !== fitted) startOwnerPulse(scene, mine.id)
    }
    // Nomes e rótulos novos nascem na resolução do renderer: ajusta ao zoom atual.
    scene.textResolution.flush()
  }

  /** Fim do gesto do laser (soltou, ou desligou o modo no meio): a ponta apaga e o rastro esmaece sozinho. */
  function endOwnLaser(scene: Scene): void {
    if (scene.drag?.kind === 'laser') scene.drag = null
    scene.ownLaser = { points: pruneLaserTrail(scene.ownLaser.points, Date.now()), on: false }
    latestRef.current.onLaserEnd?.()
  }

  /**
   * Soltou a própria ficha perto da borda, ou debaixo do painel, com "Câmera
   * segue minha ficha" ligado (ver `followsOwnToken`): a câmera vai
   * até ela em `RECENTER_MS`, e de uma vez para quem pediu ao sistema menos
   * movimento. No miolo da tela a câmera fica onde está.
   */
  function recenterOnDrop(scene: Scene, own: OwnDisc): void {
    const viewport = { width: scene.app.screen.width, height: scene.app.screen.height }
    const target = recenterTarget(scene.camera, own, viewport, readObstacles())
    if (target === null) return
    if (prefersReducedMotion()) {
      setCameraFromApp(scene, target)
      return
    }
    // O recentrar assume a câmera: o degrau do + que andava para onde está.
    scene.zoomAnimation = null
    scene.cameraGlide = startCameraGlide(scene.camera, target, performance.now())
  }

  function startTokenDrag(scene: Scene, tokenId: string, event: FederatedPointerEvent): void {
    // Alt+clique ou modo Sinalizar sobre um token: deixa o evento subir para o palco sinalizar.
    // Modo Medir também: medir a partir da própria ficha é o caso mais comum, e ela não pode andar.
    // Modo Laser também: apontar a partir da própria ficha não pode arrastá-la.
    // "Marcar destino" também: marcar onde a própria ficha está é marcar, não andar. "Anotar", idem.
    const current = latestRef.current
    if (event.altKey || current.signalArmed || current.measureArmed || current.laserArmed || current.destinationArmed || current.noteArmed) return
    event.stopPropagation()
    // Outro gesto já em curso (o segundo dedo nem chega aqui: a captura do palco o fez pinça).
    if (scene.drag !== null) return
    const view = scene.tokenViews.get(tokenId)?.wrapper
    if (!view) return
    const world = scene.world.toLocal(event.global)
    // Pegou a ficha no meio de um deslize: ela para onde está e passa a seguir o dedo.
    scene.tokenGlides.delete(tokenId)
    // Pegou a ficha no meio do recentrar: a câmera para onde está, e a borda passa a mandar nela.
    scene.cameraGlide = null
    const origin = { x: view.x, y: view.y }
    const screen = { x: event.global.x, y: event.global.y }
    scene.drag = {
      kind: 'token',
      pointerId: event.pointerId,
      tokenId,
      offsetX: view.x - world.x,
      offsetY: view.y - world.y,
      x: view.x,
      y: view.y,
      origin,
      reach: reachOutline(latestRef.current.map, origin),
      label: null,
      screenStart: screen,
      screenLast: screen,
      startX: screen.x,
      startY: screen.y,
      screenX: screen.x,
      screenY: screen.y,
      edgeArmed: false,
      edgeAt: null,
    }
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
      const props = new Graphics()
      const propImages = new Container()
      const propLabels = new Container()
      const stairs = new Graphics()
      const walls = new Graphics()
      const doorHints = new Graphics()
      const doors = new Graphics()
      const roomNames = new Container()
      const textLabels = new Container()
      const lights = new Container()
      const hazards = new Graphics()
      const hazardsMask = new Graphics()
      hazards.mask = hazardsMask
      const triggers = new Graphics()
      const fogUnknown = new Graphics()
      const knownMask = new Graphics()
      const fogDim = new Graphics()
      const visionMask = new Graphics()
      const concealed = new Graphics()
      const roofs = new Graphics()
      // Máscara do telhado: mora no mundo (acompanha a câmera, como `gridMask`).
      const roofCut = new Graphics()
      const peekedRoofs = new Graphics()
      const peekMask = new Graphics()
      const pins = new Container()
      const marks = new Graphics()
      const tokens = new Container()
      prepareTokenLayer(tokens)
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
        // Móveis sobre o chão e ABAIXO de escada, parede e porta — ao contrário
        // do editor, que põe a imagem do objeto por cima. Lá a imagem tem fundo
        // transparente; aqui a silhueta é o retângulo inteiro e, por cima, apagaria
        // o traço do cômodo onde o móvel encosta (cama, armário, estante).
        props,
        propImages,
        stairs,
        walls,
        doorHints,
        doors,
        roomNames,
        textLabels,
        propLabels,
        // Luz acima da planta e ABAIXO da névoa: o que o jogador não vê segue
        // escuro mesmo com uma tocha acesa do outro lado.
        lights,
        // Perigo acima da planta e da luz, ABAIXO da névoa, e ainda recortado
        // pela visão (`redrawHazards`): o jogador só vê o fogo onde enxerga.
        hazardsMask,
        hazards,
        // Gatilho revelado: marca da planta, também ABAIXO da névoa.
        triggers,
        fogUnknown,
        knownMask,
        fogDim,
        visionMask,
        concealed,
        // Telhado acima da névoa e abaixo dos tokens: o token do jogador está
        // do lado de fora (senão o teto teria aberto) e nunca fica sob o prédio.
        roofCut,
        roofs,
        // O telhado espiado pela porta, no mesmo andar do telhado, com o buraco da visão.
        peekedRoofs,
        peekMask,
        // Bilhete e giz acima da névoa, como o pino: só chega o que o jogador
        // já viu (lib/fogFilter.ts), e no escuro lembrado ele continua legível.
        marks,
        pins,
        tokens,
      )
      const signalsLayer = new Container()
      signalsLayer.eventMode = 'none'
      // Bandeirinhas "vamos para cá" dentro da camada dos sinais, nascida antes das ondas: ficam por baixo delas.
      const destinationsLayer = new Container()
      signalsLayer.addChild(destinationsLayer)
      // Laser do mestre acima dos sinais: é a mão de quem conduz a mesa.
      const laserLayer = new Container()
      laserLayer.eventMode = 'none'
      // Régua do jogador acima do mapa (e da névoa: medir até onde ainda não se vê é legítimo) e abaixo dos sinais.
      const measureLayer = new Graphics()
      measureLayer.eventMode = 'none'
      // Pulso da própria ficha logo acima do mapa: some sob a régua e os sinais, que são ação em curso.
      const pulseLayer = new Graphics()
      pulseLayer.eventMode = 'none'
      // Trecho que mudou desde a última visita: logo acima do mapa, abaixo do pulso da própria ficha.
      const revisitLayer = new Graphics()
      revisitLayer.eventMode = 'none'
      // Arrasto da própria ficha: mesma altura da régua. O contorno do alcance
      // é só geometria da regra (quadrados a partir da ficha), não revela nada da névoa.
      const tokenDragLayer = new Graphics()
      tokenDragLayer.eventMode = 'none'
      // Anotações pessoais logo acima do mapa (e da névoa: a nota é de quem a pôs) e abaixo de régua e sinais.
      const personalNotesLayer = new Container()
      personalNotesLayer.eventMode = 'none'
      app.stage.addChild(world, revisitLayer, personalNotesLayer, pulseLayer, measureLayer, tokenDragLayer, signalsLayer, laserLayer)
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
        props,
        lastPropsKey: null,
        propsCount: 0,
        propImages,
        propLabels,
        propLooksRenderer: createPropLooksRenderer(),
        propLooksCount: { images: 0, labels: 0 },
        walls,
        doors,
        doorHints,
        lastDoorHintsKey: null,
        doorHintsCount: 0,
        lastWallsKey: null,
        wallsCount: 0,
        culler: createPlayerCuller(),
        wallsDrawn: 0,
        floorDrawn: 0,
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
        hazards,
        hazardsMask,
        lastHazards: null,
        lastHazardsVision: null,
        hazardsCount: 0,
        triggers,
        lastTriggers: null,
        triggersCount: 0,
        marks,
        lastMarksKey: null,
        pinsSizeScale: 1,
        concealed,
        lastConcealed: null,
        concealedCount: 0,
        roofs,
        peekedRoofs,
        peekMask,
        lastRoofsKey: null,
        roofsCount: 0,
        roofCut,
        lastRoofCut: null,
        peekedRoofsCount: 0,
        tokens,
        tokenViews: new Map(),
        tokenGlides: createTokenGlides(),
        tokenTurns: createTokenTurns(),
        camera: { x: 0, y: 0, scale: 1 },
        zoomScale: 1,
        onZoom: () => {},
        fittedMapId: null,
        drag: null,
        touch: NO_TOUCH,
        zoomAnimation: null,
        cameraGlide: null,
        signalsLayer,
        signalsRenderer: createSignalsRenderer(),
        destinationsLayer,
        destinationsRenderer: createDestinationsRenderer(),
        measureLayer,
        measure: withMeasureArmed(MEASURE_OFF, latestRef.current.measureArmed),
        lastMeasureKey: null,
        ownLaser: NO_OWN_LASER,
        tokenDragLayer,
        lastTokenDragKey: null,
        // Texto rasterizado a 1x e esticado pelo zoom sai mole: resolução em degraus.
        textResolution: createDebouncedTask(() => {
          if (destroyed) return
          el.dataset.textResolution = String(syncWorldTextResolution(world, scene.camera.scale, app.renderer.resolution))
        }),
        pulseLayer,
        pulse: null,
        revisitLayer,
        revisit: null,
      }
      scene.onZoom = () => {
        redrawZoomLayers(scene)
        reportZoomLimits(scene.camera.scale)
      }
      sceneRef.current = scene

      // Degrau dos botões + e −. Primeiro ticker de propósito: sinais, laser e
      // régua do mesmo quadro já se desenham com a câmera nova.
      const tickZoom = () => {
        const animation = scene.zoomAnimation
        if (animation === null) return
        const frame = zoomAnimationFrame(animation, performance.now())
        scene.camera = frame.camera
        if (frame.done) scene.zoomAnimation = null
        applyCamera(scene)
      }
      app.ticker.add(tickZoom)

      // Recentrar na ficha solta perto da borda. Logo depois do degrau, pelo mesmo motivo.
      const tickCameraGlide = () => {
        const glide = scene.cameraGlide
        if (glide === null) return
        const frame = cameraGlideFrame(glide, performance.now())
        scene.camera = frame.camera
        if (frame.done) scene.cameraGlide = null
        applyCamera(scene)
      }
      app.ticker.add(tickCameraGlide)

      // Ficha arrastada na faixa da borda: o mapa rola a cada quadro, com o dedo parado ou não,
      // e a ficha continua sob o dedo. Só a câmera desta tela — nada vai pela rede até soltar.
      const tickEdgeScroll = () => {
        const drag = scene.drag
        if (drag?.kind !== 'token' || !drag.edgeArmed) return
        // Pinça em curso manda na câmera (o dedo da ficha nem é dela, mas não disputa).
        if (scene.touch.pinch !== null) return
        const now = performance.now()
        const elapsed = drag.edgeAt === null ? 0 : now - drag.edgeAt
        drag.edgeAt = now
        const current = latestRef.current.map
        const mapBounds = { minX: 0, minY: 0, maxX: current.width * current.grid, maxY: current.height * current.grid }
        const viewport = { width: app.screen.width, height: app.screen.height }
        // A borda é a da área que o painel deixa livre, a mesma do recentrar ao soltar.
        const next = edgeScrollCamera(scene.camera, { x: drag.screenX, y: drag.screenY }, viewport, mapBounds, elapsed, readObstacles())
        if (next === null) return
        // A borda assume a câmera: o degrau do + para onde está.
        scene.zoomAnimation = null
        scene.camera = next
        applyCamera(scene)
        // Passo máximo vale também com a borda rolando: a ficha para no alcance.
        const preview = previewTokenDrag(current, drag.origin, {
          x: (drag.screenX - next.x) / next.scale + drag.offsetX,
          y: (drag.screenY - next.y) / next.scale + drag.offsetY,
        })
        drag.x = preview.at.x
        drag.y = preview.at.y
        drag.label = preview.label
        scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(drag.x, drag.y)
        syncTokenDrag(scene)
      }
      app.ticker.add(tickEdgeScroll)

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

      // Marcas "vamos para cá": sem animação, mas presas à tela (tamanho fixo,
      // seta na borda), então acompanham a câmera quadro a quadro.
      let destinationsDrawn = 0
      const tickDestinations = () => {
        const current = latestRef.current.destinations
        if (current.length === 0 && destinationsDrawn === 0) return
        const viewport = { width: app.screen.width, height: app.screen.height }
        const drawn = scene.destinationsRenderer.draw(scene.destinationsLayer, current, scene.camera, viewport)
        // Para o e2e: quantas bandeirinhas o renderer desenhou de fato.
        if (drawn !== destinationsDrawn) el.dataset.destinationsDrawn = String(drawn)
        destinationsDrawn = drawn
      }
      app.ticker.add(tickDestinations)

      // Anotações pessoais: paradas, mas presas à tela como as bandeirinhas, então acompanham a câmera.
      const personalNotesRenderer = createPersonalNotesRenderer()
      let personalNotesDrawn = 0
      const tickPersonalNotes = () => {
        const current = latestRef.current.personalNotes
        if (current.length === 0 && personalNotesDrawn === 0) return
        const viewport = { width: app.screen.width, height: app.screen.height }
        const drawn = personalNotesRenderer.draw(personalNotesLayer, current, scene.camera, viewport)
        // Para o e2e: quantas notas estão à vista de fato.
        if (drawn !== personalNotesDrawn) el.dataset.personalNotesDrawn = String(drawn)
        personalNotesDrawn = drawn
      }
      app.ticker.add(tickPersonalNotes)

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

      // Laser dos JOGADORES: o dos outros da cena (um rastro por jogador) e o próprio, desenhado na hora.
      const playerLaserPool = createLaserPool()
      const ownLaserRenderer = createLaserRenderer({ color: latestRef.current.ownLaserColor, label: OWN_LASER_LABEL })
      let playerLasersDrawn = 0
      el.dataset.playerLasersDrawn = '0'
      const tickPlayerLasers = () => {
        const others = latestRef.current.playerLasers
        const own = scene.ownLaser
        if (others.length === 0 && own.points.length === 0 && playerLasersDrawn === 0) return
        const now = Date.now()
        ownLaserRenderer.restyle({ color: latestRef.current.ownLaserColor, label: OWN_LASER_LABEL })
        const drawn = playerLaserPool.draw(laserLayer, others, scene.camera, now) + ownLaserRenderer.draw(laserLayer, own, scene.camera, now)
        if (drawn !== playerLasersDrawn) el.dataset.playerLasersDrawn = String(drawn)
        playerLasersDrawn = drawn
        // Próprio rastro todo apagado e sem gesto: esvazia para o ticker voltar a pular o quadro.
        if (!own.on && own.points.length > 0 && pruneLaserTrail(own.points, now).length === 0) scene.ownLaser = NO_OWN_LASER
      }
      app.ticker.add(tickPlayerLasers)

      /** Ponto do próprio laser: entra no rastro local e sai pelo socket. */
      const pointOwnLaser = (screenX: number, screenY: number) => {
        const point = scene.world.toLocal({ x: screenX, y: screenY })
        const now = Date.now()
        scene.ownLaser = { points: appendLaserPoints(pruneLaserTrail(scene.ownLaser.points, now), [{ x: point.x, y: point.y }], now), on: true }
        latestRef.current.onLaserMove?.(point.x, point.y)
      }

      // Zoom e arrasto de câmera mudam a posição de tela da régua sem mudar a medida.
      const tickMeasure = () => {
        syncMeasure(scene)
        syncTokenDrag(scene)
      }
      app.ticker.add(tickMeasure)

      // Leva cada ficha em deslize um passo adiante; parada, não custa nada.
      // Mexe só na posição de quem anda: o resto da cena não é refeito.
      const tickTokenGlides = () => {
        if (scene.tokenGlides.size === 0) return
        for (const { id, x, y } of stepGlides(scene.tokenGlides, performance.now())) {
          scene.tokenViews.get(id)?.wrapper.position.set(x, y)
        }
      }
      app.ticker.add(tickTokenGlides)

      // Gira o bico de cada ficha que o mestre virou; parado, não custa nada.
      // Mexe só no ângulo do bico: a ficha, o aro e o nome não são refeitos.
      const tickTokenTurns = () => {
        if (scene.tokenTurns.size === 0) return
        for (const { id, angle } of stepTurns(scene.tokenTurns, performance.now())) {
          const view = scene.tokenViews.get(id)
          if (view) view.facingNib.rotation = angle
        }
      }
      app.ticker.add(tickTokenTurns)

      // Pulso "você está aqui": segue a ficha na tela (arrasto, zoom) até acabar sozinho.
      const tickPulse = () => {
        const pulse = scene.pulse
        if (pulse === null) return
        const view = scene.tokenViews.get(pulse.tokenId)
        if (view === undefined || !view.wrapper.visible) {
          scene.pulse = null
          pulseLayer.clear()
          return
        }
        const at = world.toGlobal(view.wrapper.position)
        const from = ownerRingOuterPx(view.radius, scene.camera.scale)
        if (!drawOwnerPulse(pulseLayer, at.x, at.y, from, performance.now() - pulse.startedAt)) scene.pulse = null
      }
      app.ticker.add(tickPulse)

      // Trecho que mudou: pisca e o aviso segue a área na tela (arrasto, zoom) até acabar sozinho.
      const tickRevisit = () => {
        const revisit = scene.revisit
        if (revisit === null) return
        const onScreen = revisit.areas.map((area) => revisitAreaOnScreen(scene, area))
        if (!drawRevisitPulse(revisitLayer, onScreen, performance.now() - revisit.startedAt, revisit.reducedMotion)) {
          stopRevisitPulse(scene)
          return
        }
        const label = revisitNoteRef.current
        if (label && !label.hidden) placeRevisitNote(scene, label, onScreen[0])
      }
      app.ticker.add(tickRevisit)

      const sendSignalAt = (screenX: number, screenY: number) => {
        const point = scene.world.toLocal({ x: screenX, y: screenY })
        latestRef.current.onSignal?.(point.x, point.y)
      }
      /** "Segurar parado": dispara depois de `SIGNAL_LONG_PRESS_MS` se o ponteiro não andou. */
      let longPress: { timer: ReturnType<typeof setTimeout>; pointerId: number; x: number; y: number } | null = null
      const cancelLongPress = () => {
        if (longPress === null) return
        clearTimeout(longPress.timer)
        longPress = null
      }

      /**
       * O gesto de um dedo acaba SEM efeito — o toque virou pinça, ou o
       * sistema cancelou o dedo: a ficha volta ao lugar do mapa, a medida
       * volta à de antes do toque, o sinal de "segurar parado" não sai, e o
       * laser apaga a ponta (quem está na cena não fica com ela acesa).
       */
      const abandonDrag = () => {
        cancelLongPress()
        const drag = scene.drag
        scene.drag = null
        if (drag?.kind === 'token') {
          const token = latestRef.current.map.tokens.find((t) => t.id === drag.tokenId)
          if (token) scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(token.x, token.y)
        } else if (drag?.kind === 'measure') {
          scene.measure = drag.before
          syncMeasure(scene)
        } else if (drag?.kind === 'laser') {
          endOwnLaser(scene)
        }
      }

      /** Dedo que sobrou da pinça: arrasta a câmera, e soltá-lo não é toque em porta ou pino. */
      const carryPan = (carry: { id: number; at: { x: number; y: number } } | null): Drag | null =>
        carry === null ? null : { kind: 'pan', pointerId: carry.id, lastX: carry.at.x, lastY: carry.at.y, startX: carry.at.x, startY: carry.at.y, canTap: false }

      /**
       * Todo toque passa aqui ANTES da ficha e do chão (fase de captura do
       * Pixi). O segundo dedo vira pinça, e o gesto que o primeiro tinha
       * começado acaba sem efeito. Sem isto o segundo dedo era ignorado e a
       * pinça virava arrasto do primeiro: a ficha andava, ou a câmera corria.
       */
      app.stage.on('pointerdowncapture', (event: FederatedPointerEvent) => {
        if (event.pointerType !== 'touch') return
        // Primeiro dedo de um gesto novo com um gesto velho pendurado: é de um toque que o navegador cancelou sem avisar.
        if (event.isPrimary && scene.drag !== null) abandonDrag()
        const { state, role } = fingerDown(scene.touch, event.pointerId, { x: event.global.x, y: event.global.y }, event.isPrimary, scene.camera)
        scene.touch = state
        if (role === 'single') return
        // Segundo dedo (pinça) ou terceiro (ignorado): nem a ficha nem o chão recebem este toque.
        event.stopPropagation()
        if (role !== 'pinch') return
        abandonDrag()
        // A pinça partiu da câmera deste instante: o degrau dos botões e o recentrar param aqui, senão puxariam o mapa de volta.
        scene.zoomAnimation = null
        scene.cameraGlide = null
      })

      app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
        // Dedo que a captura já fez pinça. Quando o alvo é o próprio palco, parar a propagação
        // lá não impede este ouvinte (o Pixi avisa captura e alvo na mesma volta).
        if (event.pointerType === 'touch' && scene.touch.pinch !== null) return
        latestRef.current.onMapPointerDown?.()
        if (scene.drag) return
        const { x, y } = event.global
        const pointerId = event.pointerId
        if (latestRef.current.measureArmed) {
          // Com o modo Medir, o arrasto mede: nem câmera, nem sinal, nem cartão de pino.
          cancelLongPress()
          scene.drag = { kind: 'measure', pointerId, before: scene.measure }
          applyMeasureEvent(scene, { type: 'press', at: measurePointFromScreen(scene.camera, { x, y }, latestRef.current.map, event.altKey) })
          return
        }
        if (latestRef.current.laserArmed) {
          // Com o modo Laser, apertar e arrastar aponta: nem câmera, nem sinal, nem cartão de pino.
          cancelLongPress()
          scene.drag = { kind: 'laser', pointerId }
          pointOwnLaser(x, y)
          return
        }
        if (latestRef.current.destinationArmed) {
          // Com "Marcar destino", o toque põe a marca: nem câmera, nem sinal, nem cartão de pino.
          cancelLongPress()
          const point = scene.world.toLocal({ x, y })
          latestRef.current.onDestination?.(point.x, point.y)
          return
        }
        if (latestRef.current.noteArmed) {
          // Com "Anotar", o toque marca onde vai a nota: nem câmera, nem sinal, nem cartão de pino.
          cancelLongPress()
          const point = scene.world.toLocal({ x, y })
          latestRef.current.onNotePlace?.(point.x, point.y)
          return
        }
        if (event.altKey || latestRef.current.signalArmed) {
          sendSignalAt(x, y)
          return
        }
        scene.drag = { kind: 'pan', pointerId, lastX: x, lastY: y, startX: x, startY: y, canTap: true }
        cancelLongPress()
        // Dedo em cima de um PINO ou de uma PORTA não arma o sinal. São
        // controles: quem aperta ali quer ler o cartão ou abrir a porta, e
        // demorar meio segundo para soltar (tela engasgada) não muda a
        // intenção — sem esta guarda, a mesma pressão virava ping de mapa e o
        // cartão ou a porta nunca respondia (medido no toque lento).
        if (!holdBecomesSignal(tapTargetAtScreen(scene, x, y))) return
        // O bilhete no chão é controle do mesmo jeito: segurar em cima dele é querer ler.
        if (markAtScreen(scene, x, y) !== null) return
        // Idem a ficha alheia: o toque nela é para abrir o cartão.
        if (otherTokenAtScreen(scene, x, y) !== null) return
        const timer = setTimeout(() => {
          longPress = null
          // Virou sinal: o gesto não continua como arrasto de câmera.
          if (scene.drag?.kind === 'pan') scene.drag = null
          // Segurou em cima da própria anotação: o gesto é dela (apagar), sem sinal e sem menu do ponto.
          const note = personalNoteAtScreen(latestRef.current.personalNotes, { x, y }, scene.camera)
          if (note !== null && latestRef.current.onNoteLongPress !== undefined) {
            latestRef.current.onNoteLongPress(note)
            return
          }
          // Com o menu do ponto montado, o gesto é dele (sinal e menu); sem ele, o sinal.
          // A tela vai em px da janela: é onde o menu abre.
          const rect = app.canvas.getBoundingClientRect()
          fireLongPress(scene.world.toLocal({ x, y }), { x: rect.left + x, y: rect.top + y }, latestRef.current)
        }, SIGNAL_LONG_PRESS_MS)
        longPress = { timer, pointerId, x, y }
      })
      app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
        if (event.pointerType === 'touch') {
          const { state, camera } = fingerMove(scene.touch, event.pointerId, { x: event.global.x, y: event.global.y })
          scene.touch = state
          if (camera !== null) {
            scene.camera = camera
            // applyCamera chama onZoom → paredes e portas refazem a largura de tela, como na roda.
            applyCamera(scene)
          }
          // Durante a pinça nenhum dedo arrasta nada sozinho.
          if (state.pinch !== null) return
        }
        if (
          longPress !== null &&
          event.pointerId === longPress.pointerId &&
          Math.hypot(event.global.x - longPress.x, event.global.y - longPress.y) > SIGNAL_LONG_PRESS_TOLERANCE_PX
        ) {
          cancelLongPress()
        }
        const drag = scene.drag
        if (!drag) {
          // Mouse parado sobre porta: cursor de mão (no celular não existe hover).
          if (latestRef.current.measureArmed || latestRef.current.laserArmed || latestRef.current.destinationArmed || latestRef.current.noteArmed) {
            app.stage.cursor = 'crosshair'
            return
          }
          const overTappable =
            !latestRef.current.signalArmed &&
            (tapTargetAtScreen(scene, event.global.x, event.global.y).kind !== 'map' ||
              markAtScreen(scene, event.global.x, event.global.y) !== null ||
              otherTokenAtScreen(scene, event.global.x, event.global.y) !== null ||
              roomTextAtScreen(scene, event.global.x, event.global.y) !== null)
          app.stage.cursor = overTappable ? 'pointer' : 'default'
          return
        }
        // Outro ponteiro (um dedo que ficou de fora do gesto): não é com este.
        if (event.pointerId !== drag.pointerId) return
        if (drag.kind === 'measure') {
          applyMeasureEvent(scene, { type: 'move', at: measurePointFromScreen(scene.camera, event.global, latestRef.current.map, event.altKey) })
          return
        }
        if (drag.kind === 'laser') {
          pointOwnLaser(event.global.x, event.global.y)
          return
        }
        if (drag.kind === 'pan') {
          // Arrastar o mapa assume a câmera: o degrau dos botões e o recentrar param onde estão (tocar sem arrastar, não).
          scene.zoomAnimation = null
          scene.cameraGlide = null
          scene.camera = panBy(scene.camera, event.global.x - drag.lastX, event.global.y - drag.lastY)
          drag.lastX = event.global.x
          drag.lastY = event.global.y
          applyCamera(scene)
          return
        }
        const world = scene.world.toLocal(event.global)
        // Passo máximo: a ficha para no último ponto do alcance e o dedo segue
        // sozinho; o rótulo conta os quadrados até onde a FICHA está.
        const preview = previewTokenDrag(latestRef.current.map, drag.origin, { x: world.x + drag.offsetX, y: world.y + drag.offsetY })
        drag.x = preview.at.x
        drag.y = preview.at.y
        drag.label = preview.label
        drag.screenLast = { x: event.global.x, y: event.global.y }
        drag.screenX = event.global.x
        drag.screenY = event.global.y
        // Andou mais que a tremida de um toque: a partir daqui a borda rola o mapa (tickEdgeScroll).
        if (!drag.edgeArmed && Math.hypot(drag.screenX - drag.startX, drag.screenY - drag.startY) > SIGNAL_LONG_PRESS_TOLERANCE_PX) {
          drag.edgeArmed = true
        }
        scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(drag.x, drag.y)
        syncTokenDrag(scene)
      })
      const endDrag = () => {
        cancelLongPress()
        const drag = scene.drag
        scene.drag = null
        // Soltou: trajeto, alcance e "N quadrados" somem junto com o gesto.
        syncTokenDrag(scene)
        if (drag?.kind === 'measure') {
          // Solta: a medida fica na tela até o próximo toque ou Escape.
          applyMeasureEvent(scene, { type: 'release' })
          return
        }
        if (drag?.kind === 'laser') {
          endOwnLaser(scene)
          return
        }
        if (drag?.kind === 'pan') {
          // Toque curto e parado: primeiro o pino (desenhado por cima de tudo),
          // depois a porta. Segurar mais que `SIGNAL_LONG_PRESS_MS` já virou
          // sinal de mapa lá em cima e nem chega aqui — abrir o cartão é o
          // toque RÁPIDO, não o demorado. O dedo que sobrou de uma pinça nunca é toque.
          if (!drag.canTap) return
          if (Math.hypot(drag.lastX - drag.startX, drag.lastY - drag.startY) > SIGNAL_LONG_PRESS_TOLERANCE_PX) return
          const target = tapTargetAtScreen(scene, drag.startX, drag.startY)
          if (target.kind === 'pin') {
            latestRef.current.onPinOpen?.(target.pinId)
            return
          }
          // Bilhete depois do pino (o pino é desenhado por cima) e antes da porta.
          const markId = latestRef.current.onMarkOpen === undefined ? null : markAtScreen(scene, drag.startX, drag.startY)
          if (markId !== null) {
            latestRef.current.onMarkOpen?.(markId)
            return
          }
          // A ficha é desenhada por cima da porta e do nome da Sala: vem antes
          // deles — mas com porta sob o dedo, só o miolo da ficha abre o cartão.
          const tokenId = otherTokenAtScreen(scene, drag.startX, drag.startY)
          if (tokenId !== null) {
            latestRef.current.onTokenOpen?.(tokenId)
            return
          }
          if (target.kind === 'door') {
            latestRef.current.onDoorToggle?.(target.doorId)
            return
          }
          // O nome da Sala fica no MEIO dela, longe das portas: a porta vem
          // antes só para o toque na parede nunca virar leitura de texto.
          const roomId = roomTextAtScreen(scene, drag.startX, drag.startY)
          if (roomId !== null) latestRef.current.onRoomOpen?.(roomId)
          return
        }
        if (drag?.kind !== 'token') return
        const token = latestRef.current.map.tokens.find((t) => t.id === drag.tokenId) ?? null
        const release = resolveTokenRelease(
          { startScreen: drag.screenStart, endScreen: drag.screenLast, drop: { x: drag.x, y: drag.y } },
          token,
          pinAtScreen(scene, drag.screenStart.x, drag.screenStart.y),
          SIGNAL_LONG_PRESS_TOLERANCE_PX,
        )
        if (release.kind === 'move') {
          latestRef.current.onMove(drag.tokenId, release.x, release.y)
          // "Câmera segue minha ficha" (Painel): desligado, a câmera fica onde o jogador a deixou.
          if (token !== null && followsOwnToken(latestRef.current.settings)) {
            recenterOnDrop(scene, { x: release.x, y: release.y, radius: tokenRadius(token, latestRef.current.map.grid) })
          }
          return
        }
        // Toque, ou arrasto que não mudou nada: a ficha volta para onde o mapa diz.
        scene.tokenViews.get(drag.tokenId)?.wrapper.position.set(token?.x ?? drag.x, token?.y ?? drag.y)
        if (release.kind === 'openPin') latestRef.current.onPinOpen?.(release.pinId)
      }

      /**
       * Tira o dedo da conta. `true` = a pinça cuidou dele: ela acabou (e o
       * dedo que sobrou segue arrastando a câmera) ou continua com outros
       * dois — nada mais a fazer com este ponteiro.
       */
      const releaseFinger = (pointerId: number): boolean => {
        const up = fingerUp(scene.touch, pointerId, scene.camera)
        scene.touch = up.state
        if (up.pinchEnded) {
          scene.drag = carryPan(up.carry)
          return true
        }
        return up.state.pinch !== null
      }
      const onPointerUp = (event: FederatedPointerEvent) => {
        if (event.pointerType === 'touch' && releaseFinger(event.pointerId)) return
        // Soltou um dedo que não é o dono do gesto em curso: o gesto continua.
        if (scene.drag !== null && scene.drag.pointerId !== event.pointerId) return
        endDrag()
      }
      app.stage.on('pointerup', onPointerUp)
      app.stage.on('pointerupoutside', onPointerUp)
      // O Pixi não repassa `pointercancel` (o sistema tomou o toque): sem isto o
      // dedo ficaria na conta e a ficha meio arrastada. Gesto cancelado acaba
      // sem efeito — nem movimento, nem porta, nem pino.
      const onPointerCancel = (event: PointerEvent) => {
        if (event.pointerType !== 'touch' || releaseFinger(event.pointerId)) return
        if (scene.drag?.pointerId === event.pointerId) abandonDrag()
      }
      app.canvas.addEventListener('pointercancel', onPointerCancel)

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        // A roda assume a câmera: o degrau dos botões e o recentrar param onde estão.
        scene.zoomAnimation = null
        scene.cameraGlide = null
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
        app.canvas.removeEventListener('pointercancel', onPointerCancel)
        cancelLongPress()
        app.ticker.remove(tickZoom)
        app.ticker.remove(tickCameraGlide)
        app.ticker.remove(tickEdgeScroll)
        app.ticker.remove(tickSignals)
        app.ticker.remove(tickDestinations)
        app.ticker.remove(tickPersonalNotes)
        app.ticker.remove(tickLaser)
        app.ticker.remove(tickPlayerLasers)
        app.ticker.remove(tickMeasure)
        app.ticker.remove(tickTokenGlides)
        app.ticker.remove(tickTokenTurns)
        app.ticker.remove(tickPulse)
        app.ticker.remove(tickRevisit)
        // Antes do app.destroy: os gradientes de luz não são filhos da cena.
        scene.lightsRenderer.destroy()
      }
      // ResizePlugin só escuta 'resize' da janela: acompanha o container também.
      resizeObserver = new ResizeObserver(() => {
        if (!destroyed) app.resize()
      })
      resizeObserver.observe(el)

      redraw(scene)
      // O enquadramento pode cair exatamente em 100% (sem `onZoom`): os botões recebem o limite de qualquer jeito.
      reportZoomLimits(scene.camera.scale)
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
  }, [map, vision, explored, concealed, glimpses, hazards, gatilhos, peek, ownTokens, waitingTokens, turnTokenId, settings])

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
    if (!token) return
    // "Minha ficha" e "Centralizar": no meio do que o painel deixa livre, no
    // zoom de agora, e a ficha pulsa para o olho achar onde a câmera foi.
    const viewport = { width: scene.app.screen.width, height: scene.app.screen.height }
    // Com o degrau dos botões andando, centraliza já na escala em que ele ia parar.
    const scale = scene.zoomAnimation?.to ?? scene.camera.scale
    setCameraFromApp(scene, centeredCamera(scale, token, viewport, readObstacles()))
    startOwnerPulse(scene, token.id)
    // Só um pedido novo (focusSeq) move a câmera; snapshot com o token andando não.
  }, [focusSeq])

  const focusPointSeq = focusPoint?.seq ?? null
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || focusPoint === null) return
    // "Minhas notas": a nota no meio do que o painel deixa livre, no zoom de agora — o mesmo enquadramento de "Minha ficha".
    const viewport = { width: scene.app.screen.width, height: scene.app.screen.height }
    const scale = scene.zoomAnimation?.to ?? scene.camera.scale
    setCameraFromApp(scene, centeredCamera(scale, focusPoint, viewport, readObstacles()))
    // Só um pedido novo (seq) move a câmera; re-render com o mesmo pedido não.
  }, [focusPointSeq])

  useEffect(() => {
    // Só um toque novo nos botões (`seq`) dá um degrau; remontar com o mesmo pedido, não.
    if (zoomStep.seq === handledZoomSeqRef.current) return
    handledZoomSeqRef.current = zoomStep.seq
    const scene = sceneRef.current
    if (scene) stepZoom(scene, zoomStep.direction, zoomStep.animate)
  }, [zoomStep])

  useEffect(() => {
    // Desligar (botão de novo ou Escape) apaga a medida; ligar começa sem nenhuma.
    const scene = sceneRef.current
    if (!scene) return
    scene.measure = withMeasureArmed(scene.measure, measureArmed)
    // Desligou no meio do arrasto: o gesto some junto, senão o próximo move reabriria a régua.
    if (!measureArmed && scene.drag?.kind === 'measure') scene.drag = null
    syncMeasure(scene)
  }, [measureArmed])

  useEffect(() => {
    // Desligou (botão de novo ou Escape) com o dedo ainda apertado: o gesto termina ali.
    const scene = sceneRef.current
    if (!scene || laserArmed || scene.drag?.kind !== 'laser') return
    endOwnLaser(scene)
  }, [laserArmed])

  return (
    <>
      <div
        ref={containerRef}
        style={
          mirror
            ? { position: 'absolute', inset: 0, pointerEvents: 'none' }
            : { position: 'fixed', inset: 0, touchAction: 'none', cursor: signalArmed || measureArmed || laserArmed || destinationArmed || noteArmed ? 'crosshair' : undefined }
        }
      />

      {/* Rótulo da régua: escrito pelo gesto direto no DOM (syncMeasure), sem re-render do React por passo do dedo.
          A região viva mora à parte e nasce montada, para a PRIMEIRA medida já ser anunciada. */}
      <PlayerMeasureLabel labelRef={measureLabelRef} announcerRef={measureAnnouncerRef} />
      {/* "N quadrados" do arrasto da própria ficha: mesmo rótulo do Medir, escrito por syncTokenDrag.
          Sem `aria-live`: o arrasto da ficha não gruda na grade, e anunciar cada décimo de quadrado enfileiraria dezenas de falas. */}
      <div ref={tokenDragLabelRef} className="pp-measure-label" data-testid="token-drag-label" hidden />
      {/* MAPA LEMBRADO: "Mudou desde a sua última visita" junto ao trecho que pisca; escrito por startRevisitPulse.
          `aria-live` educado: é um aviso por volta ao trecho, não um fluxo contínuo. */}
      <div ref={revisitNoteRef} className="pp-measure-label pp-revisit-note" data-testid="revisit-note" aria-live="polite" aria-atomic="true" hidden />
    </>
  )
}
