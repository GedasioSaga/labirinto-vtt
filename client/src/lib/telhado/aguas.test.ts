import { describe, expect, it } from 'vitest'
import { aguaNoPonto, BEIRAL_PX, dentroDoPoligono, prepararAguas, type PontoDoTelhado } from './aguas'

/**
 * ÁGUAS DO TELHADO: a conta que diz, para cada ponto, qual água cobre, a que
 * altura e onde ao longo da borda. A forma vem do esqueleto reto: retângulo
 * de 4 águas com cumeeira de w − h, L com o rincão saindo da quina de dentro.
 */

const p = (x: number, y: number): PontoDoTelhado => ({ x, y })

/** Retângulo 200 × 120 em (40, 60), no sentido horário da tela. */
const RET = [p(40, 60), p(240, 60), p(240, 180), p(40, 180)]
const W = 200
const H = 120

/** L de braços de 80: barra de cima 200 × 80 e perna da esquerda descendo até 200. Quina côncava em (80, 80). */
const L = [p(0, 0), p(200, 0), p(200, 80), p(80, 80), p(80, 200), p(0, 200)]
const BORDA_DE_BAIXO_DA_BARRA = 2 // (200,80) → (80,80)
const BORDA_DE_DENTRO_DA_PERNA = 3 // (80,80) → (80,200)

const T = [p(0, 0), p(240, 0), p(240, 80), p(160, 80), p(160, 220), p(80, 220), p(80, 80), p(0, 80)]
const U = [p(0, 0), p(240, 0), p(240, 200), p(160, 200), p(160, 80), p(80, 80), p(80, 200), p(0, 200)]
const OCTOGONO = (() => {
  const pts: PontoDoTelhado[] = []
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i + Math.PI / 8
    pts.push(p(150 + Math.cos(a) * 100, 150 + Math.sin(a) * 100))
  }
  return pts
})()

function agua(pontos: readonly PontoDoTelhado[], x: number, y: number) {
  const geo = prepararAguas(pontos)
  if (geo === null) throw new Error('polígono de teste quebrado')
  return aguaNoPonto(geo, x, y)
}

describe('retângulo: 4 águas', () => {
  it('cada borda é dona do meio dela', () => {
    expect(agua(RET, 140, 70).agua).toBe(0) // norte
    expect(agua(RET, 230, 120).agua).toBe(1) // leste
    expect(agua(RET, 140, 170).agua).toBe(2) // sul
    expect(agua(RET, 50, 120).agua).toBe(3) // oeste
  })

  it('a cumeeira mede w − h e as águas norte e sul se encontram nela', () => {
    // Logo abaixo da linha do meio, a água sul é dona exatamente do trecho da cumeeira.
    const geo = prepararAguas(RET)
    if (geo === null) throw new Error('quebrado')
    let comprimento = 0
    const passo = 0.25
    for (let x = 40 + passo / 2; x < 240; x += passo) {
      if (aguaNoPonto(geo, x, 120.01).agua === 2) comprimento += passo
    }
    expect(comprimento).toBeCloseTo(W - H, 0)
    const meio = aguaNoPonto(geo, 140, 120)
    expect(meio.ateEmenda).toBeLessThan(0.01)
    expect(meio.rincao).toBe(false)
  })

  it('o espigão sai da quina a 45°', () => {
    const quina = agua(RET, 70, 90)
    expect(quina.ateEmenda).toBeLessThan(0.01)
    expect([0, 3]).toContain(quina.agua)
    expect(agua(RET, 72, 90).agua).toBe(0) // um pouco mais perto do norte
    expect(agua(RET, 70, 92).agua).toBe(3) // um pouco mais perto do oeste
  })

  it('altura: beiral de 0 a 8 por fora, 8 na parede, h/2 + 8 na cumeeira', () => {
    expect(agua(RET, 140, 60 - BEIRAL_PX + 0.001).altura).toBeCloseTo(0, 2)
    expect(agua(RET, 140, 56).altura).toBeCloseTo(4, 6)
    expect(agua(RET, 140, 60).altura).toBeCloseTo(BEIRAL_PX, 6)
    expect(agua(RET, 140, 120).altura).toBeCloseTo(H / 2 + BEIRAL_PX, 6)
  })

  it('além do beiral não tem telhado; a quina de fora do beiral é em esquadria', () => {
    expect(agua(RET, 140, 60 - BEIRAL_PX - 0.5).agua).toBe(-1)
    // Canto do beiral: 7 px para fora nas duas direções ainda é telhado (esquadria, não quina redonda).
    expect(agua(RET, 33, 53).agua).not.toBe(-1)
    expect(agua(RET, 31, 51).agua).toBe(-1)
  })

  it('a coordenada ao longo da borda conta do primeiro ponto dela', () => {
    expect(agua(RET, 140, 70).aoLongo).toBeCloseTo(100, 6) // norte vai de x = 40 para a direita
    expect(agua(RET, 140, 170).aoLongo).toBeCloseTo(100, 6) // sul vai de x = 240 para a esquerda
    expect(agua(RET, 230, 100).aoLongo).toBeCloseTo(40, 6) // leste desce de y = 60
  })
})

