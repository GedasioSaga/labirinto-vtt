// E2E do painel "só o que importa agora" (plano de remodelagem do painel,
// seções 1-3). Prova no navegador de verdade, com o main.css aplicado, o que o
// teste unitário não enxerga: a seção recolhível fecha DE VERDADE (o corpo some
// da tela, não só ganha o atributo `hidden` — `.lb-collapsible__body
// { display:flex }` já venceu o `hidden` uma vez), a regra de abrir por padrão,
// a ordem das seções, os interruptores rápidos da grade dentro de Camadas e o
// seletor de camada do objeto no novo lugar.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_panel_sections', 'E2E Painel', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
    mod.useMapStore.getState().setSnapEnabled(false)
  })
}

async function getGridState(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const state = mod.useMapStore.getState()
    return { showGrid: state.map.showGrid, snapTargets: state.snapTargets }
  })
}

async function getPropLayer(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.props.find((prop) => prop.id === id)?.layer ?? null
  }, id)
}

function sectionHeader(page: Page, title: 'Chão do mapa' | 'Camadas') {
  return page.locator('.lb-inspector').getByRole('button', { name: title, exact: true })
}

/** Corpo apontado pelo `aria-controls` do cabeçalho. O id vem de `useId` (tem
 *  ":"), por isso o seletor de atributo em vez de `#id`. */
async function sectionBody(page: Page, header: Locator): Promise<Locator> {
  const bodyId = await header.getAttribute('aria-controls')
  if (!bodyId) throw new Error('cabeçalho sem aria-controls')
  return page.locator(`[id="${bodyId}"]`)
}

test.beforeEach(async ({ page }) => {
  // drawProps.ts chama convertFileSrc(prop.src) ao desenhar o objeto do teste 4
  // (mesmo stub de task4-select-delete.spec.ts).
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('1. sem seleção as duas seções nascem abertas; fechar tira o corpo da tela e abrir traz de volta', async ({ page }) => {
  for (const title of ['Chão do mapa', 'Camadas'] as const) {
    const header = sectionHeader(page, title)
    const body = await sectionBody(page, header)
    // Conteúdo real de cada corpo, para o "visível" não passar num corpo vazio.
    const content =
      title === 'Camadas' ? body.getByRole('list', { name: 'Camadas do mapa' }) : body.getByText('Contorno', { exact: true })

    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await expect(body).toBeVisible()
    await expect(content).toBeVisible()

    await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(body).toHaveAttribute('hidden', '')
    await expect(body).toBeHidden()
    await expect(content).toBeHidden()

    await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    await expect(body).toBeVisible()
    await expect(content).toBeVisible()
  }
})

test('2. com item selecionado as seções nascem fechadas e a ordem é item -> Seleção -> Chão do mapa -> Camadas', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addToken({ id: 'tokPanel', characterId: null, name: 'Token', x: 400, y: 400, size: 1, image: null })
    mod.useMapStore.getState().setSelection([{ kind: 'token', id: 'tokPanel' }])
  })

  for (const title of ['Chão do mapa', 'Camadas'] as const) {
    const header = sectionHeader(page, title)
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(await sectionBody(page, header)).toBeHidden()
  }
  await expect(page.getByRole('list', { name: 'Camadas do mapa', includeHidden: true })).toBeHidden()

  // Títulos em ordem de DOM (a do leitor de tela e a da tela, que é uma coluna só).
  const headings = (await page.locator('.lb-inspector__body h2').allTextContents()).map((text) => text.trim())
  const tokenIndex = headings.indexOf('Token')
  const selectionIndex = headings.indexOf('Seleção')
  const floorIndex = headings.indexOf('Chão do mapa')
  const layersIndex = headings.indexOf('Camadas')
  expect(tokenIndex).toBeGreaterThanOrEqual(0)
  expect(selectionIndex).toBeGreaterThan(tokenIndex)
  expect(floorIndex).toBeGreaterThan(selectionIndex)
  expect(layersIndex).toBeGreaterThan(floorIndex)
  expect(layersIndex).toBe(headings.length - 1)
})

