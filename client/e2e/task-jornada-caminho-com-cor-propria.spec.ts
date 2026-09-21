// JORNADA VERMELHA — "quero um caminho de terra e outro de pedra, cada um com
// a SUA cor, sem repintar o mapa inteiro".
//
// Escrita ANTES da feature existir. Nada de produção é tocado aqui.
//
// O QUE JÁ EXISTE E NÃO É ISTO. Desde `bc1f83e` dá para pintar chão com o
// pincel de blocos, SELECIONAR a peça de chão e trocar a cor dela
// (`FloorPiece.fillColor`, `src/components/FloorPieceControls.tsx:204-219`,
// pintado por `buildColorLayers` em `src/pixi/drawFloor.ts:88`). Isso é chão
// colorido, e `task-jornada-pincel-balde-caminhos.spec.ts` (teste 4) já cobra
// e passa. O que NÃO existe é o caminho como COISA PRÓPRIA: a ferramenta
// "Caminho", ponto a ponto, com a cor escolhida no painel ANTES de traçar —
// o desenho da fatia 3 do plano (`HANDOFF.md:203-205`: `Drawing` kind
// `'path'`, largura em células, cor própria, "Ferramenta Caminho ponto a
// ponto"). Hoje `TOOL_LABELS` (src/components/labels.ts:13-42) não tem nenhum
// `Caminho`, e a única cor de chão ao alcance de quem ainda não desenhou é
// "Cor do chão", que vale para o MAPA INTEIRO.
//
// O CONTRATO QUE ESTA JORNADA COBRA:
//   1. existe um "Caminho" que a pessoa escolhe pelo nome (na barra ou dentro
//      de uma setinha de opções);
//   2. com ele ativo, o painel oferece a cor DAQUELE caminho antes do
//      primeiro ponto;
//   3. traçado ponto a ponto, o caminho aparece na tela na cor escolhida;
//   4. o segundo caminho, com outra cor, aparece ao mesmo tempo, na cor DELE,
//      sem repintar o primeiro nem o fundo do mapa.
//
// COMO ELA PROVA. Régua de pixel na foto da página: o PNG é decodificado pelo
// próprio navegador e a cor lida é a que o olho vê. A store nunca é lida nem
// escrita — nem para montar o mapa (ele nasce pelo menu, com clique), nem
// para conferir. Todo gesto é ponteiro de verdade, com pausa antes de soltar.
//
// CONTROLE POSITIVO (teste 1): o editor abre pelo menu, a barra tem as
// ferramentas de desenho e a régua lê o fundo do mapa novo (#2b2b2b) no ponto
// onde os caminhos vão passar. Sem isso, um vermelho lá embaixo poderia ser
// só régua quebrada ou editor que não abriu.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`). */
const COR_DO_FUNDO = { r: 0x2b, g: 0x2b, b: 0x2b }
/** Cores que a pessoa escolhe para cada caminho. */
const COR_DO_CAMINHO_A = '#3a7ad9'
const COR_DO_CAMINHO_B = '#d94f3a'
/** Folga por canal entre a cor pedida e a cor lida na tela (antialias, blend). */
const TOLERANCIA = 28

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PINTURA_MS = 300
/** Um humano não solta o botão no mesmo frame em que desceu. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150

/** Pontos do caminho A e do caminho B, em px de tela relativos ao canvas.
 *  Longe do painel (que cobre o canvas até x~240) e das bordas. */
const CAMINHO_A = [
  { x: 420, y: 300 },
  { x: 620, y: 300 },
  { x: 820, y: 300 },
]
const CAMINHO_B = [
  { x: 420, y: 620 },
  { x: 620, y: 620 },
  { x: 820, y: 620 },
]
/** Onde a régua mede cada caminho e o fundo entre os dois. */
const MEIO_DO_A = { x: 520, y: 300 }
const FIM_DO_A = { x: 720, y: 300 }
const MEIO_DO_B = { x: 520, y: 620 }
const ENTRE_OS_DOIS = { x: 520, y: 460 }
/** Canto para onde o ponteiro sai antes de fotografar. */
const LONGE = { x: 1180, y: 120 }

interface Rgb {
  r: number
  g: number
  b: number
}

interface Ponto {
  x: number
  y: number
}

