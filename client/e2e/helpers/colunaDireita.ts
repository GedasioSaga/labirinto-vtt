import { expect, type Locator, type Page } from '@playwright/test'

/**
 * LIVRO DA MESA do mestre (fatia 4 do design consolidado), que substituiu a
 * coluna da direita (Jogo | Chat em cima, Cenas embaixo): lombada com os
 * marcadores Grupo, Chat, Cenas e Mesa, o topo da Sala fixo e a página que
 * recolhe para dentro da lombada. As jornadas que clicam, arrastam ou leem
 * pixels do mapa nesse lado recolhem a página antes — é o que o mestre faz
 * para ver mais mapa (seta da lombada ou Shift+J) — e a abrem de novo para
 * usar o Grupo, o Chat, as Cenas ou a Mesa. A lombada fica: só a página sai.
 *
 * A antiga aba Jogo virou o marcador Grupo (com o topo da Sala acima de toda
 * página); as Cenas, que moravam sempre à vista embaixo das abas, viraram o
 * marcador Cenas.
 */

export type PaginaDaMesa = 'Grupo' | 'Chat' | 'Cenas' | 'Mesa'

export function livroDaMesa(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Livro da mesa' })
}

/** Abre a página pelo marcador da lombada (que também tira a página de dentro da lombada). */
export async function abrirPaginaDaMesa(page: Page, pagina: PaginaDaMesa): Promise<void> {
  const marcador = livroDaMesa(page).getByRole('tab', { name: pagina })
  await marcador.click()
  await expect(marcador).toHaveAttribute('aria-selected', 'true')
  await expect(livroDaMesa(page).getByRole('button', { name: 'Recolher a página' })).toBeVisible()
}

/** Recolhe a página para dentro da lombada, se estiver aberta. Fora do editor (sem livro), não faz nada. */
export async function esconderColunaDireita(page: Page): Promise<void> {
  const recolher = livroDaMesa(page).getByRole('button', { name: 'Recolher a página' })
  if (!(await recolher.isVisible())) return
  await recolher.click()
  await expect(livroDaMesa(page).getByRole('button', { name: 'Abrir a página' })).toBeVisible()
}

/** Abre o livro na página Cenas: as Cenas eram o que a coluna da direita mostrava sempre. */
export async function mostrarColunaDireita(page: Page): Promise<void> {
  await abrirPaginaDaMesa(page, 'Cenas')
}

/** A antiga aba Jogo: o livro aberto na página Grupo (a sala, o grupo, a iniciativa…). */
export async function abrirAbaJogo(page: Page): Promise<void> {
  await abrirPaginaDaMesa(page, 'Grupo')
}
