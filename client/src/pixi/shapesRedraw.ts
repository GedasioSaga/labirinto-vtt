import type { Container, Graphics } from 'pixi.js'
import type { FloorPiece, MapData, MapFrame } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { selectionSingle, selectionToAreaSelection, type SelectionSet } from '../lib/selectionModel'
import { visibleWalls, visibleRegions, visibleStairs, visibleLights, visibleDrawings } from '../lib/layers'
import { areaSelectionBounds } from '../lib/areaSelection'
import type { FloorRenderer } from './drawFloor'
import { resolveHighlightedRegionId, type RegionsRenderer } from './drawRegions'
import type { TextLabelsRenderer } from './drawTextLabels'
import { drawWalls } from './drawWalls'
import { drawDoors } from './drawDoors'
import { drawStairs } from './drawStairs'
import { drawLights } from './drawLights'
import { drawDrawings } from './drawDrawings'
import { drawMapLines, drawMapMarkers } from './drawMapLines'
import { drawEditHandles } from './drawEditHandles'
import { drawAreaSelectionOutline } from './drawSelectionMarquee'

/** Referência estável: camada oculta não força recalcular o contorno a cada redraw. */
const EMPTY_FLOOR: FloorPiece[] = []

/** Onde cada camada vetorial do mapa é desenhada (criados uma vez no `setup()` do PixiCanvas). */
export interface ShapesTargets {
  floor: Graphics
  floorSelection: Graphics
  mapLines: Graphics
  regions: Container
  walls: Graphics
  doors: Graphics
  stairs: Graphics
  lights: Graphics
  drawings: Graphics
  textLabels: Container
  handles: Graphics
  areaOutline: Graphics
}

/** Renderers com cache próprio e os passos do render fiel que continuam vivendo no PixiCanvas. */
export interface ShapesRenderers {
  floor: FloorRenderer
  regions: RegionsRenderer
  textLabels: TextLabelsRenderer
  redrawMapRaster: (map: MapData) => void
  clearMapRaster: () => void
  redrawMapFrame: (frame: MapFrame | null) => void
}

/** Recorte do estado da store que as camadas vetoriais leem. */
export interface ShapesSnapshot {
  map: MapData
  selection: SelectionSet
  activeTool: DrawingTool
}

/**
 * Portão de redesenho: devolve `true` na primeira chamada e sempre que alguma
 * dependência mudar de referência (`Object.is`) ou a lista mudar de tamanho;
 * `false` quando tudo é igual à chamada anterior. A store é imutável, então
 * "mesma referência" = "mesmo conteúdo" — é o que permite pular a camada.
 */
export function createChangeGate(): (deps: readonly unknown[]) => boolean {
  let last: readonly unknown[] | null = null
  return (deps) => {
    const prev = last
    last = deps
    return prev === null || prev.length !== deps.length || deps.some((dep, i) => !Object.is(dep, prev[i]))
  }
}

/**
 * Redesenho das camadas vetoriais do mapa (chão, traços, salas, paredes,
 * portas, escadas, luzes, desenhos, textos, alças e contorno do grupo).
 *
 * Redesenho PARCIAL: cada camada só repinta quando uma das entradas DELA
 * muda. Antes, qualquer mudança (arrastar 1 sala, selecionar, desfazer)
 * repintava o mapa inteiro a cada pointermove — medido na torre: quadro p95
 * de 1,27 s arrastando sala, 1,45 s para selecionar. O id selecionado entra
 * como texto (tipo + id), não como objeto: cada clique cria um conjunto de
 * seleção novo mesmo quando o item é o mesmo.
 */
