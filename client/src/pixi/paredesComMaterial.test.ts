import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/map'
import { malhasDosMateriais } from './paredesComMaterial'

/**
 * A malha da parede com textura (pedido de 07/11/2026): a quina de duas paredes
 * soltas fecha em esquadro sem buraco nem sobra, e as duas metades do canto leem o
 * mesmo texel na diagonal (sem costura). Mapa antigo, sem material: malha nenhuma.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function areaDos(posicoes: Float32Array, indices: Uint32Array): number {
  let soma = 0
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]]
    const ax = posicoes[a * 2]
    const ay = posicoes[a * 2 + 1]
    soma += Math.abs((posicoes[b * 2] - ax) * (posicoes[c * 2 + 1] - ay) - (posicoes[c * 2] - ax) * (posicoes[b * 2 + 1] - ay)) / 2
  }
  return soma
}

/** O ponto (x, y) cai dentro de algum triângulo da malha? */
function cobre(posicoes: Float32Array, indices: Uint32Array, x: number, y: number): boolean {
  const lado = (ax: number, ay: number, bx: number, by: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]]
    const s1 = lado(posicoes[a * 2], posicoes[a * 2 + 1], posicoes[b * 2], posicoes[b * 2 + 1])
    const s2 = lado(posicoes[b * 2], posicoes[b * 2 + 1], posicoes[c * 2], posicoes[c * 2 + 1])
    const s3 = lado(posicoes[c * 2], posicoes[c * 2 + 1], posicoes[a * 2], posicoes[a * 2 + 1])
    if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) return true
  }
  return false
}

describe('malhasDosMateriais', () => {
  it('fecha o L de duas soltas em esquadro: a área certa e o mesmo texel dos dois lados da quina de fora', () => {
    // Média a 64 px por casa: 20 px do mundo (meia espessura 10). Leste e depois sul.
    const walls = [parede('a', 0, 0, 256, 0, { material: 'castelo' }), parede('b', 256, 0, 256, 256, { material: 'castelo' })]
    const [malha, ...resto] = malhasDosMateriais(walls, 64)
    expect(resto).toHaveLength(0)
    expect(malha.material).toBe('castelo')
    // A faixa em L: 266 x 20 deitada mais 20 x 246 em pé, sem buraco no canto nem triângulo dobrado.
    expect(areaDos(malha.posicoes, malha.indices)).toBeCloseTo(266 * 20 + 20 * 246, 3)
    // A quina de fora (266, -10) está nas duas metades do canto, com o MESMO uv: o x andado
    // até a quina (256 px = meio ladrilho) e o mesmo lado do traço.
    const uvsDaQuina: [number, number][] = []
    for (let i = 0; i < malha.posicoes.length / 2; i += 1) {
      if (Math.abs(malha.posicoes[i * 2] - 266) < 1e-3 && Math.abs(malha.posicoes[i * 2 + 1] + 10) < 1e-3) uvsDaQuina.push([malha.uvs[i * 2], malha.uvs[i * 2 + 1]])
    }
    expect(uvsDaQuina).toHaveLength(2)
    expect(uvsDaQuina[0][0]).toBeCloseTo(0.5, 6)
    expect(uvsDaQuina[1][0]).toBeCloseTo(uvsDaQuina[0][0], 6)
    expect(uvsDaQuina[1][1]).toBeCloseTo(uvsDaQuina[0][1], 6)
  })

  it('trechos curtos demais para o esquadro (a costa serrilhada): chanfro sem vão por fora e a imagem contínua na junta', () => {
    // Leste 16 px e depois sul 16 px: o corte da bissetriz (10 px) passa da metade do trecho (8 px).
    const walls = [parede('a', 0, 0, 16, 0, { material: 'castelo' }), parede('b', 16, 0, 16, 16, { material: 'castelo' })]
    const [malha] = malhasDosMateriais(walls, 64)
    // Por fora do canto, a 3 px da junta na bissetriz: antes, as duas pontas retas deixavam o vão ali.
    expect(cobre(malha.posicoes, malha.indices, 16 + 3 * Math.SQRT1_2, -3 * Math.SQRT1_2)).toBe(true)
    // Todo vértice na junta lê o x andado até ela (16 px de 512): antes o "b" recomeçava a imagem do 0.
    const usNaJunta: number[] = []
    for (let i = 0; i < malha.posicoes.length / 2; i += 1) {
      if (Math.abs(malha.posicoes[i * 2] - 16) < 1e-6 && Math.abs(malha.posicoes[i * 2 + 1]) < 1e-6) usNaJunta.push(malha.uvs[i * 2])
    }
    expect(usNaJunta.length).toBeGreaterThan(0)
    for (const u of usNaJunta) expect(u).toBeCloseTo(16 / 512, 6)
  })

  it('mapa antigo (sem material), porta, janela e invisível: nenhuma malha', () => {
    const walls = [
      parede('linha', 0, 0, 128, 0),
      parede('porta', 128, 0, 160, 0, { material: 'madeira', door: { open: false, locked: false, kind: 'normal' } }),
      parede('janela', 160, 0, 224, 0, { material: 'madeira', janela: true }),
      parede('invisivel', 224, 0, 256, 0, { material: 'madeira', hidden: true }),
    ]
    expect(malhasDosMateriais(walls, 64)).toEqual([])
  })
})
