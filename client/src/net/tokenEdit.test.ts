import { describe, expect, it } from 'vitest'
import { parsePlayerMessage, NAME_MAX_LENGTH } from './protocol'
import { createHostSession, TOKEN_PHOTO_MIN_INTERVAL_MS } from './hostSession'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'

// "Só o dono muda o próprio token" — a parte que nenhuma jornada de tela
// consegue provar sozinha, porque exige um SEGUNDO jogador tentando.

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const CODIGO = 'ABC123'

function token(id: string): Token {
  return { id, characterId: null, name: 'Herói', x: 100, y: 100, size: 1, image: null }
}

function mapa(): MapData {
  return { ...createEmptyMap('m1', 'Mesa', 40, 40, 50), tokens: [token('tok-ana'), token('tok-beto')] }
}

describe('parsePlayerMessage — token.edit', () => {
  it('aceita nome e foto, aparando o nome', () => {
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', name: '  Brunilda  ' })).toEqual({
      type: 'token.edit',
      tokenId: 't1',
      name: 'Brunilda',
    })
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', image: FOTO })).toEqual({
      type: 'token.edit',
      tokenId: 't1',
      image: FOTO,
    })
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', image: null })).toEqual({
      type: 'token.edit',
      tokenId: 't1',
      image: null,
    })
  })

  it('recusa foto que não é auto-contida — é aqui que o caminho do disco morre', () => {
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', image: 'C:\\fotos\\heroi.png' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', image: 'http://intranet/heroi.png' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', image: 'javascript:alert(1)' })).toBeNull()
  })

  it('recusa nome vazio, nome grande demais, id ausente e mensagem que não muda nada', () => {
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', name: '   ' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1', name: 'a'.repeat(NAME_MAX_LENGTH + 1) })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.edit', name: 'Ana' })).toBeNull()
    expect(parsePlayerMessage({ type: 'token.edit', tokenId: 't1' })).toBeNull()
  })
})

describe('hostSession — só o dono muda o próprio token', () => {
  function mesaComDoisJogadores() {
    let instante = 0
    const session = createHostSession({
      code: CODIGO,
      visionRadius: 2000,
      now: () => instante,
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
    const ana = entrar('c1', 'Ana')
    const beto = entrar('c2', 'Beto')
    session.assignToken(ana, 'tok-ana')
    session.assignToken(beto, 'tok-beto')
    return { session, avancar: (ms: number) => (instante += ms) }
  }

  it('o dono troca o nome e a foto do token dele', () => {
    const { session } = mesaComDoisJogadores()

    const r = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-ana', name: 'Brunilda' }), mapa())

    expect(r.applyTokenEdit).toEqual({ tokenId: 'tok-ana', name: 'Brunilda', image: undefined })
  })

  it('token do OUTRO jogador não muda, e nada volta para quem tentou', () => {
    const { session } = mesaComDoisJogadores()

    const r = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-beto', name: 'Palhaço' }), mapa())

    expect(r.applyTokenEdit).toBeUndefined()
    // Silêncio de propósito: responder "recusado" ensinaria quais ids existem.
    expect(r.outbound).toEqual([])
  })

  it('token que não está no mapa não muda nada', () => {
    const { session } = mesaComDoisJogadores()

    const r = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-fantasma', name: 'X' }), mapa())

    expect(r.applyTokenEdit).toBeUndefined()
  })

  it('foto nova antes do intervalo mínimo é descartada; o nome no mesmo instante passa', () => {
    const { session, avancar } = mesaComDoisJogadores()

    const primeira = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-ana', image: FOTO }), mapa())
    const segunda = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-ana', image: FOTO }), mapa())
    const nome = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-ana', name: 'Brunilda' }), mapa())

    expect(primeira.applyTokenEdit).toBeDefined()
    expect(segunda.applyTokenEdit).toBeUndefined()
    // O nome não é estrangulado junto: trocar os dois no mesmo gesto tem de funcionar.
    expect(nome.applyTokenEdit).toBeDefined()

    avancar(TOKEN_PHOTO_MIN_INTERVAL_MS)
    const depois = session.handleMessage('c1', JSON.stringify({ type: 'token.edit', tokenId: 'tok-ana', image: FOTO }), mapa())
    expect(depois.applyTokenEdit).toBeDefined()
  })
})
