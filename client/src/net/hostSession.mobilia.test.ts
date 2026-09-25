/**
 * MOBÍLIA DESENHADA, no FIO. `lib/fogFilter.mobilia.test.ts` prova o recorte;
 * aqui a prova é o pacote de verdade (`snapshot`) que a sessão do mestre
 * entrega ao transporte: a Ana recebe o catre com o tipo, o Bruno não recebe
 * nada dele, e o catre que o mestre esconde não vai para ninguém.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

const CATRE: Prop = { id: 'movel-catre', src: '', x: 250, y: 200, width: 40, height: 80, linkedMapPath: null, mobilia: 'catre' }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

const DORMITORIO: Region = {
  id: 'dormitorio',
  points: [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 400 },
    { x: 100, y: 400 },
  ],
  tag: '',
  fillColor: '#654',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Dormitório' },
}

/** Dormitório à esquerda da parede cega em x=500 (Ana), corredor à direita (Bruno). */
function quartel(extraDoCatre: Partial<Prop> = {}): MapData {
  return {
    ...createEmptyMap('m-quartel', 'Quartel', 25, 25, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    regions: [DORMITORIO],
    tokens: [ficha('ficha-ana', 250, 350), ficha('ficha-bruno', 800, 350)],
    props: [{ ...CATRE, locked: true, ...extraDoCatre }],
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

describe('hostSession — mobília desenhada no pacote do jogador', () => {
  it('o pacote da Ana leva o catre com o tipo; o do Bruno, sem visão do dormitório, não leva nada dele', () => {
    const map = quartel()
    const r = mesa(map).broadcast(map)

    expect(snapshotPara(r, 'c1').map.props).toEqual([CATRE])
    const doBruno = snapshotPara(r, 'c2').map
    expect(doBruno.props).toEqual([])
    expect(JSON.stringify(doBruno)).not.toContain('mobilia')
    expect(JSON.stringify(doBruno)).not.toContain('movel-catre')
  })

  it('"Oculto para jogadores": o catre sai do pacote da Ana no envio seguinte, com tipo e tudo', () => {
    const map = quartel()
    const s = mesa(map)
    expect(snapshotPara(s.broadcast(map), 'c1').map.props).toEqual([CATRE])

    const escondido = snapshotPara(s.broadcast(quartel({ secret: true })), 'c1').map
    expect(escondido.props).toEqual([])
    expect(JSON.stringify(escondido)).not.toContain('mobilia')
    expect(JSON.stringify(escondido)).not.toContain('movel-catre')
  })
})
