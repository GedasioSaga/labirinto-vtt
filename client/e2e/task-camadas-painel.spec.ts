// PAINEL DAS 13 CAMADAS (fase 3, fatia 6: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE PROVA, com a mão do mestre no painel de verdade (página Cena do livro):
// (1) a VIRADA para o mapa v2 (primeiro uso do olho dos jogadores) não muda
//     nenhum pixel do editor, mesmo com Salas oculta (Chão a segue no mapa de
//     antes e passa a ficar oculto explícito);
// (2) a opacidade muda o pixel no editor SEM repintar (mesmo número de nós da
//     pilha) e volta idêntica;
// (3) o olho do mestre de Telhados substitui o botão "Telhados", e o
//     "Transparente" só aparece enquanto o mestre vê os telhados;
// (4) Chão leva as camadas do chão aninhadas;
// (5) os dois olhos ponta a ponta: o mapa do mestre sai pelo recorte REAL do
//     host (`filterMapForPlayer`) e chega à tela do jogador pela rota do
//     WebSocket. Esconder Desenhos dos jogadores tira o desenho da tela DELES
//     e deixa na do mestre; a opacidade muda o alfa no jogador sem repintar.
//
// O recorte de verdade pela rota do WebSocket deixou a tela do golden em
// "Aguardando o mestre atribuir um personagem" (revisão da fatia 4); aqui ele
// chega e desenha: ver o comentário de `snapshotDoHost`.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'
import { buildRectDrawing, buildRoomFromDraft } from '../src/lib/drawingFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { buildFloorPiece } from '../src/lib/floorTool'
import { addDrawing, addFloorPiece, addRoom, addToken, createEmptyMap, setRoomRoof } from '../src/lib/mapFactory'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import type { MapData, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 20
const LINHAS = 12
const FICHA = 'ficha-ana'
/** O mapa a 1:1, encostado no topo à esquerda: tudo o que o teste olha fica à direita do livro. */
const CAMERA = { x: 0, y: 40, scale: 1 }

test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1280, height: 800 } })

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/** Salão (sem teto), Torre (com teto), um desenho cheio, uma peça de chão e a ficha da Ana, tudo à direita de x = 640. */
function mapaDoPainel(): MapData {
  let map = createEmptyMap('painel-camadas', 'Painel', COLUNAS, LINHAS, GRADE)
  const salao = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 640, y: 64 }, { x: 896, y: 320 }, undefined, undefined, 'Salão')
  map = addRoom(map, salao.region, salao.walls)
  const torre = buildRoomFromDraft('r2', ['w5', 'w6', 'w7', 'w8'], { x: 960, y: 64 }, { x: 1216, y: 320 }, undefined, undefined, 'Torre')
  map = addRoom(map, torre.region, torre.walls)
  map = setRoomRoof(map, 'r2', true)
  map = addDrawing(map, buildRectDrawing('d1', { x: 672, y: 448 }, { x: 864, y: 640 }, '#c0392b', 4, true, 1))
  map = addFloorPiece(map, buildFloorPiece('f1', { kind: 'rect', cx: 1088, cy: 560, w: 192, h: 128 }, 'add'))
  return addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 1088, y: 448, size: 1, image: null })
}

/** Recorte de tela do canvas, em coordenadas de MUNDO (a câmera é fixa). */
async function pixels(page: Page, x: number, y: number, w: number, h: number): ReturnType<Page['screenshot']> {
  return page.screenshot({ clip: { x: x + CAMERA.x, y: y + CAMERA.y, width: w, height: h } })
}

async function quadros(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
}

async function mapaDoMestre(page: Page): Promise<MapData> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map)
}

async function nos(page: Page): Promise<number> {
  await quadros(page)
  return Number(await page.locator('[data-nos-da-pilha]').first().getAttribute('data-nos-da-pilha'))
}

async function abrirOEditor(page: Page, map: MapData): Promise<void> {
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
  }, map)
  await quadros(page)
  await page.evaluate(async (camera) => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera } })
  }, CAMERA)
  await expect.poll(() => page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)).toEqual(CAMERA)
  await abrirPaginaDoLivro(page, 'Cena')
  const secao = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(secao).toBeVisible()
  if ((await secao.getAttribute('aria-expanded')) !== 'true') await secao.click()
  await expect(secao).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.move(1270, 790)
  await quadros(page)
}

const lista = (page: Page): Locator => page.getByRole('list', { name: 'Camadas do mapa' })
const linha = (page: Page, nome: string): Locator => lista(page).locator(`:scope > li[data-camada="${nome}"]`)
const botao = (page: Page, nome: string): Locator => page.getByRole('button', { name: nome, exact: true })

