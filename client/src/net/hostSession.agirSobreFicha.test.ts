/**
 * AGIR SOBRE UMA FICHA, do lado do host: o jogador toca a ficha de outro e
 * pede uma ação. O pedido só vale para ficha que ele VÊ agora (o recorte da
 * névoa), na cena DELE, e que não é dele; tudo o mais responde o mesmo
 * `unavailable` e nada chega ao mestre. A resposta do mestre vai só a quem
 * pediu, e só com o `reqId`: nem nome de ficha, nem cena, nem posição.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, TOKEN_ACTION_MIN_INTERVAL_MS, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x: number): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 500, blocksLight: true, blocksMove: true, door: null }
}

function mapa(id: string, nome: string, tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, walls }
}

/**
 * Salão (aberto): Ana (lanterna) com Severa a 2 casas (nome do mestre
 * "Severa", nome para os jogadores "Mulher de capuz"), um vulto atrás da
 * parede e uma ficha que o mestre escondeu. Cripta (de fundo): Bruno (machado)
 * e o Guarda.
 */
const SALAO: HostScene = {
  sceneId: 's-salao',
  name: 'Salao Norte',
  map: mapa(
    'm-salao',
    'Salao Norte',
    [
      ficha('lanterna', 100, 100),
      ficha('severa', 200, 100, { name: 'Severa', publicName: 'Mulher de capuz' }),
      ficha('vulto', 1200, 100, { name: 'Vulto' }),
      ficha('escondida', 300, 100, { name: 'Espia', hidden: true }),
    ],
    [parede('divisoria', 750)],
  ),
}
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100), ficha('guarda', 250, 100, { name: 'Guarda' })]) }
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(relogio = { t: 0 }) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.t, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c1', 'Ana')
  const bruno = entra(s, 'c2', 'Bruno')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  // O recorte que cada um vê sai no broadcast: é com ele que a névoa vale.
  s.broadcast(mundo)
  return { s, ana, bruno, relogio }
}

function pede(s: ReturnType<typeof createHostSession>, clientId: string, tokenId: string, extra: Record<string, unknown> = {}): HostResult {
  return s.handleMessage(clientId, { type: 'token.action', reqId: `r-${tokenId}`, tokenId, action: 'empurrar', ...extra }, mundo)
}

