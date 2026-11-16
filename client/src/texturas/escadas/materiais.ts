import type { FolhaDaEscada } from '../../lib/materialDaEscada'

/**
 * As IMAGENS da escada com material (catálogo e formato em
 * `lib/materialDaEscada.ts`): a folha de cada material em
 * `imagens/<folha>.png` e a amostra do painel em `imagens/amostras/<id>.png`.
 * Separado do catálogo porque o glob só existe no Vite, como em
 * `texturas/paredes/materiais.ts`. As imagens vão dentro do app (arquivo
 * próprio em `assets/` com hash): o jogador as recebe pela mesma rota.
 */

const FOLHAS = import.meta.glob<string>('./imagens/*.png', { eager: true, query: '?url', import: 'default' })
const AMOSTRAS = import.meta.glob<string>('./imagens/amostras/*.png', { eager: true, query: '?url', import: 'default' })

/** A URL da folha; `null` se o arquivo não está lá. */
export function urlDaFolhaDaEscada(folha: FolhaDaEscada): string | null {
  return FOLHAS[`./imagens/${folha}.png`] ?? null
}

/** A URL da amostra (`madeira-<tom>`, `metal-nova`, `tijolo`...); `null` se o arquivo não está lá. */
export function urlDaAmostraDaEscada(id: string): string | null {
  return AMOSTRAS[`./imagens/amostras/${id}.png`] ?? null
}
