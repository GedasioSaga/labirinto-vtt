import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NOVA_CAMADA } from '../../lib/camadasDoPincel'
import { createEmptyMap } from '../../lib/mapFactory'
import { DEFAULT_FLOOR_STYLE } from '../../lib/mapFile'
import { PixiCanvas } from '../../pixi/PixiCanvas'
import { useMapStore } from '../../stores/mapStore'
import type { FloorPiece, LayerId, MapData, Region } from '../../types/map'
import type { FloorLayersListProps } from '../FloorLayersList'
import type { TerritorioControlsProps } from '../TerritorioControls'
import { PaginaCena, type PaginaCenaProps } from './PaginaCena'

/*
 * Página Cena do livro do mestre (fatia 18): cada parte é uma ficha com o
 * resumo à vista enquanto fechada. E as setas que passam de cabeçalho em
 * cabeçalho ficam na página: o mapa, montado ao lado como no app, não as lê
 * como empurrão da seleção.
 */

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 1200, 800)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = new pixi.Ticker()
    readonly canvas = document.createElement('canvas')
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

const nada = (): void => {}
const GRADE = 64

const CONTAGENS: Record<LayerId, number> = {
  paredes: 4,
  portas: 1,
  salas: 1,
  escadas: 0,
  objetos: 0,
  decoracao: 0,
  iluminacao: 0,
  tokens: 0,
  anotacoes: 0,
}
const TODAS_AS_CAMADAS: LayerId[] = ['paredes', 'portas', 'salas', 'escadas', 'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes']

function peca(id: string): FloorPiece {
  return { id, shape: { kind: 'rect', cx: 0, cy: 0, w: GRADE, h: GRADE }, op: 'add', modifiers: {} }
}

function camadasDoChao(floor: FloorPiece[], extra: Partial<FloorLayersListProps> = {}): FloorLayersListProps {
  return { floor, floorFillColor: DEFAULT_FLOOR_STYLE.fillColor, selectedPieceId: null, onSelect: nada, onToggleLock: nada, onColorChange: nada, onReorder: nada, ...extra }
}

const PINCEL: FloorLayersListProps['pincel'] = { ativaId: NOVA_CAMADA, nomeDaNova: 'Camada 1', corDaNova: '#2f6690', onAtivar: nada, onNovaCamada: nada }

function territorio(alerta: TerritorioControlsProps['alerta']): TerritorioControlsProps {
  return { filtroLigado: false, onFiltroChange: nada, legenda: [], alerta, onAlertaChange: nada }
}

/** Só o que a página exige: sem Objetos, Território nem Camadas do chão. */
function props(extra: Partial<PaginaCenaProps> = {}): PaginaCenaProps {
  return {
    mapName: 'Cripta',
    mapWidth: 30,
    mapHeight: 20,
    mapGrid: GRADE,
    floorStyle: { style: { ...DEFAULT_FLOOR_STYLE }, onStyleChange: nada, frame: null, onFrameChange: nada, defaultFrameRect: { x: 0, y: 0, w: 1920, h: 1280 }, hasFloorContent: true },
    layers: { hiddenLayers: [], lockedLayers: [], counts: CONTAGENS, onToggleLayer: nada, onToggleLock: nada },
    grid: {
      showGrid: false,
      onShowGridChange: nada,
      gridShape: 'square',
      onGridShapeChange: nada,
      snapTargets: { token: true, wall: true, prop: true },
      onSnapTargetChange: nada,
      gridSettings: { color: '#000000', opacity: 0.25, lineWidth: 1, lineStyle: 'solid' },
      onGridSettingsChange: nada,
    },
    ...extra,
  }
}

let container: HTMLDivElement
let root: Root

function iniciar(): void {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
}

function encerrar(): void {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
}

const pagina = (p: PaginaCenaProps) => act(() => root.render(<PaginaCena {...p} />))

const titulos = () => [...container.querySelectorAll('.gr-ficha__tit')].map((t) => t.textContent)