test('3. com ferramenta de desenho ativa (Chão) "Chão do mapa" nasce fechada e Camadas nem aparece', async ({ page }) => {
  await page.getByRole('button', { name: 'Chão', exact: true }).click()

  const floorHeader = sectionHeader(page, 'Chão do mapa')
  await expect(floorHeader).toHaveAttribute('aria-expanded', 'false')
  await expect(await sectionBody(page, floorHeader)).toBeHidden()
  await expect(sectionHeader(page, 'Camadas')).toHaveCount(0)
})

test('4. interruptores rápidos da grade dentro de Camadas mudam a store', async ({ page }) => {
  const layersBody = await sectionBody(page, sectionHeader(page, 'Camadas'))
  const quick = layersBody.getByRole('group', { name: 'Grade' })
  await expect(quick).toBeVisible()

  expect(await getGridState(page)).toEqual({ showGrid: true, snapTargets: { token: false, wall: false, prop: false } })

  // O input do Toggle fica visualmente escondido (Toggle.tsx); mesmo `force` dos outros specs.
  const showGrid = quick.getByRole('checkbox', { name: 'Mostrar grade', exact: true })
  await expect(showGrid).toBeChecked()
  await showGrid.click({ force: true })
  await expect.poll(async () => (await getGridState(page)).showGrid).toBe(false)
  await expect(showGrid).not.toBeChecked()

  const snapCases = [
    { name: 'Grudar Token no centro', kind: 'token' },
    { name: 'Grudar Parede na grade', kind: 'wall' },
    { name: 'Grudar Objeto na grade', kind: 'prop' },
  ] as const
  const expected = { token: false, wall: false, prop: false }
  for (const { name, kind } of snapCases) {
    const toggle = quick.getByRole('checkbox', { name, exact: true })
    await expect(toggle).not.toBeChecked()
    await toggle.click({ force: true })
    expected[kind] = true
    // Cada interruptor liga só o próprio alvo.
    await expect.poll(async () => (await getGridState(page)).snapTargets).toEqual(expected)
    await expect(toggle).toBeChecked()
  }
})

test('5. "Camada do objeto selecionado" mora na seção do objeto e grava a camada do Prop', async ({ page }) => {
  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'propLayer', src: 'fake.png', x: 400, y: 400, width: 64, height: 64, linkedMapPath: null })
    mod.useMapStore.getState().setSelection([{ kind: 'prop', id: 'propLayer' }])
  })

  const picker = page.getByRole('radiogroup', { name: 'Camada do objeto selecionado' })
  await expect(picker).toBeVisible()
  // Saiu de Camadas: nem com a seção aberta ele está lá dentro.
  const layersHeader = sectionHeader(page, 'Camadas')
  await layersHeader.click()
  await expect(layersHeader).toHaveAttribute('aria-expanded', 'true')
  await expect((await sectionBody(page, layersHeader)).getByRole('radiogroup', { name: 'Camada do objeto selecionado' })).toHaveCount(0)

  const objects = picker.getByRole('radio', { name: 'Objetos', exact: true })
  const decoration = picker.getByRole('radio', { name: 'Decoração', exact: true })
  await expect(objects).toHaveAttribute('aria-checked', 'true')
  await expect(decoration).toHaveAttribute('aria-checked', 'false')
  expect(await getPropLayer(page, 'propLayer')).toBeNull()

  await decoration.click()
  await expect.poll(() => getPropLayer(page, 'propLayer')).toBe('decoracao')
  await expect(decoration).toHaveAttribute('aria-checked', 'true')
  await expect(objects).toHaveAttribute('aria-checked', 'false')

  await objects.click()
  await expect.poll(() => getPropLayer(page, 'propLayer')).toBe('objetos')
  await expect(objects).toHaveAttribute('aria-checked', 'true')
})
