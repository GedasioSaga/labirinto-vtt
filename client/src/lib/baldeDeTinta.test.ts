import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint, MapData, Wall } from '../types/map'
import { areaDoBalde, baldeDeTintaNoPonto, ehPinturaDeBalde, inserirPinturaDeBalde } from './baldeDeTinta'

/** Mapa 10x10 de 70 px: 700x700 px de mundo, uma célula de balde por px. */
function mapa(drawings: Drawing[], extra: Partial<Pick<MapData, 'walls' | 'lines' | 'regions'>> = {}) {
  return { width: 10, height: 10, grid: 70, drawings, ...extra }
}

/** Mapa 100x100 de 70 px (o do print): célula de balde de 3,5 px, a escadinha aparece. */
function mapaGrande(drawings: Drawing[], walls: Wall[] = []) {
  return { width: 100, height: 100, grid: 70, drawings, walls }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, thickness?: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, thickness }
}

/** Caminho fechado feito à mão: `lados` pontos num círculo, repetindo o primeiro no fim. */
function circuloAMao(id: string, cx: number, cy: number, raio: number, lados: number): Drawing {
  const points: DrawingPoint[] = []
  for (let i = 0; i <= lados; i += 1) {
    const angulo = (2 * Math.PI * (i % lados)) / lados
    points.push({ x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo) })
  }
  return { id, kind: 'freehand', points, color: '#000000', width: 4 }
}

function distanciaAoSegmento(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const tamanho2 = dx * dx + dy * dy
  const t = tamanho2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / tamanho2))
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y)
}

/** Distância de `p` ao contorno fechado `anel` (eixo dos traços). */
function distanciaAoContorno(p: DrawingPoint, anel: DrawingPoint[]): number {
  let menor = Infinity
  for (let i = 0; i < anel.length; i += 1) menor = Math.min(menor, distanciaAoSegmento(p, anel[i], anel[(i + 1) % anel.length]))
  return menor
}

/** Área par-ou-ímpar de um anel só (o buraco de fechadura soma zero). */
function area(pontos: DrawingPoint[]): number {
  let soma = 0
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    soma += a.x * b.y - b.x * a.y
  }
  return Math.abs(soma / 2)
}

/** Dois lados não vizinhos que se cruzam de verdade (encostar e sobrepor não conta). */
function temCruzamento(pontos: DrawingPoint[]): boolean {
  const lado = (a: DrawingPoint, b: DrawingPoint, c: DrawingPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const n = pontos.length
  for (let i = 0; i < n; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % n]
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue
      const c = pontos[j]
      const d = pontos[(j + 1) % n]
      const d1 = lado(a, b, c)
      const d2 = lado(a, b, d)
      const d3 = lado(c, d, a)
      const d4 = lado(c, d, b)
      const folga = 1e-6
      if (((d1 > folga && d2 < -folga) || (d1 < -folga && d2 > folga)) && ((d3 > folga && d4 < -folga) || (d3 < -folga && d4 > folga))) return true
    }
  }
  return false
}

function retangulo(id: string, x: number, y: number, w: number, h: number): Drawing {
  return { id, kind: 'rect', x, y, w, h, color: '#000000', width: 4, filled: false, fillAlpha: 0 }
}

/** Par-ou-ímpar, a mesma regra do preenchimento do Pixi. */
function dentro(pontos: DrawingPoint[], x: number, y: number): boolean {
  let dentroDoPoligono = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const a = pontos[i]
    const b = pontos[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentroDoPoligono = !dentroDoPoligono
  }
  return dentroDoPoligono
}

