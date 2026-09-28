import { describe, expect, it } from 'vitest'
import {
  MIN_TREAD_GAP_SCREEN_PX,
  STAIR_PERSPECTIVE_RATIO,
  landingDepth,
  planStairFlight,
  treadScreenCss,
  treadStations,
  type StairFlight,
} from './stairFlight'
import { computeStairPlan } from '../lib/stairs'
import type { StairDirection, StairSegment } from '../types/map'
import type { Point } from './world'

interface Opcoes {
  direction?: StairDirection
  scale?: number
  res?: number
  stepWidth?: number
}

function planejar(segment: StairSegment, { direction = 'up', scale = 1, res = 1, stepWidth = 64 }: Opcoes = {}): StairFlight {
  const flight = planStairFlight(segment, stepWidth, direction, scale, res)
  if (flight === null) throw new Error('lance válido devolveu null')
  return flight
}

interface Caixa {
  x0: number
  x1: number
  y0: number
  y1: number
}

function caixa(pontos: readonly Point[]): Caixa {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/** `toEqual` separa 0 de -0; a geometria espelhada produz os dois. */
function esperarCaixa(real: Caixa, esperada: Caixa): void {
  expect(real.x0).toBeCloseTo(esperada.x0, 9)
  expect(real.x1).toBeCloseTo(esperada.x1, 9)
  expect(real.y0).toBeCloseTo(esperada.y0, 9)
  expect(real.y1).toBeCloseTo(esperada.y1, 9)
}

function patamarDe(flight: StairFlight): Caixa {
  if (flight.landing === null) throw new Error('lance sem patamar')
  return caixa(flight.landing)
}

const horizontal = (comprimento: number): StairSegment => ({ x1: 0, y1: 0, x2: comprimento, y2: 0 })
/** Escada de uma casa: 64 x 64, o menor lance que o mestre desenha com um clique. */
const UMA_CASA = horizontal(64)

/** Início (borda de baixo) da faixa de cada degrau, do pé para o topo, num lance horizontal que sobe para +x. */
function iniciosDosDegraus(flight: StairFlight): number[] {
  return flight.treads.map(([a]) => a.x - flight.treadWidth / 2).sort((p, q) => p - q)
}

/**
 * Vãos de chão entre moldura, degraus e patamar, em px de TELA, do pé para o
 * topo — num lance horizontal que sobe para +x.
 */
function vaosNaTela(flight: StairFlight, scale: number): number[] {
  const moldura = caixa(flight.frame)
  const bordas = [moldura.x0 + flight.frameWidth / 2]
  for (const inicio of iniciosDosDegraus(flight)) bordas.push(inicio, inicio + flight.treadWidth)
  bordas.push(flight.landing === null ? moldura.x1 - flight.frameWidth / 2 : patamarDe(flight).x0)
  const vaos: number[] = []
  for (let i = 0; i < bordas.length; i += 2) vaos.push((bordas[i + 1] - bordas[i]) * scale)
  return vaos
}

describe('treadStations — degraus que se apertam no pé', () => {
  it('começa no pé, termina no patamar, e o vão cresce rumo ao topo', () => {
    const estacoes = treadStations(192, 21)
    expect(estacoes).toHaveLength(22)
    expect(estacoes[0]).toBe(0)
    expect(estacoes[21]).toBe(192)
    const vaos = estacoes.slice(1).map((n, i) => n - estacoes[i])
    expect(vaos[0]).toBeGreaterThan(0)
    for (let i = 1; i < vaos.length; i += 1) expect(vaos[i]).toBeGreaterThan(vaos[i - 1])
    expect(vaos[vaos.length - 1] / vaos[0]).toBeCloseTo(STAIR_PERSPECTIVE_RATIO, 6)
  })

  it('um intervalo só: o pé e o patamar', () => {
    expect(treadStations(40, 1)).toEqual([0, 40])
  })
})

describe('landingDepth e treadScreenCss', () => {
  it('o patamar tem a largura do lance, mas nunca passa de 1/4 do comprimento', () => {
    expect(landingDepth(256, 64)).toBe(64)
    expect(landingDepth(64, 64)).toBe(16)
    expect(landingDepth(1000, 64)).toBe(64)
  })

  it('degrau de 2 px de tela no zoom 1, e sempre entre 1 e 3 px', () => {
    expect(treadScreenCss(1)).toBe(2)
    expect(treadScreenCss(0.25)).toBe(1)
    expect(treadScreenCss(4)).toBe(3)
  })
})

describe('planStairFlight — lance reto de 4 casas subindo, zoom 1', () => {
  const flight = planejar(horizontal(256))

  it('a placa cobre o lance inteiro, na largura do lance', () => {
    esperarCaixa(caixa(flight.plate), { x0: 0, x1: 256, y0: -32, y1: 32 })
  })

  it('o patamar fica no TOPO (fim do traço), por dentro da moldura', () => {
    esperarCaixa(patamarDe(flight), { x0: 192, x1: 255, y0: -31, y1: 31 })
  })

  it('a moldura é um fio de 1 px por dentro da borda da placa', () => {
    expect(flight.frameWidth).toBe(1)
    esperarCaixa(caixa(flight.frame), { x0: 0.5, x1: 255.5, y0: -31.5, y1: 31.5 })
  })

  it('20 degraus de 2 px, cada um atravessando o lance de moldura a moldura', () => {
    expect(flight.treadWidth).toBe(2)
    expect(flight.treads).toHaveLength(20)
    for (const [a, b] of flight.treads) {
      expect(a.x).toBe(b.x)
      expect([a.y, b.y].sort((p, q) => p - q)).toEqual([-31, 31])
      expect(a.x).toBeGreaterThan(1)
      expect(a.x).toBeLessThan(192)
    }
  })

  it('degraus apertados no pé e folgados no topo: o último vão é bem maior que o primeiro', () => {
    const vaos = vaosNaTela(flight, 1)
    expect(vaos).toHaveLength(21)
    expect(vaos[vaos.length - 1]).toBeGreaterThanOrEqual(1.4 * vaos[0])
  })
})

describe('planStairFlight — o sentido está no desenho', () => {
  it('descer é o mesmo desenho espelhado: patamar no começo do traço, degraus apertados no fim', () => {
    const sobe = planejar(horizontal(256))
    const desce = planejar(horizontal(256), { direction: 'down' })
    esperarCaixa(patamarDe(desce), { x0: 1, x1: 64, y0: -31, y1: 31 })
    const centrosSobe = sobe.treads.map(([a]) => a.x).sort((p, q) => p - q)
    const centrosDesce = desce.treads.map(([a]) => 256 - a.x).sort((p, q) => p - q)
    expect(centrosDesce).toHaveLength(centrosSobe.length)
    centrosDesce.forEach((x, i) => expect(Math.abs(x - centrosSobe[i])).toBeLessThanOrEqual(1))
  })

  it('pé e topo são os de computeStairPlan: o patamar fica na ponta que ele chama de topo', () => {
    const segment: StairSegment = { x1: 10, y1: 20, x2: 200, y2: 20 }
    for (const direction of ['up', 'down'] as const) {
      const base = computeStairPlan(segment, 64, direction)
      if (base === null) throw new Error('lance válido devolveu null')
      const patamar = patamarDe(planejar(segment, { direction }))
      const centro = { x: (patamar.x0 + patamar.x1) / 2, y: (patamar.y0 + patamar.y1) / 2 }
      const ateTopo = Math.hypot(centro.x - base.top.x, centro.y - base.top.y)
      const atePe = Math.hypot(centro.x - base.foot.x, centro.y - base.foot.y)
      expect(ateTopo).toBeLessThan(atePe)
    }
  })

  it('lance mais longo tem mais degraus, e a escada de 1 casa ainda tem vários', () => {
    expect(planejar(horizontal(256)).treads.length).toBeGreaterThan(planejar(UMA_CASA).treads.length)
    expect(planejar(UMA_CASA).treads.length).toBeGreaterThanOrEqual(3)
  })

  it('lance largo e curto não vira pente: o degrau segue o lado menor', () => {
    expect(planejar(horizontal(64), { stepWidth: 256 }).treads.length).toBeGreaterThanOrEqual(3)
  })

  it('vertical: patamar na ponta de baixo quando sobe para +y, degraus deitados', () => {
    const flight = planejar({ x1: 0, y1: 0, x2: 0, y2: 256 })
    const patamar = patamarDe(flight)
    expect(patamar.y0).toBeCloseTo(192, 9)
    expect(patamar.y1).toBeCloseTo(255, 9)
    expect(flight.treads.length).toBeGreaterThan(0)
    for (const [a, b] of flight.treads) expect(a.y).toBeCloseTo(b.y, 9)
  })

  it('diagonal: degrau perpendicular ao lance, de moldura a moldura', () => {
    const flight = planejar({ x1: 0, y1: 0, x2: 100, y2: 100 })
    expect(flight.treads.length).toBeGreaterThan(0)
    for (const [a, b] of flight.treads) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      expect((dx + dy) / Math.SQRT2).toBeCloseTo(0, 9)
      expect(Math.hypot(dx, dy)).toBeCloseTo(62, 9)
    }
  })
})

