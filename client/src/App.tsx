import { useEffect, useState } from 'react'
import { PixiCanvas } from './pixi/PixiCanvas'
import { MainMenu } from './screens/MainMenu'
import { MapTypePicker } from './screens/MapTypePicker'
import { NewDungeonMap } from './screens/NewDungeonMap'
import { LoadMapScreen } from './screens/LoadMapScreen'
import { OptionsScreen } from './screens/OptionsScreen'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, saveMapToPath, pickMapJsonToOpen, loadMapFromDisk, mapDirFor, defaultMapsDir } from './lib/mapFileIO'
import { pickBackgroundImage, importBackgroundImage } from './lib/imageImport'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ActionBar } from './components/ActionBar'
import type { MapData, Region } from './types/map'
import type { Screen } from './types/screen'
import { parentScreen } from './lib/navigation'
import * as mapFactory from './lib/mapFactory'

/**
 * Orquestra o estado do editor: liga a store Zustand e o I/O de arquivo aos
 * componentes de interface. Nenhum layout mora aqui além do posicionamento dos
 * painéis sobre o canvas.
 */
function App() {
  const [screen, setScreen] = useState<Screen>('menu')
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
  const drawFontSize = useMapStore((state) => state.drawFontSize)
  const setDrawFontSize = useMapStore((state) => state.setDrawFontSize)
  const drawFontFamily = useMapStore((state) => state.drawFontFamily)
  const setDrawFontFamily = useMapStore((state) => state.setDrawFontFamily)
  const polygonSides = useMapStore((state) => state.polygonSides)
  const setPolygonSides = useMapStore((state) => state.setPolygonSides)
  const regionFillColor = useMapStore((state) => state.regionFillColor)
  const setRegionFillColor = useMapStore((state) => state.setRegionFillColor)
  const setRegionColor = useMapStore((state) => state.setRegionColor)
  const regionFillPattern = useMapStore((state) => state.regionFillPattern)
  const setRegionFillPattern = useMapStore((state) => state.setRegionFillPattern)
  const setRegionPattern = useMapStore((state) => state.setRegionPattern)
  const setWallDoor = useMapStore((state) => state.setWallDoor)
  const setScenarioLink = useMapStore((state) => state.setScenarioLink)
  const updateTextLabel = useMapStore((state) => state.updateTextLabel)
  const setTextFontFamily = useMapStore((state) => state.setTextFontFamily)
  const [previousMapPath, setPreviousMapPath] = useState<string | null>(null)
  /**
   * Caminho de origem do mapa em edição — diferente de `previousMapPath`
   * (pilha de "voltar" entre mapas ligados por portal). `null` enquanto o
   * mapa é novo (ainda não salvo); a partir daí toda escrita vai de volta
   * para esse caminho, em vez de gerar cópia nova em `%APPDATA%`.
   */
  const [currentMapPath, setCurrentMapPath] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Fora do editor a tela nem mostra o mapa — desfazer ali desfaria uma
      // edição em silêncio, sem nenhum feedback visual do que mudou.
      if (screen !== 'editor') return

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return

      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd) return
      const key = event.key.toLowerCase()

      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        useMapStore.getState().redo()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        useMapStore.getState().undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        useMapStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen])

  const selectedWall = selection?.kind === 'wall' ? map.walls.find((w) => w.id === selection.id) ?? null : null
  const selectedProp = selection?.kind === 'prop' ? map.props.find((p) => p.id === selection.id) ?? null : null
  const selectedDrawing = selection?.kind === 'drawing' ? map.drawings.find((d) => d.id === selection.id) ?? null : null
  const selectedTextLabel = selectedDrawing && selectedDrawing.kind === 'text' ? selectedDrawing : null
  const selectedRegion = selection?.kind === 'region' ? map.regions.find((r) => r.id === selection.id) ?? null : null

  const handleRegionColorChange = (color: string) => {
    if (selectedRegion) {
      setRegionColor(selectedRegion.id, color)
      return
    }
    setRegionFillColor(color)
  }

  const handleRegionPatternChange = (pattern: Region['fillPattern']) => {
    if (selectedRegion) {
      setRegionPattern(selectedRegion.id, pattern)
      return
    }
    setRegionFillPattern(pattern)
  }

  const handleToggleDoor = () => {
    if (!selectedWall) return
    setWallDoor(selectedWall.id, selectedWall.door === null ? { open: false, locked: false } : null)
  }

  const handleToggleOpen = () => {
    if (!selectedWall || !selectedWall.door) return
    setWallDoor(selectedWall.id, { ...selectedWall.door, open: !selectedWall.door.open })
  }

  const handleTextChange = (text: string) => {
    if (!selectedTextLabel) return
    updateTextLabel(selectedTextLabel.id, { text })
  }

  const handleTextColorChange = (color: string) => {
    if (!selectedTextLabel) return
    updateTextLabel(selectedTextLabel.id, { color })
  }

  const handleTextFontSizeChange = (fontSize: number) => {
    if (!selectedTextLabel) return
    updateTextLabel(selectedTextLabel.id, { fontSize })
  }

  const handleTextFontFamilyChange = (fontFamily: string) => {
    if (!selectedTextLabel) return
    setTextFontFamily(selectedTextLabel.id, fontFamily)
  }

  const handleCreateLinkedMap = async (propId: string) => {
    const newMap = mapFactory.createEmptyMap(`map_${crypto.randomUUID()}`, 'Andar sem título', map.width, map.height, map.grid)
    const path = await saveMapToAppData(newMap)
    useMapStore.getState().setPropLinkedPath(propId, path)
  }

  const handleLinkExistingMap = async (propId: string) => {
    const path = await pickMapJsonToOpen()
    if (!path) return
    useMapStore.getState().setPropLinkedPath(propId, path)
  }

  /**
   * Salva o mapa em edição de volta na origem (`currentMapPath`) quando ela
   * existe; um mapa novo (`currentMapPath === null`) ainda não tem origem,
   * então cai em `saveMapToAppData` e passa a ter uma a partir daqui.
   * Compartilhado por `handleSave`, `handleGoHome` e `handleEnterLinkedMap` —
   * os três precisam do mesmo "salvar no lugar certo", só o que acontece
   * depois muda (log, trocar de tela, ou seguir pro mapa ligado).
   */
  const persistMap = async (): Promise<string> => {
    if (currentMapPath) {
      await saveMapToPath(map, currentMapPath)
      return currentMapPath
    }
    const path = await saveMapToAppData(map)
    setCurrentMapPath(path)
    return path
  }

  const handleEnterLinkedMap = async (path: string) => {
    const currentPath = await persistMap()
    setPreviousMapPath(currentPath)
    loadMap(await loadMapFromDisk(path))
    setCurrentMapPath(path)
  }

  const handleGoBack = async () => {
    if (!previousMapPath) return
    loadMap(await loadMapFromDisk(previousMapPath))
    setCurrentMapPath(previousMapPath)
    setPreviousMapPath(null)
  }

  const handleAddToken = () => {
    addToken({ id: crypto.randomUUID(), characterId: null, name: 'Token', x: 0, y: 0, size: 1 })
  }

  const handleSave = async () => {
    const path = await persistMap()
    console.log('Mapa salvo em', path)
  }

  /** Roda o mesmo salvamento de `handleSave` e só depois troca para o menu — sem diálogo. */
  const handleGoHome = async () => {
    await persistMap()
    setScreen('menu')
  }

  const handleOpen = async () => {
    const path = await pickMapJsonToOpen()
    if (!path) return
    loadMap(await loadMapFromDisk(path))
    setCurrentMapPath(path)
    setScreen('editor')
  }

  const handleOpenSavedPath = async (path: string) => {
    loadMap(await loadMapFromDisk(path))
    setCurrentMapPath(path)
    setScreen('editor')
  }

  const handleCreate = (newMap: MapData) => {
    loadMap(newMap)
    setCurrentMapPath(null)
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
    const importedPath = await join(await mapDirFor(importedMapId), 'map.json')
    loadMap(await loadMapFromDisk(importedPath))
    // O mapa importado já ganha pasta própria em mapsDir/importedMapId — mesma
    // lógica de "sincronizar currentMapPath com a origem" de handleOpen, senão
    // o próximo Salvar/Início gravaria por engano no caminho do mapa anterior.
    setCurrentMapPath(importedPath)
  }

  if (screen === 'menu') {
    return (
      <MainMenu
        onCreate={() => setScreen('map-type')}
        onLoad={() => setScreen('load-map')}
        onOptions={() => setScreen('options')}
      />
    )
  }

  if (screen === 'map-type') {
    return <MapTypePicker onPickDungeon={() => setScreen('new-dungeon')} onBack={() => setScreen(parentScreen(screen))} />
  }

  if (screen === 'new-dungeon') {
    return <NewDungeonMap onCreate={handleCreate} onBack={() => setScreen(parentScreen(screen))} />
  }

  if (screen === 'load-map') {
    return <LoadMapScreen onOpenPath={handleOpenSavedPath} onBack={() => setScreen(parentScreen(screen))} />
  }

  if (screen === 'options') {
    return <OptionsScreen onBack={() => setScreen(parentScreen(screen))} />
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
            showWidth: activeTool !== 'text',
            fontSize: drawFontSize,
            onFontSizeChange: setDrawFontSize,
            fontFamily: drawFontFamily,
            onFontFamilyChange: setDrawFontFamily,
            showFontSize: activeTool === 'text',
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
          selectedProp={selectedProp}
          portal={{
            onCreateLinkedMap: () => selectedProp && handleCreateLinkedMap(selectedProp.id),
            onLinkExistingMap: () => selectedProp && handleLinkExistingMap(selectedProp.id),
            onEnterLinkedMap: handleEnterLinkedMap,
            onUnlink: () => selectedProp && useMapStore.getState().setPropLinkedPath(selectedProp.id, null),
          }}
          selectedTextLabel={selectedTextLabel}
          textLabel={{
            onTextChange: handleTextChange,
            onColorChange: handleTextColorChange,
            onFontSizeChange: handleTextFontSizeChange,
            onFontFamilyChange: handleTextFontFamilyChange,
          }}
          selectedRegion={selectedRegion}
          regionStyle={{
            color: selectedRegion ? selectedRegion.fillColor : regionFillColor,
            onColorChange: handleRegionColorChange,
            pattern: selectedRegion ? selectedRegion.fillPattern : regionFillPattern,
            onPatternChange: handleRegionPatternChange,
            onLinkWalls: selectedRegion
              ? () => useMapStore.getState().linkRegionWalls(selectedRegion.id)
              : undefined,
            onSmoothRegion: selectedRegion
              ? () => useMapStore.getState().smoothRegion(selectedRegion.id)
              : undefined,
          }}
          polygonSides={{
            sides: polygonSides,
            onSidesChange: setPolygonSides,
          }}
        />
        <ActionBar
          onSave={handleSave}
          onOpen={handleOpen}
          onImportBackground={handleImportBackground}
          onExportFolder={handleExportFolder}
          onImportFolder={handleImportFolder}
          onGoHome={handleGoHome}
          onGoBack={previousMapPath !== null ? handleGoBack : undefined}
        />
      </div>
    </div>
  )
}

export default App
