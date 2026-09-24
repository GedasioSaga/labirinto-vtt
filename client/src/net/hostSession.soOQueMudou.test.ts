/**
 * BROADCAST SÓ DO QUE MUDOU. Na torre, arrastar um NPC fazia o host recortar
 * a névoa das 7 cenas a cada 50 ms e mandar o mapa inteiro aos 7 jogadores,
 * até aos que estavam em cenas onde nada mudou. Agora cada jogador só recebe
 * snapshot quando a tela DELE muda, e o recorte de quem está numa cena parada
 * nem é refeito.
 *
 * O lado do segredo: o snapshot que NÃO sai também é informação. Mandar um
 * snapshot novo (com `rev` novo e o mesmo conteúdo) quando algo se mexe no
 * escuro, ou em outra cena, diria ao jogador que alguma coisa se mexeu lá.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { filterMapForPlayer } from '../lib/fogFilter'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

// O recorte de verdade, só contado: é por ele que se mede o trabalho do host.
vi.mock('../lib/fogFilter', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/fogFilter')>()
  return { ...real, filterMapForPlayer: vi.fn(real.filterMapForPlayer) }
})

const CODE = 'AB12CD'
const RAIO = 500

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** 30x30 células de 40 px = 1200x1200 px. */
function mapa(id: string, tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap(id, id, 30, 30, 40), tokens, walls }
}

function mundo(salao: MapData, cripta: MapData): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao', map: salao },
    background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta }],
  }
}

function entra(s: HostSession, clientId: string, nome: string, source: MapData | HostWorld): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, source).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function novaSessao(): HostSession {
  let n = 0
  return createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
}

