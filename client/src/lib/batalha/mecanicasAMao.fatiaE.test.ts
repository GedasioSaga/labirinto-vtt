import { describe, expect, it } from 'vitest'
import { golpesDeHabilidade } from '../../components/batalha/dadosDoMenu'
import { atributoComposto, maximoComposto } from '../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../personagem'
import { combateVazio, type GolpeDaBatalha, type LembreteDaMarca, type PedidoDeAcao } from './combate'
import { vantagemDaReacao } from './condicoes'
import { sistema } from './fichasDaFatiaB.testkit'
import {
  BALA_DE_PRATA,
  CHIFRES,
  CHUTE,
  DESENHAR,
  FURIA_1,
  FURIA_3,
  OLHAR,
  outroOgro,
  PARTE_1,
  PARTE_2,
  PARTE_3,
  PASSO_DE_VALSA,
  RECUPERACAO_DE_FORCAS,
  ROSA_FUNEBRE,
  ryokoCom,
  SOPRO_1,
  vincentCom,
} from './fichasDaFatiaE.testkit'
import { danoDoAtaque, lerDano } from './formula'
import { lancarGolpe, type ContextoDoGolpe } from './golpe'
import { ehPerfurante } from './leituraDaFicha'
import { danoDaTecnica } from './leituraDaTecnica'
import { acertoNaMarca, criarMarca, marcaDoToken } from './marca'
import { chavesDoDono, motivoDasRespostasDoGolpe, motivoDoTetoDeDano, perguntasDoGolpe, saidasTiradasDoDono, somaCorpoACorpo } from './mecanicasAMao'
import { ajustesDaCura, ajustesDoDano } from './reacao'
import { motivoDaReacaoComTecnica, reagirComTecnica, saidasDaTecnica, temOverloadDeReacao } from './reacaoComTecnica'
import { escudoNoComeco } from './recursosDaBatalha'
import { danoComAsReducoes, reducoesDoDano } from './reducaoDoDano'
import { mudancasDaVez, reverterTurnos } from './registro'
import { modoDaReacao } from './tiposDaHabilidade'
import { ativarForma, descerUmaParte, formasNoMenu, motivoDaOrdemDasPartes, subidaDeParte } from './transformacao'
import { novaCarta, passarVez, type TurnosDaCena } from './turnos'

/**
 * Conserto das fichas F2, fatia E (Ryoko D. Violet e Vincent G.): as regras
 * com os cartões, atributos e raça REAIS (rpg.json de 08/11). Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */

/** Um golpe de `dano` esperando a reação de `tokenId`. */
function golpeEm(tokenId: string, personagemId: string, dano = 100, extra: Partial<GolpeDaBatalha> = {}): GolpeDaBatalha {
  return { id: 'g1', linhaId: 'l1', cartaId: 'c-npc', rodada: 1, atacanteTokenId: 't-npc', atacantePersonagemId: null, autor: { tipo: 'mestre' }, nome: 'Soco', surpresa: false, overload: false, perfurante: false, alvos: [{ tokenId, personagemId, dano, podeReagir: true }], ...extra }
}

const reacaoCom = (cartaoId: string, saida: 'esquiva' | 'contra', tokenId: string) => ({ tipo: 'tecnica' as const, golpeId: 'g1', tokenId, cartaoId, saida, custo: null })

/** `quem` na vez dele, contra `alvo`. */
function contexto(quem: Personagem, alvo: Personagem): ContextoDoGolpe {
  const carta = novaCarta('tok_quem', quem.id, quem.nome)
  const outra = novaCarta('tok_alvo', alvo.id, alvo.nome)
  const turnos: TurnosDaCena = { cartas: [carta, outra], vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
  return { turnos, carta, personagem: quem, sistema, regras: null, autor: { tipo: 'mestre' }, personagens: [quem, alvo], personagemDoToken: (tokenId) => (tokenId === 'tok_quem' ? quem.id : tokenId === 'tok_alvo' ? alvo.id : undefined) }
}

const IDS = { golpe: 'golpe_1', linha: 'linha_1' }
const atacar = (dano: number, extra: Partial<Extract<PedidoDeAcao, { tipo: 'atacar' }>> = {}): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId: 'tok_alvo', dano }], surpresa: false, perfurante: false, ...extra })
const tecnica = (cartaoId: string, dano: number): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: 'tok_alvo', dano }], surpresa: false, perfurante: false, custo: null, acao: null })

