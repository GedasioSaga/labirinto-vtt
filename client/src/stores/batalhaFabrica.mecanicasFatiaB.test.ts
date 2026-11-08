// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia B (Jimboy Segundo e May D. Ark; a Saga é só
 * regra do sistema, já provada na fatia A): as mecânicas à mão na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com os cartões e os
 * atributos REAIS (`fichasDaFatiaB.testkit.ts`). Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { Casa, Direcao } from '../lib/batalha/area'
import type { PedidoDeAcao, PedidoDeAjusteNaBatalha } from '../lib/batalha/combate'
import { APLAUSO, CORTA_CENOURA, ficha, FULL, GRANDE_CHIFRE, HIBRIDO, jimboy, may, RAPID_DASH, SAI_DAI_RIN } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import type { RespostasDoPedido } from '../lib/batalha/perguntaNaHora'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const NOME_DO_JIMBOY = 'Jimboy Segundo'
const NOME_DA_MAY = 'May D. Ark'

interface Batalha {
  loja: LojaDaBatalha
  mesa: MesaEmMemoria
  /** Os d20 do host, na ordem (acabou a fila, sai 10). Enche depois de ligar. */
  fila: number[]
}

function batalha(fichaDoJimboy: Personagem = jimboy): Batalha {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: fichaDoJimboy, lado: 'a' }, { ficha: may, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => fila.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa, fila }
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

/** Passa a vez até chegar a de `nome`. */
function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez(loja)
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function pessoa(mesa: MesaEmMemoria, nome: string): Personagem {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return achada
}

const recurso = (mesa: MesaEmMemoria, nome: string, chave: string): number => numeroDaFicha(pessoa(mesa, nome).recursos, chave)
const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)
const selosDe = (loja: LojaDaBatalha, tokenId: string): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => selo.nome)
const golpesEsperando = (loja: LojaDaBatalha): string[] => (cena(loja).turnos.golpes ?? []).map((golpe) => golpe.id)

function tecnica(cartaoId: string, alvo: string, dano: number, respostas?: RespostasDoPedido, perfurante = false): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante, custo: null, acao: null, ...(respostas === undefined ? {} : { respostas }) }
}

function naoReagir(loja: LojaDaBatalha, golpeId: string, tokenId: string): void {
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId, tokenId })).toBe(true)
}

describe('Corta Cenoura (Jimboy): o app rola a disputa depois do acerto', () => {
  it('FOR com vantagem (18 e 3) vence a RES da May (2): Atordoado 1, e a linha diz a disputa', () => {
    const { loja, fila } = batalha()
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(CORTA_CENOURA.id, daMay, 45))).toBe(true)
    fila.push(18, 3, 2)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(selosDe(loja, daMay)).toContain('Atordoado')
    expect(textos(loja).some((texto) => texto.includes('disputa d20 18 (vantagem: 18 e 3)') && texto.includes('o selo pegou'))).toBe(true)
  })

  it('perdeu a disputa (1 e 1 contra 20): o golpe entra, o Atordoado não', () => {
    const { loja, fila } = batalha()
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(CORTA_CENOURA.id, daMay, 45))).toBe(true)
    fila.push(1, 1, 20)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', daMay)
    expect(selosDe(loja, daMay)).not.toContain('Atordoado')
    expect(textos(loja).some((texto) => texto.includes('o selo não pegou'))).toBe(true)
  })
})

describe('Rapid Dash (Jimboy no Full): dois golpes, duas reações', () => {
  it('80 pelo Escudo da May (72) e depois 40 perfurante: HP 700 → 652, cada golpe na própria linha', () => {
    const { loja, mesa } = batalha({ ...jimboy, cartoesAtivos: [FULL.id] })
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(RAPID_DASH.id, daMay, 80, undefined, true))).toBe(true)
    const [primeiro, segundo] = golpesEsperando(loja)
    expect(segundo).toBeDefined()
    naoReagir(loja, primeiro ?? '', daMay)
    naoReagir(loja, segundo ?? '', daMay)
    expect(recurso(mesa, NOME_DA_MAY, 'escudo')).toBe(0)
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(652)
    expect(textos(loja).filter((texto) => texto.includes('Rapid Dash'))).toHaveLength(2)
  })
})

describe('Grande Chifre (May): as respostas da mira valem no host', () => {
  it('resposta fora das opções é recusada; 3 quadrados e parede = 151 e Atordoado no Jimboy, com as respostas no registro', () => {
    const { loja, mesa } = batalha()
    const doJimboy = token(loja, NOME_DO_JIMBOY)
    const daVez = naVezDe(loja, NOME_DA_MAY)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, daVez, tecnica(GRANDE_CHIFRE.id, doJimboy, 151, { quadrados: '4', parede: 'sim' }))).toBe('Resposta fora das opções: Quantos quadrados empurrou?')
    expect(loja.getState().agir(CENA, MESTRE, daVez, tecnica(GRANDE_CHIFRE.id, doJimboy, 151, { quadrados: '3', parede: 'sim' }))).toBe(true)
    naoReagir(loja, golpesEsperando(loja)[0] ?? '', doJimboy)
    expect(selosDe(loja, doJimboy)).toContain('Atordoado')
    expect(recurso(mesa, NOME_DO_JIMBOY, 'hp')).toBe(929)
    expect(textos(loja).some((texto) => texto.includes('Grande Chifre (3 quadrados, Bateu na parede? Sim)'))).toBe(true)
  })
})

