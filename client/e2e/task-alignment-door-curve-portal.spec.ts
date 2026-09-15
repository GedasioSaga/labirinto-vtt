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
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
import type { Wall, Prop, Drawing, Region } from '../src/types/map'

type MapSnapshot = {
  walls: Wall[]
  props: Prop[]
  drawings: Drawing[]
  regions: Region[]
  scenarioLink: string | null
}

async function getMapSnapshot(page: Page): Promise<MapSnapshot> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return { walls: map.walls, props: map.props, drawings: map.drawings, regions: map.regions, scenarioLink: map.scenarioLink }
  })
}

// Onda 4, item 24 — `selection` do store virou SelectionSet (array). `[0] ??
// null` adapta pro formato de item único que os specs já esperavam.
async function getSelection(page: Page) {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
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

// Curva mora no botão Desenho: `pickTool` abre a setinha e escolhe o rádio.
async function selectTool(page: Page, label: 'Selecionar' | 'Curva') {
  await pickTool(page, label)
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
  await enterEditor(page)
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
  // Rótulo fixo "Aberta" (nomeia o estado LIGADO); porta nova começa desmarcada.
  const aberta = page.getByRole('checkbox', { name: 'Aberta', exact: true })
  await expect(aberta).not.toBeChecked()
  await aberta.click({ force: true })
  ;({ walls } = await getMapSnapshot(page))
  wall = walls.find((w) => w.id === 'wallDoor')
  expect(wall?.door?.open).toBe(true)
  await expect(aberta).toBeChecked()
})

