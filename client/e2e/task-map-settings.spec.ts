// E2E da janela "Configurações do mapa" (plano de remodelagem do painel, seção 4):
// a engrenagem do cabeçalho abre um diálogo modal com Grade, Alinhar grade,
// Medição e Link de cenário. Prova o estado lendo a store, igual aos outros specs.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_settings', 'E2E Config', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function getMeasurementMode(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.measurementMode
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. engrenagem abre a janela; trocar o modo de medição grava na store; Esc fecha e devolve o foco', async ({ page }) => {
  const gear = page.getByRole('button', { name: 'Configurações do mapa' })
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await gear.click()
  const dialog = page.getByRole('dialog', { name: 'Configurações do mapa' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(gear).toHaveAttribute('aria-expanded', 'true')
  // Foco inicial no primeiro campo (formato da grade), dentro da janela.
  await expect(dialog.getByRole('radiogroup', { name: 'Formato da grade' }).getByRole('radio').first()).toBeFocused()

  // Nada disso fica mais empilhado no painel.
  const inspector = page.locator('.lb-inspector')
  await expect(inspector.getByLabel('Modo de medição')).toHaveCount(0)
  await expect(inspector.getByLabel('Endereço do cenário')).toHaveCount(0)

  expect(await getMeasurementMode(page)).toBe('chessboard')
  const select = dialog.getByLabel('Modo de medição')
  const hint = dialog.locator('#lb-scale-mode-hint')
  const hintBefore = await hint.textContent()

  await select.selectOption('manhattan')
  await expect.poll(() => getMeasurementMode(page)).toBe('manhattan')
  await expect(select).toHaveValue('manhattan')
  await expect(hint).not.toHaveText(hintBefore ?? '')
  await expect(hint).toContainText('diagonal custa 2 células')

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(gear).toBeFocused()
  await expect(gear).toHaveAttribute('aria-expanded', 'false')
  // Esc na janela não pode ter desfeito nada no mapa.
  expect(await getMeasurementMode(page)).toBe('manhattan')
})

test('2. clique no fundo fecha a janela', async ({ page }) => {
  await page.getByRole('button', { name: 'Configurações do mapa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Configurações do mapa' })
  await expect(dialog).toBeVisible()

  // Canto de cima à esquerda da tela: fora da janela, que fica centralizada.
  await page.mouse.click(4, 4)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

/**
 * Arrasta a régua de `start` até `end` (px de tela relativos ao canvas) e
 * fotografa só o rótulo, com o botão ainda apertado (no soltar a régua some).
 * O rótulo nasce em end + (12, -12) (drawMeasurementIndicator.ts) e a linha fica
 * toda à esquerda do fim nos arrastos abaixo, então o recorte não pega a linha:
 * dois recortes no mesmo `end` só diferem se o TEXTO do rótulo diferir.
 */
async function rulerLabelShot(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.mouse.move(box.x + start.x, box.y + start.y)
  await page.mouse.down()
  await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 })
  // Dois quadros para o ticker do Pixi desenhar o rótulo novo.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const shot = await page.screenshot({ clip: { x: box.x + end.x + 6, y: box.y + end.y - 18, width: 90, height: 30 } })
  await page.mouse.up()
  return shot
}

test('3. a régua da ferramenta Medir passa a contar pelo modo escolhido na janela', async ({ page }) => {
  await page.getByRole('button', { name: 'Medir', exact: true }).click()
  // grid 64, escala 1,5 m/célula, snap desligado. Diagonal 3x3: tabuleiro = 3 células
  // (4,5 m), Manhattan = 6 (9,0 m). Reta de 6 células = 9,0 m em qualquer um dos dois.
  const end = { x: 700, y: 500 }
  const diagonalStart = { x: end.x - 3 * 64, y: end.y - 3 * 64 }
  const straightStart = { x: end.x - 6 * 64, y: end.y }

  expect(await getMeasurementMode(page)).toBe('chessboard')
  const chessboardDiagonal = await rulerLabelShot(page, diagonalStart, end)
  const chessboardStraight = await rulerLabelShot(page, straightStart, end)
  // Sanidade do recorte: "4,5 m" e "9,0 m" não podem dar a mesma imagem.
  expect(chessboardDiagonal.equals(chessboardStraight)).toBe(false)

  const gear = page.getByRole('button', { name: 'Configurações do mapa' })
  await gear.click()
  const dialog = page.getByRole('dialog', { name: 'Configurações do mapa' })
  await dialog.getByLabel('Modo de medição').selectOption('manhattan')
  await expect.poll(() => getMeasurementMode(page)).toBe('manhattan')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Mesmo arrasto diagonal, agora em Manhattan: o rótulo vira o de 6 células
  // (idêntico à reta de 6 no tabuleiro) e deixa de ser o de 3.
  const manhattanDiagonal = await rulerLabelShot(page, diagonalStart, end)
  expect(manhattanDiagonal.equals(chessboardDiagonal)).toBe(false)
  expect(manhattanDiagonal.equals(chessboardStraight)).toBe(true)
})
