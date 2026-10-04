import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PixiCanvas } from './pixi/PixiCanvas'
import { ZoomHud } from './components/ZoomHud'
import { DiceDock } from './components/DiceDock'
import { MasterChatPanel, NO_CHAT_UNREAD, type ChatUnread } from './components/MasterChatPanel'
import { useDiceStore } from './stores/diceStore'
import { PisoHud } from './components/PisoHud'
import { temPisos } from './lib/pisos'
import { corDaCamada, proximoNomeDeCamada } from './lib/camadasDoChao'
import { alvoDoPincel, NOVA_CAMADA } from './lib/camadasDoPincel'
import type { PincelNasCamadas } from './components/FloorLayersList'
import { Toast } from './components/Toast'
import { useToastStore, type ToastKind } from './stores/toastStore'
import { ensinaOQueFazer } from './lib/erroQueEnsina'
import { motivoDaFalhaDeArquivo, temPonteDoApp } from './lib/foraDoApp'
import { useSessionStore, subscribeToDirtyFlag, saveOpenMap } from './stores/sessionStore'
import { restoreRecoveryCopy, startRecoveryAutosave, type RecoveryAutosave } from './stores/recoveryAutosave'
import { clearRecoveryCopy, formatRecoveryTime, readRecoveryCopy, writeRecoveryCopy, type RecoveryCopy } from './lib/recoveryCopy'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { createHostBridge, type HostBridge, type RoomInfo, type TunnelState } from './net/hostBridge'
import { hostPlayerChanges } from './net/playerChanges'
import { setPinPassageFromRequest } from './net/pinPassageFromRequest'
import { useSignalStore } from './stores/signalStore'
import { goToPointAction } from './stores/pointActionGo'
import { useAwayTokensStore } from './stores/awayTokensStore'
import { laserStrokeEnded, useLaserStore } from './stores/laserStore'
import { usePlayerLaserStore } from './stores/playerLaserStore'
import { useNoiseStore } from './stores/noiseStore'
import { noiseFeedbackText } from './lib/noise'
import { isEditableTarget, PAUSE_NPCS_SHORTCUT } from './lib/keymap'
import { useFollowStore } from './stores/followStore'
import { useTerritorioStore } from './stores/territorioStore'
import { alertaDaCena, coresDasFaccoes, corCss, faccaoHerdada } from './lib/faccoes'
import { advanceTurn, startTurn, useInitiativeStore } from './stores/initiativeStore'
import { useClockStore } from './stores/clockStore'
import { turnTokenIdOn } from './lib/initiative'
import { carryRefsOf } from './lib/carry'
import { consertarNaAventura } from './stores/revisaoAventura'
import { useFollowPlayer } from './stores/useFollowPlayer'
import { useArrivalTextSettings } from './stores/useArrivalTextSettings'
import { subscribeToPlayerWorldChanges } from './stores/playerWorldSubscription'
import { playSignalSound } from './lib/signalSound'
import { comSomDePassagem, instalarSonsDoMestre } from './lib/sons/sonsDoMestre'
import { faceRangeCellsOrNull } from './lib/tokenVulto'
import { createSignalRouter } from './net/chamadoDeFundo'
import { tableSceneKey, type AppliedMove, type MasterChatState, type PinClueState, type PlayerInfo, type SecretCheckState } from './net/hostSession'
import { tableScreenUrl } from './lib/tableScreen'
import { giftScenesOf, RoomPanel, roomPanelTokensOf } from './components/RoomPanel'
import { hostCluesProps } from './components/CluesSection'
import { LivePlayerMirror } from './components/PlayerMirror'
import { masterDestinationMarks, partyDestinations, partyItemChange, partyMembers, peopleByScene } from './lib/party'
import { congelamentoDaMesa } from './lib/congelar'
import { jogadoresDoCorte } from './lib/corteDaTorre'
import { useDestinationStore } from './stores/destinationStore'
import { useCenaQueEspera } from './stores/useCenaQueEspera'
import { useRotinaAndandoStore } from './stores/rotinaAndandoStore'
import { usePatrulhaAndandoStore } from './stores/patrulhaAndandoStore'
import { usePausaDosNpcsStore } from './stores/pausaDosNpcsStore'
import { alternarPausaDosNpcs, useAlgumNpcAndando } from './stores/npcsAndando'
import type { TravelLogEntry } from './lib/travelLog'
import { withStoredTokens } from './lib/storedTokens'
import { loadSavedExploration, loadSavedTable, savedTableSummary, storeSavedExploration, storeSavedTable, type TableStorage } from './lib/savedTable'
import { createTauriChatStore, type ChatStore } from './lib/chatStore'
import { applyGatherPlan, gatherCandidates, planGather, sendCandidates } from './lib/gatherParty'
import { comConfronto, iniciarConfronto, proximaVez } from './lib/confronto'
import { canShowPinNow, showPinNowCandidates, showPinNowWithNotice } from './components/ShowPinNowControls'
import { RightColumn, useRightColumnOpen, type RightColumnTab, type RightColumnTabDef } from './components/RightColumn'
import { ask } from '@tauri-apps/plugin-dialog'
import { criarPedidoDeFechar } from './lib/avisoAoFechar'
import type { Bounds } from './pixi/world'
import { MainMenu } from './screens/MainMenu'
import { MapTypePicker } from './screens/MapTypePicker'
import { NewDungeonMap } from './screens/NewDungeonMap'
import { LoadMapScreen } from './screens/LoadMapScreen'
import { OptionsScreen } from './screens/OptionsScreen'
import { mapChangeCause, selectAlignableUnitCount, useMapStore } from './stores/mapStore'
import { roomHazardState } from './lib/hazards'
import { areaTriggerOfRegion } from './lib/areaTriggers'
import { saveMapToAppData, saveMapToPath, pickMapJsonToOpen, openMapFile, openMapFileFirst, mapDirFor, defaultMapsDir, type OpenedMapFile } from './lib/mapFileIO'
import { canAdvanceImposed, roomConveyorState } from './lib/conveyors'
import { cabinOf, cabinTargets, cabinTargetsOfPar } from './lib/cabins'
import { avancarMovimentoImposto, ownerFromPlayers } from './stores/avancarMovimentoImposto'
import { NO_OWNER_RADII, type OwnerVisionRadii } from './lib/imposedOccupancy'
import {
  applyItemsInScene,
  hasUnsavedWork,
  hostWorldOf,
  pinExitsTravelOf,
  pinScenesOf,
  pinTravelOptions,
  sceneDeletionInfo,
  sceneList,
  sceneMaps,
  stairTravelPanel,
  subscribeToServedScenes,
  subscribeToTravelLinks,
  travelDestinationOptions,
  useAdventureStore,
} from './stores/adventureStore'
import { ScenesSection } from './components/ScenesSection'
import { AgendaSection } from './components/AgendaSection'
import { WorldStateSection } from './components/WorldStateSection'
import { EstadoDaLuz, EstadoDaPorta, EstadoDaZona, EstadoDoPino } from './components/DependeDoEstadoControls'
import { PinCabineControls } from './components/PinCabineControls'
import { ocupantesDasCabines } from './lib/cabine'
import { UNNAMED_SCENE } from './lib/adventure'
import { PerigoDaSalaControls } from './components/PerigoDaSalaControls'
import { RotinaDaFichaControls } from './components/RotinaDaFichaControls'
import { amarradosPorEstado, type AmarraDeEstado } from './lib/estadoDoMundo'
import { MapObjectsSection } from './components/MapObjectsSection'
import { MarcasDaCena } from './components/MarcasDaCena'
import { PlaceTreeSection } from './components/PlaceTreeSection'
import { currentObjectKey, isFindObjectShortcut } from './lib/mapObjects'
import { framePlace, goToMapObject } from './stores/mapObjectNavigation'
import { fontesDaBusca, irAoAchado, mandarFichaPara } from './stores/buscaDoMestre'
import { ligacaoLevarFicha } from './stores/levarFicha'
import type { ActiveAlarmView } from './components/SceneAlarmControls'
import { PinsSection } from './components/PinsSection'
import { pinDirectory } from './lib/pinDirectory'
import {
  pickBackgroundImage,
  importBackgroundImage,
  pickImageFile,
  importPinImage,
  pinImageFromBlob,
  importTokenImage,
  importTokenImageFromBlob,
  buildTokenSharedPhoto,
  buildTokenSharedPhotoFromBlob,
} from './lib/imageImport'
import { useTokenLibraryStore } from './stores/tokenLibraryStore'
import {
  apagarDoAcervo,
  apagarPastaDoAcervo,
  criarPastaNoAcervo,
  fotoSobrouNoDisco,
  moverNoAcervo,
  recolherPastaNoAcervo,
  salvarNoAcervo,
  trazerDoAcervo,
  type ItemDoAcervoNaTela,
  type PastaDoAcervo,
} from './lib/tokenLibrary'
import { colocarPecaDoAcervo, criarToken, marcarFichaNpc, type TamanhoDaVista } from './stores/criarToken'
import { setPropImageShownToPlayers, setPropLabelForPlayers } from './stores/propPlayerLook'
import { mudarRaioDeVisaoDaSala, mudarVistaDeLonge } from './stores/visaoDeLonge'
import { pickExportFolder, pickImportFolder, exportMapFolder, importMapFolder } from './lib/mapExport'
import { join } from '@tauri-apps/api/path'
import { Toolbar } from './components/Toolbar'
import { PropertiesPanel } from './components/PropertiesPanel'
import type { RevealToControlsProps } from './components/PlayerSecretControls'
import { ActionBar } from './components/ActionBar'
import { ShortcutsDialog } from './components/ShortcutsDialog'
import { ExportImageDialog } from './components/ExportImageDialog'
import { imageExportFileName, type ImageExportOptions, type MapImageExporter } from './lib/mapImageExport'
import { saveMapImage } from './lib/mapImageSave'
import type { DoorKind, DoorSide, DrawingCap, DrawingDash, ExitPassage, MapData, Pin, PinBlockReason, PinPassage, Region, Token, Wall } from './types/map'
import { passageOf } from './lib/pins'
import { passItemOf, passTokenOptions, withPassItem, withPassToken } from './lib/pinPass'
import { isArrivalOnly, setExitPassage } from './lib/pinTravel'
import { pinAttachOptions } from './lib/pinAttach'
import { leverDoorOptions, linkedDoorOf } from './lib/lever'
import { lockDoorOptions } from './lib/pinLock'
import { pinColecaoPanel } from './components/pinColecaoPanel'
import { vehicleSeatOptions } from './lib/vehicle'
import { isDaVista } from './lib/espiar'
import type { Screen } from './types/screen'
import { createMapScreen, parentScreen } from './lib/navigation'
import * as mapFactory from './lib/mapFactory'
import { readDoorKey, setDoorKey } from './lib/doorKey'
import { countEntitiesByLayer } from './lib/layers'
import { roomDimensions } from './lib/roomOps'
import type { GridAlignResult } from './lib/gridAlign'
import { relevantPropertyGroups } from './lib/toolProperties'
import { EMPTY_SELECTION, selectionOfItem, selectionSingle, selectionToAreaSelection } from './lib/selectionModel'
import { selectionSecretState } from './lib/batchSecret'
import { isSingleGroup, NO_GROUPS } from './lib/itemGroups'
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
/**
 * "Destrancar e abrir" do MESTRE ao pedido da porta trancada: tira o cadeado e
 * abre, na cena da porta (de fundo quando o jogador está lá). É decisão do
 * mestre, então vira passo do Ctrl+Z dele — ao contrário dos retornos do
 * jogador, que vêm de `hostPlayerChanges` e ficam fora do desfazer.
 */
function unlockAndOpenDoorFromRequest(wallId: string, sceneId?: string): void {
  if (sceneId !== undefined) {
    useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => {
      const wall = m.walls.find((w) => w.id === wallId)
      return wall?.door ? mapFactory.setWallDoor(m, wallId, { ...wall.door, open: true, locked: false }) : m
    })
    return
  }
  const store = useMapStore.getState()
  const wall = store.map.walls.find((w) => w.id === wallId)
  if (wall?.door) store.setWallDoor(wallId, { ...wall.door, open: true, locked: false })
}

/**
 * "Deixar" do MESTRE ao pedido de esconder-se: liga "Oculto para jogadores"
 * na ficha, na cena dela (de fundo quando o jogador está lá). Decisão do
 * mestre, passo do Ctrl+Z dele — o mesmo toggle que o painel da ficha liga.
 */
function hideTokenFromRequest(tokenId: string, sceneId?: string): void {
  if (sceneId !== undefined) {
    useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => mapFactory.setItemSecret(m, 'token', tokenId, true))
    return
  }
  useMapStore.getState().setItemSecret('token', tokenId, true)
}

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

/**
 * Timeout de segurança do aviso ao fechar: se o diálogo nativo nunca resolver,
 * fecha mesmo assim — travar a janela do usuário é pior que perguntar de novo.
 */
const CLOSE_DIALOG_MAX_WAIT_MS = 10_000

/** Aviso de sucesso de Salvar (botão, Ctrl+S) e de sair por Início. */
const MAP_SAVED_TEXT = 'Mapa salvo'
/** Cena sem nenhum valor de iniciativa: referência estável, sem render novo à toa. */
const NO_INITIATIVE_VALUES: Readonly<Record<string, number>> = {}
/** Sala sem conversa: o chat do mestre antes da primeira linha e depois de fechar a sala. */
const NO_MASTER_CHAT: MasterChatState = { global: [], scenes: [] }

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

/** Retomar a mesa: o storage do app do mestre, ou `null` quando o acesso lança (dado bloqueado). */
function tableStorage(): TableStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** A mesa é da aventura aberta (ou do mapa solto): outra aventura não herda os donos desta. */
function currentTableId(): string {
  return useAdventureStore.getState().adventure?.id ?? useMapStore.getState().map.id
}

/**
 * CARAVANA: quem acompanha a caravana anda SEM desfazer. O passo é o do
 * arrasto do mestre; com histórico, o Ctrl+Z desfaria um seguidor por vez e o
 * seguidor refeito apagaria o refazer. Fora da ligação da ponte do host: lá só
 * entram os retornos do JOGADOR (`hostPlayerChanges`, `net/playerChanges.test.ts`).
 */
