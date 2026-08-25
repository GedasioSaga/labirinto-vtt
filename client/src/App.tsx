import { PixiCanvas } from './pixi/PixiCanvas'
import { useMapStore } from './stores/mapStore'

function App() {
  const showGrid = useMapStore((state) => state.map.showGrid)
  const setShowGrid = useMapStore((state) => state.setShowGrid)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <PixiCanvas />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          color: '#eee',
          background: '#00000080',
          padding: 8,
          borderRadius: 4,
        }}
      >
        <label>
          <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
          {' '}Mostrar grid
        </label>
      </div>
    </div>
  )
}

export default App
