/**
 * MOVIMENTO IMPOSTO pela REDE. O mestre aperta "Avançar esteiras" e as fichas
 * andam no mapa do host; cada jogador recebe a PRÓPRIA ficha na casa nova e
 * nada da esteira em si (sala, direção, passo, id). A ficha do colega que a
 * esteira empurrou atrás da porta fechada — ou em outra cena — não chega.
 */
import { describe, expect, it } from 'vitest'
import { ficha, torre } from '../lib/__fixtures__/hazardTower'
import { advanceConveyors } from '../lib/conveyors'
import type { Conveyor, MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'ESTEIR'

function mesa(source: MapData | HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const jogadores: [clientId: string, name: string, tokenId: string][] = [
    ['c1', 'Ana', 'ana'],
    ['c2', 'Bia', 'bia'],
  ]
  for (const [clientId, name, tokenId] of jogadores) {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  return s
}

/** O mapa que o cliente recebeu por último nesta rodada (snapshot ou delta). */
function mapaRecebido(r: HostResult, clientId: string): MapData {
  const msgs = r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
  for (const msg of msgs.reverse()) {
    if (msg.type === 'snapshot' || msg.type === 'delta') return msg.map
  }
  throw new Error(`sem mapa para ${clientId}`)
}

function posicoes(map: MapData): Record<string, { x: number; y: number }> {
  return Object.fromEntries(map.tokens.map((t: Token) => [t.id, { x: t.x, y: t.y }]))
}

const ESTEIRAS: Conveyor[] = [
  { id: 'esteira-segredo-a', roomId: 'sala-a', direction: 'leste', stepCells: 3 },
  { id: 'esteira-segredo-c', roomId: 'sala-c', direction: 'oeste', stepCells: 3 },
]

describe('esteira — o jogador vê só o próprio movimento', () => {
  it('Ana recebe a própria ficha 3 casas adiante; Bia, empurrada atrás da porta fechada, não aparece', () => {
    // Ana na sala A, Bia na sala C; a porta B|C está fechada: uma não enxerga a outra.
    const antes: MapData = { ...torre({ tokens: [ficha('ana', 125, 75), ficha('bia', 1375, 200)] }), conveyors: ESTEIRAS }
    const s = mesa(antes)
    s.broadcast(antes)

    const depois = advanceConveyors(antes)
    const r = s.broadcast(depois)

    expect(posicoes(mapaRecebido(r, 'c1'))).toEqual({ ana: { x: 275, y: 75 } })
    expect(posicoes(mapaRecebido(r, 'c2'))).toEqual({ bia: { x: 1225, y: 200 } })
    // Nada da esteira em si sai pela rede: nem o campo, nem o id, nem a direção.
    for (const clientId of ['c1', 'c2']) expect('conveyors' in mapaRecebido(r, clientId)).toBe(false)
    const pacote = JSON.stringify(r.outbound)
    expect(pacote).not.toContain('esteira-segredo')
    expect(pacote).not.toContain('oeste')
  })

  it('cabine contínua: Ana recebe a própria ficha na próxima parada, e nenhum pino chega com a ligação da cabine', () => {
    const pinos = [
      { id: 'parada-1', x: 125, y: 75, kind: 'exclamacao' as const, description: '', image: null, cabine: 'parada-2' },
      { id: 'parada-2', x: 375, y: 325, kind: 'exclamacao' as const, description: '', image: null, cabine: 'parada-3' },
      { id: 'parada-3', x: 1275, y: 75, kind: 'exclamacao' as const, description: '', image: null, cabine: 'parada-1' },
    ]
    const antes: MapData = { ...torre({ tokens: [ficha('ana', 125, 75), ficha('bia', 1375, 200)] }), pins: pinos }
    const s = mesa(antes)
    s.broadcast(antes)

    const depois = advanceConveyors(antes)
    const r = s.broadcast(depois)

    expect(posicoes(mapaRecebido(r, 'c1'))).toEqual({ ana: { x: 375, y: 325 } })
    for (const clientId of ['c1', 'c2']) {
      for (const pin of mapaRecebido(r, clientId).pins) expect('cabine' in pin).toBe(false)
    }
    expect(JSON.stringify(r.outbound)).not.toContain('"cabine"')
  })

  it('esteira em OUTRA cena da aventura: quem está nesta não recebe nada dela', () => {
    const salao = torre({ tokens: [ficha('ana', 250, 200), ficha('bia', 300, 200)] }, 'm-salao')
    const cripta: MapData = { ...torre({ tokens: [ficha('lich', 125, 75)] }, 'm-cripta'), conveyors: ESTEIRAS }
    const mundo = (map: MapData): HostWorld => ({
      open: { sceneId: 's-salao', name: 'Salão', map: salao },
      background: [{ sceneId: 's-cripta', name: 'Cripta', map }],
    })
    const s = mesa(mundo(cripta))
    const r0 = s.broadcast(mundo(cripta))
    expect(posicoes(mapaRecebido(r0, 'c1'))).toEqual({ ana: { x: 250, y: 200 }, bia: { x: 300, y: 200 } })
    const r = s.broadcast(mundo(advanceConveyors(cripta)))
    const pacote = JSON.stringify([r0.outbound, r.outbound])
    expect(pacote).not.toContain('lich')
    expect(pacote).not.toContain('esteira-segredo')
  })
})
