// CAMADAS LIVRES (fase 3, fatia 7: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE PROVA, com a mão do mestre no painel de verdade (página Cena do livro):
// (1) "+ Nova camada" cria com id aleatório e abre o nome para escrever;
// (2) ordenar pelo TECLADO (Subir/Descer) e pelo PONTEIRO (alça, `page.mouse`,
//     com a pausa antes de soltar já mostrando o lugar novo);
// (3) apagar com itens: o aviso diz "N itens voltaram"; Ctrl+Z desfaz tudo e
//     Ctrl+Shift+Z refaz, um passo por gesto;
// (4) recarregar a página e reabrir pelo `adventure.json` e `map.json` de
//     verdade (serialize/parse): a lista, os nomes e os itens voltam;
// (5) o recorte REAL do host (`filterMapForPlayer`) pela rota do WebSocket com
//     a camada livre escondida dos jogadores: nada dela chega (nem item, nem id,
//     nem nome), e a tela do jogador muda;
// (6) nome de 40 caracteres (emoji, cirílico, japonês, árabe) sem estourar a
//     linha a 390 (dedo), 1280 e 1920.
import { test, expect, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'
import { buildRoomFromDraft } from '../src/lib/drawingFactory'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { addRoom, addToken, createEmptyMap } from '../src/lib/mapFactory'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import type { MapData, RegionPoint } from '../src/types/map'

const GRADE = 64
const COLUNAS = 20
const LINHAS = 12
const FICHA = 'ficha-ana'
const CAMERA = { x: 0, y: 40, scale: 1 }
/** 40 caracteres visíveis: emoji (família), cirílico, japonês e árabe. */
const NOME_MUNDO = '👨‍👩‍👧 Склеп 地下牢 سرداب ' + 'Ω'.repeat(22)

test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1280, height: 800 } })

function anel(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
}

/** Salão (4 paredes) e a ficha da Ana, à direita do livro. */
function mapaDasLivres(): MapData {
  let map = createEmptyMap('camadas-livres', 'Livres', COLUNAS, LINHAS, GRADE)
  const salao = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 640, y: 64 }, { x: 896, y: 320 }, undefined, undefined, 'Salão')
  map = addRoom(map, salao.region, salao.walls)
  return addToken(map, { id: FICHA, characterId: null, name: 'Ana', x: 1088, y: 448, size: 1, image: null })
}

async function quadros(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
}

async function mapaDoMestre(page: Page): Promise<MapData> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map)
}

async function passos(page: Page): Promise<number> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)
}

/** A lista que o EDITOR desenha (o modelo do mapa aberto), de CIMA para BAIXO como o painel. */
async function ordemDoEditor(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const { contextoDeCamadas } = await import('/src/lib/camadas/consulta.ts')
    const { useMapStore } = await import('/src/stores/mapStore.ts')
    return [...contextoDeCamadas(useMapStore.getState().map).ordem].reverse()
  })
}

async function abrirPainel(page: Page): Promise<void> {
  await abrirPaginaDoLivro(page, 'Cena')
  const secao = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(secao).toBeVisible()
  if ((await secao.getAttribute('aria-expanded')) !== 'true') await secao.click()
  await expect(secao).toHaveAttribute('aria-expanded', 'true')
}

/** Abre o mapa como AVENTURA (a lista de camadas mora no `adventure.json`) e o painel de Camadas. */
async function abrirOEditor(page: Page, map: MapData): Promise<void> {
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.getState().virarAventura(null)
  }, map)
  await quadros(page)
  await page.evaluate(async (camera) => {
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera } })
  }, CAMERA)
  await abrirPainel(page)
  await page.mouse.move(1270, 790)
}

const lista = (page: Page): Locator => page.getByRole('list', { name: 'Camadas do mapa' })
const linha = (page: Page, id: string): Locator => lista(page).locator(`:scope > li[data-camada="${id}"]`)
const botao = (page: Page, nome: string): Locator => page.getByRole('button', { name: nome, exact: true })
const ordemDoPainel = (page: Page): Promise<string[]> => lista(page).locator(':scope > li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-camada') ?? ''))

/** Diretório dos prints (`LAB_PRINTS_DO_PAINEL`); sem ele, nenhum print é gravado. */
const PRINTS = process.env.LAB_PRINTS_DO_PAINEL ?? ''

async function printDoPainel(page: Page, nome: string): Promise<void> {
  if (PRINTS === '') return
  await lista(page).evaluate((ul) => ul.scrollIntoView({ block: 'start' }))
  await quadros(page)
  await lista(page).locator('xpath=ancestor::*[contains(@class, "gr-ficha")][1]').screenshot({ path: `${PRINTS}/${nome}.png` })
}

