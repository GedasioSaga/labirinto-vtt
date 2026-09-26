import { describe, expect, it } from 'vitest'
import { parsePeekHostMessage, parsePlayerMessage, REQ_ID_MAX_LENGTH } from './protocol'
import { ESPIAR_DURACAO_MS, type Espiada } from '../lib/espiar'

/** ESPIAR PELA PASSAGEM no protocolo: o pedido do jogador e a volta do host. */

const VISTA: Espiada = {
  raio: 150,
  grid: 50,
  vision: [
    [
      { x: -150, y: 0 },
      { x: 0, y: -150 },
      { x: 150, y: 0 },
    ],
  ],
  walls: [{ x1: 60, y1: -100, x2: 60, y2: 100 }],
  doors: [{ x1: -80, y1: 80, x2: -20, y2: 80, open: true }],
  tokens: [{ x: 0, y: -80, size: 1, color: '#c0392b' }],
  concealed: [],
  roofs: [],
}

describe('pin.peek (jogador -> mestre)', () => {
  it('só o id do pino; campo extra fica para trás', () => {
    expect(parsePlayerMessage({ type: 'pin.peek', pinId: 'grade', sceneId: 'cena-cripta' })).toEqual({ type: 'pin.peek', pinId: 'grade' })
    expect(parsePlayerMessage(JSON.stringify({ type: 'pin.peek', pinId: 'grade' }))).toEqual({ type: 'pin.peek', pinId: 'grade' })
  })

  it('id fora da forma recusa a mensagem', () => {
    for (const pinId of ['', 7, null, 'x'.repeat(REQ_ID_MAX_LENGTH + 1)]) expect(parsePlayerMessage({ type: 'pin.peek', pinId })).toBeNull()
  })
})

describe('parsePeekHostMessage (mestre -> jogador)', () => {
  it('o recorte válido passa, com o tempo que o host deu', () => {
    const msg = { type: 'pin.peek.view', pinId: 'grade', durationMs: ESPIAR_DURACAO_MS, view: VISTA }
    expect(parsePeekHostMessage(msg)).toEqual(msg)
  })

  it('SEGURANÇA — nome de cena ou campo desconhecido que viesse junto não passa adiante', () => {
    const lido = parsePeekHostMessage({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, sceneName: 'Cripta Rubra', view: { ...VISTA, nome: 'Cripta Rubra' } })
    expect(lido?.type).toBe('pin.peek.view')
    expect(JSON.stringify(lido)).not.toContain('Cripta Rubra')
  })

  it('recorte ruim ou tempo fora da faixa recusam a mensagem inteira', () => {
    expect(parsePeekHostMessage({ type: 'pin.peek.view', pinId: 'grade', durationMs: 4000, view: { ...VISTA, raio: 'grande' } })).toBeNull()
    expect(parsePeekHostMessage({ type: 'pin.peek.view', pinId: 'grade', durationMs: -1, view: VISTA })).toBeNull()
    expect(parsePeekHostMessage({ type: 'pin.peek.view', pinId: 'grade', durationMs: 10 * 60_000, view: VISTA })).toBeNull()
    expect(parsePeekHostMessage({ type: 'pin.peek.view', pinId: '', durationMs: 4000, view: VISTA })).toBeNull()
  })

  it('a recusa: motivo conhecido passa, desconhecido vira o genérico', () => {
    expect(parsePeekHostMessage({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'too_soon' })).toEqual({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'too_soon' })
    expect(parsePeekHostMessage({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'porque_sim' })).toEqual({ type: 'pin.peek.rejected', pinId: 'grade', reason: 'unavailable' })
    expect(parsePeekHostMessage({ type: 'laser', off: true })).toBeNull()
  })
})
