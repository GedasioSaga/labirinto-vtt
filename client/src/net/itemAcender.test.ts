import { describe, expect, it } from 'vitest'
import { createHostSession } from './hostSession'
import { createEmptyMap } from '../lib/mapFactory'
import type { CarriedItem, MapData, Token } from '../types/map'

// ITEM QUE ILUMINA (pedido de 18/11/2026): o jogador acende e apaga o item da
// mochila da PRÓPRIA ficha (`item.acender`). Exige um SEGUNDO jogador tentando,
// como o `token.aura`: nenhuma tela prova sozinha que o host recusa.

const CODIGO = 'LUZ001'
const LAMPIAO: CarriedItem = { id: 'vaga-lampiao', nome: 'Lampião', luz: { cor: '#ffe2b0', alcanceEmCasas: 3, forca: 0.8, crepita: true } }
const CORDA: CarriedItem = { id: 'vaga-corda', nome: 'Corda' }

function token(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null, ...extra }
}

/** Ana leva um lampião apagado e uma corda; Beto não leva nada. */
function mapa(): MapData {
  return { ...createEmptyMap('m1', 'Mesa', 40, 40, 50), tokens: [token('tok-ana', { mochila: [LAMPIAO, CORDA] }), token('tok-beto')] }
}

function mesaComDoisJogadores() {
  const session = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    now: () => 0,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const entrar = (clientId: string, nome: string): string => {
    const r = session.handleMessage(clientId, JSON.stringify({ type: 'join', code: CODIGO, name: nome }), mapa())
    const welcome = r.outbound.find((o) => o.msg.type === 'welcome')
    if (welcome === undefined || welcome.msg.type !== 'welcome') throw new Error('join não devolveu welcome')
    return welcome.msg.playerId
  }
  session.assignToken(entrar('c1', 'Ana'), 'tok-ana')
  session.assignToken(entrar('c2', 'Beto'), 'tok-beto')
  return session
}

const pedido = (tokenId: string, itemId: string, acesa: boolean): string => JSON.stringify({ type: 'item.acender', tokenId, itemId, acesa })

describe('hostSession: item.acender só do dono, só item que ilumina', () => {
  it('a dona acende o lampião: a ordem grava a mochila dela com a vaga acesa e o resto igual', () => {
    const session = mesaComDoisJogadores()

    const r = session.handleMessage('c1', pedido('tok-ana', 'vaga-lampiao', true), mapa())

    expect(r.applyItems?.mochilas).toEqual([{ tokenId: 'tok-ana', mochila: [{ ...LAMPIAO, acesa: true }, CORDA] }])
    // Apagar o que já está apagado não gera ordem: nada a gravar.
    expect(session.handleMessage('c1', pedido('tok-ana', 'vaga-lampiao', false), mapa()).applyItems).toBeUndefined()
  })

  it('outro jogador, item que não ilumina, vaga que não existe e quem não entrou: recusa sem gravar', () => {
    const session = mesaComDoisJogadores()

    // Beto tenta acender o lampião da Ana: silêncio, como no `token.aura` (responder ensinaria quais ids existem).
    const deOutro = session.handleMessage('c2', pedido('tok-ana', 'vaga-lampiao', true), mapa())
    expect(deOutro.applyItems).toBeUndefined()
    expect(deOutro.outbound.filter((o) => o.msg.type === 'error')).toEqual([])
    // A corda não ilumina; a vaga inventada não está lá.
    expect(session.handleMessage('c1', pedido('tok-ana', 'vaga-corda', true), mapa()).applyItems).toBeUndefined()
    expect(session.handleMessage('c1', pedido('tok-ana', 'vaga-inventada', true), mapa()).applyItems).toBeUndefined()
    // Quem nem entrou recebe o erro de sempre.
    const deFora = session.handleMessage('c9', pedido('tok-ana', 'vaga-lampiao', true), mapa())
    expect(deFora.applyItems).toBeUndefined()
    expect(deFora.outbound.map((o) => o.msg)).toEqual([{ type: 'error', reason: 'not_joined' }])
  })
})