describe('Ryoko: Fúria do Dragão e as Partes em ordem', () => {
  it('a Fúria da Parte 1 liga a Parte 2; na Parte 3 não sobe (o menu apaga com o motivo); fora da forma, recusa', () => {
    expect(subidaDeParte(ryokoCom([PARTE_1.id]), sistema, FURIA_1.id)).toMatchObject({ para: { id: PARTE_2.id } })
    expect(subidaDeParte(ryokoCom([PARTE_3.id]), sistema, FURIA_3.id)).toEqual({ motivo: 'Já está na última Parte' })
    expect(subidaDeParte(ryokoCom(), sistema, FURIA_1.id)).toEqual({ motivo: 'A forma desta técnica não está ligada' })
    const furia = golpesDeHabilidade(ryokoCom([PARTE_3.id]), sistema, undefined, null, null).find((golpe) => golpe.cartaoId === FURIA_3.id)
    expect(furia).toMatchObject({ motivo: 'Já está na última Parte', semAlvo: true })
  })

  it('da base só liga a Parte 1; com a 1, só a 2; com a 3 ligada, nenhuma (a tira Transformação diz o mesmo)', () => {
    expect(motivoDaOrdemDasPartes(ryokoCom(), sistema, PARTE_1)).toBeNull()
    expect(motivoDaOrdemDasPartes(ryokoCom(), sistema, PARTE_3)).toBe('Uma Parte por vez: a próxima é Forma Hibrida(Parte 1)')
    expect(motivoDaOrdemDasPartes(ryokoCom([PARTE_1.id]), sistema, PARTE_2)).toBeNull()
    expect(motivoDaOrdemDasPartes(ryokoCom([PARTE_3.id]), sistema, PARTE_2)).toBe('Já está na última Parte')
    expect(formasNoMenu(ryokoCom(), sistema, null).find((forma) => forma.cartao.id === PARTE_2.id)?.motivo).toBe('Uma Parte por vez: a próxima é Forma Hibrida(Parte 1)')
  })
})

describe('Ryoko: sem SP desce uma Parte; a forma não dá HP', () => {
  it('Parte 2 sem SP volta para a Parte 1; a Parte 3 sobe a Força a 100 e o HP fica 700/700', () => {
    const desceu = descerUmaParte(ryokoCom([PARTE_2.id]), sistema, PARTE_2.id, 'Mestre', 0)
    expect(desceu?.anterior?.id).toBe(PARTE_1.id)
    expect(desceu?.personagem.cartoesAtivos).toEqual([PARTE_1.id])
    const naParte3 = ativarForma(ryokoCom([PARTE_2.id]), sistema, PARTE_3.id, 'Mestre', 0)?.personagem
    if (naParte3 === undefined) throw new Error('a Parte 3 não ligou')
    expect(atributoComposto(naParte3, 'forca').total).toBe(100)
    expect([maximoComposto(naParte3, 'hp').total, numeroDaFicha(naParte3.recursos, 'hp')]).toEqual([700, 700])
  })
})

describe('Ogro: Superioridade (−30% em tudo) e Orgulho (outros ogros só Defendem)', () => {
  it('na Ryoko, 100 que chega vira 70 (golpe e "Me dar dano"); no Vincent, nada', () => {
    const reducoes = reducoesDoDano(ryokoCom(), sistema)
    expect(reducoes).toEqual([{ nome: 'Superioridade do Ogro', porcento: 30 }])
    expect(danoComAsReducoes(100, reducoes)).toBe(70)
    expect(reducoesDoDano(vincentCom(), sistema)).toEqual([])
  })

  it('outro ogro só Defende (sem Esquiva nem Contra-ataque) e também tem os −30%; a Ryoko esquiva normal', () => {
    expect(saidasTiradasDoDono(chavesDoDono(outroOgro()))).toEqual(['esquiva', 'contra'])
    expect(reducoesDoDano(outroOgro(), sistema)).toEqual([{ nome: 'Superioridade do Ogro', porcento: 30 }])
    expect(saidasTiradasDoDono(chavesDoDono(ryokoCom()))).toEqual([])
  })
})

