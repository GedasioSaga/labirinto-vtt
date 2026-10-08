import { describe, expect, it } from 'vitest'
import type { Drawing, DrawingPoint } from '../types/map'
import {
  alcasDoDesenho,
  ancorasDaFechadura,
  arrastarPontoChave,
  douglasPeucker,
  inserirPontoChave,
  MAXIMO_DE_ALCAS,
  pontosChaveDoDesenho,
  removerPontoChave,
  type DesenhoPorPontos,
} from './pontosChave'

type Traco = Extract<Drawing, { kind: 'freehand' }>
type Poligono = Extract<Drawing, { kind: 'polygon' }>

function traco(points: DrawingPoint[], pontosChave?: number[]): Traco {
  return { id: 't', kind: 'freehand', points, color: '#000', width: 3, ...(pontosChave ? { pontosChave } : {}) }
}

function poligono(points: DrawingPoint[], pontosChave?: number[]): Poligono {
  return { id: 'p', kind: 'polygon', points, color: '#000', width: 2, filled: true, fillAlpha: 1, ...(pontosChave ? { pontosChave } : {}) }
}

/** Gerador pseudoaleatório fixo: o tremido da mão é o mesmo em toda rodada. */
function sorteador(semente: number): () => number {
  let s = semente
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * Rabisco em espiral feito à mão: duas voltas, raio de 30 a ~180 px, um ponto
 * a cada ~3 px (um pointermove a 60 Hz numa mão de ~180 px/s) e tremido de
 * até 1,2 px. É o caso que o pedido nomeia: não pode virar 200 alças nem 3.
 */
function espiralAMao(): DrawingPoint[] {
  const sorte = sorteador(7)
  const pontos: DrawingPoint[] = []
  let theta = 0
  while (theta < 4 * Math.PI) {
    const r = 30 + 12 * theta
    pontos.push({ x: 400 + r * Math.cos(theta) + (sorte() - 0.5) * 2.4, y: 400 + r * Math.sin(theta) + (sorte() - 0.5) * 2.4 })
    theta += 3 / r
  }
  return pontos
}

function comprimento(pontos: readonly DrawingPoint[]): number {
  let total = 0
  for (let i = 1; i < pontos.length; i += 1) total += Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y)
  return total
}

/** Traço reto de 0 a 200 em x, um ponto a cada 2 px (101 pontos). */
function retoDe0a200(): DrawingPoint[] {
  return Array.from({ length: 101 }, (_, i) => ({ x: i * 2, y: 0 }))
}

const suave = (t: number): number => t * t * (3 - 2 * t)

describe('douglasPeucker', () => {
  it('reta cheia de pontos: só as duas pontas', () => {
    expect(douglasPeucker(retoDe0a200(), 4)).toEqual([0, 100])
  })

  it('um L guarda o canto', () => {
    const pontos = [...Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 })), ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: (i + 1) * 10 }))]
    expect(douglasPeucker(pontos, 4)).toEqual([0, 10, 20])
  })

  it('todo ponto que sai fica a até `tolerancia` do trecho que o substitui', () => {
    const pontos = espiralAMao()
    const chaves = douglasPeucker(pontos, 4)
    for (let k = 0; k < chaves.length - 1; k += 1) {
      const a = pontos[chaves[k]]
      const b = pontos[chaves[k + 1]]
      for (let i = chaves[k] + 1; i < chaves[k + 1]; i += 1) {
        const p = pontos[i]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
        expect(Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))).toBeLessThanOrEqual(4 + 1e-9)
      }
    }
  })

  it('traço que volta por cima de si mesmo guarda a ponta da volta', () => {
    const pontos = [...Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 })), ...Array.from({ length: 6 }, (_, i) => ({ x: 90 - i * 10, y: 0 }))]
    expect(douglasPeucker(pontos, 4)).toEqual([0, 10, 16])
  })
})

