import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { companionLabelText } from './companionMarker'

/**
 * MARCA DE COMPANHEIRO, na TELA do jogador: a ficha que chega com `companion`
 * (outro jogador) ganha o aro fino na cor dele e o nome "Caio (jogador)"
 * embaixo do nome do personagem; o NPC continua sem nada disso. Mesmo arranjo
 * sem navegador de `PlayerView.frente.test.tsx`: só o `Application` (WebGL) e
 * a medida do texto são trocados.
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

const VISAO: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 1000 },
    { x: 0, y: 1000 },
  ],
]
const DUDA = 'ficha-duda'
const COR_DO_CAIO = '#64b5f6'

function ficha(id: string, nome: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: nome, x, y: 500, size: 1, image: null, ...extra }
}

function pacote(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-salao', '', 25, 25, 40), tokens }
}

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function camadaDasFichas(): Container {
  const camada = mundo().children.at(-1)
  if (!(camada instanceof Container)) throw new Error('a PlayerView não montou a camada das fichas')
  return camada
}

function textosDa(ficha: Container): Text[] {
  return ficha.children.filter((c): c is Text => c instanceof Text)
}

/** A ficha visível cujo PRIMEIRO texto (o nome do personagem) é este. */
function fichaChamada(nome: string): Container {
  const achada = camadaDasFichas().children.find((c): c is Container => c instanceof Container && c.visible && textosDa(c)[0]?.text === nome)
  if (!achada) throw new Error(`a ficha ${nome} não está na tela`)
  return achada
}

/** Texto VISÍVEL da ficha além do nome do personagem: a etiqueta do jogador. */
function etiquetaDoJogador(ficha: Container): Text | undefined {
  return textosDa(ficha)
    .slice(1)
    .find((t) => t.visible && t.text !== '')
}

function coresDosTracos(ficha: Container): number[] {
  return ficha.children
    .filter((c): c is Graphics => c instanceof Graphics && c.visible)
    .flatMap((g) => g.context.instructions)
    .flatMap((i) => (i.action === 'stroke' && typeof i.data.style.color === 'number' ? [i.data.style.color] : []))
}

describe('PlayerView — a ficha do companheiro se distingue da ficha de NPC', () => {
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

  async function mostra(map: MapData): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView map={map} vision={VISAO} ownTokens={[DUDA]} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />,
      )
    })
  }

  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe(String(map.tokens.length)))
  }

  const comCaio = (): Token[] => [
    ficha(DUDA, 'Guerreira', 200),
    ficha('caio', 'Ladino', 500, { companion: { name: 'Caio', color: COR_DO_CAIO } }),
    ficha('guarda', 'Guarda', 800),
  ]

  it('a ficha do Caio mostra "Caio (jogador)" na cor dele e o aro nessa cor; o Guarda (NPC) não', async () => {
    await monta(pacote(comCaio()))

    const caio = fichaChamada('Ladino')
    const etiqueta = etiquetaDoJogador(caio)
    expect(etiqueta?.text).toBe('Caio (jogador)')
    expect(etiqueta?.style.fill).toBe(0x64b5f6)
    expect(coresDosTracos(caio)).toContain(0x64b5f6)

    const guarda = fichaChamada('Guarda')
    expect(textosDa(guarda)[0]?.text).toBe('Guarda')
    expect(etiquetaDoJogador(guarda)).toBeUndefined()
    expect(coresDosTracos(guarda)).not.toContain(0x64b5f6)

    // A própria ficha tem o aro de dono, não a marca de companheiro.
    expect(etiquetaDoJogador(fichaChamada('Guerreira'))).toBeUndefined()
    expect(conteiner().dataset.companionsCount).toBe('1')
  })

  it('a etiqueta fica abaixo do nome do personagem, nunca em cima dele', async () => {
    await monta(pacote(comCaio()))
    const caio = fichaChamada('Ladino')
    const [nome] = textosDa(caio)
    const etiqueta = etiquetaDoJogador(caio)
    expect(etiqueta).toBeDefined()
    if (etiqueta === undefined || nome === undefined) return
    expect(etiqueta.position.x).toBe(nome.position.x)
    expect(etiqueta.position.y).toBeGreaterThanOrEqual(nome.position.y + nome.height)
  })

  it('a marca some quando o snapshot seguinte chega sem ela (a ficha deixou de ser de jogador)', async () => {
    await monta(pacote(comCaio()))
    expect(etiquetaDoJogador(fichaChamada('Ladino'))?.text).toBe('Caio (jogador)')

    await mostra(pacote([ficha(DUDA, 'Guerreira', 200), ficha('caio', 'Ladino', 500), ficha('guarda', 'Guarda', 800)]))
    await vi.waitFor(() => expect(conteiner().dataset.companionsCount).toBe('0'))
    const caio = fichaChamada('Ladino')
    expect(etiquetaDoJogador(caio)).toBeUndefined()
    expect(coresDosTracos(caio)).not.toContain(0x64b5f6)
  })

  it('"Mostrar nomes" desligado esconde a etiqueta junto do nome; o aro continua marcando o companheiro', async () => {
    await act(async () => {
      root.render(
        <PlayerView
          map={pacote(comCaio())}
          vision={VISAO}
          ownTokens={[DUDA]}
          settings={{ ...DEFAULT_PLAYER_SETTINGS, showNames: false }}
          focusTokenId={null}
          focusSeq={0}
          onMove={() => {}}
        />,
      )
    })
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe('3'))
    const caio = camadaDasFichas().children.find((c): c is Container => c instanceof Container && c.visible && textosDa(c)[0]?.text === 'Ladino')
    expect(caio).toBeDefined()
    if (caio === undefined) return
    expect(etiquetaDoJogador(caio)).toBeUndefined()
    expect(coresDosTracos(caio)).toContain(0x64b5f6)
  })
})

describe('companionLabelText', () => {
  it('diz de quem é a ficha e que é de jogador', () => {
    expect(companionLabelText({ name: 'Caio', color: COR_DO_CAIO })).toBe('Caio (jogador)')
  })
})
