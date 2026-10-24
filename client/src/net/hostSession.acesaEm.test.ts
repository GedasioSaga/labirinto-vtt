/**
 * LUZ L3 no host, pacote REAL:
 *  - a luz que acende sozinha (`Light.acesaEm`) só sai para o jogador no
 *    período da cena DELE, e o campo nunca sai;
 *  - as cinco checagens de ação que ainda usavam o raio de DIA (achado da L2:
 *    espiar pela porta, cadeado, marca no lugar, agir sobre ficha e as fichas
 *    em outra cena) agora usam o raio do período da cena do jogador: à noite,
 *    com a visão curta, ele não age sobre o que não enxerga.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Light, MapData, Periodo, Pin, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RAIO = 700
const GRID = 50
const CENTRO = 1000
/** Fora da metade da visão (350 px) e dentro da visão cheia. */
const LONGE = 500

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function luz(id: string, x: number, y: number, extra: Partial<Light> = {}): Light {
  return { id, x, y, radius: 120, color: '#ffba7b', intensity: 0.85, ...extra }
}

function patio(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m-patio', 'Patio', 60, 60, GRID), externa: true, tokens: [ficha('heroi', CENTRO, CENTRO)], ...extra }
}

function welcome(r: HostResult): string {
  const first = r.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

/** Ana na mesa com a ficha `heroi`; o período da sessão em `periodo.atual`. */
function mesa(source: MapData | HostWorld, periodo: { atual: Periodo }) {
  let n = 0
  const relogio = { t: 1_000_000 }
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => relogio.t, randomId: () => `id-${(n += 1)}`, getPeriodo: () => periodo.atual })
  s.assignToken(welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, source)), 'heroi')
  return { s, relogio }
}

function mensagemDe(r: HostResult): HostMessage | undefined {
  return r.outbound.find((o) => o.clientId === 'c1')?.msg
}

function snapshotDe(r: HostResult): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = mensagemDe(r)
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

describe('Luz L3 no pacote real do host: a luz acende no período da cena do jogador', () => {
  const lampiao = luz('lampiao', CENTRO + 80, CENTRO, { acesaEm: ['tarde', 'noite'] })
  const doDia = luz('sol-de-vidro', CENTRO - 80, CENTRO, { acesaEm: ['dia'] })

  it('de dia o lampião não sai; de tarde e de noite sai; o campo acesaEm nunca sai', () => {
    const map = patio({ lights: [lampiao, doDia] })
    for (const [periodo, esperado] of [
      ['dia', ['sol-de-vidro']],
      ['tarde', ['lampiao']],
      ['noite', ['lampiao']],
    ] as const) {
      const { s } = mesa(map, { atual: periodo })
      const snap = snapshotDe(s.broadcast(map))
      expect(snap.map.lights.map((l) => l.id), periodo).toEqual(esperado)
      expect(JSON.stringify(snap), periodo).not.toContain('acesaEm')
    }
  })

  it('a troca do mestre muda as luzes do jogador: Dia some, Noite volta', () => {
    const map = patio({ lights: [lampiao] })
    const periodo: { atual: Periodo } = { atual: 'noite' }
    const { s } = mesa(map, periodo)
    expect(snapshotDe(s.broadcast(map)).map.lights.map((l) => l.id)).toEqual(['lampiao'])
    periodo.atual = 'dia'
    const dia = mensagemDe(s.broadcast(map))
    expect(dia?.type === 'snapshot' || dia?.type === 'delta' ? dia.map.lights : null).toEqual([])
    periodo.atual = 'noite'
    const noite = mensagemDe(s.broadcast(map))
    expect(noite?.type === 'snapshot' || noite?.type === 'delta' ? noite.map.lights.map((l) => l.id) : null).toEqual(['lampiao'])
  })

  it('cena interior ignora a troca: o lampião fica aceso de dia', () => {
    const map = patio({ externa: undefined, lights: [lampiao] })
    const { s } = mesa(map, { atual: 'dia' })
    expect(snapshotDe(s.broadcast(map)).map.lights.map((l) => l.id)).toEqual(['lampiao'])
  })
})

