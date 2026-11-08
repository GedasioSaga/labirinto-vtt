// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2b (fatia código): as lacunas que a auditoria da F2
 * achou, na store do app (`criarBatalhaStore`) sobre a mesa em memória do
 * treino, com os cartões REAIS. Lei: docs/auditoria-fichas/respostas-do-grilling.md
 * (com as respostas de 08/11). No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeAlvo } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { ATRIBUTOS_DO_ALEXEI, CACADA, CACADA_COMO_FORMA, RIFLE } from '../lib/batalha/fichasDaFatiaC.testkit'
import { ALVORADA, siegCom } from '../lib/batalha/fichasDaFatiaF.testkit'
import type { RespostasDoPedido } from '../lib/batalha/perguntaNaHora'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS_DO_PIRATA = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const pirata = (nome: string): Personagem => ficha(nome, ATRIBUTOS_DO_PIRATA, { hp: 500, sp: 50, escudo: 0 }, {})

function cartao(id: string, nome: string, campos: Record<string, string>): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/** Os cartões reais (rpg.json de 08/11) que os testkits das fatias não trazem. */
const IGNICAO_DO_SIEG = cartao('cart_d6374db1-54d6-4859-9938-1765e2684c38', 'Ignição', { acao: 'Livre', grupo: 'Lunariano', deslocamento: '+2', ataquesExtras: '1', usos: '2' })
const APARENCIA = cartao('cart_a27035d1-22ad-4c0c-9a0c-647ed50b01e6', 'Aparência Inofensiva', { acao: 'Passiva' })

function batalha(heroi: Personagem, inimigos: Personagem[] = [pirata('Pirata 1')]): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, ...inimigos.map((inimigo) => ({ ficha: inimigo, lado: 'b' as const }))]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** Passa a vez até chegar a de `nome`; `passarAntes` = passa a de agora primeiro (a próxima vez dele). */
function naVezDe(loja: LojaDaBatalha, nome: string, passarAntes = false): VezEsperada {
  for (let i = 0; i < 8; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (!(passarAntes && i === 0) && turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
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

function tecnica(cartaoId: string, alvos: PedidoDeAlvo[], respostas: RespostasDoPedido): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos, surpresa: false, perfurante: false, custo: null, acao: null, respostas }
}

const atacar = (tokenId: string, respostas?: RespostasDoPedido): PedidoDeAcao => ({
  tipo: 'atacar',
  armaId: null,
  alvos: [{ tokenId, dano: 100 }],
  surpresa: false,
  perfurante: false,
  ...(respostas === undefined ? {} : { respostas }),
})

const hpDe = (mesa: MesaEmMemoria, nome: string): number => numeroDaFicha(pessoa(mesa, nome).recursos, 'hp')
const golpesEsperando = (loja: LojaDaBatalha): number => (cena(loja).turnos.golpes ?? []).length
const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)
const selosDe = (loja: LojaDaBatalha, tokenId: string): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => selo.nome)

describe('Imbuir Fogo do Siegfried', () => {
  it('Gram: Alvorada com "Sim" chega com +10 (64 vira 74); com "Não", 64', () => {
    for (const [fogo, chega] of [['sim', 74], ['nao', 64]] as const) {
      const { loja } = batalha(siegCom())
      const pirata1 = token(loja, 'Pirata 1')
      expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), tecnica(ALVORADA.id, [{ tokenId: pirata1, dano: 64 }], { fogo }))).toBe(true)
      expect(cena(loja).turnos.golpes?.[0]?.alvos.map((alvo) => alvo.dano)).toEqual([chega])
    }
  })

  it('com a Ignição ligada, o "Sim" é recusado com o motivo; o "Não" vale', () => {
    const base = siegCom()
    const comIgnicao: Personagem = { ...base, abas: { ...base.abas, transformacoes: [IGNICAO_DO_SIEG] }, cartoesAtivos: [IGNICAO_DO_SIEG.id] }
    const { loja } = batalha(comIgnicao)
    const pirata1 = token(loja, 'Pirata 1')
    const vez = naVezDe(loja, 'Siegfried')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(ALVORADA.id, [{ tokenId: pirata1, dano: 64 }], { fogo: 'sim' }))).toBe('Com a Ignição ligada não dá para imbuir fogo')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(ALVORADA.id, [{ tokenId: pirata1, dano: 64 }], { fogo: 'nao' }))).toBeNull()
  })
})

