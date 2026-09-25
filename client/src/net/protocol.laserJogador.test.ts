/**
 * LASER DO JOGADOR no protocolo: o jogador manda `laser` (pontos ou off) e o
 * host aceita só o corpo; o jogador recebe o laser de outro jogador com
 * `from` + `color`, validados antes de ir para o desenho.
 */
import { describe, expect, it } from 'vitest'
import { LASER_MAX_POINTS_PER_MESSAGE } from '../lib/laser'
import { parseLaserMessage, parsePlayerMessage } from './protocol'

describe('parsePlayerMessage: laser do jogador', () => {
  it('aceita lote de pontos e off; devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'laser', points: [{ x: 1, y: 2, z: 3 }] })).toEqual({ type: 'laser', points: [{ x: 1, y: 2 }] })
    expect(parsePlayerMessage(JSON.stringify({ type: 'laser', off: true }))).toEqual({ type: 'laser', off: true })
  })

  it('segurança: nome e cor vindos do jogador não passam (quem põe é o host)', () => {
    expect(parsePlayerMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Mestre', color: '#ff2d2d' })).toEqual({ type: 'laser', points: [{ x: 1, y: 2 }] })
  })

  it('recusa lote vazio, acima do teto ou com ponto não finito', () => {
    expect(parsePlayerMessage({ type: 'laser', points: [] })).toBeNull()
    const muitos = Array.from({ length: LASER_MAX_POINTS_PER_MESSAGE + 1 }, (_, i) => ({ x: i, y: i }))
    expect(parsePlayerMessage({ type: 'laser', points: muitos })).toBeNull()
    expect(parsePlayerMessage({ type: 'laser', points: [{ x: 'a', y: 1 }] })).toBeNull()
    expect(parsePlayerMessage({ type: 'laser', points: [{ x: 1, y: Number.NaN }] })).toBeNull()
    expect(parsePlayerMessage({ type: 'laser' })).toBeNull()
  })
})

describe('parseLaserMessage: laser de outro jogador', () => {
  it('com from e color válidos é o laser de um jogador', () => {
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Ana', color: '#3cff00' })).toEqual({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Ana', color: '#3cff00' })
    expect(parseLaserMessage({ type: 'laser', off: true, from: 'Ana (2)', color: '#3CFF00' })).toEqual({ type: 'laser', off: true, from: 'Ana (2)', color: '#3CFF00' })
  })

  it('sem from nem color continua sendo o laser do mestre', () => {
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }] })).toEqual({ type: 'laser', points: [{ x: 1, y: 2 }] })
  })

  it('só um dos dois, nome vazio ou longo demais, cor fora de #rrggbb: recusa inteira', () => {
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Ana' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], color: '#3cff00' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: '', color: '#3cff00' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'x'.repeat(200), color: '#3cff00' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Ana', color: 'red' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Ana', color: 'url(javascript:1)' })).toBeNull()
  })

  it('com key, a chave opaca do rastro passa; aí o nome da ficha pode vir vazio', () => {
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: 'laser-1', color: '#9ca3af' })).toEqual({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: 'laser-1', color: '#9ca3af' })
    expect(parseLaserMessage({ type: 'laser', off: true, from: '', key: 'laser-2', color: '#9ca3af' })).toEqual({ type: 'laser', off: true, from: '', key: 'laser-2', color: '#9ca3af' })
  })

  it('key vazia, longa demais ou que não é texto: recusa inteira', () => {
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: '', color: '#9ca3af' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: 'k'.repeat(200), color: '#9ca3af' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: 7, color: '#9ca3af' })).toBeNull()
    expect(parseLaserMessage({ type: 'laser', points: [{ x: 1, y: 2 }], from: 'Guarda', key: 'laser-1', color: '#9ca3af' })).not.toBeNull()
  })
})
