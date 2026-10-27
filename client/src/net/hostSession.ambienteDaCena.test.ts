/**
 * AMBIENTE DA CENA (Luz L4c) pela rede. O mestre mexe no painel durante a
 * sessão (as mesmas funções puras que o painel chama). O jogador recebe SÓ a
 * cor e a força do período em que a cena DELE está (`snapshot.luz`); nunca
 * `ambientePorPeriodo`, `visaoPorPeriodo` nem `periodoFixo`, nem a tinta do
 * outro período, nem a de outra cena.
 */
import { describe, expect, it } from 'vitest'
import { comAmbienteDoPeriodo, comAtalhoDaNoite, comPeriodoFixo, comVisaoDoPeriodo } from '../lib/periodo'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Periodo, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AMB4C1'
const CENTRO = 1000
const COR_DA_TARDE = '#c0ffee'
const COR_DA_NOITE = '#0d0e0f'
const COR_DA_OUTRA_CENA = '#abcdef'

function ficha(id: string): Token {
  return { id, characterId: null, name: `ficha-${id}`, x: CENTRO, y: CENTRO, size: 1, image: null }
}

function mapa(id: string, tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(`m-${id}`, id, 40, 40, 50), tokens, ...extra }
}

/** A tela inteira que o jogador recebeu (`snapshot`, ou `delta` depois da primeira). */
function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' | 'delta' }> | undefined {
  const msg = r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg).find((m) => m.type === 'snapshot' || m.type === 'delta')
  return msg?.type === 'snapshot' || msg?.type === 'delta' ? msg : undefined
}

function mesa(periodo: { atual: Periodo | null }, world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}`, tableKey: 'tv', getPeriodo: () => periodo.atual })
  for (const [clientId, nome, tokenId] of [['c1', 'Ana', 'ana'], ['c2', 'Bruno', 'bruno']] as const) {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
  }
  return s
}

const SEGREDOS = ['"ambientePorPeriodo"', '"visaoPorPeriodo"', '"periodoFixo"', '"externa"', COR_DA_TARDE, COR_DA_OUTRA_CENA]

describe('Ambiente da cena mexido no meio da sessão', () => {
  it('a força nova chega em UMA mensagem, só com cor e força do período atual', () => {
    const periodo: { atual: Periodo | null } = { atual: 'noite' }
    let aberta = comAmbienteDoPeriodo(mapa('patio', [ficha('ana')], { externa: true }), 'tarde', { cor: COR_DA_TARDE, forca: 0.3 })
    const fundo = mapa('torre', [ficha('bruno')], { periodoFixo: 'tarde', ambientePorPeriodo: { tarde: { cor: COR_DA_OUTRA_CENA, forca: 0.9 } } })
    const world = (): HostWorld => ({ open: { sceneId: 's-patio', name: 'Patio', map: aberta }, background: [{ sceneId: 's-torre', name: 'Torre', map: fundo }] })
    const s = mesa(periodo, world())
    s.broadcast(world())

    // Só a força da noite (o deslizante): nada mais muda no que a Ana vê, e mesmo assim a tinta nova chega.
    aberta = comAmbienteDoPeriodo(aberta, 'noite', { forca: 0.4 })
    const soForca = s.broadcast(world())
    expect(soForca.outbound.filter((o) => o.clientId === 'c1')).toHaveLength(1)
    expect(snapshotDe(soForca, 'c1')?.luz?.forca).toBe(0.4)

    // O resto do painel: cor nova na noite, visão de 2 casas e o período fixo na noite.
    aberta = comPeriodoFixo(comVisaoDoPeriodo(comAmbienteDoPeriodo(aberta, 'noite', { cor: COR_DA_NOITE }), 'noite', 2), 'noite')
    const depois = s.broadcast(world())
    const daAna = depois.outbound.filter((o) => o.clientId === 'c1')
    expect(daAna).toHaveLength(1)
    expect(snapshotDe(depois, 'c1')?.luz).toEqual({ periodo: 'noite', cor: COR_DA_NOITE, forca: 0.4 })
    const texto = JSON.stringify(daAna)
    for (const segredo of SEGREDOS) expect(texto, segredo).not.toContain(segredo)
    // Bruno está em outra cena: o gesto no pátio não lhe manda nada.
    expect(depois.outbound.filter((o) => o.clientId === 'c2')).toEqual([])
    // Nada mais mudou: nenhuma mensagem.
    expect(s.broadcast(world()).outbound.filter((o) => o.clientId === 'c1')).toEqual([])
  })

  it('o atalho Escuridão total apaga a visão e manda só a tinta da noite', () => {
    const periodo: { atual: Periodo | null } = { atual: 'noite' }
    let aberta = mapa('patio', [ficha('ana'), { ...ficha('lobo'), x: CENTRO + 150 }], { externa: true })
    const world = (): HostWorld => ({ open: { sceneId: 's-patio', name: 'Patio', map: aberta }, background: [{ sceneId: 's-torre', name: 'Torre', map: mapa('torre', [ficha('bruno')]) }] })
    const s = mesa(periodo, world())
    expect(snapshotDe(s.broadcast(world()), 'c1')?.map.tokens.some((t) => t.id === 'lobo')).toBe(true)
    aberta = comAtalhoDaNoite(aberta, 'escuridao-total')
    const snap = snapshotDe(s.broadcast(world()), 'c1')
    expect(snap?.luz?.forca).toBe(1)
    expect(snap?.map.tokens.some((t) => t.id === 'lobo')).toBe(false)
    for (const segredo of SEGREDOS) expect(JSON.stringify(snap), segredo).not.toContain(segredo)
  })
})
