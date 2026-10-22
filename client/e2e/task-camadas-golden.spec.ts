// GOLDEN DE PIXELS DAS CAMADAS (fase 3, fatia 1: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// Gravado ANTES de qualquer mudança de render: o sistema de camadas promete que
// mapa antigo abre idêntico, pixel por pixel, no editor e no jogador. As fatias
// 3 e 4 (render por faixas) têm de passar aqui SEM regravar nada.
//
// O QUE PROVA: 4 mapas montados por código (casa completa; terreno com textura,
// relevo, carimbos, nuvens e telhado; chão com duas camadas de pincel
// empilhadas; mapa com camadas antigas ocultas e travadas) desenham exatamente
// os mesmos pixels (`maxDiffPixels: 0`) no editor a 1440 x 900 e no jogador.
// Teto de 8 imagens: o jogador a 1440 vê a casa e o terreno; a 390, o chão de
// pincel e as camadas antigas.
//
// COMO: só o `<canvas>` do Pixi entra na foto (o resto da página fica
// invisível por uma folha de estilo), com movimento reduzido (nuvens paradas).
// O jogador recebe o mapa CRU pelo WebSocket roteado (como
// task-jogador-ficha-aberta-390.spec.ts): isto confere o desenho, não o
// recorte do host.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pecaNaCamada } from '../src/lib/camadasDoChao'
import { comCarimbos } from '../src/lib/carimbos'
import {
  buildFreehandDrawing,
  buildLightAt,
  buildPathDrawing,
  buildRectDrawing,
  buildRoomFromDraft,
  buildTextDrawing,
  buildWallFromDraft,
} from '../src/lib/drawingFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { buildBlocosShape } from '../src/lib/floorBlocks'
import { buildFloorPiece } from '../src/lib/floorTool'
import {
  addDrawing,
  addFloorPiece,
  addLight,
  addPin,
  addProp,
  addRoom,
  addStair,
  addToken,
  addWall,
  buildPin,
  createEmptyMap,
  setNuvens,
  setRelevo,
  setRoomRoof,
} from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { buildStairFromDraft } from '../src/lib/stairs'
import { comTexturas } from '../src/lib/texturas'
import type { FloorPiece, MapData, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 12
const FICHA = 'ficha-ana'

// Movimento reduzido: as nuvens ficam PARADAS na fase de cada uma (`pixi/drawNuvens.ts`).
test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' } })

/** Só o canvas do Pixi aparece na foto: painéis e botões ficam invisíveis, sem mudar o layout. */
const SO_O_CANVAS = '*:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'
// `as const`: só congela os literais ('disabled', 'hide') que a assinatura de toHaveScreenshot pede; não troca tipo nenhum.
const FOTO = { maxDiffPixels: 0, animations: 'disabled', caret: 'hide', timeout: 20_000 } as const

/**
 * Esconde a interface por folha de estilo na página (a opção `style` da foto
 * não escondeu os painéis, medido em 22/10/2026). `visibility` não mexe no
 * layout: o canvas fica do mesmo tamanho e no mesmo lugar.
 */
async function soOCanvas(page: Page): Promise<void> {
  await page.addStyleTag({ content: SO_O_CANVAS })
}

function mapaVazio(id: string, nome: string): MapData {
  return addToken(createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE), { id: FICHA, characterId: null, name: 'Ana', x: 352, y: 288, size: 1, image: null })
}

/** (1) Casa: salas, paredes, porta, escada, móveis, tapete, luz, ficha, pino, desenhos, texto e caminho. */
function mapaCasa(id = 'golden-casa'): MapData {
  let map = mapaVazio(id, 'Casa')
  const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 448, y: 384 }, undefined, undefined, 'Sala')
  map = addRoom(map, sala.region, sala.walls)
  const cozinha = buildRoomFromDraft('r2', ['w5', 'w6', 'w7', 'w8'], { x: 512, y: 64 }, { x: 896, y: 384 }, undefined, undefined, 'Cozinha')
  map = addRoom(map, cozinha.region, cozinha.walls)
  map = addWall(map, { ...buildWallFromDraft('w9', { x: 448, y: 192 }, { x: 512, y: 192 }), door: { kind: 'normal', open: false, locked: false } })
  map = addStair(map, buildStairFromDraft('s1', { x: 128, y: 448 }, { x: 256, y: 640 }, 16))
  map = addProp(map, criarMovel('mesa', { x: 256, y: 224 }, GRADE, 'o1'))
  map = addProp(map, criarMovel('cadeira', { x: 320, y: 224 }, GRADE, 'o2'))
  map = addProp(map, criarMovel('tapete', { x: 704, y: 224 }, GRADE, 'o3'))
  map = addProp(map, { ...criarMovel('bau', { x: 832, y: 320 }, GRADE, 'o4'), layer: 'decoracao' })
  map = addLight(map, buildLightAt('l1', { x: 256, y: 128 }, GRADE))
  map = addPin(map, buildPin('p1', { x: 640, y: 320 }, 'exclamacao'))
  map = addDrawing(map, buildFreehandDrawing('d1', [{ x: 576, y: 448 }, { x: 640, y: 480 }, { x: 704, y: 456 }, { x: 768, y: 512 }], '#c0392b', 3))
  map = addDrawing(map, buildRectDrawing('d2', { x: 320, y: 448 }, { x: 512, y: 576 }, '#2c7be5', 2, true, 0.2))
  const rotulo = buildTextDrawing('d3', { x: 576, y: 600 }, '#222222', 20)
  map = addDrawing(map, rotulo.kind === 'text' ? { ...rotulo, text: 'Adega' } : rotulo)
  map = addDrawing(map, buildPathDrawing('d4', [{ x: 64, y: 704 }, { x: 384, y: 672 }, { x: 960, y: 704 }], '#8a6a3a', 1, GRADE))
  return map
}