describe('Aplauso do Deus do Trovão (May) na reação: rebate', () => {
  it('rebate a Corta Cenoura (45): a May não toma nada, paga 60 SP, cansa, e o Jimboy toma 45 + 70 = 115 sem contra-ataque guardado', () => {
    const { loja, mesa } = batalha()
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(CORTA_CENOURA.id, daMay, 45))).toBe(true)
    const golpeId = golpesEsperando(loja)[0] ?? ''
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: daMay, cartaoId: APLAUSO.id, saida: 'contra', custo: null })).toBe(true)
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(700)
    expect(recurso(mesa, NOME_DA_MAY, 'sp')).toBe(0)
    expect(recurso(mesa, NOME_DO_JIMBOY, 'escudo')).toBe(0)
    expect(recurso(mesa, NOME_DO_JIMBOY, 'hp')).toBe(965)
    expect(cena(loja).turnos.contras ?? []).toHaveLength(0)
    expect(selosDe(loja, daMay).some((nome) => nome.includes('Overload'))).toBe(true)
    expect(textos(loja).at(-1)).toContain('rebateu 115 em Jimboy Segundo (45 + 70)')
  })
})

const NOME_DO_ALIADO = 'Aliado da May'

/**
 * O "perto" do Aplauso: Jimboy no Híbrido (SP para o Sai Dai Rin) contra a
 * May e um aliado dela. A mesa sabe onde cada um está: May em (5, 5) olhando
 * para `frenteDaMay` (`null` = sem frente), o aliado em (3, 5), atrás dela
 * se ela olha para leste.
 */
function batalhaPerto(frenteDaMay: Direcao | null): Batalha {
  const atacante = { ...jimboy, recursos: { ...jimboy.recursos, sp: 300 }, maximos: { ...jimboy.maximos, sp: 300 }, cartoesAtivos: [HIBRIDO.id] }
  const aliado = ficha(NOME_DO_ALIADO, { forca: 10 }, { hp: 500, sp: 0, escudo: 0 }, {})
  const memoria = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: atacante, lado: 'a' }, { ficha: may, lado: 'b' }, { ficha: aliado, lado: 'b' }]))
  const casas = new Map<string, Casa>([[NOME_DA_MAY, { col: 5, row: 5 }], [NOME_DO_ALIADO, { col: 3, row: 5 }], [NOME_DO_JIMBOY, { col: 10, row: 1 }]])
  const comPosicoes: MesaDaBatalha = {
    ...memoria,
    posicaoDoToken: (_cena, tokenId) => {
      const nome = memoria.tokens().find((candidato) => candidato.id === tokenId)?.name ?? ''
      const casa = casas.get(nome)
      return casa === undefined ? null : { casa, direcao: nome === NOME_DA_MAY ? frenteDaMay : null }
    },
  }
  const fila: number[] = []
  const loja = criarBatalhaStore(comPosicoes, { rolarD20: () => fila.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = memoria.tokens()
  const combatentes = combatentesIniciais(tokens, memoria.personagens(), memoria.sistema(), new Set(tokens.map((candidato) => candidato.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa: memoria, fila }
}

describe('Aplauso (May), o "perto": Overload em alvo no 6x6 à frente dela também pergunta a ela', () => {
  it('sem frente (vale qualquer lado): o Sai Dai Rin (257) no aliado espera a May; o "sim" dela anula no aliado e rebate 257 + 70 no Jimboy', () => {
    const { loja, mesa } = batalhaPerto(null)
    const daMay = token(loja, NOME_DA_MAY)
    const doAliado = token(loja, NOME_DO_ALIADO)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(SAI_DAI_RIN.id, doAliado, 257))).toBe(true)
    const golpe = cena(loja).turnos.golpes?.[0]
    expect(golpe?.alvos[0]?.porPerto).toEqual([daMay])
    const golpeId = golpe?.id ?? ''
    // Só rebatendo: outra saída no lugar do aliado é recusada.
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: doAliado, cartaoId: APLAUSO.id, saida: 'esquiva', custo: null, por: daMay })).toBe(false)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: doAliado, cartaoId: APLAUSO.id, saida: 'contra', custo: null, por: daMay })).toBe(true)
    expect(recurso(mesa, NOME_DO_ALIADO, 'hp')).toBe(500)
    expect(selosDe(loja, doAliado)).not.toContain('Paralisado')
    expect(recurso(mesa, NOME_DA_MAY, 'sp')).toBe(0)
    expect(recurso(mesa, NOME_DO_JIMBOY, 'hp')).toBe(553)
    expect(textos(loja).at(-1)).toContain('May D. Ark reage com Aplauso do Deus do Trovão por Aliado da May: o golpe não pega · rebateu 327 em Jimboy Segundo (257 + 70)')
  })

  it('a May olhando para leste e o aliado atrás dela: ninguém pergunta, o golpe pega na hora (257 e Paralisado)', () => {
    const { loja, mesa } = batalhaPerto('leste')
    const doAliado = token(loja, NOME_DO_ALIADO)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(SAI_DAI_RIN.id, doAliado, 257))).toBe(true)
    expect(golpesEsperando(loja)).toEqual([])
    expect(recurso(mesa, NOME_DO_ALIADO, 'hp')).toBe(243)
    expect(selosDe(loja, doAliado)).toContain('Paralisado')
  })
})

