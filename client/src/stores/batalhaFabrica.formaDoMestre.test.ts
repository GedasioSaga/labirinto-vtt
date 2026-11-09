// @vitest-environment node
/**
 * CONSTRUTOR DE MECÂNICAS C6: a tela do mestre ao transformar (o Sulong da
 * May, respostas-do-grilling.md). A forma com a peça "o mestre decide os
 * números" não liga no pedido: espera o mestre, liga com os números dele, e o
 * Desfazer do pedido volta tudo. Ficha inventada (repositório público). No
 * máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { atributoComposto } from '../lib/ajusteDaFicha'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { DecisaoDaForma, FormaPendente } from '../lib/batalha/combate'
import { fraseDoRecusar, PECA_DO_MESTRE_NA_FORMA } from '../lib/batalha/mecanica/formaDoMestre'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import type { CartaoDaFicha, Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }

/** A forma de lua cheia, com a última decisão guardada (FOR +5) e a peça do mestre. */
const LUA_CHEIA: CartaoDaFicha = {
  id: 'cart_lua_cheia',
  nome: 'Lua Cheia',
  campos: { acao: 'Completa', requisito: 'Só à noite de lua cheia' },
  extras: [],
  atributos: [],
  imagem: null,
  modificadores: [{ atributo: 'forca', delta: 5 }],
  subcartoes: [],
  mecanica: { ...PECA_DO_MESTRE_NA_FORMA },
}

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const heroi = ficha('Nina', ATRIBUTOS, { hp: 500, sp: 50, escudo: 0 }, { transformacoes: [LUA_CHEIA] })
  const pirata = ficha('Pirata', ATRIBUTOS, { hp: 500, sp: 50, escudo: 0 }, {})
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, { ficha: pirata, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function nina(mesa: MesaEmMemoria): Personagem {
  const achada = mesa.personagens().find((candidato) => candidato.nome === 'Nina')
  if (achada === undefined) throw new Error('sem a Nina')
  return achada
}

const cartaoDaForma = (mesa: MesaEmMemoria): CartaoDaFicha | undefined => nina(mesa).abas.transformacoes?.find((cartao) => cartao.id === LUA_CHEIA.id)
const pedirLuaCheia = { tipo: 'transformar', cartaoId: LUA_CHEIA.id, acao: 'completa', trocarImagem: false } as const
const decisao = { mods: [{ atributo: 'forca', delta: 30 }], habilidade: { nome: 'Garras de Lua', texto: '+30 no Atacar' } }

describe('C6: o mestre decide os números da forma', () => {
  it('o pedido gasta a ação e espera o mestre sem ligar; a decisão liga com FOR +30 e a habilidade nova', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Nina')
    expect(loja.getState().agir(CENA, MESTRE, vez, pedirLuaCheia)).toBe(true)
    expect(nina(mesa).cartoesAtivos).not.toContain(LUA_CHEIA.id)
    const pendente = cena(loja).turnos.formasPendentes?.[0]
    expect(pendente?.nome).toBe('Lua Cheia')
    expect(cena(loja).turnos.gastos[vez.cartaId]?.simples).toBeGreaterThan(0)
    // O segundo pedido da mesma forma é recusado enquanto o mestre decide.
    expect(loja.getState().agir(CENA, MESTRE, vez, { ...pedirLuaCheia, acao: 'livre' })).toBe(false)

    expect(loja.getState().decidirForma(CENA, pendente?.id ?? '', decisao)).toBe(true)
    expect(nina(mesa).cartoesAtivos).toContain(LUA_CHEIA.id)
    expect(atributoComposto(nina(mesa), 'forca').total).toBe(40)
    expect(cartaoDaForma(mesa)?.subcartoes.map((subcartao) => subcartao.nome)).toEqual(['Garras de Lua'])
    expect(cena(loja).turnos.formasPendentes ?? []).toEqual([])
    expect(cena(loja).registro.at(-1)?.texto).toContain('o mestre decidiu: FOR +30 · ganha Garras de Lua')
  })

  it('desfazer o pedido depois da decisão volta tudo: a forma desliga, o cartão volta a FOR +5 sem a habilidade, e a ação volta', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Nina')
    const gastoAntes = cena(loja).turnos.gastos[vez.cartaId] ?? null
    expect(loja.getState().agir(CENA, MESTRE, vez, pedirLuaCheia)).toBe(true)
    const pendente = cena(loja).turnos.formasPendentes?.[0]
    expect(loja.getState().decidirForma(CENA, pendente?.id ?? '', decisao)).toBe(true)

    expect(loja.getState().desfazer(CENA, pendente?.linhaId ?? '', MESTRE)).toBe(true)
    expect(nina(mesa).cartoesAtivos).not.toContain(LUA_CHEIA.id)
    expect(cartaoDaForma(mesa)?.modificadores).toEqual([{ atributo: 'forca', delta: 5 }])
    expect(cartaoDaForma(mesa)?.subcartoes).toEqual([])
    expect(atributoComposto(nina(mesa), 'forca').total).toBe(10)
    expect(cena(loja).turnos.formasPendentes ?? []).toEqual([])
    expect(cena(loja).turnos.gastos[vez.cartaId] ?? null).toEqual(gastoAntes)
  })
})

