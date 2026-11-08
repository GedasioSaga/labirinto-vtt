// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S4 (docs/planos/conserto-fichas-2026-11-08.md;
 * regras do sistema em docs/auditoria-fichas/respostas-do-grilling.md):
 * Atordoado/Paralisado, vantagem no d20, Sangramento, Determinação,
 * Resiliente no "Dar dano", Preparação para a Batalha e a ação escolhida na
 * transformação. Na store do app (`criarBatalhaStore`) sobre a mesa em
 * memória do treino, com fichas inventadas. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDePassiva, PedidoDeReacao } from '../lib/batalha/combate'
import type { VezEsperada } from '../lib/batalha/ponte'
import { bonusDaBatalha, totalDoBonus } from '../lib/batalha/selos'
import { combatentesIniciais, type AutorDaAcao, type CartaDaOrdem } from '../lib/batalha/turnos'
import { numeroDaFicha, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { lerPedidoDeAcao, lerPedidoDePassiva, lerPedidoDeReacao } from '../net/protocoloDaBatalha'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const TRAVADO = 'Atordoado: nesta vez só dá para passar a vez'

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Age primeiro (Agilidade 70). Escudo 20; a forma Livre na ficha; a Preparação para a Batalha. */
const LUTADOR = ficha({
  id: 'pers_lutador',
  tipo: 'jogador',
  nome: 'Lutador',
  recursos: { hp: 300, sp: 100, escudo: 20 },
  maximos: { hp: 300, sp: 120, escudo: 40 },
  atributos: { forca: 51, agilidade: 70 },
  abas: {
    habilidades: [
      { id: 'tec_rapida', nome: 'Golpe Rápido', campos: { acao: 'Simples', custo: '-', tempo: '-', dano: '10' } },
      { id: 'tec_preparo', nome: 'Preparação para a Batalha', campos: { acao: 'Passiva', efeito: '+20 num atributo até o fim do combate' } },
    ],
    transformacoes: [{ id: 'forma_hibrida', nome: 'Forma Híbrida', campos: { acao: 'Livre' } }],
  },
})

/** Age depois. Determinação 80 (rank 4); com a forma Resiliente ligada (−20% do dano que chega). */
const ALVO = ficha({
  id: 'pers_alvo',
  tipo: 'jogador',
  nome: 'Alvo',
  recursos: { hp: 300, sp: 50 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 40, determinacao: 80 },
})

const RESILIENTE = ficha({
  id: 'pers_resiliente',
  tipo: 'jogador',
  nome: 'Alvo',
  recursos: { hp: 300, sp: 50 },
  maximos: { hp: 300, sp: 60 },
  atributos: { forca: 30, agilidade: 40 },
  abas: { transformacoes: [{ id: 'forma_resiliente', nome: 'Resiliente', campos: { acao: 'Livre', danoRecebido: '-20%' } }] },
  cartoesAtivos: ['forma_resiliente'],
})

/** `dados` = os d20 do host, na ordem; acabou a fila, sai 10. */
function batalha(alvo: Personagem = ALVO, dados: number[] = []): { loja: LojaDaBatalha; mesa: MesaEmMemoria; ids: { lutador: string; alvo: string } } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: LUTADOR, lado: 'a' }, { ficha: alvo, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => dados.shift() ?? 10, outraBatalhaLigada: () => false })
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

const hp = (mesa: MesaEmMemoria, id: string): number => numeroDaFicha(pessoa(mesa, id).recursos, 'hp')
const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''
const golpe = (cartaoId: string, alvo: string, dano: number): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: alvo, dano }], surpresa: false, perfurante: false, custo: null, acao: null })

function passar(loja: LojaDaBatalha, vezes: number): void {
  for (let i = 0; i < vezes; i += 1) expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
}

describe('S4: Atordoado e Paralisado só passam a vez', () => {
  it('na vez do Atordoado, golpe e transformação ficam recusados com o motivo; passar a vez sai', () => {
    const { loja } = batalha()
    const lutador = carta(loja, 'Lutador').tokenId
    expect(loja.getState().porSelo(CENA, lutador, { nome: 'Atordoado', turnos: 1 })).toBe(true)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez(loja), golpe('tec_rapida', carta(loja, 'Alvo').tokenId, 10))).toBe(TRAVADO)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), { tipo: 'transformar', cartaoId: 'forma_hibrida', acao: 'livre', trocarImagem: false })).toBe(false)
    expect(loja.getState().passarVez(CENA, MESTRE, vez(loja))).toBe(true)
  })

  it('o Paralisado não reage: o golpe entra na hora, sem esperar o d20', () => {
    const { loja, mesa, ids } = batalha()
    const alvo = carta(loja, 'Alvo').tokenId
    expect(loja.getState().porSelo(CENA, alvo, { nome: 'Paralisado', turnos: 2 })).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), golpe('tec_rapida', alvo, 10))).toBe(true)
    expect(hp(mesa, ids.alvo)).toBe(290)
    expect((cena(loja).turnos.golpes ?? []).some((pendente) => pendente.alvos.some((quem) => quem.tokenId === alvo && quem.danoFinal === undefined))).toBe(false)
  })
})

