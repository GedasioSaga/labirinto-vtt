import { PixiCanvas } from './pixi/PixiCanvas'
import { useMapStore } from './stores/mapStore'

function App() {
  const showGrid = useMapStore((state) => state.map.showGrid)
  const setShowGrid = useMapStore((state) => state.setShowGrid)
  const addToken = useMapStore((state) => state.addToken)

  const handleAddToken = () => {
    addToken({
      id: crypto.randomUUID(),
      characterId: null,
      name: 'Token',
      x: 0,
      y: 0,
      size: 1,
    })
  }

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
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <label>
          <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
          {' '}Mostrar grid
        </label>
        <button type="button" onClick={handleAddToken}>Adicionar token</button>
      </div>
    </div>
  )
}

export default App
