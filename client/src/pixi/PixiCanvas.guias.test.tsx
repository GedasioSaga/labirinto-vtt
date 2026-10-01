import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { Camera } from './world'
import type { MapData, Region, Wall } from '../types/map'
import { SMART_GUIDE_COLOR } from './constants'
import { PixiCanvas } from './PixiCanvas'
import { snapToHexVertex } from './tokenInteraction'

/**
 * GUIAS INTELIGENTES NO ARRASTO DE SALA (pedido 3, fatia 1), com o PixiCanvas
 * montado pelo caminho de verdade — mesmo arranjo sem GPU de
 * `PixiCanvas.desempenho.test.tsx`. Os módulos têm teste próprio
 * (`lib/smartGuides.test.ts`, `lib/guideBoxes.test.ts`,
 * `drawSmartGuides.test.ts`); aqui a prova é a fiação: a sala encaixa pela
 * caixa, a guia magenta aparece e some, o Ctrl solta, a tolerância é de tela,
 * a grade manda sem Alt e o Alt devolve a guia.
 */

const tela = vi.hoisted(() => {
  const apps: { stage: Container }[] = []
  return { apps, largura: 1200, altura: 800 }
})

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
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

function sala(id: string, minX: number, minY: number, maxX: number, maxY: number): Region {
  return {
    id,
    points: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id },
  }
}