function textoPara(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('hostSession: agir sobre uma ficha', () => {
  it('ficha visível de outro vira pedido ao mestre, com quem, o quê, sobre quem e a distância; nada sai ao jogador ainda', () => {
    const { s, ana } = mesa()
    const r = pede(s, 'c1', 'severa', { action: 'falar', text: '  Você viu o Lemos?  ' })
    expect(r.outbound).toEqual([])
    expect(r.actionRequest).toEqual({
      requestId: expect.any(String),
      playerId: ana,
      playerName: 'Ana',
      tokenId: 'severa',
      // O mestre lê o nome DELE, não o "Nome para os jogadores".
      targetName: 'Severa',
      action: 'falar',
      text: 'Você viu o Lemos?',
      distanceCells: 2,
    })
    expect(s.isTokenActionPending(r.actionRequest?.requestId ?? '')).toBe(true)
  })

  it('pedido na cena de FUNDO leva o nome da cena ao mestre (e só a ele)', () => {
    const { s } = mesa()
    const r = pede(s, 'c2', 'guarda')
    expect(r.actionRequest).toMatchObject({ playerName: 'Bruno', targetName: 'Guarda', sceneName: 'Cripta Rubra', distanceCells: 1 })
    expect(r.outbound).toEqual([])
  })

  it('ficha de outra cena, atrás da parede, escondida pelo mestre, a própria ou inventada: o mesmo unavailable, e nada vai ao mestre', () => {
    const { s, relogio } = mesa()
    for (const tokenId of ['guarda', 'vulto', 'escondida', 'lanterna', 'nao-existe']) {
      // Um toque por intervalo: o limite vale para qualquer pedido, até o recusado.
      relogio.t += TOKEN_ACTION_MIN_INTERVAL_MS
      const r = pede(s, 'c1', tokenId)
      expect(r.actionRequest).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.action.rejected', reqId: `r-${tokenId}`, reason: 'unavailable' } }])
      // A recusa não conta nada do que o jogador não vê.
      expect(textoPara(r, 'c1')).not.toMatch(/Guarda|Vulto|Espia|Cripta|s-cripta/)
    }
  })

  it('a resposta do mestre vai SÓ a quem pediu, e só com o reqId dele', () => {
    const { s } = mesa()
    const pedido = pede(s, 'c1', 'severa').actionRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    const r = s.answerTokenAction(pedido.requestId, true)
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.action.answer', reqId: 'r-severa', accepted: true } }])
    expect(textoPara(r, 'c2')).toBe('[]')
    // Nem o nome que o mestre dá à ficha, nem a cena, nem o id do pedido do host.
    expect(textoPara(r, 'c1')).not.toMatch(/Severa|Salao|s-salao|id-/)
    // Respondido, sai da fila: responder de novo não manda nada.
    expect(s.isTokenActionPending(pedido.requestId)).toBe(false)
    expect(s.answerTokenAction(pedido.requestId, false)).toEqual({ outbound: [] })
  })

  it('"Recusar" chega como accepted: false, também só a quem pediu', () => {
    const { s } = mesa()
    const pedido = pede(s, 'c2', 'guarda').actionRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    expect(s.answerTokenAction(pedido.requestId, false).outbound).toEqual([
      { clientId: 'c2', msg: { type: 'token.action.answer', reqId: 'r-guarda', accepted: false } },
    ])
  })

  it('um pedido por vez, e um intervalo mínimo entre dois', () => {
    const { s, relogio } = mesa()
    const primeiro = pede(s, 'c1', 'severa').actionRequest
    if (primeiro === undefined) throw new Error('esperava pedido')
    relogio.t = TOKEN_ACTION_MIN_INTERVAL_MS * 2
    const segundo = s.handleMessage('c1', { type: 'token.action', reqId: 'r2', tokenId: 'severa', action: 'oferecer' }, mundo)
    expect(segundo.actionRequest).toBeUndefined()
    expect(segundo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.action.rejected', reqId: 'r2', reason: 'pending' } }])

    s.answerTokenAction(primeiro.requestId, true)
    // Logo depois da resposta, o limite de tempo ainda vale (conta do último pedido).
    relogio.t += TOKEN_ACTION_MIN_INTERVAL_MS - 1
    const cedo = s.handleMessage('c1', { type: 'token.action', reqId: 'r3', tokenId: 'severa', action: 'oferecer' }, mundo)
    expect(cedo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.action.rejected', reqId: 'r3', reason: 'too_soon' } }])
  })

  it('quem cai perde o pedido: a resposta atrasada do mestre não vai a ninguém', () => {
    const { s } = mesa()
    const pedido = pede(s, 'c1', 'severa').actionRequest
    if (pedido === undefined) throw new Error('esperava pedido')
    s.disconnect('c1')
    expect(s.isTokenActionPending(pedido.requestId)).toBe(false)
    expect(s.answerTokenAction(pedido.requestId, true)).toEqual({ outbound: [] })
  })

  it('ação fora da lista ou texto acima do teto: mensagem inválida, nada ao mestre', () => {
    const { s } = mesa()
    const invalida = s.handleMessage('c1', { type: 'token.action', reqId: 'r', tokenId: 'severa', action: 'matar' }, mundo)
    expect(invalida.actionRequest).toBeUndefined()
    expect(invalida.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
    const longa = s.handleMessage('c1', { type: 'token.action', reqId: 'r', tokenId: 'severa', action: 'falar', text: 'x'.repeat(121) }, mundo)
    expect(longa.actionRequest).toBeUndefined()
  })
})
