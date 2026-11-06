// @vitest-environment node
/**
 * AS 100 LUTAS E O COMPARAR BUILD (LOBBY v2, fatia T4; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): 100 lutas com a semente 1
 * dão o mesmo resultado duas vezes e vitórias + empates = 100. Ambiente node:
 * o motor do treino roda num worker, sem DOM.
 */
import { describe, expect, it } from 'vitest'
import { compararBuild, LUTAS_DA_SERIE, rodarSerie, type PedidoDaSerie } from './cemLutas'
import { doisContraUm, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { lutaAutomatica } from './lutaAutomatica'
import type { LadoDoTreino } from './mesaEmMemoria'

describe('100 lutas do treino', () => {
  it('a semente 1 dá o mesmo resultado 2×, vitórias + empates = 100, cada luta com a sua semente', () => {
    const pedido: PedidoDaSerie = { sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(), semente: 1 }
    const primeira = rodarSerie(pedido)
    expect(rodarSerie(pedido)).toEqual(primeira)

    const { vitorias, empates, lutas } = primeira
    expect(vitorias.a + vitorias.b + empates.todosCaidos + empates.tempo).toBe(LUTAS_DA_SERIE)
    expect(lutas).toHaveLength(LUTAS_DA_SERIE)
    // Sem isto, 100 lutas na MESMA semente passariam nas duas contas acima.
    expect(new Set(lutas.map((luta) => luta.semente)).size).toBe(LUTAS_DA_SERIE)
    // "Repetir esta luta": a semente guardada refaz a luta com o mesmo fim.
    const luta = lutas[37]
    expect(lutaAutomatica({ sistema: SISTEMA_DO_TESTE, lutadores: pedido.lutadores, semente: luta.semente }).fim).toEqual(luta.fim)
  })

  it('comparar build: as mesmas sementes nas duas séries; rascunho igual = diferença 0; mais Força = mais vitórias', () => {
    const lado: LadoDoTreino = 'a'
    const igual = compararBuild({ sistema: SISTEMA_DO_TESTE, atual: doisContraUm(60), rascunho: doisContraUm(60), lado, semente: 1 })
    expect(igual.rascunho).toEqual(igual.atual)
    expect(igual.diferenca).toBe(0)
    // A série da build atual é a mesma das 100 lutas: o comparar não muda a luta.
    expect(igual.atual).toEqual(rodarSerie({ sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(60), semente: 1 }))

    const forte = compararBuild({ sistema: SISTEMA_DO_TESTE, atual: doisContraUm(60), rascunho: doisContraUm(120), lado, semente: 1 })
    expect(forte.rascunho.lutas.map((luta) => luta.semente)).toEqual(forte.atual.lutas.map((luta) => luta.semente))
    expect(forte.diferenca).toBe(forte.rascunho.vitorias.a - forte.atual.vitorias.a)
    expect(forte.diferenca, `atual ${JSON.stringify(forte.atual.vitorias)}, rascunho ${JSON.stringify(forte.rascunho.vitorias)}`).toBeGreaterThan(0)
  })
})
