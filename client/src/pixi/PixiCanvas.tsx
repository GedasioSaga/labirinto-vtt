import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import { currentRendererResolution, watchDevicePixelRatio } from './rendererResolution'
import type { MapData, Pin, Region, Wall } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { useMapStore } from '../stores/mapStore'
import { pinTravelOf, unlinkedTravelPinIds, useAdventureStore } from '../stores/adventureStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { useFollowStore, type CameraOrigin } from '../stores/followStore'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { subscribeToBackgroundRedraw } from '../stores/backgroundSubscription'
import { panBy, zoomAt, constrainToAngleStep, angleDegrees, contentBounds, fitCamera, freeAreaCenter, type Bounds, type Camera, type Point } from './world'
import { resolveCursor, type HoverKind, type ResizeCorner } from './cursorPolicy'
import { resolveMapWheel } from './wheelGesture'
import { resolveShortcut, type ShortcutEvent } from '../lib/keymap'
import { ROOM_CIRCLE_SIDES } from '../lib/roomCircle'
// Onda 2, item 15 (Frente B) — hit-test + desenho do anel de hover.
import { resolveHoverHit, type HoverHit, type HoverTarget } from '../lib/hoverHitTest'
import { drawHover } from './drawHover'
// Onda 2, item 16 (Frente C) — número ao vivo durante o arrasto de forma.
import { dimensionLabel, type DimensionDraft } from '../lib/dimensionText'
import { createDimensionLabelRenderer } from './drawDimensionLabel'
// Onda 2, item 14 (Frente E) — Shift trava proporção em rect/room/ellipse.
import { constrainDraft } from '../lib/shapeConstraint'
import type { SnapTargetKind } from './grid'
import { drawGrid } from './drawGrid'
import { computeVisibleHexCenters } from './hexGrid'
import { drawHexGrid } from './drawHexGrid'
import { computeVisibleTriEdges } from './triGrid'
import { drawTriGrid } from './drawTriGrid'
import { computeAlignedGridLines, type GridAlignResult } from '../lib/gridAlign'
import { drawGridAlignOverlay } from './drawGridAlignOverlay'
import { isHidden, canInteract } from '../lib/itemTransform'
import { drawWalls } from './drawWalls'
import { drawDoors } from './drawDoors'
import { drawStairs } from './drawStairs'
import { createLightsRenderer } from './drawLights'
import { visionSegments, type Segment } from '../lib/visibility'
import { createRegionsRenderer, resolveHighlightedRegionId } from './drawRegions'
import { createRoomNamesRenderer, findRoomLabelAt, roomLabelAnchor, roomLabelFontSize, roomLabelPosition } from './drawRoomNames'
import { createFloorRenderer, drawBlocosDraft, drawFloorDraft } from './drawFloor'
import { drawMapLines, drawMapMarkers } from './drawMapLines'
import { drawMapFrame } from './drawMapFrame'
import { createDebouncedTask, syncWorldTextResolution } from './textResolution'
import { pixelGrid, snapToPhysicalPixel } from './pixelAlign'
import { buildFloorMask } from './floorMask'
import { layoutMapFrame } from '../lib/mapFrame'
import { hexToRgb, rasterizeMinimap } from '../lib/minimapRaster'
import { compileFloor } from '../lib/floorSdf'

/** Subamostras por eixo do render fiel: 4×4 é o que reproduz o antisserrilhado dos mapas de referência. */
const MINIMAP_RASTER_SAMPLES = 4
import type { FloorPiece, MapFrame } from '../types/map'
import {
  AVISO_BORRACHA_NAO_APAGA_CHAO,
  baldeNoPonto,
  buildCorridorShape,
  buildFloorPiece,
  buildFloorShapeFromDrag,
  clampFloorPolygonSides,
  corridorDraftOnShapeChange,
  findFloorPieceAt,
  isFloorDragShape,
  pincelDeBlocosApaga,
} from '../lib/floorTool'
import { blocosDoTraco, buildBlocosShape, chaveDoBloco, type Bloco } from '../lib/floorBlocks'

/** Referência estável: camada oculta não força recalcular o contorno a cada redraw. */
const EMPTY_FLOOR: FloorPiece[] = []
/** Grade FORA do piso no editor: bem apagada e clara. A cor do usuário (escura,
 *  feita para aparecer sobre o chão) some no fundo 0x2b2b2b. */
const OUTSIDE_FLOOR_GRID_COLOR = 0xd8d8d8
const OUTSIDE_FLOOR_GRID_ALPHA = 0.08
// Onda 3, item 21 (Frente E) — moldura do mapa (contorno + sombra fora dela).
import { drawMapBounds } from './drawMapBounds'
import { createTokensRenderer } from './tokensRenderer'
import { createSignalsRenderer } from './drawSignals'
import { useSignalStore } from '../stores/signalStore'
import { createLaserRenderer } from './drawLaser'
import { isLaserArmed, useLaserStore } from '../stores/laserStore'
import { createLaserGesture } from './laserGesture'
import { LASER_KEY_TAP_MS, isLaserKey } from '../lib/laser'
import { createMeasurementIndicatorRenderer } from './drawMeasurementIndicator'
import {
  drawWallDraft,
  drawStairDraft,
  drawRegionDraft,
  drawFreehandDraft,
  drawLineDraft,
  drawCircleDraft,
  drawRectDraft,
  drawEllipseDraft,
  drawPolygonDraft,
  drawPathDraft,
  drawCurveDraft,
  drawRoomDraft,
  drawRegularPolygonDraft,
  drawLightDraft,
} from './drawDraft'
import { snapPointForTarget } from './tokenInteraction'
import { seatTokenCenter, tokenSizeInSquares } from '../lib/tokenSize'
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
  isValidRectDraft,
  buildRectDrawing,
  isValidEllipseDraft,
  buildEllipseDrawing,
  isValidPolygonDraft,
  buildPolygonDrawing,
  isValidPathDraft,
  buildPathDrawing,
  isValidCurveDraft,
  buildCurveDrawing,
  buildTextDrawing,
  isValidRoomDraft,
  buildRoomFromDraft,
  isValidRegularPolygonDraft,
  buildRegularPolygonRoomFromDraft,
  normalizeDraftPolygonPoints,
  isValidFreeRoomDraft,
  buildFreeRoomFromPoints,
} from '../lib/drawingFactory'
import { createPropsRenderer } from './drawProps'
import { createConcealZonesRenderer } from './drawConcealZones'
import { createPinsRenderer } from './drawPins'
import { findConcealZoneAt } from '../lib/concealZones'
import { findPinAt, pinKindAfterShortcut } from '../lib/pins'
import { buildConcealZoneFromDraft, buildPin, nextTokenName } from '../lib/mapFactory'
import { SECRET_ITEM_ALPHA } from './constants'
import { createTextLabelsRenderer } from './drawTextLabels'
import { createAngleIndicatorRenderer } from './drawAngleIndicator'
import { subscribeToPropsRedraw } from '../stores/propsSubscription'
import { pickImageFile, importPropImage } from '../lib/imageImport'
import { mapDirFor } from '../lib/mapFileIO'
import {
  findSelectableAt, findCurveControlPointAt, findWallAt, findNearestExistingVertex, findLockedLayerAt,
  type SelectableHit,
} from '../lib/selectionHitTest'
import type { SelectionKind } from '../types/tools'
import { drawDrawings } from './drawDrawings'
import { drawEditHandles, findLightRadiusHandleAt, circleDrawingRadiusHandle } from './drawEditHandles'
import { regionEdgeMidpoints } from '../lib/roomLink'
import { computeAlignment, mapBoundsCandidates } from '../lib/alignmentGuides'
import { drawGuides } from './drawGuides'
// Onda 3, item 13 (Frente A) — clonagem pura por tipo de entidade, usada só
// pelo Alt+arrastar (Ctrl+D chama `duplicateSelected`, que já embute a
// clonagem dentro da store — ver mapStore.ts).
import { cloneEntity, type CloneableEntity } from '../lib/entityClone'
import { placeNewRoom, subtreeIds } from '../lib/roomNesting'
import { useToastStore } from '../stores/toastStore'
import { CORRIDOR_DISCARDED_TEXT, STAIR_CLICK_WITHOUT_DRAG_TEXT } from '../components/labels'
import {
  visibleWalls, visibleRegions, visibleStairs, visibleLights, visibleDrawings, visibleTokens, visibleProps, visiblePins,
  canInteractInLayer, isLayerLocked, wallLayer, regionLayer, stairLayer, lightLayer, tokenLayer, propLayer, drawingLayer,
  LAYER_LABELS,
} from '../lib/layers'
import { isValidStairDraft, buildStairFromDraft, stairStepWidthForPreset } from '../lib/stairs'
// `eraseDecisionForRegion` saiu da lista de propósito: a borracha "Só uma
// parte" decide Região/Sala por `circleTouchesRegionOutline` (contorno, não
// interior — ver a docstring de `eraseAt`). A função segue exportada e testada
// em lib/eraseGeometry.ts para quem precise da leitura "contido conta".
import { eraseDecisionForWall, eraseDecisionForStair, eraseDecisionForToken, eraseDecisionForProp } from '../lib/eraseGeometry'
import { findRoomCornerAt, isAxisAlignedRect, rectFromCorners, type RoomCorner } from '../lib/roomOps'
import { createRoomRotateGesture } from './roomRotateGesture'
import { measureDistance } from '../lib/measurement'
import { rotuloDeQuadradosAndados } from '../lib/tokenDragDistance'
import { tokenRadiusOf } from '../lib/doorReach'
// Integrador I8 (F4): B3 "mover e redimensionar" — geometria de bounding-box
// pra resize por canto de Drawing rect/ellipse/polygon, Token e Prop.
import { findBoxCornerAt, drawingBoundingBox, tokenBoundingBox, propBoundingBox, resizeTokenSize, type Corner } from '../lib/objectTransform'
// N3 "ferramenta de seleção de área" — geometria pura de marquee + mover grupo.
import { selectEntitiesInArea, areaSelectionBounds, classifyMarqueeGesture, type AreaRect } from '../lib/areaSelection'
import { drawSelectionMarquee, drawAreaSelectionOutline, createMarqueeHintRenderer } from './drawSelectionMarquee'
// Onda 4, item 24 — modelo canônico de seleção (lib/selectionModel.ts).
// `useMapStore.getState().selection` agora é um SelectionSet (conjunto);
// estes helpers convertem na borda pros consumidores que só entendem "um
// item" (drawEditHandles, resolveHoverHit, resolveHighlightedRegionId — os
// três fora da minha lista de arquivos) ou "grupo por campo plural"
// (areaSelectionBounds, moveAreaSelection — de lib/areaSelection.ts, também
// fora da minha lista, CONTRATO diz "nenhuma mudança de assinatura").
import {
  EMPTY_SELECTION, selectionOfItem, selectionSingle, selectionFromItems, toggleSelectionItem,
  selectionToAreaSelection, selectionFromAreaSelection, isSelectionEmpty, selectionHas,
  type SelectionItem, type SelectionSet,
} from '../lib/selectionModel'
import { expandToGroup, NO_GROUPS } from '../lib/itemGroups'

// Fase 5, N1 "borracha: apagar parte" — raio do círculo de corte, como fração
// do grid do mapa (não px fixo: assim escala com mapas de grid diferente,
// mesma filosofia de STAIR_SIZE_PRESET_RATIO em lib/stairs.ts). Decisão de UX
// do integrador — a geometria pura (lib/eraseGeometry.ts) recebe qualquer
// raio, não tem opinião sobre o valor.
const ERASE_PART_RADIUS_RATIO = 0.25


// Largura padrão do corredor de chão, como fração do grid: meia célula lê
// como passagem sem engolir a sala ao lado, e escala com grids diferentes.
const FLOOR_CORRIDOR_WIDTH_RATIO = 0.5

// Abaixo disso (em unidades de mundo) o pointerup da ferramenta "Luz" trata
// como clique simples (sem arrasto de verdade) e usa o raio padrao do grid,
// em vez do raio arrastado — evita que um micro-tremor do mouse vire luz
// minuscula sem querer.
const LIGHT_CLICK_THRESHOLD = 5

// Ferramenta Região: abaixo disto (px de mundo, do ponto bruto do pointerdown
// ao do pointerup) o gesto é um CLIQUE — mais um ponto do traçado ponto a
// ponto. Acima, é um ARRASTO e vira um retângulo inteiro, como Sala e Chão.
// Mesmo valor e mesma razão do LIGHT_CLICK_THRESHOLD acima: um micro-tremor
// de mão não pode mudar o significado do gesto.
const REGION_DRAG_THRESHOLD = 5

// Folga (px de mundo) para pegar o token JÁ selecionado errando por pouco.
// Passeio cego de 16/09/2026: pressionar poucos px fora do token virava
// arrasto da VISTA e ainda limpava a seleção — o castigo por errar a mira era
// perder de vista o que se estava fazendo. Dentro desta folga o gesto é o que
// a pessoa quis: arrastar o token que está destacado na tela.
const SELECTED_TOKEN_GRAB_SLOP = 8

// Respiro (px de mundo) entre a borda do disco e o número de quadrados do
// arrasto. Medido na tela: com menos que isso o texto encosta no anel de
// seleção e deixa de ser legível; com muito mais ele desgruda da ficha e a
// pessoa precisa procurar o número em vez de ler de canto de olho.
const FOLGA_DO_ROTULO_DE_QUADRADOS = 12

/**
 * Nome em PT-BR de cada tipo de item, para o aviso de apagar dizer O QUE
 * sumiu em vez de "1 item". Mesmos nomes que a pessoa já lê no painel
 * ("Parede" em `WallStyleControls`, "Escada" em `StairControls`, "Região" em
 * `RegionStyleControls`) e na lista de camadas (`LAYER_LABELS`, `lib/layers.ts`)
 * — o aviso não pode inventar um vocabulário terceiro.
 *
 * `feminino` existe por causa da concordância: sem ele o aviso sairia "Parede
 * apagado". `Record<SelectionKind, …>` é exaustivo por construção — tipo novo
 * de seleção sem rótulo aqui não compila.
 */
const ENTITY_LABELS: Record<SelectionKind, EntityLabel> = {
  wall: { um: 'parede', varios: 'paredes', feminino: true },
  region: { um: 'região', varios: 'regiões', feminino: true },
  stair: { um: 'escada', varios: 'escadas', feminino: true },
  light: { um: 'luz', varios: 'luzes', feminino: true },
  token: { um: 'token', varios: 'tokens', feminino: false },
  prop: { um: 'objeto', varios: 'objetos', feminino: false },
  drawing: { um: 'desenho', varios: 'desenhos', feminino: false },
  floor: { um: 'pedaço de chão', varios: 'pedaços de chão', feminino: false },
}

interface EntityLabel {
  um: string
  varios: string
  feminino: boolean
}

/** Sala é uma `Region` COM `room` (`types/map.ts`), e quem a apagou leu "Sala"
 *  no painel, não "Região". A distinção só existe olhando o mapa, por isso
 *  mora aqui e não na tabela acima, que é indexada só por `SelectionKind`. */
const SALA_LABEL: EntityLabel = { um: 'sala', varios: 'salas', feminino: true }

function entityLabel(map: MapData, item: { kind: SelectionKind; id: string }): EntityLabel {
  if (item.kind === 'region' && map.regions.some((region) => region.id === item.id && region.room)) return SALA_LABEL
  return ENTITY_LABELS[item.kind]
}

