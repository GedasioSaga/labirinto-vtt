import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { SIGNAL_LONG_PRESS_MS } from '../lib/signals'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import type { PersonalNote } from './personalNotes'
import { PlayerView } from './PlayerView'

/**
 * ANOTAÇÃO PESSOAL NA PlayerView MONTADA — a parte do Pixi que faz a nota
 * existir no mapa: o toque com "Anotar" ligado vira ponto de mundo, o toque
 * longo sobre a nota vira "apagar" (e não o sinal ao mestre), o ticker desenha
 * as notas à vista, e "Minhas notas" leva a câmera até a nota.
 *
 * `main.notas.test.tsx` troca a PlayerView inteira por botões; aqui ela é a de
 * verdade, no mesmo palco sem GPU de `PlayerView.pinca.test.tsx`: o
 * `Application` falso (o jsdom não tem WebGL), o texto com caixa fixa (o jsdom
 * não mede), e o ticker e o relógio do teste.
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
/** O meio da tela de 800 x 600 (sem painel cobrindo nada): onde "Minhas notas" põe a nota. */
const CENTRO: Ponto = { x: tela.largura / 2, y: tela.altura / 2 }

/** Duas notas longe da Ana, dentro do salão enquadrado, e uma fora do mapa (fora da tela). */
const BAU: PersonalNote = { id: 'nota-bau', mapId: 'm-salao', x: 300, y: 300, text: 'Baú trancado' }
const ARMADILHA: PersonalNote = { id: 'nota-armadilha', mapId: 'm-salao', x: 200, y: 800, text: 'Armadilha' }
const LONGE: PersonalNote = { id: 'nota-longe', mapId: 'm-salao', x: -1000, y: 300, text: 'Fora da tela' }

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

