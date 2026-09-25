/**
 * PORTAS POR ATRAVESSAR pela REDE. O snapshot de cada jogador leva
 * `porAtravessar`: os ids das portas que ELE conhece com o outro lado ainda na
 * névoa para ele. Só id de porta que já saiu no recorte dele; porta na névoa,
 * porta secreta e porta de outro jogador que ele não conhece não aparecem.
 */
import { describe, expect, it } from 'vitest'
import { ficha, sala, torre } from '../lib/__fixtures__/hazardTower'
import type { MapData, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'PORTAS'

function mesa(source: MapData) {
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

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg).find((m) => m.type === 'snapshot')
  if (msg?.type !== 'snapshot') throw new Error(`esperava o snapshot de ${clientId}`)
  return msg
}

/**
 * Torre: sala-a | porta-ab (aberta) | sala-b | porta-bc (fechada) | sala-c.
 * Ana em x 450 enxerga a sala B pela porta aberta e chega à porta B|C, que
 * está fechada; Bia fica no fundo da sala A, longe (raio 700 vai até x 750).
 */
function andar(mudar: (w: Wall) => Wall = (w) => w): MapData {
  const base = torre({ tokens: [ficha('ana', 450, 200), ficha('bia', 50, 200)] })
  return { ...base, walls: base.walls.map(mudar) }
}

describe('portas por atravessar — snapshot do jogador', () => {
  it('Ana recebe a porta B|C (fechada, sala C na névoa); a porta A|B, com os dois lados à vista, não', () => {
    const map = andar()
    const r = mesa(map).broadcast(map)
    const deAna = snapshotDe(r, 'c1')
    expect(deAna.porAtravessar).toEqual(['porta-bc'])
    expect(deAna.map.walls.some((w) => w.id === 'porta-bc' && w.door !== null)).toBe(true)
  })

  it('SEGURANÇA: Bia não conhece a porta B|C — nem a marca nem o id chegam a ela', () => {
    const map = andar()
    const r = mesa(map).broadcast(map)
    const deBia = snapshotDe(r, 'c2')
    expect(deBia.porAtravessar ?? []).not.toContain('porta-bc')
    expect(JSON.stringify(deBia)).not.toContain('porta-bc')
  })

  it('SEGURANÇA: porta secreta não vira marca (nem o id) para ninguém', () => {
    const map = andar((w) => (w.id === 'porta-bc' && w.door !== null ? { ...w, door: { ...w.door, secret: true } } : w))
    const r = mesa(map).broadcast(map)
    expect(JSON.stringify(r.outbound)).not.toContain('porta-bc')
    expect(snapshotDe(r, 'c1').porAtravessar ?? []).toEqual([])
  })

  it('SEGURANÇA: sala C secreta atrás da porta B|C aberta: o campo sai igual ao de quando não há sala C', () => {
    const abrirBC = (w: Wall): Wall => (w.id === 'porta-bc' && w.door !== null ? { ...w, door: { ...w.door, open: true } } : w)
    const semSalaC: MapData = { ...andar(abrirBC), regions: [sala('sala-a', 0, 500), sala('sala-b', 500, 1000)] }
    const comSecreta: MapData = { ...semSalaC, regions: [...semSalaC.regions, sala('sala-c', 1000, 1500, { secret: true })] }
    const deAnaSem = snapshotDe(mesa(semSalaC).broadcast(semSalaC), 'c1')
    const deAnaCom = snapshotDe(mesa(comSecreta).broadcast(comSecreta), 'c1')
    // O cenário é o do vazamento: mapa, visão e preto idênticos nos dois casos.
    expect(deAnaCom.map).toEqual(deAnaSem.map)
    expect(deAnaCom.vision).toEqual(deAnaSem.vision)
    expect(deAnaCom.concealed).toEqual(deAnaSem.concealed)
    expect(deAnaCom.porAtravessar).toEqual(deAnaSem.porAtravessar)
    expect('porAtravessar' in deAnaCom).toBe(false)
  })

  it('o mestre abre a porta B|C: a sala C entra na visão e a marca some (o campo nem sai)', () => {
    const fechada = andar()
    const s = mesa(fechada)
    s.broadcast(fechada)
    const aberta = andar((w) => (w.id === 'porta-bc' && w.door !== null ? { ...w, door: { ...w.door, open: true } } : w))
    const deAna = snapshotDe(s.broadcast(aberta), 'c1')
    expect(deAna.map.walls.some((w) => w.id === 'porta-bc' && w.door?.open === true)).toBe(true)
    expect('porAtravessar' in deAna).toBe(false)
  })
})
