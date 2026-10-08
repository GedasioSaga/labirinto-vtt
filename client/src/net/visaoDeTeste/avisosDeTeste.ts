import type { ToastExtras } from '../../stores/toastStore'
import type { ToastSink } from '../avisosDaPonte'

/**
 * Os avisos da ponte de TESTE (Visão de jogador), por cima da pilha do editor.
 *
 * - `info` (relato: "Ana entrou", "Ana voltou") fica mudo: o mestre está
 *   olhando a própria janela de teste, e o relato só sujaria a pilha da mesa.
 * - `instrucao` (pedido que espera resposta) e `error` passam, com "Teste · "
 *   na frente, para nunca se passarem por coisa da mesa de verdade. O pedido
 *   vai para a caixa própria "Pedidos do teste", aberta mesmo com um só, fora
 *   do "Deixar todos" dos pedidos reais; a chave ganha `teste:` para nunca
 *   fundir com um aviso real de mesma chave.
 * - Fechar o teste tira da tela tudo o que ele pôs (`dispensarTodos`).
 */

export const PREFIXO_DO_TESTE = 'Teste · '
export const GRUPO_DO_TESTE = 'Pedidos do teste'

export interface AvisosDeTeste extends ToastSink {
  /** Tira da tela todo aviso que este teste pôs e ainda está lá. */
  dispensarTodos(): void
}

function extrasDoTeste(extras: ToastExtras | undefined, pedido: boolean): ToastExtras {
  const base: ToastExtras = { ...extras }
  if (extras?.chave !== undefined) base.chave = `teste:${extras.chave}`
  if (!pedido) return base
  return { ...base, grupo: GRUPO_DO_TESTE, sempreEmCaixa: true }
}

export function criarAvisosDeTeste(pilha: ToastSink): AvisosDeTeste {
  /** Ids que este teste pôs na pilha (os mudos não entram: nunca estiveram lá). */
  const postos = new Set<string>()
  let mudos = 0
  return {
    push(kind, text, durationMs, extras) {
      if (kind === 'info') {
        // Id que não existe na pilha: quem guardar e dispensar depois não tira nada de ninguém.
        mudos += 1
        return `teste-mudo-${mudos}`
      }
      const id = pilha.push(kind, `${PREFIXO_DO_TESTE}${text}`, durationMs, extrasDoTeste(extras, kind === 'instrucao'))
      postos.add(id)
      return id
    },
    dismiss(id) {
      if (!postos.delete(id)) return
      pilha.dismiss(id)
    },
    toasts: () => pilha.toasts(),
    dispensarTodos() {
      for (const id of postos) pilha.dismiss(id)
      postos.clear()
    },
  }
}
