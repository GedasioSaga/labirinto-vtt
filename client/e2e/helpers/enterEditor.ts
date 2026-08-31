import type { Page } from '@playwright/test'

/**
 * Navega da raiz até o editor pelo caminho novo do menu inicial: menu →
 * "Criar Mapas" → "Dungeon Map" → formulário → "Criar mapa" → espera o
 * `<canvas>` do Pixi montar.
 *
 * Substitui o antigo `page.getByRole('button', { name: 'Criar mapa' }).click()`
 * direto na raiz — o menu novo tirou esse botão da página inicial, então os
 * 19 specs que abriam o editor assim quebravam sem este helper.
 */
export async function enterEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  await page.getByRole('button', { name: 'Dungeon Map' }).click()
  await page.getByRole('button', { name: 'Criar mapa' }).click()
  await page.waitForSelector('canvas')
}