describe('S4: vantagem e desvantagem rolam 2 d20', () => {
  it('na reação ao golpe, a vantagem fica com o maior e guarda o outro', () => {
    const dados: number[] = []
    const { loja } = batalha(ALVO, dados)
    const alvo = carta(loja, 'Alvo').tokenId
    expect(loja.getState().agir(CENA, MESTRE, vez(loja), golpe('tec_rapida', alvo, 10))).toBe(true)
    const golpeId = cena(loja).turnos.golpes?.[0]?.id ?? ''
    dados.push(7, 15)
    const pedido: PedidoDeReacao = { tipo: 'rolar', golpeId, tokenId: alvo, modificador: 2, vantagem: 'vantagem' }
    expect(loja.getState().reagir(CENA, MESTRE, pedido)).toBe(true)
    const rolagem = cena(loja).turnos.golpes?.[0]?.alvos.find((quem) => quem.tokenId === alvo)?.rolagem
    expect(rolagem).toMatchObject({ d20: 15, modificador: 2, total: 17, vantagem: { modo: 'vantagem', outro: 7 } })
  })

  it('na reação livre, a desvantagem fica com o menor e o registro mostra os dois', () => {
    const dados: number[] = []
    const { loja } = batalha(ALVO, dados)
    dados.push(7, 15)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId: null, tokenId: carta(loja, 'Alvo').tokenId, modificador: 0, vantagem: 'desvantagem' })).toBe(true)
    expect(ultimaLinha(loja)).toContain('d20 7 (desvantagem: 7 e 15)')
  })
})

describe('S4: Sangramento no começo da vez de quem sangra', () => {
  it('Aplicar tira 10 do HP direto, sem gastar o Escudo', () => {
    const { loja, mesa, ids } = batalha()
    const lutador = carta(loja, 'Lutador').tokenId
    expect(loja.getState().porSelo(CENA, lutador, { nome: 'Sangramento', turnos: 3 })).toBe(true)
    passar(loja, 2)
    const lembrete = (cena(loja).turnos.combate?.[ids.lutador]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))
    expect(lembrete).toBeDefined()
    const pedido: PedidoDePassiva = { tipo: 'lembrete', tokenId: lutador, cartaoId: lembrete?.cartaoId ?? '', aplicar: true }
    // O Escudo enche no começo da batalha (S3): 40; o Sangramento não toca nele.
    const escudo = (): number => numeroDaFicha(pessoa(mesa, ids.lutador).recursos, 'escudo')
    expect(escudo()).toBe(40)
    expect(loja.getState().passiva(CENA, MESTRE, pedido)).toBe(true)
    expect(hp(mesa, ids.lutador)).toBe(290)
    expect(escudo()).toBe(40)
    expect(ultimaLinha(loja)).toBe('Lutador sangra: -10 HP (direto, sem o Escudo)')
  })

  it('o jogador não decide o Sangramento; o mestre pula sem dano', () => {
    const { loja, mesa, ids } = batalha()
    const lutador = carta(loja, 'Lutador').tokenId
    expect(loja.getState().porSelo(CENA, lutador, { nome: 'Sangrando', turnos: 3 })).toBe(true)
    passar(loja, 2)
    const cartaoId = (cena(loja).turnos.combate?.[ids.lutador]?.lembretes ?? []).find((candidato) => candidato.chave.endsWith(':sangra'))?.cartaoId ?? ''
    expect(loja.getState().passiva(CENA, JOGADOR, { tipo: 'lembrete', tokenId: lutador, cartaoId, aplicar: true })).toBe(false)
    expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: lutador, cartaoId, aplicar: false })).toBe(true)
    expect(hp(mesa, ids.lutador)).toBe(300)
    expect((cena(loja).turnos.combate?.[ids.lutador]?.lembretes ?? []).filter((candidato) => candidato.chave.endsWith(':sangra'))).toEqual([])
  })
})

