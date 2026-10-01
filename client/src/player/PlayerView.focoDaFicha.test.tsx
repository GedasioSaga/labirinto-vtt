import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { RECENTER_MS } from './edgeFollow'

/**
 * A CÂMERA VAI À FICHA (`focusSeq`) na PlayerView montada, de três jeitos:
 *
 * - pedido do dedo ou do mouse ("Minha ficha", "Onde estou", "Centralizar"):
 *   a câmera DESLIZA até a ficha em `RECENTER_MS`, e o jogador vê para que
 *   lado ela estava;
 * - pedido do teclado, pinça em curso ou sistema pedindo menos movimento: SALTA;
 * - chegada pelo ATALHO na mesma cena (`focusSnap`): a ficha aparece direto do
 *   outro lado. O mapa é o mesmo, então o snapshot da chegada começa um
 *   deslize de uma ponta do atalho à outra, em linha reta pela tela, por cima
 *   de parede e névoa; o pedido da chegada corta esse deslize.
 *
 * Mesmo arnês de `PlayerView.borda.test.tsx`: o `Application` sem WebGL e o
 * texto com caixa fixa são as únicas trocas; o ticker e o relógio são do teste.
 */

/** O palco de cada Application criado, os quadros do ticker (o teste roda quando quer) e o tamanho da tela. */
interface Tela {
  palcos: Container[]
  quadros: (() => void)[]
  largura: number
  altura: number
}

const tela = vi.hoisted((): Tela => ({ palcos: [], quadros: [], largura: 800, altura: 600 }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, tela.largura, tela.altura)
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
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

type Ponto = { x: number; y: number }
type Props = Parameters<typeof PlayerView>[0]

const GRADE = 40
/** No canto de cima à esquerda do salão: o enquadramento da chegada não a põe no meio da tela. */
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }
const CENTRO: Ponto = { x: tela.largura / 2, y: tela.altura / 2 }
/** Um quadro a 60 por segundo. */
const QUADRO_MS = 16

function quadrado(largura: number, altura: number): RegionPoint[][] {
  return [
    [
      { x: 0, y: 0 },
      { x: largura, y: 0 },
      { x: largura, y: altura },
      { x: 0, y: altura },
    ],
  ]
}

/** Salão de 25 x 25 quadrados (1000 x 1000 px de mundo), todo à vista. */
function salao(ana: Token = ANA): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, GRADE), tokens: [ana] }
}

function base(map: MapData): Props {
  return {
    map,
    vision: quadrado(1000, 1000),
    ownTokens: [ANA.id],
    settings: DEFAULT_PLAYER_SETTINGS,
    focusTokenId: null,
    focusSeq: 0,
    onMove: () => {},
  }
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function fichaDaAna(): Container {
  const ficha = mundo().children.at(-1)?.children[0]
  if (!(ficha instanceof Container)) throw new Error('a ficha da Ana não está no mundo')
  return ficha
}

function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y)

function dedo(id: number, p: Ponto, primario: boolean): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = id
  e.isPrimary = primario
  e.global.set(p.x, p.y)
  return e
}