describe('Ryoko: Recuperação de forças (come fogo ou explosão)', () => {
  it('100 de fogo: anula e cura 20 (20% do que chegava, antes do −30%), gasta 1 dos 2 usos; 500 → 520 de HP', () => {
    const ryoko = ryokoCom([], { hp: 500, sp: 240, escudo: 12 })
    const feita = reagirComTecnica(golpeEm('t-ryoko', ryoko.id), 't-ryoko', reacaoCom(RECUPERACAO_DE_FORCAS.id, 'esquiva', 't-ryoko'), ryoko, sistema, combateVazio(), null)
    expect(feita?.alvo).toMatchObject({ saida: 'esquiva', danoFinal: 0 })
    expect(feita?.cura).toBe(20)
    expect(feita?.combate.usos[RECUPERACAO_DE_FORCAS.id]).toBe(1)
    expect(ajustesDaCura(ryoko, sistema, feita?.cura ?? 0)).toEqual([{ parte: 'recurso', chave: 'hp', valor: 520 }])
  })

  it('vale contra Overload (o golpe espera a reação dela; só ela defende); o Passo de Valsa do Vincent não', () => {
    const ryoko = ryokoCom()
    expect(temOverloadDeReacao(ryoko, sistema, undefined)).toBe(true)
    const overload = golpeEm('t-ryoko', ryoko.id, 210, { overload: true })
    expect(motivoDaReacaoComTecnica({ personagem: ryoko, sistema, combate: undefined }, overload.alvos[0] ?? { podeReagir: false }, reacaoCom(RECUPERACAO_DE_FORCAS.id, 'esquiva', 't-ryoko'), true)).toBeNull()
    expect(temOverloadDeReacao(vincentCom(), sistema, undefined)).toBe(false)
  })
})

describe('Ryoko: Golpe de Chifres, Chute e o +20 de Ogro', () => {
  it('Golpe de Chifres: Completa, 35 SP, pula o Escudo e o alvo ainda reage; 60 + 50 + 20 de Ogro = 130', () => {
    expect(danoDaTecnica(CHIFRES, { personagem: ryokoCom(), sistema, arma: null })).toMatchObject({ tipo: 'valor', valor: 110 })
    const lancado = lancarGolpe(contexto(ryokoCom(), vincentCom()), tecnica(CHIFRES.id, 110), IDS)
    expect(lancado.golpe?.perfurante).toBe(true)
    expect(lancado.golpe?.alvos[0]).toMatchObject({ dano: 130, podeReagir: true })
    expect(lancado.acao).toBe('completa')
    expect(lancado.custo).toEqual([{ parte: 'recurso', chave: 'sp', valor: 205 }])
  })

  it('Atacar sem arma 60 + 20 = 80; Chute 105 (o +20 escrito já é o de Ogro, +25 no mesmo golpe); o Sopro não soma', () => {
    const ctx = contexto(ryokoCom(), vincentCom())
    expect(lancarGolpe(ctx, atacar(60), IDS).golpe?.alvos[0]?.dano).toBe(80)
    expect(danoDaTecnica(CHUTE, { personagem: ryokoCom(), sistema, arma: null })).toMatchObject({ tipo: 'valor', valor: 105 })
    expect(lancarGolpe(ctx, tecnica(CHUTE.id, 105), IDS).golpe?.alvos[0]?.dano).toBe(105)
    expect(somaCorpoACorpo(chavesDoDono(ryokoCom()), SOPRO_1.id, false)).toBe(0)
  })
})

