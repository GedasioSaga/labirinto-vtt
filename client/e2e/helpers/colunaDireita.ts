import { expect, type Page } from '@playwright/test'

/**
 * COLUNA DA DIREITA do mestre (Jogo | Chat em cima, Cenas embaixo). Ela flutua
 * sobre o lado direito do mapa, como o rail sobre o esquerdo. As jornadas que
 * clicam, arrastam ou leem pixels do mapa nesse lado escondem a coluna antes
 * — é o que o mestre faz para ver mais mapa (botão ou Shift+J) — e a mostram
 * de novo para usar o Jogo, o Chat ou as Cenas.
 *
 * Antes havia as abas "Mapa | Jogo" no rail da esquerda: "voltar para a aba
 * Mapa" escondia o painel Jogo e deixava o mapa livre. O equivalente agora é
 * esconder a coluna.
 */

const coluna = (page: Page) => page.locator('aside.lb-coldir')

/** Esconde a coluna, se estiver aberta. Fora do editor (sem coluna), não faz nada. */
export async function esconderColunaDireita(page: Page): Promise<void> {
  const esconder = page.getByRole('button', { name: 'Esconder a coluna da direita' })
  if (!(await esconder.isVisible())) return
  await esconder.click()
  await expect(coluna(page)).toBeHidden()
}

/** Mostra a coluna, se estiver escondida. */
export async function mostrarColunaDireita(page: Page): Promise<void> {
  const reabrir = page.getByRole('button', { name: /^Mostrar a coluna da direita/ })
  if (await reabrir.isVisible()) await reabrir.click()
  await expect(coluna(page)).toBeVisible()
}

/** Mostra a coluna e escolhe a aba Jogo (o painel da sala, do grupo, da iniciativa…). */
export async function abrirAbaJogo(page: Page): Promise<void> {
  await mostrarColunaDireita(page)
  await page.getByRole('tab', { name: 'Jogo' }).click()
}
