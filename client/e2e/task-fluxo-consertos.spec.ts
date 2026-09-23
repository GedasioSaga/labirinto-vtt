// E2E dos consertos de fluxo achados na auditoria do app real:
//  1. Início → Criar mapa de novo não quebra o editor;
//  2. Voltar do andar salva o andar antes de trocar;
//  4. Ctrl+A seleciona o mapa (não o texto da interface) e Ctrl+O abre;
//  5. ferramenta Token cria no ponto clicado, pedindo o nome;
//  6. token travado continua selecionável e oculto continua clicável;
//  7. "Mapa salvo" aparece ao salvar e no menu depois de Início.
// O disco é o de mentira de `helpers/tauriFsStub.ts` (sem Tauri no navegador).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import type { Region, Token } from '../src/types/map'

type StoreSnapshot = { regions: Region[]; tokens: Token[]; selection: { kind: string; id: string }[]; activeTool: string }

async function snapshot(page: Page): Promise<StoreSnapshot> {
  return page.evaluate(async () => {
    const { map, selection, activeTool } = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    return { regions: map.regions, tokens: map.tokens, selection: [...selection], activeTool }
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_fluxo', 'E2E Fluxo', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function drawRoomAt(page: Page, x0: number, y0: number, x1: number, y1: number) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  await page.getByRole('button', { name: 'Sala', exact: true }).click()
  await page.mouse.move(box.x + x0, box.y + y0)
  await page.mouse.down()
  await page.mouse.move(box.x + x1, box.y + y1, { steps: 5 })
  await page.mouse.up()
}

/** Ponto de mundo → ponto de página, pela câmera da store. */
async function worldToPage(page: Page, x: number, y: number) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  const camera = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  return { x: box.x + x * camera.scale + camera.x, y: box.y + y * camera.scale + camera.y }
}

async function addToken(page: Page, token: { id: string; name: string; x: number; y: number }, patch: { locked?: boolean; hidden?: boolean } = {}) {
  await page.evaluate(
    async ({ token, patch }) => {
      const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
      store.addToken({ ...token, characterId: null, size: 1, image: null })
      if (patch.locked !== undefined || patch.hidden !== undefined) store.updateToken(token.id, patch)
      store.setSelection([])
    },
    { token, patch },
  )
}

test.beforeEach(async ({ page }) => {
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)
})

test('1. Início e Criar mapa de novo: o editor abre e desenha', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.getByRole('button', { name: 'Início' }).click()
  await page.getByRole('button', { name: 'Criar Mapas' }).click()
  // Seletor de tipo escondido (FEATURES.otherMapTypes): o formulário abre direto.
  await expect(page.getByRole('button', { name: 'Dungeon Map' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()
  await page.waitForSelector('canvas')

  await drawRoomAt(page, 400, 400, 600, 500)
  await expect.poll(async () => (await snapshot(page)).regions.length).toBe(1)
  expect(pageErrors).toEqual([])
})

test('2. Voltar do andar salva o que foi desenhado nele', async ({ page }) => {
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.addProp({ id: 'escada', src: 'C:/escada.png', x: 900, y: 300, width: 64, height: 64, linkedMapPath: null })
    store.setSelection([{ kind: 'prop', id: 'escada' }])
  })
  await page.getByRole('button', { name: 'Novo andar em branco' }).click()
  await page.getByRole('button', { name: 'Entrar no andar' }).click()
  const back = page.getByRole('button', { name: 'Voltar' })
  await expect(back).toBeVisible()

  await drawRoomAt(page, 400, 400, 600, 500)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await snapshot(page)).regions.length).toBe(1)

  await back.click()
  await expect(back).toHaveCount(0)
  expect((await snapshot(page)).regions).toHaveLength(0)

  await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().setSelection([{ kind: 'prop', id: 'escada' }]))
  await page.getByRole('button', { name: 'Entrar no andar' }).click()
  await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
  await expect.poll(async () => (await snapshot(page)).regions.length).toBe(1)
})