describe('pontosChaveDoDesenho — traço do Pincel', () => {
  it('espiral feita à mão: uma alça a cada 30-60 px de curva, nem 3 nem 200', () => {
    const pontos = espiralAMao()
    const chaves = pontosChaveDoDesenho(traco(pontos))
    const espacamento = comprimento(pontos) / (chaves.length - 1)
    expect(chaves.length).toBeGreaterThan(10)
    expect(chaves.length).toBeLessThanOrEqual(MAXIMO_DE_ALCAS)
    expect(espacamento).toBeGreaterThanOrEqual(30)
    expect(espacamento).toBeLessThanOrEqual(60)
  })

  it('rabisco enorme não passa do teto de alças', () => {
    const sorte = sorteador(3)
    const pontos: DrawingPoint[] = []
    for (let vai = 0; vai < 120; vai += 1) {
      for (let i = 0; i <= 20; i += 1) pontos.push({ x: (vai % 2 === 0 ? i : 20 - i) * 4 + sorte(), y: vai * 6 + i * 0.3 })
    }
    const chaves = pontosChaveDoDesenho(traco(pontos))
    expect(chaves.length).toBeLessThanOrEqual(MAXIMO_DE_ALCAS)
    expect(chaves[0]).toBe(0)
    expect(chaves[chaves.length - 1]).toBe(pontos.length - 1)
  })

  it('usa os pontos-chave guardados quando eles valem para os pontos de agora', () => {
    expect(pontosChaveDoDesenho(traco(retoDe0a200(), [0, 30, 100]))).toEqual([0, 30, 100])
  })

  it('pontos-chave guardados que não batem com os pontos (fora da ordem, fora do traço, sem a ponta) são ignorados', () => {
    const pontos = retoDe0a200()
    expect(pontosChaveDoDesenho(traco(pontos, [0, 60, 30, 100]))).toEqual([0, 100])
    expect(pontosChaveDoDesenho(traco(pontos, [0, 30, 150]))).toEqual([0, 100])
    expect(pontosChaveDoDesenho(traco(pontos, [0, 30]))).toEqual([0, 100])
    expect(pontosChaveDoDesenho(traco(pontos, [0, 2.5, 100]))).toEqual([0, 100])
  })
})

describe('arrastarPontoChave — traço do Pincel', () => {
  it('o ponto-chave vai aonde o ponteiro está, os vizinhos ficam e o trecho entorta suave', () => {
    const base = traco(retoDe0a200(), [0, 50, 100])
    const depois = arrastarPontoChave(base, 1, 100, 40)

    expect(depois.points[50]).toEqual({ x: 100, y: 40 })
    expect(depois.points[0]).toEqual({ x: 0, y: 0 })
    expect(depois.points[100]).toEqual({ x: 200, y: 0 })
    // Peso suave pela distância ao longo do traço: no meio do trecho, metade.
    expect(depois.points[25].y).toBeCloseTo(40 * suave(0.5), 6)
    expect(depois.points[75].y).toBeCloseTo(40 * suave(0.5), 6)
    // Sem bico: perto do ponto arrastado o traço chega quase plano.
    expect(40 - depois.points[49].y).toBeLessThan(0.1)
    // Sobe sem voltar, de um vizinho até o ponto arrastado.
    for (let i = 1; i <= 50; i += 1) expect(depois.points[i].y).toBeGreaterThanOrEqual(depois.points[i - 1].y)
    expect(depois.pontosChave).toEqual([0, 50, 100])
  })

  it('preserva o tremido da mão: o que muda é só o deslocamento suave', () => {
    const pontos = retoDe0a200().map((p, i) => ({ x: p.x, y: Math.sin(i * 1.7) }))
    const base = traco(pontos, [0, 50, 100])
    const depois = arrastarPontoChave(base, 1, pontos[50].x, pontos[50].y + 30)
    for (let i = 0; i <= 50; i += 1) {
      const t = comprimento(pontos.slice(0, i + 1)) / comprimento(pontos.slice(0, 51))
      expect(depois.points[i].y - pontos[i].y).toBeCloseTo(30 * suave(t), 6)
    }
  })

  it('arrastar a ponta do traço só entorta o trecho que ela tem', () => {
    const base = traco(retoDe0a200(), [0, 50, 100])
    const depois = arrastarPontoChave(base, 0, 0, 40)
    expect(depois.points[0]).toEqual({ x: 0, y: 40 })
    expect(depois.points[50]).toEqual({ x: 100, y: 0 })
    expect(depois.points.slice(50)).toEqual(base.points.slice(50))
  })

  it('cada passo do arrasto parte do traço de antes do gesto, não do passo anterior', () => {
    const base = traco(retoDe0a200(), [0, 50, 100])
    const direto = arrastarPontoChave(base, 1, 100, 20)
    expect(arrastarPontoChave(base, 1, 100, 20)).toEqual(direto)
    const ida = arrastarPontoChave(base, 1, 100, 60)
    expect(ida.points[25].y).toBeCloseTo(60 * suave(0.5), 6)
  })

  it('traço sem pontos-chave guardados passa a guardá-los no primeiro arrasto (as alças não pulam depois)', () => {
    const pontos = espiralAMao()
    const base = traco(pontos)
    const chaves = pontosChaveDoDesenho(base)
    const depois = arrastarPontoChave(base, 3, pontos[chaves[3]].x + 25, pontos[chaves[3]].y - 10)
    expect(depois.pontosChave).toEqual(chaves)
    expect(pontosChaveDoDesenho(depois)).toEqual(chaves)
  })
})

