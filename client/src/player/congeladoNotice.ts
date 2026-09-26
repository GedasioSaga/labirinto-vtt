import { TEXTO_CONGELADO } from '../lib/congelar'
import type { Token } from '../types/map'

/** Nome da ficha no aviso; sem nome, nunca texto vazio. */
function nomeNoAviso(token: Pick<Token, 'name'>): string {
  const nome = token.name.trim()
  return nome === '' ? 'sua ficha' : nome
}

/** "A", "A e B", "A, B e C". */
function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/**
 * CONGELAR FICHA — o aviso fixo da tela de quem joga, enquanto uma ficha DELE
 * está congelada pelo mestre: é o que explica por que ela volta ao lugar. Só
 * as fichas dele que vieram no recorte (`ownIds`); a congelada de outro nem
 * chega com o campo (`lib/fogFilter.ts`). Todas congeladas: a frase curta;
 * algumas: diz quais. `null` = nenhuma, sem aviso.
 */
export function avisoDeCongelado(tokens: readonly Token[], ownIds: readonly string[]): string | null {
  const minhas = new Set(ownIds)
  const dele = tokens.filter((token) => minhas.has(token.id))
  const congeladas = dele.filter((token) => token.congelado === true)
  if (congeladas.length === 0) return null
  if (congeladas.length === dele.length) return TEXTO_CONGELADO
  return `${TEXTO_CONGELADO}: ${juntarNomes(congeladas.map(nomeNoAviso))}`
}
