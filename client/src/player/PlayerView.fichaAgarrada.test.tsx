import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * PEGAR A PRÓPRIA FICHA na PlayerView montada: no instante em que o dedo (ou o
 * mouse) a agarra, ela cresce um pouco e o cursor vira a mão fechada. No
 * celular o dedo cobre a ficha, e o crescimento em volta dele é o sinal de que
 * pegou. Na hora, sem tween: é resposta ao toque.
 *
 * Toda saída do arrasto a devolve ao tamanho e à mão aberta: soltar andando,
 * soltar no lugar, a pinça que larga a ficha, o sistema cancelando o toque e
 * a ficha que sumiu do pacote no meio do caminho. O snapshot que chega no meio
 * do arrasto não a encolhe nem devolve a mão aberta.
 *
 * O cursor da TELA, com o mouse parado: o Pixi só recalcula o cursor do canvas
 * quando o mouse anda, então a mão fecha no aperto e abre no soltar sem esperar
 * movimento, e fica fechada o arrasto inteiro, mesmo fora de cima da ficha.
 *
 * Mesmo arnês de `PlayerView.borda.test.tsx`: o `Application` sem WebGL e o
 * texto com caixa fixa; o dedo entra pelo palco do Pixi.
 */

/** O palco e o canvas de cada Application criado: o `pointercancel` chega pelo canvas, como no navegador. */
const tela = vi.hoisted((): { palcos: Container[]; canvases: HTMLCanvasElement[] } => ({ palcos: [], canvases: [] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
    readonly ticker = { add: () => {}, remove: () => {} }
    readonly canvas = document.createElement('canvas')
    constructor() {
      tela.palcos.push(this.stage)
      tela.canvases.push(this.canvas)
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

const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null }
/** Quanto a ficha agarrada cresce (o mesmo número da PlayerView). */
const AGARRADA = 1.08

function quadrado(lado: number): RegionPoint[][] {
  return [
    [
      { x: 0, y: 0 },
      { x: lado, y: 0 },
      { x: lado, y: lado },
      { x: 0, y: lado },
    ],
  ]
}

function salao(tokens: Token[] = [ANA]): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, 40), tokens }
}

