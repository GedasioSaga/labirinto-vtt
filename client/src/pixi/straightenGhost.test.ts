import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Graphics, Ticker } from 'pixi.js'
import { endireitarNoMapa } from '../lib/endireitar'
import { addDoorOnWall, createEmptyMap } from '../lib/mapFactory'
import { buildLineDrawing, buildPathDrawing, buildWallFromDraft } from '../lib/drawingFactory'
import type { SelectionSet } from '../lib/selectionModel'
import { useMapStore } from '../stores/mapStore'
import type { Drawing, MapData, Wall } from '../types/map'
import type { GhostStroke } from './drawStraightenGhost'
import {
  ENDIREITAR_FANTASMA_ALPHA,
  ENDIREITAR_FANTASMA_MS,
  alphaDoFantasma,
  criarFantasmaDoEndireitar,
  tracosDoEndireitar,
  type PassoDaStore,
} from './straightenGhost'

/**
 * Pedido 5, fatia 4: depois de endireitar, a posição de ANTES aparece como um
 * fantasma que apaga em ~150 ms. Só visual: o mapa e o histórico são os do
 * endireitar, e com movimento reduzido não há fantasma.
 *
 * A store não avisa "endireitei" (e esta fatia não mexe nela): o fantasma
 * nasce de comparar um estado da store com o seguinte. Por isso metade destes
 * testes é sobre o que NÃO é endireitar e se parece com ele.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 })
}

function linha(id: string, x1: number, y1: number, x2: number, y2: number): Drawing {
  return buildLineDrawing(id, { x: x1, y: y1 }, { x: x2, y: y2 }, '#ffffff', 2)
}

function mapa(walls: Wall[], drawings: Drawing[]): MapData {
  return { ...createEmptyMap('m_fantasma_endireitar', 'Fantasma', 30, 20, 64), walls, drawings }
}

const LINHA_TORTA = linha('torta', 300, 200, 360, 420)
const CAMINHO_TORTO = buildPathDrawing('trilha', [{ x: 0, y: 0 }, { x: 100, y: 8 }, { x: 110, y: 108 }], '#8a6a45', 1, 64)

// ─────────────────────────────────────────────────────────────
// Detecção: a store passou de um estado ao seguinte por um endireitar?
// ─────────────────────────────────────────────────────────────

describe('tracosDoEndireitar — com a store de verdade', () => {
  /** O que cada mudança da store deu: `null` = não foi endireitar. */
  let resultados: (GhostStroke[] | null)[]
  let desligar: () => void

  function comecar(map: MapData, selection: SelectionSet): void {
    useMapStore.setState({ map, selection, past: [], future: [] })
    resultados = []
    desligar = useMapStore.subscribe((estado, anterior) => {
      resultados.push(tracosDoEndireitar(anterior, estado))
    })
  }

  function fantasmas(): GhostStroke[][] {
    return resultados.filter((r): r is GhostStroke[] => r !== null)
  }

  afterEach(() => desligar())

  it('Alt numa linha torta: o fantasma é a linha onde ela estava', () => {
    comecar(mapa([], [LINHA_TORTA]), [{ kind: 'drawing', id: 'torta' }])
    useMapStore.getState().endireitarSelecionados()
    expect(fantasmas()).toEqual([
      [
        [
          { x: 300, y: 200 },
          { x: 360, y: 420 },
        ],
      ],
    ])
  })

  it('Caminho: o traço inteiro de antes, ponto a ponto', () => {
    comecar(mapa([], [CAMINHO_TORTO]), [{ kind: 'drawing', id: 'trilha' }])
    useMapStore.getState().endireitarSelecionados()
    expect(fantasmas()).toEqual([
      [
        [
          { x: 0, y: 0 },
          { x: 100, y: 8 },
          { x: 110, y: 108 },
        ],
      ],
    ])
  })

  it('parede com porta, com só a porta selecionada: os três pedaços, cada um onde estava', () => {
    const comPorta = addDoorOnWall(mapa([parede('w', 0, 0, 300, 40)], []), 'w', { x: 150, y: 20 }, 32, 'normal')
    expect(comPorta.walls).toHaveLength(3)
    const porta = comPorta.walls.find((w) => w.door !== null)
    if (porta === undefined) throw new Error('a porta não nasceu')
    comecar(comPorta, [{ kind: 'wall', id: porta.id }])
    useMapStore.getState().endireitarSelecionados()
    const [fantasma, ...outros] = fantasmas()
    expect(outros).toHaveLength(0)
    expect(fantasma).toEqual(
      comPorta.walls.map((w) => [
        { x: w.x1, y: w.y1 },
        { x: w.x2, y: w.y2 },
      ]),
    )
  })

  it('nada a endireitar (linha reta, parede presa, seleção vazia): o mapa não muda e não há fantasma', () => {
    const MAPA = mapa(
      [parede('presa', 0, 300, 100, 320), parede('p', 0, 300, 0, 250), parede('q', 100, 320, 100, 400)],
      [linha('reta', 0, 40, 200, 40)],
    )
    for (const selection of [[{ kind: 'drawing', id: 'reta' }], [{ kind: 'wall', id: 'presa' }], []] as const) {
      comecar(MAPA, selection)
      useMapStore.getState().endireitarSelecionados()
      expect(useMapStore.getState().map).toBe(MAPA)
      expect(fantasmas()).toHaveLength(0)
      desligar()
    }
    // O afterEach desliga de novo: desligar duas vezes é inofensivo no zustand.
  })

  it('desfazer e refazer o endireitar não chamam o fantasma: ele é do gesto, não do histórico', () => {
    comecar(mapa([], [LINHA_TORTA]), [{ kind: 'drawing', id: 'torta' }])
    useMapStore.getState().endireitarSelecionados()
    expect(fantasmas()).toHaveLength(1)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.drawings).toEqual([LINHA_TORTA])
    useMapStore.getState().redo()
    expect(useMapStore.getState().map.drawings[0]).toMatchObject({ x1: 330, x2: 330 })
    expect(fantasmas()).toHaveLength(1)
  })

  it('arrastar a ponta até a linha ficar em pé, do mesmo tamanho, não é endireitar: a ponta de cima ficou e o meio andou', () => {
    comecar(mapa([], [LINHA_TORTA]), [{ kind: 'drawing', id: 'torta' }])
    // A ponta é arrastada a um passo de desfazer por pointermove (`updateLinePoint`).
    const tamanho = Math.hypot(60, 220)
    useMapStore.getState().updateLinePoint('torta', 1, 300, 200 + tamanho)
    const depois = useMapStore.getState().map.drawings[0]
    if (depois?.kind !== 'line') throw new Error('a linha sumiu')
    expect(depois.x1).toBe(depois.x2)
    expect(fantasmas()).toHaveLength(0)
  })

  it('a guia que deixa a ponta da parede em pé no meio do arrasto também não é endireitar', () => {
    comecar(mapa([parede('w', 0, 0, 30, 200)], []), [{ kind: 'wall', id: 'w' }])
    useMapStore.getState().updateWallPoint('w', 1, 0, 200)
    expect(useMapStore.getState().map.walls[0]).toMatchObject({ x1: 0, x2: 0 })
    expect(fantasmas()).toHaveLength(0)
  })

  it('mover a linha torta selecionada não é endireitar', () => {
    comecar(mapa([], [LINHA_TORTA]), [{ kind: 'drawing', id: 'torta' }])
    useMapStore.getState().moveDrawing('torta', 64, 0)
    expect(fantasmas()).toHaveLength(0)
  })
})