test.describe('editor: o painel das 13 camadas', () => {
  test('13 linhas na ordem da lista, texto só nome e contagem, sem rolagem horizontal', async ({ page }) => {
    await abrirOEditor(page, mapaDoPainel())
    await expect(lista(page).locator(':scope > li')).toHaveCount(13)
    const ordem = await lista(page).locator(':scope > li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-camada')))
    expect(ordem).toEqual(['telhados', 'anotacoes', 'tokens', 'iluminacao', 'decoracao', 'objetos', 'escadas', 'portas', 'paredes', 'terreno', 'desenhos', 'salas', 'chao'])
    await expect(lista(page).getByRole('listitem').filter({ hasText: 'Paredes' })).toHaveText(/^Paredes\s*8$/)
    await expect(page.getByRole('slider', { name: 'Opacidade de Paredes' })).toHaveAttribute('aria-valuetext', '100%')
    await expect(botao(page, 'Ocultar Paredes dos jogadores')).toHaveAttribute('aria-pressed', 'false')
    const transborda = await lista(page).evaluate((ul) => [ul, ...Array.from(ul.querySelectorAll('.lb-camadas__cabeca'))].some((el) => el.scrollWidth > el.clientWidth + 1))
    expect(transborda, 'alguma linha rola na horizontal').toBe(false)
  })

  test('a virada para v2 (olho dos jogadores) não muda nenhum pixel do editor, com Salas e o Chão que a segue ocultos', async ({ page }) => {
    await abrirOEditor(page, mapaDoPainel())
    await botao(page, 'Ocultar Salas').click()
    await quadros(page)
    expect((await mapaDoMestre(page)).versaoDasCamadas).toBeUndefined()
    const antes = await pixels(page, 640, 64, 600, 640)
    await botao(page, 'Ocultar Tokens dos jogadores').click()
    await quadros(page)
    expect((await pixels(page, 640, 64, 600, 640)).equals(antes), 'a virada mudou a tela do mestre').toBe(true)
    const depois = await mapaDoMestre(page)
    expect(depois.versaoDasCamadas).toBe(2)
    expect(depois.hiddenLayers).toEqual(['salas', 'chao'])
    await expect(botao(page, 'Mostrar Chão')).toHaveAttribute('aria-pressed', 'true')
    // O Ctrl+Z volta ao mapa de antes (o passo da virada é o do olho).
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await mapaDoMestre(page)).versaoDasCamadas).toBeUndefined()
  })

  test('opacidade de Salas: o pixel do Salão muda sem repintar (mesmos nós) e volta idêntico', async ({ page }) => {
    await abrirOEditor(page, mapaDoPainel())
    const nosAntes = await nos(page)
    const cheio = await pixels(page, 700, 120, 40, 40)
    await page.getByRole('slider', { name: 'Opacidade de Salas' }).fill('40')
    await quadros(page)
    await expect(page.getByRole('slider', { name: 'Opacidade de Salas' })).toHaveAttribute('aria-valuetext', '40%')
    expect((await pixels(page, 700, 120, 40, 40)).equals(cheio), 'Salas a 40% não mudou o pixel').toBe(false)
    expect(await nos(page)).toBe(nosAntes)
    expect((await mapaDoMestre(page)).opacidadeDasCamadas).toEqual({ salas: 0.4 })
    await page.getByRole('slider', { name: 'Opacidade de Salas' }).fill('100')
    await quadros(page)
    expect((await pixels(page, 700, 120, 40, 40)).equals(cheio), 'de volta a 100% o pixel não voltou').toBe(true)
  })

  test('Telhados: o olho do mestre tira o telhado da Torre; Transparente só existe com os telhados à vista', async ({ page }) => {
    await abrirOEditor(page, mapaDoPainel())
    const grupo = page.getByRole('group', { name: 'Telhados' })
    await expect(grupo.getByText('Transparente', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Telhados' })).toHaveCount(0)
    const comTelhado = await pixels(page, 1060, 160, 40, 40)
    await botao(page, 'Ocultar Telhados').click()
    await quadros(page)
    expect((await pixels(page, 1060, 160, 40, 40)).equals(comTelhado), 'o olho de Telhados não mudou o pixel').toBe(false)
    await expect(grupo).toHaveCount(0)
    // Só o mestre deixa de ver: os jogadores seguem vendo o telhado.
    await expect(botao(page, 'Ocultar Telhados dos jogadores')).toHaveAttribute('aria-pressed', 'false')
    await botao(page, 'Mostrar Telhados').click()
    await quadros(page)
    expect((await pixels(page, 1060, 160, 40, 40)).equals(comTelhado)).toBe(true)
  })

  test('Chão leva aninhadas as camadas do chão, com os controles de hoje', async ({ page }) => {
    await abrirOEditor(page, mapaDoPainel())
    const doChao = linha(page, 'chao').getByRole('list', { name: 'Camadas do chão' })
    await expect(doChao).toBeVisible()
    await expect(doChao.getByRole('listitem')).toHaveCount(1)
    await expect(linha(page, 'chao').getByRole('heading', { name: 'Camadas do chão' })).toBeVisible()
  })
})

