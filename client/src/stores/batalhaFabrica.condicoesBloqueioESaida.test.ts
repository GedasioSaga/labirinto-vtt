// @vitest-environment node
/**
 * Rework das condições, E8, teste 3 "Bloqueio, ritmo e sair pagando" (docs/design/condicoes-rework/PLANO.md §4):
 * Lento, Silenciado e Enraizado de fábrica postos pelo nome, na store do app (`criarBatalhaStore`) sobre a mesa
 * em memória do treino, com fichas inventadas e o d20 fixo.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { chaveDaSaida } from '../lib/batalha/condicoesNaVez'
import { modificadorDoTeste } from '../lib/batalha/marca'
import type { VezEsperada } from '../lib/batalha/ponte'
import { bonusDaBatalha, totalDoBonus } from '../lib/batalha/selos'
import { combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { condicaoDaFabrica, pastilhaDaFabrica } from '../lib/condicoes/fabrica'
import { passoMaximoDaFicha } from '../lib/movementRules'
import { numeroDaFicha, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_bloqueio_e_saida'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro. */
const BROOK = ficha({ id: 'pers_brook', tipo: 'jogador', nome: 'Brook', recursos: { hp: 300, sp: 60, escudo: 0 }, maximos: { hp: 300, sp: 60 }, atributos: { forca: 30, agilidade: 60 } })

/** Age depois (Agilidade 40); uma técnica Simples e uma Completa. */
function hectorCom(sp: number): Personagem {
  return ficha({
    id: 'pers_hector',
    tipo: 'jogador',
    nome: 'Hector',
    recursos: { hp: 300, sp, escudo: 0 },
    maximos: { hp: 300, sp: 60 },
    atributos: { forca: 30, agilidade: 40 },
    abas: {
      habilidades: [
        { id: 'tec_grito', nome: 'Grito', campos: { acao: 'Simples', custo: '-', tempo: '-', dano: '10' } },
        { id: 'tec_avalanche', nome: 'Avalanche', campos: { acao: 'Completa', custo: '-', tempo: '-', dano: '30' } },
      ],
    },
  })
}

interface Batalha {
  loja: LojaDaBatalha
  hector: () => Personagem
}

/** `dados` = os d20 do host, na ordem; acabou a fila, sai 10. */
function batalha(hector: Personagem, dados: number[] = []): Batalha {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: BROOK, lado: 'a' }, { ficha: hector, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => dados.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const daMesa = (): Personagem => {
    const achado = mesa.personagens().find((personagem) => personagem.nome === 'Hector')
    if (achado === undefined) throw new Error('sem o Hector na mesa')
    return achado
  }
  return { loja, hector: daMesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function carta(loja: LojaDaBatalha, nome: string): CartaDaOrdem {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome === nome && candidata.extra === undefined)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((candidata) => candidata.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

const tokenDoHector = (loja: LojaDaBatalha): string => carta(loja, 'Hector').tokenId
const seloNoHector = (loja: LojaDaBatalha, nome: string): boolean => (cena(loja).turnos.selos ?? []).some((selo) => selo.tokenId === tokenDoHector(loja) && selo.nome === nome)
const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''
const tecnica = (loja: LojaDaBatalha, cartaoId: string): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: carta(loja, 'Brook').tokenId, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null })

/** Na vez do Hector, responde ao "Tentar sair" do selo `nome`. */
function tentarSair(loja: LojaDaBatalha, nome: string): void {
  naVezDe(loja, 'Hector')
  const selo = (cena(loja).turnos.selos ?? []).find((candidato) => candidato.tokenId === tokenDoHector(loja) && candidato.nome === nome)
  const personagemId = carta(loja, 'Hector').personagemId
  if (selo === undefined || personagemId === null) throw new Error(`sem ${nome} no Hector`)
  const lembrete = (cena(loja).turnos.combate?.[personagemId]?.lembretes ?? []).find((candidato) => candidato.chave === chaveDaSaida(selo.id))
  if (lembrete === undefined) throw new Error(`${nome} não pediu o Tentar sair`)
  expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: tokenDoHector(loja), cartaoId: lembrete.cartaoId, aplicar: true })).toBe(true)
}