describe('planStairFlight — tudo cai no pixel físico', () => {
  for (const res of [1, 1.25, 2]) {
    it(`zoom 1,3 em resolução ${res}: placa, patamar, degrau e moldura com borda em pixel inteiro`, () => {
      const scale = 1.3
      const ppw = scale * res
      const flight = planejar({ x1: 10, y1: 10, x2: 138, y2: 10 }, { scale, res })
      const placa = caixa(flight.plate)
      const patamar = patamarDe(flight)
      const moldura = caixa(flight.frame)
      const meioFio = flight.frameWidth / 2
      const bordas = [
        placa.x0, placa.x1, placa.y0, placa.y1,
        patamar.x0, patamar.x1, patamar.y0, patamar.y1,
        moldura.x0 - meioFio, moldura.x0 + meioFio, moldura.x1 - meioFio, moldura.x1 + meioFio,
        moldura.y0 - meioFio, moldura.y0 + meioFio, moldura.y1 - meioFio, moldura.y1 + meioFio,
      ]
      expect(flight.treads.length).toBeGreaterThan(0)
      for (const [a, b] of flight.treads) bordas.push(a.x - flight.treadWidth / 2, a.x + flight.treadWidth / 2, a.y, b.y)
      for (const borda of bordas) expect(Math.abs(borda * ppw - Math.round(borda * ppw))).toBeLessThan(1e-6)
    })
  }
})

