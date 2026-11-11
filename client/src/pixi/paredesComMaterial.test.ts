import { describe, expect, it } from 'vitest'
import { FORMATO_DA_IMAGEM } from '../texturas/paredes/catalogo'
import type { Wall } from '../types/map'
import { juntasDaFiada, type TriangulosDaParede } from './paredeEmPecas'
import { malhasDosMateriais } from './paredesComMaterial'

/**
 * A parede com textura em peças (pedido de 10/11/2026): o canto fecha num pilar
 * sem buraco nem sobra, a ponta solta acaba na ponta com a tampa, a divisória
 * acaba rente à parede em que encosta, o jogador vê o mesmo canto do mestre e as
 * juntas são desencontradas e ancoradas no mapa. Mapa antigo, sem material:
 * malha nenhuma.
 */

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

/** O ponto (x, y) cai dentro de algum triângulo da malha? */
function cobre({ posicoes, indices }: TriangulosDaParede, x: number, y: number): boolean {
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

// Média a 64 px por casa: 20 px do mundo (meia espessura 10). Leste e depois sul.
const L = [parede('a', 0, 0, 256, 0, { material: 'castelo' }), parede('b', 256, 0, 256, 256, { material: 'castelo' })]

describe('malhasDosMateriais', () => {
  it('fecha o L de duas soltas num pilar: o canto inteiro coberto, de borda a borda, e nada além do contorno', () => {
    const [malha, ...resto] = malhasDosMateriais(L, 64)
    expect(resto).toHaveLength(0)
    expect(malha.material).toBe('castelo')
    // O topo cobre o nó, a quina de fora, a quina de dentro e o corpo das duas paredes.
    for (const [x, y] of [[256, 0], [264, -8], [248, 8], [100, 0], [256, 100]]) expect(cobre(malha.cima, x, y)).toBe(true)
    // Fora do canto e dentro da sala: só chão.
    expect(cobre(malha.cima, 268, -12)).toBe(false)
    expect(cobre(malha.cima, 240, 16)).toBe(false)
    // O contorno (a malha de baixo) passa 1,25 px da quina de fora.
    expect(cobre(malha.baixo, 266.8, -10.8)).toBe(true)
  })

  it('trechos curtos demais para o canto (a costa serrilhada): o pilar cobre o vão de fora', () => {
    const walls = [parede('a', 0, 0, 16, 0, { material: 'castelo' }), parede('b', 16, 0, 16, 16, { material: 'castelo' })]
    const [malha] = malhasDosMateriais(walls, 64)
    // Por fora do canto, a 3 px do nó na bissetriz: com duas pontas retas ficava um vão ali.
    expect(cobre(malha.cima, 16 + 3 * Math.SQRT1_2, -3 * Math.SQRT1_2)).toBe(true)
  })

  it('ponta solta: a parede acaba na ponta, com a tampa (uma peça das tampas da folha) na espessura inteira', () => {
    const [malha] = malhasDosMateriais([L[0]], 64)
    expect(cobre(malha.cima, 2, 0)).toBe(true)
    expect(cobre(malha.cima, -1, 0)).toBe(false)
    expect(cobre(malha.baixo, -0.8, 0)).toBe(true)
    // O canto da ponta (0, -10) é vértice de uma peça que lê a linha das tampas.
    const { tampasY, faixa, lado } = FORMATO_DA_IMAGEM
    let naTampa = false
    for (let i = 0; i < malha.cima.posicoes.length / 2; i += 1) {
      const v = malha.cima.uvs[i * 2 + 1] * lado
      if (Math.abs(malha.cima.posicoes[i * 2]) < 1e-3 && Math.abs(malha.cima.posicoes[i * 2 + 1] + 10) < 1e-3 && v >= tampasY && v <= tampasY + faixa) naTampa = true
    }
    expect(naTampa).toBe(true)
  })

  it('T sem nó: a divisória acaba rente à borda da parede em que encosta', () => {
    const hospede = parede('h', 0, 0, 256, 0, { material: 'castelo' })
    const divisoria = parede('d', 128, 0, 128, 128, { material: 'castelo', thickness: 'thin' })
    // Só a divisória na tela: nenhum ponto dela passa da borda da outra (y = 10), fora o 1 px da junta por baixo.
    const [malha] = malhasDosMateriais([divisoria], 64, [hospede, divisoria])
    let menorY = Infinity
    for (let i = 1; i < malha.cima.posicoes.length; i += 2) menorY = Math.min(menorY, malha.cima.posicoes[i])
    expect(menorY).toBeGreaterThanOrEqual(9 - 1e-6)
    expect(cobre(malha.cima, 128, 60)).toBe(true)
  })

  it('o jogador que só vê uma parede do canto vê o mesmo pilar do mestre (os encontros saem de todas)', () => {
    const [comTodas] = malhasDosMateriais([L[0]], 64, L)
    expect(cobre(comTodas.cima, 264, 8)).toBe(true)
    expect(cobre(comTodas.cima, 256, 100)).toBe(false)
    // Sem as outras, a parede acabaria no nó, com tampa.
    const [sozinha] = malhasDosMateriais([L[0]], 64)
    expect(cobre(sozinha.cima, 264, 8)).toBe(false)
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

describe('juntasDaFiada', () => {
  // Uma parede de 30 casas, bloco médio de 20 px, a segunda fiada com meia casa de fase.
  const de = 0
  const ate = 1920
  const fiada0 = juntasDaFiada(123, 0, 20, 0.4, 0, 0, de, ate)
  const fiada1 = juntasDaFiada(123, 1, 20, 0.4, 0, 0.5, de, ate)

  it('amarração: nenhuma junta a menos de um décimo do bloco da junta da fiada vizinha, e blocos de tamanhos diferentes', () => {
    let menor = Infinity
    for (const a of fiada0) for (const b of fiada1) menor = Math.min(menor, Math.abs(a.s - b.s))
    expect(menor).toBeGreaterThanOrEqual(2 - 1e-9)
    const tamanhos = fiada0.slice(1).map((j, i) => j.s - fiada0[i].s)
    expect(Math.max(...tamanhos) - Math.min(...tamanhos)).toBeGreaterThan(4)
  })

  it('ancorada no mapa: o mesmo pedaço da reta dá as mesmas juntas, qualquer que seja o trecho pedido', () => {
    const pedaco = juntasDaFiada(123, 0, 20, 0.4, 0, 0, 500, 900)
    expect(pedaco).toEqual(fiada0.filter((j) => j.s > 500 && j.s < 900))
    expect(juntasDaFiada(123, 0, 20, 0.4, 0, 0, de, ate)).toEqual(fiada0)
  })
})
