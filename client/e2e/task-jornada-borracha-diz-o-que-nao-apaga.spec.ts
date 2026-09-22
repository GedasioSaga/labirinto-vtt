// JORNADA VERMELHA — "a Borracha em Objeto inteiro ignora chão em silêncio".
//
// Achado 9 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`): com a
// Borracha no modo "Objeto inteiro", clicar numa peça de chão não apaga nada e
// não diz nada. O mesmo clique num desenho à mão apaga o desenho. A pessoa
// conclui que errou o alvo e tenta de novo, e de novo.
//
// A DECISÃO (não é esta jornada que a toma, ela só a cobra): a borracha
// continua NÃO apagando chão nesse modo, mas AVISA na tela, com texto visível,
// que chão se apaga de outro jeito — e qual. Lido no código de hoje: nenhum
// modo da borracha alcança chão (`eraseAt` em `src/pixi/PixiCanvas.tsx` busca
// o alvo por `findSelectableAt`, que não devolve peça de chão; o chão só vira
// alvo por `floorHitAt`, que a borracha não chama). O chão sai por dois
// caminhos: a ferramenta Chão com o "Pincel de blocos" e o botão DIREITO
// (`lib/toolVariants.ts`, descrição do pincel), ou Selecionar a peça e apagá-la.
// O aviso tem de nomear um deles.
//
// COMO ELA PROVA, tudo no que aparece na tela:
//   - "o chão continua lá" e "o desenho sumiu" são o pixel do canvas comparado
//     byte a byte com uma página `data:` da cor sólida (mesma técnica de
//     `task-jornada-pincel-balde-caminhos.spec.ts`);
//   - "apareceu um aviso" é uma linha de texto VISÍVEL (innerText) que não
//     existia antes do clique e fala de chão. Comparar antes/depois evita o
//     verde falso: o painel lateral já tem "Cor do chão" e a dica da ferramenta
//     Chão fala de chão — o que se cobra é texto NOVO, nascido do clique.
//
// O cenário é montado por gesto (arrastar com Chão, arrastar com o Pincel); só
// o mapa vazio de partida vem do `loadMap`, como nas outras jornadas.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

