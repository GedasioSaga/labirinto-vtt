import { describe, expect, it } from 'vitest'
import type { MapData, MarcaNoLugar } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { acharBilheteEm, adicionarMarca, apagarMarca, fichaAlcancaPonto, limparTextoDaMarca, MARCA_TEXTO_MAX, marcaParaJogador } from './marcas'

/**
 * BILHETE NO LUGAR — as peças puras: o texto que o jogador digita, o que vai
 * a ele pela rede, o que o arquivo guarda e o toque que abre o bilhete.
 */

const BILHETE: MarcaNoLugar = { id: 'b1', tipo: 'bilhete', x: 100, y: 120, texto: 'volto já', autor: 'Ana', em: 42 }
const SETA: MarcaNoLugar = { id: 's1', tipo: 'seta', x: 300, y: 300, rumo: 'no', autor: 'Bruno', em: 43 }

function mapa(marcas?: MarcaNoLugar[]): MapData {
  const base = createEmptyMap('m1', 'Corredor', 20, 20, 50)
  return marcas === undefined ? base : { ...base, marcas }
}

describe('limparTextoDaMarca', () => {
  it('apara as pontas, junta espaços e quebras de linha num espaço só', () => {
    expect(limparTextoDaMarca('  GUI \n\n ESPERA   AQUI ')).toBe('GUI ESPERA AQUI')
  })

  it('tira caractere de controle e corta no teto sem partir emoji', () => {
    expect(limparTextoDaMarca('a\u0000b\u0007c')).toBe('abc')
    const partido = `${'y'.repeat(MARCA_TEXTO_MAX - 1)}\u{1F600}`
    expect(limparTextoDaMarca(partido)).toBe('y'.repeat(MARCA_TEXTO_MAX - 1))
    expect(limparTextoDaMarca('z'.repeat(MARCA_TEXTO_MAX + 30)).length).toBe(MARCA_TEXTO_MAX)
  })
})

describe('marcaParaJogador', () => {
  it('leva só o que o jogador pode ler: nunca autor nem hora', () => {
    expect(marcaParaJogador(BILHETE)).toEqual({ id: 'b1', tipo: 'bilhete', x: 100, y: 120, texto: 'volto já' })
    expect(marcaParaJogador(SETA)).toEqual({ id: 's1', tipo: 'seta', x: 300, y: 300, rumo: 'no' })
  })
})

describe('adicionarMarca / apagarMarca', () => {
  it('adiciona no fim (mapa antigo sem o campo também) e apaga pelo id', () => {
    const um = adicionarMarca(mapa(), BILHETE)
    expect(um.marcas).toEqual([BILHETE])
    const dois = adicionarMarca(um, SETA)
    expect(dois.marcas?.map((m) => m.id)).toEqual(['b1', 's1'])
    expect(apagarMarca(dois, 'b1').marcas?.map((m) => m.id)).toEqual(['s1'])
  })

  it('id repetido não duplica; apagar o que não existe devolve o mesmo mapa', () => {
    const um = adicionarMarca(mapa(), BILHETE)
    expect(adicionarMarca(um, BILHETE)).toBe(um)
    expect(apagarMarca(um, 'nao-existe')).toBe(um)
    const semCampo = mapa()
    expect(apagarMarca(semCampo, 'b1')).toBe(semCampo)
  })
})

describe('fichaAlcancaPonto', () => {
  it('até uma casa além da borda da ficha', () => {
    const ficha = { x: 100, y: 100, size: 1 }
    // raio 25 + 50 de alcance = 75
    expect(fichaAlcancaPonto(ficha, { x: 175, y: 100 }, 50)).toBe(true)
    expect(fichaAlcancaPonto(ficha, { x: 176, y: 100 }, 50)).toBe(false)
  })
})

describe('acharBilheteEm', () => {
  it('acha o bilhete mais perto dentro da folga; a seta não abre cartão', () => {
    const marcas = [BILHETE, SETA, { ...BILHETE, id: 'b2', x: 108, y: 120 }]
    expect(acharBilheteEm(marcas, { x: 106, y: 121 }, 10)?.id).toBe('b2')
    expect(acharBilheteEm(marcas, { x: 300, y: 300 }, 10)).toBeNull()
    expect(acharBilheteEm([], { x: 0, y: 0 }, 10)).toBeNull()
  })
})

describe('arquivo do mapa', () => {
  it('a marca atravessa salvar e abrir, com autor e hora', () => {
    const salvo = deserializeMap(serializeMap(mapa([BILHETE, SETA])))
    expect(salvo.marcas).toEqual([BILHETE, SETA])
  })

  it('mapa sem o campo abre sem o campo (round-trip exato)', () => {
    const salvo = deserializeMap(serializeMap(mapa()))
    expect(salvo.marcas).toBeUndefined()
    expect(serializeMap(salvo)).toBe(serializeMap(mapa()))
  })

  it('marca torta no arquivo cai sozinha e as boas ficam', () => {
    const json = JSON.stringify({
      ...mapa(),
      marcas: [BILHETE, { id: 'x', tipo: 'placa', x: 1, y: 1 }, { id: 'y', tipo: 'bilhete', x: 'a', y: 1, texto: 'oi' }, { id: 'z', tipo: 'seta', x: 1, y: 1, rumo: 'aqui' }, null, 7],
    })
    expect(deserializeMap(json).marcas).toEqual([BILHETE])
  })
})