describe('A Caçada Começa do Alexei', () => {
  const alexeiComCacada = (): Personagem => ({ ...ficha('Alexei', ATRIBUTOS_DO_ALEXEI, { hp: 365, sp: 250, escudo: 12 }, { transformacoes: [CACADA], armas: [RIFLE] }), maximos: { hp: 600, sp: 250 } })

  it('ligada, o Atacar dele é Overload: o pirata não reage e toma os 100 na hora; o Cansaço espera o fim da forma', () => {
    const { loja, mesa } = batalha(alexeiComCacada())
    const vez = naVezDe(loja, 'Alexei')
    expect(loja.getState().agir(CENA, MESTRE, vez, { tipo: 'transformar', cartaoId: CACADA.id, acao: 'livre', trocarImagem: false })).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, vez, atacar(token(loja, 'Pirata 1')))).toBe(true)
    expect(golpesEsperando(loja)).toBe(0)
    expect(hpDe(mesa, 'Pirata 1')).toBe(400)
    // Revisão da F2b: o golpe é Overload só pela forma; a lei põe o cansaço "após o fim da técnica".
    expect(selosDe(loja, token(loja, 'Alexei'))).not.toContain('Cansaço do Overload')
  })

  it('dura as 5 vezes dele depois da que ligou e desliga sozinha no fim da 5ª, com o Cansaço do Overload', () => {
    const { loja, mesa } = batalha(alexeiComCacada())
    const doAlexei = token(loja, 'Alexei')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), { tipo: 'transformar', cartaoId: CACADA.id, acao: 'livre', trocarImagem: false })).toBe(true)
    // A vez em que ligou não conta; depois dela, 4 vezes inteiras: ainda ligada, falta 1.
    for (let vezes = 0; vezes < 5; vezes += 1) naVezDe(loja, 'Alexei', true)
    expect(pessoa(mesa, 'Alexei').cartoesAtivos).toContain(CACADA.id)
    expect(textos(loja).some((texto) => texto.includes('falta 1 vez'))).toBe(true)
    naVezDe(loja, 'Alexei', true)
    expect(pessoa(mesa, 'Alexei').cartoesAtivos).not.toContain(CACADA.id)
    expect(selosDe(loja, doAlexei)).toContain('Cansaço do Overload')
    expect(textos(loja).some((texto) => texto.includes('A Caçada Começa acabou'))).toBe(true)
  })

  it('F0c: a Duração da ficha vale sobre a tabela; com "2 turnos" a Caçada desliga no fim da 2ª vez dele, com o Cansaço', () => {
    const curta: CartaoDaFicha = { ...CACADA_COMO_FORMA, campos: { ...CACADA_COMO_FORMA.campos, duracao: '2 turnos' } }
    const { loja, mesa } = batalha({ ...alexeiComCacada(), abas: { transformacoes: [curta], armas: [RIFLE] } })
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), { tipo: 'transformar', cartaoId: curta.id, acao: 'livre', trocarImagem: false })).toBe(true)
    for (let vezes = 0; vezes < 2; vezes += 1) naVezDe(loja, 'Alexei', true)
    expect(pessoa(mesa, 'Alexei').cartoesAtivos).toContain(curta.id)
    naVezDe(loja, 'Alexei', true)
    expect(pessoa(mesa, 'Alexei').cartoesAtivos).not.toContain(curta.id)
    expect(selosDe(loja, token(loja, 'Alexei'))).toContain('Cansaço do Overload')
  })
})

