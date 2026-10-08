import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Container } from 'pixi.js'
import { createEmptyMap } from '../lib/mapFactory'
import type { Drawing, FloorPiece, MapData, MarcaNoLugar, Pin, Region, RegionPoint, Token, Wall } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS } from './PlayerPanel'
import { PlayerView } from './PlayerView'

/**
 * A REFERÊNCIA ANTES DO CONTEÚDO, na TELA do jogador. O patch do mestre mantém
 * a mesma referência em todo campo do mapa que não mudou (`applyMapPatch`, em
 * `net/viewPatch.ts`): a ficha anda, e paredes, salas, chão, luzes, perigos,
 * desenhos, bilhetes e pinos chegam nas MESMAS listas. A tela não serializa
 * nada disso de novo para descobrir que nada mudou — numa cidade grande, era
 * o tranco de cada passo. E continua redesenhando o que muda de verdade, o
 * que o mestre esconde por camada, e nada quando um snapshot inteiro chega com
 * o mesmo conteúdo em listas novas (a chave por conteúdo segue como rede).
 *
 * Sem navegador: só o `Application` (WebGL), a medida do texto e o halo da luz
 * (gradiente de canvas) são trocados. As camadas contam quantas vezes foram
 * redesenhadas.
 */

const tela = vi.hoisted(() => ({
  palcos: new Array<Container>(),
  /** Sombra das luzes: quantas vezes a tela pediu os obstáculos da cena. */
  sombras: 0,
  /** Máscara da grade (silhueta do piso) refeita. */
  mascaras: 0,
  perigos: 0,
  bilhetes: 0,
  /**
   * Quantos desenhos cada chamada de `drawDrawings` levou. Desde que os
   * desenhos do botão Desenho passaram para baixo da borda da sala, cada
   * repintura chama duas vezes (sob as salas, depois Texto e Caminho): use
   * `desenhosNaUltimaPintura()` para o total.
   */
  desenhos: new Array<number>(),
  /** Quantos pinos cada repintura da camada levou. */
  pinos: new Array<number>(),
}))

vi.mock('../lib/visibility', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/visibility')>()
  return {
    ...original,
    visionSegments: (...args: Parameters<typeof original.visionSegments>): ReturnType<typeof original.visionSegments> => {
      tela.sombras += 1
      return original.visionSegments(...args)
    },
  }
})

vi.mock('../pixi/floorMask', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/floorMask')>()
  return {
    ...original,
    buildFloorMask: (...args: Parameters<typeof original.buildFloorMask>): boolean => {
      tela.mascaras += 1
      return original.buildFloorMask(...args)
    },
  }
})

vi.mock('../pixi/drawPerigos', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawPerigos')>()
  return {
    ...original,
    drawPerigos: (...args: Parameters<typeof original.drawPerigos>): void => {
      tela.perigos += 1
      original.drawPerigos(...args)
    },
  }
})

vi.mock('../pixi/drawMarcas', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawMarcas')>()
  return {
    ...original,
    drawMarcas: (...args: Parameters<typeof original.drawMarcas>): void => {
      tela.bilhetes += 1
      original.drawMarcas(...args)
    },
  }
})

vi.mock('../pixi/drawDrawings', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawDrawings')>()
  return {
    ...original,
    drawDrawings: (...args: Parameters<typeof original.drawDrawings>): void => {
      tela.desenhos.push(args[1].length)
      original.drawDrawings(...args)
    },
  }
})

vi.mock('../pixi/drawPins', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawPins')>()
  return {
    ...original,
    createPinsRenderer: (...args: Parameters<typeof original.createPinsRenderer>): ReturnType<typeof original.createPinsRenderer> => {
      const renderer = original.createPinsRenderer(...args)
      return {
        draw: (...d: Parameters<typeof renderer.draw>): void => {
          tela.pinos.push(d[1].length)
          renderer.draw(...d)
        },
      }
    },
  }
})

// O halo usa gradiente de canvas 2D, que o jsdom não tem: aqui só importa a sombra (`visionSegments`).
vi.mock('../pixi/drawLights', async (importOriginal) => {
  const original = await importOriginal<typeof import('../pixi/drawLights')>()
  return {
    ...original,
    createLightsRenderer: (): ReturnType<typeof original.createLightsRenderer> => ({
      draw: () => undefined,
      liveGradients: () => 0,
      destroy: () => undefined,
    }),
  }
})

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

