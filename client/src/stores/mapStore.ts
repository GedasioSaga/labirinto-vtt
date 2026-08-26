import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState } from '../types/map'
import type { Camera } from '../pixi/world'
import type { DrawingTool, Selection, SelectionKind } from '../types/tools'
import * as mapFactory from '../lib/mapFactory'
import { resolveTokenMove } from '../lib/collision'

interface MapStoreState {
  map: MapData
  camera: Camera
  selection: Selection | null
  activeTool: DrawingTool
  snapEnabled: boolean
  drawColor: string
  drawWidth: number
  drawFilled: boolean
  drawFontSize: number
  setDrawColor: (color: string) => void
  setDrawWidth: (width: number) => void
  setDrawFilled: (filled: boolean) => void
  setDrawFontSize: (size: number) => void
  addDrawing: (drawing: Drawing) => void
  removeDrawing: (id: string) => void
  setCamera: (camera: Camera) => void
  setSelection: (selection: Selection | null) => void
  removeSelected: () => void
  setActiveTool: (tool: DrawingTool) => void
  setSnapEnabled: (enabled: boolean) => void
  addWall: (wall: Wall) => void
  removeWall: (id: string) => void
  addLight: (light: Light) => void
  removeLight: (id: string) => void
  addRegion: (region: Region) => void
  removeRegion: (id: string) => void
  regionFillColor: string
  setRegionFillColor: (color: string) => void
  setRegionColor: (id: string, color: string) => void
  addToken: (token: Token) => void
  removeToken: (id: string) => void
  setTokenPosition: (id: string, x: number, y: number) => void
  moveToken: (id: string, targetX: number, targetY: number) => void
  addProp: (prop: Prop) => void
  removeProp: (id: string) => void
  moveProp: (id: string, x: number, y: number) => void
  setShowGrid: (show: boolean) => void
  setGridShape: (shape: MapData['gridShape']) => void
  setBackground: (background: MapData['background']) => void
  setWallDoor: (id: string, door: DoorState | null) => void
  setScenarioLink: (value: string | null) => void
  setPropLinkedPath: (id: string, path: string | null) => void
  updateCurvePoint: (drawingId: string, index: number, x: number, y: number) => void
  updateTextLabel: (id: string, patch: Partial<{ text: string; color: string; fontSize: number }>) => void
  loadMap: (map: MapData) => void
}

const initialMap = mapFactory.createEmptyMap('map_local', 'Mapa sem título', 30, 20, 64)

export const useMapStore = create<MapStoreState>()(subscribeWithSelector((set, get) => ({
  map: initialMap,
  camera: { x: 0, y: 0, scale: 1 },
  selection: null,
  activeTool: 'select',
  snapEnabled: false,
  drawColor: '#ffffff',
  drawWidth: 4,
  drawFilled: false,
  drawFontSize: 16,
  regionFillColor: '#3a7ad0',
  setCamera: (camera) => set({ camera }),
  setSelection: (selection) => set({ selection }),
  removeSelected: () => {
    const { selection } = get()
    if (!selection) return
    const removers: Record<SelectionKind, (id: string) => void> = {
      token: get().removeToken,
      wall: get().removeWall,
      light: get().removeLight,
      region: get().removeRegion,
      prop: get().removeProp,
      drawing: get().removeDrawing,
    }
    removers[selection.kind](selection.id)
    set({ selection: null })
  },
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setDrawColor: (color) => set({ drawColor: color }),
  setDrawWidth: (width) => set({ drawWidth: width }),
  setDrawFilled: (filled) => set({ drawFilled: filled }),
  setDrawFontSize: (size) => set({ drawFontSize: size }),
  addWall: (wall) => set((state) => ({ map: mapFactory.addWall(state.map, wall) })),
  removeWall: (id) => set((state) => ({ map: mapFactory.removeWall(state.map, id) })),
  addLight: (light) => set((state) => ({ map: mapFactory.addLight(state.map, light) })),
  removeLight: (id) => set((state) => ({ map: mapFactory.removeLight(state.map, id) })),
  addRegion: (region) => set((state) => ({ map: mapFactory.addRegion(state.map, region) })),
  removeRegion: (id) => set((state) => ({ map: mapFactory.removeRegion(state.map, id) })),
  setRegionFillColor: (color) => set({ regionFillColor: color }),
  setRegionColor: (id, color) => set((state) => ({
    map: { ...state.map, regions: state.map.regions.map((r) => (r.id === id ? { ...r, fillColor: color } : r)) },
  })),
  addToken: (token) => set((state) => ({ map: mapFactory.addToken(state.map, token) })),
  removeToken: (id) => set((state) => ({ map: mapFactory.removeToken(state.map, id) })),
  setTokenPosition: (id, x, y) => set((state) => ({ map: mapFactory.setTokenPosition(state.map, id, x, y) })),
  moveToken: (id, targetX, targetY) => {
    const state = get()
    const token = state.map.tokens.find((t) => t.id === id)
    if (!token) return
    const resolved = resolveTokenMove({ x: token.x, y: token.y }, { x: targetX, y: targetY }, state.map.walls)
    set({ map: mapFactory.setTokenPosition(state.map, id, resolved.x, resolved.y) })
  },
  addProp: (prop) => set((state) => ({ map: mapFactory.addProp(state.map, prop) })),
  removeProp: (id) => set((state) => ({ map: mapFactory.removeProp(state.map, id) })),
  moveProp: (id, x, y) => set((state) => ({ map: mapFactory.setPropPosition(state.map, id, x, y) })),
  addDrawing: (drawing) => set((state) => ({ map: mapFactory.addDrawing(state.map, drawing) })),
  removeDrawing: (id) => set((state) => ({ map: mapFactory.removeDrawing(state.map, id) })),
  setShowGrid: (show) => set((state) => ({ map: mapFactory.setShowGrid(state.map, show) })),
  setGridShape: (shape) => set((state) => ({ map: mapFactory.setGridShape(state.map, shape) })),
  setBackground: (background) => set((state) => ({ map: mapFactory.setBackground(state.map, background) })),
  setWallDoor: (id, door) => set((state) => ({ map: mapFactory.setWallDoor(state.map, id, door) })),
  setScenarioLink: (value) => set((state) => ({ map: mapFactory.setScenarioLink(state.map, value) })),
  setPropLinkedPath: (id, path) => set((state) => ({
    map: { ...state.map, props: state.map.props.map((p) => (p.id === id ? { ...p, linkedMapPath: path } : p)) },
  })),
  updateCurvePoint: (drawingId, index, x, y) => set((state) => ({
    map: {
      ...state.map,
      drawings: state.map.drawings.map((d) =>
        d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p, i) => i === index ? { x, y } : p) } : d,
      ),
    },
  })),
  updateTextLabel: (id, patch) => set((state) => ({
    map: {
      ...state.map,
      drawings: state.map.drawings.map((d) =>
        d.id === id && d.kind === 'text' ? { ...d, ...patch } : d,
      ),
    },
  })),
  loadMap: (map) => set({ map, selection: null }),
})))