function paraCliente(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function snapshotPara(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = paraCliente(r, clientId)[0]
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

const recortes = () => vi.mocked(filterMapForPlayer).mock.calls.length

beforeEach(() => {
  vi.mocked(filterMapForPlayer).mockClear()
})

describe('broadcast só para quem a tela mudou', () => {
  it('NPC arrastado na Cripta: quem está no Salão não recebe nada e o recorte dele nem é refeito', () => {
    const s = novaSessao()
    const salao = mapa('m-salao', [ficha('ana', 100, 100)])
    const cripta = (npcX: number) => mapa('m-cripta', [ficha('bia', 100, 100), ficha('npc', npcX, 200)])
    const inicio = mundo(salao, cripta(300))
    const ana = entra(s, 'c-ana', 'Ana', inicio)
    const bia = entra(s, 'c-bia', 'Bia', inicio)
    s.assignToken(ana, 'ana')
    s.assignToken(bia, 'bia')

    const primeiro = s.broadcast(inicio)
    expect(paraCliente(primeiro, 'c-ana').map((m) => m.type)).toEqual(['snapshot'])
    expect(paraCliente(primeiro, 'c-bia').map((m) => m.type)).toEqual(['snapshot'])

    // Três passos do arrasto, o Salão (mesma referência) sem mudar nada.
    for (const [passo, x] of [300 + 40, 300 + 80, 300 + 120].entries()) {
      vi.mocked(filterMapForPlayer).mockClear()
      const r = s.broadcast(mundo(salao, cripta(x)))
      expect(paraCliente(r, 'c-ana')).toEqual([])
      const praBia = snapshotPara(r, 'c-bia')
      expect(praBia.map.tokens.find((t) => t.id === 'npc')?.x).toBe(x)
      // Do segundo passo em diante, só a cena que mudou é recortada: 1 recorte (o da Bia), não 2.
      if (passo > 0) expect(recortes()).toBe(1)
    }
  })

  it('nada mudou: o segundo e o terceiro broadcast não mandam nada e o terceiro não recorta ninguém', () => {
    const s = novaSessao()
    const m = mapa('m', [ficha('ana', 100, 100), ficha('bia', 300, 100)])
    const ana = entra(s, 'c-ana', 'Ana', m)
    const bia = entra(s, 'c-bia', 'Bia', m)
    s.assignToken(ana, 'ana')
    s.assignToken(bia, 'bia')

    const primeiro = s.broadcast(m)
    expect(primeiro.outbound.map((o) => o.clientId).sort()).toEqual(['c-ana', 'c-bia'])
    expect(s.broadcast(m).outbound).toEqual([])
    vi.mocked(filterMapForPlayer).mockClear()
    expect(s.broadcast(m).outbound).toEqual([])
    expect(recortes()).toBe(0)
  })

  it('SEGREDO: NPC que anda atrás da parede, no escuro, não gera snapshot nem aparece em nada que chega', () => {
    const s = novaSessao()
    // Parede de ponta a ponta em x=600: a Ana, em x=100, nunca vê o lado de lá.
    const muro = [parede('muro', 600, 0, 600, 1200)]
    const salao = (npcY: number, anaX = 100) => mapa('m', [ficha('ana', anaX, 100), ficha('npc-escondido', 900, npcY)], muro)
    const ana = entra(s, 'c-ana', 'Ana', salao(300))
    s.assignToken(ana, 'ana')

    const recebido: HostMessage[] = []
    const primeiro = s.broadcast(salao(300))
    recebido.push(...paraCliente(primeiro, 'c-ana'))
    expect(snapshotPara(primeiro, 'c-ana').map.tokens.map((t) => t.id)).toEqual(['ana'])

    for (const y of [340, 380, 420, 460]) {
      const r = s.broadcast(salao(y))
      recebido.push(...paraCliente(r, 'c-ana'))
      expect(paraCliente(r, 'c-ana')).toEqual([])
    }

    // O que a Ana VÊ mudar (ela andou) chega, e segue sem o NPC do lado de lá.
    const andou = s.broadcast(salao(460, 180))
    recebido.push(...paraCliente(andou, 'c-ana'))
    const snap = snapshotPara(andou, 'c-ana')
    expect(snap.map.tokens.find((t) => t.id === 'ana')?.x).toBe(180)
    expect(snap.rev).toBe(s.rev)
    expect(recebido).toHaveLength(2)
    expect(JSON.stringify(recebido)).not.toContain('npc-escondido')
  })
})

describe('o que muda a tela do jogador fora do mapa ainda chega', () => {
  it('perdeu a ficha (lobby.waiting) e ganhou de volta: o snapshot sai de novo, mesmo com o mapa igual', () => {
    const s = novaSessao()
    const m = mapa('m', [ficha('ana', 100, 100)])
    const ana = entra(s, 'c-ana', 'Ana', m)
    s.assignToken(ana, 'ana')
    s.broadcast(m)
    s.broadcast(m)

    expect(paraCliente(s.unassignToken(ana, 'ana'), 'c-ana')).toEqual([{ type: 'lobby.waiting' }])
    s.assignToken(ana, 'ana')
    expect(snapshotPara(s.broadcast(m), 'c-ana').map.tokens.map((t) => t.id)).toEqual(['ana'])
  })

  it('"Mandar para…" e volta: a cena de destino e a de volta chegam, cada uma uma vez', () => {
    const s = novaSessao()
    const salao = mapa('m-salao', [ficha('ana', 100, 100)])
    const cripta = mapa('m-cripta', [])
    const inicio = mundo(salao, cripta)
    const ana = entra(s, 'c-ana', 'Ana', inicio)
    s.assignToken(ana, 'ana')
    s.broadcast(inicio)
    s.broadcast(inicio)

    const ida = s.sendPlayer(ana, 's-cripta', null, inicio)
    const chegada = ida.applyTransfer
    if (chegada === undefined) throw new Error('esperava applyTransfer')
    const naCripta = mundo(mapa('m-salao', []), mapa('m-cripta', [ficha('ana', chegada.x, chegada.y)]))
    expect(snapshotPara(s.broadcast(naCripta), 'c-ana').map.id).toBe('m-cripta')
    expect(s.broadcast(naCripta).outbound).toEqual([])

    s.sendPlayer(ana, 's-salao', null, naCripta)
    const devolta = mundo(salao, mapa('m-cripta', []))
    expect(snapshotPara(s.broadcast(devolta), 'c-ana').map.id).toBe('m-salao')
  })

  it('"Esconder planta" depois de andar: o explorado encolhido chega', () => {
    const s = novaSessao()
    const muro = [parede('muro', 600, 0, 600, 1200)]
    const em = (x: number) => mapa('m', [ficha('ana', x, 100)], muro)
    const ana = entra(s, 'c-ana', 'Ana', em(100))
    s.assignToken(ana, 'ana')
    s.broadcast(em(100))
    s.broadcast(em(900))
    s.broadcast(em(900))

    s.hidePlan(ana, em(900))
    const snap = snapshotPara(s.broadcast(em(900)), 'c-ana')
    const explorado = decodeExploration(snap.explored)
    if (explorado === null) throw new Error('explorado ilegível')
    expect(isPointExplored(explorado, { x: 100, y: 100 })).toBe(false)
    expect(isPointExplored(explorado, { x: 900, y: 100 })).toBe(true)
  })

  it('raio de visão novo: o snapshot sai com a visão nova', () => {
    const s = novaSessao()
    const m = mapa('m', [ficha('ana', 600, 600)])
    const ana = entra(s, 'c-ana', 'Ana', m)
    s.assignToken(ana, 'ana')
    s.broadcast(m)
    s.broadcast(m)

    s.setVisionRadius(ana, 100)
    const snap = snapshotPara(s.broadcast(m), 'c-ana')
    const xs = snap.vision.flat().map((p) => p.x)
    expect(Math.max(...xs)).toBeLessThanOrEqual(600 + 100 + 1)
    expect(Math.max(...xs)).toBeGreaterThan(600)
  })

  it('reconexão: o join manda a tela inteira e o broadcast seguinte, sem mudança, não repete', () => {
    const s = novaSessao()
    const m = mapa('m', [ficha('ana', 100, 100)])
    const ana = entra(s, 'c-ana', 'Ana', m)
    s.assignToken(ana, 'ana')
    s.broadcast(m)
    s.broadcast(m)
    s.disconnect('c-ana')

    const players = s.listPlayers()
    expect(players.map((p) => p.connected)).toEqual([false])
    const resume = s.handleMessage('c-ana-2', { type: 'join', code: CODE, name: 'Ana', resume: 'id-2' }, m)
    expect(paraCliente(resume, 'c-ana-2').map((msg) => msg.type)).toEqual(['welcome', 'snapshot'])
    s.broadcast(m)
    expect(s.broadcast(m).outbound).toEqual([])
  })
})
