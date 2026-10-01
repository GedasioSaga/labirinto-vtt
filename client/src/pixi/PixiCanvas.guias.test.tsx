import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { Camera } from './world'
import type { Drawing, FloorPiece, MapData, Prop, Region, Stair, Token, Wall } from '../types/map'
import { SMART_GUIDE_COLOR, SMART_GUIDE_LABEL_COLOR } from './constants'
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

  describe('a sala encaixa na peça como ela aparece', () => {
    // As duas peças aparecem de x = 750 a 850. Arrastar 652 leva a borda
    // esquerda da sala a 752: 2 px da borda que se vê, e 52 px de qualquer
    // âncora da caixa antiga (700/800/900 da mesa sem giro, 800 da linha do
    // meio da escada).
    const MESA_EM_PE: Prop = { id: 'mesa', src: '', x: 800, y: 200, width: 200, height: 100, linkedMapPath: null, mobilia: 'mesa', rotation: 90 }
    const ESCADA_EM_PE: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 800, y1: 100, x2: 800, y2: 300 }], stepWidth: 100 }

    it('móvel girado 90 graus: a sala encaixa na borda do desenho girado, não na do retângulo sem giro', async () => {
      prepara({ ...mapa([MOVEL]), props: [MESA_EM_PE] })
      await monta()
      arrasta(652, 0)
      expect(caixaDa('movel').minX).toBe(750)
      expect(guiaMagenta()).not.toBeNull()
    })

    it('escada: a sala encaixa na borda do lance, com a largura do degrau, não na linha do meio', async () => {
      prepara({ ...mapa([MOVEL]), stairs: [ESCADA_EM_PE] })
      await monta()
      arrasta(652, 0)
      expect(caixaDa('movel').minX).toBe(750)
      expect(guiaMagenta()).not.toBeNull()
    })
  })
})

/**
 * FATIA 2: todo arrasto de corpo (parede solta, linha, escada, objeto, chão,
 * seleção de vários) encaixa pela caixa do que anda, e todo arrasto de ponto
 * (ponta de parede e de linha, vértice de sala, centro da ficha) encaixa na
 * borda e no centro das caixas vizinhas — sempre com a guia magenta fina e a
 * tolerância em px de tela. Peça em y = 500..700, longe das alturas de ALVO
 * (100, 200, 300): só o eixo x encaixa.
 */