test('4. Ctrl+A seleciona itens visíveis e destravados sem pintar a interface; Ctrl+O abre o diálogo', async ({ page }) => {
  await addToken(page, { id: 'a', name: 'A', x: 200, y: 200 })
  await addToken(page, { id: 'b', name: 'B', x: 400, y: 200 })
  await addToken(page, { id: 'travado', name: 'Travado', x: 600, y: 200 }, { locked: true })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  await page.keyboard.press('Control+a')
  await expect.poll(async () => (await snapshot(page)).selection.map((item) => item.id).sort()).toEqual(['a', 'b'])
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('')

  await page.keyboard.press('Control+o')
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __invokes: string[] }).__invokes.includes('plugin:dialog|open')))
    .toBe(true)
})

test('4b. em campo de texto Ctrl+A continua selecionando o texto do campo', async ({ page }) => {
  await addToken(page, { id: 'a', name: 'A', x: 200, y: 200 })
  await drawRoomAt(page, 400, 400, 600, 500)
  const overlay = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await overlay.fill('Cripta')
  await overlay.press('Control+a')
  expect(await overlay.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe('Cripta'.length)
  expect((await snapshot(page)).selection.map((item) => item.kind)).toEqual(['region'])
})

test('5. ferramenta Token: clique no mapa pede o nome e cria o token no ponto', async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  // A ferramenta Token está escondida (FEATURES.tokenTool): K não a aciona e a
  // barra não tem o botão. O comportamento dela continua provado abaixo, ativada
  // pela store — é o que religar a flag devolve ao usuário.
  await page.keyboard.press('k')
  expect((await snapshot(page)).activeTool).toBe('select')
  await expect(page.getByRole('button', { name: 'Token', exact: true })).toHaveCount(0)
  await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().setActiveTool('token'))
  const point = await worldToPage(page, 320, 256)
  await page.mouse.click(point.x, point.y)

  const nameInput = page.getByRole('textbox', { name: 'Nome do token no mapa' })
  await expect(nameInput).toBeFocused()
  await page.keyboard.type('Ogro')
  await page.keyboard.press('Enter')

  await expect.poll(async () => (await snapshot(page)).tokens.map((t) => t.name)).toEqual(['Ogro'])
  const [token] = (await snapshot(page)).tokens
  expect(Math.abs(token.x - 320)).toBeLessThanOrEqual(32)
  expect(Math.abs(token.y - 256)).toBeLessThanOrEqual(32)

  // Esc cancela sem criar nada.
  const other = await worldToPage(page, 640, 256)
  await page.mouse.click(other.x, other.y)
  await expect(nameInput).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(nameInput).toHaveCount(0)
  expect((await snapshot(page)).tokens).toHaveLength(1)
})

test('6. token travado é selecionável e não se move; oculto no editor continua clicável', async ({ page }) => {
  await addToken(page, { id: 'travado', name: 'Travado', x: 320, y: 320 }, { locked: true })
  await addToken(page, { id: 'oculto', name: 'Oculto', x: 640, y: 320 }, { hidden: true })

  const locked = await worldToPage(page, 320, 320)
  await page.mouse.move(locked.x, locked.y)
  await page.mouse.down()
  await page.mouse.move(locked.x + 120, locked.y + 60, { steps: 6 })
  await page.mouse.up()
  const afterDrag = await snapshot(page)
  expect(afterDrag.selection).toEqual([{ kind: 'token', id: 'travado' }])
  const lockedToken = afterDrag.tokens.find((t) => t.id === 'travado')
  expect([lockedToken?.x, lockedToken?.y]).toEqual([320, 320])

  const hidden = await worldToPage(page, 640, 320)
  await page.mouse.click(hidden.x, hidden.y)
  await expect.poll(async () => (await snapshot(page)).selection).toEqual([{ kind: 'token', id: 'oculto' }])
})

test('7. "Mapa salvo" ao salvar e no menu depois de Início; erro também aparece no menu', async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('status').filter({ hasText: 'Mapa salvo' })).toBeVisible()
  await page.evaluate(async () => (await import('/src/stores/toastStore.ts')).useToastStore.setState({ toasts: [] }))

  await page.getByRole('button', { name: 'Início' }).click()
  await expect(page.getByRole('button', { name: 'Criar Mapas' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Mapa salvo' })).toBeVisible()

  await page.evaluate(async () => (await import('/src/stores/toastStore.ts')).useToastStore.getState().push('error', 'Erro de teste no menu'))
  await expect(page.getByRole('alert').filter({ hasText: 'Erro de teste no menu' })).toBeVisible()
})
