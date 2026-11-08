// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S3 (docs/planos/conserto-fichas-2026-11-08.md;
 * regras do sistema em docs/auditoria-fichas/respostas-do-grilling.md):
 * recargas (Tempo N), selo com carta extra, +10 SP por vez, técnica cara,
 * Overload, Escudo cheio e formas no fim da batalha. Na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com fichas
 * inventadas (o lutador e o alvo).
 */
import { describe, expect, it } from 'vitest'
import { maximoComposto } from '../lib/ajusteDaFicha'
import { ativarForma, desfazerForma } from '../lib/batalha/transformacao'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { numeroDaFicha, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro (Agilidade 70). Escudo 20 com cheio 40; uma forma que dá HP +300. */
const LUTADOR = ficha({
  id: 'pers_lutador',
  tipo: 'jogador',
  nome: 'Lutador',
  recursos: { hp: 300, sp: 100, escudo: 20 },
  maximos: { hp: 700, sp: 120, escudo: 40 },
  atributos: { forca: 51, agilidade: 70 },
  abas: {
    habilidades: [
      { id: 'tec_rapida', nome: 'Golpe Rápido', campos: { acao: 'Simples', custo: '-', tempo: '1', dano: '10' } },
      { id: 'tec_chute', nome: 'Chute', campos: { acao: 'Simples', custo: '10 SP', tempo: '-', dano: '10' } },
      { id: 'tec_cara', nome: 'Golpe Caro', campos: { acao: 'Simples', custo: '150 SP', tempo: '-', dano: '10' } },
      { id: 'tec_over', nome: 'Explosão Final', campos: { acao: 'Simples / Overload', custo: '20 SP', tempo: '-', dano: '50' } },
    ],
    transformacoes: [{ id: 'forma_hibrida', nome: 'Forma Híbrida', campos: { acao: 'Livre' }, modificadores: [{ atributo: 'hp', delta: 300 }] }],
  },
})

const ALVO = ficha({
  id: 'pers_alvo',
  tipo: 'jogador',
  nome: 'Alvo',
  recursos: { hp: 300, sp: 50 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 40 },
})

/** A mesa em memória dá ids próprios às fichas: `ids` = o personagem de cada carta, lido logo depois do Iniciar. */
function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria; ids: { lutador: string; alvo: string } } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: LUTADOR, lado: 'a' }, { ficha: ALVO, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  const id = (nome: string): string => {
    const personagemId = carta(loja, nome).personagemId
    if (personagemId === null) throw new Error(`a carta de ${nome} não tem personagem`)
    return personagemId
  }
  return { loja, mesa, ids: { lutador: id('Lutador'), alvo: id('Alvo') } }
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

function carta(loja: LojaDaBatalha, nome: string): CartaDaOrdem {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome === nome && candidata.extra === undefined)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada
}

function pessoa(mesa: MesaEmMemoria, id: string): Personagem {
  const achada = mesa.personagens().find((candidato) => candidato.id === id)
  if (achada === undefined) throw new Error(`sem ${id}`)
  return achada
}

const usar = (cartaoId: string, alvo: string, dano: number): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante: false, custo: null, acao: null })

/** Passa a vez `vezes` vezes, sempre com a vez esperada certa. */
function passar(loja: LojaDaBatalha, vezes: number): void {
  for (let i = 0; i < vezes; i += 1) expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
}

describe('S3: recargas e selos contam por vez do dono', () => {
  it('P1: Tempo 1 bloqueia 1 vez (usa na rodada 1, bloqueada na 2, livre na 3); e o +10 SP chega a quem não gastou', () => {
    const { loja, mesa, ids } = batalha()
    const alvo = carta(loja, 'Alvo').tokenId
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), usar('tec_rapida', alvo, 10))).toBe(true)
    passar(loja, 2)
    // Rodada 2, vez do lutador: a técnica ainda está bloqueada (hoje o app já liberava).
    expect(cena(loja).turnos.rodada).toBe(2)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez(loja), usar('tec_rapida', alvo, 10))).toBe('Recarga: 1 turno')
    // +10 SP no começo da vez: o lutador não gastou SP (100 → 110); o alvo passou sem gastar (50 → 60) na vez 2 dele.
    expect(numeroDaFicha(pessoa(mesa, ids.lutador).recursos, 'sp')).toBe(110)
    passar(loja, 2)
    expect(numeroDaFicha(pessoa(mesa, ids.alvo).recursos, 'sp')).toBe(60)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez(loja), usar('tec_rapida', alvo, 10))).toBeNull()
  })

  it('P2: com carta extra, o selo desce nas duas vezes da rodada', () => {
    const { loja } = batalha()
    const lutador = carta(loja, 'Lutador')
    expect(loja.getState().adicionarCartaExtra(CENA, lutador.tokenId, 1, 'rodada')).not.toBeNull()
    // Posto na vez da carta original: o fim DESTA vez não conta; o fim da carta extra (mesma rodada) conta.
    expect(loja.getState().porSelo(CENA, lutador.tokenId, { nome: 'Atordoado', turnos: 2 })).toBe(true)
    passar(loja, 2)
    const selo = (cena(loja).turnos.selos ?? []).find((candidato) => candidato.tokenId === lutador.tokenId)
    expect(cena(loja).turnos.rodada).toBe(1)
    expect(selo?.turnos).toBe(1)
  })
})

