// @vitest-environment node
/**
 * ACUMULADOR DA 0.6.10 (pedidos do dono de 28/11/2026): os marcos "Ao chegar a N" que liberam uma técnica
 * com "Ao usar: gasta tudo" e o "Vale em" do dano. O acumulador nasce como o "+ Acumulador" da ficha o
 * cria e grava (`comAcumuladorNovo` + `comOAcumuladorGravado`), a soma "usar a técnica X" e a liberação no
 * marco pelas funções que a peça do editor chama (`comSomaDaTecnica`, `comATecnicaNoNivel`,
 * `comOGastoNoNivel`), e as técnicas pelo Salvar do editor (`cartaoComAMecanica` + `cartaoComTextoGerado`).
 * Tudo roda na store do app (`criarBatalhaStore`) sobre a mesa em memória do treino; o nível só muda por
 * `agir`.
 */
import { describe, expect, it } from 'vitest'
import { acumuladoresNaFicha, comAcumuladorNovo, comOAcumuladorGravado, comSomaDaTecnica } from '../components/batalha/acumulador/acumuladoresDaFicha'
import { cartaoComAMecanica } from '../components/batalha/editor/gravarNoCartao'
import { comATecnicaNoNivel, comOGastoNoNivel, referenciaDoCartao } from '../components/batalha/editor/pecas/ligacoes'
import { acumuladoresDoPersonagem, nivelDoAcumulador } from '../lib/batalha/acumuladorNaBatalha'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { PREFIXO_DA_ARMA_DA_MOCHILA } from '../lib/batalha/leituraDaFicha'
import type { MecanicaV1 } from '../lib/batalha/mecanica/modelo'
import { mecanicaDoModelo } from '../lib/batalha/mecanica/modelos'
import { cartaoComTextoGerado } from '../lib/batalha/mecanica/textoGerado'
import type { VezEsperada } from '../lib/batalha/ponte'
import type { AcumuladorDaFicha, Referencia } from '../lib/batalha/requisitos/modelo'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { novoCartao, numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import type { CarriedItem } from '../types/map'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_acumulador'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
/** O jogador do herói: no golpe dele o host refaz a conta pelas peças (o número da tela não vale; o do mestre vale). */
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const HEROI = 'Vagn'
const HP_DO_PIRATA = 2000
/** O dano fixo das técnicas de teste: a régua de cada golpe. */
const DANO_DA_TECNICA = 40
const ATRIBUTOS = { forca: 10, agilidade: 40, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const pirata = (): Personagem => ficha('Pirata', { ...ATRIBUTOS, agilidade: 10 }, { hp: HP_DO_PIRATA, sp: 50, escudo: 0 }, {})

/** Uma técnica de golpe como o Salvar do editor a grava (o modelo "golpe", com o dano fixo e a ação pedida). */
function tecnicaDoEditor(nome: string, acao: MecanicaV1['acao'], heroi: Personagem): CartaoDaFicha {
  const golpe = mecanicaDoModelo('golpe', SISTEMA_DO_TESTE)
  if (golpe.dano === undefined) throw new Error('o modelo golpe veio sem dano')
  const mecanica: MecanicaV1 = { ...golpe, acao, dano: { ...golpe.dano, base: { formula: String(DANO_DA_TECNICA) } } }
  const base = novoCartao(nome)
  const montado = cartaoComAMecanica(base, mecanica, 'mestre', { personagem: heroi, sistema: SISTEMA_DO_TESTE })
  if (montado === null) throw new Error(`o editor recusou ${nome}`)
  return cartaoComTextoGerado(base, montado, SISTEMA_DO_TESTE, 'tecnica')
}

/** O "+ Acumulador" da ficha e a definição gravada por cima (com `mudar`); devolve a ficha e a referência que a peça usa. */
function comAcumulador(heroi: Personagem, mudar: (partida: AcumuladorDaFicha) => AcumuladorDaFicha): { heroi: Personagem; ref: Referencia } {
  const novo = comAcumuladorNovo(heroi)
  const item = acumuladoresNaFicha(novo.personagem).find((candidato) => candidato.acumulador.id === novo.id)
  if (item === undefined) throw new Error('o + Acumulador não criou nada')
  const definicao = mudar(item.acumulador)
  const gravado = comOAcumuladorGravado(novo.personagem, item, definicao)
  // O que a batalha lê da ficha é o que foi gravado (nada torto ficou de fora).
  expect(acumuladoresDoPersonagem(gravado).find((lido) => lido.id === novo.id)).toMatchObject({ nome: definicao.nome, maximo: definicao.maximo })
  return { heroi: gravado, ref: { id: definicao.id, nome: definicao.nome } }
}

function trocarTecnica(heroi: Personagem, cartao: CartaoDaFicha): Personagem {
  return { ...heroi, abas: { ...heroi.abas, habilidades: (heroi.abas.habilidades ?? []).map((outro) => (outro.id === cartao.id ? cartao : outro)) } }
}

function batalha(heroi: Personagem): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, { ficha: pirata(), lado: 'b' }]))
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

