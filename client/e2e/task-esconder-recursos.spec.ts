// E2E da Fatia 1 do plano de 15/09/2026: recursos escondidos por
// `lib/features.ts` (Opções, Isometric/World, subtítulo, Link de cenário e K).
// Cada texto escondido vira uma checagem de que ele não existe.
import { test, expect } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

test('menu inicial tem 2 cartões, sem Opções e sem "isométrico ou mundo"', async ({ page }) => {
  await page.goto('/')
  const cards = page.locator('.lb-menucard')
  await expect(cards).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Criar Mapas/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Carregar Mapa existente/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Opções/ })).toHaveCount(0)
  await expect(page.getByText('Dungeon, isométrico ou mundo')).toHaveCount(0)
  await expect(page.getByText('Planta em grade, paredes, portas e tokens')).toBeVisible()
})

test('Criar Mapas abre o formulário direto, e Voltar leva ao menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Criar Mapas/ }).click()
  await expect(page.getByRole('button', { name: 'Criar mapa', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Dungeon Map/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Isometric Tactical Map/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /World Map/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.locator('.lb-menucard')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Criar Mapas/ })).toBeVisible()
})

test('a janela Configurações do mapa não tem Link de cenário', async ({ page }) => {
  await enterEditor(page)
  await page.getByRole('button', { name: 'Configurações do mapa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Configurações do mapa' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Link de cenário')).toHaveCount(0)
  await expect(dialog.getByLabel('Endereço do cenário')).toHaveCount(0)
  await expect(page.locator('#lb-scenario-link')).toHaveCount(0)
})

test('a tecla K não troca a ferramenta e a barra não tem Token', async ({ page }) => {
  await enterEditor(page)
  const activeTool = () =>
    page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().activeTool)
  await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().setActiveTool('wall'))
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  await page.keyboard.press('k')
  expect(await activeTool()).toBe('wall')
  await page.keyboard.press('Shift+K')
  expect(await activeTool()).toBe('wall')
  await expect(page.getByRole('button', { name: 'Token', exact: true })).toHaveCount(0)

  // Controle: outra letra ainda troca, então o teclado estava de fato indo ao editor.
  await page.keyboard.press('v')
  await expect.poll(activeTool).toBe('select')
})
