// JORNADA DOS QUADRADOS AO ARRASTAR O TOKEN — escrita para SAIR VERMELHA hoje.
//
// A feature pedida (candidata 2 de `docs/features-candidatas-2026-09-21.md`):
// enquanto o mestre ARRASTA uma ficha pelo mapa, com o botão ainda apertado, a
// tela mostra QUANTOS QUADRADOS ela já percorreu — do jeito que a ferramenta
// Medir já mostra. Hoje não mostra nada: `pixi/drawMeasurementIndicator.ts` só
// é acionado pela ferramenta `measure` (`pixi/PixiCanvas.tsx:3780-3786`); o
// ramo `dragging-token` (:3790-3801) move a peça e não desenha número nenhum.
// Quem joga decide no olhômetro se o movimento cabia, e a mesa briga.
//
// O QUE ESTA JORNADA COBRA, TUDO NO QUE APARECE NA TELA (nenhuma asserção lê a
// store; nenhum `evaluate` escreve; todo gesto é ponteiro que desce, caminha em
// passos e PARA antes de soltar):
//
//   PROVA 1 — segurando a ficha em cima do destino, a tela mostra ALGUMA COISA
//             que não está lá depois de soltar.
//   PROVA 2 — essa coisa depende de QUANTO a ficha andou: dois arrastos que
//             terminam NA MESMA CÉLULA, um de 5 quadrados e outro de 1, têm de
//             sair diferentes na foto enquanto o botão está apertado. Um
//             realce fixo de arrasto — que não é número — não passa nesta.
//   PROVA 3 — ao soltar, some: as fotos dos dois destinos soltos são iguais
//             byte a byte, então nada de 5 quadrados nem de 1 ficou grudado.
//
// POR QUE COMPARAR FOTO INTEIRA DA FAIXA É HONESTO AQUI. O destino é um CENTRO
// DE CÉLULA (`applySnap(..., 'token')`), então a ficha já está desenhada no
// lugar final enquanto o botão está apertado: entre "segurando" e "solto" não
// muda a posição do disco, não muda a seleção e não há guia de alinhamento
// (elas só nascem com OUTRA ficha no mapa, `PixiCanvas.tsx:3794-3797`, e este
// mapa tem uma só). A PROVA 3 é também a calibração disso: se as duas fotos
// soltas não fossem iguais, comparar as fotos seguradas não provaria nada.
//
// MEDIDO NO CÓDIGO DE HOJE, 21/09/2026, antes de escrever este arquivo: a foto
// segurando e a foto solta saem IGUAIS byte a byte, e os dois arrastos de
// distâncias diferentes saem IGUAIS entre si. É exatamente aqui que a jornada
// morde.
//
// O CONTROLE POSITIVO usa a ferramenta Medir no MESMO corredor e cobra as
// MESMAS TRÊS PROVAS — ela mostra, depende da distância e some ao soltar. Ele é
// que garante que o método (recorte, espera de pintura, comparação byte a byte)
// enxerga um número efêmero no canvas quando ele existe; sem isso, "as fotos
// saíram iguais" poderia ser só a foto ser cega.
//
// GEOMETRIA (px de tela = px de mundo, câmera 1:1 ao abrir; grade de 64 px;
// mapa novo nasce sem grade desenhada). 32 + 64k é centro de célula:
//   LONGE (416,672) · PERTO (672,672) · DESTINO (736,672) — todos centros.
//   A faixa fotografada (x 360..1160, y 540..760) fica longe do painel da
//   esquerda (que cobre o canvas até x~240) e contém o corredor inteiro, os
//   discos das fichas e a área onde a régua de hoje põe o rótulo.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Onde a ficha começa o arrasto longo: 5 quadrados à esquerda do destino. */
const LONGE = { x: 416, y: 672 }
/** Onde ela começa o arrasto curto: 1 quadrado à esquerda do destino. */
const PERTO = { x: 672, y: 672 }
/** O destino dos dois arrastos — o mesmo, de propósito. */
const DESTINO = { x: 736, y: 672 }
/** Quantos quadrados o arrasto longo percorre. 5 x 64 px = 320 px. */
const QUADRADOS_DO_ARRASTO_LONGO = 5
/** Onde a ficha nasce: o centro da vista (`App.tsx:criarToken`). */
const ONDE_A_FICHA_NASCE = { x: 640, y: 400 }
/** Pedaço de tela fotografado — todo o corredor do arrasto, sem nenhum painel. */
const FAIXA = { x: 360, y: 540, width: 800, height: 220 }

