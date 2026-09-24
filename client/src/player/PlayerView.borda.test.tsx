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
 * A FICHA NA BORDA ROLA O MAPA, NA PlayerView MONTADA — relato da Fabi num
 * corredor de 530 casas no celular: a cada 8-12 casas era soltar a ficha,
 * rolar o mapa e pegar a ficha de novo.
 *
 * `edgeFollow.test.ts` prova a conta; aqui a prova é a costura: o dedo entra
 * pelo palco do Pixi, o ticker é do teste (cada quadro roda quando o teste
 * pede) e o relógio também. O que se lê é a câmera do `world`, onde a ficha
 * está na tela e o que a tela mandou para o mestre.
 *
 * A rolagem é só da câmera DESTA tela: durante o arrasto nada sai pela rede,
 * e ao soltar sai o mesmo `onMove` de sempre, uma vez.
 *
 * Mesmo arnês de `PlayerView.pinca.test.tsx`: o `Application` sem WebGL e o
 * texto com caixa fixa são as únicas trocas.
 */

const tela = vi.hoisted(() => ({
  palcos: [] as Container[],
  quadros: [] as (() => void)[],
  largura: 800,
  altura: 600,
}))

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
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null, color: '#3cff00' }
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

/** Salão de 25 x 25 quadrados (1000 x 1000 px de mundo). */
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

/** Dedo encosta NA FICHA: captura no palco, a ficha, e a subida até o palco se ninguém parou. */
function encostarNaFicha(p: Ponto): void {
  const e = dedo(1, p, true)
  act(() => {
    palco().emit('pointerdowncapture', e)
    if (e.propagationStopped) return
    fichaDaAna().emit('pointerdown', e)
    if (!e.propagationStopped) palco().emit('pointerdown', e)
  })
}

function arrastar(p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', dedo(1, p, false))
  })
}

function soltar(p: Ponto): void {
  act(() => {
    palco().emit('pointerup', dedo(1, p, false))
  })
}