describe('Rapid Dash: o Desfazer da linha leva junto o 2º golpe', () => {
  it('o 2º golpe já resolvido (40 perfurante) volta, nada fica esperando e o SP do Jimboy volta', () => {
    const { loja, mesa } = batalha({ ...jimboy, cartoesAtivos: [FULL.id] })
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, NOME_DO_JIMBOY), tecnica(RAPID_DASH.id, daMay, 80, undefined, true))).toBe(true)
    const [primeiro, segundo] = cena(loja).turnos.golpes ?? []
    naoReagir(loja, segundo?.id ?? '', daMay)
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(660)
    expect(loja.getState().desfazer(CENA, primeiro?.linhaId ?? '', MESTRE)).toBe(true)
    expect(golpesEsperando(loja)).toEqual([])
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(700)
    expect(recurso(mesa, NOME_DO_JIMBOY, 'sp')).toBe(60)
    expect(cena(loja).registro.find((linha) => linha.id === segundo?.linhaId)?.desfeita).toBeDefined()
  })
})

describe('Ajustar com Atual e Máximo juntos (resposta da Saga)', () => {
  it('vale o que foi digitado: Jimboy 1000/1000 pedindo Atual 1300 e Máximo 1300 fica 1300/1300', () => {
    const { loja, mesa } = batalha()
    const doJimboy = token(loja, NOME_DO_JIMBOY)
    const pedido: PedidoDeAjusteNaBatalha = { tokenId: doJimboy, mudancas: [{ tipo: 'atual', recursoId: 'hp', valor: 1300 }, { tipo: 'maximo', recursoId: 'hp', valor: 1300 }] }
    expect(loja.getState().ajustar(CENA, MESTRE, pedido)).toBe(true)
    expect(recurso(mesa, NOME_DO_JIMBOY, 'hp')).toBe(1300)
    expect(numeroDaFicha(pessoa(mesa, NOME_DO_JIMBOY).maximos, 'hp')).toBe(1300)
  })
})

describe('Recuperação Espantosa (May): o app avisa o mestre ao cair a 0', () => {
  it('avisa uma vez por batalha (o segundo dano com ela em 0 não avisa de novo)', () => {
    const { loja, mesa } = batalha()
    const daMay = token(loja, NOME_DA_MAY)
    expect(loja.getState().darDano(CENA, MESTRE, daMay, 800)).toBe(true)
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(0)
    expect(textos(loja).at(-1)).toContain('May D. Ark: Recuperação Espantosa: caiu a 0. Mestre, decida')
    expect(loja.getState().darDano(CENA, MESTRE, daMay, 10)).toBe(true)
    expect(textos(loja).filter((texto) => texto.includes('Recuperação Espantosa'))).toHaveLength(1)
  })

  it('o Aplicar do Sangramento que leva a May de 8 a 0 também avisa', () => {
    const { loja, mesa } = batalha()
    const daMay = token(loja, NOME_DA_MAY)
    naVezDe(loja, NOME_DO_JIMBOY)
    expect(loja.getState().ajustar(CENA, MESTRE, { tokenId: daMay, mudancas: [{ tipo: 'atual', recursoId: 'hp', valor: 8 }] })).toBe(true)
    expect(loja.getState().porSelo(CENA, daMay, { nome: 'Sangrando', turnos: 3 })).toBe(true)
    naVezDe(loja, NOME_DA_MAY)
    const lembrete = (cena(loja).turnos.combate?.[pessoa(mesa, NOME_DA_MAY).id]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))
    expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: daMay, cartaoId: lembrete?.cartaoId ?? '', aplicar: true })).toBe(true)
    expect(recurso(mesa, NOME_DA_MAY, 'hp')).toBe(0)
    expect(textos(loja).at(-1)).toContain('May D. Ark: Recuperação Espantosa: caiu a 0')
  })
})