describe('S3: SP na vez e técnica cara', () => {
  it('+10 SP: quem gastou SP na vez não ganha; desfazer a Vez tira os +10', () => {
    const { loja, mesa, ids } = batalha()
    const alvo = carta(loja, 'Alvo').tokenId
    const sp = (): number => numeroDaFicha(pessoa(mesa, ids.lutador).recursos, 'sp')
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), usar('tec_chute', alvo, 10))).toBe(true)
    expect(sp()).toBe(90)
    passar(loja, 2)
    expect(sp()).toBe(90)
    passar(loja, 2)
    expect(sp()).toBe(100)
    const linha = [...cena(loja).registro].reverse().find((candidata) => candidata.reversao.tipo === 'vez' && candidata.texto.includes('recupera 10 SP'))
    expect(linha).toBeDefined()
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect(sp()).toBe(90)
  })

  it('técnica com custo acima do SP máximo fica bloqueada com o motivo', () => {
    const { loja } = batalha()
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez(loja), usar('tec_cara', carta(loja, 'Alvo').tokenId, 10))).toBe('Precisa de 150 SP (o máximo é 120)')
  })
})

describe('S3: Overload', () => {
  it('não erra, gasta a Completa, 1 por batalha, e os atributos base ficam pela metade até o fim da batalha', () => {
    const { loja, mesa, ids } = batalha()
    const lutador = carta(loja, 'Lutador')
    const alvo = carta(loja, 'Alvo').tokenId
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), usar('tec_over', alvo, 50))).toBe(true)
    // Sem reação: o dano entra na hora.
    expect(numeroDaFicha(pessoa(mesa, ids.alvo).recursos, 'hp')).toBe(250)
    expect(cena(loja).turnos.gastos[lutador.id]).toMatchObject({ simples: 1, movimento: 1 })
    // FOR 51 → 25 e AGI 70 → 35 (metade para baixo, pelo modificador).
    expect(pessoa(mesa, ids.lutador).modificadoresDosAtributos).toMatchObject({ forca: -26, agilidade: -35 })
    passar(loja, 2)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez(loja), usar('tec_over', alvo, 50))).toBe('Overload: já usado nesta batalha')
    loja.getState().desligar(CENA)
    expect(pessoa(mesa, ids.lutador).modificadoresDosAtributos).toMatchObject({ forca: 0, agilidade: 0 })
  })
})

describe('S3: formas e Escudo', () => {
  it('bug 9: ativar e desfazer a forma não cura de graça (300/700 → 600/1000 → 300/700, duas vezes)', () => {
    const quando = 0
    let lutador = LUTADOR
    const hp = (personagem: Personagem): string => `${numeroDaFicha(personagem.recursos, 'hp')}/${maximoComposto(personagem, 'hp').total}`
    for (let i = 0; i < 2; i += 1) {
      lutador = ativarForma(lutador, SISTEMA_DO_TESTE, 'forma_hibrida', 'Mestre', quando)?.personagem ?? lutador
      expect(hp(lutador)).toBe('600/1000')
      lutador = desfazerForma(lutador, SISTEMA_DO_TESTE, 'forma_hibrida', 'Mestre', quando) ?? lutador
      expect(hp(lutador)).toBe('300/700')
    }
  })

  it('o Escudo volta cheio ao começar, e no fim da batalha a forma desliga sozinha tirando o que deu', () => {
    const { loja, mesa, ids } = batalha()
    expect(numeroDaFicha(pessoa(mesa, ids.lutador).recursos, 'escudo')).toBe(40)
    const transformar: PedidoDeAcao = { tipo: 'transformar', cartaoId: 'forma_hibrida', acao: 'completa', trocarImagem: false }
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), transformar)).toBe(true)
    expect(numeroDaFicha(pessoa(mesa, ids.lutador).recursos, 'hp')).toBe(600)
    loja.getState().desligar(CENA)
    const depois = pessoa(mesa, ids.lutador)
    expect(depois.cartoesAtivos).not.toContain('forma_hibrida')
    expect(numeroDaFicha(depois.recursos, 'hp')).toBe(300)
  })
})