const capitalize = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * Frase do aviso de apagar, NOMEANDO o que sumiu — "1 item apagado" não diz
 * nada a quem acabou de varrer o mapa com Ctrl+A. Três casos, que são os que
 * acontecem de verdade: um item ("Sala apagada"), N do mesmo tipo ("3 paredes
 * apagadas") e mistura ("12 itens apagados: 5 paredes, 4 salas, 3 tokens").
 *
 * Recebe o mapa de ANTES da remoção — depois dela os ids já não existem e não
 * há como saber se aquela região era uma Sala. Seleção vazia devolve `null`:
 * não houve nada para apagar, e aviso nenhum deve aparecer.
 */
function describeDeletion(map: MapData, selection: readonly { kind: SelectionKind; id: string }[]): string | null {
  if (selection.length === 0) return null

  // Chave = o rótulo singular: é o que distingue Sala de Região, e duas
  // entradas da tabela nunca compartilham singular.
  const porRotulo = new Map<string, { label: EntityLabel; total: number }>()
  for (const item of selection) {
    const label = entityLabel(map, item)
    const atual = porRotulo.get(label.um)
    if (atual) atual.total += 1
    else porRotulo.set(label.um, { label, total: 1 })
  }

  const grupos = [...porRotulo.values()]
  const frase = ({ label, total }: { label: EntityLabel; total: number }) =>
    total === 1 ? `1 ${label.um}` : `${total} ${label.varios}`
  const apagado = (label: EntityLabel, total: number) => `apagad${label.feminino ? 'a' : 'o'}${total === 1 ? '' : 's'}`

  if (grupos.length === 1) {
    const grupo = grupos[0]
    const alvo = grupo.total === 1 ? grupo.label.um : `${grupo.total} ${grupo.label.varios}`
    return capitalize(`${alvo} ${apagado(grupo.label, grupo.total)}`)
  }

  // Mistura: o total vem primeiro (é a informação que assusta) e a quebra
  // depois, do tipo mais numeroso para o menos — empate mantém a ordem em que
  // o tipo apareceu na seleção, para a frase não dançar entre dois gestos iguais.
  const detalhe = grupos
    .slice()
    .sort((a, b) => b.total - a.total)
    .map(frase)
    .join(', ')
  return `${selection.length} itens apagados: ${detalhe}`
}

// Tolerância (em pixels de mundo) do "ímã" de vértice ao desenhar Parede ou
// Linha: se o ponto inicial ou final do arrasto cai dentro deste raio de um
// vértice já existente (ponta de outra parede, vértice de região, ponta de
// outra linha/curva — ver findNearestExistingVertex), gruda EXATAMENTE nesse
// vértice em vez de ficar solto perto dele. Mesmo valor usado como default
// em findNearestExistingVertex; repetido aqui só para o call site ficar
// explícito sobre qual tolerância está em jogo.
const VERTEX_MAGNET_TOLERANCE = 12

/** Folga de clique do pino, em px de TELA — o alvo do dedo não encolhe com o zoom. */
const PIN_TAP_TOLERANCE_PX = 6

/**
 * Pino de viagem com a Selecionar: até esta distância (px de TELA) entre
 * apertar e soltar, o gesto é CLIQUE e atravessa a passagem; passou disso, é
 * arrasto e move o pino. O mesmo limiar do arrasto de Região: a mão treme um
 * pouco no clique, e esse tremor não pode virar "mover o pino 2 px".
 */
const TRAVEL_CLICK_SLOP_PX = REGION_DRAG_THRESHOLD

/**
 * Traçado ponto a ponto — quanto tempo pode passar entre SOLTAR um toque e
 * APERTAR o seguinte para os dois ainda contarem como "duplo clique".
 *
 * O evento `dblclick` do navegador tem janela FIXA de ~500 ms e não consulta o
 * sistema operacional. No Windows a velocidade do duplo clique é uma régua do
 * usuário, de ~200 ms a ~900 ms: quem a deixou lenta — ou quem simplesmente
 * mira com calma no último vértice antes de bater de novo — batia dois toques
 * que o Windows chama de duplo clique, o Chromium não, e a forma não fechava
 * (passeio de 20/09/2026; medido de novo em 21/09/2026 com 700 ms). 900 ms é o
 * TETO dessa régua: é o gesto mais lento que o próprio sistema ainda chama de
 * duplo clique, e nada além disso — dois cliques mais espaçados continuam
 * sendo dois vértices, como sempre foram.
 *
 * A janela é medida do `pointerup` do primeiro toque ao `pointerdown` do
 * segundo, isto é, a PAUSA entre os toques. Quanto tempo o dedo ficou no botão
 * é outra coisa: quem mira com calma segura mais, e isso não transforma o
 * gesto em dois cliques separados.
 */
const FECHAMENTO_DOIS_TOQUES_JANELA_MS = 900

/**
 * E os dois toques precisam cair no MESMO lugar, em px de TELA. Sem isto,
 * dois vértices cravados em sequência rápida — o gesto normal de quem desenha
 * — fechariam a forma sozinhos. 8 px é o dobro da folga que o Windows dá ao
 * duplo clique (`SM_CXDOUBLECLK`, 4 px por padrão) e continua muito menor que
 * a distância entre dois cantos que alguém quis desenhar de propósito.
 *
 * Em px de tela, e não de mundo, de propósito: a folga é da MÃO, e a mão não
 * fica mais firme porque o mapa está com zoom afastado.
 */
const FECHAMENTO_DOIS_TOQUES_TOLERANCIA_PX = 8

// Rótulo do indicador de ângulo durante o arrasto de Parede/Linha. Travado
// (Ctrl segurado) sempre cai num múltiplo exato de stepDegrees — arredondar
// pro inteiro mais próximo só limpa erro de ponto flutuante (ex.: 89.9999999
// vira "90°"), não perde precisão real. Livre (sem Ctrl) mostra 1 casa
// decimal (ex.: "87.3°") pra deixar claro que não está travado num valor exato.
/**
 * O que `resolveShortcut` precisa saber de ONDE a tecla caiu: a tag e, num
 * INPUT, o tipo — interruptor e rádio não recebem texto, então a letra
 * continua sendo atalho com o foco neles (achado 10 do passeio de 20/09/2026).
 * `instanceof` em vez de cast: o alvo de um `keydown` de `window` pode ser o
 * próprio `document` ou a janela, que não têm tag.
 */
function alvoDoAtalho(target: EventTarget | null): Pick<ShortcutEvent, 'targetTagName' | 'targetInputType' | 'targetContentEditable'> {
  if (!(target instanceof HTMLElement)) return { targetTagName: '' }
  return {
    targetTagName: target.tagName,
    targetInputType: target instanceof HTMLInputElement ? target.type : undefined,
    targetContentEditable: target.isContentEditable,
  }
}

function formatAngleLabel(degrees: number, locked: boolean): string {
  return locked ? `${Math.round(degrees)}°` : `${degrees.toFixed(1)}°`
}

interface PixiCanvasProps {
  /**
   * Prévia AO VIVO (ainda não aplicada) de "Alinhar grade à imagem" (F3,
   * agente C5 — `GridAlignControls.onPreviewChange`). `null`/ausente esconde
   * o overlay. Muda a cada tecla digitada em Colunas/Linhas — só o overlay
   * (`drawGridAlignOverlay`, cor ciano) reage a isto; a grade REAL só muda
   * quando o usuário clica "Aplicar" (`setGridCellSize`/`setGridOffset`, que
   * chegam por `map.grid`/`map.gridOffset`, não por esta prop).
   */
  gridAlignPreview?: GridAlignResult | null
  /**
   * Reporta as dimensões NATURAIS (px) da textura de fundo carregada, depois
   * que `redrawBackground` resolve `Assets.load` — `null` sem fundo de
   * imagem ou em erro de carga. Consumido por `GridAlignControls` (via
   * `App.tsx`) para derivar `cellSize` a partir de colunas/linhas contadas
   * na imagem — sem isto o painel nunca sai do estado vazio.
   */
  onBackgroundImageSizeChange?: (size: { width: number; height: number } | null) => void
  /**
   * Onda 1, item 10 (HUD de zoom, Frente E) — notifica a câmera a cada
   * mudança (pan/zoom/roda/atalho/fit), pra `App.tsx` repassar o `scale` pro
   * `<ZoomHud>`. Chamado uma vez já no mount, com o valor inicial.
   */
  onCameraChange?: (camera: Camera) => void
  /**
   * Pedido de "resetar zoom para 100%" vindo de FORA da closure (clique no
   * `<ZoomHud>`, `App.tsx`) — muda de valor a cada clique (contador
   * incremental). Mesmo padrão de ponte que `gridAlignOverlayRedrawRef`
   * abaixo: um `useEffect` ligado a este valor dispara a ação dentro do
   * `useEffect` de `[]` que já roda a state machine de gesto. Primeiro mount
   * não dispara nada (mesmo padrão que a ponte de `gridAlignPreview` já usa).
   */
  resetZoomRequest?: number
  /**
   * Pedido de câmera vindo da troca de cena (`stores/adventureStore.ts`):
   * `camera` volta à vista que a cena tinha; `null` enquadra o conteúdo, como
   * na abertura do mapa. Cada troca é um objeto novo — a ponte reage à
   * identidade, no molde de `resetZoomRequest`, sem remontar o canvas.
   * `focus` (chegada por pino de viagem) põe esse ponto do mundo no centro da
   * tela, no zoom de `camera` ou no de agora.
   */
  cameraRequest?: { camera: Camera | null; focus?: Point } | null
  /**
   * Painéis flutuantes sobre o canvas (rail, barra de ferramentas), em px
   * relativos ao canvas, lidos na hora do `focus`: o ponto vai ao centro da
   * parte que eles não cobrem (`freeAreaCenter`), e não para baixo da barra.
   */
  focusObstacles?: () => Bounds[]
  /**
   * Clique (sem arrasto) num pino de VIAGEM com a ferramenta Selecionar: o App
   * leva a visão do mestre pela passagem. Com a ferramenta Pino o mesmo clique
   * só abre o painel, como em todo pino.
   */
  onTravelPin?: (pinId: string) => void
  /**
   * A3 — chamada quando Sala, Sala Circular ou Polígono Regular termina de ser
   * desenhada (a região já está no mapa e selecionada). O nome é pedido aqui
   * mesmo, num campo sobre a Sala; o App só troca o rail para a aba Mapa.
   */
  onRoomCreated?: (regionId: string) => void
  /**
   * Ferramenta Token: clique no mapa, nome confirmado no campo sobre o ponto.
   * O App cria o token pelo mesmo caminho do botão "Adicionar token".
   */
  onPlaceToken?: (name: string, at: Point) => void
  /**
   * B2 — posição de mundo do ponteiro sobre o canvas, a cada movimento, só
   * enquanto o laser está ligado (L segurado ou botão Laser). O App repassa
   * ao hostBridge, que faz o throttle.
   */
  onLaserMove?: (x: number, y: number) => void
}

/**
 * Campo de nome sobre o canvas: nome de Sala (duplo clique na Sala ou no
 * rótulo, ou Sala recém-desenhada) ou nome de um token novo (ferramenta Token).
 */
type NameEditorState = { kind: 'room'; regionId: string; value: string } | { kind: 'token'; at: Point; value: string }

const MIN_ROOM_NAME_EDITOR_FONT = 12

/** Retângulo que cobre qualquer mapa: Ctrl+A reusa o filtro da seleção por área. */
const SELECT_ALL_RECT: AreaRect = { x1: -1e9, y1: -1e9, x2: 1e9, y2: 1e9 }

export function PixiCanvas({
  gridAlignPreview = null,
  onBackgroundImageSizeChange,
  onCameraChange,
  resetZoomRequest,
  cameraRequest = null,
  onRoomCreated,
  onPlaceToken,
  onLaserMove,
  onTravelPin,
  focusObstacles,
}: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onLaserMoveRef = useRef(onLaserMove)
  useEffect(() => {
    onLaserMoveRef.current = onLaserMove
  }, [onLaserMove])
  const onTravelPinRef = useRef(onTravelPin)
  useEffect(() => {
    onTravelPinRef.current = onTravelPin
  }, [onTravelPin])
  const focusObstaclesRef = useRef(focusObstacles)
  useEffect(() => {
    focusObstaclesRef.current = focusObstacles
  }, [focusObstacles])
  // Mesma ponte de ref das outras props: o setup roda uma vez só e precisa
  // enxergar sempre a callback mais recente do App.
  const onRoomCreatedRef = useRef(onRoomCreated)
  useEffect(() => {
    onRoomCreatedRef.current = onRoomCreated
  }, [onRoomCreated])

  const onPlaceTokenRef = useRef(onPlaceToken)
  useEffect(() => {
    onPlaceTokenRef.current = onPlaceToken
  }, [onPlaceToken])

  const [nameEditor, setNameEditor] = useState<NameEditorState | null>(null)
  // Enter e Esc desmontam o campo, e o navegador pode disparar blur depois;
  // sem esta trava o blur gravaria o nome que o Esc acabou de cancelar.
  const nameEditorOpenRef = useRef(false)
  const editorCamera = useMapStore((state) => (nameEditor ? state.camera : null))
  const editorRegion = useMapStore((state) =>
    nameEditor?.kind === 'room' ? state.map.regions.find((r) => r.id === nameEditor.regionId) ?? null : null,
  )
  const editorGrid = useMapStore((state) => state.map.grid)

  // Só usa ref e setter estáveis: o setup() do Pixi, que roda uma vez, pode chamar.
  const openNameEditor = (next: NameEditorState) => {
    nameEditorOpenRef.current = true
    setNameEditor(next)
  }

  const closeNameEditor = (commit: boolean) => {
    if (!nameEditorOpenRef.current || !nameEditor) return
    nameEditorOpenRef.current = false
    if (commit && nameEditor.kind === 'room' && editorRegion?.room && editorRegion.room.name !== nameEditor.value) {
      useMapStore.getState().setRoomName(nameEditor.regionId, nameEditor.value)
    }
    if (commit && nameEditor.kind === 'token') {
      // Mesmo contrato do "Adicionar token": nome vazio vira o nome sugerido.
      const name = nameEditor.value.trim()
      onPlaceTokenRef.current?.(name === '' ? nextTokenName(useMapStore.getState().map.tokens) : name, nameEditor.at)
    }
    setNameEditor(null)
  }
  // Ponte entre a prop `gridAlignPreview` (muda a cada render) e o redraw que
  // vive DENTRO do `setup()` assíncrono do efeito abaixo (`[]` de
  // dependência, roda uma vez só) — mesmo problema que motiva
  // `redrawTokens`/`redrawShapes` serem funções fechadas sobre `useMapStore`
  // em vez de props: aqui a fonte é uma prop, não a store, então a ponte é
  // um ref em vez de uma subscription. `null` até o `setup()` terminar.
  const gridAlignOverlayRedrawRef = useRef<((draft: GridAlignResult | null) => void) | null>(null)
  // Mesma ponte, para o pedido de "resetar zoom" vindo de fora (ZoomHud/
  // Ctrl+0 em App.tsx) — ver docstring de `resetZoomRequest` acima.
  const resetZoomRequestRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    gridAlignOverlayRedrawRef.current?.(gridAlignPreview)
  }, [gridAlignPreview])

  useEffect(() => {
    if (resetZoomRequest !== undefined) resetZoomRequestRef.current?.()
  }, [resetZoomRequest])

  // Mesma ponte, para a câmera de cada cena. Pedido que chega antes do
  // `setup()` terminar é descartado: a montagem já enquadra o mapa aberto.
  const cameraRequestRef = useRef<((request: { camera: Camera | null; focus?: Point }) => void) | null>(null)
  useEffect(() => {
    if (cameraRequest !== null) cameraRequestRef.current?.(cameraRequest)
  }, [cameraRequest])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let destroyed = false
    let initialized = false
    const app = new Application()

    const setup = async () => {
      // Densidade do monitor (125%/150%): o backbuffer tem pixels físicos e o
      // canvas fica no tamanho CSS; event.global e app.screen seguem em px CSS.
      await app.init({
        backgroundColor: 0x2b2b2b,
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
      // B1 — sinais dos jogadores em espaço de tela, acima de todo o mundo.
      const signalsLayer = new Container()
      signalsLayer.eventMode = 'none'
      app.stage.addChild(world, signalsLayer)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      const backgroundSprite = new Sprite(Texture.EMPTY)
      // Onda 3, item 21 (Frente E) — moldura do mapa. Fica atrás da grade e
      // do conteúdo, na frente só do fundo (mesma ordem do CONTRATO).
      const mapBoundsGraphics = new Graphics()
      // Grade acima do chão e das salas, abaixo de paredes e portas. Uma só
      // geometria (branca) em dois Graphics com tint próprio: dentro do piso na
      // cor do usuário, fora dele bem apagada. Sem piso nenhum, a grade vai inteira.
      const gridGraphics = new Graphics()
      const gridOutsideGraphics = new Graphics(gridGraphics.context)
      const gridFloorMask = new Graphics()
      const gridOutsideMask = new Graphics(gridFloorMask.context)
      gridOutsideGraphics.visible = false
      let gridHasFloor = false
      const gridAlignOverlayGraphics = new Graphics()
      const floorGraphics = new Graphics()
      // Traços e portas de minimapa (MapData.lines/markers) por cima do chão; moldura atrás de tudo do mapa.
      const mapLinesGraphics = new Graphics()
      const mapFrameContainer = new Container()
      // Render fiel (FloorStyle.renderMode === 'raster'): conteúdo do mapa rasterizado por software.
      const mapRasterSprite = new Sprite(Texture.EMPTY)
      const regionsContainer = new Container()
      // Nomes das salas acima de paredes, portas e escadas: abaixo delas a
      // parede interna cortava o nome ao meio (medido 15/09/2026).
      const roomNamesContainer = new Container()
      const wallsGraphics = new Graphics()
      const doorsGraphics = new Graphics()
      const stairsGraphics = new Graphics()
      // A5 — escadas e desenhos "Oculto para jogadores": mesmo desenho num
      // Graphics esmaecido, em vez de passar alpha por cada traço do renderer.
      const secretStairsGraphics = new Graphics()
      secretStairsGraphics.alpha = SECRET_ITEM_ALPHA
      const drawingsGraphics = new Graphics()
      const secretDrawingsGraphics = new Graphics()
      secretDrawingsGraphics.alpha = SECRET_ITEM_ALPHA
      const textLabelsContainer = new Container()
      const propsContainer = new Container()
      // Container, não Graphics: cada luz tem o halo em um objeto próprio para
      // receber a máscara do recorte por parede (drawLights.ts).
      const lightsContainer = new Container()
      const tokensContainer = new Container()
      // A5 — zonas ocultas por cima do conteúdo: o mestre precisa ver o que cobre.
      const concealZonesContainer = new Container()
      // Pinos acima das zonas ocultas: o pino é o chamariz da cena e o mestre
      // precisa achá-lo mesmo sobre uma área que ele mesmo escondeu.
      const pinsContainer = new Container()
      const handlesGraphics = new Graphics()
      // Destaque da peça de chão selecionada. Graphics próprio, acima do
      // conteúdo: o chão em si fica atrás de Regiões/paredes e esconderia o contorno.
      const floorSelectionGraphics = new Graphics()
      // Onda 2, item 15 (Frente B) — anel de hover, entre "já selecionado"
      // (handlesGraphics) e o draft ativo, mesma ordem do CONTRATO da frente.
      const hoverGraphics = new Graphics()
      const draftGraphics = new Graphics()
      const angleIndicatorContainer = new Container()
      const guidesGraphics = new Graphics()
      // N3 "ferramenta de seleção de área": contorno sólido do grupo já
      // fechado (segue o mapa, redesenhado junto de redrawShapes) e o
      // marquee tracejado vivo durante o arrasto (desenhado direto no
      // pointermove, como os demais draftGraphics deste diretório).
      const areaSelectionOutlineGraphics = new Graphics()
      const areaMarqueeGraphics = new Graphics()
      world.addChild(
        backgroundSprite,
        mapBoundsGraphics,
        mapFrameContainer,
        mapRasterSprite,
        floorGraphics,
        mapLinesGraphics,
        regionsContainer,
        gridFloorMask,
        gridOutsideMask,
        gridOutsideGraphics,
        gridGraphics,
        gridAlignOverlayGraphics,
        wallsGraphics,
        doorsGraphics,
        stairsGraphics,
        secretStairsGraphics,
        roomNamesContainer,
        drawingsGraphics,
        secretDrawingsGraphics,
        textLabelsContainer,
        propsContainer,
        lightsContainer,
        tokensContainer,
        concealZonesContainer,
        pinsContainer,
        floorSelectionGraphics,
        handlesGraphics,
        hoverGraphics,
        areaSelectionOutlineGraphics,
        draftGraphics,
        areaMarqueeGraphics,
        angleIndicatorContainer,
        guidesGraphics,
      )
      // 17/09/2026 — arrastar no vazio virou marquee (era pan). A dica que
      // conta por onde o pan foi mora DENTRO do retângulo em curso; entra no
      // `world` DEPOIS de todas as camadas acima, por cima de todas elas, que
      // é o lugar de uma dica.
      const marqueeHint = createMarqueeHintRenderer(world)

      let camera: Camera = useMapStore.getState().camera
      // `world` sempre em pixel físico inteiro: o alinhamento dos traços finos
      // (pixelAlign.ts) passa a depender só do zoom, não do pan.
      const positionWorld = () => {
        const res = app.renderer.resolution
        world.position.set(snapToPhysicalPixel(camera.x, res), snapToPhysicalPixel(camera.y, res))
      }
      positionWorld()
      world.scale.set(camera.scale)
      onCameraChange?.(camera)

      // Texto no mundo escalado acompanha o zoom em degraus (textResolution.ts):
      // sem isso ele é rasterizado a 1x e esticado (mole a 2x, em blocos a 4x).
      // `data-text-resolution` = maior resolução aplicada, lida pelo e2e.
      const syncTextResolution = () => {
        if (destroyed) return
        el.dataset.textResolution = String(syncWorldTextResolution(world, camera.scale, app.renderer.resolution))
      }
      const textResolutionTask = createDebouncedTask(syncTextResolution)

      /**
       * Executa `tarefa` no máximo UMA vez por quadro, sempre com o estado
       * mais recente (a chamada agendada roda depois das que ela engoliu, e a
       * primeira chamada de um quadro novo agenda de novo — nenhuma última
       * mudança fica sem desenhar).
       *
       * Só para trabalho DERIVADO da câmera: grade, moldura, contornos em px
       * de tela e o ZoomHud do React. O pixel que a pessoa está olhando NÃO
       * passa por aqui — `world.position`/`world.scale` continuam mudando
       * dentro do próprio pointermove/wheel, então o mapa acompanha o
       * ponteiro sem um quadro de atraso.
       *
       * Por que existe: o navegador entrega VÁRIOS pointermove e vários
       * eventos de roda por quadro, e só o último de cada quadro chega à
       * tela. Redesenhar em todos era trabalho jogado fora. Perfil de CPU do
       * Chromium num gesto de roda (10 passos, editor com 6 salas, 17/09/2026):
       * o topo do JS era `jsxDEV` repetido — a árvore inteira do React
       * re-renderizando uma vez por evento de roda, puxada por
       * `onCameraChange`, com frame_p95 de 50 ms no `ux-driver medir`.
       */
      const umaVezPorQuadro = (tarefa: () => void): (() => void) => {
        let agendado = false
        return () => {
          if (agendado) return
          agendado = true
          requestAnimationFrame(() => {
            agendado = false
            // O componente pode ter desmontado entre o agendamento e o quadro.
            if (destroyed) return
            tarefa()
          })
        }
      }

      // `camera` é lida no quadro, não capturada no agendamento: o ZoomHud
      // recebe o valor final do gesto, não o do primeiro evento dele.
      const notifyCameraChange = umaVezPorQuadro(() => onCameraChange?.(camera))

      // Onda 1 — todo ponto do arquivo que muda `camera` passa por aqui (pan,
      // roda, atalho de enquadrar/resetar): aplica no Pixi, grava na store E
      // notifica App.tsx (ZoomHud). Antes desta fase cada call site repetia
      // as 3 linhas (`world.position.set` / `world.scale.set` /
      // `setCamera`) — reunidas aqui pra `onCameraChange` não ficar esquecido
      // em algum dos pontos novos.
      //
      // `setCamera` continua SÍNCRONO de propósito: é o que os gestos e os
      // testes leem para converter mundo↔tela no evento seguinte. O que foi
      // adiado para um por quadro é só o redesenho que a câmera dispara.
      //
      // `origin` diz quem moveu: o gesto do mestre desliga o "Seguir" (G7); o
      // pedido do app (abrir, trocar de cena, "Ir lá", o próprio seguir) não —
      // senão o seguir se desligaria no primeiro centro que faz.
      const applyCamera = (next: Camera, origin: CameraOrigin) => {
        camera = next
        positionWorld()
        world.scale.set(camera.scale)
        useMapStore.getState().setCamera(camera)
        notifyCameraChange()
        textResolutionTask.schedule()
        useFollowStore.getState().cameraApplied(origin)
      }

      // Item #9 do plano — reset explícito (Ctrl+0 / clique no ZoomHud):
      // volta ao estado literal de câmera nova, não um "fit" — é o que o
      // usuário lê como "100%" de verdade (fitCamera para o mapa inteiro
      // quase nunca fica em scale=1).
      const resetZoom = () => applyCamera({ x: 0, y: 0, scale: 1 }, 'gesto')
      resetZoomRequestRef.current = resetZoom

      // Item #9 — margem de respiro (px de tela) ao redor do conteúdo tanto
      // no fit automático de abertura quanto na tecla F.
      const FIT_MARGIN = 40
      const fitToContent = (origin: CameraOrigin) => {
        const bounds = contentBounds(useMapStore.getState().map)
        // Mapa vazio (bounds nulo): não mexe na câmera — fitCamera não tem
        // "sem conteúdo" pra enquadrar, e forçar um valor arbitrário seria
        // pior que deixar a câmera onde já estava.
        if (!bounds) return
        applyCamera(fitCamera(bounds, { width: app.screen.width, height: app.screen.height }, FIT_MARGIN), origin)
      }
      // Fit automático ao ABRIR o mapa (item #9): PixiCanvas monta de novo
      // toda vez que `App.tsx` troca de tela pra 'editor' (Carregar Mapa,
      // Criar, Voltar por portal) — então "no mount" já É "ao abrir o mapa"
      // pra este componente, sem precisar de uma segunda assinatura de
      // `map.id`.
      fitToContent('pedido')
      // Troca de cena: volta à câmera que a cena tinha, ou enquadra a cena
      // vista pela primeira vez (cena vazia mantém a câmera, ver acima).
      // Chegada por pino de viagem: o pino par no centro da tela, no zoom que
      // a cena tinha (ou no de agora) — o mestre vê de cara por onde entrou.
      cameraRequestRef.current = ({ camera: requested, focus }) => {
        if (focus !== undefined) {
          const scale = requested?.scale ?? camera.scale
          const center = freeAreaCenter({ width: app.screen.width, height: app.screen.height }, focusObstaclesRef.current?.() ?? [])
          applyCamera({ scale, x: center.x - focus.x * scale, y: center.y - focus.y * scale }, 'pedido')
          return
        }
        if (requested) applyCamera(requested, 'pedido')
        else fitToContent('pedido')
      }

      // B1 — ondas animadas precisam de quadro a quadro; a store só diz quais sinais estão vivos.
      const signalsRenderer = createSignalsRenderer()
      let signalsDrawn = 0
      const tickSignals = () => {
        const { signals } = useSignalStore.getState()
        if (signals.length === 0 && signalsDrawn === 0) return
        const drawn = signalsRenderer.draw(signalsLayer, signals, camera, { width: app.screen.width, height: app.screen.height }, Date.now())
        if (drawn !== signalsDrawn) el.dataset.signalsCount = String(drawn)
        signalsDrawn = drawn
      }
      app.ticker.add(tickSignals)

      // B2 — laser do mestre: o próprio rastro em espaço de tela, acima dos sinais.
      const laserLayer = new Container()
      laserLayer.eventMode = 'none'
      app.stage.addChild(laserLayer)
      const laserRenderer = createLaserRenderer()
      let laserDrawn = 0
      el.dataset.laserDrawn = '0'
      const tickLaser = () => {
        const state = useLaserStore.getState()
        if (state.trail.length === 0 && laserDrawn === 0) return
        // A ponta fica acesa só durante o traço (botão pressionado), não com o laser só armado.
        const drawn = laserRenderer.draw(laserLayer, { points: state.trail, on: state.drawing }, camera, Date.now())
        if (drawn !== laserDrawn) el.dataset.laserDrawn = String(drawn)
        laserDrawn = drawn
        // Rastro todo apagado e sem traço: esvazia para o ticker voltar a pular o quadro.
        if (drawn === 0 && !state.drawing) useLaserStore.setState({ trail: [] })
      }
      app.ticker.add(tickLaser)
      /** Último ponto do ponteiro sobre o canvas (px de mundo); `null` com o ponteiro fora dele. */
      let laserPointer: Point | null = null
      /** L apertado há menos de `LASER_KEY_TAP_MS`, ainda sem decidir entre atalho da Linha e laser. */
      let laserKeyTimer: ReturnType<typeof setTimeout> | null = null
      let laserKeyTap: Parameters<typeof resolveShortcut>[0] | null = null
      const laserGesture = createLaserGesture((point) => {
        useLaserStore.getState().addPoint(point.x, point.y)
        onLaserMoveRef.current?.(point.x, point.y)
      })
      /** Arma o laser pela tecla: nada é desenhado nem enviado até o botão esquerdo. */
      const activateLaserKey = () => {
        if (laserKeyTimer !== null) clearTimeout(laserKeyTimer)
        laserKeyTimer = null
        laserKeyTap = null
        useLaserStore.getState().setHeld(true)
      }
      /** Soltou L. Com `allowTap`, um toque curto sem mexer o mouse ainda seleciona a ferramenta Linha. */
      const releaseLaserKey = (allowTap: boolean) => {
        if (laserKeyTimer !== null) {
          clearTimeout(laserKeyTimer)
          laserKeyTimer = null
          const tap = laserKeyTap
          laserKeyTap = null
          const action = allowTap && tap !== null ? resolveShortcut(tap) : null
          if (action !== null) runShortcut(action)
          return
        }
        useLaserStore.getState().setHeld(false)
      }
      const onCanvasPointerLeave = () => {
        laserPointer = null
      }
      el.addEventListener('pointerleave', onCanvasPointerLeave)
      // Alt+Tab com L ou o botão apertado: keyup/pointerup nunca chegam e o laser ficaria preso ligado.
      const onWindowBlur = () => {
        laserGesture.cancel()
        releaseLaserKey(false)
      }
      window.addEventListener('blur', onWindowBlur)

      const computeViewport = () => ({
        left: -camera.x / camera.scale,
        top: -camera.y / camera.scale,
        right: (app.screen.width - camera.x) / camera.scale,
        bottom: (app.screen.height - camera.y) / camera.scale,
      })

      const redrawGrid = () => {
        const { map } = useMapStore.getState()
        if (!map.showGrid) {
          // Contexto compartilhado: limpa as duas camadas (dentro e fora do piso).
          gridGraphics.clear()
          return
        }
        const viewport = computeViewport()
        // Traço branco opaco; cor e opacidade saem do tint/alpha de cada camada.
        const lineSettings = { ...map.gridSettings, color: '#ffffff', opacity: 1 }
        if (map.gridShape === 'hex') {
          drawHexGrid(gridGraphics, computeVisibleHexCenters(map.grid, viewport), map.grid, lineSettings)
        } else if (map.gridShape === 'triangle') {
          // F3, dívida "grid-triangular" (agente C6): matemática pronta em
          // triGrid.ts, só faltava este call site — snap (tokenInteraction.ts,
          // fora da minha lista de escrita) ainda cai no snap quadrado padrão
          // para esta forma; ver relatório.
          drawTriGrid(gridGraphics, computeVisibleTriEdges(map.grid, viewport), lineSettings)
        } else {
          // computeAlignedGridLines (lib/gridAlign.ts, agente C5) no lugar de
          // computeVisibleGridLines (pixi/grid.ts): a única diferença é somar
          // gridOffset — com offset ausente (undefined -> {0,0}) as duas
          // produzem exatamente as mesmas linhas (comentário no topo da
          // função), então nenhum mapa que nunca usou "Alinhar grade à
          // imagem" muda de aparência.
          // Quadrada: cada linha no pixel físico, `lineWidth` em px de tela.
          const pixel = pixelGrid(camera.scale, app.renderer.resolution, map.gridSettings.lineWidth)
          drawGrid(gridGraphics, computeAlignedGridLines(map.grid, map.gridOffset ?? { x: 0, y: 0 }, viewport), viewport, lineSettings, pixel)
        }
        applyGridStyle()
      }

      /** Cor/opacidade das duas camadas da grade e máscara ligada só com piso. */
      const applyGridStyle = () => {
        const { gridSettings } = useMapStore.getState().map
        gridGraphics.tint = gridSettings.color
        gridGraphics.alpha = gridSettings.opacity
        gridOutsideGraphics.visible = gridHasFloor
        gridOutsideGraphics.tint = OUTSIDE_FLOOR_GRID_COLOR
        gridOutsideGraphics.alpha = gridSettings.opacity > 0 ? OUTSIDE_FLOOR_GRID_ALPHA : 0
      }

      /**
       * Silhueta do piso para a grade. Com piso: grade forte dentro, apagada fora. Sem piso (mapa só
       * com imagem de fundo, por exemplo): a grade inteira como antes.
       */
      const redrawGridMask = () => {
        const { map } = useMapStore.getState()
        const rasterMode = map.floorStyle.renderMode === 'raster'
        const floorPolygons = rasterMode || map.hiddenLayers.includes('salas') ? [] : floorRenderer.polygons()
        const hasFloor = buildFloorMask(
          gridFloorMask,
          visibleRegions(map.regions, map.hiddenLayers),
          visibleWalls(map.walls, map.hiddenLayers),
          floorPolygons,
        )
        if (hasFloor !== gridHasFloor) {
          gridHasFloor = hasFloor
          if (hasFloor) {
            gridGraphics.setMask({ mask: gridFloorMask })
            gridOutsideGraphics.setMask({ mask: gridOutsideMask, inverse: true })
          } else {
            gridGraphics.mask = null
            gridOutsideGraphics.mask = null
          }
        }
        applyGridStyle()
      }

      /**
       * Onda 3, item 21 (Frente E) — moldura do mapa (`width*grid` ×
       * `height*grid`) + sombra da área fora dela dentro do viewport visível.
       * Mesmo gatilho de `redrawGrid` (chamada sempre junto dela, nunca
       * sozinha): depende do MESMO `viewport` recomputado a cada pan/zoom, e
       * de `width`/`height`/`grid`, que mudam junto de `grid` na assinatura
       * de `subscribeToGridRedraw` (ver comentário mais abaixo).
       */
      const redrawMapBounds = () => {
        const { map } = useMapStore.getState()
        drawMapBounds(mapBoundsGraphics, map, computeViewport(), pixelGrid(camera.scale, app.renderer.resolution))
      }

      /**
       * Prévia (ainda não aplicada) de "Alinhar grade à imagem" — desenhada
       * por cima da grade real, cor distinta (drawGridAlignOverlay.ts). Só é
       * chamada por `gridAlignOverlayRedrawRef` (prop `gridAlignPreview`
       * mudando) e uma vez aqui no fim do `setup()`, nunca pelas subscriptions
       * de grid/shapes — não depende de nenhuma mutação do mapa.
       */
      const redrawGridAlignOverlay = (draft: GridAlignResult | null) => {
        if (!draft) {
          gridAlignOverlayGraphics.clear()
          return
        }
        const viewport = computeViewport()
        drawGridAlignOverlay(gridAlignOverlayGraphics, computeAlignedGridLines(draft.cellSize, draft.offset, viewport), viewport)
      }

      /**
       * Paredes e portas têm espessura fixa em px de TELA (drawWalls.ts,
       * drawDoors.ts): recebem escala e resolução e redesenham quando qualquer
       * uma muda. Função própria porque também roda sozinha no zoom, sem pagar
       * o redesenho do chão/regiões de `redrawShapes`.
       */
      const redrawWallsAndDoors = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        const walls = visibleWalls(map.walls, map.hiddenLayers)
        const selectedWallId = single?.kind === 'wall' ? single.id : null
        const res = app.renderer.resolution
        // Sala selecionada: o contorno segue as paredes (sob elas o da Região some).
        drawWalls(wallsGraphics, walls, selectedWallId, camera.scale, res, single?.kind === 'region' ? single.id : null)
        drawDoors(doorsGraphics, walls, selectedWallId, camera.scale, res)
      }

      /**
       * Obstáculos que barram a luz, memorizados por REFERÊNCIA de `walls` e
       * `floor` (a store é imutável). `visionSegments` devolve um array novo a
       * cada chamada, e `redrawLights` roda em todo passo de zoom: sem este
       * memo, o recorte por raycast de cada luz seria refeito a cada quadro do
       * zoom, com o mapa parado.
       */
      let lightOccluders: { walls: MapData['walls']; floor: MapData['floor']; segments: Segment[] } | null = null
      const lightOccludersOf = (map: MapData): Segment[] => {
        if (lightOccluders !== null && lightOccluders.walls === map.walls && lightOccluders.floor === map.floor) return lightOccluders.segments
        const segments = visionSegments(map)
        lightOccluders = { walls: map.walls, floor: map.floor, segments }
        return segments
      }

      /** Luz com gradiente e marcador de tamanho fixo na tela: redesenha também no zoom. */
      const redrawLights = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        // Mesmos obstáculos da visão: a luz para onde o olho pararia.
        lightsRenderer.draw(lightsContainer, visibleLights(map.lights, map.hiddenLayers), {
          selectedLightId: single?.kind === 'light' ? single.id : null,
          cameraScale: camera.scale,
          occluders: lightOccludersOf(map),
        })
        // Para o e2e: gradientes vivos (1 textura cada) não podem crescer com trocas de intensidade.
        el.dataset.lightGradients = String(lightsRenderer.liveGradients())
      }

      /**
       * Regiões e desenhos recebem `camera.scale` para o contorno de seleção
       * manter espessura fixa na tela; roda sozinha quando só o zoom muda.
       */
      const redrawRegionsAndDrawings = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        regionsRenderer.draw(regionsContainer, visibleRegions(map.regions, map.hiddenLayers), resolveHighlightedRegionId(map.walls, single), camera.scale)
        const drawings = visibleDrawings(map.drawings, map.hiddenLayers)
        const selectedDrawingId = single?.kind === 'drawing' ? single.id : null
        drawDrawings(drawingsGraphics, drawings.filter((d) => !d.secret), selectedDrawingId, camera.scale)
        drawDrawings(secretDrawingsGraphics, drawings.filter((d) => d.secret), selectedDrawingId, camera.scale)
      }

      /** Escadas também têm contorno de seleção em px de tela: redesenham no zoom. */
      const redrawStairs = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        const stairs = visibleStairs(map.stairs, map.hiddenLayers)
        const selectedStairId = single?.kind === 'stair' ? single.id : null
        const res = app.renderer.resolution
        drawStairs(stairsGraphics, stairs.filter((s) => !s.secret), selectedStairId, camera.scale, res)
        drawStairs(secretStairsGraphics, stairs.filter((s) => s.secret), selectedStairId, camera.scale, res)
      }

      // Girar sala pela alça (bolinha acima da sala selecionada). Nasce antes do
      // redesenho das alças porque ele pergunta se o giro está em curso.
      const roomRotateGesture = createRoomRotateGesture()

      /**
       * Alças de edição (os quadradinhos amarelos) da seleção de UM item.
       *
       * Mora numa função própria porque as alças seguem TRÊS assinaturas
       * diferentes da store — formas, tokens e props —, e antes só o redraw de
       * formas as redesenhava. Resultado medido no passeio cego de 16/09/2026:
       * depois de arrastar um token, as quatro alças continuavam desenhadas na
       * posição ANTIGA (144 pixels amarelos fantasma) até a pessoa clicar fora.
       */
      const redrawEditHandles = () => {
        const { map, selection, activeTool } = useMapStore.getState()
        drawEditHandles(handlesGraphics, map, selectionSingle(selection), activeTool, {
          cameraScale: camera.scale,
          rendererResolution: app.renderer.resolution,
          rotating: roomRotateGesture.isActive(),
        })
      }

      /**
       * Pinos do mestre. Pino "Oculto no editor" some daqui como qualquer outro
       * item do mestre; pino de viagem sem par sai apagado — e o par mora em
       * OUTRA cena, então quem pede este redesenho é também a assinatura da
       * aventura (ver `unsubscribeTravelLinks`), não só `map.pins`.
       */
      const redrawPins = () => {
        const { map, selectedPinId } = useMapStore.getState()
        pinsRenderer.draw(
          pinsContainer,
          visiblePins(map.pins, map.hiddenLayers).filter((pin) => !pin.hidden),
          selectedPinId,
          unlinkedTravelPinIds(useAdventureStore.getState(), map),
        )
      }

      const redrawShapes = () => {
        const { map, selection } = useMapStore.getState()
        // Onda 4, item 24 — `selection` é um SelectionSet agora; o destaque
        // POR ENTIDADE (drawWalls/drawDoors/etc., 1 highlight cada) só faz
        // sentido pro caso de 1 item — `single` é essa borda. Grupo (2+
        // itens, Shift+clique ou marquee mesclado) ganha o contorno de
        // bounding-box abaixo, reaproveitando drawAreaSelectionOutline (N3),
        // em vez de destacar item a item (exigiria mudar drawWalls.ts e os
        // outros 6 renderers de forma, fora da minha lista de arquivos).
        const single = selectionSingle(selection)
        // Onda 3, item 22 (bug — Frente E): antes só `selection.kind ===
        // 'region'` pintava a Sala com SELECTION_COLOR; clicar na PAREDE-dona
        // (selection.kind === 'wall' com wall.regionId apontando pra cá)
        // deixava a sala sem confirmar visualmente a seleção. Ver
        // `resolveHighlightedRegionId` (drawRegions.ts) para os dois casos.
        // Chão por peças fica na camada 'salas', junto das Regiões.
        const rasterMode = map.floorStyle.renderMode === 'raster'
        if (rasterMode) {
          floorGraphics.clear()
          redrawMapRaster(map)
        } else {
          clearMapRaster()
          floorRenderer.draw(floorGraphics, map.hiddenLayers.includes('salas') ? EMPTY_FLOOR : map.floor, map.floorStyle)
        }
        redrawGridMask()
        floorRenderer.drawSelection(
          floorSelectionGraphics,
          single?.kind === 'floor' && !map.hiddenLayers.includes('salas') ? map.floor.find((p) => p.id === single.id) ?? null : null,
          map.floorStyle.sampleStep,
        )
        mapLinesGraphics.clear()
        if (!rasterMode && !map.hiddenLayers.includes('paredes')) drawMapLines(mapLinesGraphics, map.lines)
        if (!rasterMode && !map.hiddenLayers.includes('portas')) drawMapMarkers(mapLinesGraphics, map.markers)
        redrawMapFrame(map.frame)
        redrawRegionsAndDrawings()
        roomNamesRenderer.draw(roomNamesContainer, visibleRegions(map.regions, map.hiddenLayers), map.grid, camera.scale)
        redrawWallsAndDoors()
        redrawStairs()
        redrawLights()
        concealZonesRenderer.draw(concealZonesContainer, map.concealZones, map.grid, useMapStore.getState().selectedConcealZoneId)
        redrawPins()
        textLabelsRenderer.draw(textLabelsContainer, visibleDrawings(map.drawings, map.hiddenLayers), single?.kind === 'drawing' ? single.id : null)
        redrawEditHandles()
        // N3 (agora genérico, não só marquee): contorno do GRUPO — só com 2+
        // itens (1 item já tem o próprio destaque acima; 0 não desenha nada).
        drawAreaSelectionOutline(
          areaSelectionOutlineGraphics,
          selection.length > 1 ? areaSelectionBounds(map, selectionToAreaSelection(selection)) : null,
        )
        // Text novo (nome, rótulo) nasce na resolução do renderer: ajusta já ao zoom atual.
        syncTextResolution()
      }

      const redrawTokens = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        tokensRenderer.draw(tokensContainer, visibleTokens(map.tokens, map.hiddenLayers), map.grid, single?.kind === 'token' ? single.id : null, camera.scale)
        // As alças do token acompanham o token: `moveTokenLive` (arrasto) e
        // `moveSelectionBy` (setas) só acordam ESTE redraw, nunca o de formas.
        redrawEditHandles()
        syncTextResolution()
      }

      const propsRenderer = createPropsRenderer()
      const textLabelsRenderer = createTextLabelsRenderer()
      const angleIndicatorRenderer = createAngleIndicatorRenderer()
      const measurementIndicatorRenderer = createMeasurementIndicatorRenderer()
      // Quantos quadrados a ficha já andou, mostrado DURANTE o arrasto. É o
      // MESMO desenhista da ferramenta Medir (linha fina + rótulo discreto),
      // numa instância própria: o cache de Graphics/Text é fechado por closure
      // dentro de `createMeasurementIndicatorRenderer`, então compartilhar a
      // instância faria um gesto apagar o rótulo do outro.
      const tokenDragDistanceRenderer = createMeasurementIndicatorRenderer()
      // O mestre vê tudo, sempre: a marca do teto é DELE, e só existe no editor.
      const regionsRenderer = createRegionsRenderer({ roofMarker: true })
      const roomNamesRenderer = createRoomNamesRenderer()
      const concealZonesRenderer = createConcealZonesRenderer()
      const pinsRenderer = createPinsRenderer()
      const floorRenderer = createFloorRenderer()
      // Gradientes de luz nascem POR RENDERER e morrem no teardown.
      const lightsRenderer = createLightsRenderer()
      // Render fiel: re-rasteriza só quando alguma entrada muda de referência (a store é imutável).
      let lastRaster: {
        floor: MapData['floor']
        lines: MapData['lines']
        markers: MapData['markers']
        style: MapData['floorStyle']
        hidden: MapData['hiddenLayers']
        width: number
        height: number
      } | null = null
      const replaceRasterTexture = (texture: Texture) => {
        const old = mapRasterSprite.texture
        mapRasterSprite.texture = texture
        if (old !== Texture.EMPTY) old.destroy(true)
      }
      const clearMapRaster = () => {
        if (!lastRaster) return
        lastRaster = null
        replaceRasterTexture(Texture.EMPTY)
      }
      const redrawMapRaster = (map: MapData) => {
        const width = map.width * map.grid
        const height = map.height * map.grid
        const same =
          lastRaster !== null &&
          lastRaster.floor === map.floor &&
          lastRaster.lines === map.lines &&
          lastRaster.markers === map.markers &&
          lastRaster.style === map.floorStyle &&
          lastRaster.hidden === map.hiddenLayers &&
          lastRaster.width === width &&
          lastRaster.height === height
        if (same) return
        lastRaster = { floor: map.floor, lines: map.lines, markers: map.markers, style: map.floorStyle, hidden: map.hiddenLayers, width, height }
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
            floor: hexToRgb(style.fillColor),
            stroke: style.strokeColor ? hexToRgb(style.strokeColor) : null,
            strokeAlpha: style.strokeAlpha ?? 1,
            strokeWidth: style.strokeWidth,
            lineAlpha: style.lineAlpha ?? 1,
            samples: MINIMAP_RASTER_SAMPLES,
            // Borda do chão por área exata (mesmo modo que venceu na recriação dos mapas de referência).
            pattern: 'analytic',
          },
        )
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
        replaceRasterTexture(Texture.from(canvas))
      }

      // Moldura recriada só quando `map.frame` muda de referência: tem um Text do Pixi dentro.
      let lastMapFrame: MapFrame | null | undefined
      const redrawMapFrame = (frame: MapFrame | null) => {
        if (frame === lastMapFrame) return
        lastMapFrame = frame
        for (const child of mapFrameContainer.removeChildren()) child.destroy({ children: true })
        if (!frame) return
        const layout = layoutMapFrame(frame.w, frame.h, frame.title)
        const drawn = drawMapFrame(layout, frame.titleFont)
        drawn.position.set(frame.x - layout.content.x, frame.y - layout.content.y)
        mapFrameContainer.addChild(drawn)
      }
      const tokensRenderer = createTokensRenderer()
      // Onda 2, item 16 (Frente C) — número ao vivo durante o arrasto de forma.
      const dimensionLabelRenderer = createDimensionLabelRenderer()

      const redrawProps = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        propsRenderer.draw(propsContainer, visibleProps(map.props, map.hiddenLayers), single?.kind === 'prop' ? single.id : null)
        // Mesmo motivo do redraw de tokens: `movePropLive` não acorda o redraw
        // de formas, e sem isto as alças ficam na posição de onde o prop saiu.
        redrawEditHandles()
      }

      let backgroundLoadToken = 0

      const redrawBackground = async () => {
        const { map } = useMapStore.getState()
        const loadToken = (backgroundLoadToken += 1)

        if (map.background.type !== 'image' || !map.background.src) {
          backgroundSprite.texture = Texture.EMPTY
          onBackgroundImageSizeChange?.(null)
          return
        }

        try {
          const url = convertFileSrc(map.background.src)
          // Mipmaps: sem eles a imagem afastada (zoom < 100%) pula texels e
          // serrilha/faz moiré (medido a 50%). Filtro já é 'linear' por padrão.
          const texture = await Assets.load<Texture>({ src: url, data: { autoGenerateMipmaps: true } })
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = texture
          // Dimensões NATURAIS da textura (não afetadas por camera.scale) —
          // é o que GridAlignControls precisa pra derivar cellSize a partir
          // de colunas/linhas contadas na imagem (contrato do agente C5).
          onBackgroundImageSizeChange?.({ width: texture.width, height: texture.height })
        } catch {
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = Texture.EMPTY
          onBackgroundImageSizeChange?.(null)
        }
      }

      redrawGrid()
      redrawMapBounds()
      redrawShapes()
      redrawTokens()
      redrawProps()
      void redrawBackground()
      gridAlignOverlayRedrawRef.current = redrawGridAlignOverlay
      redrawGridAlignOverlay(gridAlignPreview)
      // Onda 3, item 21 — a moldura depende do MESMO gatilho que a grade
      // (câmera/showGrid/grid/gridShape, ver comentário de
      // `unsubscribeGridOffset` abaixo): sem `width`/`height` na assinatura
      // de `subscribeToGridRedraw` porque nenhuma UI desta fase edita as
      // dimensões do mapa depois de criado — se isso mudar, este é o ponto a
      // revisitar.
      // Um redesenho por quadro: durante um arrasto de vista a câmera muda
      // várias vezes dentro do mesmo quadro, e a grade só precisa do último
      // valor (ver `umaVezPorQuadro`).
      const unsubscribeGrid = subscribeToGridRedraw(
        umaVezPorQuadro(() => {
          redrawGrid()
          redrawMapBounds()
        }),
      )
      // Grade e sombra fora do mapa são recortadas ao viewport (app.screen):
      // quando o renderer muda de tamanho, redesenha as duas sem mexer na
      // câmera. Sem isso a área nova ao maximizar ficava sem grade/sombra.
      app.renderer.on('resize', () => {
        if (destroyed) return
        redrawGrid()
        redrawMapBounds()
      })
      // O ResizePlugin do Pixi só escuta 'resize' da janela; o container pode
      // mudar de tamanho sem esse evento (layout, WebView2 maximizando) e o
      // canvas ficava preso no tamanho antigo, deixando o fundo da página à mostra.
      const containerResizeObserver = new ResizeObserver(() => {
        if (!destroyed) app.resize()
      })
      containerResizeObserver.observe(el)
      // Janela arrastada para outro monitor ou zoom do navegador: troca a
      // resolução (textos se refazem pelo runner resolutionChange) e o resize
      // emite 'resize', que redesenha grade e moldura acima.
      const stopWatchingResolution = watchDevicePixelRatio((resolution) => {
        if (destroyed) return
        app.renderer.resolution = resolution
        app.resize()
        // Pixel físico mudou de tamanho: reposiciona o world e realinha escada,
        // paredes e portas (grade e moldura já redesenham no 'resize' acima).
        positionWorld()
        redrawStairs()
        redrawWallsAndDoors()
        // Text com resolução fixa não segue o runner resolutionChange do Pixi.
        textResolutionTask.flush()
      })
      const unsubscribeShapes = subscribeToShapesRedraw(redrawShapes)
      // O par de um pino de viagem mora numa cena de FUNDO: ligar, desligar ou
      // apagar o par muda o cache da aventura sem tocar em `map.pins` daqui, e
      // o pino daqui precisa acender ou apagar mesmo assim.
      const unsubscribeTravelLinks = useAdventureStore.subscribe((state, previous) => {
        if (state.cache !== previous.cache || state.adventure !== previous.adventure || state.activeSceneId !== previous.activeSceneId) {
          redrawPins()
        }
      })
      const unsubscribeTokens = subscribeToTokensRedraw(redrawTokens)
      const unsubscribeProps = subscribeToPropsRedraw(redrawProps)
      const unsubscribeBackground = subscribeToBackgroundRedraw(() => {
        void redrawBackground()
      })
      // `subscribeToGridRedraw` (stores/gridSubscription.ts, fora do escopo
      // deste integrador) assina [camera, showGrid, grid, gridShape] — não
      // `gridOffset` (campo novo, F3). Assinatura extra só pra isso, mesmo
      // padrão de unsubscribeHiddenLayersForTokensAndProps logo abaixo:
      // sem ela, mudar SÓ o deslocamento (sem mudar cellSize junto) em
      // GridAlignControls não redesenharia a grade real.
      const unsubscribeGridOffset = useMapStore.subscribe(
        (state) => state.map.gridOffset,
        () => redrawGrid(),
      )
      // Só a escala importa para o piso de 1 px das paredes e para o contorno
      // de seleção (px de tela) de regiões, desenhos e escadas: pan não muda a
      // largura na tela, então não redesenha a cada movimento de arrasto.
      // Também um por quadro: é o bloco mais caro que a câmera dispara (4
      // redraws de forma), e uma rolada de roda entrega vários eventos dentro
      // do mesmo quadro. A escala vem da store na hora de desenhar, não do
      // argumento do listener, pra valer sempre a última (ver `umaVezPorQuadro`).
      const unsubscribeCameraScaleForWalls = useMapStore.subscribe(
        (state) => state.camera.scale,
        umaVezPorQuadro(() => {
          const { scale } = useMapStore.getState().camera
          // Nomes de sala/token: tamanho mínimo na tela e somem abaixo de 30% (screenLabel.ts).
          roomNamesRenderer.setCameraScale(scale)
          tokensRenderer.setCameraScale(scale)
          redrawWallsAndDoors()
          redrawRegionsAndDrawings()
          redrawStairs()
          redrawLights()
          // A alça de girar sala tem tamanho fixo na tela.
          redrawEditHandles()
        }),
      )
      // tokensSubscription.ts/propsSubscription.ts (fora do escopo deste
      // integrador) só assinam [map.tokens/map.props, selection] — nenhum dos
      // dois vê `map.hiddenLayers` mudar, então ocultar a camada 'tokens' ou
      // 'objetos'/'decoracao' pelo LayersPanel não redesenharia essas camadas
      // sozinho. Assinatura extra, só pra isso, sem duplicar a lógica de redraw.
      const unsubscribeHiddenLayersForTokensAndProps = useMapStore.subscribe(
        (state) => state.map.hiddenLayers,
        () => {
          redrawTokens()
          redrawProps()
        },
      )

      let mode:
        | 'idle'
        | 'panning'
        | 'dragging-token'
        | 'dragging-prop'
        | 'drawing-wall'
        | 'drawing-freehand'
        | 'drawing-line'
        | 'drawing-circle'
        | 'drawing-rect'
        | 'drawing-ellipse'
        | 'drawing-polygon'
        | 'drawing-light'
        | 'drawing-curve'
        | 'dragging-curve-point'
        | 'dragging-curve-body'
        | 'dragging-light-radius'
        | 'erasing'
        | 'drawing-room'
        | 'drawing-polygon-room'
        | 'drawing-stair'
        | 'resizing-room-corner'
        | 'dragging-wall-point'
        | 'dragging-region-point'
        | 'dragging-wall-body'
        | 'dragging-region-body'
        | 'dragging-stair-body'
        | 'dragging-line-point'
        | 'dragging-line-body'
        // B3 (bug3 "mover e redimensionar"): resize por canto de Drawing
        // rect/ellipse/polygon, Token e Prop — geometria em objectTransform.ts.
        | 'resizing-drawing-corner'
        // Onda 3, item 18 (Frente B) — alça de raio do Drawing 'circle'.
        | 'resizing-drawing-radius'
        | 'resizing-token'
        | 'resizing-prop-corner'
        // N3 "ferramenta de seleção de área".
        | 'area-marquee-drag'
        | 'dragging-area-selection'
        // Chão por peças: arrasto de criação e mover corpo da peça selecionada.
        | 'drawing-floor'
        | 'dragging-floor-body'
        // Pincel de blocos: arrasto que pinta (botão esquerdo) ou apaga (direito).
        | 'painting-floor-blocks'
        // A4 — arrastar só o nome da Sala.
        | 'dragging-room-label'
        // A5 — arrasto de criação da Zona oculta.
        | 'drawing-conceal-zone'
        // Mover um pino de ponto de interesse já cravado.
        | 'dragging-pin'
        // Girar sala pela alça (pixi/roomRotateGesture.ts).
        | 'rotating-room' = 'idle'
      let lastPoint = { x: 0, y: 0 }
      let draggingTokenId: string | null = null
      let draggingPropId: string | null = null
      let draggingPinId: string | null = null
      /**
       * Distância entre a PONTA do pino e o ponto onde o dedo o pegou. Sem ela
       * o pino saltaria para debaixo do cursor no primeiro pointermove: a
       * pessoa quase sempre pega pela CABEÇA, que fica `PIN_HEAD_OFFSET` px de
       * mundo acima da ponta cravada (lib/pins.ts).
       */
      let pinDragOffset: Point | null = null
      /**
       * Pino de VIAGEM apertado com a Selecionar, em px de tela. Enquanto o
       * ponteiro não passa de `TRAVEL_CLICK_SLOP_PX`, o pino não se move; se o
       * botão sobe ali, o clique atravessa (`onTravelPin`). `moved` = o gesto
       * já virou arrasto e não atravessa mais.
       */
      let travelPress: { pinId: string; x: number; y: number; moved: boolean } | null = null
      let wallDraftStart: Point | null = null
      let regionDraftPoints: Point[] = []
      /**
       * As duas ferramentas que desenham canto a canto com `regionDraftPoints`:
       * Região e Sala livre. A Sala livre reusa o MESMO rascunho de propósito —
       * a prévia até o cursor, o Enter/duplo clique que fecha e o
       * Backspace/Ctrl+Z que tira o último canto já moram nele, e duas receitas
       * de "traçado ponto a ponto" divergiriam na primeira correção. O que
       * muda entre as duas é só o que NASCE no fim (ver `finishRegion`).
       */
      const usaTracadoPontoAPonto = (tool: DrawingTool): boolean => tool === 'region' || tool === 'roomFree'
      // Ferramenta Região: o pointerdown NÃO decide mais nada sozinho. Guarda
      // o ponto (snapado, para virar vértice; e bruto, para medir o arrasto) e
      // quem decide entre "um ponto do traçado" e "um retângulo inteiro" é o
      // pointerup, pela distância percorrida — mesmo padrão de decisão tardia
      // que a ferramenta Luz já usa (lightDraftRawStart/LIGHT_CLICK_THRESHOLD).
      // Antes, arrastar com a Região só deixava um pontinho no início e nada
      // ao soltar: 0 de 2 tentativas no passeio cego de 16/09/2026.
      let regionDraftStart: Point | null = null
      let regionDraftRawStart: Point | null = null
      let freehandDraftPoints: Point[] = []
      let lineDraftStart: Point | null = null
      let circleDraftCenter: Point | null = null
      let rectDraftStart: Point | null = null
      let ellipseDraftCenter: Point | null = null
      let polygonDraftPoints: Point[] = []
      /**
       * Caminho: os pontos já clicados da trilha em construção. Sem `mode`,
       * pelo mesmo motivo de `regionDraftPoints`/`polygonDraftPoints` — cada
       * clique é um pointerdown independente, e quem fecha é o duplo clique
       * ou o Enter.
       */
      let pathDraftPoints: Point[] = []
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
      // Ferramenta Token: ponto do clique. O campo de nome só abre no
      // pointerup — aberto no pointerdown, o mousedown seguinte no canvas
      // tirava o foco do campo e confirmava o nome sugerido na hora.
      let tokenPlacementPoint: Point | null = null
      // A5 — canto inicial (com snap) e ponto bruto do clique da Zona oculta.
      let concealDraftStart: Point | null = null
      let concealDraftRawStart: Point | null = null
      let polygonDraftCenter: Point | null = null
      let polygonDraftSides = ROOM_CIRCLE_SIDES
      let stairDraftStart: Point | null = null
      // Chão por peças: início do arrasto (retângulo/elipse/polígono) e os
      // pontos do corredor em construção — este sem `mode`, como
      // regionDraftPoints: cada clique é um pointerdown independente.
      let floorDraftStart: Point | null = null
      /**
       * Pincel de blocos: as células já tocadas neste arrasto, por chave de
       * coluna/linha. O gesto NÃO escreve na store enquanto anda — ele só
       * acumula e desenha a prévia, e o mapa muda uma vez só no pointerup.
       * É o que dá 1 Ctrl+Z por traço (e não um por célula) e o que mantém o
       * arrasto fluido: o contorno do chão inteiro é caro demais para
       * recalcular a cada pointermove.
       */
      let blocoCells: Map<string, Bloco> | null = null
      /** Apaga em vez de pintar: botão direito (decisão de 15/09/2026) ou operação Subtrair — `pincelDeBlocosApaga`. */
      let blocoApagando = false
      /** `map.grid` de quando o traço começou: mudar a grade no meio não parte o traço. */
      let blocoCellSize = 0
      /** Último ponto do ponteiro, para amostrar o caminho entre dois pointermove. */
      let blocoUltimoPonto: Point | null = null
      let corridorDraftPoints: Point[] = []
      // Estado do arrasto de canto de Sala retangular (resize) — mesmo padrão
      // de curveDragSnapshot/lightRadiusDragSnapshot: `roomCornerDragSnapshot`
      // é o `map` de ANTES do gesto (pointerdown), usado só pra fechar um
      // Ctrl+Z único no pointerup/pointerupoutside, já que os pointermoves do
      // meio usam resizeRoomCornerLive (sem histórico).
      let resizingRoomId: string | null = null
      let resizingCorner: RoomCorner | null = null
      let roomCornerDragSnapshot: MapData | null = null
      // Ponto inicial do arrasto da ferramenta "Medir" — régua efêmera, não
      // nasce entidade nenhuma. Independente de `mode` de propósito (mesmo
      // padrão de regionDraftPoints/polygonDraftPoints no fim do pointermove):
      // pointerdown/move/up checam `activeTool === 'measure'` direto.
      let measureDraftStart: Point | null = null
      // Onde a ficha ESTAVA quando o arrasto começou — a origem de "quantos
      // quadrados ela já andou". Guarda a posição da PEÇA, não a do ponteiro:
      // quem pega o disco pela borda não pode ver um quadrado a mais.
      let tokenDragOrigin: Point | null = null
      // Último rótulo+ponto já desenhados, para o pointermove não remexer em
      // Graphics/Text quando o snap devolve a mesma célula — arrastar ficha é
      // o gesto mais usado do app e a maioria dos moves não muda nada aqui.
      let tokenDragLastShown: string | null = null
      let draggingWallPointId: string | null = null
      let draggingWallPointIndex: 0 | 1 = 0
      let draggingRegionId: string | null = null
      let draggingRegionPointIndex = 0
      let draggingWallBodyId: string | null = null
      let draggingRegionBodyId: string | null = null
      // Alt+arrastar de Sala: id da sala original da cópia arrastada (senão `null`).
      let altDragRegionSource: string | null = null
      // Escada — `findSelectableAt` (selectionHitTest.ts) já devolve
      // `kind:'stair'` mas com `draggable:false` de propósito, deixando o
      // wiring de arrasto pro integrador (comentário explícito no arquivo).
      // `moveStair` já existe na store (I7); só faltava este mode + os 2
      // branches de pointerdown/pointermove, mesmo padrão de wall/region body.
      let draggingStairBodyId: string | null = null
      let draggingFloorBodyId: string | null = null
      let bodyDragLastPoint: Point | null = null
      let draggingLineId: string | null = null
      let draggingLinePointIndex: 0 | 1 = 0
      let draggingLineBodyId: string | null = null
      let draggingLightId: string | null = null
      // `map` capturado no pointerdown do arrasto da alça de raio da Luz, ANTES
      // da mutação — mesmo padrão de curveDragSnapshot acima, pra fechar o
      // gesto inteiro (pointermove usa updateLightRadiusLive, sem histórico)
      // num Ctrl+Z só no pointerup/pointerupoutside.
      let lightRadiusDragSnapshot: MapData | null = null
      // B3 (bug3 "mover e redimensionar") — resize por canto, mesmo padrão de
      // roomCornerDragSnapshot acima: snapshot de ANTES do gesto, pra fechar
      // um Ctrl+Z só no pointerup/pointerupoutside (pointermove usa as
      // variantes *Live, sem histórico).
      let resizingDrawingId: string | null = null
      let resizingDrawingCorner: Corner | null = null
      let resizingDrawingSnapshot: MapData | null = null
      let resizingTokenId: string | null = null
      let resizingTokenSnapshot: MapData | null = null
      let resizingPropId: string | null = null
      let resizingPropCorner: Corner | null = null
      let resizingPropSnapshot: MapData | null = null
      // N3 "ferramenta de seleção de área" — ponto inicial do marquee
      // (coordenadas de mundo), e o snapshot/último-ponto do arrasto do grupo
      // já fechado, mesmo padrão de bodyDragLastPoint/roomCornerDragSnapshot.
      let areaMarqueeStart: Point | null = null
      let areaSelectionDragBefore: MapData | null = null
      let areaSelectionDragLastPoint: Point | null = null
      // A4 — arrasto do rótulo da Sala. Offset absoluto a partir do ponto e
      // do offset do pointerdown (não delta acumulado), então o arredondamento
      // não soma erro ao longo do gesto. Snapshot fecha um Ctrl+Z só.
      let roomLabelDragId: string | null = null
      let roomLabelDragSnapshot: MapData | null = null
      let roomLabelDragStartPoint: Point | null = null
      let roomLabelDragStartOffset: Point | null = null
      const finishRoomLabelDrag = () => {
        if (roomLabelDragSnapshot) useMapStore.getState().commitDragHistory(roomLabelDragSnapshot)
        roomLabelDragId = null
        roomLabelDragSnapshot = null
        roomLabelDragStartPoint = null
        roomLabelDragStartOffset = null
      }

      /**
       * O nome de um cômodo não sai do cômodo.
       *
       * Prende o CENTRO do rótulo à caixa do polígono da sala e devolve o
       * offset (relativo à âncora, `roomLabelAnchor`) que corresponde a esse
       * ponto preso. Antes disto o arrasto do nome era livre: no passeio de
       * 17/09/2026 o rótulo de um quarto acabou desenhado por cima do quarto
       * vizinho, e quem lia o mapa passava a ler o nome errado na sala errada.
       *
       * Prende o centro, não a caixa do texto: um nome comprido numa sala
       * pequena não cabe inteiro de jeito nenhum, e encolher o alcance até a
       * caixa caber tiraria do mestre posições legítimas perto da parede.
       * Com o centro dentro da sala o nome sempre pertence visualmente a ela.
       */
      const clampRoomLabelOffset = (region: Region | undefined, offset: Point): Point => {
        const arredondado = { x: Math.round(offset.x), y: Math.round(offset.y) }
        if (!region || region.points.length === 0) return arredondado
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const p of region.points) {
          if (p.x < minX) minX = p.x
          if (p.x > maxX) maxX = p.x
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
        }
        const anchor = roomLabelAnchor(region.points)
        const preso = (valor: number, menor: number, maior: number) => Math.min(maior, Math.max(menor, valor))
        return {
          x: Math.round(preso(anchor.x + arredondado.x, minX, maxX) - anchor.x),
          y: Math.round(preso(anchor.y + arredondado.y, minY, maxY) - anchor.y),
        }
      }

      // Onda 1, item 3 (Frente F, "rede de segurança do undo") — snapshot de
      // ANTES do gesto pra fechar mover-corpo de Token/Prop/Wall/Region/
      // Stair/Drawing num Ctrl+Z só, mesmo padrão de curveDragSnapshot/
      // roomCornerDragSnapshot acima. `bodyDragSnapshot` é COMPARTILHADO
      // pelos 4 modos `dragging-{wall,region,stair,line}-body` — espelha
      // `bodyDragLastPoint`, que o arquivo já compartilha entre eles.
      let tokenDragSnapshot: MapData | null = null
      let propDragSnapshot: MapData | null = null
      let bodyDragSnapshot: MapData | null = null
      let pinDragSnapshot: MapData | null = null

      // Uma passada de borracha = UM Ctrl+Z. `eraseGestureSnapshot` é o `map`
      // de ANTES do pointerdown; `eraseGesturePast`/`eraseGestureFuture` são
      // as pilhas de histórico daquele instante, restauradas depois de CADA
      // corte do arrasto (ver `eraseDuringGesture`) para que os N cortes
      // intermediários não virem N entradas de undo. Mesmo par
      // "snapshot no pointerdown + commitDragHistory no pointerup" dos
      // arrastos acima — a diferença é que as actions de apagar da store
      // (`removeWall`, `erasePartOfDrawing`, …) não têm variante "live", então
      // o desfazer é desfeito aqui em vez de nunca acontecer lá.
      let eraseGestureSnapshot: MapData | null = null
      let eraseGesturePast: MapData[] | null = null
      let eraseGestureFuture: MapData[] | null = null
      /**
       * A passada atual já avisou que a borracha não apaga chão? Um arrasto
       * sobre o piso chama `eraseAt` a cada pointermove; sem esta trava o
       * aviso reapareceria a cada micro-movimento depois de dispensado.
       */
      let eraseGestureAvisouChao = false

      // Onda 1, item 1 (cursor vivo) — estado de hover em `mode === 'idle'`,
      // recalculado a cada pointermove ocioso (ver `resolveHoverAtIdle`
      // abaixo). Item 8 (pan universal) — Espaço pressionado, maior
      // prioridade que qualquer ferramenta/hover.
      let hoverKind: HoverKind = 'none'
      let hoverCorner: ResizeCorner | null = null
      // Onda 2, item 15 (Frente B) — entidade (kind+id) sob o cursor em
      // `mode === 'idle'`, `null` fora dela ou quando já é a seleção atual.
      let hoverTarget: HoverTarget | null = null
      let spaceHeld = false
      // 17/09/2026 — a pessoa já moveu a vista pelo botão do meio ou por
      // Espaço+arrastar pelo menos uma vez nesta sessão do canvas. A dica
      // dentro do marquee ("Espaço ou botão do meio move a vista") existe
      // porque o arrasto no vazio deixou de panar; quem já achou o caminho
      // não precisa mais dela, e dica que insiste depois de aprendida vira
      // ruído em cima do próprio gesto.
      let panPathLearned = false

      /**
       * RÓTULO RECÉM-CRIADO RECEBENDO O TECLADO (achado 2 do passeio de
       * 20/09/2026; jornada `texto-recebe-o-que-se-digita`). Com a ferramenta
       * Texto, clicar no mapa criava um rótulo escrito "Rótulo" e NADA ligava
       * o teclado a ele: cada letra caía em `resolveShortcut` e virava atalho
       * de ferramenta (S=Escada, A=Polígono). Quem digitava `SAIDA` escrevia
       * nada e trocava de ferramenta quatro vezes, sem aviso nenhum.
       *
       * A trava mora AQUI e não em `lib/keymap.ts` de propósito: a guarda de
       * lá (`isEditableTarget`) só reconhece INPUT/TEXTAREA/SELECT, e o rótulo
       * é um `PIXI.Text` desenhado no canvas, não um campo do DOM. Quem sabe
       * que existe um rótulo em edição é este módulo — e só enquanto ele
       * souber disso a letra deixa de ser atalho. Fora da edição
       * (`textEditingId === null`, o estado normal), nada muda: a tecla segue
       * exatamente o mesmo caminho de antes.
       */
      let textEditingId: string | null = null
      /**
       * O conteúdo com que o rótulo nasceu ("Rótulo") ainda está inteiro
       * "selecionado": a próxima letra o SUBSTITUI, em vez de se somar a ele.
       * É a convenção de Excalidraw e Figma — quem crava e digita `SAIDA`
       * termina com `SAIDA`, não com `RótuloSAIDA`.
       */
      let textEditingReplacesAll = false

      const endTextEditing = () => {
        textEditingId = null
        textEditingReplacesAll = false
      }

      /**
       * Enquanto o rótulo recém-criado edita, letra é letra e não atalho.
       * Devolve `true` quando consumiu a tecla — aí `onKeyDown` para ali e
       * `resolveShortcut` nem chega a ser consultado. Devolve `false` quando
       * a tecla não é digitação (ou quando não há mais edição de pé), e a
       * tecla segue o caminho normal de atalho.
       */
      const handleTextEditingKey = (event: KeyboardEvent): boolean => {
        const id = textEditingId
        if (id === null) return false

        // O rótulo pode ter sumido debaixo da edição — um Ctrl+Z no meio da
        // digitação desfaz a própria criação. Escrever num id morto seria
        // silêncio puro: a edição morre junto e a tecla volta a valer.
        const label = useMapStore.getState().map.drawings.find((d) => d.id === id)
        if (label === undefined || label.kind !== 'text') {
          endTextEditing()
          return false
        }

        // A edição vale só enquanto o rótulo continua sendo O selecionado. Se
        // a seleção mudou por outro caminho (Ctrl+A, painel de camadas), quem
        // digita não está mais escrevendo nele e a tecla volta a ser atalho.
        const { selection } = useMapStore.getState()
        const primeiro = selection.length === 1 ? selection[0] : undefined
        if (primeiro === undefined || primeiro.kind !== 'drawing' || primeiro.id !== id) {
          endTextEditing()
          return false
        }

        // Ctrl/Cmd seguem globais: Ctrl+Z, Ctrl+S e Ctrl+O valem digitando,
        // como valem dentro de qualquer campo de texto do painel.
        if (event.ctrlKey || event.metaKey) return false

        const escrever = (texto: string) => {
          useMapStore.getState().updateTextLabel(id, { text: texto })
          textEditingReplacesAll = false
        }

        // Enter e Escape FECHAM a edição — daí em diante a letra é atalho de
        // novo. São consumidos: o Enter reacionaria o botão da barra que ainda
        // tem o foco, e o Escape largaria a seleção no mesmo gesto em que
        // fecha a edição (dois efeitos numa tecla só).
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          endTextEditing()
          return true
        }

        // Backspace e Delete NÃO podem cair no `deleteSelected`: o selecionado
        // é justamente o rótulo que está sendo escrito, e apagá-lo inteiro no
        // meio da digitação é o pior desfecho possível. Backspace tira a
        // última letra; Delete não tem para onde apagar (não há cursor de
        // texto no mapa) e fica sem efeito, de propósito.
        if (event.key === 'Backspace') {
          event.preventDefault()
          escrever(textEditingReplacesAll ? '' : label.text.slice(0, -1))
          return true
        }
        if (event.key === 'Delete') {
          event.preventDefault()
          return true
        }

        // Só tecla que PRODUZ caractere entra no rótulo. `key.length === 1`
        // cobre letra, dígito, pontuação e o espaço (que fora daqui armaria o
        // pan); deixa de fora `ArrowLeft`, `Tab`, `F5` e companhia, que seguem
        // para quem já as tratava.
        if (event.key.length !== 1) return false
        event.preventDefault()
        escrever(textEditingReplacesAll ? event.key : label.text + event.key)
        return true
      }

      const toWorldPoint = (globalX: number, globalY: number) => ({
        x: (globalX - camera.x) / camera.scale,
        y: (globalY - camera.y) / camera.scale,
      })

      /**
       * `target` escolhe QUAL toggle de `snapTargets` consultar (Token gruda no
       * centro da célula; Parede/Objeto — e todo o resto sem toggle próprio,
       * ver CONTRATO do A4 — grudam no vértice/aresta, via snapPointForTarget).
       * `altKey` INVERTE o resultado desse toggle só neste gesto: Alt segurado
       * desliga o snap se estava ligado, e liga se estava desligado — mesmo
       * padrão de "modificador temporário" que Ctrl já usa pra travar ângulo
       * (constrainToAngleStep). Os dois parâmetros são OBRIGATÓRIOS de
       * propósito (PLANO-FASES.md §5, risco nº 4): assinatura opcional
       * deixaria um call site esquecido compilar limpo e silenciosamente sem
       * snap por alvo nem Alt — obrigatório faz o `tsc --noEmit` listar todo
       * call site que ainda não foi atualizado.
       *
       * `tokenCells` é o lado da ficha em quadrados, e é o ÚNICO parâmetro com
       * default aqui: `1` é exatamente o que todo call site fazia antes de
       * existir escolha de tamanho, então quem não passa nada continua com o
       * comportamento de sempre. Só a ficha de lado PAR muda de regra — ela
       * assenta na linha da grade, não no centro da célula (`seatTokenCenter`,
       * lib/tokenSize.ts), senão um disco de 2 quadrados fica meio fora dos
       * quatro quadrados que deveria cobrir.
       */
      const applySnap = (point: Point, gridSize: number, target: SnapTargetKind, altKey: boolean, tokenCells = 1): Point => {
        const { map, snapTargets } = useMapStore.getState()
        const enabled = altKey ? !snapTargets[target] : snapTargets[target]
        if (!enabled) return point
        const snapped = snapPointForTarget(target, map.gridShape, point.x, point.y, gridSize)
        // Só na grade quadrada: hex e triângulo têm centro de célula próprio
        // (`snapToHexGrid`/`triGrid.ts`), e "linha da grade" ali não é a
        // mesma coisa.
        if (map.gridShape !== 'square') return snapped
        return seatTokenCenter(point, snapped, gridSize, tokenCells)
      }

      /**
       * Onda 3, item 13 (Alt+arrastar duplica) — clona `input` com offset
       * ZERO (a cópia nasce exatamente sobre o original), insere no mapa via
       * `insertClonedEntityLive` (SEM histórico — quem fecha o Ctrl+Z é o
       * `commitDragHistory` do pointerup do gesto de arrasto já em
       * andamento, com o snapshot de ANTES desta clonagem) e devolve o id da
       * cópia, pra o chamador arrastar ELA em vez do original.
       *
       * Nota sobre conflito com Alt="inverter snap" (já usado por
       * `applySnap` em todo drag de corpo): os dois significados NÃO se
       * atropelam porque são lidos em momentos diferentes do mesmo gesto —
       * esta função só é chamada UMA VEZ, no pointerdown, decidindo se o
       * arrasto que está para começar duplica ou não; o `event.altKey` que os
       * pointermoves seguintes passam pra `applySnap` continua sendo lido a
       * cada frame, do jeito que já era antes desta fase, sem saber (nem
       * precisar saber) que o gesto começou como uma duplicação. Segurar Alt
       * durante o arrasto inteiro (comum neste tipo de gesto) então tem os
       * dois efeitos ao mesmo tempo — dispara a cópia no início E inverte o
       * snap durante o arrasto — mas nenhum dos dois cancela o outro.
       */
      const cloneForAltDrag = (input: CloneableEntity): string => {
        const cloned = cloneEntity(input, { dx: 0, dy: 0 })
        // Sala: as paredes vinculadas vão junto (senão a cópia sai só com o chão).
        useMapStore.getState().insertClonedEntityLive(cloned, input.kind === 'region' ? input.entity.id : undefined)
        return cloned.entity.id
      }

      /**
       * Os 3 caminhos de Sala (retângulo, circular, polígono) passam por aqui:
       * sala desenhada dentro de outra vira sub-sala (cor da mãe, sem parede
       * duplicada, desenhada por cima) — `lib/roomNesting.ts`. Com "Criar sala
       * dentro" armado e a sala fora da mãe, avisa e cria sala normal.
       */
      const addRoomWithNesting = (draft: { region: Region; walls: Wall[] }) => {
        const store = useMapStore.getState()
        const placed = placeNewRoom(store.map.regions, store.map.walls, draft, store.pendingParentRoomId)
        store.addRoom(placed.region, placed.walls)
        store.setPendingParentRoom(null)
        if (placed.missedParent) {
          const name = placed.missedParent.room?.name.trim() ?? ''
          useToastStore.getState().push('info', name === '' ? 'A sala ficou fora da sala' : `A sala ficou fora de ${name}`)
        }
      }

      /**
       * `findSelectableAt` (lib/selectionHitTest.ts) já filtra por CAMADA
       * OCULTA (`map.hiddenLayers`, o toggle do LayersPanel) — mas não pelo
       * campo `hidden` POR ITEM (Token/Prop, F3, agente C4, outro eixo:
       * "oculto no editor" sem estar numa camada escondida) nem por CAMADA
       * TRAVADA (`map.lockedLayers`, Onda 4, Frente D — CONTRATO: "item numa
       * camada travada continua VISÍVEL mas não pode ser selecionado nem
       * movido"). `lib/selectionHitTest.ts` é de outro agente (fora da minha
       * lista de escrita) — filtrar ANTES de entrar nele, em vez de editá-lo,
       * mantém a mudança inteira dentro deste arquivo. Os 7 `kind` passam
       * pelo mesmo `canInteractInLayer` que `lib/areaSelection.ts` já usa
       * pro marquee — mesma regra, dois caminhos de seleção.
       */
      const hitTestMap = (map: MapData): MapData => ({
        ...map,
        walls: map.walls.filter((wall) => canInteractInLayer(wall, wallLayer(wall), map.lockedLayers)),
        lights: map.lights.filter((light) => canInteractInLayer(light, lightLayer(light), map.lockedLayers)),
        regions: map.regions.filter((region) => canInteractInLayer(region, regionLayer(region), map.lockedLayers)),
        stairs: map.stairs.filter((stair) => canInteractInLayer(stair, stairLayer(stair), map.lockedLayers)),
        // Drawing não tem campo `locked` no schema (types/map.ts) — mesmo
        // motivo documentado em lib/areaSelection.ts (selectEntitiesInArea):
        // só o eixo de CAMADA travada se aplica, não `canInteractInLayer`
        // (que exige `Lockable`, `.locked` opcional).
        drawings: map.drawings.filter((drawing) => !isLayerLocked(map.lockedLayers, drawingLayer(drawing))),
        tokens: map.tokens.filter((token) => !isHidden(token) && canInteractInLayer(token, tokenLayer(token), map.lockedLayers)),
        props: map.props.filter((prop) => !isHidden(prop) && canInteractInLayer(prop, propLayer(prop), map.lockedLayers)),
      })

      /**
       * Clique de seleção: igual a `hitTestMap`, mas token TRAVADO e token
       * OCULTO NO EDITOR continuam clicáveis — é o único jeito de chegar aos
       * toggles do painel para destravar ou mostrar. Travado não se move (o
       * arrasto abaixo já checa `canInteract`); oculto aparece como fantasma
       * (`tokensRenderer.ts`). Só a camada travada tira o token do clique.
       * Objeto oculto no editor também fica clicável (fantasma em drawProps.ts);
       * objeto travado segue a regra de antes (`canInteractInLayer`).
       */
      /**
       * Pino sob o ponto do mundo, respeitando camada oculta/travada e o
       * "oculto no editor" do próprio pino. A folga é em px de TELA dividida
       * pelo zoom: longe o pino fica pequeno, mas o alvo do dedo não encolhe
       * junto. Mesma ideia do `DOOR_TAP_TOLERANCE_PX` do lado do jogador.
       */
      const pinAt = (map: MapData, point: Point) => {
        if (isLayerLocked(map.lockedLayers, 'anotacoes')) return null
        const clickable = visiblePins(map.pins, map.hiddenLayers).filter((pin) => !pin.hidden)
        return findPinAt(clickable, point, PIN_TAP_TOLERANCE_PX / camera.scale)
      }

      /**
       * Abre o pino no painel e, se ele não estiver travado, começa o arrasto
       * que o leva para outro lugar (pedido do usuário em 18/09/2026: "poder
       * mover ele depois de colocado").
       *
       * Seleciona SEMPRE, mesmo travado — é como a pessoa alcança o
       * interruptor "Travado" do painel para destravar; só o MODO de arrasto é
       * condicionado a `canInteract`, exatamente como o Token faz mais abaixo.
       * Pino travado fica com `mode` parado em 'idle' e nenhum branch de
       * pointermove reage: ele não se move, mas continua clicável.
       */
      const abrirETalvezArrastarPino = (map: MapData, pin: Pin, worldPoint: Point) => {
        useMapStore.getState().setSelectedPin(pin.id)
        if (!canInteract(pin)) {
          mode = 'idle'
          return
        }
        mode = 'dragging-pin'
        // Snapshot de ANTES do gesto: fecha o arrasto inteiro (dezenas de
        // pointermove via `movePinLive`, que não empurra histórico) num
        // Ctrl+Z só no pointerup/pointerupoutside.
        pinDragSnapshot = map
        draggingPinId = pin.id
        pinDragOffset = { x: pin.x - worldPoint.x, y: pin.y - worldPoint.y }
      }

      const clickSelectMap = (map: MapData): MapData => ({
        ...hitTestMap(map),
        tokens: map.tokens.filter((token) => !isLayerLocked(map.lockedLayers, tokenLayer(token))),
        props: map.props.filter((prop) => canInteractInLayer(prop, propLayer(prop), map.lockedLayers)),
        // Região/Sala TRAVADA continua clicável, pelo mesmo motivo do token
        // travado acima — e por um que só aparece aqui: Região é o kind mais
        // EMBAIXO da cadeia de prioridade (selectionHitTest.ts), então tirá-la
        // do array não deixa o clique sem alvo, deixa o clique pegar o que
        // está por baixo. Pedido de 18/09/2026: o mestre tinha uma Sala-ilha
        // sobre o chão-mar; clicar na ilha travada selecionava o mar e o
        // arrasto levava o MAR junto, sem caminho de volta pra destravar.
        // Continua não se movendo — quem cobra isso é `canInteract` em cada
        // branch de arrasto/edição de vértice abaixo.
        regions: map.regions.filter((region) => !isLayerLocked(map.lockedLayers, regionLayer(region))),
      })

      /**
       * Agrupar objetos (Ctrl+G): o que um clique em `item` seleciona — o grupo
       * inteiro ou só ele. Membro alcançável é o que o Ctrl+A pegaria (camada
       * visível e destravada, item não travado, token não oculto): membro
       * apagado ou travado fica onde está, como fica no laço. Sem grupo no
       * mapa, nem varre o mapa.
       */
      const selectionOnClick = (map: MapData, item: SelectionItem): SelectionSet => {
        const groups = useMapStore.getState().itemGroups[map.id] ?? NO_GROUPS
        if (groups.length === 0) return selectionOfItem(item)
        const reachable = selectionFromAreaSelection(selectEntitiesInArea(hitTestMap(map), SELECT_ALL_RECT))
        return expandToGroup(groups, item, (member) => selectionHas(reachable, member))
      }

      /**
       * "O círculo da borracha encostou no CONTORNO desta Região/Sala?" — as
       * `n` arestas de `region.points`, cada uma testada como o segmento que
       * é. Diferente de `eraseDecisionForRegion` (lib/eraseGeometry.ts), que
       * responde `remove` também com o círculo inteiramente DENTRO do
       * polígono; ver a docstring de `eraseAt` logo abaixo para o porquê de a
       * borracha "Só uma parte" precisar da leitura estrita.
       *
       * Reusa `eraseDecisionForWall` com uma parede-sonda em vez de repetir a
       * conta círculo↔segmento aqui: é a MESMA tolerância que o ramo `wall` do
       * `eraseAt` usa duas linhas adiante, e manter uma implementação só evita
       * que borda de Sala e parede de Sala passem a responder diferente. Os
       * campos da sonda fora da geometria (`id`, `blocksLight`, `blocksMove`,
       * `door`) não são lidos por `eraseDecisionForWall` — ela só olha
       * `x1,y1,x2,y2` — e a sonda nunca entra no `map`.
       *
       * Região com menos de 3 pontos (não deveria existir; defensivo, igual ao
       * guard de `eraseDecisionForRegion`) não tem contorno fechado: nunca some
       * por toque.
       */
      const circleTouchesRegionOutline = (region: Region, center: Point, radius: number): boolean => {
        const n = region.points.length
        if (n < 3) return false
        return region.points.some((from, index) => {
          const to = region.points[(index + 1) % n]
          const probe: Wall = {
            id: 'erase-outline-probe',
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            blocksLight: false,
            blocksMove: false,
            door: null,
          }
          return eraseDecisionForWall(probe, center, radius) === 'remove'
        })
      }

      /**
       * Hit-test da borracha: reaproveita a mesma cadeia de prioridade da
       * ferramenta "Selecionar" (token > prop > light > drawing > wall >
       * region — drawing já cobre texto/linha/círculo/curva/pincel) e decide
       * o que fazer com o que estiver mais "por cima" sob o cursor, se houver
       * algo.
       *
       * Fase 5, N1 "apagar parte ou objeto todo": `eraseMode === 'objeto'`
       * (default, comportamento IDÊNTICO ao de antes desta fase) remove a
       * entidade inteira, como sempre. `eraseMode === 'parte'` recorta
       * freehand/curve/line pelo círculo (`eraseFromDrawing`,
       * lib/eraseGeometry.ts) e, pros kinds sem recorte possível
       * (wall/region/stair/token/prop — formas fechadas/segmento único),
       * decide remove/mantém pelo mesmo círculo em vez de remover
       * incondicionalmente. Light fica de fora da tabela de decisão do
       * agente D (não documentada no contrato); cai no comportamento
       * "objeto inteiro" mesmo em modo "parte" — mais seguro que não fazer
       * nada com o clique.
       *
       * CONTORNO, NÃO INTERIOR (correção do gesto "apaguei um risco dentro do
       * saguão e a sala inteira sumiu"): `eraseDecisionForRegion` responde por
       * `circleOverlapsPolygon`, que trata "círculo CONTIDO no polígono" como
       * toque. Numa Sala isso significa que qualquer pincelada no MEIO do
       * cômodo — justamente onde estão os riscos que a borracha "Só uma parte"
       * existe para recortar — decidia `remove`, e `mapFactory.removeRegion`
       * apaga em cascata a subárvore inteira de Salas MAIS todas as paredes
       * com `regionId` nelas (mapFactory.ts:144-151) — ou seja, o cômodo, as
       * paredes dele e as portas cravadas nessas paredes, de uma vez. O menu
       * da ferramenta promete outra coisa: "formas fechadas somem só se o
       * círculo TOCAR". Tocar é encostar no contorno. `circleTouchesRegionOutline`
       * abaixo implementa exatamente essa leitura, e só ela, no modo "parte" —
       * e, para SALA (`region.room`), nem isso: ver o comentário no ramo
       * `region` do `eraseAt`. Arrastar sobre a borda continua apagando a
       * PAREDE encostada, que ganha o hit-test antes da região (wall > region
       * em `findSelectableAt`); Região solta, sem parede, segue sumindo ao
       * encostar no próprio contorno. O modo "objeto" (default) não muda em
       * nada — lá o clique é deliberado e removedor por definição.
       */
      const eraseAt = (point: Point) => {
        const { map, eraseMode } = useMapStore.getState()
        const hit = findSelectableAt(hitTestMap(map), point)
        if (!hit) {
          // Nada apagável aqui, mas pode haver CHÃO: `findSelectableAt` nunca
          // devolve peça de chão, que só vira alvo por `floorHitAt`. A
          // borracha não apaga chão por decisão (22/09/2026) — só que calar
          // fazia a pessoa achar que errou o alvo. Vale nos dois modos: nenhum
          // deles alcança chão.
          if (floorHitAt(map, point)) avisarQueBorrachaNaoApagaChao()
          return
        }

        if (eraseMode === 'parte') {
          const radius = map.grid * ERASE_PART_RADIUS_RATIO
          if (hit.kind === 'drawing') {
            useMapStore.getState().erasePartOfDrawing(hit.id, point, radius)
            return
          }
          if (hit.kind === 'wall') {
            const wall = map.walls.find((w) => w.id === hit.id)
            if (wall && eraseDecisionForWall(wall, point, radius) === 'remove') useMapStore.getState().removeWall(hit.id)
            return
          }
          if (hit.kind === 'region') {
            const region = map.regions.find((r) => r.id === hit.id)
            // SALA NUNCA MORRE AQUI (`region.room`): apagar uma Sala é apagar o
            // chão, as paredes dela, as portas cravadas nessas paredes e a
            // subárvore de sub-salas (`mapFactory.removeRegion`) — o oposto de
            // "só uma parte", em qualquer leitura. Passada de borracha que
            // encosta na borda continua apagando a PAREDE encostada (o ramo
            // `wall` acima ganha o hit-test antes deste), que é de fato uma
            // parte da sala; o cômodo inteiro sai pelo modo "Objeto inteiro" ou
            // por selecionar e apagar, onde o gesto é deliberado. Região SOLTA
            // (sem `room`) segue a regra de forma fechada prometida no menu:
            // some ao tocar o contorno.
            if (region && !region.room && circleTouchesRegionOutline(region, point, radius)) {
              useMapStore.getState().removeRegion(hit.id)
            }
            return
          }
          if (hit.kind === 'stair') {
            const stair = map.stairs.find((s) => s.id === hit.id)
            if (stair && eraseDecisionForStair(stair, point, radius) === 'remove') useMapStore.getState().removeStair(hit.id)
            return
          }
          if (hit.kind === 'token') {
            const token = map.tokens.find((t) => t.id === hit.id)
            if (token && eraseDecisionForToken(token, point, radius) === 'remove') useMapStore.getState().removeToken(hit.id)
            return
          }
          if (hit.kind === 'prop') {
            const prop = map.props.find((p) => p.id === hit.id)
            if (prop && eraseDecisionForProp(prop, point, radius) === 'remove') useMapStore.getState().removeProp(hit.id)
            return
          }
          // Sobrou `light` — sem função de decisão dedicada, ver docstring
          // acima. O `if` explícito (em vez de cair direto no removeLight) é
          // para que um `kind` novo em `SelectionKind`, ou um `floor` vindo de
          // `findSelectableAt`, não seja apagado como se fosse uma luz: id de
          // outra entidade passado para `removeLight` apagaria a coisa errada
          // em silêncio. Kind desconhecido não apaga nada.
          if (hit.kind === 'light') useMapStore.getState().removeLight(hit.id)
          return
        }

        // Sem `floor` na tabela: `findSelectableAt` nunca devolve chão, então a
        // entrada `removeFloorPiece` que existia aqui nunca rodava — e se um
        // dia rodasse, contradiria a decisão de a borracha não apagar chão. O
        // `if` abaixo mantém a tabela exaustiva no tipo sem fingir que o caso
        // existe; chão é respondido pelo aviso no topo desta função.
        const removers: Record<Exclude<SelectionKind, 'floor'>, (id: string) => void> = {
          token: useMapStore.getState().removeToken,
          wall: useMapStore.getState().removeWall,
          light: useMapStore.getState().removeLight,
          region: useMapStore.getState().removeRegion,
          stair: useMapStore.getState().removeStair,
          prop: useMapStore.getState().removeProp,
          drawing: useMapStore.getState().removeDrawing,
        }
        if (hit.kind === 'floor') return
        removers[hit.kind](hit.id)
      }

      /**
       * Mostra, uma vez por passada e sem empilhar, que a borracha não apaga
       * chão e por onde ele sai. `instrucao` porque a frase pede uma ação (ir
       * a outra ferramenta) e precisa ficar na tela enquanto a pessoa a
       * cumpre (`lib/erroQueEnsina.ts`); como esse tipo não some sozinho, o
       * mesmo texto já na fila não entra de novo — clicar três vezes no piso
       * não deixa três cartões iguais.
       */
      const avisarQueBorrachaNaoApagaChao = () => {
        if (eraseGestureAvisouChao) return
        eraseGestureAvisouChao = true
        const toasts = useToastStore.getState()
        if (toasts.toasts.some((toast) => toast.text === AVISO_BORRACHA_NAO_APAGA_CHAO)) return
        toasts.push('instrucao', AVISO_BORRACHA_NAO_APAGA_CHAO)
      }

      /**
       * Abre a passada de borracha: guarda o mapa e as duas pilhas de
       * histórico de ANTES do primeiro corte. Chamado no pointerdown da
       * ferramenta, antes de qualquer `eraseAt`.
       */
      const beginEraseGesture = () => {
        const { map, past, future } = useMapStore.getState()
        eraseGestureSnapshot = map
        eraseGesturePast = past
        eraseGestureFuture = future
        eraseGestureAvisouChao = false
      }

      /**
       * Corte de borracha DENTRO de uma passada: apaga de verdade, mas devolve
       * `past`/`future` ao estado de antes da passada.
       *
       * Por quê (passeio cego de 16/09/2026, "apaguei um risco e não consegui
       * desfazer"): cada action de apagar da store passa por `withHistory`, que
       * empurra uma entrada por chamada — e o pointermove chama `eraseAt` a
       * cada micro-movimento. Um arrasto curto sobre um traço freehand vira
       * dezenas de entradas, uma por pedacinho recortado: os três Ctrl+Z que a
       * pessoa deu desfizeram três pedacinhos (nada visível volta) e, com o
       * `HISTORY_CAP` de 50 da store estourado pela própria passada, as
       * entradas ANTERIORES ao gesto tinham sido descartadas — daí o botão
       * Desfazer esmaecido com o mapa ainda mutilado. Restaurar as pilhas a
       * cada corte resolve os dois: a passada não consome o histórico antigo, e
       * o `finishEraseGesture` fecha tudo numa entrada só.
       *
       * Restaura a REFERÊNCIA dos arrays de antes (nunca cópia): `past`/`future`
       * só são substituídos, nunca mutados, na store inteira.
       */
      const eraseDuringGesture = (point: Point) => {
        eraseAt(point)
        if (eraseGesturePast === null || eraseGestureFuture === null) return
        useMapStore.setState({ past: eraseGesturePast, future: eraseGestureFuture })
      }

      /**
       * Fecha a passada num Ctrl+Z só. `commitDragHistory` não faz nada quando
       * o mapa é o MESMO objeto do snapshot — passada que não apagou nada não
       * gasta entrada de undo nem descarta o redo pendente.
       */
      const finishEraseGesture = () => {
        if (eraseGestureSnapshot !== null) useMapStore.getState().commitDragHistory(eraseGestureSnapshot)
        eraseGestureSnapshot = null
        eraseGesturePast = null
        eraseGestureFuture = null
      }

      /**
       * Chão fica por baixo de tudo: só vira alvo de clique quando nada acima
       * dele (`findSelectableAt`) foi acertado. Camada/hidden/locked já são
       * tratados em `findFloorPieceAt`.
       */
      const floorHitAt = (map: MapData, point: Point): SelectableHit | null => {
        const piece = findFloorPieceAt(map, point)
        return piece ? { kind: 'floor', id: piece.id, draggable: true } : null
      }

      const clearDrafts = () => {
        wallDraftStart = null
        regionDraftPoints = []
        regionDraftStart = null
        regionDraftRawStart = null
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        rectDraftStart = null
        ellipseDraftCenter = null
        polygonDraftPoints = []
        pathDraftPoints = []
        lightDraftCenter = null
        lightDraftRawStart = null
        curveDraftPoints = []
        roomDraftStart = null
        concealDraftStart = null
        concealDraftRawStart = null
        polygonDraftCenter = null
        stairDraftStart = null
        measureDraftStart = null
        floorDraftStart = null
        corridorDraftPoints = []
        blocoCells = null
        blocoUltimoPonto = null
        draftGraphics.clear()
        angleIndicatorRenderer.hide()
        measurementIndicatorRenderer.hide()
        tokenDragDistanceRenderer.hide()
        tokenDragOrigin = null
        tokenDragLastShown = null
        dimensionLabelRenderer.hide()
        hoverGraphics.clear()
        hoverTarget = null
      }

      /**
       * Peça-rascunho do arrasto da ferramenta Chão, com o MESMO snap/Shift do
       * preview e do commit (Shift = quadrado/círculo, igual Retângulo/Elipse).
       * `piece: null` = arrasto ainda pequeno demais para virar peça.
       */
      const floorDraftFromDrag = (start: Point, rawEnd: Point, shiftKey: boolean, altKey: boolean) => {
        const { map, floorShapeKind, floorOp, floorPolygonSides } = useMapStore.getState()
        // Corredor, pincel e balde não nascem de um arrasto de dois pontos — o
        // tipo (`isFloorDragShape`) é quem garante que eles não chegam abaixo.
        if (!isFloorDragShape(floorShapeKind)) return null
        const snapped = applySnap(rawEnd, map.grid, 'wall', altKey)
        const end = floorShapeKind === 'polygon' ? snapped : constrainDraft(start, snapped, floorShapeKind, { shift: shiftKey, alt: altKey })
        const result = buildFloorShapeFromDrag(floorShapeKind, start, end, floorPolygonSides)
        const piece = result ? buildFloorPiece('draft', result.shape, floorOp, result.rotation) : null
        const dimension: DimensionDraft =
          floorShapeKind === 'rect'
            ? { tool: 'rect', start, end }
            : floorShapeKind === 'ellipse'
              ? { tool: 'ellipse', center: start, end }
              : { tool: 'polygon-room', center: start, end, sides: clampFloorPolygonSides(floorPolygonSides) }
        return { end, piece, dimension }
      }


      /**
       * Acumula as células do trecho percorrido pelo pincel e redesenha a
       * prévia. Amostra o caminho inteiro de `de` até `ate` (e não só o ponto
       * de chegada): o navegador entrega pointermove em saltos, e sem isso um
       * arrasto rápido deixaria buraco no traço.
       */
      const acumularBlocos = (de: Point, ate: Point) => {
        if (!blocoCells) return
        const { map, floorBrushSize } = useMapStore.getState()
        for (const bloco of blocosDoTraco(de, ate, blocoCellSize, floorBrushSize)) {
          blocoCells.set(chaveDoBloco(bloco.col, bloco.row), bloco)
        }
        drawBlocosDraft(draftGraphics, [...blocoCells.values()], blocoCellSize, map.floorStyle.fillColor, blocoApagando)
      }

      /** Fecha o traço do pincel: uma peça nova (pintando) ou um apagar (botão direito ou Subtrair). */
      const finishBlocos = () => {
        const cells = blocoCells ? [...blocoCells.values()] : []
        const cell = blocoCellSize
        const apagando = blocoApagando
        blocoCells = null
        blocoUltimoPonto = null
        draftGraphics.clear()
        if (cells.length === 0) return
        if (apagando) {
          useMapStore.getState().eraseFloorBlocks(cells, cell)
          return
        }
        // O traço inteiro é UMA peça: é ela que o painel seleciona para ganhar
        // cor própria, e é por isso que dois caminhos têm duas cores.
        const shape = buildBlocosShape(cell, cells)
        if (shape) useMapStore.getState().addFloorPiece(buildFloorPiece(crypto.randomUUID(), shape, 'add'))
      }

      /**
       * Balde: enche de chão a área fechada em volta do clique. Área aberta (o
       * vazio escapa pela borda do mapa) não tem o que encher — e calar seria
       * repetir o defeito da porta sem parede, então a tela responde.
       */
      const encherAreaFechada = (point: Point) => {
        const { map, addFloorPiece } = useMapStore.getState()
        const piece = baldeNoPonto(map, point, () => crypto.randomUUID())
        if (!piece) {
          useToastStore
            .getState()
            .push('info', 'Nada para encher aqui: o balde só enche área fechada, e esta escapa pela borda do mapa (ou já tem chão).')
          return
        }
        addFloorPiece(piece)
      }

      /** Prévia do corredor: pontos já clicados + cursor; com 1 ponto só marca o ponto. */
      const drawCorridorDraft = (cursor: Point | null) => {
        const { map, floorOp } = useMapStore.getState()
        const points = cursor ? [...corridorDraftPoints, cursor] : corridorDraftPoints
        const shape = buildCorridorShape(points, map.grid * FLOOR_CORRIDOR_WIDTH_RATIO)
        if (!shape) {
          drawRegionDraft(draftGraphics, corridorDraftPoints, null)
          return
        }
        drawFloorDraft(draftGraphics, buildFloorPiece('draft', shape, floorOp), map.floorStyle.fillColor)
      }

      /**
       * Fecha o traçado ponto a ponto — duplo clique OU Enter. Enter existe
       * porque é o que a mão faz depois do último ponto: o passeio cego de
       * 16/09/2026 bateu Enter, nada aconteceu, e o traçado ficou preso na tela
       * sem saída visível. Mesma dupla de saídas que o Chão corredor já tinha
       * (`finishCorridor`). Menos de 3 pontos não é polígono: descarta.
       *
       * O MESMO traçado serve a duas ferramentas (`usaTracadoPontoAPonto`), e é
       * só aqui que elas se separam: Região vira uma Region pelada, Sala livre
       * vira Sala com parede em toda aresta.
       */
      const finishRegion = () => {
        const points = normalizeDraftPolygonPoints(regionDraftPoints)

        if (points.length < 3) {
          clearDrafts()
          return
        }

        if (useMapStore.getState().activeTool === 'roomFree') commitFreeRoom(points)
        else commitRegion(points)
        regionDraftPoints = []
        draftGraphics.clear()
      }

      /**
       * Põe a região no mapa — ponto a ponto (duplo clique/Enter) ou retângulo
       * de um arrasto só, os dois caminhos passam por aqui para não existir
       * duas receitas de "como nasce uma Região".
       *
       * A região NÃO nasce selecionada, ao contrário da Sala e da Escada. Não é
       * esquecimento: `task4-selection-pixel-diff.spec.ts` prova, em pixel, que
       * SELECIONAR uma região muda o que está desenhado (o preenchimento de
       * destaque). Com a região já selecionada ao nascer, o "antes" daquele
       * teste já viria destacado e o clique de seleção não mudaria pixel nenhum
       * — a prova do destaque morreria em silêncio. Quem acabou de desenhar
       * seleciona com um clique; a dor medida no passeio cego era a região não
       * aparecer, não a de ter que clicar nela.
       */
      const commitRegion = (points: Point[]) => {
        const { addRegion, regionFillColor, regionFillPattern } = useMapStore.getState()
        addRegion(buildRegionFromPoints(crypto.randomUUID(), points, 'region', regionFillColor, regionFillPattern))
      }

      /**
       * Põe a Sala de formato livre no mapa — o fim do traçado ponto a ponto
       * quando a ferramenta é `roomFree`. Daqui pra frente ela é uma Sala igual
       * às outras três: passa pelo MESMO `addRoomWithNesting` (sub-sala dentro
       * de sala mãe), nasce selecionada e pede o nome no campo sobre ela mesma,
       * exatamente como a Sala retangular e a Circular — é isso que faz o
       * painel abrir em "Sala" em vez de "Região".
       *
       * Ao contrário da Região, aqui a sala NASCE SELECIONADA de propósito: é a
       * regra das outras Salas (o nome é a primeira coisa que o mestre quer
       * mexer), e o motivo que mantém a Região sem seleção
       * (`task4-selection-pixel-diff.spec.ts` mede o destaque de uma região
       * recém-criada) não alcança Sala nenhuma.
       *
       * `pontos.length` paredes: uma por aresta, inclusive as inclinadas.
       */
      const commitFreeRoom = (points: Point[]) => {
        const { roomFillColor, regionFillPattern } = useMapStore.getState()
        if (!isValidFreeRoomDraft(points)) return
        const wallIds = points.map(() => crypto.randomUUID())
        const result = buildFreeRoomFromPoints(crypto.randomUUID(), wallIds, points, roomFillColor, regionFillPattern)
        addRoomWithNesting(result)
        // Traçado fechado = gesto terminado, volta para Selecionar. As outras
        // Salas são um arrasto só (soltar o botão já termina, e o próximo
        // arrasto é outra sala); esta tem um FIM explícito — Enter ou duplo
        // clique — e depois dele todo clique no mapa viraria canto de um
        // polígono novo: nem dá pra tirar a seleção clicando no vazio, nem dá
        // pra arrastar o que acabou de nascer. `setActiveTool('select')`
        // preserva a seleção (mapStore: "Selecionar mantém"), então o painel
        // continua no que a pessoa acabou de desenhar.
        useMapStore.getState().setActiveTool('select')
        useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: result.region.id }))
        onRoomCreatedRef.current?.(result.region.id)
        if (result.region.room) openNameEditor({ kind: 'room', regionId: result.region.id, value: result.region.room.name })
      }

      /** Duplo clique ou Enter: vira peça se houver 2+ pontos distintos; sempre limpa o rascunho. */
      const finishCorridor = () => {
        const { map, floorOp, addFloorPiece } = useMapStore.getState()
        const shape = buildCorridorShape(corridorDraftPoints, map.grid * FLOOR_CORRIDOR_WIDTH_RATIO)
        if (shape) addFloorPiece(buildFloorPiece(crypto.randomUUID(), shape, floorOp))
        corridorDraftPoints = []
        draftGraphics.clear()
      }

      /**
       * Fecha o Polígono do Desenho e o põe no mapa — duplo clique OU Enter, as
       * mesmas duas saídas que a Região, a Sala livre e o Chão corredor já
       * tinham. Sem uma saída por Enter o traçado só existia como rascunho, e
       * `clearDrafts()` (trocar de ferramenta, Esc) o apagava sem aviso: o
       * desenho sumia da tela e nunca chegou a ser mapa.
       *
       * `normalizeDraftPolygonPoints` é a MESMA normalização da Sala livre, e
       * cobre as duas repetições que nascem do gesto: o duplo clique, que já
       * mandou dois `pointerdown` no mesmo ponto, e o fechamento manual, em que
       * a pessoa clica de volta no primeiro vértice para "amarrar" a figura.
       *
       * Devolve `false` quando ainda não é polígono (menos de 3 cantos), porque
       * as duas saídas discordam do que fazer com traçado curto: o duplo clique
       * descarta (comportamento antigo, preservado), o Enter deixa o rascunho
       * de pé para a pessoa continuar clicando — teclar Enter cedo demais não
       * pode custar o que já foi desenhado.
       */
      const finishPolygon = (): boolean => {
        const points = normalizeDraftPolygonPoints(polygonDraftPoints)
        if (!isValidPolygonDraft(points)) return false

        const { addDrawing, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
        addDrawing(buildPolygonDrawing(crypto.randomUUID(), points, drawColor, drawWidth, drawFilled, drawFillAlpha))
        polygonDraftPoints = []
        draftGraphics.clear()
        return true
      }

      /**
       * Fecha o Caminho e o põe no mapa — duplo clique OU Enter, as mesmas
       * duas saídas do Polígono, da Região e do Chão corredor.
       *
       * A cor e a largura são lidas AQUI, de `pathColor`/`pathWidthCells`, e
       * gravadas no próprio desenho: daí em diante aquele caminho é dono da
       * cor dele, e escolher outra cor para o caminho seguinte não o repinta.
       * `map.grid` converte a largura de células para px de mundo uma única
       * vez, no nascimento (ver `buildPathDrawing`).
       *
       * Devolve `false` quando ainda não há dois pontos, pela mesma razão do
       * Polígono: o duplo clique descarta o traçado curto, o Enter deixa o
       * rascunho de pé para a pessoa continuar clicando.
       */
      const finishPath = (): boolean => {
        const points = normalizeDraftPolygonPoints(pathDraftPoints)
        if (!isValidPathDraft(points)) return false

        const { addDrawing, pathColor, pathWidthCells, map } = useMapStore.getState()
        addDrawing(buildPathDrawing(crypto.randomUUID(), points, pathColor, pathWidthCells, map.grid))
        pathDraftPoints = []
        draftGraphics.clear()
        return true
      }

      /** Prévia do caminho em construção: pontos já clicados + cursor. */
      const drawPathPreview = (cursor: Point | null) => {
        const { pathColor, pathWidthCells, map } = useMapStore.getState()
        drawPathDraft(draftGraphics, pathDraftPoints, cursor, pathColor, pathWidthCells * map.grid)
      }

      /** Rascunho feito clique a clique aberto: Região, Área poligonal, Caminho ou Chão corredor. */
      const hasPointDraft = () =>
        regionDraftPoints.length > 0 || polygonDraftPoints.length > 0 || pathDraftPoints.length > 0 || corridorDraftPoints.length > 0

      /**
       * Quantos cantos o traçado ABERTO desta ferramenta ainda tem, e quantos
       * ela precisa. `null` quando a ferramenta não faz traçado ponto a ponto,
       * ou quando não há rascunho aberto nela.
       *
       * Os mínimos não são inventados aqui: são os mesmos de `finishRegion`
       * (3), `isValidPolygonDraft` (3), `isValidPathDraft` (2) e do corredor,
       * que precisa de dois pontos para ter comprimento.
       */
      /**
       * A ferramenta termina por duplo clique/Enter? É a lista das que
       * desenham clicando ponto a ponto — `floor` entra porque uma das formas
       * dela (o Corredor) é ponto a ponto; as outras formas do Chão nascem de
       * um arrasto e simplesmente não têm traçado aberto para fechar.
       */
      const fazTracadoPontoAPonto = (tool: DrawingTool): boolean =>
        tool === 'path' || tool === 'polygon' || tool === 'floor' || usaTracadoPontoAPonto(tool)

      const contagemDoTracado = (tool: DrawingTool): { tem: number; minimo: number; oQue: string } | null => {
        if (tool === 'path') {
          const tem = normalizeDraftPolygonPoints(pathDraftPoints).length
          return tem > 0 ? { tem, minimo: 2, oQue: 'O caminho' } : null
        }
        if (tool === 'polygon') {
          const tem = normalizeDraftPolygonPoints(polygonDraftPoints).length
          return tem > 0 ? { tem, minimo: 3, oQue: 'O polígono' } : null
        }
        if (tool === 'floor') {
          const tem = normalizeDraftPolygonPoints(corridorDraftPoints).length
          return tem > 0 ? { tem, minimo: 2, oQue: 'O corredor' } : null
        }
        if (usaTracadoPontoAPonto(tool)) {
          const tem = normalizeDraftPolygonPoints(regionDraftPoints).length
          return tem > 0 ? { tem, minimo: 3, oQue: tool === 'roomFree' ? 'A sala' : 'A região' } : null
        }
        return null
      }

      /**
       * A pessoa pediu para fechar e a forma não tinha pontos suficientes. Até
       * 21/09/2026 isso era MUDO: o rascunho curto sumia da tela no `dblclick`
       * e nada explicava por quê — a mesma queixa do passeio que originou o
       * toast da Escada e o da Porta que erra a parede. O rascunho continua
       * sendo descartado (é o comportamento de sempre do duplo clique, e
       * `task-rascunho-desfazer` depende dele para o Ctrl+Z seguinte voltar a
       * desfazer o MAPA); o que muda é que agora a tela diz o que faltou.
       */
      const explicarTracadoCurto = (contagem: { tem: number; minimo: number; oQue: string }) => {
        const faltam = contagem.minimo - contagem.tem
        useToastStore
          .getState()
          .push(
            'info',
            `${contagem.oQue} precisa de ${contagem.minimo} pontos para fechar — ${
              faltam === 1 ? 'faltou 1' : `faltaram ${faltam}`
            }. Clique os pontos e feche de novo.`,
          )
      }

      /**
       * A saída ÚNICA do traçado ponto a ponto. O `dblclick` do navegador e o
       * gesto de dois toques deste arquivo (janela do Windows, não a fixa do
       * Chromium) passam os dois por aqui — duas receitas de "o que é fechar a
       * forma" divergiriam na primeira correção.
       *
       * Devolve `true` quando havia um traçado desta ferramenta e ele foi
       * resolvido (fechado ou descartado com explicação); `false` quando não
       * havia nada para fechar, e quem chamou deve seguir em frente.
       */
      const fecharTracadoPontoAPonto = (tool: DrawingTool): boolean => {
        const contagem = contagemDoTracado(tool)
        if (contagem === null) return false

        // Curto demais: explica o que faltou e descarta — as três ferramentas
        // no mesmo lugar, porque a pergunta ("dá para fechar?") é a mesma e a
        // resposta muda só no número.
        if (contagem.tem < contagem.minimo) {
          explicarTracadoCurto(contagem)
          clearDrafts()
          return true
        }

        if (tool === 'path') finishPath()
        else if (tool === 'polygon') finishPolygon()
        else if (tool === 'floor') finishCorridor()
        else finishRegion()
        return true
      }

      /**
       * O último toque SOLTO sobre o canvas com uma ferramenta de traçado
       * ponto a ponto na mão: onde ele caiu (px de tela) e quando o botão
       * subiu. É contra ele que o toque seguinte se mede para virar, ou não,
       * um fechamento — ver `FECHAMENTO_DOIS_TOQUES_JANELA_MS`.
       */
      let ultimoToqueDoTracado: { x: number; y: number; soltoEmMs: number } | null = null

      /**
       * Quando o gesto de dois toques fechou a forma pela última vez. O
       * `dblclick` do navegador chega LOGO DEPOIS do segundo toque (a janela
       * dele, ~500 ms, cabe inteira dentro da nossa) e não pode repetir o
       * fechamento nem descartar o rascunho que a pessoa já começou a seguir.
       * O evento nativo continua ligado de propósito: é a rede de segurança
       * para o caso de o gesto daqui não reconhecer o toque.
       */
      let fechadoPorDoisToquesEmMs = Number.NEGATIVE_INFINITY

      /**
       * Este `pointerdown` é o SEGUNDO toque de um duplo clique no mesmo
       * ponto? Mesma pergunta que o sistema operacional faz — pausa curta E
       * mesmo lugar —, só que com a régua do Windows em vez da do Chromium.
       */
      const eSegundoToqueNoMesmoPonto = (x: number, y: number): boolean => {
        const anterior = ultimoToqueDoTracado
        if (anterior === null) return false
        if (performance.now() - anterior.soltoEmMs > FECHAMENTO_DOIS_TOQUES_JANELA_MS) return false
        return Math.hypot(x - anterior.x, y - anterior.y) <= FECHAMENTO_DOIS_TOQUES_TOLERANCIA_PX
      }

      /**
       * Ctrl+Z/Backspace com rascunho aberto: tira o último ponto e redesenha a
       * prévia até o cursor. Sem ponto sobrando o rascunho some. Nunca mexe no
       * histórico do mapa — o ponto ainda não é mapa.
       */
      const undoDraftPoint = () => {
        const { map, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
        const cursor = laserPointer ? applySnap(laserPointer, map.grid, 'wall', false) : null
        draftGraphics.clear()
        if (regionDraftPoints.length > 0) {
          regionDraftPoints = regionDraftPoints.slice(0, -1)
          if (regionDraftPoints.length > 0) drawRegionDraft(draftGraphics, regionDraftPoints, cursor)
        }
        if (polygonDraftPoints.length > 0) {
          polygonDraftPoints = polygonDraftPoints.slice(0, -1)
          if (polygonDraftPoints.length > 0) drawPolygonDraft(draftGraphics, polygonDraftPoints, cursor, drawColor, drawWidth, drawFilled, drawFillAlpha)
        }
        if (pathDraftPoints.length > 0) {
          pathDraftPoints = pathDraftPoints.slice(0, -1)
          if (pathDraftPoints.length > 0) drawPathPreview(cursor)
        }
        if (corridorDraftPoints.length > 0) {
          corridorDraftPoints = corridorDraftPoints.slice(0, -1)
          if (corridorDraftPoints.length > 0) drawCorridorDraft(cursor)
        }
      }

      // Onda 1, item 1 (Frente A, "cursor vivo") — `updateCursor` não recebe
      // mais `tool`: sempre lê `activeTool` fresco de `useMapStore.getState()`,
      // e delega toda a tabela de decisão pra `resolveCursor` (pixi/
      // cursorPolicy.ts, módulo puro com teste próprio), que cobre os 33
      // `mode` e os 21 `DrawingTool` — antes só conhecia 2 estados
      // ('crosshair' pra Borracha, 'default' pro resto).
      const updateCursor = () => {
        // B2 — laser armado (L ou botão Laser) fora de pan: mira, qualquer que seja a ferramenta.
        if (isLaserArmed(useLaserStore.getState()) && mode === 'idle' && !spaceHeld) {
          el.style.cursor = 'crosshair'
          return
        }
        el.style.cursor = resolveCursor({
          mode,
          activeTool: useMapStore.getState().activeTool,
          hoverKind,
          corner: hoverCorner,
          spaceHeld,
        })
      }
      updateCursor()
      const unsubscribeLaserCursor = useLaserStore.subscribe((state, previous) => {
        if (isLaserArmed(state) === isLaserArmed(previous)) return
        hoverGraphics.clear()
        hoverTarget = null
        updateCursor()
      })

      /**
       * Hit-test LEVE de hover em `mode === 'idle'` — só o suficiente pra
       * `resolveCursor` escolher entre alça de resize (cursor direcional) e
       * "algo clicável" (cursor `pointer`); não desenha anel de hover (isso é
       * o item #15, Onda 2). Espelha a MESMA cadeia de prioridade do
       * `pointerdown` logo abaixo (alça de resize de drawing/token/prop >
       * vértice/raio > canto de sala > grupo de área > `findSelectableAt`
       * genérico) — reaproveita as funções já importadas no topo do arquivo,
       * nenhuma nova.
       */
      // Onda 2, item 15 (Frente B) — a cadeia de prioridade inteira foi
      // extraída pra `lib/hoverHitTest.ts` (`resolveHoverHit`, módulo puro
      // com teste próprio) e ganhou o campo `target` (kind+id sob o cursor,
      // usado por `drawHover` pra desenhar o anel). Este wrapper só junta o
      // estado da store com o `worldPoint` do gesto.
      const resolveHoverAtIdle = (worldPoint: Point): HoverHit => {
        const { map, selection, activeTool: tool } = useMapStore.getState()
        // Onda 4, item 24 — `resolveHoverHit` (fora da minha lista) só
        // entende "um item" (alça de resize/vértice) e "grupo por campo
        // plural" (bbox do grupo pra cursor de arrastar-tudo); os dois vêm
        // do mesmo `selection` agora, convertidos na borda.
        return resolveHoverHit({
          map,
          selection: selectionSingle(selection),
          areaSelection: selection.length > 1 ? selectionToAreaSelection(selection) : null,
          activeTool: tool,
          worldPoint,
          cameraScale: camera.scale,
        })
      }

      const unsubscribeActiveTool = useMapStore.subscribe((state) => state.activeTool, () => {
        clearDrafts()
        // Trocar de ferramenta é sair de vez do rótulo: com a Escada na mão,
        // a próxima tecla tem de voltar a ser atalho.
        endTextEditing()
        updateCursor()
        redrawShapes()
      })

      // Trocar de forma no menu do Chão com um Corredor ABERTO (achado 7 do
      // passeio de 20/09/2026): o traço ficava pendurado e morria calado no
      // `clearDrafts()` da próxima troca de ferramenta. Agora a troca resolve
      // o traço na hora — vira chão se já é corredor (a mesma saída do Enter),
      // ou some COM aviso se tinha um ponto só. A regra é pura e testada em
      // `corridorDraftOnShapeChange`.
      const unsubscribeFloorShape = useMapStore.subscribe((state) => state.floorShapeKind, () => {
        const decisao = corridorDraftOnShapeChange(corridorDraftPoints)
        if (decisao === 'finalizar') {
          finishCorridor()
          return
        }
        if (decisao === 'descartar') {
          corridorDraftPoints = []
          draftGraphics.clear()
          useToastStore.getState().push('info', CORRIDOR_DISCARDED_TEXT)
        }
      })

      app.stage.on('pointerdown', (event) => {
        // Clicar em qualquer lugar do mapa encerra a edição do rótulo
        // anterior. O bloco da ferramenta Texto, mais abaixo, religa a edição
        // no rótulo que ESTE mesmo clique cria.
        endTextEditing()

        // Onda 2, item 15 (Frente B) — o anel de hover só existe em
        // `mode === 'idle'`; qualquer gesto que comece agora entra num modo
        // que não roda mais `resolveHoverAtIdle`, então sem isto o anel
        // ficaria "grudado" na tela até o próximo pointermove ocioso.
        hoverGraphics.clear()
        hoverTarget = null
        // Todo gesto novo começa sem travessia pendente: só o ramo do pino de
        // viagem, mais abaixo, arma uma — e só para ESTE aperto.
        travelPress = null

        // B2 — laser armado + botão esquerdo: o traço é do laser e a ferramenta ativa não roda.
        if (!spaceHeld && laserGesture.pointerDown(event.button, toWorldPoint(event.global.x, event.global.y))) return

        // Botao do meio (scroll wheel) sempre faz pan, independente da ferramenta
        // ativa ou do que estiver sob o cursor. Precisa vir antes de qualquer
        // outro if de ferramenta e sair com "return" pra nao rodar selecao/desenho.
        if (event.button === 1) {
          mode = 'panning'
          panPathLearned = true
          lastPoint = { x: event.global.x, y: event.global.y }
          return
        }

        // Item #8 do plano — Espaço+arrastar pana em QUALQUER ferramenta.
        // Segunda maior prioridade, logo depois do botão do meio: mesma
        // regra ("vem antes de qualquer if de ferramenta, sai com return")
        // pra não disparar desenho/seleção por baixo do gesto de pan.
        if (spaceHeld) {
          mode = 'panning'
          panPathLearned = true
          lastPoint = { x: event.global.x, y: event.global.y }
          updateCursor()
          return
        }

        const worldPoint = toWorldPoint(event.global.x, event.global.y)
        const { map, activeTool, selection, setSelection } = useMapStore.getState()
        // Onda 4, item 24 — os blocos de alça/edição abaixo (resize de
        // drawing/token/prop, vértice de curve/line/wall, canto de sala) só
        // fazem sentido pra seleção de EXATAMENTE 1 item — `single` é essa
        // borda, mesma forma que `selection` tinha antes da migração.
        const single = selectionSingle(selection)

        // DUPLO CLIQUE QUE FECHA A FORMA, no ritmo de quem mira. A dica da
        // tela promete "Duplo clique fecha" (labels.ts) e até 21/09/2026 quem
        // cumpria a promessa era só o evento `dblclick` do navegador, de
        // janela FIXA (~500 ms): dois toques a 700 ms — duplo clique legítimo
        // na régua do Windows — não fechavam nada e nada era dito.
        //
        // O gesto mora AQUI, antes de qualquer if de ferramenta, porque ele
        // precisa decidir ANTES de o toque virar mais um vértice: o segundo
        // toque de um duplo clique não é um canto novo, é o fim do traçado.
        // Só vale com botão esquerdo, e só quando o toque anterior caiu no
        // MESMO ponto (`eSegundoToqueNoMesmoPonto`) — dois cliques em lugares
        // diferentes continuam sendo dois vértices, por mais rápidos que
        // sejam.
        if (event.button === 0 && eSegundoToqueNoMesmoPonto(event.global.x, event.global.y)) {
          if (fecharTracadoPontoAPonto(activeTool)) {
            ultimoToqueDoTracado = null
            fechadoPorDoisToquesEmMs = performance.now()
            updateCursor()
            return
          }
        }

        if (activeTool === 'wall') {
          mode = 'drawing-wall'
          // Ímã primeiro: se a ponta inicial cai perto de um vértice já
          // existente, usa ele direto (sem grid-snap por cima — o vértice
          // pode não estar exatamente numa célula da grade). Só cai no
          // applySnap normal quando não há vértice perto o bastante.
          wallDraftStart = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE) ?? applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'stair') {
          mode = 'drawing-stair'
          // Mesmo ímã dos blocos de Parede/Linha acima — ver comentário lá.
          stairDraftStart = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE) ?? applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'door') {
          // Tolerância maior que o padrão de seleção (8px, ver WALL_HIT_TOLERANCE
          // em selectionHitTest.ts): clicar exatamente em cima de uma linha fina é
          // difícil, e aqui não há preview de arrasto pra corrigir a mira.
          // Filtrado por camada visível (mesmo filtro do render/hit-test de
          // seleção) — não cria porta em cima de parede que o LayersPanel escondeu.
          const wall = findWallAt(visibleWalls(map.walls, map.hiddenLayers), worldPoint, 16)
          // Sem parede sob o clique: não cria porta flutuando no vazio. `kind`
          // vem da preferência de ferramenta (doorKind/setDoorKind no store,
          // ver DoorKindControls) — antes desta fase era um comprimento fixo
          // (DOOR_LENGTH); agora addDoorOnWall calcula o comprimento pelo tipo.
          if (wall) {
            const store = useMapStore.getState()
            // `doorMode` decide o que o clique abre: a porta de sempre ou o
            // VÃO ABERTO, que tira o trecho da parede e deixa passagem livre
            // (DoorModeControls, no painel da Porta).
            if (store.doorMode === 'vao') store.addOpeningOnWall(wall.id, worldPoint)
            else store.addDoorOnWall(wall.id, worldPoint, store.doorKind)
          } else {
            // Passeio cego de 16/09/2026: o clique que erra a parede não criava
            // porta e o app não dizia NADA — sem cursor diferente, sem realce,
            // sem mensagem. A pessoa clicava de novo, no mesmo lugar, achando
            // que o clique não tinha "pegado". Agora a tela responde ao gesto.
            useToastStore
              .getState()
              .push(
                'info',
                useMapStore.getState().doorMode === 'vao'
                  ? 'Nenhuma parede aqui: clique em cima da linha da parede para abrir o vão.'
                  : 'Nenhuma parede aqui: clique em cima da linha da parede para pôr a porta.',
              )
          }
          return
        }

        if (activeTool === 'room') {
          mode = 'drawing-room'
          roomDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'pin') {
          // Sem snap: o pino é anotação, e o usuário pediu que ele apareça
          // ONDE ele clicou — não no centro da célula mais próxima.
          const existing = pinAt(map, worldPoint)
          if (existing) {
            // Clicar num pino que já existe abre ele no painel em vez de
            // empilhar um segundo em cima (o de baixo ficaria inalcançável) —
            // e arrastar ali mesmo o move. A ferramenta Pino continua na mão
            // logo depois de cravar, e é ali que a pessoa tenta corrigir a
            // posição antes de pensar em trocar de ferramenta.
            abrirETalvezArrastarPino(map, existing, worldPoint)
            lastPoint = { x: event.global.x, y: event.global.y }
            updateCursor()
            return
          }
          // `?? undefined`: `pinIcon` é `null` quando o mestre não escolheu
          // ícone, e `buildPin` trata a AUSÊNCIA como "pino de hoje".
          const pin = buildPin(
            crypto.randomUUID(),
            worldPoint,
            useMapStore.getState().pinKind,
            useMapStore.getState().pinIcon ?? undefined,
          )
          useMapStore.getState().addPin(pin)
          useMapStore.getState().setSelectedPin(pin.id)
          return
        }

        if (activeTool === 'concealZone') {
          mode = 'drawing-conceal-zone'
          concealDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          concealDraftRawStart = worldPoint
          return
        }

        if (activeTool === 'roomCircle') {
          mode = 'drawing-polygon-room'
          polygonDraftCenter = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          polygonDraftSides = ROOM_CIRCLE_SIDES
          return
        }

        if (activeTool === 'roomPolygon') {
          mode = 'drawing-polygon-room'
          polygonDraftCenter = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          polygonDraftSides = useMapStore.getState().polygonSides
          return
        }

        if (activeTool === 'light') {
          mode = 'drawing-light'
          lightDraftCenter = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          lightDraftRawStart = worldPoint
          return
        }

        // Ferramenta Token (K): clique no vazio pede o nome e cria o token ali
        // (pointerup abre o campo; o App cria pelo caminho do "Adicionar
        // token"). Clique sobre um token existente segue o fluxo de sempre.
        if (activeTool === 'token' && findSelectableAt(clickSelectMap(map), worldPoint)?.kind !== 'token') {
          tokenPlacementPoint = applySnap(worldPoint, map.grid, 'token', event.altKey)
          return
        }

        if (activeTool === 'prop') {
          const point = applySnap(worldPoint, map.grid, 'prop', event.altKey)
          void (async () => {
            // Passeio cego de 17/09/2026: este bloco era um `void (async ...)()`
            // SEM try/catch. Qualquer rejeição (o caso comum: o seletor de
            // imagem não existe fora do aplicativo) virava unhandled rejection
            // calada — a tela ficava muda, a Peça seguia marcada como ativa e a
            // pessoa clicava de novo achando que tinha errado o alvo.
            try {
              const sourcePath = await pickImageFile()
              // `null` é cancelamento: a pessoa fechou o diálogo de propósito.
              // Não é falha, então nada de aviso e a Peça continua ativa.
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
            } catch (err) {
              // A tela DIZ o que houve, com a razão junto — mesmo formato de
              // `reportFileError` em App.tsx:57, que é o texto de erro de
              // arquivo que o resto do app já usa.
              const message = err instanceof Error ? err.message : String(err)
              useToastStore.getState().push('error', `Não foi possível pôr a peça: ${message}`)
              // E a pessoa não fica presa numa ferramenta que não funciona: a
              // marcação de ativo volta para Selecionar, que é o estado de onde
              // dá para fazer qualquer outra coisa. Mesmo caminho de
              // `setActiveTool` já usado neste arquivo (linha ~4045).
              useMapStore.getState().setActiveTool('select')
            }
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
          lineDraftStart = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE) ?? applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'circle') {
          mode = 'drawing-circle'
          circleDraftCenter = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'rect') {
          mode = 'drawing-rect'
          rectDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'ellipse') {
          mode = 'drawing-ellipse'
          ellipseDraftCenter = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'polygon') {
          mode = 'drawing-polygon'
          const point = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          polygonDraftPoints = [...polygonDraftPoints, point]
          const { drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          drawPolygonDraft(draftGraphics, polygonDraftPoints, null, drawColor, drawWidth, drawFilled, drawFillAlpha)
          return
        }

        if (activeTool === 'path') {
          // SEM applySnap, de propósito: o caminho atravessa a sala, não a
          // grade — prendê-lo aos vértices da célula faria a trilha andar em
          // degraus e sair de baixo do ponto onde a pessoa clicou. É a mesma
          // escolha do pincel de blocos, que também ignora o snap.
          pathDraftPoints = [...pathDraftPoints, worldPoint]
          drawPathPreview(null)
          return
        }

        if (activeTool === 'curve') {
          mode = 'drawing-curve'
          curveDraftPoints = [worldPoint]
          return
        }

        if (usaTracadoPontoAPonto(activeTool)) {
          // Só guarda o início; ponto-a-ponto vs. retângulo se decide no
          // pointerup (ver `regionDraftStart`).
          regionDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          regionDraftRawStart = worldPoint
          return
        }

        if (activeTool === 'floor') {
          const { floorShapeKind, floorOp } = useMapStore.getState()
          // Pincel de blocos: sem applySnap: a célula sai do ponto bruto, e é a
          // CÉLULA inteira que pinta — é isso que separa "preso à grade" de
          // "fita centrada no ponteiro".
          if (floorShapeKind === 'blocos') {
            mode = 'painting-floor-blocks'
            // Botão direito OU operação Subtrair apagam: ver `pincelDeBlocosApaga`.
            blocoApagando = pincelDeBlocosApaga(floorOp, event.button)
            blocoCellSize = map.grid
            blocoCells = new Map()
            blocoUltimoPonto = worldPoint
            acumularBlocos(worldPoint, worldPoint)
            return
          }
          // Balde é um clique só: não há arrasto para acompanhar.
          if (floorShapeKind === 'balde') {
            if (event.button === 0) encherAreaFechada(worldPoint)
            return
          }
          const point = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          if (floorShapeKind === 'corridor') {
            corridorDraftPoints = [...corridorDraftPoints, point]
            drawCorridorDraft(null)
            return
          }
          mode = 'drawing-floor'
          floorDraftStart = point
          return
        }

        if (activeTool === 'text') {
          const point = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const id = crypto.randomUUID()
          const { addDrawing, drawColor, drawFontSize, drawFontFamily, setSelection: select } = useMapStore.getState()
          addDrawing(buildTextDrawing(id, point, drawColor, drawFontSize, drawFontFamily))
          select(selectionOfItem({ kind: 'drawing', id }))
          // O rótulo nasce PRONTO para receber o teclado, com o conteúdo
          // inicial ainda inteiro "selecionado" — a primeira letra o
          // substitui. É o gesto de todo editor de desenho: clicar com a
          // ferramenta Texto e sair digitando.
          textEditingId = id
          textEditingReplacesAll = true
          return
        }

        if (activeTool === 'eraser') {
          mode = 'erasing'
          beginEraseGesture()
          eraseDuringGesture(worldPoint)
          return
        }

        if (activeTool === 'measure') {
          // Régua efêmera — não muda `mode` de propósito (mesmo padrão de
          // regionDraftPoints/polygonDraftPoints): pointermove/pointerup
          // checam `activeTool === 'measure' && measureDraftStart` direto,
          // sem depender da state machine de `mode`.
          measureDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          return
        }

        if (activeTool === 'select' && single?.kind === 'drawing') {
          const drawing = map.drawings.find((d) => d.id === single.id)

          // B3 (bug3 "mover e redimensionar"): alça de canto de rect/ellipse/
          // polygon, ANTES de curve/line abaixo — um clique numa alça tem
          // prioridade sobre qualquer outro gesto dessa seleção.
          if (drawing && (drawing.kind === 'rect' || drawing.kind === 'ellipse' || drawing.kind === 'polygon')) {
            const box = drawingBoundingBox(drawing)
            const corner = box ? findBoxCornerAt(box, worldPoint) : null
            if (corner !== null) {
              mode = 'resizing-drawing-corner'
              resizingDrawingId = single.id
              resizingDrawingCorner = corner
              resizingDrawingSnapshot = map
              return
            }
          }

          // Onda 3, item 18 (Frente B) — círculo era o único Drawing sem
          // alça NENHUMA. Mesma alça de raio da Luz (drawLightRadiusHandle,
          // generalizada em drawEditHandles.ts), adaptando cx/cy pra x/y via
          // `circleDrawingRadiusHandle`.
          if (drawing && drawing.kind === 'circle' && findLightRadiusHandleAt(circleDrawingRadiusHandle(drawing), worldPoint)) {
            mode = 'resizing-drawing-radius'
            resizingDrawingId = single.id
            resizingDrawingSnapshot = map
            return
          }

          if (drawing && drawing.kind === 'curve') {
            const index = findCurveControlPointAt(drawing.points, worldPoint)
            if (index !== null) {
              mode = 'dragging-curve-point'
              draggingCurveId = single.id
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
              useMapStore.getState().insertCurvePoint(single.id, midpointIndex, midpoint.x, midpoint.y)
              mode = 'dragging-curve-point'
              draggingCurveId = single.id
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
              draggingLineId = single.id
              // findCurveControlPointAt é genérico sobre number; o array de entrada
              // tem exatamente 2 pontos (x1,y1 e x2,y2), então o índice retornado
              // só pode ser 0 ou 1 — o mesmo par que updateLinePoint espera.
              draggingLinePointIndex = index as 0 | 1
              return
            }
          }
        }

        if (activeTool === 'select' && single?.kind === 'light') {
          const light = map.lights.find((l) => l.id === single.id)
          if (light && findLightRadiusHandleAt(light, worldPoint)) {
            mode = 'dragging-light-radius'
            draggingLightId = light.id
            lightRadiusDragSnapshot = map
            return
          }
        }

        if (activeTool === 'select' && single?.kind === 'wall') {
          const wall = map.walls.find((w) => w.id === single.id)
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

        // B3 (bug3 "mover e redimensionar"): alça de canto de Token/Prop.
        // Respeita `canInteract` (item travado não ganha alça de resize),
        // mesmo padrão de dragging-token/dragging-prop mais abaixo.
        if (activeTool === 'select' && single?.kind === 'token') {
          const token = map.tokens.find((t) => t.id === single.id)
          if (token && canInteract(token)) {
            const corner = findBoxCornerAt(tokenBoundingBox(token, map.grid), worldPoint)
            if (corner !== null) {
              mode = 'resizing-token'
              resizingTokenId = token.id
              resizingTokenSnapshot = map
              return
            }
          }
        }

        if (activeTool === 'select' && single?.kind === 'prop') {
          const prop = map.props.find((p) => p.id === single.id)
          if (prop && canInteract(prop)) {
            const corner = findBoxCornerAt(propBoundingBox(prop), worldPoint)
            if (corner !== null) {
              mode = 'resizing-prop-corner'
              resizingPropId = prop.id
              resizingPropCorner = corner
              resizingPropSnapshot = map
              return
            }
          }
        }

        if (activeTool === 'select') {
          let editRegionId: string | null = null
          if (single?.kind === 'region') {
            editRegionId = single.id
          } else if (single?.kind === 'wall') {
            const wall = map.walls.find((w) => w.id === single.id)
            if (wall && wall.regionId !== undefined) editRegionId = wall.regionId
          }

          if (editRegionId !== null) {
            const region = map.regions.find((r) => r.id === editRegionId)
            // `canInteract`: travada agora fica SELECIONADA, então as alças de
            // canto/vértice/midpoint passariam a ser alcançáveis. Travado vale
            // pra geometria também, não só pro corpo.
            if (region && canInteract(region)) {
              // Alça de girar (bolinha acima da Sala): antes do canto — ela
              // fica FORA da sala, e é o que está por cima nesse ponto.
              if (region.room && roomRotateGesture.begin(editRegionId, worldPoint, camera.scale)) {
                mode = 'rotating-room'
                redrawEditHandles()
                updateCursor()
                return
              }
              // Sala retangular (Region.room?.shape === 'rect'): resize SÓ
              // pelos 4 cantos (findRoomCornerAt, lib/roomOps.ts) — nunca cai
              // no arrasto de vértice/midpoint genérico abaixo, que deixaria a
              // sala virar um quadrilátero torto e dessincronizaria as 4
              // paredes vinculadas (resizeRoomCornerLive já cuida da sync,
              // ver mapFactory.ts). Girada torta, nem o canto: reconstruir o
              // retângulo pelos cantos a desmontaria (`isAxisAlignedRect`).
              if (region.room?.shape === 'rect') {
                const corner = isAxisAlignedRect(region.points) ? findRoomCornerAt(region.points, worldPoint) : null
                if (corner !== null) {
                  mode = 'resizing-room-corner'
                  resizingRoomId = editRegionId
                  resizingCorner = corner
                  roomCornerDragSnapshot = map
                  return
                }
              } else {
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
        }

        // A4 — arrastar o nome da Sala move só o rótulo, e só quando a Sala
        // JÁ ESTÁ SELECIONADA. Vem antes do hit-test de corpo: o nome fica
        // dentro da sala, e sem esta exceção o gesto arrastaria a sala.
        //
        // A condição "já selecionada" é nova (passeio de 17/09/2026). O nome
        // nasce no MEIO da sala, então quem pega o cômodo pelo meio para
        // levá-lo a outro canto — o gesto que a dica da ferramenta promete,
        // "Arraste o corpo do item para mover" — caía aqui: a sala ficava
        // parada e só marcada de amarelo, enquanto o nome escapulia dela e
        // ia parar por cima do cômodo vizinho. Só um SEGUNDO arrasto movia,
        // e movia porque o nome já tinha saído de baixo do cursor. Agora o
        // primeiro arrasto seleciona E move a sala no mesmo gesto (cai no
        // `dragging-region-body` lá embaixo), e o ajuste fino do rótulo
        // continua sendo o segundo gesto, com a sala destacada.
        //
        // Com grupo (2+) o arrasto do grupo continua valendo, e Shift
        // continua sendo "somar à seleção".
        if (activeTool === 'select' && !event.shiftKey && single?.kind === 'region') {
          const labelRegion = findRoomLabelAt(visibleRegions(map.regions, map.hiddenLayers), worldPoint, map.grid, camera.scale)
          if (labelRegion?.room && labelRegion.id === single.id) {
            setSelection(selectionOfItem({ kind: 'region', id: labelRegion.id }))
            if (canInteract(labelRegion)) {
              mode = 'dragging-room-label'
              roomLabelDragId = labelRegion.id
              roomLabelDragSnapshot = map
              roomLabelDragStartPoint = worldPoint
              roomLabelDragStartOffset = labelRegion.room.labelOffset ?? { x: 0, y: 0 }
            } else {
              mode = 'idle'
            }
            lastPoint = { x: event.global.x, y: event.global.y }
            updateCursor()
            return
          }
        }

        // N3 "ferramenta de seleção de área": clicar DENTRO do bounding box
        // de um grupo já fechado por um marquee anterior arrasta o grupo
        // inteiro — tem prioridade sobre o hit-test de item único logo
        // abaixo, mesmo quando o clique cai exatamente sobre uma das
        // entidades do grupo (é assim que "arrastar o grupo" continua
        // funcionando clicando em qualquer parte dele, não só no vazio entre
        // os itens).
        // Onda 4, item 24 — clicar DENTRO do bounding box de um grupo (2+
        // itens JÁ selecionados, Shift+clique ou marquee mesclado) arrasta o
        // grupo inteiro. Tem prioridade sobre o hit-test de item único logo
        // abaixo, mesmo quando o clique cai exatamente sobre uma das
        // entidades do grupo (é assim que "arrastar o grupo" continua
        // funcionando clicando em qualquer parte dele, não só no vazio entre
        // os itens). Com 0 ou 1 item selecionado não há "grupo" — cai direto
        // no hit-test normal.
        if (activeTool === 'select' && selection.length > 1) {
          const bounds = areaSelectionBounds(map, selectionToAreaSelection(selection))
          if (
            bounds &&
            worldPoint.x >= bounds.minX &&
            worldPoint.x <= bounds.maxX &&
            worldPoint.y >= bounds.minY &&
            worldPoint.y <= bounds.maxY
          ) {
            mode = 'dragging-area-selection'
            areaSelectionDragBefore = map
            areaSelectionDragLastPoint = worldPoint
            lastPoint = { x: event.global.x, y: event.global.y }
            return
          }
        }

        // Pino antes do hit-test geral: ele é desenhado POR CIMA de tudo, e o
        // que está por cima é o que o dedo acerta. Fica fora de `selection`
        // (igual à zona oculta), então abre o painel — e, destravado, o gesto
        // segue como arrasto do próprio pino em vez de encerrar aqui.
        if (activeTool === 'select') {
          const pin = pinAt(map, worldPoint)
          if (pin) {
            abrirETalvezArrastarPino(map, pin, worldPoint)
            // Pino de viagem: soltar sem arrastar atravessa a passagem (no
            // pointerup); arrastar continua movendo o pino, como qualquer pino.
            travelPress = pin.kind === 'viagem' && event.button === 0 ? { pinId: pin.id, x: event.global.x, y: event.global.y, moved: false } : null
            lastPoint = { x: event.global.x, y: event.global.y }
            updateCursor()
            return
          }
        }

        // Camada travada barra o GESTO, não só a seleção.
        //
        // `clickSelectMap`/`hitTestMap` tiram do mapa os itens de camada
        // travada ANTES do hit-test — e com o item fora do array a cadeia de
        // prioridade seguia em frente e acertava o que estava EMBAIXO dele.
        // Quem travava a camada Tokens justamente para não esbarrar num token
        // arrastava a SALA inteira por baixo dele: luz, escada e rótulo iam
        // junto, sem aviso nenhum (jornada e2e/task-jornada-camada-travada).
        // `findLockedLayerAt` pergunta, no mapa CRU, quem está por cima neste
        // ponto; se a camada desse item estiver travada, o gesto para aqui:
        // `mode` fica 'idle' (nenhum branch de pointermove reage), a seleção
        // de antes continua de pé e o aviso diz POR QUE nada aconteceu.
        //
        // Só no caminho do hit-test genérico de propósito: alça de resize,
        // vértice de sala e arrasto de grupo, acima, trabalham sobre itens JÁ
        // selecionados — e travar uma camada remove os itens dela da seleção
        // (mapStore.toggleLayerLock), então nenhum deles alcança item travado.
        const lockedLayer = findLockedLayerAt(map, worldPoint)
        if (lockedLayer !== null) {
          mode = 'idle'
          useToastStore.getState().push('info', `A camada ${LAYER_LABELS[lockedLayer]} está travada`)
          lastPoint = { x: event.global.x, y: event.global.y }
          updateCursor()
          return
        }

        const hit = findSelectableAt(clickSelectMap(map), worldPoint) ?? floorHitAt(map, worldPoint)
        if (hit && event.shiftKey) {
          // Onda 4, item 24 — Shift+clique soma/tira ESTE item da seleção,
          // sem iniciar nenhum arrasto neste gesto (o gesto de Shift+clique é
          // "construir o conjunto"; mover o conjunto é um clique separado,
          // dentro do bounding box acima, ou Shift+arrastar pra somar uma
          // área inteira — ver 'area-marquee-drag' mais abaixo). `mode` fica
          // 'idle': nenhum branch de pointermove reage a um clique parado.
          setSelection(toggleSelectionItem(selection, { kind: hit.kind, id: hit.id }))
          mode = 'idle'
          lastPoint = { x: event.global.x, y: event.global.y }
          updateCursor()
          return
        }
        // Agrupar objetos (Ctrl+G): um clique num membro pega o grupo inteiro,
        // e o mesmo gesto já arrasta todos juntos — o arrasto da seleção de
        // vários logo acima, só que sem precisar laçar de novo. Alt+arrastar
        // segue duplicando só o item (Onda 3, item 13).
        if (hit && !event.altKey) {
          const grupo = selectionOnClick(map, { kind: hit.kind, id: hit.id })
          if (grupo.length > 1) {
            setSelection(grupo)
            mode = 'dragging-area-selection'
            areaSelectionDragBefore = map
            areaSelectionDragLastPoint = worldPoint
            lastPoint = { x: event.global.x, y: event.global.y }
            updateCursor()
            return
          }
        }
        if (hit) {
          // Seleciona SEMPRE, mesmo travado — é como o usuário alcança o
          // toggle "Travado" em ItemTransformControls pra destravar. Só o
          // MODO de arrasto abaixo é condicionado a `canInteract` (F3,
          // contrato do agente C4): item travado permanece com `mode`
          // parado em 'idle' (valor já vigente entre gestos), então nenhum
          // branch de pointermove reage e o item não se move. Clique SEM
          // Shift SUBSTITUI o conjunto por este item só (mesmo comportamento
          // de sempre) — o caso Shift já retornou acima.
          setSelection(selectionOfItem({ kind: hit.kind, id: hit.id }))
          if (hit.kind === 'token') {
            const token = map.tokens.find((t) => t.id === hit.id)
            if (token && canInteract(token)) {
              mode = 'dragging-token'
              // Onda 1, item 3 (Frente F) — snapshot de ANTES do gesto (e de
              // qualquer clonagem por Alt logo abaixo), pra fechar o arrasto
              // inteiro (40 pointermove) num Ctrl+Z só no pointerup/
              // pointerupoutside (moveTokenLive não empurra histórico).
              tokenDragSnapshot = map
              // Origem do contador de quadrados: onde a PEÇA está agora. Vale
              // igual no Alt+arrastar — a cópia nasce exatamente aqui.
              tokenDragOrigin = { x: token.x, y: token.y }
              tokenDragLastShown = null
              // Onda 3, item 13 (Alt+arrastar duplica) — clona no pointerdown
              // e arrasta a CÓPIA; o original fica onde estava. Ver
              // `cloneForAltDrag` para a nota sobre Alt="inverter snap".
              draggingTokenId = event.altKey ? cloneForAltDrag({ kind: 'token', entity: token }) : hit.id
            }
          } else if (hit.kind === 'prop') {
            const prop = map.props.find((p) => p.id === hit.id)
            if (prop && canInteract(prop)) {
              mode = 'dragging-prop'
              propDragSnapshot = map
              draggingPropId = event.altKey ? cloneForAltDrag({ kind: 'prop', entity: prop }) : hit.id
            }
          } else if (hit.kind === 'wall') {
            mode = 'dragging-wall-body'
            bodyDragSnapshot = map
            const wall = map.walls.find((w) => w.id === hit.id)
            draggingWallBodyId = event.altKey && wall ? cloneForAltDrag({ kind: 'wall', entity: wall }) : hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          } else if (hit.kind === 'region') {
            // `canInteract`: desde que `clickSelectMap` passou a deixar a
            // Região travada chegar no hit-test, é ESTE ponto que segura o
            // "não move" — mesmo padrão das alças de Token/Prop acima. Sem a
            // checagem aqui, travar só teria tirado o item do clique, que é
            // exatamente o defeito que estamos consertando.
            const region = map.regions.find((r) => r.id === hit.id)
            if (region && canInteract(region)) {
              mode = 'dragging-region-body'
              bodyDragSnapshot = map
              draggingRegionBodyId = event.altKey ? cloneForAltDrag({ kind: 'region', entity: region }) : hit.id
              altDragRegionSource = event.altKey ? region.id : null
              bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
            }
          } else if (hit.kind === 'stair') {
            // B3 (bug3 "mover e redimensionar"): wiring que faltava — a ação
            // já existia na store (moveStair), só não tinha gesto nenhum a
            // chamando (selectionHitTest.ts documenta isso explicitamente).
            mode = 'dragging-stair-body'
            bodyDragSnapshot = map
            const stair = map.stairs.find((s) => s.id === hit.id)
            draggingStairBodyId = event.altKey && stair ? cloneForAltDrag({ kind: 'stair', entity: stair }) : hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          } else if (hit.kind === 'floor') {
            // Mesmo esquema de corpo de wall/region/stair: snapshot de antes
            // do gesto, pointermove com moveFloorPieceLive, 1 undo no pointerup.
            mode = 'dragging-floor-body'
            bodyDragSnapshot = map
            const piece = map.floor.find((p) => p.id === hit.id)
            draggingFloorBodyId = event.altKey && piece ? cloneForAltDrag({ kind: 'floor', entity: piece }) : hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          } else if (hit.kind === 'drawing') {
            const drawing = map.drawings.find((d) => d.id === hit.id)
            if (drawing && drawing.kind === 'curve') {
              mode = 'dragging-curve-body'
              curveDragSnapshot = map
              draggingCurveBodyId = event.altKey ? cloneForAltDrag({ kind: 'drawing', entity: drawing }) : hit.id
              bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
            } else if (drawing) {
              // line/circle/text/freehand/rect/ellipse/polygon: todos movem
              // via moveDrawing genérico (mapFactory.ts) — B3 (bug3 "mover e
              // redimensionar"), mesmo mecanismo que só 'line' usava antes
              // desta fase. Nome do mode/variáveis ficou "line-body" por não
              // tocar a union `mode` mais do que o necessário.
              mode = 'dragging-line-body'
              bodyDragSnapshot = map
              draggingLineBodyId = event.altKey ? cloneForAltDrag({ kind: 'drawing', entity: drawing }) : hit.id
              bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
            } else {
              mode = 'idle'
            }
          } else {
            mode = 'idle'
          }
          // Clique SEM Shift já substituiu `selection` por este item só,
          // logo acima — nada a mais a invalidar aqui (antes disto existia
          // um segundo campo `areaSelection` paralelo que precisava ser
          // limpo à parte; não existe mais).
        } else {
          // Clique/arrasto em espaço vazio (o caso "dentro do grupo já
          // fechado" já foi resolvido ANTES do hit-test, acima).
          //
          // 17/09/2026 — com a ferramenta Selecionar, ESTE gesto é o
          // retângulo de seleção, com ou sem Shift. Antes, o retângulo só
          // nascia com Shift no pointerdown e o mesmo arrasto sem Shift
          // panava a câmera E limpava a seleção; ninguém descobria o Shift
          // sozinho, e o pedido do usuário era literalmente "capacidade de
          // selecionar tudo com mouse".
          //
          // O que cada um significa é decidido no pointerup, por
          // `classifyMarqueeGesture` (lib/areaSelection.ts) — aqui o gesto
          // ainda não tem tamanho: quase parado = clique no vazio (larga a
          // seleção, como sempre foi); arrasto sem Shift = a área SUBSTITUI
          // a seleção; arrasto com Shift = a área SOMA. Por isso este bloco
          // NÃO chama mais `setSelection(EMPTY_SELECTION)`: limpar aqui
          // apagaria a seleção que um Shift+arrasto vem justamente somar.
          //
          // Mover a vista não morreu e não mudou de lugar: botão do meio e
          // Espaço+arrastar continuam panando em QUALQUER ferramenta, os dois
          // lá em cima, antes de qualquer if de ferramenta (cobertos por
          // e2e/task-middle-button-pan.spec.ts). Enquanto o retângulo está
          // aberto, `marqueeHint` diz isso dentro dele.
          //
          // Errar o token JÁ selecionado por poucos px não pode custar a
          // seleção nem o enquadramento (passeio cego de 16/09/2026: virava
          // arrasto da vista E limpava a seleção, sem aviso). Dentro da folga,
          // o gesto é o que a pessoa quis — arrastar o token destacado.
          const selectedToken = single?.kind === 'token' ? map.tokens.find((t) => t.id === single.id) ?? null : null
          const grabBox = selectedToken ? tokenBoundingBox(selectedToken, map.grid) : null
          const nearSelectedToken =
            grabBox !== null &&
            worldPoint.x >= grabBox.minX - SELECTED_TOKEN_GRAB_SLOP &&
            worldPoint.x <= grabBox.maxX + SELECTED_TOKEN_GRAB_SLOP &&
            worldPoint.y >= grabBox.minY - SELECTED_TOKEN_GRAB_SLOP &&
            worldPoint.y <= grabBox.maxY + SELECTED_TOKEN_GRAB_SLOP

          if (
            activeTool === 'select' &&
            !event.shiftKey &&
            selectedToken &&
            nearSelectedToken &&
            canInteract(selectedToken)
          ) {
            // Shift continua tendo prioridade sobre a folga do token (era a
            // ordem de antes: o `if` do Shift vinha primeiro) — com Shift o
            // gesto é sempre construir conjunto, nunca arrastar um item.
            mode = 'dragging-token'
            tokenDragSnapshot = map
            draggingTokenId = selectedToken.id
            // Mesma origem do ramo de cima: pegar a ficha pela folga em volta
            // do disco não pode contar quadrado que ela não andou.
            tokenDragOrigin = { x: selectedToken.x, y: selectedToken.y }
            tokenDragLastShown = null
          } else if (activeTool === 'select') {
            mode = 'area-marquee-drag'
            areaMarqueeStart = worldPoint
          } else {
            // Nenhuma ferramenta de desenho chega aqui (todas saem com
            // `return` bem acima); sobra a Selecionar. Este ramo é a rede de
            // segurança pra uma ferramenta futura sem gesto próprio no vazio.
            mode = 'panning'
            setSelection(EMPTY_SELECTION)
          }
        }
        lastPoint = { x: event.global.x, y: event.global.y }
        updateCursor()
      })

      app.stage.on('pointerup', (event) => {
        // B2 — fim do traço do laser; o App manda `laser {off}` na transição.
        if (laserGesture.pointerUp()) return

        // Guarda ONDE e QUANDO este toque foi solto, para o toque seguinte
        // poder se medir contra ele e virar (ou não) um fechamento — ver
        // `eSegundoToqueNoMesmoPonto` no pointerdown. Só com a ferramenta de
        // traçado na mão e só com o botão esquerdo: o botão do meio pana e o
        // direito apaga blocos, nenhum dos dois é toque de vértice.
        if (event.button === 0 && fazTracadoPontoAPonto(useMapStore.getState().activeTool)) {
          ultimoToqueDoTracado = { x: event.global.x, y: event.global.y, soltoEmMs: performance.now() }
        } else {
          ultimoToqueDoTracado = null
        }
        if (tokenPlacementPoint) {
          openNameEditor({ kind: 'token', at: tokenPlacementPoint, value: nextTokenName(useMapStore.getState().map.tokens) })
          tokenPlacementPoint = null
        }
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
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
          }
          if (isValidWallDraft(wallDraftStart, end)) {
            addWall(buildWallFromDraft(crypto.randomUUID(), wallDraftStart, end, useMapStore.getState().wallKind))
          }
          wallDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-freehand') {
          const { addDrawing, drawColor, drawWidth, drawCap, drawTexture } = useMapStore.getState()
          if (isValidFreehandDraft(freehandDraftPoints)) {
            addDrawing(buildFreehandDrawing(crypto.randomUUID(), freehandDraftPoints, drawColor, drawWidth, drawCap, drawTexture))
          }
          freehandDraftPoints = []
          draftGraphics.clear()
        }

        if (mode === 'drawing-line' && lineDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addDrawing, drawColor, drawWidth, drawCap, drawDash } = useMapStore.getState()
          // Ímã primeiro — mesma lógica do bloco de Parede acima, ver lá.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          if (magnet) {
            end = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(lineDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — ver nota
            // completa no bloco de preview (pointermove) mais abaixo, mesma lógica.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
          }
          if (isValidLineDraft(lineDraftStart, end)) {
            addDrawing(buildLineDrawing(crypto.randomUUID(), lineDraftStart, end, drawColor, drawWidth, drawCap, drawDash))
          }
          lineDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-circle' && circleDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { addDrawing, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const radius = Math.hypot(worldPoint.x - circleDraftCenter.x, worldPoint.y - circleDraftCenter.y)
          if (isValidCircleDraft(radius)) {
            addDrawing(buildCircleDrawing(crypto.randomUUID(), circleDraftCenter, radius, drawColor, drawWidth, drawFilled, drawFillAlpha))
          }
          circleDraftCenter = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-rect' && rectDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addDrawing, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em quadrado; sem Shift
          // devolve `snapped` intacto (mesmo comportamento de antes).
          const end = constrainDraft(rectDraftStart, snapped, 'rect', { shift: event.shiftKey, alt: event.altKey })
          if (isValidRectDraft(rectDraftStart, end)) {
            addDrawing(buildRectDrawing(crypto.randomUUID(), rectDraftStart, end, drawColor, drawWidth, drawFilled, drawFillAlpha))
          }
          rectDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-ellipse' && ellipseDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addDrawing, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em círculo (rx===ry).
          const end = constrainDraft(ellipseDraftCenter, snapped, 'ellipse', { shift: event.shiftKey, alt: event.altKey })
          const rx = Math.abs(end.x - ellipseDraftCenter.x)
          const ry = Math.abs(end.y - ellipseDraftCenter.y)
          if (isValidEllipseDraft(rx, ry)) {
            addDrawing(buildEllipseDrawing(crypto.randomUUID(), ellipseDraftCenter, rx, ry, drawColor, drawWidth, drawFilled, drawFillAlpha))
          }
          ellipseDraftCenter = null
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
          const { addDrawing, drawColor, drawWidth, drawCap, drawDash } = useMapStore.getState()
          if (isValidCurveDraft(curveDraftPoints)) {
            addDrawing(buildCurveDrawing(crypto.randomUUID(), curveDraftPoints, drawColor, drawWidth, drawCap, drawDash))
          }
          curveDraftPoints = []
          draftGraphics.clear()
        }

        if (mode === 'drawing-room' && roomDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, roomFillColor, regionFillPattern } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em quadrado.
          const end = constrainDraft(roomDraftStart, snapped, 'room', { shift: event.shiftKey, alt: event.altKey })
          if (isValidRoomDraft(roomDraftStart, end)) {
            const wallIds: [string, string, string, string] = [
              crypto.randomUUID(),
              crypto.randomUUID(),
              crypto.randomUUID(),
              crypto.randomUUID(),
            ]
            const result = buildRoomFromDraft(crypto.randomUUID(), wallIds, roomDraftStart, end, roomFillColor, regionFillPattern)
            addRoomWithNesting(result)
            // A3 — a Sala nova já nasce selecionada e pede o nome sobre ela
            // mesma (o mesmo campo do duplo clique), com o texto selecionado.
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: result.region.id }))
            onRoomCreatedRef.current?.(result.region.id)
            if (result.region.room) openNameEditor({ kind: 'room', regionId: result.region.id, value: result.region.room.name })
          }
          roomDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-conceal-zone' && concealDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const store = useMapStore.getState()
          const end = applySnap(worldPoint, store.map.grid, 'wall', event.altKey)
          if (isValidRoomDraft(concealDraftStart, end)) {
            // Retângulo sem paredes: a zona esconde conteúdo, não bloqueia a visão.
            const zone = buildConcealZoneFromDraft(crypto.randomUUID(), concealDraftStart, end)
            store.addConcealZone(zone)
            store.setSelectedConcealZone(zone.id)
          } else {
            // Clique sem arrasto abre no painel a zona sob o cursor (ou fecha, no vazio).
            const hit = findConcealZoneAt(store.map.concealZones, concealDraftRawStart ?? worldPoint)
            store.setSelectedConcealZone(hit?.id ?? null)
          }
          concealDraftStart = null
          concealDraftRawStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-polygon-room' && polygonDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, roomFillColor, regionFillPattern } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          if (isValidRegularPolygonDraft(polygonDraftCenter, end)) {
            const wallIds = Array.from({ length: polygonDraftSides }, () => crypto.randomUUID())
            const result = buildRegularPolygonRoomFromDraft(
              crypto.randomUUID(),
              wallIds,
              polygonDraftCenter,
              end,
              polygonDraftSides,
              roomFillColor,
              regionFillPattern,
            )
            addRoomWithNesting(result)
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: result.region.id }))
            onRoomCreatedRef.current?.(result.region.id)
            if (result.region.room) openNameEditor({ kind: 'room', regionId: result.region.id, value: result.region.room.name })
          }
          polygonDraftCenter = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-stair' && stairDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addStair, stairSizePreset } = useMapStore.getState()
          // Ímã primeiro — mesma lógica do bloco de Parede acima, ver lá.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          if (magnet) {
            end = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(stairDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — mesma
            // lógica do bloco de Parede acima, ver lá.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
          }
          if (isValidStairDraft(stairDraftStart, end)) {
            // Fase 5, N1 "escada P/M/G": stepWidth da PRÓXIMA escada vem da
            // preferência de sessão `stairSizePreset` (default 'medium' ===
            // 1×grid, byte a byte o `map.grid` que este call site sempre usou
            // antes desta fase — nenhuma mudança de comportamento pra quem
            // não mexer na setinha).
            const stairId = crypto.randomUUID()
            addStair(buildStairFromDraft(stairId, stairDraftStart, end, stairStepWidthForPreset(stairSizePreset, map.grid)))
            // A escada recém-desenhada nasce SELECIONADA, como a Sala (ver o
            // bloco 'drawing-room' acima). Sem isto ela nascia órfã: o painel
            // não mostrava nada e não havia como trocar o sentido nem mover
            // sem antes acertar um clique em cima dela — o passeio cego de
            // 16/09/2026 gastou 4 tentativas e não conseguiu.
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'stair', id: stairId }))
          } else {
            // Rascunho recusado = clique parado (início e fim no mesmo ponto).
            // Antes daqui a ferramenta simplesmente emudecia, e o relato de
            // 18/09/2026 é exatamente esse: nada nasceu e nada foi dito. Mesmo
            // caminho de fala que a Porta já usa no pointerdown deste arquivo
            // quando o clique erra a parede.
            useToastStore.getState().push('info', STAIR_CLICK_WITHOUT_DRAG_TEXT)
          }
          stairDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'painting-floor-blocks') {
          // Clique parado também conta: uma célula pintada é uma peça válida
          // (ao contrário do arrasto de retângulo, que precisa de área).
          finishBlocos()
        }

        if (mode === 'drawing-floor' && floorDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const draft = floorDraftFromDrag(floorDraftStart, worldPoint, event.shiftKey, event.altKey)
          // Clique sem arrasto dá `piece: null` — nada nasce.
          if (draft?.piece) useMapStore.getState().addFloorPiece({ ...draft.piece, id: crypto.randomUUID() })
          floorDraftStart = null
          draftGraphics.clear()
        }

        // Região e Sala livre — o gesto só ganha significado aqui (ver
        // `regionDraftStart`). Não mexe em `mode` de propósito: as duas são
        // feitas de cliques soltos, mesmo padrão da régua logo abaixo.
        const toolDoTracado = useMapStore.getState().activeTool
        if (usaTracadoPontoAPonto(toolDoTracado) && regionDraftStart && regionDraftRawStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const dragged = Math.hypot(worldPoint.x - regionDraftRawStart.x, worldPoint.y - regionDraftRawStart.y)
          const start = regionDraftStart
          regionDraftStart = null
          regionDraftRawStart = null

          // Arrasto com o traçado vazio: retângulo inteiro num gesto só, do
          // jeito que Sala, Retângulo e Chão já se comportam. Com traçado
          // aberto, um arrasto continua valendo como mais um ponto — misturar
          // as duas coisas no meio de um polígono não tem leitura possível.
          //
          // Atalho SÓ da Região: na Sala livre o retângulo de um arrasto já é
          // a ferramenta Sala (tecla N), e um arrasto sem querer viraria uma
          // sala retangular no lugar do primeiro canto do polígono — aqui o
          // arrasto sempre vale como mais um canto.
          if (toolDoTracado === 'region' && regionDraftPoints.length === 0 && dragged >= REGION_DRAG_THRESHOLD) {
            const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
            if (isValidRoomDraft(start, end)) commitRegion(rectFromCorners(start, end))
            draftGraphics.clear()
          } else {
            regionDraftPoints = [...regionDraftPoints, start]
            drawRegionDraft(draftGraphics, regionDraftPoints, null)
          }
        }

        if (useMapStore.getState().activeTool === 'measure' && measureDraftStart) {
          measurementIndicatorRenderer.hide()
          measureDraftStart = null
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
        // Fecha o arrasto da alça de raio da Luz no mesmo padrão de Curva acima:
        // lightRadiusDragSnapshot é o `map` de ANTES do gesto (pointerdown); os
        // pointermoves do meio usaram updateLightRadiusLive, sem histórico.
        if (mode === 'dragging-light-radius' && lightRadiusDragSnapshot) {
          useMapStore.getState().commitDragHistory(lightRadiusDragSnapshot)
        }
        // Fecha o arrasto de canto de Sala retangular no mesmo padrão de Luz
        // acima: roomCornerDragSnapshot é o `map` de ANTES do gesto
        // (pointerdown); os pointermoves do meio usaram resizeRoomCornerLive,
        // sem histórico.
        if (mode === 'resizing-room-corner' && roomCornerDragSnapshot) {
          // Canto arrastado pode tirar a aresta de cima da parede da mãe (ou afastar a mãe das filhas).
          if (resizingRoomId !== null) useMapStore.getState().reparentAfterMoveLive(roomCornerDragSnapshot, [resizingRoomId])
          useMapStore.getState().commitDragHistory(roomCornerDragSnapshot)
        }
        // Giro da sala: sala de fora + ordem dos cantos, e o arrasto vira UM
        // Ctrl+Z. `mode` sai já aqui para a alça voltar a ser desenhada solta.
        if (mode === 'rotating-room') {
          roomRotateGesture.finish()
          mode = 'idle'
          redrawEditHandles()
        }
        // B3 (bug3 "mover e redimensionar") — mesmo padrão de Sala acima,
        // pros 3 resizes novos desta fase (Drawing rect/ellipse/polygon,
        // Token, Prop). Onda 3, item 18 — 'resizing-drawing-radius' (alça de
        // raio do circle) reusa o MESMO par mode/snapshot do corner-resize.
        if ((mode === 'resizing-drawing-corner' || mode === 'resizing-drawing-radius') && resizingDrawingSnapshot) {
          useMapStore.getState().commitDragHistory(resizingDrawingSnapshot)
        }
        if (mode === 'resizing-token' && resizingTokenSnapshot) {
          useMapStore.getState().commitDragHistory(resizingTokenSnapshot)
        }
        if (mode === 'resizing-prop-corner' && resizingPropSnapshot) {
          useMapStore.getState().commitDragHistory(resizingPropSnapshot)
        }
        // Fecha o gesto do vazio com a ferramenta Selecionar. Um gesto só,
        // três significados, decididos aqui por `classifyMarqueeGesture`
        // (lib/areaSelection.ts, puro e testado) porque só agora o gesto tem
        // tamanho:
        //
        //  'click'   — quase parado: foi um clique no vazio, e clique no
        //              vazio larga a seleção (e2e/task4-select-delete.spec.ts
        //              #6). Com Shift, não larga nada: Shift é sempre
        //              "construir conjunto", e um Shift+clique que erra o
        //              alvo por 2 px não pode destruir o conjunto.
        //  'replace' — arrasto sem Shift: a área SUBSTITUI a seleção, mesmo
        //              quando não pega nada (arrastar no nada é o jeito
        //              natural de dizer "nada selecionado"). Convenção de
        //              Figma/Inkscape/Dungeon Scrawl.
        //  'add'     — arrasto com Shift: SOMA ao conjunto já selecionado
        //              (comportamento original desta ferramenta;
        //              `selectionFromItems` dedupica quem já estava nos dois).
        if (mode === 'area-marquee-drag' && areaMarqueeStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const rect: AreaRect = { x1: areaMarqueeStart.x, y1: areaMarqueeStart.y, x2: worldPoint.x, y2: worldPoint.y }
          const gesture = classifyMarqueeGesture(rect, camera.scale, event.shiftKey)
          const store = useMapStore.getState()
          if (gesture === 'click') {
            if (!event.shiftKey && store.selection.length > 0) store.setSelection(EMPTY_SELECTION)
          } else {
            const encontrados = selectionFromAreaSelection(selectEntitiesInArea(store.map, rect))
            store.setSelection(
              gesture === 'add' ? selectionFromItems([...store.selection, ...encontrados]) : selectionFromItems(encontrados),
            )
          }
          areaMarqueeGraphics.clear()
        }
        if (mode === 'dragging-area-selection' && areaSelectionDragBefore) {
          useMapStore.getState().reparentAfterMoveLive(areaSelectionDragBefore)
          useMapStore.getState().commitDragHistory(areaSelectionDragBefore)
        }
        // Onda 1, item 3 (Frente F) — fecha mover-corpo de Token/Prop/Wall/
        // Region/Stair/Drawing num Ctrl+Z só, mesmo padrão dos commits acima:
        // snapshot de ANTES do gesto (pointerdown), pointermoves do meio
        // usaram as variantes *Live (sem histórico).
        if (mode === 'dragging-token' && tokenDragSnapshot) {
          useMapStore.getState().commitDragHistory(tokenDragSnapshot)
        }
        if (mode === 'dragging-prop' && propDragSnapshot) {
          useMapStore.getState().commitDragHistory(propDragSnapshot)
        }
        // Mesmo par do Token: arrastar o pino inteiro vira UM Ctrl+Z.
        if (mode === 'dragging-pin' && pinDragSnapshot) {
          useMapStore.getState().commitDragHistory(pinDragSnapshot)
        }
        if (
          (mode === 'dragging-wall-body' || mode === 'dragging-region-body' ||
            mode === 'dragging-stair-body' || mode === 'dragging-line-body' || mode === 'dragging-floor-body') &&
          bodyDragSnapshot
        ) {
          // Sala arrastada (pelo corpo ou por uma parede dela) recalcula a sala de fora antes de fechar o Ctrl+Z.
          if (mode === 'dragging-region-body' && draggingRegionBodyId !== null) {
            const sources = altDragRegionSource === null ? undefined : { [draggingRegionBodyId]: altDragRegionSource }
            useMapStore.getState().reparentAfterMoveLive(bodyDragSnapshot, [draggingRegionBodyId], sources)
          }
          if (mode === 'dragging-wall-body' && draggingWallBodyId !== null) {
            const movedRegionId = useMapStore.getState().map.walls.find((w) => w.id === draggingWallBodyId)?.regionId
            if (movedRegionId !== undefined) useMapStore.getState().reparentAfterMoveLive(bodyDragSnapshot, [movedRegionId])
          }
          useMapStore.getState().commitDragHistory(bodyDragSnapshot)
        }
        // Passada de borracha: um Ctrl+Z desfaz o gesto inteiro (ver
        // `eraseDuringGesture`). Vale igual no pointerupoutside — soltar o
        // botão fora do canvas encerra a passada do mesmo jeito.
        if (mode === 'erasing') finishEraseGesture()
        curveDragSnapshot = null
        lightRadiusDragSnapshot = null
        roomCornerDragSnapshot = null
        resizingRoomId = null
        resizingCorner = null
        resizingDrawingId = null
        resizingDrawingCorner = null
        resizingDrawingSnapshot = null
        resizingTokenId = null
        resizingTokenSnapshot = null
        resizingPropId = null
        resizingPropCorner = null
        resizingPropSnapshot = null
        areaMarqueeStart = null
        areaSelectionDragBefore = null
        areaSelectionDragLastPoint = null
        tokenDragSnapshot = null
        propDragSnapshot = null
        bodyDragSnapshot = null
        pinDragSnapshot = null
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingPinId = null
        pinDragOffset = null
        draggingCurveId = null
        draggingCurveBodyId = null
        draggingWallPointId = null
        draggingRegionId = null
        draggingWallBodyId = null
        draggingRegionBodyId = null
        draggingStairBodyId = null
        draggingFloorBodyId = null
        draggingLineId = null
        draggingLineBodyId = null
        draggingLightId = null
        bodyDragLastPoint = null
        finishRoomLabelDrag()
        guidesGraphics.clear()
        angleIndicatorRenderer.hide()
        // O número de quadrados é informação PASSAGEIRA: vive só enquanto o
        // botão está apertado. Mesmo choke point de `angleIndicatorRenderer`,
        // pra não precisar de um hide() por ramo de pointerup.
        tokenDragDistanceRenderer.hide()
        tokenDragOrigin = null
        tokenDragLastShown = null
        // Onda 2, item 16 (Frente C) — mesmo choke point de
        // angleIndicatorRenderer: cobre TODOS os pointerup de forma
        // (room/stair/polygon-room/rect/ellipse/circle) sem precisar de um
        // hide() por bloco.
        dimensionLabelRenderer.hide()
        // Mesmo choke point: a dica do marquee vive só enquanto o botão está
        // apertado. Sem isto ela ficaria "grudada" na tela depois de soltar,
        // o mesmo bug que os dois `hide()` acima documentam.
        marqueeHint.hide()
        updateCursor()

        // Clique num pino de viagem com a Selecionar: atravessa. Por último, com
        // o gesto já fechado — a travessia troca o mapa inteiro do editor. A
        // distância é medida de novo aqui porque o pino TRAVADO não entra no
        // modo de arrasto e nenhum pointermove marca `moved`.
        const travessia = travelPress
        travelPress = null
        if (
          travessia !== null &&
          !travessia.moved &&
          event.button === 0 &&
          Math.hypot(event.global.x - travessia.x, event.global.y - travessia.y) < TRAVEL_CLICK_SLOP_PX
        ) {
          onTravelPinRef.current?.(travessia.pinId)
        }
      })

      app.stage.on('pointerupoutside', () => {
        tokenPlacementPoint = null
        // Soltou fora do canvas: não é clique no pino, não atravessa.
        travelPress = null
        // O toque terminou FORA do canvas: ele não é mais a primeira metade de
        // um duplo clique, e o próximo toque dentro do mapa é um toque novo.
        ultimoToqueDoTracado = null
        if (laserGesture.pointerUp()) return
        // Mesmo fechamento de gesto do pointerup acima — o mouse pode sair do
        // canvas no meio de um arrasto de Curva, e o gesto ainda precisa virar
        // uma entrada de undo só (senão as mudanças aplicadas via *Live ficam
        // sem NENHUMA entrada de histórico, e um Ctrl+Z pula direto pra antes
        // do gesto ainda mais anterior).
        if ((mode === 'dragging-curve-point' || mode === 'dragging-curve-body') && curveDragSnapshot) {
          useMapStore.getState().commitDragHistory(curveDragSnapshot)
        }
        if (mode === 'dragging-light-radius' && lightRadiusDragSnapshot) {
          useMapStore.getState().commitDragHistory(lightRadiusDragSnapshot)
        }
        if (mode === 'resizing-room-corner' && roomCornerDragSnapshot) {
          // Canto arrastado pode tirar a aresta de cima da parede da mãe (ou afastar a mãe das filhas).
          if (resizingRoomId !== null) useMapStore.getState().reparentAfterMoveLive(roomCornerDragSnapshot, [resizingRoomId])
          useMapStore.getState().commitDragHistory(roomCornerDragSnapshot)
        }
        // Giro da sala solto fora do canvas: fecha igual ao pointerup.
        if (mode === 'rotating-room') {
          roomRotateGesture.finish()
          mode = 'idle'
          redrawEditHandles()
        }
        // B3/N3 — mesmo padrão de commit acima, ver comentário no pointerup.
        if ((mode === 'resizing-drawing-corner' || mode === 'resizing-drawing-radius') && resizingDrawingSnapshot) {
          useMapStore.getState().commitDragHistory(resizingDrawingSnapshot)
        }
        if (mode === 'resizing-token' && resizingTokenSnapshot) {
          useMapStore.getState().commitDragHistory(resizingTokenSnapshot)
        }
        if (mode === 'resizing-prop-corner' && resizingPropSnapshot) {
          useMapStore.getState().commitDragHistory(resizingPropSnapshot)
        }
        if (mode === 'dragging-area-selection' && areaSelectionDragBefore) {
          useMapStore.getState().reparentAfterMoveLive(areaSelectionDragBefore)
          useMapStore.getState().commitDragHistory(areaSelectionDragBefore)
        }
        // Soltar o botão fora do canvas no meio de um traço do pincel: o que já
        // foi pintado vira peça, em vez de sumir sem explicação. Precisa vir
        // ANTES do `mode = 'idle'` lá embaixo, como os commits vizinhos.
        if (mode === 'painting-floor-blocks') finishBlocos()
        // Onda 1, item 3 (Frente F) — mesmo padrão de commit acima, ver
        // comentário completo no pointerup.
        if (mode === 'dragging-token' && tokenDragSnapshot) {
          useMapStore.getState().commitDragHistory(tokenDragSnapshot)
        }
        if (mode === 'dragging-prop' && propDragSnapshot) {
          useMapStore.getState().commitDragHistory(propDragSnapshot)
        }
        // Mesmo par do Token: arrastar o pino inteiro vira UM Ctrl+Z.
        if (mode === 'dragging-pin' && pinDragSnapshot) {
          useMapStore.getState().commitDragHistory(pinDragSnapshot)
        }
        if (
          (mode === 'dragging-wall-body' || mode === 'dragging-region-body' ||
            mode === 'dragging-stair-body' || mode === 'dragging-line-body' || mode === 'dragging-floor-body') &&
          bodyDragSnapshot
        ) {
          // Sala arrastada (pelo corpo ou por uma parede dela) recalcula a sala de fora antes de fechar o Ctrl+Z.
          if (mode === 'dragging-region-body' && draggingRegionBodyId !== null) {
            const sources = altDragRegionSource === null ? undefined : { [draggingRegionBodyId]: altDragRegionSource }
            useMapStore.getState().reparentAfterMoveLive(bodyDragSnapshot, [draggingRegionBodyId], sources)
          }
          if (mode === 'dragging-wall-body' && draggingWallBodyId !== null) {
            const movedRegionId = useMapStore.getState().map.walls.find((w) => w.id === draggingWallBodyId)?.regionId
            if (movedRegionId !== undefined) useMapStore.getState().reparentAfterMoveLive(bodyDragSnapshot, [movedRegionId])
          }
          useMapStore.getState().commitDragHistory(bodyDragSnapshot)
        }
        // Passada de borracha: um Ctrl+Z desfaz o gesto inteiro (ver
        // `eraseDuringGesture`). Vale igual no pointerupoutside — soltar o
        // botão fora do canvas encerra a passada do mesmo jeito.
        if (mode === 'erasing') finishEraseGesture()
        curveDragSnapshot = null
        lightRadiusDragSnapshot = null
        roomCornerDragSnapshot = null
        resizingRoomId = null
        resizingCorner = null
        resizingDrawingId = null
        resizingDrawingCorner = null
        resizingDrawingSnapshot = null
        resizingTokenId = null
        resizingTokenSnapshot = null
        resizingPropId = null
        resizingPropCorner = null
        resizingPropSnapshot = null
        areaSelectionDragBefore = null
        areaSelectionDragLastPoint = null
        tokenDragSnapshot = null
        propDragSnapshot = null
        bodyDragSnapshot = null
        pinDragSnapshot = null
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
        draggingPinId = null
        pinDragOffset = null
        draggingCurveId = null
        draggingCurveBodyId = null
        draggingWallPointId = null
        draggingRegionId = null
        draggingWallBodyId = null
        draggingRegionBodyId = null
        draggingStairBodyId = null
        draggingFloorBodyId = null
        draggingLineId = null
        draggingLineBodyId = null
        draggingLightId = null
        bodyDragLastPoint = null
        finishRoomLabelDrag()
        guidesGraphics.clear()
        updateCursor()
        // N3: o mouse saiu do canvas no meio de um marquee ainda ABERTO —
        // cancela sem fechar a seleção (mesmo padrão de wallDraftStart/
        // roomDraftStart abaixo: um draft "solto fora do canvas" descarta, não
        // commita com o último ponto conhecido).
        if (areaMarqueeStart) {
          areaMarqueeStart = null
          areaMarqueeGraphics.clear()
          marqueeHint.hide()
        }
        if (wallDraftStart) {
          wallDraftStart = null
          draftGraphics.clear()
        }
        if (stairDraftStart) {
          stairDraftStart = null
          draftGraphics.clear()
        }
        // Arrasto de Região que terminou fora do canvas: descarta o retângulo
        // em curso e NÃO deixa o ponto virar vértice — mesma regra dos drafts
        // vizinhos. O traçado ponto a ponto já fechado (regionDraftPoints)
        // continua vivo de propósito: ele não é um gesto em curso.
        if (regionDraftStart) {
          regionDraftStart = null
          regionDraftRawStart = null
          if (regionDraftPoints.length === 0) draftGraphics.clear()
        }
        if (measureDraftStart) {
          measurementIndicatorRenderer.hide()
          measureDraftStart = null
        }
        if (roomDraftStart) {
          roomDraftStart = null
          draftGraphics.clear()
        }
        if (concealDraftStart) {
          concealDraftStart = null
          concealDraftRawStart = null
          draftGraphics.clear()
        }
        if (polygonDraftCenter) {
          polygonDraftCenter = null
          draftGraphics.clear()
        }
        if (rectDraftStart) {
          rectDraftStart = null
          draftGraphics.clear()
        }
        if (ellipseDraftCenter) {
          ellipseDraftCenter = null
          draftGraphics.clear()
        }
        if (floorDraftStart) {
          floorDraftStart = null
          draftGraphics.clear()
        }
        if (
          freehandDraftPoints.length > 0 ||
          lineDraftStart ||
          circleDraftCenter ||
          lightDraftCenter ||
          curveDraftPoints.length > 0 ||
          polygonDraftPoints.length > 0
        ) {
          draftGraphics.clear()
        }
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        lightDraftCenter = null
        lightDraftRawStart = null
        curveDraftPoints = []
        polygonDraftPoints = []
        angleIndicatorRenderer.hide()
        // Soltar a ficha fora do canvas encerra o arrasto do mesmo jeito: o
        // número não pode ficar grudado na tela.
        tokenDragDistanceRenderer.hide()
        tokenDragOrigin = null
        tokenDragLastShown = null
        // Onda 2, item 16 (Frente C) — mesmo choke point acima: o mouse saiu
        // do canvas no meio de um arrasto de forma, o rótulo não pode ficar
        // "grudado" na tela.
        dimensionLabelRenderer.hide()
      })

      app.stage.on('pointermove', (event) => {
        // B2 — antes de qualquer gesto: guarda o ponteiro (L só arma sobre o canvas).
        laserPointer = toWorldPoint(event.global.x, event.global.y)
        // Mexer o mouse com L apertado já arma o laser, sem esperar o tempo do toque.
        if (laserKeyTimer !== null) activateLaserKey()
        // Traço do laser em curso (botão esquerdo pressionado): consome o move.
        if (laserGesture.pointerMove(laserPointer)) return
        // Armado e ocioso: sem hover nem prévia da ferramenta, só a mira.
        if (mode === 'idle' && isLaserArmed(useLaserStore.getState())) return

        if (mode === 'panning') {
          const dx = event.global.x - lastPoint.x
          const dy = event.global.y - lastPoint.y
          lastPoint = { x: event.global.x, y: event.global.y }
          applyCamera(panBy(camera, dx, dy), 'gesto')
          return
        }

        // Onda 1, item 1 (cursor vivo) — só em `mode === 'idle'` existe
        // "hover" pra recalcular; todo outro `mode` já está no meio de um
        // gesto (o cursor dele é fixo, decidido por `resolveCursor` a partir
        // só do `mode`, ver docstring do módulo). Roda a cada pointermove
        // ocioso — 1 evento de atraso perceptível é imperceptível a 60fps.
        if (mode === 'idle') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const hover = resolveHoverAtIdle(worldPoint)
          hoverKind = hover.kind
          hoverCorner = hover.corner
          hoverTarget = hover.target
          updateCursor()
          // Onda 2, item 15 (Frente B) — anel de hover, mesmo custo marginal
          // ~0 do resolveHoverHit (ver docstring do módulo).
          drawHover(hoverGraphics, useMapStore.getState().map, hoverTarget)
          // Corredor em construção não tem `mode` (cliques soltos), então a
          // prévia até o cursor mora aqui, no pointermove ocioso.
          if (corridorDraftPoints.length > 0 && useMapStore.getState().activeTool === 'floor') {
            drawCorridorDraft(applySnap(worldPoint, useMapStore.getState().map.grid, 'wall', event.altKey))
          }
          // Região e Sala livre também são feitas de cliques soltos (`mode`
          // nunca sai de 'idle'), e por isso a prévia delas precisa morar aqui:
          // enquanto estava lá embaixo, depois do `return` deste bloco, NUNCA
          // era desenhada — nem o retângulo do arrasto, nem a linha até o
          // cursor no traçado ponto a ponto. Era a queixa "não aparece nada".
          const toolDaPrevia = useMapStore.getState().activeTool
          if (usaTracadoPontoAPonto(toolDaPrevia)) {
            const cursor = applySnap(worldPoint, useMapStore.getState().map.grid, 'wall', event.altKey)
            // Prévia de retângulo é do atalho de arrasto, que só a Região tem.
            if (toolDaPrevia === 'region' && regionDraftStart && regionDraftPoints.length === 0) {
              const rect = rectFromCorners(regionDraftStart, cursor)
              // `cursor` = primeiro vértice: fecha o retângulo na prévia (a
              // prévia de polígono liga ponto a ponto, sem fechar sozinha).
              drawRegionDraft(draftGraphics, rect, rect[0])
            } else if (regionDraftPoints.length > 0) {
              drawRegionDraft(draftGraphics, regionDraftPoints, cursor)
            }
          }
          // A régua também não muda `mode` (pointerdown da ferramenta Medir),
          // então a prévia dela precisa morar aqui: depois deste `return` o
          // arrasto de medição nunca chegava a desenhar. Lê o mapa da store a
          // cada move para o modo de medição trocado na janela valer na hora.
          if (useMapStore.getState().activeTool === 'measure' && measureDraftStart) {
            const { map } = useMapStore.getState()
            const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
            const result = measureDistance(measureDraftStart, end, map.grid, map.gridShape, map.measurementMode, map.scale)
            measurementIndicatorRenderer.show(angleIndicatorContainer, measureDraftStart, end, result.label)
          }
          return
        }

        if (mode === 'dragging-token' && draggingTokenId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          // O tamanho da ficha arrastada decide ONDE ela assenta: a de lado
          // par gruda na linha da grade, a de lado ímpar no centro da célula.
          const cells = tokenSizeInSquares(map.tokens.find((token) => token.id === draggingTokenId))
          const snapped = applySnap(worldPoint, map.grid, 'token', event.altKey, cells)
          const candidates = map.tokens
            .filter((token) => token.id !== draggingTokenId)
            .map((token) => ({ x: token.x, y: token.y }))
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          useMapStore.getState().moveTokenLive(draggingTokenId, result.point.x, result.point.y)
          // Quantos quadrados a ficha já andou, enquanto o botão está apertado.
          // A conta é a da ferramenta Medir (`measureCells`, via
          // `rotuloDeQuadradosAndados`) e o desenho é o desenhista dela, com o
          // modo de medição da própria mesa — duas réguas divergentes seriam
          // pior que nenhuma. `tokenDragOrigin` é a posição de ANTES do gesto.
          if (tokenDragOrigin) {
            const rotulo = rotuloDeQuadradosAndados(
              tokenDragOrigin,
              result.point,
              map.grid,
              map.gridShape,
              map.measurementMode,
            )
            // Sem mexer em Graphics/Text quando nada mudou: entre dois centros
            // de célula cabem dezenas de pointermove idênticos, e este é o
            // gesto mais usado do app.
            const assinatura = rotulo === null ? null : `${rotulo}@${result.point.x},${result.point.y}`
            if (assinatura !== tokenDragLastShown) {
              if (rotulo === null) {
                tokenDragDistanceRenderer.hide()
              } else {
                // Logo acima do disco, nunca por dentro dele: o raio sai de
                // `tokenRadiusOf` (lib/doorReach.ts), a mesma conta que o
                // desenho e o hit-test usam, então ficha grande não engole o
                // número. O nome da peça é desenhado ABAIXO do disco, então
                // acima está livre.
                const arrastada = map.tokens.find((t) => t.id === draggingTokenId)
                const raio = arrastada ? tokenRadiusOf(arrastada, map.grid) : map.grid / 2
                tokenDragDistanceRenderer.show(angleIndicatorContainer, tokenDragOrigin, result.point, rotulo, {
                  x: result.point.x,
                  y: result.point.y - raio - FOLGA_DO_ROTULO_DE_QUADRADOS,
                })
              }
              tokenDragLastShown = assinatura
            }
          }
          return
        }

        if (mode === 'dragging-pin' && draggingPinId && pinDragOffset) {
          // Pino de viagem: dentro da folga o gesto ainda é o clique que
          // atravessa, e o pino fica onde está.
          if (travelPress !== null && !travelPress.moved) {
            if (Math.hypot(event.global.x - travelPress.x, event.global.y - travelPress.y) < TRAVEL_CLICK_SLOP_PX) return
            travelPress.moved = true
          }
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          // Sem snap e sem guias de alinhamento, de propósito: o pino nasce
          // ONDE o mestre clica (ver o pointerdown da ferramenta Pino), e mover
          // não pode obedecer a uma regra diferente de criar.
          useMapStore.getState().movePinLive(draggingPinId, worldPoint.x + pinDragOffset.x, worldPoint.y + pinDragOffset.y)
          return
        }

        if (mode === 'dragging-prop' && draggingPropId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'prop', event.altKey)
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
          useMapStore.getState().movePropLive(draggingPropId, result.point.x, result.point.y)
          return
        }

        if (mode === 'erasing') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          eraseDuringGesture(worldPoint)
          return
        }

        if (mode === 'dragging-curve-point' && draggingCurveId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          useMapStore.getState().updateCurvePointLive(draggingCurveId, draggingCurvePointIndex, p.x, p.y)
          return
        }

        if (mode === 'dragging-wall-point' && draggingWallPointId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          // Ímã primeiro — mesma prioridade que já vale ao DESENHAR uma parede
          // nova (ver 'drawing-wall' acima), até aqui ausente neste modo
          // (arrastar a ponta de uma parede JÁ desenhada). Era essa ausência
          // que causava "não consigo fechar as paredes externas quando
          // aproximo": sem ímã, só `computeAlignment` (guia de alinhamento)
          // testava X e Y de forma INDEPENDENTE, então um ponto a poucos px de
          // distância num só eixo ficava com folga visível mesmo "colado"
          // visualmente (Dossiê F4, "bug1 canto-aberto"/"não-fecha").
          // `excludeWallId` (selectionHitTest.ts) evita que a própria parede em
          // arrasto (inclusive a OUTRA ponta dela) vire candidata espúria.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE, draggingWallPointId)
          if (magnet) {
            drawGuides(guidesGraphics, [], computeViewport())
            useMapStore.getState().updateWallPoint(draggingWallPointId, draggingWallPointIndex, magnet.x, magnet.y)
            return
          }
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
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
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const candidates = map.regions
            .filter((region) => region.id !== draggingRegionId)
            .flatMap((region) => region.points)
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          useMapStore.getState().updateRegionPoint(draggingRegionId, draggingRegionPointIndex, result.point.x, result.point.y)
          return
        }

        if (mode === 'resizing-room-corner' && resizingRoomId !== null && resizingCorner !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, resizeRoomCornerLive } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          resizeRoomCornerLive(resizingRoomId, resizingCorner, snapped.x, snapped.y)
          return
        }

        // Giro da sala ao vivo, com o ângulo numa etiqueta junto ao ponteiro
        // (o mesmo rótulo de número do arrasto de forma; some no pointerup).
        if (mode === 'rotating-room') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const giro = roomRotateGesture.move(worldPoint, event.shiftKey)
          if (giro) dimensionLabelRenderer.show(angleIndicatorContainer, worldPoint, giro.label, computeViewport())
          return
        }

        if (mode === 'dragging-wall-body' && draggingWallBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
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
              useMapStore.getState().moveWallLive(draggingWallBodyId, result.point.x - wall.x1, result.point.y - wall.y1)
            }
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-room-label' && roomLabelDragId !== null && roomLabelDragStartPoint && roomLabelDragStartOffset) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          // Sem snap: o rótulo é texto solto, e o grid o prenderia em cima das paredes.
          // Mas preso à sala: ver `clampRoomLabelOffset`.
          const regiaoDoRotulo = useMapStore.getState().map.regions.find((r) => r.id === roomLabelDragId)
          useMapStore.getState().setRoomLabelOffsetLive(
            roomLabelDragId,
            clampRoomLabelOffset(regiaoDoRotulo, {
              x: roomLabelDragStartOffset.x + worldPoint.x - roomLabelDragStartPoint.x,
              y: roomLabelDragStartOffset.y + worldPoint.y - roomLabelDragStartPoint.y,
            }),
          )
          return
        }

        if (mode === 'dragging-region-body' && draggingRegionBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            const region = map.regions.find((r) => r.id === draggingRegionBodyId)
            if (region) {
              // Mesma ancoragem do wall-body acima, no primeiro ponto da regiao.
              const anchor = region.points[0]
              const tentativeAnchor = { x: anchor.x + dx, y: anchor.y + dy }
              // Sub-salas andam junto: alinhar com elas seria alinhar consigo mesma.
              const moving = subtreeIds(map.regions, draggingRegionBodyId)
              const candidates = map.regions
                .filter((r) => !moving.has(r.id))
                .flatMap((r) => r.points)
              const result = computeAlignment(tentativeAnchor, candidates)
              drawGuides(guidesGraphics, result.guides, computeViewport())
              useMapStore.getState().moveRegionLive(draggingRegionBodyId, result.point.x - anchor.x, result.point.y - anchor.y)
            }
            bodyDragLastPoint = p
          }
          return
        }

        // Onda 3, item 19 (Frente C) — guias de alinhamento no corpo da
        // escada, no mesmo padrão de dragging-wall-body/dragging-region-body
        // acima: âncora no primeiro ponto do 1º segmento (`stair.segments[0]`,
        // mesmo campo que `moveStairLive` já move de forma delta-based),
        // testa contra as pontas de PAREDE + bordas/centro do mapa
        // (`mapBoundsCandidates`), converte de volta pra delta. Sem
        // candidato próprio de escada/linha de propósito — "colar em outra
        // escada" é bem mais raro que "fechar contra a parede mais perto".
        if (mode === 'dragging-stair-body' && draggingStairBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            const stair = map.stairs.find((s) => s.id === draggingStairBodyId)
            if (stair) {
              const anchor = stair.segments[0]
              const tentativeAnchor = { x: anchor.x1 + dx, y: anchor.y1 + dy }
              const candidates = [
                ...map.walls.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
                ...mapBoundsCandidates(map),
              ]
              const result = computeAlignment(tentativeAnchor, candidates)
              drawGuides(guidesGraphics, result.guides, computeViewport())
              useMapStore.getState().moveStairLive(draggingStairBodyId, result.point.x - anchor.x1, result.point.y - anchor.y1)
            }
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-floor-body' && draggingFloorBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveFloorPieceLive } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            moveFloorPieceLive(draggingFloorBodyId, dx, dy)
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'painting-floor-blocks' && blocoUltimoPonto) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          acumularBlocos(blocoUltimoPonto, worldPoint)
          blocoUltimoPonto = worldPoint
          return
        }

        if (mode === 'drawing-floor' && floorDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const draft = floorDraftFromDrag(floorDraftStart, worldPoint, event.shiftKey, event.altKey)
          const { map } = useMapStore.getState()
          if (!draft?.piece) {
            draftGraphics.clear()
            dimensionLabelRenderer.hide()
            return
          }
          drawFloorDraft(draftGraphics, draft.piece, map.floorStyle.fillColor)
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            draft.end,
            dimensionLabel(draft.dimension, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
          return
        }

        if (mode === 'dragging-line-point' && draggingLineId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          useMapStore.getState().updateLinePoint(draggingLineId, draggingLinePointIndex, p.x, p.y)
          return
        }

        // Onda 3, item 19 (Frente C) — guias de alinhamento no corpo da
        // Linha, mesmo padrão de dragging-stair-body acima. Restrito a
        // `kind === 'line'` de propósito: `dragging-line-body` hoje move
        // QUALQUER Drawing (B3 generalizou pra circle/text/freehand/rect/
        // ellipse/polygon também, apesar do nome do mode) e cada kind tem uma
        // âncora geometricamente diferente (x1/y1, cx/cy, x/y, points[0]...);
        // este item do plano pediu só Linha — os demais kinds continuam com
        // `applySnap` puro, sem guia, exatamente como antes desta mudança.
        if (mode === 'dragging-line-body' && draggingLineBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            const drawing = map.drawings.find((d) => d.id === draggingLineBodyId)
            if (drawing && drawing.kind === 'line') {
              const tentativeAnchor = { x: drawing.x1 + dx, y: drawing.y1 + dy }
              const candidates = [
                ...map.walls.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]),
                ...mapBoundsCandidates(map),
              ]
              const result = computeAlignment(tentativeAnchor, candidates)
              drawGuides(guidesGraphics, result.guides, computeViewport())
              useMapStore.getState().moveDrawingLive(draggingLineBodyId, result.point.x - drawing.x1, result.point.y - drawing.y1)
            } else {
              useMapStore.getState().moveDrawingLive(draggingLineBodyId, dx, dy)
            }
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-curve-body' && draggingCurveBodyId !== null && bodyDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveCurveLive } = useMapStore.getState()
          const p = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const dx = p.x - bodyDragLastPoint.x
          const dy = p.y - bodyDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            moveCurveLive(draggingCurveBodyId, dx, dy)
            bodyDragLastPoint = p
          }
          return
        }

        if (mode === 'dragging-light-radius' && draggingLightId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, updateLightRadiusLive } = useMapStore.getState()
          const light = map.lights.find((l) => l.id === draggingLightId)
          if (light) {
            const radius = Math.hypot(worldPoint.x - light.x, worldPoint.y - light.y)
            updateLightRadiusLive(draggingLightId, radius)
          }
          return
        }

        // B3 (bug3 "mover e redimensionar") — resize por canto de Drawing
        // rect/ellipse/polygon, Token e Prop. Mesmo padrão *Live (sem
        // histórico) de resizing-room-corner acima. Onda 3, item 17 (Frente
        // B) — `modifiers`: Shift preserva a proporção original, Alt
        // redimensiona a partir do centro (ver `lib/objectTransform.ts`).
        if (mode === 'resizing-drawing-corner' && resizingDrawingId !== null && resizingDrawingCorner !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          useMapStore.getState().resizeDrawingCornerLive(resizingDrawingId, resizingDrawingCorner, worldPoint.x, worldPoint.y, { shift: event.shiftKey, alt: event.altKey })
          return
        }

        // Onda 3, item 18 (Frente B) — alça de raio do Drawing 'circle'.
        // Mesmo padrão *Live (sem histórico) do resize de canto acima.
        if (mode === 'resizing-drawing-radius' && resizingDrawingId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          useMapStore.getState().resizeCircleDrawingRadiusLive(resizingDrawingId, worldPoint.x, worldPoint.y)
          return
        }

        if (mode === 'resizing-token' && resizingTokenId !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const token = map.tokens.find((t) => t.id === resizingTokenId)
          if (token) {
            const size = resizeTokenSize(token, map.grid, worldPoint.x, worldPoint.y)
            useMapStore.getState().updateTokenLive(resizingTokenId, { size })
          }
          return
        }

        // Onda 3, item 17 — `modifiers`, mesma regra do Drawing acima.
        if (mode === 'resizing-prop-corner' && resizingPropId !== null && resizingPropCorner !== null) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          useMapStore.getState().resizePropCornerLive(resizingPropId, resizingPropCorner, worldPoint.x, worldPoint.y, { shift: event.shiftKey, alt: event.altKey })
          return
        }

        // N3 "ferramenta de seleção de área". Só geometria por pointermove:
        // quem está dentro do retângulo é calculado UMA vez, ao soltar — o
        // gesto precisa ficar liso com mapa grande, e `selectEntitiesInArea`
        // varre todas as entidades do mapa.
        if (mode === 'area-marquee-drag' && areaMarqueeStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const rect: AreaRect = { x1: areaMarqueeStart.x, y1: areaMarqueeStart.y, x2: worldPoint.x, y2: worldPoint.y }
          drawSelectionMarquee(areaMarqueeGraphics, rect)
          // A dica de "e a vista, como move?" só enquanto a pessoa ainda não
          // achou o caminho nesta sessão — ver `panPathLearned`.
          if (panPathLearned) marqueeHint.hide()
          else marqueeHint.show(rect, camera.scale)
          return
        }

        if (mode === 'dragging-area-selection' && areaSelectionDragLastPoint) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const dx = worldPoint.x - areaSelectionDragLastPoint.x
          const dy = worldPoint.y - areaSelectionDragLastPoint.y
          if (dx !== 0 || dy !== 0) {
            useMapStore.getState().moveSelectionLive(dx, dy)
            areaSelectionDragLastPoint = worldPoint
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
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
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
          const { map, roomFillColor } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em quadrado.
          const end = constrainDraft(roomDraftStart, snapped, 'room', { shift: event.shiftKey, alt: event.altKey })
          drawRoomDraft(draftGraphics, roomDraftStart, end, roomFillColor)
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            end,
            dimensionLabel({ tool: 'room', start: roomDraftStart, end }, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
          return
        }

        if (mode === 'drawing-conceal-zone' && concealDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          drawRoomDraft(draftGraphics, concealDraftStart, applySnap(worldPoint, map.grid, 'wall', event.altKey), '#000000')
          return
        }

        if (mode === 'drawing-stair' && stairDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, stairSizePreset } = useMapStore.getState()
          // Ímã primeiro — mesma lógica do preview de Parede acima, ver lá.
          // Preview e commit (pointerup acima) usam a MESMA checagem.
          const magnet = findNearestExistingVertex(map, worldPoint, VERTEX_MAGNET_TOLERANCE)
          let end: Point
          if (magnet) {
            end = magnet
          } else {
            const constrained = event.ctrlKey ? constrainToAngleStep(stairDraftStart, worldPoint) : worldPoint
            // Com Ctrl em grade hexagonal, NÃO re-snapa `constrained` — mesma
            // lógica do bloco de preview de Parede acima, ver lá.
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
          }
          // Mesmo stepWidth que o pointerup vai gravar (stairSizePreset) — o
          // preview do arrasto já mostra o tamanho real do preset escolhido.
          drawStairDraft(draftGraphics, stairDraftStart, end, stairStepWidthForPreset(stairSizePreset, map.grid))
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            end,
            dimensionLabel({ tool: 'stair', start: stairDraftStart, end }, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
          return
        }

        if (mode === 'drawing-polygon-room' && polygonDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, roomFillColor } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawRegularPolygonDraft(draftGraphics, polygonDraftCenter, end, polygonDraftSides, roomFillColor)
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            end,
            dimensionLabel(
              { tool: 'polygon-room', center: polygonDraftCenter, end, sides: polygonDraftSides },
              map.grid,
              map.gridShape,
              map.scale,
            ),
            computeViewport(),
          )
          return
        }

        if (mode === 'drawing-rect' && rectDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em quadrado.
          const end = constrainDraft(rectDraftStart, snapped, 'rect', { shift: event.shiftKey, alt: event.altKey })
          drawRectDraft(draftGraphics, rectDraftStart, end, drawColor, drawWidth, drawFilled, drawFillAlpha)
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            end,
            dimensionLabel({ tool: 'rect', start: rectDraftStart, end }, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
          return
        }

        if (mode === 'drawing-ellipse' && ellipseDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em círculo.
          const end = constrainDraft(ellipseDraftCenter, snapped, 'ellipse', { shift: event.shiftKey, alt: event.altKey })
          drawEllipseDraft(draftGraphics, ellipseDraftCenter, end, drawColor, drawWidth, drawFilled, drawFillAlpha)
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            end,
            dimensionLabel({ tool: 'ellipse', center: ellipseDraftCenter, end }, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
          return
        }

        if (mode === 'drawing-freehand') {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          freehandDraftPoints = [...freehandDraftPoints, worldPoint]
          const { drawColor, drawWidth, drawCap, drawTexture } = useMapStore.getState()
          drawFreehandDraft(draftGraphics, freehandDraftPoints, drawColor, drawWidth, drawCap, drawTexture)
          return
        }

        if (mode === 'drawing-line' && lineDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawDash } = useMapStore.getState()
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
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
            angleReference = constrained
          }
          // `cap` fica no default 'round' do draft, como sempre foi — quem
          // muda aqui é só o estilo do traço, para o preview já mostrar o
          // pontilhado em vez de prometer uma linha cheia.
          drawLineDraft(draftGraphics, lineDraftStart, end, drawColor, drawWidth, 'round', drawDash)
          angleIndicatorRenderer.show(
            angleIndicatorContainer,
            end,
            formatAngleLabel(angleDegrees(lineDraftStart, angleReference), event.ctrlKey),
          )
          return
        }

        if (mode === 'drawing-circle' && circleDraftCenter) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawFilled } = useMapStore.getState()
          const radius = Math.hypot(worldPoint.x - circleDraftCenter.x, worldPoint.y - circleDraftCenter.y)
          drawCircleDraft(draftGraphics, circleDraftCenter, radius, drawColor, drawWidth, drawFilled)
          // Onda 2, item 16 (Frente C) — número ao vivo.
          dimensionLabelRenderer.show(
            angleIndicatorContainer,
            worldPoint,
            dimensionLabel({ tool: 'circle', center: circleDraftCenter, end: worldPoint }, map.grid, map.gridShape, map.scale),
            computeViewport(),
          )
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
          const { drawColor, drawWidth, drawDash } = useMapStore.getState()
          drawCurveDraft(draftGraphics, curveDraftPoints, drawColor, drawWidth, 'round', drawDash)
          return
        }

        if (usaTracadoPontoAPonto(useMapStore.getState().activeTool) && regionDraftPoints.length > 0) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const cursor = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawRegionDraft(draftGraphics, regionDraftPoints, cursor)
        }

        if (useMapStore.getState().activeTool === 'path' && pathDraftPoints.length > 0) {
          drawPathPreview(toWorldPoint(event.global.x, event.global.y))
        }

        if (useMapStore.getState().activeTool === 'polygon' && polygonDraftPoints.length > 0) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const cursor = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawPolygonDraft(draftGraphics, polygonDraftPoints, cursor, drawColor, drawWidth, drawFilled, drawFillAlpha)
        }
      })

      const onDblClick = (event: MouseEvent) => {
        const { activeTool, selection, map } = useMapStore.getState()
        // Onda 4, item 24 — editar vértice de região/curva é sempre sobre UM
        // item; com 2+ selecionados (grupo) não há "o" item pra editar.
        const single = selectionSingle(selection)

        if (activeTool === 'select') {
          let editRegionId: string | null = null
          if (single?.kind === 'region') {
            editRegionId = single.id
          } else if (single?.kind === 'wall') {
            const wall = map.walls.find((w) => w.id === single.id)
            if (wall && wall.regionId !== undefined) editRegionId = wall.regionId
          }

          if (editRegionId !== null) {
            const region = map.regions.find((r) => r.id === editRegionId)
            // `canInteract`: remover vértice é editar a geometria — região
            // travada também não perde ponto por duplo clique.
            if (region && canInteract(region)) {
              const rect = el.getBoundingClientRect()
              const worldPoint = toWorldPoint(event.clientX - rect.left, event.clientY - rect.top)
              const index = findCurveControlPointAt(region.points, worldPoint)
              if (index !== null) {
                useMapStore.getState().removeRegionPoint(editRegionId, index)
                return
              }
            }
          } else if (single?.kind === 'drawing') {
            const drawing = map.drawings.find((d) => d.id === single.id)
            if (drawing && drawing.kind === 'curve') {
              const rect = el.getBoundingClientRect()
              const worldPoint = toWorldPoint(event.clientX - rect.left, event.clientY - rect.top)
              const index = findCurveControlPointAt(drawing.points, worldPoint)
              if (index !== null) {
                useMapStore.getState().removeCurvePoint(single.id, index)
                return
              }
            }
          }

          // A3 — duplo clique no nome ou dentro da Sala (inclusive numa parede
          // dela) abre o campo de nome sobre o canvas. Vem depois da remoção de
          // ponto acima: duplo clique em vértice continua removendo o vértice.
          const rect = el.getBoundingClientRect()
          const worldPoint = toWorldPoint(event.clientX - rect.left, event.clientY - rect.top)
          let roomRegion = findRoomLabelAt(visibleRegions(map.regions, map.hiddenLayers), worldPoint, map.grid, camera.scale)
          if (!roomRegion) {
            const hit = findSelectableAt(hitTestMap(map), worldPoint)
            const regionId =
              hit?.kind === 'region' ? hit.id : hit?.kind === 'wall' ? map.walls.find((w) => w.id === hit.id)?.regionId : undefined
            roomRegion = map.regions.find((r) => r.id === regionId && r.room !== undefined) ?? null
          }
          if (roomRegion?.room) {
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: roomRegion.id }))
            openNameEditor({ kind: 'room', regionId: roomRegion.id, value: roomRegion.room.name })
          }
          return
        }

        // Daqui para baixo é o fechamento do traçado ponto a ponto — e ele já
        // foi resolvido pelo gesto de dois toques do `pointerdown`, que roda
        // na janela do WINDOWS. A janela deste evento (~500 ms, fixa no
        // Chromium) cabe inteira dentro dela, então todo `dblclick` que chega
        // aqui logo depois de um fechamento é o eco do mesmo gesto: repetir
        // descartaria o rascunho que a pessoa já começou a seguir.
        if (performance.now() - fechadoPorDoisToquesEmMs <= FECHAMENTO_DOIS_TOQUES_JANELA_MS) return

        // Rede de segurança, de propósito NÃO removida: se por qualquer razão
        // o gesto de dois toques não tiver reconhecido o duplo clique (outro
        // dispositivo de entrada, um toque solto fora do canvas no meio), o
        // evento nativo continua fechando a forma como sempre fechou.
        fecharTracadoPontoAPonto(activeTool)
      }
      el.addEventListener('dblclick', onDblClick)

      /**
       * O botão DIREITO apaga com o pincel de blocos (decisão do usuário,
       * 15/09/2026). O menu de contexto do navegador nasce do mesmo botão e
       * abriria por cima do gesto — some só onde o gesto existe, para o clique
       * direito continuar normal em toda outra ferramenta.
       */
      const onContextMenu = (event: MouseEvent) => {
        const { activeTool, floorShapeKind } = useMapStore.getState()
        if (activeTool === 'floor' && floorShapeKind === 'blocos') event.preventDefault()
      }
      el.addEventListener('contextmenu', onContextMenu)

      /**
       * Onda 1, item 7 (nudge por seta) — move TODO o conjunto selecionado
       * (Onda 4, item 24: "operações passam a valer para o conjunto
       * inteiro") por `dx`/`dy` já na unidade certa (célula de grade sem
       * modificador, 10 células com Shift, px cru com Alt — `lib/keymap.ts`
       * já resolveu essa conta; aqui só falta multiplicar célula→px quando
       * `fine` é falso). Cada tecla é UM Ctrl+Z (não é gesto contínuo de
       * arrasto) — `moveSelectionBy` (mapStore.ts) reusa `moveAreaSelection`
       * (lib/areaSelection.ts), que já resolve os 7 kinds e respeita
       * `canInteract` item a item; luz agora move por nudge também (antes
       * declarado "sem capacidade" só porque o switch aqui não a cobria —
       * `moveAreaSelection` sempre soube mover luz, ver CONTRATO N3).
       */
      const nudgeSelected = (dx: number, dy: number, fine: boolean) => {
        const { selection, map } = useMapStore.getState()
        if (isSelectionEmpty(selection)) return
        const scale = fine ? 1 : map.grid
        useMapStore.getState().moveSelectionBy(dx * scale, dy * scale)
      }

      const onKeyDown = (event: KeyboardEvent) => {
        // No meio do giro da sala, Esc devolve a sala ao ângulo do começo — e
        // só isso: o botão ainda está apertado, então largar a seleção aqui
        // (o que o Esc faz fora do gesto) tiraria a sala da mão da pessoa.
        // Shift apertado agora já trava de 15 em 15°, sem esperar o mouse andar.
        if (mode === 'rotating-room') {
          if (event.key === 'Escape') {
            event.preventDefault()
            roomRotateGesture.cancel()
            dimensionLabelRenderer.hide()
            mode = 'idle'
            redrawEditHandles()
            updateCursor()
            return
          }
          if (event.key === 'Shift') {
            const giro = roomRotateGesture.setShift(true)
            if (giro && laserPointer) dimensionLabelRenderer.show(angleIndicatorContainer, laserPointer, giro.label, computeViewport())
            return
          }
        }

        // Rótulo recém-criado em edição: enquanto ele recebe o teclado, letra
        // é letra e não atalho de ferramenta. Vem ANTES de tudo — inclusive do
        // laser (L) e do Espaço=pan — porque esses também são teclas que
        // alguém pode querer escrever dentro do rótulo.
        //
        // Com o foco DENTRO de um campo do DOM quem manda é o campo: digitar
        // no painel lateral fecha a edição no mapa em vez de escrever duas
        // vezes no mesmo rótulo.
        if (textEditingId !== null) {
          const alvo = event.target as HTMLElement | null
          const tag = alvo?.tagName ?? ''
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') endTextEditing()
          else if (handleTextEditingKey(event)) return
        }

        // B2 — L com o ponteiro sobre o canvas: segurar liga o laser; o toque
        // curto vira o atalho da Linha só no keyup (releaseLaserKey). Fora do
        // canvas, L segue direto para `resolveShortcut` como antes.
        const laserKey = {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          targetTagName: event.target instanceof HTMLElement ? event.target.tagName : '',
        }
        if (isLaserKey(laserKey) && (laserPointer !== null || laserKeyTimer !== null || useLaserStore.getState().held)) {
          event.preventDefault()
          if (event.repeat || laserKeyTimer !== null || useLaserStore.getState().held) return
          laserKeyTap = laserKey
          laserKeyTimer = setTimeout(activateLaserKey, LASER_KEY_TAP_MS)
          return
        }

        // Item #8 (pan universal) — Espaço arma o pan; tratado à parte de
        // `resolveShortcut` porque não é uma "ação" de conteúdo do mapa, é um
        // MODIFICADOR contínuo (segurar/soltar), na mesma classe de Ctrl/Alt/
        // Shift que os outros gestos já leem direto de `event.*Key`. Mesmo
        // guard de campo editável que `resolveShortcut` aplica às letras —
        // sem isso, digitar espaço num campo de texto (nome de token, rótulo)
        // armaria pan por engano.
        if (event.key === ' ') {
          const target = event.target as HTMLElement | null
          const editable = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
          if (editable) return
          if (!spaceHeld) {
            spaceHeld = true
            if (mode === 'idle') updateCursor()
          }
          event.preventDefault()
          return
        }

        // Enter fecha o traçado ponto a ponto em construção — corredor de Chão,
        // Região/Sala livre ou Polígono do Desenho (mesma saída do duplo
        // clique). preventDefault: o foco pode estar no botão da barra, e o
        // Enter "clicaria" nele de novo.
        //
        // O Polígono entrou aqui em 18/09/2026: `hasPointDraft()` já contava os
        // TRÊS rascunhos, mas esta condição só olhava dois, então o Polígono era
        // a única ferramenta de clique-a-clique sem fim — e o rascunho que não
        // vira mapa morre no `clearDrafts()` da próxima troca de ferramenta.
        if (event.key === 'Enter' && hasPointDraft()) {
          const target = event.target as HTMLElement | null
          const editable = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
          if (!editable) {
            event.preventDefault()
            if (corridorDraftPoints.length > 0) finishCorridor()
            else if (polygonDraftPoints.length > 0) finishPolygon()
            else if (pathDraftPoints.length > 0) finishPath()
            else finishRegion()
            return
          }
        }

        const action = resolveShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          ...alvoDoAtalho(event.target),
        })
        if (action === null) return
        // Sem isto o navegador também seleciona o texto da interface (laranja).
        if (action.kind === 'selectAll') event.preventDefault()
        // Ctrl+G / Ctrl+Shift+G são "achar próximo/anterior" do navegador.
        if (action.kind === 'group' || action.kind === 'ungroup') event.preventDefault()
        runShortcut(action)
      }

      const runShortcut = (action: NonNullable<ReturnType<typeof resolveShortcut>>) => {
        switch (action.kind) {
          case 'cancel':
            clearDrafts()
            // Onda 4, item 24 — Esc cancela um marquee aberto e limpa a
            // seleção, de QUALQUER tamanho.
            //
            // O "de qualquer tamanho" é de 17/09/2026: até aqui só grupo (2+
            // itens) era largado, e um item só ficava grudado. No passeio, o
            // "Closet secreto" seguia contornado de amarelo depois de dois
            // Escape — um com a ferramenta Sala, outro com a Selecionar — e o
            // painel continuava mostrando as propriedades dele. Largar a
            // seleção só clicando numa área vazia é dizer que a tecla
            // universal de "deixa pra lá" não vale aqui; ela vale.
            if (mode === 'area-marquee-drag') {
              areaMarqueeStart = null
              areaMarqueeGraphics.clear()
              marqueeHint.hide()
              mode = 'idle'
            }
            if (useMapStore.getState().selection.length > 0) {
              useMapStore.getState().setSelection(EMPTY_SELECTION)
            }
            // O pino tem estado de seleção próprio e `setSelection` o preserva
            // de propósito, então Esc o deixava selecionado calado — e o Delete
            // de minutos depois apagaria um pino que o mestre já achava solto.
            // "Deixa pra lá" vale para ele também.
            if (useMapStore.getState().selectedPinId !== null) {
              useMapStore.getState().setSelectedPin(null)
            }
            break
          // Apagar é o gesto mais barato de fazer e o mais caro de errar:
          // Ctrl+A seguido de Delete varria o mapa inteiro em silêncio, sem
          // dizer o que sumiu nem que dá para voltar (passeio cego de
          // 16/09/2026). O aviso NOMEIA o que foi apagado e mostra a saída —
          // mesma função do toast de desfazer da referência do nicho.
          case 'deleteSelected': {
            // O pino de ponto de interesse vive FORA de `selection` (estado
            // próprio, `selectedPinId`), então Delete nunca o alcançava: dava
            // para colocar e não dava para tirar sem achar "Excluir ponto de
            // interesse" no painel. Os dois estados são exclusivos — selecionar
            // um limpa o outro —, então atender o pino primeiro não esconde
            // nenhuma seleção comum.
            //
            // `selectedPinId` pode estar VELHO: `undo` não mexe em seleção, então
            // colocar um pino e desfazer deixa o id apontando para um pino que
            // não existe mais. Sem conferir o mapa, o atalho engolia o
            // `removeSelected` e ainda prometia "Ctrl+Z desfaz" para uma ação que
            // não aconteceu — e o Ctrl+Z do mestre desfaria outra coisa.
            const { map: mapaDoPino, selectedPinId: pinoSelecionado } = useMapStore.getState()
            const pinoApagado = pinoSelecionado === null ? undefined : mapaDoPino.pins.find((pino) => pino.id === pinoSelecionado)
            if (pinoApagado !== undefined) {
              // O par de um pino de viagem mora em OUTRA cena: o aviso diz o
              // que mudou lá, porque daqui não dá para ver.
              const travessia = pinoApagado.kind === 'viagem' ? pinTravelOf(useAdventureStore.getState(), mapaDoPino, pinoApagado) : null
              useMapStore.getState().removePin(pinoApagado.id)
              useToastStore
                .getState()
                .push(
                  'info',
                  travessia?.status === 'ligado'
                    ? `Pino de viagem apagado; o de ${travessia.sceneName} ficou sem destino — Ctrl+Z desfaz`
                    : pinoApagado.kind === 'viagem'
                      ? 'Pino de viagem apagado — Ctrl+Z desfaz'
                      : 'Ponto de interesse apagado — Ctrl+Z desfaz',
                )
              break
            }
            // O mapa é lido ANTES da remoção: depois dela não há como saber se
            // a região apagada era uma Sala (ver `describeDeletion`).
            const { map: mapaAntes, selection: apagados } = useMapStore.getState()
            const oQueSumiu = describeDeletion(mapaAntes, apagados)
            useMapStore.getState().removeSelected()
            if (oQueSumiu !== null) useToastStore.getState().push('info', `${oQueSumiu} — Ctrl+Z desfaz`)
            break
          }
          case 'selectTool':
            useMapStore.getState().setActiveTool(action.tool)
            break
          // `?` (achado 11 do passeio de 20/09/2026): alterna "!"/"?" do pino
          // SELECIONADO. Sem pino — ou com id velho, que o `undo` deixa para
          // trás (ver `deleteSelected` acima) — a tecla não faz nada e fica
          // livre para outro papel sem o pino. O `destino: null` é o mesmo do
          // painel (`App.tsx`, `onKindChange`): tipo que não é viagem não leva
          // destino.
          case 'togglePinType': {
            const { map: mapaAtual, selectedPinId: pinoId, updatePin } = useMapStore.getState()
            const pino = pinoId === null ? undefined : mapaAtual.pins.find((p) => p.id === pinoId)
            if (pino === undefined) break
            const proximo = pinKindAfterShortcut(pino.kind)
            if (proximo !== null) updatePin(pino.id, { kind: proximo, destino: null })
            break
          }
          case 'nudge':
            nudgeSelected(action.dx, action.dy, action.fine)
            break
          case 'fitAll':
            fitToContent('gesto')
            break
          case 'zoomReset':
            resetZoom()
            break
          // Onda 3, item 13 — Ctrl+D duplica a entidade selecionada
          // (duplicateSelected já clona+insere+seleciona a cópia, com
          // histórico — ver mapStore.ts).
          case 'duplicate':
            useMapStore.getState().duplicateSelected()
            break
          // Ctrl+A: tudo das camadas visíveis e destravadas, pelas mesmas
          // regras da seleção por área (item travado e token oculto ficam de fora).
          case 'selectAll': {
            const { map, setSelection } = useMapStore.getState()
            setSelection(selectionFromAreaSelection(selectEntitiesInArea(hitTestMap(map), SELECT_ALL_RECT)))
            break
          }
          // Agrupar objetos: o store guarda o grupo e avisa o que fez; o clique
          // que pega o grupo inteiro fica no pointerdown (`selectionOnClick`).
          case 'group':
            useMapStore.getState().groupSelected()
            break
          case 'ungroup':
            useMapStore.getState().ungroupSelected()
            break
          // save/open/undo/redo têm handler próprio em App.tsx, com o MESMO
          // mapeamento de tecla — tratar aqui de novo disparava a ação DUAS
          // vezes por tecla.
          case 'save':
          case 'open':
          case 'undo':
          case 'redo':
            break
        }
      }
      window.addEventListener('keydown', onKeyDown)

      // Fase de CAPTURA: roda antes do Ctrl+Z global de App.tsx e do
      // Backspace=apagar seleção de `onKeyDown` (os dois na bolha do window).
      // Sem isto o Ctrl+Z com rascunho aberto desfazia a última Sala e o
      // rascunho continuava na tela.
      const onDraftKeyDown = (event: KeyboardEvent) => {
        if (!hasPointDraft()) return
        const action = resolveShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          ...alvoDoAtalho(event.target),
          hasPointDraft: true,
        })
        if (action?.kind !== 'undoDraftPoint') return
        event.preventDefault()
        event.stopImmediatePropagation()
        undoDraftPoint()
      }
      window.addEventListener('keydown', onDraftKeyDown, true)

      const onKeyUp =(event: KeyboardEvent) => {
        if (event.key === 'l' || event.key === 'L') {
          releaseLaserKey(true)
          return
        }
        // Soltou o Shift no meio do giro: volta ao grau solto na hora.
        if (event.key === 'Shift' && mode === 'rotating-room') {
          const giro = roomRotateGesture.setShift(false)
          if (giro && laserPointer) dimensionLabelRenderer.show(angleIndicatorContainer, laserPointer, giro.label, computeViewport())
          return
        }
        if (event.key !== ' ') return
        spaceHeld = false
        if (mode === 'idle') updateCursor()
      }
      window.addEventListener('keyup', onKeyUp)

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        const rect = el.getBoundingClientRect()
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        const gesture = resolveMapWheel({
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
        })
        applyCamera(gesture.kind === 'zoom' ? zoomAt(camera, pointer, gesture.deltaY) : panBy(camera, -gesture.dx, -gesture.dy), 'gesto')
      }
      el.addEventListener('wheel', onWheel, { passive: false })

      return () => {
        app.ticker.remove(tickSignals)
        app.ticker.remove(tickLaser)
        unsubscribeLaserCursor()
        laserGesture.cancel()
        releaseLaserKey(false)
        el.removeEventListener('pointerleave', onCanvasPointerLeave)
        window.removeEventListener('blur', onWindowBlur)
        containerResizeObserver.disconnect()
        stopWatchingResolution()
        textResolutionTask.cancel()
        unsubscribeGrid()
        unsubscribeGridOffset()
        unsubscribeCameraScaleForWalls()
        unsubscribeShapes()
        unsubscribeTravelLinks()
        unsubscribeTokens()
        unsubscribeProps()
        unsubscribeBackground()
        unsubscribeHiddenLayersForTokensAndProps()
        unsubscribeActiveTool()
        unsubscribeFloorShape()
        // Antes do app.destroy: os gradientes de luz não são filhos da cena.
        lightsRenderer.destroy()
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('dblclick', onDblClick)
        el.removeEventListener('contextmenu', onContextMenu)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keydown', onDraftKeyDown, true)
        window.removeEventListener('keyup', onKeyUp)
        gridAlignOverlayRedrawRef.current = null
        resetZoomRequestRef.current = null
        cameraRequestRef.current = null
      }
    }

    const cleanupPromise = setup()

    return () => {
      destroyed = true
      // A limpeza (tickers, assinaturas da store, listeners) roda ANTES do
      // destroy. Na ordem inversa, `app.ticker` já era null, a limpeza quebrava
      // na 1ª linha e as assinaturas da store ficavam vivas desenhando em
      // Graphics destruídos: o próximo loadMap (Criar/Abrir depois de Início)
      // lançava dentro do setState e o editor não abria mais.
      void cleanupPromise.then((cleanup) => {
        try {
          cleanup?.()
        } finally {
          if (initialized) app.destroy({ removeView: true }, { children: true }) // `true` limparia o TexturePool GLOBAL e quebraria Text de outro app vivo
        }
      })
    }
  }, [])

  const editorPosition = nameEditor?.kind === 'token' ? nameEditor.at : editorRegion ? roomLabelPosition(editorRegion) : null

  return (
    // O canvas do Pixi é anexado por fora do React no div do ref; o campo de
    // nome fica num irmão para o React nunca reconciliar filhos do Pixi.
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {nameEditor && editorPosition && editorCamera && (
        <input
          // Trocar de alvo remonta o campo, para o autoFocus valer de novo.
          key={nameEditor.kind === 'room' ? `room-${nameEditor.regionId}` : 'token'}
          className="lb-input"
          aria-label={nameEditor.kind === 'room' ? 'Nome da sala no mapa' : 'Nome do token no mapa'}
          autoFocus
          value={nameEditor.value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setNameEditor({ ...nameEditor, value: event.target.value })}
          onKeyDown={(event) => {
            const key = event.key.toLowerCase()
            const history = event.ctrlKey || event.metaKey ? (key === 'y' || (key === 'z' && event.shiftKey) ? 'redo' : key === 'z' ? 'undo' : null) : null
            // Ctrl+Z/Ctrl+Y com o nome sugerido ainda intacto: o mestre quer
            // desfazer o desenho, não um texto que ele não digitou.
            // `stopPropagation` nos três ramos: a tecla que ESTE campo já
            // tratou não pode ser tratada DE NOVO pelos atalhos globais no
            // window. Sem isso o Esc daqui fechava o campo e seguia viagem até
            // o `case 'cancel'` do mapa, que larga a seleção — a sala recém-
            // desenhada saía do painel no mesmo Esc que só devia manter o nome
            // padrão. Mesma armadilha nos outros dois: o Ctrl+Z já desfaz aqui
            // dentro (desfaria duas vezes) e o Enter fecha traçado aberto.
            if (history && nameEditor.kind === 'room' && editorRegion?.room?.name === nameEditor.value) {
              event.preventDefault()
              event.stopPropagation()
              closeNameEditor(false)
              if (history === 'undo') useMapStore.getState().undo()
              else useMapStore.getState().redo()
            } else if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              closeNameEditor(true)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              closeNameEditor(false)
            }
          }}
          onBlur={() => closeNameEditor(true)}
          style={{
            position: 'absolute',
            left: editorPosition.x * editorCamera.scale + editorCamera.x,
            top: editorPosition.y * editorCamera.scale + editorCamera.y,
            transform: 'translate(-50%, -50%)',
            // Caixa do tamanho do texto, não os 14em x 38px do .lb-input: com
            // zoom afastado aquela caixa passava das bordas da Sala e engolia o
            // arrasto da Sala seguinte começado logo abaixo dela.
            fieldSizing: 'content',
            width: 'auto',
            minWidth: '4ch',
            minHeight: 0,
            padding: '0 0.3em',
            lineHeight: 1.3,
            textAlign: 'center',
            fontSize: Math.max(MIN_ROOM_NAME_EDITOR_FONT, roomLabelFontSize(editorGrid) * editorCamera.scale),
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}
