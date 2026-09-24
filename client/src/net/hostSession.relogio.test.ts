/**
 * RELÓGIO DA CAMPANHA pela rede: o mestre avança a hora; cada jogador recebe
 * no snapshot só o PERÍODO e, da cena ONDE ELE ESTÁ, se está escuro. Numa cena
 * externa, à noite, a visão dele cai — o recorte encolhe no host, então o que
 * ficou no escuro não chega. A hora exata e a marca "externa" nunca viajam.
 */
import { describe, expect, it } from 'vitest'
import { NIGHT_VISION_FACTOR } from '../lib/campaignClock'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RAIO = 700
const CENTRO = 1000

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function cena(sceneId: string, name: string, tokens: Token[], externa: boolean): HostScene {
  const base: MapData = { ...createEmptyMap(`m-${sceneId}`, name, 40, 40, 50), tokens }
  return { sceneId, name, map: externa ? { ...base, externa: true } : base }
}

/** Pátio (externo, aberto) com Ana e um lobo a 500 px dela; Cripta (interna) com Bruno. */
function mundo(): HostWorld {
  return {
    open: cena('s-patio', 'Patio das Oliveiras', [ficha('lanterna', CENTRO, CENTRO), ficha('lobo', CENTRO + 500, CENTRO)], true),
    background: [cena('s-cripta', 'Cripta Rubra', [ficha('machado', CENTRO, CENTRO)], false)],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, world: HostWorld): string {
  const result = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world)
  const welcome = result.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(hora: { value: number | null }) {
  let n = 0
  const world = mundo()
  const s = createHostSession({
    code: CODE,
    visionRadius: RAIO,
    now: () => 0,
    randomId: () => `id-${(n += 1)}`,
    tableKey: 'chave-da-tv',
    getClock: () => hora.value,
  })
  s.assignToken(entra(s, 'c1', 'Ana', world), 'lanterna')
  s.assignToken(entra(s, 'c2', 'Bruno', world), 'machado')
  return { s, world }
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

/** Até onde a visão chega, a partir do centro da ficha. */
function alcance(vision: RegionPoint[][]): number {
  const pontos = vision.flat()
  return Math.max(...pontos.map((p) => Math.hypot(p.x - CENTRO, p.y - CENTRO)))
}

describe('relógio da campanha no snapshot', () => {
  it('de dia, na cena externa: só o período, visão inteira, o lobo à vista', () => {
    const { s, world } = mesa({ value: 14 })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    expect(ana.relogio).toEqual({ periodo: 'tarde' })
    expect(alcance(ana.vision)).toBeGreaterThan(RAIO - 5)
    expect(alcance(ana.vision)).toBeLessThanOrEqual(RAIO + 1)
    expect(ana.map.tokens.map((t) => t.id).sort()).toEqual(['lanterna', 'lobo'])
  })

  it('à noite, na cena externa: escuro, a visão cai e o lobo no escuro NÃO chega', () => {
    const { s, world } = mesa({ value: 22 })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    expect(ana.relogio).toEqual({ periodo: 'noite', escuro: true })
    const noite = Math.round(RAIO * NIGHT_VISION_FACTOR)
    expect(alcance(ana.vision)).toBeGreaterThan(noite - 5)
    expect(alcance(ana.vision)).toBeLessThanOrEqual(noite + 1)
    expect(ana.map.tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(JSON.stringify(ana)).not.toContain('"lobo"')
  })

  it('à noite, na cena interna: noite sem escuro, visão inteira', () => {
    const { s, world } = mesa({ value: 22 })
    const bruno = snapshotDe(s.broadcast(world), 'c2')
    expect(bruno.relogio).toEqual({ periodo: 'noite' })
    expect(alcance(bruno.vision)).toBeGreaterThan(RAIO - 5)
    expect(alcance(bruno.vision)).toBeLessThanOrEqual(RAIO + 1)
  })

  it('nunca viaja a hora exata, a marca "externa" nem o nome de outra cena', () => {
    const { s, world } = mesa({ value: 21 })
    const r = s.broadcast(world)
    for (const clientId of ['c1', 'c2']) {
      const snap = snapshotDe(r, clientId)
      expect(Object.keys(snap.relogio ?? {}).every((k) => k === 'periodo' || k === 'escuro')).toBe(true)
      expect('externa' in snap.map).toBe(false)
    }
    const texto = JSON.stringify(r.outbound)
    expect(texto).toContain('"periodo":"noite"')
    // Nomes e ids de cena não saem para ninguém (o id do MAPA da própria cena, sim).
    for (const segredo of ['"hora"', '"externa"', 'Patio das Oliveiras', 'Cripta Rubra', '"s-cripta"', '"s-patio"']) {
      expect(texto).not.toContain(segredo)
    }
    // Da cena do outro, nem o id do mapa: o relógio não abre porta para outra cena.
    expect(JSON.stringify(snapshotDe(r, 'c1'))).not.toContain('m-s-cripta')
    expect(JSON.stringify(snapshotDe(r, 'c2'))).not.toContain('m-s-patio')
  })

  it('o mestre avança a hora: o próximo snapshot já sai com o período novo', () => {
    const hora: { value: number | null } = { value: 17 }
    const { s, world } = mesa(hora)
    expect(snapshotDe(s.broadcast(world), 'c1').relogio).toEqual({ periodo: 'tarde' })
    hora.value = 18
    expect(snapshotDe(s.broadcast(world), 'c1').relogio).toEqual({ periodo: 'noite', escuro: true })
  })

  it('sem relógio no mestre: o campo nem sai, e a visão é a de sempre', () => {
    const { s, world } = mesa({ value: null })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    expect('relogio' in ana).toBe(false)
    expect(alcance(ana.vision)).toBeGreaterThan(RAIO - 5)
    expect(alcance(ana.vision)).toBeLessThanOrEqual(RAIO + 1)
  })
})
