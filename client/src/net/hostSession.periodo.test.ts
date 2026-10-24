/**
 * DIA/TARDE/NOITE pela rede (Luz L1). O mestre troca o período da sessão
 * (Dia/Tarde/Noite); cada jogador recebe no snapshot SÓ o período da cena
 * ONDE ELE ESTÁ (`periodoDaCena`) e a tinta desse período (`snapshot.luz`,
 * cor e força). Cena interior ignora a troca (nem mensagem nova); cena com
 * período fixo fica nele. A noite encolhe a visão no host, então o que ficou
 * no escuro não chega. Hora nenhuma viaja: o relógio de campanha saiu.
 */
import { describe, expect, it } from 'vitest'
import { AMBIENTE_PADRAO, VISAO_DA_NOITE } from '../lib/periodo'
import { createEmptyMap } from '../lib/mapFactory'
import type { Light, MapData, Periodo, RegionPoint, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const RAIO = 700
const CENTRO = 1000
const COR_TARDE_DA_TORRE = '#aa3311'
const COR_NOITE_DA_TORRE = '#010203'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function cena(sceneId: string, name: string, tokens: Token[], marcas: Partial<MapData> = {}): HostScene {
  return { sceneId, name, map: { ...createEmptyMap(`m-${sceneId}`, name, 40, 40, 50), tokens, ...marcas } }
}

/** Lampião que acende sozinho à noite (Luz L3): o campo `acesaEm` nunca viaja. */
const LAMPIAO: Light = { id: 'lampiao', x: CENTRO + 100, y: CENTRO, radius: 150, color: '#ffb347', intensity: 0.8, acesaEm: ['noite'] }

/**
 * Pátio (externo) com Ana e um lobo a 500 px dela; Cripta (interior, sem
 * marca) com Bruno; Torre (sempre à tarde, tinta própria) com Caio.
 */
function mundo(): HostWorld {
  return {
    open: cena('s-patio', 'Patio das Oliveiras', [ficha('lanterna', CENTRO, CENTRO), ficha('lobo', CENTRO + 500, CENTRO)], { externa: true, lights: [LAMPIAO] }),
    background: [
      cena('s-cripta', 'Cripta Rubra', [ficha('machado', CENTRO, CENTRO)]),
      cena('s-torre', 'Torre Velha', [ficha('cajado', CENTRO, CENTRO)], {
        periodoFixo: 'tarde',
        ambientePorPeriodo: { tarde: { cor: COR_TARDE_DA_TORRE, forca: 0.4 }, noite: { cor: COR_NOITE_DA_TORRE, forca: 1 } },
        visaoPorPeriodo: { noite: 2 },
      }),
    ],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, world: HostWorld): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** A mesa com o período da sessão em `periodo.atual` (`null` = mestre sem período). */
function mesa(periodo: { atual: Periodo | null }) {
  let n = 0
  const world = mundo()
  const s = createHostSession({
    code: CODE,
    visionRadius: RAIO,
    now: () => 0,
    randomId: () => `id-${(n += 1)}`,
    tableKey: 'chave-da-tv',
    getPeriodo: () => periodo.atual,
  })
  s.assignToken(entra(s, 'c1', 'Ana', world), 'lanterna')
  s.assignToken(entra(s, 'c2', 'Bruno', world), 'machado')
  s.assignToken(entra(s, 'c3', 'Caio', world), 'cajado')
  return { s, world }
}

function mensagensDe(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = mensagensDe(r, clientId).find((m) => m.type === 'snapshot')
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

/** Até onde a visão chega, a partir do centro da ficha. */
function alcance(vision: RegionPoint[][]): number {
  return Math.max(...vision.flat().map((p) => Math.hypot(p.x - CENTRO, p.y - CENTRO)))
}

describe('Dia/Tarde/Noite no snapshot (tabela do host)', () => {
  it('a troca chega em UMA mensagem a quem está na cena externa, já com o período novo', () => {
    const periodo: { atual: Periodo | null } = { atual: 'dia' }
    const { s, world } = mesa(periodo)
    expect('luz' in snapshotDe(s.broadcast(world), 'c1')).toBe(false)
    periodo.atual = 'noite'
    const troca = mensagensDe(s.broadcast(world), 'c1')
    expect(troca).toHaveLength(1)
    const [msg] = troca
    expect(msg?.type === 'snapshot' ? msg.luz : undefined).toEqual({ periodo: 'noite', ...AMBIENTE_PADRAO.noite })
  })

  it('cena interior ignora a troca: nenhuma mensagem nova e nenhum campo de luz', () => {
    const periodo: { atual: Periodo | null } = { atual: 'dia' }
    const { s, world } = mesa(periodo)
    expect('luz' in snapshotDe(s.broadcast(world), 'c2')).toBe(false)
    for (const proximo of ['tarde', 'noite', 'dia'] as const) {
      periodo.atual = proximo
      expect(mensagensDe(s.broadcast(world), 'c2'), proximo).toEqual([])
    }
  })

  it('cena externa e cena de período fixo recebem períodos diferentes, cada uma com a tinta dela', () => {
    const { s, world } = mesa({ atual: 'noite' })
    const r = s.broadcast(world)
    expect(snapshotDe(r, 'c1').luz).toEqual({ periodo: 'noite', ...AMBIENTE_PADRAO.noite })
    expect(snapshotDe(r, 'c3').luz).toEqual({ periodo: 'tarde', cor: COR_TARDE_DA_TORRE, forca: 0.4 })
    // Nada do período de OUTRA cena (nem do período que não é o atual da própria).
    const ana = JSON.stringify(mensagensDe(r, 'c1'))
    for (const alheio of [COR_TARDE_DA_TORRE, COR_NOITE_DA_TORRE]) expect(ana).not.toContain(alheio)
    expect(JSON.stringify(mensagensDe(r, 'c3'))).not.toContain(COR_NOITE_DA_TORRE)
  })

  it('a troca na cena de período fixo também não manda nada', () => {
    const periodo: { atual: Periodo | null } = { atual: 'dia' }
    const { s, world } = mesa(periodo)
    s.broadcast(world)
    periodo.atual = 'noite'
    expect(mensagensDe(s.broadcast(world), 'c3')).toEqual([])
  })

  it('0 campos de hora no snapshot: nem relógio, nem hora, nem "escuro"', () => {
    const { s, world } = mesa({ atual: 'noite' })
    const r = s.broadcast(world)
    for (const clientId of ['c1', 'c2', 'c3']) {
      const snap = snapshotDe(r, clientId)
      expect('relogio' in snap, clientId).toBe(false)
      expect(Object.keys(snap.luz ?? {}).every((k) => k === 'periodo' || k === 'cor' || k === 'forca'), clientId).toBe(true)
    }
    const texto = JSON.stringify(r.outbound)
    for (const hora of ['"relogio"', '"hora"', '"hour"', '"escuro"']) expect(texto).not.toContain(hora)
  })

  it('à noite, na cena externa: a visão cai e o lobo no escuro NÃO chega', () => {
    const { s, world } = mesa({ atual: 'noite' })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    const noite = Math.round(RAIO * VISAO_DA_NOITE)
    expect(alcance(ana.vision)).toBeGreaterThan(noite - 5)
    expect(alcance(ana.vision)).toBeLessThanOrEqual(noite + 1)
    expect(ana.map.tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(JSON.stringify(ana)).not.toContain('"lobo"')
  })

  it('de tarde, na cena externa: visão inteira e o lobo à vista', () => {
    const { s, world } = mesa({ atual: 'tarde' })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    expect(ana.luz).toEqual({ periodo: 'tarde', ...AMBIENTE_PADRAO.tarde })
    expect(alcance(ana.vision)).toBeGreaterThan(RAIO - 5)
    expect(ana.map.tokens.map((t) => t.id).sort()).toEqual(['lanterna', 'lobo'])
  })

  it('mestre sem período: o campo nem sai, e a visão é a de sempre', () => {
    const { s, world } = mesa({ atual: null })
    const ana = snapshotDe(s.broadcast(world), 'c1')
    expect('luz' in ana).toBe(false)
    expect(alcance(ana.vision)).toBeGreaterThan(RAIO - 5)
  })

  it('vazamento no pacote real: nenhuma marca de período, acesaEm, externa nem nome de outra cena', () => {
    const { s, world } = mesa({ atual: 'noite' })
    const texto = JSON.stringify(s.broadcast(world).outbound)
    for (const segredo of ['"periodoFixo"', '"ambientePorPeriodo"', '"visaoPorPeriodo"', '"acesaEm"', '"externa"', 'Patio das Oliveiras', 'Cripta Rubra', 'Torre Velha']) {
      expect(texto).not.toContain(segredo)
    }
  })
})
