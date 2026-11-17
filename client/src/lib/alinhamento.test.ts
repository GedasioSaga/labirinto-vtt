import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { buildWallFromDraft } from './drawingFactory'
import type { Region, RegionPoint, Wall } from '../types/map'
import {
  alinhamentoDaSala, alinhamentoDoSegmento, endireitarPoligono, giroComGrude, grudarPonto, paredesTortasDoPiso, planoDeEndireitarSala,
  rotuloDoAlinhamento, salaRedonda, segmentoReto,
} from './alinhamento'

/** Ponto a `graus` e `raio` px de `centro` — y para baixo, como na tela. */
function aoRedor(centro: RegionPoint, graus: number, raio: number): RegionPoint {
  const rad = (graus * Math.PI) / 180
  return { x: centro.x + raio * Math.cos(rad), y: centro.y + raio * Math.sin(rad) }
}

const ORIGEM = { x: 100, y: 100 }

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { ...buildWallFromDraft(id, { x: x1, y: y1 }, { x: x2, y: y2 }), ...extra }
}

function sala(id: string, points: RegionPoint[], room: Region['room']): Region {
  return { id, points, tag: '', fillColor: '#444444', fillPattern: 'solid', data: {}, room }
}

describe('alinhamentoDoSegmento e o selo', () => {
  it('reta em 0°, 45° e 90°; torta a poucos graus; inclinada longe de toda reta', () => {
    expect(rotuloDoAlinhamento(alinhamentoDoSegmento(ORIGEM, { x: 100, y: 400 }))).toBe('reta ✓')
    expect(segmentoReto(ORIGEM, { x: 300, y: 300 })).toBe(true)
    expect(rotuloDoAlinhamento(alinhamentoDoSegmento(ORIGEM, aoRedor(ORIGEM, 93, 300)))).toBe('torta 3°')
    expect(rotuloDoAlinhamento(alinhamentoDoSegmento(ORIGEM, aoRedor(ORIGEM, 210, 300)))).toBe('inclinada 30°')
  })

  it('abaixo de um grau o selo mostra a casa decimal, e o ruído de conta de um giro conta como reta', () => {
    expect(rotuloDoAlinhamento(alinhamentoDoSegmento(ORIGEM, aoRedor(ORIGEM, 0.4, 300)))).toBe('torta 0,4°')
    expect(segmentoReto(ORIGEM, { x: 400, y: 100.0000000001 })).toBe(true)
  })
})

describe('grudarPonto: uma âncora (desenhar parede, puxar a ponta)', () => {
  it('a 3° de 90° a ponta vai para a reta, com o x copiado da âncora e o y do ponteiro', () => {
    const puxada = aoRedor(ORIGEM, 87, 300)
    const { ponto, grudou } = grudarPonto(puxada, [ORIGEM], 12)
    expect(grudou).toBe(true)
    expect(ponto.x).toBe(ORIGEM.x)
    expect(ponto.y).toBe(puxada.y)
    const diagonal = grudarPonto(aoRedor(ORIGEM, 43, 300), [ORIGEM], 12).ponto
    expect(Math.abs(diagonal.x - ORIGEM.x)).toBeCloseTo(Math.abs(diagonal.y - ORIGEM.y), 9)
  })

  it('a 8° fica onde a mão pôs, e o traço curto demais também, mesmo quase reto', () => {
    const longe = aoRedor(ORIGEM, 82, 300)
    expect(grudarPonto(longe, [ORIGEM], 12)).toEqual({ ponto: longe, grudou: false })
    const curto = aoRedor(ORIGEM, 87, 8)
    expect(grudarPonto(curto, [ORIGEM], 12)).toEqual({ ponto: curto, grudou: false })
  })
})

describe('grudarPonto: duas âncoras (o vértice da sala e os dois vizinhos)', () => {
  it('os dois lados quase retos: o vértice vai para o canto reto, o cruzamento das duas retas', () => {
    const anterior = { x: 100, y: 100 }
    const proximo = { x: 400, y: 300 }
    expect(grudarPonto({ x: 396, y: 104 }, [anterior, proximo], 12)).toEqual({ ponto: { x: 400, y: 100 }, grudou: true })
  })

  it('só um lado quase reto: o vértice vai para a reta dele e o outro lado fica inclinado', () => {
    const anterior = { x: 100, y: 100 }
    const proximo = { x: 500, y: 300 }
    expect(grudarPonto({ x: 396, y: 104 }, [anterior, proximo], 12)).toEqual({ ponto: { x: 396, y: 100 }, grudou: true })
  })
})

describe('giroComGrude: a alça de girar a sala', () => {
  it('a menos de 5° do quarto de volta gruda nele; fora disso anda de grau em grau', () => {
    expect(giroComGrude(3.4, false, false)).toBe(0)
    expect(giroComGrude(-86.2, false, false)).toBe(-90)
    expect(giroComGrude(176, false, false)).toBe(180)
    expect(giroComGrude(37.4, false, false)).toBe(37)
  })

  it('Ctrl solta (3° de propósito) e o Shift continua de 15 em 15', () => {
    expect(giroComGrude(3.4, false, true)).toBe(3)
    expect(giroComGrude(37.4, true, false)).toBe(30)
  })
})

