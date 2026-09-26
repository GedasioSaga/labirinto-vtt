// @vitest-environment node
/**
 * CONGELAR FICHA — a parte pura. O mestre congela a ficha de um jogador
 * (`Token.congelado`): o JOGADOR não a move por pedido nenhum, o mestre move
 * à vontade. Aqui: ler o campo do mapa cru, ligar e desligar em lote sem
 * inventar campo, e achar a congelada que iria PRESA a quem anda (a bordo do
 * veículo ou levada).
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap, setTokenPosition } from './mapFactory'
import { validateTokenMove } from './moveValidation'
import type { MapData, Token } from '../types/map'
import { congeladaPresaA, congelamentoDaMesa, congelarNoMapa, descongelarTudoNoMapa, estaCongelada, semAsCongeladas, TEXTO_CONGELADO } from './congelar'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function sala(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-sala', 'Sala', 20, 10, 50), tokens }
}

describe('estaCongelada', () => {
  it('só `true` conta: o mapa do disco chega cru', () => {
    expect(estaCongelada(ficha('a', 0, 0, { congelado: true }))).toBe(true)
    expect(estaCongelada(ficha('a', 0, 0))).toBe(false)
    expect(estaCongelada(ficha('a', 0, 0, { congelado: false }))).toBe(false)
    // Forma torta que um arquivo editado à mão traria: não congela ninguém.
    const torta: { congelado?: unknown } = { congelado: 'sim' }
    expect(estaCongelada(torta)).toBe(false)
  })

  it('o texto que o jogador lê é o do pedido', () => {
    expect(TEXTO_CONGELADO).toBe('Congelado pelo mestre')
  })
})

describe('congelarNoMapa', () => {
  it('liga só nas fichas pedidas, e desligar APAGA o campo (mapa salvo antes abre igual)', () => {
    const map = sala([ficha('ana', 75, 75), ficha('bia', 175, 75), ficha('npc', 275, 75)])
    const congelado = congelarNoMapa(map, new Set(['ana', 'bia']), true)
    expect(congelado.tokens.map((t) => t.congelado === true)).toEqual([true, true, false])
    expect('congelado' in (congelado.tokens[2] ?? {})).toBe(false)
    const solto = congelarNoMapa(congelado, new Set(['ana']), false)
    expect(solto.tokens.map((t) => t.congelado === true)).toEqual([false, true, false])
    expect('congelado' in (solto.tokens[0] ?? {})).toBe(false)
  })

  it('nada a mudar devolve o MESMO mapa (o editor redesenha pela referência)', () => {
    const map = sala([ficha('ana', 75, 75, { congelado: true }), ficha('bia', 175, 75)])
    expect(congelarNoMapa(map, new Set(['ana']), true)).toBe(map)
    expect(congelarNoMapa(map, new Set(['bia']), false)).toBe(map)
    expect(congelarNoMapa(map, new Set(['fantasma']), true)).toBe(map)
  })

  it('"Descongelar todos" solta toda ficha do mapa, de quem quer que seja', () => {
    const map = sala([ficha('ana', 75, 75, { congelado: true }), ficha('bia', 175, 75), ficha('npc', 275, 75, { congelado: true })])
    const solto = descongelarTudoNoMapa(map)
    expect(solto.tokens.some((t) => 'congelado' in t)).toBe(false)
    expect(descongelarTudoNoMapa(solto)).toBe(solto)
  })
})

describe('congeladaPresaA — quem vai preso a quem anda', () => {
  it('passageiro congelado a bordo do veículo', () => {
    const map = sala([ficha('carroca', 75, 75, { veiculo: { lugares: 2, passageiros: ['bia'] } }), ficha('bia', 75, 75, { congelado: true })])
    expect(congeladaPresaA(map, ['carroca'])?.id).toBe('bia')
  })

  it('ficha congelada levada por quem anda (levar ficha junto)', () => {
    const map = sala([ficha('ana', 75, 75), ficha('ferido', 125, 75, { levadoPor: 'ana', congelado: true })])
    expect(congeladaPresaA(map, ['ana'])?.id).toBe('ferido')
  })

  it('ninguém congelado preso: `null` — e a própria ficha não conta (ela tem a trava dela)', () => {
    const map = sala([
      ficha('ana', 75, 75, { congelado: true }),
      ficha('ferido', 125, 75, { levadoPor: 'ana' }),
      ficha('carroca', 275, 75, { veiculo: { lugares: 2, passageiros: ['bia'] } }),
      ficha('bia', 275, 75),
      // Congelada solta, perto mas sem vínculo: não vai presa a ninguém.
      ficha('npc', 325, 75, { congelado: true }),
    ])
    expect(congeladaPresaA(map, ['ana'])).toBeNull()
    expect(congeladaPresaA(map, ['carroca'])).toBeNull()
  })
})

describe('congelamentoDaMesa — o que os botões do Grupo oferecem', () => {
  const mundo = (salao: Token[], cripta: Token[] = []) => ({
    open: { sceneId: 's-a', name: 'Salão', map: sala(salao) },
    background: [{ sceneId: 's-b', name: 'Cripta', map: sala(cripta) }],
  })

  it('ninguém congelado: nem todas, nem alguma', () => {
    expect(congelamentoDaMesa(['ana', 'bia'], mundo([ficha('ana', 75, 75)], [ficha('bia', 75, 75)]))).toEqual({ todas: false, alguma: false })
  })

  it('toda ficha de jogador congelada, em qualquer cena: todas', () => {
    const w = mundo([ficha('ana', 75, 75, { congelado: true }), ficha('npc', 175, 75)], [ficha('bia', 75, 75, { congelado: true })])
    expect(congelamentoDaMesa(['ana', 'bia'], w)).toEqual({ todas: true, alguma: true })
  })

  it('só uma: alguma, e não todas', () => {
    const w = mundo([ficha('ana', 75, 75, { congelado: true })], [ficha('bia', 75, 75)])
    expect(congelamentoDaMesa(['ana', 'bia'], w)).toEqual({ todas: false, alguma: true })
  })

  it('ficha congelada que ficou sem dono ainda conta para "Descongelar todos"', () => {
    const w = mundo([ficha('ana', 75, 75), ficha('orfa', 175, 75, { congelado: true })])
    expect(congelamentoDaMesa(['ana'], w)).toEqual({ todas: false, alguma: true })
  })

  it('sem ficha de jogador em cena, não há o que congelar: `todas` fica falso', () => {
    expect(congelamentoDaMesa([], mundo([ficha('npc', 75, 75)]))).toEqual({ todas: false, alguma: false })
  })
})

describe('semAsCongeladas — quem só acompanha a passagem', () => {
  it('tira as congeladas; nenhuma congelada devolve o mesmo mapa', () => {
    const map = sala([ficha('ana', 75, 75), ficha('ponei', 125, 75, { congelado: true })])
    expect(semAsCongeladas(map).tokens.map((t) => t.id)).toEqual(['ana'])
    const semNenhuma = sala([ficha('ana', 75, 75)])
    expect(semAsCongeladas(semNenhuma)).toBe(semNenhuma)
  })
})

describe('a trava do passo — jogador não, mestre sim', () => {
  const map = sala([ficha('ana', 75, 75, { congelado: true }), ficha('bia', 175, 75)])
  const posse = { p1: ['ana'] }

  it('o pedido do jogador para a ficha congelada volta com o motivo `congelado`', () => {
    expect(validateTokenMove(map, { playerId: 'p1', tokenId: 'ana', x: 75, y: 225 }, posse)).toEqual({ ok: false, reason: 'congelado' })
  })

  it('o mestre move a ficha congelada (o passo dele não passa pela trava)', () => {
    expect(validateTokenMove(map, { playerId: '', tokenId: 'ana', x: 75, y: 225 }, {}, { isHost: true })).toEqual({ ok: true, x: 75, y: 225 })
    // E o arrasto do editor aplica o passo como sempre.
    expect(setTokenPosition(map, 'ana', 75, 225).tokens.find((t) => t.id === 'ana')).toMatchObject({ x: 75, y: 225, congelado: true })
  })

  it('ficha de OUTRO congelada responde `not_owner`: a recusa não conta quem o mestre congelou', () => {
    const deBia = { p2: ['bia'] }
    expect(validateTokenMove(map, { playerId: 'p2', tokenId: 'ana', x: 75, y: 225 }, deBia)).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('cadeado do mestre vence: travada E congelada lê `locked`', () => {
    const ambas = sala([ficha('ana', 75, 75, { congelado: true, locked: true })])
    expect(validateTokenMove(ambas, { playerId: 'p1', tokenId: 'ana', x: 75, y: 225 }, posse)).toEqual({ ok: false, reason: 'locked' })
  })
})