describe('Ryoko: vantagem corpo a corpo (o app pergunta a ela)', () => {
  it('no Atacar e no Golpe de Chifres pergunta, no Sopro não; "sim" faz o alvo rolar a reação com desvantagem', () => {
    const chaves = chavesDoDono(ryokoCom())
    expect(perguntasDoGolpe(null, chaves).map((pergunta) => pergunta.chave)).toEqual(['vantagemDeOgro'])
    expect(perguntasDoGolpe(CHIFRES.id, chaves).map((pergunta) => pergunta.chave)).toEqual(['vantagemDeOgro'])
    expect(perguntasDoGolpe(SOPRO_1.id, chaves)).toEqual([])
    expect(motivoDasRespostasDoGolpe(SOPRO_1.id, chaves, { vantagemDeOgro: 'sim' })).toBe('Resposta que a técnica não pergunta')
    const golpe = lancarGolpe(contexto(ryokoCom(), vincentCom()), atacar(60, { respostas: { vantagemDeOgro: 'sim' } }), IDS).golpe
    expect(golpe?.reacaoComDesvantagem).toBe(true)
    expect(vantagemDaReacao(undefined, [], golpe ?? undefined)).toBe('desvantagem')
    expect(lancarGolpe(contexto(ryokoCom(), vincentCom()), atacar(60, { respostas: { vantagemDeOgro: 'nao' } }), IDS).golpe?.reacaoComDesvantagem).toBeUndefined()
  })
})

describe('Vincent: Passo de Valsa e Desenhar o alvo', () => {
  it('Passo de Valsa vale contra tiro, mas só como Esquiva (Contra-ataque recusado)', () => {
    const vincent = vincentCom()
    expect(saidasDaTecnica(PASSO_DE_VALSA.id, modoDaReacao(PASSO_DE_VALSA)).saidas).toEqual(['esquiva'])
    const tiro = golpeEm('t-vincent', vincent.id, 55, { armaQueAtira: true })
    const alvo = tiro.alvos[0] ?? { podeReagir: false }
    expect(motivoDaReacaoComTecnica({ personagem: vincent, sistema, combate: undefined }, alvo, reacaoCom(PASSO_DE_VALSA.id, 'esquiva', 't-vincent'))).toBeNull()
    expect(motivoDaReacaoComTecnica({ personagem: vincent, sistema, combate: undefined }, alvo, reacaoCom(PASSO_DE_VALSA.id, 'contra', 't-vincent'))).toBe('Saída que a técnica não dá')
  })

  it('Desenhar o alvo: 1 alvo só; perfurante direto no HP (Escudo 12 fica, HP 700 → 628)', () => {
    expect(motivoDoTetoDeDano(DESENHAR.id, 'Desenhar o alvo', ['p-a', 'p-b'], new Set())).toBe('Desenhar o alvo dá dano em um inimigo só')
    expect(motivoDoTetoDeDano(DESENHAR.id, 'Desenhar o alvo', ['p-a'], new Set())).toBeNull()
    expect(ehPerfurante(DESENHAR)).toBe(true)
    expect(ajustesDoDano(ryokoCom(), sistema, 72, true)).toEqual([{ parte: 'recurso', chave: 'hp', valor: 628 }])
  })
})