function cabecalho(titulo: string): HTMLButtonElement {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('.gr-ficha__cab')].find((b) => b.querySelector('.gr-ficha__tit')?.textContent === titulo)
  if (botao === undefined) throw new Error(`sem a ficha "${titulo}"`)
  return botao
}

/** O que a ficha fechada diz, pela descrição do cabeçalho; `null` sem resumo. */
function resumo(titulo: string): string | null {
  const id = cabecalho(titulo).getAttribute('aria-describedby')
  if (id === null) return null
  const alvo = document.getElementById(id)
  if (alvo === null) throw new Error(`a descrição de "${titulo}" aponta para #${id}, que não existe`)
  return alvo.textContent
}

describe('PaginaCena: o resumo de cada ficha fechada', () => {
  beforeEach(() => {
    iniciar()
    // Chão do mapa, Camadas do chão e Camadas nascem abertas; o resumo é o da ficha fechada.
    for (const id of ['floor', 'floor-layers', 'layers']) window.localStorage.setItem(`lb-section:${id}`, '0')
  })
  afterEach(encerrar)

  it('sem os opcionais a página só tem Chão do mapa e Camadas, com o título da cena', () => {
    pagina(props())
    expect(titulos()).toEqual(['Chão do mapa', 'Camadas'])
    expect(container.textContent).toContain('Cripta, 30 × 20 casas de 64 px')
  })

  it('Chão do mapa diz se há contorno: strokeColor null é "Sem contorno", uma cor é "Com contorno"', () => {
    pagina(props())
    expect(resumo('Chão do mapa')).toBe('Sem contorno')
    pagina(props({ floorStyle: { ...props().floorStyle, style: { ...DEFAULT_FLOOR_STYLE, strokeColor: '#000000' } } }))
    expect(resumo('Chão do mapa')).toBe('Com contorno')
  })

  it('Camadas conta as visíveis das 9: nenhuma oculta, duas e todas', () => {
    pagina(props())
    expect(resumo('Camadas')).toBe('9 de 9 visíveis')
    pagina(props({ layers: { ...props().layers, hiddenLayers: ['paredes', 'tokens'] } }))
    expect(resumo('Camadas')).toBe('7 de 9 visíveis')
    pagina(props({ layers: { ...props().layers, hiddenLayers: TODAS_AS_CAMADAS } }))
    expect(resumo('Camadas')).toBe('0 de 9 visíveis')
  })

  it('Camadas do chão conta as peças no singular e no plural', () => {
    pagina(props({ floorLayers: camadasDoChao([peca('chao')]) }))
    expect(resumo('Camadas do chão')).toBe('1 peça')
    pagina(props({ floorLayers: camadasDoChao([peca('mar'), peca('chao'), peca('trilha')]) }))
    expect(resumo('Camadas do chão')).toBe('3 peças')
  })

  it('Camadas do chão sem peça: some sem o pincel; com o pincel aparece, sem "0 peças"', () => {
    pagina(props({ floorLayers: camadasDoChao([]) }))
    expect(titulos()).not.toContain('Camadas do chão')
    pagina(props({ floorLayers: camadasDoChao([], { pincel: PINCEL }) }))
    expect(titulos()).toContain('Camadas do chão')
    expect(resumo('Camadas do chão')).toBeNull()
    expect(cabecalho('Camadas do chão').querySelector('.gr-ficha__resumo')).toBeNull()
  })

  it('Território diz o alerta da cena, em minúscula, e vem antes do Chão do mapa', () => {
    pagina(props({ territorio: territorio('cacada') }))
    expect(titulos()).toEqual(['Território', 'Chão do mapa', 'Camadas'])
    expect(resumo('Território')).toBe('Alerta caçada')
    pagina(props({ territorio: territorio('calmo') }))
    expect(resumo('Território')).toBe('Alerta calmo')
  })

  it('aberta, a ficha tira o resumo da descrição', () => {
    pagina(props())
    act(() => cabecalho('Camadas').click())
    expect(resumo('Camadas')).toBeNull()
  })
})