describe('endireitarPoligono', () => {
  it('sala em L torta vira um L reto, com os cantos que estavam na grade parados', () => {
    const torta = [
      { x: 0, y: 0 }, { x: 320, y: 6 }, { x: 318, y: 192 }, { x: 128, y: 196 }, { x: 131, y: 384 }, { x: 4, y: 384 },
    ]
    expect(endireitarPoligono(torta, 64)).toEqual([
      { x: 0, y: 0 }, { x: 320, y: 0 }, { x: 320, y: 192 }, { x: 128, y: 192 }, { x: 128, y: 384 }, { x: 0, y: 384 },
    ])
  })

  it('quina chanfrada a 43° fica a 45°, e a sala já reta e a redonda voltam pelo mesmo array', () => {
    const chanfrada = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 93 }, { x: 400, y: 300 }, { x: 0, y: 300 }]
    const reta = endireitarPoligono(chanfrada, 0)
    expect(alinhamentoDaSala(reta)).toEqual({ estado: 'reta' })
    expect(reta[0]).toEqual({ x: 0, y: 0 })

    const jaReta = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }]
    expect(endireitarPoligono(jaReta, 64)).toBe(jaReta)
    const redonda = Array.from({ length: 64 }, (_, i) => aoRedor(ORIGEM, (i * 360) / 64 + 2.8, 200))
    expect(salaRedonda(redonda)).toBe(true)
    expect(endireitarPoligono(redonda, 64)).toBe(redonda)
  })
})

describe('planoDeEndireitarSala', () => {
  it('sala retangular girada 3° volta girando −3°; a girada 30° de propósito fica', () => {
    const girada = [{ x: 0, y: 0 }, { x: 200, y: 10 }, { x: 195, y: 110 }, { x: -5, y: 100 }]
    expect(planoDeEndireitarSala({ points: girada, room: { shape: 'rect', name: '', rotation: 3 } }, 64)).toEqual({ tipo: 'giro', graus: -3 })
    const inclinada = [ORIGEM, aoRedor(ORIGEM, 30, 200), aoRedor(aoRedor(ORIGEM, 30, 200), 120, 100), aoRedor(ORIGEM, 120, 100)]
    expect(planoDeEndireitarSala({ points: inclinada, room: { shape: 'rect', name: '', rotation: 30 } }, 64)).toBeNull()
  })

  it('polígono torto ganha os cantos novos, na mesma ordem e quantidade', () => {
    const torto = [{ x: 0, y: 0 }, { x: 256, y: 5 }, { x: 256, y: 128 }, { x: 0, y: 128 }]
    const plano = planoDeEndireitarSala({ points: torto, room: { shape: 'polygon', name: '' } }, 64)
    expect(plano).toEqual({ tipo: 'pontos', pontos: [{ x: 0, y: 0 }, { x: 256, y: 0 }, { x: 256, y: 128 }, { x: 0, y: 128 }] })
  })
})

describe('paredesTortasDoPiso: o "Mostrar paredes tortas"', () => {
  it('acha a de 3°, e deixa a reta, a de meio grau e a diagonal de 30°', () => {
    const fim = aoRedor(ORIGEM, 3, 300)
    const meio = aoRedor(ORIGEM, 0.5, 300)
    const longe = aoRedor(ORIGEM, 30, 300)
    const map = {
      ...createEmptyMap('m_tortas', 'Tortas', 30, 20, 64),
      walls: [
        parede('torta', ORIGEM.x, ORIGEM.y, fim.x, fim.y),
        parede('reta', 0, 0, 0, 300),
        parede('meio-grau', ORIGEM.x, ORIGEM.y, meio.x, meio.y),
        parede('inclinada', ORIGEM.x, ORIGEM.y, longe.x, longe.y),
      ],
    }
    expect(paredesTortasDoPiso(map, 0).map((w) => w.id)).toEqual(['torta'])
  })

  it('ficam de fora a parede de outro piso, a que segue um desenho e a de sala redonda', () => {
    const fim = aoRedor(ORIGEM, 3, 300)
    const redonda = Array.from({ length: 64 }, (_, i) => aoRedor(ORIGEM, (i * 360) / 64 + 2.8, 200))
    const map = {
      ...createEmptyMap('m_tortas', 'Tortas', 30, 20, 64),
      regions: [sala('circulo', redonda, { shape: 'polygon', name: '' })],
      walls: [
        parede('de-cima', ORIGEM.x, ORIGEM.y, fim.x, fim.y, { piso: 1 }),
        parede('do-pincel', ORIGEM.x, ORIGEM.y, fim.x, fim.y, { desenhoId: 'd1' }),
        parede('do-circulo', redonda[0].x, redonda[0].y, redonda[1].x, redonda[1].y, { regionId: 'circulo', regionEdgeIndex: 0 }),
      ],
    }
    expect(paredesTortasDoPiso(map, 0)).toEqual([])
  })
})
