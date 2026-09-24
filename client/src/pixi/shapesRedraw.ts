import type { MapData } from '../types/map'
import type { DrawingTool } from '../types/tools'
import { selectionSingle, type SelectionSet } from '../lib/selectionModel'
import { resolveHighlightedRegionId } from './drawRegions'
import { hazardsOf } from '../lib/hazards'
import { conveyorsOf } from '../lib/conveyors'
import { tokenWatchOf } from '../lib/npcWatch'

/**
 * Camadas vetoriais do mapa no editor, NA ORDEM de pintura do PixiCanvas.
 * `gridMask` vem depois de `floor` porque lê os polígonos que o chão acabou
 * de montar (`floorRenderer.polygons()`).
 */
export const SHAPES_LAYERS = [
  'floor',
  'gridMask',
  'floorSelection',
  'mapLines',
  'mapFrame',
  'regions',
  'drawings',
  'hazards',
  'conveyors',
  'roomNames',
  'walls',
  'stairs',
  'lights',
  'watchCones',
  'concealZones',
  'pins',
  'textLabels',
  'handles',
  'areaOutline',
] as const

export type ShapesLayer = (typeof SHAPES_LAYERS)[number]

/** Camadas que criam ou mexem em `Text`: pintar uma delas pede sincronizar a resolução dos textos. */
const TEXT_LAYERS: ReadonlySet<ShapesLayer> = new Set<ShapesLayer>(['mapFrame', 'roomNames', 'concealZones', 'pins', 'textLabels'])

export function paintedTextLayer(painted: readonly ShapesLayer[]): boolean {
  return painted.some((layer) => TEXT_LAYERS.has(layer))
}