/** Cria pelo botão e escreve o nome; devolve o id que nasceu (a primeira linha do painel). */
async function criarComNome(page: Page, nome: string): Promise<string> {
  await page.getByRole('button', { name: '+ Nova camada' }).click()
  const campo = page.getByRole('textbox', { name: /^Nome da camada / })
  await expect(campo).toBeFocused()
  await expect(campo).toHaveValue('Nova camada')
  await page.keyboard.insertText(nome)
  await page.keyboard.press('Enter')
  await expect(campo).toHaveCount(0)
  return (await ordemDoPainel(page))[0]
}

const naoTransborda = (page: Page): Promise<boolean> =>
  lista(page).evaluate((ul) => ![ul, ...Array.from(ul.querySelectorAll('.lb-camadas__cabeca'))].some((el) => el.scrollWidth > el.clientWidth + 1))

test.describe('editor: camadas livres', () => {
  test('criar, renomear, ordenar (teclado e arrasto), apagar com "N itens voltaram"; Ctrl+Z desfaz tudo e Ctrl+Shift+Z refaz', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    const inicial = await mapaDoMestre(page)

    // (1) Criar e renomear: dois gestos, dois passos.
    const livre = await criarComNome(page, 'Cripta')
    expect(livre).toMatch(/^livre_[0-9a-f]{8}$/)
    expect(await passos(page)).toBe(2)
    await expect(linha(page, livre)).toHaveText(/^Cripta\s*0$/)
    expect(await ordemDoEditor(page)).toEqual(await ordemDoPainel(page))
    await printDoPainel(page, 'livres-1280-criada')

    // As quatro paredes do Salão na camada (mover item é a fatia 8: aqui o dado direto, fora do Ctrl+Z).
    await page.evaluate(async (id) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.setState((s) => ({ map: { ...s.map, walls: s.map.walls.map((w) => ({ ...w, camada: id as `livre_${string}` })) } })) // as: o id veio do painel
    }, livre)
    await expect(linha(page, livre)).toHaveText(/^Cripta\s*4$/)

    // (2a) TECLADO: abre a linha, Tab até "Descer Cripta", Enter. O foco fica no botão que andou.
    await botao(page, 'Cripta, opacidade').click()
    await botao(page, 'Descer Cripta').focus()
    await page.keyboard.press('Enter')
    expect((await ordemDoPainel(page)).slice(0, 2)).toEqual(['telhados', livre])
    await expect(botao(page, 'Descer Cripta')).toBeFocused()
    expect(await ordemDoEditor(page)).toEqual(await ordemDoPainel(page))
    expect(await passos(page)).toBe(3)
    await page.keyboard.press('Escape')

    // (2b) PONTEIRO: a alça do Chão sobe até logo acima de Salas; na pausa antes de soltar, Salas já abriu espaço.
    const alca = linha(page, 'chao').locator('.lb-camadas__alca')
    // A lista mora no livro, que rola: Chão (a última) precisa estar à vista para o ponteiro achar a alça.
    await linha(page, 'chao').locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
    await quadros(page)
    const deAlca = await alca.boundingBox()
    const deSalas = await linha(page, 'salas').locator('.lb-camadas__cabeca').boundingBox()
    const doChao = await linha(page, 'chao').boundingBox()
    if (deAlca === null || deSalas === null || doChao === null) throw new Error('sem caixa')
    const x = deAlca.x + deAlca.width / 2
    const y = deAlca.y + deAlca.height / 2
    const sobe = doChao.y + doChao.height / 2 - (deSalas.y + deSalas.height / 2) + 4
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y - sobe, { steps: 12 })
    await page.waitForTimeout(400)
    await expect(lista(page)).toHaveAttribute('data-arrastando', '')
    expect(await linha(page, 'salas').evaluate((li) => li.style.transform)).toMatch(/translateY\(\d/)
    await page.mouse.up()
    await expect(lista(page)).not.toHaveAttribute('data-arrastando', '')
    expect((await ordemDoPainel(page)).slice(-2)).toEqual(['chao', 'salas'])
    expect(await ordemDoEditor(page)).toEqual(await ordemDoPainel(page))
    expect(await passos(page)).toBe(4)

    // Esc no meio do arrasto: nada muda.
    const antesDoEsc = await ordemDoPainel(page)
    await linha(page, 'salas').locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
    const alcaDeSalas = await linha(page, 'salas').locator('.lb-camadas__alca').boundingBox()
    if (alcaDeSalas === null) throw new Error('sem alça')
    await page.mouse.move(alcaDeSalas.x + 5, alcaDeSalas.y + 8)
    await page.mouse.down()
    await page.mouse.move(alcaDeSalas.x + 5, alcaDeSalas.y - 120, { steps: 8 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    expect(await ordemDoPainel(page)).toEqual(antesDoEsc)
    expect(await passos(page)).toBe(4)

    // (3) Apagar: o aviso diz quantos voltaram; as paredes voltam a Paredes.
    await botao(page, 'Cripta, opacidade').click()
    await botao(page, 'Apagar a camada Cripta').click()
    const aviso = page.getByText('Camada "Cripta" apagada: 4 itens voltaram às camadas padrão.')
    await expect(aviso).toBeVisible()
    if (PRINTS !== '') await aviso.locator('xpath=ancestor::*[@role="status" or @role="alert" or contains(@class, "toast")][1]').screenshot({ path: `${PRINTS}/livres-1280-aviso.png` })
    expect(await ordemDoPainel(page)).not.toContain(livre)
    await expect(linha(page, 'paredes')).toHaveText(/^Paredes\s*4$/)
    expect(await passos(page)).toBe(5)

    // Ctrl+Z desfaz TUDO (5 passos): o mapa volta ao que abriu.
    await page.locator('body').click({ position: { x: 1200, y: 760 } })
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Control+z')
    const desfeito = await mapaDoMestre(page)
    expect(desfeito.modeloCamadas).toBeUndefined()
    expect(desfeito.walls).toEqual(inicial.walls)
    expect(await ordemDoPainel(page)).toEqual(await ordemDoEditor(page))
    expect((await ordemDoPainel(page))[0]).toBe('telhados')
    expect(await page.evaluate(async () => (await import('/src/stores/adventureStore.ts')).useAdventureStore.getState().adventure?.camadas)).toBeUndefined()
    // Ctrl+Shift+Z refaz os 5.
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Control+Shift+z')
    expect(await ordemDoPainel(page)).not.toContain(livre)
    expect((await ordemDoPainel(page)).slice(-2)).toEqual(['chao', 'salas'])
    await expect(linha(page, 'paredes')).toHaveText(/^Paredes\s*4$/)
  })

  test('recarregar: reaberta pelo adventure.json e map.json de verdade, a lista, o nome e os itens voltam', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    const livre = await criarComNome(page, 'Cripta')
    await page.evaluate(async (id) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.setState((s) => ({ map: { ...s.map, walls: s.map.walls.map((w, i) => (i < 2 ? { ...w, camada: id as `livre_${string}` } : w)) } })) // as: o id veio do painel
    }, livre)
    await botao(page, 'Cripta, opacidade').click()
    await botao(page, 'Descer Cripta').click()
    const antes = await ordemDoPainel(page)
    const arquivos = await page.evaluate(async () => {
      const { serializeMap } = await import('/src/lib/mapFile.ts')
      const { serializeAdventure } = await import('/src/lib/adventure.ts')
      const { useAdventureStore } = await import('/src/stores/adventureStore.ts')
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      const aventura = useAdventureStore.getState().adventure
      if (aventura === null) throw new Error('sem aventura')
      return { mapa: serializeMap(useMapStore.getState().map), aventura: serializeAdventure(aventura) }
    })
    expect(arquivos.mapa).not.toContain('Cripta')
    expect(arquivos.aventura).toContain('Cripta')

    await page.reload()
    await enterEditor(page)
    await page.evaluate(async ({ mapa, aventura }) => {
      const { deserializeMap } = await import('/src/lib/mapFile.ts')
      const { parseAdventure } = await import('/src/lib/adventure.ts')
      const { useAdventureStore } = await import('/src/stores/adventureStore.ts')
      const map = deserializeMap(mapa)
      const adventure = parseAdventure(aventura)
      const scenes = adventure.scenes.map((entry) => ({ entry, status: 'ok' as const, map }))
      await useAdventureStore.getState().open({ path: 'C:/mapas/livres/map.json', map, adventure, adventureDir: 'C:/mapas/livres', activeSceneId: adventure.startSceneId, scenes, changedSceneIds: [], adventureChanged: false, legacySources: [] })
    }, arquivos)
    await abrirPainel(page)
    expect(await ordemDoPainel(page)).toEqual(antes)
    await expect(linha(page, livre)).toHaveText(/^Cripta\s*2$/)
    expect(await ordemDoEditor(page)).toEqual(antes)
  })
})

