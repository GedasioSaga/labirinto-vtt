import { describe, expect, it } from 'vitest'
import { combateVazio, type GolpeDaBatalha, type SeloDaBatalha } from './combate'
import { motivoDoContador, temGolpeEsperando } from './contador'
import { debuffsDobrados, debuffsDoToken } from './debuffs'
import { comADisputaNoUso } from './disputaNoUso'
import { sistema } from './fichasDaFatiaB.testkit'
import { ARMADURA, EXPLOSAO, GIRO, guilherme, IGNICAO, KMH, LANCA, PROJECAO, RESILIENTE, REVIGORAR, vagnCom } from './fichasDaFatiaD.testkit'
import { danoDoAtaque, lerDano } from './formula'
import type { GolpeLancado } from './golpe'
import { danoDaTecnica, danoDaTecnicaComAVida } from './leituraDaTecnica'
import { disputaNoUso, limpezaDe, motivoDaRespostaVetada, perfuranteDaMecanica, seloDaMecanica } from './mecanicasAMao'
import { danoQueChega } from './reacao'
import { motivoDaReacaoComTecnica, reagirComTecnica } from './reacaoComTecnica'
import { NOME_DO_CANSACO, ORIGEM_DO_CANSACO } from './recursosDaBatalha'
import { danoComAsReducoes, reducoesDoDano } from './reducaoDoDano'
import { comAtaqueExtra, formaNaVez, usosDaForma } from './transformacao'

/**
 * Conserto das fichas F2, fatia D (Vagn Kane e Guilherme): as regras com os
 * cartões e atributos REAIS (rpg.json de 08/11). Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */

/** Um golpe de 100 de dano esperando a reação de `tokenId`. */
function golpeEm(tokenId: string, personagemId: string, dano = 100): GolpeDaBatalha {
  return { id: 'g1', linhaId: 'l1', cartaId: 'c-npc', rodada: 1, atacanteTokenId: 't-npc', atacantePersonagemId: null, autor: { tipo: 'mestre' }, nome: 'Soco', surpresa: false, overload: false, perfurante: false, alvos: [{ tokenId, personagemId, dano, podeReagir: true }] }
}

function selo(id: string, nome: string, turnos: number | null, extra: Partial<SeloDaBatalha> = {}): SeloDaBatalha {
  return { id, tokenId: 't-alvo', nome, turnos, total: turnos, ...extra }
}

const d20 = (valor: number) => () => valor

describe('Vagn: Projeção Letal (cortante ou perfurante, Imbuir Fogo)', () => {
  it('cortante põe Sangramento 10 por 3 turnos e passa pelo Escudo; perfurante vai direto no HP', () => {
    expect(seloDaMecanica(PROJECAO.id, { corte: 'cortante', fogo: 'nao' })).toEqual({ nome: 'Sangramento', turnos: 3, natureza: 'debuff' })
    expect(perfuranteDaMecanica(PROJECAO.id, { corte: 'cortante', fogo: 'nao' })).toBe(false)
    expect(perfuranteDaMecanica(PROJECAO.id, { corte: 'perfurante', fogo: 'nao' })).toBe(true)
    expect(seloDaMecanica(PROJECAO.id, { corte: 'perfurante', fogo: 'nao' })).toBeNull()
  })

  it('Espírito 35 + 20 = 55; com o fogo 65, sem custo; com a Ignição ligada o fogo é recusado', () => {
    const vagn = vagnCom()
    expect(danoDaTecnica(PROJECAO, { personagem: vagn, sistema, arma: null }, { corte: 'cortante', fogo: 'nao' })).toMatchObject({ valor: 55 })
    expect(danoDaTecnica(PROJECAO, { personagem: vagn, sistema, arma: null }, { corte: 'cortante', fogo: 'sim' })).toMatchObject({ valor: 65 })
    expect(motivoDaRespostaVetada(PROJECAO.id, { corte: 'cortante', fogo: 'sim' }, [])).toBeNull()
    expect(motivoDaRespostaVetada(PROJECAO.id, { corte: 'cortante', fogo: 'sim' }, [IGNICAO.id])).toContain('Ignição')
  })
})

