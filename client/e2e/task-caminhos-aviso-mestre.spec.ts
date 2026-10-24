// CAMINHOS, fatia F0 — AVISO AO MESTRE. O guarda patrulha pelo motor e o
// caminho passa por uma porta TRANCADA: a tela do mestre diz "Porta trancada:
// Guarda parou" (nada de id cru), num canto que não tapa a barra de
// ferramentas nem os livros; destrancou, o aviso some; "Fechar" dispensa;
// com movimento reduzido a entrada é só opacidade.
//
// O cenário nasce pela store (mapa, parede, porta, ficha com patrulha e o
// "Patrulhar sozinha"), como os outros specs deste diretório; o que se cobra
// é a TELA. Spec não selado (não é jornada).
import { expect, test, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { livroDoMestre } from './helpers/livroDoMestre'

const PORTA_ID = 'porta-e2e-aviso'
const GUARDA_ID = 'guarda-e2e-aviso'
const FRASE = 'Porta trancada: Guarda parou'
/** O guarda acha a porta trancada no 1º pedido de caminho: 1 tique de 200 ms, com folga para o vite de dev. */
const ESPERA_DO_AVISO_MS = 5_000

interface Caixa {
  x: number
  y: number
  width: number
  height: number
}

function cruzam(a: Caixa, b: Caixa): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function montarGuardaAtrasDaPorta(page: Page): Promise<void> {
  await page.evaluate(
    async ({ portaId, guardaId }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mapa = await import('/src/stores/mapStore.ts')
      const patrulha = await import('/src/stores/patrulhaAndandoStore.ts')
      const base = mapFactory.createEmptyMap('map_e2e_aviso_mestre', 'E2E aviso ao mestre', 30, 20, 64)
      const parede = { blocksLight: true, blocksMove: true, door: null }
      mapa.useMapStore.getState().loadMap({
        ...base,
        walls: [
          { id: 'norte-e2e', x1: 640, y1: 0, x2: 640, y2: 256, ...parede },
          { id: portaId, x1: 640, y1: 256, x2: 640, y2: 384, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } },
          { id: 'sul-e2e', x1: 640, y1: 384, x2: 640, y2: 1280, ...parede },
        ],
        tokens: [
          {
            id: guardaId,
            characterId: null,
            name: 'Guarda',
            x: 512,
            y: 320,
            size: 1,
            image: null,
            npc: true,
            patrulha: { pontos: [{ x: 512, y: 320 }, { x: 768, y: 320 }], atual: 0 },
          },
        ],
      })
      patrulha.usePatrulhaAndandoStore.getState().ligar(guardaId)
    },
    { portaId: PORTA_ID, guardaId: GUARDA_ID },
  )
}

async function destrancar(page: Page): Promise<void> {
  await page.evaluate(async (portaId) => {
    const mapa = await import('/src/stores/mapStore.ts')
    mapa.useMapStore.getState().setWallDoor(portaId, { open: false, locked: false, kind: 'normal' })
  }, PORTA_ID)
}

async function desligar(page: Page): Promise<void> {
  await page.evaluate(async (guardaId) => {
    const patrulha = await import('/src/stores/patrulhaAndandoStore.ts')
    patrulha.usePatrulhaAndandoStore.getState().desligar(guardaId)
  }, GUARDA_ID)
}

function regiao(page: Page): Locator {
  return page.getByRole('region', { name: 'Avisos dos NPCs' })
}

/** O aviso não tapa a barra de ferramentas nem nenhum dos livros (aberto ou recolhido). */
async function naoTapaNada(page: Page): Promise<void> {
  const aviso = await regiao(page).locator('li').first().boundingBox()
  if (aviso === null) throw new Error('aviso sem caixa')
  const barra = await page.locator('.lb-toolbar-dock').first().boundingBox()
  if (barra === null) throw new Error('barra de ferramentas sem caixa')
  expect(cruzam(aviso, barra), 'o aviso tapa a barra de ferramentas').toBe(false)
  for (const livro of await page.locator('aside').all()) {
    if (!(await livro.isVisible())) continue
    const caixa = await livro.boundingBox()
    if (caixa !== null) expect(cruzam(aviso, caixa), 'o aviso tapa um livro').toBe(false)
  }
}