describe('PlayerView — a câmera vai à ficha: desliza pelo dedo, salta pelo teclado, e o atalho não arrasta a ficha pela tela', () => {
  let raiz: HTMLDivElement
  let root: Root
  let agora = 0

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
    agora = 1000
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

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  /** Primeiro desenho (o `init` do Application é assíncrono); daí em diante o relógio é do teste. */
  async function monta(props: Props): Promise<void> {
    await mostra(props)
    await vi.waitFor(() => {
      const el = raiz.firstElementChild
      expect(el instanceof HTMLElement ? el.dataset.tokensCount : undefined).toBe('1')
    })
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
  }

  /** `n` quadros do ticker, `ms` cada. */
  function quadros(n: number, ms: number = QUADRO_MS): void {
    for (let i = 0; i < n; i += 1) {
      agora += ms
      act(() => {
        for (const q of [...tela.quadros]) q()
      })
    }
  }

  function movimentoReduzido(): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  describe('pedido de centralizar', () => {
    it('pelo dedo ou pelo mouse: a câmera desliza até a ficha em RECENTER_MS, no mesmo zoom, e para lá', async () => {
      const props = base(salao())
      await monta(props)
      const escala = mundo().scale.x
      const antes = naTela(ANA)
      // Na chegada a ficha está longe do meio: a prova não passa por acaso.
      expect(distancia(antes, CENTRO)).toBeGreaterThan(100)

      await mostra({ ...props, focusTokenId: ANA.id, focusSeq: 1, focusAnimate: true })
      // O pedido não salta: quem leva a câmera é o ticker, quadro a quadro.
      expect(distancia(naTela(ANA), antes)).toBeLessThan(1)

      quadros(1, RECENTER_MS / 2)
      const meio = naTela(ANA)
      expect(distancia(meio, antes)).toBeGreaterThan(1)
      expect(distancia(meio, CENTRO)).toBeGreaterThan(1)

      quadros(1, RECENTER_MS / 2)
      expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)
      expect(mundo().scale.x).toBe(escala)
      // Chegou e parou: mais quadros não mexem na câmera.
      const assentou = { x: mundo().x, y: mundo().y }
      quadros(5)
      expect(mundo().x).toBe(assentou.x)
      expect(mundo().y).toBe(assentou.y)
    })

    it('pelo teclado (Enter ou Espaço, sem deslize pedido): a câmera salta na hora', async () => {
      const props = base(salao())
      await monta(props)
      await mostra({ ...props, focusTokenId: ANA.id, focusSeq: 1, focusAnimate: false })
      expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)
    })

    it('com o sistema pedindo menos movimento, o pedido do dedo também salta', async () => {
      movimentoReduzido()
      const props = base(salao())
      await monta(props)
      await mostra({ ...props, focusTokenId: ANA.id, focusSeq: 1, focusAnimate: true })
      expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)
    })

    it('com a pinça em curso, o pedido salta: a câmera é dela, e um deslize brigaria com os dedos', async () => {
      const props = base(salao())
      await monta(props)
      // Dois dedos no chão, longe da ficha: o segundo faz a pinça.
      act(() => {
        palco().emit('pointerdowncapture', dedo(1, { x: 600, y: 400 }, true))
        palco().emit('pointerdowncapture', dedo(2, { x: 700, y: 450 }, false))
      })
      await mostra({ ...props, focusTokenId: ANA.id, focusSeq: 1, focusAnimate: true })
      expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)
    })
  })

  describe('chegada pelo atalho na mesma cena', () => {
    const PONTA_A: Token = { ...ANA, x: 200, y: 500 }
    const PONTA_B: Token = { ...ANA, x: 800, y: 500 }

    /** Ana parada na ponta A; chega o snapshot com ela na ponta B, no MESMO mapa (o deslize de A a B começa aqui). */
    async function chegaPeloAtalho(): Promise<Props> {
      const props = base(salao(PONTA_A))
      await monta(props)
      const chegada = { ...props, map: salao(PONTA_B) }
      await mostra(chegada)
      return chegada
    }

    it('o pedido no MESMO desenho do snapshot da chegada (como o main.tsx manda): a ficha já está do outro lado, e nenhum quadro a mostra a caminho', async () => {
      const props = base(salao(PONTA_A))
      await monta(props)
      await mostra({ ...props, map: salao(PONTA_B), focusTokenId: ANA.id, focusSeq: 1, focusSnap: true })
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
      expect(fichaDaAna().position.y).toBe(PONTA_B.y)
      expect(distancia(naTela(PONTA_B), CENTRO)).toBeLessThan(1)
      // O primeiro quadro do ticker já é o do outro lado: o deslize de A a B nem chega a andar.
      quadros(1)
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
      quadros(20)
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
      expect(fichaDaAna().position.y).toBe(PONTA_B.y)
    })

    it('a ficha aparece direto do outro lado, sem cruzar a tela, e a câmera salta junto', async () => {
      const chegada = await chegaPeloAtalho()
      // O pedido no desenho seguinte ao do snapshot: o corte vale mesmo com o pedido atrasado.
      await mostra({ ...chegada, focusTokenId: ANA.id, focusSeq: 1, focusSnap: true })
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
      expect(fichaDaAna().position.y).toBe(PONTA_B.y)
      expect(distancia(naTela(PONTA_B), CENTRO)).toBeLessThan(1)
      // Nenhum deslize sobrou para o ticker levar a ficha pelo caminho reto.
      quadros(20)
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
      expect(fichaDaAna().position.y).toBe(PONTA_B.y)
    })

    it('o atalho manda sobre o pedido do dedo: a câmera salta, sem deslizar', async () => {
      const chegada = await chegaPeloAtalho()
      await mostra({ ...chegada, focusTokenId: ANA.id, focusSeq: 1, focusSnap: true, focusAnimate: true })
      expect(distancia(naTela(PONTA_B), CENTRO)).toBeLessThan(1)
    })

    it('"Minha ficha" com a ficha andando pela sala (sem atalho): o deslize dela continua', async () => {
      const chegada = await chegaPeloAtalho()
      await mostra({ ...chegada, focusTokenId: ANA.id, focusSeq: 1 })
      // Logo depois do pedido a ficha ainda está saindo da ponta A.
      expect(fichaDaAna().position.x).toBeLessThan(PONTA_B.x)
      quadros(20)
      expect(fichaDaAna().position.x).toBe(PONTA_B.x)
    })
  })
})