/** As 4 paredes vinculadas de uma sala retangular, como a ferramenta Sala cria. */
function paredesDa(regiao: Region): Wall[] {
  return regiao.points.map((p, i) => {
    const q = regiao.points[(i + 1) % regiao.points.length]
    return { id: `${regiao.id}-p${i}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: null, regionId: regiao.id, regionEdgeIndex: i }
  })
}

function mapa(regioes: Region[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('m_guias', 'Guias', 40, 20, GRADE), regions: regioes, walls }
}

/** Centro em x = 800. */
const ALVO = sala('alvo', 640, 100, 960, 300)
/** Centro em x = 200; pega-se longe do nome (que mora no meio). */
const MOVEL = sala('movel', 100, 500, 300, 700)
const PEGA_NO_MOVEL = { x: 120, y: 520 }

let raiz: HTMLDivElement
let root: Root
const exportador = vi.fn()

function prepara(map: MapData, gradeLigada = false): void {
  useMapStore.setState({
    map,
    selection: [],
    past: [],
    future: [],
    activeTool: 'select',
    snapTargets: { token: false, wall: gradeLigada, prop: false },
    camera: { x: 0, y: 0, scale: 1 },
  })
}

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
  prepara(mapa([ALVO, MOVEL]))
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
})

/** Monta e põe a câmera do teste: ao abrir, o canvas enquadra o conteúdo (`fitToContent`) e o zoom mudaria a tolerância. */
async function monta(camera: Camera = { x: 0, y: 0, scale: 1 }): Promise<void> {
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  act(() => {
    root.render(<PixiCanvas onImageExporterChange={exportador} cameraRequest={{ camera }} />)
  })
  expect(useMapStore.getState().camera).toEqual(camera)
}

function stage(): Container {
  const atual = tela.apps.at(-1)
  if (atual === undefined) throw new Error('o PixiCanvas não criou o Application')
  return atual.stage
}

function descendentes(no: Container): Container[] {
  return no.children.flatMap((filho) => [filho, ...descendentes(filho)])
}

interface Teclas {
  ctrl?: boolean
  alt?: boolean
}

function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', mundo: { x: number; y: number }, teclas: Teclas = {}): void {
  const camera = useMapStore.getState().camera
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.buttons = tipo === 'pointerup' ? 0 : 1
  e.ctrlKey = teclas.ctrl ?? false
  e.altKey = teclas.alt ?? false
  e.global.set(camera.x + mundo.x * camera.scale, camera.y + mundo.y * camera.scale)
  act(() => {
    stage().emit(tipo, e)
  })
}

/** O Graphics que tem traço magenta agora, ou `null` sem guia na tela. */
function guiaMagenta(): Graphics | null {
  for (const no of descendentes(stage())) {
    if (!(no instanceof Graphics)) continue
    if (no.context.instructions.some((i) => i.action === 'stroke' && i.data.style.color === SMART_GUIDE_COLOR)) return no
  }
  return null
}

function caixaDa(id: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const regiao = useMapStore.getState().map.regions.find((r) => r.id === id)
  if (!regiao) throw new Error(`sem a região ${id}`)
  const xs = regiao.points.map((p) => p.x)
  const ys = regiao.points.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

/** Arrasta pelo DELTA dado a partir de `PEGA_NO_MOVEL`. */
function arrasta(dx: number, dy: number, teclas: Teclas = {}): void {
  ponteiro('pointerdown', PEGA_NO_MOVEL, teclas)
  ponteiro('pointermove', { x: PEGA_NO_MOVEL.x + dx, y: PEGA_NO_MOVEL.y + dy }, teclas)
}

describe('PixiCanvas — guias inteligentes no arrasto de sala (pedido 3, fatia 1)', () => {
  it('o centro da sala a 3 px do centro da vizinha encaixa nele, e a guia magenta aparece', async () => {
    await monta()
    arrasta(603, 0)
    expect(caixaDa('movel')).toEqual({ minX: 700, maxX: 900, minY: 500, maxY: 700 })
    const guia = guiaMagenta()
    expect(guia).not.toBeNull()
    // Segmento vertical em x = 800, do centro de uma sala ao da outra.
    const caixa = guia?.getLocalBounds()
    expect(caixa?.minY).toBeLessThan(205)
    expect(caixa?.maxY).toBeGreaterThan(595)
    expect(Math.abs(((caixa?.minX ?? 0) + (caixa?.maxX ?? 0)) / 2 - 800)).toBeLessThan(1)
  })

  it('soltar grava a posição encaixada num Ctrl+Z só, e a guia some', async () => {
    await monta()
    arrasta(603, 0)
    ponteiro('pointerup', { x: PEGA_NO_MOVEL.x + 603, y: PEGA_NO_MOVEL.y })
    expect(caixaDa('movel').minX).toBe(700)
    expect(guiaMagenta()).toBeNull()
    act(() => useMapStore.getState().undo())
    expect(caixaDa('movel').minX).toBe(100)
  })

  it('Ctrl no meio do arrasto: a sala anda livre, sem encaixe nem guia', async () => {
    await monta()
    ponteiro('pointerdown', PEGA_NO_MOVEL)
    ponteiro('pointermove', { x: PEGA_NO_MOVEL.x + 603, y: PEGA_NO_MOVEL.y }, { ctrl: true })
    expect(caixaDa('movel').minX).toBe(703)
    expect(guiaMagenta()).toBeNull()
  })

  it('passando da tolerância a sala solta e acompanha o cursor (sem ficar para trás)', async () => {
    await monta()
    ponteiro('pointerdown', PEGA_NO_MOVEL)
    for (let passo = 0; passo <= 12; passo += 1) {
      ponteiro('pointermove', { x: PEGA_NO_MOVEL.x + 600 + passo, y: PEGA_NO_MOVEL.y })
      expect(caixaDa('movel').minX).toBe(passo <= 6 ? 700 : 700 + passo)
    }
  })

  it('a tolerância é de TELA: no zoom 0,5 (6 px de tela = 12 de mundo) 10 px de mundo encaixam', async () => {
    await monta({ x: 0, y: 0, scale: 0.5 })
    arrasta(610, 0)
    expect(caixaDa('movel').minX).toBe(700)
    expect(guiaMagenta()).not.toBeNull()
  })

  it('a tolerância é de TELA: no zoom 2 (6 px de tela = 3 de mundo) 5 px de mundo não encaixam, 2 px sim', async () => {
    await monta({ x: 0, y: 0, scale: 2 })
    arrasta(605, 0)
    expect(caixaDa('movel').minX).toBe(705)
    expect(guiaMagenta()).toBeNull()
    ponteiro('pointermove', { x: PEGA_NO_MOVEL.x + 602, y: PEGA_NO_MOVEL.y })
    expect(caixaDa('movel').minX).toBe(700)
  })

  describe('grade × guia', () => {
    // Vizinha fora da grade (centro em 803) e sala móvel na grade (centro em 224).
    const ALVO_FORA_DA_GRADE = sala('alvo', 643, 100, 963, 300)
    const MOVEL_NA_GRADE = sala('movel', 128, 512, 320, 704)
    const PEGA = { x: 150, y: 530 }

    it('grade ligada e sem Alt: a grade manda, a sala anda em células e não encaixa na guia', async () => {
      prepara(mapa([ALVO_FORA_DA_GRADE, MOVEL_NA_GRADE]), true)
      await monta()
      ponteiro('pointerdown', PEGA)
      ponteiro('pointermove', { x: 730, y: 530 })
      expect(caixaDa('movel').minX).toBe(704)
      expect(guiaMagenta()).toBeNull()
    })

    it('grade ligada e Alt segurado: o Alt solta a grade e a guia encaixa', async () => {
      prepara(mapa([ALVO_FORA_DA_GRADE, MOVEL_NA_GRADE]), true)
      await monta()
      ponteiro('pointerdown', PEGA)
      ponteiro('pointermove', { x: 733, y: 530 }, { alt: true })
      expect(caixaDa('movel').minX).toBe(707)
      expect(guiaMagenta()).not.toBeNull()
    })

    it('grade hex ligada: o delta é de vértice a vértice da grade (a grade vale nos dois ponteiros, nunca no delta)', async () => {
      prepara({ ...mapa([ALVO, MOVEL]), gridShape: 'hex' }, true)
      await monta()
      const destino = { x: PEGA_NO_MOVEL.x + 603, y: PEGA_NO_MOVEL.y + 37 }
      ponteiro('pointerdown', PEGA_NO_MOVEL)
      ponteiro('pointermove', destino)
      const de = snapToHexVertex(PEGA_NO_MOVEL.x, PEGA_NO_MOVEL.y, GRADE)
      const ate = snapToHexVertex(destino.x, destino.y, GRADE)
      expect(caixaDa('movel').minX).toBeCloseTo(100 + ate.x - de.x)
      expect(caixaDa('movel').minY).toBeCloseTo(500 + ate.y - de.y)
    })

    it('grade desligada e Alt+arrastar (duplica): a cópia anda na grade do Alt e a guia encaixa por cima; a original fica', async () => {
      prepara(mapa([ALVO_FORA_DA_GRADE, MOVEL_NA_GRADE]))
      await monta()
      ponteiro('pointerdown', PEGA, { alt: true })
      ponteiro('pointermove', { x: 730, y: 530 }, { alt: true })
      const regioes = useMapStore.getState().map.regions
      expect(regioes).toHaveLength(3)
      const copia = regioes.find((r) => r.id !== 'alvo' && r.id !== 'movel')
      if (!copia) throw new Error('o Alt+arrastar não criou a cópia')
      expect(caixaDa(copia.id)).toEqual({ minX: 707, maxX: 899, minY: 512, maxY: 704 })
      expect(caixaDa('movel').minX).toBe(128)
      // A original não anda e não está selecionada: é vizinha da cópia, e a
      // guia horizontal vai da original (centro x = 224) até a cópia.
      expect(guiaMagenta()?.getLocalBounds().minX).toBeLessThan(230)
    })
  })

  it('arrastar a sala por uma parede dela também encaixa pela caixa da sala', async () => {
    prepara(mapa([ALVO, MOVEL], [...paredesDa(ALVO), ...paredesDa(MOVEL)]))
    await monta()
    // Na parede esquerda da sala móvel (x = 100), longe dos cantos.
    ponteiro('pointerdown', { x: 100, y: 600 })
    ponteiro('pointermove', { x: 703, y: 600 })
    expect(caixaDa('movel')).toEqual({ minX: 700, maxX: 900, minY: 500, maxY: 700 })
    expect(guiaMagenta()).not.toBeNull()
    const parede = useMapStore.getState().map.walls.find((w) => w.id === 'movel-p3')
    expect(parede).toMatchObject({ x1: 700, x2: 700 })
  })
})
