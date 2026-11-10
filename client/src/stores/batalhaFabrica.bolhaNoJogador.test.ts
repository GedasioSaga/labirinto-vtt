// @vitest-environment node
/**
 * Conserto de 09/11/2026 (achado principal da auditoria da Bolha): o mestre
 * mirou a cura do NPC num JOGADOR e ela "não curou nada", porque para o app
 * todo NPC era inimigo dos jogadores e a regra recusava calada. Agora: o NPC
 * do lado dos jogadores cura o jogador como aliado, e o mestre, que é o juiz,
 * cura com o NPC quem ele mirar. O jogador segue sem curar o outro lado.
 * O cartão é a cópia das peças da Bolha (ids e nomes inventados). Dados
 * inventados; no máximo 2 testes.
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

const CENA = 'cena_da_bolha_no_jogador'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

const BOLHA: CartaoDaFicha = {
  id: 'cart_bolha_no_jogador',
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

/** Ficha com Espírito 50, 120 de SP e a vida pedida (de 500). */
function de(nome: string, tipo: Personagem['tipo'], hp: number, habilidades: CartaoDaFicha[] = []): Personagem {
  const base = ficha(nome, { forca: 50, espirito: 50 }, { hp: 500, sp: 120, escudo: 0 }, { habilidades })
  return { ...base, tipo, recursos: { ...base.recursos, hp } }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 6; i += 1) {
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

function bolhaEm(alvos: readonly string[], cartaoId = BOLHA.id): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos: alvos.map((tokenId) => ({ tokenId, dano: null })), surpresa: false, perfurante: false, custo: null, acao: null }
}

/** A Árvore (NPC com a Bolha) no lado pedido; a Capitã (200/500) e o Grumete (480/500) jogadores no lado b; um Urso contra. */
function mesaDaBolha(ladoDaArvore: 'a' | 'b') {
  const lutadores = lutadoresDe([
    { ficha: de('Árvore de Teste', 'npc', 500, [BOLHA]), lado: ladoDaArvore },
    { ficha: de('Urso de Teste', 'npc', 300), lado: 'a' },
    { ficha: de('Capitã de Teste', 'jogador', 200, [{ ...BOLHA, id: 'cart_bolha_da_capita' }]), lado: 'b' },
    { ficha: de('Grumete de Teste', 'jogador', 480), lado: 'b' },
  ])
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadores)
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((item) => item.id))), regras: null, desempate: 'd20' })
  const recurso = (nome: string, chave: string) => numeroDaFicha(mesa.personagens().find((item) => item.nome === nome)?.recursos ?? {}, chave)
  return { loja, recurso }
}

describe('a Bolha do NPC num jogador', () => {
  it('NPC do lado dos jogadores (Espírito 50) cura o jogador ferido: +50 sem passar do máximo, 30 de SP, 1 uso', () => {
    const { loja, recurso } = mesaDaBolha('b')
    const vez = naVezDe(loja, 'Árvore de Teste')
    expect(loja.getState().agir(CENA, MESTRE, vez, bolhaEm([token(loja, 'Capitã de Teste'), token(loja, 'Grumete de Teste')]))).toBe(true)
    expect([recurso('Capitã de Teste', 'hp'), recurso('Grumete de Teste', 'hp'), recurso('Árvore de Teste', 'sp')]).toEqual([250, 500, 90])
    const { turnos } = cena(loja)
    const quemUsou = turnos.cartas.find((carta) => carta.id === vez.cartaId)?.personagemId ?? ''
    expect(turnos.combate?.[quemUsou]?.usos[BOLHA.id]).toBe(1)
  })

  it('NPC contra os jogadores: o mestre mira o jogador e a cura sai do mesmo jeito; o jogador segue sem curar o outro lado, e o motivo diz quem está lá', () => {
    const { loja, recurso } = mesaDaBolha('a')
    const daArvore = naVezDe(loja, 'Árvore de Teste')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, daArvore, bolhaEm([token(loja, 'Capitã de Teste')]))).toBeNull()
    expect(loja.getState().agir(CENA, MESTRE, daArvore, bolhaEm([token(loja, 'Capitã de Teste')]))).toBe(true)
    expect([recurso('Capitã de Teste', 'hp'), recurso('Árvore de Teste', 'sp')]).toEqual([250, 90])

    const daCapita = naVezDe(loja, 'Capitã de Teste')
    const jogadora: AutorDaAcao = { tipo: 'jogador', playerId: 'p1', nome: 'Jogadora' }
    const noUrso = bolhaEm([token(loja, 'Urso de Teste')], 'cart_bolha_da_capita')
    expect(loja.getState().agir(CENA, jogadora, daCapita, noUrso)).toBe(false)
    expect(loja.getState().motivoDoAgir(CENA, jogadora, daCapita, noUrso)).toBe('Bolha só vale em você ou num aliado')
    // O mestre jogando pela ficha do jogador lê quem está do outro lado.
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, daCapita, noUrso)).toBe('Bolha só vale em quem usa ou num aliado. Urso de Teste está do outro lado.')
    expect(recurso('Capitã de Teste', 'sp')).toBe(120)
  })
})
