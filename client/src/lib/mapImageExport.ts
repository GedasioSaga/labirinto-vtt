import type { ConcealZone, Drawing, MapData, Region, RegionPoint, Stair, Wall } from '../types/map'
import { shapeCenter } from './floorSdf'
import { isHidden } from './itemTransform'
import { isArrivalOnly } from './pinTravel'
import { ancestorsOf, pointInPolygonInclusive, subtreeIds } from './roomNesting'

/**
 * "Exportar imagem": o que o mestre escolhe no diálogo antes de salvar o PNG.
 *
 * `masterOnly` desligado é o caso de postar a imagem no grupo: nada do que é
 * só do mestre pode sair nela — item "Oculto para jogadores" (`secret`), sala
 * secreta com tudo o que está dentro, zona oculta com o que ela cobre, nome de
 * sala escondido dos jogadores e pino de chegada oculta. Mesmas regras
 * estáticas do recorte do jogador (`lib/fogFilter.ts`), sem névoa: a imagem
 * mostra a cena inteira.
 */
export interface ImageExportOptions {
  grid: boolean
  masterOnly: boolean
}

/** Gera o PNG da cena atual (bytes do arquivo). Mora no canvas do editor (`pixi/PixiCanvas.tsx`). */
export type MapImageExporter = (options: ImageExportOptions) => Promise<Uint8Array>

/** Maior lado do PNG, em px: nítido para imprimir e dentro do limite de textura de qualquer placa. */
export const IMAGE_EXPORT_MAX_SIDE_PX = 2048
/** Mapa pequeno não passa do dobro: acima disso a imagem só fica pesada, sem detalhe novo. */
export const IMAGE_EXPORT_MAX_SCALE = 2
/** Nome do arquivo quando o nome do mapa não sobra nada que o sistema aceite. */
const FALLBACK_FILE_NAME = 'mapa'

/** Escala do mundo para a imagem: o mapa inteiro, maior lado até `IMAGE_EXPORT_MAX_SIDE_PX`. */
export function imageExportScale(widthPx: number, heightPx: number): number {
  const side = Math.max(widthPx, heightPx)
  if (!Number.isFinite(side) || side <= 0) return 1
  return Math.min(IMAGE_EXPORT_MAX_SCALE, IMAGE_EXPORT_MAX_SIDE_PX / side)
}

/**
 * "Cripta do Farol" vira "Cripta do Farol.png". Tira o que o Windows recusa em
 * nome de arquivo (`<>:"/\|?*` e caracteres de controle) e o ponto/espaço do fim.
 */
export function imageExportFileName(mapName: string): string {
  const cleaned = Array.from(mapName)
    .filter((char) => char.charCodeAt(0) >= 32 && !'<>:"/\\|?*'.includes(char))
    .join('')
    .trim()
    .replace(/[. ]+$/, '')
  return `${cleaned === '' ? FALLBACK_FILE_NAME : cleaned}.png`
}

/** Bytes de um data URL em base64 (`data:image/png;base64,...`), como o `extract` do Pixi devolve. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1 || !dataUrl.slice(0, comma).endsWith(';base64')) {
    throw new Error('imagem gerada em formato inesperado')
  }
  const binary = atob(dataUrl.slice(comma + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * O mapa como ele sai na imagem. A grade segue a opção do diálogo (não a do
 * editor), item "Oculto no editor" (`hidden`) nunca sai — no editor ele é só
 * um fantasma de trabalho — e, sem `masterOnly`, sai sem nada do que é só do
 * mestre (ver `ImageExportOptions`). Não muda o mapa recebido.
 */
export function mapForImageExport(map: MapData, options: ImageExportOptions): MapData {
  const shown: MapData = {
    ...map,
    showGrid: options.grid,
    tokens: map.tokens.filter((t) => !isHidden(t)),
    props: map.props.filter((p) => !isHidden(p)),
    pins: map.pins.filter((p) => !isHidden(p)),
    lights: map.lights.filter((l) => !isHidden(l)),
    stairs: map.stairs.filter((s) => !isHidden(s)),
    walls: map.walls.filter((w) => !isHidden(w)),
    regions: map.regions.filter((r) => !isHidden(r)),
  }
  return options.masterOnly ? shown : withoutMasterOnly(shown)
}

