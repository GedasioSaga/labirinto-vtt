/**
 * PARTÍCULAS DA CENA (`lib/particulasDaCena.ts`): o campo do mapa que guarda
 * quanto de fumaça e de brasas a cena mostra. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { TETO_DE_PARTICULAS, comParticulas, lerParticulas, temParticulas, tetoDoEfeito } from './particulasDaCena'

describe('partículas da cena', () => {
  it('ligar grava e volta do arquivo; desligar o último efeito tira o campo', () => {
    const vazio = createEmptyMap('clareira', 'Clareira', 10, 10, 50)
    expect(temParticulas(vazio)).toBe(false)
    const comFumaca = comParticulas(vazio, 'fumaca', 'muita')
    expect(tetoDoEfeito(comFumaca, 'fumaca')).toBe(TETO_DE_PARTICULAS.fumaca.muita)
    expect(tetoDoEfeito(comFumaca, 'brasas')).toBe(0)
    // O mesmo valor devolve o mesmo mapa: sem passo vazio no desfazer.
    expect(comParticulas(comFumaca, 'fumaca', 'muita')).toBe(comFumaca)
    expect(deserializeMap(serializeMap(comParticulas(comFumaca, 'brasas', 'pouca'))).particulas).toEqual({ fumaca: 'muita', brasas: 'pouca' })
    const desligado = comParticulas(comFumaca, 'fumaca', null)
    expect('particulas' in desligado).toBe(false)
  })

  it('arquivo editado à mão: quantidade desconhecida sai, e sem nada válido o campo não entra', () => {
    expect(lerParticulas({ fumaca: 'demais', brasas: 'media', neve: 'muita' })).toEqual({ brasas: 'media' })
    expect(lerParticulas({ fumaca: 3 })).toBeUndefined()
    expect(lerParticulas('muita')).toBeUndefined()
    expect(lerParticulas(null)).toBeUndefined()
    expect(lerParticulas(undefined)).toBeUndefined()
  })
})
