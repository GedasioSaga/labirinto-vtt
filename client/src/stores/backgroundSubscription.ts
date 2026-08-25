import { useMapStore } from './mapStore'

export function subscribeToBackgroundRedraw(onChange: () => void): () => void {
  return useMapStore.subscribe((state) => state.map.background, onChange)
}