describe('areaDoBalde', () => {
  it('enche o interior de um retângulo desenhado e para no traço', () => {
    const area = areaDoBalde(mapa([retangulo('r', 100, 100, 200, 200)]), { x: 200, y: 200 })
    expect(area).not.toBeNull()
    const pontos = area ?? []
    expect(dentro(pontos, 200, 200)).toBe(true)
    expect(dentro(pontos, 110, 290)).toBe(true)
    expect(dentro(pontos, 50, 50)).toBe(false)
    expect(dentro(pontos, 350, 200)).toBe(false)
    for (const p of pontos) {
      expect(p.x).toBeGreaterThanOrEqual(96)
      expect(p.x).toBeLessThanOrEqual(304)
      expect(p.y).toBeGreaterThanOrEqual(96)
      expect(p.y).toBeLessThanOrEqual(304)
    }
  })

  it('enche um quadrado feito à mão com o Pincel', () => {
    const quadrado: Drawing = {
      id: 'f',
      kind: 'freehand',
      points: [{ x: 400, y: 400 }, { x: 600, y: 400 }, { x: 600, y: 600 }, { x: 400, y: 600 }, { x: 400, y: 400 }],
      color: '#000000',
      width: 6,
    }
    const pontos = areaDoBalde(mapa([quadrado]), { x: 500, y: 500 }) ?? []
    expect(dentro(pontos, 500, 500)).toBe(true)
    expect(dentro(pontos, 300, 300)).toBe(false)
  })

  it('enche em volta de uma forma fechada lá dentro e deixa o buraco vazio', () => {
    const drawings = [retangulo('fora', 100, 100, 400, 400), retangulo('dentro', 250, 250, 100, 100)]
    const pontos = areaDoBalde(mapa(drawings), { x: 150, y: 150 }) ?? []
    expect(dentro(pontos, 150, 150)).toBe(true)
    expect(dentro(pontos, 450, 450)).toBe(true)
    expect(dentro(pontos, 300, 200)).toBe(true)
    expect(dentro(pontos, 300, 300)).toBe(false)
    expect(dentro(pontos, 50, 50)).toBe(false)
  })

  it('deixa vários buracos vazios, inclusive dois na mesma altura', () => {
    const drawings = [
      retangulo('fora', 50, 50, 600, 600),
      retangulo('a', 150, 150, 80, 80),
      retangulo('b', 400, 150, 80, 80),
      retangulo('c', 250, 400, 120, 60),
    ]
    const pontos = areaDoBalde(mapa(drawings), { x: 100, y: 600 }) ?? []
    expect(dentro(pontos, 100, 600)).toBe(true)
    expect(dentro(pontos, 320, 190)).toBe(true)
    expect(dentro(pontos, 600, 100)).toBe(true)
    expect(dentro(pontos, 190, 190)).toBe(false)
    expect(dentro(pontos, 440, 190)).toBe(false)
    expect(dentro(pontos, 310, 430)).toBe(false)
  })

  it('sem nenhum traço enche o mapa inteiro até a borda', () => {
    const pontos = areaDoBalde(mapa([]), { x: 10, y: 10 }) ?? []
    expect(dentro(pontos, 1, 1)).toBe(true)
    expect(dentro(pontos, 699, 699)).toBe(true)
  })

  it('para em parede, linha do mapa e borda de sala', () => {
    const walls = [
      { id: 'w', x1: 0, y1: 200, x2: 700, y2: 200, blocksLight: true, blocksMove: true, door: null },
    ] as unknown as MapData['walls']
    const pontos = areaDoBalde(mapa([], { walls }), { x: 100, y: 100 }) ?? []
    expect(dentro(pontos, 100, 100)).toBe(true)
    expect(dentro(pontos, 100, 300)).toBe(false)
  })

  it('não enche quando o clique cai em cima do traço ou fora do mapa', () => {
    const map = mapa([retangulo('r', 100, 100, 200, 200)])
    expect(areaDoBalde(map, { x: 100, y: 200 })).toBeNull()
    expect(areaDoBalde(map, { x: -5, y: 10 })).toBeNull()
    expect(areaDoBalde(map, { x: 800, y: 10 })).toBeNull()
  })

  it('atravessa a tinta de um balde anterior', () => {
    const tinta: Drawing = {
      id: 't',
      kind: 'polygon',
      points: [{ x: 150, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 250 }, { x: 150, y: 250 }],
      color: '#ff0000',
      width: 0,
      filled: true,
      fillAlpha: 1,
    }
    const pontos = areaDoBalde(mapa([tinta, retangulo('r', 100, 100, 200, 200)]), { x: 120, y: 120 }) ?? []
    expect(dentro(pontos, 200, 200)).toBe(true)
    expect(dentro(pontos, 280, 280)).toBe(true)
  })
})