describe('Vagn: Polaridade', () => {
  it('Concentração 3 multiplica o todo: (55 + 30) x 3,5 = 297; com golpe esperando a reação dele, não carrega', () => {
    expect(danoQueChega(55 + 30, 3, false)).toBe(297)
    const esperando = golpeEm('t-vagn', 'p-vagn')
    expect(temGolpeEsperando([esperando], 't-vagn')).toBe(true)
    expect(motivoDoContador('ganhar', 0, 3, false, temGolpeEsperando([esperando], 't-vagn'))).toBe('golpeEsperando')
    const respondido: GolpeDaBatalha = { ...esperando, alvos: esperando.alvos.map((alvo) => ({ ...alvo, saida: 'cheio', danoFinal: 100 })) }
    expect(temGolpeEsperando([respondido], 't-vagn')).toBe(false)
  })
})

describe('Vagn: Armadura Humana na reação', () => {
  const pedido = (saida: 'cheio' | 'contra' | 'metade') => ({ tipo: 'tecnica' as const, golpeId: 'g1', tokenId: 't-vagn', cartaoId: ARMADURA.id, saida, custo: null })

  it('Harvey acerta 100: Defender toma 90; Atacar toma 100 e devolve ÷ 7; outra saída é recusada', () => {
    const vagn = vagnCom()
    const defender = reagirComTecnica(golpeEm('t-vagn', vagn.id), 't-vagn', pedido('cheio'), vagn, sistema, combateVazio(), null)
    expect(defender?.alvo).toMatchObject({ saida: 'cheio', danoFinal: 90 })
    expect(defender?.devolveDividido).toBeUndefined()
    const atacar = reagirComTecnica(golpeEm('t-vagn', vagn.id), 't-vagn', pedido('contra'), vagn, sistema, combateVazio(), null)
    expect(atacar?.alvo).toMatchObject({ saida: 'cheio', danoFinal: 100 })
    expect(atacar?.devolveDividido).toBe(7)
    expect(Math.floor((atacar?.alvo.danoFinal ?? 0) / 7)).toBe(14)
    expect(motivoDaReacaoComTecnica({ personagem: vagn, sistema, combate: undefined }, golpeEm('t-vagn', vagn.id).alvos[0] ?? { podeReagir: false }, pedido('metade'))).toBe('Saída que a técnica não dá')
  })

  it('Resiliente vale o combate inteiro (sem olhar SP nem Escudo): Defender com ele = −28% (100 → 72)', () => {
    const vagn = { ...vagnCom([RESILIENTE.id]), recursos: { hp: 1000, sp: 0, escudo: 0 } }
    expect(danoComAsReducoes(90, reducoesDoDano(vagn, sistema))).toBe(72)
  })
})

describe('Vagn: Ignição', () => {
  it('liga sem limite; o ataque adicional só 2 vezes na batalha inteira (trocar de forma não renova)', () => {
    expect(usosDaForma(IGNICAO)).toBeNull()
    const vagn = vagnCom([IGNICAO.id])
    expect(formaNaVez(vagn, sistema, combateVazio(), 1)).toMatchObject({ aMais: 2, ataquesExtras: { total: 1, usados: 0 } })
    const depoisDeDois = comAtaqueExtra(comAtaqueExtra(combateVazio(), 1, IGNICAO.id), 2, IGNICAO.id)
    expect(depoisDeDois.usos[IGNICAO.id]).toBe(2)
    expect(formaNaVez(vagn, sistema, depoisDeDois, 3).ataquesExtras).toBeUndefined()
  })
})

describe('Guilherme: Lança 20', () => {
  it('Atacar 110, Giro da Lança 130, 10.000 Km/h 315', () => {
    expect(danoDoAtaque({ personagem: guilherme, sistema, arma: LANCA, vidaDoAlvo: null })).toMatchObject({ valor: 110 })
    expect(danoDaTecnica(GIRO, { personagem: guilherme, sistema, arma: LANCA })).toMatchObject({ valor: 130 })
    expect(danoDaTecnica(KMH, { personagem: guilherme, sistema, arma: LANCA })).toMatchObject({ valor: 315 })
  })
})

describe('Guilherme: Giro da Lança na reação', () => {
  const pedido = { tipo: 'tecnica' as const, golpeId: 'g1', tokenId: 't-gui', cartaoId: GIRO.id, saida: 'rolar' as const, custo: null }

  it('o +1 (o maior entre FOR e AGI) entra sozinho: d20 9 = 10 anula tudo; d20 8 = 9 toma cheio', () => {
    const anulou = reagirComTecnica(golpeEm('t-gui', guilherme.id), 't-gui', pedido, guilherme, sistema, combateVazio(), 9)
    expect(anulou?.alvo).toMatchObject({ rolagem: { d20: 9, modificador: 1, total: 10 }, saida: 'esquiva', danoFinal: 0 })
    const tomou = reagirComTecnica(golpeEm('t-gui', guilherme.id), 't-gui', { ...pedido, modificador: 5 }, guilherme, sistema, combateVazio(), 8)
    expect(tomou?.alvo).toMatchObject({ rolagem: { total: 9 }, saida: 'cheio', danoFinal: 100 })
  })
})