function carta(loja: LojaDaBatalha, nome: string): { tokenId: string; personagemId: string } {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome === nome)
  if (achada === undefined || achada.personagemId === null) throw new Error(`sem a carta de ${nome}`)
  return { tokenId: achada.tokenId, personagemId: achada.personagemId }
}

const nivelDe = (loja: LojaDaBatalha, ref: Referencia): number => nivelDoAcumulador(cena(loja).turnos.combate?.[carta(loja, HEROI).personagemId], ref.id ?? '')
const hpDoPirata = (mesa: MesaEmMemoria): number => numeroDaFicha(mesa.personagens().find((personagem) => personagem.nome === 'Pirata')?.recursos ?? {}, 'hp')

const usar = (loja: LojaDaBatalha, cartao: CartaoDaFicha, armaId: string | null = null): PedidoDeAcao => ({
  tipo: 'habilidade',
  cartaoId: cartao.id,
  armaId,
  alvos: [{ tokenId: carta(loja, 'Pirata').tokenId, dano: DANO_DA_TECNICA }],
  surpresa: false,
  perfurante: false,
  custo: null,
  acao: null,
})

/** O pirata não reage ao golpe que espera: o dano entra na ficha dele. */
function piratanaoReage(loja: LojaDaBatalha): void {
  const golpe = cena(loja).turnos.golpes?.[0]
  if (golpe === undefined) throw new Error('o golpe não esperou a reação do pirata')
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId: carta(loja, 'Pirata').tokenId })).toBe(true)
}

describe('marco nível 2 que libera a Descarga com "gasta tudo"', () => {
  /** Carga até 5, começa em 1; Carregar (Livre) soma 2 ao usar; a Descarga (Simples) sai no marco 2 e gasta tudo. */
  function heroiComCarga(): { heroi: Personagem; ref: Referencia; carregar: CartaoDaFicha; descarga: CartaoDaFicha } {
    const semNada = ficha(HEROI, ATRIBUTOS, { hp: 800, sp: 200, escudo: 0 }, {})
    const carregar = tecnicaDoEditor('Carregar', 'livre', semNada)
    const descargaCrua = tecnicaDoEditor('Descarga', 'simples', semNada)
    const comTecnicas: Personagem = { ...semNada, abas: { ...semNada.abas, habilidades: [carregar, descargaCrua] } }
    const { heroi, ref } = comAcumulador(comTecnicas, (partida) => {
      const definicao: AcumuladorDaFicha = { ...partida, nome: 'Carga', maximo: 5, inicial: 1, marcos: [{ nivel: 2 }] }
      const comSoma = comSomaDaTecnica(definicao, referenciaDoCartao(carregar), 2)
      if (comSoma === null) throw new Error('sem lugar para a soma do Carregar')
      return comSoma
    })
    const descarga = comOGastoNoNivel(comATecnicaNoNivel(descargaCrua, ref, 2), ref, 'tudo')
    expect(descarga).not.toBe(descargaCrua)
    return { heroi: trocarTecnica(heroi, descarga), ref, carregar, descarga }
  }

  it('com Carga 1 a Descarga fica bloqueada com o motivo; Carregar sobe a 3; a Descarga sai e o medidor zera (gasta tudo, não só os 2 do marco)', () => {
    const { heroi, ref, carregar, descarga } = heroiComCarga()
    const { loja } = batalha(heroi)
    const vez = naVezDe(loja, HEROI)
    expect(nivelDe(loja, ref)).toBe(1)

    const motivo = loja.getState().motivoDoAgir(CENA, MESTRE, vez, usar(loja, descarga))
    expect(motivo).toContain('Falta: Carga 2, tem 1')
    expect(loja.getState().agir(CENA, MESTRE, vez, usar(loja, descarga))).toBe(false)
    expect(nivelDe(loja, ref)).toBe(1)

    expect(loja.getState().agir(CENA, MESTRE, vez, usar(loja, carregar))).toBe(true)
    piratanaoReage(loja)
    expect(nivelDe(loja, ref)).toBe(3)

    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, usar(loja, descarga))).toBeNull()
    expect(loja.getState().agir(CENA, MESTRE, vez, usar(loja, descarga))).toBe(true)
    expect(nivelDe(loja, ref)).toBe(0)
  })
})

