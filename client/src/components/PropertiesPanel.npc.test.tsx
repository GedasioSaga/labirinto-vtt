import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { colocarPecaDoAcervo, criarToken, marcarFichaNpc } from '../stores/criarToken'
import { useMapStore } from '../stores/mapStore'
import type { LayerId, Token } from '../types/map'
import { PropertiesPanel } from './PropertiesPanel'
import { TOKEN_NPC_HINT } from './TokenNpcControls'

/*
 * O interruptor "Ficha de NPC" tem de estar no painel de propriedades DE
 * VERDADE, na seção da ficha selecionada, e ligado ao mapa pelo mesmo
 * `marcarFichaNpc` que o App passa em `tokenNpc`. Renderizar o controle solto
 * não prova isso: tirá-lo do `PropertiesPanel` deixaria aquele teste verde.
 */

type PainelProps = ComponentProps<typeof PropertiesPanel>

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

/** Painel como o App monta com a ferramenta Selecionar e UMA ficha selecionada; o resto do mapa vazio. */
function propsDoPainel(ficha: Token): PainelProps {
  const map = useMapStore.getState().map
  return {
    mapName: map.name,
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
    selectedWall: null,
    wallDoor: { onToggleDoor: nada, onToggleOpen: nada, onToggleLocked: nada },
    doorKind: { kind: 'normal', onKindChange: nada },
    doorMode: { mode: 'porta', onModeChange: nada },
    wallStyle: { wallKind: undefined, onWallKindChange: nada },
    selectedProp: null,
    onSetPropLayer: nada,
    propTransform: { onLockedChange: nada },
    selectedToken: ficha,
    tokenName: { onNameChange: nada },
    tokenImage: { onChangeImage: nada, onClearImage: nada, onSaveToLibrary: nada },
    tokenColor: { onColorChange: nada },
    tokenSize: { onSizeChange: nada },
    // A mesma ligação de App.tsx (`tokenNpc`).
    tokenNpc: { onNpcChange: (npc) => marcarFichaNpc(ficha.id, npc) },
    tokenTransform: { onLockedChange: nada },
    selectedTextLabel: null,
    textLabel: { onTextChange: nada, onColorChange: nada, onFontSizeChange: nada, onFontFamilyChange: nada },
    regionTransform: { onLockedChange: nada },
    selectedRegion: null,
    regionStyle: { color: '#ffffff', onColorChange: nada, pattern: 'solid', onPatternChange: nada },
    room: { onNameChange: nada, onWidthChange: nada, onHeightChange: nada, onRotationChange: nada, onRotateBy: nada },
    selectedLight: null,
    lightControls: { onColorChange: nada, onIntensityChange: nada },
    selectedStair: null,
    stairControls: { onDirectionChange: nada, stepWidth: 1, onStepWidthChange: nada, grid: map.grid },
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
    pin: {
      kind: 'exclamacao',
      onKindChange: nada,
      description: null,
      onDescriptionChange: nada,
      locked: false,
      onLockedChange: nada,
      image: null,
      onChooseImage: nada,
      onClearImage: nada,
      onDelete: nada,
    },
    pinIcon: { icon: null, onIconChange: nada },
    pinSelected: false,
    tokenLibrary: { itens: [], aviso: null, onPlace: nada, onDropOnMap: () => false, onDelete: nada },
  }
}

describe('"Ficha de NPC" no painel de propriedades', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: createEmptyMap('m1', 'Casa', 20, 20, 50),
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function fichaNoMapa(id: string): Token {
    const ficha = useMapStore.getState().map.tokens.find((t) => t.id === id)
    if (ficha === undefined) throw new Error(`ficha ${id} não está no mapa`)
    return ficha
  }

  /** Renderiza o painel com a ficha como está no mapa AGORA, como o App faz a cada mudança da store. */
  function renderPainel(id: string): void {
    act(() => root.render(<PropertiesPanel {...propsDoPainel(fichaNoMapa(id))} />))
  }

  /** O interruptor achado pelo rótulo visível, como o mestre acha. */
  function interruptorNpc(): HTMLInputElement | null {
    const rotulo = Array.from(container.querySelectorAll('label')).find((el) => (el.textContent ?? '').includes('Ficha de NPC'))
    return rotulo?.querySelector('input[type="checkbox"]') ?? null
  }

  it('ficha comum selecionada: o painel mostra "Ficha de NPC" desligado, com a dica do que muda', () => {
    const id = criarToken('Gina', { at: { x: 300, y: 300 } }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)

    const caixa = interruptorNpc()
    expect(caixa).not.toBe(null)
    expect(caixa?.checked).toBe(false)
    expect(document.getElementById(caixa?.getAttribute('aria-describedby') ?? '')?.textContent).toBe(TOKEN_NPC_HINT)
  })

  it('ligar no painel grava npc: true no mapa (um desfazer); desligar grava false', () => {
    const id = criarToken('Mordomo', { at: { x: 300, y: 300 } }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)
    const antes = useMapStore.getState().past.length

    act(() => interruptorNpc()?.click())
    expect(fichaNoMapa(id).npc).toBe(true)
    expect(useMapStore.getState().past.length).toBe(antes + 1)

    renderPainel(id)
    expect(interruptorNpc()?.checked).toBe(true)
    act(() => interruptorNpc()?.click())
    expect(fichaNoMapa(id).npc).toBe(false)
  })

  it('ficha trazida do acervo abre no painel já com "Ficha de NPC" ligado', () => {
    const id = colocarPecaDoAcervo({ nome: 'Mordomo', tamanho: 1 }, 'tok-mordomo', { image: null, imageData: null }, { x: 300, y: 300 }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)

    expect(interruptorNpc()?.checked).toBe(true)
  })
})