export function createShapesRedrawer(targets: ShapesTargets, renderers: ShapesRenderers): (snapshot: ShapesSnapshot) => void {
  const gates = {
    floor: createChangeGate(),
    floorSelection: createChangeGate(),
    mapLines: createChangeGate(),
    regions: createChangeGate(),
    walls: createChangeGate(),
    stairs: createChangeGate(),
    lights: createChangeGate(),
    drawings: createChangeGate(),
    handles: createChangeGate(),
    areaOutline: createChangeGate(),
  }

  return ({ map, selection, activeTool }) => {
    const single = selectionSingle(selection)
    const selectedId = (kind: string): string | null => (single?.kind === kind ? single.id : null)
    const hidden = map.hiddenLayers
    const rasterMode = map.floorStyle.renderMode === 'raster'

    if (rasterMode) {
      if (gates.floor([true, map.floor, map.lines, map.markers, map.floorStyle, hidden, map.width, map.height, map.grid])) {
        targets.floor.clear()
        renderers.redrawMapRaster(map)
      }
    } else {
      const floorSource = hidden.includes('salas') ? EMPTY_FLOOR : map.floor
      if (gates.floor([false, floorSource, map.floorStyle])) {
        renderers.clearMapRaster()
        renderers.floor.draw(targets.floor, floorSource, map.floorStyle)
      }
    }

    const floorId = selectedId('floor')
    const selectedPiece = floorId !== null && !hidden.includes('salas') ? map.floor.find((p) => p.id === floorId) ?? null : null
    if (gates.floorSelection([selectedPiece, map.floorStyle.sampleStep])) {
      renderers.floor.drawSelection(targets.floorSelection, selectedPiece, map.floorStyle.sampleStep)
    }

    const showLines = !rasterMode && !hidden.includes('paredes')
    const showMarkers = !rasterMode && !hidden.includes('portas')
    if (gates.mapLines([showLines, showMarkers, map.lines, map.markers])) {
      targets.mapLines.clear()
      if (showLines) drawMapLines(targets.mapLines, map.lines)
      if (showMarkers) drawMapMarkers(targets.mapLines, map.markers)
    }

    // Já memoizada por referência de `map.frame` no PixiCanvas.
    renderers.redrawMapFrame(map.frame)

    // Além do portão da camada, o renderer de salas pula cada sala cuja
    // referência e destaque não mudaram — arrastar uma sala repinta só ela.
    const highlightedRegionId = resolveHighlightedRegionId(map.walls, single)
    if (gates.regions([map.regions, hidden, highlightedRegionId])) {
      renderers.regions.draw(targets.regions, visibleRegions(map.regions, hidden), highlightedRegionId)
    }

    const wallId = selectedId('wall')
    if (gates.walls([map.walls, hidden, wallId])) {
      const walls = visibleWalls(map.walls, hidden)
      drawWalls(targets.walls, walls, wallId)
      drawDoors(targets.doors, walls, wallId)
    }

    const stairId = selectedId('stair')
    if (gates.stairs([map.stairs, hidden, stairId])) {
      drawStairs(targets.stairs, visibleStairs(map.stairs, hidden), stairId)
    }

    const lightId = selectedId('light')
    if (gates.lights([map.lights, hidden, lightId])) {
      drawLights(targets.lights, visibleLights(map.lights, hidden), lightId)
    }

    const drawingId = selectedId('drawing')
    if (gates.drawings([map.drawings, hidden, drawingId])) {
      const drawings = visibleDrawings(map.drawings, hidden)
      drawDrawings(targets.drawings, drawings, drawingId)
      renderers.textLabels.draw(targets.textLabels, drawings, drawingId)
    }

    // Alças só existem com 1 item selecionado na ferramenta Selecionar; sem
    // isso, mudança no mapa não mexe nelas. Com seleção, dependem das listas
    // onde `drawEditHandles` procura o item.
    const handlesDeps: readonly unknown[] =
      activeTool === 'select' && single
        ? [activeTool, single.kind, single.id, map.walls, map.regions, map.drawings, map.tokens, map.props, map.lights, map.grid]
        : [activeTool, null, null]
    if (gates.handles(handlesDeps)) {
      drawEditHandles(targets.handles, map, single, activeTool)
    }

    // Contorno do grupo (2+ itens): a caixa depende de quase todas as listas,
    // então acompanha o mapa inteiro — mas só quando há grupo.
    const isGroup = selection.length > 1
    if (gates.areaOutline(isGroup ? [selection, map] : [null])) {
      drawAreaSelectionOutline(targets.areaOutline, isGroup ? areaSelectionBounds(map, selectionToAreaSelection(selection)) : null)
    }
  }
}