describe('Guilherme: Explosão', () => {
  const disputa = disputaNoUso(EXPLOSAO.id)
  const alvo = { ...guilherme, id: 'p-alvo' }
  const lancado = (): GolpeLancado => ({
    golpe: { ...golpeEm('t-alvo', 'p-alvo', 200), atacanteTokenId: 't-gui', atacantePersonagemId: guilherme.id, perfurante: true, alvos: [{ tokenId: 't-alvo', personagemId: 'p-alvo', dano: 200, podeReagir: false, saida: 'semReacao', danoFinal: 200 }] },
    resolvidos: [],
    gasto: null,
    combate: { ...combateVazio(), usos: { [EXPLOSAO.id]: 1 }, gastouSp: true },
    custo: [{ parte: 'recurso', chave: 'sp', valor: 25 }],
    contraUsado: null,
    acao: 'completa',
    cargaUsada: 0,
  })
  const ctx = (valor: number) => ({ usa: { personagem: guilherme }, fichaDoAlvo: () => ({ personagem: alvo }), combateAntes: combateVazio(), sistema, carga: 0, rolarD20: d20(valor) })

  it('10% da vida ATUAL do alvo (2.000 → 200) direto no HP; o alvo passa (d20 10 + 1 = 11 contra CD 11): nada, e não gasta SP nem uso', () => {
    if (disputa === null) throw new Error('Explosão sem disputa ao usar')
    expect(danoDaTecnicaComAVida(EXPLOSAO, { personagem: guilherme, sistema, arma: null }, { atual: 2000, maximo: 2000 })).toMatchObject({ valor: 200 })
    const passou = comADisputaNoUso(lancado(), disputa, ctx(10))
    expect(passou.naoGastou).toBe(true)
    expect(passou.lancado.custo).toEqual([])
    expect(passou.lancado.combate?.usos).toEqual({})
    expect(passou.lancado.golpe?.alvos[0]).toMatchObject({ danoFinal: 0, semDano: true })
  })

  it('o alvo falha (d20 5 + 1 = 6): toma os 200 e os debuffs dobram os turnos (Atordoado 2 → 4, Queimando 1 → 2; a Bênção fica)', () => {
    if (disputa === null) throw new Error('Explosão sem disputa ao usar')
    const falhou = comADisputaNoUso(lancado(), disputa, ctx(5))
    expect(falhou.venceuEm).toEqual(['t-alvo'])
    expect(falhou.lancado.custo).toHaveLength(1)
    expect(falhou.lancado.golpe?.alvos[0]?.danoFinal).toBe(200)
    expect(disputa.seQuemUsaVence?.dobraOsDebuffs).toBe(true)
    const selos = [selo('s1', 'Atordoado', 2, { natureza: 'debuff' }), selo('s2', 'Queimando', 1), selo('s3', 'Bênção de uma Raposa', 3, { natureza: 'buff' })]
    expect(debuffsDobrados(selos, 't-alvo').map(({ depois }) => [depois.nome, depois.turnos])).toEqual([
      ['Atordoado', 4],
      ['Queimando', 2],
    ])
  })
})

describe('Guilherme: Revigorar', () => {
  it('tira todos os debuffs, até o cansaço do Overload (não o buff nem a Polaridade), e cura o Espírito (100)', () => {
    const selos = [selo('s1', 'Atordoado', 2, { natureza: 'debuff' }), selo('s2', NOME_DO_CANSACO, null, { origem: ORIGEM_DO_CANSACO }), selo('s3', 'Bênção de uma Raposa', 3, { natureza: 'buff' }), selo('s4', 'Polaridade', null, { contador: 2 })]
    expect(debuffsDoToken(selos, 't-alvo').map((daLista) => daLista.id)).toEqual(['s1', 's2'])
    const cura = limpezaDe(REVIGORAR.id)?.cura ?? ''
    expect(lerDano(cura, { personagem: guilherme, sistema, arma: null, vidaDoAlvo: null })).toMatchObject({ valor: 100 })
  })
})
