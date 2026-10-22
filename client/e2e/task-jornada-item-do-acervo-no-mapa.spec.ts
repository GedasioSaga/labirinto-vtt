// ITEM DO ACERVO NO MAPA, pelo "+" e pelo arrasto (fatia 18b, revisão de
// 22/10/2026). O "+" do cartão do item (`handlePorItemNoCentro`) e o soltar do
// arrasto (`handleSoltarItemNoMapa`) passam pela mesma `colocarItemNoMapa`
// desde o commit 5b90ba97, e só o painel tinha teste: ninguém provava que o
// clique chega ao mapa, nem que o arrasto continuou igual depois da troca.
//
// O que esta jornada prova no app de verdade, com a câmera mexida pela roda
// (o centro da vista não é o centro da tela):
//  1. "+" num item com imagem: a imagem no chão, no `viewportCenterWorld` da
//     câmera, do lado de uma casa, já selecionada; o Acervo continua aberto;
//  2. "+" num item sem imagem: o pino de item no mesmo centro, já selecionado;
//  3. cada um sai num Ctrl+Z só, o último primeiro;
//  4. arrastar o cartão até o mapa: a imagem no ponto solto; com Alt, o pino;
//     soltar no livro não põe nada, e o clique do gesto não abre a janela do item.
//
// O acervo de itens é do disco do app, que o navegador não tem: a store é
// enchida depois de o painel montar (fora do Tauri ele recarrega vazio).
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { abrirPaginaDoLivro, livroDoMestre } from './helpers/livroDoMestre'

interface Ponto {
  x: number
  y: number
}

interface ObjetoNoMapa extends Ponto {
  id: string
  nome: string | null
  imagem: string | null
  livre: boolean
}

interface EstadoDoMapa {
  props: (ObjetoNoMapa & { width: number; height: number })[]
  pins: (ObjetoNoMapa & { kind: string; icon: string | null })[]
  selecao: { kind: string; id: string }[]
  pinoSelecionado: string | null
}

const LADO_DA_CASA = 64
/** Referência de mídia válida (`midia:<64 hex>.png`): o item "tem imagem" para o mapa. */
const IMAGEM_DA_ESPADA = `midia:${'a'.repeat(64)}.png`
/** Folga de arredondamento: o ponto vem de px de tela em float e volta pela mesma conta. */
const CASAS_DECIMAIS = 3

async function mapaVazio(page: Page): Promise<void> {
  await page.evaluate(async (lado) => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_item_no_mapa', 'E2E Item no mapa', 30, 20, lado))
    mod.useMapStore.getState().setActiveTool('select')
  }, LADO_DA_CASA)
}

/** Abre a estante de itens do Acervo e põe nela uma espada (com imagem) e uma poção (sem). */
async function abrirAcervoDeItens(page: Page): Promise<void> {
  await abrirPaginaDoLivro(page, 'Acervo')
  await livroDoMestre(page).getByRole('radio', { name: 'Itens' }).click()
  await expect(page.getByRole('region', { name: 'Itens' })).toBeVisible()
  await page.evaluate(async (imagem) => {
    const mod = await import('/src/stores/acervoDeItensStore.ts')
    mod.useAcervoDeItensStore.setState({
      itens: [
        { id: 'item_e2e_espada', nome: 'Espada', imagem, descricao: 'Afiada.', categoria: 'Arma', preco: null, empilhavel: false },
        { id: 'item_e2e_pocao', nome: 'Poção', imagem: null, descricao: '', categoria: 'Consumível', preco: null, empilhavel: true },
      ],
    })
  }, IMAGEM_DA_ESPADA)
  await expect(page.getByRole('button', { name: 'Abrir Espada' })).toBeVisible()
}

async function estadoDoMapa(page: Page): Promise<EstadoDoMapa> {
  return page.evaluate(async () => {
    const mod = await import('/src/stores/mapStore.ts')
    const s = mod.useMapStore.getState()
    return {
      props: s.map.props.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        nome: p.item?.nome ?? null,
        imagem: p.item?.imagem ?? null,
        livre: p.item?.livre === true,
      })),
      pins: s.map.pins.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        kind: p.kind,
        icon: p.icon ?? null,
        nome: p.item?.nome ?? null,
        imagem: p.item?.imagem ?? null,
        livre: p.item?.livre === true,
      })),
      selecao: s.selection.map((item) => ({ kind: item.kind, id: item.id })),
      pinoSelecionado: s.selectedPinId,
    }
  })
}

