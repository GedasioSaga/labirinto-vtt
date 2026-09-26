import type { ComponentProps } from 'react'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import type { LayerId, Token } from '../types/map'
import type { PropertiesPanel } from './PropertiesPanel'

/*
 * Só para teste: as props do `PropertiesPanel` como o App monta com a
 * ferramenta Selecionar e UMA ficha selecionada. Cada teste troca só a ligação
 * que prova (`tokenNpc`, `tokenSceneCarry`) — a do App, não uma inventada.
 */

export type PainelProps = ComponentProps<typeof PropertiesPanel>

const nada = (): void => {}
const CONTAGEM_ZERO: Record<LayerId, number> = {
  paredes: 0,
  portas: 0,
  salas: 0,
  escadas: 0,
  objetos: 0,
  decoracao: 0,
  iluminacao: 0,
  tokens: 0,
  anotacoes: 0,
}

/** Painel com UMA ficha selecionada (ou nenhuma) e o resto do mapa vazio; `extra` troca as ligações que o teste prova. */
export function propsDoPainel(ficha: Token | null, extra: Partial<PainelProps> = {}): PainelProps {
  const map = useMapStore.getState().map
  return {
    mapName: map.name,
    onMapSizeApply: nada,
    mapWidth: map.width,
    mapHeight: map.height,
    mapGrid: map.grid,
    activeTool: 'select',
    groups: relevantPropertyGroups('select', { token: true }),
    lineCap: null,
    lineShape: null,
    fill: { filled: false, onFilledChange: nada },
    areaSelection: { selection: null, onClear: nada },
    alignDistribute: { count: 1, onAlign: nada, onDistribute: nada },
    drawingStyle: {
      color: '#ffffff',
      onColorChange: nada,
      width: 2,
      onWidthChange: nada,
      filled: false,
      onFilledChange: nada,
      fillAlpha: 1,
      onFillAlphaChange: nada,
      showFilled: false,
      showWidth: false,
      fontSize: 16,
      onFontSizeChange: nada,
      fontFamily: 'Arial',
      onFontFamilyChange: nada,
      showFontSize: false,
    },
    pathStyle: { color: '#ffffff', onColorChange: nada, widthCells: 1, onWidthCellsChange: nada },
    grid: {
      showGrid: map.showGrid,
      onShowGridChange: nada,
      gridShape: map.gridShape,
      onGridShapeChange: nada,
      snapTargets: { token: true, wall: true, prop: true },
      onSnapTargetChange: nada,
      gridSettings: map.gridSettings,
      onGridSettingsChange: nada,
    },
    mapScale: { scale: map.scale, onScaleChange: nada, measurementMode: map.measurementMode, onMeasurementModeChange: nada, gridShape: map.gridShape },
    faceRange: { faceRangeCells: null, onFaceRangeCellsChange: nada },
    gridAlign: {
      backgroundFilename: null,
      imageWidth: null,
      imageHeight: null,
      cellSize: map.grid,
      offset: { x: 0, y: 0 },
      onOffsetChange: nada,
      onApply: nada,
      onPreviewChange: nada,
    },
    layers: { hiddenLayers: [], lockedLayers: [], counts: CONTAGEM_ZERO, onToggleLayer: nada, onToggleLock: nada },
    selection: { selection: null, defaultTokenName: 'Token', onAddToken: nada, onRemoveSelected: nada },
    scenarioLink: { scenarioLink: null, onScenarioLinkChange: nada },
    sceneVision: { visionCells: undefined, onVisionCellsChange: nada },
    selectedWall: null,
    wallDoor: { onToggleDoor: nada, onToggleOpen: nada, onToggleLocked: nada, onToggleSecret: nada, onRevealPassage: nada, onOpensFromChange: nada },
    doorKind: { kind: 'normal', onKindChange: nada },
    doorMode: { mode: 'porta', onModeChange: nada },
    wallStyle: { wallKind: undefined, onWallKindChange: nada },
    selectedProp: null,
    onSetPropLayer: nada,
    propTransform: { onLockedChange: nada },
    propPlayer: { onLabelChange: nada, onShowImageChange: nada },
    selectedToken: ficha,
    tokenName: { onNameChange: nada, onPublicNameChange: nada },
    tokenImage: { onChangeImage: nada, onClearImage: nada, onSaveToLibrary: nada },
    tokenColor: { onColorChange: nada },
    tokenSize: { onSizeChange: nada },
    // Grupo mundo: vida, condição e vigia da ficha (as ligações de App.tsx).
    tokenHealth: { onHealthChange: nada },
    tokenCondition: { onToggleCondition: nada },
    tokenWatch: { onWatchChange: nada },
    // Grupo mundo (onda 3): rota de patrulha e "Vai junto de" (levar ficha junto), sem rota nem vínculo.
    tokenPatrol: { onPatrolOp: nada },
    tokenCarry: { carrier: null, carried: [], candidates: [], onCarry: nada, onRelease: nada },
    // A mesma ligação de App.tsx (`tokenNpc`).
    tokenNpc: { onNpcChange: nada },
    // Grupo rede: "Ficha de jogador" (quem chega escolhe a ficha).
    tokenPlayerCharacter: { onPlayerCharacterChange: nada },
    tokenLights: { lights: [], onSelectLight: nada, onDetach: nada },
    tokenTransform: { onLockedChange: nada },
    selectedTextLabel: null,
    textLabel: { onTextChange: nada, onColorChange: nada, onFontSizeChange: nada, onFontFamilyChange: nada },
    regionTransform: { onLockedChange: nada },
    selectedRegion: null,
    regionStyle: { color: '#ffffff', onColorChange: nada, pattern: 'solid', onPatternChange: nada },
    room: { onNameChange: nada, onWidthChange: nada, onHeightChange: nada, onRotationChange: nada, onRotateBy: nada, onRaioDeVisaoChange: nada },
    selectedLight: null,
    lightControls: { onColorChange: nada, onIntensityChange: nada, tokens: [], onAttach: nada, onDetach: nada, onVistaDeLongeChange: nada },
    selectedStair: null,
    stairControls: { onDirectionChange: nada, onShapeChange: nada, stepWidth: 1, onStepWidthChange: nada, grid: map.grid, travel: null },
    polygonSides: { sides: 6, onSidesChange: nada },
    selectedFloorPiece: null,
    floorPieceControls: { index: 0, count: 0, grid: map.grid, onChange: nada, onReorder: nada, onRemove: nada },
    floorStyle: {
      style: map.floorStyle,
      onStyleChange: nada,
      frame: map.frame,
      onFrameChange: nada,
      defaultFrameRect: { x: 0, y: 0, w: map.width, h: map.height },
      hasFloorContent: false,
    },
    playerSecret: null,
    concealZone: null,
    concealBrush: { mode: 'revelar', onModeChange: nada, width: 1, onWidthChange: nada },
    pin: {
      kind: 'exclamacao',
      onKindChange: nada,
      description: null,
      onDescriptionChange: nada,
      locked: false,
      onLockedChange: nada,
      marco: false,
      onMarcoChange: nada,
      lerDePerto: null,
      onLerDePertoChange: nada,
      image: null,
      onChooseImage: nada,
      onClearImage: nada,
      onDelete: nada,
    },
    pinIcon: { icon: null, onIconChange: nada },
    pinSelected: false,
    tokenLibrary: { itens: [], aviso: null, onPlace: nada, onDropOnMap: () => false, onDelete: nada },
    // Grupo mundo: sem Sala selecionada, sem gatilho de área a mostrar.
    areaTrigger: null,
    ...extra,
  }
}
