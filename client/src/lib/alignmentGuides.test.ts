import { describe, expect, it } from 'vitest'
import {
  computeAlignment,
  mapBoundsCandidates,
  gridAlignmentCandidates,
  nearbyCandidates,
  ALIGNMENT_THRESHOLD,
} from './alignmentGuides'

describe('computeAlignment', () => {
  it('sem candidato próximo retorna ponto original e guides vazio', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 500, y: 500 }])
    expect(result).toEqual({ point: { x: 100, y: 100 }, guides: [] })
  })

  it('candidato dentro do threshold no eixo x snapa só x', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 103, y: 500 }])
    expect(result.point).toEqual({ x: 103, y: 100 })
    expect(result.guides).toEqual([{ axis: 'x', position: 103 }])
  })

  it('candidato dentro do threshold nos dois eixos snapa os dois', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 104, y: 97 }])
    expect(result.point).toEqual({ x: 104, y: 97 })
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { axis: 'x', position: 104 },
        { axis: 'y', position: 97 },
      ]),
    )
    expect(result.guides).toHaveLength(2)
  })

  it('dois candidatos concorrentes no mesmo eixo, o mais próximo vence', () => {
    const result = computeAlignment(
      { x: 100, y: 100 },
      [
        { x: 105, y: 500 },
        { x: 102, y: 500 },
      ],
    )
    expect(result.point.x).toBe(102)
    expect(result.guides).toEqual([{ axis: 'x', position: 102 }])
  })

  it('candidato exatamente no limite do threshold snapa (inclusive)', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 100 + ALIGNMENT_THRESHOLD, y: 500 }])
    expect(result.point.x).toBe(100 + ALIGNMENT_THRESHOLD)
    expect(result.guides).toEqual([{ axis: 'x', position: 100 + ALIGNMENT_THRESHOLD }])
  })

  it('candidato um pixel além do threshold não snapa (exclusive)', () => {
    const result = computeAlignment({ x: 100, y: 100 }, [{ x: 100 + ALIGNMENT_THRESHOLD + 1, y: 500 }])
    expect(result.point).toEqual({ x: 100, y: 100 })
    expect(result.guides).toEqual([])
  })

  it('é agnóstica de tipo de entidade: candidatos vindos de segmento de escada/linha grudam igual a candidatos de parede', () => {
    // Generalização (Onda 3, item 19): a mesma função que hoje só é chamada
    // para parede/sala/token/prop funciona sem nenhuma mudança para
    // qualquer lista de pontos — inclusive extremidades de escada ou corpo
    // de linha, os dois casos citados no plano como "não grudam hoje". A
    // lacuna é de wiring em PixiCanvas.tsx (fora do escopo deste módulo),
    // não de capacidade de `computeAlignment`.
    const stairSegmentEndpoints = [
      { x: 200, y: 300 },
      { x: 240, y: 340 },
    ]
    const result = computeAlignment({ x: 199, y: 500 }, stairSegmentEndpoints)
    expect(result.point.x).toBe(200)
    expect(result.guides).toEqual([{ axis: 'x', position: 200 }])
  })
})

describe('mapBoundsCandidates', () => {
  it('devolve os 4 cantos e o centro do mapa', () => {
    const candidates = mapBoundsCandidates({ width: 2000, height: 1000 })
    expect(candidates).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 0, y: 1000 },
        { x: 2000, y: 1000 },
        { x: 1000, y: 500 },
      ]),
    )
    expect(candidates).toHaveLength(5)
  })

  it('perto da borda esquerda gruda em x=0 sem depender de nenhum outro candidato', () => {
    const result = computeAlignment({ x: 3, y: 500 }, mapBoundsCandidates({ width: 2000, height: 1000 }))
    expect(result.point.x).toBe(0)
  })

  it('perto do centro do mapa gruda nos dois eixos', () => {
    const result = computeAlignment({ x: 1003, y: 497 }, mapBoundsCandidates({ width: 2000, height: 1000 }))
    expect(result.point).toEqual({ x: 1000, y: 500 })
  })

  it('mapa 0×0 (campo ausente/degenerado) não produz NaN — todos os candidatos colapsam na origem', () => {
    const candidates = mapBoundsCandidates({ width: 0, height: 0 })
    const result = computeAlignment({ x: 2, y: 2 }, candidates)
    expect(result.point).toEqual({ x: 0, y: 0 })
    expect(Number.isNaN(result.point.x)).toBe(false)
    expect(Number.isNaN(result.point.y)).toBe(false)
  })
})

describe('gridAlignmentCandidates', () => {
  it('devolve a interseção de grade mais próxima do ponto', () => {
    const candidates = gridAlignmentCandidates({ x: 54, y: 98 }, 50)
    expect(candidates).toEqual([{ x: 50, y: 100 }])
  })

  it('ponto exatamente entre duas linhas arredonda (Math.round, half-up)', () => {
    const candidates = gridAlignmentCandidates({ x: 25, y: 0 }, 50)
    expect(candidates).toEqual([{ x: 50, y: 0 }])
  })

  it('cellSize 0 (grade desligada) devolve lista vazia, não NaN', () => {
    expect(gridAlignmentCandidates({ x: 10, y: 10 }, 0)).toEqual([])
  })

  it('cellSize negativo (campo inválido) devolve lista vazia, não NaN', () => {
    expect(gridAlignmentCandidates({ x: 10, y: 10 }, -50)).toEqual([])
  })

  it('composto com computeAlignment gruda o ponto na grade', () => {
    const point = { x: 203, y: 401 }
    const result = computeAlignment(point, gridAlignmentCandidates(point, 50))
    expect(result.point).toEqual({ x: 200, y: 400 })
  })
})

describe('nearbyCandidates', () => {
  it('mantém candidato perto em X mesmo que longe em Y (semântica por-eixo, igual a computeAlignment)', () => {
    const point = { x: 100, y: 100 }
    const candidates = [{ x: 102, y: 5000 }]
    expect(nearbyCandidates(point, candidates, 6)).toEqual(candidates)
  })

  it('mantém candidato perto em Y mesmo que longe em X', () => {
    const point = { x: 100, y: 100 }
    const candidates = [{ x: 5000, y: 103 }]
    expect(nearbyCandidates(point, candidates, 6)).toEqual(candidates)
  })

  it('descarta candidato longe nos dois eixos', () => {
    const point = { x: 100, y: 100 }
    const candidates = [{ x: 5000, y: 5000 }]
    expect(nearbyCandidates(point, candidates, 6)).toEqual([])
  })

  it('usa ALIGNMENT_THRESHOLD como raio padrão quando radius é omitido', () => {
    const point = { x: 100, y: 100 }
    const dentro = { x: 100 + ALIGNMENT_THRESHOLD, y: 5000 }
    const fora = { x: 100 + ALIGNMENT_THRESHOLD + 1, y: 5000 }
    expect(nearbyCandidates(point, [dentro, fora])).toEqual([dentro])
  })

  it('pré-filtrar antes de computeAlignment produz o mesmo resultado que passar a lista inteira', () => {
    const point = { x: 100, y: 100 }
    const candidates = [
      { x: 103, y: 9000 }, // perto em X, deve sobreviver ao filtro e vencer o alinhamento
      { x: 9000, y: 9000 }, // longe nos dois eixos, deve ser descartado
    ]
    const semFiltro = computeAlignment(point, candidates)
    const comFiltro = computeAlignment(point, nearbyCandidates(point, candidates))
    expect(comFiltro).toEqual(semFiltro)
  })
})
