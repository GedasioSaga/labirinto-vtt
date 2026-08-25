import { create } from 'zustand'

export interface Camera {
  x: number
  y: number
  scale: number
}

interface MapStoreState {
  camera: Camera
  setCamera: (camera: Camera) => void
}

export const useMapStore = create<MapStoreState>((set) => ({
  camera: { x: 0, y: 0, scale: 1 },
  setCamera: (camera) => set({ camera }),
}))