describe('inserirPontoChave', () => {
  it('traço: o ponto novo nasce no meio do trecho, medido pelo comprimento do traço', () => {
    const base = traco(retoDe0a200(), [0, 100])
    const inserido = inserirPontoChave(base, 0)
    expect(inserido).not.toBeNull()
    if (inserido === null) return
    expect(inserido.chave).toBe(1)
    expect(inserido.desenho.pontosChave).toEqual([0, 50, 100])
    expect(inserido.desenho.points).toEqual(base.points)
  })

  it('traço com pontos espaçados: entra um ponto bruto novo no meio e as chaves seguintes andam uma casa', () => {
    const base = traco([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], [0, 2, 3])
    const inserido = inserirPontoChave(base, 0)
    if (inserido === null) throw new Error('recusou inserir')
    expect(inserido.desenho.points).toEqual([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])
    expect(inserido.desenho.pontosChave).toEqual([0, 2, 3, 4])
    expect(inserido.chave).toBe(1)
  })

  it('polígono: ponto novo no meio da aresta, igual à sala livre', () => {
    const base = poligono([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    const inserido = inserirPontoChave(base, 0)
    if (inserido === null) throw new Error('recusou inserir')
    expect(inserido.desenho.points).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    expect(inserido.desenho.pontosChave).toEqual([0, 1, 2, 3, 4])
    expect(inserido.chave).toBe(1)
  })

  it('polígono: a aresta que fecha o anel (último → primeiro) também ganha ponto', () => {
    const base = poligono([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    const inserido = inserirPontoChave(base, 3)
    if (inserido === null) throw new Error('recusou inserir')
    expect(inserido.desenho.points[4]).toEqual({ x: 0, y: 50 })
    expect(inserido.desenho.pontosChave).toEqual([0, 1, 2, 3, 4])
    expect(inserido.chave).toBe(4)
  })
})

describe('removerPontoChave', () => {
  it('traço: os pontos do trecho são puxados para a curva suave entre os vizinhos, sem sumir nem partir', () => {
    const base = traco(retoDe0a200(), [0, 50, 100])
    const torto = arrastarPontoChave(base, 1, 100, 40)
    const removido = removerPontoChave(torto, 1)
    if (removido === null) throw new Error('recusou remover')
    expect(removido.pontosChave).toEqual([0, 99])
    expect(removido.points).toHaveLength(100)
    // Era um morro de 40 px; volta a ser (quase) a reta entre os vizinhos.
    // Sobra menos de 1 px porque o peso da volta é medido no traço já torto.
    for (const p of removido.points) expect(Math.abs(p.y)).toBeLessThan(1)
    expect(removido.points[0]).toEqual({ x: 0, y: 0 })
    expect(removido.points[99]).toEqual({ x: 200, y: 0 })
  })

  it('traço: apagar o pico que acabou de ser puxado num trecho curto não deixa laço', () => {
    // Pontos-chave em x = 0, 20, 40 e 200: o trecho 20→40 é curto.
    const base = traco(retoDe0a200(), [0, 10, 20, 100])
    const inserido = inserirPontoChave(base, 1)
    if (inserido === null) throw new Error('recusou inserir')
    const pico = arrastarPontoChave(inserido.desenho, inserido.chave, 35, -50)
    const removido = removerPontoChave(pico, inserido.chave)
    if (removido === null) throw new Error('recusou remover')
    for (const p of removido.points) expect(Math.abs(p.y)).toBeLessThan(1)
    // Sem laço: andando pelo traço, x nunca volta.
    for (let i = 1; i < removido.points.length; i += 1) expect(removido.points[i].x).toBeGreaterThan(removido.points[i - 1].x)
  })

  it('traço feito com a mão acelerando (pontos cada vez mais espaçados): apagar o que foi puxado volta perto da reta', () => {
    const pontos = Array.from({ length: 101 }, (_, i) => ({ x: 200 * (i / 100) ** 1.3, y: 0 }))
    const base = traco(pontos, [0, 50, 100])
    const removido = removerPontoChave(arrastarPontoChave(base, 1, pontos[50].x, 120), 1)
    if (removido === null) throw new Error('recusou remover')
    // Puxado 120 px; volta a menos de 3 px da reta, sem laço.
    for (const p of removido.points) expect(Math.abs(p.y)).toBeLessThan(3)
    for (let i = 1; i < removido.points.length; i += 1) expect(removido.points[i].x).toBeGreaterThan(removido.points[i - 1].x)
  })

  it('traço: tirar a ponta encurta o traço até o ponto-chave vizinho', () => {
    const base = traco(retoDe0a200(), [0, 30, 60, 100])
    const semFim = removerPontoChave(base, 3)
    if (semFim === null) throw new Error('recusou remover')
    expect(semFim.points).toEqual(base.points.slice(0, 61))
    expect(semFim.pontosChave).toEqual([0, 30, 60])
    const semComeco = removerPontoChave(base, 0)
    if (semComeco === null) throw new Error('recusou remover')
    expect(semComeco.points).toEqual(base.points.slice(30))
    expect(semComeco.pontosChave).toEqual([0, 30, 70])
  })

  it('traço com só 2 pontos-chave não perde nenhum', () => {
    expect(removerPontoChave(traco(retoDe0a200(), [0, 100]), 0)).toBeNull()
  })

  it('polígono: tira o vértice como a sala livre', () => {
    const base = poligono([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    const removido = removerPontoChave(base, 1)
    if (removido === null) throw new Error('recusou remover')
    expect(removido.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])
    expect(removido.pontosChave).toEqual([0, 1, 2])
  })

  it('triângulo não perde vértice', () => {
    expect(removerPontoChave(poligono([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }]), 0)).toBeNull()
  })
})

/**
 * Pintura do balde com buraco: o polígono guarda um anel só, e o buraco entra
 * por uma ponte de ida e volta (lib/baldeDeTinta.ts, `juntarBuracos`). Fora
 * 0..100, buraco 40..60, ponte em y = 50 saindo do lado esquerdo.
 */
function pinturaComBuraco(): Poligono {
  return {
    ...poligono([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
      { x: 0, y: 50 }, { x: 40, y: 50 },
      { x: 40, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 40 }, { x: 40, y: 40 },
      { x: 40, y: 50 }, { x: 0, y: 50 },
    ]),
    width: 0,
  }
}

describe('pintura do balde com buraco (fechadura)', () => {
  it('as pontas da ponte de ida e volta são âncoras', () => {
    expect([...ancorasDaFechadura(pinturaComBuraco().points)].sort((a, b) => a - b)).toEqual([4, 5, 10, 11])
  })

  it('âncora é ponto-chave mas não ganha alça, e a ponte não ganha bolinha de meio', () => {
    const pintura = pinturaComBuraco()
    const chaves = pontosChaveDoDesenho(pintura)
    for (const ancora of [4, 5, 10, 11]) expect(chaves).toContain(ancora)
    const alcas = alcasDoDesenho(pintura)
    const comAlca = alcas.vertices.map((v) => chaves[v.chave])
    for (const ancora of [4, 5, 10, 11]) expect(comAlca).not.toContain(ancora)
    expect(alcas.vertices.length).toBe(chaves.length - 4)
    // Meio da ponte: (20, 50). Nenhuma bolinha vazada ali.
    expect(alcas.meios.some((m) => Math.abs(m.x - 20) < 1e-9 && Math.abs(m.y - 50) < 1e-9)).toBe(false)
  })

  it('arrastar um canto do buraco não rasga a ponte', () => {
    const pintura = pinturaComBuraco()
    const chaves = pontosChaveDoDesenho(pintura)
    const canto = chaves.indexOf(6)
    const depois = arrastarPontoChave(pintura, canto, 30, 70)
    expect(depois.points[6]).toEqual({ x: 30, y: 70 })
    expect(depois.points[4]).toEqual(depois.points[11])
    expect(depois.points[5]).toEqual(depois.points[10])
    expect(ancorasDaFechadura(depois.points).size).toBe(4)
  })

  it('âncora não sai por duplo clique e a ponte não aceita ponto novo', () => {
    const pintura = pinturaComBuraco()
    const chaves = pontosChaveDoDesenho(pintura)
    expect(removerPontoChave(pintura, chaves.indexOf(5))).toBeNull()
    expect(inserirPontoChave(pintura, chaves.indexOf(4))).toBeNull()
  })
})

describe('alcasDoDesenho', () => {
  it('traço: bolinha cheia em cada ponto-chave e vazada no meio de cada trecho', () => {
    const alcas = alcasDoDesenho(traco(retoDe0a200(), [0, 50, 100]))
    expect(alcas.vertices.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])
    expect(alcas.meios.map(({ x, y, depoisDaChave }) => ({ x, y, depoisDaChave }))).toEqual([
      { x: 50, y: 0, depoisDaChave: 0 },
      { x: 150, y: 0, depoisDaChave: 1 },
    ])
  })

  it('trecho curto demais na tela não ganha bolinha de meio (zoom longe)', () => {
    const desenho: DesenhoPorPontos = traco(retoDe0a200(), [0, 50, 100])
    expect(alcasDoDesenho(desenho, 1).meios).toHaveLength(2)
    expect(alcasDoDesenho(desenho, 0.1).meios).toHaveLength(0)
  })

  it('polígono: um vértice por canto e um meio por aresta, inclusive a que fecha', () => {
    const alcas = alcasDoDesenho(poligono([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]))
    expect(alcas.vertices).toHaveLength(4)
    expect(alcas.meios).toHaveLength(4)
    expect(alcas.meios[3]).toMatchObject({ x: 0, y: 50, depoisDaChave: 3 })
  })
})
