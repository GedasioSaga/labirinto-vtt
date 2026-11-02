/**
 * Fio da batalha DBT (docs/planos/dbt-batalha.md, seção 17): número de dado
 * no pedido é ignorado, extras fora do intervalo derrubam o pedido, e o
 * leitor estrito do jogador recusa vida de NPC e campo torto.
 */
import { describe, expect, it } from 'vitest'
import { SISTEMA_DRAGON_BALL } from '../lib/dbt/sistemaDragonBall'
import { novoPersonagem } from '../lib/personagem'
import {
  ALIADOS_DBT_MAX,
  lerVistaDBT,
  parseBatalhaDBTAgir,
  parseBatalhaDBTAliados,
  parseBatalhaDBTEfeitos,
  parseBatalhaDBTPlayerMessage,
  parseBatalhaDBTResponder,
} from './protocoloDaBatalhaDBT'

const VISTA = {
  fase: 'combate',
  rodada: 1,
  modo: 'automatico',
  vez: 't-goku',
  minhaVez: true,
  turno: { n: 1, m: 2 },
  cartas: [
    { tokenId: 't-goku', nome: 'Goku', lado: 'eu', iniciativa: 22, pv: { atual: 30, max: 30 }, pk: { atual: 20, max: 20 }, condicoes: [], transformacao: null, voo: 0, situacao: 'de-pe', agarrado: false, agarradoPor: null },
    { tokenId: 't-raditz', nome: 'Saiyajin', lado: 'outro', iniciativa: 5, pv: null, pk: null, condicoes: [{ id: 'c1', condicao: 'caido', nome: 'Caído' }], transformacao: null, voo: 0, situacao: 'de-pe', agarrado: false, agarradoPor: null },
  ],
  meus: [],
  declaracoes: [],
  pendencias: [],
  janela: null,
  aguardando: null,
  registro: [{ id: 'l1', rodada: 1, tipo: 'inicio', autor: 'Mestre', texto: 'O combate começa: rodada 1', detalhes: [], desfeita: false, podeDesfazer: false }],
}

describe('protocoloDaBatalhaDBT', () => {
  it('ignora o d20 que o jogador mandou no pedido', () => {
    const msg = parseBatalhaDBTAgir({ type: 'batalhaDBT.agir', reqId: 'r1', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'tecnica:x', alvos: ['t-raditz'], d20: 20, total: 99 })
    expect(msg).toEqual({ type: 'batalhaDBT.agir', reqId: 'r1', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'tecnica:x', alvos: ['t-raditz'] })
  })

  it('recusa alvo repetido e extras fora do intervalo', () => {
    const base = { type: 'batalhaDBT.agir', reqId: 'r1', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'tecnica:x' }
    expect(parseBatalhaDBTAgir({ ...base, alvos: ['a', 'a'] })).toBeNull()
    expect(parseBatalhaDBTAgir({ ...base, alvos: [], extras: { cargasKi: 6 } })).toBeNull()
    expect(parseBatalhaDBTAgir({ ...base, alvos: [], extras: { basicos: 3 } })).toBeNull()
    expect(parseBatalhaDBTAgir({ ...base, alvos: [], extras: { nivelDeVoo: 2 } })?.extras).toEqual({ nivelDeVoo: 2 })
  })

  it('responder aceita aposta 0-10 e atributo des/for, nunca d20', () => {
    const base = { type: 'batalhaDBT.responder', reqId: 'r2', pendenciaId: 'p1', combatenteId: 't-goku', opcao: 'apostar' }
    expect(parseBatalhaDBTResponder({ ...base, aposta: 11 })).toBeNull()
    expect(parseBatalhaDBTResponder({ ...base, atributo: 'con' })).toBeNull()
    expect(parseBatalhaDBTResponder({ ...base, aposta: 2, d20: 20 })).toEqual({ ...base, aposta: 2 })
  })

  it('o despacho só conhece os cinco pedidos', () => {
    expect(parseBatalhaDBTPlayerMessage({ type: 'batalhaDBT.desfazer', reqId: 'r', linhaId: 'l1' })).not.toBeNull()
    expect(parseBatalhaDBTPlayerMessage({ type: 'batalhaDBT.rolarIniciativa', reqId: 'r' })).toBeNull()
  })

  it('o leitor estrito aceita o recorte e recusa vida de NPC', () => {
    expect(lerVistaDBT(VISTA)).not.toBeNull()
    const forjada = { ...VISTA, cartas: [VISTA.cartas[0], { ...VISTA.cartas[1], pv: { atual: 1, max: 50 } }] }
    expect(lerVistaDBT(forjada)).toBeNull()
    expect(lerVistaDBT({ ...VISTA, fase: 'fim' })).toBeNull()
  })

  it('aliados: só jogador, sem dado de mestre, sem bloco de NPC, sem repetir', () => {
    const vegeta = { ...novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Vegeta'), id: 'vegeta' }
    const lida = parseBatalhaDBTAliados({ type: 'batalhaDBT.aliados', personagens: [vegeta] })
    expect(lida?.personagens.map((personagem) => personagem.id)).toEqual(['vegeta'])
    expect(lida?.personagens[0]?.dbt).toBeDefined()
    expect(parseBatalhaDBTAliados({ type: 'batalhaDBT.aliados', personagens: [] })).toEqual({ type: 'batalhaDBT.aliados', personagens: [] })
    const aliados = (...personagens: unknown[]) => parseBatalhaDBTAliados({ type: 'batalhaDBT.aliados', personagens })
    expect(aliados({ ...vegeta, tipo: 'npc' })).toBeNull()
    expect(aliados({ ...vegeta, dono: 'conta-1' })).toBeNull()
    expect(aliados({ ...vegeta, notaDoMestre: 'segredo' })).toBeNull()
    expect(aliados({ ...vegeta, dbt: { ...vegeta.dbt, npc: { nd: 3 } } })).toBeNull()
    expect(aliados({ ...vegeta, dbt: { versao: 999 } })).toBeNull()
    expect(aliados(vegeta, vegeta)).toBeNull()
    expect(aliados({ ...vegeta, id: 'x'.repeat(129) })).toBeNull()
    expect(aliados(...Array.from({ length: ALIADOS_DBT_MAX + 1 }, (_, i) => ({ ...vegeta, id: `v${i}` })))).toBeNull()
  })

  it('efeitos fora de ordem são forjados', () => {
    const efeito = (seq: number) => ({ seq, tipo: 'dano', tokenIds: ['t-goku'], d20: null, faixa: null, numero: 5 })
    expect(parseBatalhaDBTEfeitos({ type: 'batalhaDBT.efeitos', efeitos: [efeito(1), efeito(2)] })).not.toBeNull()
    expect(parseBatalhaDBTEfeitos({ type: 'batalhaDBT.efeitos', efeitos: [efeito(2), efeito(1)] })).toBeNull()
  })
})
