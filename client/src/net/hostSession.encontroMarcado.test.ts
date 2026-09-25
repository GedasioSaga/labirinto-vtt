import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ENCONTRO MARCADO no host. Ana combina "espero a Bia no portão, 15 min":
 * - só ANA recebe quem e onde (`wait.state`); o mestre lê no painel Grupo;
 * - quem VÊ a ficha dela recebe só o id em `waiting` (a marca "esperando");
 * - quando a Bia APARECE no recorte de Ana, ela lê "Bia chegou"; o prazo
 *   vencido vira "o prazo acabou".
 *
 * O que NUNCA chega a ninguém: onde a Bia está enquanto não aparece (outra
 * cena, escuro), o "quem" e o "onde" da Ana para os colegas, e a ficha que
 * espera no escuro.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const MINUTO = 60_000
const T0 = 1_000_000

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

/** O Salão (aberto no editor) e a Cripta Secreta (fundo). Salão: 2.000 × 500 px. */
function mundo(salao: Token[], cripta: Token[]): HostWorld {
  const map: MapData = { ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50), tokens: salao }
  const fundo: MapData = { ...createEmptyMap('mapa-cripta', 'Cripta Secreta', 20, 10, 50), tokens: cripta }
  return { open: { sceneId: SALAO, name: 'Salão', map }, background: [{ sceneId: CRIPTA, name: 'Cripta Secreta', map: fundo }] }
}