describe('planStairFlight — de longe, menos degraus em vez de borrão', () => {
  const lances = [
    ['4 casas', horizontal(256)],
    ['1 casa', UMA_CASA],
  ] as const
  for (const scale of [0.25, 0.4]) {
    for (const [nome, segment] of lances) {
      it(`zoom ${scale}, ${nome}: todo vão de chão tem pelo menos ${MIN_TREAD_GAP_SCREEN_PX} px de tela`, () => {
        for (const vao of vaosNaTela(planejar(segment, { scale }), scale)) {
          expect(vao).toBeGreaterThanOrEqual(MIN_TREAD_GAP_SCREEN_PX - 1e-9)
        }
      })
    }
  }

  it('a 25% de zoom a escada de 1 casa ainda mostra degrau, e a de 4 casas mostra vários', () => {
    expect(planejar(UMA_CASA, { scale: 0.25 }).treads.length).toBeGreaterThanOrEqual(1)
    expect(planejar(horizontal(256), { scale: 0.25 }).treads.length).toBeGreaterThanOrEqual(3)
  })

  it('afastar só tira degraus: quem sobra a 25% já estava no zoom 1, no mesmo lugar', () => {
    const perto = iniciosDosDegraus(planejar(horizontal(256)))
    const longe = iniciosDosDegraus(planejar(horizontal(256), { scale: 0.25 }))
    expect(longe.length).toBeGreaterThan(0)
    for (const inicio of longe) expect(perto.some((x) => Math.abs(x - inicio) <= 2.5)).toBe(true)
  })

  it('degrau entre 1 e 3 px de tela em qualquer zoom', () => {
    for (const scale of [0.1, 0.25, 0.4, 0.5, 0.75, 1, 1.25, 2.5, 4]) {
      const naTela = planejar(horizontal(256), { scale }).treadWidth * scale
      expect(naTela).toBeGreaterThanOrEqual(1)
      expect(naTela).toBeLessThanOrEqual(3)
    }
  })
})

describe('planStairFlight — casos-limite', () => {
  it('lance de 1 px de largura: nenhum NaN e nenhum degrau', () => {
    const flight = planejar(horizontal(256), { stepWidth: 1 })
    const pontos = [...flight.plate, ...flight.frame, ...flight.treads.flat(), ...(flight.landing ?? [])]
    for (const p of pontos) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
    expect(flight.treads).toHaveLength(0)
  })

  it('largura zero, negativa ou inválida não trava: só a placa vazia, sem degrau nem patamar', () => {
    for (const stepWidth of [0, -5, Number.NaN]) {
      const flight = planejar(horizontal(256), { stepWidth })
      expect(flight.treads).toHaveLength(0)
      expect(flight.landing).toBeNull()
    }
  })

  it('comprimento zero: não há lance', () => {
    expect(planStairFlight({ x1: 5, y1: 5, x2: 5, y2: 5 }, 64, 'up')).toBeNull()
  })
})
