// E2E da Fatia 3 do plano de 15/09/2026: seção "Avançado" do painel. Nasce
// fechada, abre pelo cabeçalho mostrando a frase de cada controle, e volta a
// nascer fechada quando outro objeto é selecionado.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const WALL_HINT = 'Arredondada suaviza a ponta solta e a quina entre paredes; Reta deixa a quina viva.'

async function resetWithWalls(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.loadMap(mapFactory.createEmptyMap('map_e2e_avancado', 'E2E Avançado', 30, 20, 64))
    store.setActiveTool('select')
    store.addWall({ id: 'w1', x1: 128, y1: 128, x2: 512, y2: 128, blocksLight: true, blocksMove: true, door: null })
    store.addWall({ id: 'w2', x1: 128, y1: 384, x2: 512, y2: 384, blocksLight: true, blocksMove: true, door: null })
  })
}

async function selectWall(page: Page, id: string) {
  await page.evaluate(async (wallId) => {
    ;(await import('/src/stores/mapStore.ts')).useMapStore.getState().setSelection([{ kind: 'wall', id: wallId }])
  }, id)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetWithWalls(page)
})

test('1. parede selecionada: Ponta e canto invisível até abrir o Avançado, e aí aparece com a frase', async ({ page }) => {
  await selectWall(page, 'w1')
  const inspector = page.locator('.lb-inspector')
  const advanced = inspector.getByRole('button', { name: 'Avançado', exact: true })
  const lineStyle = inspector.getByRole('radiogroup', { name: 'Ponta e canto da parede' })

  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await expect(lineStyle).toBeHidden()
  await expect(inspector.getByText(WALL_HINT)).toBeHidden()
  // "Avançado" é h3, abaixo do h2 do bloco.
  await expect(inspector.getByRole('heading', { level: 3, name: 'Avançado' })).toHaveCount(1)

  await advanced.click()
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')
  await expect(lineStyle).toBeVisible()
  await expect(inspector.getByText(WALL_HINT)).toBeVisible()
  await expect(lineStyle).toHaveAccessibleDescription(WALL_HINT)

  // O controle continua funcionando dentro do Avançado.
  await lineStyle.getByRole('radio', { name: 'Reta', exact: true }).click()
  const lineStyleSaved = await page.evaluate(async () =>
    (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.walls.find((w) => w.id === 'w1')?.lineStyle,
  )
  expect(lineStyleSaved).toBe('straight')
})

test('2. selecionar outra parede faz o Avançado nascer fechado de novo', async ({ page }) => {
  await selectWall(page, 'w1')
  const inspector = page.locator('.lb-inspector')
  const advanced = inspector.getByRole('button', { name: 'Avançado', exact: true })
  await advanced.click()
  await expect(advanced).toHaveAttribute('aria-expanded', 'true')

  await selectWall(page, 'w2')
  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await expect(inspector.getByRole('radiogroup', { name: 'Ponta e canto da parede' })).toBeHidden()
  // Não grava preferência: nenhuma chave lb-section:advanced no localStorage.
  expect(await page.evaluate(() => window.localStorage.getItem('lb-section:advanced'))).toBeNull()
})

test('3. Chão do mapa → Avançado → Render fiel', async ({ page }) => {
  const inspector = page.locator('.lb-inspector')
  const floor = inspector.locator('section.lb-collapsible').filter({ has: page.getByRole('button', { name: 'Chão do mapa', exact: true }) })
  const floorHeader = inspector.getByRole('button', { name: 'Chão do mapa', exact: true })
  if ((await floorHeader.getAttribute('aria-expanded')) === 'false') await floorHeader.click()
  await expect(floorHeader).toHaveAttribute('aria-expanded', 'true')

  const renderFiel = floor.getByRole('checkbox', { name: 'Render fiel (minimapa)', exact: true })
  await expect(renderFiel).toBeHidden()
  // Precisão do contorno perdeu o tooltip técnico: a explicação agora é a frase do Avançado.
  await expect(floor.locator('[title^="Amostra a cada"]')).toHaveCount(0)

  const advanced = floor.getByRole('button', { name: 'Avançado', exact: true })
  await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  await advanced.click()
  await expect(renderFiel).toBeAttached()
  await expect(floor.getByRole('radiogroup', { name: 'Precisão do contorno do chão' })).toBeVisible()
  await expect(floor.getByRole('checkbox', { name: 'Moldura com título', exact: true })).toBeAttached()

  await renderFiel.click({ force: true })
  const renderMode = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.floorStyle.renderMode)
  expect(renderMode).toBe('raster')
})