test.afterEach(async ({ page }) => {
  await desligar(page)
})

test('porta trancada no caminho do guarda: o mestre lê a frase, fora da barra e dos livros; destrancou, some', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterEditor(page)
  await montarGuardaAtrasDaPorta(page)

  const item = regiao(page).getByRole('listitem')
  await expect(item).toHaveText(FRASE, { timeout: ESPERA_DO_AVISO_MS })
  await expect(item).toHaveCount(1)
  await expect(regiao(page)).not.toContainText(PORTA_ID)
  await expect(regiao(page)).not.toContainText(GUARDA_ID)
  await naoTapaNada(page)
  const fechar = regiao(page).getByRole('button', { name: `Fechar aviso: ${FRASE}` })
  const alvo = await fechar.boundingBox()
  if (alvo === null) throw new Error('Fechar sem caixa')
  // Alvo de 44 px: 6 px acima do botão de 28 px ainda é ele (o `::after`).
  const acima = { x: alvo.x + alvo.width / 2, y: alvo.y - 6 }
  const tocado = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label') ?? null, acima)
  expect(tocado).toBe(`Fechar aviso: ${FRASE}`)
  if (process.env.AVISO_PRINTS) await page.screenshot({ path: `${process.env.AVISO_PRINTS}/aviso-1280.png` })

  await destrancar(page)
  await expect(regiao(page)).toHaveCount(0)
})

test('"Fechar" dispensa o aviso, e ele não volta enquanto a porta segue trancada', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterEditor(page)
  await montarGuardaAtrasDaPorta(page)
  await expect(regiao(page).getByRole('listitem')).toHaveText(FRASE, { timeout: ESPERA_DO_AVISO_MS })
  await regiao(page).getByRole('button', { name: `Fechar aviso: ${FRASE}` }).click()
  await expect(regiao(page)).toHaveCount(0)
  // 2 s = 10 tiques do guarda tentando de novo: o aviso dispensado fica dispensado.
  await page.waitForTimeout(2_000)
  await expect(regiao(page)).toHaveCount(0)
})

test('celular (390 px): com o livro aberto o aviso espera; recolhido, cabe na tela sem tapar a barra nem os livros', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterEditor(page)
  await montarGuardaAtrasDaPorta(page)
  const item = regiao(page).getByRole('listitem')
  // O livro aberto tapa o mapa inteiro: o aviso não fica por cima dele.
  const noDom = page.locator('.lb-aviso-rotina li')
  await expect(noDom).toHaveCount(1, { timeout: ESPERA_DO_AVISO_MS })
  await expect(noDom).toBeHidden()
  await livroDoMestre(page).getByRole('button', { name: 'Recolher a página' }).click()
  await expect(item).toBeVisible()
  await expect(item).toHaveText(FRASE)
  const caixa = await item.boundingBox()
  if (caixa === null) throw new Error('aviso sem caixa')
  expect(caixa.x).toBeGreaterThanOrEqual(0)
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(390)
  // Com o livro recolhido a caixa do `aside` segue a da página escondida: aqui a conta é com a barra.
  const barra = await page.locator('.lb-toolbar-dock').first().boundingBox()
  if (barra === null) throw new Error('barra de ferramentas sem caixa')
  expect(cruzam(caixa, barra), 'o aviso tapa a barra de ferramentas').toBe(false)
  if (process.env.AVISO_PRINTS) await page.screenshot({ path: `${process.env.AVISO_PRINTS}/aviso-390.png` })
})

test('movimento reduzido: a entrada do aviso é só opacidade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterEditor(page)
  await montarGuardaAtrasDaPorta(page)
  const item = regiao(page).getByRole('listitem')
  await expect(item).toHaveText(FRASE, { timeout: ESPERA_DO_AVISO_MS })
  const transicao = await item.evaluate((el) => getComputedStyle(el).transitionProperty)
  expect(transicao).toBe('opacity')
})