/** O centro da vista em mundo, pela mesma função e pelo mesmo canvas que o app usa. */
async function centroDaVista(page: Page): Promise<Ponto> {
  return page.evaluate(async () => {
    const world = await import('/src/pixi/world.ts')
    const mod = await import('/src/stores/mapStore.ts')
    const host = document.querySelector('.lb-editor__canvas')
    if (!(host instanceof HTMLElement)) throw new Error('sem o canvas do editor')
    return world.viewportCenterWorld(mod.useMapStore.getState().camera, host.clientWidth, host.clientHeight)
  })
}

/** Ponto de tela (px de janela) em mundo, pela câmera da store, que é a do Pixi. */
async function noMundo(page: Page, ponto: Ponto): Promise<Ponto> {
  return page.evaluate(async ({ x, y }) => {
    const mod = await import('/src/stores/mapStore.ts')
    const host = document.querySelector('.lb-editor__canvas')
    if (!(host instanceof HTMLElement)) throw new Error('sem o canvas do editor')
    const caixa = host.getBoundingClientRect()
    const { camera } = mod.useMapStore.getState()
    return { x: (x - caixa.left - camera.x) / camera.scale, y: (y - caixa.top - camera.y) / camera.scale }
  }, ponto)
}

/**
 * Um ponto da tela onde o que está por cima é o canvas do mapa (nem o livro,
 * nem a coluna, nem o HUD), o mais perto do centro dele a pelo menos
 * `distancia` px: o soltar precisa cair longe do centro da vista para não se
 * confundir com o "+".
 */
async function pontoNoMapa(page: Page, distancia: number): Promise<Ponto> {
  return page.evaluate((minimo) => {
    const host = document.querySelector('.lb-editor__canvas')
    if (!(host instanceof HTMLElement)) throw new Error('sem o canvas do editor')
    const caixa = host.getBoundingClientRect()
    const centro = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 }
    let melhor: { x: number; y: number; d: number } | null = null
    for (let y = caixa.top + 40; y < caixa.bottom - 40; y += 20) {
      for (let x = caixa.left + 40; x < caixa.right - 40; x += 20) {
        const d = Math.hypot(x - centro.x, y - centro.y)
        if (d < minimo || (melhor !== null && d >= melhor.d)) continue
        const sob = document.elementFromPoint(x, y)
        if (sob instanceof HTMLCanvasElement && host.contains(sob)) melhor = { x, y, d }
      }
    }
    if (melhor === null) throw new Error(`nenhum ponto do mapa à vista a ${minimo} px do centro`)
    return { x: melhor.x, y: melhor.y }
  }, distancia)
}

/** Aproxima pela roda num ponto fora do centro: a câmera sai de {0, 0, 1} como num uso de verdade. */
async function mexerNaCamera(page: Page): Promise<void> {
  const antes = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  const ancora = await pontoNoMapa(page, 120)
  await page.mouse.move(ancora.x, ancora.y)
  await page.mouse.wheel(0, -200)
  await page.mouse.wheel(0, -200)
  await expect
    .poll(async () => {
      const depois = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
      return depois.scale !== antes.scale && depois.x !== antes.x && depois.y !== antes.y
    })
    .toBe(true)
}

/** Arrasta o cartão do item até `para`, de ponteiro como a mão; com Alt apertado ao soltar. */
async function arrastar(page: Page, cartao: Locator, para: Ponto, comAlt = false): Promise<void> {
  const caixa = await cartao.boundingBox()
  if (caixa === null) throw new Error('o cartão do item não está na tela')
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2)
  await page.mouse.down()
  await page.mouse.move(para.x, para.y, { steps: 12 })
  if (comAlt) await page.keyboard.down('Alt')
  await page.mouse.up()
  if (comAlt) await page.keyboard.up('Alt')
}

function esperarPerto(real: Ponto, esperado: Ponto, oQue: string): void {
  expect(real.x, `${oQue}: x`).toBeCloseTo(esperado.x, CASAS_DECIMAIS)
  expect(real.y, `${oQue}: y`).toBeCloseTo(esperado.y, CASAS_DECIMAIS)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await mapaVazio(page)
  await abrirAcervoDeItens(page)
  await mexerNaCamera(page)
})

