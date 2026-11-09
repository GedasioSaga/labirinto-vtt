// @vitest-environment node
/**
 * Construtor de mecânicas, fatia C4 (teste e disputa): a técnica montada com
 * teste do alvo contra CD, ou disputa d20 contra d20, rolada pelo app ao usar
 * (a mesma `disputa.ts` da F2), com o texto da rolagem na linha do golpe e o
 * Desfazer da linha devolvendo tudo. Dados inventados; no máximo 2 testes por
 * situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { modificadorDoTeste } from '../lib/batalha/marca'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_teste'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const CD = 12

function cartao(id: string, nome: string, teste: unknown): CartaoDaFicha {
  return {
    id,
    nome,
    campos: {},
    extras: [],
    atributos: [],
    imagem: null,
    modificadores: [],
    subcartoes: [],
    mecanica: {
      versao: 1,
      acao: 'simples',
      custos: [{ recurso: 'sp', quanto: { fixo: 20 }, quando: 'aoUsar' }],
      alvo: { quem: 'inimigos', forma: { tipo: 'um' } },
      teste,
      efeitos: [{ tipo: 'selo', nome: 'Atordoado', duracao: 1, natureza: 'debuff' }],
    },
  }
}

/** "RES contra 12" (o pronto da C4), sem vantagem e sem `sePassar` guardado (vale "nada"). */
const OLHAR = cartao('cart_olhar_paralisante', 'Olhar Paralisante', { tipo: 'resistencia', alvo: { atributo: 'resistencia' }, cd: { fixo: CD } })
/** Disputa de Força (com vantagem) contra Resistência. */
const EMPURRAO = cartao('cart_empurrao_de_teste', 'Empurrão de Teste', { tipo: 'disputa', usuario: { atributo: 'forca', vantagem: 'vantagem' }, alvo: { atributo: 'resistencia' } })

const feiticeira: Personagem = { ...ficha('Feiticeira de Teste', { forca: 30 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [OLHAR, EMPURRAO] }), tipo: 'npc' }
const marujo: Personagem = ficha('Marujo de Teste', { resistencia: 30 }, { hp: 500, sp: 100, escudo: 0 }, {})

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria; fila: number[] } {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: feiticeira, lado: 'a' }, { ficha: marujo, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => fila.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((item) => item.id))), regras: null, desempate: 'd20' })
  return { loja, mesa, fila }
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

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function usar(loja: LojaDaBatalha, tecnica: CartaoDaFicha): boolean {
  const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId: tecnica.id, armaId: null, alvos: [{ tokenId: token(loja, 'Marujo de Teste'), dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
  return loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Feiticeira de Teste'), pedido)
}

const spDaFeiticeira = (mesa: MesaEmMemoria): number => numeroDaFicha(mesa.personagens().find((item) => item.nome === 'Feiticeira de Teste')?.recursos ?? {}, 'sp')
const selosNoMarujo = (loja: LojaDaBatalha): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === token(loja, 'Marujo de Teste')).map((selo) => `${selo.nome} ${selo.turnos ?? ''}`.trim())
const linhaCom = (loja: LojaDaBatalha, trecho: string) => [...cena(loja).registro].reverse().find((linha) => linha.desfeita === undefined && linha.texto.includes(trecho))
const modDe = (personagem: Personagem, atributoId: string): number => modificadorDoTeste(personagem, SISTEMA_DO_TESTE, atributoId)

describe('teste do alvo contra CD 12 (RES do Marujo)', () => {
  it('falhou (total 11): Atordoado 1 e 20 SP gastos, a rolagem na linha; o Desfazer tira o selo e devolve o SP', () => {
    const { loja, mesa, fila } = batalha()
    fila.push(CD - modDe(marujo, 'resistencia') - 1)
    expect(usar(loja, OLHAR)).toBe(true)
    expect(selosNoMarujo(loja)).toEqual(['Atordoado 1'])
    expect(spDaFeiticeira(mesa)).toBe(80)
    const linha = linhaCom(loja, `contra CD ${CD}, pegou`)
    expect(linha?.texto).toContain('Olhar Paralisante')
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([selosNoMarujo(loja), spDaFeiticeira(mesa)]).toEqual([[], 100])
  })

  it('passou (total 12): nada acontece no Marujo, a linha diz que não pegou', () => {
    const { loja, mesa, fila } = batalha()
    fila.push(CD - modDe(marujo, 'resistencia'))
    expect(usar(loja, OLHAR)).toBe(true)
    expect(selosNoMarujo(loja)).toEqual([])
    expect(spDaFeiticeira(mesa)).toBe(80)
    expect(linhaCom(loja, `contra CD ${CD}, não pegou`)).toBeDefined()
  })
})

describe('disputa d20 + FOR (com vantagem) contra d20 + RES', () => {
  it('o 2º d20 da vantagem (15) vence o 14 do Marujo: Atordoado; empate fica com o alvo', () => {
    const { loja, fila } = batalha()
    const diferenca = modDe(feiticeira, 'forca') - modDe(marujo, 'resistencia')
    // A Feiticeira tira 2 e 15 (fica o 15); o Marujo tira o que empata com o 2 e perde para o 15.
    const doMarujo = 15 + diferenca - 1
    fila.push(2, 15, doMarujo)
    expect(usar(loja, EMPURRAO)).toBe(true)
    expect(selosNoMarujo(loja)).toEqual(['Atordoado 1'])
    expect(linhaCom(loja, 'disputa d20')?.texto).toContain('pegou')

    const empate = batalha()
    empate.fila.push(15, 2, 15 + diferenca)
    expect(usar(empate.loja, EMPURRAO)).toBe(true)
    expect(selosNoMarujo(empate.loja)).toEqual([])
    expect(linhaCom(empate.loja, 'não pegou')).toBeDefined()
  })
})
