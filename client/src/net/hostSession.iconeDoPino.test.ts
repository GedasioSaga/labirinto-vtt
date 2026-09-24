import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * O ícone do marcador pela REDE: o que sai do host para a conexão do jogador.
 * O cartão do jogador só desenha o baú se o baú vier no snapshot — e o ícone
 * de um pino escondido não pode vir, nem como texto solto.
 */

const CODE = 'AB12CD'
const RADIUS = 300

function pin(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `desc-${id}`, image: null, ...extra }
}

function mapa(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('mapa-cripta', 'Cripta', 25, 25, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

function snapshotOf(messages: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const found = messages.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (found === undefined || found.type !== 'snapshot') throw new Error('esperava snapshot para c1')
  return found
}

function snapshotDoJogador(map: MapData): Extract<HostMessage, { type: 'snapshot' }> {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'heroi')
  return snapshotOf(s.broadcast(map).outbound)
}

describe('hostSession: ícone do marcador na rede', () => {
  it('o ícone do pino visível chega no snapshot do jogador', () => {
    const snap = snapshotDoJogador(mapa([pin('bau-da-sala', 240, 200, { icon: 'bau' })]))
    const recebido = snap.map.pins.find((p) => p.id === 'bau-da-sala')
    expect(recebido?.icon).toBe('bau')
  })

  it('o ícone de pino oculto, secreto ou fora da visão não sai pela rede', () => {
    const snap = snapshotDoJogador(
      mapa([
        pin('visivel', 240, 200, { icon: 'chave' }),
        pin('oculto', 250, 200, { icon: 'armadilha', hidden: true }),
        pin('secreto', 260, 200, { icon: 'perigo', secret: true }),
        pin('longe', 900, 900, { icon: 'agua' }),
      ]),
    )
    expect(snap.map.pins.map((p) => p.id)).toEqual(['visivel'])
    const json = JSON.stringify(snap)
    for (const escondido of ['armadilha', 'perigo', 'agua']) {
      expect(json, `a rede vazou o ícone "${escondido}"`).not.toContain(escondido)
    }
  })
})
