// AMBIENTE DA CENA (Luz L4c): o painel da página Cena muda a tinta do período
// no mapa NA HORA, e mapas com forças diferentes desenham diferente.
//
// COMO PROVA: o editor de verdade (vite, sem Tauri), um mapa grande (cobre a
// tela inteira em qualquer câmera) posto na store, e gestos reais no painel:
// o rádio "Período fixo: Noite", as setas e o arrasto do deslizante "Força",
// o Ctrl+Z. A tinta aplicada é lida do atributo que o tique do mapa de luz
// escreve no quadro em que ela muda (`data-mapa-de-luz-tinta`, PixiCanvas);
// o "um quadro" é contado por um laço de requestAnimationFrame da página.
//
// Com LAB_PRINTS_L4C=1 grava 2 prints SÓ do painel (layout) em
// docs/design/luz/provas/ (fora disso, nada é escrito).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { FloorPiece, MapData } from '../src/types/map'

test.use({ trace: 'off', video: 'off' })

const GRADE = 50
const TAREFA_LONGA_MS = 200
/** O passo da força no deslizante (`PASSO_DA_FORCA`). */
const PASSO = 0.05
const PRINTS = process.env.LAB_PRINTS_L4C === '1'
const PASTA_DOS_PRINTS = '../docs/design/luz/provas'

/** 60 x 40 casas de chão claro: o mapa cobre a tela inteira, então a tinta cobre a área medida. */
function mapaGrande(extra: Partial<MapData> = {}): MapData {
  const chao: FloorPiece = { id: 'chao', shape: { kind: 'rect', cx: 1500, cy: 1000, w: 3000, h: 2000 }, op: 'add', modifiers: {} }
  return { ...createEmptyMap('map_amb', 'Ambiente', 60, 40, GRADE), floor: [chao], ...extra }
}

async function carregar(page: Page, mapa: MapData): Promise<void> {
  await page.evaluate(async (m) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(m)
    mod.useMapStore.getState().setActiveTool('select')
  }, mapa)
}

async function forcaDaNoiteNaStore(page: Page): Promise<number | undefined> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.ambientePorPeriodo?.noite?.forca)
}

/** Abre a ficha "Ambiente da cena" (nasce fechada) na página Cena. */
async function abrirAmbiente(page: Page) {
  await abrirPaginaDoLivro(page, 'Cena')
  const cabecalho = page.getByRole('button', { name: /^Ambiente da cena/ })
  if ((await cabecalho.getAttribute('aria-expanded')) !== 'true') await cabecalho.click()
  return page.locator('[data-secao="ambiente"]')
}

/** Luminância média (Rec. 709, 0 a 255) de um retângulo no meio do canvas. */
async function brilhoDoMeio(page: Page): Promise<number> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  const png = (await page.screenshot({ clip: { x: caixa.x + caixa.width / 2 - 100, y: caixa.y + caixa.height / 2 - 100, width: 200, height: 200 } })).toString('base64')
  return page.evaluate(async (dados) => {
    const img = new Image()
    img.src = `data:image/png;base64,${dados}`
    await img.decode()
    const tela = new OffscreenCanvas(img.width, img.height)
    const ctx = tela.getContext('2d')
    if (ctx === null) throw new Error('sem contexto 2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, img.width, img.height).data
    let soma = 0
    for (let i = 0; i < d.length; i += 4) soma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    return soma / (d.length / 4)
  }, png)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterEditor(page)
})