test('3. link de cenário: campo escondido da janela, mas o dado ainda é salvo e reaberto', async ({ page }) => {
  const link = 'https://exemplo.com/cenario-1'
  // FEATURES.scenarioLink=false tira o campo da janela "Configurações do mapa"
  // (plano D12). O dado continua passando por App.tsx e pelo arquivo: grava
  // pela store, salva com Ctrl+S no disco de mentira e reabre de lá.
  await installTauriFsStub(page)
  await enterEditor(page)
  await resetMap(page)

  await page.getByRole('button', { name: 'Configurações do mapa' }).click()
  const dialog = page.getByRole('dialog', { name: 'Configurações do mapa' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Link de cenário')).toHaveCount(0)
  await expect(dialog.getByLabel('Endereço do cenário')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toHaveCount(0)

  await page.evaluate(async (value) => {
    ;(await import('/src/stores/mapStore.ts')).useMapStore.getState().setScenarioLink(value)
  }, link)
  expect((await getMapSnapshot(page)).scenarioLink).toBe(link)

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('status').filter({ hasText: 'Mapa salvo' })).toBeVisible()

  const reopened = await page.evaluate(async () => {
    const files = (window as unknown as { __fakeFs: Record<string, string> }).__fakeFs
    const path = Object.keys(files).find((p) => p.endsWith('.json') && files[p].includes('map_e2e_task5'))
    if (!path) throw new Error('Ctrl+S não gravou o map.json no disco de mentira')
    const { loadMapFromDisk } = await import('/src/lib/mapFileIO.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const mapFactory = await import('/src/lib/mapFactory.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_outro', 'Outro', 5, 5, 64))
    const map = await loadMapFromDisk(path)
    mod.useMapStore.getState().loadMap(map)
    return mod.useMapStore.getState().map.scenarioLink
  })
  expect(reopened).toBe(link)
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

test('6. alinhamento: vertice de Regiao arrastado perto da borda de outra regiao trava exatamente no candidato (mesmo x)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    // regionTarget: um vertice fixo em x=600 serve de candidato de alinhamento.
    mod.useMapStore.getState().addRegion({
      id: 'regionTarget',
      points: [{ x: 600, y: 300 }, { x: 680, y: 250 }, { x: 680, y: 380 }],
      tag: 'region',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    })
    // regionDrag: o vertice 0 (300,650) e o que vamos arrastar.
    mod.useMapStore.getState().addRegion({
      id: 'regionDrag',
      points: [{ x: 300, y: 650 }, { x: 380, y: 650 }, { x: 340, y: 720 }],
      tag: 'region',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    })
  })
  await selectTool(page, 'Selecionar')

  // Primeiro clique seleciona a regiao (dentro do triangulo, longe de qualquer
  // vertice) — só depois disso o pointerdown em cima de um vertice entra no
  // modo de arrastar ponto (mesmo padrão do teste 4, com curva).
  await page.mouse.click(box.x + 340, box.y + 673)
  expect(await getSelection(page)).toEqual({ kind: 'region', id: 'regionDrag' })

  await page.mouse.move(box.x + 300, box.y + 650)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 650, { steps: 5 })
  await page.mouse.move(box.x + 550, box.y + 650, { steps: 5 })
  // 604 fica a 4px do candidato x=600 (vertice de regionTarget) — dentro do threshold de 6.
  await page.mouse.move(box.x + 604, box.y + 650, { steps: 5 })
  await page.mouse.up()

  const { regions } = await getMapSnapshot(page)
  const dragged = regions.find((r) => r.id === 'regionDrag')
  expect(dragged).toBeTruthy()
  expect(dragged!.points[0]).toEqual({ x: 600, y: 650 })
  expect(dragged!.points.slice(1)).toEqual([{ x: 380, y: 650 }, { x: 340, y: 720 }])
})

test('7. alinhamento: vertice de Parede solta arrastado perto de outra parede trava exatamente no candidato (mesmo x)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    // wallTarget: parede solta com um extremo fixo em x=600 serve de candidato de alinhamento.
    mod.useMapStore.getState().addWall({ id: 'wallTarget', x1: 600, y1: 300, x2: 750, y2: 300, blocksLight: true, blocksMove: true, door: null })
    // wallDrag: o extremo 0 (300,650) e o que vamos arrastar.
    mod.useMapStore.getState().addWall({ id: 'wallDrag', x1: 300, y1: 650, x2: 380, y2: 650, blocksLight: true, blocksMove: true, door: null })
  })
  await selectTool(page, 'Selecionar')

  // Primeiro clique seleciona a parede (no corpo, longe de qualquer extremo) — só
  // depois disso o pointerdown em cima de um extremo entra no modo de arrastar
  // vértice (mesmo padrão do teste 6, com região). updateWallPoint é absolute
  // (escreve o ponto calculado direto, sem acumular delta), então só a posição
  // final do cursor importa — mesmo padrão dos testes 1 e 6.
  await page.mouse.click(box.x + 340, box.y + 650)
  expect(await getSelection(page)).toEqual({ kind: 'wall', id: 'wallDrag' })

  await page.mouse.move(box.x + 300, box.y + 650)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 650, { steps: 5 })
  await page.mouse.move(box.x + 550, box.y + 650, { steps: 5 })
  // 604 fica a 4px do candidato x=600 (extremo de wallTarget) — dentro do threshold de 6.
  await page.mouse.move(box.x + 604, box.y + 650, { steps: 5 })
  await page.mouse.up()

  const { walls } = await getMapSnapshot(page)
  const dragged = walls.find((w) => w.id === 'wallDrag')
  expect(dragged).toBeTruthy()
  expect(dragged!.x1).toBe(600)
  expect(dragged!.y1).toBe(650)
  expect(dragged!.x2).toBe(380)
  expect(dragged!.y2).toBe(650)
})

