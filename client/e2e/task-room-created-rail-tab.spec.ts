// E2E de A3 (plano valiant-enchanting-patterson.md): terminar de desenhar uma
// Sala com a aba "Jogo" aberta volta o rail para "Mapa", onde o Nome da Sala
// vive. Sem isso o foco automático cai num campo escondido e o mestre não vê
// onde digitar.
//
// As abas só existem dentro do Tauri (App.tsx: withRoomTabs olha isTauri()),
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

test('desenhar Sala com a aba Jogo aberta volta para a aba Mapa e pede o nome sobre a Sala', async ({ page }) => {
  const mapTab = page.getByRole('tab', { name: 'Mapa' })
  const gameTab = page.getByRole('tab', { name: 'Jogo' })
  await gameTab.click()
  await expect(gameTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#lb-rail-panel-map')).toBeHidden()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 600, box.y + 500, { steps: 5 })
  await page.mouse.up()

  await expect(mapTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#lb-rail-panel-map')).toBeVisible()
  // O nome é pedido no campo sobre a Sala; o do painel não rouba o foco.
  await expect(page.getByRole('textbox', { name: 'Nome da sala no mapa' })).toBeFocused()
  await expect(page.locator('#lb-room-name')).not.toBeFocused()
})
