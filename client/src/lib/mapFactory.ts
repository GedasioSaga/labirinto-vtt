import type { MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState } from '../types/map'

export function createEmptyMap(id: string, name: string, width: number, height: number, grid: number): MapData {
  return {
    id,
    name,
    width,
    height,
    grid,
    gridShape: 'square',
    showGrid: true,
    background: { type: 'color', src: '#2b2b2b' },
    walls: [],
    lights: [],
    regions: [],
    tokens: [],
    props: [],
    drawings: [],
    fog: { mode: 'none', revealed: [] },
    ownerId: null,
    scenarioLink: null,
  }
}

export function addWall(map: MapData, wall: Wall): MapData {
  return { ...map, walls: [...map.walls, wall] }
}

export function removeWall(map: MapData, wallId: string): MapData {
  return { ...map, walls: map.walls.filter((w) => w.id !== wallId) }
}

export function addLight(map: MapData, light: Light): MapData {
  return { ...map, lights: [...map.lights, light] }
}

export function removeLight(map: MapData, lightId: string): MapData {
  return { ...map, lights: map.lights.filter((l) => l.id !== lightId) }
}

export function addRegion(map: MapData, region: Region): MapData {
  return { ...map, regions: [...map.regions, region] }
}

export function removeRegion(map: MapData, regionId: string): MapData {
  return { ...map, regions: map.regions.filter((r) => r.id !== regionId) }
}

export function addToken(map: MapData, token: Token): MapData {
  return { ...map, tokens: [...map.tokens, token] }
}

export function removeToken(map: MapData, tokenId: string): MapData {
  return { ...map, tokens: map.tokens.filter((t) => t.id !== tokenId) }
}

export function setTokenPosition(map: MapData, tokenId: string, x: number, y: number): MapData {
  return {
    ...map,
    tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
  }
}

export function addProp(map: MapData, prop: Prop): MapData {
  return { ...map, props: [...map.props, prop] }
}

export function removeProp(map: MapData, propId: string): MapData {
  return { ...map, props: map.props.filter((p) => p.id !== propId) }
}

export function setPropPosition(map: MapData, propId: string, x: number, y: number): MapData {
  return {
    ...map,
    props: map.props.map((p) => (p.id === propId ? { ...p, x, y } : p)),
  }
}

export function setShowGrid(map: MapData, showGrid: boolean): MapData {
  return { ...map, showGrid }
}

export function setBackground(map: MapData, background: MapData['background']): MapData {
  return { ...map, background }
}

export function setGridShape(map: MapData, gridShape: MapData['gridShape']): MapData {
  return { ...map, gridShape }
}

export function setWallDoor(map: MapData, wallId: string, door: DoorState | null): MapData {
  return {
    ...map,
    walls: map.walls.map((w) => (w.id === wallId ? { ...w, door } : w)),
  }
}

export function setScenarioLink(map: MapData, scenarioLink: string | null): MapData {
  return { ...map, scenarioLink }
}

export function addDrawing(map: MapData, drawing: Drawing): MapData {
  return { ...map, drawings: [...map.drawings, drawing] }
}

export function removeDrawing(map: MapData, drawingId: string): MapData {
  return { ...map, drawings: map.drawings.filter((d) => d.id !== drawingId) }
}
