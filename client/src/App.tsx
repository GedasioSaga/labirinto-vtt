import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PixiCanvas } from './pixi/PixiCanvas'
import { ZoomHud } from './components/ZoomHud'
import { Toast } from './components/Toast'
import { useToastStore, type ToastKind } from './stores/toastStore'
import { ensinaOQueFazer } from './lib/erroQueEnsina'
import { motivoDaFalhaDeArquivo, temPonteDoApp } from './lib/foraDoApp'
import { useSessionStore, subscribeToDirtyFlag } from './stores/sessionStore'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { createHostBridge, type HostBridge, type RoomInfo, type TunnelState } from './net/hostBridge'
import { useSignalStore } from './stores/signalStore'
import { laserStrokeEnded, useLaserStore } from './stores/laserStore'
import { useFollowStore } from './stores/followStore'
import { useFollowPlayer } from './stores/useFollowPlayer'
import { playSignalSound } from './lib/signalSound'
import { createSignalRouter } from './net/chamadoDeFundo'
import type { PlayerInfo } from './net/hostSession'
import { RoomPanel } from './components/RoomPanel'
import { LivePlayerMirror } from './components/PlayerMirror'
import { partyDestinations, partyMembers, peopleByScene } from './lib/party'
import { applyGatherPlan, gatherCandidates, planGather } from './lib/gatherParty'
import { RailTabs, type RailTab } from './components/RailTabs'
import { ask } from '@tauri-apps/plugin-dialog'
import { viewportCenterWorld, type Bounds, type Camera } from './pixi/world'
import { MainMenu } from './screens/MainMenu'
import { MapTypePicker } from './screens/MapTypePicker'
import { NewDungeonMap } from './screens/NewDungeonMap'
import { LoadMapScreen } from './screens/LoadMapScreen'
import { OptionsScreen } from './screens/OptionsScreen'
import { useMapStore } from './stores/mapStore'
import { saveMapToAppData, saveMapToPath, pickMapJsonToOpen, openMapFile, mapDirFor, defaultMapsDir, type OpenedMapFile } from './lib/mapFileIO'
import {
  hasUnsavedWork,
  hostWorldOf,
  pinExitsTravelOf,
  pinTravelOptions,
  sceneList,
  subscribeToTravelLinks,
  travelSceneOptions,
  useAdventureStore,
} from './stores/adventureStore'
import { ScenesSection } from './components/ScenesSection'
import { pickBackgroundImage, importBackgroundImage, pickImageFile, importPinImage, importTokenImage, buildTokenSharedPhoto } from './lib/imageImport'
import { useTokenLibraryStore } from './stores/tokenLibraryStore'
import { apagarDoAcervo, fotoSobrouNoDisco, salvarNoAcervo, trazerDoAcervo, IMAGEM_SUMIU_DO_ACERVO, type ItemDoAcervoNaTela } from './lib/tokenLibrary'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ActionBar } from './components/ActionBar'
import type { DoorKind, DrawingCap, DrawingDash, MapData, Pin, PinPassage, Region, Token, Wall } from './types/map'
import { passageOf } from './lib/pins'
import { isArrivalOnly } from './lib/pinTravel'
import type { Screen } from './types/screen'
import { createMapScreen, parentScreen } from './lib/navigation'
import * as mapFactory from './lib/mapFactory'
import { countEntitiesByLayer } from './lib/layers'
import { findTokenSpawn, tokenRadiusFor, wallClearanceForScale } from './lib/tokenPlacement'
import { roomDimensions } from './lib/roomOps'
import type { GridAlignResult } from './lib/gridAlign'
import { relevantPropertyGroups } from './lib/toolProperties'
import { EMPTY_SELECTION, selectionOfItem, selectionSingle, selectionToAreaSelection } from './lib/selectionModel'
import { lightsOnToken } from './lib/selectionHitTest'
import { traceFloorPieces } from './lib/traceImage'
import { loadImagePixels } from './lib/imagePixels'
import { traceMapDetails } from './lib/traceDetails'
import { buildMinimapFromImage, MINIMAP_IMAGE_DEFAULTS } from './lib/minimapFromImage'
import { layoutMapFrame, MINIMAP_FRAME_STYLE } from './lib/mapFrame'
import { fitTitleFont } from './pixi/frameTitle'

/**
 * Onda 2, item 12 (Frente A) — empurra um toast de erro padronizado pros
 * handlers de arquivo (abrir/salvar/importar/exportar). `action` é a
 * descrição no infinitivo do que falhou ("salvar o mapa", "importar a
 * imagem") — vira `Não foi possível <action>: <mensagem>`. Módulo-escopo
 * (não precisa de hook) porque só chama `useToastStore.getState().push`,
 * mesmo padrão que o próprio CONTRATO da Frente A já usa fora de componente.
 *
 * DOIS TIPOS DE AVISO, UM CAMINHO SÓ (21/09/2026): se o erro veio marcado
 * como `ErroQueEnsina`, a mensagem pede uma AÇÃO da pessoa e o aviso fica na
 * tela até ela dispensar (`kind: 'instrucao'`); qualquer outro erro só relata
 * o que falhou e continua sumindo sozinho aos 7 s. A marca viaja no erro
 * porque só quem o lançou sabe se a frase termina numa tarefa — a fronteira
 * inteira está em `lib/erroQueEnsina.ts`.
 */
function reportFileError(action: string, err: unknown): void {
  // Fora do app desktop o erro é sempre a ponte do Tauri ausente, e a frase
  // explica isso em vez de mostrar o `TypeError` cru (`lib/foraDoApp.ts`).
  const message = motivoDaFalhaDeArquivo(err, temPonteDoApp())
  const kind: ToastKind = ensinaOQueFazer(err) ? 'instrucao' : 'error'
  useToastStore.getState().push(kind, `Não foi possível ${action}: ${message}`)
}

/**
 * Cancela um listener do Tauri sem poder derrubar a tela.
 *
 * `unlisten` do `@tauri-apps/api/event` fala com
 * `window.__TAURI_EVENT_PLUGIN_INTERNALS__`, uma ponte SEPARADA de
 * `__TAURI_INTERNALS__` (que é a que `isTauri()` enxerga): onde só a segunda
 * existe, a chamada estoura `TypeError: Cannot read properties of undefined`
 * dentro da limpeza de um `useEffect` — o lugar onde o React não tem quem
 * pegue o erro, e a tela inteira cai. Fechar a janela já derruba o listener de
 * qualquer jeito, então falhar aqui não custa nada e não merece aviso.
 */
function pararDeOuvir(unlisten: (() => void) | undefined): void {
  if (unlisten === undefined) return
  try {
    // O `unlisten` do Tauri é ASSÍNCRONO por dentro (`_unlisten` em
    // `@tauri-apps/api/event`), mesmo declarado como `() => void`: o erro não
    // chega ao `catch` abaixo, ele vira promessa rejeitada sem dono — que é
    // exatamente como este defeito apareceu. Por isso os DOIS caminhos.
    void Promise.resolve(unlisten() as unknown).catch(() => undefined)
  } catch {
    // Ponte de eventos ausente ou pela metade: nada a fazer e nada a dizer.
  }
}

/** Aviso de sucesso de Salvar (botão, Ctrl+S) e de sair por Início. */
const MAP_SAVED_TEXT = 'Mapa salvo'

/** Toda peça nova nasce ocupando uma célula; o painel muda o tamanho depois. */
const NEW_TOKEN_SIZE = 1
/** Diz por que nenhuma peça apareceu, com o que fazer a seguir — silêncio aqui é o defeito que esta mudança conserta. */
const NO_TOKEN_SPOT_TEXT = 'Sem lugar livre para a peça aqui: as paredes em volta não deixam espaço. Mova a vista para um trecho vazio e tente de novo.'

/** Entrada do aviso de trabalho não salvo: ease-out curto, nunca de escala zero. */
const UNSAVED_DIALOG_ENTER_MS = 160

interface UnsavedChangesDialogProps {
  onSaveAndContinue: () => void
  onDiscardAndContinue: () => void
  onCancel: () => void
}

/**
 * Pergunta antes de jogar fora o que o mestre desenhou.
 *
 * É `alertdialog`, não `dialog`: a ação confirmada é destrutiva, então o foco
 * entra no botão SEGURO ("Continuar editando"), o clique no fundo não fecha
 * nada (só Esc ou o próprio botão) e o Tab circula dentro da caixa — mesma
 * regra do Alert Dialog do Radix. Mora em `App.tsx` junto com quem decide
 * QUANDO perguntar; o layout reusa as classes de `MapSettingsDialog`.
 */
function UnsavedChangesDialog({ onSaveAndContinue, onDiscardAndContinue, onCancel }: UnsavedChangesDialogProps) {
  const titleId = useId()
  const textId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    keepEditingRef.current?.focus()
    const box = dialogRef.current
    // `animate` não existe em jsdom, e quem pediu menos movimento não recebe
    // nenhum — a caixa já aparece no lugar certo sem a animação.
    if (!box || typeof box.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    box.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }], {
      duration: UNSAVED_DIALOG_ENTER_MS,
      easing: 'ease-out',
    })
  }, [])

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Caixa modal: nenhuma tecla daqui vale como atalho do editor — nem o
    // próprio Ctrl+O que abriu a pergunta, nem Delete apagando a seleção.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="lb-dialog-backdrop">
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <h2 id={titleId} className="lb-dialog__title">
            Alterações não salvas
          </h2>
        </header>
        <div className="lb-dialog__body" style={{ padding: 'var(--lb-space-4)' }}>
          <p id={textId} style={{ margin: 0, lineHeight: 'var(--lb-font-leading-normal)' }}>
            Você tem alterações não salvas neste mapa. Abrir outro mapa agora joga fora o que você desenhou desde o
            último Salvar.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--lb-space-2)',
            justifyContent: 'flex-end',
            padding: 'var(--lb-space-4)',
            paddingTop: 0,
          }}
        >
          <button ref={keepEditingRef} type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
            Continuar editando
          </button>
          <button type="button" className="lb-btn lb-btn--danger" onClick={onDiscardAndContinue}>
            Descartar e abrir
          </button>
          <button type="button" className="lb-btn lb-btn--primary" onClick={onSaveAndContinue}>
            Salvar e abrir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Ferramentas que criam Sala (piso em `roomFillColor`); Região usa `regionFillColor`. */
