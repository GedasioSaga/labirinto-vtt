import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { Drawing, FloorPiece, MapData, Region, Wall } from '../types/map'
import { DOOR_COLOR } from './drawDoors'
import { WALL_COLOR } from './drawWalls'
import { PixiCanvas } from './PixiCanvas'

/**
 * PAREDES POR CIMA DA TINTA, no editor do mestre (pedido de 03/10/2026: "as
 * paredes é para sempre ficar em cima da parte de pincel, até no balde"). Com
 * o PixiCanvas montado pelo caminho de verdade (mesmo arranjo sem GPU de
 * `PixiCanvas.guias.test.tsx`), a prova é a ORDEM dos Graphics no `world`: o
 * que pinta a tinta do chão (pincel e balde do Chão) e a pintura do balde de
 * tinta do Desenho fica ANTES — logo, por baixo — de paredes e portas. A
 * exportação de imagem usa o mesmo palco, então vale para ela também.
 */

const tela = vi.hoisted(() => ({ apps: [] as { stage: Container }[] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 1200, 800)
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = new pixi.Ticker()
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.apps.push({ stage: this.stage })
    }
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

const GRADE = 64
/** Cores que nenhuma outra camada usa: é por elas que cada Graphics é achado. */
const COR_DA_TINTA_DO_CHAO = '#2f6690'
const COR_DA_TINTA_DO_DESENHO = '#d94f3a'

const SALA: Region = {
  id: 'sala',
  points: [
    { x: 128, y: 128 },
    { x: 512, y: 128 },
    { x: 512, y: 448 },
    { x: 128, y: 448 },
  ],
  tag: '',
  fillColor: '#a8776a',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Sala' },
}

function paredes(): Wall[] {
  return SALA.points.map((p, i) => {
    const q = SALA.points[(i + 1) % SALA.points.length]
    const porta = i === 0 ? { state: 'closed' as const, locked: false } : null
    return { id: `p${i}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: porta, regionId: SALA.id, regionEdgeIndex: i } as Wall
  })
}

/** A tinta do pincel/balde do Chão: blocos com cor própria, colados nas paredes. */
const TINTA_DO_CHAO: FloorPiece = {
  id: 'tinta',
  shape: { kind: 'blocos', cell: GRADE, cells: [{ col: 2, row: 2 }, { col: 7, row: 6 }] },
  op: 'add',
  fillColor: COR_DA_TINTA_DO_CHAO,
  modifiers: {},
}

/** A pintura do balde de tinta do Desenho (`ehPinturaDeBalde`: polígono cheio, espessura 0). */
const TINTA_DO_DESENHO: Drawing = {
  id: 'balde',
  kind: 'polygon',
  points: [
    { x: 124, y: 124 },
    { x: 516, y: 124 },
    { x: 516, y: 452 },
    { x: 124, y: 452 },
  ],
  color: COR_DA_TINTA_DO_DESENHO,
  width: 0,
  filled: true,
  fillAlpha: 1,
}

function mapa(): MapData {
  return { ...createEmptyMap('m_paredes', 'Paredes', 12, 10, GRADE), regions: [SALA], walls: paredes(), floor: [TINTA_DO_CHAO], drawings: [TINTA_DO_DESENHO] }
}

let raiz: HTMLDivElement
let root: Root
const exportador = vi.fn()

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  tela.apps.length = 0
  exportador.mockClear()
  useMapStore.setState({ map: mapa(), selection: [], past: [], future: [], activeTool: 'select', camera: { x: 0, y: 0, scale: 1 } })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
})

async function monta(): Promise<Container> {
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  const app = tela.apps.at(-1)
  if (app === undefined) throw new Error('o PixiCanvas não criou o Application')
  return app.stage.children[0] as Container
}

type Instrucao = Graphics['context']['instructions'][number]

function corDe(i: Instrucao): number | undefined {
  if (i.action !== 'fill' && i.action !== 'stroke') return undefined
  return i.data.style.color
}

/** Índice no `world` do primeiro Graphics que pinta com `cor` (preenchimento ou traço). */
function indiceDaCamada(world: Container, cor: number): number {
  const i = world.children.findIndex((filho) => filho instanceof Graphics && filho.context.instructions.some((ins) => corDe(ins) === cor))
  if (i < 0) throw new Error(`nenhuma camada pinta com ${cor.toString(16)}`)
  return i
}

describe('PixiCanvas — paredes por cima da tinta', () => {
  it('a tinta do pincel/balde do Chão fica por baixo das paredes e das portas', async () => {
    const world = await monta()
    const tinta = indiceDaCamada(world, Number.parseInt(COR_DA_TINTA_DO_CHAO.slice(1), 16))
    expect(indiceDaCamada(world, WALL_COLOR)).toBeGreaterThan(tinta)
    expect(indiceDaCamada(world, DOOR_COLOR)).toBeGreaterThan(tinta)
  })

  it('a pintura do balde de tinta do Desenho fica por baixo das paredes e das portas', async () => {
    const world = await monta()
    const tinta = indiceDaCamada(world, Number.parseInt(COR_DA_TINTA_DO_DESENHO.slice(1), 16))
    expect(indiceDaCamada(world, WALL_COLOR)).toBeGreaterThan(tinta)
    expect(indiceDaCamada(world, DOOR_COLOR)).toBeGreaterThan(tinta)
  })
})