test.describe('nome de 40 caracteres em várias escritas', () => {
  test('1280 e 1920: sem estourar a linha, botões no lugar', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    const livre = await criarComNome(page, NOME_MUNDO)
    const nome = (await mapaDoMestre(page)).modeloCamadas?.ordem.find((c) => c.id === livre)?.nome ?? ''
    expect([...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(nome)]).toHaveLength(40)
    for (const largura of [1280, 1920]) {
      await page.setViewportSize({ width: largura, height: 900 })
      await quadros(page)
      expect(await naoTransborda(page), `transbordou a ${largura}`).toBe(true)
      const daTrava = await botao(page, `Travar ${nome}`).boundingBox()
      const daLista = await lista(page).boundingBox()
      if (daTrava === null || daLista === null) throw new Error('sem caixa')
      expect(daTrava.x + daTrava.width).toBeLessThanOrEqual(daLista.x + daLista.width + 1)
    }
  })
})

test.describe('toque (390 px, dedo)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('nome de 40 caracteres e a alça: sem estourar, alvos de 44 px', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    const livre = await criarComNome(page, NOME_MUNDO)
    expect(await naoTransborda(page)).toBe(true)
    const alca = await linha(page, livre).locator('.lb-camadas__alca').boundingBox()
    expect(alca?.height).toBeGreaterThanOrEqual(44)
    await linha(page, livre).locator('.lb-camadas__nome').tap()
    const descer = await linha(page, livre).getByRole('button', { name: /^Descer / }).boundingBox()
    expect(descer?.height).toBeGreaterThanOrEqual(44)
    expect(await naoTransborda(page)).toBe(true)
    await printDoPainel(page, 'livres-390-toque')
  })
})