const BASE: Props = {
  map: salao(),
  vision: quadrado(1000, 1000),
  ownTokens: [ANA.id],
  settings: DEFAULT_PLAYER_SETTINGS,
  focusTokenId: null,
  focusSeq: 0,
  onMove: () => {},
}

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, personalNotesLayer, …)`). */
function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** A camada das anotações: o segundo filho do palco, em espaço de tela. */
function camadaDasNotas(): Container {
  const camada = palco().children[1]
  if (!(camada instanceof Container)) throw new Error('a PlayerView não montou a camada das notas')
  return camada
}

/** Os textos de nota que estão à vista agora, na ordem do desenho. */
function textosVisiveis(): string[] {
  return camadaDasNotas()
    .children.filter((filho): filho is Text => filho instanceof Text && filho.visible)
    .map((texto) => texto.text)
}

/** Onde um ponto do mundo aparece na tela agora. */
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

/** Um dedo encosta no chão (o próprio palco é o alvo: captura e alvo na mesma volta). */
function encostar(id: number, p: Ponto): void {
  const e = dedo(id, p, true)
  act(() => {
    palco().emit('pointerdowncapture', e)
    palco().emit('pointerdown', e)
  })
}

function arrastar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('globalpointermove', dedo(id, p, true))
  })
}

function soltar(id: number, p: Ponto): void {
  act(() => {
    palco().emit('pointerup', dedo(id, p, true))
  })
}

/** O dedo fica parado além do prazo do toque longo. */
function segurar(): void {
  act(() => {
    vi.advanceTimersByTime(SIGNAL_LONG_PRESS_MS + 50)
  })
}

describe('PlayerView — anotação pessoal no palco do Pixi', () => {
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
    vi.useRealTimers()
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

  /** Espera o `setup` assíncrono chegar ao fim (o último passo avisa os limites do zoom). */
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

  it('"Anotar" ligado: o toque marca o ponto em px de mundo — sem sinal, sem arrastar a câmera', async () => {
    const onNotePlace = vi.fn()
    const onSignal = vi.fn()
    await monta({ ...BASE, noteArmed: true, onNotePlace, onSignal })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const camera0 = { x: mundo().x, y: mundo().y, escala: mundo().scale.x }
    const alvo = naTela({ x: 300, y: 200 })

    encostar(1, alvo)
    expect(onNotePlace).toHaveBeenCalledTimes(1)
    expect(onNotePlace).toHaveBeenCalledWith(expect.closeTo(300, 6), expect.closeTo(200, 6))

    // Segurou parado além do prazo e depois arrastou: o toque já era da nota.
    segurar()
    arrastar(1, { x: alvo.x + 80, y: alvo.y + 60 })
    soltar(1, { x: alvo.x + 80, y: alvo.y + 60 })
    expect(onSignal).not.toHaveBeenCalled()
    expect(onNotePlace).toHaveBeenCalledTimes(1)
    expect(mundo().x).toBe(camera0.x)
    expect(mundo().y).toBe(camera0.y)
    expect(mundo().scale.x).toBe(camera0.escala)
  })

  it('toque longo em cima da própria nota: pede para apagar e não manda o sinal ao mestre', async () => {
    const onNoteLongPress = vi.fn()
    const onSignal = vi.fn()
    await monta({ ...BASE, personalNotes: [BAU, ARMADILHA], onNoteLongPress, onSignal })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Dedo a 5 px da nota: dentro do perdão do dedo (18 px de tela).
    const naNota = naTela(BAU)
    encostar(1, { x: naNota.x + 5, y: naNota.y })
    segurar()
    soltar(1, { x: naNota.x + 5, y: naNota.y })
    expect(onNoteLongPress).toHaveBeenCalledTimes(1)
    expect(onNoteLongPress).toHaveBeenCalledWith(BAU.id)
    expect(onSignal).not.toHaveBeenCalled()

    // Controle: o mesmo gesto no chão vazio continua sendo o sinal de sempre.
    const chao = naTela({ x: 700, y: 200 })
    encostar(2, chao)
    segurar()
    soltar(2, chao)
    expect(onSignal).toHaveBeenCalledTimes(1)
    expect(onNoteLongPress).toHaveBeenCalledTimes(1)
  })

  it('o ticker desenha as notas à vista (a fora da tela não), e acompanha a lista quando ela muda', async () => {
    await monta({ ...BASE, personalNotes: [BAU, ARMADILHA, LONGE] })
    quadro(16)
    expect(conteiner().dataset.personalNotesDrawn).toBe('2')
    expect(textosVisiveis()).toEqual([BAU.text, ARMADILHA.text])

    await mostra({ ...BASE, personalNotes: [ARMADILHA] })
    quadro(16)
    expect(conteiner().dataset.personalNotesDrawn).toBe('1')
    expect(textosVisiveis()).toEqual([ARMADILHA.text])

    // Apagou a última: nada fica na tela.
    await mostra({ ...BASE, personalNotes: [] })
    quadro(16)
    expect(conteiner().dataset.personalNotesDrawn).toBe('0')
    expect(textosVisiveis()).toEqual([])
  })

  it('"Minhas notas": um pedido novo centraliza a nota no zoom de agora; o mesmo pedido de novo não mexe', async () => {
    await monta(BASE)
    const escala0 = mundo().scale.x
    expect(distancia(naTela(ARMADILHA), CENTRO)).toBeGreaterThan(100)

    await mostra({ ...BASE, focusPoint: { x: ARMADILHA.x, y: ARMADILHA.y, seq: 1 } })
    expect(mundo().scale.x).toBe(escala0)
    // Um pixel de tela de folga: a posição do mundo encosta no pixel inteiro (pixelAlign.ts).
    expect(distancia(naTela(ARMADILHA), CENTRO)).toBeLessThan(1)

    // Re-render com o mesmo pedido (a lista de notas mudou, por exemplo): a câmera fica.
    const parada = { x: mundo().x, y: mundo().y }
    await mostra({ ...BASE, personalNotes: [BAU], focusPoint: { x: ARMADILHA.x, y: ARMADILHA.y, seq: 1 } })
    expect(mundo().x).toBe(parada.x)
    expect(mundo().y).toBe(parada.y)

    // Pedido novo, outra nota: vai até ela.
    await mostra({ ...BASE, personalNotes: [BAU], focusPoint: { x: BAU.x, y: BAU.y, seq: 2 } })
    expect(mundo().scale.x).toBe(escala0)
    expect(distancia(naTela(BAU), CENTRO)).toBeLessThan(1)
  })
})
