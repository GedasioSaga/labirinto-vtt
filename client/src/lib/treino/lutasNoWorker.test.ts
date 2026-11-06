// @vitest-environment node
/**
 * AS 100 LUTAS PELO WORKER (LOBBY v2, fatia T4): a página manda o pedido, o
 * worker atende (`atenderPedido`) e devolve o progresso e o resultado. Aqui o
 * "worker" é um canal falso na mesma thread que copia o pedido e cada resposta
 * com `structuredClone`, como o `postMessage` faz; o worker de verdade é só
 * `lutas.worker.ts` (três linhas) em volta do mesmo atendimento.
 */
import { describe, expect, it } from 'vitest'
import { atenderPedido } from './atendimentoDasLutas'
import { rodarSerie, type PedidoDaSerie } from './cemLutas'
import { doisContraUm, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { rodarSerieNoWorker, type CanalDasLutas } from './lutasNoWorker'
import type { PedidoAoWorker } from './protocoloDasLutas'

/** Canal que atende na volta do laço de eventos (como a mensagem de um worker) e para de responder no `terminate`. */
function canalNaMesmaThread(): { abrir: () => CanalDasLutas; fechados: () => number } {
  let fechados = 0
  const abrir = (): CanalDasLutas => {
    let vivo = true
    const canal: CanalDasLutas = {
      onmessage: null,
      onerror: null,
      terminate: () => {
        if (vivo) fechados += 1
        vivo = false
      },
      postMessage: (pedido: PedidoAoWorker) => {
        const copia = structuredClone(pedido)
        setTimeout(() => {
          if (!vivo) return
          atenderPedido(copia, (resposta) => (vivo ? canal.onmessage?.(new MessageEvent('message', { data: structuredClone(resposta) })) : undefined), () => performance.now())
        }, 0)
      },
    }
    return canal
  }
  return { abrir, fechados: () => fechados }
}

function pedidoDoDoisContraUm(semente: number): PedidoDaSerie {
  return { sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(), semente }
}

/** 200 lutas (o worker e o rodarSerie de conferência): ~1,2 s sozinho; o teto evita reprovar pela máquina no grupo 'rapido'. */
const TETO_DO_TESTE_MS = 30_000

describe('100 lutas pelo worker', () => {
  it('dá o mesmo resultado do rodarSerie direto, avisa de 1 a 100 e fecha o worker', { timeout: TETO_DO_TESTE_MS }, async () => {
    const pedido = pedidoDoDoisContraUm(1)
    const canal = canalNaMesmaThread()
    const avisos: string[] = []
    const saida = await rodarSerieNoWorker(pedido, (feitas, total) => avisos.push(`${feitas}/${total}`), canal.abrir).saida
    if (!saida.ok) throw new Error(`a série falhou: ${saida.detalhe}`)
    // Relido pelo worker (personagemDoArquivo, lerSistemaDeRpg) e pela página (respostaDoFio): nada muda a luta.
    expect(saida.valor).toEqual(rodarSerie(pedido))
    expect(saida.ms).toBeGreaterThan(0)
    expect(avisos).toEqual(Array.from({ length: 100 }, (_, indice) => `${indice + 1}/100`))
    expect(canal.fechados()).toBe(1)
  })

  it('ficha torta, semente torta e cancelar viram saída (nunca exceção) e fecham o worker', async () => {
    const canal = canalNaMesmaThread()
    const base = pedidoDoDoisContraUm(1)
    const [primeira, ...resto] = base.lutadores.personagens
    const semId = { ...base.lutadores, personagens: [{ ...primeira, id: '' }, ...resto] }
    expect(await rodarSerieNoWorker({ ...base, lutadores: semId }, undefined, canal.abrir).saida).toEqual({ ok: false, motivo: 'falhou', detalhe: 'pedido das lutas com forma inválida' })
    expect(await rodarSerieNoWorker(pedidoDoDoisContraUm(-1), undefined, canal.abrir).saida).toEqual({ ok: false, motivo: 'falhou', detalhe: 'semente da série do treino inválida: -1' })

    const avisos: number[] = []
    const execucao = rodarSerieNoWorker(base, (feitas) => avisos.push(feitas), canal.abrir)
    execucao.cancelar()
    expect(await execucao.saida).toEqual({ ok: false, motivo: 'cancelado', detalhe: 'lutas canceladas' })
    expect(avisos).toEqual([])
    expect(canal.fechados()).toBe(3)
  })
})