/**
 * O pacote que o host manda: o recorte REAL (`filterMapForPlayer`) com a
 * planta inteira lembrada, com a ficha da Ana posta no mapa do mestre e
 * atribuída (`{ 'p-ana': [FICHA] }`), mandado DEPOIS do `welcome`. Assim a
 * tela sai da espera e desenha. A causa da espera no golden (mapa com camada
 * livre nas paredes, pacote junto do `welcome`) não foi reproduzida aqui.
 */
function snapshotDoHost(map: MapData, rev: number): string {
  const recorte = filterMapForPlayer(map, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map))
  const visao = [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)]
  return JSON.stringify({ type: 'snapshot', rev, map: recorte.map, vision: visao, explored: encodeExploration(createExploration(map)), ownTokens: [FICHA], concealed: [], sceneName: map.name })
}

test.describe('jogador: os dois olhos e a opacidade pelo recorte do host', () => {
  test('esconder Desenhos dos jogadores tira o desenho da tela deles e deixa na do mestre; a opacidade chega sem repintar', async ({ page, context }) => {
    test.setTimeout(150_000)
    await abrirOEditor(page, mapaDoPainel())

    let socket: WebSocketRoute | null = null
    let rev = 0
    const mandar = async () => {
      if (socket === null) throw new Error('o jogador ainda não entrou')
      rev += 1
      socket.send(snapshotDoHost(await mapaDoMestre(page), rev))
    }
    const jogador = await context.newPage()
    await jogador.routeWebSocket(
      (url) => url.pathname === '/ws',
      (ws) => {
        ws.onMessage((bruto) => {
          const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
          if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
          socket = ws
          ws.send(JSON.stringify({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' }))
          void mandar()
        })
      },
    )
    await jogador.goto('/player.html')
    await jogador.getByLabel('Código da sala').fill('PAINEL')
    await jogador.getByLabel('Seu nome').fill('Ana')
    await jogador.getByRole('button', { name: 'Entrar' }).click()
    await expect(jogador.getByText('Aguardando o mestre atribuir um personagem.')).toHaveCount(0)
    await expect(jogador.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
    await jogador.addStyleTag({ content: '*:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' })
    const telaDoJogador = jogador.locator('canvas').first()
    await quadros(jogador)
    const comDesenho = await telaDoJogador.screenshot()
    const mestreComDesenho = await pixels(page, 700, 480, 120, 120)

    // Controle: o olho dos jogadores de uma camada VAZIA (Escadas) não muda a tela deles.
    await botao(page, 'Ocultar Escadas dos jogadores').click()
    await mandar()
    await quadros(jogador)
    await expect.poll(async () => (await telaDoJogador.screenshot()).equals(comDesenho), { message: 'Escadas vazia escondida mudou a tela do jogador' }).toBe(true)

    // Desenhos escondidos dos jogadores: o desenho sai do pacote e da tela deles; o mestre segue vendo.
    await botao(page, 'Ocultar Desenhos dos jogadores').click()
    await mandar()
    const doMestre = await mapaDoMestre(page)
    const recorte = filterMapForPlayer(doMestre, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(doMestre)).map
    expect(recorte.drawings.some((d) => d.id === 'd1')).toBe(false)
    await expect.poll(async () => (await telaDoJogador.screenshot()).equals(comDesenho), { message: 'o desenho continuou na tela do jogador' }).toBe(false)
    expect((await pixels(page, 700, 480, 120, 120)).equals(mestreComDesenho), 'o desenho sumiu também da tela do mestre').toBe(true)

    // De volta: a tela do jogador volta igual.
    await botao(page, 'Mostrar Desenhos aos jogadores').click()
    await mandar()
    await expect.poll(async () => (await telaDoJogador.screenshot()).equals(comDesenho)).toBe(true)

    // Opacidade de Salas a 40%: o alfa muda na tela do jogador sem nó novo; a 100% volta igual.
    const nosDoJogador = await nos(jogador)
    await page.getByRole('slider', { name: 'Opacidade de Salas' }).fill('40')
    await mandar()
    await expect.poll(async () => (await telaDoJogador.screenshot()).equals(comDesenho), { message: 'Salas a 40% não mudou a tela do jogador' }).toBe(false)
    expect(await nos(jogador)).toBe(nosDoJogador)
    await page.getByRole('slider', { name: 'Opacidade de Salas' }).fill('100')
    await mandar()
    await expect.poll(async () => (await telaDoJogador.screenshot()).equals(comDesenho)).toBe(true)
  })
})
