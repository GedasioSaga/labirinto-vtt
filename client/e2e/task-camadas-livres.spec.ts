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
import { CAMADAS_PADRAO } from '../src/lib/camadas/padrao'
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

/** Os nós REAIS da pilha do Pixi do editor (`data-ordem-da-pilha`), de BAIXO para CIMA, cada um com as camadas que desenha. */
async function nosDaPilha(page: Page): Promise<string[][]> {
  const bruto = (await page.locator('[data-ordem-da-pilha]').first().getAttribute('data-ordem-da-pilha')) ?? ''
  return bruto === '' ? [] : bruto.split(',').map((no) => no.split('+'))
}

/** A lista que o pacote REAL do host leva ao jogador (`camadasDoJogador`), de CIMA para BAIXO; ausente = a padrão. */
function camadasDoPacote(map: MapData): string[] {
  const recorte = filterMapForPlayer(map, 'p-ana', { 'p-ana': [FICHA] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map))
  const lista = recorte.map.camadasDoJogador
  return (lista === undefined ? [...CAMADAS_PADRAO] : lista.map((c) => c.id)).reverse()
}

/**
 * O pacote REAL do jogador na ordem do painel (fonte diferente: o painel não confere a si mesmo). A pilha do
 * editor não é uma ordem total das camadas (uma camada desenha em várias faixas: o rótulo da sala fica alto),
 * então ela se confere por par, com `acimaNaPilha`, onde o gesto mexeu.
 */
async function pacoteSegueOPainel(page: Page): Promise<void> {
  const painel = await ordemDoPainel(page)
  const doJogador = camadasDoPacote(await mapaDoMestre(page))
  expect(painel.filter((id) => doJogador.includes(id))).toEqual(doJogador)
}

/** `a` começa por cima de `b` na pilha REAL do editor: o primeiro nó de `a` está acima do primeiro nó de `b`. */
async function acimaNaPilha(page: Page, a: string, b: string): Promise<boolean> {
  const nos = await nosDaPilha(page)
  const base = (id: string): number => nos.findIndex((no) => no.includes(id))
  return base(a) >= 0 && base(b) >= 0 && base(a) > base(b)
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
    await pacoteSegueOPainel(page)
    // "+ Nova camada" mora acima da lista (a camada nasce no topo, perto do botão).
    const doBotao = await page.getByRole('button', { name: '+ Nova camada' }).boundingBox()
    const daLista = await lista(page).boundingBox()
    expect((doBotao?.y ?? Infinity) + (doBotao?.height ?? 0)).toBeLessThanOrEqual(daLista?.y ?? -Infinity)
    await printDoPainel(page, 'livres-1280-criada')

    // As quatro paredes do Salão na camada (mover item é a fatia 8: aqui o dado direto, fora do Ctrl+Z).
    await page.evaluate(async (id) => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      useMapStore.setState((s) => ({ map: { ...s.map, walls: s.map.walls.map((w) => ({ ...w, camada: id as `livre_${string}` })) } })) // as: o id veio do painel
    }, livre)
    await expect(linha(page, livre)).toHaveText(/^Cripta\s*4$/)
    // Na pilha REAL do editor, as paredes da Cripta ganharam nó, e ele desenha por cima dos Telhados (a Cripta é a de cima).
    await expect.poll(() => acimaNaPilha(page, livre, 'telhados')).toBe(true)

    // (2a) TECLADO: abre a linha, Tab até "Descer Cripta", Enter. O foco fica no botão que andou.
    await botao(page, 'Cripta, opacidade').click()
    await botao(page, 'Descer Cripta').focus()
    await page.keyboard.press('Enter')
    expect((await ordemDoPainel(page)).slice(0, 2)).toEqual(['telhados', livre])
    await expect(botao(page, 'Descer Cripta')).toBeFocused()
    // A pilha do editor trocou (Telhados por cima da Cripta), e o pacote do jogador também.
    await expect.poll(() => acimaNaPilha(page, 'telhados', livre)).toBe(true)
    expect(camadasDoPacote(await mapaDoMestre(page)).slice(0, 2)).toEqual(['telhados', livre])
    await pacoteSegueOPainel(page)
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
    // Na pausa antes de soltar, Salas JÁ abriu espaço (o deslocamento chega pela transição de 180 ms).
    await expect(lista(page)).toHaveAttribute('data-arrastando', '')
    await expect.poll(() => linha(page, 'salas').evaluate((li) => li.style.transform)).toMatch(/translateY\(\d/)
    expect(await acimaNaPilha(page, 'salas', 'chao')).toBe(true)
    await page.mouse.up()
    await expect(lista(page)).not.toHaveAttribute('data-arrastando', '')
    expect((await ordemDoPainel(page)).slice(-2)).toEqual(['chao', 'salas'])
    // A pilha REAL do editor trocou: Chão desenha por cima de Salas.
    await expect.poll(() => acimaNaPilha(page, 'chao', 'salas')).toBe(true)
    await pacoteSegueOPainel(page)
    expect(await passos(page)).toBe(4)

    // Esc no meio do arrasto (com o arrasto JÁ em curso): nada muda.
    const antesDoEsc = await ordemDoPainel(page)
    await linha(page, 'salas').locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
    const alcaDeSalas = await linha(page, 'salas').locator('.lb-camadas__alca').boundingBox()
    if (alcaDeSalas === null) throw new Error('sem alça')
    await page.mouse.move(alcaDeSalas.x + alcaDeSalas.width / 2, alcaDeSalas.y + 8)
    await page.mouse.down()
    await page.mouse.move(alcaDeSalas.x + alcaDeSalas.width / 2, alcaDeSalas.y - 120, { steps: 8 })
    await expect(lista(page)).toHaveAttribute('data-arrastando', '')
    await page.keyboard.press('Escape')
    await expect(lista(page)).not.toHaveAttribute('data-arrastando', '')
    await page.mouse.up()
    expect(await ordemDoPainel(page)).toEqual(antesDoEsc)
    expect(await passos(page)).toBe(4)

    // (3) Apagar pelo TECLADO (Enter): o aviso diz quantos voltaram; as paredes voltam a Paredes; o foco vai à vizinha.
    await botao(page, 'Cripta, opacidade').click()
    await botao(page, 'Apagar a camada Cripta').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator(':focus')).toHaveClass(/lb-camadas__nome/)
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
    expect(await ordemDoPainel(page)).toEqual([...CAMADAS_PADRAO].reverse())
    await expect.poll(() => acimaNaPilha(page, 'salas', 'chao')).toBe(true)
    await pacoteSegueOPainel(page)
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
    await pacoteSegueOPainel(page)
    expect(camadasDoPacote(await mapaDoMestre(page))).toContain(livre)
  })
})