describe('Vincent: Bala de Prata, a marca e o Escudo', () => {
  it('Bala de Prata: 35 + 20 + 17 = 72 no Atacar e no Desenhar; o tiro deixa "Ferido por prata" (só lembrete)', () => {
    const vincent = vincentCom()
    const bala = { nome: BALA_DE_PRATA.nome, dano: BALA_DE_PRATA.campos.dano ?? '' }
    expect(danoDoAtaque({ personagem: vincent, sistema, arma: ROSA_FUNEBRE, vidaDoAlvo: null }, bala)).toMatchObject({ tipo: 'valor', valor: 72 })
    expect(lerDano(DESENHAR.campos.dano ?? '', { personagem: vincent, sistema, arma: ROSA_FUNEBRE, vidaDoAlvo: null, bala })).toMatchObject({ tipo: 'valor', valor: 72 })
    const golpe = lancarGolpe(contexto(vincent, ryokoCom()), atacar(72, { armaId: ROSA_FUNEBRE.id, balaId: BALA_DE_PRATA.id }), IDS).golpe
    expect(golpe?.selo).toEqual({ nome: 'Ferido por prata', turnos: null, natureza: 'debuff' })
  })

  it('o tiro que gasta a marca dobra (55 → 110) e já marca de novo; o marcado reage com desvantagem', () => {
    const vincent = vincentCom()
    const turnos: TurnosDaCena = { cartas: [novaCarta('t-vincent', vincent.id, 'Vincent'), novaCarta('t-alvo', 'p-alvo', 'Alvo')], vez: null, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
    const marca = criarMarca(turnos, 't-alvo', { selo: 's1', linha: 'l0' }, DESENHAR)
    const comMarca: TurnosDaCena = { ...turnos, selos: [marca] }
    const golpe = golpeEm('t-alvo', 'p-alvo', 55, { atacanteTokenId: 't-vincent', atacantePersonagemId: vincent.id, armaQueAtira: true })
    const acertou = { ...golpe.alvos[0], tokenId: 't-alvo', personagemId: 'p-alvo', dano: 55, podeReagir: true, saida: 'cheio' as const, danoFinal: 55 }
    const desenhar = acertoNaMarca(comMarca, golpe, acertou, { linhaId: 'l1', novoId: () => 'nova', passiva: OLHAR, tecnicaQueMarca: DESENHAR })
    expect(desenhar.alvo.danoFinal).toBe(110)
    expect(marcaDoToken(desenhar.turnos.selos, 't-alvo')?.id).toBe('nova')
    const tiro = acertoNaMarca(comMarca, golpe, acertou, { linhaId: 'l1', novoId: () => 'lm', passiva: OLHAR, tecnicaQueMarca: null })
    expect([tiro.alvo.danoFinal, tiro.turnos.lembretesDaMarca?.map((lembrete) => lembrete.alvoTokenId)]).toEqual([110, ['t-alvo']])
    expect(vantagemDaReacao(undefined, [marca])).toBe('desvantagem')
  })

  it('o lembrete "Marcar o alvo?" vence no fim da vez do Vincent (não na de outro) e o Desfazer da vez o devolve', () => {
    const vincent = vincentCom()
    const doVincent = novaCarta('t-vincent', vincent.id, 'Vincent')
    const doAlvo = novaCarta('t-alvo', 'p-alvo', 'Alvo')
    const lembrete: LembreteDaMarca = { id: 'lm1', linhaId: 'l1', golpeId: 'g1', cartaoId: OLHAR.id, tokenId: 't-vincent', personagemId: vincent.id, alvoTokenId: 't-alvo', rodada: 1 }
    const turnos: TurnosDaCena = { cartas: [doVincent, doAlvo], vez: doVincent.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {}, lembretesDaMarca: [lembrete] }
    const passada = passarVez(turnos, new Set())
    if (passada === null) throw new Error('a vez não passou')
    expect(passada.turnos.lembretesDaMarca).toEqual([])
    const volta = reverterTurnos(passada.turnos, { tipo: 'vez', antes: { vez: turnos.vez, rodada: 1, removidas: [], gastos: {} }, mudou: mudancasDaVez(turnos, passada.turnos) })
    expect(volta.lembretesDaMarca).toEqual([lembrete])
    expect(passarVez({ ...turnos, vez: doAlvo.id }, new Set())?.turnos.lembretesDaMarca).toEqual([lembrete])
  })

  it('Escudo 20 volta cheio a cada batalha: grava 20 como máximo; gasto (5), volta a 20', () => {
    expect(escudoNoComeco(vincentCom(), sistema)).toEqual({ escudoId: 'escudo', cheio: 20, ajuste: null })
    const gasto = { ...vincentCom({ hp: 600, sp: 60, escudo: 5 }), maximos: { hp: 600, sp: 60, escudo: 20 } }
    expect(escudoNoComeco(gasto, sistema)?.ajuste).toEqual({ parte: 'recurso', chave: 'escudo', valor: 20 })
  })
})
