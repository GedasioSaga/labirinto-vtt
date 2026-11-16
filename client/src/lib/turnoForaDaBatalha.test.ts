/**
 * Fase C, item 4: o "Passar turno" fora da batalha. Envenenado 3 x 4 tira 12
 * em 3 passes e a pastilha apaga; o Desfazer volta as condições exatas; a
 * ficha sem nenhum campo opcional não quebra nada.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { novoPersonagem, type Personagem } from './personagem'
import { porCondicaoNaFicha } from './prazoDaCondicao'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'
import { condicoesDaFicha, passarTurnoForaDaBatalha, personagemComAPerda, trocarCondicoesNoMapa } from './turnoForaDaBatalha'
import { recursoDeVida, vidaDoPersonagem } from './vidaDaFicha'
import type { MapData, Token } from '../types/map'

const RECURSO = recursoDeVida(SISTEMA_ONE_PIECE)

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 125, y: 125, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('vale', 'Vale', 60, 20, 50), tokens }
}

describe('passarTurnoForaDaBatalha', () => {
  it('Envenenado 3 x 4: 12 de vida em 3 passes, a pastilha apaga no fim, e o Desfazer volta exatamente', () => {
    if (RECURSO === null) throw new Error('o sistema do teste não tem vida')
    const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Brann')
    let brann: Personagem = { ...base, id: 'p-brann', recursos: { ...base.recursos, [RECURSO.id]: 40 }, maximos: { ...base.maximos, [RECURSO.id]: 60 } }
    const veneno = porCondicaoNaFicha(ficha('t-brann', { name: 'Brann', characterId: 'p-brann' }), 'Envenenado', [], { turnos: 3, porVez: 4 })
    let mapa = mapaCom([veneno, ficha('t-lia', { name: 'Lia' })])
    const vidaInicial = vidaDoPersonagem(brann, RECURSO)?.atual
    const frases: string[] = []
    let primeiro: ReturnType<typeof passarTurnoForaDaBatalha> = null
    for (let passe = 0; passe < 3; passe += 1) {
      const feito = passarTurnoForaDaBatalha(mapa, [brann], SISTEMA_ONE_PIECE)
      if (feito === null) throw new Error(`passe ${passe + 1} não passou`)
      if (primeiro === null) primeiro = feito
      mapa = trocarCondicoesNoMapa(mapa, feito.depois)
      for (const perda of feito.perdas) brann = personagemComAPerda(brann, SISTEMA_ONE_PIECE, perda, 0)
      frases.push(...feito.partes)
    }
    expect(vidaInicial).toBe(40)
    expect(vidaDoPersonagem(brann, RECURSO)?.atual).toBe(28)
    expect(frases).toEqual(['Brann perdeu 4 PV (Envenenado, faltam 2)', 'Brann perdeu 4 PV (Envenenado, faltam 1)', 'Brann perdeu 4 PV (Envenenado, acabou)'])
    const depois = mapa.tokens.find((token) => token.id === 't-brann')
    expect(depois?.conditions ?? []).not.toContain('envenenado')
    expect(depois?.prazosDasCondicoes).toBeUndefined()
    // Nada mais a passar: o botão não age.
    expect(passarTurnoForaDaBatalha(mapa, [brann], SISTEMA_ONE_PIECE)).toBeNull()
    // O Desfazer do primeiro passe, sobre o mapa de antes dele: as condições voltam idênticas.
    if (primeiro === null) throw new Error('sem o primeiro passe')
    const desfeito = trocarCondicoesNoMapa(trocarCondicoesNoMapa(mapaCom([veneno]), primeiro.depois), primeiro.antes)
    expect(condicoesDaFicha(desfeito.tokens[0])).toEqual(condicoesDaFicha(veneno))
  })

  it('ficha sem nenhum campo opcional (sem ficha ligada, sem condição, sem prazo) e sem sistema: nada a passar, sem erro', () => {
    const mapa = mapaCom([ficha('t-nada')])
    expect(passarTurnoForaDaBatalha(mapa, [], null)).toBeNull()
    // Lento sem personagem: o turno passa só o prazo, sem vida.
    const lento = porCondicaoNaFicha(ficha('t-tomas', { name: 'Tomás' }), 'Lento', [], { turnos: 2 })
    const feito = passarTurnoForaDaBatalha(mapaCom([lento]), [], null)
    expect(feito?.perdas).toEqual([])
    expect(feito?.partes).toEqual(['Tomás: Lento faltam 1'])
  })
})