/** Pega a alça de `id` e leva o ponteiro `dy` px (12 passos), sem soltar; devolve onde o ponteiro está. */
async function pegarEArrastar(page: Page, id: string, dy: number): Promise<{ x: number; y: number }> {
  await linha(page, id).locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
  await quadros(page)
  const caixa = await linha(page, id).locator('.lb-camadas__alca').boundingBox()
  if (caixa === null) throw new Error(`sem alça em ${id}`)
  const x = caixa.x + caixa.width / 2
  const y = caixa.y + caixa.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 12 })
  await expect(lista(page)).toHaveAttribute('data-arrastando', '')
  return { x, y: y + dy }
}

/** As animações WAAPI da linha agora (duração e propriedades dos quadros-chave) e se ela está levantada, no MESMO instante. */
const animacoesDa = (page: Page, id: string) =>
  linha(page, id).evaluate((li) => ({
    levantada: li.hasAttribute('data-arrastada'),
    animacoes: li
      .getAnimations()
      .filter((a) => !(a instanceof CSSTransition))
      .map((a) => ({ duracao: Number(a.effect?.getTiming().duration), propriedades: [...new Set((a.effect instanceof KeyframeEffect ? a.effect.getKeyframes() : []).flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))] })),
  }))

test.describe('arrasto: a linha assenta ao soltar e volta animada no Esc (movimento NORMAL)', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('soltar: FLIP de 150 ms só em transform, levantada até pousar; Esc: volta em 200 ms e as vizinhas voltam antes de o arrasto sair', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    const salas = await linha(page, 'salas').boundingBox()
    const chao = await linha(page, 'chao').boundingBox()
    if (salas === null || chao === null) throw new Error('sem caixa')
    await pegarEArrastar(page, 'chao', -(chao.y - salas.y) - 6)
    await page.mouse.up()
    // Logo depois de soltar: a ordem já mudou, a linha assenta (150 ms, só transform) e continua levantada.
    expect((await ordemDoPainel(page)).slice(-2)).toEqual(['chao', 'salas'])
    expect(await animacoesDa(page, 'chao')).toEqual({ levantada: true, animacoes: [{ duracao: 150, propriedades: ['transform'] }] })
    await expect(linha(page, 'chao')).not.toHaveAttribute('data-arrastada', '', { timeout: 1000 })

    // Esc: a linha volta em 200 ms; `data-arrastando` fica enquanto as vizinhas voltam (180 ms) e depois sai.
    await pegarEArrastar(page, 'salas', -120)
    await page.keyboard.press('Escape')
    const noEsc = await animacoesDa(page, 'salas')
    expect(noEsc.animacoes).toEqual([{ duracao: 200, propriedades: ['transform'] }])
    // Ainda levantada no mesmo instante: o arrasto segura `data-arrastando` enquanto as vizinhas voltam.
    expect(noEsc.levantada).toBe(true)
    await expect(lista(page)).not.toHaveAttribute('data-arrastando', '', { timeout: 1000 })
    await page.mouse.up()
    expect((await ordemDoPainel(page)).slice(-2)).toEqual(['chao', 'salas'])
  })
})

