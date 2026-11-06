import type { AvisoDeProgresso, ComparacaoDeBuild, PedidoDaSerie, PedidoDeComparacao, ResultadoDaSerie } from './cemLutas'
import { respostaDoFio, type PedidoAoWorker, type RespostaDoWorker } from './protocoloDasLutas'

/**
 * O LADO DA PÁGINA DAS 100 LUTAS (LOBBY v2, fatia T4 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): abre o worker
 * (`lutas.worker.ts`), manda o pedido, repassa o progresso e entrega o
 * resultado. Um worker por pedido, fechado no fim: as lutas são um laço
 * síncrono lá dentro, então "cancelar" é fechar o worker na hora.
 *
 * A promessa nunca rejeita: a saída diz se deu certo, se foi cancelada ou se
 * falhou (com o motivo), e a tela mostra cada caso.
 *
 * Não importa o motor da luta (só tipos e a leitura da resposta): a batalha
 * entra no pacote do worker, não no da página.
 */

/** O que este arquivo usa do `Worker` do navegador (o teste dá um falso que atende na mesma thread). */
export interface CanalDasLutas {
  postMessage(pedido: PedidoAoWorker): void
  terminate(): void
  onmessage: ((evento: MessageEvent) => void) | null
  onerror: ((evento: ErrorEvent) => void) | null
}

export type SaidaDasLutas<T> =
  /** `ms` = o tempo das lutas medido no worker. */
  | { ok: true; valor: T; ms: number }
  | { ok: false; motivo: 'cancelado' | 'falhou'; detalhe: string }

export interface LutasNoWorker<T> {
  saida: Promise<SaidaDasLutas<T>>
  /** Fecha o worker e resolve a saída como `cancelado`; depois do fim, não faz nada. */
  cancelar(): void
}

/** O worker de verdade. O `new URL(..., import.meta.url)` é o que o Vite reconhece para empacotar o worker à parte. */
export function abrirWorkerDasLutas(): CanalDasLutas {
  return new Worker(new URL('./lutas.worker.ts', import.meta.url), { type: 'module' })
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Um pedido num worker novo; `valorDa` tira da resposta final o valor esperado (`null` = resposta de outro tipo). */
function executarNoWorker<T>(
  pedido: PedidoAoWorker,
  valorDa: (resposta: RespostaDoWorker) => T | null,
  aviso: AvisoDeProgresso | undefined,
  abrir: () => CanalDasLutas,
): LutasNoWorker<T> {
  let encerrar: (fim: SaidaDasLutas<T>) => void = () => undefined
  const saida = new Promise<SaidaDasLutas<T>>((resolver) => {
    let canal: CanalDasLutas
    try {
      canal = abrir()
    } catch (erro) {
      // Ex.: o navegador recusa o worker (CSP, arquivo que não carrega).
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
      const resposta = respostaDoFio(evento.data)
      if (resposta === null) return encerrar({ ok: false, motivo: 'falhou', detalhe: 'resposta do worker das lutas com forma inválida' })
      if (resposta.tipo === 'progresso') return aviso?.(resposta.feitas, resposta.total)
      if (resposta.tipo === 'erro') return encerrar({ ok: false, motivo: 'falhou', detalhe: resposta.motivo })
      const valor = valorDa(resposta)
      encerrar(valor === null ? { ok: false, motivo: 'falhou', detalhe: `resposta "${resposta.tipo}" ao pedido "${pedido.tipo}"` } : { ok: true, valor, ms: resposta.ms })
    }
    canal.onerror = (evento) => {
      // O erro já vira a saída: sem isto o navegador o repete no console como erro não tratado.
      evento.preventDefault()
      encerrar({ ok: false, motivo: 'falhou', detalhe: evento.message || 'o worker das lutas parou com erro' })
    }
    canal.postMessage(pedido)
  })
  return { saida, cancelar: () => encerrar({ ok: false, motivo: 'cancelado', detalhe: 'lutas canceladas' }) }
}

/** As 100 lutas da semente num worker. */
export function rodarSerieNoWorker(pedido: PedidoDaSerie, aviso?: AvisoDeProgresso, abrir: () => CanalDasLutas = abrirWorkerDasLutas): LutasNoWorker<ResultadoDaSerie> {
  return executarNoWorker({ tipo: 'serie', pedido }, (resposta) => (resposta.tipo === 'serie' ? resposta.resultado : null), aviso, abrir)
}

/** A build atual contra o rascunho, nas mesmas 100 sementes, num worker. */
export function compararBuildNoWorker(pedido: PedidoDeComparacao, aviso?: AvisoDeProgresso, abrir: () => CanalDasLutas = abrirWorkerDasLutas): LutasNoWorker<ComparacaoDeBuild> {
  return executarNoWorker({ tipo: 'comparar', pedido }, (resposta) => (resposta.tipo === 'comparar' ? resposta.comparacao : null), aviso, abrir)
}
