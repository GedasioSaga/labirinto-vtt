// JORNADA VERMELHA — "troquei de forma e o corredor sumiu".
//
// Achado 7 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`): com um
// traço de Corredor de chão ABERTO (pontos clicados, ainda sem Enter), trocar
// de forma no menu "Opções de Chão" faz o corredor inteiro desaparecer, sem
// aviso nenhum. A pessoa clicou três, quatro pontos e perdeu tudo por um
// clique no menu.
//
// DECISÃO que esta régua cobra:
//   - traço aberto com 2 pontos ou mais: trocar de forma FINALIZA o corredor
//     como está — o chão fica na tela;
//   - traço com menos de 2 pontos (não dá corredor): o rascunho some, mas um
//     aviso visível diz que o traço foi descartado.
//
// MEDIDO em 22/09/2026: `setFloorShapeKind` (`src/stores/mapStore.ts`) só
// troca a forma — ninguém finaliza nem avisa. O rascunho fica em
// `corridorDraftPoints` e morre calado no `clearDrafts()` da próxima troca de
// ferramenta (`unsubscribeActiveTool`, `src/pixi/PixiCanvas.tsx`).
//
// POR QUE A LEITURA VEM DEPOIS DE "Selecionar": o rascunho do corredor é
// desenhado com o mesmo preenchimento do chão (`drawCorridorDraft` em
// `src/pixi/PixiCanvas.tsx`). Pixel de chão logo depois da troca podia ser só
// o rascunho ainda pintado. Trocar de ferramenta limpa todo rascunho
// (`clearDrafts`) e deixa só o que virou mapa — então o pixel lido depois de
// "Selecionar" é chão DE VERDADE.
//
// CONTROLE POSITIVO: o mesmo traço fechado do jeito de hoje (Enter) desenha o
// chão e ele continua lá depois de "Selecionar". Sem ele, "não tem chão" em
// (a) poderia ser a leitura de pixel que não enxerga corredor.
//
// COMO ELA PROVA: pixel de tela comparado byte a byte com uma página `data:`
// da cor do fundo (técnica de `task-jornada-subtrair-abre-buraco.spec.ts`).
// Gesto real de ponteiro e teclado; só o mapa vazio vem do `loadMap`.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const GRADE = 64
/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`): "aqui não tem chão". */
const COR_DO_FUNDO = '#2b2b2b'
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PINTURA_MS = 300
/** Folga de poll em volta de leitura de pixel. */
const POLL_MS = 15_000

type Foto = Awaited<ReturnType<Page['screenshot']>>
interface Ponto {
  x: number
  y: number
}

const canto = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE, y: linha * GRADE })

/** O traço do corredor: um L por cruzamentos da grade. */
const PONTOS_DO_CORREDOR: readonly Ponto[] = [canto(7, 5), canto(13, 5), canto(13, 10)]
/** Meio do primeiro trecho: em cima da linha central do corredor. */
const NO_CORREDOR = canto(10, 5)

let referenciaDoFundo: Foto | null = null

async function fotoDoFundo(page: Page): Promise<Foto> {
  if (referenciaDoFundo) return referenciaDoFundo
  const outra = await page.context().newPage()
  try {
    await outra.setViewportSize({ width: 200, height: 200 })
    await outra.goto(`data:text/html,<body style="margin:0;background:%23${COR_DO_FUNDO.slice(1)}">`)
    referenciaDoFundo = await outra.screenshot({ clip: { x: 100, y: 100, width: 1, height: 1 } })
    return referenciaDoFundo
  } finally {
    await outra.close()
  }
}

async function naTela(page: Page, mundo: Ponto): Promise<Ponto> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + mundo.x, y: box.y + mundo.y }
}

async function temChao(page: Page, mundo: Ponto): Promise<boolean> {
  const p = await naTela(page, mundo)
  const foto = await page.screenshot({ clip: { x: Math.round(p.x), y: Math.round(p.y), width: 1, height: 1 } })
  return !foto.equals(await fotoDoFundo(page))
}

async function ponteiroLonge(page: Page): Promise<void> {
  const longe = await naTela(page, { x: 1200, y: 760 })
  await page.mouse.move(longe.x, longe.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Clique de pessoa no mapa: move, pausa, desce, pausa, sobe. */
async function clicarNoMapa(page: Page, mundo: Ponto): Promise<void> {
  const p = await naTela(page, mundo)
  await page.mouse.move(p.x, p.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  // Longe do duplo clique: cada ponto é um clique separado.
  await page.waitForTimeout(450)
}

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas do mapa' })

/** Uma escolha no menu "Opções de Chão" — cada escolha fecha o menu. */
async function escolherFormaDoChao(page: Page, forma: string): Promise<void> {
  await barra(page).getByRole('button', { name: 'Opções de Chão', exact: true }).click()
  const menu = page.getByRole('group', { name: 'Opções de Chão' })
  await menu.getByRole('radiogroup', { name: 'Forma' }).getByRole('radio', { name: forma, exact: true }).click()
  await expect(menu, 'escolher uma forma não fechou o menu de Chão').toBeHidden()
}

async function pegarCorredor(page: Page): Promise<void> {
  await barra(page).getByRole('button', { name: 'Chão', exact: true }).click()
  await escolherFormaDoChao(page, 'Corredor')
  await expect(barra(page).getByRole('button', { name: 'Chão', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** Vai para Selecionar pela barra: todo rascunho some, só fica o que é mapa. */
async function largarAFerramenta(page: Page): Promise<void> {
  await barra(page).getByRole('button', { name: 'Selecionar', exact: true }).click()
  await expect(barra(page).getByRole('button', { name: 'Selecionar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await ponteiroLonge(page)
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_corredor_aberto', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('CONTROLE POSITIVO: fechar o corredor com Enter desenha o chão, e ele fica depois de largar a ferramenta', async ({ page }) => {
  test.setTimeout(60_000)
  expect(await temChao(page, NO_CORREDOR), 'o mapa de partida já tinha chão onde o corredor vai passar').toBe(false)

  await pegarCorredor(page)
  for (const ponto of PONTOS_DO_CORREDOR) await clicarNoMapa(page, ponto)
  await page.keyboard.press('Enter')
  await ponteiroLonge(page)
  await largarAFerramenta(page)

  await expect
    .poll(() => temChao(page, NO_CORREDOR), { timeout: POLL_MS, message: 'o corredor fechado com Enter não desenhou chão' })
    .toBe(true)
})

test('(a) com 3 pontos clicados, trocar de forma finaliza o corredor: o chão fica na tela', async ({ page }) => {
  test.setTimeout(60_000)
  expect(await temChao(page, NO_CORREDOR), 'o mapa de partida já tinha chão onde o corredor vai passar').toBe(false)

  await pegarCorredor(page)
  for (const ponto of PONTOS_DO_CORREDOR) await clicarNoMapa(page, ponto)
  await ponteiroLonge(page)

  // O gesto do passeio: com o traço aberto, a pessoa troca de forma no menu.
  await escolherFormaDoChao(page, 'Retângulo')
  await ponteiroLonge(page)
  await largarAFerramenta(page)

  await expect
    .poll(() => temChao(page, NO_CORREDOR), {
      timeout: POLL_MS,
      message: 'trocar de forma com o corredor aberto (3 pontos) apagou o corredor em vez de finalizá-lo',
    })
    .toBe(true)
})

test('(b) com 1 ponto só, trocar de forma descarta o rascunho e AVISA que descartou', async ({ page }) => {
  test.setTimeout(60_000)
  await pegarCorredor(page)
  await clicarNoMapa(page, PONTOS_DO_CORREDOR[0])
  await ponteiroLonge(page)

  await escolherFormaDoChao(page, 'Retângulo')

  await expect(
    page.getByText(/descart/i).first(),
    'trocar de forma com 1 ponto de corredor sumiu com o rascunho sem nenhum aviso visível',
  ).toBeVisible({ timeout: POLL_MS })
})
