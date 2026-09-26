import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Graphics } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import type { SharedRoute } from './playerConnection'

/**
 * MOSTRAR UM CAMINHO COM A RÉGUA na PlayerView MONTADA: a costura que põe algo
 * na tela. Quem mede solta a régua e a PlayerView avisa os dois pontos de
 * mundo (`onMeasureSettle`, que acende "Mostrar a…" em `main.tsx`); quem
 * recebe vê o caminho do colega tracejado na cor dele, com a etiqueta
 * "caminho do …" perto da chegada, e ele some quando o caminho sai.
 *
 * Mesmo arranjo sem navegador de `PlayerView.pinca.test.tsx`: só o
 * `Application` (WebGL) e a medida do texto são trocados; o ticker é do teste.
 */

const tela = vi.hoisted(() => ({ palcos: [] as Container[], quadros: [] as Array<() => void> }))

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
    readonly ticker = {
      add: (quadro: () => void) => {
        tela.quadros.push(quadro)
      },
      remove: (quadro: () => void) => {
        const k = tela.quadros.indexOf(quadro)
        if (k >= 0) tela.quadros.splice(k, 1)
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
  return { ...pixi, Application: ApplicationSemGpu, Text: TextSemMedida }
})

type Ponto = { x: number; y: number }
type Props = Parameters<typeof PlayerView>[0]

const GRADE = 40
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null }
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const COR_DO_GUI = '#ff8800'
/** Vértices da grade: a régua gruda neles, então o ponto avisado é exatamente este. */
const INICIO: Ponto = { x: 200, y: 200 }
const FIM: Ponto = { x: 600, y: 200 }

function salao(): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, GRADE), tokens: [ANA] }
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

/**
 * A camada do caminho do colega: logo abaixo da régua
 * (`addChild(world, revisit, personalNotes, pulse, route, measure, …)`). A
 * revisita e as anotações pessoais (outras features) entraram antes dela.
 */
function camadaDoCaminho(): Graphics {
  const camada = palco().children[4]
  if (!(camada instanceof Graphics)) throw new Error('a PlayerView não montou a camada do caminho')
  return camada
}

function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

function mouse(p: Ponto): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'mouse'
  e.pointerId = 1
  e.isPrimary = true
  e.global.set(p.x, p.y)
  return e
}

function apertar(p: Ponto): void {
  act(() => {
    palco().emit('pointerdowncapture', mouse(p))
    palco().emit('pointerdown', mouse(p))
  })
}

function arrastar(p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', mouse(p))
  })
}

function soltar(p: Ponto): void {
  act(() => {
    palco().emit('pointerup', mouse(p))
  })
}

function quadro(): void {
  act(() => {
    for (const q of [...tela.quadros]) q()
  })
}

/** Cores e quantidade de traços (moveTo) de cada `stroke` da camada. */
function tracos(g: Graphics): Array<{ color: unknown; dashes: number }> {
  return g.context.instructions.flatMap((i) =>
    i.action === 'stroke' ? [{ color: i.data.style.color, dashes: i.data.path.instructions.filter((p) => p.action === 'moveTo').length }] : [],
  )
}