test('mexer na força muda a tinta do mapa no quadro seguinte, e um Ctrl+Z desfaz o arrasto inteiro', async ({ page }) => {
  await carregar(page, mapaGrande())
  const editor = page.locator('[data-light-gradients]')
  // Mapa sem campo, interior, sessão de dia: sem tinta.
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', 'nenhuma')

  const ficha = await abrirAmbiente(page)
  await ficha.getByRole('radiogroup', { name: 'Período fixo' }).getByRole('radio', { name: 'Noite' }).click()
  await expect(ficha.getByRole('status')).toHaveText('Esta cena fica sempre à noite.')
  // A noite padrão (85%) a 50% no editor.
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', /^noite [0-9a-f]{6} 0\.5$/)
  const antes = await editor.getAttribute('data-mapa-de-luz-tinta')

  const forca = ficha.getByLabel('Força')
  await forca.focus()
  // O relógio de quadros da página e as duas marcas: o quadro do gesto e o quadro em que a tinta mudou.
  await page.evaluate(() => {
    const alvo = window as unknown as { __quadro: number; __quadroDoGesto: number; __quadroDaTinta: number }
    alvo.__quadro = 0
    alvo.__quadroDoGesto = -1
    alvo.__quadroDaTinta = -1
    const contar = () => {
      alvo.__quadro += 1
      requestAnimationFrame(contar)
    }
    requestAnimationFrame(contar)
    const deslizante = document.activeElement
    deslizante?.addEventListener('keydown', () => (alvo.__quadroDoGesto = alvo.__quadro), { capture: true, once: true })
    const host = document.querySelector('[data-light-gradients]')
    if (host === null) throw new Error('sem o canvas do editor')
    new MutationObserver(() => {
      if (alvo.__quadroDaTinta < 0) alvo.__quadroDaTinta = alvo.__quadro
    }).observe(host, { attributes: true, attributeFilter: ['data-mapa-de-luz-tinta'] })
  })
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __quadroDaTinta: number }).__quadroDaTinta)).toBeGreaterThanOrEqual(0)
  const { gesto, tinta } = await page.evaluate(() => {
    const alvo = window as unknown as { __quadroDoGesto: number; __quadroDaTinta: number }
    return { gesto: alvo.__quadroDoGesto, tinta: alvo.__quadroDaTinta }
  })
  expect(gesto).toBeGreaterThanOrEqual(0)
  expect(tinta - gesto, `gesto no quadro ${gesto}, tinta no quadro ${tinta}`).toBeLessThanOrEqual(1)
  const depois = await editor.getAttribute('data-mapa-de-luz-tinta')
  expect(depois).not.toBe(antes)
  expect(await forcaDaNoiteNaStore(page)).toBeCloseTo(0.85 - PASSO, 5)
  await expect(ficha.getByText('80%')).toBeVisible()

  // "Ver como jogador" deste painel: a tinta cheia.
  await ficha.getByLabel('Ver como jogador').check()
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', /^noite [0-9a-f]{6} 1$/)
  await ficha.getByLabel('Ver como jogador').uncheck()

  // Arrasto de verdade pelo trilho, medindo tarefas longas durante o gesto. Antes, o passo da seta
  // fecha sozinho (400 ms parado): o arrasto é outro Ctrl+Z.
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const alvo = window as unknown as { __longas: number[] }
    alvo.__longas = []
    new PerformanceObserver((lista) => {
      for (const tarefa of lista.getEntries()) alvo.__longas.push(tarefa.duration)
    }).observe({ type: 'longtask', buffered: false })
  })
  const trilho = await forca.boundingBox()
  if (trilho === null) throw new Error('deslizante sem caixa')
  const y = trilho.y + trilho.height / 2
  await page.mouse.move(trilho.x + trilho.width * 0.8, y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) await page.mouse.move(trilho.x + trilho.width * (0.8 - (0.7 * i) / 20), y)
  await page.mouse.up()
  const forcaArrastada = await forcaDaNoiteNaStore(page)
  expect(forcaArrastada).toBeLessThan(0.3)
  // O arrasto vira um passo depois de 400 ms parado (`SLIDER_COMMIT_DEBOUNCE_MS`).
  await page.waitForTimeout(700)
  const longas = await page.evaluate(() => (window as unknown as { __longas: number[] }).__longas)
  expect(longas.filter((ms) => ms >= TAREFA_LONGA_MS), `tarefas longas: ${longas.join(', ')}`).toEqual([])

  // Ctrl+Z com o foco no deslizante desfaz o ARRASTO inteiro (volta aos 80%), não um quadro.
  await forca.focus()
  await page.keyboard.press('Control+z')
  await expect.poll(() => forcaDaNoiteNaStore(page)).toBeCloseTo(0.85 - PASSO, 5)

  if (PRINTS) {
    await ficha.screenshot({ path: `${PASTA_DOS_PRINTS}/l4c-painel-noite.png` })
    await ficha.getByRole('radiogroup', { name: 'Ajustar' }).getByRole('radio', { name: 'Tarde' }).click()
    await ficha.screenshot({ path: `${PASTA_DOS_PRINTS}/l4c-painel-tarde.png` })
  }
})

test('dois mapas com forças diferentes desenham pixels diferentes na mesma área', async ({ page }) => {
  const editor = page.locator('[data-light-gradients]')
  const noite = (forca: number): Partial<MapData> => ({ periodoFixo: 'noite', ambientePorPeriodo: { noite: { forca } } })

  await carregar(page, mapaGrande())
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', 'nenhuma')
  await page.waitForTimeout(300)
  const semCampo = await brilhoDoMeio(page)

  await carregar(page, mapaGrande(noite(0.2)))
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', /^noite /)
  await page.waitForTimeout(300)
  const fraca = await brilhoDoMeio(page)

  await carregar(page, mapaGrande(noite(1)))
  await expect(editor).toHaveAttribute('data-mapa-de-luz-tinta', /^noite /)
  await page.waitForTimeout(300)
  const forte = await brilhoDoMeio(page)

  test.info().annotations.push({ type: 'brilho', description: `sem campo ${semCampo.toFixed(1)}, noite 20% ${fraca.toFixed(1)}, noite 100% ${forte.toFixed(1)}` })
  expect(fraca).toBeLessThan(semCampo - 3)
  expect(forte).toBeLessThan(fraca - 10)
})