test.describe('arrasto: Ctrl+Z no meio, resistência nas pontas e rolagem do livro', () => {
  test('Ctrl+Z no meio do arrasto muda a lista: soltar não move nada (o índice era velho)', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    // O último passo do Ctrl+Z é CRIAR uma camada: desfazê-lo no meio do arrasto muda a lista.
    await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().criarCamadaLivre())
    await expect(lista(page).locator(':scope > li')).toHaveCount(14)
    const passosAntes = await passos(page)
    const salas = await linha(page, 'salas').boundingBox()
    const chao = await linha(page, 'chao').boundingBox()
    if (salas === null || chao === null) throw new Error('sem caixa')
    await pegarEArrastar(page, 'chao', -(chao.y - salas.y) - 6)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => passos(page)).toBe(passosAntes - 1)
    await expect(lista(page).locator(':scope > li')).toHaveCount(13)
    await page.mouse.up()
    expect(await ordemDoPainel(page)).toEqual([...CAMADAS_PADRAO].reverse())
    expect(await passos(page)).toBe(passosAntes - 1)
  })

  test('além da última vaga a linha resiste (30%); perto da borda do livro, o livro rola e a linha vai longe', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    // 30 camadas livres: a lista passa da altura do livro.
    await page.evaluate(async () => {
      const { useMapStore } = await import('/src/stores/mapStore.ts')
      for (let i = 0; i < 30; i += 1) useMapStore.getState().criarCamadaLivre()
    })
    await expect(lista(page).locator(':scope > li')).toHaveCount(43)
    // Resistência: a de cima puxada 100 px para cima anda ~30 (já está na primeira vaga).
    const primeira = (await ordemDoPainel(page))[0]
    await pegarEArrastar(page, primeira, -100)
    const andou = await linha(page, primeira).evaluate((li) => Number(/translateY\((-?[\d.]+)px\)/.exec(li.style.transform)?.[1] ?? 'NaN'))
    expect(andou).toBeGreaterThan(-45)
    expect(andou).toBeLessThan(-15)
    await page.keyboard.press('Escape')
    await page.mouse.up()

    // Rolagem: Chão (a última) levada até a borda de cima do livro; o livro rola sozinho e, ao soltar, Chão sobe muito.
    const deAntes = (await ordemDoPainel(page)).indexOf('chao')
    await linha(page, 'chao').locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
    const alca = await linha(page, 'chao').locator('.lb-camadas__alca').boundingBox()
    const topoDoLivro = await lista(page).evaluate((ul) => {
      for (let pai = ul.parentElement; pai !== null; pai = pai.parentElement) {
        const { overflowY } = getComputedStyle(pai)
        if ((overflowY === 'auto' || overflowY === 'scroll') && pai.scrollHeight > pai.clientHeight) return { topo: pai.getBoundingClientRect().top, rolado: pai.scrollTop }
      }
      return null
    })
    if (alca === null || topoDoLivro === null) throw new Error('sem alça ou sem livro que rola')
    await page.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2)
    await page.mouse.down()
    await page.mouse.move(alca.x + alca.width / 2, topoDoLivro.topo + 6, { steps: 20 })
    await expect
      .poll(() =>
        lista(page).evaluate((ul) => {
          for (let pai = ul.parentElement; pai !== null; pai = pai.parentElement) if (pai.scrollHeight > pai.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(pai).overflowY)) return pai.scrollTop
          return -1
        }),
      )
      .toBeLessThan(topoDoLivro.rolado - 200)
    await page.mouse.up()
    expect((await ordemDoPainel(page)).indexOf('chao')).toBeLessThan(deAntes - 5)
  })
})

