// @vitest-environment node
/**
 * BUGS DA BATALHA (testadores de 28/11/2026, G1-03/05/06/10): a reação com técnica que DEVOLVE o golpe
 * (a Armadura Humana do modelo novo, como o Salvar do editor grava) e o "Anula o dano" da passiva
 * montada. O Pirata bate 70 no Hector; o Hector reage com a Armadura, saída "contra" (devolve 70 ÷ 7 +
 * Força). Tudo na store do app (`criarBatalhaStore`) sobre a mesa em memória do treino.
 */
import { describe, expect, it } from 'vitest'
import { acumuladoresNaFicha, comAcumuladorNovo, comOAcumuladorGravado } from '../components/batalha/acumulador/acumuladoresDaFicha'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import { ANULA_DE_PARTIDA, type RegraDoAnula } from '../lib/batalha/anulaODano'
import { anulacaoNoGolpe } from '../lib/batalha/anulacaoNoGolpe'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { MecanicaV1 } from '../lib/batalha/mecanica/modelo'
import { mecanicaDoModeloNovo, type IdDoModeloNovo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, turnosVazios, type AutorDaAcao } from '../lib/batalha/turnos'
import { novoCartao, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_devolve'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const GOLPE = 70
const HP_DO_PIRATA = 500
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }

const hectorSemNada = (): Personagem => ficha('Hector', ATRIBUTOS, { hp: 800, sp: 100, escudo: 0 }, {})
const pirata = (): Personagem => ficha('Pirata', { ...ATRIBUTOS, agilidade: 40 }, { hp: HP_DO_PIRATA, sp: 50, escudo: 0 }, {})

/** O cartão como o Salvar do editor grava (mestre), a partir da mecânica pedida. */
function doEditor(nome: string, mecanica: MecanicaV1, heroi: Personagem): CartaoDaFicha {
  const base = novoCartao(nome)
  const montado = cartaoComAMecanica(base, mecanica, 'mestre', { personagem: heroi, sistema: SISTEMA_DO_TESTE })
  if (montado === null) throw new Error(`o editor recusou ${nome}`)
  return cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
}

const doModelo = (id: IdDoModeloNovo, nome: string, heroi: Personagem): CartaoDaFicha => doEditor(nome, mecanicaDoModeloNovo(id, SISTEMA_DO_TESTE), heroi)

/** A passiva "Corpo de Fumaça": Dispara sozinha "Ao ser atingido (antes do dano)" com o Anula o dano da `regra`. */
function anulaDoEditor(heroi: Personagem, regra: Partial<RegraDoAnula>): CartaoDaFicha {
  const anula = { tipo: 'anula' as const, ...ANULA_DE_PARTIDA, ...regra }
  const mecanica: MecanicaV1 = { ...mecanicaDoModeloNovo('folegoDeBatalha', SISTEMA_DO_TESTE), pecas: [{ tipo: 'gatilho', quando: 'aoSerAtingido', n: 2, vezes: 'sempre', pergunta: false, efeitos: [anula] }] }
  return doEditor('Corpo de Fumaça', mecanica, heroi)
}

function comHabilidades(heroi: Personagem, habilidades: CartaoDaFicha[]): Personagem {
  return { ...heroi, abas: { ...heroi.abas, habilidades: [...(heroi.abas.habilidades ?? []), ...habilidades] } }
}

function batalha(hector: Personagem): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: pirata(), lado: 'a' }, { ficha: hector, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function vezDoPirata(loja: LojaDaBatalha): VezEsperada {
  const { turnos } = cena(loja)
  if (turnos.vez === null || turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome !== 'Pirata') throw new Error('a vez não é do Pirata')
  return { cartaId: turnos.vez, rodada: turnos.rodada }
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

const recurso = (mesa: MesaEmMemoria, nome: string, chave: string): number => numeroDaFicha(mesa.personagens().find((personagem) => personagem.nome === nome)?.recursos ?? {}, chave)

/** O Pirata bate 70 no Hector, e o Hector reage com a `armadura`, saída "contra". */
function golpeEArmadura(loja: LojaDaBatalha, armadura: CartaoDaFicha): void {
  const doHector = token(loja, 'Hector')
  const atacar: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doHector, dano: GOLPE }], surpresa: false, perfurante: false }
  expect(loja.getState().agir(CENA, MESTRE, vezDoPirata(loja), atacar)).toBe(true)
  const golpeId = cena(loja).turnos.golpes?.[0]?.id
  if (golpeId === undefined) throw new Error('o golpe não esperou a reação do Hector')
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: doHector, cartaoId: armadura.id, saida: 'contra', custo: null })).toBe(true)
}

