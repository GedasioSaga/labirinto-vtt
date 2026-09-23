/**
 * CÔMODO LEMBRADO, no FIO. `lib/fogFilter.comodo.test.ts` prova o recorte;
 * aqui a prova é o pacote de verdade (`snapshot`) que a sessão do mestre
 * entrega: o Bruno abre a porta, vê o corredor, fecha — e o corredor continua
 * no mapa dele, com a névoa levantada (mais apagado) e o armário tocável. A
 * despensa, de porta fechada, nem aparece, nem na grade do explorado.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function comodo(id: string, points: Region['points'], parentId?: string): Region {
  return {
    id,
    points,
    tag: '',
    fillColor: '#654',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: `nome-${id}`, comodo: true },
    ...(parentId === undefined ? {} : { parentId }),
  }
}

function retangulo(x0: number, y0: number, x1: number, y1: number): Region['points'] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number): Pin {
  return { id, kind: 'exclamacao', x, y, description: `descricao-${id}`, image: null }
}

/**
 * Sala 100..400 (o Bruno em 250, 250), corredor 400..800 a leste com porta em
 * x = 400, y 230..270. Dentro da sala, no canto noroeste, a despensa
 * 110..190 com parede própria e porta FECHADA: da sala não se vê dentro dela.
 */
function casa(portaAberta: boolean, ana: { x: number; y: number } = { x: 900, y: 900 }): MapData {
  return {
    ...createEmptyMap('m-casa', 'Casa do prefeito', 25, 25, 40),
    regions: [comodo('sala', retangulo(100, 100, 400, 400)), comodo('corredor', retangulo(400, 100, 800, 400)), comodo('despensa', retangulo(110, 110, 190, 190), 'sala')],
    walls: [
      parede('sala-n', 100, 100, 400, 100),
      parede('sala-o', 100, 100, 100, 400),
      parede('sala-s', 100, 400, 400, 400),
      parede('comum-1', 400, 100, 400, 230),
      parede('porta-corredor', 400, 230, 400, 270, { open: portaAberta, locked: false, kind: 'normal' }),
      parede('comum-2', 400, 270, 400, 400),
      parede('corredor-n', 400, 100, 800, 100),
      parede('corredor-l', 800, 100, 800, 400),
      parede('corredor-s', 400, 400, 800, 400),
      parede('despensa-n', 110, 110, 190, 110),
      parede('despensa-o', 110, 110, 110, 190),
      parede('despensa-l-1', 190, 110, 190, 140),
      parede('porta-despensa', 190, 140, 190, 160, { open: false, locked: false, kind: 'normal' }),
      parede('despensa-l-2', 190, 160, 190, 190),
      parede('despensa-s', 110, 190, 190, 190),
    ],
    pins: [pino('armario-do-corredor', 450, 130), pino('pote-da-despensa', 150, 150)],
    tokens: [ficha('ficha-bruno', 250, 250), ficha('ficha-ana', ana.x, ana.y)],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const bruno = entra(s, 'c1', 'Bruno', map)
  s.assignToken(bruno, 'ficha-bruno')
  s.assignToken(entra(s, 'c2', 'Ana', map), 'ficha-ana')
  return { s, bruno }
}

const regioes = (snap: Extract<HostMessage, { type: 'snapshot' }>): string[] => snap.map.regions.map((r) => r.id).sort()

describe('hostSession — cômodo lembrado no pacote do jogador', () => {
  it('abre a porta, vê o corredor, fecha: o corredor fica lembrado, com a névoa levantada e o armário tocável', () => {
    const { s } = mesa(casa(false))

    const antes = snapshotPara(s.broadcast(casa(false)), 'c1')
    expect(regioes(antes)).toEqual(['sala'])
    expect(JSON.stringify(antes.map)).not.toContain('nome-corredor')
    expect(JSON.stringify(antes.map)).not.toContain('armario-do-corredor')

    const aberta = snapshotPara(s.broadcast(casa(true)), 'c1')
    expect(regioes(aberta)).toEqual(['corredor', 'sala'])
    expect(aberta.map.pins.map((p) => p.id)).toEqual(['armario-do-corredor'])

    // A Ana entra no corredor DEPOIS que a porta fechou: lembrar do cômodo não é espiar quem está nele.
    const fechada = snapshotPara(s.broadcast(casa(false, { x: 600, y: 250 })), 'c1')
    expect(regioes(fechada)).toEqual(['corredor', 'sala'])
    expect(fechada.map.pins.map((p) => p.id)).toEqual(['armario-do-corredor'])
    expect(fechada.map.tokens.map((t) => t.id)).toEqual(['ficha-bruno'])

    // A névoa do corredor INTEIRO levantou, até o canto que a porta nunca mostrou.
    const explorado = decodeExploration(fechada.explored)
    expect(explorado).not.toBeNull()
    if (explorado === null) return
    expect(isPointExplored(explorado, { x: 450, y: 130 })).toBe(true)
    expect(isPointExplored(explorado, { x: 780, y: 380 })).toBe(true)
  })

  it('a despensa de porta fechada, dentro da sala lembrada, não aparece nem na grade do explorado', () => {
    const { s } = mesa(casa(false))
    const snap = snapshotPara(s.broadcast(casa(false)), 'c1')

    expect(regioes(snap)).toEqual(['sala'])
    const json = JSON.stringify(snap.map)
    expect(json).not.toContain('nome-despensa')
    expect(json).not.toContain('pote-da-despensa')

    const explorado = decodeExploration(snap.explored)
    expect(explorado).not.toBeNull()
    if (explorado === null) return
    // Controle: a sala onde ele está levantou...
    expect(isPointExplored(explorado, { x: 300, y: 380 })).toBe(true)
    // ...a despensa, que ele nunca viu, não.
    expect(isPointExplored(explorado, { x: 150, y: 150 })).toBe(false)
  })

  it('"Esconder planta" esquece os cômodos lembrados junto com o explorado', () => {
    const { s, bruno } = mesa(casa(false))
    s.broadcast(casa(true))
    expect(regioes(snapshotPara(s.broadcast(casa(false)), 'c1'))).toEqual(['corredor', 'sala'])

    s.hidePlan(bruno, casa(false))
    expect(regioes(snapshotPara(s.broadcast(casa(false)), 'c1'))).toEqual(['sala'])
  })

  it('a Ana, na rua, não recebe nada da casa que o Bruno viu', () => {
    const { s } = mesa(casa(true))
    const daAna = snapshotPara(s.broadcast(casa(true)), 'c2').map
    expect(daAna.regions).toEqual([])
    expect(daAna.pins).toEqual([])
  })
})
