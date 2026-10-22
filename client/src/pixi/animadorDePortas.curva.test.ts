import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics, Ticker } from 'pixi.js'
import { createAnimadorDePortas, type MovimentoDasPortas } from './animadorDePortas'
import { esquecerAnimacoesDePortaDeFora, registrarAnimacaoDePorta } from '../portas/animacoesDePorta'
import { criarCurvaBezier } from '../portas/curvaBezier'
import type { EventoDeSomDaPorta } from '../portas/somDePorta'
import type { DoorState, Wall } from '../types/map'

/**
 * TEMPO E CURVA POR SENTIDO (22/10/2026): a animação do pacote diz quanto leva
 * para abrir e para fechar e com que curva. O animador anda no tempo e na
 * curva do sentido; inverter no meio parte de onde a porta está.
 */
const ABRIR = [0, 0, 1, 1] as const
const FECHAR = [0.33, 1, 0.68, 1] as const

function porta(door: Partial<DoorState> = {}): Wall {
  return { id: 'p', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', animacao: 'teste-curva', ...door } }
}

function relogio() {
  const ticker = new Ticker()
  let agora = 1000
  const som = vi.fn<(evento: EventoDeSomDaPorta) => void>()
  const movimento: MovimentoDasPortas = { ticker, reducedMotion: () => false, now: () => agora, som }
  return {
    ticker,
    movimento,
    som,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

/** Registra a animação de teste com um espião no desenhar: o último progresso pedido é onde a porta está. */
function registrar(extra: Record<string, unknown> = {}) {
  const desenhar = vi.fn()
  registrarAnimacaoDePorta({ id: 'teste-curva', nome: 'Teste', duracaoMs: 400, duracaoFecharMs: 200, curvaAbrir: [...ABRIR], curvaFechar: [...FECHAR], som: 'grade', desenhar, ...extra })
  const ultimo = () => {
    const chamadas = desenhar.mock.calls
    return chamadas.length === 0 ? null : (chamadas[chamadas.length - 1][2] as number)
  }
  return { desenhar, ultimo }
}

afterEach(() => esquecerAnimacoesDePortaDeFora())

describe('animadorDePortas — tempo e curva de cada sentido', () => {
  it('abre no tempo e na curva de abrir; fecha no tempo e na curva de fechar', () => {
    const { ultimo } = registrar()
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    quadro(100)
    // Curva de abrir linear: a 100 de 400 ms, um quarto do caminho.
    expect(ultimo()).toBeCloseTo(0.25, 6)
    quadro(300)
    expect(ticker.count).toBe(0)

    animador.desenhar(g, [porta()])
    quadro(100)
    // Fecha em 200 ms: na metade do tempo, a curva de fechar já andou o que ela diz.
    expect(ultimo()).toBeCloseTo(1 - criarCurvaBezier([...FECHAR])(0.5), 6)
    quadro(100)
    expect(ticker.count).toBe(0)
  })

  it('o progresso anda sempre no sentido do caminho, e inverter a 25, 50 e 75% parte dali mesmo', () => {
    for (const fracao of [0.25, 0.5, 0.75]) {
      const { ultimo } = registrar()
      const { movimento, quadro } = relogio()
      const g = new Graphics()
      const animador = createAnimadorDePortas(movimento)
      animador.desenhar(g, [porta()])
      animador.desenhar(g, [porta({ open: true })])
      quadro(400 * fracao)
      const antes = ultimo()
      if (antes === null) throw new Error('não desenhou')
      animador.desenhar(g, [porta()])
      // O primeiro quadro depois de inverter é o mesmo ponto: sem salto.
      expect(ultimo()).toBeCloseTo(antes, 9)
      let anterior = antes
      for (let i = 0; i < 30; i += 1) {
        quadro(10)
        const agora = ultimo()
        if (agora === null) break
        expect(agora).toBeLessThanOrEqual(anterior + 1e-9)
        anterior = agora
      }
      esquecerAnimacoesDePortaDeFora()
    }
  })

  it('o som do caminho leva `de` e a curva declarada do sentido', () => {
    registrar()
    const { movimento, som } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(som).toHaveBeenLastCalledWith({ tipo: 'abrir', som: 'grade', duracaoMs: 400, de: 0, curva: [...ABRIR] })
  })

  it('sem curva declarada (pacote de antes do campo): easeOutCubic, e o som vai sem curva', () => {
    const { ultimo } = registrar({ curvaAbrir: undefined, curvaFechar: undefined })
    const { movimento, som, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(som).toHaveBeenLastCalledWith({ tipo: 'abrir', som: 'grade', duracaoMs: 400, de: 0 })
    quadro(200)
    expect(ultimo()).toBeCloseTo(1 - 0.5 ** 3, 6)
  })
})
