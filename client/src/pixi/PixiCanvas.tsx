import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { MapData } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { subscribeToBackgroundRedraw } from '../stores/backgroundSubscription'
import { panBy, zoomAt, constrainToAngleStep, angleDegrees, contentBounds, fitCamera, type Camera, type Point } from './world'
import { resolveCursor, type HoverKind, type ResizeCorner } from './cursorPolicy'
import { resolveWheel } from './wheelGesture'
import { resolveShortcut } from '../lib/keymap'
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
import { drawLights } from './drawLights'
import { createRegionsRenderer, resolveHighlightedRegionId } from './drawRegions'
import { createRoomNamesRenderer, findRoomLabelAt, roomLabelFontSize, roomLabelPosition } from './drawRoomNames'
import { createFloorRenderer, drawFloorDraft } from './drawFloor'
import { drawMapLines, drawMapMarkers } from './drawMapLines'
import { drawMapFrame } from './drawMapFrame'
import { layoutMapFrame } from '../lib/mapFrame'
import { hexToRgb, rasterizeMinimap } from '../lib/minimapRaster'
import { compileFloor } from '../lib/floorSdf'

/** Subamostras por eixo do render fiel: 4×4 é o que reproduz o antisserrilhado dos mapas de referência. */
const MINIMAP_RASTER_SAMPLES = 4
import type { FloorPiece, MapFrame } from '../types/map'
import { buildCorridorShape, buildFloorPiece, buildFloorShapeFromDrag, clampFloorPolygonSides, findFloorPieceAt } from '../lib/floorTool'

/** Referência estável: camada oculta não força recalcular o contorno a cada redraw. */
const EMPTY_FLOOR: FloorPiece[] = []
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
  drawCurveDraft,
  drawRoomDraft,
  drawRegularPolygonDraft,
  drawLightDraft,
} from './drawDraft'
import { snapPointForTarget } from './tokenInteraction'
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
  isValidCurveDraft,
  buildCurveDrawing,
  buildTextDrawing,
  isValidRoomDraft,
  buildRoomFromDraft,
  isValidRegularPolygonDraft,
  buildRegularPolygonRoomFromDraft,
} from '../lib/drawingFactory'
import { createPropsRenderer } from './drawProps'
import { createConcealZonesRenderer } from './drawConcealZones'
import { findConcealZoneAt } from '../lib/concealZones'
import { buildConcealZoneFromDraft } from '../lib/mapFactory'
import { SECRET_ITEM_ALPHA } from './constants'
import { createTextLabelsRenderer } from './drawTextLabels'
import { createAngleIndicatorRenderer } from './drawAngleIndicator'
import { subscribeToPropsRedraw } from '../stores/propsSubscription'
import { pickImageFile, importPropImage } from '../lib/imageImport'
import { mapDirFor } from '../lib/mapFileIO'
import { findSelectableAt, findCurveControlPointAt, findWallAt, findNearestExistingVertex, type SelectableHit } from '../lib/selectionHitTest'
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
import {
  visibleWalls, visibleRegions, visibleStairs, visibleLights, visibleDrawings, visibleTokens, visibleProps,
  canInteractInLayer, isLayerLocked, wallLayer, regionLayer, stairLayer, lightLayer, tokenLayer, propLayer, drawingLayer,
} from '../lib/layers'
import { isValidStairDraft, buildStairFromDraft, stairStepWidthForPreset } from '../lib/stairs'
import { eraseDecisionForWall, eraseDecisionForRegion, eraseDecisionForStair, eraseDecisionForToken, eraseDecisionForProp } from '../lib/eraseGeometry'
import { findRoomCornerAt, type RoomCorner } from '../lib/roomOps'
import { measureDistance } from '../lib/measurement'
// Integrador I8 (F4): B3 "mover e redimensionar" — geometria de bounding-box
// pra resize por canto de Drawing rect/ellipse/polygon, Token e Prop.
import { findBoxCornerAt, drawingBoundingBox, tokenBoundingBox, propBoundingBox, resizeTokenSize, type Corner } from '../lib/objectTransform'
// N3 "ferramenta de seleção de área" — geometria pura de marquee + mover grupo.
import { selectEntitiesInArea, areaSelectionBounds, isAreaSelectionEmpty, type AreaRect } from '../lib/areaSelection'
import { drawSelectionMarquee, drawAreaSelectionOutline } from './drawSelectionMarquee'
// Onda 4, item 24 — modelo canônico de seleção (lib/selectionModel.ts).
// `useMapStore.getState().selection` agora é um SelectionSet (conjunto);
// estes helpers convertem na borda pros consumidores que só entendem "um
// item" (drawEditHandles, resolveHoverHit, resolveHighlightedRegionId — os
// três fora da minha lista de arquivos) ou "grupo por campo plural"
// (areaSelectionBounds, moveAreaSelection — de lib/areaSelection.ts, também
// fora da minha lista, CONTRATO diz "nenhuma mudança de assinatura").
import {
  EMPTY_SELECTION, selectionOfItem, selectionSingle, selectionFromItems, toggleSelectionItem,
  selectionToAreaSelection, selectionFromAreaSelection, isSelectionEmpty,
} from '../lib/selectionModel'

