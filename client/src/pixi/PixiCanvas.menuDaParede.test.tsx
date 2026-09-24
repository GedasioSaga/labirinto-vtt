import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { findTokenPath } from '../lib/collision'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Wall } from '../types/map'
import { PixiCanvas } from './PixiCanvas'

/**
 * O CLIQUE DIREITO NA PAREDE COM O PixiCanvas MONTADO — a costura que o
 * `wallGesture.test.tsx` não vê. Lá as duas peças (`ligarMenuDaParede` e
 * `botaoDireitoEhDaParede`) são provadas soltas; aqui a prova é que o canvas
 * do mestre as liga: o `contextmenu` no contêiner abre o menu da parede e o
 * item chama a store com a parede e o ponto do clique, e o `pointerdown` do
 * botão direito sobre a parede sai antes de começar seleção ou traço.
 *
 * Sem navegador: só o que o jsdom não tem é trocado — o `Application` (pede
 * WebGL) e a medida do texto (sem canvas 2d), no molde de
 * `player/PlayerView.pinca.test.tsx`.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], largura: 1200, altura: 800 }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
    // O canvas escuta o `resize` do renderer para redesenhar grade e fundo.
    readonly renderer = Object.assign(new pixi.EventEmitter(), { resolution: 1 })
    readonly ticker = { add: () => {}, remove: () => {} }
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
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

const GRADE = 64
const BOTAO_ESQUERDO = 0
const BOTAO_DIREITO = 2
/** Meio da divisa entre os dois prédios (x=512), em px de mundo. */
const NA_DIVISA = { x: 512, y: 160 }

function doisPredios(): MapData {
  const armazem = buildRoomFromDraft('armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 })
  const oficina = buildRoomFromDraft('oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 320 })
  const base = createEmptyMap('m_canvas_gesto', 'Dois prédios', 40, 20, GRADE)
  return addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)
}

function divisa(map: MapData): Wall[] {
  return map.walls.filter((w) => Math.abs(w.x1 - 512) < 0.01 && Math.abs(w.x2 - 512) < 0.01)
}

/** Ponto de mundo → px do contêiner, pela câmera que o canvas aplicou (o enquadramento de
 *  abertura desloca e dá zoom: o ponto tem de ser convertido de verdade). */
function naTela(mundo: { x: number; y: number }): { x: number; y: number } {
  const camera = useMapStore.getState().camera
  return { x: camera.x + mundo.x * camera.scale, y: camera.y + mundo.y * camera.scale }
}

let raiz: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // O jsdom não tem ResizeObserver, e o canvas acompanha o tamanho do contêiner com ele.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  tela.palcos.length = 0
  useMapStore.setState({ map: doisPredios(), selection: [], past: [], future: [], activeTool: 'select', floorShapeKind: 'rect', camera: { x: 0, y: 0, scale: 1 } })
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
  root = createRoot(raiz)
})

afterEach(() => {
  act(() => root.unmount())
  raiz.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Monta o canvas e espera o `setup` assíncrono chegar até o fim (o canvas anexado ao contêiner). */
async function monta(): Promise<void> {
  const exportador = vi.fn()
  await act(async () => {
    root.render(<PixiCanvas onImageExporterChange={exportador} />)
  })
  // `onImageExporterChange` é das últimas coisas do setup: com ele chamado, os ouvintes estão todos ligados.
  await vi.waitFor(() => expect(exportador).toHaveBeenCalled())
  // O enquadramento de abertura mexeu na câmera: tela e mundo não coincidem.
  expect(useMapStore.getState().camera).not.toEqual({ x: 0, y: 0, scale: 1 })
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('o PixiCanvas não criou o Application')
  return p
}

function canvas(): HTMLCanvasElement {
  const c = raiz.querySelector('canvas')
  if (c === null) throw new Error('o canvas não foi anexado ao contêiner')
  return c
}

/** Clique direito do navegador sobre o canvas; devolve `true` se o menu do navegador foi suprimido. */
function cliqueDireito(mundo: { x: number; y: number }): boolean {
  const p = naTela(mundo)
  const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: BOTAO_DIREITO, clientX: p.x, clientY: p.y })
  act(() => {
    canvas().dispatchEvent(evento)
  })
  return evento.defaultPrevented
}

