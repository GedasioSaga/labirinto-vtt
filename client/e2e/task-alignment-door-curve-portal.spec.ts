// E2E das 4 features da Fase 2-5 (plano `2026-08-25-alinhamento-porta-curva-andares.md`,
// Task 5): guias de alinhamento, porta em parede, link de cenário, ferramenta Curva e
// mapas linkados (andares). Mesmo padrão dos specs já existentes: passa pela tela
// inicial, prova estado via leitura direta da store (`getByRole`/`getByLabel` para
// interação, nunca texto que os componentes não expõem por acessibilidade).
//
// Roda contra `npm run dev` (Vite web) — não substitui a verificação em
// `npm run tauri:dev` (app Tauri real). Por isso o teste 5 não clica em "Novo andar
// em branco": esse botão chama `handleCreateLinkedMap`, que grava um `map.json` via
// API de arquivo do Tauri — indisponível fora do binário Tauri. Simulamos a conclusão
// dessa criação chamando `setPropLinkedPath` direto na store (o que o handler faz por
// baixo, depois do I/O) e verificamos que a UI reage de verdade ao novo estado.
import { test, expect, type Page } from '@playwright/test'
import type { Wall, Prop, Drawing } from '../src/types/map'

type MapSnapshot = {
  walls: Wall[]
  props: Prop[]
  drawings: Drawing[]
  scenarioLink: string | null
}

async function getMapSnapshot(page: Page): Promise<MapSnapshot> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return { walls: map.walls, props: map.props, drawings: map.drawings, scenarioLink: map.scenarioLink }
  })
}

async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection
  })
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_task5', 'E2E Task5', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

async function selectTool(page: Page, label: 'Selecionar' | 'Curva') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  // stub mínimo do bridge Tauri: fora do webview real, window.__TAURI_INTERNALS__ não existe,
  // e drawProps.ts chama convertFileSrc(prop.src) de forma síncrona ao desenhar qualquer peça
  // (mesmo com src fake) — sem o stub, isso derruba o page.evaluate inteiro dos testes 1 e 5.
  // Mesmo padrão de task4-select-delete.spec.ts.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar mapa' }).click()
  await page.waitForSelector('canvas')
  await resetMap(page)
})

test('1. alinhamento: prop arrastado perto de outro trava exatamente no candidato (mesmo x)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'propTarget', src: 'fake.png', x: 600, y: 300, width: 64, height: 64, linkedMapPath: null })
    mod.useMapStore.getState().addProp({ id: 'propDrag', src: 'fake.png', x: 300, y: 650, width: 64, height: 64, linkedMapPath: null })
  })
  await selectTool(page, 'Selecionar')

  await page.mouse.move(box.x + 300, box.y + 650)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 650, { steps: 5 })
  await page.mouse.move(box.x + 550, box.y + 650, { steps: 5 })
  // 604 fica a 4px do candidato x=600 (centro de propTarget) — dentro do threshold de 6.
  await page.mouse.move(box.x + 604, box.y + 650, { steps: 5 })
  await page.mouse.up()

  const { props } = await getMapSnapshot(page)
  const dragged = props.find((p) => p.id === 'propDrag')
  expect(dragged).toBeTruthy()
  expect(dragged!.x).toBe(600)
})

test('2. porta: virar parede em porta e alternar aberta/fechada reflete no store', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addWall({ id: 'wallDoor', x1: 400, y1: 400, x2: 650, y2: 400, blocksLight: true, blocksMove: true, door: null })
  })
  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 525, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'wall', id: 'wallDoor' })

  await page.getByRole('button', { name: 'Virar porta', exact: true }).click()
  let { walls } = await getMapSnapshot(page)
  let wall = walls.find((w) => w.id === 'wallDoor')
  expect(wall?.door).not.toBeNull()
  expect(wall?.door?.open).toBe(false)

  // O checkbox real fica visualmente coberto pelo track decorativo do Toggle (span
  // com o desenho do interruptor) — force:true clica direto no input, igual o usuário
  // clicando em cima do interruptor visual faria.
  await page.getByRole('checkbox', { name: 'Fechada' }).click({ force: true })
  ;({ walls } = await getMapSnapshot(page))
  wall = walls.find((w) => w.id === 'wallDoor')
  expect(wall?.door?.open).toBe(true)
})

test('3. link de cenário: digitar no campo atualiza map.scenarioLink', async ({ page }) => {
  const link = 'https://exemplo.com/cenario-1'
  await page.getByRole('textbox').fill(link)

  const { scenarioLink } = await getMapSnapshot(page)
  expect(scenarioLink).toBe(link)
})

test('4. curva: arrasto cria Bézier e arrastar um ponto de controle move só ele', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await selectTool(page, 'Curva')
  await page.mouse.move(box.x + 400, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 380, { steps: 5 })
  await page.mouse.move(box.x + 520, box.y + 420, { steps: 5 })
  await page.mouse.move(box.x + 600, box.y + 400, { steps: 5 })
  await page.mouse.up()

  const before = await getMapSnapshot(page)
  expect(before.drawings).toHaveLength(1)
  const curve = before.drawings[0]
  expect(curve.kind).toBe('curve')
  if (curve.kind !== 'curve') throw new Error('esperava um drawing kind curve')
  expect(curve.points.length).toBeGreaterThanOrEqual(2)
  const originalPoints = curve.points.map((p) => ({ ...p }))

  await selectTool(page, 'Selecionar')
  const p0 = originalPoints[0]
  await page.mouse.click(box.x + p0.x, box.y + p0.y)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: curve.id })

  await page.mouse.move(box.x + p0.x, box.y + p0.y)
  await page.mouse.down()
  await page.mouse.move(box.x + p0.x + 80, box.y + p0.y + 80, { steps: 5 })
  await page.mouse.up()

  const after = await getMapSnapshot(page)
  const movedCurve = after.drawings.find((d) => d.id === curve.id)
  expect(movedCurve).toBeTruthy()
  if (!movedCurve || movedCurve.kind !== 'curve') throw new Error('esperava um drawing kind curve')
  expect(movedCurve.points[0]).not.toEqual(originalPoints[0])
  expect(movedCurve.points.slice(1)).toEqual(originalPoints.slice(1))
})

test('5. andar: peça vira portal para outro mapa (linkedMapPath deixa de ser null)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addProp({ id: 'propPortal', src: 'fake.png', x: 400, y: 400, width: 64, height: 64, linkedMapPath: null })
  })
  await selectTool(page, 'Selecionar')
  await page.mouse.click(box.x + 400, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'prop', id: 'propPortal' })

  await expect(page.getByRole('button', { name: 'Novo andar em branco' })).toBeVisible()

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setPropLinkedPath('propPortal', 'C:/fake/maps/map_x/map.json')
  })

  const { props } = await getMapSnapshot(page)
  const prop = props.find((p) => p.id === 'propPortal')
  expect(prop?.linkedMapPath).not.toBeNull()

  await expect(page.getByRole('button', { name: 'Entrar no andar' })).toBeVisible()
})
