/**
 * Aviso ao fechar a janela do mestre (X, Alt+F4, barra de tarefas).
 *
 * Duas coisas se perdem ao fechar: edição não salva e a sala. Fechar o app
 * derruba o servidor da LAN, e todo jogador conectado cai sem aviso — com o
 * mapa salvo, antes, o X fechava direto e levava os 7 junto. Aqui mora a
 * decisão de perguntar ou não, e o texto da pergunta; `App.tsx` só liga isto
 * ao `onCloseRequested` do Tauri e ao `ask` do plugin de diálogo.
 */

/** O que o app sabe no instante do pedido de fechar. */
export interface EstadoAoFechar {
  alteracoesNaoSalvas: boolean
  /** Jogadores com conexão viva agora: quem já caiu não perde nada com o fechamento. */
  jogadoresNaSala: number
}

/** Pergunta do diálogo, ou `null` quando nada se perde e a janela fecha direto. */
export function perguntaAoFechar({ alteracoesNaoSalvas, jogadoresNaSala }: EstadoAoFechar): string | null {
  if (jogadoresNaSala <= 0) return alteracoesNaoSalvas ? 'Há alterações não salvas neste mapa. Fechar mesmo assim?' : null
  const quem = jogadoresNaSala === 1 ? 'Há 1 jogador na sala' : `Há ${jogadoresNaSala} jogadores na sala`
  const tambem = alteracoesNaoSalvas ? ' e alterações não salvas neste mapa' : ''
  const quemCai = jogadoresNaSala === 1 ? 'esse jogador' : 'todos'
  return `${quem}${tambem}. Fechar o Labirinto desconecta ${quemCai}. Fechar mesmo assim?`
}

export interface PedidoDeFecharDeps {
  /** Lido a cada X: o aviso é registrado uma vez só, mas a sala e o mapa mudam. */
  estado: () => EstadoAoFechar
  /** Diálogo nativo: `true` = fechar. */
  perguntar: (texto: string) => Promise<boolean>
  /** Fecha de verdade, sem passar de novo por este aviso. */
  fechar: () => Promise<void>
  /**
   * Se o diálogo não responder até aqui, fecha: travar a janela do usuário é
   * pior que perguntar de novo na próxima tentativa.
   */
  esperaMaximaMs: number
}

/** Só o que o pedido de fechar do Tauri (`CloseRequestedEvent`) precisa oferecer. */
export interface PedidoDeFechar {
  preventDefault(): void
}

/** Handler para `getCurrentWindow().onCloseRequested`. */
export function criarPedidoDeFechar(deps: PedidoDeFecharDeps): (pedido: PedidoDeFechar) => Promise<void> {
  return async (pedido) => {
    const pergunta = perguntaAoFechar(deps.estado())
    if (pergunta === null) return
    pedido.preventDefault()
    let relogio: ReturnType<typeof setTimeout> | undefined
    try {
      const confirmado = await Promise.race([
        // Diálogo que falha (ponte ausente) fecha: mesmo motivo da espera máxima.
        deps.perguntar(pergunta).catch(() => true),
        new Promise<boolean>((resolve) => {
          relogio = setTimeout(() => resolve(true), deps.esperaMaximaMs)
        }),
      ])
      if (confirmado) await deps.fechar()
    } finally {
      clearTimeout(relogio)
    }
  }
}
