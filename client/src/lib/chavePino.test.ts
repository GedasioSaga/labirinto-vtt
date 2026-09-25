import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { keyForPin } from './doorKey'
import { createEmptyMap, updatePin } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/** CHAVE ABRE PORTA no pino de viagem trancado — regra pura, disco e desfazer. */

const CHAVE = 'Chave do Escudo'

function ficha(id: string, mochila?: Token['mochila']): Token {
  const t: Token = { id, characterId: null, name: id, x: 0, y: 0, size: 1, image: null }
  return mochila === undefined ? t : { ...t, mochila }
}

function pino(extra: Partial<Pin> = {}): Pin {
  return { id: 'portao', x: 400, y: 200, kind: 'viagem', description: '', image: null, passagem: 'trancada', abreCom: CHAVE, ...extra }
}

function mapaCom(p: Pin): MapData {
  return { ...createEmptyMap('m', 'Mansão', 40, 10, 50), pins: [p] }
}

describe('keyForPin', () => {
  const diego = ficha('diego', [{ id: 'i0', nome: 'Tocha' }, { id: 'i1', nome: CHAVE }])

  it('acha quem carrega o "Abre com" do pino trancado, sem diferença de maiúscula e espaço', () => {
    const achou = keyForPin(pino({ abreCom: '  chave do ESCUDO ' }), [ficha('ana'), diego])
    expect(achou?.token.id).toBe('diego')
    expect(achou?.item).toEqual({ id: 'i1', nome: CHAVE })
  })

  it('ninguém com o item, pino sem "Abre com", ou pino que não é trancado: ninguém passa com item', () => {
    expect(keyForPin(pino(), [ficha('ana')])).toBeNull()
    expect(keyForPin(pino({ abreCom: undefined }), [diego])).toBeNull()
    expect(keyForPin(pino({ passagem: 'pede' }), [diego])).toBeNull()
    expect(keyForPin(pino({ passagem: 'livre' }), [diego])).toBeNull()
    expect(keyForPin(pino({ kind: 'exclamacao' }), [diego])).toBeNull()
  })
})

describe('disco: "Abre com" do pino', () => {
  it('ida e volta guarda o nome; o `chave` do recorte do jogador não entra no mapa do mestre', () => {
    const volta = deserializeMap(serializeMap(mapaCom(pino({ chave: 'vazado' }))))
    expect(volta.pins[0]?.abreCom).toBe(CHAVE)
    expect(volta.pins[0]?.chave).toBeUndefined()
  })

  it('valor que não é texto, ou só espaço, volta ausente — o pino continua trancado', () => {
    // O arquivo editado à mão: troca o texto gravado por outra forma, no próprio JSON.
    const gravado = serializeMap(mapaCom(pino()))
    const campo = `"abreCom": "${CHAVE}"`
    expect(gravado).toContain(campo)
    const objeto = deserializeMap(gravado.replace(campo, `"abreCom": {"nome": "${CHAVE}"}`))
    expect(objeto.pins[0]?.abreCom).toBeUndefined()
    expect(objeto.pins[0]?.passagem).toBe('trancada')
    expect(deserializeMap(gravado.replace(campo, '"abreCom": "   "')).pins[0]?.abreCom).toBeUndefined()
  })

  it('mapa de antes do campo abre sem ele', () => {
    const antigo = deserializeMap(serializeMap(mapaCom(pino({ abreCom: undefined }))))
    expect(antigo.pins[0] !== undefined && antigo.pins[0].abreCom === undefined).toBe(true)
  })
})

describe('updatePin: "Abre com" com desfazer', () => {
  it('escrever o nome é mudança; apagar o que nunca existiu não é', () => {
    const semChave = mapaCom(pino({ abreCom: undefined }))
    const comChave = updatePin(semChave, 'portao', { abreCom: CHAVE })
    expect(comChave).not.toBe(semChave)
    expect(comChave.pins[0]?.abreCom).toBe(CHAVE)
    expect(updatePin(semChave, 'portao', { abreCom: undefined })).toBe(semChave)
    expect(updatePin(comChave, 'portao', { abreCom: CHAVE })).toBe(comChave)
  })
})
