// GOLDEN DE PIXELS DAS CAMADAS (fase 3, fatia 1: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// Gravado ANTES de qualquer mudança de render: o sistema de camadas promete que
// mapa antigo abre idêntico, pixel por pixel, no editor e no jogador. As fatias
// 3 e 4 (render por faixas) têm de passar aqui SEM regravar nada.
//
// O QUE PROVA: 5 mapas montados por código desenham exatamente os mesmos pixels
// (`maxDiffPixels: 0`). A ORDEM entre faixas só aparece onde os itens se
// sobrepõem, por isso desenho a mão, retângulo, texto, caminho e escada CRUZAM
// sala, chão de pincel, móvel e ficha, e o pino fica sobre o telhado. Câmera
// FIXA, escrita pela store (a tecla F enquadra por `contentBounds`, que ignora
// chão, textura, carimbo e pino). O jogador com visão parcial e área explorada
// faz as zonas da névoa desenharem (visível, explorado, desconhecido), com
// telhado, ficha, pino e luz de longe cruzando a borda da visão.
//
// COMO: só o `<canvas>` do Pixi entra na foto (o resto da página fica
// invisível por uma folha de estilo), com movimento reduzido (nuvens paradas). O jogador
// recebe o mapa CRU pelo WebSocket roteado (como
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
import { createExploration, encodeExploration, markRings } from '../src/lib/exploration'
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
  setGridSettings,
  setNuvens,
  setRelevo,
  setRoomRoof,
  setShowGrid,
} from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import { buildStairFromDraft } from '../src/lib/stairs'
import { comTexturas } from '../src/lib/texturas'
import { CAMADAS_PADRAO } from '../src/lib/camadas/padrao'
import type { CamadaPadraoId, DoorState, FloorPiece, MapData, ModeloDeCamadas, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 16
const LINHAS = 12
const FICHA = 'ficha-ana'
/** O mapa de 1024 x 768 inteiro, a 1:1 e centrado, no canvas de 1440 x 900 do editor. */
const CAMERA_DO_EDITOR = { x: 208, y: 66, scale: 1 }
/** PNG de 2 x 2 (imagem do móvel para o jogador). */
const IMAGEM_DO_MOVEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGElEQVR4nGM4oaGhseAEg8aCEydOaGgAACyXBhm1Ipj+AAAAAElFTkSuQmCC'

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

/** Mapa vazio com a ficha da Ana e a grade à vista. */
function mapaVazio(id: string, nome: string): MapData {
  const base = setGridSettings(setShowGrid(createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE), true), { color: '#6a6a6a', opacity: 0.6 })
  return addToken(base, { id: FICHA, characterId: null, name: 'Ana', x: 352, y: 288, size: 1, image: null })
}

function porta(id: string, y: number, estado: DoorState): MapData['walls'][number] {
  return { ...buildWallFromDraft(id, { x: 448, y }, { x: 512, y }), door: estado }
}

/**
 * (1) Casa. Na Sala, chão de pincel, mesa, cadeira e a ficha formam um bolo
 * que o rabisco, o retângulo, o texto, o caminho e a escada atravessam. No
 * corredor, porta secreta, fechada, aberta e trancada. Na Cozinha, fogueira
 * (chama), barril com rótulo e imagem, perigo, fumaça e esteira; na Sala, um gatilho.
 */
