/**
 * FICHA MOVIDA PELO JOGADOR, NA TELA DO MESTRE — quais fichas o movimento que
 * acabou de chegar pela rede andou.
 *
 * O mapa não diz quem mexeu: para a store, a ficha que o jogador andou e a que
 * o mestre arrastou, desfez ou empurrou pelas setas mudam do mesmo jeito. Só a
 * do jogador desliza no editor (`pixi/tokensRenderer.ts`, com a conta do
 * deslize do jogador em `player/tokenGlide.ts`); a do mestre continua pulando
 * para o lugar, porque foi a mão dele que acabou de pô-la lá.
 *
 * A marca vive só enquanto a mudança é aplicada. O redraw das fichas roda
 * DENTRO do `set` da store (a assinatura do zustand é síncrona), então ele a
 * vê e a consome; depois disso ela não sobra para animar a próxima edição do
 * mestre — nem quando o movimento não mudou nada na tela (a ficha já estava
 * lá, ou o passo foi numa cena de fundo) e nenhum redraw chegou a consumi-la.
 */

let marcadas = new Set<string>()
const NENHUMA: ReadonlySet<string> = new Set()

/** Aplica um movimento do jogador com `tokenId` marcado. Use em volta da mudança na store. */
export function comMovimentoRemoto(tokenId: string, aplicar: () => void): void {
  marcadas.add(tokenId)
  try {
    aplicar()
  } finally {
    marcadas.delete(tokenId)
  }
}

/**
 * As fichas marcadas agora, e as marcas saem: cada movimento vale para UM
 * redraw. Chamado pelo redraw das fichas do editor a cada vez que ele roda,
 * mesmo quando a ficha marcada não está na cena desenhada.
 */
export function consumirMovimentosRemotos(): ReadonlySet<string> {
  if (marcadas.size === 0) return NENHUMA
  const consumidas = marcadas
  marcadas = new Set()
  return consumidas
}