function welcomeOf(r: HostResult): { playerId: string; resumeToken: string } {
  const first = r.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** Ana e Caio no Salão, lado a lado; Bia na Cripta. */
function mesa() {
  let clock = T0
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const w = mundo([token('ana-t', 200, 200), token('caio-t', 400, 200)], [token('bia-t', 300, 200)])
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  const caio = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Caio' }, w))
  const bia = welcomeOf(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Bia' }, w))
  s.assignToken(ana.playerId, 'ana-t')
  s.assignToken(caio.playerId, 'caio-t')
  s.assignToken(bia.playerId, 'bia-t')
  return {
    s,
    w,
    ana,
    avancar: (ms: number) => {
      clock += ms
    },
    esperar: (msg: Record<string, unknown>, world: HostWorld = w) => s.handleMessage('c1', { type: 'wait.set', ...msg }, world),
  }
}

type Snapshot = Extract<HostMessage, { type: 'snapshot' | 'delta' }>

function snapshotDe(r: HostResult, clientId: string): Snapshot {
  const msg = r.outbound.find((o) => o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta'))?.msg
  if (msg === undefined || (msg.type !== 'snapshot' && msg.type !== 'delta')) throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

function para(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function fimDaEspera(r: HostResult, clientId: string): HostMessage | undefined {
  return para(r, clientId).find((m) => m.type === 'wait.ended')
}

describe('hostSession: encontro marcado', () => {
  it('Ana marca a espera: só ela recebe quem, onde e quanto falta', () => {
    const t = mesa()
    const r = t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'wait.state', wait: { who: 'Bia', where: 'no portão', remainingMs: 15 * MINUTO } } }])
    // A marca na ficha muda o que os colegas veem: o integrador refaz o broadcast.
    expect(r.waitsChanged).toBe(true)
  })

  it('SEGURANÇA — Caio, que vê a ficha da Ana, recebe só a marca: nem o colega, nem o lugar', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    const b = t.s.broadcast(t.w)
    expect(snapshotDe(b, 'c2').waiting).toEqual(['ana-t'])
    // A própria Ana vê a marca na ficha dela.
    expect(snapshotDe(b, 'c1').waiting).toEqual(['ana-t'])
    const caioLeu = JSON.stringify(para(b, 'c2'))
    expect(caioLeu).not.toContain('no portão')
    expect(caioLeu).not.toContain('Bia')
    expect(caioLeu).not.toContain('wait.')
  })

  it('SEGURANÇA — a Bia, em outra cena, não recebe nada da espera da Ana', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    const b = t.s.broadcast(t.w)
    const snap = snapshotDe(b, 'c3')
    expect(snap.map.id).toBe('mapa-cripta')
    expect(snap.waiting).toBeUndefined()
    const biaLeu = JSON.stringify(para(b, 'c3'))
    expect(biaLeu).not.toContain('ana-t')
    expect(biaLeu).not.toContain('no portão')
    expect(biaLeu).not.toContain('Salão')
  })

  it('SEGURANÇA — ficha que espera no escuro: quem está na cena mas não a vê não recebe a marca', () => {
    const t = mesa()
    const w = mundo([token('ana-t', 200, 200), token('caio-t', 1800, 250)], [token('bia-t', 300, 200)])
    t.esperar({ minutes: 15 }, w)
    const b = t.s.broadcast(w)
    expect(snapshotDe(b, 'c2').map.tokens.map((tk) => tk.id)).toEqual(['caio-t'])
    expect(snapshotDe(b, 'c2').waiting).toBeUndefined()
    expect(JSON.stringify(para(b, 'c2'))).not.toContain('ana-t')
  })

  it('a Bia aparece no recorte da Ana: "Bia chegou", e a marca sai da ficha', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    // Enquanto ela está na Cripta, Ana não sabe de nada — nem que ela existe lá.
    const antes = t.s.broadcast(t.w)
    expect(fimDaEspera(antes, 'c1')).toBeUndefined()
    expect(JSON.stringify(para(antes, 'c1'))).not.toContain('bia-t')
    expect(JSON.stringify(para(antes, 'c1'))).not.toContain('Cripta Secreta')

    const chegou = mundo([token('ana-t', 200, 200), token('caio-t', 400, 200), token('bia-t', 300, 200)], [])
    const r = t.s.broadcast(chegou)
    expect(fimDaEspera(r, 'c1')).toEqual({ type: 'wait.ended', reason: 'met', who: 'Bia' })
    expect(fimDaEspera(r, 'c2')).toBeUndefined()
    expect(r.waitsChanged).toBe(true)

    const depois = t.s.broadcast(chegou)
    expect(snapshotDe(depois, 'c1').waiting).toBeUndefined()
    expect(snapshotDe(depois, 'c2').waiting).toBeUndefined()
    expect(fimDaEspera(depois, 'c1')).toBeUndefined()
    expect(depois.waitsChanged).toBeUndefined()
  })

  it('SEGURANÇA — a Bia entra no Salão, mas no escuro da Ana: nenhum aviso (o aviso diria onde ela está)', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'bia' })
    t.s.broadcast(t.w)
    const noEscuro = mundo([token('ana-t', 200, 200), token('caio-t', 400, 200), token('bia-t', 1800, 250)], [])
    const r = t.s.broadcast(noEscuro)
    expect(fimDaEspera(r, 'c1')).toBeUndefined()
    expect(JSON.stringify(para(r, 'c1'))).not.toContain('bia-t')
    expect(snapshotDe(r, 'c1').waiting).toEqual(['ana-t'])
  })

  it('"qualquer colega": quem já estava à vista não conta; quem some e volta, conta', () => {
    const t = mesa()
    t.esperar({ minutes: 15 })
    expect(fimDaEspera(t.s.broadcast(t.w), 'c1')).toBeUndefined()
    const longe = mundo([token('ana-t', 200, 200), token('caio-t', 1800, 250)], [token('bia-t', 300, 200)])
    expect(fimDaEspera(t.s.broadcast(longe), 'c1')).toBeUndefined()
    expect(fimDaEspera(t.s.broadcast(t.w), 'c1')).toEqual({ type: 'wait.ended', reason: 'met', who: 'Caio' })
  })

  it('o prazo vence: só a Ana lê "o prazo acabou", e o relógio do host diz quando', () => {
    const t = mesa()
    t.esperar({ minutes: 5, who: 'Bia' })
    expect(t.s.nextWaitDeadline()).toBe(T0 + 5 * MINUTO)
    t.avancar(5 * MINUTO - 1)
    expect(t.s.expireWaits()).toEqual({ outbound: [] })
    t.avancar(1)
    const r = t.s.expireWaits()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'wait.ended', reason: 'expired', who: 'Bia' } }])
    expect(r.waitsChanged).toBe(true)
    expect(t.s.nextWaitDeadline()).toBeNull()
    expect(snapshotDe(t.s.broadcast(t.w), 'c2').waiting).toBeUndefined()
  })

  it('o mestre lê no painel Grupo quem espera quem, onde e até quando', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    const jogadores = t.s.listPlayers(t.w)
    expect(jogadores.find((p) => p.name === 'Ana')?.waiting).toEqual({ who: 'Bia', where: 'no portão', until: T0 + 15 * MINUTO })
    expect(jogadores.find((p) => p.name === 'Caio')?.waiting).toBeUndefined()
  })

  it('"Parar de esperar": a espera some da Ana, do mestre e das fichas', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia' })
    const r = t.s.handleMessage('c1', { type: 'wait.clear' }, t.w)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'wait.state', wait: null } }])
    expect(r.waitsChanged).toBe(true)
    expect(t.s.listPlayers(t.w).find((p) => p.name === 'Ana')?.waiting).toBeUndefined()
    expect(snapshotDe(t.s.broadcast(t.w), 'c2').waiting).toBeUndefined()
  })

  it('a Ana viaja para outra cena: a espera acaba, sem dizer o nome da cena', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia', where: 'no portão' })
    t.s.broadcast(t.w)
    const viajou = mundo([token('caio-t', 400, 200)], [token('bia-t', 300, 200), token('ana-t', 600, 200)])
    const r = t.s.broadcast(viajou)
    expect(fimDaEspera(r, 'c1')).toEqual({ type: 'wait.ended', reason: 'left', who: 'Bia' })
  })

  it('a Ana recarrega a página: volta com a espera e o tempo que falta', () => {
    const t = mesa()
    t.esperar({ minutes: 15, who: 'Bia' })
    t.s.disconnect('c1')
    t.avancar(3 * MINUTO)
    const r = t.s.handleMessage('c9', { type: 'join', code: CODE, name: 'Ana', resume: t.ana.resumeToken }, t.w)
    expect(para(r, 'c9')).toContainEqual({ type: 'wait.state', wait: { who: 'Bia', remainingMs: 12 * MINUTO } })
  })

  it('quem não está em cena não marca espera', () => {
    const t = mesa()
    t.s.handleMessage('c4', { type: 'join', code: CODE, name: 'Duda' }, t.w)
    const r = t.s.handleMessage('c4', { type: 'wait.set', minutes: 15 }, t.w)
    expect(r.outbound).toEqual([{ clientId: 'c4', msg: { type: 'wait.state', wait: null } }])
    expect(r.waitsChanged).toBeUndefined()
    expect(t.s.nextWaitDeadline()).toBeNull()
  })
})
