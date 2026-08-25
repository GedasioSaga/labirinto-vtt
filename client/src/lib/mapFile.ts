import type { MapData } from '../types/map'

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
    showGrid: parsed.showGrid ?? true,
    background: parsed.background ?? { type: 'color', src: '#2b2b2b' },
    walls: parsed.walls ?? [],
    lights: parsed.lights ?? [],
    regions: parsed.regions ?? [],
    tokens: parsed.tokens ?? [],
    fog: parsed.fog ?? { mode: 'none', revealed: [] },
    ownerId: parsed.ownerId ?? null,
    scenarioLink: parsed.scenarioLink ?? null,
  }
}