const GRADE = 64
/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`): "aqui não tem nada". */
const COR_DO_FUNDO = '#2b2b2b'
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 12
const PINTURA_MS = 300
/** Folga de poll em volta de leitura de pixel e de texto. */
const POLL_MS = 15_000

type Foto = Awaited<ReturnType<Page['screenshot']>>
interface Ponto {
  x: number
  y: number
}

/** Peça de chão do teste: retângulo das colunas 5..12 e linhas 4..9. */
const CHAO_DE = { x: 5 * GRADE, y: 4 * GRADE }
const CHAO_ATE = { x: 12 * GRADE, y: 9 * GRADE }
const MEIO_DO_CHAO = { x: 8 * GRADE + GRADE / 2, y: 6 * GRADE + GRADE / 2 }
/** Traço à mão, longe do chão, na horizontal. */
const TRACO_DE = { x: 14 * GRADE, y: 6 * GRADE + GRADE / 2 }
const TRACO_ATE = { x: 18 * GRADE, y: 6 * GRADE + GRADE / 2 }
const MEIO_DO_TRACO = { x: 16 * GRADE, y: 6 * GRADE + GRADE / 2 }

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

/** Verdadeiro quando o pixel de mundo é o fundo vazio do mapa. */
async function vazioEm(page: Page, mundo: Ponto): Promise<boolean> {
  const p = await naTela(page, mundo)
  const foto = await page.screenshot({ clip: { x: Math.round(p.x), y: Math.round(p.y), width: 1, height: 1 } })
  return foto.equals(await fotoDoFundo(page))
}

/** Tira o ponteiro da frente antes de ler pixel (sem Escape: não é para cancelar nada). */
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
}

/** Clique de pessoa: chega, para, aperta, segura um instante, solta. */
async function clicar(page: Page, mundo: Ponto): Promise<void> {
  const p = await naTela(page, mundo)
  await page.mouse.move(p.x, p.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas do mapa' })

async function desenharChao(page: Page): Promise<void> {
  // Ferramenta Chão no padrão do mapa novo: Retângulo, Somar.
  await barra(page).getByRole('button', { name: 'Chão', exact: true }).click()
  await arrastar(page, CHAO_DE, CHAO_ATE)
  await ponteiroLonge(page)
  await expect
    .poll(() => vazioEm(page, MEIO_DO_CHAO), { timeout: POLL_MS, message: 'o arrasto com a ferramenta Chão não pintou chão nenhum' })
    .toBe(false)
}

async function desenharTraco(page: Page): Promise<void> {
  await barra(page).getByRole('button', { name: 'Opções de Desenho', exact: true }).click()
  await page.getByRole('group', { name: 'Opções de Desenho' }).getByRole('radio', { name: 'Pincel', exact: true }).click()
  await arrastar(page, TRACO_DE, TRACO_ATE)
  await ponteiroLonge(page)
  await expect
    .poll(() => vazioEm(page, MEIO_DO_TRACO), { timeout: POLL_MS, message: 'o arrasto com o Pincel não deixou traço nenhum' })
    .toBe(false)
}

async function borrachaObjetoInteiro(page: Page): Promise<void> {
  await barra(page).getByRole('button', { name: 'Borracha', exact: true }).click()
  await barra(page).getByRole('button', { name: 'Opções de Borracha', exact: true }).click()
  await page.getByRole('group', { name: 'Opções de Borracha' }).getByRole('radio', { name: 'Objeto inteiro', exact: true }).click()
  await expect(barra(page).getByRole('button', { name: 'Borracha', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** Linhas de texto visíveis agora — `innerText` já deixa de fora o que está escondido. */
async function linhasVisiveis(page: Page): Promise<string[]> {
  const texto = await page.locator('body').innerText()
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_borracha_chao', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('CONTROLE POSITIVO: a Borracha em Objeto inteiro apaga um desenho à mão com um clique', async ({ page }) => {
  test.setTimeout(90_000)
  await desenharTraco(page)
  await borrachaObjetoInteiro(page)

  await clicar(page, MEIO_DO_TRACO)
  await ponteiroLonge(page)

  await expect
    .poll(() => vazioEm(page, MEIO_DO_TRACO), { timeout: POLL_MS, message: 'o clique da Borracha não apagou o traço à mão' })
    .toBe(true)
})

test('(a) clicar num chão com a Borracha em Objeto inteiro mostra um aviso que fala de chão e diz como apagá-lo', async ({ page }) => {
  test.setTimeout(90_000)
  await desenharChao(page)
  await borrachaObjetoInteiro(page)

  // O "antes" é tirado com o ponteiro já em cima do chão: o que só aparece ao
  // passar o mouse não conta como resposta ao clique.
  const alvo = await naTela(page, MEIO_DO_CHAO)
  await page.mouse.move(alvo.x, alvo.y)
  await page.waitForTimeout(PINTURA_MS)
  const antes = new Set(await linhasVisiveis(page))

  await clicar(page, MEIO_DO_CHAO)

  const avisosNovos = async () => (await linhasVisiveis(page)).filter((linha) => !antes.has(linha) && /ch[ãa]o/i.test(linha))
  await expect
    .poll(avisosNovos, {
      timeout: POLL_MS,
      message: 'clicar no chão com a Borracha em "Objeto inteiro" não mostrou texto novo nenhum que fale de chão — a pessoa acha que errou o alvo',
    })
    .not.toEqual([])

  const aviso = (await avisosNovos()).join(' ')
  expect(
    aviso,
    `o aviso fala de chão mas não diz por onde ele se apaga (Pincel de blocos com o botão direito, ou Selecionar e apagar): "${aviso}"`,
  ).toMatch(/pincel de blocos|bot[ãa]o direito|selecion/i)
})

test('(b) o clique da Borracha em Objeto inteiro não apaga o chão', async ({ page }) => {
  test.setTimeout(90_000)
  await desenharChao(page)
  await borrachaObjetoInteiro(page)

  await clicar(page, MEIO_DO_CHAO)
  await ponteiroLonge(page)

  // Espera a pintura assentar e confirma, com folga, que o chão continua lá.
  await page.waitForTimeout(PINTURA_MS)
  await expect
    .poll(() => vazioEm(page, MEIO_DO_CHAO), { timeout: POLL_MS, message: 'a Borracha em Objeto inteiro apagou o chão — a decisão é avisar, não apagar' })
    .toBe(false)
})
