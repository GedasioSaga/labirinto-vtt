import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'
import { LAST_SEEN_LAYER_LABEL, LAST_SEEN_TTL_MS } from './lastSeen'

/**
 * ONDE VI O COLEGA PELA ÚLTIMA VEZ, na TELA do jogador. `lastSeen.test.ts`
 * prova a memória e o recorte; aqui a prova é a COSTURA: a ficha que sai do
 * pacote vira um contorno apagado com "há N s" no ponto em que foi vista, o
 * tempo anda com o ticker, e o contorno some quando ela volta, quando a cena
 * muda ou depois de 2 minutos.
 *
 * Sem navegador, como em `PlayerView.frente.test.tsx`: só o `Application`
 * (pede WebGL) e a MEDIDA do texto (sem canvas 2d) são trocados. O ticker e o
 * relógio são do teste.
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
const ANA = 'ficha-ana'
const T0 = 5_000_000

function ficha(id: string, name: string, x: number, y: number): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null }
}

function pacote(tokens: Token[], id = 'm-galeria'): MapData {
  return { ...createEmptyMap(id, '', 25, 25, 40), tokens }
}

const ANA_FICHA = ficha(ANA, 'Ana', 200, 500)
const BRUNO = ficha('bruno', 'Bruno', 600, 400)

function mundo(): Container {
  const world = tela.palcos.at(-1)?.children[0]
  if (!(world instanceof Container)) throw new Error('a PlayerView não montou o mundo no palco')
  return world
}

function camadaDosFantasmas(): Container {
  const camada = mundo().getChildByLabel(LAST_SEEN_LAYER_LABEL)
  if (camada === null) throw new Error('a PlayerView não montou a camada do último avistamento')
  return camada
}

function fantasmasVisiveis(): Container[] {
  return camadaDosFantasmas().children.filter((c): c is Container => c instanceof Container && c.visible)
}

function rotuloDe(fantasma: Container): string {
  const texto = fantasma.children.find((c): c is Text => c instanceof Text)
  if (!texto) throw new Error('o fantasma não tem rótulo')
  return texto.text
}

describe('PlayerView — onde vi o colega pela última vez', () => {
  let raiz: HTMLDivElement
  let root: Root
  let agora = T0

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
    agora = T0
    vi.spyOn(Date, 'now').mockImplementation(() => agora)
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

  async function mostra(map: MapData, showNames = true): Promise<void> {
    await act(async () => {
      root.render(
        <PlayerView
          map={map}
          vision={VISAO}
          ownTokens={[ANA]}
          settings={{ ...DEFAULT_PLAYER_SETTINGS, showNames }}
          focusTokenId={null}
          focusSeq={0}
          onMove={() => {}}
        />,
      )
    })
  }

  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.tokensCount).toBe(String(map.tokens.length)))
  }

  function quadro(): void {
    act(() => {
      for (const q of [...tela.quadros]) q()
    })
  }

  it('o colega que sai da visão deixa um contorno no último ponto com "há N s", que anda com o relógio', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')

    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    const [fantasma] = fantasmasVisiveis()
    expect(fantasmasVisiveis()).toHaveLength(1)
    expect(fantasma?.position.x).toBe(600)
    expect(fantasma?.position.y).toBe(400)
    expect(fantasma && rotuloDe(fantasma)).toBe('Bruno · há 0 s')
    expect(conteiner().dataset.lastSeenCount).toBe('1')

    agora = T0 + 13_000
    quadro()
    expect(fantasma && rotuloDe(fantasma)).toBe('Bruno · há 12 s')
  })

  it('o contorno fica abaixo das fichas e não pega toque', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    const camadas = mundo().children
    const fantasmas = camadaDosFantasmas()
    expect(camadas.indexOf(fantasmas)).toBe(camadas.length - 2)
    expect(fantasmas.eventMode).toBe('none')
  })

  it('some depois de 2 minutos', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    expect(fantasmasVisiveis()).toHaveLength(1)

    agora = T0 + 1000 + LAST_SEEN_TTL_MS
    quadro()
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')
  })

  it('o zoom que acontece depois de o contorno vencer também zera a contagem que o DOM mostra', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    expect(conteiner().dataset.lastSeenCount).toBe('1')

    // Venceu, e a roda chega antes do próximo quadro do ticker.
    agora = T0 + 1000 + LAST_SEEN_TTL_MS
    const canvas = conteiner().querySelector('canvas')
    if (canvas === null) throw new Error('a PlayerView não pôs o canvas no contêiner')
    const escalaAntes = mundo().scale.x
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: 400, clientY: 300, cancelable: true }))
    })
    expect(mundo().scale.x).not.toBe(escalaAntes)
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')

    // O quadro seguinte não tem mais nada a fazer, e a contagem continua certa.
    quadro()
    expect(conteiner().dataset.lastSeenCount).toBe('0')
  })

  it('some quando o colega volta à visão', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    expect(fantasmasVisiveis()).toHaveLength(1)

    agora = T0 + 2000
    await mostra(pacote([ANA_FICHA, { ...BRUNO, x: 640 }]))
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')
  })

  it('some quando a cena muda', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    expect(fantasmasVisiveis()).toHaveLength(1)

    agora = T0 + 2000
    await mostra(pacote([ANA_FICHA], 'm-outra-cena'))
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')
  })

  it('a própria ficha que sai do pacote não vira contorno', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([BRUNO]))
    expect(fantasmasVisiveis()).toEqual([])
    expect(conteiner().dataset.lastSeenCount).toBe('0')
  })

  it('a seta aponta para onde o colega andava; sem passo visto, não há seta', async () => {
    await monta(pacote([ANA_FICHA, BRUNO, ficha('caio', 'Caio', 800, 800)]))
    agora = T0 + 500
    await mostra(pacote([ANA_FICHA, { ...BRUNO, y: 440 }, ficha('caio', 'Caio', 800, 800)]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]))
    const porNome = new Map(fantasmasVisiveis().map((f) => [rotuloDe(f).split(' · ')[0], f]))
    const setaDo = (f: Container | undefined): Graphics | undefined =>
      f?.children.find((c): c is Graphics => c instanceof Graphics && c.visible && c.context.instructions.some((i) => i.action === 'fill'))
    const setaDoBruno = setaDo(porNome.get('Bruno'))
    expect(setaDoBruno).toBeDefined()
    // Para baixo na tela: +90 graus.
    expect(setaDoBruno?.rotation).toBeCloseTo(Math.PI / 2, 9)
    expect(porNome.has('Caio')).toBe(true)
    expect(setaDo(porNome.get('Caio'))).toBeUndefined()
  })

  it('com os nomes desligados o contorno diz só há quanto tempo', async () => {
    await monta(pacote([ANA_FICHA, BRUNO]))
    agora = T0 + 1000
    await mostra(pacote([ANA_FICHA]), false)
    const [fantasma] = fantasmasVisiveis()
    expect(fantasma).toBeDefined()
    expect(fantasma && rotuloDe(fantasma)).toBe('há 0 s')
  })
})