/** Botão parado antes de soltar: é o que separa um arrasto de pessoa de um clique. */
const PAUSA_MS = 200
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Ponto {
  x: number
  y: number
}

/** Foto da faixa livre de painel. */
async function fotoDaFaixa(page: Page): Promise<Foto> {
  return page.screenshot({ clip: FAIXA })
}

/** Escolhe uma ferramenta na barra do mestre. */
async function ferramenta(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: nome, exact: true }).click()
}

/** Caixa do `<canvas>` do editor (os painéis flutuam por cima dele). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/**
 * Coloca a ficha pelo caminho do painel ("Adicionar token"), que é o único
 * caminho de interface hoje — a ferramenta Token está escondida por
 * `FEATURES.tokenTool`. A peça nasce no CENTRO DA VISTA.
 */
async function colocarFicha(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  const campo = page.getByLabel('Nome do novo token')
  await campo.click()
  await campo.pressSequentially(nome, { delay: 15 })
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Apagar token selecionado' }),
    'a ficha não entrou no mapa: o painel não mostra nada de token selecionado',
  ).toBeVisible({ timeout: 5000 })
}

/** Desce o ponteiro, caminha em passos e PARA em cima do destino — sem soltar. */
async function segurarAte(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(para.x, para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS + PINTURA_MS)
}

