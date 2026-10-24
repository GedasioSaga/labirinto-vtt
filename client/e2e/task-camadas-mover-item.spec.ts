// MOVER ITEM DE CAMADA (fase 3, fatia 8: `docs/planos/camadas-fase3-2026-10-22.md`).
//
// O QUE PROVA, com a mão do mestre na tela de verdade:
// (1) pelo seletor "Camada" da ficha: um passo do Ctrl+Z, Ctrl+Shift+Z refaz;
//     camada travada aparece desligada; a sala diz por que não muda;
// (2) pelo clique direito em cima da seleção ("Mover para camada ›"): vários
//     itens num passo só, a atual marcada, teclado (seta direita, Esc);
// (3) arrastando a linha da lista "Objetos do mapa" até a camada do painel: o
//     alvo acende na pausa antes de soltar; a travada acende como recusa e,
//     solta, avisa sem mudar nada;
// (4) a camada escolhida atravessa o arquivo (serializa, recarrega a página e
//     lê de novo);
// (5) o recorte REAL do host (`filterMapForPlayer`): mover para a camada
//     escondida só dos jogadores tira o item do pacote.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro } from './helpers/livroDoMestre'
import { buildRoomFromDraft } from '../src/lib/drawingFactory'
import { addRoom, addToken, createEmptyMap } from '../src/lib/mapFactory'
import { deserializeMap, serializeMap } from '../src/lib/mapFile'
import { filterMapForPlayer, planOfWholeMap } from '../src/lib/fogFilter'
import type { MapData } from '../src/types/map'

const GRADE = 64
const COLUNAS = 20
const LINHAS = 12
/** Centro das fichas em px de mundo; com a câmera em 0,0 e escala 1, o mesmo px na caixa do canvas, à direita do livro. */
const ANA = { x: 1000, y: 480 }
const BRUNO = { x: 1128, y: 480 }

test.use({ trace: 'off', video: 'off', contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1280, height: 800 } })

/** Mapa v2 com Iluminação escondida só dos jogadores e Decoração travada; o salão (com teto) fica longe das fichas. */
function mapaDoMover(): MapData {
  let map = createEmptyMap('camadas-mover', 'Mover', COLUNAS, LINHAS, GRADE)
  const salao = buildRoomFromDraft('r1', ['w1', 'w2', 'w3', 'w4'], { x: 640, y: 64 }, { x: 896, y: 256 }, undefined, undefined, 'Salão')
  map = addRoom(map, salao.region, salao.walls)
  map = addToken(map, { id: 'ana', characterId: null, name: 'Ana', ...ANA, size: 1, image: null })
  map = addToken(map, { id: 'bruno', characterId: null, name: 'Bruno', ...BRUNO, size: 1, image: null })
  return { ...map, versaoDasCamadas: 2, hiddenLayers: [], ocultasDoJogador: ['iluminacao'], lockedLayers: ['decoracao'] }
}

async function quadros(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto))))
}

async function abrirOEditor(page: Page, map: MapData): Promise<void> {
  await enterEditor(page)
  await page.evaluate(async (mapa) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapa)
    mod.useMapStore.getState().setActiveTool('select')
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 0, y: 0, scale: 1 } } })
  }, map)
  await quadros(page)
}

async function selecionar(page: Page, itens: { kind: string; id: string }[]): Promise<void> {
  await page.evaluate(async (sel) => {
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().setSelection(sel as never)
  }, itens)
}

async function mapaDoMestre(page: Page): Promise<MapData> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map)
}

async function passos(page: Page): Promise<number> {
  return page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length)
}

