import { useEffect, useRef, useState } from 'react'
import { PixiCanvas } from './pixi/PixiCanvas'
import { ZoomHud } from './components/ZoomHud'
import { Toast } from './components/Toast'
import { useToastStore } from './stores/toastStore'
import { useSessionStore, subscribeToDirtyFlag } from './stores/sessionStore'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from '@tauri-apps/api/core'
import { ask } from '@tauri-apps/plugin-dialog'
import type { Camera } from './pixi/world'
import { MainMenu } from './screens/MainMenu'
import { MapTypePicker } from './screens/MapTypePicker'
import { NewDungeonMap } from './screens/NewDungeonMap'
import { LoadMapScreen } from './screens/LoadMapScreen'
import { OptionsScreen } from './screens/OptionsScreen'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, saveMapToPath, pickMapJsonToOpen, loadMapFromDisk, mapDirFor, defaultMapsDir } from './lib/mapFileIO'
import { pickBackgroundImage, importBackgroundImage, pickImageFile, importTokenImage } from './lib/imageImport'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ActionBar } from './components/ActionBar'
import type { DoorKind, DrawingCap, MapData, Region, Wall } from './types/map'
import type { Screen } from './types/screen'
import { parentScreen } from './lib/navigation'
import * as mapFactory from './lib/mapFactory'
import { countEntitiesByLayer } from './lib/layers'
import { roomDimensions } from './lib/roomOps'
import type { GridAlignResult } from './lib/gridAlign'
import { relevantPropertyGroups } from './lib/toolProperties'
import { EMPTY_SELECTION, selectionSingle, selectionToAreaSelection } from './lib/selectionModel'

/**
 * Onda 2, item 12 (Frente A) — empurra um toast de erro padronizado pros
 * handlers de arquivo (abrir/salvar/importar/exportar). `action` é a
 * descrição no infinitivo do que falhou ("salvar o mapa", "importar a
 * imagem") — vira `Não foi possível <action>: <mensagem>`. Módulo-escopo
 * (não precisa de hook) porque só chama `useToastStore.getState().push`,
 * mesmo padrão que o próprio CONTRATO da Frente A já usa fora de componente.
 */
