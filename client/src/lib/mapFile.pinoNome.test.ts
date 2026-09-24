import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { deserializeMap, serializeMap } from './mapFile'
import { createEmptyMap, updatePin } from './mapFactory'
import { PIN_NOME_MAX_LENGTH } from './pins'

/**
 * O nome só do mestre é gravado no arquivo da cena e volta ao abrir. Campo
 * NOVO e OPCIONAL: pino de mapa antigo abre sem ele, e lixo vindo do disco
 * (número, texto só de espaços) volta ausente.
 */

const FACA: Pin = { id: 'faca', x: 10, y: 20, kind: 'interrogacao', description: 'Lâmina.', image: null, nome: 'Faca' }

function mapa(pin: Pin): MapData {
  return { ...createEmptyMap('m', 'M', 20, 20, 50), pins: [pin] }
}

/** O pino como o disco o traria, com `nome` trocado por um valor cru qualquer. */
function lidoComNome(nome: unknown): Pin {
  const cru: unknown = JSON.parse(serializeMap(mapa(FACA)))
  if (typeof cru !== 'object' || cru === null) throw new Error('mapa serializado inválido')
  const pins: unknown = Reflect.get(cru, 'pins')
  if (!Array.isArray(pins)) throw new Error('mapa serializado sem pinos')
  const primeiro: unknown = pins[0]
  if (typeof primeiro !== 'object' || primeiro === null) throw new Error('pino serializado inválido')
  Reflect.set(primeiro, 'nome', nome)
  return deserializeMap(JSON.stringify(cru)).pins[0]
}

describe('mapFile: nome do pino', () => {
  it('gravar e abrir devolve o nome', () => {
    expect(deserializeMap(serializeMap(mapa(FACA))).pins[0].nome).toBe('Faca')
  })

  it('pino de mapa antigo, sem o campo, abre sem nome', () => {
    const { nome: _nome, ...antigo } = FACA
    const lido = deserializeMap(serializeMap(mapa(antigo))).pins[0]
    expect(lido.nome).toBeUndefined()
    expect(lido.description).toBe('Lâmina.')
  })

  it('nome torto do disco: número e texto em branco voltam ausentes; longo é cortado', () => {
    expect(lidoComNome(42).nome).toBeUndefined()
    expect(lidoComNome('   ').nome).toBeUndefined()
    expect(lidoComNome('  Faca  ').nome).toBe('Faca')
    expect(lidoComNome('x'.repeat(500)).nome).toHaveLength(PIN_NOME_MAX_LENGTH)
  })
})

describe('mapFactory.updatePin: nome', () => {
  it('dar nome é mudança; escrever o mesmo nome não é; apagar volta ausente', () => {
    const { nome: _nome, ...semNome } = FACA
    const antes = mapa(semNome)
    const comNome = updatePin(antes, 'faca', { nome: 'Faca' })
    expect(comNome).not.toBe(antes)
    expect(comNome.pins[0].nome).toBe('Faca')
    expect(updatePin(comNome, 'faca', { nome: 'Faca' })).toBe(comNome)
    expect(updatePin(antes, 'faca', { nome: undefined })).toBe(antes)
    expect(updatePin(comNome, 'faca', { nome: undefined }).pins[0].nome).toBeUndefined()
  })
})