/** Tudo que o jogador nunca recebe por decisão do mestre, fora do mapa. */
function withoutMasterOnly(map: MapData): MapData {
  const secretRooms = map.regions.filter((r) => r.secret && r.room !== undefined)
  // Sala secreta leva junto as sub-salas e as paredes delas, como no recorte do jogador.
  const goneRegionIds = new Set([
    ...map.regions.filter((r) => r.secret).map((r) => r.id),
    ...secretRooms.flatMap((r) => [...subtreeIds(map.regions, r.id)]),
    ...map.regions.filter((r) => ancestorsOf(map.regions, r.id).some((a) => a.secret)).map((r) => r.id),
  ])
  const hiddenAreas = [...secretRooms.map((r) => r.points), ...activeZoneRings(map.concealZones)]
  const hidden = (point: RegionPoint): boolean => hiddenAreas.some((ring) => pointInPolygonInclusive(point, ring))
  const anyHidden = (points: readonly RegionPoint[]): boolean => hiddenAreas.length > 0 && points.some(hidden)

  return {
    ...map,
    regions: map.regions.filter((r) => !goneRegionIds.has(r.id)).map(withoutHiddenRoomName),
    walls: map.walls.filter((w) => !(w.regionId !== undefined && goneRegionIds.has(w.regionId)) && !anyHidden(wallPoints(w))),
    tokens: map.tokens.filter((t) => !t.secret && !anyHidden([t])),
    props: map.props.filter((p) => !p.secret && !anyHidden([p])),
    pins: map.pins.filter((p) => !p.secret && !isArrivalOnly(p) && !anyHidden([p])),
    lights: map.lights.filter((l) => !anyHidden([l])),
    stairs: map.stairs.filter((s) => !s.secret && !anyHidden(stairPoints(s))),
    drawings: map.drawings.filter((d) => !d.secret && !anyHidden(drawingPoints(d))),
    markers: map.markers.filter((m) => !anyHidden([{ x: m.cx, y: m.cy }])),
    lines: map.lines.filter((l) => !anyHidden(l.points)),
    floor: map.floor.filter((f) => !anyHidden([shapeCenter(f.shape)])),
    // A zona é anotação do mestre: nem o contorno dela sai.
    concealZones: [],
  }
}

function activeZoneRings(zones: readonly ConcealZone[]): RegionPoint[][] {
  return zones.filter((z) => !z.revealed && z.points.length >= 3).map((z) => z.points)
}

/** Sala com "nome oculto para jogadores" sai sem o nome, como no recorte do jogador. */
function withoutHiddenRoomName(region: Region): Region {
  if (region.room === undefined || region.room.nameHiddenFromPlayers !== true) return region
  return { ...region, room: { ...region.room, name: '' } }
}

function wallPoints(wall: Wall): RegionPoint[] {
  return [
    { x: wall.x1, y: wall.y1 },
    { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 },
    { x: wall.x2, y: wall.y2 },
  ]
}

function stairPoints(stair: Stair): RegionPoint[] {
  return stair.segments.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ])
}

/** Pontos que dizem onde o desenho está: basta um escondido para ele não sair. */
function drawingPoints(drawing: Drawing): RegionPoint[] {
  switch (drawing.kind) {
    case 'freehand':
    case 'curve':
    case 'polygon':
    case 'path':
      return drawing.points
    case 'line':
      return [
        { x: drawing.x1, y: drawing.y1 },
        { x: drawing.x2, y: drawing.y2 },
      ]
    case 'circle':
    case 'ellipse':
      return [{ x: drawing.cx, y: drawing.cy }]
    case 'text':
      return [{ x: drawing.x, y: drawing.y }]
    case 'rect':
      return [{ x: drawing.x + drawing.w / 2, y: drawing.y + drawing.h / 2 }]
  }
}
