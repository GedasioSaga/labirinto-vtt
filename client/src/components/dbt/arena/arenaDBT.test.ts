/**
 * As contas puras da arena Dragon Ball (`stores/arenaDBTStore.ts`): o boneco
 * de treino é lido pela batalha com a CA, o EP e o PV que o mestre deu (e PK
 * 0); a montagem só fica pronta com alguém nos dois lados; cada combatente
 * entra no lado dele; as casas do palco viram as posições do motor; o Judge
 * não nasce em cima de ficha. Fica aqui para morar com as telas da arena.
 */
import { describe, expect, it } from 'vitest'
import { CASA_DA_ARENA, GRADE_PEQUENA } from '../../../lib/arena/tipos'
import { lerFichaParaBatalha } from '../../../lib/dbt/batalha/leitura'
import { SISTEMA_DRAGON_BALL } from '../../../lib/dbt/sistemaDragonBall'
import { novoPersonagem } from '../../../lib/personagem'
import type { Token } from '../../../types/map'
import {
  BONECO_DBT_PADRAO,
  bonecoValido,
  comNumerosDoBoneco,
  entrantesDaArenaDBT,
  fichaDoBonecoDBT,
  ID_DO_TOKEN_DO_JUDGE,
  judgeEmCasaLivre,
  montagemProntaDBT,
  posicoesDaArenaDBT,
  type BonecoDeTreinoDBT,
  type MontagemDaArenaDBT,
} from '../../../stores/arenaDBTStore'

const BONECO: BonecoDeTreinoDBT = { id: 'b1', nome: 'Boneco 1', lado: 'b', ca: 18, pv: 250, ep: 4 }

function token(id: string, characterId: string, col: number, row: number): Token {
  return { id, characterId, name: id, x: (col + 0.5) * CASA_DA_ARENA, y: (row + 0.5) * CASA_DA_ARENA, size: 1, image: null, imageData: null, color: '#4a78c2' }
}

function montagem(parcial: Partial<MontagemDaArenaDBT>): MontagemDaArenaDBT {
  return { escolhas: [], bonecos: [], grade: 'pequena', modo: 'automatico', ...parcial }
}

describe('boneco de treino', () => {
  it('a batalha lê a CA, o EP e o PV dados à mão, com PK 0', () => {
    const ficha = lerFichaParaBatalha(fichaDoBonecoDBT(SISTEMA_DRAGON_BALL, BONECO, 'arena_x'), SISTEMA_DRAGON_BALL)
    expect(ficha).not.toBeNull()
    expect(ficha?.caBase).toBe(18)
    expect(ficha?.epBase).toBe(4)
    expect(ficha?.pv).toEqual({ atual: 250, max: 250 })
    expect(ficha?.pk).toEqual({ atual: 0, max: 0 })
    expect(ficha?.tecnicas).toEqual([])
  })

  it('mexer na CA no meio da luta não enche o PV de volta', () => {
    const ferido = { ...fichaDoBonecoDBT(SISTEMA_DRAGON_BALL, BONECO, 'arena_x') }
    const apanhou = { ...ferido, recursos: { ...ferido.recursos, pv: 40 } }
    const ajustado = comNumerosDoBoneco(apanhou, { ...BONECO, ca: 25 }, false)
    expect(ajustado.recursos.pv).toBe(40)
    expect(lerFichaParaBatalha(ajustado, SISTEMA_DRAGON_BALL)?.caBase).toBe(25)
  })

  it('números fora da faixa voltam para a borda; nome vazio vira "Boneco"', () => {
    expect(bonecoValido({ ...BONECO, nome: '  ', ca: 500, pv: 0, ep: -3 })).toEqual({ ...BONECO, nome: 'Boneco', ca: 99, pv: 1, ep: 0 })
    expect(bonecoValido({ ...BONECO, ca: Number.NaN }).ca).toBe(BONECO_DBT_PADRAO.ca)
  })
})

describe('montagem', () => {
  const ana = { id: 'ana' }

  it('pronta só com alguém (ficha que existe ou boneco) nos dois lados', () => {
    expect(montagemProntaDBT(montagem({ escolhas: [{ personagemId: 'ana', lado: 'a', vezes: 1 }] }), [ana])).toBe(false)
    expect(montagemProntaDBT(montagem({ escolhas: [{ personagemId: 'ana', lado: 'a', vezes: 1 }], bonecos: [BONECO] }), [ana])).toBe(true)
    expect(montagemProntaDBT(montagem({ escolhas: [{ personagemId: 'sumiu', lado: 'a', vezes: 1 }], bonecos: [BONECO] }), [ana])).toBe(false)
  })

  it('só bonecos não fica pronta: a vez giraria sozinha sem fim', () => {
    expect(montagemProntaDBT(montagem({ bonecos: [BONECO, { ...BONECO, id: 'b2', lado: 'a' }] }), [])).toBe(false)
  })
})

describe('luta', () => {
  it('cada combatente entra no lado dele ("A" ou "B"); o jogador continua jogador', () => {
    const goku = { ...novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Goku'), id: 'c-goku' }
    const raditz = { ...novoPersonagem(SISTEMA_DRAGON_BALL, 'npc', 'Raditz'), id: 'c-raditz' }
    const tokens = [token('t1', goku.id, 1, 3), token('t2', raditz.id, 10, 3)]
    const entrantes = entrantesDaArenaDBT(tokens, [goku, raditz], { t1: 'a', t2: 'b' })
    expect(entrantes).toEqual([
      { tokenId: 't1', personagemId: 'c-goku', nome: 't1', lado: 'A', npc: false },
      { tokenId: 't2', personagemId: 'c-raditz', nome: 't2', lado: 'B', npc: true },
    ])
  })

  it('as casas do palco viram as posições do motor (1,5 m por casa)', () => {
    const posicoes = posicoesDaArenaDBT([token('t1', 'x', 2, 5)])
    expect(posicoes.metrosPorCasa).toBe(1.5)
    expect(posicoes.tokens.get('t1')).toEqual({ col: 2, row: 5, tamanho: 1 })
  })

  it('o Judge não nasce em cima de ficha, e o id dele não colide com o das fichas', () => {
    const ocupada = token('arena_tok_1', 'x', 4, 4)
    const judge = judgeEmCasaLivre({ x: ocupada.x, y: ocupada.y }, [ocupada], GRADE_PEQUENA)
    expect(judge).not.toEqual({ x: ocupada.x, y: ocupada.y })
    expect(Math.max(Math.abs(judge.x - ocupada.x), Math.abs(judge.y - ocupada.y))).toBe(CASA_DA_ARENA)
    expect(ID_DO_TOKEN_DO_JUDGE).not.toMatch(/^arena_tok_\d+$/)
  })
})