async function camadaDa(page: Page, id: string): Promise<string | null> {
  return page.evaluate(async (tokenId) => (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.tokens.find((t) => t.id === tokenId)?.camada ?? null, id)
}

/** Ctrl+Z e Ctrl+Shift+Z do mapa: o foco sai do campo (no `<select>` o atalho é do navegador, de propósito). */
async function atalho(page: Page, combo: string): Promise<void> {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.keyboard.press(combo)
}

/** O ponto da tela de um ponto do mundo (câmera em 0,0, escala 1). */
async function naTela(page: Page, ponto: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const caixa = await page.locator('[data-ordem-dos-nos]').first().boundingBox()
  if (caixa === null) throw new Error('o canvas do editor não tem caixa')
  return { x: caixa.x + ponto.x, y: caixa.y + ponto.y }
}

function pacote(map: MapData): MapData {
  return filterMapForPlayer(map, 'p-ana', { 'p-ana': ['ana'] }, COLUNAS * GRADE, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, planOfWholeMap(map)).map
}

const seletor = (page: Page): Locator => page.getByLabel('Camada', { exact: true })
const linhaDaCamada = (page: Page, id: string): Locator => page.getByRole('list', { name: 'Camadas do mapa' }).locator(`:scope > li[data-camada="${id}"]`)

test('pela ficha: o seletor "Camada" move num passo; Ctrl+Z volta, Ctrl+Shift+Z refaz; travada desligada; sala diz por quê', async ({ page }) => {
  await abrirOEditor(page, mapaDoMover())
  await selecionar(page, [{ kind: 'token', id: 'ana' }])
  await abrirPaginaDoLivro(page, 'Ficha')
  await expect(seletor(page)).toHaveValue('tokens')
  await expect(seletor(page).locator('option[value="decoracao"]')).toBeDisabled()
  await expect(seletor(page).locator('option[value="iluminacao"]')).toHaveText('Iluminação (jogadores não veem)')
  // Print de layout (não é o teste): a ficha com o seletor logo abaixo da cabeça.
  await page.screenshot({ path: test.info().outputPath('ficha-com-seletor.png') })

  const antes = await passos(page)
  await seletor(page).selectOption('objetos')
  await expect.poll(() => camadaDa(page, 'ana')).toBe('objetos')
  expect(await passos(page)).toBe(antes + 1)
  await expect(page.getByText('Item movido para Objetos.')).toBeVisible()

  await atalho(page, 'Control+z')
  await expect.poll(() => camadaDa(page, 'ana')).toBeNull()
  await expect(seletor(page)).toHaveValue('tokens')
  await atalho(page, 'Control+Shift+z')
  await expect.poll(() => camadaDa(page, 'ana')).toBe('objetos')

  // A sala ainda desenha na camada padrão: o seletor se desliga e diz por quê; o teto dela muda sozinho.
  await selecionar(page, [{ kind: 'region', id: 'r1' }])
  await expect(seletor(page)).toBeDisabled()
  await expect(page.getByText('Desenha na camada padrão por enquanto.')).toBeVisible()
})

test('pelo menu: clique direito na seleção, "Mover para camada ›", dois itens num passo só; teclado abre e fecha', async ({ page }) => {
  await abrirOEditor(page, mapaDoMover())
  await selecionar(page, [{ kind: 'token', id: 'ana' }, { kind: 'token', id: 'bruno' }])
  const ponto = await naTela(page, ANA)
  await page.mouse.click(ponto.x, ponto.y, { button: 'right' })
  const menu = page.getByRole('menu', { name: '2 itens selecionados' })
  await expect(menu).toBeVisible()
  const pai = menu.getByRole('menuitem', { name: 'Mover para camada' })
  await expect(pai).toBeFocused()

  // Teclado: seta direita abre com o foco na atual (marcada); seta esquerda fecha só o submenu.
  await page.keyboard.press('ArrowRight')
  const sub = page.getByRole('menu', { name: 'Mover para camada' })
  await expect(sub.getByRole('menuitemradio', { name: 'Tokens' })).toBeFocused()
  await expect(sub.getByRole('menuitemradio', { name: 'Tokens' })).toHaveAttribute('aria-checked', 'true')
  await expect(sub.getByRole('menuitemradio', { name: /Decoração/ })).toBeDisabled()
  await page.screenshot({ path: test.info().outputPath('menu-com-submenu.png') })
  await page.keyboard.press('ArrowLeft')
  await expect(sub).toHaveCount(0)
  await expect(pai).toBeFocused()

  // Ponteiro: pairar abre, clicar move os dois.
  const antes = await passos(page)
  await pai.hover()
  await sub.getByRole('menuitemradio', { name: 'Iluminação' }).click()
  await expect(menu).toHaveCount(0)
  await expect.poll(async () => [await camadaDa(page, 'ana'), await camadaDa(page, 'bruno')]).toEqual(['iluminacao', 'iluminacao'])
  expect(await passos(page)).toBe(antes + 1)
  await expect(page.getByText('2 itens movidos para Iluminação.')).toBeVisible()

  // Escondida só dos jogadores: o pacote REAL do host perde as duas fichas (a do jogador e a outra).
  const depois = await mapaDoMestre(page)
  expect(pacote(depois).tokens.map((t) => t.id)).not.toContain('bruno')
  await atalho(page, 'Control+z')
  await expect.poll(async () => [await camadaDa(page, 'ana'), await camadaDa(page, 'bruno')]).toEqual([null, null])
  expect(pacote(await mapaDoMestre(page)).tokens.map((t) => t.id)).toContain('bruno')

  // Esc fecha o menu inteiro.
  await page.mouse.click(ponto.x, ponto.y, { button: 'right' })
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('arrastando a linha da lista para a camada: o alvo acende na pausa; travada recusa com aviso; recarregar mantém', async ({ page }) => {
  await abrirOEditor(page, mapaDoMover())
  await page.setViewportSize({ width: 1280, height: 1500 })
  await abrirPaginaDoLivro(page, 'Cena')
  for (const nome of ['Objetos do mapa', 'Camadas']) {
    const secao = page.getByRole('button', { name: nome, exact: true })
    if ((await secao.getAttribute('aria-expanded')) !== 'true') await secao.click()
  }
  const linhaDaAna = page.locator('[data-objeto]').filter({ hasText: 'Ana' })
  await expect(linhaDaAna).toBeVisible()

  // Arrasto pelo mouse, quadro a quadro, sem rolar o livro no meio: rolar entre o apertar e o primeiro
  // movimento tira a linha de baixo do ponteiro antes de o arrasto nativo começar (a janela é alta para caber tudo).
  const arrastarAte = async (alvo: Locator): Promise<void> => {
    const de = await linhaDaAna.boundingBox()
    const para = await alvo.boundingBox()
    if (de === null || para === null) throw new Error('origem ou alvo do arrasto sem caixa')
    await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2)
    await page.mouse.down()
    await page.mouse.move(de.x + de.width / 2 + 6, de.y + de.height / 2 + 6, { steps: 3 })
    await page.mouse.move(para.x + para.width / 2, para.y + para.height / 2, { steps: 10 })
    await page.mouse.move(para.x + para.width / 2 + 2, para.y + para.height / 2, { steps: 2 })
  }

  // Para a travada: acende como recusa; solto, avisa e nada muda.
  const antes = await passos(page)
  await arrastarAte(linhaDaCamada(page, 'decoracao'))
  await expect(linhaDaCamada(page, 'decoracao')).toHaveAttribute('data-alvo-do-item', 'recusa')
  await page.mouse.up()
  await expect(page.getByText('A camada Decoração está travada')).toBeVisible()
  expect(await camadaDa(page, 'ana')).toBeNull()
  expect(await passos(page)).toBe(antes)

  // Para Objetos, com a pausa antes de soltar: a linha de Objetos acende.
  const alvo = linhaDaCamada(page, 'objetos')
  await arrastarAte(alvo)
  await expect(alvo).toHaveAttribute('data-alvo-do-item', 'recebe')
  await page.screenshot({ path: test.info().outputPath('arrasto-na-pausa.png') })
  await page.mouse.up()
  await expect.poll(() => camadaDa(page, 'ana')).toBe('objetos')
  await expect(alvo).not.toHaveAttribute('data-alvo-do-item', /.*/)
  expect(await passos(page)).toBe(antes + 1)

  // A camada atravessa o arquivo: serializa, recarrega a página e lê de novo.
  const arquivo = serializeMap(await mapaDoMestre(page))
  await page.reload()
  await abrirOEditor(page, deserializeMap(arquivo))
  expect(await camadaDa(page, 'ana')).toBe('objetos')
  await selecionar(page, [{ kind: 'token', id: 'ana' }])
  await abrirPaginaDoLivro(page, 'Ficha')
  await expect(seletor(page)).toHaveValue('objetos')
})