/** (2) Terreno: textura de pincel, relevo, carimbos, nuvens e uma casa com telhado. */
function mapaTerreno(): MapData {
  let map = mapaVazio('golden-terreno', 'Terreno')
  const casa = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 448, y: 128 }, { x: 704, y: 384 }, undefined, undefined, 'Casa')
  map = setRoomRoof(addRoom(map, casa.region, casa.walls), 'r1', true)
  map = comTexturas(map, [
    { id: 'tx1', tipo: 'pincel', textura: 'grama', forca: 0.8, raio: 96, pontos: [{ x: 96, y: 512 }, { x: 320, y: 560 }, { x: 640, y: 520 }, { x: 960, y: 600 }] },
  ])
  map = comCarimbos(map, [
    { id: 'c1', tipo: 'pinheiro', x: 160, y: 256, tamanho: 64, giro: 0 },
    { id: 'c2', tipo: 'pedras', x: 864, y: 704, tamanho: 48, giro: 30 },
    { id: 'c3', tipo: 'arbusto', x: 288, y: 704, tamanho: 40, giro: 0 },
  ])
  return setNuvens(setRelevo(map, true), true)
}

function pincelada(id: string, camada: Parameters<typeof pecaNaCamada>[1], blocos: { col: number; row: number }[]): FloorPiece {
  const forma = buildBlocosShape(GRADE, blocos)
  if (forma === null) throw new Error(`pincelada ${id} sem blocos`)
  return pecaNaCamada(buildFloorPiece(id, forma, 'add'), camada)
}

function blocosDe(col0: number, row0: number, colunas: number, linhas: number): { col: number; row: number }[] {
  return Array.from({ length: colunas * linhas }, (_, i) => ({ col: col0 + (i % colunas), row: row0 + Math.floor(i / colunas) }))
}

/** (3) Chão de pincel: duas cores empilhadas, a de cima cobrindo parte da de baixo. */
function mapaPincel(): MapData {
  let map = mapaVazio('golden-pincel', 'Pincel')
  map = addFloorPiece(map, pincelada('f1', 'grama', blocosDe(1, 1, 8, 6)))
  return addFloorPiece(map, pincelada('f2', 'terra', blocosDe(5, 4, 8, 6)))
}

/** (4) A casa com chão e camadas antigas ocultas e travadas (Salas oculta leva o chão junto). */
function mapaCamadasAntigas(): MapData {
  const casa = addFloorPiece(mapaCasa('golden-antigas'), pincelada('f1', 'pedra', blocosDe(1, 1, 6, 5)))
  return { ...casa, hiddenLayers: ['salas', 'anotacoes', 'iluminacao'], lockedLayers: ['tokens', 'paredes'] }
}

async function abrirNoEditor(page: Page, map: MapData): Promise<void> {
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, map)
  await page.mouse.move(1, 1)
  // Tecla F: enquadra o mapa inteiro (`fitAll`), a mesma câmera a cada rodada.
  await page.keyboard.press('f')
  await soOCanvas(page)
}

/** O host de mentira: a cada `join` manda a cena com a visão inteira e a ficha da Ana. */
function hostCom(map: MapData): (ws: WebSocketRoute) => void {
  const largura = COLUNAS * GRADE
  const altura = LINHAS * GRADE
  const visao: RegionPoint[][] = [[{ x: 0, y: 0 }, { x: largura, y: 0 }, { x: largura, y: altura }, { x: 0, y: altura }]]
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(JSON.stringify({ type: 'snapshot', rev: 1, map, vision: visao, explored: encodeExploration(createExploration(map)), ownTokens: [FICHA], concealed: [], sceneName: map.name }))
    })
  }
}

async function abrirNoJogador(page: Page, map: MapData): Promise<void> {
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(map))
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('GOLDEN')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  await soOCanvas(page)
}

test.describe('editor a 1440 x 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  const casos: [string, () => MapData][] = [
    ['editor-casa.png', () => mapaCasa()],
    ['editor-terreno.png', mapaTerreno],
    ['editor-pincel.png', mapaPincel],
    ['editor-camadas-antigas.png', mapaCamadasAntigas],
  ]
  for (const [foto, montar] of casos) {
    test(foto, async ({ page }) => {
      test.setTimeout(90_000)
      await abrirNoEditor(page, montar())
      await expect(page.locator('canvas').first()).toHaveScreenshot(foto, FOTO)
    })
  }
})

test.describe('jogador a 1440 x 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  const casos: [string, () => MapData][] = [
    ['jogador-1440-casa.png', () => mapaCasa()],
    ['jogador-1440-terreno.png', mapaTerreno],
  ]
  for (const [foto, montar] of casos) {
    test(foto, async ({ page }) => {
      test.setTimeout(90_000)
      await abrirNoJogador(page, montar())
      await expect(page.locator('canvas').first()).toHaveScreenshot(foto, FOTO)
    })
  }
})

test.describe('jogador a 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  const casos: [string, () => MapData][] = [
    ['jogador-390-pincel.png', mapaPincel],
    ['jogador-390-camadas-antigas.png', mapaCamadasAntigas],
  ]
  for (const [foto, montar] of casos) {
    test(foto, async ({ page }) => {
      test.setTimeout(90_000)
      await abrirNoJogador(page, montar())
      await expect(page.locator('canvas').first()).toHaveScreenshot(foto, FOTO)
    })
  }
})