function mapaCasa(id = 'golden-casa'): MapData {
  let map = mapaVazio(id, 'Casa')
  const sala = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 64, y: 64 }, { x: 448, y: 384 }, undefined, undefined, 'Sala')
  map = addRoom(map, sala.region, sala.walls)
  const cozinha = buildRoomFromDraft('r2', ['w5', 'w6', 'w7', 'w8'], { x: 512, y: 64 }, { x: 896, y: 384 }, undefined, undefined, 'Cozinha')
  map = addRoom(map, cozinha.region, cozinha.walls)
  map = addFloorPiece(map, pincelada('f-sala', 'terra', blocosDe(2, 2, 4, 3)))
  map = addWall(map, porta('w9', 128, { kind: 'normal', open: false, locked: false, secret: true }))
  map = addWall(map, porta('w10', 192, { kind: 'normal', open: false, locked: false }))
  map = addWall(map, porta('w11', 256, { kind: 'normal', open: true, locked: false }))
  map = addWall(map, porta('w12', 320, { kind: 'normal', open: false, locked: true }))
  map = addProp(map, criarMovel('mesa', { x: 256, y: 224 }, GRADE, 'o1'))
  map = addProp(map, criarMovel('cadeira', { x: 320, y: 224 }, GRADE, 'o2'))
  map = addProp(map, criarMovel('tapete', { x: 704, y: 224 }, GRADE, 'o3'))
  map = addProp(map, { ...criarMovel('bau', { x: 832, y: 320 }, GRADE, 'o4'), layer: 'decoracao' })
  map = addProp(map, criarMovel('fogueira', { x: 640, y: 160 }, GRADE, 'o5'))
  map = addProp(map, { ...criarMovel('barril', { x: 832, y: 128 }, GRADE, 'o6'), playerLabel: 'Vinho', playerImage: IMAGEM_DO_MOVEL })
  map = addLight(map, buildLightAt('l1', { x: 160, y: 128 }, GRADE))
  map = addPin(map, buildPin('p1', { x: 640, y: 320 }, 'exclamacao'))
  map = addStair(map, buildStairFromDraft('s1', { x: 288, y: 200 }, { x: 352, y: 328 }, 8))
  map = addDrawing(map, buildFreehandDrawing('d1', [{ x: 160, y: 180 }, { x: 260, y: 230 }, { x: 350, y: 290 }, { x: 430, y: 250 }], '#c0392b', 4))
  map = addDrawing(map, buildRectDrawing('d2', { x: 232, y: 200 }, { x: 376, y: 312 }, '#f2f2f2', 3, true, 0.25))
  const rotulo = buildTextDrawing('d3', { x: 250, y: 250 }, '#ffe08a', 28)
  map = addDrawing(map, rotulo.kind === 'text' ? { ...rotulo, text: 'Adega' } : rotulo)
  map = addDrawing(map, buildPathDrawing('d4', [{ x: 96, y: 300 }, { x: 330, y: 240 }, { x: 600, y: 300 }], '#d9a441', 1, GRADE))
  return {
    ...map,
    hazards: [{ id: 'hz1', kind: 'fumaca', roomIds: ['r2'] }],
    perigos: [{ id: 'pg1', tipo: 'fogo', salas: ['r2'] }],
    gatilhos: [{ id: 'g1', kind: 'armadilha', regionId: 'r1', revealed: true }],
    conveyors: [{ id: 'cv1', roomId: 'r2', direction: 'leste', stepCells: 1 }],
  }
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

/** Retângulo do mundo como anel de visão. */
function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/**
 * (5) Visão parcial: a borda da visão (x = 576) corta a Casa de telhado, o
 * pino em cima do telhado e a luz de longe; à direita dela, uma faixa
 * explorada e, além, o desconhecido.
 */
const VISAO_PARCIAL = [anel(0, 0, 576, 768)]
const EXPLORADO_FORA = [anel(576, 64, 832, 512)]
function mapaVisao(): MapData {
  let map = mapaVazio('golden-visao', 'Visão')
  const salao = buildRoomFromDraft('r2', ['w5', 'w6', 'w7', 'w8'], { x: 64, y: 128 }, { x: 384, y: 448 }, undefined, undefined, 'Salão')
  map = addRoom(map, salao.region, salao.walls)
  const casa = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 448, y: 128 }, { x: 704, y: 384 }, undefined, undefined, 'Casa')
  map = setRoomRoof(addRoom(map, casa.region, casa.walls), 'r1', true)
  map = addPin(map, buildPin('p1', { x: 576, y: 256 }, 'exclamacao'))
  map = addLight(map, buildLightAt('l1', { x: 160, y: 224 }, GRADE))
  return addLight(map, { ...buildLightAt('l2', { x: 576, y: 448 }, GRADE), radius: 0, vistaDeLonge: true })
}