/** Solta o botão e espera a pintura assentar. */
async function soltar(page: Page): Promise<void> {
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Arrasto de pessoa completo: segura, caminha, para, solta. */
async function arrastarComoPessoa(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await segurarAte(page, de, para)
  await soltar(page)
}

/**
 * Controle negativo obrigatório: parada, a faixa é estável. Sem isto, "as fotos
 * saíram diferentes" não provaria nada — bastaria o canvas tremer sozinho.
 */
async function faixaEstavel(page: Page): Promise<Foto> {
  await page.waitForTimeout(PINTURA_MS)
  const primeira = await fotoDaFaixa(page)
  await page.waitForTimeout(PINTURA_MS)
  const segunda = await fotoDaFaixa(page)
  expect(
    primeira.equals(segunda),
    'a faixa do mapa muda sozinha parada: nenhuma comparação de fotos provaria o que aparece durante o arrasto',
  ).toBe(true)
  return segunda
}

test('CONTROLE POSITIVO: a ferramenta Medir mostra a medida durante o arrasto, ela muda com a distância e some ao soltar', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  // Sem isto, as coordenadas desta jornada cairiam fora do desenho e a leitura
  // de foto não significaria nada.
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: a faixa desta jornada (até x=1160, y=760) não cabe nele`,
  ).toBeGreaterThan(600)

  await ferramenta(page, 'Medir')
  const vazio = await faixaEstavel(page)

  // PROVA 1 do controle — segurando, aparece a medida.
  await segurarAte(page, LONGE, DESTINO)
  const medindoLongo = await fotoDaFaixa(page)
  expect(
    medindoLongo.equals(vazio),
    `a régua não desenhou nada segurando de (${LONGE.x}, ${LONGE.y}) até (${DESTINO.x}, ${DESTINO.y}): a foto da faixa é cega para o que aparece durante o gesto`,
  ).toBe(false)

  // PROVA 3 do controle — ao soltar, some.
  await soltar(page)
  expect(
    (await fotoDaFaixa(page)).equals(vazio),
    'a régua ficou grudada na tela depois de soltar: a foto da faixa não serve para provar que algo SOME',
  ).toBe(true)

  // PROVA 2 do controle — o que aparece depende da distância percorrida.
  await segurarAte(page, PERTO, DESTINO)
  const medindoCurto = await fotoDaFaixa(page)
  expect(
    medindoLongo.equals(medindoCurto),
    `a régua desenha a mesma coisa para ${QUADRADOS_DO_ARRASTO_LONGO} quadrados e para 1, terminando no mesmo ponto: a foto da faixa não distingue distância`,
  ).toBe(false)
  await soltar(page)

  expect(erros, 'o editor jogou erro durante a medição').toEqual([])
})

test('arrastar a ficha mostra quantos quadrados ela andou enquanto o botão está apertado, e o número some ao soltar', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  await ferramenta(page, 'Selecionar')
  await colocarFicha(page, 'Pe')

  // A ficha nasce no centro da vista; daqui ela vai para o começo do corredor.
  await arrastarComoPessoa(page, ONDE_A_FICHA_NASCE, LONGE)
  await faixaEstavel(page)

  // ------------------------------------------------------------------
  // ARRASTO LONGO — 5 quadrados até o destino.
  // ------------------------------------------------------------------
  await segurarAte(page, LONGE, DESTINO)
  const segurandoLongo = await fotoDaFaixa(page)
  await soltar(page)
  const soltoDepoisDoLongo = await fotoDaFaixa(page)

  // ------------------------------------------------------------------
  // ARRASTO CURTO — a ficha sai um quadrado e volta ao MESMO destino.
  // ------------------------------------------------------------------
  await arrastarComoPessoa(page, DESTINO, PERTO)
  await segurarAte(page, PERTO, DESTINO)
  const segurandoCurto = await fotoDaFaixa(page)
  await soltar(page)
  const soltoDepoisDoCurto = await fotoDaFaixa(page)

  // ------------------------------------------------------------------
  // PROVA 3 (e calibração das outras duas) — soltas, as duas telas são a MESMA.
  // A ficha assentou na mesma célula nas duas vezes, com a mesma seleção; então
  // qualquer diferença entre as fotos SEGURANDO é conteúdo do arrasto, não
  // posição da peça. E nada de "5 quadrados" nem de "1 quadrado" ficou na tela.
  // ------------------------------------------------------------------
  expect(
    soltoDepoisDoLongo.equals(soltoDepoisDoCurto),
    `depois de soltar no MESMO destino (${DESTINO.x}, ${DESTINO.y}), a tela do arrasto de ${QUADRADOS_DO_ARRASTO_LONGO} quadrados ficou diferente da do arrasto de 1: ou a ficha não assentou no mesmo lugar, ou o número continuou na tela depois de soltar`,
  ).toBe(true)

  // ------------------------------------------------------------------
  // PROVA 1 — segurando, a tela mostra algo que não está lá depois de soltar.
  // ------------------------------------------------------------------
  expect(
    segurandoLongo.equals(soltoDepoisDoLongo),
    `com a ficha segurada em cima de (${DESTINO.x}, ${DESTINO.y}), depois de andar ${QUADRADOS_DO_ARRASTO_LONGO} quadrados, a tela está IDÊNTICA à de depois de soltar: nenhum número de quadrados percorridos apareceu durante o arrasto`,
  ).toBe(false)

  // ------------------------------------------------------------------
  // PROVA 2 — o que aparece depende de quantos quadrados a ficha andou.
  // ------------------------------------------------------------------
  expect(
    segurandoLongo.equals(segurandoCurto),
    `segurando no mesmo destino, o arrasto de ${QUADRADOS_DO_ARRASTO_LONGO} quadrados desenha exatamente a mesma coisa que o de 1: o que aparece durante o arrasto não conta quadrados`,
  ).toBe(false)

  expect(erros, 'o editor jogou erro ao arrastar a ficha').toEqual([])
})
