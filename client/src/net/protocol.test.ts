import { describe, expect, it } from 'vitest'
import { createExploration, decodeExploration, encodeExploration, markRings } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import { LASER_MAX_POINTS_PER_MESSAGE } from '../lib/laser'
import { PROTOCOL_VERSION, parseLaserMessage, parsePlayerMessage, type HostMessage } from './protocol'

describe('parseLaserMessage', () => {
  it('aceita off e lote de pontos finitos, copiando só x e y', () => {
    expect(parseLaserMessage({ type: 'laser', off: true })).toEqual({ type: 'laser', off: true })
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1.5, y: -2, cor: '<img>' }] })).toEqual({ type: 'laser', points: [{ x: 1.5, y: -2 }] })
    const full = Array.from({ length: LASER_MAX_POINTS_PER_MESSAGE }, (_, i) => ({ x: i, y: i }))
    expect(parseLaserMessage({ type: 'laser', points: full })).toEqual({ type: 'laser', points: full })
  })

  it('descarta lote vazio, grande demais, ponto não finito ou malformado e outro tipo', () => {
    const tooMany = Array.from({ length: LASER_MAX_POINTS_PER_MESSAGE + 1 }, () => ({ x: 1, y: 1 }))
    const invalid: unknown[] = [
      null,
      'laser',
      { type: 'laser' },
      { type: 'laser', off: 'true' },
      { type: 'laser', off: false },
      { type: 'laser', points: [] },
      { type: 'laser', points: tooMany },
      { type: 'laser', points: 'x' },
      { type: 'laser', points: [{ x: '1', y: 2 }] },
      { type: 'laser', points: [{ x: 1 }] },
      { type: 'laser', points: [{ x: 1, y: Number.NaN }] },
      { type: 'laser', points: [{ x: 1, y: 2 }, null] },
      { type: 'laser', points: [[1, 2]] },
      { type: 'signal', points: [{ x: 1, y: 2 }] },
    ]
    for (const value of invalid) expect(parseLaserMessage(value)).toBeNull()
  })

  it('jogador não consegue mandar laser: o parser do mestre descarta', () => {
    expect(parsePlayerMessage({ type: 'laser', points: [{ x: 1, y: 2 }] })).toBeNull()
  })
})

