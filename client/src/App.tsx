import { useState } from 'react'
import { PixiCanvas } from './pixi/PixiCanvas'
import { StartScreen } from './StartScreen'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, pickMapJsonToOpen, loadMapFromDisk, mapDirFor, defaultMapsDir } from './lib/mapFileIO'
import { pickBackgroundImage, importBackgroundImage } from './lib/imageImport'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import type { DrawingTool } from './types/tools'
import type { MapData } from './types/map'

const TOOL_LABELS: Record<DrawingTool, string> = {
  select: 'Selecionar',
  wall: 'Parede',
  light: 'Luz',
  region: 'Região',
  prop: 'Peça',
  brush: 'Pincel',
  line: 'Linha',
  circle: 'Círculo',
}

const SELECTION_LABELS: Record<string, string> = {
  token: 'token',
  wall: 'parede',
  light: 'luz',
  region: 'região',
  prop: 'peça',
}

const TOOL_HINTS: Partial<Record<DrawingTool, string>> = {
  wall: 'Clique e arraste para desenhar uma parede.',
  light: 'Clique para colocar uma luz.',
  region: 'Clique para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela.',
  prop: 'Clique no mapa e escolha uma imagem — vira um objeto que pode ser arrastado depois (ferramenta Selecionar).',
}

function App() {
  const [screen, setScreen] = useState<'start' | 'editor'>('start')
  const showGrid = useMapStore((state) => state.map.showGrid)
  const setShowGrid = useMapStore((state) => state.setShowGrid)
  const addToken = useMapStore((state) => state.addToken)
  const map = useMapStore((state) => state.map)
  const loadMap = useMapStore((state) => state.loadMap)
  const setBackground = useMapStore((state) => state.setBackground)
  const activeTool = useMapStore((state) => state.activeTool)
  const setActiveTool = useMapStore((state) => state.setActiveTool)
  const snapEnabled = useMapStore((state) => state.snapEnabled)
  const setSnapEnabled = useMapStore((state) => state.setSnapEnabled)
  const gridShape = useMapStore((state) => state.map.gridShape)
  const setGridShapeAction = useMapStore((state) => state.setGridShape)
  const selection = useMapStore((state) => state.selection)
  const removeSelected = useMapStore((state) => state.removeSelected)

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
    setScreen('editor')
  }

  const handleCreate = (newMap: MapData) => {
    loadMap(newMap)
    setScreen('editor')
  }

  const handleImportBackground = async () => {
    const sourcePath = await pickBackgroundImage()
    if (!sourcePath) return
    const mapDir = await mapDirFor(map.id)
    const destPath = await importBackgroundImage(sourcePath, mapDir)
    setBackground({ type: 'image', src: destPath })
  }

  const handleExportFolder = async () => {
    const destDir = await pickExportFolder()
    if (!destDir) return
    const sourceMapDir = await mapDirFor(map.id)
    await exportMapFolder(map, sourceMapDir, destDir)
    console.log('Mapa exportado em', destDir)
  }

  const handleImportFolder = async () => {
    const sourceDir = await pickImportFolder()
    if (!sourceDir) return
    const mapsDir = await defaultMapsDir()
    const importedMapId = await importMapFolder(sourceDir, mapsDir)
    loadMap(await loadMapFromDisk(await join(await mapDirFor(importedMapId), 'map.json')))
  }

  if (screen === 'start') {
    return <StartScreen onCreate={handleCreate} onOpen={handleOpen} />
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
          maxWidth: 220,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(TOOL_LABELS) as DrawingTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => setActiveTool(tool)}
              style={{
                fontWeight: activeTool === tool ? 'bold' : 'normal',
                outline: activeTool === tool ? '2px solid #ffdd55' : 'none',
              }}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
        {TOOL_HINTS[activeTool] && (
          <span style={{ fontSize: 12, opacity: 0.85 }}>{TOOL_HINTS[activeTool]}</span>
        )}
        <label>
          <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
          {' '}Mostrar grid
        </label>
        <label>
          Formato do grid:{' '}
          <select value={gridShape} onChange={(event) => setGridShapeAction(event.target.value as 'square' | 'hex')}>
            <option value="square">Quadrado</option>
            <option value="hex">Hexágono</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />
          {' '}Travar na grade
        </label>
        <button type="button" onClick={handleAddToken}>Adicionar token</button>
        <button type="button" onClick={removeSelected} disabled={!selection}>
          {selection ? `Apagar ${SELECTION_LABELS[selection.kind]} selecionada(o)` : 'Nada selecionado'}
        </button>
        <button type="button" onClick={handleSave}>Salvar</button>
        <button type="button" onClick={handleOpen}>Abrir...</button>
        <button type="button" onClick={handleImportBackground}>Importar imagem de fundo</button>
        <button type="button" onClick={handleExportFolder}>Exportar mapa (pasta)</button>
        <button type="button" onClick={handleImportFolder}>Importar mapa (pasta)</button>
        <button type="button" onClick={() => setScreen('start')}>Início</button>
      </div>
    </div>
  )
}

export default App
