/**
 * A ESCOLHA DE TROCAR A IMAGEM ao ativar uma forma (F3, fatia T; seção 2.1 de
 * docs/planos/batalha-one-piece-f3-plano.md): a caixa "Trocar a imagem do
 * token e do retrato" lembra a última escolha de quem ativa, por personagem,
 * NO APARELHO (não vai à ficha nem ao mapa). Nada guardado = trocar.
 *
 * Puro, com o armazém passado por quem chama (`armazemDoAparelho()` na tela).
 */

const PREFIXO = 'lb-batalha:forma-imagem:'

function chaveDa(personagemId: string): string {
  return `${PREFIXO}${personagemId}`
}

/** A última escolha; sem nada guardado (ou sem armazém) = `true` (trocar). */
export function lerEscolhaDaImagem(armazem: Pick<Storage, 'getItem'> | null, personagemId: string | null): boolean {
  if (armazem === null || personagemId === null || personagemId === '') return true
  try {
    return armazem.getItem(chaveDa(personagemId)) !== 'false'
  } catch {
    return true
  }
}

/** Grava a escolha usada ao ativar. Armazém cheio, bloqueado ou ausente: não lembra, sem erro. */
export function gravarEscolhaDaImagem(armazem: Pick<Storage, 'setItem'> | null, personagemId: string | null, trocar: boolean): void {
  if (armazem === null || personagemId === null || personagemId === '') return
  try {
    armazem.setItem(chaveDa(personagemId), trocar ? 'true' : 'false')
  } catch {
    // Janela privada ou armazém cheio: a escolha vale só agora.
  }
}

/** O `localStorage` do aparelho, ou `null` quando o navegador o recusa. */
export function armazemDoAparelho(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