/** O que `page.screenshot()` devolve — sem @types/node no tsconfig dos e2e,
 *  o tipo do buffer vem da própria API do Playwright. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

function hexParaRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function comoTexto(cor: Rgb): string {
  return `rgb(${cor.r}, ${cor.g}, ${cor.b})`
}

function distancia(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { x: caixa.x, y: caixa.y }
}

/**
 * Cor do pixel que está NA TELA, no ponto pedido. Fotografa 1×1, decodifica o
 * PNG com o decodificador do próprio navegador e devolve o RGB. Só leitura:
 * nenhum estado do app é tocado.
 */
async function corNaTela(page: Page, ponto: Ponto): Promise<Rgb> {
  const canvas = await caixaDoCanvas(page)
  const foto: Foto = await page.screenshot({
    clip: { x: Math.round(canvas.x + ponto.x), y: Math.round(canvas.y + ponto.y), width: 1, height: 1 },
  })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d para ler a foto')
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, 1, 1)
    return { r: data[0], g: data[1], b: data[2] }
  }, foto.toString('base64'))
}

/** Tira o ponteiro e qualquer rascunho da frente antes de medir. */
async function limparAVista(page: Page): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await page.keyboard.press('Escape')
  await page.mouse.move(canvas.x + LONGE.x, canvas.y + LONGE.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Clique de pessoa: desce, fica parado um instante, sobe. */
async function clicarComoPessoa(page: Page, ponto: Ponto): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await page.mouse.move(canvas.x + ponto.x, canvas.y + ponto.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
}

/** Todo nome acessível de controle na tela — só para a mensagem de falha
 *  ajudar quem for implementar. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * A ferramenta que a pessoa procura pelo nome "Caminho": primeiro um botão da
 * barra, depois um rádio dentro de qualquer setinha de opções já aberta. Não
 * achou: vermelho honesto, dizendo o que a barra oferece hoje.
 */
async function pegarOCaminho(page: Page): Promise<void> {
  const naBarra = page.getByRole('button', { name: /caminho/i })
  if ((await naBarra.count()) > 0) {
    await naBarra.first().click()
    await page.waitForTimeout(PINTURA_MS)
    return
  }
  for (const setinha of ['Opções de Desenho', 'Opções de Chão']) {
    const botao = page.getByRole('button', { name: setinha, exact: true })
    if ((await botao.count()) === 0) continue
    await botao.first().click()
    const opcao = page.getByRole('group', { name: setinha }).getByRole('radio', { name: /caminho/i })
    if ((await opcao.count()) > 0) {
      await opcao.first().click()
      await page.waitForTimeout(PINTURA_MS)
      return
    }
    await page.keyboard.press('Escape')
  }
  const existentes = await nomesDeControleNaTela(page)
  expect(
    0,
    `não existe nenhuma ferramenta chamada "Caminho" na barra nem nas setinhas de opções — para fazer um caminho de terra e outro de pedra a pessoa só tem "Cor do chão", que repinta o mapa inteiro. O que a tela oferece hoje: ${existentes.join(' | ')}`,
  ).toBeGreaterThan(0)
}

/**
 * O swatch da cor DESTE caminho, com a ferramenta Caminho ativa. Aceita
 * qualquer `input[type=color]` dentro de uma seção que fale de Caminho; sem
 * ela, qualquer swatch do painel que não seja um dos que já existem hoje —
 * e nenhum dos de hoje é por caminho (`#lb-floor-fill-color` é do mapa
 * inteiro; `#lb-draw-color` é do traço de desenho).
 */
function corDesteCaminho(page: Page): Locator {
  const naSecaoDoCaminho = page
    .locator('section')
    .filter({ hasText: /caminho/i })
    .locator('input[type="color"]')
  const qualquerOutro = page.locator(
    '.lb-inspector__body input[type="color"]' +
      ':not(#lb-floor-fill-color):not(#lb-floor-stroke-color)' +
      ':not(#lb-draw-color):not(#lb-grid-color):not(#lb-text-color)' +
      ':not(#lb-region-color):not(#lb-light-color)',
  )
  return naSecaoDoCaminho.or(qualquerOutro)
}

/**
 * Traça um caminho ponto a ponto, com a cor escolhida ANTES do primeiro
 * ponto, e termina com duplo clique no último — o gesto que o plano descreve
 * ("ponto a ponto, Enter/duplo clique termina").
 */
async function tracarCaminho(page: Page, pontos: readonly Ponto[], hex: string): Promise<void> {
  await pegarOCaminho(page)

  const swatch = corDesteCaminho(page)
  await expect(
    swatch.first(),
    `com a ferramenta Caminho ativa, o painel não oferece a cor DESTE caminho antes de traçar — sem ela cada caminho nasce com a cor do chão e "terra" e "pedra" ficam iguais`,
  ).toBeVisible({ timeout: 5_000 })
  await swatch.first().fill(hex)
  await page.waitForTimeout(PINTURA_MS)

  const canvas = await caixaDoCanvas(page)
  for (const ponto of pontos.slice(0, -1)) await clicarComoPessoa(page, ponto)
  const ultimo = pontos[pontos.length - 1]
  await page.mouse.move(canvas.x + ultimo.x, canvas.y + ultimo.y)
  await page.mouse.dblclick(canvas.x + ultimo.x, canvas.y + ultimo.y)
  await page.waitForTimeout(PINTURA_MS)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('CONTROLE POSITIVO: o editor abre pelo menu, a barra traz as ferramentas de desenho e a régua de pixel lê o fundo do mapa novo', async ({
  page,
}) => {
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chão', exact: true })).toBeVisible()

  await limparAVista(page)

  // A régua mede nos três pontos que os caminhos vão ocupar: mapa novo é só
  // fundo, então os três têm de vir iguais ao fundo. Régua que já acendesse
  // aqui não provaria nada lá embaixo.
  for (const ponto of [MEIO_DO_A, MEIO_DO_B, ENTRE_OS_DOIS]) {
    const cor = await corNaTela(page, ponto)
    expect(
      distancia(cor, COR_DO_FUNDO),
      `no mapa recém-criado o ponto (${ponto.x}, ${ponto.y}) devia ser o fundo ${comoTexto(COR_DO_FUNDO)}, e a régua leu ${comoTexto(cor)}`,
    ).toBeLessThanOrEqual(TOLERANCIA)
  }
})

test('dois caminhos, duas cores: cada caminho aparece na cor escolhida no painel, os dois ao mesmo tempo, sem repintar o outro nem o fundo', async ({
  page,
}, testInfo) => {
  await tracarCaminho(page, CAMINHO_A, COR_DO_CAMINHO_A)
  await limparAVista(page)

  const a = await corNaTela(page, MEIO_DO_A)
  expect(
    distancia(a, hexParaRgb(COR_DO_CAMINHO_A)),
    `o primeiro caminho não saiu na cor escolhida: pedi ${COR_DO_CAMINHO_A} e a tela mostra ${comoTexto(a)} no meio do traço`,
  ).toBeLessThanOrEqual(TOLERANCIA)

  await tracarCaminho(page, CAMINHO_B, COR_DO_CAMINHO_B)
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('dois-caminhos.png') })

  const b = await corNaTela(page, MEIO_DO_B)
  expect(
    distancia(b, hexParaRgb(COR_DO_CAMINHO_B)),
    `o segundo caminho não saiu na cor escolhida: pedi ${COR_DO_CAMINHO_B} e a tela mostra ${comoTexto(b)}`,
  ).toBeLessThanOrEqual(TOLERANCIA)

  // OS DOIS AO MESMO TEMPO: pintar o segundo não pode ter levado o primeiro
  // junto — é exatamente o que "Cor do chão" faz hoje.
  const aDepois = await corNaTela(page, MEIO_DO_A)
  const aNoFim = await corNaTela(page, FIM_DO_A)
  expect(
    distancia(aDepois, hexParaRgb(COR_DO_CAMINHO_A)),
    `escolher a cor do segundo caminho repintou o primeiro: ele devia continuar ${COR_DO_CAMINHO_A} e a tela mostra ${comoTexto(aDepois)}`,
  ).toBeLessThanOrEqual(TOLERANCIA)
  expect(
    distancia(aNoFim, hexParaRgb(COR_DO_CAMINHO_A)),
    `o fim do primeiro caminho perdeu a cor dele: esperava ${COR_DO_CAMINHO_A}, a tela mostra ${comoTexto(aNoFim)}`,
  ).toBeLessThanOrEqual(TOLERANCIA)

  // E nada vazou para fora dos dois traços.
  const meio = await corNaTela(page, ENTRE_OS_DOIS)
  expect(
    distancia(meio, COR_DO_FUNDO),
    `a cor de um caminho vazou para fora dele: entre os dois traços a tela devia ter o fundo ${comoTexto(COR_DO_FUNDO)} e tem ${comoTexto(meio)}`,
  ).toBeLessThanOrEqual(TOLERANCIA)
})