async function abrirNoEditor(page: Page, map: MapData): Promise<void> {
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, map)
  await page.mouse.move(1, 1)
  // Câmera escrita, não a tecla F: o pedido de câmera da store vai direto para o canvas (`applyCamera`).
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
  await page.evaluate(async (camera) => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera } })
  }, CAMERA_DO_EDITOR)
  await expect.poll(() => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)).toEqual(CAMERA_DO_EDITOR)
  await soOCanvas(page)
}

interface CenaDoJogador {
  map: MapData
  visao?: RegionPoint[][]
  explorado?: RegionPoint[][]
}

/** O host de mentira: a cada `join` manda a cena (por padrão, visão inteira e nada explorado) e a ficha da Ana. */
function hostCom({ map, visao = [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)], explorado = [] }: CenaDoJogador): (ws: WebSocketRoute) => void {
  const exploracao = createExploration(map)
  if (explorado.length > 0) markRings(exploracao, [...visao, ...explorado])
  const explored = encodeExploration(exploracao)
  return (ws) => {
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
      ws.send(JSON.stringify({ type: 'snapshot', rev: 1, map, vision: visao, explored, ownTokens: [FICHA], concealed: [], sceneName: map.name }))
    })
  }
}

async function abrirNoJogador(page: Page, cena: CenaDoJogador): Promise<void> {
  await page.routeWebSocket((url) => url.pathname === '/ws', hostCom(cena))
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

/** A lista padrão com `camada` tirada e posta logo acima de `acimaDe` (de baixo para cima). */
function listaCom(camada: CamadaPadraoId, acimaDe: CamadaPadraoId): ModeloDeCamadas {
  const sem = CAMADAS_PADRAO.filter((c) => c !== camada)
  const i = sem.indexOf(acimaDe)
  return { ordem: [...sem.slice(0, i + 1), camada, ...sem.slice(i + 1)].map((id) => ({ id })) }
}

// FATIA 3 (render do editor por faixas): a lista manda. A mesma Casa, na mesma
// câmera; só a lista de camadas ou a opacidade muda, posta pelo `loadMap`.
// Chão logo acima de Salas: a pincelada de terra pinta por cima do fundo da
// Sala, e paredes, móveis, luz e nomes continuam por cima. Escadas logo acima
// de Salas: a escada passa para baixo do rabisco, do retângulo e da porta que
// ela cobre. Objetos a 40%: mesa, cadeira, tapete, fogueira e barril esmaecem;
// o baú (Decoração) fica inteiro.
test.describe('editor a 1440 x 900, camadas mexidas (fatia 3)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  const casos: [string, () => MapData][] = [
    ['editor-chao-acima-de-salas.png', () => ({ ...mapaCasa(), modeloCamadas: listaCom('chao', 'salas') })],
    // Uma escada a mais cobre a porta trancada (vermelha) do corredor: sob Portas, a porta passa por cima dela.
    ['editor-escadas-acima-de-salas.png', () => ({ ...addStair(mapaCasa(), buildStairFromDraft('s2', { x: 460, y: 296 }, { x: 500, y: 344 }, 8)), modeloCamadas: listaCom('escadas', 'salas') })],
    ['editor-objetos-40.png', () => ({ ...mapaCasa(), opacidadeDasCamadas: { objetos: 0.4 } })],
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
  const casos: [string, () => CenaDoJogador][] = [
    ['jogador-1440-casa.png', () => ({ map: mapaCasa() })],
    ['jogador-1440-terreno.png', () => ({ map: mapaTerreno() })],
    ['jogador-1440-visao-parcial.png', () => ({ map: mapaVisao(), visao: VISAO_PARCIAL, explorado: EXPLORADO_FORA })],
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
      await abrirNoJogador(page, { map: montar() })
      await expect(page.locator('canvas').first()).toHaveScreenshot(foto, FOTO)
    })
  }
})
