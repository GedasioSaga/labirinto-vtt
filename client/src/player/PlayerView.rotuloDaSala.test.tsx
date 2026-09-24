import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, EventBoundary, FederatedPointerEvent, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import { estimateRoomLabelTextWidth, roomLabelFontSize, roomLabelPlateSize } from '../pixi/drawRoomNames'
import type { MapData, Region, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * NOME DA SALA DEBAIXO DA FICHA, na PlayerView montada — simulação de 7
 * jogadores, cenário vila*: o Ladino parado no meio do Quarto do Prefeito
 * tapava o nome da sala (a camada das fichas fica por cima da dos nomes). A
 * conta do lugar do nome tem prova própria em `pixi/drawRoomNames.ficha.test.ts`;
 * aqui a prova é a COSTURA: as fichas que chegam no pacote viram obstáculo do
 * nome no `world` de verdade, e o toque no nome (que reabre o texto da sala)
 * acha o nome onde ele está desenhado, e não onde ele estava.
 *
 * Mesmo palco sem GPU de `PlayerView.notas.test.tsx`: o `Application` falso (o
 * jsdom não tem WebGL) e o texto com caixa fixa (o jsdom não mede).
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
const NOME_DA_SALA = 'Quarto do Prefeito'
/** 10 x 7 quadrados; o meio (centróide) cai em (400, 340). */
const QUARTO: Region = {
  id: 'quarto',
  points: [
    { x: 200, y: 200 },
    { x: 600, y: 200 },
    { x: 600, y: 480 },
    { x: 200, y: 480 },
  ],
  tag: '',
  fillColor: '#2f5d50',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: NOME_DA_SALA, textoAoEntrar: 'Cheiro de tabaco e cera de vela.' },
}
const MEIO_DO_QUARTO: Ponto = { x: 400, y: 340 }
const TOPO_DO_QUARTO = 200
/** Raio da ficha de tamanho 1 na grade de 40 (`tokenRadius` da PlayerView). */
const RAIO = GRADE / 2

function ladinoEm(p: Ponto): Token {
  return { id: 'tok-ladino', characterId: null, name: 'Ladino', x: p.x, y: p.y, size: 1, image: null, color: '#9ca3af' }
}

function vila(ladino: Ponto): MapData {
  return { ...createEmptyMap('m-vila', '', 25, 25, GRADE), regions: [QUARTO], tokens: [ladinoEm(ladino)] }
}

const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]

function palco(): Container {
  const p = tela.palcos.at(-1)
  if (p === undefined) throw new Error('a PlayerView não criou o Application')
  return p
}