describe('E8 teste 3: Lento', () => {
  it('a Agilidade 40 vai a 30, 20, 10 e fica em 10, e a ação Completa é recusada', () => {
    const { loja } = batalha(hectorCom(60))
    const agilidade = (): number => 40 + totalDoBonus(bonusDaBatalha(cena(loja).turnos.selos, tokenDoHector(loja)), 'agilidade')
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Lento', turnos: 5 })).toBe(true)
    // Ao entrar ainda não caiu: o "−10 por vez" conta no fim de cada vez do Hector, até o teto de 30.
    expect(agilidade()).toBe(40)
    const vistas: number[] = []
    for (let vez = 0; vez < 4; vez += 1) {
      expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Hector'))).toBe(true)
      vistas.push(agilidade())
    }
    expect(vistas).toEqual([30, 20, 10, 10])
    const vez = naVezDe(loja, 'Hector')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(loja, 'tec_avalanche'))).toContain('Lento')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(loja, 'tec_grito'))).toBeNull()
  })
})

describe('E8 teste 3: Silenciado', () => {
  it('a técnica é recusada no host; "Tentar sair" com 20 SP sai', () => {
    const { loja, hector } = batalha(hectorCom(60))
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Silenciado', turnos: 2 })).toBe(true)
    const vez = naVezDe(loja, 'Hector')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(loja, 'tec_grito'))).toContain('Silenciado')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(loja, 'tec_grito'))).toBe(false)
    tentarSair(loja, 'Silenciado')
    expect(numeroDaFicha(hector().recursos, 'sp')).toBe(40)
    expect(seloNoHector(loja, 'Silenciado')).toBe(false)
  })

  it('sem SP, rola Espírito CD 13: 12 no total não sai', () => {
    const dados: number[] = []
    const { loja, hector } = batalha(hectorCom(0), dados)
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Silenciado', turnos: 2 })).toBe(true)
    const modificador = modificadorDoTeste(hector(), SISTEMA_DO_TESTE, 'espirito')
    dados.push(12 - modificador)
    tentarSair(loja, 'Silenciado')
    expect(ultimaLinha(loja)).toContain('contra CD 13, não passou')
    expect(seloNoHector(loja, 'Silenciado')).toBe(true)
  })
})

describe('E8 teste 3: Enraizado', () => {
  it('o passo do jogador é 0 com a pastilha; sem ela, o da cena', () => {
    const enraizado = condicaoDaFabrica('enraizado')
    if (enraizado === null) throw new Error('sem o Enraizado de fábrica')
    const cenaComPasso = { movement: { maxStepCells: 6 } }
    expect(passoMaximoDaFicha(cenaComPasso, { condicoesProprias: [pastilhaDaFabrica(enraizado)] })).toBe(0)
    expect(passoMaximoDaFicha(cenaComPasso, {})).toBe(6)
  })

  it('só sai pagando a ação simples e passando em Força CD 15', () => {
    const dados: number[] = []
    const { loja, hector } = batalha(hectorCom(60), dados)
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Enraizado', turnos: null })).toBe(true)
    const modificador = modificadorDoTeste(hector(), SISTEMA_DO_TESTE, 'forca')
    dados.push(14 - modificador)
    tentarSair(loja, 'Enraizado')
    expect(ultimaLinha(loja)).toContain('contra CD 15, não passou')
    expect(seloNoHector(loja, 'Enraizado')).toBe(true)
    expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Hector'))).toBe(true)
    dados.push(15 - modificador)
    tentarSair(loja, 'Enraizado')
    expect(ultimaLinha(loja)).toContain('contra CD 15, passou')
    expect(seloNoHector(loja, 'Enraizado')).toBe(false)
  })
})
