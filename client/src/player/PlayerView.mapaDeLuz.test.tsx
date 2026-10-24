import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, FillGradient, Graphics, Matrix, Texture } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { LuzDoJogador } from '../lib/periodo'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS } from '../lib/mobilia/vistaTresQuartos'
import type { Light, MapData, Prop, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * MAPA DE LUZ na TELA do jogador (Luz L4b). `pixi/mapaDeLuz.test.ts` prova a
 * conta e o refazer isolados; aqui a prova é a COSTURA: o `snapshot.luz` da
 * cena dele liga a tinta por cima do mundo inteiro (fichas inclusive, D2), o
 * halo de sempre some (quem acende é o mapa de luz), e o dia deixa o mundo
 * com os mesmos filhos de antes da Luz. Sem navegador: só o `Application` é
 * trocado; o `render` do renderer conta os redesenhos do mapa de luz.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], quadros: new Array<() => void>(), redesenhos: 0 }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = {
      resolution: 1,
      render: () => {
        tela.redesenhos += 1
      },
    }
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

const LAMPIAO: Light = { id: 'lampiao', x: 200, y: 200, radius: 140, color: '#ffba7b', intensity: 0.85 }
const NOITE: LuzDoJogador = { periodo: 'noite', cor: '#465a92', forca: 0.85 }
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    { x: 600, y: 600 },
    { x: 0, y: 600 },
  ],
]
const SEM_FICHAS: string[] = []

function pacote(lights: Light[]): MapData {
  return { ...createEmptyMap('m-vila', '', 25, 25, 40), lights }
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** Halos VISÍVEIS (gradiente da luz) em qualquer nó do mundo. */
function halosVisiveis(no: Container): number {
  if (!no.visible) return 0
  let soma = no instanceof Graphics && no.context.instructions.some((i) => i.action === 'fill' && i.data.style.fill instanceof FillGradient) ? 1 : 0
  for (const filho of no.children) soma += halosVisiveis(filho)
  return soma
}

describe('PlayerView — a tinta do período e a luz quente (mapa de luz)', () => {
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
    // O jsdom não tem canvas: o gradiente do halo nasce com a textura branca.
    vi.spyOn(FillGradient.prototype, 'buildGradient').mockImplementation(function (this: FillGradient) {
      this.texture = Texture.WHITE
      this.transform = new Matrix()
    })
    tela.palcos.length = 0
    tela.quadros.length = 0
    tela.redesenhos = 0
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

  function quadro(): void {
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  async function mostra(map: MapData, luz?: LuzDoJogador): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={VISAO} ownTokens={SEM_FICHAS} luz={luz} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  const rotulos = () => mundo().children.map((c) => c.label)

  it('de dia o mundo fica como antes da Luz: sem mapa de luz, com o halo de sempre, nada desenhado', async () => {
    await mostra(pacote([LAMPIAO]))
    quadro()
    expect(rotulos()).not.toContain('mapaDeLuz')
    expect(halosVisiveis(mundo())).toBe(1)
    expect(tela.redesenhos).toBe(0)
  })

  it('à noite o mapa de luz entra por cima de tudo, o halo some e o mapa só se refaz quando o conteúdo muda', async () => {
    const mapa = pacote([LAMPIAO])
    await mostra(mapa, NOITE)
    quadro()
    expect(rotulos().slice(-2)).toEqual(['mapaDeLuz', 'contornoDaFicha'])
    expect(halosVisiveis(mundo())).toBe(0)
    expect(tela.redesenhos).toBe(1)
    quadro()
    expect(tela.redesenhos).toBe(1)
    // Snapshot novo com o mesmo conteúdo (listas novas): a chave de revisão não muda.
    await mostra(structuredClone(mapa), NOITE)
    quadro()
    expect(tela.redesenhos).toBe(1)
    // A luz andou: refaz.
    await mostra(pacote([{ ...LAMPIAO, x: 260 }]), NOITE)
    quadro()
    expect(tela.redesenhos).toBe(2)
  })

  it('MT11: na vista 3/4 com a obra ligada, a chama da fogueira do jogador sobe com a lenha, como no editor', async () => {
    const fogueira: Prop = { id: 'fogo-1', src: '', x: 200, y: 100, width: 64, height: 64, linkedMapPath: null, mobilia: 'fogueira' }
    const chama = (): Container | undefined => {
      const achar = (no: Container): Container | undefined => (no.label === 'chama:fogo-1' ? no : no.children.map(achar).find((c) => c !== undefined))
      return achar(mundo())
    }
    trocarObraNoTeste(true)
    try {
      await mostra({ ...pacote([]), props: [fogueira] })
      quadro()
      const deCima = chama()?.position.y
      await mostra({ ...pacote([]), props: [fogueira], vistaDosMoveis: 'tres-quartos' })
      quadro()
      expect(deCima).toBeDefined()
      expect(chama()?.position.y).toBeCloseTo((deCima ?? 0) + DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS, 6)
    } finally {
      trocarObraNoTeste(false)
    }
  })

  it('voltar ao dia tira o mapa de luz do mundo e devolve o halo', async () => {
    const mapa = pacote([LAMPIAO])
    await mostra(mapa, NOITE)
    quadro()
    await mostra(mapa)
    quadro()
    expect(rotulos()).not.toContain('mapaDeLuz')
    expect(rotulos()).not.toContain('contornoDaFicha')
    expect(halosVisiveis(mundo())).toBe(1)
  })
})
