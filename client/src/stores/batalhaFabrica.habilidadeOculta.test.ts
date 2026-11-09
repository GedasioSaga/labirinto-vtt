// @vitest-environment node
/**
 * HABILIDADE OCULTA na store da batalha (fatia C7, revisão): a passiva e a
 * técnica oculta não mostram o nome em selo nem em linha; "revela ao usar"
 * revela a ficha; o jogador não pede o cartão oculto e o recorte dele não
 * leva o id. Na store do app (`criarBatalhaStore`) sobre a mesa em memória do
 * treino, com fichas inventadas. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDePassiva } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { vistaParaJogador } from '../lib/batalha/vistaDoJogador'
import { cartaoPorId, NOME_DO_OCULTO, ocultarCartao } from '../lib/habilidadeOculta'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_oculta'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const SEGREDO = 'Fortaleza de Ferro'
const GARRA = 'Garra Lunar'

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro. A passiva que o mestre esconde, uma passiva visível e a técnica que o mestre esconde. */
const LUTADOR = ficha({
  id: 'pers_lutador',
  tipo: 'jogador',
  nome: 'Lutador',
  recursos: { hp: 300, sp: 100 },
  maximos: { hp: 300, sp: 120 },
  atributos: { forca: 51, agilidade: 70 },
  abas: {
    habilidades: [
      { id: 'pas_fortaleza', nome: SEGREDO, campos: { acao: 'Passiva', custo: '-', tempo: '-' } },
      { id: 'pas_visivel', nome: 'Postura Firme', campos: { acao: 'Passiva', custo: '-', tempo: '-' } },
      { id: 'tec_garra', nome: GARRA, campos: { acao: 'Simples', custo: '-', tempo: '-', dano: '10' } },
    ],
  },
})

const ALVO = ficha({ id: 'pers_alvo', tipo: 'npc', nome: 'Alvo', recursos: { hp: 300, sp: 50 }, maximos: { hp: 300, sp: 60 }, atributos: { forca: 30, agilidade: 40 } })

