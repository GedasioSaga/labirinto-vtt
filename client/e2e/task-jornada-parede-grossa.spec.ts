// JORNADA DE USUÁRIO — "isso era para ser uma muralha de castelo, mas não
// consigo engrossar a linha o quanto eu quiser".
//
// Escrita para FALHAR hoje. Nada de produção é tocado aqui.
//
// A DOR: a espessura da parede é um radiogroup de 3 opções fixas
// (src/components/WallStyleControls.tsx:7-11 — Fina/Média/Grossa) e as três
// valem 1, 2 e 3 px de TELA (src/pixi/drawWalls.ts:32, WALL_SCREEN_PX). O
// maior valor que existe no app é um risco de 3 px. Muralha de castelo, no
// mapa de 64 px por célula, é um traço GORDO — o usuário empurra o controle
// para o fim e não sai do risco.
//
// O CONTRATO QUE ESTA JORNADA COBRA: na seção "Parede" do painel, com uma
// parede selecionada, existe um controle CONTÍNUO de grossura (um slider, o
// mesmo padrão que Região já tem em "Ajuste fino",
// src/components/RegionStyleControls.tsx:205-215) e arrastá-lo até o fim
// engrossa a parede DESENHADA muito além do "Grossa" de hoje.
//
// COMO A PROVA É FEITA: régua de PIXEL na foto do canvas. Mede-se a altura da
// faixa clara contínua da parede numa coluna da tela, em px de CSS —
// exatamente o que o olho do usuário vê. A store nunca é lida: nem para
// montar o mapa (o mapa nasce pelo menu, com clique), nem para conferir.
//
// GESTO REAL em todo passo: page.mouse.move → down → vários move → PAUSA →
// up. Nenhum dispatchEvent, nenhum setState, nenhuma ação de store no lugar
// do gesto.
//
// CONTROLES POSITIVOS (a régua tem de errar quando deve):
//  a. coluna sem parede nenhuma → a régua devolve 0;
//  b. "Grossa", o maior valor de hoje, tem de cair na faixa de 2 a 6 px de
//     CSS. Se a régua devolvesse um número grande aí, ela estaria contando
//     grade/fundo/moldura de seleção e o piso da asserção final não valeria
//     nada.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** O Pixi pinta no rAF seguinte: o redraw é síncrono, a PINTURA não. */
const PAINT_MS = 150
/** Um humano não solta o botão no mesmo frame do último movimento. */
const PAUSA_ANTES_DE_SOLTAR_MS = 120

// Geometria, em px do canvas (câmera 1:1, grade de 64 px). A parede fica no
// meio da faixa entre as linhas de grade y=384 e y=448 (y=416), e a coluna de
// medição fica no meio de 576..640 (x=596) — longe das linhas da grade nos
// dois eixos, e bem à direita do painel, que cobre o canvas até x~240.
const PAREDE_X0 = 400
const PAREDE_X1 = 760
const PAREDE_Y = 416
/** Coluna onde a régua mede — em cima da parede, longe das linhas da grade. */
const X_MEDIDA = 596
/** Coluna depois do fim da parede: aqui a régua tem de devolver 0. */
const X_SEM_PAREDE = 900
/** Ponto vazio do canvas usado para tirar a seleção antes de fotografar. */
const VAZIO = { x: 1000, y: 660 }

/**
 * Luminância mínima para um pixel contar como "linha de parede". A parede
 * exterior é 0xd8d2c4 (luminância ~210); a grade padrão é #4a4a4a (~74) e o
 * fundo do canvas é 0x2b2b2b (~43). 130 separa a parede de tudo o mais com
 * folga dos dois lados.
 */
const LIMIAR_DE_LUZ = 130
/** Quantos px de CSS a régua procura para cima e para baixo do alvo. */
const JANELA = 40

/** O que `locator.screenshot()` devolve — `Buffer` não é tipo declarado no
 *  tsconfig dos e2e (sem @types/node), então o tipo vem da própria API. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Medida {
  /** Altura da faixa clara contínua da parede, em px de CSS. 0 = nada aceso. */
  largura: number
  /** Onde o centro dessa faixa caiu, em px de CSS dentro do canvas. */
  centro: number
}

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

/**
 * Régua de pixel: fotografa o canvas, decodifica o PNG com o próprio
 * decodificador do navegador num canvas 2D descartável e mede, numa coluna, a
 * faixa clara CONTÍNUA em volta do ponto mais aceso perto do alvo. Nenhum
 * estado do app é lido — só a imagem que o usuário vê.
 */
