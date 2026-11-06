// @vitest-environment node
/**
 * O TEMPO DAS 100 LUTAS (LOBBY v2, fatia T4; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): tempo impresso, alvo
 * ≤ 5 s, teto 15 s. Grupo `desempenho` do vitest (client/vitest.projetos.json):
 * roda sozinho e em série, porque tempo medido sob carga mente.
 *
 * Mede o atendimento do worker (`atenderPedido`: relê o pedido e roda as
 * lutas), sem a thread. Dois casos: o 2×1 de sempre e o 6×6 em espelho (as
 * 12 vagas, lado contra lado do mesmo tamanho: lutas longas, que acabam por
 * nocaute).
 *
 * Fora daqui, o pior caso (6×6 que só acaba no teto de 30 rodadas, 1440
 * passos por luta) mediu 4,8 s com o processo em prioridade alta e 20 a 40 s
 * em prioridade normal (06/11/2026): neste Windows o processo de segundo
 * plano é rebaixado depois de ~3 s de CPU, e qualquer laço fica ~8× mais
 * lento. Um teste com ele reprovaria pela máquina, não pelo código.
 */
import { describe, expect, it } from 'vitest'
import { atenderPedido } from './atendimentoDasLutas'
import type { PedidoDaSerie } from './cemLutas'
import { doisContraUm, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import type { EscolhaDaVaga } from './mesaEmMemoria'
import type { RespostaDoWorker } from './protocoloDasLutas'

const ALVO_MS = 5_000
const TETO_MS = 15_000

/** As 100 lutas pelo atendimento do worker: o tempo de fora (com a releitura do pedido). */
function medirSerie(nome: string, pedido: PedidoDaSerie): number {
  const finais: RespostaDoWorker[] = []
  const inicio = performance.now()
  atenderPedido({ tipo: 'serie', pedido }, (resposta) => {
    if (resposta.tipo !== 'progresso') finais.push(resposta)
  }, () => performance.now())
  const ms = performance.now() - inicio
  const [resposta] = finais
  if (finais.length !== 1 || resposta.tipo !== 'serie') throw new Error(`a série ${nome} não deu um resultado só: ${JSON.stringify(finais)}`)
  const situacao = ms <= ALVO_MS ? 'dentro do alvo' : ms <= TETO_MS ? 'ACIMA DO ALVO, abaixo do teto' : 'ACIMA DO TETO'
  console.info(`[T4 desempenho] 100 lutas ${nome}: ${Math.round(ms)} ms (${situacao}; alvo ${ALVO_MS} ms, teto ${TETO_MS} ms)`)
  return ms
}

describe('tempo das 100 lutas', () => {
  it('2×1 (Zé e Lia contra o Marinheiro): abaixo do teto', { timeout: TETO_MS * 2 }, () => {
    expect(medirSerie('2×1', { sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(), semente: 1 })).toBeLessThanOrEqual(TETO_MS)
  })

  it('6×6 em espelho (as 12 vagas): abaixo do teto', { timeout: TETO_MS * 2 }, () => {
    const lado = (ladoDaVaga: EscolhaDaVaga['lado']): EscolhaDaVaga[] => Array.from({ length: 6 }, () => ({ ficha: MARINHEIRO, lado: ladoDaVaga }))
    expect(medirSerie('6×6 em espelho', { sistema: SISTEMA_DO_TESTE, lutadores: lutadoresDe([...lado('a'), ...lado('b')]), semente: 1 })).toBeLessThanOrEqual(TETO_MS)
  })
})
