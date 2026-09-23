/**
 * AÇÕES NO PONTO: o toque longo do jogador vira pedido com o ponto
 * ("Fabi quer Procurar — Ferreiro"). O pedido e o nome da sala são do MESTRE:
 * nenhum outro jogador recebe nada, e a resposta ("Nada aqui" / "Feito") volta
 * só para quem pediu, sem nome de sala nem de cena.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { MAX_PENDING_POINT_ACTIONS_PER_PLAYER, POINT_ACTION_MIN_INTERVAL_MS } from '../lib/pointActions'
import type { MapData, Region, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, name: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name },
    ...extra,
  }
}

function mapa(id: string, tokens: Token[], regions: Region[] = []): MapData {
  return { ...createEmptyMap(id, id, 30, 10, 50), tokens, regions }
}

/** Vila (aberta): Ferreiro dentro da Praça, com Fabi e Duda. Porão (de fundo): Bruno. */
const VILA: HostScene = {
  sceneId: 's-vila',
  name: 'Vila do Norte',
  map: mapa('m-vila', [ficha('fabi', 100, 100), ficha('duda', 150, 100)], [sala('praca', 'Praça', 0, 0, 600, 400), sala('ferreiro', 'Ferreiro', 50, 50, 250, 250)]),
}
const PORAO: HostScene = { sceneId: 's-porao', name: 'Porão Úmido', map: mapa('m-porao', [ficha('bruno', 200, 100)], [sala('adega', 'Adega', 0, 0, 400, 400)]) }
const mundo: HostWorld = { open: VILA, background: [PORAO] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(relogio = { agora: 0 }) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.agora, randomId: () => `id-${(n += 1)}` })
  const fabi = entra(s, 'c1', 'Fabi')
  const duda = entra(s, 'c2', 'Duda')
  const bruno = entra(s, 'c3', 'Bruno')
  s.assignToken(fabi, 'fabi')
  s.assignToken(duda, 'duda')
  s.assignToken(bruno, 'bruno')
  // Um broadcast para todo mundo ter visão e memória: é o estado de jogo normal.
  s.broadcast(mundo)
  return { s, relogio, fabi }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('ações no ponto (host)', () => {
  it('Fabi segura na bigorna > Procurar: o mestre recebe o pedido com o nome da sala mais de dentro', () => {
    const { s, fabi } = mesa()
    const r = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo)
    expect(r.pointAction).toEqual({
      requestId: expect.any(String),
      playerId: fabi,
      playerName: 'Fabi',
      color: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      action: 'procurar',
      x: 120,
      y: 130,
      roomName: 'Ferreiro',
      sceneId: 's-vila',
      sceneName: 'Vila do Norte',
      background: false,
    })
  })

  it('o pedido não chega a NENHUM jogador: nem a quem está na mesma cena, nem a quem pediu', () => {
    const { s } = mesa()
    const r = s.handleMessage('c1', { type: 'point.action', action: 'escutar', x: 120, y: 130 }, mundo)
    expect(r.outbound).toEqual([])
    const tudo = JSON.stringify(r.outbound)
    expect(tudo).not.toContain('Ferreiro')
    expect(tudo).not.toContain('Vila do Norte')
  })

  it('"Nada aqui" e "Feito" voltam só para quem pediu, sem sala, cena nem ponto', () => {
    const { s } = mesa()
    const pedido = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava pedido')
    const nada = s.answerPointAction(pedido.requestId, 'nothing')
    expect(nada.outbound).toEqual([{ clientId: 'c1', msg: { type: 'point.action.answer', action: 'procurar', answer: 'nothing' } }])
    const texto = JSON.stringify(nada.outbound)
    for (const segredo of ['Ferreiro', 'Praça', 'Vila do Norte', 's-vila', '120', '130']) expect(texto).not.toContain(segredo)
    expect(para(nada, 'c2')).toBe('[]')
    expect(para(nada, 'c3')).toBe('[]')
    // Respondido uma vez, acabou: o segundo clique não manda nada de novo.
    expect(s.isPointActionPending(pedido.requestId)).toBe(false)
    expect(s.answerPointAction(pedido.requestId, 'seen')).toEqual({ outbound: [] })
  })

  it('"Feito" responde "seen"', () => {
    const { s } = mesa()
    const pedido = s.handleMessage('c1', { type: 'point.action', action: 'espiar', x: 400, y: 300 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava pedido')
    // Fora do Ferreiro, dentro da Praça: a sala é a Praça.
    expect(pedido.roomName).toBe('Praça')
    expect(s.answerPointAction(pedido.requestId, 'seen').outbound).toEqual([
      { clientId: 'c1', msg: { type: 'point.action.answer', action: 'espiar', answer: 'seen' } },
    ])
  })

  it('pedido de cena de FUNDO leva a cena de lá (para o mestre), e ponto fora de sala não tem sala', () => {
    const { s } = mesa()
    const r = s.handleMessage('c3', { type: 'point.action', action: 'escutar', x: 600, y: 300 }, mundo)
    expect(r.pointAction).toMatchObject({ playerName: 'Bruno', roomName: null, sceneId: 's-porao', sceneName: 'Porão Úmido', background: true })
    expect(r.outbound).toEqual([])
  })

  it('mapa solto, região sem sala e sala sem nome: pedido sem sala e sem cena de aventura', () => {
    const regiaoComum: Region = { ...sala('chao', 'x', 0, 0, 600, 400), room: undefined }
    const solto: MapData = mapa('m-solto', [ficha('fabi', 100, 100)], [regiaoComum, sala('sem-nome', '   ', 0, 0, 600, 400)])
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => 'r1' })
    const r0 = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Fabi' }, solto)
    const welcome = r0.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'fabi')
    const r = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 100, y: 100 }, solto)
    expect(r.pointAction).toMatchObject({ roomName: null, sceneId: null, sceneName: 'm-solto', background: false })
  })

  it('sala secreta dá o nome ao pedido do MESTRE, e nada dela vai ao jogador', () => {
    const secreta: HostWorld = {
      open: { ...VILA, map: { ...VILA.map, regions: [sala('cofre', 'Cofre', 0, 0, 600, 400, { secret: true })] } },
      background: [PORAO],
    }
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const r0 = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Fabi' }, secreta)
    const welcome = r0.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'fabi')
    const r = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 100, y: 100 }, secreta)
    expect(r.pointAction?.roomName).toBe('Cofre')
    // ...e o jogador não recebe nada que diga que ali há um Cofre.
    expect(JSON.stringify(r.outbound)).not.toContain('Cofre')
  })

  it('limite: um pedido por intervalo, e no máximo N esperando o mestre por jogador', () => {
    const { s, relogio } = mesa()
    const ok = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo)
    expect(ok.pointAction).toBeDefined()
    const cedo = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo)
    expect(cedo.pointAction).toBeUndefined()
    expect(cedo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'point.action.rejected', reason: 'too_soon' } }])

    for (let i = 1; i < MAX_PENDING_POINT_ACTIONS_PER_PLAYER; i += 1) {
      relogio.agora += POINT_ACTION_MIN_INTERVAL_MS
      expect(s.handleMessage('c1', { type: 'point.action', action: 'escutar', x: 120, y: 130 }, mundo).pointAction).toBeDefined()
    }
    relogio.agora += POINT_ACTION_MIN_INTERVAL_MS
    const cheio = s.handleMessage('c1', { type: 'point.action', action: 'escutar', x: 120, y: 130 }, mundo)
    expect(cheio.pointAction).toBeUndefined()
    expect(cheio.outbound).toEqual([{ clientId: 'c1', msg: { type: 'point.action.rejected', reason: 'pending' } }])
    // O limite é de Fabi: Duda pede normalmente.
    expect(s.handleMessage('c2', { type: 'point.action', action: 'escutar', x: 150, y: 100 }, mundo).pointAction).toBeDefined()
  })

  it('ação desconhecida ou ponto não finito: nada chega ao mestre', () => {
    const { s } = mesa()
    expect(s.handleMessage('c1', { type: 'point.action', action: 'roubar', x: 1, y: 1 }, mundo).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
    expect(s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 'a', y: 1 }, mundo).pointAction).toBeUndefined()
  })

  it('fora do mapa: nada chega ao mestre, e Fabi recebe a recusa em vez de esperar para sempre', () => {
    const { s } = mesa()
    const recusa = [{ clientId: 'c1', msg: { type: 'point.action.rejected', reason: 'out_of_map' } }]
    // Câmera arrastada até a borda escura: x < 0, e depois além da largura.
    expect(s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: -5, y: 100 }, mundo)).toEqual({ outbound: recusa })
    expect(s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 99_999, y: 1 }, mundo)).toEqual({ outbound: recusa })
    // A recusa não gasta o intervalo: o pedido de dentro, logo depois, passa.
    expect(s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction).toBeDefined()
  })

  it('quem não entrou ou está aguardando não pede; expulso tem os pedidos apagados', () => {
    const { s } = mesa()
    expect(s.handleMessage('c9', { type: 'point.action', action: 'procurar', x: 1, y: 1 }, mundo).outbound).toEqual([
      { clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } },
    ])
    entra(s, 'c4', 'Caio')
    expect(s.handleMessage('c4', { type: 'point.action', action: 'procurar', x: 100, y: 100 }, mundo)).toEqual({ outbound: [] })

    const pedido = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava pedido')
    s.kick('c1')
    expect(s.isPointActionPending(pedido.requestId)).toBe(false)
    expect(s.answerPointAction(pedido.requestId, 'nothing')).toEqual({ outbound: [] })
  })

  it('caiu a conexão: o pedido continua na mão do mestre, e a resposta não vai a ninguém', () => {
    const { s } = mesa()
    const pedido = s.handleMessage('c1', { type: 'point.action', action: 'procurar', x: 120, y: 130 }, mundo).pointAction
    if (pedido === undefined) throw new Error('esperava pedido')
    s.disconnect('c1')
    expect(s.isPointActionPending(pedido.requestId)).toBe(true)
    // Sem conexão, a resposta não tem para onde ir (e não vai para outro jogador).
    const semNinguem = s.answerPointAction(pedido.requestId, 'nothing')
    expect(semNinguem).toEqual({ outbound: [] })
  })
})
