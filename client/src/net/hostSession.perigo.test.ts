import { describe, expect, it } from 'vitest'
import { avancarPerigo } from '../lib/perigo'
import { ADEGA, casa, CORREDOR, COZINHA, DESPENSA, ficha } from '../lib/perigoPlanta.fixture'
import type { MapData } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PERIGO QUE SE ALASTRA pela rede. O fogo nasce na Cozinha, onde a Gabi está.
 * O mestre avança: o Corredor e a Despensa (portas abertas, à vista) pegam fogo e a Cozinha
 * vira cinza. A Adega, atrás da porta fechada, também queima no mapa do
 * mestre — e nenhum snapshot leva o fogo dela nem o id do perigo.
 */
const CODE = 'FOGO01'
const ID_DO_MESTRE = 'perigo_incendio_secreto'

function gabiNaMesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 2000, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const first = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, map).outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(first.playerId, 'gabi')
  return s
}

function snapshotDe(mensagens: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const snap = mensagens.find((m) => m.clientId === 'c1' && m.msg.type === 'snapshot')?.msg
  if (snap?.type !== 'snapshot') throw new Error('esperava snapshot para a Gabi')
  return snap
}

describe('hostSession: o jogador recebe o fogo que vê, nunca o do mestre inteiro', () => {
  it('antes e depois do avanço: o fogo à vista chega, o da Adega e o id nunca', () => {
    const map = casa({
      perigos: [{ id: ID_DO_MESTRE, tipo: 'fogo', salas: [COZINHA, ADEGA] }],
      tokens: [ficha('gabi', 150, 150)],
    })
    const s = gabiNaMesa(map)
    const antes = snapshotDe(s.broadcast(map).outbound)
    expect(antes.map.perigos).toEqual([{ id: 'fogo', tipo: 'fogo', salas: [COZINHA] }])

    const avancou = avancarPerigo(map, ID_DO_MESTRE)
    const depois = snapshotDe(s.broadcast(avancou).outbound)
    expect(depois.map.perigos).toEqual([{ id: 'fogo', tipo: 'fogo', salas: [CORREDOR, DESPENSA], cinzas: [COZINHA] }])

    for (const snap of [antes, depois]) {
      const json = JSON.stringify(snap)
      expect(json).not.toContain(ID_DO_MESTRE)
      expect(json).not.toContain(ADEGA)
    }
  })
})