describe('borda da pintura', () => {
  /** Sala de 5 paredes com o canto de cima à direita cortado na diagonal (como no print). */
  const cantosDaSala: DrawingPoint[] = [
    { x: 700, y: 700 },
    { x: 2000, y: 700 },
    { x: 2600, y: 1300 },
    { x: 2600, y: 2400 },
    { x: 700, y: 2400 },
  ]
  const paredesDaSala = cantosDaSala.map((a, i) => {
    const b = cantosDaSala[(i + 1) % cantosDaSala.length]
    return parede(`p${i}`, a.x, a.y, b.x, b.y)
  })

  it('parede diagonal vira uma aresta só, no eixo da parede, sem degrau e sem passar para o outro lado', () => {
    const pontos = areaDoBalde(mapaGrande([], paredesDaSala), { x: 1500, y: 1500 }) ?? []
    expect(pontos.length).toBeGreaterThanOrEqual(5)
    expect(pontos.length).toBeLessThanOrEqual(8)
    for (const p of pontos) expect(distanciaAoContorno(p, cantosDaSala)).toBeLessThan(0.05)
    const diagonal = pontos.some((a, i) => {
      const b = pontos[(i + 1) % pontos.length]
      const naParede = (p: DrawingPoint) => distanciaAoSegmento(p, cantosDaSala[1], cantosDaSala[2]) < 0.05
      return naParede(a) && naParede(b) && Math.hypot(b.x - a.x, b.y - a.y) > 0.99 * Math.hypot(600, 600)
    })
    expect(diagonal).toBe(true)
  })

  it('a tinta enche a sala até o eixo das paredes, sem fresta', () => {
    const pontos = areaDoBalde(mapaGrande([], paredesDaSala), { x: 1500, y: 1500 }) ?? []
    const esperada = area(cantosDaSala)
    expect(Math.abs(area(pontos) - esperada) / esperada).toBeLessThan(0.001)
  })

  it('retângulo com um lado diagonal feito com o Pincel sai com os 4 cantos', () => {
    const cantos = [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 550, y: 350 }, { x: 100, y: 350 }]
    const forma: Drawing = { id: 'q', kind: 'polygon', points: cantos, color: '#000000', width: 4, filled: false, fillAlpha: 0 }
    const pontos = areaDoBalde(mapa([forma]), { x: 200, y: 200 }) ?? []
    expect(pontos.length).toBeGreaterThanOrEqual(4)
    expect(pontos.length).toBeLessThanOrEqual(6)
    for (const canto of cantos) expect(Math.min(...pontos.map((p) => Math.hypot(p.x - canto.x, p.y - canto.y)))).toBeLessThan(0.05)
    for (const p of pontos) expect(distanciaAoContorno(p, cantos)).toBeLessThan(0.05)
  })

  it.each([['célula de 1 px', mapa], ['célula de 3,5 px', mapaGrande]])('círculo feito à mão continua redondo, com a borda no eixo do traço (%s)', (_, criarMapa) => {
    const raio = 150
    const pontos = areaDoBalde(criarMapa([circuloAMao('c', 350, 350, raio, 72)]), { x: 350, y: 350 }) ?? []
    expect(pontos.length).toBeGreaterThanOrEqual(24)
    expect(pontos.length).toBeLessThanOrEqual(80)
    for (const p of pontos) expect(Math.abs(Math.hypot(p.x - 350, p.y - 350) - raio)).toBeLessThan(0.3)
    // A corda entre dois vértices não afunda no arco mais que a meia espessura
    // do traço (2 px), com folga: a falha fica escondida embaixo da linha.
    pontos.forEach((a, i) => {
      const b = pontos[(i + 1) % pontos.length]
      expect(Math.hypot((a.x + b.x) / 2 - 350, (a.y + b.y) / 2 - 350)).toBeGreaterThan(raio - 1.5)
    })
    expect(Math.abs(area(pontos) - Math.PI * raio * raio) / (Math.PI * raio * raio)).toBeLessThan(0.015)
  })

  it.each([['célula de 1 px', mapa], ['célula de 3,5 px', mapaGrande]])('buraco feito à mão continua buraco, com a borda no eixo e sem cruzamento (%s)', (_, criarMapa) => {
    const raio = 100
    const drawings = [retangulo('fora', 100, 100, 500, 500), circuloAMao('c', 350, 350, raio, 72)]
    const pontos = areaDoBalde(criarMapa(drawings), { x: 150, y: 150 }) ?? []
    expect(dentro(pontos, 150, 150)).toBe(true)
    expect(dentro(pontos, 560, 560)).toBe(true)
    expect(dentro(pontos, 350, 350)).toBe(false)
    expect(dentro(pontos, 350, 260)).toBe(false)
    expect(temCruzamento(pontos)).toBe(false)
    for (const p of pontos) {
      const doCirculo = Math.abs(Math.hypot(p.x - 350, p.y - 350) - raio)
      if (doCirculo < 5) expect(doCirculo).toBeLessThan(0.3)
    }
    // Do lado de fora do círculo a corda entra nele: nunca além da meia
    // espessura do traço (2 px), com folga.
    pontos.forEach((a, i) => {
      const b = pontos[(i + 1) % pontos.length]
      const meio = Math.hypot((a.x + b.x) / 2 - 350, (a.y + b.y) / 2 - 350)
      if (Math.abs(meio - raio) < 5) expect(meio).toBeGreaterThan(raio - 1.5)
    })
    expect(pontos.length).toBeLessThanOrEqual(100)
    const esperada = 500 * 500 - Math.PI * raio * raio
    expect(Math.abs(area(pontos) - esperada) / esperada).toBeLessThan(0.01)
  })

  it('toco de parede saindo da parede da sala e parede solta no meio: a tinta passa por baixo, sem espinho', () => {
    const walls = [...paredesDaSala, parede('toco', 1200, 2400, 1200, 2000), parede('solta', 1500, 1200, 1900, 1500)]
    const pontos = areaDoBalde(mapaGrande([], walls), { x: 1000, y: 1000 }) ?? []
    expect(pontos.length).toBeLessThanOrEqual(8)
    expect(temCruzamento(pontos)).toBe(false)
    for (const p of pontos) expect(distanciaAoContorno(p, cantosDaSala)).toBeLessThan(0.05)
    const esperada = area(cantosDaSala)
    expect(Math.abs(area(pontos) - esperada) / esperada).toBeLessThan(0.001)
  })

  it('diagonal que corta o canto do mapa: a borda segue a borda do mapa até o eixo', () => {
    const pontos = areaDoBalde(mapaGrande([], [parede('d', -100, 400, 400, -100)]), { x: 50, y: 50 }) ?? []
    expect(pontos.length).toBe(3)
    const cantos = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 300 }]
    for (const canto of cantos) expect(Math.min(...pontos.map((p) => Math.hypot(p.x - canto.x, p.y - canto.y)))).toBeLessThan(0.05)
  })

  it('sala de muralha: os cantos ficam no encontro dos eixos', () => {
    const walls = paredesDaSala.map((w) => ({ ...w, thickness: 48 }))
    const pontos = areaDoBalde(mapaGrande([], walls), { x: 1500, y: 1500 }) ?? []
    expect(pontos.length).toBe(5)
    for (const canto of cantosDaSala) expect(Math.min(...pontos.map((p) => Math.hypot(p.x - canto.x, p.y - canto.y)))).toBeLessThan(0.05)
  })

  it('rabiscos que se cruzam perto de paredes: o polígono nunca se cruza e cobre o clique', () => {
    // Sorteio fixo (LCG): o mesmo emaranhado em toda rodada.
    let semente = 127
    const sorteio = () => {
      semente = (semente * 1664525 + 1013904223) % 4294967296
      return semente / 4294967296
    }
    for (let cena = 0; cena < 8; cena += 1) {
      const walls: Wall[] = []
      for (let i = 0; i < 6; i += 1) {
        const x = sorteio() * 700
        const y = sorteio() * 700
        walls.push(parede(`w${i}`, x, y, x + (sorteio() - 0.5) * 600, y + (sorteio() - 0.5) * 600, sorteio() < 0.3 ? 4 + sorteio() * 30 : undefined))
      }
      const drawings: Drawing[] = []
      for (let i = 0; i < 3; i += 1) {
        const points: DrawingPoint[] = [{ x: sorteio() * 700, y: sorteio() * 700 }]
        for (let k = 0; k < 40; k += 1) {
          const ultimo = points[points.length - 1]
          points.push({ x: ultimo.x + (sorteio() - 0.5) * 30, y: ultimo.y + (sorteio() - 0.5) * 30 })
        }
        drawings.push({ id: `f${i}`, kind: 'freehand', points, color: '#000000', width: 1 + sorteio() * 8 })
      }
      for (let k = 0; k < 3; k += 1) {
        const clique = { x: sorteio() * 700, y: sorteio() * 700 }
        const pontos = areaDoBalde(mapa(drawings, { walls }), clique)
        if (!pontos) continue
        expect(temCruzamento(pontos)).toBe(false)
        expect(dentro(pontos, clique.x, clique.y)).toBe(true)
      }
    }
  })

  it('parede grossa: a tinta vai só até o eixo, e a fresta que a espessura cobre não deixa passar', () => {
    const walls = [parede('a', 0, 350, 330, 350, 40), parede('b', 350, 350, 700, 350, 40)]
    const pontos = areaDoBalde(mapa([], { walls }), { x: 100, y: 100 }) ?? []
    expect(dentro(pontos, 100, 100)).toBe(true)
    expect(dentro(pontos, 340, 345)).toBe(true)
    expect(dentro(pontos, 340, 360)).toBe(false)
    expect(dentro(pontos, 100, 600)).toBe(false)
    for (const p of pontos) expect(p.y).toBeLessThanOrEqual(350.05)
    expect(pontos.length).toBeLessThanOrEqual(6)
  })
})

