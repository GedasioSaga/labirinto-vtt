/**
 * A PONTE DA BATALHA PARA A PASTILHA (Fase 3), a parte pura: o selo do One
 * Piece e a condição do Dragon Ball acendem e apagam a pastilha de mesmo nome,
 * de fábrica ou criada pelo mestre. Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CondicaoPropria, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { chavesDoDragonBall, chavesDosSelos, espelharNoMapa, mudancasDaPonte } from './ponteDasCondicoes'
import { porCondicaoNaFicha } from './prazoDaCondicao'

const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff7043', simbolo: 'chama' }
const NENHUMA = new Map<string, Set<string>>()

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 100, y: 100, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('arena', 'Arena', 20, 12, 50), tokens }
}

function selo(tokenId: string, nome: string): { tokenId: string; nome: string } {
  return { tokenId, nome }
}

/** Espelha a passagem de uma foto da batalha para a outra, como a store faz. */
function espelhar(map: MapData, antes: ReadonlyMap<string, ReadonlySet<string>>, depois: ReadonlyMap<string, ReadonlySet<string>>, catalogo: readonly CondicaoPropria[] = []): MapData {
  return espelharNoMapa(map, mudancasDaPonte(antes, depois), catalogo)
}

describe('One Piece: o selo acende e apaga a pastilha', () => {
  it('"Atordoado 2" entra: a estrela acende; sai: apaga. "Atordoada" é o mesmo selo; "Queimando" acende a criada pelo mestre', () => {
    const vazio = mapaCom([ficha('ilo'), ficha('lia')])
    const comSelos = chavesDosSelos([selo('ilo', 'Atordoada'), selo('lia', 'Queimando'), selo('lia', 'Aéreo')])
    const aceso = espelhar(vazio, NENHUMA, comSelos, [QUEIMANDO])
    expect(aceso.tokens[0].conditions).toEqual(['atordoado'])
    expect(aceso.tokens[1].condicoesProprias).toEqual([QUEIMANDO])
    // "Aéreo" não tem pastilha: nada acende por ele.
    expect(aceso.tokens[1].conditions).toBeUndefined()
    const apagado = espelhar(aceso, comSelos, NENHUMA)
    expect(apagado.tokens).toEqual(vazio.tokens)
  })

  it('pastilha já acesa à mão não duplica; a mesma mudança aplicada de novo devolve o MESMO mapa', () => {
    const aMao = mapaCom([ficha('ilo', { conditions: ['atordoado'] })])
    const comSelo = chavesDosSelos([selo('ilo', 'Atordoado')])
    expect(espelhar(aMao, NENHUMA, comSelo)).toBe(aMao)
    const semNada = mapaCom([ficha('ilo')])
    const uma = espelhar(semNada, NENHUMA, comSelo)
    expect(espelhar(uma, NENHUMA, comSelo)).toBe(uma)
    // Selo de ficha que não está no mapa: nada muda.
    expect(espelhar(semNada, NENHUMA, chavesDosSelos([selo('fantasma', 'Atordoado')]))).toBe(semNada)
  })
})

describe('Dragon Ball: a condição acende e apaga a pastilha', () => {
  it('Envenenado do livro entra e sai; o prazo da armadilha segura a pastilha quando a condição do livro sai', () => {
    const combatentes = (condicoes: readonly { nome: string }[]) => ({ ilo: { id: 'ilo', condicoes } })
    const antes = chavesDoDragonBall(combatentes([]))
    const depois = chavesDoDragonBall(combatentes([{ nome: 'Envenenado' }, { nome: 'Caído' }]))
    const aceso = espelhar(mapaCom([ficha('ilo')]), antes, depois)
    expect(aceso.tokens[0].conditions).toEqual(['envenenado', 'caido'])
    expect(espelhar(aceso, depois, antes).tokens[0].conditions).toBeUndefined()

    const daArmadilha = porCondicaoNaFicha(ficha('ilo'), 'Envenenado', [], { turnos: 3, porVez: 4 })
    const comLivroEArmadilha = espelhar(mapaCom([daArmadilha]), antes, depois)
    const livroSaiu = espelhar(comLivroEArmadilha, depois, antes)
    expect(livroSaiu.tokens[0].conditions).toEqual(['envenenado'])
    expect(livroSaiu.tokens[0].prazosDasCondicoes).toEqual([{ nome: 'Envenenado', turnos: 3, porVez: 4 }])
  })

  it('a batalha que acaba (foto vazia) apaga tudo o que segurava em cada ficha, e só isso', () => {
    const segurava = chavesDoDragonBall({ ilo: { id: 'ilo', condicoes: [{ nome: 'Atordoado' }] }, lia: { id: 'lia', condicoes: [{ nome: 'Lento' }] } })
    const mapa = mapaCom([ficha('ilo', { conditions: ['atordoado', 'invisivel'] }), ficha('lia', { conditions: ['lento'] })])
    const fim = espelhar(mapa, segurava, NENHUMA)
    expect(fim.tokens.map((token) => token.conditions)).toEqual([['invisivel'], undefined])
  })
})