test('8. alinhamento: corpo de Parede solta arrastado perto do extremo de outra parede trava exatamente no candidato (mesmo x)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addWall({ id: 'wallTarget', x1: 600, y1: 300, x2: 750, y2: 300, blocksLight: true, blocksMove: true, door: null })
    mod.useMapStore.getState().addWall({ id: 'wallDrag', x1: 300, y1: 650, x2: 380, y2: 650, blocksLight: true, blocksMove: true, door: null })
  })
  await selectTool(page, 'Selecionar')

  // Arrasto de CORPO (clique longe de qualquer extremo) entra em dragging-wall-body
  // no próprio pointerdown — não precisa de clique de seleção antes, ao contrário
  // do arrasto de vértice acima. Diferença crucial pro cálculo do teste:
  // dragging-wall-body é delta-based (moveWall soma dx/dy no ponto corrente pra
  // preservar a forma da parede, âncora em x1/y1), não absolute como o vértice.
  // Por isso cada `.mouse.move` abaixo usa steps:1 (um único evento, sem
  // interpolação): com steps>1 um sub-passo intermediário poderia cair, sem
  // querer, dentro do threshold de alinhamento (6px) e "prender" a parede num
  // candidato antes da hora — como o resultado de cada frame vira a nova base
  // pro próximo delta, isso mudaria o valor final. As três posições abaixo (390 de
  // avanço acumulado do cursor, x1 tentativo 300→450→550→604) foram calculadas pra
  // só a última cair dentro do threshold (as duas primeiras ficam a 150px e 50px
  // de distância do candidato, bem acima de 6).
  await page.mouse.move(box.x + 340, box.y + 650)
  await page.mouse.down()
  await page.mouse.move(box.x + 490, box.y + 650, { steps: 1 })
  await page.mouse.move(box.x + 590, box.y + 650, { steps: 1 })
  await page.mouse.move(box.x + 644, box.y + 650, { steps: 1 })
  await page.mouse.up()

  const { walls } = await getMapSnapshot(page)
  const dragged = walls.find((w) => w.id === 'wallDrag')
  expect(dragged).toBeTruthy()
  // x1 trava em 600 (candidato); x2 preserva a largura original (80px) porque
  // moveWall translada os dois extremos pelo mesmo delta.
  expect(dragged!.x1).toBe(600)
  expect(dragged!.y1).toBe(650)
  expect(dragged!.x2).toBe(680)
  expect(dragged!.y2).toBe(650)
})

test('9. alinhamento: corpo de Região arrastado perto do vértice de outra região trava exatamente no candidato (mesmo x)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addRegion({
      id: 'regionTarget',
      points: [{ x: 600, y: 300 }, { x: 680, y: 250 }, { x: 680, y: 380 }],
      tag: 'region',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    })
    mod.useMapStore.getState().addRegion({
      id: 'regionDrag',
      points: [{ x: 300, y: 650 }, { x: 380, y: 650 }, { x: 340, y: 720 }],
      tag: 'region',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
    })
  })
  await selectTool(page, 'Selecionar')

  // Clique dentro do triângulo (longe de qualquer vértice) entra em
  // dragging-region-body direto no pointerdown, mesmo esquema do corpo de parede
  // acima — moveRegion também é delta-based, ancorado em region.points[0]. Mesmo
  // motivo pro steps:1 e pras mesmas três posições (avanço acumulado do cursor:
  // 150, depois 100, depois 54 — ponto tentativo de points[0] vai de 300 a 450,
  // depois 550, depois 604, só a última dentro do threshold de 6 do candidato x=600).
  await page.mouse.move(box.x + 340, box.y + 673)
  await page.mouse.down()
  await page.mouse.move(box.x + 490, box.y + 673, { steps: 1 })
  await page.mouse.move(box.x + 590, box.y + 673, { steps: 1 })
  await page.mouse.move(box.x + 644, box.y + 673, { steps: 1 })
  await page.mouse.up()

  const { regions } = await getMapSnapshot(page)
  const dragged = regions.find((r) => r.id === 'regionDrag')
  expect(dragged).toBeTruthy()
  // Os 3 pontos transladam juntos pelo mesmo delta (forma do triângulo preservada);
  // só points[0] (a âncora) trava exatamente no candidato x=600.
  expect(dragged!.points).toEqual([{ x: 600, y: 650 }, { x: 680, y: 650 }, { x: 640, y: 720 }])
})
