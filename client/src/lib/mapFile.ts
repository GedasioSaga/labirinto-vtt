import type { FloorStyle, MapData } from '../types/map'

/** Verde do minimapa dos mapas de referência (`Objetivo/*.png`, cor dominante #006B00). */
export const DEFAULT_FLOOR_STYLE: FloorStyle = { fillColor: '#006b00', strokeColor: null, strokeWidth: 1 }

export function serializeMap(map: MapData): string {
  return JSON.stringify(map, null, 2)
}

export function deserializeMap(json: string): MapData {
  let parsed: Partial<MapData>
  try {
    parsed = JSON.parse(json) as Partial<MapData>
  } catch (error) {
    throw new Error(`map.json inválido: JSON malformado (${(error as Error).message})`)
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('map.json inválido: campo "id" ausente ou não é string')
  }

  return {
    id: parsed.id,
    name: parsed.name ?? 'Mapa sem título',
    width: parsed.width ?? 30,
    height: parsed.height ?? 20,
    grid: parsed.grid ?? 64,
    gridShape: parsed.gridShape ?? 'square',
    showGrid: parsed.showGrid ?? true,
    // NOVO — valores = cópia literal dos hardcodes de drawGrid.ts:4 / drawHexGrid.ts:4
    gridSettings: parsed.gridSettings ?? {
      color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid',
    },
    background: parsed.background ?? { type: 'color', src: '#2b2b2b' },
    // MUDA de cru para .map(): DoorState ganhou campo obrigatório.
    // wallKind ausente fica undefined de propósito (=== 'exterior').
    walls: (parsed.walls ?? []).map((w) => ({
      ...w,
      door: w.door ? { ...w.door, kind: w.door.kind ?? 'normal' } : null,
    })),
    lights: parsed.lights ?? [],
    // inalterado — `room` ausente fica undefined (região comum)
    regions: (parsed.regions ?? []).map((r) => ({ ...r, fillColor: r.fillColor ?? '#3a7ad0', fillPattern: r.fillPattern ?? 'solid' })),
    // MUDA de cru para .map(): Token.image é obrigatório
    tokens: (parsed.tokens ?? []).map((t) => ({ ...t, image: t.image ?? null })),
    // inalterado fora o que já existia — Prop.layer ausente fica undefined
    props: (parsed.props ?? []).map((p) => ({ ...p, linkedMapPath: p.linkedMapPath ?? null })),
    stairs: parsed.stairs ?? [],
    // MUDA de cru para .map(): PONTO DE MAIOR RISCO DE TODA A MIGRAÇÃO.
    // 0.5/0 é o alpha que drawDrawings.ts:50 já aplicava (filled ? 0.5 : 0);
    // sem esta linha, alpha: undefined vira 1 no Pixi e TODO círculo
    // preenchido de mapa salvo muda de aparência ao abrir.
    drawings: (parsed.drawings ?? []).map((d) =>
      d.kind === 'circle' && d.fillAlpha === undefined ? { ...d, fillAlpha: d.filled ? 0.5 : 0 } : d,
    ),
    floor: parsed.floor ?? [],
    floorStyle: parsed.floorStyle ?? { ...DEFAULT_FLOOR_STYLE },
    lines: parsed.lines ?? [],
    markers: parsed.markers ?? [],
    frame: parsed.frame ?? null,
    fog: parsed.fog ?? { mode: 'none', revealed: [] },
    hiddenLayers: parsed.hiddenLayers ?? [],
    // NOVO (Onda 4, Frente D) — mesmo padrão de hiddenLayers acima: mapa
    // salvo antes deste campo existir abre com nada travado.
    lockedLayers: parsed.lockedLayers ?? [],
    scale: parsed.scale ?? { unitsPerCell: 5, unit: 'ft', precision: 0 },
    // depende do gridShape JÁ RESOLVIDO, não do literal cru — senão mapa hex
    // antigo sem gridShape salvo cairia em 'chessboard' por engano
    measurementMode:
      parsed.measurementMode ?? ((parsed.gridShape ?? 'square') === 'hex' ? 'hex' : 'chessboard'),
    ownerId: parsed.ownerId ?? null,
    scenarioLink: parsed.scenarioLink ?? null,
  }
}
