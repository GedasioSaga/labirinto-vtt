/**
 * VER PELA PORTA ABERTA DE PRÉDIO FECHADO, no FIO. `lib/fogFilter.verPelaPorta.test.ts`
 * prova o recorte; aqui a prova é o pacote de verdade (`snapshot`) que a
 * sessão do mestre entrega ao transporte: a Ana, no vão da porta, recebe o
 * colega e a espiada; o Bruno, na rua, não recebe nada de dentro nem a espiada;
 * e quando a Ana sai do vão o teto volta a esconder tudo.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function casa(): Region {
  return {
    id: 'casa',
    points: [
      { x: 200, y: 200 },
      { x: 600, y: 200 },
      { x: 600, y: 600 },
      { x: 200, y: 600 },
    ],
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Casa do ferreiro', roof: true },
  }
}

/** Casa de teto fechado com a porta aberta no muro sul (x 380..420) e uma divisória em y = 400. */
function vila(ana: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('m-vila', 'Vila', 25, 25, 40),
    regions: [casa()],
    walls: [
      parede('muro-norte', 200, 200, 600, 200),
      parede('muro-oeste', 200, 200, 200, 600),
      parede('muro-leste', 600, 200, 600, 600),
      parede('muro-sul-a', 200, 600, 380, 600),
      parede('porta-da-casa', 380, 600, 420, 600, { door: { open: true, locked: false, kind: 'normal' } }),
      parede('muro-sul-b', 420, 600, 600, 600),
      parede('divisoria', 200, 400, 600, 400),
    ],
    tokens: [ficha('ficha-ana', ana.x, ana.y), ficha('ficha-bruno', 800, 900), ficha('ferreiro', 400, 500), ficha('vulto-dos-fundos', 400, 300)],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  s.assignToken(entra(s, 'c1', 'Ana', map), 'ficha-ana')
  s.assignToken(entra(s, 'c2', 'Bruno', map), 'ficha-bruno')
  return s
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

describe('hostSession — ver pela porta aberta no pacote do jogador', () => {
  it('a Ana no vão recebe o ferreiro e a espiada; o vulto atrás da divisória não vai', () => {
    const map = vila({ x: 400, y: 630 })
    const daAna = snapshotPara(mesa(map).broadcast(map), 'c1')

    expect(daAna.map.tokens.map((t) => t.id).sort()).toEqual(['ferreiro', 'ficha-ana', 'ficha-bruno'])
    expect(daAna.peek).toEqual({ roofIds: ['casa'], vision: [daAna.vision[0]] })
    expect(JSON.stringify(daAna.map)).not.toContain('vulto-dos-fundos')
    // O teto continua fechado para o resto: a silhueta sai marcada e sem nome.
    const silhueta = daAna.map.regions.find((r) => r.id === 'casa')
    expect(silhueta?.room?.roof).toBe(true)
    expect(JSON.stringify(daAna.map)).not.toContain('Casa do ferreiro')
  })

  it('SEGURANÇA: o Bruno, na rua, não recebe nada de dentro nem o campo da espiada', () => {
    const map = vila({ x: 400, y: 630 })
    const doBruno = snapshotPara(mesa(map).broadcast(map), 'c2')

    expect('peek' in doBruno).toBe(false)
    const json = JSON.stringify(doBruno.map)
    expect(json).not.toContain('ferreiro')
    expect(json).not.toContain('vulto-dos-fundos')
    expect(json).not.toContain('divisoria')
  })

  it('a Ana sai do vão: o envio seguinte volta a esconder o interior e some a espiada', () => {
    const s = mesa(vila({ x: 400, y: 630 }))
    expect(snapshotPara(s.broadcast(vila({ x: 400, y: 630 })), 'c1').peek?.roofIds).toEqual(['casa'])

    const longe = vila({ x: 400, y: 850 })
    const depois = snapshotPara(s.broadcast(longe), 'c1')
    expect('peek' in depois).toBe(false)
    const json = JSON.stringify(depois.map)
    expect(json).not.toContain('ferreiro')
    expect(json).not.toContain('divisoria')
  })
})