/** Tudo de que as camadas vetoriais dependem, lido da store e da câmera no momento do redesenho. */
export interface ShapesSnapshot {
  map: MapData
  selection: SelectionSet
  activeTool: DrawingTool
  selectedConcealZoneId: string | null
  selectedPinId: string | null
  /**
   * Referências da aventura que decidem se um pino de viagem está ligado (o
   * par mora em OUTRA cena): `[cache, adventure, activeSceneId]`.
   */
  travel: readonly unknown[]
  cameraScale: number
  rendererResolution: number
  /** Sala sendo girada pela alça: a alça de girar aparece acesa. */
  rotatingRoom: boolean
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
 * Do que cada camada depende. Só entra a escala da câmera onde ela muda a
 * pintura: traço fino em px de tela (paredes, portas, escadas), marcador da
 * luz, alças e o contorno de seleção — este último só existe com algo
 * selecionado, então sala e desenho só dependem da escala quando há um deles
 * selecionado. Nomes de sala e fichas seguem o zoom por `setCameraScale`, sem
 * repintar.
 */
export function shapesLayerDeps(layer: ShapesLayer, snapshot: ShapesSnapshot): readonly unknown[] {
  const { map, selection, cameraScale, rendererResolution } = snapshot
  const hidden = map.hiddenLayers
  const single = selectionSingle(selection)
  const selectedId = (kind: string): string | null => (single !== null && single.kind === kind ? single.id : null)
  const rasterMode = map.floorStyle.renderMode === 'raster'
  const floorHidden = hidden.includes('salas')

  switch (layer) {
    case 'floor':
      return rasterMode
        ? ['raster', map.floor, map.lines, map.markers, map.floorStyle, hidden, map.width, map.height, map.grid]
        : ['vetor', floorHidden, floorHidden ? null : map.floor, map.floorStyle]
    case 'gridMask':
      // Lê os polígonos do chão, que o `floorStyle` também molda (amostragem).
      return [rasterMode, hidden, map.regions, map.walls, rasterMode || floorHidden ? null : map.floor, map.floorStyle]
    case 'floorSelection': {
      const floorId = selectedId('floor')
      const piece = floorId !== null && !floorHidden ? (map.floor.find((p) => p.id === floorId) ?? null) : null
      return [piece, map.floorStyle.sampleStep]
    }
    case 'mapLines':
      return [rasterMode, hidden.includes('paredes'), hidden.includes('portas'), map.lines, map.markers]
    case 'mapFrame':
      return [map.frame]
    case 'regions': {
      const highlighted = resolveHighlightedRegionId(map.walls, single)
      return [map.regions, hidden, highlighted, highlighted === null ? null : cameraScale]
    }
    case 'drawings': {
      const drawingId = selectedId('drawing')
      return [map.drawings, hidden, drawingId, drawingId === null ? null : cameraScale]
    }
    case 'hazards':
      // ZONA DE PERIGO: a cor pinta a sala tomada. Sem perigo no mapa, nada a repintar.
      return hazardsOf(map).length === 0 ? ['sem perigo'] : [map.hazards, map.regions, hidden]
    case 'conveyors':
      // ESTEIRA e CABINE: setas na sala, linha de pino a pino e anel no pino
      // de viagem. Traço de 1 px de tela, então o zoom também repinta.
      return conveyorsOf(map).length === 0 && !map.pins.some((p) => p.cabine !== undefined)
        ? ['sem esteira']
        : [map.conveyors, map.regions, map.pins, hidden, map.grid, cameraScale, rendererResolution]
    case 'roomNames':
      return [map.regions, hidden, map.grid]
    case 'walls':
      return [map.walls, hidden, selectedId('wall'), selectedId('region'), cameraScale, rendererResolution]
    case 'stairs':
      return [map.stairs, hidden, selectedId('stair'), cameraScale, rendererResolution]
    case 'lights':
      // Paredes e chão barram a luz (`visionSegments`): mudou um deles, o recorte muda.
      return [map.lights, hidden, selectedId('light'), cameraScale, map.walls, map.floor]
    case 'watchCones':
      // OLHOS DO GUARDA: o cone segue o guarda (fichas) e é cortado por paredes e chão.
      return map.tokens.some((t) => tokenWatchOf(t) !== null) ? [map.tokens, map.walls, map.floor, hidden, map.grid] : ['sem guarda']
    case 'concealZones':
      return [map.concealZones, map.grid, snapshot.selectedConcealZoneId]
    case 'pins':
      return [map.pins, hidden, snapshot.selectedPinId, ...snapshot.travel]
    case 'textLabels':
      return [map.drawings, hidden, selectedId('drawing')]
    case 'handles':
      // Alças só existem com UM item selecionado na ferramenta Selecionar; o
      // item pode estar em qualquer lista do mapa, então elas seguem o mapa.
      return snapshot.activeTool === 'select' && single !== null
        ? ['alças', single.kind, single.id, map, cameraScale, rendererResolution, snapshot.rotatingRoom]
        : ['sem alças']
    case 'areaOutline':
      return selection.length > 1 ? ['grupo', selection, map] : ['sem grupo']
  }
}

/**
 * Redesenho PARCIAL das camadas vetoriais: cada camada só repinta quando uma
 * das entradas DELA muda. Antes, arrastar uma sala repintava o mapa inteiro a
 * cada pointermove, selecionar e desfazer também, e cada passo de zoom refazia
 * paredes, salas, escadas e luzes (medido na torre).
 *
 * `only` pede um subconjunto (quem só mexeu nas alças, por exemplo) — pelo
 * MESMO portão, então uma pintura avulsa nunca deixa o redesenho inteiro com
 * uma memória velha. Devolve as camadas pintadas, na ordem.
 */
export function createShapesRedrawer(
  paint: Readonly<Record<ShapesLayer, () => void>>,
): (snapshot: ShapesSnapshot, only?: readonly ShapesLayer[]) => ShapesLayer[] {
  const gates = new Map<ShapesLayer, (deps: readonly unknown[]) => boolean>(SHAPES_LAYERS.map((layer) => [layer, createChangeGate()]))

  return (snapshot, only) => {
    const painted: ShapesLayer[] = []
    for (const layer of only ?? SHAPES_LAYERS) {
      const gate = gates.get(layer)
      if (gate === undefined || !gate(shapesLayerDeps(layer, snapshot))) continue
      paint[layer]()
      painted.push(layer)
    }
    return painted
  }
}