function sala(id: string): Region {
  return {
    id,
    points: [
      { x: 320, y: 320 },
      { x: 576, y: 320 },
      { x: 576, y: 576 },
      { x: 320, y: 576 },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Cripta' },
  }
}

const SALA = sala('cripta')

function mapa(): MapData {
  return { ...createEmptyMap('m_setas_na_cena', 'Setas na cena', 30, 20, GRADE), regions: [SALA] }
}

const empurraoDeVerdade = useMapStore.getState().moveSelectionBy
/** O que o `nudgeSelected` do mapa chama: espiado, mas ainda movendo de verdade. */
const empurrao = vi.fn(empurraoDeVerdade)
const exportador = vi.fn()

function teclar(el: Element, key: string, shiftKey = false): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
  })
}

const pontosDaSala = () => useMapStore.getState().map.regions.find((r) => r.id === SALA.id)?.points

describe('PaginaCena com o mapa montado: a seta no cabeçalho não empurra a sala selecionada', () => {
  beforeEach(async () => {
    iniciar()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
    empurrao.mockClear()
    useMapStore.setState({
      map: mapa(),
      selection: [{ kind: 'region', id: SALA.id }],
      past: [],
      future: [],
      activeTool: 'select',
      camera: { x: 0, y: 0, scale: 1 },
      moveSelectionBy: empurrao,
    })
    await act(async () => {
      root.render(
        <>
          <PixiCanvas onImageExporterChange={exportador} />
          <PaginaCena {...props({ territorio: territorio('calmo'), floorLayers: camadasDoChao([peca('chao')]) })} />
        </>,
      )
    })
    await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  })

  afterEach(() => {
    encerrar()
    useMapStore.setState({ moveSelectionBy: empurraoDeVerdade })
    vi.unstubAllGlobals()
  })

  it('controle: a seta fora da página ainda é o empurrão do mapa (o ouvinte está vivo)', () => {
    teclar(document.body, 'ArrowDown')
    expect(empurrao).toHaveBeenCalledTimes(1)
    expect(pontosDaSala()?.[0]).toEqual({ x: 320, y: 320 + GRADE })
  })

  it('foco em "Chão do mapa" (onde o "Ir para Cena" o põe), seta para baixo: o foco vai a "Camadas do chão" e a sala fica', () => {
    const chao = cabecalho('Chão do mapa')
    act(() => chao.focus())
    teclar(chao, 'ArrowDown')
    expect(document.activeElement).toBe(cabecalho('Camadas do chão'))
    expect(empurrao).not.toHaveBeenCalled()
    expect(pontosDaSala()).toEqual(SALA.points)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('Shift+seta (o empurrão de 10 casas), seta para cima, Home e End: o foco anda e a sala não', () => {
    const chao = cabecalho('Chão do mapa')
    act(() => chao.focus())
    teclar(chao, 'ArrowDown', true)
    expect(document.activeElement).toBe(cabecalho('Camadas do chão'))
    teclar(cabecalho('Camadas do chão'), 'ArrowUp', true)
    expect(document.activeElement).toBe(chao)
    teclar(chao, 'End')
    expect(document.activeElement).toBe(cabecalho('Camadas'))
    teclar(cabecalho('Camadas'), 'Home')
    expect(document.activeElement).toBe(cabecalho('Território'))
    expect(empurrao).not.toHaveBeenCalled()
    expect(pontosDaSala()).toEqual(SALA.points)
  })

  it('na ponta da pilha a seta não tem para onde levar o foco, e mesmo assim não chega ao mapa', () => {
    const camadas = cabecalho('Camadas')
    act(() => camadas.focus())
    teclar(camadas, 'ArrowDown')
    expect(document.activeElement).toBe(camadas)
    expect(empurrao).not.toHaveBeenCalled()
    expect(pontosDaSala()).toEqual(SALA.points)
  })
})