/** Liga a Lua Cheia pelo pedido e pela decisão (sem gastar ação) e devolve a pendência que o mestre decidiu. */
function transformar(loja: LojaDaBatalha, vez: VezEsperada, escolha: DecisaoDaForma): FormaPendente {
  expect(loja.getState().agir(CENA, MESTRE, vez, { ...pedirLuaCheia, acao: 'livre' })).toBe(true)
  const pendente = cena(loja).turnos.formasPendentes?.at(-1)
  if (pendente === undefined) throw new Error('o pedido não esperou o mestre')
  expect(loja.getState().decidirForma(CENA, pendente.id, escolha)).toBe(true)
  return pendente
}

function desligar(loja: LojaDaBatalha, vez: VezEsperada): void {
  expect(loja.getState().agir(CENA, MESTRE, vez, { tipo: 'destransformar', cartaoId: LUA_CHEIA.id })).toBe(true)
}

describe('C6 (revisão): a habilidade vale só na transformação, e o Desfazer fora de ordem não estraga a decisão de agora', () => {
  it('a habilidade da noite 1 sai na noite 2 sem habilidade, e uma nova não se soma à velha', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Nina')
    transformar(loja, vez, decisao)
    const garras = cartaoDaForma(mesa)?.subcartoes[0]
    expect(cartaoDaForma(mesa)?.mecanica).toEqual({ ...PECA_DO_MESTRE_NA_FORMA, habilidade: garras?.id })
    desligar(loja, vez)

    transformar(loja, vez, { mods: [{ atributo: 'forca', delta: 30 }], habilidade: null })
    expect(cartaoDaForma(mesa)?.subcartoes).toEqual([])
    expect(cartaoDaForma(mesa)?.mecanica).toEqual(PECA_DO_MESTRE_NA_FORMA)
    desligar(loja, vez)

    transformar(loja, vez, decisao)
    desligar(loja, vez)
    transformar(loja, vez, { mods: [], habilidade: { nome: 'Uivo', texto: 'assusta quem ouve' } })
    expect(cartaoDaForma(mesa)?.subcartoes.map((subcartao) => subcartao.nome)).toEqual(['Uivo'])
  })

  it('desfazer a decisão da noite 1 depois da noite 2 deixa os números da noite 2 e não devolve o pedido 1 com a forma ligada', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Nina')
    const pedido1 = transformar(loja, vez, decisao)
    const linhaDaDecisao1 = cena(loja).registro.at(-1)?.id ?? ''
    desligar(loja, vez)
    transformar(loja, vez, { mods: [{ atributo: 'forca', delta: 50 }], habilidade: null })

    expect(loja.getState().desfazer(CENA, linhaDaDecisao1, MESTRE)).toBe(true)
    expect(cartaoDaForma(mesa)?.modificadores).toEqual([{ atributo: 'forca', delta: 50 }])
    // O Desfazer da noite 1 desliga a forma (a ficha volta ao "desligada" daquela linha): só então o pedido 1 volta a esperar, e decidir funciona.
    expect(nina(mesa).cartoesAtivos).not.toContain(LUA_CHEIA.id)
    expect((cena(loja).turnos.formasPendentes ?? []).map((pendente) => pendente.id)).toEqual([pedido1.id])
    expect(loja.getState().decidirForma(CENA, pedido1.id, decisao)).toBe(true)
  })

  it('a confirmação de Recusar diz o que volta: a ação na vez do pedido, nada depois que a vez passou', () => {
    const { loja } = batalha()
    const vez = naVezDe(loja, 'Nina')
    expect(loja.getState().agir(CENA, MESTRE, vez, pedirLuaCheia)).toBe(true)
    const pendente = cena(loja).turnos.formasPendentes?.[0]
    if (pendente === undefined) throw new Error('sem pendência')
    expect(fraseDoRecusar(pendente, 'Nina', cena(loja).turnos, cena(loja).registro)).toBe('A ação volta para Nina.')
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
    expect(fraseDoRecusar(pendente, 'Nina', cena(loja).turnos, cena(loja).registro)).toBe('A ação não volta: a vez já passou.')
  })
})