function applyCaravanMoves(moves: readonly AppliedMove[]): void {
  const open = moves.filter((move) => move.sceneId === undefined)
  if (open.length > 0) useMapStore.getState().setTokenPositionsLive(open.map(({ tokenId, x, y }) => ({ id: tokenId, x, y })))
  for (const { tokenId, x, y, sceneId } of moves) {
    if (sceneId === undefined) continue
    useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => mapFactory.setTokenPosition(m, tokenId, x, y))
  }
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
  const map = useMapStore((state) => state.map)
  const pisoAtivo = useMapStore((state) => state.pisoAtivo)
  const mapaTemPisos = useMemo(() => temPisos(map), [map])
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
  // Blocos que andam no alinhar (Sala + paredes = 1), não entradas da seleção.
  const alignableCount = useMapStore(selectAlignableUnitCount)
  const setSelection = useMapStore((state) => state.setSelection)
  // Agrupar objetos (Ctrl+G): só os grupos do mapa aberto.
  const mapGroups = useMapStore((state) => state.itemGroups[state.map.id] ?? NO_GROUPS)
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
  const setDoorOpensFrom = useMapStore((state) => state.setDoorOpensFrom)
  const setDoorSemEspiar = useMapStore((state) => state.setDoorSemEspiar)
  const revealSecretPassage = useMapStore((state) => state.revealSecretPassage)
  const turnWallIntoDoor = useMapStore((state) => state.turnWallIntoDoor)
  const doorKind = useMapStore((state) => state.doorKind)
  const setDoorKind = useMapStore((state) => state.setDoorKind)
  const doorMode = useMapStore((state) => state.doorMode)
  const setDoorMode = useMapStore((state) => state.setDoorMode)
  const roomFreeKind = useMapStore((state) => state.roomFreeKind)
  const setRoomFreeKind = useMapStore((state) => state.setRoomFreeKind)
  const roomFreeRounded = useMapStore((state) => state.roomFreeRounded)
  const setRoomFreeRounded = useMapStore((state) => state.setRoomFreeRounded)
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
  const setWallJanela = useMapStore((state) => state.setWallJanela)
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
  const trocarTipoDoMovel = useMapStore((state) => state.trocarTipoDoMovel)
  const trocarVistaDoMovel = useMapStore((state) => state.trocarVistaDoMovel)
  const setAparenciaDoMovel = useMapStore((state) => state.setAparenciaDoMovel)
  const setGridOffset = useMapStore((state) => state.setGridOffset)
  const setGridCellSize = useMapStore((state) => state.setGridCellSize)
  const setMapSize = useMapStore((state) => state.setMapSize)
  const setStairDirection = useMapStore((state) => state.setStairDirection)
  const setStairShape = useMapStore((state) => state.setStairShape)
  const setRoomName = useMapStore((state) => state.setRoomName)
  const resizeRoomDimensions = useMapStore((state) => state.resizeRoomDimensions)
  const setMapScale = useMapStore((state) => state.setMapScale)
  const setMeasurementMode = useMapStore((state) => state.setMeasurementMode)
  const setMovementRules = useMapStore((state) => state.setMovementRules)
  const setWorldMap = useMapStore((state) => state.setWorldMap)
  const arrivalTextSettings = useArrivalTextSettings()
  const setOutdoor = useMapStore((state) => state.setOutdoor)
  const setSceneFloor = useMapStore((state) => state.setSceneFloor)
  const setSceneVisionCells = useMapStore((state) => state.setSceneVisionCells)
  const setSceneDark = useMapStore((state) => state.setSceneDark)
  const setFaceRangeCells = useMapStore((state) => state.setFaceRangeCells)
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
  const brushMode = useMapStore((state) => state.brushMode)
  const setBrushMode = useMapStore((state) => state.setBrushMode)
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
  const floorCamada = useMapStore((state) => state.floorCamada)
  const setFloorCamada = useMapStore((state) => state.setFloorCamada)
  const camadaDoPincelId = useMapStore((state) => state.camadaDoPincelId)
  const setCamadaDoPincel = useMapStore((state) => state.setCamadaDoPincel)
  const mobiliaTipo = useMapStore((state) => state.mobiliaTipo)
  const setMobiliaTipo = useMapStore((state) => state.setMobiliaTipo)
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
  const acervoPastas = useTokenLibraryStore((state) => state.pastas)
  const acervoPodeOrganizar = useTokenLibraryStore((state) => state.podeOrganizar)
  useEffect(() => {
    void useTokenLibraryStore.getState().recarregar()
  }, [])

  // Multiplayer em LAN: ponte do mestre criada sob demanda (só dentro do Tauri, ver RoomPanel abaixo).
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [roomPlayers, setRoomPlayers] = useState<PlayerInfo[]>([])
  // "Quem vê" de cada pino com lista. O dono é a sessão do host; isto é só o que o painel desenha.
  const [pinAudiences, setPinAudiences] = useState<Record<string, string[]>>({})
  // Tela da mesa: a cena que a TV mostra (`tableSceneKey`) e quantas TVs estão conectadas.
  const [tableScene, setTableScene] = useState<string | null>(null)
  const [tableScreens, setTableScreens] = useState(0)
  // A chave do link da TV, gerada pela sala: sem ela o código sozinho não vira tela.
  const [tableKey, setTableKey] = useState<string | null>(null)
  // ALARME PARA VÁRIAS CENAS: o que está soando, para a seção Cenas mostrar e encerrar.
  const [sceneAlarm, setSceneAlarm] = useState<ActiveAlarmView | null>(null)
  // Cenas pausadas (G12): espelho do que a sessão da sala guarda; fechar a sala zera as duas.
  const [pausedScenes, setPausedScenes] = useState<ReadonlySet<string>>(() => new Set())
  // G15 — diário de viagens da sala (só do mestre; a ponte avisa a cada viagem e "Desfazer").
  const [travelLog, setTravelLog] = useState<TravelLogEntry[]>([])
  // Painel Pistas: quem recebeu e quem leu cada pino. O dono também é a sessão do host.
  const [pinClues, setPinClues] = useState<Record<string, PinClueState>>({})
  // "Revelar para…" de ficha/escada/zona secreta. Mesma regra: o dono é a sessão do host.
  const [secretReveals, setSecretReveals] = useState<Record<string, string[]>>({})
  // Testes secretos e as respostas: só o mestre vê. O dono é a sessão do host.
  const [secretChecks, setSecretChecks] = useState<SecretCheckState[]>([])
  // CHAT DOS JOGADORES: o que o mestre lê (Global e cenas), relido a cada linha nova.
  const [masterChat, setMasterChat] = useState<MasterChatState>(NO_MASTER_CHAT)
  const [tunnel, setTunnel] = useState<TunnelState>({ kind: 'idle' })
  // COLUNA DA DIREITA: a aba de cima (Jogo | Chat), aberta ou escondida
  // (lembrado), as Cenas abertas ou recolhidas e o que o chat ainda não leu.
  const [rightTab, setRightTab] = useState<RightColumnTab>('room')
  const [rightOpen, setRightOpen] = useRightColumnOpen()
  const [scenesOpen, setScenesOpen] = useState(true)
  const [chatUnread, setChatUnread] = useState<ChatUnread>(NO_CHAT_UNREAD)
  /** Muda a cada Ctrl+K: "Objetos do mapa" abre com o cursor na busca (MapObjectsSection). */
  const [objectSearchRequest, setObjectSearchRequest] = useState(0)
  // INICIATIVA (aba Jogo): valores por cena e a vez. Estado da mesa, fora do arquivo do mapa.
  const initiativeValues = useInitiativeStore((state) => state.values)
  const initiativeTurn = useInitiativeStore((state) => state.turn)
  const clockHour = useClockStore((state) => state.hour)
  const hostBridgeRef = useRef<HostBridge | null>(null)
  // A mesa da sala aberta é da aventura em que ela abriu: trocar de aventura no
  // meio não pode gravar os donos desta sala na mesa da outra.
  const roomTableIdRef = useRef<string | null>(null)
  // CHAT SALVO: o disco do chat da mesa desta sala (`$APPDATA/chat/<tableId>/`).
  // Um por mesa: a fila de gravação de uma aventura nunca escreve na de outra.
  const chatStoreRef = useRef<{ tableId: string; store: ChatStore } | null>(null)
  const roomChatStore = (): ChatStore => {
    const tableId = roomTableIdRef.current ?? currentTableId()
    if (chatStoreRef.current?.tableId !== tableId) chatStoreRef.current = { tableId, store: createTauriChatStore(tableId) }
    return chatStoreRef.current.store
  }
  const hostBridge = (): HostBridge => {
    if (!hostBridgeRef.current) {
      hostBridgeRef.current = createHostBridge({
        invoke,
        listen,
        loadTable: () => loadSavedTable(tableStorage(), roomTableIdRef.current ?? currentTableId()),
        saveTable: (table) => storeSavedTable(tableStorage(), roomTableIdRef.current ?? currentTableId(), table),
        loadExploration: () => loadSavedExploration(tableStorage(), roomTableIdRef.current ?? currentTableId()),
        saveExploration: (exploration) => storeSavedExploration(tableStorage(), roomTableIdRef.current ?? currentTableId(), exploration),
        loadChat: () => roomChatStore().load(),
        appendChat: (sceneKey, entry) => roomChatStore().append(sceneKey, entry),
        deleteChat: (sceneKey, id) => roomChatStore().remove(sceneKey, id),
        getMap: () => useMapStore.getState().map,
        // Cada jogador vê a cena do token dele: a sessão precisa da aventura inteira, não só da cena aberta.
        getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
        // Movimento, porta e nome/foto da ficha que o JOGADOR mudou, já validados
        // pela sessão: entram no mapa sem virar passo do Ctrl+Z do mestre (ver
        // `net/playerChanges.ts`), na cena aberta ou numa de fundo.
        ...hostPlayerChanges,
        // CARAVANA: os seguidores andam sem desfazer (`applyCaravanMoves`, acima do App).
        applyCaravanMoves,
        // "Destrancar e abrir" do mestre ao pedido da porta trancada (passo do Ctrl+Z dele).
        unlockAndOpenDoor: unlockAndOpenDoorFromRequest,
        // "Deixar" do mestre ao pedido de esconder-se (passo do Ctrl+Z dele).
        hideToken: hideTokenFromRequest,
        // "Passar para pede" do pedido pelo pino trancado: o pino muda de modo
        // na cena dele (de fundo quando o jogador estava lá), como o painel faria.
        // MODO POR SAÍDA: com `exitId`, só aquela saída extra passa a pedir
        // (`net/pinPassageFromRequest.ts`, provado em `hostBridge.modoPorSaida.test.ts`).
        setPinPassage: setPinPassageFromRequest,
        // ITEM PEGÁVEL: o pino pego sai e as mochilas mudam, já validados pela
        // sessão. Vale para TODO passo do desfazer da cena, aberta ou de fundo
        // (`applyItemsInScene`): um Ctrl+Z do mestre não devolve a chave ao
        // chão com ela ainda na mochila de alguém.
        applyItems: (change) => {
          applyItemsInScene(change)
        },
        // "Deixar ir": o token troca de cena fora do desfazer das duas (ver `transferToken`).
        applyTransfer: ({ tokenId, fromSceneId, toSceneId, x, y, piso, hold }) =>
          useAdventureStore.getState().transferToken(tokenId, fromSceneId, toSceneId, x, y, piso, hold),
        // CABINE DE TRANSPORTE: quem passou pela parada levou a cabine junto.
        applyCabine: ({ cabineId, parada }) => {
          useAdventureStore.getState().moverCabine(cabineId, parada)
        },
        // CABINE DE TRANSPORTE: um jogador chamou a cabine — a chamada entra na fila da aventura.
        applyChamadaDeCabine: (chamada) => useAdventureStore.getState().chamarCabine(chamada),
        // "Ir lá" do aviso de chegada: o editor vai à cena, com a ficha no centro
        // (mesmo caminho do "Ir lá" do painel Grupo, que também serve à cena já aberta).
        // PISOS: no piso onde ela chegou (o do pino par).
        onGoToScene: (sceneId, x, y, piso) => {
          useAdventureStore.getState().goToPointNoPiso(sceneId, { x, y }, piso)
        },
        // "Ir lá" da ação no ponto: centra no ponto e o marca com o anel do jogador.
        onPointActionGo: goToPointAction,
        onPlayersChange: (players) => {
          setRoomPlayers(players)
          // VOLTO JÁ: o canvas põe o selo de ausente nas fichas de quem saiu da mesa.
          useAwayTokensStore.getState().setFromPlayers(players)
        },
        onPinAudiencesChange: setPinAudiences,
        // SONS: linha nova no diário é ficha que trocou de cena na sessão, e toca a passagem.
        // O pino de viagem do editor (`handleTravelPin`) só move a vista do mestre: não entra aqui.
        onTravelLogChange: comSomDePassagem(setTravelLog),
        onPinCluesChange: setPinClues,
        onSecretRevealsChange: setSecretReveals,
        onSecretChecksChange: setSecretChecks,
        onTunnelChange: setTunnel,
        // A vez vai no snapshot, recortada por jogador (`turnForPlayer`): ficha que ele não vê não vira vez.
        getTurn: () => useInitiativeStore.getState().turn,
        // O relógio vai no snapshot recortado (`clockForPlayer`): só o período, nunca a hora.
        getClock: () => useClockStore.getState().hour,
        onTableScreensChange: setTableScreens,
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
        // Laser do jogador: o canvas desenha pela store, só o da cena aberta.
        onPlayerLaser: (laser) => usePlayerLaserStore.getState().receive(laser),
        // Chamar o mestre: a linha na caixa "Chamados" a ponte já põe; aqui só o bipe.
        onCall: () => playSignalSound(),
        // "Ir lá" do chamado: a cena de quem chamou (ou a aberta, no mapa solto) com a ficha no centro.
        onGoToPoint: (sceneId, x, y) => {
          useAdventureStore.getState().goToPoint(sceneId, { x, y })
        },
        // "Guardar ficha" de quem foi embora: a ficha sai do mapa (na cena aberta, pelo desfazer de sempre).
        removeToken: (tokenId, sceneId) => {
          if (sceneId === undefined) useMapStore.getState().removeToken(tokenId)
          else useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => mapFactory.removeToken(m, tokenId))
        },
        // A ficha guardada volta. Já no mapa (o mestre desfez a retirada): não entra de novo, com o mesmo id.
        restoreToken: (token, sceneId) => {
          if (sceneId === undefined) {
            const store = useMapStore.getState()
            if (!store.map.tokens.some((t) => t.id === token.id)) store.addToken(token)
            return
          }
          useAdventureStore.getState().updateBackgroundScene(sceneId, (m) => (m.tokens.some((t) => t.id === token.id) ? m : mapFactory.addToken(m, token)))
        },
        // Dado rolado na sala: toda rolagem da mesa (e a do mestre, escondida ou não) entra na lista dele.
        onDiceRoll: (roll) => useDiceStore.getState().push(roll),
        onMasterChatChange: setMasterChat,
      })
    }
    return hostBridgeRef.current
  }
  // Desfazer/refazer avisa como tal: a caravana do mapa-mundi não o lê como arrasto.
  useEffect(
    () =>
      useMapStore.subscribe((state, previous) => {
        const cause = mapChangeCause(state, previous)
        if (cause !== null) hostBridgeRef.current?.notifyMapChanged(cause)
      }),
    [],
  )
  // A vez andou: os jogadores sabem na hora (o "Sua vez" não espera outra edição do mapa).
  useEffect(
    () =>
      useInitiativeStore.subscribe((state, previous) => {
        if (state.turn !== previous.turn) hostBridgeRef.current?.notifyTurnChanged()
      }),
    [],
  )
  // ESTADO DO MUNDO: qualquer troca na aventura reenvia o recorte — nome ("onde
  // estou"), CABINE DE TRANSPORTE (mestre ou viagem: quem está numa parada lê
  // "aqui/longe" de novo) e comporta (estados) inclusos, sem esperar outra
  // edição do mapa.
  useEffect(
    () =>
      useAdventureStore.subscribe((state, previous) => {
        if (state.adventure !== previous.adventure) hostBridgeRef.current?.notifyMapChanged()
      }),
    [],
  )
  // O relógio andou: o período e a visão da noite chegam na hora, sem esperar outra edição.
  useEffect(
    () =>
      useClockStore.subscribe((state, previous) => {
        if (state.hour !== previous.hour) hostBridgeRef.current?.notifyClockChanged()
      }),
    [],
  )
  // Cena de fundo que chega do disco depois de abrir a aventura: quem está nela sai da espera.
  useEffect(() => subscribeToServedScenes(() => hostBridgeRef.current?.notifyMapChanged()), [])
  // O mapa aberto e as cenas de fundo: o snapshot dos jogadores lê os dois.
  useEffect(() => subscribeToPlayerWorldChanges(() => hostBridgeRef.current?.notifyMapChanged()), [])
  // SONS DO MESTRE: o dado rolado na sala toca, e o primeiro gesto no app
  // destrava o áudio (o bipe de chamado toca nesse contexto também).
  useEffect(() => instalarSonsDoMestre(), [])
  const laserToggled = useLaserStore((state) => state.toggled)
  const diceRolls = useDiceStore((state) => state.rolls)
  const noiseArmed = useNoiseStore((state) => state.armed)
  const noiseRangeCells = useNoiseStore((state) => state.rangeCells)
  // Ruído armado: Escape desarma sem disparar (fora de campo de texto, onde o Escape é da edição).
  useEffect(() => {
    if (!noiseArmed) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const alvo = event.target
      if (alvo instanceof HTMLElement && isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
      useNoiseStore.getState().setArmed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [noiseArmed])
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
  const handleStartRoom = async (resume: boolean) => {
    roomTableIdRef.current = currentTableId()
    try {
      const bridge = hostBridge()
      setRoom(await bridge.start({ resume }))
      setTableKey(bridge.tableKey())
    } catch {
      // A ponte já mostrou o toast com o motivo; o painel continua com a sala fechada.
    }
  }
  const handleStopRoom = async () => {
    await hostBridgeRef.current?.stop()
    setRoom(null)
    setRoomPlayers([])
    // Sala nova nasce sem cena na TV: a sessão de agora morreu com a escolha.
    setTableScene(null)
    setTableKey(null)
    // O alarme morreu com a sessão: sala nova começa sem alarme.
    setSceneAlarm(null)
    setPausedScenes(new Set())
    useAwayTokensStore.getState().clear()
    useSignalStore.getState().clear()
    usePlayerLaserStore.getState().clear()
    useLaserStore.getState().setToggled(false)
    useDiceStore.getState().clear()
    // Sala fechada: o painel esvazia; a conversa guardada volta do disco quando a sala reabrir.
    setMasterChat(NO_MASTER_CHAT)
    useNoiseStore.getState().setArmed(false)
  }
  /**
   * O mundo que o host serve (cena aberta + as de fundo), para o painel Jogo:
   * o Grupo mostra onde cada um está e o "Remover …" acha a ficha de quem
   * viajou. Só é montado com a aba Jogo existindo (Tauri).
   */
  const roomPanelWorld = () => hostWorldOf({ adventure, activeSceneId, cache: sceneCache }, map)
  /** A lista do "Reunir o grupo aqui" do pino aberto: agrupada por cena, com quem já está em volta dele à parte. */
  const gatherListFor = (pin: { x: number; y: number }) => {
    const world = roomPanelWorld()
    return gatherCandidates(partyMembers(roomPlayers, world), world, pin)
  }
  /** Com a sala fechada, quem tem ficha na mesa guardada: é o que faz o "Abrir sala" perguntar "Retomar a mesa?". */
  const savedTableNames = (): string | null => {
    if (room !== null) return null
    const table = loadSavedTable(tableStorage(), currentTableId())
    return table === null ? null : savedTableSummary(table)
  }
  /** A lista Cenas: as mesmas linhas do Grupo, com a Sala de cada um para o recado a escolhidos. */
  const scenePeople = () => {
    if (roomPlayers.length === 0) return undefined
    const world = roomPanelWorld()
    return peopleByScene(partyMembers(roomPlayers, world), world)
  }
  /** "Desfazer" do diário: a ponte devolve a ficha; o aviso confirma para onde, já que a linha some. */
  const undoTravel = (entryId: string): boolean => {
    const entry = travelLog.find((e) => e.id === entryId)
    const bridge = hostBridgeRef.current
    if (entry === undefined || bridge === null || !bridge.undoTravel(entryId)) return false
    useToastStore.getState().push('info', `Viagem desfeita: ${entry.tokenName} voltou para ${entry.fromSceneName}`)
    return true
  }
  /**
   * "Revelar para…" de ficha secreta, escada secreta ou zona oculta `itemId`.
   * Só com a sala aberta: a lista vive na sessão do host (`setSecretReveal`).
   */
  const secretRevealFor = (itemId: string): RevealToControlsProps | null =>
    room === null
      ? null
      : {
          players: partyMembers(roomPlayers, roomPanelWorld()).map((member) => ({
            playerId: member.playerId,
            name: member.name,
            color: member.token?.color ?? null,
          })),
          chosen: secretReveals[itemId] ?? [],
          onChange: (chosen) => hostBridgeRef.current?.setSecretReveal(itemId, chosen),
        }
  /**
   * As abas "Jogo | Chat" da coluna da direita. Fora do Tauri não há sala
   * possível (nem Jogo nem conversa): sem abas, as Cenas ficam com a coluna.
   */
  const rightColumnTabs = (): RightColumnTabDef[] => {
    if (!isTauri()) return []
    return [
      { id: 'room', label: 'Jogo', panel: roomPanelNode() },
      {
        id: 'chat',
        label: 'Chat',
        unread: chatUnread,
        // A conversa vive na sessão: sem sala, o convite para abri-la na aba Jogo.
        panel:
          room === null ? (
            <section className="lb-panel lb-coldir__vazio" aria-label="Chat dos jogadores">
              <p>O chat dos jogadores abre junto com a sala.</p>
              <button type="button" className="lb-btn" onClick={() => setRightTab('room')}>
                Ir para Jogo
              </button>
            </section>
          ) : (
            <MasterChatPanel
              chat={masterChat}
              active={rightOpen && rightTab === 'chat'}
              onUnreadChange={setChatUnread}
              onSend={(text) => hostBridgeRef.current?.masterChatSend(text) ?? false}
              onDelete={(sceneKey, id) => hostBridgeRef.current?.masterChatDelete(sceneKey, id)}
            />
          ),
      },
    ]
  }
  /** O painel da aba Jogo (só no Tauri). */
  const roomPanelNode = (): ReactNode => {
    const world = roomPanelWorld()
    const members = partyMembers(roomPlayers, world)
    // CONGELAR FICHA: toda ficha na mão de um jogador — a própria, a emprestada, o ajudante.
    const fichasDeJogador = roomPlayers.flatMap((player) => player.tokenIds)
    return (
      <RoomPanel
        room={room}
        players={roomPlayers}
        tokens={roomPanelTokensOf(world)}
        party={{
          members,
          destinations: partyDestinations(world, adventure?.scenes),
          onGoTo: (member) => {
            // "Ir lá" em OUTRO jogador é o mestre escolhendo a vista: desliga o seguir.
            useFollowStore.getState().irAteJogador(member.playerId)
            // PISOS: e o editor no piso da ficha (ausente = térreo).
            if (member.token !== null) useAdventureStore.getState().goToPointNoPiso(member.sceneId, { x: member.token.x, y: member.token.y }, member.token.piso ?? 0)
          },
          onSend: (playerId, sceneId, pinId) => hostBridgeRef.current?.sendPlayer(playerId, sceneId, pinId) ?? false,
          // ITEM PEGÁVEL: tirar, devolver ao chão ou dar, gravado na cena
          // da ficha (fora do desfazer, em todo passo dele). A cena de
          // fundo não passa pelo `useMapStore`: o snapshot sai por aqui.
          onItem: (action) => {
            const change = partyItemChange(world, action, crypto.randomUUID())
            if (change === null || !applyItemsInScene(change)) return false
            hostBridgeRef.current?.notifyMapChanged()
            return true
          },
          followingId,
          onToggleFollow: (member) => useFollowStore.getState().toggle(member.playerId),
          // "Ver tela": um espelho por vez; o mesmo botão fecha o que abriu.
          mirroringId: mirrorId,
          onToggleMirror: (member) => setMirrorId((current) => (current === member.playerId ? null : member.playerId)),
          // Recado para um jogador só: sem sala não há quem leia.
          onNote: room === null ? undefined : (playerId, text) => hostBridgeRef.current?.playerNote(playerId, text) ?? null,
          // MOEDAS E TROCA: a oferta vai pela sessão, só ao jogador da linha; sem sala não há quem responda.
          onTrade:
            room === null
              ? undefined
              : (member, proposta) => (member.token === null ? 'unavailable' : (hostBridgeRef.current?.proposeTrade(member.playerId, member.token.id, proposta) ?? 'unavailable')),
          // "Ver" da marca "vamos para cá": a mesma ida do "Ir lá", até a marca e não até a ficha.
          onViewDestination: (member) => {
            if (member.playerId !== followingId) useFollowStore.getState().stop()
            if (member.destination !== undefined) useAdventureStore.getState().goToPoint(member.sceneId, member.destination)
          },
          // "Trazer" a ficha que ficou em outra cena: sem sala não há sessão que saiba do dono.
          onBring: room === null ? undefined : (playerId, tokenId) => hostBridgeRef.current?.bringToken(playerId, tokenId) ?? false,
          // CONGELAR FICHA: mudança de MESA em toda cena carregada (fora do
          // Ctrl+Z). A cena de fundo não passa pelo `useMapStore`: o recorte
          // novo sai por aqui, como no `onItem`.
          congelar: {
            ...congelamentoDaMesa(fichasDeJogador, world),
            onChange: (congelar) => {
              if (congelar) useAdventureStore.getState().congelarFichas(new Set(fichasDeJogador), true)
              else useAdventureStore.getState().descongelarTodas()
              hostBridgeRef.current?.notifyMapChanged()
            },
          },
        }}
        initiative={{
          tokens: map.tokens.map((token) => ({ id: token.id, name: token.name })),
          values: initiativeValues[map.id] ?? NO_INITIATIVE_VALUES,
          turnTokenId: turnTokenIdOn(initiativeTurn, map),
          onValueChange: (tokenId, value) => useInitiativeStore.getState().setValue(map.id, tokenId, value),
          onStart: () => startTurn(map.id, map.tokens),
          onNext: () => advanceTurn(map.id, map.tokens),
          onStop: () => useInitiativeStore.getState().stop(),
        }}
        // Mapa solto não tem para onde viajar: o diário só aparece com aventura aberta.
        travelLog={adventure === null ? undefined : { entries: travelLog, onUndo: undoTravel }}
        // CONFRONTO da cena aberta. Grava como mudança de MESA
        // (`applyPlayerChange`): fora do Ctrl+Z do editor, e o host manda
        // a faixa nova no broadcast que toda mudança do mapa dispara.
        confronto={{
          fichas: map.tokens.map((t) => ({ id: t.id, nome: t.name })),
          confronto: map.confronto,
          onIniciar: (fila, passo) => {
            const novo = iniciarConfronto(fila, passo)
            if (novo !== null) useMapStore.getState().applyPlayerChange((m) => comConfronto(m, novo))
          },
          onProximaVez: () => {
            const atual = useMapStore.getState().map
            if (atual.confronto === undefined) return
            const proximo = proximaVez(atual.confronto, new Set(atual.tokens.map((t) => t.id)))
            useMapStore.getState().applyPlayerChange((m) => comConfronto(m, proximo))
          },
          onEncerrar: () => useMapStore.getState().applyPlayerChange((m) => comConfronto(m, undefined)),
        }}
        clock={{
          hour: clockHour,
          outdoor: map.externa === true,
          onAdvanceHour: () => useClockStore.getState().advanceHour(),
          onNextPeriod: () => useClockStore.getState().nextPeriod(),
          onOutdoorChange: setOutdoor,
        }}
        clues={hostCluesProps({
          world,
          members,
          clues: pinClues,
          audiences: pinAudiences,
          stopFollow: () => useFollowStore.getState().stop(),
          goToPoint: (sceneId, point) => useAdventureStore.getState().goToPoint(sceneId, point),
          setPinAudience: (pinId, playerIds) => hostBridgeRef.current?.setPinAudience(pinId, playerIds),
        })}
        secretCheck={{
          players: roomPlayers.map((player) => ({ playerId: player.playerId, name: player.name, playing: player.status === 'playing' })),
          checks: secretChecks,
          onAsk: (label, playerIds) => hostBridgeRef.current?.secretCheck(label, playerIds) ?? null,
          onClose: (checkId) => hostBridgeRef.current?.closeSecretCheck(checkId),
        }}
        tunnel={tunnel}
        savedTableNames={savedTableNames()}
        onStart={(resume) => void handleStartRoom(resume)}
        onStop={() => void handleStopRoom()}
        onStartTunnel={() => void hostBridgeRef.current?.startTunnel()}
        onStopTunnel={() => void hostBridgeRef.current?.stopTunnel()}
        onAssign={(playerId, tokenId) => hostBridgeRef.current?.assignToken(playerId, tokenId)}
        onUnassign={(playerId, tokenId) => hostBridgeRef.current?.unassignToken(playerId, tokenId)}
        onLend={(playerId, tokenId, terms) => hostBridgeRef.current?.lendToken(playerId, tokenId, terms)}
        onKick={(clientId) => void hostBridgeRef.current?.kick(clientId)}
        onStoreTokens={(playerId) => hostBridgeRef.current?.storeTokens(playerId)}
        onDismiss={(playerId) => hostBridgeRef.current?.dismissPlayer(playerId)}
        onHandOver={(playerId, heirId) => hostBridgeRef.current?.handOverPlayer(playerId, heirId)}
        onLendTokens={(ownerId, borrowerId) => hostBridgeRef.current?.lendTokens(ownerId, borrowerId)}
        onEndLoans={(ownerId) => hostBridgeRef.current?.endLoans(ownerId)}
        onVisionRadiusChange={(playerId, radius) => hostBridgeRef.current?.setVisionRadius(playerId, radius)}
        onVisionFactorChange={(playerId, factor) => hostBridgeRef.current?.setVisionFactor(playerId, factor)}
        onRevealPlan={(playerId) => hostBridgeRef.current?.revealPlan(playerId)}
        onHidePlan={(playerId) => hostBridgeRef.current?.hidePlan(playerId)}
        onGiveGroupView={(playerId) => hostBridgeRef.current?.giveGroupView(playerId) ?? null}
        onShareMap={(fromPlayerId, toPlayerId) => hostBridgeRef.current?.shareMap(fromPlayerId, toPlayerId) ?? false}
        giftScenes={giftScenesOf(world)}
        onGiveMap={(playerId, sceneId, roomIds) => hostBridgeRef.current?.giveRoomsMap(playerId, sceneId, roomIds) ?? 0}
        laserOn={laserToggled}
        onToggleLaser={() => {
          // Laser e Ruído disputam o mesmo clique no mapa: ligar um desliga o outro.
          useNoiseStore.getState().setArmed(false)
          useLaserStore.getState().setToggled(!useLaserStore.getState().toggled)
        }}
        table={{
          url: room === null || room.urls[0] === undefined || tableKey === null ? null : tableScreenUrl(room.urls[0], room.code, tableKey),
          scenes: [world.open, ...world.background].map((scene) => ({ key: tableSceneKey(scene), name: scene.name })),
          sceneKey: tableScene,
          screens: tableScreens,
          onSceneChange: (key) => {
            setTableScene(key)
            hostBridgeRef.current?.setTableScene(key)
          },
        }}
        noise={{
          armed: noiseArmed,
          rangeCells: noiseRangeCells,
          onToggle: () => {
            useLaserStore.getState().setToggled(false)
            useNoiseStore.getState().setArmed(!useNoiseStore.getState().armed)
          },
          onRangeChange: (cells) => useNoiseStore.getState().setRangeCells(cells),
        }}
      />
    )
  }
  const dismissToast = useToastStore((state) => state.dismiss)
  const pausarAvisos = useToastStore((state) => state.pausar)
  const retomarAvisos = useToastStore((state) => state.retomar)
  // Cenas da aventura (`stores/adventureStore.ts`). O Voltar da barra leva à
  // cena de onde se veio na última troca.
  const adventure = useAdventureStore((state) => state.adventure)
  const activeSceneId = useAdventureStore((state) => state.activeSceneId)
  const sceneCache = useAdventureStore((state) => state.cache)
  const previousSceneId = useAdventureStore((state) => state.previousSceneId)
  // Cada cena lembra a própria câmera; a troca pede ao canvas que volte a ela (ou enquadre).
  const sceneCameraRequest = useAdventureStore((state) => state.cameraRequest)
  const canGoBackToScene = previousSceneId !== null && sceneCache[previousSceneId]?.status === 'ok'
  // Busca do mestre (Ctrl+K): as OUTRAS cenas, onde "Objetos do mapa" também procura.
  // Não depende do mapa aberto: editar a cena aberta não refaz a lista das outras.
  const otherSceneSources = useMemo(() => fontesDaBusca({ adventure, activeSceneId, cache: sceneCache }), [adventure, activeSceneId, sceneCache])
  // G7 — "Seguir" na linha do Grupo: a câmera acompanha a ficha do jogador, inclusive de cena em cena.
  const followingId = useFollowStore((state) => state.playerId)
  // Marcas "vamos para cá" no canvas do mestre: só as da cena aberta (as de fundo têm coordenadas de outro mapa).
  const openSceneId = adventure === null ? null : activeSceneId
  useEffect(() => {
    useDestinationStore.getState().setMarks(masterDestinationMarks(roomPlayers, openSceneId))
  }, [roomPlayers, openSceneId])
  // ROTINA ANDANDO: quem anda sozinho agora; ficha na mão de um jogador (a dele ou o ajudante) não anda.
  const rotinasAndando = useRotinaAndandoStore((state) => state.andando)
  // PATRULHA ANDANDO: a mesma regra — ficha na mão de um jogador fica onde está.
  const patrulhasAndando = usePatrulhaAndandoStore((state) => state.andando)
  // MACRO POR PONTO: o ponto aberto no painel (o mapa o destaca).
  const pontoDaPatrulhaAberto = usePatrulhaAndandoStore((state) => state.pontoAberto)
  useEffect(() => {
    const fixas = new Set(roomPlayers.flatMap((player) => player.tokenIds))
    useRotinaAndandoStore.getState().setFixas(fixas)
    usePatrulhaAndandoStore.getState().setFixas(fixas)
  }, [roomPlayers])
  // PAUSA GERAL DOS NPCS: o botão da barra de cima só existe com alguém andando sozinho.
  const algumNpcAndando = useAlgumNpcAndando()
  const npcsPausados = usePausaDosNpcsStore((state) => state.pausadaDesde !== null)
  /**
   * "Pausar NPCs": congela rotina e patrulha andando para o mestre narrar. Na
   * barra de cima (fora do fluxo dela, para não pular de lugar quando aparece)
   * ou, com a coluna da direita aberta, no alto da coluna (`extraClass`).
   */
  const npcsPauseButton = (extraClass?: string): ReactNode =>
    algumNpcAndando && (
      <button
        type="button"
        className={extraClass === undefined ? 'lb-btn lb-npcs-pausa' : `lb-btn lb-npcs-pausa ${extraClass}`}
        aria-pressed={npcsPausados}
        aria-keyshortcuts={PAUSE_NPCS_SHORTCUT}
        title={`${npcsPausados ? 'Retomar' : 'Pausar'} os NPCs que andam sozinhos (${PAUSE_NPCS_SHORTCUT})`}
        onClick={alternarPausaDosNpcs}
      >
        {npcsPausados ? 'Retomar NPCs' : 'Pausar NPCs'}
      </button>
    )
  useFollowPlayer(roomPlayers, () => hostWorldOf({ adventure, activeSceneId, cache: sceneCache }, map))
  // FACÇÃO E ALERTA: o filtro "Quem manda aqui" é da vista do mestre; a legenda sai das salas da cena aberta.
  const filtroFaccoes = useTerritorioStore((state) => state.filtroLigado)
  const legendaFaccoes = coresDasFaccoes(map.regions)
  // "Ver tela" do Grupo: de quem é o espelho aberto. Quem saiu da sala (expulso,
  // sala fechada) leva o espelho junto — voltar depois não o reabre sozinho.
  const [mirrorId, setMirrorId] = useState<string | null>(null)
  const mirroredPlayer = mirrorId === null ? undefined : roomPlayers.find((player) => player.playerId === mirrorId)
  useEffect(() => {
    if (mirrorId !== null && mirroredPlayer === undefined) setMirrorId(null)
  }, [mirrorId, mirroredPlayer])
  // atencao-do-mestre — a cena que espera (`lib/cenaQueEspera.ts`): cada cena
  // com gente que o editor NÃO mostra guarda desde quando espera; a lista
  // Cenas mostra 'há N min' e o Ctrl+J abre a que espera há mais tempo.
  const tableMembers = roomPlayers.length === 0 ? [] : partyMembers(roomPlayers, roomPanelWorld())
  const waitingSince = useCenaQueEspera(tableMembers, activeSceneId, screen === 'editor')
  /**
   * Caminho de origem do mapa em edição. `null` enquanto o mapa é novo
   * (ainda não salvo); a partir daí toda escrita vai de volta para esse
   * caminho, em vez de gerar cópia nova em `%APPDATA%`. Numa aventura é o
   * arquivo da cena aberta, e quem grava é `useAdventureStore.flush`.
   */
  const [currentMapPath, setCurrentMapPath] = useState<string | null>(null)
  /** O salvamento automático lê a origem na hora da cópia, fora do render. */
  const currentMapPathRef = useRef<string | null>(null)
  /**
   * Cópia de recuperação deixada por uma abertura anterior que fechou sem
   * salvar — vira a oferta "Recuperar" no menu inicial. Só vale até o mestre
   * entrar no editor: dali em diante o salvamento automático desta abertura
   * pode gravar por cima dela.
   */
  const [recoveryCopy, setRecoveryCopy] = useState<RecoveryCopy | null>(null)
  const recoveryOfferExpiredRef = useRef(false)
  const recoveryAutosaveRef = useRef<RecoveryAutosave | null>(null)
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
   * Contador que dispara o reset de zoom DENTRO da closure de `PixiCanvas`
   * (ver `resetZoomRequest` na prop e `resetZoomRequestRef` lá) — incrementa
   * a cada clique no ZoomHud ou Ctrl+0. O valor em si não importa, só a
   * MUDANÇA (mesmo padrão que `gridAlignPreview` já usa como ponte).
   */
  const [resetZoomRequest, setResetZoomRequest] = useState(0)
  /** Tela de atalhos: abre pela tecla `?` no mapa (PixiCanvas) ou pelo botão da barra de ações. */
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  /** "Exportar imagem": a função do canvas que gera o PNG (`null` sem canvas montado). */
  const imageExporterRef = useRef<MapImageExporter | null>(null)
  /** Janela "Exportar imagem" aberta (`null` = fechada), gerando/gravando, e o erro da última tentativa. */
  const [exportImageState, setExportImageState] = useState<{ busy: boolean; error: string | null } | null>(null)
  /** Container do canvas: o tamanho dele é a "tela" usada para achar o centro visível ao adicionar token. */
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  /** Barra de ferramentas e rail: flutuam sobre o canvas e tapam o que está embaixo. */
  const editorTopRef = useRef<HTMLDivElement | null>(null)
  const editorRailRef = useRef<HTMLDivElement | null>(null)
  const rightColumnRef = useRef<HTMLElement | null>(null)
  /** A raiz do editor: leva `--lb-topo-altura`, a altura da barra de ferramentas (os avisos descem para baixo dela). */
  const editorRootRef = useRef<HTMLDivElement | null>(null)
  /**
   * Os painéis flutuantes em px relativos ao canvas, lidos na hora: o "Ir lá"
   * (e toda chegada com foco) centra o ponto no que eles deixam livre, e não
   * embaixo da barra de ferramentas (ver `freeAreaCenter`).
   */
  const canvasObstacles = (): Bounds[] => {
    const host = canvasHostRef.current
    if (host === null) return []
    const base = host.getBoundingClientRect()
    // A coluna da direita escondida (`hidden`) não tapa nada.
    const right = rightColumnRef.current
    const rightShown = right !== null && !right.hidden ? right : null
    return [editorTopRef.current, editorRailRef.current, rightShown].flatMap((el) => {
      if (el === null) return []
      const r = el.getBoundingClientRect()
      return [{ minX: r.left - base.left, minY: r.top - base.top, maxX: r.right - base.left, maxY: r.bottom - base.top }]
    })
  }
  /** Tamanho do canvas agora, para a peça nova nascer no centro da vista; `null` antes de ele montar. */
  const vistaDoCanvas = (): TamanhoDaVista | null => {
    const host = canvasHostRef.current
    return host === null ? null : { width: host.clientWidth, height: host.clientHeight }
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

  useEffect(() => {
    currentMapPathRef.current = currentMapPath
  }, [currentMapPath])

  /**
   * Salvamento automático com recuperação: ao abrir, procura a cópia de
   * recuperação de uma abertura anterior (oferta no menu); enquanto o mestre
   * edita, guarda a cópia sozinho. Só no app (Tauri) — no `vite` puro dos
   * testes e2e sem a ponte não existe disco, mesmo guard do efeito abaixo.
   * Ler a cópia é melhor esforço: sem cópia legível não há o que oferecer, e
   * um erro ali não pode virar aviso na tela inicial.
   */
  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    readRecoveryCopy()
      .then((copy) => {
        if (!cancelled && !recoveryOfferExpiredRef.current) setRecoveryCopy(copy)
      })
      .catch(() => undefined)
    const autosave = startRecoveryAutosave({
      storage: { write: writeRecoveryCopy, clear: clearRecoveryCopy },
      getLooseMapPath: () => currentMapPathRef.current,
      onError: (err) => reportFileError('guardar a cópia de recuperação', err),
    })
    recoveryAutosaveRef.current = autosave
    return () => {
      cancelled = true
      autosave.stop()
      recoveryAutosaveRef.current = null
    }
  }, [])

  // Entrou no editor (mapa novo, aberto ou recuperado): a oferta do menu
  // deixa de valer, porque o salvamento automático desta abertura assume a cópia.
  useEffect(() => {
    if (screen !== 'editor') return
    recoveryOfferExpiredRef.current = true
    setRecoveryCopy(null)
  }, [screen])

  /**
   * Avisa antes de fechar a janela (X, Alt+F4, taskbar) se houver edição não
   * salva ou jogador conectado na sala (`lib/avisoAoFechar.ts`) — item 11
   * (Frente D), com UM desvio deliberado do CONTRATO da
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
      .onCloseRequested(
        // Pergunta com edição não salva OU com jogador conectado: fechar o app
        // derruba a sala, e com o mapa salvo o X levava os 7 sem perguntar.
        // Sem ponte (sala nunca aberta), ninguém está na sala.
        criarPedidoDeFechar({
          estado: () => ({
            alteracoesNaoSalvas: hasUnsavedWork(),
            jogadoresNaSala: hostBridgeRef.current?.connectedPlayerCount() ?? 0,
          }),
          perguntar: (texto) => ask(texto, { title: 'Labirinto', kind: 'warning' }),
          fechar: () => getCurrentWindow().destroy(),
          esperaMaximaMs: CLOSE_DIALOG_MAX_WAIT_MS,
        }),
      )
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
  // LEVAR FICHA JUNTO: quem leva a ficha selecionada, quem ela leva e a quem pode ser presa (a mais perto primeiro).
  // `carryRefsOf` só lê `map.tokens`: parede, sala ou desenho que mudam não refazem a
  // lista. No arrasto da ficha o memo não segura nada (as fichas mudam a cada pointermove).
  const selectedTokenCarry = useMemo(() => carryRefsOf(map, selectedToken), [map.tokens, selectedToken])
  // MACRO POR PONTO: o anel do ponto aberto é do painel da ficha; outra ficha (ou nenhuma) selecionada, ele sai do mapa.
  const fichaSelecionadaId = selectedToken?.id ?? null
  useEffect(() => {
    const aberto = usePatrulhaAndandoStore.getState().pontoAberto
    if (aberto !== null && aberto.tokenId !== fichaSelecionadaId) usePatrulhaAndandoStore.getState().abrirPonto(null)
  }, [fichaSelecionadaId])
  const selectedDrawing = singleSelection?.kind === 'drawing' ? map.drawings.find((d) => d.id === singleSelection.id) ?? null : null
  const selectedTextLabel = selectedDrawing && selectedDrawing.kind === 'text' ? selectedDrawing : null
  const selectedRegion = singleSelection?.kind === 'region' ? map.regions.find((r) => r.id === singleSelection.id) ?? null : null
  // Sub-sala: a sala de fora (parentId órfão = sala de topo, sem linha "Dentro de").
  const selectedRegionParent = selectedRegion?.parentId !== undefined ? map.regions.find((r) => r.id === selectedRegion.parentId) ?? null : null
  // ZONA DE PERIGO da Sala selecionada: o perigo dela e se "Avançar um passo" muda algo.
  const selectedRoomHazard = selectedRegion?.room ? roomHazardState(map, selectedRegion.id) : null
  // GATILHO DE ÁREA da Região/Sala selecionada (`null` = sem gatilho).
  const selectedRegionTrigger = selectedRegion ? areaTriggerOfRegion(map, selectedRegion.id) : null
  // ESTEIRA e CABINE: com "Fichas ocupam espaço", só segura a ficha quem o
  // dono dela enxerga com o raio que o host APLICA a ela neste mapa ("Visão
  // nesta cena", fator, hora do relógio: `tokenVisionRadii`), nunca o de base.
  // Sem sala aberta (ponte ainda não criada) ninguém tem dono.
  const conveyorRadiiIn = (target: MapData): OwnerVisionRadii => hostBridgeRef.current?.tokenVisionRadii(target) ?? NO_OWNER_RADII
  const conveyorRadii = conveyorRadiiIn(map)
  // UM AVANÇAR (botão "Avançar esteiras" e "Próximo apito" da Agenda): esteiras
  // e cabines desta cena, e a cabine que leva ao par — a ficha de jogador pela
  // sessão ("Mandar para…" com a ficha exata), a sem dono pelo "Levar para…".
  const avancarEsteiras = () => {
    // O raio de AGORA: o "Próximo apito" pode ter mudado a hora neste mesmo clique.
    avancarMovimentoImposto(conveyorRadiiIn(useMapStore.getState().map), {
      ownerOf: ownerFromPlayers(roomPlayers),
      sendPlayer: (playerId, sceneId, pinId, tokenId) => hostBridgeRef.current?.sendPlayer(playerId, sceneId, pinId, undefined, tokenId) ?? false,
    })
  }
  // ESTEIRA da Sala selecionada: direção, passo e se "Avançar esteiras" move alguém.
  const selectedRoomConveyor = selectedRegion?.room ? roomConveyorState(map, selectedRegion.id, conveyorRadii) : null
  const selectedLight = singleSelection?.kind === 'light' ? map.lights.find((l) => l.id === singleSelection.id) ?? null : null
  const selectedStair = singleSelection?.kind === 'stair' ? map.stairs.find((s) => s.id === singleSelection.id) ?? null : null
  const selectedFloorIndex = singleSelection?.kind === 'floor' ? map.floor.findIndex((p) => p.id === singleSelection.id) : -1
  const selectedFloorPiece = selectedFloorIndex >= 0 ? map.floor[selectedFloorIndex] : null
  // CAMADAS DO PINCEL: com o Chão em Pincel de blocos ou Balde, a lista
  // "Camadas do chão" marca onde a tinta cai e oferece "Nova camada".
  const alvoDaTinta = alvoDoPincel(map.floor, pisoAtivo, camadaDoPincelId)
  const pincelNasCamadas: PincelNasCamadas | undefined =
    activeTool === 'floor' && (floorShapeKind === 'blocos' || floorShapeKind === 'balde')
      ? {
          ativaId: alvoDaTinta.tipo === 'camada' ? alvoDaTinta.peca.id : NOVA_CAMADA,
          nomeDaNova: proximoNomeDeCamada(map.floor),
          corDaNova: corDaCamada(floorCamada) ?? map.floorStyle.fillColor,
          onAtivar: setCamadaDoPincel,
          onNovaCamada: () => setCamadaDoPincel(NOVA_CAMADA),
        }
      : undefined
  // A5 — zona aberta no painel. Some sozinha se o Ctrl+Z tirar a zona do mapa.
  const selectedConcealZoneId = useMapStore((state) => state.selectedConcealZoneId)
  const selectedConcealZone = map.concealZones.find((z) => z.id === selectedConcealZoneId) ?? null
  // ESTADO DO MUNDO: "Depende do estado" amarra o elemento aberto; a aventura sabe o valor atual do estado.
  const amarrarAoEstado = (amarra: AmarraDeEstado) => useAdventureStore.getState().amarrarAoEstado(amarra)
  // Pino aberto no painel. Some sozinho se o Ctrl+Z tirar o pino do mapa.
  const selectedPinId = useMapStore((state) => state.selectedPinId)
  const selectedPin = map.pins.find((p) => p.id === selectedPinId) ?? null
  // "Objetos do mapa": a linha do objeto selecionado fica marcada na lista.
  const currentMapObjectKey = currentObjectKey(map, selection, selectedPinId)
  const pinKind = useMapStore((state) => state.pinKind)
  const pinIcon = useMapStore((state) => state.pinIcon)
  // "Oculto para jogadores" EM LOTE (2+ itens selecionados): nenhum, todos ou misturado.
  const selectionSecret = selection.length > 1 ? selectionSecretState(map, selection) : null
  const setSelectionSecret = useMapStore((state) => state.setSelectionSecret)
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
  const propertyGroups = relevantPropertyGroups(
    activeTool,
    {
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
    },
    { roomFreeKind },
  )

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

  /** "Jogador pode espiar": o interruptor mostra o contrário do campo (ligado = sem `semEspiar`). */
  const handleToggleSemEspiar = () => {
    if (!selectedWall || !selectedWall.door) return
    setDoorSemEspiar(selectedWall.id, selectedWall.door.semEspiar !== true)
  }

  const handleToggleSecret = () => {
    if (!selectedWall || !selectedWall.door) return
    setDoorSecret(selectedWall.id, selectedWall.door.secret !== true)
  }

  const handleRevealPassage = () => {
    if (!selectedWall) return
    revealSecretPassage(selectedWall.id)
  }

  /** CHAVE ABRE PORTA: "Abre com" da porta selecionada, com histórico (Ctrl+Z desfaz). "" tira a chave. */
  const handleDoorKeyChange = (nome: string) => {
    if (!selectedWall || !selectedWall.door) return
    setWallDoor(selectedWall.id, setDoorKey(selectedWall.door, nome))
  }

  const handleOpensFromChange = (side: DoorSide | null) => {
    if (!selectedWall || !selectedWall.door) return
    setDoorOpensFrom(selectedWall.id, side)
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
      await gravarImagemDoToken(
        tokenId,
        (mapDir) => importTokenImage(sourcePath, mapDir, tokenId),
        () => buildTokenSharedPhoto(sourcePath),
      )
    } catch (err) {
      reportFileError('trocar a imagem do token', err)
    }
  }

  /** Imagem colada (Ctrl+V) ou solta arrastando em "Imagem do token": o mesmo caminho do "Trocar imagem...". */
  const handleTokenImageBlob = async (tokenId: string, blob: Blob) => {
    try {
      await gravarImagemDoToken(
        tokenId,
        (mapDir) => importTokenImageFromBlob(blob, mapDir, tokenId),
        () => buildTokenSharedPhotoFromBlob(blob),
      )
    } catch (err) {
      reportFileError('usar a imagem do token', err)
    }
  }

  /**
   * Grava a imagem do token pela pasta do mapa (`importar`) e a cópia que
   * viaja ao jogador (`compartilhar`), e só então troca a foto (com histórico).
   * Lança o erro de `importar`; o de `compartilhar` vira aviso e não segura a troca.
   */
  const gravarImagemDoToken = async (
    tokenId: string,
    importar: (mapDir: string) => Promise<{ destPath: string }>,
    compartilhar: () => Promise<string>,
  ) => {
    const mapDir = await mapDirFor(map.id)
    const imported = await importar(mapDir)
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
      shared = await compartilhar()
    } catch (err) {
      reportFileError('preparar a foto do token para os jogadores (o token fica com a imagem só na sua tela)', err)
    }
    setTokenImage(tokenId, imported.destPath, shared)
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

    // Nasce com a marca de NPC e, sem foto, com o aviso — `stores/criarToken.ts`.
    colocarPecaDoAcervo(item, tokenId, { image, imageData }, at, vistaDoCanvas())
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
   * ACERVO — pastas. Criar e apagar pasta relêem o disco no fim, como apagar
   * token: o nome final ("Chefes (2)") e os tokens que voltam para "Sem pasta"
   * são decididos na gravação, não aqui.
   *
   * Mover e recolher são ADIANTADOS na tela (`marcarPasta`, `marcarRecolhida`):
   * o token pula de pasta no soltar e o chevron gira no clique. Só a falha
   * relê o disco, para a tela voltar ao que ficou gravado; reler a cada
   * sucesso faria dois movimentos seguidos piscarem, o primeiro voltando do
   * disco antes de o segundo ser gravado.
   */
  const handleCriarPasta = async (nome: string) => {
    try {
      await criarPastaNoAcervo(nome)
    } catch (err) {
      reportFileError('criar a pasta no acervo', err)
    } finally {
      await useTokenLibraryStore.getState().recarregar()
    }
  }

  const handleMoverNoAcervo = async (item: ItemDoAcervoNaTela, pasta: string | null) => {
    useTokenLibraryStore.getState().marcarPasta(item.id, pasta)
    try {
      await moverNoAcervo(item.id, pasta)
    } catch (err) {
      reportFileError(`mover ${item.nome} de pasta`, err)
      await useTokenLibraryStore.getState().recarregar()
    }
  }

  const handleRecolherPasta = async (pasta: PastaDoAcervo, recolhida: boolean) => {
    useTokenLibraryStore.getState().marcarRecolhida(pasta.id, recolhida)
    try {
      await recolherPastaNoAcervo(pasta.id, recolhida)
    } catch (err) {
      reportFileError(recolhida ? `recolher a pasta ${pasta.nome}` : `abrir a pasta ${pasta.nome}`, err)
      await useTokenLibraryStore.getState().recarregar()
    }
  }

  const handleApagarPasta = async (pasta: PastaDoAcervo) => {
    try {
      await apagarPastaDoAcervo(pasta.id)
    } catch (err) {
      reportFileError(`apagar a pasta ${pasta.nome}`, err)
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

  /** Imagem colada (Ctrl+V) ou solta arrastando na área do painel do pino. */
  const handlePinImageBlob = async (pinId: string, blob: Blob) => {
    try {
      useMapStore.getState().updatePin(pinId, { image: await pinImageFromBlob(blob) })
    } catch (err) {
      reportFileError('usar a imagem do ponto de interesse', err)
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
   *
   * Já marca como salvo SÓ o que foi gravado (`saveOpenMap` e `flush`): a
   * edição feita enquanto o disco grava continua não salva. Quem chama não
   * deve chamar `markSaved()` depois — isso marcaria o mapa de agora.
   */
  const persistMap = async (): Promise<string> => {
    // "Guardar ficha" tira a ficha do mapa, não do arquivo: gravar sem ela e
    // fechar a janela a apagaria para sempre (a cópia só vive na ponte da sala).
    const stored = hostBridgeRef.current?.storedTokens() ?? []
    const adventureState = useAdventureStore.getState()
    if (adventureState.adventure !== null) {
      const path = await adventureState.flush(stored)
      setCurrentMapPath(path)
      return path
    }
    if (currentMapPath) {
      const path = currentMapPath
      await saveOpenMap((saving) => saveMapToPath(withStoredTokens(saving, stored), path))
      return path
    }
    const path = await saveOpenMap((saving) => saveMapToAppData(withStoredTokens(saving, stored)))
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

  /** As fichas dos jogadores da sala: não entram na cópia e travam o apagar. Sala fechada = nenhuma conhecida. */
  const playerTokenIds = () => new Set(roomPlayers.flatMap((player) => player.tokenIds))

  /** "Duplicar" do menu "…" da cena: a cópia aparece logo abaixo, e a cena aberta continua a mesma. */
  const handleDuplicateScene = (sceneId: string) => {
    if (useAdventureStore.getState().duplicateScene(sceneId, playerTokenIds()) === null) {
      useToastStore.getState().push('error', 'Não deu para duplicar: o arquivo desta cena não abriu.')
    }
  }

  /** "Apagar cena…", já confirmado. Recusa com jogador na cena e com a última cena. */
  const handleDeleteScene = (sceneId: string) => {
    const name = adventure?.scenes.find((entry) => entry.id === sceneId)?.name ?? 'a cena'
    // Apagar a cena aberta troca a vista: o "Seguir" desliga, como em qualquer troca à mão.
    if (sceneId === activeSceneId) useFollowStore.getState().stop()
    if (useAdventureStore.getState().deleteScene(sceneId, playerTokenIds())) {
      useToastStore.getState().push('info', `${name} foi apagada.`)
      return
    }
    useToastStore.getState().push('error', `Não deu para apagar ${name}: alguém ainda está lá, ou é a única cena.`)
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
   * ALAVANCA aberta no painel: a porta ligada, as portas desta cena e o
   * "Acionar agora". Acionar entra no desfazer (é o mestre mexendo), e porta
   * trancada não se move — o painel diz por quê em vez de um clique mudo.
   */
  const leverPanel = (pin: Pin) => {
    const door = linkedDoorOf(map, pin)
    return {
      value: pin.portaLigada ?? null,
      options: leverDoorOptions(map),
      onChange: (wallId: string | null) => useMapStore.getState().updatePin(pin.id, { portaLigada: wallId ?? undefined }),
      onPull: () => useMapStore.getState().pullLever(pin.id),
      pullBlocked: door !== null && door.door.locked ? 'A porta ligada está trancada: a alavanca não a move.' : null,
    }
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
      // "Esta cena" primeiro: o atalho para outro ponto do mesmo mapa.
      scenes: travelDestinationOptions(scenes),
      pinsIn: (sceneId: string) => pinTravelOptions(scenes, map, sceneId, pin.id),
      onLinkNew: (sceneId: string, exitId: string | null) => {
        useAdventureStore.getState().linkPinToNewArrival(pin.id, sceneId, exitId)
      },
      onLinkExisting: (sceneId: string, partnerId: string, exitId: string | null) => {
        useAdventureStore.getState().linkPinToExisting(pin.id, sceneId, partnerId, exitId)
      },
      // "+ Cena nova…": a cena nasce já ligada e o mestre continua nesta — sem
      // troca de vista, o "Seguir" fica como está. No mapa solto, a aventura
      // nasce aqui, como no "+ Nova cena" de Cenas.
      onCreateScene: (nome: string, exitId: string | null) => {
        if (useAdventureStore.getState().createSceneForPin(pin.id, nome, currentMapPath, exitId) === null) {
          useToastStore.getState().push('error', 'Não deu para criar a cena: o pino não está mais aqui.')
        }
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
      // MODO POR SAÍDA: o modo de uma saída extra, com desfazer. Lido de novo
      // na store na hora da troca: o painel pode estar atrás de um desfazer.
      onExitPassageChange: (exitId: string, passagem: ExitPassage | undefined) => {
        const atual = useMapStore.getState().map.pins.find((p) => p.id === pin.id)
        if (atual !== undefined) useMapStore.getState().updatePin(pin.id, setExitPassage(atual, exitId, passagem))
      },
      // CHAVE ABRE PORTA: "Abre com" do pino trancado, com desfazer; "" tira a chave.
      keyName: pin.abreCom ?? '',
      onKeyChange: (nome: string) => useMapStore.getState().updatePin(pin.id, { abreCom: readDoorKey(nome) }),
      // "Aceita tentativas" do trancado: desligar grava `mudo`; ligar tira a marca.
      acceptsAttempts: pin.mudo !== true,
      onAcceptsAttemptsChange: (on: boolean) => useMapStore.getState().updatePin(pin.id, { mudo: on ? undefined : true }),
      // Motivo do bloqueio: do pino desta cena, com desfazer, como o modo.
      motivo: pin.motivo,
      onMotivoChange: (motivo: PinBlockReason | undefined) => useMapStore.getState().updatePin(pin.id, { motivo }),
      // PASSE: item e marcas vivem no pino desta cena, com desfazer. Lidos de
      // novo na store na hora do clique: o painel pode estar atrás de um desfazer.
      passItem: passItemOf(pin.passe),
      onPassItemChange: (item: string) => {
        const atual = useMapStore.getState().map.pins.find((p) => p.id === pin.id)
        if (atual !== undefined) useMapStore.getState().updatePin(pin.id, { passe: withPassItem(atual.passe, item) })
      },
      passTokens: passTokenOptions(map.tokens, pin.passe),
      onPassTokenToggle: (tokenId: string, on: boolean) => {
        const atual = useMapStore.getState().map.pins.find((p) => p.id === pin.id)
        if (atual !== undefined) useMapStore.getState().updatePin(pin.id, { passe: withPassToken(atual.passe, tokenId, on) })
      },
      // Mão única mora no PAR (cena de fundo): marcar e desmarcar vão pela
      // aventura, fora do desfazer desta cena.
      onOneWayChange: (exitId: string, on: boolean) => {
        useAdventureStore.getState().setPinOneWay(pin.id, exitId, on)
      },
      // "Trancar os dois lados": este pino (com desfazer) e os pares (cenas de
      // fundo, fora do desfazer), sem sair da cena aberta.
      onBothSidesChange: (trancar: boolean) => {
        useAdventureStore.getState().setPassageBothSides(pin.id, trancar)
      },
      arrivalOnly: isArrivalOnly(pin),
      // ESPIAR: "Dá vista" é do pino desta cena, com desfazer como o modo de passagem.
      daVista: isDaVista(pin.daVista) ? pin.daVista : null,
      onDaVistaChange: (casas: number | null) => useMapStore.getState().updatePin(pin.id, { daVista: casas ?? undefined }),
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
   * "Mostrar agora a…" no painel do pino `pinId`: o cartão abre sozinho na
   * tela do jogador. O mestre lê no aviso que saiu — ou que não deu, porque a
   * lista pode ter ficado aberta enquanto ele saía da cena ou caía.
   */
  const handleShowPinNow = (pinId: string, playerId: string) => {
    const bridge = hostBridgeRef.current
    if (bridge === null) return
    showPinNowWithNotice(bridge, pinId, playerId, (kind, text) => useToastStore.getState().push(kind, text))
  }

  /** Assinatura que a barra de ações e o clique da ferramenta Token já usam:
   *  cria e esquece. Onde a peça nasce e por quê: `stores/criarToken.ts`. */
  const handleAddToken = (name: string, at?: { x: number; y: number }) => {
    criarToken(name, { at }, vistaDoCanvas())
  }

  const handleSave = async () => {
    try {
      await persistMap()
      useToastStore.getState().push('info', MAP_SAVED_TEXT)
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  /** Roda o mesmo salvamento de `handleSave` e só depois troca para o menu — sem diálogo. */
  const handleGoHome = async () => {
    // Sair para o menu encerra a sessão de jogo: as rotinas param ANTES de
    // salvar, senão um passo depois da gravação sujava o mapa (o "Abrir" do
    // menu avisava trabalho não salvo) e os jogadores seguiam vendo o NPC andar.
    useRotinaAndandoStore.getState().reset()
    usePatrulhaAndandoStore.getState().reset()
    try {
      await persistMap()
      useToastStore.getState().push('info', MAP_SAVED_TEXT)
      setScreen('menu')
    } catch (err) {
      reportFileError('salvar o mapa', err)
    }
  }

  /**
   * Põe no editor o que `openMapFileFirst` leu: o mapa pedido na hora e, se
   * ele é cena de uma aventura, as outras cenas na lista, "carregando" até
   * chegarem do disco. O store marca o ponto de sincronia com o disco
   * (`markSaved`) — portal antigo convertido ao abrir continua pendente,
   * porque a conversão ainda não foi gravada.
   */
  const openInEditor = (opened: OpenedMapFile) => {
    // Não espera as cenas de fundo: a promessa nunca rejeita (a cena que não
    // abre vira "indisponível" dentro do store).
    void useAdventureStore.getState().open(opened)
    setCurrentMapPath(opened.path)
  }

  /** Abre pelo seletor de arquivo. Não checa trabalho não salvo — quem checa é `askBeforeReplacingMap`. */
  const openMapFromPicker = async () => {
    try {
      const path = await pickMapJsonToOpen()
      if (!path) return
      openInEditor(await openMapFileFirst(path))
      setScreen('editor')
    } catch (err) {
      reportFileError('abrir o mapa', err)
    }
  }

  /** Abre um caminho já escolhido (lista "Carregar Mapa"). Mesma regra de checagem acima. */
  const openMapFromPath = async (path: string) => {
    try {
      openInEditor(await openMapFileFirst(path))
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

  // Altura da barra de ferramentas na raiz do editor (`--lb-topo-altura`): com
  // a coluna da direita aberta, os avisos descem para logo abaixo dela
  // (Toast.css). Ela quebra em mais linhas na janela estreita, daí medir.
  useEffect(() => {
    if (screen !== 'editor') return
    const top = editorTopRef.current
    const root = editorRootRef.current
    if (top === null || root === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => root.style.setProperty('--lb-topo-altura', `${top.offsetHeight}px`))
    observer.observe(top)
    return () => observer.disconnect()
  }, [screen])

  // Ctrl+K — "Objetos do mapa" com o cursor na busca, de qualquer ponto do
  // editor: abre a seção e foca o campo. Num campo de texto
  // a tecla fica com o campo (`isFindObjectShortcut`).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== 'editor') return
      const target = event.target instanceof HTMLElement ? event.target : null
      const pressed = isFindObjectShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        targetTagName: target?.tagName ?? '',
        targetInputType: target instanceof HTMLInputElement ? target.type : undefined,
        targetContentEditable: target?.isContentEditable ?? false,
      })
      if (!pressed) return
      event.preventDefault()
      setObjectSearchRequest((request) => request + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [screen])

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

  /**
   * "Recuperar" do menu (`restoreRecoveryCopy`): o trabalho não salvo volta
   * ao editor como NÃO salvo, apontado para o arquivo de onde veio, e a cópia
   * passa a ser desta abertura — Salvar a apaga.
   */
  const handleRecover = async (copy: RecoveryCopy) => {
    setCurrentMapPath(await restoreRecoveryCopy(copy, openMapFile))
    recoveryAutosaveRef.current?.adoptExistingCopy()
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
      // O mestre precisa ver que deu certo e onde a pasta foi parar, como no "Exportar imagem".
      useToastStore.getState().push('info', `Mapa exportado em ${destDir}`)
    } catch (err) {
      reportFileError('exportar o mapa', err)
    }
  }

  /**
   * "Exportar imagem" confirmado: gera o PNG da cena pelo canvas e grava onde
   * o mestre escolher. Falha fica DENTRO da janela, perto do botão, com as
   * opções como estavam; cancelar a janela de salvar só volta ao diálogo.
   */
  const handleExportImage = async (options: ImageExportOptions) => {
    const exporter = imageExporterRef.current
    if (exporter === null) {
      setExportImageState({ busy: false, error: 'O mapa ainda está carregando. Tente de novo em instantes.' })
      return
    }
    setExportImageState({ busy: true, error: null })
    try {
      const bytes = await exporter(options)
      const saved = await saveMapImage(bytes, imageExportFileName(useMapStore.getState().map.name))
      if (saved === null) {
        setExportImageState({ busy: false, error: null })
        return
      }
      setExportImageState(null)
      useToastStore.getState().push('info', `Imagem exportada: ${saved}`)
    } catch (err) {
      setExportImageState({ busy: false, error: `Não foi possível exportar a imagem: ${motivoDaFalhaDeArquivo(err, temPonteDoApp())}` })
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
      openInEditor(await openMapFileFirst(importedPath))
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
      <Toast toasts={toasts} onDismiss={dismissToast} onPausar={pausarAvisos} onRetomar={retomarAvisos} />
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
          recovery={
            recoveryCopy && {
              mapName: recoveryCopy.map.name,
              savedAtLabel: formatRecoveryTime(recoveryCopy.savedAtMs, Date.now()),
              onRecover: () => void handleRecover(recoveryCopy),
              onDismiss: () => setRecoveryCopy(null),
            }
          }
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

  // Alarme para várias cenas, só com a sala aberta: a seção Cenas soa pelo
  // formulário e a Agenda soa quando um evento com alarme dispara.
  const soarAlarme =
    room === null
      ? undefined
      : (sceneIds: string[], text: string): number | null => {
          const bridge = hostBridgeRef.current
          if (bridge === null) return null
          const sent = bridge.sceneAlarm(sceneIds, text)
          setSceneAlarm(bridge.activeAlarm())
          return sent
        }
  const scenesPanel = sceneList({ adventure, activeSceneId, cache: sceneCache }, map)

  return (
    <div className="lb-editor" ref={editorRootRef} data-coldir={rightOpen ? 'aberta' : 'escondida'}>
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
          resetZoomRequest={resetZoomRequest}
          cameraRequest={sceneCameraRequest}
          focusObstacles={canvasObstacles}
          onTravelPin={handleTravelPin}
          onLaserMove={(x, y) => hostBridgeRef.current?.laserMove(x, y)}
          onNoise={(x, y) => {
            // Sala fechada devolve `null`: o aviso diz por que o ruído não saiu.
            const heard = hostBridgeRef.current?.noise(x, y, useNoiseStore.getState().rangeCells) ?? null
            useToastStore.getState().push('info', noiseFeedbackText(heard))
          }}
          onPlaceToken={handleAddToken}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onImageExporterChange={(exporter) => {
            imageExporterRef.current = exporter
          }}
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
            brushMode: { value: brushMode, onChange: setBrushMode },
            eraseMode: { value: eraseMode, onChange: setEraseMode },
            floorShapeKind: { value: floorShapeKind, onChange: setFloorShapeKind },
            floorOp: { value: floorOp, onChange: setFloorOp },
            floorPolygonSides: { value: floorPolygonSides, onChange: setFloorPolygonSides },
            floorBrushSize: { value: floorBrushSize, onChange: setFloorBrushSize },
            floorCamada: { value: floorCamada, onChange: setFloorCamada },
            mobiliaTipo: { value: mobiliaTipo, onChange: setMobiliaTipo },
            roomFreeKind: { value: roomFreeKind, onChange: setRoomFreeKind },
            roomFreeRounded: { value: roomFreeRounded, onChange: setRoomFreeRounded },
            drawShape: { value: activeTool, onChange: setActiveTool },
          }}
        />
        {/* PAUSA GERAL DOS NPCS: congela rotina e patrulha andando para o
            mestre narrar; fora do fluxo da barra, para ela não pular de lugar
            quando o botão aparece. */}
        {/* Com a coluna da direita aberta ele mora no alto dela: aqui cairia em cima. */}
        {!rightOpen && npcsPauseButton()}
      </div>

      <div className="lb-editor__rail" ref={editorRailRef}>
        {/* Só o inspetor na esquerda: Jogo, Chat e Cenas moram na coluna da direita. */}
        {/* `div` com papel de região, e não `section`: as jornadas acham seções pela tag. */}
        <div className="lb-editor__mapa" role="region" aria-label="Mapa">
          <PropertiesPanel
            scenes={
              <>
              {/* Todos os pinos da aventura pelo nome só do mestre: tocar abre a cena com o pino selecionado. */}
              <PinsSection
                entries={pinDirectory(pinScenesOf({ adventure, activeSceneId, cache: sceneCache }, map))}
                onGo={(entry) => useAdventureStore.getState().goToPin(entry.sceneId, entry.pinId)}
              />
              {/* Agenda da campanha: mora na aventura, então só aparece com ela; ao jogador só vai o alarme de um evento, no disparo. */}
              {adventure !== null && (
                <AgendaSection
                  agenda={adventure.agenda}
                  onChange={(agenda) => useAdventureStore.getState().setAgenda(agenda)}
                  cenas={scenesPanel}
                  onAlarm={soarAlarme}
                  onApito={avancarEsteiras}
                />
              )}
              </>
            }
            // ESTADO DO MUNDO: só com aventura (o estado cruza cenas). O jogador recebe o efeito pelo broadcast de sempre.
            worldState={
              adventure === null ? undefined : (
                <WorldStateSection
                  estados={adventure.estados ?? []}
                  // Conta só quando há estado: sem estado, nenhuma passada pelas cenas.
                  amarrados={(adventure.estados ?? []).length === 0 ? new Map() : amarradosPorEstado(sceneMaps({ adventure, activeSceneId, cache: sceneCache }, map).values())}
                  onCriar={(nome, valores) => useAdventureStore.getState().criarEstadoDoMundo(nome, valores)}
                  // ROTINA DO NPC: a troca é também o apito. Ficha na mão de um jogador (a dele ou o ajudante) não é arrancada.
                  onTrocar={(estadoId, valor) =>
                    useAdventureStore.getState().trocarEstadoDoMundo(estadoId, valor, new Set(roomPlayers.flatMap((player) => player.tokenIds)))
                  }
                />
              )
            }
            // ESTADO DO MUNDO: "Depende do estado" do elemento aberto no painel —
            // é daqui que a regra `porEstado` nasce, sem editar o map.json à mão.
            estadoDaPorta={
              adventure === null || selectedWall === null ? undefined : (
                <EstadoDaPorta wall={selectedWall} estados={adventure.estados ?? []} onAmarrar={amarrarAoEstado} />
              )
            }
            // Só o pino de VIAGEM tem passagem para o estado mudar — e só ele
            // pode ser parada de cabine (elevador, cesto), que mora na aventura.
            estadoDoPino={
              adventure === null || selectedPin?.kind !== 'viagem' ? undefined : (
                <>
                  <EstadoDoPino pin={selectedPin} estados={adventure.estados ?? []} onAmarrar={amarrarAoEstado} />
                  {activeSceneId !== null && (
                    <PinCabineControls
                      cabines={adventure.cabines ?? []}
                      parada={{ sceneId: activeSceneId, pinId: selectedPin.id }}
                      nomeDaCena={(sceneId) => adventure.scenes.find((entry) => entry.id === sceneId)?.name ?? UNNAMED_SCENE}
                      onCriar={(nome) => {
                        useAdventureStore.getState().criarCabine(nome, selectedPin.id)
                      }}
                      onEscolher={(cabineId) => {
                        useAdventureStore.getState().definirParadaDeCabine(selectedPin.id, cabineId)
                      }}
                      onTrazer={(cabineId) => {
                        useAdventureStore.getState().moverCabine(cabineId, { sceneId: activeSceneId, pinId: selectedPin.id })
                      }}
                      onAtender={(cabineId) => {
                        useAdventureStore.getState().atenderChamada(cabineId)
                      }}
                      onLimparFila={(cabineId) => {
                        useAdventureStore.getState().limparFilaDaCabine(cabineId)
                      }}
                      ocupantes={ocupantesDasCabines(roomPlayers)}
                    />
                  )}
                </>
              )
            }
            estadoDaZona={
              adventure === null || selectedConcealZone === null ? undefined : (
                <EstadoDaZona zone={selectedConcealZone} estados={adventure.estados ?? []} onAmarrar={amarrarAoEstado} />
              )
            }
            perigoDaSala={
              selectedRegion?.room === undefined ? undefined : (
                <PerigoDaSalaControls
                  map={map}
                  salaId={selectedRegion.id}
                  onPor={(tipo) => useMapStore.getState().porPerigoNaSala(selectedRegion.id, tipo)}
                  onAvancar={(perigoId) => useMapStore.getState().avancarPerigo(perigoId)}
                  onApagar={(perigoId) => useMapStore.getState().apagarPerigo(perigoId)}
                />
              )
            }
            estadoDaLuz={
              adventure === null || selectedLight === null ? undefined : (
                <EstadoDaLuz light={selectedLight} estados={adventure.estados ?? []} onAmarrar={amarrarAoEstado} />
              )
            }
            // ROTINA DO NPC: o posto da ficha em cada valor do estado; gravar entra no Ctrl+Z.
            rotinaDaFicha={
              adventure === null || activeSceneId === null || selectedToken === null ? undefined : (
                <RotinaDaFichaControls
                  token={selectedToken}
                  estados={adventure.estados ?? []}
                  cenas={adventure.scenes}
                  cenaAberta={activeSceneId}
                  onChange={(rotina) => useMapStore.getState().setTokenRotina(selectedToken.id, rotina)}
                  // ROTINA ANDANDO: a ficha anda sozinha de posto em posto até o mestre parar.
                  andando={rotinasAndando.has(selectedToken.id)}
                  onAndar={(ligar) => {
                    const rotinas = useRotinaAndandoStore.getState()
                    if (ligar) rotinas.ligar(selectedToken.id)
                    else rotinas.desligar(selectedToken.id)
                  }}
                />
              )
            }
            objects={
              <>
                <MapObjectsSection
                  map={map}
                  currentKey={currentMapObjectKey}
                  onGoTo={goToMapObject}
                  searchRequest={objectSearchRequest}
                  otherScenes={otherSceneSources}
                  onGoToOther={(hit) => void irAoAchado(hit)}
                  // "Mandar ficha para cá" só com a sala aberta: sem sala não há jogador para mandar.
                  senders={room === null ? undefined : sendCandidates(partyMembers(roomPlayers, roomPanelWorld()))}
                  onSendHere={(playerId, target) => {
                    const bridge = hostBridgeRef.current
                    if (bridge === null) return { ok: false, mensagem: 'A sala não está aberta.' }
                    return mandarFichaPara(playerId, target, bridge)
                  }}
                />
                {/* BILHETE NO LUGAR: reler e apagar a marca de um jogador depois que o aviso some. */}
                <MarcasDaCena marcas={map.marcas ?? []} onApagar={hostPlayerChanges.removeMark} />
                <PlaceTreeSection regions={map.regions} currentId={selectedRegion?.id ?? null} onFrame={framePlace} />
              </>
            }
            mapName={map.name}
            mapWidth={map.width}
            mapHeight={map.height}
            mapGrid={map.grid}
            onMapSizeApply={setMapSize}
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
              grouped: isSingleGroup(mapGroups, selection),
              onGroup: () => useMapStore.getState().groupSelected(),
              onUngroup: () => useMapStore.getState().ungroupSelected(),
            }}
            alignDistribute={{
              count: alignableCount,
              onAlign: (edge) => useMapStore.getState().alignSelection(edge),
              onDistribute: (axis) => useMapStore.getState().distributeSelection(axis),
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
            movement={{ movement: map.movement, onMovementChange: setMovementRules, worldMap: map.worldMap === true, onWorldMapChange: setWorldMap }}
            arrivalText={arrivalTextSettings}
            sceneFloor={{ andar: map.andar, onChange: setSceneFloor }}
            sceneVision={{
              visionCells: map.visionCells,
              onVisionCellsChange: setSceneVisionCells,
              dark: map.dark === true,
              onDarkChange: setSceneDark,
            }}
            faceRange={{
              faceRangeCells: faceRangeCellsOrNull(map.faceRangeCells),
              onFaceRangeCellsChange: setFaceRangeCells,
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
              // "Oculto para jogadores" em lote: só com 2+ itens (um item só
              // tem o próprio toggle no painel dele).
              secret: selectionSecret === null ? undefined : { ...selectionSecret, onChange: setSelectionSecret },
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
              onToggleSemEspiar: handleToggleSemEspiar,
              onToggleSecret: handleToggleSecret,
              onRevealPassage: handleRevealPassage,
              onKeyChange: handleDoorKeyChange,
              onOpensFromChange: handleOpensFromChange,
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
              // Janela só na parede selecionada e sem porta (`setWallJanela`).
              janela: selectedWall?.janela === true,
              onJanelaChange: selectedWall && selectedWall.door === null ? (on: boolean) => setWallJanela(selectedWall.id, on) : undefined,
            }}
            selectedProp={selectedProp}
            propTransform={{
              onRotationChange: (rotation) => selectedProp && updateProp(selectedProp.id, { rotation }),
              onLockedChange: (locked) => selectedProp && updateProp(selectedProp.id, { locked }),
              onHiddenChange: (hidden) => selectedProp && updateProp(selectedProp.id, { hidden }),
              onSecretChange: (secret) => selectedProp && useMapStore.getState().setItemSecret('prop', selectedProp.id, secret),
            }}
            propPlayer={{
              onLabelChange: (label) => selectedProp && setPropLabelForPlayers(selectedProp.id, label),
              onShowImageChange: (show) => {
                if (!selectedProp) return
                // Ler o arquivo e reduzir a imagem é assíncrono: o erro vira o
                // mesmo aviso de "trocar a imagem do token", e o interruptor fica
                // desligado (nada foi gravado).
                setPropImageShownToPlayers(selectedProp.id, show).catch((err: unknown) =>
                  reportFileError('preparar a imagem do objeto para os jogadores', err),
                )
              },
            }}
            // Tipo, vista e aparência do móvel: cada troca é um passo do Ctrl+Z,
            // e o arrastar num seletor de cor vira um passo só (`mapStore`).
            propMobilia={{
              onTipoChange: trocarTipoDoMovel,
              onVistaChange: trocarVistaDoMovel,
              onAparenciaChange: setAparenciaDoMovel,
            }}
            selectedToken={selectedToken}
            tokenName={{
              onNameChange: (name) => selectedToken && useMapStore.getState().renameToken(selectedToken.id, name),
              // Com histórico (`updateToken`): trocar o nome que a mesa lê se desfaz com Ctrl+Z.
              onPublicNameChange: (publicName) => selectedToken && updateToken(selectedToken.id, { publicName }),
            }}
            tokenImage={{
              onChangeImage: () => selectedToken && handleChangeTokenImage(selectedToken.id),
              onImageBlob: (blob) => selectedToken && void handleTokenImageBlob(selectedToken.id, blob),
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
            tokenNpc={{
              // `updateToken` passa por `withHistory`: marcar errado se desfaz com Ctrl+Z.
              onNpcChange: (npc) => selectedToken && marcarFichaNpc(selectedToken.id, npc),
            }}
            tokenSceneCarry={ligacaoLevarFicha(roomPanelWorld(), roomPlayers)}
            tokenLights={{
              lights: selectedToken ? lightsOnToken(map, selectedToken.id) : [],
              onSelectLight: (lightId) => setSelection(selectionOfItem({ kind: 'light', id: lightId })),
              onDetach: (lightId) => setLightAttachment(lightId, null),
            }}
            tokenHealth={{
              // Mesmo caminho da cor e do tamanho: cada número confirmado é um
              // Ctrl+Z. `null` tira a barra da ficha.
              onHealthChange: (health) => selectedToken && updateToken(selectedToken.id, { health }),
            }}
            tokenCondition={{
              // Alterna sobre o estado ATUAL da ficha no store (não sobre a
              // cópia desta renderização) e passa pelo histórico: Ctrl+Z desfaz.
              onToggleCondition: (condition) => selectedToken && useMapStore.getState().toggleTokenCondition(selectedToken.id, condition),
            }}
            tokenWatch={{
              // Mesmo caminho da cor e do tamanho: cada escolha é um Ctrl+Z.
              // `null` desliga a vigia e a ficha volta a ser comum.
              onWatchChange: (vigia) => selectedToken && updateToken(selectedToken.id, { vigia }),
            }}
            tokenPatrol={{
              // Opera sobre a ficha ATUAL do store: o "marcar" grava onde ela
              // está agora. Cada clique que muda o mapa é um Ctrl+Z.
              onPatrolOp: (op) => selectedToken && useMapStore.getState().patrolAction(selectedToken.id, op),
              // PATRULHA ANDANDO: a ficha anda sozinha pela rota até o mestre
              // parar; os passos ficam fora do Ctrl+Z, como a rotina andando.
              patrulhando: selectedToken !== null && patrulhasAndando.has(selectedToken.id),
              onPatrulhar: (ligar) => {
                if (selectedToken === null) return
                const patrulhas = usePatrulhaAndandoStore.getState()
                if (ligar) patrulhas.ligar(selectedToken.id)
                else patrulhas.desligar(selectedToken.id)
              },
              // Velocidade e modo são da rota: cada escolha é um Ctrl+Z.
              onConfig: (config) => selectedToken && useMapStore.getState().setPatrolConfig(selectedToken.id, config),
              // MACRO POR PONTO: editar os passos entra no Ctrl+Z; fazê-los (na ronda) não.
              onPassos: (indice, passos) => selectedToken && useMapStore.getState().setPatrolPassos(selectedToken.id, indice, passos),
              pontoAberto: selectedToken !== null && pontoDaPatrulhaAberto?.tokenId === selectedToken.id ? pontoDaPatrulhaAberto.indice : null,
              onAbrirPonto: (indice) => usePatrulhaAndandoStore.getState().abrirPonto(selectedToken === null || indice === null ? null : { tokenId: selectedToken.id, indice }),
              esperandoMestre: selectedToken !== null && patrulhasAndando.get(selectedToken.id)?.esperandoMestre === true,
              onSeguir: () => selectedToken && usePatrulhaAndandoStore.getState().seguir(selectedToken.id),
            }}
            tokenCarry={{
              ...selectedTokenCarry,
              // Prender e soltar passam pelo histórico: Ctrl+Z desfaz.
              onCarry: (carrierId) => selectedToken && useMapStore.getState().carryToken(selectedToken.id, carrierId),
              onRelease: (carriedId) => useMapStore.getState().releaseCarriedToken(carriedId),
            }}
            // "Visto por": só com a sala aberta, lendo as telas que saíram pelo fio (`HostBridge.tokenSeenBy`).
            tokenSeenBy={
              room !== null && hostBridgeRef.current !== null
                ? { watch: hostBridgeRef.current.watchPlayerScreens, read: hostBridgeRef.current.tokenSeenBy }
                : undefined
            }
            tokenVehicle={{
              options: selectedToken ? vehicleSeatOptions(map, selectedToken.id) : [],
              // Os dois passam pelo histórico e leem o mapa ATUAL da store:
              // dois cliques seguidos nunca decidem sobre uma cópia velha.
              onSeatsChange: (lugares) => selectedToken && useMapStore.getState().setVehicleSeats(selectedToken.id, lugares),
              onPassengerChange: (tokenId, aBordo) => {
                if (selectedToken) useMapStore.getState().setVehiclePassenger(selectedToken.id, tokenId, aBordo)
              },
            }}
            tokenTransform={{
              onRotationChange: (rotation) => selectedToken && updateToken(selectedToken.id, { rotation }),
              onLockedChange: (locked) => selectedToken && updateToken(selectedToken.id, { locked }),
              // CONGELAR FICHA: o mesmo caminho do "Travado" (Ctrl+Z desfaz), e o
              // jogador recebe o floco no broadcast que toda mudança do mapa dispara.
              onCongeladoChange: (congelado) => selectedToken && updateToken(selectedToken.id, { congelado }),
              onHiddenChange: (hidden) => selectedToken && updateToken(selectedToken.id, { hidden }),
              onSecretChange: (secret) => selectedToken && useMapStore.getState().setItemSecret('token', selectedToken.id, secret),
              reveal: selectedToken ? secretRevealFor(selectedToken.id) : null,
            }}
            tokenPlayerCharacter={{
              // Mesmo caminho da cor: `updateToken` passa por `withHistory` (Ctrl+Z
              // desfaz), e a lista de quem chega muda no broadcast do mapa.
              onPlayerCharacterChange: (playerCharacter) => selectedToken && updateToken(selectedToken.id, { playerCharacter }),
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
              onLabelStyleChange: (patch) => selectedRegion && useMapStore.getState().setRoomLabelStyle(selectedRegion.id, patch),
              onRoofChange: (roof) => selectedRegion && useMapStore.getState().setRoomRoof(selectedRegion.id, roof),
              onComodoChange: (comodo) => selectedRegion && useMapStore.getState().setRoomComodo(selectedRegion.id, comodo),
              onTextoAoEntrarChange: (textoAoEntrar) => selectedRegion && useMapStore.getState().setRoomTexts(selectedRegion.id, { textoAoEntrar }),
              onNotaDoMestreChange: (notaDoMestre) => selectedRegion && useMapStore.getState().setRoomTexts(selectedRegion.id, { notaDoMestre }),
              onDarkChange: (dark) => selectedRegion && useMapStore.getState().setRoomDark(selectedRegion.id, dark),
              onFaccaoChange: (faccao) => selectedRegion && useMapStore.getState().setRoomFaccao(selectedRegion.id, faccao),
              // Só a herdada vira dica: com facção própria o campo já diz quem manda.
              faccaoHerdada: selectedRegion ? faccaoHerdada(map.regions, selectedRegion.id) : undefined,
              faccoesConhecidas: legendaFaccoes.map((item) => item.faccao),
              onRaioDeVisaoChange: (raio) => selectedRegion && mudarRaioDeVisaoDaSala(selectedRegion.id, raio),
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
              hazard:
                selectedRegion && selectedRoomHazard
                  ? {
                      kind: selectedRoomHazard.kind,
                      roomCount: selectedRoomHazard.roomCount,
                      canAdvance: selectedRoomHazard.canAdvance,
                      onKindChange: (kind) => useMapStore.getState().setRoomHazard(selectedRegion.id, kind),
                      onAdvance: () => {
                        const hazardId = selectedRoomHazard.hazardId
                        if (hazardId !== null) useMapStore.getState().advanceHazard(hazardId)
                      },
                    }
                  : undefined,
              conveyor:
                selectedRegion && selectedRoomConveyor
                  ? {
                      direction: selectedRoomConveyor.direction,
                      stepCells: selectedRoomConveyor.stepCells,
                      canAdvance: selectedRoomConveyor.canAdvance,
                      onChange: (setting) => useMapStore.getState().setRoomConveyor(selectedRegion.id, setting),
                      onAdvance: avancarEsteiras,
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
                // "Revelar para…" só na escada: é o outro item que o recorte sabe revelar a um só.
                reveal: secretTarget.kind === 'stair' ? secretRevealFor(secretTarget.id) : null,
              }
            }
            areaTrigger={
              selectedRegion && {
                kind: selectedRegionTrigger?.kind ?? null,
                revealed: selectedRegionTrigger?.revealed ?? false,
                // Cada escolha é um Ctrl+Z (`mapStore.setRegionTrigger`).
                onKindChange: (kind) => useMapStore.getState().setRegionTrigger(selectedRegion.id, kind),
                onRevealedChange: (revealed) => useMapStore.getState().setRegionTriggerRevealed(selectedRegion.id, revealed),
              }
            }
            concealZone={
              selectedConcealZone && {
                name: selectedConcealZone.name,
                onNameChange: (name) => useMapStore.getState().updateConcealZone(selectedConcealZone.id, { name }),
                revealed: selectedConcealZone.revealed,
                onRevealedChange: (revealed) => useMapStore.getState().updateConcealZone(selectedConcealZone.id, { revealed }),
                onDelete: () => useMapStore.getState().removeConcealZone(selectedConcealZone.id),
                reveal: secretRevealFor(selectedConcealZone.id),
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
                  ? useMapStore
                      .getState()
                      // Deixar de ser de viagem também solta o pino da ficha: só a passagem anda com o navio.
                      // Deixar de ser alavanca solta a porta ligada no mesmo passo do desfazer.
                      .updatePin(
                        selectedPin.id,
                        kind === 'viagem'
                          ? { kind, portaLigada: undefined }
                          : { kind, destino: null, presoA: undefined, ...(kind === 'alavanca' ? {} : { portaLigada: undefined }) },
                      )
                  : useMapStore.getState().setPinKind(kind),
              travel: selectedPin?.kind === 'viagem' ? pinTravelPanel(selectedPin) : null,
              // Só com a sala aberta: sem sala não há jogador para reunir.
              gather:
                selectedPin && room !== null
                  ? {
                      pinId: selectedPin.id,
                      candidates: gatherListFor(selectedPin),
                      onGather: (playerIds) => handleGather(selectedPin.id, playerIds),
                    }
                  : null,
              // "Mostrar agora a…": regra de quando aparece em `canShowPinNow`.
              showNow:
                selectedPin && canShowPinNow(selectedPin, room !== null)
                  ? {
                      pinId: selectedPin.id,
                      candidates: showPinNowCandidates(partyMembers(roomPlayers, roomPanelWorld()), roomPanelWorld().open.sceneId),
                      onShow: (playerId) => handleShowPinNow(selectedPin.id, playerId),
                    }
                  : null,
              description: selectedPin?.description ?? null,
              onDescriptionChange: (description) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { description }),
              // Nome só do mestre: apagar grava AUSENTE (o pino de sempre), nunca `''`.
              nome: selectedPin?.nome ?? '',
              onNomeChange: (nome) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { nome: nome === '' ? undefined : nome }),
              // "Só eu leio": opcional no schema, pino antigo chega sem nota.
              notaDoMestre: selectedPin ? selectedPin.notaDoMestre ?? '' : null,
              onNotaDoMestreChange: (notaDoMestre) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { notaDoMestre }),
              // Veracidade, nunca `=== true`: `locked` é opcional no schema e
              // pino de mapa salvo antes desta fase chega sem o campo.
              locked: !!selectedPin?.locked,
              onLockedChange: (locked) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { locked }),
              // Opcionais no schema: ausente = pino de sempre. Desligar grava
              // AUSENTE (`undefined`), nunca `false`, que o disco não guarda.
              marco: selectedPin?.marco === true,
              onMarcoChange: (marco) => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { marco: marco ? true : undefined }),
              lerDePerto: selectedPin?.lerDePerto ?? null,
              onLerDePertoChange: (casas) =>
                selectedPin && useMapStore.getState().updatePin(selectedPin.id, { lerDePerto: casas ?? undefined }),
              // "Só o círculo, sem haste": a mesma regra do marco — ligar grava
              // `true`, desligar grava AUSENTE (o pino de sempre, com haste).
              semHaste: selectedPin?.semHaste === true,
              onSemHasteChange: (semHaste) =>
                selectedPin && useMapStore.getState().updatePin(selectedPin.id, { semHaste: semHaste ? true : undefined }),
              // FECHADURA COM SEGREDO: a combinação fica neste mapa; o host confere a tentativa.
              lock: selectedPin
                ? {
                    lock: selectedPin.segredo ?? null,
                    onChange: (segredo) => useMapStore.getState().updatePin(selectedPin.id, { segredo }),
                    doors: lockDoorOptions(map, selectedPin),
                  }
                : null,
              // COLEÇÃO DE PISTAS: a peça e a frase inteira ficam neste mapa; o host manda ao jogador só o progresso dele.
              colecao: selectedPin ? pinColecaoPanel(selectedPin, map.pins) : null,
              image: selectedPin?.image ?? null,
              onChooseImage: () => selectedPin && void handleChoosePinImage(selectedPin.id),
              onImageBlob: (blob) => selectedPin && void handlePinImageBlob(selectedPin.id, blob),
              onClearImage: () => selectedPin && useMapStore.getState().updatePin(selectedPin.id, { image: null }),
              onDelete: () => selectedPin && useMapStore.getState().removePin(selectedPin.id),
              // ITEM PEGÁVEL: só com um pino "!"/"?" aberto (a passagem não vai para a mochila).
              item:
                selectedPin && selectedPin.kind !== 'viagem' && selectedPin.kind !== 'alavanca'
                  ? {
                      value: selectedPin.item ?? null,
                      onChange: (item) => useMapStore.getState().updatePin(selectedPin.id, { item: item ?? undefined }),
                    }
                  : null,
              // LOJA COM PREÇOS: só com um pino "!"/"?" aberto. O "Quero" do jogador chega na caixa Pedidos.
              loja:
                selectedPin && selectedPin.kind !== 'viagem' && selectedPin.kind !== 'alavanca'
                  ? {
                      pinId: selectedPin.id,
                      loja: selectedPin.loja ?? null,
                      onChange: (loja) => useMapStore.getState().updatePin(selectedPin.id, { loja }),
                    }
                  : null,
              // PRESO À FICHA: só o pino de viagem (a prancha do navio, a porta da carroça).
              attachment:
                selectedPin && selectedPin.kind === 'viagem'
                  ? {
                      value: selectedPin.presoA ?? null,
                      options: pinAttachOptions(map.tokens),
                      onChange: (tokenId) => useMapStore.getState().updatePin(selectedPin.id, { presoA: tokenId ?? undefined }),
                    }
                  : null,
              // ALAVANCA: a porta que ela abre (desta cena, de qualquer sala) e o "Acionar agora" do mestre.
              lever: selectedPin && selectedPin.kind === 'alavanca' ? leverPanel(selectedPin) : null,
              // CABINE CONTÍNUA: o "!"/"?" leva ao próximo pino da cena; o de
              // viagem leva ao PAR (outra cena). A chegada oculta não leva de volta; a alavanca não é parada.
              cabin:
                selectedPin && selectedPin.soChegada !== true && selectedPin.kind !== 'alavanca'
                  ? {
                      target: cabinOf(map, selectedPin.id),
                      targets:
                        selectedPin.kind === 'viagem'
                          ? cabinTargetsOfPar(pinExitsTravelOf({ adventure, activeSceneId, cache: sceneCache }, map, selectedPin))
                          : cabinTargets(map, selectedPin.id),
                      emptyHint: selectedPin.kind === 'viagem' ? 'Ligue este pino a um par em outra cena para a cabine levar até lá.' : undefined,
                      canAdvance: canAdvanceImposed(map, conveyorRadii),
                      onChange: (targetId) => useMapStore.getState().setPinCabin(selectedPin.id, targetId),
                      onAdvance: avancarEsteiras,
                    }
                  : null,
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
              pastas: acervoPastas,
              aviso: acervoAviso,
              podeOrganizar: acervoPodeOrganizar,
              onPlace: (item) => void handlePlaceFromLibrary(item),
              onDropOnMap: handleDropFromLibrary,
              onDelete: (item) => void handleDeleteFromLibrary(item),
              onCriarPasta: (nome) => void handleCriarPasta(nome),
              onMover: (item, pasta) => void handleMoverNoAcervo(item, pasta),
              onRecolherPasta: (pasta, recolhida) => void handleRecolherPasta(pasta, recolhida),
              onApagarPasta: (pasta) => void handleApagarPasta(pasta),
            }}
            territorio={{
              filtroLigado: filtroFaccoes,
              onFiltroChange: (ligado) => useTerritorioStore.getState().setFiltroLigado(ligado),
              legenda: legendaFaccoes.map((item) => ({ faccao: item.faccao, cor: corCss(item.cor), salas: item.salas })),
              alerta: alertaDaCena(map),
              onAlertaChange: (nivel) => useMapStore.getState().setSceneAlerta(nivel),
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
              onVistaDeLongeChange: (vistaDeLonge) => selectedLight && mudarVistaDeLonge(selectedLight.id, vistaDeLonge),
            }}
            selectedStair={selectedStair}
            stairControls={{
              onDirectionChange: (direction) => selectedStair && setStairDirection(selectedStair.id, direction),
              onShapeChange: (shape) => selectedStair && setStairShape(selectedStair.id, shape),
              stepWidth: selectedStair?.stepWidth ?? map.grid,
              onStepWidthChange: (stepWidth) => selectedStair && setStairStepWidthForStair(selectedStair.id, stepWidth),
              grid: map.grid,
              // "Leva a…": `null` sem escada selecionada ou fora de uma aventura (a seção some).
              travel: selectedStair === null ? null : stairTravelPanel({ adventure, activeSceneId, cache: sceneCache }, map, selectedStair),
            }}
            pisos={{
              // PISOS NA MESMA CENA: as duas passam por `withHistory` — piso errado se desfaz com Ctrl+Z.
              onTokenPisoChange: (tokenId, piso) => useMapStore.getState().setTokenPiso(tokenId, piso),
              onStairPisosChange: (stairId, mudanca) => useMapStore.getState().setStairPisos(stairId, mudanca),
              pisoAtivo,
              onEditarPiso: (piso) => useMapStore.getState().setPisoAtivo(piso),
              onLevarSelecaoAoPiso: (piso) => useMapStore.getState().moverSelecaoAoPiso(piso),
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
            floorLayers={{
              floor: map.floor,
              floorFillColor: map.floorStyle.fillColor,
              selectedPieceId: selectedFloorPiece?.id ?? null,
              onSelect: (id) => setSelection(selectionOfItem({ kind: 'floor', id })),
              onToggleLock: (id, locked) => updateFloorPiece(id, { locked: locked || undefined }),
              onColorChange: (id, color) => updateFloorPiece(id, { fillColor: color }),
              onReorder: (id, delta) => reorderFloorPiece(id, delta),
              onToggleHidden: (id, hidden) => updateFloorPiece(id, { hidden: hidden || undefined }),
              onRename: (id, nome) => updateFloorPiece(id, { nome }),
              pincel: pincelNasCamadas,
            }}
          />
        </div>
        <ActionBar
          onSave={handleSave}
          onOpen={handleOpen}
          onImportBackground={handleImportBackground}
          onExportFolder={handleExportFolder}
          onExportImage={() => setExportImageState({ busy: false, error: null })}
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
          onShowShortcuts={() => setShortcutsOpen(true)}
          shortcutsOpen={shortcutsOpen}
        />
      </div>

      <RightColumn
        open={rightOpen}
        onOpenChange={setRightOpen}
        tabs={rightColumnTabs()}
        active={rightTab}
        onActiveChange={setRightTab}
        unread={chatUnread}
        scenesOpen={scenesOpen}
        columnRef={rightColumnRef}
        top={rightOpen && npcsPauseButton('lb-npcs-pausa--coluna')}
        scenes={
          <ScenesSection
            scenes={scenesPanel}
            onSelect={handleSelectScene}
            onCreate={handleCreateScene}
            onRename={(sceneId, name, publicName) => {
              const adventureStore = useAdventureStore.getState()
              adventureStore.renameScene(sceneId, name)
              adventureStore.setScenePublicName(sceneId, publicName)
            }}
            // Visão geral: a cena aberta pelo mapa vivo, as de fundo pelo cache (fichas de jogador que andam aparecem na hora).
            maps={sceneMaps({ adventure, activeSceneId, cache: sceneCache }, map)}
            // A miniatura da cena aberta mostra o andar que o editor mostra.
            pisoAberto={pisoAtivo}
            // Mesmas linhas do painel Grupo: quem está em cada cena e os pedidos que esperam.
            people={scenePeople()}
            // Há quanto tempo cada cena com gente espera o mestre ('há N min').
            waitingSince={waitingSince}
            // Recado por cena só com a sala aberta: sem sala não há quem leia.
            onNote={room === null ? undefined : (sceneId, text, playerIds) => hostBridgeRef.current?.sceneNote(sceneId, text, playerIds) ?? null}
            // A flag grava com a aventura; o snapshot sai pelo throttle do mapa para quem já está lá.
            onTogglePlanKnown={(sceneId, known) => {
              useAdventureStore.getState().setScenePlanKnown(sceneId, known)
              hostBridgeRef.current?.notifyMapChanged()
            }}
            players={roomPlayers.map((p) => ({ playerId: p.playerId, name: p.name }))}
            // "Revelar planta para…" só com a sala aberta: sem sala não há para quem.
            onRevealPlanFor={room === null ? undefined : (sceneId, playerIds) => hostBridgeRef.current?.revealPlanFor(sceneId, playerIds) ?? null}
            // Menu "…" da cena: só com aventura (o mapa solto não tem lista de cenas para mexer).
            onDuplicate={adventure === null ? undefined : handleDuplicateScene}
            onShift={adventure === null ? undefined : (sceneId, delta) => useAdventureStore.getState().shiftScene(sceneId, delta)}
            onDelete={adventure === null ? undefined : handleDeleteScene}
            deletionInfo={
              adventure === null ? undefined : (sceneId) => sceneDeletionInfo({ adventure, activeSceneId, cache: sceneCache }, map, sceneId, roomPlayers)
            }
            // Cenas em pastas: só a lista do mestre muda (pede Salvar); o jogador não recebe nada.
            onMove={adventure === null ? undefined : (sceneId, parentId) => useAdventureStore.getState().moveScene(sceneId, parentId)}
            adventureId={adventure?.id ?? null}
            // Alarme para várias cenas, também só com a sala aberta.
            alarm={room === null ? null : sceneAlarm}
            onAlarm={soarAlarme}
            onEndAlarm={
              room === null
                ? undefined
                : () => {
                    hostBridgeRef.current?.endAlarm()
                    setSceneAlarm(null)
                  }
            }
            // Pausa por cena também só com a sala aberta: sem sala não há grupo esperando.
            paused={pausedScenes}
            onTogglePause={
              room === null
                ? undefined
                : (sceneId, pause) => {
                    // O botão só muda depois que a sessão aceitou: o estado que o jogador vê é o dela.
                    if (hostBridgeRef.current?.setScenePaused(sceneId, pause) !== true) return
                    setPausedScenes((current) => {
                      const next = new Set(current)
                      if (pause) next.add(sceneId)
                      else next.delete(sceneId)
                      return next
                    })
                  }
            }
            // Abalo por distância: mesma regra do recado, um envio para a aventura inteira.
            onQuake={room === null ? undefined : (origem, textos, vizinhas) => hostBridgeRef.current?.abalo(origem, textos, vizinhas) ?? null}
            // Corte da torre: clicar numa ficha é o mestre escolhendo a vista (como o "Ir lá" do Grupo), então desliga o seguir.
            // O revisor também vale no mapa solto, cujo id na lista é '': ali "a cena" é a aberta.
            onGoToPoint={(sceneId, x, y) => {
              useFollowStore.getState().stop()
              useAdventureStore.getState().goToPoint(sceneId === '' ? null : sceneId, { x, y })
            }}
            towerPlayers={roomPlayers.length === 0 ? undefined : jogadoresDoCorte(roomPlayers)}
            // Revisor da aventura: o conserto entra no desfazer da cena aberta, ou marca a de fundo para salvar.
            onFix={consertarNaAventura}
            // Na coluna da direita a lista não empurra mais a ficha do item: nasce aberta.
            // Aberta ou recolhida, a coluna reparte a altura por isso.
            onOpenChange={setScenesOpen}
          />
        }
      />

      {/* O HUD lê a escala da câmera direto da store: o zoom não re-renderiza o App. */}
      <ZoomHud onReset={() => setResetZoomRequest((n) => n + 1)} />
      {/* PISOS NA MESMA CENA: só aparece quando a cena tem pisos (ou o mestre já saiu do térreo) — mapa de um piso não ganha controle à toa. */}
      {(pisoAtivo !== 0 || mapaTemPisos) && <PisoHud piso={pisoAtivo} onPisoChange={(piso) => useMapStore.getState().setPisoAtivo(piso)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {exportImageState !== null && (
        <ExportImageDialog
          defaultGrid={map.showGrid}
          busy={exportImageState.busy}
          error={exportImageState.error}
          onExport={(options) => void handleExportImage(options)}
          onClose={() => {
            if (!exportImageState.busy) setExportImageState(null)
          }}
        />
      )}
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
      {/* Dado rolado na sala: só com a sala aberta — sem mesa, não há quem veja a rolagem. */}
      {room !== null && <DiceDock rolls={diceRolls} onRoll={(request, hidden) => hostBridgeRef.current?.rollDice(request, hidden)} />}
    </div>
  )
}

export default App