describe('S4: o dano que chega cai (Determinação e Resiliente)', () => {
  it('Determinação rank 4: só com o HP abaixo da metade, −10%', () => {
    const { loja, mesa, ids } = batalha()
    const alvo = carta(loja, 'Alvo').tokenId
    expect(loja.getState().darDano(CENA, MESTRE, alvo, 100)).toBe(true)
    expect(loja.getState().darDano(CENA, MESTRE, alvo, 100)).toBe(true)
    expect(hp(mesa, ids.alvo)).toBe(100)
    expect(loja.getState().darDano(CENA, MESTRE, alvo, 50)).toBe(true)
    expect(hp(mesa, ids.alvo)).toBe(55)
    expect(ultimaLinha(loja)).toContain('(Determinação -10%: de 50)')
  })

  it('Resiliente: digita 100, chegam 80, e o registro diz o desconto', () => {
    const { loja, mesa, ids } = batalha(RESILIENTE)
    expect(loja.getState().darDano(CENA, MESTRE, carta(loja, 'Alvo').tokenId, 100)).toBe(true)
    expect(hp(mesa, ids.alvo)).toBe(220)
    expect(ultimaLinha(loja)).toContain('deu 80 de dano')
    expect(ultimaLinha(loja)).toContain('(Resiliente -20%: de 100)')
  })
})

describe('S4: Preparação para a Batalha no começo do combate', () => {
  it('pergunta "vai fazer?"; com o atributo, +20 nele até o fim do combate', () => {
    const { loja, ids } = batalha()
    const lutador = carta(loja, 'Lutador').tokenId
    const lembrete = (cena(loja).turnos.combate?.[ids.lutador]?.lembretes ?? []).find((candidato) => candidato.chave === 'tec_preparo:preparacao')
    expect(lembrete).toMatchObject({ tokenId: lutador, tipo: 'ativar' })
    expect(loja.getState().passiva(CENA, JOGADOR, { tipo: 'lembrete', tokenId: lutador, cartaoId: 'tec_preparo', aplicar: true })).toBe(false)
    expect(loja.getState().passiva(CENA, JOGADOR, { tipo: 'lembrete', tokenId: lutador, cartaoId: 'tec_preparo', aplicar: true, atributoId: 'forca' })).toBe(true)
    expect(totalDoBonus(bonusDaBatalha(cena(loja).turnos.selos, lutador), 'forca')).toBe(20)
    expect((cena(loja).turnos.selos ?? []).find((selo) => selo.tokenId === lutador)?.turnos).toBeNull()
  })
})

describe('S4: a transformação cobra a ação que o jogador escolheu', () => {
  it('Simples numa forma Livre na ficha gasta a Simples; Livre não gasta nada', () => {
    const simples = batalha().loja
    const cartaId = carta(simples, 'Lutador').id
    expect(simples.getState().agir(CENA, MESTRE, vez(simples), { tipo: 'transformar', cartaoId: 'forma_hibrida', acao: 'simples', trocarImagem: false })).toBe(true)
    expect(cena(simples).turnos.gastos[cartaId]).toMatchObject({ simples: 1 })
    const livre = batalha().loja
    expect(livre.getState().agir(CENA, MESTRE, vez(livre), { tipo: 'transformar', cartaoId: 'forma_hibrida', acao: 'livre', trocarImagem: false })).toBe(true)
    expect(cena(livre).turnos.gastos[carta(livre, 'Lutador').id]?.simples ?? 0).toBe(0)
  })
})

describe('S4: o fio entre o jogador e o host', () => {
  it('aceita a vantagem, a ação Livre e o atributo da Preparação; recusa o que sai do enum', () => {
    const base = { tipo: 'rolar', golpeId: 'golpe_1', tokenId: 'tok_1', modificador: 0 }
    expect(lerPedidoDeReacao({ ...base, vantagem: 'vantagem' })).toEqual({ ...base, vantagem: 'vantagem' })
    expect(lerPedidoDeReacao({ ...base, vantagem: 'dobro' })).toBeNull()
    expect(lerPedidoDeAcao({ tipo: 'transformar', cartaoId: 'forma_1', acao: 'livre', trocarImagem: false })).toMatchObject({ acao: 'livre' })
    expect(lerPedidoDePassiva({ tipo: 'lembrete', tokenId: 'tok_1', cartaoId: 'tec_1', aplicar: true, atributoId: 'forca' })).toMatchObject({ atributoId: 'forca' })
  })
})