test('o "+" do cartão põe o item no centro da vista, já selecionado, e cada um sai num Ctrl+Z', async ({ page }) => {
  const centro = await centroDaVista(page)

  await page.getByRole('button', { name: 'Pôr Espada no centro do mapa' }).click()
  await expect.poll(async () => (await estadoDoMapa(page)).props.length).toBe(1)
  let estado = await estadoDoMapa(page)
  const espada = estado.props[0]
  expect(espada).toMatchObject({ nome: 'Espada', imagem: IMAGEM_DA_ESPADA, livre: true, width: LADO_DA_CASA, height: LADO_DA_CASA })
  esperarPerto(espada, centro, 'a espada no chão')
  expect(estado.pins).toEqual([])
  expect(estado.selecao).toEqual([{ kind: 'prop', id: espada.id }])
  // O que nasce do Acervo não puxa a página Ficha: o próximo "+" continua à mão.
  await expect(livroDoMestre(page).getByRole('tab', { name: 'Acervo', exact: true })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'Pôr Poção no centro do mapa' }).click()
  await expect.poll(async () => (await estadoDoMapa(page)).pins.length).toBe(1)
  estado = await estadoDoMapa(page)
  const pocao = estado.pins[0]
  // Sem imagem não há o que desenhar no chão: o "+" faz o pino de item.
  expect(pocao).toMatchObject({ nome: 'Poção', imagem: null, livre: true, kind: 'exclamacao', icon: 'item' })
  esperarPerto(pocao, centro, 'o pino da poção')
  expect(estado.props.map((p) => p.id)).toEqual([espada.id])
  expect(estado.pinoSelecionado).toBe(pocao.id)

  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await estadoDoMapa(page)).pins.length).toBe(0)
  expect((await estadoDoMapa(page)).props.map((p) => p.id)).toEqual([espada.id])
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await estadoDoMapa(page)).props.length).toBe(0)
})

test('arrastar o cartão até o mapa põe a imagem no ponto solto; com Alt, o pino; no livro, nada', async ({ page }) => {
  const cartao = page.getByRole('button', { name: 'Abrir Espada' })
  const solto = await pontoNoMapa(page, 160)
  const centro = await centroDaVista(page)

  await arrastar(page, cartao, solto)
  await expect.poll(async () => (await estadoDoMapa(page)).props.length).toBe(1)
  let estado = await estadoDoMapa(page)
  const noChao = estado.props[0]
  expect(noChao).toMatchObject({ nome: 'Espada', imagem: IMAGEM_DA_ESPADA, livre: true, width: LADO_DA_CASA })
  esperarPerto(noChao, await noMundo(page, solto), 'a espada solta')
  // O ponto solto não é o centro: o arrasto não caiu na conta do "+".
  expect(Math.hypot(noChao.x - centro.x, noChao.y - centro.y)).toBeGreaterThan(LADO_DA_CASA)
  expect(estado.selecao).toEqual([{ kind: 'prop', id: noChao.id }])
  // O clique que o navegador manda depois do arrasto é engolido: a janela do item não abre.
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const comAlt = await pontoNoMapa(page, 260)
  await arrastar(page, cartao, comAlt, true)
  await expect.poll(async () => (await estadoDoMapa(page)).pins.length).toBe(1)
  estado = await estadoDoMapa(page)
  const pino = estado.pins[0]
  expect(pino).toMatchObject({ nome: 'Espada', imagem: IMAGEM_DA_ESPADA, kind: 'exclamacao', icon: 'item' })
  esperarPerto(pino, await noMundo(page, comAlt), 'o pino solto com Alt')
  expect(estado.pinoSelecionado).toBe(pino.id)
  expect(estado.props).toHaveLength(1)

  // Soltar em cima do livro é desistir: nada nasce, nada muda.
  const estante = await page.getByRole('region', { name: 'Itens' }).boundingBox()
  if (estante === null) throw new Error('a estante de itens não está na tela')
  await arrastar(page, cartao, { x: estante.x + estante.width / 2, y: estante.y + 12 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  estado = await estadoDoMapa(page)
  expect(estado.props).toHaveLength(1)
  expect(estado.pins).toHaveLength(1)

  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await estadoDoMapa(page)).pins.length).toBe(0)
  expect((await estadoDoMapa(page)).props.map((p) => p.id)).toEqual([noChao.id])
  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await estadoDoMapa(page)).props.length).toBe(0)
})
