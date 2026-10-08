import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { DOOR_COLOR } from '../pixi/drawDoors'
import { WALL_COLOR } from '../pixi/drawWalls'
import type { Drawing, FloorPiece, MapData, Region, RegionPoint, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PAREDES POR CIMA DA TINTA, na tela do JOGADOR (pedido de 03/10/2026). Mesma
 * prova de `pixi/PixiCanvas.paredesPorCima.test.tsx`, do lado de cá: no
 * `world` da PlayerView de verdade (só o `Application` trocado, o jsdom não
 * tem WebGL), quem pinta a tinta do chão e a pintura do balde do Desenho vem
 * ANTES de paredes e portas.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], quadros: new Array<() => void>() }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = {
      add: (quadro: () => void) => {
        tela.quadros.push(quadro)
      },
      remove: (quadro: () => void) => {
        const i = tela.quadros.indexOf(quadro)
        if (i >= 0) tela.quadros.splice(i, 1)
      },
    }
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.palcos.push(this.stage)
    }
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  return { ...pixi, Application: ApplicationSemGpu }
})

const GRADE = 64
const COR_DA_TINTA_DO_CHAO = '#2f6690'
const COR_DA_TINTA_DO_DESENHO = '#d94f3a'
/** O jogador enxerga o mapa inteiro: nada fica sob a névoa. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 768, y: 0 },
    { x: 768, y: 640 },
    { x: 0, y: 640 },
  ],
]

const CANTOS = [
  { x: 128, y: 128 },
  { x: 512, y: 128 },
  { x: 512, y: 448 },
  { x: 128, y: 448 },
]

function paredes(): Wall[] {
  return CANTOS.map((p, i) => {
    const q = CANTOS[(i + 1) % CANTOS.length]
    const porta = i === 0 ? { state: 'closed' as const, locked: false } : null
    return { id: `p${i}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: porta } as Wall
  })
}

const TINTA_DO_CHAO: FloorPiece = {
  id: 'tinta',
  shape: { kind: 'blocos', cell: GRADE, cells: [{ col: 2, row: 2 }, { col: 7, row: 6 }] },
  op: 'add',
  fillColor: COR_DA_TINTA_DO_CHAO,
  modifiers: {},
}

const TINTA_DO_DESENHO: Drawing = {
  id: 'balde',
  kind: 'polygon',
  points: CANTOS.map((p) => ({ x: p.x + (p.x < 300 ? -4 : 4), y: p.y + (p.y < 300 ? -4 : 4) })),
  color: COR_DA_TINTA_DO_DESENHO,
  width: 0,
  filled: true,
  fillAlpha: 1,
}

const COR_DA_SALA = '#a8776a'
const COR_DO_CAMINHO = '#3c8d2f'
const ROTULO = 'Cozinha'

/** A sala atrás das paredes: o fundo dela vai por baixo da pintura, a borda por cima. */
const SALA: Region = { id: 'sala', points: CANTOS, tag: '', fillColor: COR_DA_SALA, fillPattern: 'solid', data: {} }

/** Caminho (ferramenta junto do Chão, fora do botão Desenho) atravessando a borda da sala. */
const CAMINHO: Drawing = {
  id: 'caminho',
  kind: 'path',
  points: [
    { x: 320, y: 64 },
    { x: 320, y: 256 },
  ],
  color: COR_DO_CAMINHO,
  width: GRADE / 2,
}

/** Texto (botão T) em cima da parede de cima da sala. */
const TEXTO: Drawing = { id: 'texto', kind: 'text', x: 280, y: 120, text: ROTULO, color: '#ffffff', fontSize: 16 }

function pacote(drawings: Drawing[] = [TINTA_DO_DESENHO]): MapData {
  return { ...createEmptyMap('m-paredes', '', 12, 10, GRADE), regions: [SALA], walls: paredes(), floor: [TINTA_DO_CHAO], drawings }
}

type Instrucao = Graphics['context']['instructions'][number]

function corDe(i: Instrucao): number | undefined {
  if (i.action !== 'fill' && i.action !== 'stroke') return undefined
  return i.data.style.color
}

