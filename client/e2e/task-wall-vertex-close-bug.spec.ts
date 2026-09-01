// E2E do bug relatado pelo usuário: "nao consigo fechar as paredes externas quando eu
// puxo para ficar mais perto, e como se ele nao deixasse". Causa raiz (Dossiê F4,
// investigação G4): arrastar a PONTA de uma parede JÁ DESENHADA (`dragging-wall-point`
// em PixiCanvas.tsx) usava só `computeAlignment` — um guia de alinhamento que testa X e
// Y de forma INDEPENDENTE (tolerância 6px POR EIXO) — nunca o ímã de vértice
// (`findNearestExistingVertex`, tolerância 12px de distância euclidiana conjunta) que a
// ferramenta "Parede" já usa ao DESENHAR uma parede nova. Resultado: soltar a ponta a
// poucos px de outra parede em AMBOS os eixos deixava uma folga visível em vez de fechar
// o canto, mesmo "parecendo" colado.
//
// Mesmo padrão de task-vertex-magnet.spec.ts (que cobre o ímã ao DESENHAR), mas para o
// caminho de EDITAR uma parede já existente. Coordenadas escolhidas com x >= 400 e
// y >= 200 de propósito: o painel esquerdo (~280px) e a barra superior (~100px) são DOM
// por cima do canvas e engolem o clique se o ponto cair debaixo deles — não é bug do
// gesto, é sobreposição de UI (confirmado depurando com uma captura de tela).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { Wall } from '../src/types/map'

async function getWalls(page: Page): Promise<Wall[]> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().map.walls
  })
}

// Duas paredes SOLTAS (sem regionId) — mundo coincide com tela porque a câmera nasce em
// { x: 0, y: 0, scale: 1 } (mapStore.ts). wallA fica na diagonal com vértice-alvo em
// (900,500); wallB é a que vamos arrastar pela ponta (x2,y2 = 650,650).
const wallA: Wall = { id: 'wA', x1: 700, y1: 300, x2: 900, y2: 500, blocksLight: true, blocksMove: true, door: null }
const wallB: Wall = { id: 'wB', x1: 400, y1: 650, x2: 650, y2: 650, blocksLight: true, blocksMove: true, door: null }

async function resetMap(page: Page) {
  await page.evaluate(
    async ({ a, b }: { a: Wall; b: Wall }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const mod = await import('/src/stores/mapStore.ts')
      let map = mapFactory.createEmptyMap('map_e2e_wall_vertex_close', 'E2E', 30, 20, 64)
      map = mapFactory.addWall(map, a)
      map = mapFactory.addWall(map, b)
      mod.useMapStore.getState().loadMap(map)
      mod.useMapStore.getState().setActiveTool('select')
      // Desliga o snap de grade — sem isso não dá pra distinguir "grudou no vértice da
      // outra parede" de "coincidiu com uma célula da grade" (900,500 não é múltiplo de
      // 64, mas mesma cautela dos outros specs desta família).
      mod.useMapStore.getState().setSnapEnabled(false)
    },
    { a: wallA, b: wallB },
  )
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click()
})

test('arrastar a ponta de uma parede existente pra perto (não exatamente em cima) do vértice de outra parede fecha o canto exatamente', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // 1. Seleciona wallB clicando no CORPO dela (não numa ponta) — pré-requisito pro
  // gesto de arrastar ponta: `dragging-wall-point` só entra com a wall já selecionada.
  await page.mouse.click(box.x + 500, box.y + 650)
  // Onda 4, item 24 — `selection` do store virou SelectionSet (array).
  const selection = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
  })
  expect(selection).toEqual({ kind: 'wall', id: 'wB' })

  // 2. Pointerdown exatamente na ponta livre de wallB (x2,y2 = 650,650) — entra em
  // 'dragging-wall-point'.
  await page.mouse.move(box.x + 650, box.y + 650)
  await page.mouse.down()
  // 3. Solta a (908,493) — 8px de X e 7px de Y do vértice (900,500) de wallA
  // (distância euclidiana ~10.6px, dentro da tolerância do ímã, 12px). Cada eixo
  // SOZINHO (8px, 7px) já está FORA da tolerância do guia de alinhamento antigo (6px
  // por eixo) — reproduz exatamente o gesto do usuário: "perto" visualmente, mas sem o
  // ímã nenhum dos dois eixos grudava, deixando o canto aberto.
  await page.mouse.move(box.x + 908, box.y + 493, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  const b = walls.find((w) => w.id === 'wB')
  expect(b).toBeTruthy()
  // `?.`, não `!`: a linha acima já falha explicitamente se `b` for undefined
  // (toBeTruthy) — aqui só evita non-null assertion redundante, sem mascarar
  // nada (se `b` sumisse, `.x2` viraria undefined e toBe(900) já reprovaria).
  // A ponta arrastada tem que terminar EXATAMENTE no vértice de wallA — não só "perto".
  expect(b?.x2).toBe(900)
  expect(b?.y2).toBe(500)
})

test('arrastar a ponta de uma parede existente NÃO gruda na própria outra ponta dela (excludeWallId)', async ({ page }) => {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')

  // wallB tem x1=(400,650). Arrastar a ponta x2 pra perto de x1 (a OUTRA ponta da MESMA
  // parede) não deveria grudar nela via excludeWallId — regressão-guarda do fix de G4.
  await page.mouse.click(box.x + 500, box.y + 650)
  // Onda 4, item 24 — `selection` do store virou SelectionSet (array).
  const selection = await page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    return mod.useMapStore.getState().selection[0] ?? null
  })
  expect(selection).toEqual({ kind: 'wall', id: 'wB' })

  await page.mouse.move(box.x + 650, box.y + 650)
  await page.mouse.down()
  // Solta a 8px de (400,650) — dentro da tolerância do ímã SE a própria wall contasse
  // como candidata; como não conta (excludeWallId), o ponto final não é (400,650) exato.
  await page.mouse.move(box.x + 408, box.y + 650, { steps: 5 })
  await page.mouse.up()

  const walls = await getWalls(page)
  const b = walls.find((w) => w.id === 'wB')
  expect(b).toBeTruthy()
  // `?.` pelo mesmo motivo do teste acima — não mascara ausência, só evita `!`.
  // Não vira um segmento de comprimento ~0 grudado na própria ponta oposta.
  expect(b?.x2).not.toBe(400)
})