async function medirParede(page: Page, xCss: number, yAlvoCss: number): Promise<Medida> {
  const canvas = page.locator('canvas')
  const box = await caixaDoCanvas(page)
  const foto: Foto = await canvas.screenshot()
  return page.evaluate(
    async ({ b64, xCss, yAlvoCss, larguraCss, limiar, janela }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas2d = document.createElement('canvas')
      canvas2d.width = bmp.width
      canvas2d.height = bmp.height
      const ctx = canvas2d.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const px = Math.min(width - 1, Math.max(0, Math.round(xCss * escala)))
      const luz = (py: number): number => {
        if (py < 0 || py >= height) return 0
        const i = (py * width + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }

      const topo = Math.round((yAlvoCss - janela) * escala)
      const base = Math.round((yAlvoCss + janela) * escala)
      let semente = topo
      for (let py = topo; py <= base; py += 1) {
        if (luz(py) > luz(semente)) semente = py
      }
      if (luz(semente) < limiar) return { largura: 0, centro: yAlvoCss }

      let cima = semente
      while (luz(cima - 1) >= limiar) cima -= 1
      let baixo = semente
      while (luz(baixo + 1) >= limiar) baixo += 1
      return { largura: (baixo - cima + 1) / escala, centro: (cima + baixo) / 2 / escala }
    },
    { b64: foto.toString('base64'), xCss, yAlvoCss, larguraCss: box.width, limiar: LIMIAR_DE_LUZ, janela: JANELA },
  )
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Parede') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** Botão que diz na tela o que está selecionado. */
function botaoDeSelecao(page: Page): Locator {
  return page.getByRole('button', { name: /Apagar|Nada selecionado/ })
}

/** A seção "Parede" do painel — onde o usuário procura a grossura. */
function secaoParede(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Parede', exact: true }) })
}

/** Arrasto de ponteiro de verdade, com pausa antes de soltar. */
async function arrastar(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }, passos = 12) {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(ate.x, ate.y, { steps: passos })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
}

/** Clica no vazio para tirar a seleção — a moldura amarela não pode entrar na medição. */
async function tirarSelecao(page: Page) {
  const box = await caixaDoCanvas(page)
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + VAZIO.x, box.y + VAZIO.y)
  await expect(botaoDeSelecao(page), 'o clique no vazio tinha de desselecionar antes da foto').toHaveText('Nada selecionado')
  await page.waitForTimeout(PAINT_MS)
}

/** Clica em cima da linha que está DESENHADA na tela, no y medido pela régua. */
async function selecionarAParede(page: Page, yNaTela: number) {
  const box = await caixaDoCanvas(page)
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + X_MEDIDA, box.y + yNaTela)
  await expect(botaoDeSelecao(page), 'clicar em cima da linha desenhada tinha de selecionar a parede').toHaveText(
    'Apagar parede selecionada',
  )
}

