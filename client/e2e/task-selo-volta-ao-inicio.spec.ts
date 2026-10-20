// E2E do selo da lombada (pedido de 20/10/2026): no editor, um clique no selo
// dourado do alto do livro do mestre salva o mapa e volta ao menu principal,
// o mesmo "Voltar ao início" do menu Arquivo.
import { test, expect } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'

test('o selo da lombada volta ao menu principal', async ({ page }) => {
  await installTauriFsStub(page)
  await enterEditor(page)
  const selo = page.getByRole('button', { name: 'Voltar ao início' })
  await expect(selo).toBeVisible()
  // Botão de verdade: sem borda nem preenchimento do navegador por cima do dourado.
  const estilo = await selo.evaluate((el) => {
    const css = getComputedStyle(el)
    return { borda: css.borderTopWidth, largura: el.getBoundingClientRect().width, altura: el.getBoundingClientRect().height }
  })
  expect(estilo).toEqual({ borda: '0px', largura: 30, altura: 30 })
  await page.screenshot({ path: test.info().outputPath('selo-1440.png'), clip: { x: 0, y: 0, width: 360, height: 220 } })
  await selo.click()
  await expect(page.getByRole('button', { name: 'Criar Mapas' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})
