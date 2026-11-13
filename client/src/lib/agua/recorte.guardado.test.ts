import { describe, expect, it } from 'vitest'
import type { Agua, RegionPoint } from '../../types/map'
import { aguasParaJogador } from './recorte'

/**
 * O ESCONDIDO GUARDADO (M05 da 0.5.62, FX-NEVOA2-062): com a mesma chave do
 * lugar escondido, o recorte da água não pergunta de novo se cada ponto está
 * escondido, e sai igual ao de sem chave. Grade de 64 px; o lugar escondido é
 * a caixa 24..30 x 2..8 casas; o jogador conhece só a metade de cima do mapa.
 */
const G = 64
const casa = ([x, y]: readonly [number, number]): RegionPoint => ({ x: x * G, y: y * G })
const naCaixa = (p: RegionPoint): boolean => p.x >= 24 * G && p.x <= 30 * G && p.y >= 2 * G && p.y <= 8 * G
const conhece = (p: RegionPoint): boolean => p.y <= 11 * G

const rio: Agua = {
  id: 'rio',
  tipo: 'rio',
  pontos: ([[22, 0.5], [24.4, 2.6], [26.5, 4.2], [27.5, 6.6], [29.6, 7.6], [32, 9.5], [36, 11], [44, 12]] as const).map(casa),
  cor: '#2f6f9f',
  largura: 1.5,
}
const lago: Agua = { id: 'lago', tipo: 'lago', pontos: ([[27, 5], [34, 4.6], [35, 9], [31, 13], [26.6, 10]] as const).map(casa), cor: '#2f7f8f' }

describe('o escondido guardado do recorte da água', () => {
  it('com a mesma chave sai igual a sem chave e não pergunta de novo; chave nova pergunta', () => {
    let perguntas = 0
    const escondido = (p: RegionPoint): boolean => {
      perguntas += 1
      return naCaixa(p)
    }
    const aguas = [rio, lago]
    const semChave = aguasParaJogador(aguas, G, conhece, naCaixa)
    expect(semChave?.map((a) => a.id), 'premissa: as duas saem').toEqual(['rio', 'lago'])

    expect(aguasParaJogador(aguas, G, conhece, escondido, undefined, 'a')).toEqual(semChave)
    expect(perguntas, 'a primeira vez pergunta').toBeGreaterThan(0)
    perguntas = 0
    expect(aguasParaJogador(aguas, G, conhece, escondido, undefined, 'a')).toEqual(semChave)
    expect(perguntas, 'a mesma chave não pergunta de novo').toBe(0)
    expect(aguasParaJogador(aguas, G, conhece, escondido, undefined, 'b')).toEqual(semChave)
    expect(perguntas, 'chave nova pergunta de novo').toBeGreaterThan(0)
  })
})