/** O `world` do jogador: o primeiro filho do palco. */
function mundo(): Container {
  const world = palco().children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** Todo `Text` pendurado no mundo, em qualquer profundidade. */
function textos(no: Container): Text[] {
  const achados: Text[] = []
  for (const filho of no.children) {
    if (filho instanceof Text) achados.push(filho)
    else if (filho instanceof Container) achados.push(...textos(filho))
  }
  return achados
}

function textoNoMundo(conteudo: string): Text {
  const achado = textos(mundo()).find((t) => t.text === conteudo)
  if (achado === undefined) throw new Error(`"${conteudo}" não está desenhado no mundo`)
  return achado
}

/** Caixa (mundo) da plaquinha do nome da sala desenhada em `centro`, pela régua larga do próprio renderer. */
function plaquinha(centro: Ponto): { minX: number; minY: number; maxX: number; maxY: number } {
  const fonte = roomLabelFontSize(GRADE)
  const { width, height } = roomLabelPlateSize(estimateRoomLabelTextWidth(NOME_DA_SALA, fonte), fonte)
  return { minX: centro.x - width / 2, minY: centro.y - height / 2, maxX: centro.x + width / 2, maxY: centro.y + height / 2 }
}

function naTela(p: Ponto): Ponto {
  const w = mundo()
  return { x: w.x + p.x * w.scale.x, y: w.y + p.y * w.scale.y }
}

function dedo(p: Ponto): FederatedPointerEvent {
  const e = new FederatedPointerEvent(new EventBoundary())
  e.pointerType = 'touch'
  e.pointerId = 1
  e.isPrimary = true
  e.global.set(p.x, p.y)
  return e
}

/** Toque curto e parado, do jeito do dedo: encosta e solta no mesmo ponto. */
function tocar(p: Ponto): void {
  act(() => {
    palco().emit('pointerdowncapture', dedo(p))
    palco().emit('pointerdown', dedo(p))
  })
  act(() => {
    palco().emit('pointerup', dedo(p))
  })
}

describe('PlayerView — o nome da sala sai de baixo da ficha', () => {
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  function base(map: MapData, extra: Partial<Props> = {}): Props {
    return { map, vision: VISAO, ownTokens: [], settings: DEFAULT_PLAYER_SETTINGS, focusTokenId: null, focusSeq: 0, onMove: () => {}, ...extra }
  }

  async function mostra(props: Props): Promise<void> {
    await act(async () => {
      root.render(<PlayerView {...props} />)
    })
  }

  /** Primeiro snapshot: espera o `setup` assíncrono chegar ao primeiro desenho. */
  async function monta(props: Props): Promise<void> {
    await mostra(props)
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe('1'))
  }

  it('Ladino parado no meio do Quarto do Prefeito: o nome sobe para a borda de cima e os dois nomes ficam à vista', async () => {
    await monta(base(vila(MEIO_DO_QUARTO)))

    const nomeDaSala = textoNoMundo(NOME_DA_SALA)
    const nomeDaFicha = textoNoMundo('Ladino')
    expect(nomeDaSala.visible).toBe(true)
    expect(nomeDaFicha.visible).toBe(true)

    const placa = plaquinha(nomeDaSala.position)
    // Na coluna do meio, dentro da sala, e inteira ACIMA do disco do Ladino (o nome dele fica embaixo do disco).
    expect(nomeDaSala.position.x).toBe(MEIO_DO_QUARTO.x)
    expect(placa.minY).toBeGreaterThan(TOPO_DO_QUARTO)
    expect(placa.maxY).toBeLessThan(MEIO_DO_QUARTO.y - RAIO)
    const topoDoNomeDaFicha = (nomeDaFicha.parent?.y ?? 0) + nomeDaFicha.y
    expect(topoDoNomeDaFicha).toBeGreaterThan(MEIO_DO_QUARTO.y + RAIO)
  })

  it('o toque segue o nome: tocar onde ele está agora reabre o texto da sala; tocar na ficha, onde ele estava, não', async () => {
    const onRoomOpen = vi.fn()
    await monta(base(vila(MEIO_DO_QUARTO), { onRoomOpen }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    tocar(naTela(MEIO_DO_QUARTO))
    expect(onRoomOpen).not.toHaveBeenCalled()

    tocar(naTela(textoNoMundo(NOME_DA_SALA).position))
    expect(onRoomOpen).toHaveBeenCalledTimes(1)
    expect(onRoomOpen).toHaveBeenCalledWith('quarto')
  })

  it('o Ladino anda para o canto: o nome volta para o meio da sala, no mesmo Text', async () => {
    await monta(base(vila(MEIO_DO_QUARTO)))
    const nomeDaSala = textoNoMundo(NOME_DA_SALA)
    expect(nomeDaSala.position.y).not.toBe(MEIO_DO_QUARTO.y)

    await mostra(base(vila({ x: 260, y: 440 })))
    expect(textoNoMundo(NOME_DA_SALA)).toBe(nomeDaSala)
    expect(nomeDaSala.position.x).toBe(MEIO_DO_QUARTO.x)
    expect(nomeDaSala.position.y).toBe(MEIO_DO_QUARTO.y)
  })
})