describe('PlayerView — a ficha na borda rola o mapa, e a câmera recentra quem soltou perto da borda', () => {
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
    agora = 0
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

  /**
   * Monta e aproxima dois degraus do + (pelo teclado, sem animação): o salão
   * inteiro enquadrado cabe na tela e não teria o que rolar; aproximado, ele
   * passa da tela para os quatro lados.
   */
  async function montaAproximado(props: Props): Promise<void> {
    const limites = vi.fn()
    await mostra({ ...props, onZoomLimitsChange: limites })
    await vi.waitFor(() => expect(limites).toHaveBeenCalledWith({ canZoomIn: true, canZoomOut: true }))
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
    await mostra({ ...props, onZoomLimitsChange: limites, zoomStep: { direction: 1, animate: false, seq: 1 } })
    await mostra({ ...props, onZoomLimitsChange: limites, zoomStep: { direction: 1, animate: false, seq: 2 } })
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

  it('arrastar a ficha até a borda direita: o mapa rola, a ficha fica sob o dedo e nada sai pela rede até soltar', async () => {
    const onMove = vi.fn()
    const onSignal = vi.fn()
    const onLaserMove = vi.fn()
    await montaAproximado({ ...base(salao()), onMove, onSignal, onLaserMove })
    const escala = mundo().scale.x
    const x0 = mundo().x
    const y0 = mundo().y
    // O mapa passa da tela: há o que rolar para a direita.
    expect(naTela({ x: 1000, y: 0 }).x).toBeGreaterThan(tela.largura)

    const borda = { x: tela.largura - 4, y: CENTRO.y }
    encostarNaFicha(naTela(ANA))
    arrastar({ x: CENTRO.x + 100, y: CENTRO.y })
    arrastar(borda)
    // Soltar a ficha ali sem rolar a deixaria neste ponto do mundo.
    const semRolar = (borda.x - x0) / escala
    quadros(10)

    // A câmera andou para a esquerda (revela a direita), só no eixo x e no mesmo zoom.
    expect(mundo().x).toBeLessThan(x0 - 20)
    expect(mundo().y).toBe(y0)
    expect(mundo().scale.x).toBe(escala)
    // A ficha andou junto no mundo e continua sob o dedo.
    expect(fichaDaAna().position.x).toBeGreaterThan(semRolar + 20)
    expect(distancia(naTela(fichaDaAna().position), borda)).toBeLessThan(1)
    // Rolar é só desta tela: nenhum pedido ao mestre durante o arrasto.
    expect(onMove).not.toHaveBeenCalled()
    expect(onSignal).not.toHaveBeenCalled()
    expect(onLaserMove).not.toHaveBeenCalled()

    soltar(borda)
    expect(onMove).toHaveBeenCalledTimes(1)
    const [id, x, y] = onMove.mock.calls[0]
    expect(id).toBe(ANA.id)
    expect(x).toBeGreaterThan(semRolar + 20)
    expect(y).toBe(ANA.y)
  })

  /** O aparelho: `dedo` = tela de toque (`pointer: coarse`), onde "Câmera segue minha ficha" nasce ligado. */
  function aparelho(tipo: 'dedo' | 'mouse'): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: tipo === 'dedo' && query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  /** Arrasta a Ana até 30 px da borda direita e solta; devolve a câmera logo depois de soltar e onde a ficha ficou. */
  function soltaPertoDaBorda(onMove: ReturnType<typeof vi.fn>): { x0: number; y0: number; solta: Ponto } {
    const borda = { x: tela.largura - 30, y: CENTRO.y }
    encostarNaFicha(naTela(ANA))
    arrastar({ x: CENTRO.x + 100, y: CENTRO.y })
    arrastar(borda)
    const x0 = mundo().x
    const y0 = mundo().y
    soltar(borda)
    expect(onMove).toHaveBeenCalledTimes(1)
    const [, x, y] = onMove.mock.calls[0]
    return { x0, y0, solta: { x, y } }
  }

  it('no celular, sem ajuste salvo ("Câmera segue minha ficha" nasce ligado): soltar perto da borda recentra', async () => {
    aparelho('dedo')
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), onMove })
    const escala = mundo().scale.x
    const { x0, solta } = soltaPertoDaBorda(onMove)
    quadros(1, RECENTER_MS)
    expect(distancia(naTela(solta), CENTRO)).toBeLessThan(1)
    expect(mundo().x).not.toBe(x0)
    expect(mundo().scale.x).toBe(escala)
  })

  it('no notebook, sem ajuste salvo ("Câmera segue minha ficha" nasce desligado): soltar perto da borda não mexe a câmera', async () => {
    aparelho('mouse')
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), onMove })
    const { x0, y0 } = soltaPertoDaBorda(onMove)
    quadros(20)
    expect(mundo().x).toBe(x0)
    expect(mundo().y).toBe(y0)
  })

  it('"Câmera segue minha ficha" desligado no Painel vale até no celular: soltar perto da borda não mexe a câmera', async () => {
    aparelho('dedo')
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), settings: { ...DEFAULT_PLAYER_SETTINGS, followOwnToken: false }, onMove })
    const { x0, y0 } = soltaPertoDaBorda(onMove)
    quadros(20)
    expect(mundo().x).toBe(x0)
    expect(mundo().y).toBe(y0)
  })

  it('com o painel aberto na esquerda, a faixa começa onde ele termina: a ficha logo à direita dele rola o mapa', async () => {
    // A coluna do painel no notebook: 12..286 px da janela (player.css, .pp-panel).
    const painel = { minX: 12, minY: 12, maxX: 286, maxY: tela.altura - 12 }
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), focusObstacles: () => [painel], onMove })
    const x0 = mundo().x
    const y0 = mundo().y
    // Há mapa escondido à esquerda do começo da faixa livre: há o que rolar.
    expect(naTela({ x: 0, y: 0 }).x).toBeLessThan(painel.maxX + 48)
    const ana = naTela(ANA)
    expect(ana.x).toBeGreaterThan(painel.maxX + 60)

    // 10 px à direita do painel: dentro da faixa livre, mas a 296 px da borda do canvas.
    const alvo = { x: painel.maxX + 10, y: ana.y }
    encostarNaFicha(ana)
    arrastar({ x: ana.x - 40, y: ana.y })
    arrastar(alvo)
    quadros(10)

    // A câmera andou para a direita (revela a esquerda), só no eixo x, e a ficha segue sob o dedo.
    expect(mundo().x).toBeGreaterThan(x0 + 20)
    expect(mundo().y).toBe(y0)
    expect(distancia(naTela(fichaDaAna().position), alvo)).toBeLessThan(1)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('soltou a ficha perto da borda com "Câmera segue minha ficha" ligado: a câmera recentra nela em 200 ms, suave, e para lá', async () => {
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), settings: { ...DEFAULT_PLAYER_SETTINGS, followOwnToken: true }, onMove })
    const escala = mundo().scale.x
    const borda = { x: tela.largura - 30, y: CENTRO.y }
    encostarNaFicha(naTela(ANA))
    arrastar({ x: CENTRO.x + 100, y: CENTRO.y })
    arrastar(borda)
    soltar(borda)
    expect(onMove).toHaveBeenCalledTimes(1)
    const [, x, y] = onMove.mock.calls[0]
    const solta = { x, y }

    // No meio do caminho: já saiu da borda, ainda não chegou ao centro.
    quadros(1, RECENTER_MS / 2)
    expect(naTela(solta).x).toBeLessThan(borda.x - 1)
    expect(distancia(naTela(solta), CENTRO)).toBeGreaterThan(1)

    quadros(1, RECENTER_MS / 2)
    expect(distancia(naTela(solta), CENTRO)).toBeLessThan(1)
    expect(mundo().scale.x).toBe(escala)
    // Chegou e parou: mais quadros não mexem na câmera.
    const assentou = mundo().x
    quadros(5)
    expect(mundo().x).toBe(assentou)
  })

  it('soltou a ficha no miolo da tela: a câmera não se mexe', async () => {
    const onMove = vi.fn()
    await montaAproximado({ ...base(salao()), onMove })
    const x0 = mundo().x
    const y0 = mundo().y
    encostarNaFicha(naTela(ANA))
    arrastar({ x: CENTRO.x + 60, y: CENTRO.y + 20 })
    quadros(5)
    soltar({ x: CENTRO.x + 60, y: CENTRO.y + 20 })
    quadros(20)
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(mundo().x).toBe(x0)
    expect(mundo().y).toBe(y0)
  })

  it('pegar a ficha que JÁ está na faixa da borda e segurar parado não rola o mapa', async () => {
    const onMove = vi.fn()
    // Aproximado, a Ana em x = 830 aparece a ~36 px da borda direita: dentro da faixa, ainda inteira na tela.
    const naBorda = { ...ANA, x: 830 }
    await montaAproximado({ ...base(salao(naBorda)), onMove })
    const onde = naTela(naBorda)
    expect(onde.x).toBeGreaterThan(tela.largura - 48)
    expect(onde.x).toBeLessThan(tela.largura)
    const x0 = mundo().x

    encostarNaFicha(onde)
    quadros(30)
    // Tremida do dedo, menor que a de um toque: continua parado.
    arrastar({ x: onde.x + 2, y: onde.y })
    quadros(30)
    expect(mundo().x).toBe(x0)

    // Volta ao ponto de onde pegou: soltar ali não é passo nenhum.
    arrastar(onde)
    soltar(onde)
    expect(onMove).not.toHaveBeenCalled()
    expect(mundo().x).toBe(x0)
  })
})
