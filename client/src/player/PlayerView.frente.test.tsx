import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { FACING_NIB_COLOR, FACING_NIB_LENGTH_PX, facingLabelOffset, facingNibReach } from './facingMarker'
import { TOKEN_TURN_MS } from './tokenTurn'

/**
 * FRENTE DA FICHA, na TELA do jogador. `facingMarker.test.ts` prova o desenho
 * do bico e `tokenTurn.test.ts` o giro, cada um isolado; aqui a prova é a
 * COSTURA: a rotação que chega no pacote vira o bico branco na ficha certa da
 * PlayerView de verdade, apontando para onde o mestre a virou, girando quando
 * ele a vira de novo, e sumindo quando a ficha não tem frente.
 *
 * Sem navegador, e só o que o jsdom não tem é trocado, como em
 * `PlayerView.pinca.test.tsx`: o `Application` (pede WebGL) e a MEDIDA do
 * texto (sem canvas 2d; o nome da ficha ganha uma caixa fixa). O ticker é do
 * teste — cada quadro roda quando o teste pede — e o relógio também, então o
 * giro do bico fica parado exatamente onde o teste quer.
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

/** Guarita aberta, 1000 x 1000 px de mundo e sem parede: a Ana enxerga todo mundo. */
const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const ANA = 'ficha-ana'
const MINHAS = [ANA]
/** Raio do disco de uma ficha de 1 casa na grade de 40 px (`tokenRadius` da PlayerView). */
const RAIO = 20
/** Folga de sempre entre o disco e o nome, em px de mundo, na ficha sem frente. */
const NOME_COLADO = RAIO + 2

function ficha(id: string, nome: string, x: number, y: number, rotation?: number): Token {
  const token: Token = { id, characterId: null, name: nome, x, y, size: 1, image: null }
  if (rotation !== undefined) token.rotation = rotation
  return token
}

/**
 * A Ana (do jogador) virada para baixo, o guarda para a direita (ou para onde
 * o teste mandar; `null` = sem rotação), a sentinela com 0 grau GRAVADO (para
 * cima) e o mercador, que o mestre nunca virou: sem frente.
 */
function fichas(guarda: number | null = 90): Token[] {
  return [
    ficha(ANA, 'Ana', 200, 500, 180),
    ficha('guarda', 'Guarda', 500, 500, guarda ?? undefined),
    ficha('sentinela', 'Sentinela', 500, 250, 0),
    ficha('mercador', 'Mercador', 800, 500),
  ]
}

/** O mapa como o jogador o recebe: mesmo id em todo snapshot, então a câmera não reenquadra. */
function pacote(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-guarita', '', 25, 25, 40), tokens }
}

type Instrucao = Graphics['context']['instructions'][number]

function ehPreenchimentoDoBico(i: Instrucao): boolean {
  return i.action === 'fill' && i.data.style.color === FACING_NIB_COLOR && i.data.path.instructions.some((p) => p.action === 'poly')
}

/** O `world` do jogador: o primeiro filho do palco (`app.stage.addChild(world, …)`). */
function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

/** A camada das fichas é a última do mundo, acima da névoa. */
function camadaDasFichas(): Container {
  const camada = mundo().children.at(-1)
  if (!(camada instanceof Container)) throw new Error('a PlayerView não montou a camada das fichas')
  return camada
}

function nomeDa(ficha: Container): Text {
  const nome = ficha.children.find((c): c is Text => c instanceof Text)
  if (!nome) throw new Error('a ficha não tem nome')
  return nome
}

/** A ficha VISÍVEL que traz este nome: é por ele que o jogador a reconhece. */
function fichaChamada(nome: string): Container {
  const achada = camadaDasFichas().children.find((c): c is Container => c instanceof Container && c.visible && nomeDa(c).text === nome)
  if (!achada) throw new Error(`a ficha ${nome} não está na tela`)
  return achada
}

/** O bico desenhado e visível da ficha; `undefined` quando ela não mostra frente nenhuma. */
function bicoDa(ficha: Container): Graphics | undefined {
  return ficha.children.find((c): c is Graphics => c instanceof Graphics && c.visible && c.context.instructions.some(ehPreenchimentoDoBico))
}

/** Ponta do bico no espaço dele: o vértice do triângulo que fica no eixo. */
function pontaLocal(bico: Graphics): { x: number; y: number } {
  const preenchimento = bico.context.instructions.find(ehPreenchimentoDoBico)
  if (preenchimento?.action !== 'fill') throw new Error('o bico não tem preenchimento')
  const poly = preenchimento.data.path.instructions.find((p) => p.action === 'poly')
  const plano = (poly?.data[0] ?? []) as number[]
  return { x: plano[2], y: plano[3] }
}

/** Ângulo em [0, 2π): o giro pode dar voltas inteiras a mais sem mudar para onde o bico aponta. */
function volta(angulo: number): number {
  const v = angulo % (2 * Math.PI)
  return v < 0 ? v + 2 * Math.PI : v
}