function base(map: MapData): Props {
  return {
    map,
    vision: quadrado(1000),
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

/**
 * O MOUSE e o cursor da tela. O Pixi põe no canvas o `cursor` do EventBoundary
 * raiz no fim de cada evento de ponteiro, e todo evento do mouse sai dele
 * (`event.manager`). No movimento, ele recalcula esse cursor pelo objeto sob o
 * ponteiro ANTES de avisar o `globalpointermove`; no aperto e no soltar, não
 * recalcula. Aqui o boundary é um só por teste, como o raiz do Pixi, e o cursor
 * dele é o que a tela mostra.
 */
function mouse(raiz: EventBoundary, p: Ponto, alvo: Container | undefined): FederatedPointerEvent {
  const e = new FederatedPointerEvent(raiz)
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.button = 0
  e.global.set(p.x, p.y)
  // Sem alvo: nada sob o ponteiro, como o Pixi entrega o soltar fora do canvas.
  if (alvo !== undefined) e.target = alvo
  return e
}

/** O mouse anda até `p`, sobre `alvo`: o Pixi põe na tela o cursor do alvo (a seta, se ele não pede nenhum) e só depois avisa o palco. */
function moverMouse(raiz: EventBoundary, p: Ponto, alvo: Container): void {
  act(() => {
    raiz.cursor = alvo.cursor ?? 'default'
    palco().emit('globalpointermove', mouse(raiz, p, alvo))
  })
}

/** Aperta o botão com o mouse parado sobre a ficha: captura no palco, a ficha, e a subida até o palco se ninguém parou. */
function apertarNaFicha(raiz: EventBoundary, p: Ponto): void {
  const e = mouse(raiz, p, fichaDaAna())
  act(() => {
    palco().emit('pointerdowncapture', e)
    if (e.propagationStopped) return
    fichaDaAna().emit('pointerdown', e)
    if (!e.propagationStopped) palco().emit('pointerdown', e)
  })
}

/** Solta o botão com o mouse parado sobre `alvo`. */
function soltarMouse(raiz: EventBoundary, p: Ponto, alvo: Container): void {
  act(() => {
    palco().emit('pointerup', mouse(raiz, p, alvo))
  })
}

/** Solta o botão fora do canvas (sobre o painel, ou fora da janela): o Pixi avisa `pointerupoutside`, sem nada sob o ponteiro. */
function soltarMouseForaDoCanvas(raiz: EventBoundary, p: Ponto): void {
  act(() => {
    palco().emit('pointerupoutside', mouse(raiz, p, undefined))
  })
}

/** Tamanho e cursor da ficha agora. */
function pegada(): { escala: number; cursor: string | undefined } {
  const ficha = fichaDaAna()
  // Crescer é por igual nos dois eixos: um eixo só achataria o disco.
  expect(ficha.scale.y).toBe(ficha.scale.x)
  return { escala: ficha.scale.x, cursor: ficha.cursor }
}

const AGARRADA_NA_MAO = { escala: AGARRADA, cursor: 'grabbing' }
const SOLTA = { escala: 1, cursor: 'grab' }

describe('PlayerView — pegar a própria ficha dá sinal de que pegou', () => {
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
    tela.canvases.length = 0
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    vi.unstubAllGlobals()
  })

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  async function monta(props: Props): Promise<void> {
    await mostra(props)
    await vi.waitFor(() => {
      const el = raiz.firstElementChild
      expect(el instanceof HTMLElement ? el.dataset.tokensCount : undefined).toBe(String(props.map.tokens.length))
    })
  }

  it('solta no mapa, a ficha tem o tamanho normal e a mão aberta', async () => {
    await monta(base(salao()))
    expect(pegada()).toEqual(SOLTA)
  })

  it('encostar o dedo: a ficha cresce e o cursor vira a mão fechada, já no toque, antes de andar', async () => {
    await monta(base(salao()))
    encostarNaFicha(naTela(ANA))
    expect(pegada()).toEqual(AGARRADA_NA_MAO)
  })

  it('arrastar e soltar em outro lugar: volta ao tamanho e à mão aberta', async () => {
    const onMove = vi.fn()
    await monta({ ...base(salao()), onMove })
    const onde = naTela(ANA)
    encostarNaFicha(onde)
    arrastar({ x: onde.x + 60, y: onde.y })
    expect(pegada()).toEqual(AGARRADA_NA_MAO)
    soltar({ x: onde.x + 60, y: onde.y })
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(pegada()).toEqual(SOLTA)
  })

  it('um toque sem andar (soltar no lugar): volta também', async () => {
    const onMove = vi.fn()
    await monta({ ...base(salao()), onMove })
    const onde = naTela(ANA)
    encostarNaFicha(onde)
    soltar(onde)
    expect(onMove).not.toHaveBeenCalled()
    expect(pegada()).toEqual(SOLTA)
  })

  it('o segundo dedo faz pinça e larga a ficha: ela volta ao tamanho', async () => {
    await monta(base(salao()))
    encostarNaFicha(naTela(ANA))
    act(() => {
      palco().emit('pointerdowncapture', dedo(2, { x: 100, y: 100 }, false))
    })
    expect(pegada()).toEqual(SOLTA)
  })

  it('o sistema cancela o toque (pointercancel): ela volta ao tamanho', async () => {
    await monta(base(salao()))
    encostarNaFicha(naTela(ANA))
    const canvas = tela.canvases.at(-1)
    if (canvas === undefined) throw new Error('a PlayerView não criou o canvas')
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'touch' }))
    })
    expect(pegada()).toEqual(SOLTA)
  })

  it('um snapshot no meio do arrasto não encolhe a ficha nem devolve a mão aberta', async () => {
    const props = base(salao())
    await monta(props)
    const onde = naTela(ANA)
    encostarNaFicha(onde)
    arrastar({ x: onde.x + 40, y: onde.y })
    // O mestre manda o mapa de novo (outro objeto, a mesma ficha): a posse é reaplicada a cada snapshot.
    await mostra({ ...props, map: salao([{ ...ANA }]) })
    expect(pegada()).toEqual(AGARRADA_NA_MAO)
  })

  it('a ficha some do pacote no meio do arrasto e o dedo solta: a view guardada volta ao tamanho', async () => {
    const props = base(salao())
    await monta(props)
    const onde = naTela(ANA)
    encostarNaFicha(onde)
    await mostra({ ...props, map: salao([]) })
    soltar(onde)
    expect(pegada()).toEqual(SOLTA)
  })

  it('com o sistema pedindo menos movimento, só o cursor muda', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await monta(base(salao()))
    encostarNaFicha(naTela(ANA))
    expect(pegada()).toEqual({ escala: 1, cursor: 'grabbing' })
  })

  describe('o cursor que a tela mostra, com o mouse parado', () => {
    it('apertar sobre a ficha já mostra a mão fechada, sem esperar o mouse andar', async () => {
      const raiz = new EventBoundary()
      await monta(base(salao()))
      const onde = naTela(ANA)
      moverMouse(raiz, onde, fichaDaAna())
      expect(raiz.cursor).toBe('grab')
      apertarNaFicha(raiz, onde)
      expect(raiz.cursor).toBe('grabbing')
    })

    it('um clique sem andar: a mão fecha no aperto e abre no soltar', async () => {
      const raiz = new EventBoundary()
      await monta(base(salao()))
      const onde = naTela(ANA)
      moverMouse(raiz, onde, fichaDaAna())
      apertarNaFicha(raiz, onde)
      expect(raiz.cursor).toBe('grabbing')
      soltarMouse(raiz, onde, fichaDaAna())
      expect(raiz.cursor).toBe('grab')
    })

    it('arrastar e soltar com o mouse parado no fim: a mão abre já, sem esperar o mouse andar', async () => {
      const raiz = new EventBoundary()
      const onMove = vi.fn()
      await monta({ ...base(salao()), onMove })
      const onde = naTela(ANA)
      const destino = { x: onde.x + 60, y: onde.y }
      moverMouse(raiz, onde, fichaDaAna())
      apertarNaFicha(raiz, onde)
      // A ficha segue o mouse: o Pixi a acha sob ele, de mão fechada.
      moverMouse(raiz, destino, fichaDaAna())
      expect(raiz.cursor).toBe('grabbing')
      soltarMouse(raiz, destino, fichaDaAna())
      expect(onMove).toHaveBeenCalledTimes(1)
      expect(raiz.cursor).toBe('grab')
    })

    it('o mouse sai de cima da ficha no arrasto: a mão continua fechada, e soltar no chão mostra a seta', async () => {
      const raiz = new EventBoundary()
      await monta(base(salao()))
      const onde = naTela(ANA)
      const longe = { x: onde.x + 300, y: onde.y }
      moverMouse(raiz, onde, fichaDaAna())
      apertarNaFicha(raiz, onde)
      // A ficha parou no alcance, ou o mouse correu na frente dela: o Pixi acha o palco sob o ponteiro.
      moverMouse(raiz, longe, palco())
      expect(raiz.cursor).toBe('grabbing')
      soltarMouse(raiz, longe, palco())
      expect(raiz.cursor).toBe('default')
    })

    it('soltar fora do canvas: a ficha volta ao tamanho e a mão não fica fechada', async () => {
      const raiz = new EventBoundary()
      await monta(base(salao()))
      const onde = naTela(ANA)
      moverMouse(raiz, onde, fichaDaAna())
      apertarNaFicha(raiz, onde)
      moverMouse(raiz, { x: onde.x + 40, y: onde.y }, fichaDaAna())
      soltarMouseForaDoCanvas(raiz, { x: -20, y: -20 })
      expect(pegada()).toEqual(SOLTA)
      expect(raiz.cursor).not.toBe('grabbing')
    })

    it('com o sistema pedindo menos movimento, o aperto também mostra a mão fechada na hora', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      const raiz = new EventBoundary()
      await monta(base(salao()))
      const onde = naTela(ANA)
      moverMouse(raiz, onde, fichaDaAna())
      apertarNaFicha(raiz, onde)
      expect(raiz.cursor).toBe('grabbing')
      expect(pegada()).toEqual({ escala: 1, cursor: 'grabbing' })
    })
  })
})
