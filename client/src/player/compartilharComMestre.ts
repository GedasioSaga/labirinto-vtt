/**
 * COMPARTILHAR COM O MESTRE (B6): o interruptor do jogador, lembrado NESTE
 * aparelho. Padrão ligado (pedido do usuário, 28/10/2026): sem armazenamento
 * (janela anônima, WebView sem storage, site bloqueado), fica ligado.
 */
const CHAVE = 'labirinto.jogador.compartilharMedida'

export function lerCompartilharComMestre(): boolean {
  try {
    return globalThis.localStorage?.getItem(CHAVE) !== '0'
  } catch {
    return true
  }
}

export function gravarCompartilharComMestre(ligado: boolean): void {
  try {
    globalThis.localStorage?.setItem(CHAVE, ligado ? '1' : '0')
  } catch {
    // Sem armazenamento a escolha vale só nesta tela; na próxima abertura volta ligado.
  }
}