describe('Luz L3: as cinco checagens de ação usam o raio do período da cena', () => {
  it('espiar pela porta: à noite sem visão (noite 0) a porta encostada não está à vista', () => {
    const porta: Wall = { id: 'porta', x1: CENTRO + 40, y1: CENTRO - 50, x2: CENTRO + 40, y2: CENTRO + 50, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
    const espiar = (periodo: Periodo): HostResult => {
      const map = patio({ walls: [porta], visaoPorPeriodo: { noite: 0 } })
      const { s } = mesa(map, { atual: periodo })
      s.broadcast(map)
      return s.handleMessage('c1', { type: 'door.peek', wallId: 'porta' }, map)
    }
    expect(espiar('dia').peek).toBeDefined()
    const noite = espiar('noite')
    expect(noite.peek).toBeUndefined()
    expect(mensagemDe(noite)).toEqual({ type: 'door.toggle.rejected', wallId: 'porta', reason: 'not_visible' })
  })

  it('cadeado: à noite o pino a 10 casas, fora da visão curta, não abre', () => {
    const cofre: Pin = { id: 'cofre', x: CENTRO + LONGE, y: CENTRO, kind: 'exclamacao', description: 'Cofre', image: null, segredo: { resposta: '12', forma: 'teclado' } }
    const tentar = (periodo: Periodo): HostMessage | undefined => {
      const map = patio({ pins: [cofre] })
      const { s } = mesa(map, { atual: periodo })
      s.broadcast(map)
      return mensagemDe(s.handleMessage('c1', { type: 'pin.answer', pinId: 'cofre', tentativa: '12' }, map))
    }
    expect(tentar('dia')).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: true })
    expect(tentar('noite')).toEqual({ type: 'pin.answer.result', pinId: 'cofre', ok: false })
  })

  it('marca no lugar: à noite sem visão (noite 0) o ponto encostado não aceita a marca', () => {
    const marcar = (periodo: Periodo): HostResult => {
      const map = patio({ visaoPorPeriodo: { noite: 0 } })
      const { s } = mesa(map, { atual: periodo })
      s.broadcast(map)
      return s.handleMessage('c1', { type: 'mark.place', x: CENTRO + 30, y: CENTRO, tipo: 'bilhete', texto: 'aqui' }, map)
    }
    expect(marcar('dia').applyMark).toBeDefined()
    const noite = marcar('noite')
    expect(noite.applyMark).toBeUndefined()
    expect(mensagemDe(noite)).toEqual({ type: 'mark.place.result', ok: false, reason: 'unavailable' })
  })

  it('agir sobre ficha: à noite o NPC a 10 casas, fora da visão curta, não recebe a ação', () => {
    const agir = (periodo: Periodo): HostMessage | undefined => {
      const map = patio({ tokens: [ficha('heroi', CENTRO, CENTRO), ficha('mercador', CENTRO + LONGE, CENTRO)] })
      const { s } = mesa(map, { atual: periodo })
      s.broadcast(map)
      return mensagemDe(s.handleMessage('c1', { type: 'token.action', reqId: 'r1', tokenId: 'mercador', action: 'acao', text: 'acenar' }, map))
    }
    expect(agir('dia')?.type).not.toBe('token.action.rejected')
    expect(agir('noite')).toEqual({ type: 'token.action.rejected', reqId: 'r1', reason: 'unavailable' })
  })

  it('fichas em outra cena: a Sala de lá só sai com o nome se a visão do período a alcança', () => {
    const adega: Region = {
      id: 'adega',
      points: [
        { x: CENTRO - 100, y: CENTRO - 100 },
        { x: CENTRO + 100, y: CENTRO - 100 },
        { x: CENTRO + 100, y: CENTRO + 100 },
        { x: CENTRO - 100, y: CENTRO + 100 },
      ],
      tag: '',
      fillColor: '#333',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Adega', roof: false },
    }
    const outraCena = (periodo: Periodo): string | undefined => {
      const world: HostWorld = {
        open: { sceneId: 's-sala', name: 'Sala', map: { ...createEmptyMap('m-sala', 'Sala', 40, 40, GRID), tokens: [ficha('heroi', 500, 500)] } },
        background: [{ sceneId: 's-quintal', name: 'Quintal', map: patio({ tokens: [ficha('gemeo', CENTRO, CENTRO)], regions: [adega], visaoPorPeriodo: { noite: 0 } }) }],
      }
      let n = 0
      const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}`, getPeriodo: () => periodo })
      const ana = welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, world))
      s.assignToken(ana, 'heroi')
      s.assignToken(ana, 'gemeo')
      return snapshotDe(s.broadcast(world)).elsewhere?.find((e) => e.tokenId === 'gemeo')?.room
    }
    expect(outraCena('dia')).toBe('Adega')
    expect(outraCena('noite')).toBe('')
  })
})
