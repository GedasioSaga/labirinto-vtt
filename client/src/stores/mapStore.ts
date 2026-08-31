import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MapData, Wall, Light, Region, Token, Prop, Drawing, DoorState } from '../types/map'
import type { Camera } from '../pixi/world'
import type { DrawingTool, Selection, SelectionKind } from '../types/tools'
import * as mapFactory from '../lib/mapFactory'
import { resolveTokenMove } from '../lib/collision'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'

interface MapStoreState {
  map: MapData
  past: MapData[]
  future: MapData[]
  camera: Camera
  selection: Selection | null
  activeTool: DrawingTool
  snapEnabled: boolean
  drawColor: string
  drawWidth: number
  drawFilled: boolean
  drawFontSize: number
  drawFontFamily: string
  polygonSides: number
  setDrawColor: (color: string) => void
  setDrawWidth: (width: number) => void
  setDrawFilled: (filled: boolean) => void
  setDrawFontSize: (size: number) => void
  setDrawFontFamily: (fontFamily: string) => void
  setPolygonSides: (sides: number) => void
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
  addRoom: (region: Region, walls: Wall[]) => void
  updateWallPoint: (wallId: string, endpoint: 0 | 1, x: number, y: number) => void
  moveWall: (wallId: string, dx: number, dy: number) => void
  updateRegionPoint: (regionId: string, index: number, x: number, y: number) => void
  insertRegionPoint: (regionId: string, afterEdgeIndex: number, x: number, y: number, newWallId: string) => void
  removeRegionPoint: (regionId: string, index: number) => void
  moveRegion: (regionId: string, dx: number, dy: number) => void
  linkRegionWalls: (regionId: string) => void
  smoothRegion: (regionId: string) => void
  regionFillColor: string
  setRegionFillColor: (color: string) => void
  setRegionColor: (id: string, color: string) => void
  regionFillPattern: Region['fillPattern']
  setRegionFillPattern: (pattern: Region['fillPattern']) => void
  setRegionPattern: (id: string, pattern: Region['fillPattern']) => void
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
  addDoorOnWall: (wallId: string, point: { x: number; y: number }, doorLength: number) => void
  setScenarioLink: (value: string | null) => void
  setPropLinkedPath: (id: string, path: string | null) => void
  updateCurvePoint: (drawingId: string, index: number, x: number, y: number) => void
  insertCurvePoint: (drawingId: string, afterIndex: number, x: number, y: number) => void
  removeCurvePoint: (drawingId: string, index: number) => void
  moveCurve: (drawingId: string, dx: number, dy: number) => void
  /**
   * Variantes "live" de updateCurvePoint/moveCurve: aplicam a mudança no
   * `map` SEM empurrar pra `past` — pensadas pro pointermove de um arrasto
   * de ponto/corpo de Curva, que dispara a cada micro-movimento do mouse.
   * Usar a versão com histórico aí faria cada pixel de arrasto virar uma
   * entrada de undo, exigindo dezenas de Ctrl+Z pra desfazer um gesto só.
   * Ver commitDragHistory abaixo pro outro lado do par.
   */
  updateCurvePointLive: (drawingId: string, index: number, x: number, y: number) => void
  moveCurveLive: (drawingId: string, dx: number, dy: number) => void
  /**
   * Fecha um gesto de arrasto (drag) num único snapshot de undo: `before` é
   * o `map` capturado ANTES do gesto começar (no pointerdown), guardado numa
   * variável local do PixiCanvas. Chamado uma vez no pointerup/pointerupoutside,
   * empurra esse snapshot pro topo de `past` — não o estado atual, que já é o
   * resultado final do arrasto. Não faz nada se `before` for igual (mesma
   * referência) ao `map` atual, ou seja, o gesto não mudou nada de verdade
   * (ex.: clique sem arrasto real).
   */
  commitDragHistory: (before: MapData) => void
  updateLinePoint: (drawingId: string, endpoint: 0 | 1, x: number, y: number) => void
  moveDrawing: (drawingId: string, dx: number, dy: number) => void
  updateTextLabel: (id: string, patch: Partial<{ text: string; color: string; fontSize: number }>) => void
  setTextFontFamily: (id: string, fontFamily: string) => void
  loadMap: (map: MapData) => void
  undo: () => void
  redo: () => void
}

const initialMap = mapFactory.createEmptyMap('map_local', 'Mapa sem título', 30, 20, 64)