/** A batalha ligada com o cartão `cartaoId` do Lutador escondido pela mesa (a cópia do treino tira os ocultos, então esconde depois). */
function batalha(ocultos: readonly { cartaoId: string; revelaAoUsar: boolean }[]): { loja: LojaDaBatalha; mesa: MesaEmMemoria; lutadorId: string; lutador: string; alvo: string } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: LUTADOR, lado: 'a' }, { ficha: ALVO, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  const cartas = cena(loja).turnos.cartas
  const doLutador = cartas.find((carta) => carta.nome === 'Lutador')
  const doAlvo = cartas.find((carta) => carta.nome === 'Alvo')
  if (doLutador === undefined || doLutador.personagemId === null || doAlvo === undefined) throw new Error('a batalha não ligou com os dois')
  const lutadorId = doLutador.personagemId
  for (const { cartaoId, revelaAoUsar } of ocultos) expect(mesa.ajustarPersonagem(lutadorId, (atual) => ocultarCartao(atual, cartaoId, revelaAoUsar))).toBe(true)
  return { loja, mesa, lutadorId, lutador: doLutador.tokenId, alvo: doAlvo.tokenId }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function vez(loja: LojaDaBatalha): VezEsperada {
  const { turnos } = cena(loja)
  if (turnos.vez === null) throw new Error('sem vez')
  return { cartaId: turnos.vez, rodada: turnos.rodada }
}

function fichaNaMesa(mesa: MesaEmMemoria, id: string): Personagem {
  const achada = mesa.personagens().find((candidato) => candidato.id === id)
  if (achada === undefined) throw new Error(`sem ${id}`)
  return achada
}

const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''
/** O Ativar com o selo que a tela sugere (o nome da passiva) e +10 de Força. */
const ativar = (tokenId: string, cartaoId: string, nome: string): PedidoDePassiva => ({ tipo: 'passiva', tokenId, cartaoId, ligar: true, custo: null, selo: { nome, turnos: null, mods: [{ alvo: 'forca', delta: 10 }] } })

describe('passiva oculta na batalha', () => {
  it('o mestre ativa: o selo no token e a linha dizem "???", sem o nome nem os números; com "revela ao usar", o nome e a ficha revelada', () => {
    const { loja, mesa, lutadorId, lutador } = batalha([{ cartaoId: 'pas_fortaleza', revelaAoUsar: false }])
    expect(loja.getState().passiva(CENA, MESTRE, ativar(lutador, 'pas_fortaleza', SEGREDO))).toBe(true)
    const selo = (cena(loja).turnos.selos ?? []).find((candidato) => candidato.cartaoId === 'pas_fortaleza')
    expect(selo?.nome).toBe(NOME_DO_OCULTO)
    expect(selo?.origem).toBe(NOME_DO_OCULTO)
    expect(ultimaLinha(loja)).toBe(`Lutador ativou ${NOME_DO_OCULTO}`)
    expect(cartaoPorId(fichaNaMesa(mesa, lutadorId), 'pas_fortaleza')?.oculta).toBe(true)

    const revela = batalha([{ cartaoId: 'pas_fortaleza', revelaAoUsar: true }])
    expect(revela.loja.getState().passiva(CENA, MESTRE, ativar(revela.lutador, 'pas_fortaleza', SEGREDO))).toBe(true)
    expect(ultimaLinha(revela.loja)).toContain(SEGREDO)
    expect(cartaoPorId(fichaNaMesa(revela.mesa, revela.lutadorId), 'pas_fortaleza')?.oculta).toBeUndefined()
  })
})

describe('técnica oculta na batalha', () => {
  it('o selo com o nome da técnica oculta vai ao golpe como "???"; o selo pronto (Atordoado) fica', () => {
    const golpe = (alvo: string, selo: { nome: string; turnos: number }): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId: 'tec_garra', armaId: null, alvos: [{ tokenId: alvo, dano: 10 }], surpresa: false, perfurante: false, custo: null, acao: null, selo })
    const { loja, alvo } = batalha([{ cartaoId: 'tec_garra', revelaAoUsar: false }])
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), golpe(alvo, { nome: GARRA, turnos: 2 }))).toBe(true)
    const lancado = cena(loja).turnos.golpes?.[0]
    expect(lancado?.nome).toBe(NOME_DO_OCULTO)
    expect(lancado?.selo?.nome).toBe(NOME_DO_OCULTO)
    expect(JSON.stringify(cena(loja).turnos.golpes)).not.toContain(GARRA)

    const outra = batalha([{ cartaoId: 'tec_garra', revelaAoUsar: false }])
    expect(outra.loja.getState().agir(CENA, MESTRE, vez(outra.loja), golpe(outra.alvo, { nome: 'Atordoado', turnos: 1 }))).toBe(true)
    expect(cena(outra.loja).turnos.golpes?.[0]?.selo?.nome).toBe('Atordoado')
  })
})

describe('o jogador e o cartão oculto', () => {
  it('o pedido do jogador pela passiva oculta é recusado; o recorte dele não leva o id da oculta ligada, e a visível segue', () => {
    const { loja, mesa, lutadorId, lutador } = batalha([{ cartaoId: 'pas_fortaleza', revelaAoUsar: false }])
    expect(loja.getState().passiva(CENA, JOGADOR, ativar(lutador, 'pas_fortaleza', SEGREDO))).toBe(false)
    expect(loja.getState().passiva(CENA, MESTRE, ativar(lutador, 'pas_fortaleza', SEGREDO))).toBe(true)
    expect(loja.getState().passiva(CENA, MESTRE, ativar(lutador, 'pas_visivel', 'Postura Firme'))).toBe(true)
    const nomes = new Map(mesa.tokens().map((token): [string, string] => [token.id, token.name]))
    const recorte = vistaParaJogador(cena(loja), {
      playerId: 'jogador_1',
      meusTokens: new Set([lutador]),
      tokensNoRecorte: nomes,
      meusPersonagens: new Set([lutadorId]),
      aliados: new Set(),
      equipes: undefined,
      personagens: mesa.personagens(),
      sistema: mesa.sistema(),
    })
    const meu = recorte.meus?.find((candidato) => candidato.personagemId === lutadorId)
    expect(meu?.passivasAtivas).toEqual(['pas_visivel'])
    expect(JSON.stringify(recorte)).not.toContain('pas_fortaleza')
    expect(JSON.stringify(recorte)).not.toContain(SEGREDO)
  })
})