describe('tracosDoEndireitar — passos que lembram o endireitar e não são', () => {
  const ANTES_DO_MAPA = mapa([parede('solta', 0, 0, 30, 200)], [LINHA_TORTA])
  const SELECAO: SelectionSet = [{ kind: 'drawing', id: 'torta' }]
  const ENDIREITADO = endireitarNoMapa(ANTES_DO_MAPA, SELECAO).map
  /** O `past` de antes; a store o mantém (mesma referência) quando muda o mapa sem passo novo. */
  const PASSADO: readonly MapData[] = []

  /** O passo como o `withHistory` o deixa: o mapa de antes no topo do `past`, `future` vazio. */
  function passo(depois: Partial<PassoDaStore> = {}): [PassoDaStore, PassoDaStore] {
    const antes: PassoDaStore = { map: ANTES_DO_MAPA, past: PASSADO, future: [], selection: SELECAO }
    return [antes, { map: ENDIREITADO, past: [ANTES_DO_MAPA], future: [], selection: SELECAO, ...depois }]
  }

  it('o passo do endireitar, montado à mão, é reconhecido (controle dos casos abaixo)', () => {
    expect(tracosDoEndireitar(...passo())).toHaveLength(1)
  })

  it('a seleção trocou no mesmo passo: não é o endireitar, que nunca mexe nela', () => {
    expect(tracosDoEndireitar(...passo({ selection: [{ kind: 'drawing', id: 'torta' }] }))).toBeNull()
  })

  it('o mapa mudou sem passo novo de desfazer (arrasto ao vivo, mudança de jogador): não é', () => {
    expect(tracosDoEndireitar(...passo({ past: PASSADO }))).toBeNull()
  })

  it('o passo novo guarda outro mapa que não o de antes (fim de arrasto): não é', () => {
    expect(tracosDoEndireitar(...passo({ past: [mapa([], [])] }))).toBeNull()
  })

  it('outra coisa mudou junto (uma parede a mais): não é', () => {
    const comParedeNova = { ...ENDIREITADO, walls: [...ENDIREITADO.walls, parede('nova', 0, 500, 64, 500)] }
    expect(tracosDoEndireitar(...passo({ map: comParedeNova }))).toBeNull()
  })

  it('parede de Sala que ficou reta: não é (endireitar não mexe em Sala)', () => {
    const daSala = { ...parede('sala', 0, 0, 30, 200), regionId: 'r1' }
    const antes: PassoDaStore = { map: mapa([daSala], []), past: [], future: [], selection: [{ kind: 'wall', id: 'sala' }] }
    const reta = { ...daSala, x2: 0 }
    const depois: PassoDaStore = { ...antes, map: mapa([reta], []), past: [antes.map] }
    expect(tracosDoEndireitar(antes, depois)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// O fantasma na tela: aparece, apaga em 150 ms e some
// ─────────────────────────────────────────────────────────────

describe('alphaDoFantasma — de 0,5 a 0 em 150 ms, rápido no começo e assentando no fim', () => {
  it('começa em 0,5 e chega a 0 em 150 ms', () => {
    expect(alphaDoFantasma(0)).toBe(ENDIREITAR_FANTASMA_ALPHA)
    expect(ENDIREITAR_FANTASMA_ALPHA).toBe(0.5)
    expect(ENDIREITAR_FANTASMA_MS).toBe(150)
    expect(alphaDoFantasma(ENDIREITAR_FANTASMA_MS)).toBe(0)
    expect(alphaDoFantasma(ENDIREITAR_FANTASMA_MS + 40)).toBe(0)
  })

  it('só desce, e desce mais no primeiro terço que no último (ease-out: o que sai, sai rápido)', () => {
    const passos = [0, 25, 50, 75, 100, 125, 149].map(alphaDoFantasma)
    for (let i = 1; i < passos.length; i++) expect(passos[i]).toBeLessThan(passos[i - 1] ?? 1)
    const terco = ENDIREITAR_FANTASMA_MS / 3
    const quedaNoComeco = alphaDoFantasma(0) - alphaDoFantasma(terco)
    const quedaNoFim = alphaDoFantasma(2 * terco) - alphaDoFantasma(ENDIREITAR_FANTASMA_MS)
    expect(quedaNoComeco).toBeGreaterThan(quedaNoFim)
  })

  it('relógio que volta ou que dá NaN não deixa alpha inválido', () => {
    expect(alphaDoFantasma(-20)).toBe(ENDIREITAR_FANTASMA_ALPHA)
    expect(alphaDoFantasma(Number.NaN)).toBe(0)
  })
})

describe('criarFantasmaDoEndireitar — o fantasma no quadro a quadro', () => {
  const ANTES: GhostStroke[] = [
    [
      { x: 300, y: 200 },
      { x: 360, y: 420 },
    ],
  ]

  let reduzido: boolean
  let agora: number
  let ticker: Ticker
  let graphics: Graphics
  let avisos: number[]

  beforeEach(() => {
    reduzido = false
    agora = 1000
    ticker = new Ticker()
    graphics = new Graphics()
    avisos = []
  })

  function montar() {
    return criarFantasmaDoEndireitar({
      graphics,
      ticker,
      movimentoReduzido: () => reduzido,
      escalaDaCamera: () => 1,
      resolucao: () => 1,
      agora: () => agora,
      aoMudar: (tracos) => avisos.push(tracos),
    })
  }

  function quadro(ms: number): void {
    agora += ms
    ticker.update(agora)
  }

  const desenhado = () => graphics.context.instructions.length > 0

  it('aparece a 0,5 na posição de antes, apaga a cada quadro e some em 150 ms, desligando o ticker', () => {
    const fantasma = montar()
    fantasma.mostrar(ANTES)
    expect(desenhado()).toBe(true)
    expect(graphics.alpha).toBe(ENDIREITAR_FANTASMA_ALPHA)
    expect(ticker.count).toBe(1)
    expect(avisos).toEqual([1])

    quadro(50)
    const noMeio = graphics.alpha
    expect(noMeio).toBeLessThan(ENDIREITAR_FANTASMA_ALPHA)
    expect(noMeio).toBeGreaterThan(0)
    quadro(50)
    expect(graphics.alpha).toBeLessThan(noMeio)
    expect(fantasma.emCurso()).toBe(true)

    quadro(50)
    expect(desenhado()).toBe(false)
    expect(fantasma.emCurso()).toBe(false)
    expect(ticker.count).toBe(0)
    expect(avisos).toEqual([1, 0])
  })

  it('movimento reduzido: a linha só muda — nada é desenhado e o ticker nem é ligado', () => {
    reduzido = true
    const fantasma = montar()
    fantasma.mostrar(ANTES)
    expect(desenhado()).toBe(false)
    expect(ticker.count).toBe(0)
    expect(fantasma.emCurso()).toBe(false)
    expect(avisos).toEqual([])
  })

  it('o movimento reduzido é lido a cada endireitar: ligado com o app aberto, vale já no seguinte', () => {
    const fantasma = montar()
    fantasma.mostrar(ANTES)
    reduzido = true
    fantasma.mostrar(ANTES)
    expect(desenhado()).toBe(false)
    expect(ticker.count).toBe(0)
  })

  it('outro endireitar no meio troca o fantasma e recomeça a conta, com um ouvinte só no ticker', () => {
    const fantasma = montar()
    fantasma.mostrar(ANTES)
    quadro(120)
    const outra: GhostStroke[] = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 8 },
      ],
    ]
    fantasma.mostrar(outra)
    expect(graphics.alpha).toBe(ENDIREITAR_FANTASMA_ALPHA)
    expect(ticker.count).toBe(1)
    quadro(100)
    expect(desenhado()).toBe(true)
    quadro(50)
    expect(desenhado()).toBe(false)
  })

  it('parar (desmonte do canvas): limpa e desliga; parar sem fantasma não faz nada', () => {
    const fantasma = montar()
    fantasma.parar()
    expect(avisos).toEqual([])
    fantasma.mostrar(ANTES)
    fantasma.parar()
    expect(desenhado()).toBe(false)
    expect(ticker.count).toBe(0)
    expect(avisos).toEqual([1, 0])
  })

  it('sem traço nenhum, nada acontece', () => {
    const fantasma = montar()
    fantasma.mostrar([])
    expect(desenhado()).toBe(false)
    expect(ticker.count).toBe(0)
    expect(avisos).toEqual([])
  })
})
