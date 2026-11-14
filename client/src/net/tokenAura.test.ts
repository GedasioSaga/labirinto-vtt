import { describe, expect, it } from 'vitest'
import { createHostSession } from './hostSession'
import { hostPlayerChanges } from './playerChanges'
import { createEmptyMap } from '../lib/mapFactory'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Token } from '../types/map'

// AURA DA FICHA (pedido de 14/11/2026): o jogador só liga e desliga a aura da
// PRÓPRIA ficha (`token.aura`). Qual aura é, só o mestre escolhe. Como no
// `token.edit`, exige um SEGUNDO jogador tentando: nenhuma tela prova sozinha.

const CODIGO = 'AURA01'

function token(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null, ...extra }
}

/** Ana tem aura de fogo acesa; Beto não tem aura nenhuma. */
function mapa(): MapData {
  return { ...createEmptyMap('m1', 'Mesa', 40, 40, 50), tokens: [token('tok-ana', { aura: { tipo: 'fogo', ligada: true } }), token('tok-beto')] }
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

const pedido = (tokenId: string, ligada: boolean): string => JSON.stringify({ type: 'token.aura', tokenId, ligada })

describe('hostSession: token.aura só do dono', () => {
  it('o dono desliga a aura da ficha dele, e o mapa do mestre troca só o interruptor', () => {
    const session = mesaComDoisJogadores()

    const r = session.handleMessage('c1', pedido('tok-ana', false), mapa())

    expect(r.applyTokenEdit).toEqual({ tokenId: 'tok-ana', auraLigada: false })
    // O que o app do mestre faz com a ordem (`playerChanges`): mesma aura, apagada; a ficha do Beto não ganha aura.
    useMapStore.getState().loadMap(mapa())
    if (r.applyTokenEdit === undefined) throw new Error('sem ordem para aplicar')
    hostPlayerChanges.applyTokenEdit(r.applyTokenEdit)
    const depois = useMapStore.getState().map.tokens
    expect(depois.find((t) => t.id === 'tok-ana')?.aura).toEqual({ tipo: 'fogo', ligada: false })
    expect(depois.find((t) => t.id === 'tok-beto')?.aura).toBeUndefined()
    // Pedir o que já está não gera ordem: nada a gravar.
    expect(session.handleMessage('c1', pedido('tok-ana', true), mapa()).applyTokenEdit).toBeUndefined()
  })

  it('quem não é dono é recusado em silêncio, e o dono não cria aura em ficha que o mestre deixou sem', () => {
    const session = mesaComDoisJogadores()

    // Beto tenta apagar a aura da Ana.
    const deOutro = session.handleMessage('c2', pedido('tok-ana', false), mapa())
    expect(deOutro.applyTokenEdit).toBeUndefined()
    // Silêncio de propósito, como no `token.edit`: responder "recusado" ensinaria quais ids existem.
    expect(deOutro.outbound.filter((o) => o.msg.type === 'error')).toEqual([])

    // Beto é dono da própria ficha, mas ela não tem aura: o jogador não inventa uma.
    const semAura = session.handleMessage('c2', pedido('tok-beto', true), mapa())
    expect(semAura.applyTokenEdit).toBeUndefined()

    // Quem nem entrou na sala recebe o erro de sempre e nada muda.
    const deFora = session.handleMessage('c9', pedido('tok-ana', false), mapa())
    expect(deFora.applyTokenEdit).toBeUndefined()
    expect(deFora.outbound.map((o) => o.msg)).toEqual([{ type: 'error', reason: 'not_joined' }])
  })
})
