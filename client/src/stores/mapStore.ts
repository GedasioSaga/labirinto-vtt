import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MapData, Wall, Light, Region, Token } from '../types/map'
import type { Camera } from '../pixi/world'
import * as mapFactory from '../lib/mapFactory'

interface MapStoreState {
  map: MapData
  camera: Camera
  setCamera: (camera: Camera) => void
  addWall: (wall: Wall) => void
  removeWall: (id: string) => void
  addLight: (light: Light) => void
  removeLight: (id: string) => void
  addRegion: (region: Region) => void
  removeRegion: (id: string) => void
  addToken: (token: Token) => void
  removeToken: (id: string) => void
  setTokenPosition: (id: string, x: number, y: number) => void
  setShowGrid: (show: boolean) => void
  setBackground: (background: MapData['background']) => void
  loadMap: (map: MapData) => void
}

const initialMap = mapFactory.createEmptyMap('map_local', 'Mapa sem título', 30, 20, 64)

export const useMapStore = create<MapStoreState>()(subscribeWithSelector((set) => ({
  map: initialMap,
  camera: { x: 0, y: 0, scale: 1 },
  setCamera: (camera) => set({ camera }),
  addWall: (wall) => set((state) => ({ map: mapFactory.addWall(state.map, wall) })),
  removeWall: (id) => set((state) => ({ map: mapFactory.removeWall(state.map, id) })),
  addLight: (light) => set((state) => ({ map: mapFactory.addLight(state.map, light) })),
  removeLight: (id) => set((state) => ({ map: mapFactory.removeLight(state.map, id) })),
  addRegion: (region) => set((state) => ({ map: mapFactory.addRegion(state.map, region) })),
  removeRegion: (id) => set((state) => ({ map: mapFactory.removeRegion(state.map, id) })),
  addToken: (token) => set((state) => ({ map: mapFactory.addToken(state.map, token) })),
  removeToken: (id) => set((state) => ({ map: mapFactory.removeToken(state.map, id) })),
  setTokenPosition: (id, x, y) => set((state) => ({ map: mapFactory.setTokenPosition(state.map, id, x, y) })),
  setShowGrid: (show) => set((state) => ({ map: mapFactory.setShowGrid(state.map, show) })),
  setBackground: (background) => set((state) => ({ map: mapFactory.setBackground(state.map, background) })),
  loadMap: (map) => set({ map }),
})))