describe('G1-05: o dano devolvido pela Armadura passa pelo "toma 0" e pelos cortes de quem atacou', () => {
  it('a régua: devolve 70 ÷ 7 + 10 = 20; com o Pirata Intangível toma 0; com o Pirata Vulnerável (+25%) toma 25', () => {
    const casos: { selo: string | null; perde: number }[] = [
      { selo: null, perde: 20 },
      { selo: 'Intangível', perde: 0 },
      { selo: 'Vulnerável', perde: 25 },
    ]
    for (const { selo, perde } of casos) {
      const semNada = hectorSemNada()
      const armadura = doModelo('armaduraHumana', 'Armadura Humana', semNada)
      const { loja, mesa } = batalha(comHabilidades(semNada, [armadura]))
      if (selo !== null) expect(loja.getState().porSelo(CENA, token(loja, 'Pirata'), { nome: selo, turnos: 3 })).toBe(true)
      golpeEArmadura(loja, armadura)
      expect({ selo, hp: recurso(mesa, 'Pirata', 'hp') }).toEqual({ selo, hp: HP_DO_PIRATA - perde })
    }
  })
})

describe('G1-06: o atributo do marco do acumulador soma no Devolve', () => {
  it('Raiva no nível 2 com o marco +30 de Força: devolve 70 ÷ 7 + (10 + 30) = 50 no Pirata', () => {
    const semNada = hectorSemNada()
    const novo = comAcumuladorNovo(semNada)
    const item = acumuladoresNaFicha(novo.personagem).find((candidato) => candidato.acumulador.id === novo.id)
    if (item === undefined) throw new Error('o + Acumulador não criou nada')
    const definicao = { ...item.acumulador, nome: 'Raiva', maximo: 5, inicial: 2, marcos: [{ nivel: 2, atributos: [{ atributo: { id: 'forca', nome: 'Força' }, n: 30 }] }] }
    const comRaiva = comOAcumuladorGravado(novo.personagem, item, definicao)
    const armadura = doModelo('armaduraHumana', 'Armadura Humana', comRaiva)
    const { loja, mesa } = batalha(comHabilidades(comRaiva, [armadura]))
    golpeEArmadura(loja, armadura)
    expect(recurso(mesa, 'Pirata', 'hp')).toBe(HP_DO_PIRATA - 50)
  })
})

describe('G1-10: o SP que o Anula cobrou não some quando a técnica da reação cobra o dela', () => {
  it('Hector (SP 100): a passiva paga 10 e a Armadura custa 15, então fica SP 75', () => {
    const semNada = hectorSemNada()
    const armadura = doModelo('armaduraHumana', 'Armadura Humana', semNada)
    const anula = anulaDoEditor(semNada, { paga: 10, corte: { menos: 15 } })
    const { loja, mesa } = batalha(comHabilidades(semNada, [armadura, anula]))
    golpeEArmadura(loja, armadura)
    expect(cena(loja).registro.some((linha) => linha.texto.includes('paga 10 SP'))).toBe(true)
    expect(recurso(mesa, 'Hector', 'sp')).toBe(100 - 10 - 15)
  })
})

describe('G1-03: o motivo do selo atravessado fica no registro quando a passiva anula', () => {
  it('Intangível com exceção Haki e o Punho de Haki: a linha diz o porquê do selo e a anulação da passiva', () => {
    const semNada = hectorSemNada()
    const hector = comHabilidades(semNada, [anulaDoEditor(semNada, {})])
    const selo = { id: 'selo_intangivel', tokenId: 't_hector', nome: 'Intangível', turnos: 2, total: 2, regras: { condId: 'cond_intangivel', tipo: 'positiva' as const, deNovo: 'renova' as const, anula: { exceto: { nome: 'Haki' } } } }
    const anulacao = anulacaoNoGolpe({
      turnos: { ...turnosVazios(), selos: [selo] },
      golpe: { nome: 'Punho de Haki', atacanteTokenId: 't_pirata' },
      alvoTokenId: 't_hector',
      alvo: hector,
      sistema: SISTEMA_DO_TESTE,
      reducoes: [],
      nomeDoAlvo: 'Hector',
      rolarD20: () => 10,
      dano: 40,
    })
    expect(anulacao).toMatchObject({ anulou: true, texto: 'Intangível não anulou: o golpe tem Haki; Intangível: Hector tomou 0 de dano (Corpo de Fumaça)' })
  })
})