describe('Aparência Inofensiva do Alexei', () => {
  const alexeiInofensivo = (): Personagem => ({ ...ficha('Alexei', ATRIBUTOS_DO_ALEXEI, { hp: 365, sp: 120, escudo: 12 }, { vantagens: [APARENCIA], armas: [RIFLE] }), maximos: { hp: 600, sp: 120 } })

  it('o 1º golpe no pirata que nunca o viu lutar é Surpresa (100 vira 150, sem reação); o 2º espera a reação', () => {
    const { loja, mesa } = batalha(alexeiInofensivo())
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), atacar(pirata1, { inofensiva: 'sim' }))).toBe(true)
    expect(golpesEsperando(loja)).toBe(0)
    expect(hpDe(mesa, 'Pirata 1')).toBe(350)
    expect(textos(loja).some((texto) => texto.includes('Surpresa (Aparência Inofensiva)'))).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei', true), atacar(pirata1, { inofensiva: 'sim' }))).toBe(true)
    expect(golpesEsperando(loja)).toBe(1)
  })

  it('o mestre desliga na mira ("Não"), e o pedido sem a resposta (versão velha) também não ganha Surpresa', () => {
    for (const respostas of [{ inofensiva: 'nao' }, undefined]) {
      const { loja } = batalha(alexeiInofensivo())
      expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), atacar(token(loja, 'Pirata 1'), respostas))).toBe(true)
      expect(golpesEsperando(loja)).toBe(1)
    }
  })

  it('quem estava na ordem e assistiu o 1º golpe já o viu lutar: o Pirata 2 não leva Surpresa depois', () => {
    const { loja, mesa } = batalha(alexeiInofensivo(), [pirata('Pirata 1'), pirata('Pirata 2')])
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei'), atacar(token(loja, 'Pirata 1'), { inofensiva: 'sim' }))).toBe(true)
    expect(hpDe(mesa, 'Pirata 1')).toBe(350)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Alexei', true), atacar(token(loja, 'Pirata 2'), { inofensiva: 'sim' }))).toBe(true)
    expect(golpesEsperando(loja)).toBe(1)
    expect(hpDe(mesa, 'Pirata 2')).toBe(500)
  })

  it('o Desfazer do 1º golpe devolve a Surpresa: o golpe repetido sai de novo com 150, sem reação', () => {
    const { loja, mesa } = batalha(alexeiInofensivo())
    const pirata1 = token(loja, 'Pirata 1')
    const vez = naVezDe(loja, 'Alexei')
    expect(loja.getState().agir(CENA, MESTRE, vez, atacar(pirata1, { inofensiva: 'sim' }))).toBe(true)
    const linhaDoGolpe = cena(loja).registro.find((linha) => linha.tipo === 'golpe')
    expect(linhaDoGolpe).toBeDefined()
    expect(loja.getState().desfazer(CENA, linhaDoGolpe?.id ?? '', MESTRE)).toBe(true)
    expect(hpDe(mesa, 'Pirata 1')).toBe(500)
    expect(loja.getState().agir(CENA, MESTRE, vez, atacar(pirata1, { inofensiva: 'sim' }))).toBe(true)
    expect(golpesEsperando(loja)).toBe(0)
    expect(hpDe(mesa, 'Pirata 1')).toBe(350)
  })
})

describe('Ignição: a ordem na virada da rodada (revisão da F2b)', () => {
  // Agilidade 10 × 1,2 = 12 passa o Pirata de 11; sem a forma, ele joga depois.
  const siegLento = (): Personagem => ficha('Siegfried', { ...ATRIBUTOS_DO_PIRATA, agilidade: 10 }, { hp: 500, sp: 100, escudo: 0 }, { transformacoes: [IGNICAO_DO_SIEG] })
  const pirataRapido = (): Personagem => ficha('Pirata 1', { ...ATRIBUTOS_DO_PIRATA, agilidade: 11 }, { hp: 500, sp: 50, escudo: 0 }, {})
  const nomes = (loja: LojaDaBatalha): (string | undefined)[] => cena(loja).turnos.cartas.map((carta) => carta.nome)

  function ligarAIgnicao(): LojaDaBatalha {
    const { loja } = batalha(siegLento(), [pirataRapido()])
    expect(nomes(loja)).toEqual(['Pirata 1', 'Siegfried'])
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), { tipo: 'transformar', cartaoId: IGNICAO_DO_SIEG.id, acao: 'livre', trocarImagem: false })).toBe(true)
    expect(textos(loja).some((texto) => texto.includes('a ordem muda no começo da próxima rodada'))).toBe(true)
    // No meio da rodada a ordem não se mexe.
    expect(nomes(loja)).toEqual(['Pirata 1', 'Siegfried'])
    naVezDe(loja, 'Siegfried', true)
    return loja
  }

  it('ligada no meio da rodada, na virada a carta dele vai para a frente e ele joga primeiro', () => {
    const loja = ligarAIgnicao()
    expect(cena(loja).turnos.rodada).toBe(2)
    expect(nomes(loja)).toEqual(['Siegfried', 'Pirata 1'])
    expect(cena(loja).turnos.cartas.find((carta) => carta.id === cena(loja).turnos.vez)?.nome).toBe('Siegfried')
    expect(textos(loja).some((texto) => texto.includes('Siegfried vai para a posição 1 (Agilidade de agora: 12)'))).toBe(true)
  })

  it('o Desfazer da vez volta a ordem e a rodada; passar de novo o põe na frente outra vez', () => {
    const loja = ligarAIgnicao()
    const linhaDaVez = [...cena(loja).registro].reverse().find((linha) => linha.tipo === 'vez')
    expect(loja.getState().desfazer(CENA, linhaDaVez?.id ?? '', MESTRE)).toBe(true)
    expect(cena(loja).turnos.rodada).toBe(1)
    expect(nomes(loja)).toEqual(['Pirata 1', 'Siegfried'])
    const { turnos } = cena(loja)
    expect(loja.getState().passarVez(CENA, MESTRE, { cartaId: turnos.vez ?? '', rodada: turnos.rodada })).toBe(true)
    expect(nomes(loja)).toEqual(['Siegfried', 'Pirata 1'])
  })
})