function reportFileError(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  useToastStore.getState().push('error', `Não foi possível ${action}: ${message}`)
}

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
  const snapTargets = useMapStore((state) => state.snapTargets)
  const setSnapTarget = useMapStore((state) => state.setSnapTarget)
  const setGridSettings = useMapStore((state) => state.setGridSettings)
  const gridShape = useMapStore((state) => state.map.gridShape)
  const setGridShapeAction = useMapStore((state) => state.setGridShape)
  const selection = useMapStore((state) => state.selection)
  const setSelection = useMapStore((state) => state.setSelection)
  const removeSelected = useMapStore((state) => state.removeSelected)
  // Onda 3, item 20 (Frente D) — histórico deixa de ser invisível: botões
  // de desfazer/refazer na ActionBar, desabilitados com past/future vazio.
  const canUndo = useMapStore((state) => state.past.length > 0)
  const canRedo = useMapStore((state) => state.future.length > 0)
  const undo = useMapStore((state) => state.undo)
  const redo = useMapStore((state) => state.redo)
  const drawColor = useMapStore((state) => state.drawColor)
  const setDrawColor = useMapStore((state) => state.setDrawColor)
  const drawWidth = useMapStore((state) => state.drawWidth)
  const setDrawWidth = useMapStore((state) => state.setDrawWidth)
  const drawFilled = useMapStore((state) => state.drawFilled)
  const setDrawFilled = useMapStore((state) => state.setDrawFilled)
  const drawFillAlpha = useMapStore((state) => state.drawFillAlpha)
  const setDrawFillAlpha = useMapStore((state) => state.setDrawFillAlpha)
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
  const setDoorLocked = useMapStore((state) => state.setDoorLocked)
  const doorKind = useMapStore((state) => state.doorKind)
  const setDoorKind = useMapStore((state) => state.setDoorKind)
  const setWallDoorKind = useMapStore((state) => state.setWallDoorKind)
  const wallKind = useMapStore((state) => state.wallKind)
  const setWallKind = useMapStore((state) => state.setWallKind)
  const wallThickness = useMapStore((state) => state.wallThickness)
  const setWallThickness = useMapStore((state) => state.setWallThickness)
  const setWallThicknessForWall = useMapStore((state) => state.setWallThicknessForWall)
  const wallLineStyle = useMapStore((state) => state.wallLineStyle)
  const setWallLineStyle = useMapStore((state) => state.setWallLineStyle)
  const setWallLineStyleForWall = useMapStore((state) => state.setWallLineStyleForWall)
  const regionStrokeWidth = useMapStore((state) => state.regionStrokeWidth)
  const setRegionStrokeWidth = useMapStore((state) => state.setRegionStrokeWidth)
  const regionStrokeJoin = useMapStore((state) => state.regionStrokeJoin)
  const setRegionStrokeJoin = useMapStore((state) => state.setRegionStrokeJoin)
  const setRegionStrokeJoinForRegion = useMapStore((state) => state.setRegionStrokeJoinForRegion)
  const setWallKindForWall = useMapStore((state) => state.setWallKindForWall)
  const toggleLayerVisibility = useMapStore((state) => state.toggleLayerVisibility)
  // Onda 4, Frente D (camadas) — trava de camada + seletor "camada do Prop
  // selecionado" (setPropLayer já existia órfão desde a Fase 1).
  const toggleLayerLock = useMapStore((state) => state.toggleLayerLock)
  const setPropLayer = useMapStore((state) => state.setPropLayer)
  const updateLight = useMapStore((state) => state.updateLight)
  const setTokenImage = useMapStore((state) => state.setTokenImage)
  const updateToken = useMapStore((state) => state.updateToken)
  const updateProp = useMapStore((state) => state.updateProp)
  const setGridOffset = useMapStore((state) => state.setGridOffset)
  const setGridCellSize = useMapStore((state) => state.setGridCellSize)
  const setStairDirection = useMapStore((state) => state.setStairDirection)
  const setRoomName = useMapStore((state) => state.setRoomName)
  const resizeRoomDimensions = useMapStore((state) => state.resizeRoomDimensions)
  const setMapScale = useMapStore((state) => state.setMapScale)
  const setMeasurementMode = useMapStore((state) => state.setMeasurementMode)
  const setScenarioLink = useMapStore((state) => state.setScenarioLink)
  const updateTextLabel = useMapStore((state) => state.updateTextLabel)
  const setTextFontFamily = useMapStore((state) => state.setTextFontFamily)
  // Onda 4, item 24 (Frente C + integrador) — `areaSelection` como campo
  // separado do store sumiu: o grupo (N3, "ferramenta de seleção de área")
  // e o item único agora são o MESMO `selection` (SelectionSet). O resumo
  // "N itens selecionados" (AreaSelectionControls) é derivado abaixo, na
  // hora de montar as props do painel, via `selectionToAreaSelection`.
  // Fase 4 — N2/B2 "ponta da linha" (preferência da PRÓXIMA forma com traço)
  // e "dobrar a linha" (converter uma line selecionada em curve).
  const drawCap = useMapStore((state) => state.drawCap)
  const setDrawCap = useMapStore((state) => state.setDrawCap)
  const setDrawingCap = useMapStore((state) => state.setDrawingCap)
  const convertDrawingToCurve = useMapStore((state) => state.convertDrawingToCurve)
  const convertDrawingToLine = useMapStore((state) => state.convertDrawingToLine)
  // Fase 5 — N1 "setinha de variantes": os 3 eixos que faltavam
  // (pincel/borracha/escada), mesma classe de drawCap/wallKind/doorKind acima.
  const drawTexture = useMapStore((state) => state.drawTexture)
  const setDrawTexture = useMapStore((state) => state.setDrawTexture)
  const eraseMode = useMapStore((state) => state.eraseMode)
  const setEraseMode = useMapStore((state) => state.setEraseMode)
  const stairSizePreset = useMapStore((state) => state.stairSizePreset)
  const setStairSizePreset = useMapStore((state) => state.setStairSizePreset)
  const setStairStepWidthForStair = useMapStore((state) => state.setStairStepWidthForStair)
  // Fase 4 — N2 "tirar o fundo" (Região/Sala) e edição de fillAlpha/filled de
  // uma forma preenchível JÁ SELECIONADA (as actions já existiam órfãs, sem
  // nenhuma UI usando — ver dossiê F4).
  const regionFillEnabled = useMapStore((state) => state.regionFillEnabled)
  const setRegionFillEnabled = useMapStore((state) => state.setRegionFillEnabled)
  const setRegionFilled = useMapStore((state) => state.setRegionFilled)
  const setDrawingFilled = useMapStore((state) => state.setDrawingFilled)
  // Onda 2, item 12 (Frente A) — pilha de avisos (erro/info).
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismiss)
  const [previousMapPath, setPreviousMapPath] = useState<string | null>(null)
  /**
   * Caminho de origem do mapa em edição — diferente de `previousMapPath`
   * (pilha de "voltar" entre mapas ligados por portal). `null` enquanto o
   * mapa é novo (ainda não salvo); a partir daí toda escrita vai de volta
   * para esse caminho, em vez de gerar cópia nova em `%APPDATA%`.
   */
  const [currentMapPath, setCurrentMapPath] = useState<string | null>(null)
  /**
   * Prévia AO VIVO (ainda não aplicada) de "Alinhar grade à imagem" (F3,
   * agente C5) — repassada pra `<PixiCanvas>` desenhar o overlay ciano por
   * cima da imagem. `null` fora do painel/sem prévia ativa.
   */
  const [gridAlignPreview, setGridAlignPreview] = useState<GridAlignResult | null>(null)
  /**
   * Dimensões NATURAIS (px) da textura de fundo carregada — reportadas por
   * `<PixiCanvas>` depois que `Assets.load` resolve dentro de
   * `redrawBackground`. `GridAlignControls` precisa disto pra derivar
   * `cellSize` a partir de colunas/linhas contadas na imagem; sem imagem
   * (ou antes de carregar) fica `null` e o painel mostra o estado vazio.
   */
  const [backgroundImageSize, setBackgroundImageSize] = useState<{ width: number; height: number } | null>(null)
  /**
   * Onda 1, item 10 (HUD de zoom) — `scale` da câmera, atualizado a cada
   * `onCameraChange` de `<PixiCanvas>` (pan/zoom/roda/atalho/fit). `1` é o
   * mesmo default de `camera` em `stores/mapStore.ts`.
   */
  const [cameraScale, setCameraScale] = useState(1)
  /**
   * Contador que dispara o reset de zoom DENTRO da closure de `PixiCanvas`
   * (ver `resetZoomRequest` na prop e `resetZoomRequestRef` lá) — incrementa
   * a cada clique no ZoomHud ou Ctrl+0. O valor em si não importa, só a
   * MUDANÇA (mesmo padrão que `gridAlignPreview` já usa como ponte).
   */
  const [resetZoomRequest, setResetZoomRequest] = useState(0)

  /**
   * Onda 1, item 4 do plano — sliders de propriedade (intensidade de luz,
   * opacidade de preenchimento, espessura de contorno de região) viram
   * `*Live` (sem histórico) a cada `onChange`, com UM `commitDragHistory` ao
   * fim do gesto — mesmo resultado pro usuário de `moveTokenLive`+
   * `commitDragHistory` no canvas (item 3): 40 arrastos de slider = 1
   * Ctrl+Z, não 40.
   *
   * DIFERENÇA do canvas: lá o fim do gesto é `pointerup`, direto na
   * `Application` do Pixi. Aqui os controles do slider
   * (`LightControls`/`DrawingStyleControls`/`RegionStyleControls`) estão
   * FORA da lista de arquivos desta integração (só `App.tsx`/`mapStore.ts`/
   * `PixiCanvas.tsx`/`labels.ts`/`Toolbar.tsx` — ver plano) e não expõem
   * `onPointerUp` separado do `onChange` do `<input type="range">`. Sem
   * poder tocar esses arquivos, o fim do gesto é detectado por INATIVIDADE
   * (debounce): passado `SLIDER_COMMIT_DEBOUNCE_MS` sem outro `onChange`, o
   * gesto é considerado encerrado e commita. Efeito prático idêntico pro
   * usuário; só o GATILHO do commit muda de "soltei o mouse" pra "parei de
   * mexer".
   */
  const SLIDER_COMMIT_DEBOUNCE_MS = 400
  const sliderDragBefore = useRef<Map<string, MapData>>(new Map())
  const sliderCommitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const liveSliderChange = (key: string, applyLive: () => void) => {
    if (!sliderCommitTimers.current.has(key)) {
      sliderDragBefore.current.set(key, useMapStore.getState().map)
    } else {
      clearTimeout(sliderCommitTimers.current.get(key))
    }
    applyLive()
    const timer = setTimeout(() => {
      const before = sliderDragBefore.current.get(key)
      sliderCommitTimers.current.delete(key)
      sliderDragBefore.current.delete(key)
      if (before) useMapStore.getState().commitDragHistory(before)
    }, SLIDER_COMMIT_DEBOUNCE_MS)
    sliderCommitTimers.current.set(key, timer)
  }

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

  // Onda 2, item 11 (Frente D) — liga a flag "tem alteração não salva".
  useEffect(() => subscribeToDirtyFlag(), [])

  /**
   * Avisa antes de fechar a janela (X, Alt+F4, taskbar) se houver edição não
   * salva — item 11 (Frente D), com UM desvio deliberado do CONTRATO da
   * frente (ver relatório do integrador): `getCurrentWindow()` lê
   * `window.__TAURI_INTERNALS__.metadata` de forma SÍNCRONA e lança
   * `TypeError` fora do webview real — e este app roda a suíte inteira de
   * e2e (111 specs) contra um `vite` puro no browser, sem essa ponte (ver
   * `pixi/tokensRenderer.ts:142`, mesma condição já documentada para
   * `convertFileSrc`). Sem o guard `isTauri()`, TODO teste que monta a tela
   * 'editor' quebraria neste efeito — exatamente a "janela travada" que a
   * regra de segurança deste item pede pra evitar, só que na CI em vez do
   * usuário. Fora do Tauri real, o efeito não faz nada (sem aviso, sem
   * risco) — dentro dele, o comportamento é o do CONTRATO original.
   */
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (!useSessionStore.getState().isDirty) return
        event.preventDefault()
        // Timeout de segurança: se o diálogo nativo nunca resolver (ou
        // `ask` falhar), fecha mesmo assim — travar a janela do usuário é
        // pior que perguntar de novo na próxima tentativa.
        const confirmed = await Promise.race([
          ask('Há alterações não salvas neste mapa. Fechar mesmo assim?', { title: 'Labirinto', kind: 'warning' }).catch(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10_000)),
        ])
        if (confirmed) await getCurrentWindow().destroy()
      })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  // Onda 4, item 24 — `selection` virou SelectionSet (conjunto). Os painéis
  // de propriedade abaixo são todos de UM item (editar propriedade de vários
  // objetos heterogêneos ao mesmo tempo não é o escopo deste item do plano),
  // então `selectionSingle` é a borda: `null` tanto pra "nada selecionado"
  // quanto pra "vários selecionados" — mesmo contrato de antes pro caso de
  // 1 item, novo estado (painel de propriedade De 1 item some) só quando há
  // 2+ selecionados.
  const singleSelection = selectionSingle(selection)
  const selectedWall = singleSelection?.kind === 'wall' ? map.walls.find((w) => w.id === singleSelection.id) ?? null : null
  const selectedProp = singleSelection?.kind === 'prop' ? map.props.find((p) => p.id === singleSelection.id) ?? null : null
  const selectedToken = singleSelection?.kind === 'token' ? map.tokens.find((t) => t.id === singleSelection.id) ?? null : null
  const selectedDrawing = singleSelection?.kind === 'drawing' ? map.drawings.find((d) => d.id === singleSelection.id) ?? null : null
  const selectedTextLabel = selectedDrawing && selectedDrawing.kind === 'text' ? selectedDrawing : null
  const selectedRegion = singleSelection?.kind === 'region' ? map.regions.find((r) => r.id === singleSelection.id) ?? null : null
  const selectedLight = singleSelection?.kind === 'light' ? map.lights.find((l) => l.id === singleSelection.id) ?? null : null
  const selectedStair = singleSelection?.kind === 'stair' ? map.stairs.find((s) => s.id === singleSelection.id) ?? null : null

  // Fase 4 (integrador I8) — N2 "painel contextual": quais seções do painel
  // esquerdo são relevantes agora, dado a ferramenta ativa e o que está
  // selecionado. Substitui os `show*` booleanos espalhados que existiam antes
  // desta fase (dossiê F4: Grade/Medição/Alinhar grade/Camadas/Cenário
  // renderizavam SEMPRE, empurrando Medição pra fora da viewport).
  const propertyGroups = relevantPropertyGroups(activeTool, {
    wall: selectedWall !== null,
    wallHasDoor: selectedWall?.door != null,
    prop: selectedProp !== null,
    token: selectedToken !== null,
    textLabel: selectedTextLabel !== null,
    region: selectedRegion !== null,
    regionIsRoom: selectedRegion?.room !== undefined,
    light: selectedLight !== null,
    stair: selectedStair !== null,
    drawingKind: selectedDrawing && selectedDrawing.kind !== 'text' ? selectedDrawing.kind : null,
  })

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
    setWallDoor(selectedWall.id, selectedWall.door === null ? { open: false, locked: false, kind: 'normal' } : null)
  }

  const handleToggleOpen = () => {
    if (!selectedWall || !selectedWall.door) return
    setWallDoor(selectedWall.id, { ...selectedWall.door, open: !selectedWall.door.open })
  }

  const handleToggleLocked = () => {
    if (!selectedWall || !selectedWall.door) return
    setDoorLocked(selectedWall.id, !selectedWall.door.locked)
  }

  /**
   * Com uma parede-porta selecionada, o seletor de tipo edita ELA (com
   * histórico, via setWallDoorKind). Sem porta selecionada — ferramenta
   * Porta ativa —, edita a preferência da PRÓXIMA porta (sem histórico, via
   * setDoorKind). Mesmo padrão de handleWallKindChange logo abaixo.
   */
  const handleDoorKindChange = (kind: DoorKind) => {
    if (selectedWall?.door) {
      setWallDoorKind(selectedWall.id, kind)
      return
    }
    setDoorKind(kind)
  }

  /**
   * Com uma parede selecionada, o toggle edita ELA (com histórico, via
   * setWallKindForWall). Sem seleção — ferramenta Parede ativa —, edita a
   * preferência da PRÓXIMA parede (sem histórico, via setWallKind). Mesmo
   * padrão de handleRegionColorChange/handleRegionPatternChange acima.
   */
  const handleWallKindChange = (kind: NonNullable<Wall['wallKind']>) => {
    if (selectedWall) {
      setWallKindForWall(selectedWall.id, kind)
      return
    }
    setWallKind(kind)
  }

  /** Espessura e acabamento de ponta seguem exatamente a regra de `wallKind`
   *  acima: com parede selecionada editam ELA (com histórico); sem seleção,
   *  editam a preferência da PRÓXIMA parede (sem histórico). */
  const handleWallThicknessChange = (thickness: NonNullable<Wall['thickness']>) => {
    if (selectedWall) {
      setWallThicknessForWall(selectedWall.id, thickness)
      return
    }
    setWallThickness(thickness)
  }

  const handleWallLineStyleChange = (lineStyle: NonNullable<Wall['lineStyle']>) => {
    if (selectedWall) {
      setWallLineStyleForWall(selectedWall.id, lineStyle)
      return
    }
    setWallLineStyle(lineStyle)
  }

  const handleRegionStrokeWidthChange = (strokeWidth: number) => {
    if (selectedRegion) {
      // Onda 1, item 4 — ver liveSliderChange acima.
      liveSliderChange(`region-stroke-${selectedRegion.id}`, () =>
        useMapStore.getState().setRegionStrokeWidthForRegionLive(selectedRegion.id, strokeWidth),
      )
      return
    }
    setRegionStrokeWidth(strokeWidth)
  }

  const handleRegionStrokeJoinChange = (strokeJoin: 'round' | 'miter') => {
    if (selectedRegion) {
      setRegionStrokeJoinForRegion(selectedRegion.id, strokeJoin)
      return
    }
    setRegionStrokeJoin(strokeJoin)
  }

  const handleChangeTokenImage = async (tokenId: string) => {
    try {
      const sourcePath = await pickImageFile()
      if (!sourcePath) return
      const mapDir = await mapDirFor(map.id)
      const imported = await importTokenImage(sourcePath, mapDir, tokenId)
      setTokenImage(tokenId, imported.destPath)
    } catch (err) {
      reportFileError('trocar a imagem do token', err)
    }
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
    try {
      const newMap = mapFactory.createEmptyMap(`map_${crypto.randomUUID()}`, 'Andar sem título', map.width, map.height, map.grid)
      const path = await saveMapToAppData(newMap)
      useMapStore.getState().setPropLinkedPath(propId, path)
    } catch (err) {
      reportFileError('criar o mapa ligado', err)
    }
  }

  const handleLinkExistingMap = async (propId: string) => {
    try {
      const path = await pickMapJsonToOpen()
      if (!path) return
      useMapStore.getState().setPropLinkedPath(propId, path)
    } catch (err) {
      reportFileError('ligar o mapa existente', err)
    }
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
    try {
      const currentPath = await persistMap()
      setPreviousMapPath(currentPath)
      loadMap(await loadMapFromDisk(path))
      setCurrentMapPath(path)
      // Onda 2, item 11 (Frente D) — os dois mapas envolvidos acabaram de
      // sincronizar com o disco (o de origem por persistMap, o de destino
      // por já vir de loadMapFromDisk).
      useSessionStore.getState().markSaved()
    } catch (err) {
      reportFileError('entrar no mapa ligado', err)
    }
  }

  const handleGoBack = async () => {
    if (!previousMapPath) return
    try {
      loadMap(await loadMapFromDisk(previousMapPath))
      setCurrentMapPath(previousMapPath)
      setPreviousMapPath(null)
      useSessionStore.getState().markSaved()
    } catch (err) {
      reportFileError('voltar para o mapa anterior', err)
    }
  }

  const handleAddToken = () => {
    addToken({ id: crypto.randomUUID(), characterId: null, name: 'Token', x: 0, y: 0, size: 1, image: null })
  }

  const handleSave = async () => {
    try {
      const path = await persistMap()
      useSessionStore.getState().markSaved()
      console.log('Mapa salvo em', path)
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  /**
   * Onda 2, item 11 (Frente D) — Ctrl+S salva sem diálogo, só no editor.
   * `handleSave` entra nas deps (não memoizado) de propósito: ele fecha
   * sobre `currentMapPath`/`map` via `persistMap`, então uma dep desatualizada
   * salvaria no caminho ou conteúdo ERRADO — o mesmo cuidado que o app já
   * toma em `pixi/PixiCanvas.tsx` lendo `useMapStore.getState()` fresco a
   * cada gesto, só que aqui via dependência do efeito (currentMapPath/map
   * não vivem na store do Zustand, são `useState` deste componente).
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== 'editor') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void handleSave()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, handleSave])

  /** Roda o mesmo salvamento de `handleSave` e só depois troca para o menu — sem diálogo. */
  const handleGoHome = async () => {
    try {
      await persistMap()
      useSessionStore.getState().markSaved()
      setScreen('menu')
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  const handleOpen = async () => {
    try {
      const path = await pickMapJsonToOpen()
      if (!path) return
      loadMap(await loadMapFromDisk(path))
      setCurrentMapPath(path)
      useSessionStore.getState().markSaved()
      setScreen('editor')
    } catch (err) {
      reportFileError('abrir o mapa', err)
    }
  }

  const handleOpenSavedPath = async (path: string) => {
    try {
      loadMap(await loadMapFromDisk(path))
      setCurrentMapPath(path)
      useSessionStore.getState().markSaved()
      setScreen('editor')
    } catch (err) {
      reportFileError('abrir o mapa', err)
    }
  }

  const handleCreate = (newMap: MapData) => {
    loadMap(newMap)
    setCurrentMapPath(null)
    // Onda 2, item 11 (Frente D) — mapa recém-criado, sem edição nenhuma
    // ainda: não conta como "trabalho não salvo" (decisão de produto
    // documentada no CONTRATO da frente).
    useSessionStore.getState().markSaved()
    setScreen('editor')
  }

  const handleImportBackground = async () => {
    try {
      const sourcePath = await pickBackgroundImage()
      if (!sourcePath) return
      const mapDir = await mapDirFor(map.id)
      const destPath = await importBackgroundImage(sourcePath, mapDir)
      setBackground({ type: 'image', src: destPath })
    } catch (err) {
      reportFileError('importar a imagem de fundo', err)
    }
  }

  const handleExportFolder = async () => {
    try {
      const destDir = await pickExportFolder()
      if (!destDir) return
      const sourceMapDir = await mapDirFor(map.id)
      await exportMapFolder(map, sourceMapDir, destDir)
      console.log('Mapa exportado em', destDir)
    } catch (err) {
      reportFileError('exportar o mapa', err)
    }
  }

  const handleImportFolder = async () => {
    try {
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
      useSessionStore.getState().markSaved()
    } catch (err) {
      reportFileError('importar a pasta do mapa', err)
    }
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
        <PixiCanvas
          gridAlignPreview={gridAlignPreview}
          onBackgroundImageSizeChange={setBackgroundImageSize}
          onCameraChange={(camera: Camera) => setCameraScale(camera.scale)}
          resetZoomRequest={resetZoomRequest}
        />
      </div>

      <div className="lb-editor__top">
        <Toolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          variantBindings={{
            doorKind: { value: doorKind, onChange: setDoorKind },
            wallKind: { value: wallKind, onChange: setWallKind },
            regionFillPattern: { value: regionFillPattern, onChange: setRegionFillPattern },
            polygonSides: { value: polygonSides, onChange: setPolygonSides },
            stairSizePreset: { value: stairSizePreset, onChange: setStairSizePreset },
            drawTexture: { value: drawTexture, onChange: setDrawTexture },
            eraseMode: { value: eraseMode, onChange: setEraseMode },
          }}
        />
      </div>

      <div className="lb-editor__rail">
        <PropertiesPanel
          mapName={map.name}
          mapWidth={map.width}
          mapHeight={map.height}
          mapGrid={map.grid}
          activeTool={activeTool}
          groups={propertyGroups}
          lineCap={
            activeTool === 'brush' || activeTool === 'line' || activeTool === 'curve'
              ? { cap: drawCap, onCapChange: setDrawCap }
              : selectedDrawing && 'cap' in selectedDrawing
                ? { cap: selectedDrawing.cap ?? 'round', onCapChange: (cap: DrawingCap) => setDrawingCap(selectedDrawing.id, cap) }
                : null
          }
          lineShape={
            selectedDrawing?.kind === 'line'
              ? { kind: 'line', onConvertToCurve: () => convertDrawingToCurve(selectedDrawing.id), onConvertToLine: null }
              : selectedDrawing?.kind === 'curve'
                ? {
                    kind: 'curve',
                    onConvertToCurve: () => convertDrawingToCurve(selectedDrawing.id),
                    onConvertToLine: selectedDrawing.points.length === 2 ? () => convertDrawingToLine(selectedDrawing.id) : null,
                  }
                : null
          }
          fill={
            selectedRegion
              ? { filled: selectedRegion.filled ?? true, onFilledChange: (f: boolean) => setRegionFilled(selectedRegion.id, f) }
              : selectedDrawing && 'filled' in selectedDrawing
                ? {
                    filled: selectedDrawing.filled,
                    onFilledChange: (f: boolean) => setDrawingFilled(selectedDrawing.id, f),
                    fillAlpha: selectedDrawing.fillAlpha,
                    // Onda 1, item 4 — ver liveSliderChange acima.
                    onFillAlphaChange: (a: number) =>
                      liveSliderChange(`drawing-fillalpha-${selectedDrawing.id}`, () =>
                        useMapStore.getState().setDrawingFillAlphaLive(selectedDrawing.id, a),
                      ),
                  }
                : { filled: regionFillEnabled, onFilledChange: setRegionFillEnabled }
          }
          // Onda 4, item 24 — resumo de grupo só aparece com 2+ itens: com
          // exatamente 1, o painel de propriedade do item já cobre (ver
          // singleSelection acima); mostrar os dois ao mesmo tempo pra 1
          // item seria redundante. `onClear` limpa o conjunto inteiro.
          areaSelection={{
            selection: selection.length > 1 ? selectionToAreaSelection(selection) : null,
            onClear: () => setSelection(EMPTY_SELECTION),
          }}
          drawingStyle={{
            color: drawColor,
            onColorChange: setDrawColor,
            width: drawWidth,
            onWidthChange: setDrawWidth,
            filled: drawFilled,
            onFilledChange: setDrawFilled,
            fillAlpha: drawFillAlpha,
            onFillAlphaChange: setDrawFillAlpha,
            showFilled: activeTool === 'circle' || activeTool === 'ellipse' || activeTool === 'rect' || activeTool === 'polygon',
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
            snapTargets,
            onSnapTargetChange: setSnapTarget,
            gridSettings: map.gridSettings,
            onGridSettingsChange: setGridSettings,
          }}
          mapScale={{
            scale: map.scale,
            onScaleChange: (patch) => setMapScale({ ...map.scale, ...patch }),
            measurementMode: map.measurementMode,
            onMeasurementModeChange: setMeasurementMode,
            gridShape,
          }}
          gridAlign={{
            backgroundFilename:
              map.background.type === 'image' && map.background.src
                ? (map.background.src.split(/[\\/]/).pop() ?? null)
                : null,
            imageWidth: backgroundImageSize?.width ?? null,
            imageHeight: backgroundImageSize?.height ?? null,
            cellSize: map.grid,
            offset: map.gridOffset ?? { x: 0, y: 0 },
            onOffsetChange: setGridOffset,
            // 2 chamadas = 2 entradas de histórico (Ctrl+Z desfaz offset e
            // cellSize separadamente) — aceito de propósito, mesma decisão
            // já documentada no CONTRATO do agente C5: sem ação combinada,
            // é o preço de reusar as duas actions atômicas que já existem.
            onApply: (cellSize, offset) => {
              setGridCellSize(cellSize)
              setGridOffset(offset)
            },
            onPreviewChange: setGridAlignPreview,
          }}
          layers={{
            hiddenLayers: map.hiddenLayers,
            lockedLayers: map.lockedLayers,
            counts: countEntitiesByLayer(map),
            onToggleLayer: toggleLayerVisibility,
            onToggleLock: toggleLayerLock,
            selectedProp,
            onSetPropLayer: setPropLayer,
          }}
          selection={{
            // SelectionControls (Onda 4, item 24) só precisa de um resumo:
            // `kind` do primeiro item (só importa quando count === 1) +
            // quantos itens no total. `null` = seleção vazia (botão desabilita).
            selection: selection.length > 0 ? { kind: selection[0].kind, count: selection.length } : null,
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
            onToggleLocked: handleToggleLocked,
          }}
          doorKind={{
            kind: selectedWall?.door ? selectedWall.door.kind : doorKind,
            onKindChange: handleDoorKindChange,
          }}
          wallStyle={{
            wallKind: selectedWall ? selectedWall.wallKind : wallKind,
            onWallKindChange: handleWallKindChange,
            thickness: selectedWall ? selectedWall.thickness : wallThickness,
            onThicknessChange: handleWallThicknessChange,
            lineStyle: selectedWall ? selectedWall.lineStyle : wallLineStyle,
            onLineStyleChange: handleWallLineStyleChange,
          }}
          selectedProp={selectedProp}
          portal={{
            onCreateLinkedMap: () => selectedProp && handleCreateLinkedMap(selectedProp.id),
            onLinkExistingMap: () => selectedProp && handleLinkExistingMap(selectedProp.id),
            onEnterLinkedMap: handleEnterLinkedMap,
            onUnlink: () => selectedProp && useMapStore.getState().setPropLinkedPath(selectedProp.id, null),
          }}
          propTransform={{
            onRotationChange: (rotation) => selectedProp && updateProp(selectedProp.id, { rotation }),
            onLockedChange: (locked) => selectedProp && updateProp(selectedProp.id, { locked }),
            onHiddenChange: (hidden) => selectedProp && updateProp(selectedProp.id, { hidden }),
          }}
          selectedToken={selectedToken}
          tokenImage={{
            onChangeImage: () => selectedToken && handleChangeTokenImage(selectedToken.id),
            onClearImage: () => selectedToken && setTokenImage(selectedToken.id, null),
          }}
          tokenTransform={{
            onRotationChange: (rotation) => selectedToken && updateToken(selectedToken.id, { rotation }),
            onLockedChange: (locked) => selectedToken && updateToken(selectedToken.id, { locked }),
            onHiddenChange: (hidden) => selectedToken && updateToken(selectedToken.id, { hidden }),
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
            strokeWidth: selectedRegion ? selectedRegion.strokeWidth ?? 2 : regionStrokeWidth,
            onStrokeWidthChange: handleRegionStrokeWidthChange,
            strokeJoin: selectedRegion ? selectedRegion.strokeJoin ?? 'miter' : regionStrokeJoin,
            onStrokeJoinChange: handleRegionStrokeJoinChange,
            onLinkWalls: selectedRegion
              ? () => useMapStore.getState().linkRegionWalls(selectedRegion.id)
              : undefined,
            onSmoothRegion: selectedRegion
              ? () => useMapStore.getState().smoothRegion(selectedRegion.id)
              : undefined,
          }}
          room={{
            onNameChange: (name) => selectedRegion && setRoomName(selectedRegion.id, name),
            onWidthChange: (width) =>
              selectedRegion && resizeRoomDimensions(selectedRegion.id, width, roomDimensions(selectedRegion.points).height),
            onHeightChange: (height) =>
              selectedRegion && resizeRoomDimensions(selectedRegion.id, roomDimensions(selectedRegion.points).width, height),
          }}
          selectedLight={selectedLight}
          lightControls={{
            onColorChange: (color) => selectedLight && updateLight(selectedLight.id, { color }),
            // Onda 1, item 4 — ver liveSliderChange acima.
            onIntensityChange: (intensity) =>
              selectedLight &&
              liveSliderChange(`light-intensity-${selectedLight.id}`, () =>
                useMapStore.getState().updateLightIntensityLive(selectedLight.id, intensity),
              ),
          }}
          selectedStair={selectedStair}
          stairControls={{
            onDirectionChange: (direction) => selectedStair && setStairDirection(selectedStair.id, direction),
            stepWidth: selectedStair?.stepWidth ?? map.grid,
            onStepWidthChange: (stepWidth) => selectedStair && setStairStepWidthForStair(selectedStair.id, stepWidth),
            grid: map.grid,
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
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
      </div>

      <ZoomHud scale={cameraScale} onReset={() => setResetZoomRequest((n) => n + 1)} />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
