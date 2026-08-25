import { useState } from 'react'
import { PixiCanvas } from './pixi/PixiCanvas'
import { StartScreen } from './StartScreen'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, pickMapJsonToOpen, loadMapFromDisk, mapDirFor, defaultMapsDir } from './lib/mapFileIO'
import { pickBackgroundImage, importBackgroundImage } from './lib/imageImport'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ActionBar } from './components/ActionBar'
import type { MapData } from './types/map'

/**
 * Orquestra o estado do editor: liga a store Zustand e o I/O de arquivo aos
 * componentes de interface. Nenhum layout mora aqui além do posicionamento dos
 * painéis sobre o canvas.
 */
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
  const drawColor = useMapStore((state) => state.drawColor)
  const setDrawColor = useMapStore((state) => state.setDrawColor)
  const drawWidth = useMapStore((state) => state.drawWidth)
  const setDrawWidth = useMapStore((state) => state.setDrawWidth)
  const drawFilled = useMapStore((state) => state.drawFilled)
  const setDrawFilled = useMapStore((state) => state.setDrawFilled)
  const setWallDoor = useMapStore((state) => state.setWallDoor)
  const setScenarioLink = useMapStore((state) => state.setScenarioLink)

  const selectedWall = selection?.kind === 'wall' ? map.walls.find((w) => w.id === selection.id) ?? null : null

  const handleToggleDoor = () => {
    if (!selectedWall) return
    setWallDoor(selectedWall.id, selectedWall.door === null ? { open: false, locked: false } : null)
  }

  const handleToggleOpen = () => {
    if (!selectedWall || !selectedWall.door) return
    setWallDoor(selectedWall.id, { ...selectedWall.door, open: !selectedWall.door.open })
  }

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
    <div className="lb-editor">
      <div className="lb-editor__canvas">
        <PixiCanvas />
      </div>

      <div className="lb-editor__top">
        <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />
      </div>

      <div className="lb-editor__rail">
        <PropertiesPanel
          mapName={map.name}
          mapWidth={map.width}
          mapHeight={map.height}
          mapGrid={map.grid}
          activeTool={activeTool}
          drawingStyle={{
            color: drawColor,
            onColorChange: setDrawColor,
            width: drawWidth,
            onWidthChange: setDrawWidth,
            filled: drawFilled,
            onFilledChange: setDrawFilled,
            showFilled: activeTool === 'circle',
          }}
          grid={{
            showGrid,
            onShowGridChange: setShowGrid,
            gridShape,
            onGridShapeChange: setGridShapeAction,
            snapEnabled,
            onSnapEnabledChange: setSnapEnabled,
          }}
          selection={{
            selection,
            onAddToken: handleAddToken,
            onRemoveSelected: removeSelected,
          }}
          scenarioLink={{
            scenarioLink: map.scenarioLink,
            onScenarioLinkChange: setScenarioLink,
          }}
          selectedWall={selectedWall}
          wallDoor={{
            onToggleDoor: handleToggleDoor,
            onToggleOpen: handleToggleOpen,
          }}
        />
        <ActionBar
          onSave={handleSave}
          onOpen={handleOpen}
          onImportBackground={handleImportBackground}
          onExportFolder={handleExportFolder}
          onImportFolder={handleImportFolder}
          onGoHome={() => setScreen('start')}
        />
      </div>
    </div>
  )
}

export default App
