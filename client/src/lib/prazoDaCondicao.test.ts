/**
 * PRAZO DA CONDIÇÃO (Fase 3): pôr pelo nome com turnos e vida por turno, o
 * tique do "Passar turno" e da vez da batalha, e a regra do Lento no passo.
 * Os números são os padrões da armadilha do baú (cobra: Envenenado 3 turnos x
 * 4 de vida; aranha: Lento 2 turnos). Dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { CondicaoPropria, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { passoMaximoDaFicha } from './movementRules'
import { validateTokenMove } from './moveValidation'
import { contarFimDaVez, passarTurnoNoMapa, porCondicaoNaFicha, prazoDaCondicao, prazosDaFicha, tirarCondicaoDaFicha, vidaDoComecoDaVez } from './prazoDaCondicao'
import { toggleTokenCondition } from './tokenConditions'

const GRID = 50
const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff7043', simbolo: 'chama' }

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: `pers_${id}`, name: id, x: 125, y: 125, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[], patch: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('vale', 'Vale', 60, 20, GRID), tokens, ...patch }
}

function fichaDe(map: MapData, id: string): Token {
  const achada = map.tokens.find((token) => token.id === id)
  if (achada === undefined) throw new Error(`ficha ${id} sumiu do mapa`)
  return achada
}

describe('cobra: Envenenado 3 turnos tirando 4 por turno', () => {
  it('acende a gota, tira 4 em cada um dos 3 "Passar turno" (12 no total) e apaga no terceiro', () => {
    const picada = porCondicaoNaFicha(ficha('ilo'), 'Envenenado', [], { turnos: 3, porVez: 4 })
    expect(picada.conditions).toEqual(['envenenado'])
    expect(prazoDaCondicao(picada, 'envenenado')).toEqual({ nome: 'Envenenado', turnos: 3, porVez: 4 })
    let mapa = mapaCom([picada, ficha('lia')])
    const danos: number[] = []
    for (let turno = 1; turno <= 3; turno += 1) {
      const passo = passarTurnoNoMapa(mapa)
      expect(passo.fichas.map((f) => f.tokenId)).toEqual(['ilo'])
      expect(passo.fichas[0].characterId).toBe('pers_ilo')
      danos.push(passo.fichas[0].dano)
      expect(passo.fichas[0].acabaram).toEqual(turno === 3 ? ['Envenenado'] : [])
      mapa = passo.map
    }
    expect(danos).toEqual([4, 4, 4])
    // Acabou: a ficha volta a ser a de antes, sem pastilha e sem o campo novo.
    expect(fichaDe(mapa, 'ilo')).toEqual(ficha('ilo'))
    // Um quarto "Passar turno" não acha mais nada.
    expect(passarTurnoNoMapa(mapa)).toEqual({ map: mapa, fichas: [] })
  })

  it('na batalha a vida vem no começo da vez e o desconto no fim; a segunda picada renova os turnos em vez de somar', () => {
    let ilo = porCondicaoNaFicha(ficha('ilo'), 'Envenenado', [], { turnos: 3, porVez: 4 })
    expect(vidaDoComecoDaVez(ilo)).toEqual({ dano: 4, danos: [{ nome: 'Envenenado', dano: 4 }] })
    ilo = contarFimDaVez(ilo).token
    expect(prazoDaCondicao(ilo, 'Envenenado')?.turnos).toBe(2)
    ilo = porCondicaoNaFicha(ilo, 'envenenado', [], { turnos: 3, porVez: 4 })
    expect(prazosDaFicha(ilo)).toEqual([{ nome: 'envenenado', turnos: 3, porVez: 4 }])
  })
})

describe('aranha: Lento 2 turnos anda metade do passo', () => {
  it('passo 6 vira 3 enquanto dura; depois dos 2 turnos o passo volta a 6', () => {
    const picada = porCondicaoNaFicha(ficha('ilo'), 'Lento', [], { turnos: 2 })
    expect(picada.conditions).toEqual(['lento'])
    expect(vidaDoComecoDaVez(picada).dano).toBe(0)
    let mapa = mapaCom([picada], { movement: { maxStepCells: 6 } })
    const pedido = { playerId: 'p1', tokenId: 'ilo', x: 125 + 30 * GRID, y: 125 }
    const dono = { p1: ['ilo'] }
    expect(passoMaximoDaFicha(mapa, picada)).toBe(3)
    expect(validateTokenMove(mapa, pedido, dono)).toEqual({ ok: true, x: 125 + 3 * GRID, y: 125 })
    mapa = passarTurnoNoMapa(mapa).map
    expect(fichaDe(mapa, 'ilo').conditions).toEqual(['lento'])
    mapa = passarTurnoNoMapa(mapa).map
    expect(fichaDe(mapa, 'ilo').conditions).toBeUndefined()
    expect(validateTokenMove(mapa, pedido, dono)).toEqual({ ok: true, x: 125 + 6 * GRID, y: 125 })
  })

  it('passo ímpar corta para baixo e nunca fica abaixo de 1; cena livre continua livre', () => {
    const lento = ficha('ilo', { conditions: ['lento'] })
    expect(passoMaximoDaFicha({ movement: { maxStepCells: 5 } }, lento)).toBe(2)
    expect(passoMaximoDaFicha({ movement: { maxStepCells: 1 } }, lento)).toBe(1)
    expect(passoMaximoDaFicha({}, lento)).toBeNull()
    expect(passoMaximoDaFicha({ movement: { maxStepCells: 5 } }, ficha('lia'))).toBe(5)
  })
})

describe('o prazo e quem mais mexe na pastilha', () => {
  it('a batalha que ainda segura o nome mantém a pastilha quando o prazo acaba; o mestre que apaga à mão mata o prazo sem tirar vida', () => {
    const ilo = porCondicaoNaFicha(ficha('ilo'), 'Envenenado', [], { turnos: 1, porVez: 4 })
    const segurada = contarFimDaVez(ilo, new Set(['envenenado']))
    expect(segurada.acabaram).toEqual(['Envenenado'])
    expect(segurada.token.conditions).toEqual(['envenenado'])
    expect(segurada.token.prazosDasCondicoes).toBeUndefined()

    const apagadaAMao = toggleTokenCondition(mapaCom([porCondicaoNaFicha(ficha('lia'), 'Envenenado', [], { turnos: 3, porVez: 4 })]), 'lia', 'envenenado')
    const passo = passarTurnoNoMapa(apagadaAMao)
    expect(passo.fichas).toEqual([])
    expect(fichaDe(passo.map, 'lia')).toEqual(ficha('lia'))
  })

  it('condição criada pelo mestre também leva prazo; nome sem pastilha, prazo torto e lixo do disco não acendem nada', () => {
    const queimando = porCondicaoNaFicha(ficha('ilo'), 'queimando', [QUEIMANDO], { turnos: 2, porVez: 10 })
    expect(queimando.condicoesProprias).toEqual([QUEIMANDO])
    expect(vidaDoComecoDaVez(queimando).dano).toBe(10)
    expect(tirarCondicaoDaFicha(queimando, 'Queimando')).toEqual(ficha('ilo'))

    const semFicha = ficha('lia')
    expect(porCondicaoNaFicha(semFicha, 'Aéreo', [], { turnos: 2 })).toBe(semFicha)
    expect(porCondicaoNaFicha(semFicha, 'Envenenado', [], { turnos: 0, porVez: 4 })).toBe(semFicha)
    const doDisco = { conditions: ['envenenado'], prazosDasCondicoes: [{ nome: 'Envenenado', turnos: 2.5 }, { nome: '', turnos: 2 }, 'lixo', { nome: 'Caído', turnos: 2 }, { nome: 'ENVENENADO', turnos: 2, porVez: -1 }] }
    expect(prazosDaFicha(doDisco)).toEqual([{ nome: 'ENVENENADO', turnos: 2 }])
  })
})
