// E2E de "Imagem de fundo e conversão", hoje um trecho do menu Arquivo do topo
// do livro do mestre (fatia 2; antes era um botão da barra de baixo): os três
// botões de conversão saíram do painel de Chão e agora só existem, no menu,
// quando o mapa tem imagem de fundo. Prova o caminho de UI inteiro
// até a store: menu -> "Chão a partir da imagem" -> peças de chão criadas.
//
// A imagem é gerada no próprio navegador (canvas -> data URL), sem arquivo de
// fixture: fundo preto com um retângulo verde #006b00, a cor de chão que
// `isMinimapFloorPixel` (lib/traceImage.ts) reconhece.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { FloorPiece } from '../src/types/map'

const FLOOR_RECT = { x: 120, y: 90, w: 240, h: 160 }

async function getFloor(page: Page): Promise<FloorPiece[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.floor
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_background_menu', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function getTraceState(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return {
      floor: map.floor.length,
      lines: map.lines.length,
      markers: map.markers.length,
      renderMode: map.floorStyle.renderMode ?? 'vector',
    }
  })
}

/**
 * `withDetails` acrescenta, dentro do chão verde, um traço cinza vertical e uma
 * porta laranja — as mesmas cores da cena de lib/traceDetails.test.ts, que
 * `traceMapDetails` transforma em MapLine e MapMarker.
 */
async function loadGreenFloorBackground(page: Page, withDetails = false) {
  await page.evaluate(
    async ({ rect, withDetails }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 340
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas 2d indisponível')
      context.fillStyle = '#000000'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#006b00'
      context.fillRect(rect.x, rect.y, rect.w, rect.h)
      if (withDetails) {
        context.fillStyle = '#7f857f'
        context.fillRect(rect.x + rect.w / 2, rect.y + 20, 2, rect.h - 40)
        context.fillStyle = '#cc9933'
        context.fillRect(rect.x + 40, rect.y + rect.h / 2, 12, 4)
      }
      const mod = await import('/src/stores/mapStore.ts')
      mod.useMapStore.getState().setBackground({ type: 'image', src: canvas.toDataURL('image/png') })
    },
    { rect: FLOOR_RECT, withDetails },
  )
}

/** O menu Arquivo do topo do livro do mestre (fatia 2): a imagem de fundo e as conversões moram nele. */
function arquivo(page: Page) {
  return page.getByRole('complementary', { name: 'Livro do mestre' }).getByRole('button', { name: 'Arquivo', exact: true })
}

async function chooseMenuItem(page: Page, name: string) {
  const trigger = arquivo(page)
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Arquivo' })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name, exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
}

test.beforeEach(async ({ page }) => {
  // Fora do webview real não há __TAURI_INTERNALS__, e tanto o desenho do
  // fundo quanto `handleFloorFromBackground` chamam `convertFileSrc(src)`.
  // Mesmo stub de task-alignment-door-curve-portal.spec.ts.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('1. sem imagem o botão só importa; com imagem abre o menu e "Chão a partir da imagem" cria peças', async ({ page }) => {
  const trigger = arquivo(page)
  const menu = page.getByRole('menu', { name: 'Arquivo' })
  const conversoes = menu.getByRole('menuitem', { name: /a partir da imagem|Recriar minimapa/ })
  // Sem imagem: o menu só importa uma, e os botões de conversão não estão no painel nem no menu.
  await trigger.click()
  await expect(menu.getByRole('menuitem', { name: 'Importar imagem de fundo…', exact: true })).toBeVisible()
  await expect(conversoes).toHaveCount(0)
  await expect(page.getByRole('button', { name: /a partir da imagem/ })).toHaveCount(0)
  await expect(page.getByText('Importe uma imagem de fundo para usar.')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  await loadGreenFloorBackground(page)
  expect(await getFloor(page)).toEqual([])

  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()

  await expect(menu).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  const trocar = menu.getByRole('menuitem', { name: 'Trocar imagem de fundo…', exact: true })
  await expect(trocar).toBeVisible()
  await expect(conversoes).toHaveCount(3)

  // As setas andam pelo menu: da troca de imagem, a seta para baixo chega ao chão.
  const floorItem = menu.getByRole('menuitem', { name: 'Chão a partir da imagem', exact: true })
  await trocar.focus()
  await page.keyboard.press('ArrowDown')
  await expect(floorItem).toBeFocused()
  await floorItem.click()

  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect.poll(async () => (await getFloor(page)).length).toBeGreaterThan(0)

  // As peças seguem o retângulo verde da imagem (pixel da imagem === px de mundo):
  // a caixa que envolve todas elas bate com o retângulo, com folga de poucos px.
  const box = await page.evaluate(async () => {
    const store = await import('/src/stores/mapStore.ts')
    const sdf = await import('/src/lib/floorSdf.ts')
    const all = store.useMapStore.getState().map.floor.map((piece) => sdf.pieceBounds(piece))
    return {
      minX: Math.min(...all.map((b) => b.minX)),
      minY: Math.min(...all.map((b) => b.minY)),
      maxX: Math.max(...all.map((b) => b.maxX)),
      maxY: Math.max(...all.map((b) => b.maxY)),
    }
  })
  const tolerance = 8
  expect(Math.abs(box.minX - FLOOR_RECT.x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(box.maxX - (FLOOR_RECT.x + FLOOR_RECT.w))).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(box.minY - FLOOR_RECT.y)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(box.maxY - (FLOOR_RECT.y + FLOOR_RECT.h))).toBeLessThanOrEqual(tolerance)
})

test('2. Esc fecha o menu, devolve o foco ao botão e não cria nada', async ({ page }) => {
  await loadGreenFloorBackground(page)
  const trigger = arquivo(page)
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Arquivo' })
  await expect(menu).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(await getFloor(page)).toEqual([])
})

// Os dois testes abaixo provam a LIGAÇÃO em App.tsx de cada item ao handler
// certo: cada handler deixa uma assinatura diferente na store. Linhas e portas
// não cria chão nem liga o render fiel; o minimapa cria chão E liga o render
// fiel (applyMinimapTrace com renderMode 'raster'). Uma troca entre os dois
// itens, ou com o de chão, reprova um dos testes.
test('3. "Linhas e portas a partir da imagem" cria só linhas e portas', async ({ page }) => {
  await loadGreenFloorBackground(page, true)
  expect(await getTraceState(page)).toEqual({ floor: 0, lines: 0, markers: 0, renderMode: 'vector' })

  await chooseMenuItem(page, 'Linhas e portas a partir da imagem')

  await expect.poll(async () => {
    const state = await getTraceState(page)
    return state.lines + state.markers
  }).toBeGreaterThan(0)
  const state = await getTraceState(page)
  expect(state.floor).toBe(0)
  expect(state.renderMode).toBe('vector')
})

test('4. "Recriar minimapa completo" cria o chão e liga o render fiel', async ({ page }) => {
  await loadGreenFloorBackground(page, true)
  expect(await getTraceState(page)).toEqual({ floor: 0, lines: 0, markers: 0, renderMode: 'vector' })

  await chooseMenuItem(page, 'Recriar minimapa completo')

  // O pipeline completo roda no thread principal e leva alguns segundos.
  await expect.poll(async () => (await getTraceState(page)).floor, { timeout: 20_000 }).toBeGreaterThan(0)
  expect((await getTraceState(page)).renderMode).toBe('raster')
})