/** Valor que o controle mostra, seja `<input type="range">` ou role="slider" à mão. */
async function valorDoControle(controle: Locator): Promise<number | null> {
  const aria = await controle.getAttribute('aria-valuenow')
  if (aria !== null) return Number(aria)
  try {
    return Number(await controle.inputValue())
  } catch {
    return null
  }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('mestre engrossa a parede até virar muralha de castelo: arrastar o controle de grossura até o fim deixa a linha MUITO mais gorda que a "Grossa" de hoje', async ({
  page,
}) => {
  const box = await caixaDoCanvas(page)

  // 1. Desenha a parede arrastando o ponteiro, como o mestre faz.
  await ferramenta(page, 'Parede')
  await arrastar(page, { x: box.x + PAREDE_X0, y: box.y + PAREDE_Y }, { x: box.x + PAREDE_X1, y: box.y + PAREDE_Y })

  // Onde a linha caiu na tela (a ferramenta pode encostar na grade): a régua
  // acha, e é nesse y que o usuário vai clicar.
  const recemDesenhada = await medirParede(page, X_MEDIDA, PAREDE_Y)
  expect(recemDesenhada.largura, 'o arrasto não desenhou parede nenhuma nesta coluna').toBeGreaterThan(0)
  const yNaTela = recemDesenhada.centro

  // CONTROLE POSITIVO (a): fora da parede a régua devolve 0 — ela não conta
  // grade nem fundo como parede.
  const vazio = await medirParede(page, X_SEM_PAREDE, yNaTela)
  expect(vazio.largura, 'a régua acendeu numa coluna SEM parede: está contando grade/fundo').toBe(0)

  // 2. Seleciona a parede clicando na linha desenhada.
  await selecionarAParede(page, yNaTela)

  // 3. Primeiro o usuário faz o que o app oferece hoje: põe no máximo, "Grossa".
  await secaoParede(page).getByRole('radio', { name: 'Grossa', exact: true }).click()
  await page.waitForTimeout(PAINT_MS)
  await tirarSelecao(page)
  const grossaDeHoje = await medirParede(page, X_MEDIDA, yNaTela)

  // CONTROLE POSITIVO (b): o maior valor de hoje é um risco de 3 px de tela
  // (WALL_SCREEN_PX em pixi/drawWalls.ts:32) — com antialias, de 2 a 6 px de
  // CSS. Fora dessa faixa a régua está medindo outra coisa e o piso lá
  // embaixo não provaria nada.
  expect(
    grossaDeHoje.largura,
    `"Grossa" mediu ${grossaDeHoje.largura.toFixed(1)} px de CSS — fora da faixa esperada de 2 a 6 px, a régua não está medindo a parede`,
  ).toBeGreaterThanOrEqual(2)
  expect(grossaDeHoje.largura, 'régua saturada: "Grossa" não pode medir mais que 6 px de CSS').toBeLessThanOrEqual(6)

  // 4. "Grossa" continua um risco. O usuário volta ao painel atrás de um
  // controle que deixe ele escolher O QUANTO quer engrossar.
  await selecionarAParede(page, yNaTela)
  const controleGrossura = secaoParede(page).getByRole('slider')
  await expect(
    controleGrossura,
    'com a parede selecionada, a seção "Parede" não oferece nenhum controle contínuo de grossura (slider) — o usuário só tem Fina/Média/Grossa e a maior delas é um risco de 3 px de tela, nunca uma muralha de castelo',
  ).toBeVisible({ timeout: 5_000 })

  const antesDoArrasto = await valorDoControle(controleGrossura)

  // 5. Arrasta o controle até o fim do trilho, com ponteiro de verdade.
  const trilho = await controleGrossura.boundingBox()
  if (!trilho) throw new Error('controle de grossura sem bounding box')
  const meioDoTrilho = { x: trilho.x + trilho.width / 2, y: trilho.y + trilho.height / 2 }
  // Passa um pouco do fim de propósito: quem quer "o máximo" empurra até bater.
  const fimDoTrilho = { x: trilho.x + trilho.width + 24, y: trilho.y + trilho.height / 2 }
  await arrastar(page, meioDoTrilho, fimDoTrilho, 10)

  const depoisDoArrasto = await valorDoControle(controleGrossura)
  // APOIO (não é a prova): o controle na tela tem de ter subido com o arrasto.
  expect
    .soft(
      depoisDoArrasto ?? -1,
      `o arrasto até o fim do trilho não aumentou o valor do controle (antes ${antesDoArrasto}, depois ${depoisDoArrasto})`,
    )
    .toBeGreaterThan(antesDoArrasto ?? 0)

  await tirarSelecao(page)
  const muralha = await medirParede(page, X_MEDIDA, yNaTela)

  // 6. A PROVA, no pixel da tela: a parede desenhada tem de ficar claramente
  // mais gorda que a "Grossa" de hoje. Dois pisos, ambos sobre o que se vê:
  //   - ao menos 12 px de CSS: numa célula de 64 px é traço de muralha, não risco;
  //   - ao menos 3× a "Grossa" medida agora há pouco, para a margem ser gritante
  //     e não sobrar dúvida de antialias.
  expect(
    muralha.largura,
    `depois de empurrar o controle até o fim, a parede desenhada mede ${muralha.largura.toFixed(1)} px de CSS — muralha de castelo precisa de pelo menos 12`,
  ).toBeGreaterThanOrEqual(12)
  expect(
    muralha.largura,
    `a parede no máximo (${muralha.largura.toFixed(1)} px) não é visivelmente mais grossa que a "Grossa" de hoje (${grossaDeHoje.largura.toFixed(1)} px)`,
  ).toBeGreaterThanOrEqual(grossaDeHoje.largura * 3)
})
