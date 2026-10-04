// E2E de A3 (plano valiant-enchanting-patterson.md): terminar de desenhar uma
// Sala com a aba "Jogo" aberta não pode esconder o Nome da Sala. Antes o rail
// trocava de "Jogo" para "Mapa"; desde a coluna da direita, o Jogo mora lá e
// o inspetor (região "Mapa", onde o Nome da Sala vive) nunca sai da esquerda.
//
// As abas só existem dentro do Tauri (App.tsx: rightColumnTabs olha isTauri()),
// então o teste finge o webview com o mínimo que o App toca ao montar o editor:
// a flag isTauri, a janela atual (onCloseRequested) e o invoke/listen de eventos.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

type TauriStub = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: () => Promise<number>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
}

async function stubTauri(page: Page) {
  await page.addInitScript(() => {
    const target = window as unknown as TauriStub
    target.isTauri = true
    target.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      // O único invoke ao montar é o listen do onCloseRequested, que espera um id numérico.
      invoke: async () => 0,
      transformCallback: () => 0,
      convertFileSrc: (filePath: string) => filePath,
    }
  })
}

test.beforeEach(async ({ page }) => {
  await stubTauri(page)
  await enterEditor(page)
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_room_tab', 'E2E Aba da Sala', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
})

test('desenhar Sala com a aba Jogo aberta deixa o Mapa à vista e pede o nome sobre a Sala', async ({ page }) => {
  const gameTab = page.getByRole('tab', { name: 'Jogo' })
  const mapa = page.getByRole('region', { name: 'Mapa' })
  await gameTab.click()
  await expect(gameTab).toHaveAttribute('aria-selected', 'true')
  // A aba Mapa saiu: o inspetor fica sempre à vista, ao lado do Jogo.
  await expect(page.getByRole('tab', { name: 'Mapa' })).toHaveCount(0)
  await expect(mapa).toBeVisible()
  await expect(page.locator('#lb-rail-panel-room')).toBeVisible()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  await expect(mapa).toBeVisible()
  // O Jogo continua onde estava: desenhar não troca a aba da direita.
  await expect(gameTab).toHaveAttribute('aria-selected', 'true')
  // O nome é pedido no campo sobre a Sala; o do painel não rouba o foco.
  await expect(page.getByRole('textbox', { name: 'Nome da sala no mapa' })).toBeFocused()
  await expect(page.locator('#lb-room-name')).not.toBeFocused()
})
