import type { ToastAction, ToastExtras, ToastReplyField, ToastResposta } from '../../stores/toastStore'
import type { ToastSink } from '../avisosDaPonte'
import type { PedidoDoTeste } from './tipos'

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
 * - O pedido também vai para a JANELA DE TESTE (caça J6): quem testa sozinho
 *   responde ali, sem trocar de janela. `aoMudarPedidos` recebe a lista a
 *   cada mudança e `responder` roda o botão escolhido lá. Responder de um
 *   lado tira o pedido dos dois.
 * - Fechar o teste tira da tela tudo o que ele pôs (`dispensarTodos`).
 */

export const PREFIXO_DO_TESTE = 'Teste · '
export const GRUPO_DO_TESTE = 'Pedidos do teste'

export interface AvisosDeTeste extends ToastSink {
  /** Tira da tela todo aviso que este teste pôs e ainda está lá. */
  dispensarTodos(): void
  /** Os pedidos que esperam o mestre agora, na ordem de chegada. */
  pedidos(): PedidoDoTeste[]
  /**
   * A resposta dada na JANELA DE TESTE: `botao` é a posição em
   * `PedidoDoTeste.botoes`; `null` = o campo `responder` ("Não, porque…").
   * Pedido que já foi respondido (pela janela principal, por exemplo) não faz nada.
   */
  responder(id: string, botao: number | null, texto: string): void
}

/** O pedido como a pilha o tem, com as ações de verdade por trás dos rótulos. */
interface PedidoGuardado {
  texto: string
  acoes: ToastAction[]
  campo?: ToastReplyField
  responder?: ToastResposta
}

function extrasDoTeste(extras: ToastExtras | undefined, pedido: boolean): ToastExtras {
  const base: ToastExtras = { ...extras }
  if (extras?.chave !== undefined) base.chave = `teste:${extras.chave}`
  if (!pedido) return base
  return { ...base, grupo: GRUPO_DO_TESTE, sempreEmCaixa: true }
}

function respostaQueEnvia(campo: ToastResposta | ToastReplyField): campo is ToastResposta {
  return 'enviar' in campo
}

/** O que a janela de teste vê do pedido: texto e rótulos, nada de função. */
function paraAJanela(id: string, pedido: PedidoGuardado): PedidoDoTeste {
  const visto: PedidoDoTeste = { id, texto: pedido.texto, botoes: pedido.acoes.map((acao) => acao.label) }
  if (pedido.campo !== undefined) visto.campo = { rotulo: pedido.campo.rotulo, maxLength: pedido.campo.maxLength }
  if (pedido.responder !== undefined) visto.responder = { rotulo: pedido.responder.rotulo, maxLength: pedido.responder.maxLength }
  return visto
}

