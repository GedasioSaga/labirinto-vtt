// E2E de Token com imagem (ROADMAP.md, F1 "Token com imagem"): token sem
// imagem continua desenhando o círculo genérico de sempre, e o bug real da
// Fase 1 não volta — um token construído FORA do type-checker (page.evaluate
// de outro spec, mapa legado em disco) sem o campo `image` não pode derrubar
// a página inteira. Causa original (ROADMAP.md): `token.image !== null` dá
// `true` pra `undefined` — entrava no ramo "tem imagem" e tentava
// `convertFileSrc(undefined)`. O fix (pixi/tokensRenderer.ts) troca pra
// checagem por veracidade (`if (token.image)`) — este spec prova que
// continua assim.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Token } from '../src/types/map'

async function getTokens(page: Page): Promise<Token[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.tokens
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_token_image', 'E2E Token', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. token sem imagem (image: null) desenha algo visível no canvas — círculo genérico', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Canto vazio do canvas, longe da barra de ferramentas e de qualquer painel.
  const clip = { x: box.x + 750, y: box.y + 550, width: 100, height: 100 }
  const before = await page.screenshot({ clip })

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokCircle', characterId: null, name: 'Sem imagem', x: 800, y: 600, size: 1, image: null })
  })
  await expect.poll(async () => (await getTokens(page)).length).toBe(1)
  // O redraw do renderer roda síncrono na mutação da store (tokensSubscription.ts),
  // mas a pintura de verdade no canvas só acontece no próximo tick do ticker do
  // Pixi (requestAnimationFrame) — dá tempo pro navegador pintar antes do screenshot.
  await page.waitForTimeout(100)

  const after = await page.screenshot({ clip })
  expect(before.equals(after)).toBe(false)

  const tokens = await getTokens(page)
  expect(tokens[0].image).toBeNull()
})

test('2. token criado sem o CAMPO image (não apenas null) não derruba a página — bug real da Fase 1', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    // Simula dado que atravessou o type-checker por fora (mapa legado em
    // disco, ou o `page.evaluate` cru que vários specs e2e já fazem):
    // objeto sem a chave `image`, do jeito que chegava ANTES da fábrica
    // migrar mapa antigo. `as unknown as Token` é o mesmo padrão já usado em
    // task-alignment-door-curve-portal.spec.ts pra simular ponte externa —
    // justificado aqui porque É o cenário do bug real (dado vindo de fora do
    // type-checker), não um atalho pra evitar tipar direito.
    const legacyToken = {
      id: 'tokLegacy',
      characterId: null,
      name: 'Legado',
      x: 400,
      y: 400,
      size: 1,
    } as unknown as Token
    mod.useMapStore.getState().addToken(legacyToken)
  })

  await expect.poll(async () => (await getTokens(page)).length).toBe(1)
  await page.waitForTimeout(100)

  // A página continua respondendo: o canvas segue de pé e reage a um clique.
  await page.mouse.click(box.x + 300, box.y + 300)
  expect(await page.locator('canvas').isVisible()).toBe(true)
  expect(errors).toEqual([])
})