describe('PixiCanvas — guias em todo arrasto de corpo e de ponto (pedido 3, fatia 2)', () => {
  function paredeSolta(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
    return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
  }
  function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
    return { id, kind: 'line', x1, y1, x2, y2, color: '#ffffff', width: 2 }
  }
  function ficha(id: string, x: number, y: number): Token {
    return { id, characterId: null, name: id, x, y, size: 1, image: null }
  }
  const mapaCom = (extra: Partial<MapData>): MapData => ({ ...mapa([ALVO]), ...extra })
  const atual = (): MapData => useMapStore.getState().map
  function seleciona(kind: 'wall' | 'drawing' | 'region', ...ids: string[]): void {
    act(() => useMapStore.setState({ selection: ids.map((id) => ({ kind, id })) }))
  }
  function solta(mundo: { x: number; y: number }): void {
    ponteiro('pointerup', mundo)
  }

  describe('corpo', () => {
    it('parede solta: a caixa dela encaixa no centro da sala, a própria parede não prende o arrasto e soltar grava num Ctrl+Z', async () => {
      prepara(mapaCom({ walls: [paredeSolta('solta', 100, 500, 300, 500)] }))
      await monta()
      ponteiro('pointerdown', { x: 150, y: 500 })
      // 3 px: a parede acompanha (a caixa de partida dela não é candidata).
      ponteiro('pointermove', { x: 153, y: 500 })
      expect(atual().walls[0]).toMatchObject({ x1: 103, x2: 303 })
      // Centro em 803, a 3 px do centro da sala (800).
      ponteiro('pointermove', { x: 753, y: 500 })
      expect(atual().walls[0]).toMatchObject({ x1: 700, y1: 500, x2: 900, y2: 500 })
      expect(guiaMagenta()).not.toBeNull()
      solta({ x: 753, y: 500 })
      expect(guiaMagenta()).toBeNull()
      expect(atual().walls[0]).toMatchObject({ x1: 700, x2: 900 })
      act(() => useMapStore.getState().undo())
      expect(atual().walls[0]).toMatchObject({ x1: 100, x2: 300 })
    })

    it('linha (o corredor da imagem): encaixa pela caixa, e com Ctrl anda livre e sem guia', async () => {
      prepara(mapaCom({ drawings: [linha('corredor', 100, 500, 300, 500)] }))
      await monta()
      ponteiro('pointerdown', { x: 150, y: 500 })
      ponteiro('pointermove', { x: 753, y: 500 })
      expect(atual().drawings[0]).toMatchObject({ x1: 700, x2: 900 })
      expect(guiaMagenta()).not.toBeNull()
      ponteiro('pointermove', { x: 753, y: 500 }, { ctrl: true })
      expect(atual().drawings[0]).toMatchObject({ x1: 703, x2: 903 })
      expect(guiaMagenta()).toBeNull()
    })

    it('escada: encaixa pela placa desenhada', async () => {
      const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 100, y1: 500, x2: 300, y2: 500 }], stepWidth: 64 }
      prepara(mapaCom({ stairs: [escada] }))
      await monta()
      ponteiro('pointerdown', { x: 150, y: 500 })
      ponteiro('pointermove', { x: 753, y: 500 })
      expect(atual().stairs[0].segments[0]).toMatchObject({ x1: 700, x2: 900 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('objeto girado: encaixa pela borda do desenho e não pula o centro para o cursor', async () => {
      // Mesa 200 x 100 em pé: o desenho vai de x = 150 a 250 (o retângulo sem giro iria de 100 a 300).
      const mesa: Prop = { id: 'mesa', src: '', x: 200, y: 600, width: 200, height: 100, linkedMapPath: null, mobilia: 'mesa', rotation: 90 }
      prepara(mapaCom({ props: [mesa] }))
      await monta()
      ponteiro('pointerdown', { x: 230, y: 640 })
      // Borda esquerda do desenho em 643, a 3 px da borda esquerda da sala (640).
      ponteiro('pointermove', { x: 723, y: 640 })
      expect(atual().props[0]).toMatchObject({ x: 690, y: 600 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('peça de chão: encaixa pela caixa dela', async () => {
      const chao: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 200, cy: 600, w: 200, h: 100 }, op: 'add', modifiers: {} }
      prepara(mapaCom({ floor: [chao] }))
      await monta()
      ponteiro('pointerdown', { x: 150, y: 600 })
      ponteiro('pointermove', { x: 753, y: 600 })
      expect(atual().floor[0].shape).toMatchObject({ cx: 800, cy: 600 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('chão de blocos: arrastado devagar anda uma célula quando o gesto passa de meia célula, e não mostra guia', async () => {
      // Duas células de 64 (colunas 2 e 3, linha 8): de x = 128 a 256.
      const blocos: FloorPiece = { id: 'blocos', shape: { kind: 'blocos', cell: GRADE, cells: [{ col: 2, row: 8 }, { col: 3, row: 8 }] }, op: 'add', modifiers: {} }
      prepara(mapaCom({ floor: [blocos] }))
      await monta()
      const colunas = () => {
        const shape = atual().floor[0].shape
        return shape.kind === 'blocos' ? shape.cells.map((c) => c.col) : []
      }
      ponteiro('pointerdown', { x: 150, y: 540 })
      // De 10 em 10 px: o passo somado arredondava cada um para zero célula, e a peça nunca saía do lugar.
      for (const x of [160, 170, 180]) ponteiro('pointermove', { x, y: 540 })
      expect(colunas()).toEqual([2, 3])
      ponteiro('pointermove', { x: 190, y: 540 })
      expect(colunas()).toEqual([3, 4])
      ponteiro('pointermove', { x: 200, y: 540 })
      expect(colunas()).toEqual([3, 4])
      expect(guiaMagenta()).toBeNull()
    })

    it('Alt+arrastar uma parede solta com a grade desligada: a cópia anda na grade do Alt, a guia encaixa por cima e a original fica', async () => {
      // Centro em 226: depois de 9 células (576), o centro da cópia fica a 2 px do centro da sala.
      prepara(mapaCom({ walls: [paredeSolta('solta', 126, 500, 326, 500)] }))
      await monta()
      ponteiro('pointerdown', { x: 150, y: 500 }, { alt: true })
      ponteiro('pointermove', { x: 705, y: 500 }, { alt: true })
      const paredes = atual().walls
      expect(paredes).toHaveLength(2)
      const copia = paredes.find((w) => w.id !== 'solta')
      expect(copia).toMatchObject({ x1: 700, y1: 500, x2: 900, y2: 500 })
      expect(paredes.find((w) => w.id === 'solta')).toMatchObject({ x1: 126, x2: 326 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('dois itens selecionados (as duas linhas de um corredor): a caixa da união encaixa, e as próprias linhas não prendem o arrasto', async () => {
      prepara(mapaCom({ drawings: [linha('a', 100, 500, 100, 700), linha('b', 140, 500, 140, 700)] }))
      await monta()
      seleciona('drawing', 'a', 'b')
      ponteiro('pointerdown', { x: 120, y: 600 })
      ponteiro('pointermove', { x: 123, y: 600 })
      expect(atual().drawings.map((d) => (d.kind === 'line' ? d.x1 : null))).toEqual([103, 143])
      // Centro da união em 803: encaixa no centro da sala.
      ponteiro('pointermove', { x: 803, y: 600 })
      expect(atual().drawings.map((d) => (d.kind === 'line' ? d.x1 : null))).toEqual([780, 820])
      expect(guiaMagenta()).not.toBeNull()
      solta({ x: 803, y: 600 })
      act(() => useMapStore.getState().undo())
      expect(atual().drawings.map((d) => (d.kind === 'line' ? d.x1 : null))).toEqual([100, 140])
    })

    it('seleção com objeto girado: encaixa pela borda que se vê, e a borda do retângulo sem giro (1,5 célula fora) não prende', async () => {
      // Mesa de 4 x 1 células em pé: o desenho vai de x = 168 a 232; sem o giro, iria de 72 a 328.
      const mesa: Prop = { id: 'mesa', src: '', x: 200, y: 600, width: 256, height: 64, linkedMapPath: null, mobilia: 'mesa', rotation: 90 }
      prepara(mapaCom({ props: [mesa], drawings: [linha('linha', 220, 500, 220, 700)] }))
      await monta()
      act(() => useMapStore.setState({ selection: [{ kind: 'prop', id: 'mesa' }, { kind: 'drawing', id: 'linha' }] }))
      ponteiro('pointerdown', { x: 200, y: 600 })
      // Borda direita do desenho em 643, a 3 px da borda esquerda da sala (640).
      ponteiro('pointermove', { x: 611, y: 600 })
      expect(atual().props[0]).toMatchObject({ x: 608, y: 600 })
      const caixa = guiaMagenta()?.getLocalBounds()
      expect(Math.abs(((caixa?.minX ?? 0) + (caixa?.maxX ?? 0)) / 2 - 640)).toBeLessThan(1)
      // A borda esquerda do retângulo SEM giro iria a 963, a 3 px da borda direita
      // da sala (960). Ali não se vê nada: nada encaixa e não há guia.
      ponteiro('pointermove', { x: 1091, y: 600 })
      expect(atual().props[0]).toMatchObject({ x: 1091, y: 600 })
      expect(guiaMagenta()).toBeNull()
    })

    it('seleção com sala travada e objeto solto: só o objeto anda, e a caixa que encaixa é só a dele', async () => {
      const travada: Region = { ...sala('travada', 100, 400, 300, 500), locked: true }
      // Caixa de 128 a 256 em x.
      const caixote: Prop = { id: 'caixote', src: '', x: 192, y: 640, width: 128, height: 128, linkedMapPath: null, mobilia: 'caixa' }
      prepara({ ...mapa([ALVO, travada]), props: [caixote] })
      await monta()
      act(() => useMapStore.setState({ selection: [{ kind: 'region', id: 'travada' }, { kind: 'prop', id: 'caixote' }] }))
      ponteiro('pointerdown', { x: 192, y: 640 })
      // Borda esquerda do caixote em 643, a 3 px da borda esquerda da sala (640).
      ponteiro('pointermove', { x: 707, y: 640 })
      expect(atual().props[0]).toMatchObject({ x: 704, y: 640 })
      expect(guiaMagenta()).not.toBeNull()
      // Somada à sala travada, a caixa iria até 300 + 663 = 963, a 3 px de 960;
      // mas a sala não anda, e o caixote (de 791 a 919) não encaixa em nada.
      ponteiro('pointermove', { x: 855, y: 640 })
      expect(atual().props[0]).toMatchObject({ x: 855, y: 640 })
      expect(guiaMagenta()).toBeNull()
      expect(caixaDa('travada')).toEqual({ minX: 100, maxX: 300, minY: 400, maxY: 500 })
    })

    it('seleção só de fichas (que não são guia de ninguém): anda pelo gesto, sem encaixe e sem guia', async () => {
      prepara(mapaCom({ tokens: [ficha('a', 200, 600), ficha('b', 300, 600)] }))
      await monta()
      act(() => useMapStore.setState({ selection: [{ kind: 'token', id: 'a' }, { kind: 'token', id: 'b' }] }))
      ponteiro('pointerdown', { x: 250, y: 600 })
      // O meio da fileira (250) vai a 803, a 3 px do centro da sala: ficha não encaixa em sala.
      ponteiro('pointermove', { x: 803, y: 600 })
      expect(atual().tokens.map((t) => t.x)).toEqual([753, 853])
      expect(guiaMagenta()).toBeNull()
    })

    describe('grade do objeto × guia', () => {
      // Caixa 128 x 128 com o centro num vértice da grade (192, 576): caixa de 128 a 256.
      // Móvel (desenhado em silhueta): objeto com imagem pediria o Tauri para carregá-la.
      const caixote: Prop = { id: 'caixote', src: '', x: 192, y: 576, width: 128, height: 128, linkedMapPath: null, mobilia: 'caixa' }
      // A borda esquerda da sala fica a 1 px de um vértice da grade (768).
      const ALVO_A_1_PX = sala('alvo', 769, 100, 1089, 300)

      it('grade de objeto ligada e sem Alt: anda em células e não encaixa na guia de 1 px', async () => {
        prepara({ ...mapa([ALVO_A_1_PX]), props: [caixote] })
        act(() => useMapStore.setState({ snapTargets: { token: false, wall: false, prop: true } }))
        await monta()
        ponteiro('pointerdown', { x: 150, y: 530 })
        ponteiro('pointermove', { x: 794, y: 530 })
        expect(atual().props[0]).toMatchObject({ x: 832, y: 576 })
        expect(guiaMagenta()).toBeNull()
      })

      it('grade de objeto ligada e Alt no gesto: o Alt solta a grade e a guia encaixa', async () => {
        prepara({ ...mapa([ALVO_A_1_PX]), props: [caixote] })
        act(() => useMapStore.setState({ snapTargets: { token: false, wall: false, prop: true } }))
        await monta()
        ponteiro('pointerdown', { x: 150, y: 530 })
        ponteiro('pointermove', { x: 794, y: 530 }, { alt: true })
        expect(atual().props[0]).toMatchObject({ x: 833, y: 576 })
        expect(guiaMagenta()).not.toBeNull()
      })

      // Grade de 50 e o cenário do achado: objeto 40 x 40 com o centro FORA da
      // grade, em (37, 52), pego em (40, 55).
      const torto: Prop = { id: 'torto', src: '', x: 37, y: 52, width: 40, height: 40, linkedMapPath: null, mobilia: 'caixa' }

      it('objeto fora da grade, grade de objeto ligada: o centro cai no vértice (a grade vale para o centro, não para o ponteiro)', async () => {
        prepara({ ...mapa([ALVO_A_1_PX]), grid: 50, props: [torto] })
        act(() => useMapStore.setState({ snapTargets: { token: false, wall: false, prop: true } }))
        await monta()
        ponteiro('pointerdown', { x: 40, y: 55 })
        // Com o delta entre os dois ponteiros na grade, o centro ia para (87, 52) e ficava fora dela para sempre.
        ponteiro('pointermove', { x: 90, y: 55 })
        expect(atual().props[0]).toMatchObject({ x: 100, y: 50 })
        ponteiro('pointerup', { x: 90, y: 55 })
        expect(atual().props[0]).toMatchObject({ x: 100, y: 50 })
        act(() => useMapStore.getState().undo())
        expect(atual().props[0]).toMatchObject({ x: 37, y: 52 })
      })

      it('grade de objeto desligada e Alt+arrastar (duplica): o centro da cópia cai na grade do Alt, a guia encaixa por cima e a original fica', async () => {
        prepara({ ...mapa([ALVO_A_1_PX]), grid: 50, props: [torto] })
        await monta()
        ponteiro('pointerdown', { x: 40, y: 55 }, { alt: true })
        ponteiro('pointermove', { x: 240, y: 55 }, { alt: true })
        const objetos = atual().props
        expect(objetos).toHaveLength(2)
        // O centro iria a (237, 52); a grade o põe em (250, 50), e a guia o leva 2 px
        // para baixo, até alinhar com a original, que ficou em y = 52.
        expect(objetos.find((p) => p.id !== 'torto')).toMatchObject({ x: 250, y: 52 })
        expect(objetos.find((p) => p.id === 'torto')).toMatchObject({ x: 37, y: 52 })
        expect(guiaMagenta()).not.toBeNull()
      })
    })
  })

  describe('ponto', () => {
    it('ponta de parede solta: encaixa no centro da sala (âncora da caixa), com a guia', async () => {
      prepara(mapaCom({ walls: [paredeSolta('solta', 100, 500, 300, 500)] }))
      await monta()
      seleciona('wall', 'solta')
      ponteiro('pointerdown', { x: 300, y: 500 })
      ponteiro('pointermove', { x: 803, y: 450 })
      expect(atual().walls[0]).toMatchObject({ x1: 100, y1: 500, x2: 800, y2: 450 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('ponta de linha: encaixa no centro da sala, e com Ctrl fica onde o cursor está', async () => {
      prepara(mapaCom({ drawings: [linha('corredor', 100, 500, 300, 500)] }))
      await monta()
      seleciona('drawing', 'corredor')
      ponteiro('pointerdown', { x: 300, y: 500 })
      ponteiro('pointermove', { x: 803, y: 450 })
      expect(atual().drawings[0]).toMatchObject({ x2: 800, y2: 450 })
      expect(guiaMagenta()).not.toBeNull()
      ponteiro('pointermove', { x: 803, y: 450 }, { ctrl: true })
      expect(atual().drawings[0]).toMatchObject({ x2: 803, y2: 450 })
      expect(guiaMagenta()).toBeNull()
    })

    it('vértice de região: encaixa no centro da outra sala', async () => {
      const triangulo: Region = { id: 'tri', points: [{ x: 100, y: 500 }, { x: 200, y: 500 }, { x: 150, y: 600 }], tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
      prepara(mapa([ALVO, triangulo]))
      await monta()
      seleciona('region', 'tri')
      ponteiro('pointerdown', { x: 200, y: 500 })
      ponteiro('pointermove', { x: 803, y: 450 })
      expect(atual().regions.find((r) => r.id === 'tri')?.points[1]).toEqual({ x: 800, y: 450 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('ficha: o centro alinha com o de outra ficha, na tolerância de TELA, e a guia é a magenta', async () => {
      prepara(mapaCom({ tokens: [ficha('parada', 800, 200), ficha('andando', 200, 600)] }))
      // Zoom 0,5: 6 px de tela são 12 de mundo, e 10 de mundo encaixam.
      await monta({ x: 0, y: 0, scale: 0.5 })
      ponteiro('pointerdown', { x: 200, y: 600 })
      ponteiro('pointermove', { x: 810, y: 600 })
      expect(atual().tokens.find((t) => t.id === 'andando')).toMatchObject({ x: 800, y: 600 })
      expect(guiaMagenta()).not.toBeNull()
    })

    it('ficha no zoom 2: 6 px de tela são 3 de mundo, e 5 de mundo não encaixam', async () => {
      prepara(mapaCom({ tokens: [ficha('parada', 800, 200), ficha('andando', 200, 600)] }))
      await monta({ x: 0, y: 0, scale: 2 })
      ponteiro('pointerdown', { x: 200, y: 600 })
      ponteiro('pointermove', { x: 805, y: 600 })
      expect(atual().tokens.find((t) => t.id === 'andando')).toMatchObject({ x: 805, y: 600 })
      expect(guiaMagenta()).toBeNull()
    })
  })
})

/**
 * FATIA 3: espaçamento igual e o número de cada vão. A peça encaixa onde os
 * vãos da fileira ficam iguais, e a pílula magenta escreve o vão na unidade
 * do mapa (grade de 64 e 1,5 m por célula: 128 px = "3,0 m"). O número só
 * existe com encaixe ativo e some ao soltar.
 */
describe('PixiCanvas — espaçamento igual e o número dos vãos (pedido 3, fatia 3)', () => {
  /** Fileira em y = 500..628: A e B com 128 px de vão; M à direita, 216 px depois de B. */
  const A = sala('a', 100, 500, 228, 628)
  const B = sala('b', 356, 500, 484, 628)
  const M = sala('m', 700, 500, 828, 628)
  /** Perto do canto de M, longe do nome (que mora no meio). */
  const PEGA_EM_M = { x: 710, y: 510 }

  function visivel(no: Container): boolean {
    let atual: Container | null = no
    while (atual !== null) {
      if (!atual.visible) return false
      atual = atual.parent
    }
    return true
  }

  /** Os números dos vãos na tela agora: o texto de cada pílula magenta visível. */
  function numerosNaTela(): string[] {
    const numeros: string[] = []
    for (const no of descendentes(stage())) {
      if (!(no instanceof Graphics) || !no.context.instructions.some((i) => i.action === 'fill' && i.data.style.color === SMART_GUIDE_LABEL_COLOR)) continue
      const rotulo = no.parent
      if (rotulo === null || !visivel(rotulo)) continue
      const texto = rotulo.children.find((c): c is Text => c instanceof Text)
      if (texto !== undefined) numeros.push(texto.text)
    }
    return numeros
  }

  function quantosTextos(): number {
    return descendentes(stage()).filter((no) => no instanceof Text).length
  }

  it('a sala que chega a 3 px do vão da fileira encaixa nele, os dois vãos iguais ganham número, e ao soltar o número some', async () => {
    prepara(mapa([A, B, M]))
    await monta()
    const textosAntes = quantosTextos()
    ponteiro('pointerdown', PEGA_EM_M)
    // -85: a borda esquerda de M vai a 615, a 3 px de 612 (= 484 + 128).
    ponteiro('pointermove', { x: PEGA_EM_M.x - 85, y: PEGA_EM_M.y })
    expect(caixaDa('m').minX).toBe(612)
    expect(numerosNaTela()).toEqual(['3,0 m', '3,0 m'])
    // O pool de números é fixo: o arrasto não cria Text nenhum.
    expect(quantosTextos()).toBe(textosAntes)
    ponteiro('pointerup', { x: PEGA_EM_M.x - 85, y: PEGA_EM_M.y })
    expect(caixaDa('m').minX).toBe(612)
    expect(numerosNaTela()).toEqual([])
    expect(guiaMagenta()).toBeNull()
  })

  it('passando da tolerância a sala solta do espaçamento e acompanha o cursor; sobra só a distância até a vizinha alinhada', async () => {
    prepara(mapa([A, B, M]))
    await monta()
    ponteiro('pointerdown', PEGA_EM_M)
    ponteiro('pointermove', { x: PEGA_EM_M.x - 85, y: PEGA_EM_M.y })
    expect(numerosNaTela()).toEqual(['3,0 m', '3,0 m'])
    // -95: a borda vai a 605, a 7 px do vão igual. M continua na altura de A e
    // B (alinhada em y), e a medida até a alinhada mais perto continua: 121 px
    // até B = 1,89 célula = 2,8 m.
    ponteiro('pointermove', { x: PEGA_EM_M.x - 95, y: PEGA_EM_M.y })
    expect(caixaDa('m').minX).toBe(605)
    expect(numerosNaTela()).toEqual(['2,8 m'])
  })

  it('a sala que encaixa pela borda com a de cima mostra a distância vertical entre as duas', async () => {
    await monta()
    // +543: a borda esquerda de MOVEL vai a 643, a 3 px da borda esquerda de ALVO (640).
    arrasta(543, 0)
    expect(caixaDa('movel').minX).toBe(640)
    // ALVO acaba em y = 300, MOVEL começa em 500: 200 px = 3,125 células = 4,7 m.
    expect(numerosNaTela()).toEqual(['4,7 m'])
  })

  it('com Ctrl a sala anda livre: nem encaixe nem número', async () => {
    prepara(mapa([A, B, M]))
    await monta()
    ponteiro('pointerdown', PEGA_EM_M)
    ponteiro('pointermove', { x: PEGA_EM_M.x - 85, y: PEGA_EM_M.y }, { ctrl: true })
    expect(caixaDa('m').minX).toBe(615)
    expect(numerosNaTela()).toEqual([])
  })

  it('arrasto de PONTO (a ponta de uma parede) tem a guia, mas não mede vão', async () => {
    const solta: Wall = { id: 'solta', x1: 100, y1: 500, x2: 300, y2: 500, blocksLight: true, blocksMove: true, door: null }
    prepara(mapa([ALVO], [solta]))
    await monta()
    act(() => useMapStore.setState({ selection: [{ kind: 'wall', id: 'solta' }] }))
    ponteiro('pointerdown', { x: 300, y: 500 })
    ponteiro('pointermove', { x: 803, y: 450 })
    expect(useMapStore.getState().map.walls[0]).toMatchObject({ x2: 800, y2: 450 })
    expect(guiaMagenta()).not.toBeNull()
    expect(numerosNaTela()).toEqual([])
  })

  it('grade ligada e sem Alt: a grade manda, mas o número aparece quando os vãos JÁ são iguais', async () => {
    // Fileira na grade de 64: A' e B' com 128 de vão; M' a 192 de B'.
    const A2 = sala('a', 128, 512, 256, 640)
    const B2 = sala('b', 384, 512, 512, 640)
    const M2 = sala('m', 704, 512, 832, 640)
    prepara(mapa([A2, B2, M2]), true)
    await monta()
    ponteiro('pointerdown', { x: 714, y: 522 })
    // -64: uma célula para a esquerda, e o vão B'→M' fica 128, igual ao de A'→B'.
    ponteiro('pointermove', { x: 650, y: 522 })
    expect(caixaDa('m').minX).toBe(640)
    expect(numerosNaTela()).toEqual(['3,0 m', '3,0 m'])
  })

  it('parede cortada pelas portas: o pedaço arrastado com a mão 2 px fora da reta volta a ela, encaixa no vão igual e os dois vãos ganham número', async () => {
    // Três pedaços de parede solta em y = 500: W1 e W2 com 128 px de vão; M 216 px depois de W2.
    const pedaco = (id: string, x1: number, x2: number): Wall => ({ id, x1, y1: 500, x2, y2: 500, blocksLight: true, blocksMove: true, door: null })
    prepara(mapa([], [pedaco('w1', 100, 228), pedaco('w2', 356, 484), pedaco('m', 700, 828)]))
    await monta()
    ponteiro('pointerdown', { x: 750, y: 500 })
    // -85 em x e +2 em y: a ponta esquerda iria a 615, a 3 px de 612 (= 484 + 128), e fora da reta.
    ponteiro('pointermove', { x: 665, y: 502 })
    expect(useMapStore.getState().map.walls.find((w) => w.id === 'm')).toMatchObject({ x1: 612, y1: 500, x2: 740, y2: 500 })
    expect(numerosNaTela()).toEqual(['3,0 m', '3,0 m'])
  })
})
