import { Application, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js'
import { useMapStore } from '../src/stores/mapStore'
import { createFloorRenderer } from '../src/pixi/drawFloor'
import { drawMapLines, drawMapMarkers } from '../src/pixi/drawMapLines'
import { drawMapFrame } from '../src/pixi/drawMapFrame'
import { layoutMapFrame, MINIMAP_FRAME_STYLE } from '../src/lib/mapFrame'
import { fitTitleFont } from '../src/pixi/frameTitle'
import type { FloorPiece, FloorStyle, MapFrame, MapLine, MapMarker } from '../src/types/map'
import { createEmptyMap } from '../src/lib/mapFactory'
import { compileFloor } from '../src/lib/floorSdf'
import { hexToRgb, rasterizeMinimap } from '../src/lib/minimapRaster'
import type { TraceRect } from '../src/lib/traceImage'
import { traceMinimapImage } from '../src/lib/traceMinimap'
import { estimateFloorStrokeWidth, estimateLineWidth } from '../src/lib/estimateStroke'
import { calibrateLineStyle, calibrateStroke, insetPieces, isCalibratableLine, type StrokeCalibration } from '../src/lib/calibrateMinimap'
import { maskTopology, type MaskTopology } from '../src/lib/maskTopology'
import { DEFAULT_FLOOR_STYLE } from '../src/lib/mapFile'
import { loadPixels } from './compareMasks'

/**
 * Roda DENTRO do browser (importado por `page.evaluate` via Vite). Monta o
 * mapa só pelas ações da store — as mesmas que os botões do painel chamam
 * ("Chão a partir da imagem", "Linhas e portas a partir da imagem",
 * "Moldura com título") — e pinta o mapa da store com os renderers do app,
 * na mesma ordem do PixiCanvas: moldura, chão, linhas e portas.
 */

export type LineDetection = 'gray' | 'weight'

/** Variante de render medida pelo harness (ver variáveis RECREATE_* em recreate.spec.ts). */
export interface RecreateVariant {
  antialias: boolean
  /** Recuo da borda vetorizada, em px. */
  inset: number
  strokeColor: string | null
  strokeWidth: number
  details: boolean
  /** Raio de exclusão do traço colado no fundo; 0 desliga. */
  borderRadius: number
  /** Contorno subpixel pela cobertura do antisserrilhado. */
  coverage: boolean
  /** Rasterizador por software com cobertura (lib/minimapRaster.ts) no lugar dos renderers do Pixi. */
  raster: boolean
  strokeAlpha: number
  lineAlpha: number
  /** Vértices de linha e portas ajustados ao antisserrilhado (lib/refineLines.ts, lib/refineMarkers.ts). */
  subpixelLines: boolean
  lineWidth: number
  /** 'auto' (exige `calibrate`): vetoriza com as duas e fica com a de maior nota de calibração. */
  lineDetection: LineDetection | 'auto'
  /** Mede na imagem a largura do contorno e das linhas (lib/estimateStroke.ts); recuo = largura ÷ 2. */
  autoWidth: boolean
  /** Calibra largura e recuo do contorno renderizando contra a imagem (lib/calibrateMinimap.ts). */
  calibrate: boolean
  /** Traços pretos finos e manchas verde-escuras como linha/marcador (lib/traceDark.ts). */
  dark: boolean
  /** Pontilhado com período e ponto medidos (lib/traceDotted.ts). */
  dotted: boolean
  /** Padrão de subamostra do rasterizador. */
  pattern: 'grid' | 'rooks' | 'analytic'
  /** Contorno do chão no centro do traço (lib/refineFloor.ts); calibração procura recuo em torno de 0. */
  refineFloor: boolean
  /** Afina a máscara das linhas cinzas para 1 px antes de vetorizar. */
  thinLines: boolean
  /** Métrica da calibração: contagem dentro da tolerância ou erro absoluto médio. */
  calibMetric: 'match' | 'error'
  /** Calibra também a opacidade do traço do contorno. */
  calibAlpha: boolean
  /** Entre os candidatos da calibração, prefere o que mantém ilhas/buracos iguais à referência. */
  topologyGuard: boolean
  /** Com `pattern: 'analytic'`: linhas não pretas e portas também por área exata. */
  analyticShapes: boolean
  /** Calibra largura e cor das linhas cinzas contínuas por render (lib/calibrateMinimap.ts). */
  calibLines: boolean
}

export interface RecreateCounts {
  /** Fonte do título escolhida, quando há moldura. */
  titleFont: string | null
  pieces: number
  lines: number
  markers: number
  strokeWidth: number
  lineWidth: number
  inset: number
  strokeAlpha: number
  /** A proteção de topologia achou um candidato com ilhas/buracos iguais à referência. */
  topologyMatched: boolean
  /** Nota da calibração nas janelas de borda, quando calibrado. */
  calibrationScore: number | null
  lineDetection: LineDetection
}

export interface RecreateInput {
  name: string
  width: number
  height: number
  traceRect: TraceRect
  frame: MapFrame | null
  pieces: FloorPiece[]
}

const GRID = 64
const RASTER_SAMPLES = 4

function rasterStyle(variant: RecreateVariant) {
  return {
    background: [0, 0, 0] as [number, number, number],
    floor: hexToRgb(DEFAULT_FLOOR_STYLE.fillColor),
    stroke: variant.strokeColor ? hexToRgb(variant.strokeColor) : null,
    strokeAlpha: variant.strokeAlpha,
    lineAlpha: variant.lineAlpha,
    samples: RASTER_SAMPLES,
    pattern: variant.pattern,
    analyticShapes: variant.analyticShapes,
  }
}

interface Candidate {
  basePieces: FloorPiece[]
  lines: MapLine[]
  markers: MapMarker[]
  strokeWidth: number
  lineWidth: number
  inset: number
  strokeAlpha: number
  calibrationScore: number | null
  lineDetection: LineDetection
  topologyMatched: boolean
}

/** Quantos candidatos da calibração, em ordem de nota, a proteção de topologia rasteriza no máximo. */
const TOPOLOGY_CANDIDATES = 10

/** Opacidades do contorno testadas quando `calibAlpha` está ligado. */
const CALIBRATION_ALPHAS = [0.7, 0.8, 0.9, 0.955, 1]

function buildCandidate(
  input: RecreateInput,
  pixels: Uint8ClampedArray,
  variant: RecreateVariant,
  lineDetection: LineDetection,
  referenceTopology: MaskTopology | null,
): Candidate {
  const trace = traceMinimapImage(
    pixels,
    input.width,
    input.height,
    {
      rect: input.traceRect,
      coverage: variant.coverage,
      subpixel: variant.subpixelLines,
      lineDetection,
      borderRadius: variant.borderRadius,
      lineColor: lineDetection === 'weight' ? variant.strokeColor ?? undefined : undefined,
      dark: variant.dark,
      dotted: variant.dotted,
      refineFloor: variant.refineFloor,
      thinLines: variant.thinLines,
    },
    (kind, i) => `${input.name}-${kind}-${i}`,
  )
  const basePieces = input.pieces.length > 0 ? input.pieces : trace.basePieces
  // Traço escuro e pontilhado já saem com largura própria medida: não recebem a das linhas cinzas.
  const isDarkLine = (id: string) => id.startsWith(`${input.name}-dark-`) || id.startsWith(`${input.name}-dotted-`)

  let lineWidth = variant.lineWidth
  if (variant.autoWidth || variant.calibrate) {
    const measured = estimateLineWidth(pixels, input.width, input.height, trace.lines.filter((l) => !isDarkLine(l.id)))
    if (measured !== null) lineWidth = measured
  }
  let lines = variant.details ? trace.lines.map((line) => (isDarkLine(line.id) ? line : { ...line, width: lineWidth })) : []
  const markers = variant.details ? trace.markers : []

  let strokeWidth = variant.strokeWidth
  let inset = variant.inset
  let strokeAlpha = variant.strokeAlpha
  let calibrationScore: number | null = null
  let topologyMatched = false
  if (variant.calibrate) {
    const calibrated = calibrateStroke({
      reference: pixels,
      width: input.width,
      height: input.height,
      rect: input.traceRect,
      basePieces,
      lines,
      markers,
      style: rasterStyle(variant),
      insetCenter: variant.refineFloor ? () => 0 : undefined,
      metric: variant.calibMetric,
      alphas: variant.calibAlpha ? CALIBRATION_ALPHAS : undefined,
    })
    if (calibrated) {
      let chosen: StrokeCalibration['ranked'][number] = calibrated
      if (variant.topologyGuard && referenceTopology) {
        // Primeiro candidato (por nota) cujo render tem as mesmas ilhas e buracos da referência.
        const rect = input.traceRect
        const tried = new Set<string>()
        for (const candidate of calibrated.ranked.slice(0, TOPOLOGY_CANDIDATES)) {
          const key = `${candidate.strokeWidth.toFixed(3)}:${candidate.inset.toFixed(3)}:${candidate.strokeAlpha}`
          if (tried.has(key)) continue
          tried.add(key)
          const raster = rasterizeMinimap(
            { originX: rect.x, originY: rect.y, width: rect.w, height: rect.h, floor: compileFloor(insetPieces(basePieces, candidate.inset)), lines, markers },
            { ...rasterStyle(variant), strokeWidth: candidate.strokeWidth, strokeAlpha: candidate.strokeAlpha },
          )
          const topology = maskTopology(raster, rect.w, { x: 0, y: 0, w: rect.w, h: rect.h })
          if (topology.islands === referenceTopology.islands && topology.holes === referenceTopology.holes) {
            chosen = candidate
            topologyMatched = true
            break
          }
        }
      }
      strokeWidth = chosen.strokeWidth
      inset = chosen.inset
      strokeAlpha = chosen.strokeAlpha
      calibrationScore = chosen.score
    }
  } else if (variant.autoWidth) {
    const measured = estimateFloorStrokeWidth(pixels, input.width, input.height, basePieces, input.traceRect)
    if (measured !== null) {
      strokeWidth = measured
      inset = measured / 2
    }
  }
  if (variant.calibLines && lines.length > 0) {
    // Largura e cor das linhas cinzas por render contra a imagem, com chão e contorno já fixos.
    const lineStyle = calibrateLineStyle({
      reference: pixels,
      width: input.width,
      rect: input.traceRect,
      lines,
      markers,
      floorPieces: insetPieces(basePieces, inset),
      style: { ...rasterStyle(variant), strokeWidth, strokeAlpha },
      colors: [null, variant.strokeColor ?? '#858585'],
    })
    if (lineStyle) {
      lineWidth = lineStyle.lineWidth
      lines = lines.map((line) => (isCalibratableLine(line) ? { ...line, width: lineStyle.lineWidth, color: lineStyle.lineColor ?? line.color } : line))
    }
  }
  return { basePieces, lines, markers, strokeWidth, lineWidth, inset, strokeAlpha, calibrationScore, lineDetection, topologyMatched }
}

export async function recreateIntoStore(input: RecreateInput, url: string, variant: RecreateVariant): Promise<RecreateCounts> {
  const store = () => useMapStore.getState()
  store().loadMap(createEmptyMap(`recreate_${input.name}`, input.name, Math.ceil(input.width / GRID), Math.ceil(input.height / GRID), GRID))
  const pixels = await loadPixels(url, input.width, input.height)

  const detections: LineDetection[] = variant.lineDetection === 'auto' ? ['gray', 'weight'] : [variant.lineDetection]
  const referenceTopology = variant.topologyGuard ? maskTopology(pixels, input.width, input.traceRect) : null
  let best: Candidate | null = null
  for (const detection of detections) {
    const candidate = buildCandidate(input, pixels, variant, detection, referenceTopology)
    if (!best || (candidate.calibrationScore ?? -1) > (best.calibrationScore ?? -1)) best = candidate
  }
  const chosen = best as Candidate

  // Precisão de 0,5 px: linhas de 1 px do objetivo (hachura de escada) precisam sobreviver ao contorno.
  const style: Partial<FloorStyle> = {
    sampleStep: 0.5,
    strokeColor: variant.strokeColor,
    strokeWidth: chosen.strokeWidth,
    strokeAlpha: chosen.strokeAlpha,
    lineAlpha: variant.lineAlpha,
  }
  store().setFloorStyle(style)
  store().addFloorPieces(insetPieces(chosen.basePieces, chosen.inset))
  store().addMapDetails(chosen.lines, chosen.markers)
  if (input.frame) {
    // Fonte do título escolhida comparando com a imagem (pixi/frameTitle.ts).
    const layout = layoutMapFrame(input.frame.w, input.frame.h, input.frame.title)
    const titleFont = fitTitleFont(
      pixels,
      input.width,
      input.height,
      layout,
      input.frame.x - layout.content.x,
      input.frame.y - layout.content.y,
      MINIMAP_FRAME_STYLE.titleBarFill,
    )
    store().setMapFrame(titleFont ? { ...input.frame, titleFont } : input.frame)
  }

  const { map } = store()
  return {
    titleFont: map.frame?.titleFont ? `${map.frame.titleFont.weight} ${map.frame.titleFont.size}px ${map.frame.titleFont.family}` : null,
    pieces: map.floor.length,
    lines: map.lines.length,
    markers: map.markers.length,
    strokeWidth: chosen.strokeWidth,
    lineWidth: chosen.lineWidth,
    inset: chosen.inset,
    strokeAlpha: chosen.strokeAlpha,
    topologyMatched: chosen.topologyMatched,
    calibrationScore: chosen.calibrationScore,
    lineDetection: chosen.lineDetection,
  }
}

/** Rasteriza o conteúdo do mapa da store por software e devolve como sprite na posição de mundo. */
function rasterSprite(rect: TraceRect, variant: RecreateVariant): Sprite {
  const { map } = useMapStore.getState()
  const rgba = rasterizeMinimap(
    {
      originX: rect.x,
      originY: rect.y,
      width: rect.w,
      height: rect.h,
      floor: map.floor.length > 0 ? compileFloor(map.floor) : null,
      lines: map.lines,
      markers: map.markers,
    },
    {
      ...rasterStyle(variant),
      floor: hexToRgb(map.floorStyle.fillColor),
      strokeWidth: map.floorStyle.strokeWidth,
      strokeAlpha: map.floorStyle.strokeAlpha ?? variant.strokeAlpha,
    },
  )
  const canvas = document.createElement('canvas')
  canvas.width = rect.w
  canvas.height = rect.h
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.putImageData(new ImageData(rgba, rect.w, rect.h), 0, 0)
  const sprite = new Sprite(Texture.from(canvas))
  sprite.position.set(rect.x, rect.y)
  return sprite
}

export async function renderStoreMapPng(width: number, height: number, variant: RecreateVariant, contentRect: TraceRect, background = '#000000'): Promise<string> {
  const app = new Application()
  await app.init({ width, height, background, antialias: variant.antialias, preference: 'webgl' })
  try {
    const { map } = useMapStore.getState()
    const stage = new Container()
    stage.addChild(new Graphics().rect(0, 0, width, height).fill({ color: background }))
    if (map.frame) {
      const layout = layoutMapFrame(map.frame.w, map.frame.h, map.frame.title)
      const frame = drawMapFrame(layout, map.frame.titleFont)
      frame.position.set(map.frame.x - layout.content.x, map.frame.y - layout.content.y)
      stage.addChild(frame)
    }
    if (variant.raster) {
      stage.addChild(rasterSprite(contentRect, variant))
    } else {
      const floor = new Graphics()
      createFloorRenderer().draw(floor, map.floor, map.floorStyle)
      const details = new Graphics()
      drawMapLines(details, map.lines)
      drawMapMarkers(details, map.markers)
      stage.addChild(floor, details)
    }
    return await app.renderer.extract.base64({ target: stage, frame: new Rectangle(0, 0, width, height) })
  } finally {
    app.destroy(true)
  }
}