describe('PlayerView — o jogador vê para onde as fichas olham', () => {
  let raiz: HTMLDivElement
  let root: Root

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

  /** O div do canvas: é nele que a PlayerView escreve as contagens para o e2e. */
  function conteiner(): HTMLElement {
    const el = raiz.firstElementChild
    if (!(el instanceof HTMLElement)) throw new Error('a PlayerView não renderizou o contêiner')
    return el
  }

  async function mostra(map: MapData): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={VISAO} ownTokens={MINHAS} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  /** Primeiro snapshot: espera o `setup` assíncrono (o `init` do Application) chegar ao primeiro desenho. */
  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe(String(map.tokens.length)))
  }

  /** Um quadro do ticker do Pixi, no relógio que o teste parou. */
  function quadro(): void {
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  /** Movimento reduzido ligado no sistema (o jsdom não tem matchMedia). */
  function movimentoReduzido(): void {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  it('a ficha do jogador e as que ele enxerga ganham o bico na direção da rotação; a que o mestre nunca virou fica sem', async () => {
    await monta(pacote(fichas()))

    const bicoDaAna = bicoDa(fichaChamada('Ana'))
    const bicoDoGuarda = bicoDa(fichaChamada('Guarda'))
    const bicoDaSentinela = bicoDa(fichaChamada('Sentinela'))
    expect(bicoDaAna).toBeDefined()
    expect(bicoDoGuarda).toBeDefined()
    expect(bicoDaSentinela).toBeDefined()
    expect(bicoDa(fichaChamada('Mercador'))).toBeUndefined()
    if (!bicoDaAna || !bicoDoGuarda || !bicoDaSentinela) return

    expect(volta(bicoDaAna.rotation)).toBeCloseTo(Math.PI, 9)
    expect(volta(bicoDoGuarda.rotation)).toBeCloseTo(Math.PI / 2, 9)
    // Zero GRAVADO é frente (para cima); só a rotação ausente é "sem frente".
    expect(bicoDaSentinela.rotation).toBe(0)
    // Para o e2e: canvas WebGL não é legível pelo DOM.
    expect(conteiner().dataset.facingCount).toBe('3')
  })

  it('na tela, a ponta do bico fica do lado para onde a ficha olha', async () => {
    await monta(pacote(fichas()))
    const escala = mundo().scale.x

    const pontaNaTela = (nome: string, own: boolean) => {
      const ficha = fichaChamada(nome)
      const bico = bicoDa(ficha)
      if (!bico) throw new Error(`a ficha ${nome} não mostra frente`)
      const centro = ficha.toGlobal({ x: 0, y: 0 })
      const ponta = bico.toGlobal(pontaLocal(bico))
      const alcance = facingNibReach(RAIO, escala, own) * escala
      return { dx: ponta.x - centro.x, dy: ponta.y - centro.y, alcance }
    }

    const guarda = pontaNaTela('Guarda', false)
    expect(guarda.dx).toBeGreaterThan(0)
    expect(guarda.dx).toBeCloseTo(guarda.alcance, 6)
    expect(guarda.dy).toBeCloseTo(0, 6)

    const ana = pontaNaTela('Ana', true)
    expect(ana.dy).toBeGreaterThan(0)
    expect(ana.dy).toBeCloseTo(ana.alcance, 6)
    expect(ana.dx).toBeCloseTo(0, 6)

    const sentinela = pontaNaTela('Sentinela', false)
    expect(sentinela.dy).toBeLessThan(0)
    expect(-sentinela.dy).toBeCloseTo(sentinela.alcance, 6)
    expect(sentinela.dx).toBeCloseTo(0, 6)
  })

  it('o nome da ficha com frente sai de baixo do bico; o da ficha sem frente continua colado no disco', async () => {
    await monta(pacote(fichas()))
    const escala = mundo().scale.x

    const guarda = fichaChamada('Guarda')
    const bico = bicoDa(guarda)
    expect(bico).toBeDefined()
    if (!bico) return
    expect(nomeDa(guarda).y).toBeGreaterThan(facingNibReach(RAIO, escala, false))
    expect(nomeDa(guarda).y).toBeCloseTo(facingLabelOffset(RAIO, escala, false), 9)
    // O nome fica por cima do bico: ele nunca apaga uma letra.
    expect(guarda.getChildIndex(nomeDa(guarda))).toBeGreaterThan(guarda.getChildIndex(bico))

    const ana = fichaChamada('Ana')
    expect(nomeDa(ana).y).toBeCloseTo(facingLabelOffset(RAIO, escala, true), 9)
    expect(nomeDa(fichaChamada('Mercador')).y).toBe(NOME_COLADO)
  })

  it('o mestre vira o guarda: o bico gira pelo lado curto em TOKEN_TURN_MS, sem saltar', async () => {
    await monta(pacote(fichas(90)))
    const bico = bicoDa(fichaChamada('Guarda'))
    expect(bico).toBeDefined()
    if (!bico) return
    const relogio = vi.spyOn(performance, 'now').mockReturnValue(50_000)

    await mostra(pacote(fichas(180)))
    // O snapshot chegou: o bico começa onde estava, e é o ticker que o leva.
    expect(volta(bico.rotation)).toBeCloseTo(Math.PI / 2, 9)

    relogio.mockReturnValue(50_000 + TOKEN_TURN_MS / 2)
    quadro()
    expect(volta(bico.rotation)).toBeGreaterThan(Math.PI / 2)
    expect(volta(bico.rotation)).toBeLessThan(Math.PI)

    relogio.mockReturnValue(50_000 + TOKEN_TURN_MS)
    quadro()
    expect(volta(bico.rotation)).toBeCloseTo(Math.PI, 9)
    // O mesmo bico o tempo todo: girar não recria nada na tela.
    expect(bicoDa(fichaChamada('Guarda'))).toBe(bico)
  })

  it('volta completa por cima do zero: de 350 para 10 graus o bico passa pelo topo, não pela base', async () => {
    await monta(pacote(fichas(350)))
    const bico = bicoDa(fichaChamada('Guarda'))
    expect(bico).toBeDefined()
    if (!bico) return
    const relogio = vi.spyOn(performance, 'now').mockReturnValue(80_000)

    await mostra(pacote(fichas(10)))
    relogio.mockReturnValue(80_000 + TOKEN_TURN_MS / 2)
    quadro()
    // Metade do caminho curto é o topo (0 grau): perto dele, e longe da base (180).
    expect(Math.cos(bico.rotation)).toBeGreaterThan(0.99)
    relogio.mockReturnValue(80_000 + TOKEN_TURN_MS)
    quadro()
    expect(volta(bico.rotation)).toBeCloseTo((10 * Math.PI) / 180, 9)
    expect(bicoDa(fichaChamada('Guarda'))).toBe(bico)
  })

  it('movimento reduzido: o bico salta direto para a frente nova', async () => {
    movimentoReduzido()
    await monta(pacote(fichas(90)))
    const bico = bicoDa(fichaChamada('Guarda'))
    expect(bico).toBeDefined()
    if (!bico) return

    await mostra(pacote(fichas(270)))
    expect(volta(bico.rotation)).toBeCloseTo((3 * Math.PI) / 2, 9)
    expect(bicoDa(fichaChamada('Guarda'))).toBe(bico)
  })

  it('o guarda que sai da visão e volta virado aparece já na frente nova, sem girar na frente do jogador', async () => {
    await monta(pacote(fichas(90)))
    vi.spyOn(performance, 'now').mockReturnValue(90_000)

    await mostra(pacote(fichas(90).filter((t) => t.id !== 'guarda')))
    expect(conteiner().dataset.facingCount).toBe('2')

    await mostra(pacote(fichas(270)))
    const bico = bicoDa(fichaChamada('Guarda'))
    expect(bico).toBeDefined()
    if (!bico) return
    expect(volta(bico.rotation)).toBeCloseTo((3 * Math.PI) / 2, 9)
    expect(conteiner().dataset.facingCount).toBe('3')
  })

  it('a frente some do pacote: o bico some e o nome volta a encostar no disco', async () => {
    await monta(pacote(fichas(90)))
    expect(bicoDa(fichaChamada('Guarda'))).toBeDefined()

    await mostra(pacote(fichas(null)))
    const guarda = fichaChamada('Guarda')
    expect(bicoDa(guarda)).toBeUndefined()
    expect(nomeDa(guarda).y).toBe(NOME_COLADO)
    expect(conteiner().dataset.facingCount).toBe('2')
  })

  it('o zoom refaz o bico: a ponta continua a FACING_NIB_LENGTH_PX de tela da borda do disco', async () => {
    await monta(pacote(fichas()))
    const world = mundo()
    const bico = bicoDa(fichaChamada('Guarda'))
    expect(bico).toBeDefined()
    if (!bico) return
    const antes = world.scale.x
    expect((-pontaLocal(bico).y - RAIO) * antes).toBeCloseTo(FACING_NIB_LENGTH_PX, 6)

    const canvas = conteiner().querySelector('canvas')
    if (canvas === null) throw new Error('a PlayerView não pôs o canvas no contêiner')
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -500, clientX: 400, clientY: 300, cancelable: true }))
    })

    const depois = world.scale.x
    expect(depois).toBeGreaterThan(antes)
    expect((-pontaLocal(bico).y - RAIO) * depois).toBeCloseTo(FACING_NIB_LENGTH_PX, 6)
    expect(nomeDa(fichaChamada('Guarda')).y).toBeCloseTo(facingLabelOffset(RAIO, depois, false), 9)
  })
})
