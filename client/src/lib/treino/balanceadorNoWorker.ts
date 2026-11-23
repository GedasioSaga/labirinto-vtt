import type { BalancoDaSerie, PropostaDoAchar } from './balanceadorComum'
import type { SaidaDasLutas } from './lutasNoWorker'
import { respostaDoBalanceador, type PedidoAoBalanceador, type RespostaDoBalanceador } from './protocoloDoBalanceador'

/**
 * O LADO DA PÁGINA DO BALANCEADOR: abre o worker, manda o pedido, repassa o
 * progresso e entrega a saída. A promessa nunca rejeita (como
 * `lutasNoWorker.ts`): diz se deu certo, se foi cancelada ou se falhou.
 */

export interface CanalDoBalanceador {
  postMessage(pedido: PedidoAoBalanceador): void
  terminate(): void
  onmessage: ((evento: MessageEvent) => void) | null
  onerror: ((evento: ErrorEvent) => void) | null
}

export type ProgressoDoBalanceador = (feitas: number, total: number, fase: string) => void

export interface BalanceadorNoWorker<T> {
  saida: Promise<SaidaDasLutas<T>>
  cancelar(): void
}

export function abrirWorkerDoBalanceador(): CanalDoBalanceador {
  return new Worker(new URL('./balanceador.worker.ts', import.meta.url), { type: 'module' })
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function executar<T>(
  pedido: PedidoAoBalanceador,
  valorDa: (resposta: RespostaDoBalanceador) => T | null,
  progresso: ProgressoDoBalanceador,
  abrir: () => CanalDoBalanceador,
): BalanceadorNoWorker<T> {
  let encerrar: (fim: SaidaDasLutas<T>) => void = () => undefined
  const saida = new Promise<SaidaDasLutas<T>>((resolver) => {
    let canal: CanalDoBalanceador
    try {
      canal = abrir()
    } catch (erro) {
      resolver({ ok: false, motivo: 'falhou', detalhe: textoDoErro(erro) })
      return
    }
    let aberto = true
    encerrar = (fim) => {
      if (!aberto) return
      aberto = false
      canal.onmessage = null
      canal.onerror = null
      canal.terminate()
      resolver(fim)
    }
    canal.onmessage = (evento) => {
      const resposta = respostaDoBalanceador(evento.data)
      if (resposta === null) return encerrar({ ok: false, motivo: 'falhou', detalhe: 'resposta do balanceador com forma inválida' })
      if (resposta.tipo === 'progresso') return progresso(resposta.feitas, resposta.total, resposta.fase)
      if (resposta.tipo === 'erro') return encerrar({ ok: false, motivo: 'falhou', detalhe: resposta.motivo })
      const valor = valorDa(resposta)
      const ms = resposta.ms
      encerrar(valor === null ? { ok: false, motivo: 'falhou', detalhe: `resposta "${resposta.tipo}" ao pedido "${pedido.tipo}"` } : { ok: true, valor, ms })
    }
    canal.onerror = (evento) => {
      evento.preventDefault()
      encerrar({ ok: false, motivo: 'falhou', detalhe: evento.message || 'o worker do balanceador parou com erro' })
    }
    canal.postMessage(pedido)
  })
  return { saida, cancelar: () => encerrar({ ok: false, motivo: 'cancelado', detalhe: 'cancelado' }) }
}

/** O "Testar": N lutas com os contadores. */
export function testarNoWorker(
  pedido: Extract<PedidoAoBalanceador, { tipo: 'balanco' }>,
  progresso: ProgressoDoBalanceador,
  abrir: () => CanalDoBalanceador = abrirWorkerDoBalanceador,
): BalanceadorNoWorker<BalancoDaSerie> {
  return executar(pedido, (resposta) => (resposta.tipo === 'balanco' ? resposta.balanco : null), progresso, abrir)
}

/** O "Achar os números". */
export function acharNoWorker(
  pedido: Extract<PedidoAoBalanceador, { tipo: 'achar' }>,
  progresso: ProgressoDoBalanceador,
  abrir: () => CanalDoBalanceador = abrirWorkerDoBalanceador,
): BalanceadorNoWorker<PropostaDoAchar> {
  return executar(pedido, (resposta) => (resposta.tipo === 'achar' ? resposta.proposta : null), progresso, abrir)
}
