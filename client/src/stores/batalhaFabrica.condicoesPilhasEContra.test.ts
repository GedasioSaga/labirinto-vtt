// @vitest-environment node
/**
 * Rework das condições, E8, teste 2 "Pilhas, contra e teste por turno, na batalha"
 * (docs/design/condicoes-rework/PLANO.md §4): as de fábrica postas pelo nome na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com fichas inventadas e o d20 fixo.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { selosQueSaemCom } from '../lib/batalha/condicoes'
import { modificadorDoTeste } from '../lib/batalha/marca'
import type { VezEsperada } from '../lib/batalha/ponte'
import { danoComAsReducoes, reducoesDosSelos } from '../lib/batalha/reducaoDoDano'
import { combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { numeroDaFicha, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_pilhas_e_contra'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro. */
const BROOK = ficha({ id: 'pers_brook', tipo: 'jogador', nome: 'Brook', recursos: { hp: 300, sp: 60, escudo: 0 }, maximos: { hp: 300, sp: 60 }, atributos: { forca: 30, agilidade: 60 } })

/** Age depois, ferido (200 de 300), sem Escudo e sem Resistência (o teste soma 0); cura 40 em si com uma ação livre. */
const HECTOR = ficha({
  id: 'pers_hector',
  tipo: 'jogador',
  nome: 'Hector',
  recursos: { hp: 200, sp: 60, escudo: 0 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 30 },
  abas: {
    habilidades: [
      {
        id: 'tec_balsamo',
        nome: 'Bálsamo',
        campos: {},
        mecanica: { versao: 1, acao: 'livre', custos: [], alvo: { quem: 'si', forma: { tipo: 'um' } }, teste: { tipo: 'naoErra' }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 40 }, emQuem: 'alvo' }] },
      },
    ],
  },
})

interface Batalha {
  loja: LojaDaBatalha
  hpDoHector: () => number
  hector: () => Personagem
}

/** `dados` = os d20 do host, na ordem; acabou a fila, sai 10. */
function batalha(dados: number[] = []): Batalha {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: BROOK, lado: 'a' }, { ficha: HECTOR, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => dados.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const hector = (): Personagem => {
    const achado = mesa.personagens().find((personagem) => personagem.nome === 'Hector')
    if (achado === undefined) throw new Error('sem o Hector na mesa')
    return achado
  }
  return { loja, hector, hpDoHector: () => numeroDaFicha(hector().recursos, 'hp') }
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
const selosNoHector = (loja: LojaDaBatalha): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenDoHector(loja)).map((selo) => selo.nome)
const textosDoRegistro = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)

describe('E8 teste 2: contra-condição', () => {
  it('Hector com Queimando ganha Molhado e o Queimando sai; um Queimando novo é recusado', () => {
    const { loja } = batalha()
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Queimando', turnos: 3 })).toBe(true)
    expect(selosNoHector(loja)).toEqual(['Queimando'])
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Molhado', turnos: 2 })).toBe(true)
    expect(selosNoHector(loja)).toEqual(['Molhado'])
    expect(loja.getState().porSelo(CENA, tokenDoHector(loja), { nome: 'Queimando', turnos: 3 })).toBe(false)
    expect(selosNoHector(loja)).toEqual(['Molhado'])
  })
})

describe('E8 teste 2: pilhas e teste por turno', () => {
  it('Envenenado duas vezes: 2 pilhas, o Aplicar tira 6, a cura 40 chega 20 e, com 12 no total, passa na Resistência CD 12 no fim da vez e sai', () => {
    const dados: number[] = []
    const { loja, hector, hpDoHector } = batalha(dados)
    const hectorToken = tokenDoHector(loja)
    expect(loja.getState().porSelo(CENA, hectorToken, { nome: 'Envenenado', turnos: 3 })).toBe(true)
    expect(loja.getState().porSelo(CENA, hectorToken, { nome: 'Envenenado', turnos: 3 })).toBe(true)
    const envenenados = (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === hectorToken && selo.nome === 'Envenenado')
    expect(envenenados.map((selo) => selo.pilhas)).toEqual([2])

    // O Aplicar no começo da vez do Hector: 3 × 2 pilhas.
    const vez = naVezDe(loja, 'Hector')
    const personagemId = carta(loja, 'Hector').personagemId
    if (personagemId === null) throw new Error('a carta do Hector não tem ficha')
    const lembrete = (cena(loja).turnos.combate?.[personagemId]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))
    if (lembrete === undefined) throw new Error('o Envenenado não pediu o Aplicar')
    expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: hectorToken, cartaoId: lembrete.cartaoId, aplicar: true })).toBe(true)
    expect(hpDoHector()).toBe(194)

    // A cura de 40 chega pela metade (a cura −50% não multiplica com as pilhas).
    const balsamo: PedidoDeAcao = { tipo: 'habilidade', cartaoId: 'tec_balsamo', armaId: null, alvos: [{ tokenId: hectorToken, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
    expect(loja.getState().agir(CENA, MESTRE, vez, balsamo)).toBe(true)
    expect(hpDoHector()).toBe(214)

    // O teste de saída no fim da vez: d20 12 + 0 = 12 contra CD 12.
    expect(modificadorDoTeste(hector(), SISTEMA_DO_TESTE, 'resistencia')).toBe(0)
    dados.push(12)
    expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Hector'))).toBe(true)
    expect(selosNoHector(loja)).toEqual([])
    expect(textosDoRegistro(loja).some((texto) => texto.includes('Envenenado') && texto.includes('12'))).toBe(true)
  })
})

describe('E8 teste 2: dano de um tipo e saída por tipo', () => {
  it('Congelado: o golpe de Impacto 30 chega 45, um de Eletricidade fica 30, e um de Fogo o tira', () => {
    const { loja } = batalha()
    const hectorToken = tokenDoHector(loja)
    expect(loja.getState().porSelo(CENA, hectorToken, { nome: 'Congelado', turnos: 2 })).toBe(true)
    const selos = cena(loja).turnos.selos
    // As mesmas contas que o golpe da store faz com os tipos do golpe (lib/batalha/golpe.ts, tiposDoGolpe).
    expect(danoComAsReducoes(30, reducoesDosSelos(selos, hectorToken, ['impacto']))).toBe(45)
    expect(danoComAsReducoes(30, reducoesDosSelos(selos, hectorToken, ['eletricidade']))).toBe(30)
    expect(selosQueSaemCom(selos, hectorToken, { tipo: 'dano', tipos: ['fogo'] }).map((selo) => selo.nome)).toEqual(['Congelado'])
    expect(selosQueSaemCom(selos, hectorToken, { tipo: 'dano', tipos: ['impacto'] })).toEqual([])
  })
})
