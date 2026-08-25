import { PixiCanvas } from './pixi/PixiCanvas'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, pickMapJsonToOpen, loadMapFromDisk } from './lib/mapFileIO'

function App() {
  const showGrid = useMapStore((state) => state.map.showGrid)
  const setShowGrid = useMapStore((state) => state.setShowGrid)
  const addToken = useMapStore((state) => state.addToken)
  const map = useMapStore((state) => state.map)
  const loadMap = useMapStore((state) => state.loadMap)

  const handleAddToken = () => {
    addToken({ id: crypto.randomUUID(), characterId: null, name: 'Token', x: 0, y: 0, size: 1 })
  }

  const handleSave = async () => {
    const path = await saveMapToAppData(map)
    console.log('Mapa salvo em', path)
  }

  const handleOpen = async () => {
    const path = await pickMapJsonToOpen()
    if (!path) return
    loadMap(await loadMapFromDisk(path))
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
        <button type="button" onClick={handleSave}>Salvar</button>
        <button type="button" onClick={handleOpen}>Abrir...</button>
      </div>
    </div>
  )
}

export default App