describe('parsePlayerMessage', () => {
  it('expõe a versão 1 do protocolo', () => {
    expect(PROTOCOL_VERSION).toBe(1)
  })

  it('aceita join válido, com nome aparado e resume opcional', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: '  Ana  ' })).toEqual({
      type: 'join',
      code: 'AB12CD',
      name: 'Ana',
    })
    expect(parsePlayerMessage({ type: 'join', code: 'ZZZZZZ', name: 'Bia', resume: 'tok' })).toEqual({
      type: 'join',
      code: 'ZZZZZZ',
      name: 'Bia',
      resume: 'tok',
    })
  })

  it('aceita token.move e ping válidos, inclusive como string JSON', () => {
    expect(parsePlayerMessage({ type: 'token.move', reqId: 'r1', tokenId: 't1', x: 10, y: -2.5 })).toEqual({
      type: 'token.move',
      reqId: 'r1',
      tokenId: 't1',
      x: 10,
      y: -2.5,
    })
    expect(parsePlayerMessage('{"type":"ping"}')).toEqual({ type: 'ping' })
  })

  it('aceita signal com x e y finitos e descarta o resto', () => {
    expect(parsePlayerMessage({ type: 'signal', x: 12.5, y: 0, from: 'intruso', color: '#000000' })).toEqual({ type: 'signal', x: 12.5, y: 0 })
    expect(parsePlayerMessage('{"type":"signal","x":1,"y":2}')).toEqual({ type: 'signal', x: 1, y: 2 })
    expect(parsePlayerMessage({ type: 'signal', x: '1', y: 2 })).toBeNull()
    expect(parsePlayerMessage({ type: 'signal', x: 1 })).toBeNull()
    expect(parsePlayerMessage({ type: 'signal', x: Number.NaN, y: 2 })).toBeNull()
    expect(parsePlayerMessage({ type: 'signal', x: 1, y: Number.POSITIVE_INFINITY })).toBeNull()
  })

  it('descarta campos desconhecidos', () => {
    expect(parsePlayerMessage({ type: 'ping', extra: 1 })).toEqual({ type: 'ping' })
  })

  it.each([
    ['null', null],
    ['número', 42],
    ['array', [{ type: 'ping' }]],
    ['objeto sem type', { code: 'AB12CD', name: 'Ana' }],
    ['type desconhecido', { type: 'welcome' }],
    ['JSON inválido', '{type: ping'],
    ['join sem code', { type: 'join', name: 'Ana' }],
    ['join code minúsculo', { type: 'join', code: 'ab12cd', name: 'Ana' }],
    ['join code curto', { type: 'join', code: 'AB12C', name: 'Ana' }],
    ['join code longo', { type: 'join', code: 'AB12CDE', name: 'Ana' }],
    ['join code número', { type: 'join', code: 123456, name: 'Ana' }],
    ['join name vazio', { type: 'join', code: 'AB12CD', name: '   ' }],
    ['join name longo', { type: 'join', code: 'AB12CD', name: 'x'.repeat(33) }],
    ['join name não string', { type: 'join', code: 'AB12CD', name: 7 }],
    ['join resume não string', { type: 'join', code: 'AB12CD', name: 'Ana', resume: 1 }],
    ['move x NaN', { type: 'token.move', reqId: 'r', tokenId: 't', x: Number.NaN, y: 0 }],
    ['move y Infinity', { type: 'token.move', reqId: 'r', tokenId: 't', x: 0, y: Number.POSITIVE_INFINITY }],
    ['move x string', { type: 'token.move', reqId: 'r', tokenId: 't', x: '1', y: 0 }],
    ['move sem tokenId', { type: 'token.move', reqId: 'r', x: 0, y: 0 }],
    ['move reqId longo', { type: 'token.move', reqId: 'r'.repeat(65), tokenId: 't', x: 0, y: 0 }],
    ['move reqId vazio', { type: 'token.move', reqId: '', tokenId: 't', x: 0, y: 0 }],
  ])('rejeita %s', (_label, raw) => {
    expect(parsePlayerMessage(raw)).toBeNull()
  })

  it('mede o nome em unidades UTF-16: 16 emojis cabem, 17 não', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: '😀'.repeat(16) })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: '😀'.repeat(17) })).toBeNull()
  })

  it('token.move com coordenada finita gigante passa no parser (quem recusa é a validação do mapa)', () => {
    expect(parsePlayerMessage({ type: 'token.move', reqId: 'r', tokenId: 't', x: 1.7e308, y: -1e20 })).not.toBeNull()
  })

  it('snapshot carrega explored e ownTokens que atravessam o JSON sem perda', () => {
    const exp = createExploration({ width: 400, height: 400, grid: 40 })
    markRings(exp, [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]])
    const msg: HostMessage = {
      type: 'snapshot',
      rev: 1,
      map: createEmptyMap('m', 'M', 400, 400, 40),
      vision: [],
      explored: encodeExploration(exp),
      ownTokens: ['t1'],
      concealed: [],
    }
    const back: unknown = JSON.parse(JSON.stringify(msg))
    expect(back).toMatchObject({ ownTokens: ['t1'], explored: { cell: 10, cols: 40, rows: 40 } })
    const explored = decodeExploration(Reflect.get(back as object, 'explored'))
    expect(Array.from(explored?.bits ?? [])).toEqual(Array.from(exp.bits))
    expect(PROTOCOL_VERSION).toBe(1)
  })

  it('aceita name com exatamente 32 chars e reqId com 64', () => {
    expect(parsePlayerMessage({ type: 'join', code: 'AB12CD', name: 'x'.repeat(32) })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'token.move', reqId: 'r'.repeat(64), tokenId: 't', x: 0, y: 0 })).not.toBeNull()
  })
})
