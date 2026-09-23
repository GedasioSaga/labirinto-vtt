import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Token } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * VIAJAR JUNTO (G10) no host: quem está perto de quem pediu (Chebyshev ≤ 2
 * casas, mesma cena, jogando e conectado) vai junto quando o mestre deixa — e
 * a conta é refeita no CLIQUE, não no aviso: o grupo anda enquanto o mestre lê.
 */

const CODE = 'AB12CD'
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const ESCADA_A = casa(10, 5)
const ESCADA_B = casa(20, 5)

function ficha(id: string, p: { x: number; y: number }): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null }
}

function escada(id: string, p: { x: number; y: number }, sceneId: string, pinId: string): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: id, image: null, destino: { sceneId, pinId } }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/**
 * Salão com a escada e cinco jogadores: Ana (quem pede), Bruno na diagonal a 2
 * casas dela, Carla a 3, Davi colado (vai desconectar) e Eva na Cripta, nas
 * mesmas coordenadas de Ana — outra cena não conta.
 */
function mesa() {
  const pos: Record<string, { x: number; y: number }> = {
    lanterna: casa(9, 6),
    machado: casa(11, 4),
    cajado: casa(12, 6),
    arco: casa(9, 5),
  }
  /** O que o mestre mudou numa ficha do Salão (esconder, por exemplo). */
  const patch: Record<string, Partial<Token>> = {}
  /** Quem já chegou à Cripta: a ficha sai do Salão e entra lá (o que o integrador faz com `applyTransfer`). */
  const cripta: Record<string, { x: number; y: number }> = { tocha: casa(9, 6) }
  const world = (): HostWorld => ({
    open: {
      sceneId: SALAO,
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-salao', 'Aventura', 40, 12, GRADE),
        tokens: Object.entries(pos).filter(([id]) => !(id in cripta)).map(([id, p]) => ({ ...ficha(id, p), ...patch[id] })),
        pins: [escada('escada-a', ESCADA_A, CRIPTA, 'escada-b')],
      },
    },
    background: [
      {
        sceneId: CRIPTA,
        name: 'Cripta Rubra',
        map: { ...createEmptyMap('mapa-cripta', 'Planta', 40, 12, GRADE), tokens: Object.entries(cripta).map(([id, p]) => ficha(id, p)), pins: [escada('escada-b', ESCADA_B, SALAO, 'escada-a')] },
      },
    ],
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  const entra = (clientId: string, name: string, tokenId: string) => {
    ids[name] = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name }, world()).outbound).playerId
    s.assignToken(ids[name], tokenId)
  }
  entra('c1', 'Ana', 'lanterna')
  entra('c2', 'Bruno', 'machado')
  entra('c3', 'Carla', 'cajado')
  entra('c4', 'Davi', 'arco')
  entra('c5', 'Eva', 'tocha')
  s.disconnect('c4')
  s.broadcast(world())
  const pedir = (clientId: string): string => {
    const r = s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'escada-a' }, world())
    if (r.travelRequest === undefined) throw new Error(`o pedido de ${clientId} deveria valer`)
    return r.travelRequest.requestId
  }
  return { s, pos, patch, cripta, world, ids, pedir }
}

