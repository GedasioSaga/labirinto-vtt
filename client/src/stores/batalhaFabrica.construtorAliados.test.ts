// @vitest-environment node
/**
 * Construtor de mecânicas, revisão da fatia C3: a área "aliados" da técnica
 * montada (a cura em área) vale no host com a MESMA regra de aliado da mira
 * do mestre (`ladoNaBatalha`): o NPC cura o NPC da equipe dele e não cura o
 * jogador do outro lado. Dados inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ladoNaBatalha, mesmoLadoNaBatalha, type Equipe } from '../lib/batalha/equipes'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_dos_aliados'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

const CHUVA_CURATIVA: CartaoDaFicha = {
  id: 'cart_chuva_curativa',
  nome: 'Chuva Curativa',
  campos: {},
  extras: [],
  atributos: [],
  imagem: null,
  modificadores: [],
  subcartoes: [],
  mecanica: { versao: 1, acao: 'simples', alvo: { quem: 'aliados', forma: { tipo: 'quadrado', lado: 3, centro: 'si' } }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 50 }, emQuem: 'alvo' }] },
}

/** Uma ficha de teste com 200 de 500 de HP (a cura aparece). */
function ferido(nome: string, tipo: Personagem['tipo'], habilidades: CartaoDaFicha[] = []): Personagem {
  const base = ficha(nome, { forca: 20 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades })
  return { ...base, tipo, recursos: { ...base.recursos, hp: 200 } }
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

function curar(alvos: readonly string[]): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId: CHUVA_CURATIVA.id, armaId: null, alvos: alvos.map((tokenId) => ({ tokenId, dano: null })), surpresa: false, perfurante: false, custo: null, acao: null }
}

describe('a área "aliados" da técnica montada no host', () => {
  it('o NPC cura o NPC da equipe dele (200 → 250); o jogador do outro lado é recusado', () => {
    const lutadores = lutadoresDe([
      { ficha: ferido('Curandeira de Teste', 'npc', [CHUVA_CURATIVA]), lado: 'a' },
      { ficha: ferido('Grumete de Teste', 'npc'), lado: 'a' },
      { ficha: ferido('Capitã de Teste', 'jogador'), lado: 'b' },
    ])
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadores)
    const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
    const tokens = mesa.tokens()
    loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((item) => item.id))), regras: null, desempate: 'd20' })
    const vez = naVezDe(loja, 'Curandeira de Teste')
    const hp = (nome: string) => numeroDaFicha(mesa.personagens().find((item) => item.nome === nome)?.recursos ?? {}, 'hp')

    expect(loja.getState().agir(CENA, MESTRE, vez, curar([token(loja, 'Capitã de Teste')]))).toBe(false)
    expect(loja.getState().agir(CENA, MESTRE, vez, curar([token(loja, 'Grumete de Teste'), token(loja, 'Curandeira de Teste')]))).toBe(true)
    expect([hp('Grumete de Teste'), hp('Curandeira de Teste'), hp('Capitã de Teste')]).toEqual([250, 250, 200])
  })

  it('a regra única de lado (mira do mestre e host): sem equipes, NPC com NPC; com equipes, a equipe; o invocado é do dono', () => {
    const npcA = ferido('NPC A', 'npc')
    const npcB = ferido('NPC B', 'npc')
    const jogadora = ferido('Jogadora', 'jogador')
    const personagens = [npcA, npcB, jogadora]
    const invocados = [{ personagemId: 'pers_lobo', donoPersonagemId: npcA.id }]
    const semEquipes = { equipes: undefined, personagens, invocados }
    expect([mesmoLadoNaBatalha(npcA.id, npcB.id, semEquipes), mesmoLadoNaBatalha(npcA.id, jogadora.id, semEquipes), mesmoLadoNaBatalha(npcB.id, 'pers_lobo', semEquipes)]).toEqual([true, false, true])
    const equipes: Equipe[] = [{ id: 'equipe_mista', nome: 'Mista', cor: '#336699', membros: [npcA.id, jogadora.id] }]
    const comEquipes = { equipes, personagens, invocados }
    expect([mesmoLadoNaBatalha(npcA.id, jogadora.id, comEquipes), mesmoLadoNaBatalha(npcA.id, npcB.id, comEquipes), ladoNaBatalha(npcB.id, comEquipes)]).toEqual([true, false, null])
  })
})