describe('baldeDeTintaNoPonto', () => {
  it('cria um polígono cheio, sem traço, com a cor do desenho', () => {
    const pintura = baldeDeTintaNoPonto(mapa([retangulo('r', 100, 100, 200, 200)]), { x: 200, y: 200 }, '#3366ff', 'novo')
    expect(pintura).toMatchObject({ id: 'novo', kind: 'polygon', color: '#3366ff', width: 0, filled: true, fillAlpha: 1 })
    expect(pintura && ehPinturaDeBalde(pintura)).toBe(true)
  })

  it('devolve null quando não há o que encher', () => {
    expect(baldeDeTintaNoPonto(mapa([]), { x: -1, y: -1 }, '#3366ff', 'novo')).toBeNull()
  })
})

describe('inserirPinturaDeBalde', () => {
  const tinta = (id: string): Drawing => ({ id, kind: 'polygon', points: [], color: '#f00', width: 0, filled: true, fillAlpha: 1 })

  it('põe a pintura antes de todo traço quando ainda não há tinta', () => {
    const lista = inserirPinturaDeBalde([retangulo('a', 0, 0, 1, 1), retangulo('b', 0, 0, 1, 1)], tinta('t'))
    expect(lista.map((d) => d.id)).toEqual(['t', 'a', 'b'])
  })

  it('põe a pintura nova logo depois da última tinta, ainda por baixo dos traços', () => {
    const lista = inserirPinturaDeBalde([tinta('t1'), retangulo('a', 0, 0, 1, 1), tinta('t2'), retangulo('b', 0, 0, 1, 1)], tinta('t3'))
    expect(lista.map((d) => d.id)).toEqual(['t1', 'a', 't2', 't3', 'b'])
  })
})