test.describe('1280: a alça pende na margem e os nomes das 13 cabem inteiros', () => {
  test('nenhum nome padrão corta, a alça fica à vista dentro do livro', async ({ page }) => {
    await abrirOEditor(page, mapaDasLivres())
    await linha(page, 'paredes').locator('.lb-camadas__cabeca').scrollIntoViewIfNeeded()
    await quadros(page)
    const cortados = await lista(page).evaluate((ul) =>
      Array.from(ul.querySelectorAll<HTMLElement>(':scope > li > .lb-camadas__cabeca .lb-camadas__rotulo'))
        .filter((r) => r.scrollWidth > r.clientWidth)
        .map((r) => `${r.textContent} ${r.clientWidth}/${r.scrollWidth}`),
    )
    expect(cortados).toEqual([])
    const visivel = await linha(page, 'paredes').locator('.lb-camadas__alca').evaluate((alca) => {
      const caixa = alca.getBoundingClientRect()
      const no = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2)
      return no !== null && (no === alca || alca.contains(no))
    })
    expect(visivel).toBe(true)
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

/** Os pixels que mudaram entre dois prints (decodificados no navegador): quantos, a caixa deles e se o meio da caixa ficou igual. */
type Print = Awaited<ReturnType<Locator['screenshot']>>

async function diferenca(pagina: Page, antes: Print, depois: Print): Promise<{ pixels: number; largura: number; altura: number; meioIgual: boolean }> {
  return pagina.evaluate(
    async ([a, b]) => {
      const ler = async (png: string): Promise<ImageData> => {
        const imagem = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
        const tela = new OffscreenCanvas(imagem.width, imagem.height)
        const contexto = tela.getContext('2d')
        if (contexto === null) throw new Error('sem 2d')
        contexto.drawImage(imagem, 0, 0)
        return contexto.getImageData(0, 0, imagem.width, imagem.height)
      }
      const [x, y] = [await ler(a), await ler(b)]
      const distancia = (i: number) => Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2])
      let [x0, y0, x1, y1, pixels] = [Infinity, Infinity, -1, -1, 0]
      for (let py = 0; py < x.height; py += 1)
        for (let px = 0; px < x.width; px += 1) {
          if (distancia((py * x.width + px) * 4) <= 30) continue
          pixels += 1
          x0 = Math.min(x0, px)
          y0 = Math.min(y0, py)
          x1 = Math.max(x1, px)
          y1 = Math.max(y1, py)
        }
      const meio = (Math.round((y0 + y1) / 2) * x.width + Math.round((x0 + x1) / 2)) * 4
      return { pixels, largura: x1 - x0, altura: y1 - y0, meioIgual: pixels > 0 && distancia(meio) <= 30 }
    },
    [antes.toString('base64'), depois.toString('base64')] as const,
  )
}

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
    await expect.poll(() => jogador.locator('[data-walls-drawn]').first().getAttribute('data-walls-drawn')).toBe('4')
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
    // O renderer do jogador desenha 0 paredes, e o que muda na TELA é o quadrado das paredes do Salão: a caixa dos
    // pixels que mudaram é quadrada (as 4 paredes, 256 × 256 no mapa) e o meio da sala (o chão, que fica) não muda.
    await expect.poll(() => jogador.locator('[data-walls-drawn]').first().getAttribute('data-walls-drawn'), { message: 'as paredes continuaram na tela do jogador' }).toBe('0')
    await quadros(jogador)
    const mudou = await diferenca(jogador, comParedes, await tela.screenshot())
    expect(mudou.pixels).toBeGreaterThan(0)
    expect(Math.abs(mudou.largura - mudou.altura), JSON.stringify(mudou)).toBeLessThanOrEqual(Math.max(mudou.largura, mudou.altura) * 0.25)
    expect(mudou.meioIgual, JSON.stringify(mudou)).toBe(true)
    // O mestre continua vendo a camada (o olho dele é outro).
    await expect(botao(page, 'Ocultar Segredo do Lich')).toHaveAttribute('aria-pressed', 'false')
  })
})
