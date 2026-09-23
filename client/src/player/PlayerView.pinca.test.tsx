import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { ZOOM_STEP_FACTOR, ZOOM_STEP_MS, type ZoomStepRequest } from './playerZoom'

/**
 * A PINÇA E O + NA PlayerView MONTADA — a costura do zoom do celular com o que
 * a tela do jogador já fazia com um dedo só: arrastar a própria ficha, apontar
 * o laser, "Minha ficha" e chegar a outra cena por um pino de viagem.
 *
 * `playerZoom.test.ts` prova a conta da pinça e do degrau; a régua e2e
 * (`task-jornada-zoom-no-celular.spec.ts`) prova o pixel num celular. Aqui a
 * prova é o meio: os dedos entram pelo palco do Pixi na ordem em que o
 * EventBoundary os entrega (captura no palco, alvo, subida até o palco) e o
 * que se lê é a câmera do `world` e o que a tela mandou para o mestre.
 *
 * Sem navegador, e só o que o jsdom não tem é trocado: o `Application` (pede
 * WebGL) e a MEDIDA do texto (sem canvas 2d; o nome da ficha ganha uma caixa
 * fixa, como o `sizedText` de `pixi/textResolution.test.ts`). O ticker é do
 * teste — cada quadro roda quando o teste pede — e o relógio também, então o
 * degrau animado do + fica parado exatamente onde o teste quer.
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
/** O meio da tela de 800 x 600: onde "Minha ficha" põe a ficha (sem painel cobrindo nada). */
const CENTRO: Ponto = { x: tela.largura / 2, y: tela.altura / 2 }
/** Margem do enquadramento de mapa novo (`FIT_MARGIN` da PlayerView). */
const MARGEM = 24

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

/** Salão de 25 x 25 quadrados (1000 x 1000 px de mundo), com a Ana no meio. */
function salao(): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, GRADE), tokens: [ANA] }
}

/** Porão de 10 x 8 quadrados (400 x 320 px de mundo): outra cena, outro tamanho. */
function porao(): MapData {
  return { ...createEmptyMap('m-porao', '', 10, 8, GRADE), tokens: [{ ...ANA, x: 200, y: 160 }] }
}

const BASE: Props = {
  map: salao(),
  vision: quadrado(1000, 1000),
  ownTokens: [ANA.id],
  settings: DEFAULT_PLAYER_SETTINGS,
  focusTokenId: null,
  focusSeq: 0,
  onMove: () => {},
}

