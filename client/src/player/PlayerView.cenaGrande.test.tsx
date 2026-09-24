import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * CENA GRANDE NO CELULAR, na TELA. `playerCulling.test.ts` prova o recorte
 * isolado; aqui a prova é a COSTURA: a PlayerView de verdade recebe a planta
 * inteira de uma cena enorme e desenha só as paredes perto da ficha e as que o
 * jogador já viu. `data-walls-count` continua contando o que chegou (os e2e
 * leem assim); `data-walls-drawn` conta o que virou traço no Pixi.
 *
 * Sem navegador: só o `Application` (WebGL) é trocado, como em
 * `PlayerView.silhueta.test.tsx`.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => undefined, remove: () => undefined }
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

const GRID = 40
const SALA = 5 * GRID
const SEM_FICHAS: string[] = []

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Quarteirão de `lado` x `lado` salas de 4 paredes: a planta como o jogador a recebe. */
function quarteirao(lado: number): MapData {
  const walls: Wall[] = []
  for (let linha = 0; linha < lado; linha += 1) {
    for (let coluna = 0; coluna < lado; coluna += 1) {
      const x = coluna * SALA
      const y = linha * SALA
      const id = `s${coluna}-${linha}`
      walls.push(
        parede(`${id}-n`, x, y, x + SALA, y),
        parede(`${id}-l`, x + SALA, y, x + SALA, y + SALA),
        parede(`${id}-s`, x, y + SALA, x + SALA, y + SALA),
        parede(`${id}-o`, x, y, x, y + SALA),
      )
    }
  }
  return { ...createEmptyMap('m-blocos', '', lado * 5, lado * 5, GRID), walls }
}

function sala(coluna: number, linha: number): RegionPoint[] {
  const x = coluna * SALA
  const y = linha * SALA
  return [
    { x: x + 1, y: y + 1 },
    { x: x + SALA - 1, y: y + 1 },
    { x: x + SALA - 1, y: y + SALA - 1 },
    { x: x + 1, y: y + SALA - 1 },
  ]
}

describe('PlayerView — cena grande não desenha a cidade inteira', () => {
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
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    vi.unstubAllGlobals()
  })

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  async function mostra(map: MapData, vision: RegionPoint[][]): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={vision} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  async function paredesDesenhadas(map: MapData, vision: RegionPoint[][]): Promise<{ recebidas: string; desenhadas: string }> {
    await mostra(map, vision)
    await vi.waitFor(() => expect(conteiner().dataset.wallsDrawn).toBeDefined())
    return { recebidas: conteiner().dataset.wallsCount ?? '', desenhadas: conteiner().dataset.wallsDrawn ?? '' }
  }

  it('900 salas recebidas, e a tela desenha só as paredes da vizinhança da ficha — as mesmas de uma cena de 9 salas', async () => {
    const grande = await paredesDesenhadas(quarteirao(30), [sala(0, 0)])
    expect(grande.recebidas).toBe('3600')

    act(() => root.unmount())
    root = createRoot(raiz)
    const pequena = await paredesDesenhadas(quarteirao(3), [sala(0, 0)])
    expect(pequena.recebidas).toBe('36')

    // Mesmo desenho na cidade de 900 salas e na vila de 9: o resto está debaixo do preto.
    expect(grande.desenhadas).toBe(pequena.desenhadas)
    expect(Number(grande.desenhadas)).toBeGreaterThanOrEqual(4)
    expect(Number(grande.desenhadas) * 20).toBeLessThan(3600)
  })

  it('snapshot novo com a ficha do outro lado da cidade: as paredes de lá passam a ser desenhadas', async () => {
    const map = quarteirao(30)
    const aqui = await paredesDesenhadas(map, [sala(0, 0)])
    await mostra(map, [sala(0, 0), sala(29, 29)])
    await vi.waitFor(() => expect(conteiner().dataset.wallsDrawn).not.toBe(aqui.desenhadas))
    // A vizinhança de cá continua (a ficha ainda vê a sala 0,0) e a de lá entra.
    expect(Number(conteiner().dataset.wallsDrawn)).toBeGreaterThan(Number(aqui.desenhadas))
    expect(conteiner().dataset.wallsCount).toBe('3600')
  })
})