describe('PlayerView — caminho da régua para o colega', () => {
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
    vi.restoreAllMocks()
  })

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  function etiquetaDoCaminho(): HTMLElement {
    const el = raiz.querySelector('.pp-route-label')
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não pôs a etiqueta do caminho')
    return el
  }

  async function mostra(extra: Partial<Props>): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView
          map={salao()}
          vision={VISAO}
          ownTokens={[ANA.id]}
          settings={DEFAULT_PLAYER_SETTINGS}
          focusTokenId={null}
          focusSeq={0}
          onMove={() => {}}
          {...extra}
        />,
      )
    })
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe('1'))
  }

  it('régua solta avisa os dois pontos de mundo; durante o arrasto, não', async () => {
    const onMeasureSettle = vi.fn<(points: RegionPoint[] | null) => void>()
    await mostra({ measureArmed: true, onMeasureSettle })
    quadro()
    // O primeiro quadro diz "sem medida": a tela de cima esquece a de antes.
    expect(onMeasureSettle.mock.calls).toEqual([[null]])

    apertar(naTela(INICIO))
    arrastar(naTela(FIM))
    quadro()
    // Dedo ainda na tela: nada de "Mostrar a…" com um traço pela metade.
    expect(onMeasureSettle).toHaveBeenCalledTimes(1)

    soltar(naTela(FIM))
    expect(onMeasureSettle).toHaveBeenLastCalledWith([INICIO, FIM])
    expect(onMeasureSettle).toHaveBeenCalledTimes(2)
    // O ticker passa de novo sem medida nova: sem aviso repetido.
    quadro()
    expect(onMeasureSettle).toHaveBeenCalledTimes(2)
  })

  it('um toque novo tira a medida solta; toque sem arrastar não é caminho', async () => {
    const onMeasureSettle = vi.fn<(points: RegionPoint[] | null) => void>()
    await mostra({ measureArmed: true, onMeasureSettle })
    apertar(naTela(INICIO))
    arrastar(naTela(FIM))
    soltar(naTela(FIM))
    expect(onMeasureSettle).toHaveBeenLastCalledWith([INICIO, FIM])

    apertar(naTela(FIM))
    expect(onMeasureSettle).toHaveBeenLastCalledWith(null)
    soltar(naTela(FIM))
    expect(onMeasureSettle).toHaveBeenLastCalledWith(null)
    expect(onMeasureSettle.mock.calls.filter(([p]) => p !== null)).toHaveLength(1)
  })

  it('o caminho do colega aparece tracejado na cor dele, com a etiqueta perto da chegada; sai quando o caminho sai', async () => {
    const caminho: SharedRoute = { id: 7, from: 'Gui', color: COR_DO_GUI, points: [INICIO, FIM] }
    await mostra({ sharedRoute: caminho })
    quadro()

    // Sombra, linha e o anel da chegada; sombra e linha cortadas em vários pedaços.
    const desenho = tracos(camadaDoCaminho())
    expect(desenho).toHaveLength(3)
    expect(desenho[1]?.color).toBe(0xff8800)
    expect(desenho[1]?.dashes).toBeGreaterThan(4)
    expect(desenho[0]?.dashes).toBe(desenho[1]?.dashes)
    expect(desenho[2]?.color).toBe(0xff8800)

    const etiqueta = etiquetaDoCaminho()
    expect(etiqueta.hidden).toBe(false)
    expect(etiqueta.textContent).toBe('caminho do Gui')
    expect(etiqueta.style.borderColor).not.toBe('')
    const chegada = naTela(FIM)
    expect(etiqueta.style.transform).toMatch(/^translate\(/)
    const [x, y] = (etiqueta.style.transform.match(/-?\d+/g) ?? []).map(Number)
    expect(x).toBeGreaterThanOrEqual(Math.round(chegada.x))
    expect(y).toBeGreaterThanOrEqual(Math.round(chegada.y))
    expect(conteiner().dataset.sharedRoutePoints).toBe('2')

    await mostra({ sharedRoute: undefined })
    quadro()
    expect(tracos(camadaDoCaminho())).toEqual([])
    expect(etiqueta.hidden).toBe(true)
    expect(etiqueta.textContent).toBe('')
  })

  it('o caminho acompanha a câmera: outro zoom repinta nas novas posições de tela', async () => {
    const caminho: SharedRoute = { id: 1, from: 'Gui', color: COR_DO_GUI, points: [INICIO, FIM] }
    await mostra({ sharedRoute: caminho })
    quadro()
    const antes = etiquetaDoCaminho().style.transform
    expect(antes).toMatch(/^translate\(/)

    await mostra({ sharedRoute: caminho, zoomStep: { direction: 1, animate: false, seq: 1 } })
    quadro()
    expect(etiquetaDoCaminho().style.transform).not.toBe(antes)
    expect(tracos(camadaDoCaminho())).toHaveLength(3)
  })
})