/** Um toque no + (animado, como o dedo pede). */
const MAIS: ZoomStepRequest = { direction: 1, animate: true, seq: 1 }

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, …)`). */
function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** A ficha da Ana: a camada das fichas é a última do mundo (`world.addChild(…, pins, tokens)`). */
function fichaDaAna(): Container {
  const ficha = mundo().children.at(-1)?.children[0]
  if (!(ficha instanceof Container)) throw new Error('a ficha da Ana não está no mundo')
  return ficha
}

/** Onde um ponto do mundo aparece na tela agora. */
function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

/** O ponto do mundo sob um ponto da tela agora. */
function noMundo(p: Ponto): Ponto {
  const w = mundo()
  return { x: (p.x - w.x) / w.scale.x, y: (p.y - w.y) / w.scale.y }
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

/**
 * Dedo encosta, na ordem do EventBoundary do Pixi: primeiro a captura no palco;
 * com a ficha como alvo, depois a ficha e a subida até o palco, a menos que
 * alguém pare a propagação. Com o próprio palco como alvo, captura e alvo saem
 * na mesma volta — parar na captura não impede o ouvinte do alvo.
 */
function encostar(id: number, p: Ponto, primario: boolean, alvo: Container | null = null): void {
  const e = dedo(id, p, primario)
  act(() => {
    palco().emit('pointerdowncapture', e)
    if (alvo === null) {
      palco().emit('pointerdown', e)
      return
    }
    if (e.propagationStopped) return
    alvo.emit('pointerdown', e)
    if (!e.propagationStopped) palco().emit('pointerdown', e)
  })
}

function arrastar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', dedo(id, p, false))
  })
}

function soltar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('pointerup', dedo(id, p, false))
  })
}

describe('PlayerView — a pinça e o + convivem com o gesto de um dedo', () => {
  let raiz: HTMLDivElement
  let root: Root
  let agora = 0

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // O jsdom não tem ResizeObserver, e a PlayerView acompanha o tamanho do contêiner com ele.
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

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  /**
   * Primeiro snapshot: espera o `setup` assíncrono (o `init` do Application)
   * chegar ao fim. A última coisa que ele faz é avisar os botões + e − do
   * limite — sem esse aviso, um erro no meio do setup (que só vai para o
   * console) deixaria a tela meio montada e o teste lendo nada. Só então o
   * relógio passa a ser o do teste: o `waitFor` mede o próprio prazo.
   */
  async function monta(props: Props): Promise<void> {
    const limites = vi.fn()
    await mostra({ ...props, onZoomLimitsChange: limites })
    await vi.waitFor(() => expect(limites).toHaveBeenCalledWith({ canZoomIn: true, canZoomOut: true }))
    expect(conteiner().dataset.tokensCount).toBe('1')
    vi.spyOn(performance, 'now').mockImplementation(() => agora)
  }

  /** Um quadro do ticker, `ms` depois do anterior. */
  function quadro(ms: number): void {
    agora += ms
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  it('dedo na própria ficha e o segundo dedo abrindo: aproxima pelo ponto médio e a ficha não anda', async () => {
    const onMove = vi.fn()
    await monta({ ...BASE, onMove })
    const escala0 = mundo().scale.x
    const a0 = naTela(ANA)
    // O primeiro dedo já arrastava a ficha 8 px quando o segundo encostou, 50 px adiante:
    // a pinça começa no meio dos dois AGORA. Arrastar a ficha não mexe na câmera.
    const a1 = { x: a0.x + 8, y: a0.y }
    const meio = { x: a1.x + 25, y: a1.y }
    const meioNoMundo = noMundo(meio)

    encostar(1, a0, true, fichaDaAna())
    arrastar(1, a1)
    encostar(2, { x: a1.x + 50, y: a1.y }, false)
    // Abrindo em volta do mesmo meio: de 50 px para 130 px entre os dedos.
    arrastar(1, { x: meio.x - 65, y: meio.y })
    arrastar(2, { x: meio.x + 65, y: meio.y })
    soltar(1, { x: meio.x - 65, y: meio.y })
    soltar(2, { x: meio.x + 65, y: meio.y })

    expect(mundo().scale.x / escala0).toBeGreaterThan(2.5)
    // Um pixel de tela de folga: a posição do mundo encosta no pixel inteiro (pixelAlign.ts).
    expect(distancia(noMundo(meio), meioNoMundo)).toBeLessThan(1)
    expect(onMove).not.toHaveBeenCalled()
    expect(fichaDaAna().position.x).toBe(ANA.x)
    expect(fichaDaAna().position.y).toBe(ANA.y)
  })

  it('laser ligado: o segundo dedo vira pinça e o laser apaga na hora — a mesa não fica com a ponta acesa', async () => {
    const onLaserMove = vi.fn()
    const onLaserEnd = vi.fn()
    await monta({ ...BASE, laserArmed: true, onLaserMove, onLaserEnd })
    const escala0 = mundo().scale.x
    const chao = naTela({ x: 300, y: 300 })

    encostar(1, chao, true)
    expect(onLaserMove).toHaveBeenCalledTimes(1)
    expect(onLaserEnd).not.toHaveBeenCalled()

    encostar(2, { x: chao.x + 40, y: chao.y }, false)
    expect(onLaserEnd).toHaveBeenCalledTimes(1)

    // Abrindo de 40 px para 120 px: a pinça aproxima e não aponta nada.
    arrastar(1, { x: chao.x - 20, y: chao.y })
    arrastar(2, { x: chao.x + 100, y: chao.y })
    expect(mundo().scale.x / escala0).toBeGreaterThan(2.5)
    expect(onLaserMove).toHaveBeenCalledTimes(1)

    soltar(1, { x: chao.x - 20, y: chao.y })
    soltar(2, { x: chao.x + 100, y: chao.y })
    expect(onLaserEnd).toHaveBeenCalledTimes(1)

    // O modo continua ligado: o próximo dedo sozinho aponta de novo.
    encostar(3, chao, true)
    expect(onLaserMove).toHaveBeenCalledTimes(2)
  })

  it('botão Minha ficha no meio do degrau do +: centraliza na escala em que o degrau ia parar, e o degrau não puxa de volta', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x

    await mostra({ ...BASE, zoomStep: MAIS })
    // O degrau começou e nenhum quadro rodou: a câmera ainda não andou.
    expect(mundo().scale.x).toBe(escala0)

    await mostra({ ...BASE, zoomStep: MAIS, focusTokenId: ANA.id, focusSeq: 1 })
    const escalaFinal = escala0 * ZOOM_STEP_FACTOR
    expect(mundo().scale.x).toBeCloseTo(escalaFinal, 9)
    expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)

    // O tempo inteiro do degrau passa: a ficha continua no centro, na mesma escala.
    quadro(ZOOM_STEP_MS * 2)
    expect(mundo().scale.x).toBeCloseTo(escalaFinal, 9)
    expect(distancia(naTela(ANA), CENTRO)).toBeLessThan(1)
  })

  it('mapa novo (pino de viagem) no meio do degrau do +: chega enquadrado, e o degrau do mapa de antes não o puxa', async () => {
    await monta(BASE)
    await mostra({ ...BASE, zoomStep: MAIS })

    await mostra({ ...BASE, zoomStep: MAIS, map: porao() })
    // Porão de 400 x 320 numa tela de 800 x 600, com a margem: quem limita é a altura.
    const enquadrado = (tela.altura - 2 * MARGEM) / 320
    expect(mundo().scale.x).toBeCloseTo(enquadrado, 9)
    const chegada = { escala: mundo().scale.x, x: mundo().x, y: mundo().y }

    quadro(ZOOM_STEP_MS * 2)
    expect(mundo().scale.x).toBe(chegada.escala)
    expect(mundo().x).toBe(chegada.x)
    expect(mundo().y).toBe(chegada.y)
  })
})
