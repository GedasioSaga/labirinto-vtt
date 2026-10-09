import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * CONTEXTO WEBGL PERDIDO (bug de 09/10/2026, "fechar o inventário no celular"):
 * com o inventário aberto o mapa fica escondido atrás do véu, e o Chrome do
 * Android, apertado de memória pelas fotos dos itens, solta o contexto WebGL
 * do canvas do mapa e não devolve. Ao fechar, o canvas reaparece BRANCO, com
 * o ícone de imagem quebrada que o Chrome pinta no canto de um canvas perdido.
 * Reproduzido no Edge com `WEBGL_lose_context.loseContext()` sem restaurar.
 *
 * A prova aqui é a costura: o evento `webglcontextlost` no canvas faz a
 * PlayerView montar um Pixi NOVO (canvas e contexto novos) no lugar do morto —
 * e, se o aparelho perde o contexto de novo e de novo, desiste e cai na tela
 * de erro do mapa em vez de ficar remontando para sempre.
 *
 * Sem navegador: o `Application` do Pixi pede WebGL, que o jsdom não tem, e é
 * a única peça trocada.
 */

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => undefined, remove: () => undefined }
    readonly canvas = document.createElement('canvas')
    async init(): Promise<void> {}
    resize(): void {}
    destroy(): void {
      this.canvas.remove()
    }
  }
  return { ...pixi, Application: ApplicationSemGpu }
})

const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
    { x: 0, y: 400 },
  ],
]
const MAPA = createEmptyMap('m-sala', '', 10, 10, 40)
const SEM_FICHAS: string[] = []

describe('PlayerView — contexto WebGL perdido', () => {
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

  async function mostra(): Promise<void> {
    await act(async () => {
      root.render(<PlayerView map={MAPA} vision={VISAO} ownTokens={SEM_FICHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
  }

  async function canvasMontado(): Promise<HTMLCanvasElement> {
    let achado: HTMLCanvasElement | null = null
    await vi.waitFor(() => {
      const todos = raiz.querySelectorAll('canvas')
      expect(todos).toHaveLength(1)
      achado = todos[0] ?? null
    })
    if (achado === null) throw new Error('sem canvas')
    return achado
  }

  async function perdeOContexto(canvas: HTMLCanvasElement): Promise<void> {
    await act(async () => {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
  }

  it('o canvas que perdeu o contexto é trocado por um novo, com o mapa desenhado de novo', async () => {
    await mostra()
    const morto = await canvasMontado()
    await perdeOContexto(morto)

    const novo = await canvasMontado()
    expect(novo).not.toBe(morto)
    expect(morto.isConnected).toBe(false)
  })

  it('perde o contexto de novo e de novo: desiste e lança, para a tela de erro do mapa', async () => {
    // O React reporta o erro que escapou no console: silêncio, a prova é `lancou`.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let lancou: unknown = null
    let remontagens = 0
    await mostra()
    // Sem ErrorBoundary aqui: o erro que escapa da árvore sai pelo `act`.
    for (let vez = 0; vez < 10 && lancou === null; vez++) {
      const canvas = await canvasMontado()
      try {
        await perdeOContexto(canvas)
        remontagens++
      } catch (erro) {
        lancou = erro
      }
    }
    expect(remontagens).toBe(3)
    expect(lancou).toBeInstanceOf(Error)
  })
})