/** Todo mapa (`snapshot` ou `delta`) que saiu para `clientId`. */
function mapasDe(outbound: readonly { clientId: string; msg: HostMessage }[], clientId: string) {
  return outbound.flatMap((o) => (o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta') ? [o.msg.map] : []))
}

describe('hostSession: viajar junto', () => {
  it('quem está perto: Chebyshev ≤ 2 na mesma cena, sem contar quem pediu, quem está longe, desconectado nem outra cena', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    expect(t.s.travelCompanions(pedido, t.world())).toEqual([t.ids.Bruno])
  })

  it('leva só quem AINDA está perto no clique: Bruno se afastou, Carla chegou perto', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    expect(t.s.travelCompanions(pedido, t.world())).toEqual([t.ids.Bruno])
    t.pos.machado = casa(14, 4)
    t.pos.cajado = casa(11, 6)
    const [lider, ...junto] = t.s.approveTravelTogether(pedido, t.world())
    expect(lider.applyTransfer).toMatchObject({ tokenId: 'lanterna', playerId: t.ids.Ana, toSceneId: CRIPTA })
    expect(junto.map((r) => r.applyTransfer?.tokenId)).toEqual(['cajado'])
    // A mesma chegada de quem pediu: "Você chegou", sem nome de cena.
    expect(junto[0].outbound).toEqual([{ clientId: 'c3', msg: { type: 'scene.changed' } }])
  })

  it('cada um numa casa diferente, em volta do pino par; quem pediu na casa livre colada ao pino, não em cima dele', () => {
    const t = mesa()
    t.pos.cajado = casa(10, 6)
    const pedido = t.pedir('c1')
    const resultados = t.s.approveTravelTogether(pedido, t.world())
    const chegadas = resultados.map((r) => r.applyTransfer).filter((a) => a !== undefined)
    expect(chegadas.map((a) => a.tokenId)).toEqual(['lanterna', 'machado', 'cajado'])
    expect(new Set(chegadas.map((a) => `${a.x}|${a.y}`)).size).toBe(3)
    expect(chegadas.every((a) => a.fromSceneId === SALAO && a.toSceneId === CRIPTA)).toBe(true)
    expect(chegadas.every((a) => Math.abs(a.x - ESCADA_B.x) <= 1.5 * GRADE && Math.abs(a.y - ESCADA_B.y) <= 1.5 * GRADE)).toBe(true)
    // Chegada em casa livre: quem pediu senta na casa vizinha ao pino par, que continua livre e tocável.
    expect(chegadas[0].x === ESCADA_B.x && chegadas[0].y === ESCADA_B.y).toBe(false)
    expect(Math.max(Math.abs(chegadas[0].x - ESCADA_B.x), Math.abs(chegadas[0].y - ESCADA_B.y))).toBe(GRADE)
  })

  it('o pedido pendente de quem está perto é resolvido junto', () => {
    const t = mesa()
    const deAna = t.pedir('c1')
    const deBruno = t.pedir('c2')
    const resultados = t.s.approveTravelTogether(deAna, t.world())
    expect(resultados.map((r) => r.applyTransfer?.tokenId)).toEqual(['lanterna', 'machado'])
    expect(t.s.isTravelPending(deAna)).toBe(false)
    expect(t.s.isTravelPending(deBruno)).toBe(false)
    // Resolvido, não esquecido: aprovar o dele depois não leva ninguém de novo.
    expect(t.s.approveTravel(deBruno, t.world())).toEqual({ outbound: [] })
  })

  it('quem pediu não passa na revalidação: ninguém vai junto', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    // A ficha de Ana some do Salão (foi removida pelo mestre): o pedido morre.
    delete t.pos.lanterna
    const resultados = t.s.approveTravelTogether(pedido, t.world())
    expect(resultados).toHaveLength(1)
    expect(resultados[0].applyTransfer).toBeUndefined()
  })

  it('ficha que o mestre escondeu não conta nem viaja: Bruno escondido fica, e o jogador não é levado para a Cripta', () => {
    const t = mesa()
    t.patch.machado = { hidden: true }
    const pedido = t.pedir('c1')
    expect(t.s.travelCompanions(pedido, t.world())).toEqual([])
    const resultados = t.s.approveTravelTogether(pedido, t.world())
    expect(resultados.map((r) => r.applyTransfer?.tokenId)).toEqual(['lanterna'])
    expect(resultados.flatMap((r) => r.outbound.map((o) => o.clientId))).not.toContain('c2')
  })

  it('pela rede: quem fica não recebe as fichas de quem foi, e nenhum nome de cena sai para ninguém', () => {
    const t = mesa()
    const pedido = t.pedir('c1')
    const resultados = t.s.approveTravelTogether(pedido, t.world())
    // O integrador aplica cada `applyTransfer`: a ficha sai do Salão e entra na Cripta.
    for (const r of resultados) {
      const chegada = r.applyTransfer
      if (chegada !== undefined) t.cripta[chegada.tokenId] = { x: chegada.x, y: chegada.y }
    }
    expect(Object.keys(t.cripta).sort()).toEqual(['lanterna', 'machado', 'tocha'])
    const rede = t.s.broadcast(t.world()).outbound
    const fichasDe = (clientId: string) => mapasDe(rede, clientId).flatMap((m) => m.tokens.map((tok) => tok.id))
    // Carla ficou no Salão: as fichas de Ana e Bruno (e a Cripta inteira) não chegam a ela.
    expect(mapasDe(rede, 'c3').length).toBeGreaterThan(0)
    expect(fichasDe('c3')).not.toContain('lanterna')
    expect(fichasDe('c3')).not.toContain('machado')
    expect(fichasDe('c3')).not.toContain('tocha')
    // Ana e Bruno recebem a Cripta, com a própria ficha, e nada do Salão.
    for (const [clientId, propria] of [['c1', 'lanterna'], ['c2', 'machado']] as const) {
      expect(fichasDe(clientId)).toContain(propria)
      expect(fichasDe(clientId)).not.toContain('cajado')
      expect(mapasDe(rede, clientId).every((m) => m.id === 'mapa-cripta')).toBe(true)
    }
    // Nome de cena não sai: nem na chegada ("Você chegou") nem no mapa.
    const tudo = JSON.stringify([...resultados.flatMap((r) => r.outbound), ...rede])
    expect(tudo).not.toMatch(/Cripta Rubra|Salão/)
  })

  it('pedido que já não existe: nada', () => {
    const t = mesa()
    expect(t.s.approveTravelTogether('nao-existe', t.world())).toEqual([])
    expect(t.s.travelCompanions('nao-existe', t.world())).toEqual([])
  })
})