describe('L: águas calculadas com rincão', () => {
  it('o rincão sai da quina côncava em diagonal, até onde as cumeeiras se cruzam', () => {
    for (const k of [4, 12, 20, 30, 38]) {
      const a = agua(L, 80 - k, 80 - k)
      expect(a.ateEmenda).toBeLessThan(0.01)
      expect(a.rincao).toBe(true)
      expect([BORDA_DE_BAIXO_DA_BARRA, BORDA_DE_DENTRO_DA_PERNA]).toContain(a.agua)
    }
  })

  it('de cada lado do rincão a água continua a da borda vizinha, sem degrau', () => {
    // Acima da diagonal (mais perto da barra) a água é a da borda de baixo da barra, que segue além da quina.
    const barra = agua(L, 70, 60)
    expect(barra.agua).toBe(BORDA_DE_BAIXO_DA_BARRA)
    expect(barra.altura).toBeCloseTo(20 + BEIRAL_PX, 6)
    expect(agua(L, 60, 70).agua).toBe(BORDA_DE_DENTRO_DA_PERNA)
    // Atravessando a reta da quina (x = 80) a altura não pula.
    const antes = agua(L, 79.5, 60)
    const depois = agua(L, 80.5, 60)
    expect(antes.agua).toBe(depois.agua)
    expect(Math.abs(antes.altura - depois.altura)).toBeLessThan(1e-6)
  })

  it('o beiral de fora da quina côncava também tem rincão (os dois beirais se cruzam na diagonal)', () => {
    const fora = agua(L, 84, 84)
    expect(fora.altura).toBeCloseTo(BEIRAL_PX - 4, 6)
    expect(fora.rincao).toBe(true)
    expect(fora.ateEmenda).toBeLessThan(0.01)
  })
})

/**
 * O telhado é uma superfície sem degrau: dois pontos a 1 px de distância
 * nunca diferem mais de 1 px de altura (cada água sobe 1 por 1). Pega o
 * erro de trocar a água dona na quina côncava, que deixa um rasgo de altura
 * zero no meio da casa.
 */
describe('forma livre sem degrau', () => {
  const formas: [string, readonly PontoDoTelhado[]][] = [
    ['retângulo', RET],
    ['L', L],
    ['T', T],
    ['U', U],
    ['octógono', OCTOGONO],
  ]
  for (const [nome, pontos] of formas) {
    it(`${nome}: tudo coberto dentro, altura contínua`, () => {
      const geo = prepararAguas(pontos)
      if (geo === null) throw new Error('quebrado')
      const passo = 1
      let maiorSalto = 0
      let descobertos = 0
      for (let y = geo.minY - 6; y <= geo.maxY + 6; y += passo) {
        let anterior: number | null = null
        for (let x = geo.minX - 6; x <= geo.maxX + 6; x += passo) {
          const a = aguaNoPonto(geo, x + 0.37, y + 0.21)
          // Dentro da parede tem sempre água, e no mínimo a altura da parede.
          if (dentroDoPoligono(geo, x + 0.37, y + 0.21) && (a.agua < 0 || a.altura < BEIRAL_PX - 1e-9)) descobertos += 1
          if (a.agua < 0) {
            anterior = null
            continue
          }
          if (anterior !== null) maiorSalto = Math.max(maiorSalto, Math.abs(a.altura - anterior))
          anterior = a.altura
        }
      }
      expect(descobertos).toBe(0)
      expect(maiorSalto).toBeLessThanOrEqual(passo + 1e-6)
    })
  }

  it('octógono: cada borda é dona do próprio meio', () => {
    for (let i = 0; i < 8; i += 1) {
      const a = OCTOGONO[i]
      const b = OCTOGONO[(i + 1) % 8]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const dentro = agua(OCTOGONO, mx + (150 - mx) * 0.1, my + (150 - my) * 0.1)
      expect(dentro.agua).toBe(i)
    }
  })

  it('o sentido dos pontos (horário ou anti-horário) não muda a forma', () => {
    const invertido = [...L].reverse()
    expect(agua(invertido, 70, 60).altura).toBeCloseTo(20 + BEIRAL_PX, 6)
    expect(agua(invertido, 60, 60).rincao).toBe(true)
  })
})

describe('polígono quebrado não lança', () => {
  const quebrados: unknown[] = [
    [],
    [p(0, 0)],
    [p(0, 0), p(10, 0)],
    [p(0, 0), p(10, 0), p(20, 0)], // tudo numa reta
    [p(0, 0), p(Number.NaN, 5), p(10, 10)],
    [p(0, 0), p(0, 0), p(0, 0), p(0, 0)],
    null,
    undefined,
    'casa',
    [{ x: 'a', y: 1 }, null, p(3, 4)],
  ]
  for (const q of quebrados) {
    it(`${JSON.stringify(q) ?? String(q)}: geometria nula, sem erro`, () => {
      expect(() => prepararAguas(q as PontoDoTelhado[])).not.toThrow()
      expect(prepararAguas(q as PontoDoTelhado[])).toBeNull()
    })
  }

  it('ponto repetido e ponto final igual ao primeiro são limpos (o polígono continua valendo)', () => {
    const sujo = [p(40, 60), p(40, 60), p(240, 60), p(240, 180), p(40, 180), p(40, 60)]
    const geo = prepararAguas(sujo)
    expect(geo).not.toBeNull()
    expect(geo?.n).toBe(4)
  })

  it('ponto com NaN no meio de um polígono bom é ignorado', () => {
    const geo = prepararAguas([p(40, 60), p(240, 60), p(Number.NaN, 1), p(240, 180), p(40, 180)])
    expect(geo?.n).toBe(4)
  })

  it('ponto pedido com NaN devolve "sem água" em vez de lançar', () => {
    const geo = prepararAguas(RET)
    if (geo === null) throw new Error('quebrado')
    expect(aguaNoPonto(geo, Number.NaN, 10).agua).toBe(-1)
  })
})