export function criarAvisosDeTeste(pilha: ToastSink, aoMudarPedidos?: (pedidos: PedidoDoTeste[]) => void): AvisosDeTeste {
  /** Ids que este teste pôs na pilha (os mudos não entram: nunca estiveram lá). */
  const postos = new Set<string>()
  /** Os pedidos que esperam o mestre, por id do aviso. O `Map` guarda a ordem de chegada. */
  const pedidos = new Map<string, PedidoGuardado>()
  let mudos = 0

  const naPilha = (id: string) => pilha.toasts().some((toast) => toast.id === id)
  const listar = (): PedidoDoTeste[] => [...pedidos].filter(([id]) => naPilha(id)).map(([id, pedido]) => paraAJanela(id, pedido))
  const avisar = () => aoMudarPedidos?.(listar())

  /** O pedido saiu (respondido, dispensado ou trocado): some da janela de teste. */
  const largar = (id: string) => {
    if (pedidos.delete(id)) avisar()
  }

  /** Tira o aviso da pilha como o botão da janela principal tira: antes de agir. */
  const tirarDaPilha = (id: string) => {
    postos.delete(id)
    pilha.dismiss(id)
    largar(id)
  }

  /**
   * As ações do aviso, embrulhadas: qualquer resposta dada na janela principal
   * (botão, ×, "Deixar todos", "Responder") também tira o pedido da janela de
   * teste. `idDoAviso` só existe depois do `push`; as ações só rodam depois.
   */
  const embrulhar = (extras: ToastExtras, idDoAviso: () => string): ToastExtras => {
    const embrulhado: ToastExtras = { ...extras }
    if (extras.actions !== undefined) {
      embrulhado.actions = extras.actions.map((acao) => ({
        ...acao,
        run: (resposta?: string) => {
          if (acao.mantem !== true) largar(idDoAviso())
          acao.run(resposta)
        },
      }))
    }
    const aoDispensar = extras.onDismiss
    embrulhado.onDismiss = () => {
      largar(idDoAviso())
      aoDispensar?.()
    }
    const campo = extras.resposta
    if (campo !== undefined && respostaQueEnvia(campo)) {
      embrulhado.resposta = {
        ...campo,
        enviar: (texto) => {
          largar(idDoAviso())
          campo.enviar(texto)
        },
      }
    }
    return embrulhado
  }

  return {
    push(kind, text, durationMs, extras) {
      if (kind === 'info') {
        // Id que não existe na pilha: quem guardar e dispensar depois não tira nada de ninguém.
        mudos += 1
        return `teste-mudo-${mudos}`
      }
      const doTeste = extrasDoTeste(extras, kind === 'instrucao')
      const pergunta = kind === 'instrucao' && (doTeste.actions !== undefined || doTeste.resposta !== undefined)
      if (!pergunta) {
        const id = pilha.push(kind, `${PREFIXO_DO_TESTE}${text}`, durationMs, doTeste)
        postos.add(id)
        return id
      }
      let idDoAviso = ''
      const id = pilha.push(kind, `${PREFIXO_DO_TESTE}${text}`, durationMs, embrulhar(doTeste, () => idDoAviso))
      idDoAviso = id
      postos.add(id)
      // "Ir lá" e afins só mexem no editor, que está atrás da janela de teste: lá eles não entram.
      const acoes = (doTeste.actions ?? []).filter((acao) => acao.mantem !== true)
      const campo = doTeste.resposta
      const guardado: PedidoGuardado = { texto: text, acoes }
      if (campo !== undefined && respostaQueEnvia(campo)) guardado.responder = campo
      else if (campo !== undefined) guardado.campo = campo
      // Mesma chave de um pedido na tela: a pilha troca no lugar (mesmo id), e a janela também.
      pedidos.delete(id)
      pedidos.set(id, guardado)
      avisar()
      return id
    },
    dismiss(id) {
      if (!postos.delete(id)) return
      pilha.dismiss(id)
      largar(id)
    },
    toasts: () => pilha.toasts(),
    dispensarTodos() {
      for (const id of postos) pilha.dismiss(id)
      postos.clear()
      if (pedidos.size === 0) return
      pedidos.clear()
      avisar()
    },
    pedidos: listar,
    responder(id, botao, texto) {
      const pedido = pedidos.get(id)
      if (pedido === undefined) return
      if (!naPilha(id)) {
        largar(id)
        return
      }
      if (botao === null) {
        const campo = pedido.responder
        if (campo === undefined) return
        const limpo = texto.trim().slice(0, campo.maxLength)
        // Texto vazio não envia, igual ao campo da janela principal.
        if (limpo === '') return
        tirarDaPilha(id)
        campo.enviar(limpo)
        return
      }
      const acao = pedido.acoes[botao]
      if (acao === undefined) return
      tirarDaPilha(id)
      // Aviso sem campo acima dos botões chama como sempre chamou: sem argumento.
      if (pedido.campo === undefined) acao.run()
      else acao.run(texto.trim().slice(0, pedido.campo.maxLength))
    },
  }
}