// Fase 5, N1 "borracha: apagar parte" — raio do círculo de corte, como fração
// do grid do mapa (não px fixo: assim escala com mapas de grid diferente,
// mesma filosofia de STAIR_SIZE_PRESET_RATIO em lib/stairs.ts). Decisão de UX
// do integrador — a geometria pura (lib/eraseGeometry.ts) recebe qualquer
// raio, não tem opinião sobre o valor.
const ERASE_PART_RADIUS_RATIO = 0.25

// "Sala Circular" é o mesmo poligono regular de "Poligono Regular", só que com
// segments fixo alto o bastante pra ler como círculo suave — não configurável
// pelo usuário (ver PolygonSidesControls, que só aparece pra 'roomPolygon').
const ROOM_CIRCLE_SIDES = 24

// Largura padrão do corredor de chão, como fração do grid: meia célula lê
// como passagem sem engolir a sala ao lado, e escala com grids diferentes.
const FLOOR_CORRIDOR_WIDTH_RATIO = 0.5

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
   * A3 — chamada quando Sala, Sala Circular ou Polígono Regular termina de ser
   * desenhada (a região já está no mapa e selecionada). O App usa para trocar
   * o rail para a aba Mapa e focar o campo Nome.
   */
  onRoomCreated?: (regionId: string) => void
  /**
   * B2 — posição de mundo do ponteiro sobre o canvas, a cada movimento, só
   * enquanto o laser está ligado (L segurado ou botão Laser). O App repassa
   * ao hostBridge, que faz o throttle.
   */
  onLaserMove?: (x: number, y: number) => void
}

/** Campo de nome aberto por duplo clique sobre a Sala ou o rótulo dela. */
interface RoomNameEditorState {
  regionId: string
  value: string
}

const MIN_ROOM_NAME_EDITOR_FONT = 12