const GRADE = 40
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: 500, y: 500, size: 1, image: null, color: '#3cff00' }

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Sala quadrada de 200 px com canto em (x, y): 4 paredes, o contorno e uma peça de chão. */
function sala(id: string, x: number, y: number): { walls: Wall[]; region: Region; floor: FloorPiece } {
  const lado = 5 * GRADE
  const points: RegionPoint[] = [
    { x: x + 1, y: y + 1 },
    { x: x + lado - 1, y: y + 1 },
    { x: x + lado - 1, y: y + lado - 1 },
    { x: x + 1, y: y + lado - 1 },
  ]
  return {
    walls: [parede(`${id}-n`, x, y, x + lado, y), parede(`${id}-l`, x + lado, y, x + lado, y + lado), parede(`${id}-s`, x, y + lado, x + lado, y + lado), parede(`${id}-o`, x, y, x, y + lado)],
    region: { id, points, tag: '', fillColor: '#334455', fillPattern: 'solid', data: {} },
    floor: { id: `${id}-chao`, shape: { kind: 'rect', cx: x + lado / 2, cy: y + lado / 2, w: lado, h: lado }, op: 'add', modifiers: {} },
  }
}

const AQUI = sala('sala-aqui', 400, 400)
/** No canto oposto do mapa: fora do recorte de desenho da vizinhança da Ana (`playerCulling.ts`). */
const LONGE = sala('sala-longe', 3400, 3400)

function desenho(id: string, x: number): Drawing {
  return { id, kind: 'line', x1: x, y1: 420, x2: x + 40, y2: 460, color: '#ffffff', width: 2 }
}

function pino(id: string, x: number): Pin {
  return { id, x, y: 560, kind: 'exclamacao', description: `pino ${id}`, image: null }
}

const BILHETE: MarcaNoLugar = { id: 'bilhete-1', tipo: 'bilhete', x: 450, y: 450, texto: 'cuidado' }

/** Vila de 100 x 100 quadrados com tudo o que a tela serializava a cada passo: luz, perigo, desenhos, bilhete e pinos. */
function vila(): MapData {
  return {
    ...createEmptyMap('m-vila', '', 100, 100, GRADE),
    tokens: [ANA],
    walls: [...AQUI.walls, ...LONGE.walls],
    regions: [AQUI.region, LONGE.region],
    floor: [AQUI.floor, LONGE.floor],
    lights: [{ id: 'tocha', x: 500, y: 500, radius: 120, color: '#ffcc66', intensity: 1 }],
    perigos: [{ id: 'fogo', tipo: 'fogo', salas: [LONGE.region.id] }],
    drawings: [desenho('risco-1', 420), desenho('risco-2', 500)],
    marcas: [BILHETE],
    pins: [pino('pino-1', 450), pino('pino-2', 550)],
  }
}

const VISAO: RegionPoint[][] = [AQUI.region.points]

/** A ficha da Ana um quadrado adiante, e nada mais muda: o patch do mestre só troca `tokens`. */
function passo(map: MapData): MapData {
  return { ...map, tokens: [{ ...ANA, x: ANA.x + GRADE }] }
}

function ehLista(valor: unknown): valor is readonly unknown[] {
  return Array.isArray(valor)
}

/**
 * Quais listas cruas do mapa um `JSON.stringify` serializou: a própria lista,
 * ou uma cópia filtrada dela inteira (mesmo tamanho, mesmo primeiro item) —
 * `visibleWalls` devolve uma lista nova com as mesmas paredes. Salas também
 * na forma `[id, contorno]` das chaves de salas. Procura até 3 níveis dentro
 * do valor serializado.
 */
function listasSerializadas(valor: unknown, map: MapData, achadas: Set<string>, fundo = 0): void {
  if (!ehLista(valor)) return
  const listas: [string, readonly unknown[]][] = [
    ['paredes', map.walls],
    ['chão', map.floor],
    ['salas', map.regions],
    ['luzes', map.lights],
    ['perigos', map.perigos ?? []],
    ['desenhos', map.drawings],
    ['bilhetes', map.marcas ?? []],
    ['pinos', map.pins],
  ]
  for (const [nome, lista] of listas) {
    if (lista.length > 0 && valor.length === lista.length && valor[0] === lista[0]) achadas.add(nome)
  }
  const primeiro = valor[0]
  const salaDaChave = map.regions[0]
  if (salaDaChave !== undefined && valor.length === map.regions.length && ehLista(primeiro) && primeiro[1] === salaDaChave.points) achadas.add('salas')
  if (fundo < 3) for (const item of valor) listasSerializadas(item, map, achadas, fundo + 1)
}

