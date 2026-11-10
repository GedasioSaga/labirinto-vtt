// @vitest-environment node
/**
 * Pedido de 09/11/2026 (item 2): a Bolha do NPC Tree, montada por peças
 * (30 SP, Ação Simples, até 2 aliados, "Cura Espírito de HP", até 3 usos por
 * batalha), "não curou nada". O cartão abaixo é a cópia das peças gravadas na
 * mesa (ids e nomes inventados). Dados inventados; no máximo 2 testes.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_bolha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

const BOLHA: CartaoDaFicha = {
  id: 'cart_bolha_de_teste',
  nome: 'Bolha',
  campos: { dano: '', acao: 'Ação Simples', tipo: 'Buff' },
  extras: [],
  atributos: [],
  imagem: null,
  modificadores: [],
  subcartoes: [],
  mecanica: {
    versao: 1,
    limite: { usosPorBatalha: 3 },
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { formula: 'Espírito' }, emQuem: 'alvo' }],
    acao: 'simples',
    custos: [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }],
    alvo: { quem: 'aliados', forma: { tipo: 'varios', max: 2 } },
  },
}

/** NPC com Espírito 50, 120 de SP e a vida pedida (de 500). */
function npc(nome: string, hp: number, habilidades: CartaoDaFicha[] = []): Personagem {
  const base = ficha(nome, { forca: 50, espirito: 50 }, { hp: 500, sp: 120, escudo: 0 }, { habilidades })
  return { ...base, tipo: 'npc', recursos: { ...base.recursos, hp } }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez !== null && turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return { cartaId: turnos.vez, rodada: turnos.rodada }
    const vez = turnos.vez === null ? undefined : { cartaId: turnos.vez, rodada: turnos.rodada }
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function bolhaEm(alvos: readonly string[]): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId: BOLHA.id, armaId: null, alvos: alvos.map((tokenId) => ({ tokenId, dano: null })), surpresa: false, perfurante: false, custo: null, acao: null }
}

function mesaDaBolha(hpDoAliado: number) {
  const lutadores = lutadoresDe([
    { ficha: npc('Sapo de Teste', 500, [BOLHA]), lado: 'a' },
    { ficha: npc('Urso de Teste', hpDoAliado), lado: 'a' },
    { ficha: { ...npc('Capitã de Teste', 500), tipo: 'jogador' }, lado: 'b' },
  ])
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadores)
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((item) => item.id))), regras: null, desempate: 'd20' })
  const recurso = (nome: string, chave: string) => numeroDaFicha(mesa.personagens().find((item) => item.nome === nome)?.recursos ?? {}, chave)
  return { loja, recurso }
}

describe('a Bolha do NPC (cura o Espírito de quem usa no aliado)', () => {
  it('NPC com Espírito 50 cura 50 no aliado ferido, gasta 30 de SP e conta o uso', () => {
    const { loja, recurso } = mesaDaBolha(200)
    const vez = naVezDe(loja, 'Sapo de Teste')
    expect(loja.getState().agir(CENA, MESTRE, vez, bolhaEm([token(loja, 'Urso de Teste')]))).toBe(true)
    expect([recurso('Urso de Teste', 'hp'), recurso('Sapo de Teste', 'sp')]).toEqual([250, 90])
    const { turnos } = cena(loja)
    const quemUsou = turnos.cartas.find((carta) => carta.id === vez.cartaId)?.personagemId ?? ''
    expect(turnos.combate?.[quemUsou]?.usos[BOLHA.id]).toBe(1)
  })

  it('o registro diz o que curou de verdade (20 no quase cheio); só em quem está de vida cheia, recusa antes de cobrar', () => {
    const quaseCheio = mesaDaBolha(480)
    const vez = naVezDe(quaseCheio.loja, 'Sapo de Teste')
    expect(quaseCheio.loja.getState().agir(CENA, MESTRE, vez, bolhaEm([token(quaseCheio.loja, 'Urso de Teste')]))).toBe(true)
    expect(quaseCheio.recurso('Urso de Teste', 'hp')).toBe(500)
    expect(cena(quaseCheio.loja).registro.at(-1)?.texto ?? '').toContain('curou 20 (a vida encheu)')

    // Conserto de 09/11 (achado 5): antes gastava 30 de SP e 1 uso e o registro dizia "vida já cheia, não curou".
    const { loja, recurso } = mesaDaBolha(500)
    const daVez = naVezDe(loja, 'Sapo de Teste')
    const noCheio = bolhaEm([token(loja, 'Urso de Teste'), token(loja, 'Sapo de Teste')])
    const linhasAntes = cena(loja).registro.length
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, daVez, noCheio)).toBe('Ninguém marcado está ferido')
    expect(loja.getState().agir(CENA, MESTRE, daVez, noCheio)).toBe(false)
    const quemUsou = cena(loja).turnos.cartas.find((carta) => carta.id === daVez.cartaId)?.personagemId ?? ''
    expect([recurso('Sapo de Teste', 'sp'), cena(loja).turnos.combate?.[quemUsou]?.usos[BOLHA.id] ?? 0, cena(loja).registro.length]).toEqual([120, 0, linhasAntes])
  })
})