export function PixiCanvas({ gridAlignPreview = null, onBackgroundImageSizeChange, onCameraChange, resetZoomRequest, onRoomCreated, onLaserMove }: PixiCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onLaserMoveRef = useRef(onLaserMove)
  useEffect(() => {
    onLaserMoveRef.current = onLaserMove
  }, [onLaserMove])
  // Mesma ponte de ref das outras props: o setup roda uma vez só e precisa
  // enxergar sempre a callback mais recente do App.
  const onRoomCreatedRef = useRef(onRoomCreated)
  useEffect(() => {
    onRoomCreatedRef.current = onRoomCreated
  }, [onRoomCreated])

  const [roomNameEditor, setRoomNameEditor] = useState<RoomNameEditorState | null>(null)
  // Enter e Esc desmontam o campo, e o navegador pode disparar blur depois;
  // sem esta trava o blur gravaria o nome que o Esc acabou de cancelar.
  const roomNameEditorOpenRef = useRef(false)
  const editorCamera = useMapStore((state) => (roomNameEditor ? state.camera : null))
  const editorRegion = useMapStore((state) =>
    roomNameEditor ? state.map.regions.find((r) => r.id === roomNameEditor.regionId) ?? null : null,
  )
  const editorGrid = useMapStore((state) => state.map.grid)

  const closeRoomNameEditor = (commit: boolean) => {
    if (!roomNameEditorOpenRef.current || !roomNameEditor) return
    roomNameEditorOpenRef.current = false
    if (commit && editorRegion?.room && editorRegion.room.name !== roomNameEditor.value) {
      useMapStore.getState().setRoomName(roomNameEditor.regionId, roomNameEditor.value)
    }
    setRoomNameEditor(null)
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
      const gridGraphics = new Graphics()
      const gridAlignOverlayGraphics = new Graphics()
      const floorGraphics = new Graphics()
      // Traços e portas de minimapa (MapData.lines/markers) por cima do chão; moldura atrás de tudo do mapa.
      const mapLinesGraphics = new Graphics()
      const mapFrameContainer = new Container()
      // Render fiel (FloorStyle.renderMode === 'raster'): conteúdo do mapa rasterizado por software.
      const mapRasterSprite = new Sprite(Texture.EMPTY)
      const regionsContainer = new Container()
      // Nomes das salas logo acima do preenchimento: abaixo das paredes para
      // não cobrir porta/escada, mas nunca escondidos pela cor da própria sala.
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
      const lightsGraphics = new Graphics()
      const tokensContainer = new Container()
      // A5 — zonas ocultas por cima do conteúdo: o mestre precisa ver o que cobre.
      const concealZonesContainer = new Container()
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
        gridGraphics,
        gridAlignOverlayGraphics,
        mapFrameContainer,
        mapRasterSprite,
        floorGraphics,
        mapLinesGraphics,
        regionsContainer,
        roomNamesContainer,
        wallsGraphics,
        doorsGraphics,
        stairsGraphics,
        secretStairsGraphics,
        drawingsGraphics,
        secretDrawingsGraphics,
        textLabelsContainer,
        propsContainer,
        lightsGraphics,
        tokensContainer,
        concealZonesContainer,
        floorSelectionGraphics,
        handlesGraphics,
        hoverGraphics,
        areaSelectionOutlineGraphics,
        draftGraphics,
        areaMarqueeGraphics,
        angleIndicatorContainer,
        guidesGraphics,
      )

      let camera: Camera = useMapStore.getState().camera
      world.position.set(camera.x, camera.y)
      world.scale.set(camera.scale)
      onCameraChange?.(camera)

      // Onda 1 — todo ponto do arquivo que muda `camera` passa por aqui (pan,
      // roda, atalho de enquadrar/resetar): aplica no Pixi, grava na store E
      // notifica App.tsx (ZoomHud). Antes desta fase cada call site repetia
      // as 3 linhas (`world.position.set` / `world.scale.set` /
      // `setCamera`) — reunidas aqui pra `onCameraChange` não ficar esquecido
      // em algum dos pontos novos.
      const applyCamera = (next: Camera) => {
        camera = next
        world.position.set(camera.x, camera.y)
        world.scale.set(camera.scale)
        useMapStore.getState().setCamera(camera)
        onCameraChange?.(camera)
      }

      // Item #9 do plano — reset explícito (Ctrl+0 / clique no ZoomHud):
      // volta ao estado literal de câmera nova, não um "fit" — é o que o
      // usuário lê como "100%" de verdade (fitCamera para o mapa inteiro
      // quase nunca fica em scale=1).
      const resetZoom = () => applyCamera({ x: 0, y: 0, scale: 1 })
      resetZoomRequestRef.current = resetZoom

      // Item #9 — margem de respiro (px de tela) ao redor do conteúdo tanto
      // no fit automático de abertura quanto na tecla F.
      const FIT_MARGIN = 40
      const fitToContent = () => {
        const bounds = contentBounds(useMapStore.getState().map)
        // Mapa vazio (bounds nulo): não mexe na câmera — fitCamera não tem
        // "sem conteúdo" pra enquadrar, e forçar um valor arbitrário seria
        // pior que deixar a câmera onde já estava.
        if (!bounds) return
        applyCamera(fitCamera(bounds, { width: app.screen.width, height: app.screen.height }, FIT_MARGIN))
      }
      // Fit automático ao ABRIR o mapa (item #9): PixiCanvas monta de novo
      // toda vez que `App.tsx` troca de tela pra 'editor' (Carregar Mapa,
      // Criar, Voltar por portal) — então "no mount" já É "ao abrir o mapa"
      // pra este componente, sem precisar de uma segunda assinatura de
      // `map.id`.
      fitToContent()

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
          drawHexGrid(gridGraphics, computeVisibleHexCenters(map.grid, viewport), map.grid, map.gridSettings)
        } else if (map.gridShape === 'triangle') {
          // F3, dívida "grid-triangular" (agente C6): matemática pronta em
          // triGrid.ts, só faltava este call site — snap (tokenInteraction.ts,
          // fora da minha lista de escrita) ainda cai no snap quadrado padrão
          // para esta forma; ver relatório.
          drawTriGrid(gridGraphics, computeVisibleTriEdges(map.grid, viewport), map.gridSettings)
        } else {
          // computeAlignedGridLines (lib/gridAlign.ts, agente C5) no lugar de
          // computeVisibleGridLines (pixi/grid.ts): a única diferença é somar
          // gridOffset — com offset ausente (undefined -> {0,0}) as duas
          // produzem exatamente as mesmas linhas (comentário no topo da
          // função), então nenhum mapa que nunca usou "Alinhar grade à
          // imagem" muda de aparência.
          drawGrid(gridGraphics, computeAlignedGridLines(map.grid, map.gridOffset ?? { x: 0, y: 0 }, viewport), viewport, map.gridSettings)
        }
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
        drawMapBounds(mapBoundsGraphics, map, computeViewport())
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
       * Paredes e portas recebem a escala da câmera para manter o traço com
       * pelo menos 1 px de tela (`screenSafeWidth`, drawWalls.ts). Função
       * própria porque também roda sozinha quando só o zoom muda, sem pagar o
       * redesenho do chão/regiões de `redrawShapes`.
       */
      const redrawWallsAndDoors = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        const walls = visibleWalls(map.walls, map.hiddenLayers)
        const selectedWallId = single?.kind === 'wall' ? single.id : null
        drawWalls(wallsGraphics, walls, selectedWallId, camera.scale)
        drawDoors(doorsGraphics, walls, selectedWallId, camera.scale)
      }

      const redrawShapes = () => {
        const { map, selection, activeTool } = useMapStore.getState()
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
        floorRenderer.drawSelection(
          floorSelectionGraphics,
          single?.kind === 'floor' && !map.hiddenLayers.includes('salas') ? map.floor.find((p) => p.id === single.id) ?? null : null,
          map.floorStyle.sampleStep,
        )
        mapLinesGraphics.clear()
        if (!rasterMode && !map.hiddenLayers.includes('paredes')) drawMapLines(mapLinesGraphics, map.lines)
        if (!rasterMode && !map.hiddenLayers.includes('portas')) drawMapMarkers(mapLinesGraphics, map.markers)
        redrawMapFrame(map.frame)
        regionsRenderer.draw(regionsContainer, visibleRegions(map.regions, map.hiddenLayers), resolveHighlightedRegionId(map.walls, single))
        roomNamesRenderer.draw(roomNamesContainer, visibleRegions(map.regions, map.hiddenLayers), map.grid)
        redrawWallsAndDoors()
        const stairs = visibleStairs(map.stairs, map.hiddenLayers)
        const selectedStairId = single?.kind === 'stair' ? single.id : null
        drawStairs(stairsGraphics, stairs.filter((s) => !s.secret), selectedStairId)
        drawStairs(secretStairsGraphics, stairs.filter((s) => s.secret), selectedStairId)
        drawLights(lightsGraphics, visibleLights(map.lights, map.hiddenLayers), single?.kind === 'light' ? single.id : null)
        const drawings = visibleDrawings(map.drawings, map.hiddenLayers)
        const selectedDrawingId = single?.kind === 'drawing' ? single.id : null
        drawDrawings(drawingsGraphics, drawings.filter((d) => !d.secret), selectedDrawingId)
        drawDrawings(secretDrawingsGraphics, drawings.filter((d) => d.secret), selectedDrawingId)
        concealZonesRenderer.draw(concealZonesContainer, map.concealZones, map.grid, useMapStore.getState().selectedConcealZoneId)
        textLabelsRenderer.draw(textLabelsContainer, visibleDrawings(map.drawings, map.hiddenLayers), single?.kind === 'drawing' ? single.id : null)
        drawEditHandles(handlesGraphics, map, single, activeTool)
        // N3 (agora genérico, não só marquee): contorno do GRUPO — só com 2+
        // itens (1 item já tem o próprio destaque acima; 0 não desenha nada).
        drawAreaSelectionOutline(
          areaSelectionOutlineGraphics,
          selection.length > 1 ? areaSelectionBounds(map, selectionToAreaSelection(selection)) : null,
        )
      }

      const redrawTokens = () => {
        const { map, selection } = useMapStore.getState()
        const single = selectionSingle(selection)
        tokensRenderer.draw(tokensContainer, visibleTokens(map.tokens, map.hiddenLayers), map.grid, single?.kind === 'token' ? single.id : null)
      }

      const propsRenderer = createPropsRenderer()
      const textLabelsRenderer = createTextLabelsRenderer()
      const angleIndicatorRenderer = createAngleIndicatorRenderer()
      const measurementIndicatorRenderer = createMeasurementIndicatorRenderer()
      const regionsRenderer = createRegionsRenderer()
      const roomNamesRenderer = createRoomNamesRenderer()
      const concealZonesRenderer = createConcealZonesRenderer()
      const floorRenderer = createFloorRenderer()
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
          const texture = await Assets.load(url)
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
      const unsubscribeGrid = subscribeToGridRedraw(() => {
        redrawGrid()
        redrawMapBounds()
      })
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
      const unsubscribeShapes = subscribeToShapesRedraw(redrawShapes)
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
      // Só a escala importa para o piso de 1 px das paredes: pan não muda a
      // largura na tela, então não redesenha a cada movimento de arrasto.
      const unsubscribeCameraScaleForWalls = useMapStore.subscribe(
        (state) => state.camera.scale,
        () => redrawWallsAndDoors(),
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
        // A4 — arrastar só o nome da Sala.
        | 'dragging-room-label'
        // A5 — arrasto de criação da Zona oculta.
        | 'drawing-conceal-zone' = 'idle'
      let lastPoint = { x: 0, y: 0 }
      let draggingTokenId: string | null = null
      let draggingPropId: string | null = null
      let wallDraftStart: Point | null = null
      let regionDraftPoints: Point[] = []
      let freehandDraftPoints: Point[] = []
      let lineDraftStart: Point | null = null
      let circleDraftCenter: Point | null = null
      let rectDraftStart: Point | null = null
      let ellipseDraftCenter: Point | null = null
      let polygonDraftPoints: Point[] = []
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
      let draggingWallPointId: string | null = null
      let draggingWallPointIndex: 0 | 1 = 0
      let draggingRegionId: string | null = null
      let draggingRegionPointIndex = 0
      let draggingWallBodyId: string | null = null
      let draggingRegionBodyId: string | null = null
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

      // Onda 1, item 3 (Frente F, "rede de segurança do undo") — snapshot de
      // ANTES do gesto pra fechar mover-corpo de Token/Prop/Wall/Region/
      // Stair/Drawing num Ctrl+Z só, mesmo padrão de curveDragSnapshot/
      // roomCornerDragSnapshot acima. `bodyDragSnapshot` é COMPARTILHADO
      // pelos 4 modos `dragging-{wall,region,stair,line}-body` — espelha
      // `bodyDragLastPoint`, que o arquivo já compartilha entre eles.
      let tokenDragSnapshot: MapData | null = null
      let propDragSnapshot: MapData | null = null
      let bodyDragSnapshot: MapData | null = null

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
       */
      const applySnap = (point: Point, gridSize: number, target: SnapTargetKind, altKey: boolean): Point => {
        const { map, snapTargets } = useMapStore.getState()
        const enabled = altKey ? !snapTargets[target] : snapTargets[target]
        if (!enabled) return point
        return snapPointForTarget(target, map.gridShape, point.x, point.y, gridSize)
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
        useMapStore.getState().insertClonedEntityLive(cloned)
        return cloned.entity.id
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
       */
      const eraseAt = (point: Point) => {
        const { map, eraseMode } = useMapStore.getState()
        const hit = findSelectableAt(hitTestMap(map), point)
        if (!hit) return

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
            if (region && eraseDecisionForRegion(region, point, radius) === 'remove') useMapStore.getState().removeRegion(hit.id)
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
          // hit.kind === 'light' — sem função de decisão dedicada, ver docstring acima.
          useMapStore.getState().removeLight(hit.id)
          return
        }

        const removers: Record<SelectionKind, (id: string) => void> = {
          token: useMapStore.getState().removeToken,
          wall: useMapStore.getState().removeWall,
          light: useMapStore.getState().removeLight,
          region: useMapStore.getState().removeRegion,
          stair: useMapStore.getState().removeStair,
          prop: useMapStore.getState().removeProp,
          drawing: useMapStore.getState().removeDrawing,
          floor: useMapStore.getState().removeFloorPiece,
        }
        removers[hit.kind](hit.id)
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
        freehandDraftPoints = []
        lineDraftStart = null
        circleDraftCenter = null
        rectDraftStart = null
        ellipseDraftCenter = null
        polygonDraftPoints = []
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
        draftGraphics.clear()
        angleIndicatorRenderer.hide()
        measurementIndicatorRenderer.hide()
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
        if (floorShapeKind === 'corridor') return null
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

      /** Duplo clique ou Enter: vira peça se houver 2+ pontos distintos; sempre limpa o rascunho. */
      const finishCorridor = () => {
        const { map, floorOp, addFloorPiece } = useMapStore.getState()
        const shape = buildCorridorShape(corridorDraftPoints, map.grid * FLOOR_CORRIDOR_WIDTH_RATIO)
        if (shape) addFloorPiece(buildFloorPiece(crypto.randomUUID(), shape, floorOp))
        corridorDraftPoints = []
        draftGraphics.clear()
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
        })
      }

      const unsubscribeActiveTool = useMapStore.subscribe((state) => state.activeTool, () => {
        clearDrafts()
        updateCursor()
        redrawShapes()
      })

      app.stage.on('pointerdown', (event) => {
        // Onda 2, item 15 (Frente B) — o anel de hover só existe em
        // `mode === 'idle'`; qualquer gesto que comece agora entra num modo
        // que não roda mais `resolveHoverAtIdle`, então sem isto o anel
        // ficaria "grudado" na tela até o próximo pointermove ocioso.
        hoverGraphics.clear()
        hoverTarget = null

        // B2 — laser armado + botão esquerdo: o traço é do laser e a ferramenta ativa não roda.
        if (!spaceHeld && laserGesture.pointerDown(event.button, toWorldPoint(event.global.x, event.global.y))) return

        // Botao do meio (scroll wheel) sempre faz pan, independente da ferramenta
        // ativa ou do que estiver sob o cursor. Precisa vir antes de qualquer
        // outro if de ferramenta e sair com "return" pra nao rodar selecao/desenho.
        if (event.button === 1) {
          mode = 'panning'
          lastPoint = { x: event.global.x, y: event.global.y }
          return
        }

        // Item #8 do plano — Espaço+arrastar pana em QUALQUER ferramenta.
        // Segunda maior prioridade, logo depois do botão do meio: mesma
        // regra ("vem antes de qualquer if de ferramenta, sai com return")
        // pra não disparar desenho/seleção por baixo do gesto de pan.
        if (spaceHeld) {
          mode = 'panning'
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
          if (wall) useMapStore.getState().addDoorOnWall(wall.id, worldPoint, useMapStore.getState().doorKind)
          return
        }

        if (activeTool === 'room') {
          mode = 'drawing-room'
          roomDraftStart = applySnap(worldPoint, map.grid, 'wall', event.altKey)
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

        if (activeTool === 'prop') {
          const point = applySnap(worldPoint, map.grid, 'prop', event.altKey)
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

        if (activeTool === 'curve') {
          mode = 'drawing-curve'
          curveDraftPoints = [worldPoint]
          return
        }

        if (activeTool === 'region') {
          const point = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          regionDraftPoints = [...regionDraftPoints, point]
          drawRegionDraft(draftGraphics, regionDraftPoints, null)
          return
        }

        if (activeTool === 'floor') {
          const point = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          if (useMapStore.getState().floorShapeKind === 'corridor') {
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
          return
        }

        if (activeTool === 'eraser') {
          mode = 'erasing'
          eraseAt(worldPoint)
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
            if (region) {
              // Sala retangular (Region.room?.shape === 'rect'): resize SÓ
              // pelos 4 cantos (findRoomCornerAt, lib/roomOps.ts) — nunca cai
              // no arrasto de vértice/midpoint genérico abaixo, que deixaria a
              // sala virar um quadrilátero torto e dessincronizaria as 4
              // paredes vinculadas (resizeRoomCornerLive já cuida da sync,
              // ver mapFactory.ts).
              if (region.room?.shape === 'rect') {
                const corner = findRoomCornerAt(region.points, worldPoint)
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

        // A4 — clicar no nome da Sala arrasta só o rótulo. Vem antes do
        // hit-test de corpo: o nome fica dentro da sala, e sem isto o clique
        // nele arrastaria a sala inteira. Com grupo (2+) o arrasto do grupo
        // continua valendo, e Shift continua sendo "somar à seleção".
        if (activeTool === 'select' && !event.shiftKey && selection.length <= 1) {
          const labelRegion = findRoomLabelAt(visibleRegions(map.regions, map.hiddenLayers), worldPoint, map.grid)
          if (labelRegion?.room) {
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

        const hit = findSelectableAt(hitTestMap(map), worldPoint) ?? floorHitAt(map, worldPoint)
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
            mode = 'dragging-region-body'
            bodyDragSnapshot = map
            const region = map.regions.find((r) => r.id === hit.id)
            draggingRegionBodyId = event.altKey && region ? cloneForAltDrag({ kind: 'region', entity: region }) : hit.id
            bodyDragLastPoint = applySnap(worldPoint, map.grid, 'wall', event.altKey)
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
          // Onda 4, item 24 — clique em espaço vazio (o caso "dentro do
          // grupo já fechado" já foi resolvido ANTES do hit-test, acima).
          // Dois casos, nesta ordem:
          //  1. Shift segurado, com Selecionar ativa → começa um novo
          //     marquee, que ao fechar SOMA à seleção já existente (não
          //     substitui — ver pointerup, 'area-marquee-drag');
          //  2. nenhum dos dois → comportamento de sempre, pan da câmera E
          //     limpa a seleção (preserva o spec e2e "pan de área vazia move
          //     a câmera", que nunca segura Shift).
          if (activeTool === 'select' && event.shiftKey) {
            mode = 'area-marquee-drag'
            areaMarqueeStart = worldPoint
          } else {
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
          const { map, addDrawing, drawColor, drawWidth, drawCap } = useMapStore.getState()
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
            addDrawing(buildLineDrawing(crypto.randomUUID(), lineDraftStart, end, drawColor, drawWidth, drawCap))
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
          const { addDrawing, drawColor, drawWidth, drawCap } = useMapStore.getState()
          if (isValidCurveDraft(curveDraftPoints)) {
            addDrawing(buildCurveDrawing(crypto.randomUUID(), curveDraftPoints, drawColor, drawWidth, drawCap))
          }
          curveDraftPoints = []
          draftGraphics.clear()
        }

        if (mode === 'drawing-room' && roomDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, addRoom, regionFillColor, regionFillPattern } = useMapStore.getState()
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
            const result = buildRoomFromDraft(crypto.randomUUID(), wallIds, roomDraftStart, end, regionFillColor, regionFillPattern)
            addRoom(result.region, result.walls)
            // A3 — a Sala nova já nasce selecionada para o Nome aparecer.
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: result.region.id }))
            onRoomCreatedRef.current?.(result.region.id)
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
          const { map, addRoom, regionFillColor, regionFillPattern } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
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
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: result.region.id }))
            onRoomCreatedRef.current?.(result.region.id)
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
            addStair(buildStairFromDraft(crypto.randomUUID(), stairDraftStart, end, stairStepWidthForPreset(stairSizePreset, map.grid)))
          }
          stairDraftStart = null
          draftGraphics.clear()
        }

        if (mode === 'drawing-floor' && floorDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const draft = floorDraftFromDrag(floorDraftStart, worldPoint, event.shiftKey, event.altKey)
          // Clique sem arrasto dá `piece: null` — nada nasce.
          if (draft?.piece) useMapStore.getState().addFloorPiece({ ...draft.piece, id: crypto.randomUUID() })
          floorDraftStart = null
          draftGraphics.clear()
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
          useMapStore.getState().commitDragHistory(roomCornerDragSnapshot)
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
        // Onda 4, item 24 — fecha o marquee: calcula a área e SOMA ao
        // conjunto já selecionado (Shift+arrastar acumula sobre Shift+clique
        // anterior, ou sobre outro marquee anterior — `selectionFromItems`
        // dedupica quem já estava nos dois). Área vazia (nada dentro do
        // retângulo) não muda nada.
        if (mode === 'area-marquee-drag' && areaMarqueeStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const rect: AreaRect = { x1: areaMarqueeStart.x, y1: areaMarqueeStart.y, x2: worldPoint.x, y2: worldPoint.y }
          const result = selectEntitiesInArea(useMapStore.getState().map, rect)
          if (!isAreaSelectionEmpty(result)) {
            const store = useMapStore.getState()
            store.setSelection(selectionFromItems([...store.selection, ...selectionFromAreaSelection(result)]))
          }
          areaMarqueeGraphics.clear()
        }
        if (mode === 'dragging-area-selection' && areaSelectionDragBefore) {
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
        if (
          (mode === 'dragging-wall-body' || mode === 'dragging-region-body' ||
            mode === 'dragging-stair-body' || mode === 'dragging-line-body' || mode === 'dragging-floor-body') &&
          bodyDragSnapshot
        ) {
          useMapStore.getState().commitDragHistory(bodyDragSnapshot)
        }
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
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
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
        // Onda 2, item 16 (Frente C) — mesmo choke point de
        // angleIndicatorRenderer: cobre TODOS os pointerup de forma
        // (room/stair/polygon-room/rect/ellipse/circle) sem precisar de um
        // hide() por bloco.
        dimensionLabelRenderer.hide()
        updateCursor()
      })

      app.stage.on('pointerupoutside', () => {
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
          useMapStore.getState().commitDragHistory(roomCornerDragSnapshot)
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
          useMapStore.getState().commitDragHistory(areaSelectionDragBefore)
        }
        // Onda 1, item 3 (Frente F) — mesmo padrão de commit acima, ver
        // comentário completo no pointerup.
        if (mode === 'dragging-token' && tokenDragSnapshot) {
          useMapStore.getState().commitDragHistory(tokenDragSnapshot)
        }
        if (mode === 'dragging-prop' && propDragSnapshot) {
          useMapStore.getState().commitDragHistory(propDragSnapshot)
        }
        if (
          (mode === 'dragging-wall-body' || mode === 'dragging-region-body' ||
            mode === 'dragging-stair-body' || mode === 'dragging-line-body' || mode === 'dragging-floor-body') &&
          bodyDragSnapshot
        ) {
          useMapStore.getState().commitDragHistory(bodyDragSnapshot)
        }
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
        mode = 'idle'
        draggingTokenId = null
        draggingPropId = null
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
        }
        if (wallDraftStart) {
          wallDraftStart = null
          draftGraphics.clear()
        }
        if (stairDraftStart) {
          stairDraftStart = null
          draftGraphics.clear()
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
          applyCamera(panBy(camera, dx, dy))
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
          return
        }

        if (mode === 'dragging-token' && draggingTokenId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'token', event.altKey)
          const candidates = map.tokens
            .filter((token) => token.id !== draggingTokenId)
            .map((token) => ({ x: token.x, y: token.y }))
          const result = computeAlignment(snapped, candidates)
          drawGuides(guidesGraphics, result.guides, computeViewport())
          useMapStore.getState().moveTokenLive(draggingTokenId, result.point.x, result.point.y)
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
          eraseAt(worldPoint)
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
          useMapStore.getState().setRoomLabelOffsetLive(roomLabelDragId, {
            x: Math.round(roomLabelDragStartOffset.x + worldPoint.x - roomLabelDragStartPoint.x),
            y: Math.round(roomLabelDragStartOffset.y + worldPoint.y - roomLabelDragStartPoint.y),
          })
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
              const candidates = map.regions
                .filter((r) => r.id !== draggingRegionBodyId)
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

        // N3 "ferramenta de seleção de área".
        if (mode === 'area-marquee-drag' && areaMarqueeStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const rect: AreaRect = { x1: areaMarqueeStart.x, y1: areaMarqueeStart.y, x2: worldPoint.x, y2: worldPoint.y }
          drawSelectionMarquee(areaMarqueeGraphics, rect)
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
          const { map, regionFillColor } = useMapStore.getState()
          const snapped = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          // Onda 2, item 14 (Frente E) — Shift trava em quadrado.
          const end = constrainDraft(roomDraftStart, snapped, 'room', { shift: event.shiftKey, alt: event.altKey })
          drawRoomDraft(draftGraphics, roomDraftStart, end, regionFillColor)
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
          const { map, regionFillColor } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawRegularPolygonDraft(draftGraphics, polygonDraftCenter, end, polygonDraftSides, regionFillColor)
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
            end = event.ctrlKey && map.gridShape === 'hex' ? constrained : applySnap(constrained, map.grid, 'wall', event.altKey)
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
          const { drawColor, drawWidth } = useMapStore.getState()
          drawCurveDraft(draftGraphics, curveDraftPoints, drawColor, drawWidth)
          return
        }

        if (useMapStore.getState().activeTool === 'region' && regionDraftPoints.length > 0) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const cursor = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawRegionDraft(draftGraphics, regionDraftPoints, cursor)
        }

        if (useMapStore.getState().activeTool === 'polygon' && polygonDraftPoints.length > 0) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          const cursor = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          drawPolygonDraft(draftGraphics, polygonDraftPoints, cursor, drawColor, drawWidth, drawFilled, drawFillAlpha)
        }

        if (useMapStore.getState().activeTool === 'measure' && measureDraftStart) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map } = useMapStore.getState()
          const end = applySnap(worldPoint, map.grid, 'wall', event.altKey)
          const result = measureDistance(measureDraftStart, end, map.grid, map.gridShape, map.measurementMode, map.scale)
          measurementIndicatorRenderer.show(angleIndicatorContainer, measureDraftStart, end, result.label)
        }
      })

      const onDblClick = (event: MouseEvent) => {
        const { activeTool, addRegion, selection, map } = useMapStore.getState()
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
            if (region) {
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
          let roomRegion = findRoomLabelAt(visibleRegions(map.regions, map.hiddenLayers), worldPoint, map.grid)
          if (!roomRegion) {
            const hit = findSelectableAt(hitTestMap(map), worldPoint)
            const regionId =
              hit?.kind === 'region' ? hit.id : hit?.kind === 'wall' ? map.walls.find((w) => w.id === hit.id)?.regionId : undefined
            roomRegion = map.regions.find((r) => r.id === regionId && r.room !== undefined) ?? null
          }
          if (roomRegion?.room) {
            useMapStore.getState().setSelection(selectionOfItem({ kind: 'region', id: roomRegion.id }))
            roomNameEditorOpenRef.current = true
            setRoomNameEditor({ regionId: roomRegion.id, value: roomRegion.room.name })
          }
          return
        }

        if (activeTool === 'polygon') {
          const last = polygonDraftPoints[polygonDraftPoints.length - 1]
          const secondToLast = polygonDraftPoints[polygonDraftPoints.length - 2]
          if (last && secondToLast && last.x === secondToLast.x && last.y === secondToLast.y) {
            polygonDraftPoints = polygonDraftPoints.slice(0, -1)
          }

          if (!isValidPolygonDraft(polygonDraftPoints)) {
            clearDrafts()
            return
          }

          const { addDrawing, drawColor, drawWidth, drawFilled, drawFillAlpha } = useMapStore.getState()
          addDrawing(buildPolygonDrawing(crypto.randomUUID(), polygonDraftPoints, drawColor, drawWidth, drawFilled, drawFillAlpha))
          polygonDraftPoints = []
          draftGraphics.clear()
          return
        }

        if (activeTool === 'floor') {
          if (corridorDraftPoints.length > 0) finishCorridor()
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

        // Enter fecha o corredor de chão em construção (mesma saída do duplo
        // clique). preventDefault: o foco pode estar no botão da barra, e o
        // Enter "clicaria" nele de novo.
        if (event.key === 'Enter' && corridorDraftPoints.length > 0) {
          const target = event.target as HTMLElement | null
          const editable = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
          if (!editable) {
            event.preventDefault()
            finishCorridor()
            return
          }
        }

        const action = resolveShortcut({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          targetTagName: (event.target as HTMLElement | null)?.tagName ?? '',
        })
        if (action === null) return
        runShortcut(action)
      }

      const runShortcut = (action: NonNullable<ReturnType<typeof resolveShortcut>>) => {
        switch (action.kind) {
          case 'cancel':
            clearDrafts()
            // Onda 4, item 24 — Esc cancela um marquee aberto (sem fechar
            // seleção) e também limpa um GRUPO já fechado (2+ itens) —
            // mesma convenção de Esc "desfazer o que está em progresso" já
            // usada pelos outros drafts deste handler. Seleção de 1 item só
            // (clique simples) não é tocada aqui, mesmo comportamento de
            // antes da migração (Esc nunca desfazia um clique simples).
            if (mode === 'area-marquee-drag') {
              areaMarqueeStart = null
              areaMarqueeGraphics.clear()
              mode = 'idle'
            }
            if (useMapStore.getState().selection.length > 1) {
              useMapStore.getState().setSelection(EMPTY_SELECTION)
            }
            break
          case 'deleteSelected':
            useMapStore.getState().removeSelected()
            break
          case 'selectTool':
            useMapStore.getState().setActiveTool(action.tool)
            break
          case 'nudge':
            nudgeSelected(action.dx, action.dy, action.fine)
            break
          case 'fitAll':
            fitToContent()
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
          // save/open/selectAll/undo/redo: fora do escopo da Onda 1 (undo/
          // redo já têm handler próprio em App.tsx:161-178, com o MESMO
          // mapeamento de tecla — tratar aqui de novo disparava undo/redo
          // DUAS vezes por tecla).
          case 'save':
          case 'open':
          case 'selectAll':
          case 'undo':
          case 'redo':
            break
        }
      }
      window.addEventListener('keydown', onKeyDown)

      const onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'l' || event.key === 'L') {
          releaseLaserKey(true)
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
        const gesture = resolveWheel({
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
        })
        applyCamera(gesture.kind === 'zoom' ? zoomAt(camera, pointer, gesture.deltaY) : panBy(camera, -gesture.dx, -gesture.dy))
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
        unsubscribeGrid()
        unsubscribeGridOffset()
        unsubscribeCameraScaleForWalls()
        unsubscribeShapes()
        unsubscribeTokens()
        unsubscribeProps()
        unsubscribeBackground()
        unsubscribeHiddenLayersForTokensAndProps()
        unsubscribeActiveTool()
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('dblclick', onDblClick)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        gridAlignOverlayRedrawRef.current = null
        resetZoomRequestRef.current = null
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

  const editorPosition = editorRegion && editorCamera ? roomLabelPosition(editorRegion) : null

  return (
    // O canvas do Pixi é anexado por fora do React no div do ref; o campo de
    // nome fica num irmão para o React nunca reconciliar filhos do Pixi.
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {roomNameEditor && editorPosition && editorCamera && (
        <input
          className="lb-input"
          aria-label="Nome da sala no mapa"
          autoFocus
          value={roomNameEditor.value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setRoomNameEditor({ ...roomNameEditor, value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              closeRoomNameEditor(true)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              closeRoomNameEditor(false)
            }
          }}
          onBlur={() => closeRoomNameEditor(true)}
          style={{
            position: 'absolute',
            left: editorPosition.x * editorCamera.scale + editorCamera.x,
            top: editorPosition.y * editorCamera.scale + editorCamera.y,
            transform: 'translate(-50%, -50%)',
            width: '14em',
            textAlign: 'center',
            fontSize: Math.max(MIN_ROOM_NAME_EDITOR_FONT, roomLabelFontSize(editorGrid) * editorCamera.scale),
            zIndex: 2,
          }}
        />
      )}
    </div>
  )
}