describe('PlayerView — a referência antes do conteúdo nas chaves do redesenho', () => {
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
    tela.sombras = 0
    tela.mascaras = 0
    tela.perigos = 0
    tela.bilhetes = 0
    tela.desenhos.length = 0
    tela.pinos.length = 0
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
      root.render(<PlayerView map={map} vision={VISAO} ownTokens={[ANA.id]} settings={DEFAULT_PLAYER_SETTINGS} focusTokenId={null} focusSeq={0} onMove={() => {}} />)
    })
  }

  /**
   * Primeiro snapshot: espera o `setup` assíncrono chegar ao primeiro desenho,
   * com cada camada pintada ao menos uma vez (o enquadramento da câmera pode
   * repintar os pinos no tamanho do zoom: os testes contam a partir daqui).
   */
  async function monta(map: MapData): Promise<void> {
    await mostra(map)
    await vi.waitFor(() => expect(conteiner().dataset.wallsCount).toBe(String(map.walls.length)))
    expect(tela.sombras).toBeGreaterThan(0)
    expect(tela.mascaras).toBeGreaterThan(0)
    expect(tela.perigos).toBeGreaterThan(0)
    expect(tela.bilhetes).toBeGreaterThan(0)
    expect(desenhosNaUltimaPintura()).toBe(2)
    expect(tela.pinos.at(-1)).toBe(2)
  }

  /** Desenhos da última repintura: as duas chamadas (sob as salas + Texto e Caminho) somadas. */
  function desenhosNaUltimaPintura(): number {
    return (tela.desenhos.at(-2) ?? 0) + (tela.desenhos.at(-1) ?? 0)
  }

  /** Quantas vezes cada camada foi pintada até agora. */
  function pinturas(): Record<string, number> {
    return {
      sombras: tela.sombras,
      mascaras: tela.mascaras,
      perigos: tela.perigos,
      bilhetes: tela.bilhetes,
      desenhos: tela.desenhos.length,
      pinos: tela.pinos.length,
    }
  }

  it('a ficha anda e nada mais muda no mapa: a tela não serializa de novo paredes, salas, chão, luzes, perigos, desenhos, bilhetes nem pinos', async () => {
    const map = vila()
    await monta(map)
    const antes = pinturas()
    const serializa = vi.spyOn(JSON, 'stringify')

    await mostra(passo(map))

    const achadas = new Set<string>()
    for (const [valor] of serializa.mock.calls) listasSerializadas(valor, map, achadas)
    expect([...achadas]).toEqual([])
    // Nem chave, nem desenho: nenhuma camada da planta foi repintada.
    expect(pinturas()).toEqual(antes)
  })

  it('o que muda de verdade continua redesenhando: parede, perigo, desenho, bilhete e pino novos', async () => {
    const map = vila()
    await monta(map)
    await mostra(passo(map))
    const antes = pinturas()

    const serializa = vi.spyOn(JSON, 'stringify')
    const comParede: MapData = { ...map, walls: [...map.walls, parede('nova', 400, 500, 500, 500)] }
    await mostra(comParede)
    // A chave por conteúdo das paredes voltou a ser feita (lista nova)...
    const achadas = new Set<string>()
    for (const [valor] of serializa.mock.calls) listasSerializadas(valor, comParede, achadas)
    expect(achadas.has('paredes')).toBe(true)
    // ...e a sombra e a máscara da grade, que dependem delas, foram refeitas.
    expect(pinturas()).toEqual({ ...antes, sombras: antes.sombras + 1, mascaras: antes.mascaras + 1 })

    const comPerigo: MapData = { ...comParede, perigos: [{ id: 'fogo', tipo: 'fogo', salas: [LONGE.region.id, AQUI.region.id] }] }
    await mostra(comPerigo)
    expect(tela.perigos).toBe(antes.perigos + 1)

    const comDesenho: MapData = { ...comPerigo, drawings: [...comPerigo.drawings, desenho('risco-3', 540)] }
    await mostra(comDesenho)
    expect(desenhosNaUltimaPintura()).toBe(3)

    const comBilhete: MapData = { ...comDesenho, marcas: [BILHETE, { id: 'seta-1', tipo: 'seta', x: 520, y: 520, rumo: 'n' }] }
    await mostra(comBilhete)
    expect(tela.bilhetes).toBe(antes.bilhetes + 1)

    const comPino: MapData = { ...comBilhete, pins: [...comBilhete.pins, pino('pino-3', 500)] }
    await mostra(comPino)
    expect(tela.pinos.at(-1)).toBe(3)
  })

  it('o mestre esconde camadas com as mesmas listas no mapa: desenhos, pinos, sombra e perigo acompanham', async () => {
    const map = vila()
    await monta(map)
    const antes = pinturas()

    await mostra({ ...map, hiddenLayers: ['anotacoes', 'paredes', 'salas'] })
    expect(desenhosNaUltimaPintura()).toBe(0)
    expect(tela.pinos.at(-1)).toBe(0)
    expect(conteiner().dataset.pinsCount).toBe('0')
    // Sem paredes à vista, a sombra muda; sem salas, o perigo não tem onde pintar.
    expect(tela.sombras).toBe(antes.sombras + 1)
    expect(tela.perigos).toBe(antes.perigos + 1)
  })

  it('snapshot inteiro com o mesmo conteúdo, em listas novas: nada a redesenhar', async () => {
    const map = vila()
    await monta(map)
    const antes = pinturas()

    await mostra(structuredClone(map))
    expect(pinturas()).toEqual(antes)
  })
})