describe('"Vale em: só tiros" com +5 de dano por nível', () => {
  const ATAQUE = { dano: 20, soma: '', acao: 'Ação Simples', alvos: 1 }
  const PISTOLA: CarriedItem = { id: 'vaga_pistola', nome: 'Pistola', tipo: 'fogo', equipado: true, regra: { ataque: ATAQUE } }
  const ESPADA: CarriedItem = { id: 'vaga_espada', nome: 'Espada', tipo: 'corpo', equipado: true, regra: { ataque: ATAQUE } }

  /** Mira até 3, começa a batalha em 2, +5 de dano por nível, só nos tiros; o Golpe é a técnica que bate. */
  function heroiComMira(): { heroi: Personagem; golpe: CartaoDaFicha; ref: Referencia } {
    const semNada: Personagem = { ...ficha(HEROI, ATRIBUTOS, { hp: 800, sp: 200, escudo: 0 }, {}), mochila: [PISTOLA, ESPADA] }
    const golpe = tecnicaDoEditor('Golpe', 'simples', semNada)
    const { heroi, ref } = comAcumulador({ ...semNada, abas: { ...semNada.abas, habilidades: [golpe] } }, (partida) => ({ ...partida, nome: 'Mira', maximo: 3, inicial: 2, ganho: { ganho: 'dano', cada: 5 }, valeEm: { em: 'tiros' } }))
    return { heroi, golpe, ref }
  }

  /** Quanto o Golpe com a arma `vagaId` (ou sem arma) tira do pirata, com a Mira 2. */
  function danoDoGolpe(vagaId: string | null): number {
    const { heroi, golpe, ref } = heroiComMira()
    const { loja, mesa } = batalha(heroi)
    const vez = naVezDe(loja, HEROI)
    expect(nivelDe(loja, ref)).toBe(2)
    // O pedido leva o número da tela sem a Mira: quem põe (ou não) os +10 é o host, pelo "Vale em".
    expect(loja.getState().agir(CENA, JOGADOR, vez, usar(loja, golpe, vagaId === null ? null : `${PREFIXO_DA_ARMA_DA_MOCHILA}${vagaId}`))).toBe(true)
    piratanaoReage(loja)
    return HP_DO_PIRATA - hpDoPirata(mesa)
  }

  it('com a Pistola (De fogo) soma os +10 da Mira 2; com a Espada (corpo a corpo) e sem arma, não soma', () => {
    expect(danoDoGolpe(PISTOLA.id)).toBe(DANO_DA_TECNICA + 10)
    expect(danoDoGolpe(ESPADA.id)).toBe(DANO_DA_TECNICA)
    expect(danoDoGolpe(null)).toBe(DANO_DA_TECNICA)
  })
})
