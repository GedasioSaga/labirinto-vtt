// E2E da edição de Curva pós-criação (Drawing kind 'curve'): inserir ponto novo
// no meio de um trecho (arrastando o ponto médio), remover um ponto de controle
// (duplo-clique nele) e mover o corpo inteiro sem mudar o formato. Espelha o
// padrão já usado para Região em `task-alignment-door-curve-portal.spec.ts`
// (teste 6, midpoint/vértice) e para Linha em `task-line-edit.spec.ts` (corpo
// vs ponta) — a Curva em si (arrasto de ponto de controle já existente) já tem
// cobertura no teste 4 daquele primeiro arquivo; aqui é só o que falta:
// insertCurvePoint/removeCurvePoint/moveCurve.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Drawing } from '../src/types/map'

type MapSnapshot = {
  drawings: Drawing[]
}

async function getMapSnapshot(page: Page): Promise<MapSnapshot> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const { map } = mod.useMapStore.getState()
    return { drawings: map.drawings }
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
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_curve', 'E2E Curve', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  // stub mínimo do bridge Tauri — mesmo padrão de task-line-edit.spec.ts.
  await page.addInitScript(() => {
    ;(window as unknown as { __TAURI_INTERNALS__?: { convertFileSrc: (p: string) => string } }).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string) => filePath,
    }
  })
  await enterEditor(page)
  await resetMap(page)
})

test('curva: arrastar o meio de um trecho insere ponto, duplo-clique nele remove, e arrastar o corpo desloca tudo igual', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // Curva de 3 pontos colineares — deixa os midpoints (375,400) e (525,400)
  // previsíveis, sem depender de simplifyToControlPoints() reduzir um traço
  // de mouse real.
  const originalPoints = [{ x: 300, y: 400 }, { x: 450, y: 400 }, { x: 600, y: 400 }]
  await page.evaluate(async (points) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().addDrawing({ id: 'curveDrag', kind: 'curve', points, color: '#ffffff', width: 4 })
  }, originalPoints)
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()

  // Seleciona clicando em cima do primeiro trecho, longe de qualquer vértice
  // ou midpoint (mesmo padrão dos outros specs: 1º clique só seleciona).
  await page.mouse.click(box.x + 350, box.y + 400)
  expect(await getSelection(page)).toEqual({ kind: 'drawing', id: 'curveDrag' })

  // Arrasta o midpoint do 1º trecho (300,400)-(450,400) = (375,400): insere um
  // ponto novo ali e já entra arrastando ele.
  await page.mouse.move(box.x + 375, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 375, box.y + 350, { steps: 5 })
  await page.mouse.up()

  let { drawings } = await getMapSnapshot(page)
  let curve = drawings.find((d) => d.id === 'curveDrag')
  expect(curve).toBeTruthy()
  if (!curve || curve.kind !== 'curve') throw new Error('esperava um drawing kind curve')
  expect(curve.points).toHaveLength(4)
  expect(curve.points).toEqual([
    { x: 300, y: 400 },
    { x: 375, y: 350 },
    { x: 450, y: 400 },
    { x: 600, y: 400 },
  ])

  // Duplo-clique no ponto novo (agora em 375,350) remove ele — volta pro
  // número de pontos e coordenadas originais.
  await page.mouse.dblclick(box.x + 375, box.y + 350)

  ;({ drawings } = await getMapSnapshot(page))
  curve = drawings.find((d) => d.id === 'curveDrag')
  expect(curve).toBeTruthy()
  if (!curve || curve.kind !== 'curve') throw new Error('esperava um drawing kind curve')
  expect(curve.points).toHaveLength(3)
  expect(curve.points).toEqual(originalPoints)

  // Arrasta o corpo inteiro (clique em cima do 2º trecho, a 40px do vértice
  // (450,400) e a 35px do midpoint (525,400) — longe o bastante dos handles
  // de 8px de raio) — mode='dragging-curve-body', delta-based (moveCurve
  // soma dx/dy), então todos os pontos deslocam igual e o formato preserva.
  // steps:1 evita que um sub-passo intermediário caia sobre um handle.
  await page.mouse.move(box.x + 490, box.y + 400)
  await page.mouse.down()
  await page.mouse.move(box.x + 530, box.y + 440, { steps: 1 })
  await page.mouse.up()

  ;({ drawings } = await getMapSnapshot(page))
  curve = drawings.find((d) => d.id === 'curveDrag')
  expect(curve).toBeTruthy()
  if (!curve || curve.kind !== 'curve') throw new Error('esperava um drawing kind curve')
  expect(curve.points).toEqual(originalPoints.map((p) => ({ x: p.x + 40, y: p.y + 40 })))
})
