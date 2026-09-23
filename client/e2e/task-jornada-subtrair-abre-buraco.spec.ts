// JORNADA VERMELHA — "Subtrair não faz nada".
//
// Achado 8 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`): em
// Opções de Chão, na OPERAÇÃO "Subtrair", arrastar por cima de um chão já
// pintado não abre buraco nenhum; numa área meio vazia, pinta chão NOVO. A
// própria descrição da opção promete o contrário: "A peça abre um buraco no
// chão desenhado antes dela." (`lib/toolVariants.ts`, FLOOR_OP_GROUP).
//
// O QUE ELA COBRA, no pixel do canvas:
//   (a) subtrair DENTRO de um chão abre buraco: o pixel dentro da forma volta
//       a ser o fundo vazio, e o chão fora da forma continua lá;
//   (b) subtrair numa área SEM chão não cria chão.
// Os dois casos usam o Pincel de blocos, a forma que o passeio usava.
//
// MEDIDO em 22/09/2026: com o Retângulo, Subtrair abre buraco direito; com o
// Pincel de blocos, a operação escolhida é ignorada. No `pointerdown` da
// ferramenta Chão (`src/pixi/PixiCanvas.tsx`, ramo `floorShapeKind ===
// 'blocos'`) o pincel decide apagar só por `event.button === 2` e nunca lê
// `floorOp`: com o botão esquerdo, Subtrair pinta igual a Somar — por cima de
// chão não muda nada, no vazio nasce chão.
//
// CONTROLES POSITIVOS: Somar com o mesmo arrasto do Pincel de blocos pinta
// chão (sem isso, "não nasceu chão" em (b) passaria com a ferramenta morta); e
// Subtrair com o Retângulo abre buraco (sem isso, "o chão continua" em (a)
// poderia ser a leitura de pixel que não enxerga buraco).
//
// COMO ELA PROVA: pixel de tela comparado byte a byte com uma página `data:`
// da cor do fundo (técnica de `task-jornada-pincel-balde-caminhos.spec.ts`).
// O chão de partida é pintado por gesto; só o mapa vazio vem do `loadMap`.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const GRADE = 64
/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`): "aqui não tem chão". */
const COR_DO_FUNDO = '#2b2b2b'
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 14
const PINTURA_MS = 300
/** Folga de poll em volta de leitura de pixel. */
const POLL_MS = 15_000

type Foto = Awaited<ReturnType<Page['screenshot']>>
interface Ponto {
  x: number
  y: number
}
type Forma = 'Pincel de blocos' | 'Retângulo'
type Operacao = 'Somar' | 'Subtrair'

const centro = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const canto = (coluna: number, linha: number): Ponto => ({ x: coluna * GRADE, y: linha * GRADE })

/** Chão de partida: retângulo das colunas 5..11 e linhas 4..8. */
const CHAO_DE = canto(5, 4)
const CHAO_ATE = canto(12, 9)
/** Ponto dentro do chão de partida mas FORA de qualquer forma de subtrair abaixo. */
const CHAO_FORA_DA_FORMA = centro(5, 8)

/**
 * O arrasto de cada forma, em volta de uma célula-alvo. O Pincel de blocos
 * pinta as células por onde passa (uma fileira); o Retângulo vai de canto a
 * canto. Nos dois, a célula-alvo fica no miolo da forma.
 */
function arrastoDaForma(forma: Forma, alvo: { coluna: number; linha: number }): { de: Ponto; ate: Ponto } {
  if (forma === 'Pincel de blocos') {
    return { de: centro(alvo.coluna - 1, alvo.linha), ate: centro(alvo.coluna + 2, alvo.linha) }
  }
  return { de: canto(alvo.coluna - 1, alvo.linha - 1), ate: canto(alvo.coluna + 2, alvo.linha + 2) }
}

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

async function arrastar(page: Page, de: Ponto, ate: Ponto): Promise<void> {
  const a = await naTela(page, de)
  const b = await naTela(page, ate)
  await page.mouse.move(a.x, a.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
  await ponteiroLonge(page)
}

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas do mapa' })

/** Uma escolha no menu "Opções de Chão" — cada escolha fecha o menu, então reabre a cada vez. */
async function escolherNoChao(page: Page, grupo: 'Forma' | 'Operação', opcao: string): Promise<void> {
  await barra(page).getByRole('button', { name: 'Opções de Chão', exact: true }).click()
  const menu = page.getByRole('group', { name: 'Opções de Chão' })
  await menu.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: opcao, exact: true }).click()
  await expect(menu, 'escolher uma opção não fechou o menu de Chão').toBeHidden()
}

async function pegarChao(page: Page, forma: Forma, operacao: Operacao): Promise<void> {
  await barra(page).getByRole('button', { name: 'Chão', exact: true }).click()
  await escolherNoChao(page, 'Forma', forma)
  await escolherNoChao(page, 'Operação', operacao)
  await expect(barra(page).getByRole('button', { name: 'Chão', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** Chão de partida, pintado por gesto: Retângulo, Somar. */
async function pintarChaoDePartida(page: Page): Promise<void> {
  await pegarChao(page, 'Retângulo', 'Somar')
  await arrastar(page, CHAO_DE, CHAO_ATE)
  await expect
    .poll(() => temChao(page, centro(8, 6)), { timeout: POLL_MS, message: 'o chão de partida não foi pintado' })
    .toBe(true)
  await expect
    .poll(() => temChao(page, CHAO_FORA_DA_FORMA), { timeout: POLL_MS, message: 'o chão de partida não chegou ao canto de controle' })
    .toBe(true)
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_subtrair', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

/** Área vazia, longe do chão de partida. */
const ALVO_VAZIO = { coluna: 16, linha: 6 }
/** Célula no miolo do chão de partida. */
const ALVO_NO_CHAO = { coluna: 8, linha: 6 }

test('CONTROLE POSITIVO: Somar com o Pincel de blocos pinta chão numa área vazia', async ({ page }) => {
  test.setTimeout(90_000)
  await pegarChao(page, 'Pincel de blocos', 'Somar')
  const { de, ate } = arrastoDaForma('Pincel de blocos', ALVO_VAZIO)
  await arrastar(page, de, ate)

  await expect
    .poll(() => temChao(page, centro(ALVO_VAZIO.coluna, ALVO_VAZIO.linha)), {
      timeout: POLL_MS,
      message: 'Somar com o Pincel de blocos não pintou chão na área vazia',
    })
    .toBe(true)
})

test('CONTROLE POSITIVO: Subtrair com o Retângulo abre buraco — a leitura de pixel enxerga buraco', async ({ page }) => {
  test.setTimeout(90_000)
  await pintarChaoDePartida(page)

  await pegarChao(page, 'Retângulo', 'Subtrair')
  const { de, ate } = arrastoDaForma('Retângulo', ALVO_NO_CHAO)
  await arrastar(page, de, ate)

  await expect
    .poll(() => temChao(page, centro(ALVO_NO_CHAO.coluna, ALVO_NO_CHAO.linha)), {
      timeout: POLL_MS,
      message: 'Subtrair com o Retângulo não abriu buraco no chão',
    })
    .toBe(false)
  expect(await temChao(page, CHAO_FORA_DA_FORMA), 'Subtrair com o Retângulo levou junto o chão de FORA da forma').toBe(true)
})

test('(a) Subtrair com o Pincel de blocos dentro de um chão abre um buraco, e o chão fora da forma fica', async ({ page }) => {
  test.setTimeout(90_000)
  await pintarChaoDePartida(page)

  await pegarChao(page, 'Pincel de blocos', 'Subtrair')
  const { de, ate } = arrastoDaForma('Pincel de blocos', ALVO_NO_CHAO)
  await arrastar(page, de, ate)

  await expect
    .poll(() => temChao(page, centro(ALVO_NO_CHAO.coluna, ALVO_NO_CHAO.linha)), {
      timeout: POLL_MS,
      message: 'Subtrair com o Pincel de blocos por cima do chão não abriu buraco: o chão continua dentro da forma',
    })
    .toBe(false)
  expect(await temChao(page, CHAO_FORA_DA_FORMA), 'Subtrair com o Pincel de blocos levou junto o chão de FORA da forma').toBe(true)
})

test('(b) Subtrair com o Pincel de blocos numa área sem chão não cria chão', async ({ page }) => {
  test.setTimeout(90_000)
  await pegarChao(page, 'Pincel de blocos', 'Subtrair')
  const { de, ate } = arrastoDaForma('Pincel de blocos', ALVO_VAZIO)
  await arrastar(page, de, ate)

  // A pintura já assentou (`arrastar` espera e tira o ponteiro): o pixel
  // lido agora é o que a pessoa vê depois de soltar.
  await page.waitForTimeout(PINTURA_MS)
  expect(
    await temChao(page, centro(ALVO_VAZIO.coluna, ALVO_VAZIO.linha)),
    'Subtrair com o Pincel de blocos numa área vazia pintou chão novo em vez de não fazer nada',
  ).toBe(false)
})