/** O recorte REAL do host com a ficha da Ana atribuída, mandado depois do `welcome` (como no spec do painel). */
function snapshotDoHost(map: MapData, rev: number): string {
  const recorte = filterMapForPlayer(map, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map))
  const visao = [anel(0, 0, COLUNAS * GRADE, LINHAS * GRADE)]
  return JSON.stringify({ type: 'snapshot', rev, map: recorte.map, vision: visao, explored: encodeExploration(createExploration(map)), ownTokens: [FICHA], concealed: [], sceneName: map.name })
}

test.describe('jogador: camada livre escondida dos jogadores pelo recorte do host', () => {
  test('nada dela chega pela rota do WebSocket (nem parede, nem id, nem nome) e a tela do jogador muda', async ({ page, context }) => {
    test.setTimeout(150_000)
    await abrirOEditor(page, mapaDasLivres())
    const livre = await criarComNome(page, 'Segredo do Lich')
    await page.evaluate(async (id) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.setState((s) => ({ map: { ...s.map, walls: s.map.walls.map((w) => ({ ...w, camada: id as `livre_${string}` })) } })) // as: o id veio do painel
    }, livre)

    let socket: WebSocketRoute | null = null
    let rev = 0
    const enviados: string[] = []
    const mandar = async () => {
      if (socket === null) throw new Error('o jogador ainda não entrou')
      rev += 1
      const pacote = snapshotDoHost(await mapaDoMestre(page), rev)
      enviados.push(pacote)
      socket.send(pacote)
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
    await jogador.getByLabel('Código da sala').fill('LIVRES')
    await jogador.getByLabel('Seu nome').fill('Ana')
    await jogador.getByRole('button', { name: 'Entrar' }).click()
    await expect(jogador.getByText('Aguardando o mestre atribuir um personagem.')).toHaveCount(0)
    await expect(jogador.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
    await jogador.addStyleTag({ content: '*:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' })
    const tela = jogador.locator('canvas').first()
    await quadros(jogador)
    const comParedes = await tela.screenshot()
    // À vista: as paredes e o id chegam; o nome, nunca.
    expect(enviados[0]).toContain('"w1"')
    expect(enviados[0]).toContain(livre)
    expect(enviados[0]).not.toContain('Segredo')

    await botao(page, 'Ocultar Segredo do Lich dos jogadores').click()
    await mandar()
    const ultimo = enviados[enviados.length - 1]
    for (const parede of ['"w1"', '"w2"', '"w3"', '"w4"']) expect(ultimo).not.toContain(parede)
    expect(ultimo).not.toContain(livre)
    expect(ultimo).not.toContain('Segredo')
    await expect.poll(async () => (await tela.screenshot()).equals(comParedes), { message: 'as paredes continuaram na tela do jogador' }).toBe(false)
    // O mestre continua vendo a camada (o olho dele é outro).
    await expect(botao(page, 'Ocultar Segredo do Lich')).toHaveAttribute('aria-pressed', 'false')
  })
})
