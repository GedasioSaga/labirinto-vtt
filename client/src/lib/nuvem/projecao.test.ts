import { describe, expect, it } from 'vitest'
import { fichaDBTVazia, lerFichaDBT } from '../dbt/modelo'
import type { Personagem } from '../personagem'
import { AGORA, enviar, F_NAMI, ficha, guardada, MEMBROS, mesa, MESTRE, MESTRE_NO_SITE, NAMI, op, ZORO } from './campanha.fixture'
import { CAMPOS_DO_MESTRE } from './caminho'
import { paraJson } from './json'
import { fichaNoEstado, projetarMembros, projetarOpParaJogador, projetarParaJogador } from './projecao'
import type { OpGravada } from './tipos'

/**
 * PROJEÇÃO (plano do Lobby §6.4; testes liberados pela 12.18, grupo c): nota
 * do mestre, dono, combate, NPC e ficha escondida nunca chegam ao jogador —
 * nem pelo caminho, nem dentro do valor da op. Mochila e moedas chegam.
 */

const NPC_DBT = { nd: 2, categoria: 'elite', rank: 'C', passivas: [], prontoId: null }

/** A ficha com TODOS os campos do mestre preenchidos, mochila, moedas e o bloco Dragon Ball com NPC. */
function fichaCheia(): Personagem {
  const dbt = lerFichaDBT({ ...fichaDBTVazia(), npc: NPC_DBT })
  if (dbt === null || dbt.npc === undefined) throw new Error('a ficha Dragon Ball com NPC não passou no leitor')
  return ficha('pers_crocodile', {
    dono: 'conta_nami',
    combate: { forca: 2 },
    soCenario: true,
    nomeDoJogador: 'Robin',
    notaDoMestre: 'Trai a tripulação no arco 3',
    mochila: [{ id: 'vaga_areia', nome: 'Areia' }],
    moedas: 40,
    dbt,
  })
}

function gravada(extra: Partial<OpGravada> & Pick<OpGravada, 'caminho' | 'acao'>): OpGravada {
  return {
    opId: 'op_1',
    loteId: 'lote_1',
    fichaId: 'pers_crocodile',
    baseRev: 0,
    clienteId: 'cli_app',
    quandoCliente: AGORA,
    rev: 1,
    autorContaId: 'mestre',
    autorNome: 'Mestre',
    origem: 'app',
    atestadoPeloApp: false,
    quando: AGORA,
    ...extra,
  }
}

describe('a ficha projetada', () => {
  it('tira todos os campos do mestre e o NPC da Dragon Ball; mantém mochila e moedas; não muda a recebida', () => {
    const cheia = fichaCheia()
    const copia = structuredClone(cheia)
    const projetada = projetarParaJogador(cheia)
    for (const campo of CAMPOS_DO_MESTRE) expect(projetada, campo).not.toHaveProperty(campo)
    expect(projetada.dbt).not.toHaveProperty('npc')
    expect(projetada).toMatchObject({ mochila: [{ id: 'vaga_areia' }], moedas: 40, nome: 'crocodile' })
    expect(cheia).toEqual(copia)
  })
})

describe('a op projetada', () => {
  it('criar a ficha com notaDoMestre sai projetada sem ela (e sem os outros campos do mestre)', () => {
    const campanha = mesa()
    const criar = op(MESTRE_NO_SITE, 'pers_crocodile', [], 'criar', { valor: paraJson(fichaCheia()) })
    expect(enviar(campanha, MESTRE_NO_SITE, [criar]).respostas[0]).toMatchObject({ t: 'ack' })
    const gravadaNoLog = campanha.todasAsOps()[0]
    // O servidor guarda o doc completo; só a saída para o jogador é projetada.
    expect(gravadaNoLog.valor).toMatchObject({ notaDoMestre: 'Trai a tripulação no arco 3' })
    const projetada = projetarOpParaJogador(gravadaNoLog, 'mesa')
    const texto = JSON.stringify(projetada)
    for (const proibido of ['notaDoMestre', 'Trai a tripulação', '"dono"', 'combate', 'soCenario', 'nomeDoJogador', '"npc"']) expect(texto, proibido).not.toContain(proibido)
    expect(projetada?.valor).toMatchObject({ id: 'pers_crocodile', moedas: 40, mochila: [{ id: 'vaga_areia' }] })
    expect(gravadaNoLog.valor).toMatchObject({ notaDoMestre: 'Trai a tripulação no arco 3' })
  })

  it('apagar a ficha inteira: o antes também sai projetado', () => {
    const projetada = projetarOpParaJogador(gravada({ caminho: [], acao: 'apagar', antes: paraJson(fichaCheia()) }), 'mesa')
    expect(JSON.stringify(projetada)).not.toContain('Trai a tripulação')
    expect(projetada?.antes).toMatchObject({ nome: 'crocodile' })
  })

  it('op em ficha do mestre = null para o jogador', () => {
    const comum = gravada({ caminho: ['recursos', 'hp'], acao: 'definir', valor: 10, antes: 20 })
    expect(projetarOpParaJogador(comum, 'mestre')).toBeNull()
    expect(projetarOpParaJogador(comum, 'mesa')).toBe(comum)
  })

  it('op de ficha do treino (T8): a ficha inteira sai sem notaDoMestre, dono, combate nem mochila; op de mochila e bolsa não vai', () => {
    const criar = gravada({ fichaId: 'treino_pers_crocodile', caminho: [], acao: 'criar', valor: paraJson(fichaCheia()) })
    const projetada = projetarOpParaJogador(criar, 'treino')
    const texto = JSON.stringify(projetada)
    for (const proibido of ['notaDoMestre', 'Trai a tripulação', '"dono"', 'combate', 'soCenario', 'nomeDoJogador', '"npc"', 'mochila', 'vaga_areia', 'moedas']) expect(texto, proibido).not.toContain(proibido)
    expect(projetada?.valor).toMatchObject({ id: 'pers_crocodile', nome: 'crocodile' })
    const naMochila = gravada({ caminho: ['mochila', 'vaga_areia', 'quantidade'], acao: 'somar', delta: 1 })
    expect(projetarOpParaJogador(naMochila, 'treino')).toBeNull()
    expect(projetarOpParaJogador(gravada({ caminho: ['moedas'], acao: 'somar', delta: 5 }), 'treino')).toBeNull()
    // Na mesa, a mesma mochila continua chegando ao jogador.
    expect(projetarOpParaJogador(naMochila, 'mesa')).toBe(naMochila)
  })

  it('op em campo do mestre ou no NPC da Dragon Ball = null, mesmo em ficha da mesa', () => {
    for (const caminho of [['notaDoMestre'], ['dono'], ['combate'], ['soCenario'], ['nomeDoJogador'], ['dbt', 'npc']]) {
      expect(projetarOpParaJogador(gravada({ caminho, acao: 'definir', valor: 'segredo', antes: 'segredo antigo' }), 'mesa'), caminho.join('/')).toBeNull()
    }
  })
})