function indiceDaCamada(world: Container, cor: number): number {
  const i = world.children.findIndex((filho) => filho instanceof Graphics && filho.context.instructions.some((ins) => corDe(ins) === cor))
  if (i < 0) throw new Error(`nenhuma camada pinta com ${cor.toString(16)}`)
  return i
}

/** `no` ou algum descendente dele satisfaz `teste`. */
function contem(no: Container, teste: (filho: Container) => boolean): boolean {
  return teste(no) || no.children.some((filho) => contem(filho, teste))
}

/** Índice no `world` da camada que guarda o Graphics da sala `id` com uma instrução `acao` (fundo ou borda). */
function indiceDaSala(world: Container, id: string, acao: 'fill' | 'stroke'): number {
  const i = world.children.findIndex((filho) =>
    contem(filho, (no) => no instanceof Graphics && no.label === id && no.context.instructions.some((ins) => ins.action === acao)),
  )
  if (i < 0) throw new Error(`nenhuma camada pinta ${acao} da sala ${id}`)
  return i
}

/** Índice no `world` da camada que guarda o rótulo de texto `texto`. */
function indiceDoTexto(world: Container, texto: string): number {
  const i = world.children.findIndex((filho) => contem(filho, (no) => no instanceof Text && no.text === texto))
  if (i < 0) throw new Error(`nenhuma camada mostra o texto ${texto}`)
  return i
}

describe('PlayerView — paredes por cima da tinta', () => {
  let raiz: HTMLDivElement
  let root: Root

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
    tela.palcos.length = 0
    tela.quadros.length = 0
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    vi.unstubAllGlobals()
  })

  async function monta(drawings?: Drawing[]): Promise<Container> {
    await act(async () => {
      root.render(
        <PlayerView map={pacote(drawings)} vision={VISAO} ownTokens={[]} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
    await vi.waitFor(() => expect((raiz.firstElementChild as HTMLElement | null)?.dataset.propsCount).toBeDefined())
    const world = tela.palcos.at(-1)?.children[0]
    if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
    return world
  }

  it('a tinta do chão e a pintura do balde ficam por baixo das paredes e das portas', async () => {
    const world = await monta()
    const paredesEm = indiceDaCamada(world, WALL_COLOR)
    const portasEm = indiceDaCamada(world, DOOR_COLOR)
    for (const cor of [COR_DA_TINTA_DO_CHAO, COR_DA_TINTA_DO_DESENHO]) {
      const tinta = indiceDaCamada(world, Number.parseInt(cor.slice(1), 16))
      expect(paredesEm).toBeGreaterThan(tinta)
      expect(portasEm).toBeGreaterThan(tinta)
    }
  })

  /**
   * PINCEL POR BAIXO DA BORDA DA SALA (pedido de 08/10/2026), mesma ordem do
   * editor: fundo da sala < pintura < borda da sala < paredes. Texto e Caminho
   * não são do botão Desenho e seguem por cima da sala.
   */
  it('fundo da sala < pintura do balde < borda da sala < paredes e portas', async () => {
    const world = await monta()
    const tinta = indiceDaCamada(world, Number.parseInt(COR_DA_TINTA_DO_DESENHO.slice(1), 16))
    const fundo = indiceDaSala(world, SALA.id, 'fill')
    const borda = indiceDaSala(world, SALA.id, 'stroke')
    expect(fundo).toBeLessThan(tinta)
    expect(borda).toBeGreaterThan(tinta)
    expect(indiceDaCamada(world, WALL_COLOR)).toBeGreaterThan(borda)
    expect(indiceDaCamada(world, DOOR_COLOR)).toBeGreaterThan(borda)
  })

  it('Caminho e Texto continuam por cima da borda da sala', async () => {
    const world = await monta([TINTA_DO_DESENHO, CAMINHO, TEXTO])
    const borda = indiceDaSala(world, SALA.id, 'stroke')
    expect(indiceDaCamada(world, Number.parseInt(COR_DO_CAMINHO.slice(1), 16))).toBeGreaterThan(borda)
    expect(indiceDoTexto(world, ROTULO)).toBeGreaterThan(borda)
  })
})