function isRoomTool(tool: string): boolean {
  return tool === 'room' || tool === 'roomCircle' || tool === 'roomPolygon' || tool === 'roomFree'
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
  const pathColor = useMapStore((state) => state.pathColor)
  const setPathColor = useMapStore((state) => state.setPathColor)
  const pathWidthCells = useMapStore((state) => state.pathWidthCells)
  const setPathWidthCells = useMapStore((state) => state.setPathWidthCells)
  const polygonSides = useMapStore((state) => state.polygonSides)
  const setPolygonSides = useMapStore((state) => state.setPolygonSides)
  const regionFillColor = useMapStore((state) => state.regionFillColor)
  const setRegionFillColor = useMapStore((state) => state.setRegionFillColor)
  const roomFillColor = useMapStore((state) => state.roomFillColor)
  const setRoomFillColor = useMapStore((state) => state.setRoomFillColor)
  const setRegionColor = useMapStore((state) => state.setRegionColor)
  const regionFillPattern = useMapStore((state) => state.regionFillPattern)
  const setRegionFillPattern = useMapStore((state) => state.setRegionFillPattern)
  const setRegionPattern = useMapStore((state) => state.setRegionPattern)
  const setWallDoor = useMapStore((state) => state.setWallDoor)
  const setDoorLocked = useMapStore((state) => state.setDoorLocked)
  const setDoorSecret = useMapStore((state) => state.setDoorSecret)
  const revealSecretPassage = useMapStore((state) => state.revealSecretPassage)
  const turnWallIntoDoor = useMapStore((state) => state.turnWallIntoDoor)
  const doorKind = useMapStore((state) => state.doorKind)
  const setDoorKind = useMapStore((state) => state.setDoorKind)
  const doorMode = useMapStore((state) => state.doorMode)
  const setDoorMode = useMapStore((state) => state.setDoorMode)
  const revealBrushMode = useMapStore((state) => state.revealBrushMode)
  const setRevealBrushMode = useMapStore((state) => state.setRevealBrushMode)
  const revealBrushWidth = useMapStore((state) => state.revealBrushWidth)
  const setRevealBrushWidth = useMapStore((state) => state.setRevealBrushWidth)
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
  const setLightAttachment = useMapStore((state) => state.setLightAttachment)
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
  // "Estilo do traço" (contínuo/tracejado/pontilhado) — passagem secreta e
  // limite sugerido deixam de sair iguais a uma parede. Mesma dupla de
  // drawCap: preferência da PRÓXIMA linha/curva + edição da já selecionada.
  const drawDash = useMapStore((state) => state.drawDash)
  const setDrawDash = useMapStore((state) => state.setDrawDash)
  const setDrawingDash = useMapStore((state) => state.setDrawingDash)
  const convertDrawingToCurve = useMapStore((state) => state.convertDrawingToCurve)
  const convertDrawingToLine = useMapStore((state) => state.convertDrawingToLine)
  // Fase 5 — N1 "setinha de variantes": os 3 eixos que faltavam
  // (pincel/borracha/escada), mesma classe de drawCap/wallKind/doorKind acima.
  const drawTexture = useMapStore((state) => state.drawTexture)
  const lastDrawingTool = useMapStore((state) => state.lastDrawingTool)
  const setDrawTexture = useMapStore((state) => state.setDrawTexture)
  const eraseMode = useMapStore((state) => state.eraseMode)
  const setEraseMode = useMapStore((state) => state.setEraseMode)
  const stairSizePreset = useMapStore((state) => state.stairSizePreset)
  const setStairSizePreset = useMapStore((state) => state.setStairSizePreset)
  const setStairStepWidthForStair = useMapStore((state) => state.setStairStepWidthForStair)
  // Chão por peças — preferências da ferramenta (setinha) e edição da peça
  // selecionada / do estilo do chão (painel).
  const floorShapeKind = useMapStore((state) => state.floorShapeKind)
  const setFloorShapeKind = useMapStore((state) => state.setFloorShapeKind)
  const floorOp = useMapStore((state) => state.floorOp)
  const setFloorOp = useMapStore((state) => state.setFloorOp)
  const floorPolygonSides = useMapStore((state) => state.floorPolygonSides)
  const setFloorPolygonSides = useMapStore((state) => state.setFloorPolygonSides)
  const floorBrushSize = useMapStore((state) => state.floorBrushSize)
  const setFloorBrushSize = useMapStore((state) => state.setFloorBrushSize)
  const updateFloorPiece = useMapStore((state) => state.updateFloorPiece)
  const reorderFloorPiece = useMapStore((state) => state.reorderFloorPiece)
  const setFloorStyle = useMapStore((state) => state.setFloorStyle)
  const addFloorPieces = useMapStore((state) => state.addFloorPieces)
  const addMapDetails = useMapStore((state) => state.addMapDetails)
  const setMapFrame = useMapStore((state) => state.setMapFrame)
  const applyMinimapTrace = useMapStore((state) => state.applyMinimapTrace)
  // Fase 4 — N2 "tirar o fundo" (Região/Sala) e edição de fillAlpha/filled de
  // uma forma preenchível JÁ SELECIONADA (as actions já existiam órfãs, sem
  // nenhuma UI usando — ver dossiê F4).
  const regionFillEnabled = useMapStore((state) => state.regionFillEnabled)
  const setRegionFillEnabled = useMapStore((state) => state.setRegionFillEnabled)
  const setRegionFilled = useMapStore((state) => state.setRegionFilled)
  const setRegionLocked = useMapStore((state) => state.setRegionLocked)
  const setDrawingFilled = useMapStore((state) => state.setDrawingFilled)
  // Onda 2, item 12 (Frente A) — pilha de avisos (erro/info).
  const toasts = useToastStore((state) => state.toasts)

  // Acervo de tokens prontos: global do app, lido do disco uma vez por
  // execução e reler só depois de gravar (salvar/apagar). Ver `stores/tokenLibraryStore.ts`.
  const acervoItens = useTokenLibraryStore((state) => state.itens)
  const acervoAviso = useTokenLibraryStore((state) => state.aviso)
  useEffect(() => {
    void useTokenLibraryStore.getState().recarregar()
  }, [])

  // Multiplayer em LAN: ponte do mestre criada sob demanda (só dentro do Tauri, ver RoomPanel abaixo).
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [roomPlayers, setRoomPlayers] = useState<PlayerInfo[]>([])
  // "Quem vê" de cada pino com lista. O dono é a sessão do host; isto é só o que o painel desenha.
  const [pinAudiences, setPinAudiences] = useState<Record<string, string[]>>({})
  const [tunnel, setTunnel] = useState<TunnelState>({ kind: 'idle' })
  const [railTab, setRailTab] = useState<RailTab>('map')
  const hostBridgeRef = useRef<HostBridge | null>(null)
  const hostBridge = (): HostBridge => {
    if (!hostBridgeRef.current) {
      hostBridgeRef.current = createHostBridge({
        invoke,
        listen,
        getMap: () => useMapStore.getState().map,
        // Cada jogador vê a cena do token dele: a sessão precisa da aventura inteira, não só da cena aberta.
        getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
        // Movimento já validado pela sessão (dono, paredes, borda do chão). Jogador numa
        // cena de fundo mexe nela sem passar pelo desfazer da cena aberta.
        applyMove: (tokenId, x, y, sceneId) => {
          if (sceneId === undefined) useMapStore.getState().setTokenPosition(tokenId, x, y)
          else useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => mapFactory.setTokenPosition(m, tokenId, x, y))
        },
        // Porta aberta/fechada pelo jogador, já validada pela sessão (visível, destrancada, token perto).
        applyDoor: (wallId, open, sceneId) => {
          if (sceneId !== undefined) {
            useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => {
              const wall = m.walls.find((w) => w.id === wallId)
              // Mesma recusa defensiva da cena aberta, logo abaixo.
              if (!wall?.door || (open && wall.door.locked)) return m
              return mapFactory.setWallDoor(m, wallId, { ...wall.door, open })
            })
            return
          }
          const store = useMapStore.getState()
          const wall = store.map.walls.find((w) => w.id === wallId)
          // Trancada só o mestre abre: recusa defensiva se o mapa mudou entre a validação e aqui.
          if (!wall?.door || (open && wall.door.locked)) return
          store.setWallDoor(wallId, { ...wall.door, open })
        },
        // Nome/foto que o jogador trocou no próprio token, já validados pela
        // sessão (o token é dele, a foto é auto-contida). `image` chega como
        // referência embutida: ela vira a cópia que viaja, e o caminho do
        // disco do mestre (se havia um) deixa de valer para este token.
        applyTokenEdit: ({ tokenId, name, image, sceneId }) => {
          if (sceneId !== undefined) {
            useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => {
              const renamed = name === undefined ? m : mapFactory.renameToken(m, tokenId, name)
              return image === undefined ? renamed : mapFactory.setTokenImage(renamed, tokenId, null, image)
            })
            return
          }
          const store = useMapStore.getState()
          if (name !== undefined) store.renameToken(tokenId, name)
          if (image !== undefined) store.setTokenImage(tokenId, null, image)
        },
        // "Deixar ir": o token troca de cena fora do desfazer das duas (ver `transferToken`).
        applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y }) =>
          useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y),
        // "Ir lá" do aviso de chegada: o editor vai à cena, com a ficha no centro
        // (mesmo caminho do "Ir lá" do painel Grupo, que também serve à cena já aberta).
        onGoToScene: (sceneId, x, y) => {
          useAdventureStore.getState().goToPoint(sceneId, { x, y })
        },
        onPlayersChange: setRoomPlayers,
        onPinAudiencesChange: setPinAudiences,
        onTunnelChange: setTunnel,
        // B1 — sinal do jogador: o canvas desenha pela store e o bipe avisa quem não está olhando.
        // G6 — sinal de cena de FUNDO não vira ping aqui (as coordenadas são de
        // outro mapa): vira o aviso "chamou em", com "Ir lá" (`net/chamadoDeFundo.ts`).
        onSignal: createSignalRouter({
          drawPing: (signal) => useSignalStore.getState().push(signal),
          beep: playSignalSound,
          goTo: (sceneId, x, y) => {
            useAdventureStore.getState().goToPoint(sceneId, { x, y })
          },
        }),
      })
    }
    return hostBridgeRef.current
  }
  useEffect(() => useMapStore.subscribe((state) => state.map, () => hostBridgeRef.current?.notifyMapChanged()), [])
  const laserToggled = useLaserStore((state) => state.toggled)
  // B2 — o `off` sai no fim do traço: soltar o botão, sair da janela ou desarmar (L e botão Laser).
  useEffect(
    () =>
      useLaserStore.subscribe((state, previous) => {
        if (laserStrokeEnded(previous, state)) hostBridgeRef.current?.laserOff()
      }),
    [],
  )
  useEffect(
    () => () => {
      void hostBridgeRef.current?.stop()
    },
    [],
  )
  const handleStartRoom = async () => {
    try {
      setRoom(await hostBridge().start())
    } catch {
      // A ponte já mostrou o toast com o motivo; o painel continua com a sala fechada.
    }
  }
  const handleStopRoom = async () => {
    await hostBridgeRef.current?.stop()
    setRoom(null)
    setRoomPlayers([])
    useSignalStore.getState().clear()
    useLaserStore.getState().setToggled(false)
  }
  /**
   * O mundo que o host serve (cena aberta + as de fundo), para o painel Jogo:
   * o Grupo mostra onde cada um está e o "Remover …" acha a ficha de quem
   * viajou. Só é montado com a aba Jogo existindo (Tauri).
   */
  const roomPanelWorld = () => hostWorldOf({ adventure, activeSceneId, cache: sceneCache }, map)
  /** Fora do Tauri o rail segue só com o inspetor; no app ganha as abas Mapa | Jogo. */
  const withRoomTabs = (mapPanel: ReactNode): ReactNode => {
    if (!isTauri()) return mapPanel
    const world = roomPanelWorld()
    return (
      <RailTabs
        active={railTab}
        onChange={setRailTab}
        mapPanel={mapPanel}
        roomPanel={
          <RoomPanel
            room={room}
            players={roomPlayers}
            tokens={map.tokens.map((token) => ({ id: token.id, name: token.name }))}
            knownTokens={[world.open, ...world.background].flatMap((scene) => scene.map.tokens.map((token) => ({ id: token.id, name: token.name })))}
            party={{
              members: partyMembers(roomPlayers, world),
              destinations: partyDestinations(world),
              onGoTo: (member) => {
                // "Ir lá" em OUTRO jogador é o mestre escolhendo a vista: desliga o seguir.
                if (member.playerId !== followingId) useFollowStore.getState().stop()
                if (member.token !== null) useAdventureStore.getState().goToPoint(member.sceneId, { x: member.token.x, y: member.token.y })
              },
              onSend: (playerId, sceneId, pinId) => hostBridgeRef.current?.sendPlayer(playerId, sceneId, pinId) ?? false,
              followingId,
              onToggleFollow: (member) => useFollowStore.getState().toggle(member.playerId),
              // "Ver tela": um espelho por vez; o mesmo botão fecha o que abriu.
              mirroringId: mirrorId,
              onToggleMirror: (member) => setMirrorId((current) => (current === member.playerId ? null : member.playerId)),
            }}
            tunnel={tunnel}
            onStart={() => void handleStartRoom()}
            onStop={() => void handleStopRoom()}
            onStartTunnel={() => void hostBridgeRef.current?.startTunnel()}
            onStopTunnel={() => void hostBridgeRef.current?.stopTunnel()}
            onAssign={(playerId, tokenId) => hostBridgeRef.current?.assignToken(playerId, tokenId)}
            onUnassign={(playerId, tokenId) => hostBridgeRef.current?.unassignToken(playerId, tokenId)}
            onKick={(clientId) => void hostBridgeRef.current?.kick(clientId)}
            onVisionRadiusChange={(playerId, radius) => hostBridgeRef.current?.setVisionRadius(playerId, radius)}
            onRevealPlan={(playerId) => hostBridgeRef.current?.revealPlan(playerId)}
            onHidePlan={(playerId) => hostBridgeRef.current?.hidePlan(playerId)}
            onGiveGroupView={(playerId) => hostBridgeRef.current?.giveGroupView(playerId) ?? null}
            laserOn={laserToggled}
            onToggleLaser={() => useLaserStore.getState().setToggled(!useLaserStore.getState().toggled)}
          />
        }
      />
    )
  }
  const dismissToast = useToastStore((state) => state.dismiss)
  // Cenas da aventura (`stores/adventureStore.ts`). O Voltar da barra leva à
  // cena de onde se veio na última troca.
  const adventure = useAdventureStore((state) => state.adventure)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const sceneCache = useAdventureStore((state) => state.cache)
  const previousSceneId = useAdventureStore((state) => state.previousSceneId)
  // Cada cena lembra a própria câmera; a troca pede ao canvas que volte a ela (ou enquadre).
  const sceneCameraRequest = useAdventureStore((state) => state.cameraRequest)
  const canGoBackToScene = previousSceneId !== null && sceneCache[previousSceneId]?.status === 'ok'
  // G7 — "Seguir" na linha do Grupo: a câmera acompanha a ficha do jogador, inclusive de cena em cena.
  const followingId = useFollowStore((state) => state.playerId)
  useFollowPlayer(roomPlayers, () => hostWorldOf({ adventure, activeSceneId, cache: sceneCache }, map))
  // "Ver tela" do Grupo: de quem é o espelho aberto. Quem saiu da sala (expulso,
  // sala fechada) leva o espelho junto — voltar depois não o reabre sozinho.
  const [mirrorId, setMirrorId] = useState<string | null>(null)
  const mirroredPlayer = mirrorId === null ? undefined : roomPlayers.find((player) => player.playerId === mirrorId)
  useEffect(() => {
    if (mirrorId !== null && mirroredPlayer === undefined) setMirrorId(null)
  }, [mirrorId, mirroredPlayer])
  /**
   * Caminho de origem do mapa em edição. `null` enquanto o mapa é novo
   * (ainda não salvo); a partir daí toda escrita vai de volta para esse
   * caminho, em vez de gerar cópia nova em `%APPDATA%`. Numa aventura é o
   * arquivo da cena aberta, e quem grava é `useAdventureStore.flush`.
   */
  const [currentMapPath, setCurrentMapPath] = useState<string | null>(null)
  /**
   * Troca de mapa que está esperando o mestre responder sobre o trabalho não
   * salvo. `run` é a abertura que já ia acontecer (seletor de arquivo ou
   * caminho da lista) — guardada inteira para a resposta só decidir SE ela
   * roda, sem repetir o fluxo em dois lugares. O aviso de trabalho não salvo
   * só existia ao FECHAR a janela (`onCloseRequested`); quem abria outro mapa
   * pela porta da frente perdia tudo calado.
   */
  const [pendingOpen, setPendingOpen] = useState<{ run: () => Promise<void> } | null>(null)
  /** Quem abriu a pergunta, para devolver o foco ao cancelar (convenção de modal). */
  const unsavedOpenerRef = useRef<HTMLElement | null>(null)
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
  /** Container do canvas: o tamanho dele é a "tela" usada para achar o centro visível ao adicionar token. */
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  /** Barra de ferramentas e rail: flutuam sobre o canvas e tapam o que está embaixo. */
  const editorTopRef = useRef<HTMLDivElement | null>(null)
  const editorRailRef = useRef<HTMLDivElement | null>(null)
  /**
   * Os painéis flutuantes em px relativos ao canvas, lidos na hora: o "Ir lá"
   * (e toda chegada com foco) centra o ponto no que eles deixam livre, e não
   * embaixo da barra de ferramentas (ver `freeAreaCenter`).
   */
  const canvasObstacles = (): Bounds[] => {
    const host = canvasHostRef.current
    if (host === null) return []
    const base = host.getBoundingClientRect()
    return [editorTopRef.current, editorRailRef.current].flatMap((el) => {
      if (el === null) return []
      const r = el.getBoundingClientRect()
      return [{ minX: r.left - base.left, minY: r.top - base.top, maxX: r.right - base.left, maxY: r.bottom - base.top }]
    })
  }

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
  // Pino de viagem: toda mudança de ligação na cena aberta (ligar, desligar,
  // apagar, Ctrl+Z) é espelhada no par da outra cena.
  useEffect(() => subscribeToTravelLinks(), [])

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
        if (!hasUnsavedWork()) return
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
        if (cancelled) pararDeOuvir(fn)
        else unlisten = fn
      })
      // Registrar o aviso é melhor esforço: sem ele o app fecha sem perguntar,
      // que é ruim — mas uma promessa rejeitada sem dono derruba a tela, que é
      // pior, e foi assim que este efeito quebrou a jornada do acervo.
      .catch(() => undefined)
    return () => {
      cancelled = true
      pararDeOuvir(unlisten)
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
  // Sub-sala: a sala de fora (parentId órfão = sala de topo, sem linha "Dentro de").
  const selectedRegionParent = selectedRegion?.parentId !== undefined ? map.regions.find((r) => r.id === selectedRegion.parentId) ?? null : null
  const selectedLight = singleSelection?.kind === 'light' ? map.lights.find((l) => l.id === singleSelection.id) ?? null : null
  const selectedStair = singleSelection?.kind === 'stair' ? map.stairs.find((s) => s.id === singleSelection.id) ?? null : null
  const selectedFloorIndex = singleSelection?.kind === 'floor' ? map.floor.findIndex((p) => p.id === singleSelection.id) : -1
  const selectedFloorPiece = selectedFloorIndex >= 0 ? map.floor[selectedFloorIndex] : null
  // A5 — zona aberta no painel. Some sozinha se o Ctrl+Z tirar a zona do mapa.
  const selectedConcealZoneId = useMapStore((state) => state.selectedConcealZoneId)
  const selectedConcealZone = map.concealZones.find((z) => z.id === selectedConcealZoneId) ?? null
  // Pino aberto no painel. Some sozinho se o Ctrl+Z tirar o pino do mapa.
  const selectedPinId = useMapStore((state) => state.selectedPinId)
  const selectedPin = map.pins.find((p) => p.id === selectedPinId) ?? null
  const pinKind = useMapStore((state) => state.pinKind)
  const pinIcon = useMapStore((state) => state.pinIcon)
  // A5 — "Oculto para jogadores" do item selecionado que não é Token/Objeto.
  const secretTarget: { kind: 'region' | 'stair' | 'drawing' | 'pin'; id: string; secret: boolean } | null = selectedRegion
    ? { kind: 'region', id: selectedRegion.id, secret: !!selectedRegion.secret }
    : selectedStair
      ? { kind: 'stair', id: selectedStair.id, secret: !!selectedStair.secret }
      : selectedDrawing
        ? { kind: 'drawing', id: selectedDrawing.id, secret: !!selectedDrawing.secret }
        // Pino também precisa do toggle: sem ele, "esconder este ponto do
        // jogador" existiria no recorte (lib/fogFilter.ts) e não teria botão.
        : selectedPin
          ? { kind: 'pin', id: selectedPin.id, secret: !!selectedPin.secret }
          : null

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
    floorPiece: selectedFloorPiece !== null,
    concealZone: selectedConcealZone !== null,
    pin: selectedPin !== null,
  })

  /**
   * "Chão a partir da imagem de fundo": lê os pixels da MESMA imagem que
   * `redrawBackground` (PixiCanvas.tsx) desenha em (0,0) sem escala — então
   * pixel da imagem === px de mundo, sem conversão. Todas as peças entram
   * numa entrada de histórico só (`addFloorPieces`). Falha de carga vira
   * toast, nunca silêncio.
   */
  const handleFloorFromBackground = async () => {
    if (map.background.type !== 'image' || !map.background.src) return
    try {
      const pixels = await loadImagePixels(convertFileSrc(map.background.src))
      const pieces = traceFloorPieces(pixels.data, pixels.width, pixels.height, {}, () => crypto.randomUUID())
      if (pieces.length === 0) {
        useToastStore.getState().push('info', 'Nenhum chão encontrado na imagem de fundo.')
        return
      }
      addFloorPieces(pieces)
      useToastStore.getState().push('info', `Chão criado a partir da imagem: ${pieces.length} peças.`)
    } catch (err) {
      reportFileError('criar o chão a partir da imagem de fundo', err)
    }
  }

  /** "Linhas e portas a partir da imagem de fundo" — mesmo contrato de `handleFloorFromBackground`, 1 undo. */
  const handleDetailsFromBackground = async () => {
    if (map.background.type !== 'image' || !map.background.src) return
    try {
      const pixels = await loadImagePixels(convertFileSrc(map.background.src))
      const { lines, markers } = traceMapDetails(pixels.data, pixels.width, pixels.height, {}, () => crypto.randomUUID())
      if (lines.length === 0 && markers.length === 0) {
        useToastStore.getState().push('info', 'Nenhuma linha ou porta encontrada na imagem de fundo.')
        return
      }
      addMapDetails(lines, markers)
      useToastStore.getState().push('info', `Criadas ${lines.length} linhas e ${markers.length} portas a partir da imagem.`)
    } catch (err) {
      reportFileError('criar linhas e portas a partir da imagem de fundo', err)
    }
  }

  /**
   * "Recriar minimapa a partir da imagem de fundo": pipeline completo
   * (lib/minimapFromImage.ts) — chão, linhas, portas, pontilhado, detalhes
   * escuros e calibração do contorno — aplicado em 1 undo, já com o render
   * fiel ligado. Roda no thread principal e leva alguns segundos.
   */
  const handleMinimapFromBackground = async () => {
    if (map.background.type !== 'image' || !map.background.src) return
    try {
      useToastStore.getState().push('info', 'Recriando o minimapa a partir da imagem — pode levar alguns segundos.')
      const pixels = await loadImagePixels(convertFileSrc(map.background.src))
      // Deixa o aviso aparecer antes do cálculo pesado travar o thread.
      await new Promise((resolve) => setTimeout(resolve, 50))
      const options = { ...MINIMAP_IMAGE_DEFAULTS, rect: { x: 0, y: 0, w: pixels.width, h: pixels.height } }
      const result = buildMinimapFromImage(pixels.data, pixels.width, pixels.height, options, () => crypto.randomUUID())
      if (result.pieces.length === 0) {
        useToastStore.getState().push('info', 'Nenhum chão encontrado na imagem de fundo.')
        return
      }
      applyMinimapTrace(result.pieces, result.lines, result.markers, {
        fillColor: options.floorColor,
        strokeColor: options.strokeColor,
        strokeWidth: result.strokeWidth,
        strokeAlpha: options.strokeAlpha,
        lineAlpha: options.lineAlpha,
        renderMode: 'raster',
      })
      // Com moldura: escolhe a fonte do título comparando com a própria imagem (pixi/frameTitle.ts).
      if (map.frame) {
        const layout = layoutMapFrame(map.frame.w, map.frame.h, map.frame.title)
        const titleFont = fitTitleFont(
          pixels.data,
          pixels.width,
          pixels.height,
          layout,
          map.frame.x - layout.content.x,
          map.frame.y - layout.content.y,
          MINIMAP_FRAME_STYLE.titleBarFill,
        )
        if (titleFont) setMapFrame({ ...map.frame, titleFont })
      }
      useToastStore
        .getState()
        .push('info', `Minimapa recriado: ${result.pieces.length} peças, ${result.lines.length} linhas, ${result.markers.length} marcadores.`)
    } catch (err) {
      reportFileError('recriar o minimapa a partir da imagem de fundo', err)
    }
  }

  const handleRegionColorChange = (color: string) => {
    if (selectedRegion) {
      setRegionColor(selectedRegion.id, color)
      return
    }
    if (isRoomTool(activeTool)) {
      setRoomFillColor(color)
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
    // Porta nasce do tamanho padrão no MEIO da parede, partindo a parede como a
    // ferramenta Porta faz. Antes o LADO INTEIRO da sala virava porta (bug P10).
    if (selectedWall.door === null) turnWallIntoDoor(selectedWall.id)
    else setWallDoor(selectedWall.id, null)
  }

  const handleToggleOpen = () => {
    if (!selectedWall || !selectedWall.door) return
    setWallDoor(selectedWall.id, { ...selectedWall.door, open: !selectedWall.door.open })
  }

  const handleToggleLocked = () => {
    if (!selectedWall || !selectedWall.door) return
    setDoorLocked(selectedWall.id, !selectedWall.door.locked)
  }

  const handleToggleSecret = () => {
    if (!selectedWall || !selectedWall.door) return
    setDoorSecret(selectedWall.id, selectedWall.door.secret !== true)
  }

  const handleRevealPassage = () => {
    if (!selectedWall) return
    revealSecretPassage(selectedWall.id)
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
      // A cópia embutida sai junto: sem ela o jogador receberia o token sem
      // foto nenhuma, porque o caminho do disco do mestre não atravessa o
      // recorte (lib/fogFilter.ts).
      //
      // Melhor esforço, e não parte do gesto: se a redução falhar (formato que
      // o `createImageBitmap` recusa, foto que não cabe no teto), a imagem do
      // mestre entra do mesmo jeito — perder a foto INTEIRA porque a cópia não
      // saiu seria trocar um problema pequeno por um grande. O aviso diz o que
      // ficou faltando.
      let shared: string | null = null
      try {
        shared = await buildTokenSharedPhoto(sourcePath)
      } catch (err) {
        reportFileError('preparar a foto do token para os jogadores (o token fica com a imagem só na sua tela)', err)
      }
      setTokenImage(tokenId, imported.destPath, shared)
    } catch (err) {
      reportFileError('trocar a imagem do token', err)
    }
  }

  /**
   * ACERVO DE TOKENS — guardar o token selecionado na estante do app.
   *
   * O erro sobe de `lib/tokenLibrary.ts` e sai pelo MESMO `reportFileError` de
   * salvar mapa e trocar imagem: token sem foto vira "Não foi possível guardar
   * o token no acervo: este token ainda não tem foto — escolha uma imagem para
   * ele antes de guardar no acervo", que diz o que fazer a seguir. Checar a
   * foto aqui também seria uma segunda regra dizendo a mesma coisa, livre para
   * divergir da primeira.
   *
   * Esse aviso é o único deste handler que FICA na tela até a pessoa
   * dispensar (`ErroQueEnsina` → `kind: 'instrucao'`): ele manda ela ir
   * escolher uma imagem, e ela precisa da frase enquanto procura o arquivo na
   * pasta dela. O "<nome> entrou no acervo" do caminho feliz continua sumindo
   * sozinho — ali não sobrou passo nenhum para ela.
   */
  const handleSaveTokenToLibrary = async (token: Token) => {
    try {
      const item = await salvarNoAcervo(token)
      await useTokenLibraryStore.getState().recarregar()
      // O nome pode ter ganhado sufixo ("Goblin (2)"): mostrar o nome FINAL é
      // o que faz a pessoa achar a linha certa no painel logo em seguida.
      useToastStore.getState().push('info', `${item.nome} entrou no acervo`)
    } catch (err) {
      reportFileError('guardar o token no acervo', err)
    }
  }

  /**
   * ACERVO — trazer o NPC pronto para o mapa aberto.
   *
   * A foto é copiada para a pasta DESTE mapa ANTES de a peça nascer, e a peça
   * nasce já com ela: um clique, uma entrada de desfazer. A ordem inversa (peça
   * primeiro, foto depois) custava dois Ctrl+Z para desfazer um gesto só e,
   * quando o Ctrl+Z vinha no meio da cópia, a foto atrasada caía num mapa sem
   * aquele token e matava o Refazer sem nada aparecer na tela.
   *
   * O `id` é sorteado aqui porque o nome do arquivo da cópia é derivado dele:
   * a peça e a imagem dela precisam do MESMO id antes de qualquer dos dois
   * existir.
   */
  const handlePlaceFromLibrary = async (item: ItemDoAcervoNaTela, at?: { x: number; y: number }) => {
    const tokenId = crypto.randomUUID()
    let image: string | null = null
    let imageData: string | null = null
    try {
      const mapDir = await mapDirFor(map.id)
      const copiada = await trazerDoAcervo(item, mapDir, tokenId)
      image = copiada.image
      imageData = copiada.imageData
    } catch (err) {
      reportFileError('trazer o token do acervo', err)
      return
    }

    if (criarToken(item.nome, { at, id: tokenId, size: item.tamanho, image, imageData }) === null) return
    if (image === null && imageData === null) {
      // A peça entra assim mesmo, com o nome certo e o círculo genérico: o
      // arquivo sumiu da pasta do acervo, e não colocar a peça seria punir a
      // pessoa por um problema do disco.
      useToastStore.getState().push('error', IMAGEM_SUMIU_DO_ACERVO)
    }
  }

  /**
   * ACERVO — soltar um item ARRASTADO da estante (achado 12 do passeio de
   * 20/09/2026). Recebe o ponto da tela onde o ponteiro subiu; só aceita se
   * ali está o MAPA — o elemento sob o ponteiro mora dentro do canvas, e não
   * no painel que o cobre. Fora dele devolve `false` e nada nasce: soltar
   * no painel é desistir, como soltar fora do botão desiste do clique.
   *
   * Tela → mundo pela mesma conta de `viewportCenterWorld`: a câmera da store
   * é a do Pixi (`applyCamera` a grava a cada gesto) e o canvas ocupa o
   * `lb-editor__canvas` inteiro.
   */
  const handleDropFromLibrary = (item: ItemDoAcervoNaTela, clientX: number, clientY: number): boolean => {
    const host = canvasHostRef.current
    const sobOPonteiro = document.elementFromPoint(clientX, clientY)
    if (host === null || sobOPonteiro === null || !host.contains(sobOPonteiro)) return false
    const caixa = host.getBoundingClientRect()
    const { camera } = useMapStore.getState()
    void handlePlaceFromLibrary(item, {
      x: (clientX - caixa.left - camera.x) / camera.scale,
      y: (clientY - caixa.top - camera.y) / camera.scale,
    })
    return true
  }

  /**
   * ACERVO — apagar do disco. A confirmação já aconteceu em `TokenLibraryPanel`.
   *
   * O `finally` não é zelo: `apagarDoAcervo` reescreve o índice ANTES de mexer
   * nos arquivos de imagem, então quando ela lança por causa de uma foto que o
   * disco recusou apagar o item JÁ saiu do índice. Sem recarregar aí, a estante
   * continuaria mostrando um nome que não existe mais no disco até a próxima
   * releitura — uma segunda mentira, em cima da que este conserto veio tirar.
   *
   * Duas frases de abertura porque são dois acidentes diferentes: "não deu para
   * apagar o token do acervo" é o índice que não foi reescrito (nada mudou), e
   * "não deu para apagar do disco a foto de X" é o nome que saiu com a foto
   * para trás. Dizer a primeira nos dois casos mandaria a pessoa procurar na
   * estante um item que não está mais lá.
   */
  const handleDeleteFromLibrary = async (item: ItemDoAcervoNaTela) => {
    try {
      await apagarDoAcervo(item.id)
    } catch (err) {
      reportFileError(fotoSobrouNoDisco(err) ? `apagar do disco a foto de ${item.nome}` : 'apagar o token do acervo', err)
    } finally {
      await useTokenLibraryStore.getState().recarregar()
    }
  }

  /**
   * Imagem do cartão do ponto de interesse. Diferente do token e da Peça, o
   * que entra no mapa é a imagem EMBUTIDA (data URL) e não o caminho do
   * arquivo: é a única forma de ela chegar à tela do jogador sem abrir o disco
   * do mestre (ver `importPinImage` e `lib/fogFilter.ts`).
   */
  const handleChoosePinImage = async (pinId: string) => {
    try {
      const sourcePath = await pickImageFile()
      // `null` é cancelamento: a pessoa fechou o diálogo de propósito.
      if (!sourcePath) return
      useMapStore.getState().updatePin(pinId, { image: await importPinImage(sourcePath) })
    } catch (err) {
      reportFileError('escolher a imagem do ponto de interesse', err)
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

  /**
   * Salva o mapa em edição de volta na origem (`currentMapPath`) quando ela
   * existe; um mapa novo (`currentMapPath === null`) ainda não tem origem,
   * então cai em `saveMapToAppData` e passa a ter uma a partir daqui. Numa
   * aventura grava todas as cenas pendentes e o `adventure.json`
   * (`useAdventureStore.flush`). Compartilhado por `handleSave`,
   * `handleGoHome` e `saveAndOpen` — só o que acontece depois muda.
   */
  const persistMap = async (): Promise<string> => {
    const adventureState = useAdventureStore.getState()
    if (adventureState.adventure !== null) {
      const path = await adventureState.flush()
      setCurrentMapPath(path)
      return path
    }
    if (currentMapPath) {
      await saveMapToPath(map, currentMapPath)
      return currentMapPath
    }
    const path = await saveMapToAppData(map)
    setCurrentMapPath(path)
    return path
  }

  /** Um clique na lista "Cenas". O que foi feito na cena de onde se sai fica no cache, esperando o Salvar. */
  // Trocar de cena à mão (lista, nova cena, Voltar, pino de viagem) é o mestre escolhendo a vista: desliga o "Seguir".
  const handleSelectScene = (sceneId: string) => {
    useFollowStore.getState().stop()
    useAdventureStore.getState().switchScene(sceneId)
  }

  /** "+ Nova cena": a aventura nasce aqui quando o mapa ainda era solto. */
  const handleCreateScene = (name: string) => {
    useFollowStore.getState().stop()
    useAdventureStore.getState().createScene(name, currentMapPath)
  }

  const handleGoBack = () => {
    useFollowStore.getState().stop()
    if (previousSceneId !== null) useAdventureStore.getState().switchScene(previousSceneId)
  }

  const handleTravelPin = (pinId: string, exitId?: string) => {
    useFollowStore.getState().stop()
    useAdventureStore.getState().travelThroughPin(pinId, exitId)
  }

  /**
   * O destino do pino de viagem aberto no painel: o que ele diz ("Leva a
   * Cripta", "Sem destino") e o que o "Leva a…" oferece. A ligação vive no
   * `adventureStore` — o painel só lê e pede.
   */
  const pinTravelPanel = (pin: Pin) => {
    const scenes = { adventure, activeSceneId, cache: sceneCache }
    return {
      pinId: pin.id,
      // Encruzilhada: uma linha por saída, a principal primeiro.
      exits: pinExitsTravelOf(scenes, map, pin),
      scenes: travelSceneOptions(scenes),
      pinsIn: (sceneId: string) => pinTravelOptions(scenes, map, sceneId, pin.id),
      onLinkNew: (sceneId: string, exitId: string | null) => {
        useAdventureStore.getState().linkPinToNewArrival(pin.id, sceneId, exitId)
      },
      onLinkExisting: (sceneId: string, partnerId: string, exitId: string | null) => {
        useAdventureStore.getState().linkPinToExisting(pin.id, sceneId, partnerId, exitId)
      },
      onUnlink: (exitId: string) => useAdventureStore.getState().unlinkPin(pin.id, exitId),
      onRename: (exitId: string, rotulo: string) => useAdventureStore.getState().renamePinExit(pin.id, exitId, rotulo),
      // Pelo mesmo caminho do clique no pino: ir por uma saída é mexer na
      // vista, e desliga o "Seguir" (G7).
      onGo: (exitId: string) => handleTravelPin(pin.id, exitId),
      // O modo é do pino desta cena, com desfazer como o resto do painel; o
      // par da outra cena fica como está.
      passage: passageOf(pin),
      onPassageChange: (passagem: PinPassage) => useMapStore.getState().updatePin(pin.id, { passagem }),
      // Mão única mora no PAR (cena de fundo): marcar e desmarcar vão pela
      // aventura, fora do desfazer desta cena.
      onOneWayChange: (exitId: string, on: boolean) => {
        useAdventureStore.getState().setPinOneWay(pin.id, exitId, on)
      },
      arrivalOnly: isArrivalOnly(pin),
    }
  }

  /**
   * "Reunir o grupo aqui" confirmado no painel do pino `pinId`. Lê tudo de
   * novo na hora — jogadores da ponte, mundo e pino das stores —, porque a
   * lista pode ter ficado aberta enquanto alguém andava. Quem vem de outra
   * cena atravessa pelo caminho do "Mandar para…" (aviso "O mestre reuniu o
   * grupo", sem nome de cena); quem já está aqui só anda. Quem não coube ou
   * não pôde vir, o mestre fica sabendo.
   */
  const handleGather = (pinId: string, playerIds: string[]) => {
    const bridge = hostBridgeRef.current
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    if (bridge === null || pin === undefined) return
    const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
    const wanted = new Set(playerIds)
    const members = partyMembers(bridge.players(), world).filter((member) => wanted.has(member.playerId))
    const plan = planGather(members, world, pin)
    const failed = applyGatherPlan(plan, {
      sceneId: world.open.sceneId,
      bringFromOtherScene: (playerId, sceneId, at) => bridge.sendPlayer(playerId, sceneId, null, at),
      placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
    })
    if (plan.leftOut.length > 0) useToastStore.getState().push('error', `Sem casa livre perto do pino para: ${plan.leftOut.join(', ')}. As fichas ficaram onde estavam.`)
    if (failed.length > 0) useToastStore.getState().push('error', `Não deu para trazer: ${failed.join(', ')}. A cena ou a ficha mudou; tente de novo.`)
  }

  /**
   * Token nasce no centro da área visível do canvas (câmera da store, que o
   * PixiCanvas mantém em dia a cada pan/zoom) e já selecionado, para o painel
   * mostrar o Nome dele. Sem o container montado cai em (0,0), como antes.
   * `at` (ferramenta Token, clique no mapa) troca o centro pelo ponto clicado.
   *
   * O ponto pedido é só o PEDIDO: `findTokenSpawn` (lib/tokenPlacement.ts)
   * empurra a peça para o lugar livre mais perto quando o disco cairia em
   * cima da linha de uma parede — antes disto, com a vista enquadrada numa
   * parede, a peça nascia atravessada nela e o app não dizia nada. Vale
   * também para o clique da ferramenta Token: o usuário aponta mais ou menos,
   * o app assenta a peça onde ela cabe. Sem lugar livre por perto ele não
   * cria peça nenhuma e FALA por quê (toast), em vez de largar na parede.
   *
   * Lê mapa e câmera de `getState()` e não da closure de render: este handler
   * também vai como prop para dentro do PixiCanvas, e lá o valor capturado
   * pode ser de um render anterior — mesmo motivo de a câmera já ser lida
   * assim antes desta mudança.
   */
  const criarToken = (
    name: string,
    opts: { at?: { x: number; y: number }; size?: number; id?: string; image?: string | null; imageData?: string | null } = {},
  ): string | null => {
    const host = canvasHostRef.current
    const { map: currentMap, camera } = useMapStore.getState()
    const size = opts.size ?? NEW_TOKEN_SIZE
    const requested = opts.at ?? (host ? viewportCenterWorld(camera, host.clientWidth, host.clientHeight) : { x: 0, y: 0 })
    const spot = findTokenSpawn(requested, currentMap.walls, {
      // O raio acompanha o TAMANHO da peça: o NPC de 2 células vindo do acervo
      // precisa de mais espaço livre que o disco de uma célula, e medir pelo
      // tamanho fixo o assentaria encostado na parede.
      radius: tokenRadiusFor(currentMap.grid, size),
      clearance: wallClearanceForScale(camera.scale),
    })
    if (spot === null) {
      useToastStore.getState().push('error', NO_TOKEN_SPOT_TEXT)
      return null
    }
    // A foto entra JUNTO com a peça, num `addToken` só: criar a peça e depois
    // chamar `setTokenImage` empilhava DUAS entradas de desfazer para um clique
    // (o primeiro Ctrl+Z tirava só a foto), e a segunda, chegando depois da
    // cópia do arquivo, ainda podia rodar sobre um mapa que já não tinha esse
    // token — um no-op silencioso que mesmo assim zerava o Refazer.
    const id = opts.id ?? crypto.randomUUID()
    addToken({
      id,
      characterId: null,
      name,
      x: spot.x,
      y: spot.y,
      size,
      image: opts.image ?? null,
      imageData: opts.imageData ?? null,
    })
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id }))
    return id
  }

  /** Assinatura que a barra de ações e o clique da ferramenta Token já usam:
   *  cria e esquece. Quem precisa do `id` (o acervo) chama `criarToken`. */
  const handleAddToken = (name: string, at?: { x: number; y: number }) => {
    criarToken(name, { at })
  }

  const handleSave = async () => {
    try {
      await persistMap()
      useSessionStore.getState().markSaved()
      useToastStore.getState().push('info', MAP_SAVED_TEXT)
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  /** Roda o mesmo salvamento de `handleSave` e só depois troca para o menu — sem diálogo. */
  const handleGoHome = async () => {
    try {
      await persistMap()
      useSessionStore.getState().markSaved()
      useToastStore.getState().push('info', MAP_SAVED_TEXT)
      setScreen('menu')
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  /**
   * Põe no editor o que `openMapFile` leu: o mapa pedido e, se ele é cena de
   * uma aventura, as outras cenas na lista. O store marca o ponto de
   * sincronia com o disco (`markSaved`) — portal antigo convertido ao abrir
   * continua pendente, porque a conversão ainda não foi gravada.
   */
  const openInEditor = (opened: OpenedMapFile) => {
    useAdventureStore.getState().open(opened)
    setCurrentMapPath(opened.path)
  }

  /** Abre pelo seletor de arquivo. Não checa trabalho não salvo — quem checa é `askBeforeReplacingMap`. */
  const openMapFromPicker = async () => {
    try {
      const path = await pickMapJsonToOpen()
      if (!path) return
      openInEditor(await openMapFile(path))
      setScreen('editor')
    } catch (err) {
      reportFileError('abrir o mapa', err)
    }
  }

  /** Abre um caminho já escolhido (lista "Carregar Mapa"). Mesma regra de checagem acima. */
  const openMapFromPath = async (path: string) => {
    try {
      openInEditor(await openMapFile(path))
      setScreen('editor')
    } catch (err) {
      reportFileError('abrir o mapa', err)
    }
  }

  /**
   * Porta única de toda troca de mapa: com trabalho não salvo, PERGUNTA antes
   * e o seletor de arquivo só abre depois da resposta; sem trabalho pendente,
   * abre direto — abrir um mapa logo depois de salvar não pergunta nada.
   */
  const askBeforeReplacingMap = (run: () => Promise<void>): void => {
    if (!hasUnsavedWork()) {
      void run()
      return
    }
    unsavedOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPendingOpen({ run })
  }

  const handleOpen = () => askBeforeReplacingMap(openMapFromPicker)

  const handleOpenSavedPath = (path: string) => askBeforeReplacingMap(() => openMapFromPath(path))

  const closeUnsavedDialog = () => {
    setPendingOpen(null)
    unsavedOpenerRef.current?.focus()
    unsavedOpenerRef.current = null
  }

  const discardAndOpen = () => {
    const pending = pendingOpen
    setPendingOpen(null)
    unsavedOpenerRef.current = null
    if (pending) void pending.run()
  }

  const saveAndOpen = async () => {
    const pending = pendingOpen
    try {
      await persistMap()
      useSessionStore.getState().markSaved()
      useToastStore.getState().push('info', MAP_SAVED_TEXT)
    } catch (err) {
      // Falhou salvar: a pergunta CONTINUA aberta. Fechar aqui descartaria o
      // desenho exatamente no caso em que ele não chegou ao disco.
      reportFileError('salvar o mapa', err)
      return
    }
    setPendingOpen(null)
    unsavedOpenerRef.current = null
    if (pending) void pending.run()
  }

  const unsavedDialog = pendingOpen ? (
    <UnsavedChangesDialog
      onSaveAndContinue={() => void saveAndOpen()}
      onDiscardAndContinue={discardAndOpen}
      onCancel={closeUnsavedDialog}
    />
  ) : null

  /**
   * Onda 2, item 11 (Frente D) — Ctrl+S salva sem diálogo, só no editor; Ctrl+O
   * faz o mesmo que o botão "Abrir..." da barra. Fica DEPOIS de `handleOpen`:
   * as deps são lidas no render e um `const` ainda não declarado quebraria.
   * `handleSave`/`handleOpen` entram nas deps (não memoizados) de propósito: eles
   * fecham sobre `currentMapPath`/`map` via `persistMap`, então uma dep
   * desatualizada salvaria no caminho ou conteúdo ERRADO — o mesmo cuidado que
   * o app já toma em `pixi/PixiCanvas.tsx` lendo `useMapStore.getState()` fresco
   * a cada gesto. Em campo de texto os dois ficam com o comportamento nativo.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== 'editor') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return
      const ctrlOrCmd = event.ctrlKey || event.metaKey
      if (!ctrlOrCmd || event.shiftKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key !== 's' && key !== 'o') return
      event.preventDefault()
      void (key === 's' ? handleSave() : handleOpen())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen, handleSave, handleOpen])

  const handleCreate = (newMap: MapData) => {
    useAdventureStore.getState().reset()
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
      // O mapa importado já ganha pasta própria em mapsDir/importedMapId — mesma
      // lógica de "sincronizar currentMapPath com a origem" de handleOpen, senão
      // o próximo Salvar/Início gravaria por engano no caminho do mapa anterior.
      openInEditor(await openMapFile(importedPath))
    } catch (err) {
      reportFileError('importar a pasta do mapa', err)
    }
  }

  // Avisos e erros valem em toda tela, não só no editor: "Mapa salvo" ao sair
  // por Início e um erro ao abrir um mapa da lista aparecem no menu. A
  // pergunta de trabalho não salvo anda junto pelo mesmo motivo — ela também
  // dispara da lista "Carregar Mapa", fora do editor.
  const toastStack = (
    <>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      {unsavedDialog}
    </>
  )

  if (screen === 'menu') {
    return (
      <>
        <MainMenu
          onCreate={() => setScreen(createMapScreen())}
          onLoad={() => setScreen('load-map')}
          onOptions={() => setScreen('options')}
        />
        {toastStack}
      </>
    )
  }

  if (screen === 'map-type') {
    return (
      <>
        <MapTypePicker onPickDungeon={() => setScreen('new-dungeon')} onBack={() => setScreen(parentScreen(screen))} />
        {toastStack}
      </>
    )
  }

  if (screen === 'new-dungeon') {
    return (
      <>
        <NewDungeonMap onCreate={handleCreate} onBack={() => setScreen(parentScreen(screen))} />
        {toastStack}
      </>
    )
  }

  if (screen === 'load-map') {
    return (
      <>
        <LoadMapScreen onOpenPath={handleOpenSavedPath} onBack={() => setScreen(parentScreen(screen))} />
        {toastStack}
      </>
    )
  }

  if (screen === 'options') {
    return (
      <>
        <OptionsScreen onBack={() => setScreen(parentScreen(screen))} />
        {toastStack}
      </>
    )
  }

  return (
    <div className="lb-editor">
      {/* Os avisos vêm PRIMEIRO no DOM, antes do trilho. A posição na tela é do
          CSS (absoluto, z-index 30), mas a ordem do texto conta: com os avisos
          depois do painel Grupo, o texto do editor lia "Bruno … Ana quer passar
          por …" e uma busca pela frase do pedido de Bruno achava o editor
          inteiro depois de o pedido dele já ter sido respondido. Primeiro no
          DOM também põe os avisos que esperam resposta no começo do Tab. */}
      {toastStack}
      <div className="lb-editor__canvas" ref={canvasHostRef}>
        <PixiCanvas
          gridAlignPreview={gridAlignPreview}
          onBackgroundImageSizeChange={setBackgroundImageSize}
          onCameraChange={(camera: Camera) => setCameraScale(camera.scale)}
          resetZoomRequest={resetZoomRequest}
          cameraRequest={sceneCameraRequest}
          focusObstacles={canvasObstacles}
          onTravelPin={handleTravelPin}
          onLaserMove={(x, y) => hostBridgeRef.current?.laserMove(x, y)}
          onRoomCreated={() => {
            // O nome é pedido sobre a própria Sala (PixiCanvas); a aba Mapa só
            // mostra o resto da Sala recém-criada, sem tirar o foco do canvas.
            setRailTab('map')
          }}
          onPlaceToken={handleAddToken}
        />
      </div>

      <div className="lb-editor__top" ref={editorTopRef}>
        <Toolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          lastDrawingTool={lastDrawingTool}
          variantBindings={{
            doorKind: { value: doorKind, onChange: setDoorKind },
            wallKind: { value: wallKind, onChange: setWallKind },
            regionFillPattern: { value: regionFillPattern, onChange: setRegionFillPattern },
            polygonSides: { value: polygonSides, onChange: setPolygonSides },
            stairSizePreset: { value: stairSizePreset, onChange: setStairSizePreset },
            drawTexture: { value: drawTexture, onChange: setDrawTexture },
            eraseMode: { value: eraseMode, onChange: setEraseMode },
            floorShapeKind: { value: floorShapeKind, onChange: setFloorShapeKind },
            floorOp: { value: floorOp, onChange: setFloorOp },
            floorPolygonSides: { value: floorPolygonSides, onChange: setFloorPolygonSides },
            floorBrushSize: { value: floorBrushSize, onChange: setFloorBrushSize },
            drawShape: { value: activeTool, onChange: setActiveTool },
          }}
        />
      </div>

      <div className="lb-editor__rail" ref={editorRailRef}>
        {withRoomTabs(
          <PropertiesPanel
            scenes={
              <ScenesSection
                scenes={sceneList({ adventure, activeSceneId, cache: sceneCache }, map)}
                onSelect={handleSelectScene}
                onCreate={handleCreateScene}
                onRename={(sceneId, name) => useAdventureStore.getState().renameScene(sceneId, name)}
                // Mesmas linhas do painel Grupo: quem está em cada cena e os pedidos que esperam.
                people={roomPlayers.length === 0 ? undefined : peopleByScene(partyMembers(roomPlayers, roomPanelWorld()))}
                // Recado por cena só com a sala aberta: sem sala não há quem leia.
                onNote={room === null ? undefined : (sceneId, text) => hostBridgeRef.current?.sceneNote(sceneId, text) ?? null}
                // A flag grava com a aventura; o snapshot sai pelo throttle do mapa para quem já está lá.
                onTogglePlanKnown={(sceneId, known) => {
                  useAdventureStore.getState().setScenePlanKnown(sceneId, known)
                  hostBridgeRef.current?.notifyMapChanged()
                }}
                players={roomPlayers.map((p) => ({ playerId: p.playerId, name: p.name }))}
                // "Revelar planta para…" só com a sala aberta: sem sala não há para quem.
                onRevealPlanFor={room === null ? undefined : (sceneId, playerIds) => hostBridgeRef.current?.revealPlanFor(sceneId, playerIds) ?? null}
              />
            }
            mapName={map.name}
            mapWidth={map.width}
            mapHeight={map.height}
            mapGrid={map.grid}
            activeTool={activeTool}
            groups={propertyGroups}
            lineCap={
              activeTool === 'brush' || activeTool === 'line' || activeTool === 'curve'
                ? {
                    cap: drawCap,
                    onCapChange: setDrawCap,
                    // Pincel não entra: a aparência do traço livre já é a
                    // textura (caneta/lápis/marcador) — ver LineCapControls.
                    dash: activeTool === 'brush' ? null : { dash: drawDash, onDashChange: setDrawDash },
                  }
                : selectedDrawing && 'cap' in selectedDrawing
                  ? {
                      cap: selectedDrawing.cap ?? 'round',
                      onCapChange: (cap: DrawingCap) => setDrawingCap(selectedDrawing.id, cap),
                      dash:
                        selectedDrawing.kind === 'line' || selectedDrawing.kind === 'curve'
                          ? {
                              dash: selectedDrawing.dash ?? 'solid',
                              onDashChange: (dash: DrawingDash) => setDrawingDash(selectedDrawing.id, dash),
                            }
                          : null,
                    }
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
            drawingStyle={selectedDrawing && selectedDrawing.kind !== 'text' ? {
              // Desenho já selecionado: o painel edita ELE, não a preferência do próximo.
              target: 'selected',
              color: selectedDrawing.color,
              onColorChange: (c: string) =>
                liveSliderChange(`drawing-color-${selectedDrawing.id}`, () =>
                  useMapStore.getState().setDrawingColorLive(selectedDrawing.id, c),
                ),
              width: selectedDrawing.width,
              onWidthChange: (w: number) =>
                liveSliderChange(`drawing-width-${selectedDrawing.id}`, () =>
                  useMapStore.getState().setDrawingWidthLive(selectedDrawing.id, w),
                ),
              filled: drawFilled,
              onFilledChange: setDrawFilled,
              fillAlpha: drawFillAlpha,
              onFillAlphaChange: setDrawFillAlpha,
              showFilled: false,
              showWidth: true,
              fontSize: drawFontSize,
              onFontSizeChange: setDrawFontSize,
              fontFamily: drawFontFamily,
              onFontFamilyChange: setDrawFontFamily,
              showFontSize: false,
            } : {
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
            pathStyle={{
              color: pathColor,
              onColorChange: setPathColor,
              widthCells: pathWidthCells,
              onWidthCellsChange: setPathWidthCells,
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
            }}
            onSetPropLayer={setPropLayer}
            selection={{
              // SelectionControls (Onda 4, item 24) só precisa de um resumo:
              // `kind` do primeiro item (só importa quando count === 1) +
              // quantos itens no total. `null` = seleção vazia (botão desabilita).
              selection: selection.length > 0 ? { kind: selection[0].kind, count: selection.length } : null,
              defaultTokenName: mapFactory.nextTokenName(map.tokens),
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
              onToggleSecret: handleToggleSecret,
              onRevealPassage: handleRevealPassage,
            }}
            doorKind={{
              kind: selectedWall?.door ? selectedWall.door.kind : doorKind,
              onKindChange: handleDoorKindChange,
            }}
            doorMode={{ mode: doorMode, onModeChange: setDoorMode }}
            wallStyle={{
              wallKind: selectedWall ? selectedWall.wallKind : wallKind,
              onWallKindChange: handleWallKindChange,
              thickness: selectedWall ? selectedWall.thickness : wallThickness,
              onThicknessChange: handleWallThicknessChange,
              lineStyle: selectedWall ? selectedWall.lineStyle : wallLineStyle,
              onLineStyleChange: handleWallLineStyleChange,
            }}
            selectedProp={selectedProp}
            propTransform={{
              onRotationChange: (rotation) => selectedProp && updateProp(selectedProp.id, { rotation }),
              onLockedChange: (locked) => selectedProp && updateProp(selectedProp.id, { locked }),
              onHiddenChange: (hidden) => selectedProp && updateProp(selectedProp.id, { hidden }),
              onSecretChange: (secret) => selectedProp && useMapStore.getState().setItemSecret('prop', selectedProp.id, secret),
            }}
            selectedToken={selectedToken}
            tokenName={{
              onNameChange: (name) => selectedToken && useMapStore.getState().renameToken(selectedToken.id, name),
              // Com histórico (`updateToken`): trocar o nome que a mesa lê se desfaz com Ctrl+Z.
              onPublicNameChange: (publicName) => selectedToken && updateToken(selectedToken.id, { publicName }),
            }}
            tokenImage={{
              onChangeImage: () => selectedToken && handleChangeTokenImage(selectedToken.id),
              onClearImage: () => selectedToken && setTokenImage(selectedToken.id, null),
              onSaveToLibrary: () => selectedToken && void handleSaveTokenToLibrary(selectedToken),
            }}
            tokenColor={{
              // `null` devolve o token à cor de fábrica: grava o campo como
              // null em vez de apagá-lo, para o undo (`updateToken` passa por
              // `withHistory`) ter o que restaurar.
              onColorChange: (color) => selectedToken && updateToken(selectedToken.id, { color }),
            }}
            tokenSize={{
              // Mesmo caminho da cor: `updateToken` passa por `withHistory`,
              // então escolher o tamanho errado se desfaz com Ctrl+Z. Não
              // mexe em x/y — a ficha cresce em volta de onde já está, e é o
              // próximo arrasto que a assenta na grade (`seatTokenCenter`).
              onSizeChange: (size) => selectedToken && updateToken(selectedToken.id, { size }),
            }}
            tokenLights={{
              lights: selectedToken ? lightsOnToken(map, selectedToken.id) : [],
              onSelectLight: (lightId) => setSelection(selectionOfItem({ kind: 'light', id: lightId })),
              onDetach: (lightId) => setLightAttachment(lightId, null),
            }}
            // "Visto por": só com a sala aberta, lendo as telas que saíram pelo fio (`HostBridge.tokenSeenBy`).
            tokenSeenBy={
              room !== null && hostBridgeRef.current !== null
                ? { watch: hostBridgeRef.current.watchPlayerScreens, read: hostBridgeRef.current.tokenSeenBy }
                : undefined
            }
            tokenTransform={{
              onRotationChange: (rotation) => selectedToken && updateToken(selectedToken.id, { rotation }),
              onLockedChange: (locked) => selectedToken && updateToken(selectedToken.id, { locked }),
              onHiddenChange: (hidden) => selectedToken && updateToken(selectedToken.id, { hidden }),
              onSecretChange: (secret) => selectedToken && useMapStore.getState().setItemSecret('token', selectedToken.id, secret),
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
              color: selectedRegion ? selectedRegion.fillColor : isRoomTool(activeTool) ? roomFillColor : regionFillColor,
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
            regionTransform={{
              onLockedChange: (locked) => selectedRegion && setRegionLocked(selectedRegion.id, locked),
            }}
            room={{
              onNameChange: (name) => selectedRegion && setRoomName(selectedRegion.id, name),
              onNameHiddenFromPlayersChange: (hidden) =>
                selectedRegion && useMapStore.getState().setRoomNameHiddenFromPlayers(selectedRegion.id, hidden),
              onRoofChange: (roof) => selectedRegion && useMapStore.getState().setRoomRoof(selectedRegion.id, roof),
              onWidthChange: (width) =>
                selectedRegion && resizeRoomDimensions(selectedRegion.id, width, roomDimensions(selectedRegion.points).height),
              onHeightChange: (height) =>
                selectedRegion && resizeRoomDimensions(selectedRegion.id, roomDimensions(selectedRegion.points).width, height),
              onRotationChange: (degrees) => selectedRegion && useMapStore.getState().setRoomRotation(selectedRegion.id, degrees),
              onRotateBy: (degrees) => selectedRegion && useMapStore.getState().rotateRoom(selectedRegion.id, degrees),
              parentName: selectedRegionParent ? selectedRegionParent.room?.name.trim() || 'Sala sem nome' : undefined,
              onCreateRoomInside: selectedRegion?.room
                ? () => {
                    const store = useMapStore.getState()
                    store.setActiveTool('room')
                    store.setPendingParentRoom(selectedRegion.id)
                  }
                : undefined,
            }}
            playerSecret={
              secretTarget && {
                secret: secretTarget.secret,
                onSecretChange: (secret) => useMapStore.getState().setItemSecret(secretTarget.kind, secretTarget.id, secret),
                // "Quem vê" só no pino e só com a sala aberta: a lista vive na sessão do host.
                audience:
                  secretTarget.kind === 'pin' && room !== null
                    ? {
                        players: partyMembers(roomPlayers, roomPanelWorld()).map((member) => ({
                          playerId: member.playerId,
                          name: member.name,
                          color: member.token?.color ?? null,
                        })),
                        chosen: pinAudiences[secretTarget.id] ?? null,
                        onChange: (chosen) => hostBridgeRef.current?.setPinAudience(secretTarget.id, chosen),
                      }
                    : null,
              }
            }
            concealZone={
              selectedConcealZone && {
                name: selectedConcealZone.name,
                onNameChange: (name) => useMapStore.getState().updateConcealZone(selectedConcealZone.id, { name }),
                revealed: selectedConcealZone.revealed,
                onRevealedChange: (revealed) => useMapStore.getState().updateConcealZone(selectedConcealZone.id, { revealed }),
                onDelete: () => useMapStore.getState().removeConcealZone(selectedConcealZone.id),
              }
            }
            concealBrush={{
              mode: revealBrushMode,
              onModeChange: setRevealBrushMode,
              width: revealBrushWidth,
              onWidthChange: setRevealBrushWidth,
            }}
            pin={{
              kind: selectedPin?.kind ?? pinKind,
              // Com um pino aberto, o controle edita ESSE pino; sem nenhum, ele
              // guarda a preferência do próximo — mesmo padrão de DoorKindControls.
              // Pino que deixa de ser de viagem perde o destino no MESMO passo
              // do desfazer; o par da outra cena é desligado pelo adventureStore.
              onKindChange: (kind) =>
                selectedPin
                  ? useMapStore.getState().updatePin(selectedPin.id, kind === 'viagem' ? { kind } : { kind, destino: null })
                  : useMapStore.getState().setPinKind(kind),
              travel: selectedPin?.kind === 'viagem' ? pinTravelPanel(selectedPin) : null,
              // Só com a sala aberta: sem sala não há jogador para reunir.
              gather:
                selectedPin && room !== null
                  ? {
                      pinId: selectedPin.id,
                      candidates: gatherCandidates(partyMembers(roomPlayers, roomPanelWorld())),
                      onGather: (playerIds) => handleGather(selectedPin.id, playerIds),
                    }
                  : null,
              description: selectedPin?.description ?? null,
              onDescriptionChange: (description) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { description }),
              // Veracidade, nunca `=== true`: `locked` é opcional no schema e
              // pino de mapa salvo antes desta fase chega sem o campo.
              locked: !!selectedPin?.locked,
              onLockedChange: (locked) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { locked }),
              image: selectedPin?.image ?? null,
              onChooseImage: () => selectedPin && void handleChoosePinImage(selectedPin.id),
              onClearImage: () => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { image: null }),
              onDelete: () => selectedPin && useMapStore.getState().removePin(selectedPin.id),
            }}
            pinIcon={{
              // Mesma ligação dupla do tipo logo acima: com um pino aberto, o
              // controle edita ESSE pino; sem nenhum, guarda a preferência do
              // próximo. `?? null` porque `icon` é opcional no schema — pino
              // salvo antes deste campo chega sem ele.
              icon: selectedPin ? selectedPin.icon ?? null : pinIcon,
              onIconChange: (icon) =>
                selectedPin
                  ? useMapStore.getState().updatePin(selectedPin.id, { icon: icon ?? undefined })
                  : useMapStore.getState().setPinIcon(icon),
            }}
            pinSelected={selectedPin !== null}
            tokenLibrary={{
              itens: acervoItens,
              aviso: acervoAviso,
              onPlace: (item) => void handlePlaceFromLibrary(item),
              onDropOnMap: handleDropFromLibrary,
              onDelete: (item) => void handleDeleteFromLibrary(item),
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
              tokens: map.tokens.map((t) => ({ id: t.id, name: t.name })),
              onAttach: (tokenId) => selectedLight && setLightAttachment(selectedLight.id, tokenId),
              onDetach: () => selectedLight && setLightAttachment(selectedLight.id, null),
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
            selectedFloorPiece={selectedFloorPiece}
            floorPieceControls={{
              index: selectedFloorIndex,
              count: map.floor.length,
              grid: map.grid,
              onChange: (patch) => selectedFloorPiece && updateFloorPiece(selectedFloorPiece.id, patch),
              onReorder: (delta) => selectedFloorPiece && reorderFloorPiece(selectedFloorPiece.id, delta),
              // removeSelected (não removeFloorPiece) para também limpar a seleção.
              onRemove: removeSelected,
            }}
            floorStyle={{
              style: map.floorStyle,
              onStyleChange: setFloorStyle,
              frame: map.frame,
              // Moldura nova envolve o mapa inteiro (moldura de mapa desenhado à mão); a recriação usa retângulo próprio.
              onFrameChange: (frame) => setMapFrame(frame),
              defaultFrameRect: { x: 0, y: 0, w: map.width * map.grid, h: map.height * map.grid },
              hasFloorContent: map.floor.length > 0 || map.lines.length > 0 || map.markers.length > 0,
            }}
          />,
        )}
        <ActionBar
          onSave={handleSave}
          onOpen={handleOpen}
          onImportBackground={handleImportBackground}
          onExportFolder={handleExportFolder}
          onImportFolder={handleImportFolder}
          onGoHome={handleGoHome}
          onGoBack={canGoBackToScene ? handleGoBack : undefined}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          hasBackgroundImage={map.background.type === 'image' && map.background.src !== ''}
          onFloorFromBackground={() => void handleFloorFromBackground()}
          onDetailsFromBackground={() => void handleDetailsFromBackground()}
          onRecreateMinimapFromBackground={() => void handleMinimapFromBackground()}
        />
      </div>

      <ZoomHud scale={cameraScale} onReset={() => setResetZoomRequest((n) => n + 1)} />
      {mirroredPlayer !== undefined &&
        hostBridgeRef.current !== null &&
        createPortal(
          <LivePlayerMirror
            key={mirroredPlayer.playerId}
            playerName={mirroredPlayer.name}
            playerId={mirroredPlayer.playerId}
            watch={hostBridgeRef.current.watchPlayerScreens}
            read={hostBridgeRef.current.playerScreen}
            onClose={() => setMirrorId(null)}
          />,
          document.body,
        )}
    </div>
  )
}

export default App