/** `pointerdown` + `pointerup` no palco do Pixi, no ponto de mundo, com o botão pedido. */
function aperta(mundo: { x: number; y: number }, botao: number): void {
  const p = naTela(mundo)
  const evento = (): FederatedPointerEvent => {
    const e = new FederatedPointerEvent(new EventBoundary())
    e.pointerType = 'mouse'
    e.pointerId = 1
    e.isPrimary = true
    e.button = botao
    e.global.set(p.x, p.y)
    return e
  }
  act(() => {
    palco().emit('pointerdown', evento())
  })
  act(() => {
    palco().emit('pointerup', evento())
  })
}

function menu(): HTMLElement | null {
  return raiz.querySelector<HTMLElement>('[role="menu"]')
}

function item(rotulo: string): HTMLButtonElement {
  const botao = [...raiz.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent?.includes(rotulo))
  if (botao === undefined) throw new Error(`item "${rotulo}" não está no menu`)
  return botao
}

describe('PixiCanvas — o clique direito na parede abre o menu da parede', () => {
  it('contextmenu sobre a divisa abre o menu e "Abrir vão aqui" abre o vão ONDE o mestre clicou, dos dois lados', async () => {
    await monta()
    expect(menu()).toBeNull()

    expect(cliqueDireito(NA_DIVISA)).toBe(true)
    expect(menu()).not.toBeNull()
    act(() => item('Abrir vão aqui').click())

    const map = useMapStore.getState().map
    const bordas = divisa(map)
      .flatMap((w) => [w.y1, w.y2])
      .map(Math.round)
    // Vão de uma célula centrado em y=160 (128..192), nas duas paredes da divisa.
    expect(bordas.filter((y) => y === 128)).toHaveLength(2)
    expect(bordas.filter((y) => y === 192)).toHaveLength(2)
    expect(findTokenPath({ x: 480, y: 160 }, { x: 544, y: 160 }, map.walls, GRADE)).not.toBeNull()
    expect(menu()).toBeNull()
  })

  it('perto da quina, o vão aberto pelo canvas para na ponta da parede clicada: a face do vizinho na mesma reta fica inteira', async () => {
    await monta()
    const faceNorteDoVizinho = useMapStore.getState().map.walls.find((w) => w.id === 'o0')
    expect(faceNorteDoVizinho).toBeDefined()

    // Face norte do Armazém (a0, y=0, x 0..512), a 16 px da quina com a Oficina.
    expect(cliqueDireito({ x: 496, y: 0 })).toBe(true)
    act(() => item('Abrir vão aqui').click())

    const map = useMapStore.getState().map
    expect(map.walls.some((w) => w.id === 'a0')).toBe(false)
    expect(map.walls.find((w) => w.id === 'o0')).toBe(faceNorteDoVizinho)
  })

  it('"Desabar parede" pelo menu do canvas derruba a divisa dos dois lados', async () => {
    await monta()
    cliqueDireito({ x: 512, y: 40 })
    act(() => item('Desabar parede').click())
    expect(divisa(useMapStore.getState().map)).toHaveLength(0)
    expect(menu()).toBeNull()
  })

  it('fora de parede o clique direito continua sendo o do navegador', async () => {
    await monta()
    expect(cliqueDireito({ x: 250, y: 160 })).toBe(false)
    expect(menu()).toBeNull()
  })
})

describe('PixiCanvas — o pointerdown do botão direito sobre a parede não começa outro gesto', () => {
  it('botão esquerdo na parede seleciona (o gesto da ferramenta está vivo)', async () => {
    await monta()
    aperta({ x: 250, y: 0 }, BOTAO_ESQUERDO)
    expect(useMapStore.getState().selection).toEqual([{ kind: 'wall', id: 'a0' }])
  })

  it('botão direito na mesma parede NÃO seleciona: o aperto é do menu da parede', async () => {
    await monta()
    aperta({ x: 250, y: 0 }, BOTAO_DIREITO)
    expect(useMapStore.getState().selection).toEqual([])
  })
})