/**
 * Comprimento padrão (px de mundo) do vão que a ferramenta "Porta" abre ao
 * clicar em cima de uma parede — metade do tamanho de célula default do grid
 * (64px, ver createEmptyMap acima). Suficiente pra ler como vão de porta na
 * escala usual do grid, sem exigir um arrasto do usuário pra definir tamanho
 * (a ferramenta é de clique único, ver PixiCanvas.tsx).
 */
export const DOOR_LENGTH = 32

export const useMapStore = create<MapStoreState>()(subscribeWithSelector((set, get) => {
  /**
   * Toda action que muda conteúdo do mapa (não estado de UI/ferramenta como
   * activeTool/camera/selection/snapEnabled) passa por aqui: empurra o `map`
   * atual pro topo de `past` antes de aplicar `updater`, e zera `future` —
   * qualquer redo pendente é descartado assim que uma ação nova acontece.
   * Os mapas nunca são mutados in-place (sempre spread novo), então guardar a
   * referência antiga em `past` já basta como snapshot, sem precisar de
   * `structuredClone`.
   */
  const withHistory = (updater: (map: MapData) => MapData) => {
    const prevMap = get().map
    set((state) => ({
      map: updater(prevMap),
      past: [...state.past, prevMap],
      future: [],
    }))
  }

  return {
    map: initialMap,
    past: [],
    future: [],
    camera: { x: 0, y: 0, scale: 1 },
    selection: null,
    activeTool: 'select',
    snapEnabled: false,
    drawColor: '#ffffff',
    drawWidth: 4,
    drawFilled: false,
    drawFontSize: 16,
    drawFontFamily: DEFAULT_TEXT_FONT_FAMILY,
    polygonSides: 6,
    regionFillColor: '#3a7ad0',
    regionFillPattern: 'solid',
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
    setDrawFontFamily: (fontFamily) => set({ drawFontFamily: fontFamily }),
    setPolygonSides: (sides) => set({ polygonSides: sides }),
    addWall: (wall) => withHistory((map) => mapFactory.addWall(map, wall)),
    removeWall: (id) => withHistory((map) => mapFactory.removeWall(map, id)),
    addLight: (light) => withHistory((map) => mapFactory.addLight(map, light)),
    removeLight: (id) => withHistory((map) => mapFactory.removeLight(map, id)),
    addRegion: (region) => withHistory((map) => mapFactory.addRegion(map, region)),
    removeRegion: (id) => withHistory((map) => mapFactory.removeRegion(map, id)),
    addRoom: (region, walls) => withHistory((map) => mapFactory.addRoom(map, region, walls)),
    updateWallPoint: (wallId, endpoint, x, y) => {
      const before = get().map
      const after = mapFactory.updateWallPoint(before, wallId, endpoint, x, y)
      if (after === before) return
      withHistory(() => after)
    },
    moveWall: (wallId, dx, dy) => withHistory((map) => mapFactory.moveWall(map, wallId, dx, dy)),
    updateRegionPoint: (regionId, index, x, y) => withHistory((map) => mapFactory.updateRegionPoint(map, regionId, index, x, y)),
    insertRegionPoint: (regionId, afterEdgeIndex, x, y, newWallId) => withHistory((map) => mapFactory.insertRegionPoint(map, regionId, afterEdgeIndex, x, y, newWallId)),
    removeRegionPoint: (regionId, index) => {
      const before = get().map
      const after = mapFactory.removeRegionPoint(before, regionId, index)
      if (after === before) return
      withHistory(() => after)
    },
    moveRegion: (regionId, dx, dy) => withHistory((map) => mapFactory.moveRegion(map, regionId, dx, dy)),
    linkRegionWalls: (regionId) => {
      const before = get().map
      const after = mapFactory.linkRegionWalls(before, regionId)
      if (after === before) return
      withHistory(() => after)
    },
    smoothRegion: (regionId) => {
      const before = get().map
      const after = mapFactory.smoothRegion(before, regionId)
      if (after === before) return
      withHistory(() => after)
    },
    setRegionFillColor: (color) => set({ regionFillColor: color }),
    setRegionColor: (id, color) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, fillColor: color } : r)),
    })),
    setRegionFillPattern: (pattern) => set({ regionFillPattern: pattern }),
    setRegionPattern: (id, pattern) => withHistory((map) => ({
      ...map,
      regions: map.regions.map((r) => (r.id === id ? { ...r, fillPattern: pattern } : r)),
    })),
    addToken: (token) => withHistory((map) => mapFactory.addToken(map, token)),
    removeToken: (id) => withHistory((map) => mapFactory.removeToken(map, id)),
    setTokenPosition: (id, x, y) => withHistory((map) => mapFactory.setTokenPosition(map, id, x, y)),
    moveToken: (id, targetX, targetY) => {
      const { map } = get()
      const token = map.tokens.find((t) => t.id === id)
      if (!token) return
      const resolved = resolveTokenMove({ x: token.x, y: token.y }, { x: targetX, y: targetY }, map.walls)
      withHistory((m) => mapFactory.setTokenPosition(m, id, resolved.x, resolved.y))
    },
    addProp: (prop) => withHistory((map) => mapFactory.addProp(map, prop)),
    removeProp: (id) => withHistory((map) => mapFactory.removeProp(map, id)),
    moveProp: (id, x, y) => withHistory((map) => mapFactory.setPropPosition(map, id, x, y)),
    addDrawing: (drawing) => withHistory((map) => mapFactory.addDrawing(map, drawing)),
    removeDrawing: (id) => withHistory((map) => mapFactory.removeDrawing(map, id)),
    setShowGrid: (show) => withHistory((map) => mapFactory.setShowGrid(map, show)),
    setGridShape: (shape) => withHistory((map) => mapFactory.setGridShape(map, shape)),
    setBackground: (background) => withHistory((map) => mapFactory.setBackground(map, background)),
    setWallDoor: (id, door) => withHistory((map) => mapFactory.setWallDoor(map, id, door)),
    addDoorOnWall: (wallId, point, doorLength) => withHistory((map) => mapFactory.addDoorOnWall(map, wallId, point, doorLength)),
    setScenarioLink: (value) => withHistory((map) => mapFactory.setScenarioLink(map, value)),
    setPropLinkedPath: (id, path) => withHistory((map) => ({
      ...map,
      props: map.props.map((p) => (p.id === id ? { ...p, linkedMapPath: path } : p)),
    })),
    updateCurvePoint: (drawingId, index, x, y) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p, i) => i === index ? { x, y } : p) } : d,
      ),
    })),
    insertCurvePoint: (drawingId, afterIndex, x, y) => withHistory((map) => mapFactory.insertCurvePoint(map, drawingId, afterIndex, x, y)),
    removeCurvePoint: (drawingId, index) => {
      const before = get().map
      const after = mapFactory.removeCurvePoint(before, drawingId, index)
      if (after === before) return
      withHistory(() => after)
    },
    moveCurve: (drawingId, dx, dy) => withHistory((map) => mapFactory.moveCurve(map, drawingId, dx, dy)),
    updateCurvePointLive: (drawingId, index, x, y) => set((state) => ({
      map: {
        ...state.map,
        drawings: state.map.drawings.map((d) =>
          d.id === drawingId && d.kind === 'curve' ? { ...d, points: d.points.map((p, i) => i === index ? { x, y } : p) } : d,
        ),
      },
    })),
    moveCurveLive: (drawingId, dx, dy) => set((state) => ({ map: mapFactory.moveCurve(state.map, drawingId, dx, dy) })),
    commitDragHistory: (before) => set((state) => (state.map === before ? {} : { past: [...state.past, before], future: [] })),
    updateLinePoint: (drawingId, endpoint, x, y) => {
      const before = get().map
      const after = mapFactory.updateLinePoint(before, drawingId, endpoint, x, y)
      if (after === before) return
      withHistory(() => after)
    },
    moveDrawing: (drawingId, dx, dy) => withHistory((map) => mapFactory.moveDrawing(map, drawingId, dx, dy)),
    updateTextLabel: (id, patch) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === id && d.kind === 'text' ? { ...d, ...patch } : d,
      ),
    })),
    setTextFontFamily: (id, fontFamily) => withHistory((map) => ({
      ...map,
      drawings: map.drawings.map((d) =>
        d.id === id && d.kind === 'text' ? { ...d, fontFamily } : d,
      ),
    })),
    loadMap: (map) => set({ map, selection: null, past: [], future: [] }),
    undo: () => {
      const { past, map } = get()
      if (past.length === 0) return
      const previous = past[past.length - 1]
      set((state) => ({
        map: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, map],
      }))
    },
    redo: () => {
      const { future, map } = get()
      if (future.length === 0) return
      const next = future[future.length - 1]
      set((state) => ({
        map: next,
        future: state.future.slice(0, -1),
        past: [...state.past, map],
      }))
    },
  }
}))
