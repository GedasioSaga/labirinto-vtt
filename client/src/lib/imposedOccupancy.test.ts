/**
 * MOVIMENTO IMPOSTO — o raio com que a esteira e a cabine decidem quem segura a
 * ficha é o do DONO dela na sala, o mesmo que o host aplica ao recorte do jogador.
 */
import { describe, expect, it } from 'vitest'
import { ownerVisionRadii } from './imposedOccupancy'

describe('ownerVisionRadii — o raio do dono de cada ficha', () => {
  it('cada ficha leva o raio do jogador dono dela; ficha sem dono fica de fora', () => {
    const raios = ownerVisionRadii([
      { tokenIds: ['ana', 'cavalo'], visionRadius: 700 },
      { tokenIds: ['bia'], visionRadius: 300 },
    ])
    expect(Object.fromEntries(raios)).toEqual({ ana: 700, cavalo: 700, bia: 300 })
    expect(raios.has('guarda')).toBe(false)
  })

  it('ficha de dois donos fica com o MENOR raio: segura só quem os dois enxergam', () => {
    const raios = ownerVisionRadii([
      { tokenIds: ['barco'], visionRadius: 900 },
      { tokenIds: ['barco'], visionRadius: 250 },
    ])
    expect(raios.get('barco')).toBe(250)
  })

  it('sala sem jogador: nenhum raio', () => {
    expect(ownerVisionRadii([]).size).toBe(0)
  })
})