describe('o estado e os membros', () => {
  const nomeDaConta = (contaId: string): string | null => MEMBROS.find((membro) => membro.contaId === contaId)?.nome ?? null

  it('jogador: a própria ficha é "minha", a do colega só ver, a sem dono só ver sem nome de dono', () => {
    const daNami = guardada(ficha(F_NAMI, { dono: NAMI.contaId, notaDoMestre: 'x' }))
    const doZoro = guardada(ficha('pers_zoro', { dono: ZORO.contaId }))
    const semDono = guardada(ficha('pers_brook', { nomeDoJogador: 'Brook' }))
    expect(fichaNoEstado(NAMI, daNami, nomeDaConta)).toMatchObject({ ehMinha: true, nomeDoDono: 'Nami', rev: 0, visivel: 'mesa' })
    expect(fichaNoEstado(NAMI, daNami, nomeDaConta)?.doc).not.toHaveProperty('notaDoMestre')
    expect(fichaNoEstado(NAMI, doZoro, nomeDaConta)).toMatchObject({ ehMinha: false, nomeDoDono: 'Zoro' })
    expect(fichaNoEstado(NAMI, semDono, nomeDaConta)).toMatchObject({ ehMinha: false, nomeDoDono: null })
    expect(fichaNoEstado(NAMI, semDono, nomeDaConta)?.doc).not.toHaveProperty('nomeDoJogador')
  })

  it('jogador não recebe ficha escondida nem apagada; o mestre recebe tudo menos a apagada, com o doc completo', () => {
    const escondida = guardada(ficha('pers_arlong', { tipo: 'npc', notaDoMestre: 'Chefe' }), { visivel: 'mestre' })
    const apagada = guardada(ficha('pers_morto', { dono: NAMI.contaId }), { apagada: true })
    expect(fichaNoEstado(NAMI, escondida, nomeDaConta)).toBeNull()
    expect(fichaNoEstado(NAMI, apagada, nomeDaConta)).toBeNull()
    expect(fichaNoEstado(MESTRE, apagada, nomeDaConta)).toBeNull()
    expect(fichaNoEstado(MESTRE, escondida, nomeDaConta)).toMatchObject({ ehMinha: true, doc: { notaDoMestre: 'Chefe' } })
  })

  it('inimigo liberado (T8): o jogador recebe só ver, sem os campos do mestre, a mochila e a bolsa; o mestre recebe o doc completo', () => {
    const doTreino = guardada(fichaCheia(), { visivel: 'treino' })
    const paraNami = fichaNoEstado(NAMI, doTreino, nomeDaConta)
    expect(paraNami).toMatchObject({ ehMinha: false, nomeDoDono: null, visivel: 'treino' })
    for (const campo of [...CAMPOS_DO_MESTRE, 'mochila', 'moedas']) expect(paraNami?.doc, campo).not.toHaveProperty(campo)
    expect(paraNami?.doc.dbt).not.toHaveProperty('npc')
    expect(fichaNoEstado(MESTRE, doTreino, nomeDaConta)?.doc).toMatchObject({ notaDoMestre: 'Trai a tripulação no arco 3', moedas: 40 })
  })

  it('membros para o jogador: sem e-mail e sem os removidos', () => {
    const projetados = projetarMembros(MEMBROS)
    expect(projetados).toEqual([
      { contaId: 'mestre', nome: 'Mestre', papel: 'mestre' },
      { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador' },
      { contaId: 'conta_zoro', nome: 'Zoro', papel: 'jogador' },
    ])
    expect(JSON.stringify(projetados)).not.toContain('@')
  })
})
