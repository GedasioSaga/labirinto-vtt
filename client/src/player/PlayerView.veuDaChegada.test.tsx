import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { theme } from '../theme'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * VÉU DA CHEGADA na PlayerView montada: o mapa troca (viagem, "o mestre levou
 * você", outro andar ao vivo) e um véu escuro cobre a tela no mesmo instante e
 * some em `theme.motion.base` — o lugar novo surge em vez de saltar de um
 * quadro para o outro.
 *
 * Fica sem véu: a primeira cena (entrar no jogo), o snapshot novo do mesmo
 * mapa, olhar outro andar pelas abas (a `arrivalKey` não muda: a aba troca na
 * hora pelas setas do teclado), quem pediu menos movimento e o espelho do mestre.
 * A chegada que não troca o mapa na tela (ao andar cuja memória ele já olhava,
 * ou levado enquanto olhava outro) também fica sem véu, mas fica registrada: a
 * troca de aba seguinte não pode tocar o véu de uma chegada velha.
 *
 * O jsdom não tem Web Animations: o teste põe um `animate` espião no
 * HTMLElement e lê o que a tela pediu a ele — e onde a câmera estava nessa hora.
 */

const tela = vi.hoisted((): { palcos: Container[] } => ({ palcos: [] }))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  class TextSemMedida extends pixi.Text {
    protected override updateBounds(): void {
      this._bounds.set(0, 0, 40, 14)
    }
  }
  class ApplicationSemGpu {
    readonly stage = new pixi.Container()
    readonly screen = new pixi.Rectangle(0, 0, 800, 600)
    readonly renderer = { resolution: 1 }
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
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

type Props = Parameters<typeof PlayerView>[0]

/** O que a tela pediu ao `animate`, e a câmera do `world` no instante do pedido. */
interface PedidoDeVeu {
  alvo: HTMLElement
  quadros: Keyframe[]
  tempo: KeyframeAnimationOptions
  camera: { x: number; y: number; escala: number }
}

const EVA: Token = { id: 'tok-eva', characterId: null, name: 'Eva', x: 120, y: 120, size: 1, image: null }

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

/** Cenas de tamanhos diferentes: o enquadramento de cada uma é outro, e a câmera muda na troca. */
function cena(id: string, colunas: number, eva: Token = EVA): MapData {
  return { ...createEmptyMap(id, '', colunas, colunas, 40), tokens: [eva] }
}

const SALAO = cena('m-salao', 25)
const PORAO = cena('m-porao', 10)

function base(map: MapData): Props {
  return {
    map,
    vision: quadrado(1000),
    ownTokens: [EVA.id],
    settings: DEFAULT_PLAYER_SETTINGS,
    focusTokenId: null,
    focusSeq: 0,
    onMove: () => {},
  }
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

describe('PlayerView — véu curto na troca de cena, em vez do corte seco', () => {
  let raiz: HTMLDivElement
  let root: Root
  let pedidos: PedidoDeVeu[]

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
    pedidos = []
    Reflect.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function animarEspiao(this: HTMLElement, quadros: Keyframe[], tempo: KeyframeAnimationOptions) {
        const w = mundo()
        pedidos.push({ alvo: this, quadros, tempo, camera: { x: w.x, y: w.y, escala: w.scale.x } })
        return { cancel: () => {}, finish: () => {} }
      },
    })
    raiz = document.createElement('div')
    document.body.appendChild(raiz)
    root = createRoot(raiz)
  })

  afterEach(() => {
    act(() => root.unmount())
    raiz.remove()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    vi.unstubAllGlobals()
  })

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  /** Primeiro desenho: espera o `setup` assíncrono (o `init` do Application) chegar ao primeiro redraw. */
  async function monta(props: Props): Promise<void> {
    await mostra(props)
    await vi.waitFor(() => {
      const el = raiz.firstElementChild
      expect(el instanceof HTMLElement ? el.dataset.tokensCount : undefined).toBe('1')
    })
  }

  function veu(): HTMLElement | null {
    return raiz.querySelector<HTMLElement>('[data-testid="map-veil"]')
  }

  it('entrar no jogo (a primeira cena) não ganha véu; o véu nasce transparente, mudo para o leitor de tela e sem pegar toque', async () => {
    await monta(base(SALAO))
    expect(pedidos).toHaveLength(0)
    const el = veu()
    expect(el, 'a tela do mapa deveria ter o véu montado, pronto para a troca').not.toBeNull()
    expect(el?.getAttribute('aria-hidden')).toBe('true')
    expect(el?.style.opacity).toBe('0')
    expect(el?.style.pointerEvents).toBe('none')
    expect(el?.style.position).toBe('fixed')
  })

  it('viagem para outra cena: o véu cobre de uma vez e some em theme.motion.base, com theme.motion.ease, já sobre a câmera da cena nova', async () => {
    await monta(base(SALAO))
    const noSalao = { x: mundo().x, y: mundo().y, escala: mundo().scale.x }

    await mostra(base(PORAO))
    expect(pedidos).toHaveLength(1)
    const [pedido] = pedidos
    expect(pedido?.alvo).toBe(veu())
    expect(pedido?.quadros).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(pedido?.tempo).toEqual({ duration: Number.parseFloat(theme.motion.base), easing: theme.motion.ease })
    // O primeiro quadro coberto já é o do lugar novo, enquadrado: a câmera mudou ANTES do véu.
    const noPorao = { x: mundo().x, y: mundo().y, escala: mundo().scale.x }
    expect(noPorao).not.toEqual(noSalao)
    expect(pedido?.camera).toEqual(noPorao)
  })

  it('snapshot novo do MESMO mapa (a ficha andou) não ganha véu', async () => {
    await monta(base(SALAO))
    await mostra(base(cena('m-salao', 25, { ...EVA, x: 400, y: 400 })))
    expect(pedidos).toHaveLength(0)
  })

  it('olhar outro andar pelas abas (a mesma chegada) não ganha véu; chegar a outro andar de verdade, sim', async () => {
    const terreo = cena('m-terreo', 25)
    const subsolo = cena('m-subsolo', 10)
    await monta({ ...base(terreo), arrivalKey: 'm-terreo' })
    // A aba do subsolo: a memória dele, com a chegada ainda no térreo.
    await mostra({ ...base(subsolo), arrivalKey: 'm-terreo' })
    // E de volta ao térreo ao vivo.
    await mostra({ ...base(terreo), arrivalKey: 'm-terreo' })
    expect(pedidos).toHaveLength(0)
    // Desceu a escada: o mapa ao vivo agora é o subsolo.
    await mostra({ ...base(subsolo), arrivalKey: 'm-subsolo' })
    expect(pedidos).toHaveLength(1)
  })

  it('chegar ao andar cuja memória já estava na tela (o mapa não troca) fica registrado: a troca de aba seguinte, pelas setas, não ganha véu', async () => {
    const terreo = cena('m-terreo', 25)
    await monta({ ...base(terreo), arrivalKey: 'm-terreo' })
    // A aba do subsolo: a memória dele, com o mesmo id do subsolo ao vivo.
    await mostra({ ...base(cena('m-subsolo', 10)), arrivalKey: 'm-terreo' })
    // O mestre leva a ficha ao subsolo: a tela passa ao subsolo ao vivo, e o mapa (o id) não troca.
    await mostra({ ...base(cena('m-subsolo', 10, { ...EVA, x: 200, y: 200 })), arrivalKey: 'm-subsolo' })
    // Seta do teclado na aba do térreo: a memória dele. Ninguém chegou a lugar nenhum.
    await mostra({ ...base(terreo), arrivalKey: 'm-subsolo' })
    expect(pedidos).toHaveLength(0)
  })

  it('a chegada que só muda a chave (ele olhava a memória de outro andar, e a aba ficou nela): fica registrada, e voltar pela aba não ganha véu', async () => {
    await monta({ ...base(cena('m-terreo', 25)), arrivalKey: 'm-terreo' })
    // As props da memória são as mesmas nos dois desenhos: só a chave da chegada muda.
    const memoriaDoSubsolo = base(cena('m-subsolo', 10))
    await mostra({ ...memoriaDoSubsolo, arrivalKey: 'm-terreo' })
    await mostra({ ...memoriaDoSubsolo, arrivalKey: 'm-sotao' })
    // Ele mesmo volta, pela aba, ao andar onde a ficha está agora.
    await mostra({ ...base(cena('m-sotao', 15)), arrivalKey: 'm-sotao' })
    expect(pedidos).toHaveLength(0)
  })

  it('com o sistema pedindo menos movimento, a troca fica seca, como antes', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await monta(base(SALAO))
    await mostra(base(PORAO))
    expect(pedidos).toHaveLength(0)
  })

  it('no espelho do mestre (Ver tela) não há véu: ele é fixo na janela, e o espelho é um quadro dentro da tela do mestre', async () => {
    await monta({ ...base(SALAO), mirror: true })
    expect(veu()).toBeNull()
    await mostra({ ...base(PORAO), mirror: true })
    expect(pedidos).toHaveLength(0)
  })
})
