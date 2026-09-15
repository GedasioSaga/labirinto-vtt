// Regressão do bug "faixa escura ao maximizar": o canvas do editor ficava preso no
// tamanho inicial quando o container mudava sem evento 'resize' da janela (o
// ResizePlugin do Pixi só escuta window), e a grade/sombra fora do mapa não eram
// redesenhadas quando o renderer mudava de tamanho (só com câmera/grade).
// Mapa pequeno (10x6 x 64px) com câmera em (0,0,1): o canto inferior direito da
// janela fica FORA do mapa, onde deve aparecer a sombra (preto 0.25 sobre #2b2b2b
// = ~#202020) — nem o fundo cru do canvas (#2b2b2b), nem o fundo da página.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

// Ponto em px CSS fora do mapa (640x384), fora das linhas da grade (múltiplos de
// 64) e fora do HUD de zoom; além de 1280 de largura (tamanho inicial da janela).
const PROBE = { x: 1504, y: 672 }
const SHADE = 0x20
const TOLERANCE = 4

async function loadSmallMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_resize', 'E2E Resize', 10, 6, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
  // Ctrl+0 = reset de zoom: câmera (0,0,1) e redesenho da grade/moldura com o mapa novo.
  await page.keyboard.press('Control+0')
}

async function canvasCoversWindow(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    // Backbuffer em pixels físicos (autoDensity): canvas.width = CSS × devicePixelRatio,
    // devolvido já dividido para comparar com o tamanho CSS em qualquer DPR.
    const dpr = window.devicePixelRatio
    return {
      rect: [Math.round(rect.width), Math.round(rect.height)],
      window: [window.innerWidth, window.innerHeight],
      backbuffer: [Math.round(canvas.width / dpr), Math.round(canvas.height / dpr)],
    }
  })
}

async function pixelAt(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const shot = await page.screenshot({ clip: { x, y, width: 1, height: 1 } })
  const b64 = shot.toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext('2d')
    if (!g) throw new Error('sem contexto 2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]] as [number, number, number]
  }, b64)
}

async function expectOutsideShadeAtProbe(page: Page) {
  await expect
    .poll(async () => {
      const [r, g, b] = await pixelAt(page, PROBE.x, PROBE.y)
      return [r, g, b].every((c) => Math.abs(c - SHADE) <= TOLERANCE)
    })
    .toBe(true)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await loadSmallMap(page)
})

test('1. maximizar a janela: canvas cobre a janela e a sombra fora do mapa cobre a área nova', async ({ page }) => {
  await page.setViewportSize({ width: 1521, height: 778 })
  await expect.poll(() => canvasCoversWindow(page)).toEqual({ rect: [1521, 778], window: [1521, 778], backbuffer: [1521, 778] })
  await expectOutsideShadeAtProbe(page)
})

test('2. container cresce sem evento resize da janela: canvas acompanha e redesenha', async ({ page }) => {
  await page.setViewportSize({ width: 1521, height: 778 })
  await expect.poll(() => canvasCoversWindow(page)).toEqual({ rect: [1521, 778], window: [1521, 778], backbuffer: [1521, 778] })

  await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.lb-editor')
    if (!editor) throw new Error('.lb-editor ausente')
    editor.style.width = '1200px'
    editor.style.height = '600px'
  })
  await expect.poll(() => canvasCoversWindow(page)).toEqual({ rect: [1200, 600], window: [1521, 778], backbuffer: [1200, 600] })

  // Solta o CSS sem disparar 'resize' na janela.
  await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>('.lb-editor')
    if (!editor) throw new Error('.lb-editor ausente')
    editor.style.width = ''
    editor.style.height = ''
  })
  await expect.poll(() => canvasCoversWindow(page)).toEqual({ rect: [1521, 778], window: [1521, 778], backbuffer: [1521, 778] })
  await expectOutsideShadeAtProbe(page)
})
