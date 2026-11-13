import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FloorPiece } from '../types/map'
import { materiaisContados, passosDosMateriais, type PedidoDoTerreno } from './contornoDoTerreno'
import { buildCaminhoShape, passosDoTerreno, pecasDoContorno } from './terrenoDoChao'

/**
 * O CONTORNO DO TERRENO NO WORKER (FX-CAMINHO2-062): os passos que a tela
 * recebe do worker são os MESMOS da conta na página (byte a byte), o worker só
 * recebe as peças que contam, e sem worker (ou com ele quebrado) a conta é a de
 * sempre, na página.
 */

const G = 64
const CLIP = { minX: 0, minY: 0, maxX: 20 * G, maxY: 14 * G }

function caminho(id: string, material: string, pontos: Array<[number, number]>, extra: Partial<FloorPiece> = {}): FloorPiece {
  const shape = buildCaminhoShape(
    pontos.map(([x, y]) => ({ x: x * G, y: y * G })),
    1.5 * G,
    G,
  )
  if (shape === null) throw new Error('caminho sem forma')
  return { id, shape, op: 'add', modifiers: {}, material, borda: 0.6, ...extra }
}

function ret(id: string, cx: number, cy: number, w: number, h: number, extra: Partial<FloorPiece> = {}): FloorPiece {
  return { id, shape: { kind: 'rect', cx: cx * G, cy: cy * G, w: w * G, h: h * G }, op: 'add', modifiers: {}, ...extra }
}

/** Liso, buraco antes de todo material, calçamento com pedras, terra cruzando, escondida e buraco depois. */
function chao(materialDaTrilha = 'terra'): FloorPiece[] {
  return [
    ret('liso', 10, 7, 20, 14),
    ret('buraco-antes', 3, 3, 2, 2, { op: 'subtract' }),
    caminho('rua', 'calcamento', [[2, 7], [7, 4], [12, 9], [17, 6]]),
    caminho('trilha', materialDaTrilha, [[10, 1], [9, 7], [11, 13]]),
    caminho('escondida', 'cascalho', [[2, 12], [18, 12]], { hidden: true }),
    ret('buraco-depois', 12, 9, 1, 1, { op: 'subtract' }),
  ]
}

class WorkerFalso {
  static abertos: WorkerFalso[] = []
  onmessage: ((evento: MessageEvent) => void) | null = null
  onerror: ((evento: ErrorEvent) => void) | null = null
  readonly recebidos: PedidoDoTerreno[] = []
  fechado = false
  constructor() {
    WorkerFalso.abertos.push(this)
  }
  postMessage(pedido: PedidoDoTerreno): void {
    // O que atravessa para o worker de verdade é uma cópia estruturada.
    this.recebidos.push(structuredClone(pedido))
  }
  terminate(): void {
    this.fechado = true
  }
  responder(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
  WorkerFalso.abertos = []
})

describe('contorno do terreno no worker', () => {
  it('sem worker: os passos saem na hora, iguais aos de passosDoTerreno; só as peças que contam, e a ida e volta em Float64Array não muda um bit', async () => {
    const floor = chao()
    const contam = pecasDoContorno(floor)
    expect(contam.map((p) => p.id)).toEqual(['rua', 'trilha', 'buraco-depois'])
    const daLista = JSON.stringify(passosDoTerreno(floor, G, CLIP))
    expect(JSON.parse(daLista)).toHaveLength(2)
    expect(JSON.stringify(passosDoTerreno(contam, G, CLIP))).toBe(daLista)
    // O buraco de depois corta a rua de verdade (sem ele os passos seriam outros): o filtro não pode perdê-lo.
    expect(JSON.stringify(passosDoTerreno(contam.slice(0, 2), G, CLIP))).not.toBe(daLista)
    expect(JSON.stringify(passosDosMateriais(materiaisContados(structuredClone(contam), G, CLIP)))).toBe(daLista)

    // O jsdom não tem Worker: a conta é a de sempre, na hora (um array, não uma promessa).
    const { pedirTerreno } = await import('./terrenoNoWorker')
    const naHora = pedirTerreno(chao(), G, CLIP)
    expect(Array.isArray(naHora)).toBe(true)
    expect(JSON.stringify(naHora)).toBe(daLista)
  })

  it('com worker: um pedido por desenho, passos iguais, resposta torta ignorada, e com o worker quebrado a página conta', async () => {
    vi.stubGlobal('Worker', WorkerFalso)
    const { pedirTerreno } = await import('./terrenoNoWorker')
    const floor = chao()
    const esperado = JSON.stringify(passosDoTerreno(floor, G, CLIP))

    const primeiro = pedirTerreno(floor, G, CLIP)
    // O mesmo desenho numa lista nova, enquanto conta: espera a mesma conta.
    const mesmo = pedirTerreno(chao(), G, CLIP)
    expect(primeiro).toBeInstanceOf(Promise)
    expect(mesmo).toBeInstanceOf(Promise)
    const [worker] = WorkerFalso.abertos
    expect(WorkerFalso.abertos).toHaveLength(1)
    expect(worker.recebidos).toHaveLength(1)
    const [pedido] = worker.recebidos
    expect(pedido.pecas.map((p) => p.id)).toEqual(['rua', 'trilha', 'buraco-depois'])

    worker.responder({ tipo: 'pronto' })
    worker.responder({ tipo: 'terreno', pedido: pedido.pedido + 50, materiais: [] })
    worker.responder({ tipo: 'terreno', pedido: pedido.pedido, materiais: [{ textura: 'terra', pontos: [1, 2] }] })
    const conta = materiaisContados(pedido.pecas, pedido.grid, pedido.clip)
    worker.responder({ tipo: 'terreno', pedido: pedido.pedido, materiais: conta })
    expect(JSON.stringify(await primeiro)).toBe(esperado)
    expect(JSON.stringify(await mesmo)).toBe(esperado)
    // Já contado: na hora, sem pedido novo.
    const guardado = pedirTerreno(floor, G, CLIP)
    expect(Array.isArray(guardado)).toBe(true)
    expect(worker.recebidos).toHaveLength(1)

    // Outro desenho com o worker quebrando no meio: a página conta, igual à conta de sempre.
    const outro = chao('areia')
    const quebrou = pedirTerreno(outro, G, CLIP)
    expect(worker.recebidos).toHaveLength(2)
    worker.onerror?.(new ErrorEvent('error'))
    expect(worker.fechado).toBe(true)
    expect(JSON.stringify(await quebrou)).toBe(JSON.stringify(passosDoTerreno(outro, G, CLIP)))
  })
})
