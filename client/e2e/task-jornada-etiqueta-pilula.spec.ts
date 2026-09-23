// JORNADA VERMELHA — "o nome da sala some quando o chão é claro".
//
// Escrita ANTES da feature existir. Nada de produção é tocado aqui.
//
// A DOR. O nome da sala é desenhado em BRANCO FIXO com um fiozinho escuro em
// volta (`src/pixi/drawRoomNames.ts:20-21`: `LABEL_FILL = 0xffffff`,
// `LABEL_STROKE = 0x111111`) — e nada mais. Sobre chão escuro isso lê bem;
// sobre chão claro (pedra clara, areia, papel) o branco encosta no branco e
// sobra só o contorno de 1 px para segurar a leitura. Como a cor do chão da
// sala é escolhida pelo mestre (`#lb-region-color`), a legibilidade do nome
// hoje depende de ele escolher uma cor escura.
//
// O CONTRATO QUE ESTA JORNADA COBRA: o nome vem numa ETIQUETA EM PÍLULA, com
// um fundo discreto atrás das letras. Consequências observáveis, que é o que
// se mede aqui:
//   1. as letras contrastam com o que está atrás delas (≥ 4.5:1, o mínimo da
//      WCAG 2.2 para texto normal) nas duas salas — guarda de legibilidade;
//   2. existe etiqueta: o que está atrás das letras NÃO é o chão da sala —
//      as duas luminâncias se separam, nas duas salas;
//   3. é a MESMA etiqueta nas duas: o fundo do nome quase não muda entre o
//      chão claro e o escuro. Sem esta terceira, um contorno mais gordo
//      passaria como pílula.
//
// POR QUE A (1) SOZINHA NÃO BASTA. Medida rodada em 20/09/2026 no código de
// hoje: sobre o chão claro o nome já "passa" em contraste, porque o fiozinho
// preto de 1 px em volta da letra contrasta com o branco. O olho lê mal do
// mesmo jeito — o que falta é fundo atrás do texto, e isso quem mede são a
// (2) e a (3).
//
// COMO ELA PROVA. Régua de pixel: um retângulo em volta do nome é
// fotografado, o PNG é decodificado pelo próprio navegador, e de cada caixa
// saem duas luminâncias relativas (fórmula da WCAG) — a MEDIANA, que é o que
// está atrás das letras, e a do pixel mais distante dela, que são as letras.
// O chão da sala é lido à parte, num ponto dentro da sala e longe do nome. A
// store nunca é lida nem escrita: a sala nasce de arrasto, o nome de
// digitação, a cor de um clique no swatch.
//
// CONTROLE POSITIVO (teste 1): com UMA sala clara, a mesma régua tem de (a)
// ver a cor escolhida no chão da sala longe do nome e (b) achar tinta do nome
// no meio dela. Sem isso, um vermelho lá embaixo poderia ser sala que não
// nasceu, cor que não pegou ou nome que nunca foi desenhado. As duas
// afirmações continuam verdadeiras depois da pílula pronta.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`). */
const COR_DO_FUNDO = { r: 0x2b, g: 0x2b, b: 0x2b }
/** Chão claro de pedra/areia e chão escuro de cripta: os dois extremos que o
 *  mestre escolhe no `#lb-region-color`. */
const CHAO_CLARO = '#efe6d2'
const CHAO_ESCURO = '#1d2026'

/** Mínimo da WCAG 2.2 (critério 1.4.3) para texto normal. */
const CONTRASTE_MINIMO = 4.5
/** Quanto a luminância do fundo do nome pode variar entre as duas salas e
 *  ainda contar como "a mesma pílula". */
const VARIACAO_DE_FUNDO_TOLERADA = 0.1
/** O quanto o fundo do nome precisa se separar do chão da sala para haver
 *  etiqueta: abaixo disso o que está atrás das letras É o chão. */
const SEPARACAO_MINIMA_DO_CHAO = 0.15

const PINTURA_MS = 300
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 10

/** Salas em coordenadas múltiplas da grade (64 px), bem à direita do painel
 *  (que cobre o canvas até x~240) e dentro da janela de 1280×800. */
const SALA_CLARA = { x0: 384, y0: 256, x1: 640, y1: 384 }
const SALA_ESCURA = { x0: 704, y0: 512, x1: 960, y1: 640 }
/** Ponto dentro de cada sala, longe do nome: serve para selecionar e para
 *  conferir a cor do chão. */
const DENTRO_DA_CLARA = { x: 410, y: 284 }
const DENTRO_DA_ESCURA = { x: 730, y: 540 }
/** Ponto vazio do mapa, para tirar a seleção antes de fotografar. */
const VAZIO = { x: 1150, y: 730 }
/** Canto para onde o ponteiro sai antes de fotografar. */
const LONGE = { x: 1180, y: 120 }

/** Caixa em volta do nome, centrada na âncora da sala (o centróide, quando
 *  ninguém arrastou o rótulo — `drawRoomNames.roomLabelPosition`). */
const CAIXA_DO_NOME = { largura: 140, altura: 34 }

const NOME_DA_CLARA = 'Cripta'
const NOME_DA_ESCURA = 'Adega'

interface Rgb {
  r: number
  g: number
  b: number
}

interface Ponto {
  x: number
  y: number
}

interface Retangulo {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** O que a régua extrai da caixa do nome, em luminância relativa da WCAG. */
interface LeituraDoNome {
  /** Luminância do que está ATRÁS das letras (mediana da caixa). */
  fundo: number
  /** Luminância das LETRAS (o pixel mais distante da mediana). */
  tinta: number
  /** Razão de contraste WCAG entre as duas. */
  contraste: number
}

/** O que `page.screenshot()` devolve — sem @types/node no tsconfig dos e2e,
 *  o tipo do buffer vem da própria API do Playwright. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

function canal(valor: number): number {
  const c = valor / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** Luminância relativa da WCAG 2.2 (0 = preto, 1 = branco). */
function luminancia(cor: Rgb): number {
  return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b)
}

function contraste(a: number, b: number): number {
  const claro = Math.max(a, b)
  const escuro = Math.min(a, b)
  return (claro + 0.05) / (escuro + 0.05)
}

function distancia(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

function comoTexto(cor: Rgb): string {
  return `rgb(${cor.r}, ${cor.g}, ${cor.b})`
}

function centro(sala: Retangulo): Ponto {
  return { x: (sala.x0 + sala.x1) / 2, y: (sala.y0 + sala.y1) / 2 }
}

async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { x: caixa.x, y: caixa.y }
}

/**
 * Lê um retângulo de pixels direto da TELA: fotografa, decodifica o PNG com o
 * decodificador do próprio navegador e devolve o RGB de cada pixel. Só
 * leitura — nenhum estado do app é tocado.
 */
async function pixels(page: Page, x: number, y: number, largura: number, altura: number): Promise<Rgb[]> {
  const canvas = await caixaDoCanvas(page)
  const foto: Foto = await page.screenshot({
    clip: { x: Math.round(canvas.x + x), y: Math.round(canvas.y + y), width: largura, height: altura },
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
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    const cores: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < data.length; i += 4) cores.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    return cores
  }, foto.toString('base64'))
}

async function corNaTela(page: Page, ponto: Ponto): Promise<Rgb> {
  const [cor] = await pixels(page, ponto.x, ponto.y, 1, 1)
  return cor
}

/** Mede o nome de uma sala: o que está atrás das letras, as letras, e o
 *  contraste entre os dois. */
async function medirONome(page: Page, sala: Retangulo): Promise<LeituraDoNome> {
  const meio = centro(sala)
  const cores = await pixels(
    page,
    meio.x - CAIXA_DO_NOME.largura / 2,
    meio.y - CAIXA_DO_NOME.altura / 2,
    CAIXA_DO_NOME.largura,
    CAIXA_DO_NOME.altura,
  )
  const luzes = cores.map(luminancia).sort((a, b) => a - b)
  const fundo = luzes[Math.floor(luzes.length / 2)]
  const maisEscuro = luzes[0]
  const maisClaro = luzes[luzes.length - 1]
  const tinta = Math.abs(maisClaro - fundo) >= Math.abs(fundo - maisEscuro) ? maisClaro : maisEscuro
  return { fundo, tinta, contraste: contraste(tinta, fundo) }
}

/** Tira o ponteiro e a seleção da frente antes de medir. */
async function limparAVista(page: Page): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await pickTool(page, 'Selecionar')
  await clicarComoPessoa(page, VAZIO)
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

/** Desenha a sala arrastando e batiza pelo campo que aparece sobre o mapa. */
async function criarSala(page: Page, sala: Retangulo, nome: string): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await pickTool(page, 'Sala')
  await page.mouse.move(canvas.x + sala.x0, canvas.y + sala.y0)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(canvas.x + sala.x0 + (sala.x1 - sala.x0) * t, canvas.y + sala.y0 + (sala.y1 - sala.y0) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()

  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(campo, 'desenhar a sala tinha de abrir o campo do nome sobre o mapa').toBeFocused()
  await page.keyboard.type(nome)
  await page.keyboard.press('Enter')
  await expect(campo).toHaveCount(0)
  await page.waitForTimeout(PINTURA_MS)
}

/** Seleciona a sala pelo chão dela e pinta com a cor escolhida no painel. */
async function pintarOChao(page: Page, dentro: Ponto, hex: string): Promise<void> {
  await pickTool(page, 'Selecionar')
  await clicarComoPessoa(page, dentro)
  const swatch = page.locator('#lb-region-color')
  await expect(swatch, 'com a sala selecionada o painel tinha de oferecer a cor do chão dela').toBeVisible({
    timeout: 5_000,
  })
  await swatch.fill(hex)
  await page.waitForTimeout(PINTURA_MS)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('CONTROLE POSITIVO: a sala nasce do arrasto, aceita o nome digitado, o chão fica com a cor escolhida e a régua acha a tinta do nome no meio dela', async ({
  page,
}) => {
  await criarSala(page, SALA_CLARA, NOME_DA_CLARA)
  await pintarOChao(page, DENTRO_DA_CLARA, CHAO_CLARO)
  await limparAVista(page)

  // (a) o chão da sala, longe do nome, é a cor escolhida — e não o fundo do mapa.
  const chao = await corNaTela(page, DENTRO_DA_CLARA)
  expect(
    distancia(chao, COR_DO_FUNDO),
    `o chão da sala continua igual ao fundo do mapa (${comoTexto(chao)}): a cor escolhida não chegou à tela`,
  ).toBeGreaterThan(40)

  // (b) tem tinta de nome no meio da sala: a caixa não é uma mancha lisa.
  const nome = await medirONome(page, SALA_CLARA)
  expect(
    Math.abs(nome.tinta - nome.fundo),
    'a régua não achou nenhuma letra no meio da sala — o nome não foi desenhado, ou a caixa está no lugar errado',
  ).toBeGreaterThan(0.05)
})

test('o nome da sala continua legível sobre chão claro E sobre chão escuro: é a etiqueta em pílula que fica atrás das letras, não o chão', async ({
  page,
}, testInfo) => {
  await criarSala(page, SALA_CLARA, NOME_DA_CLARA)
  await criarSala(page, SALA_ESCURA, NOME_DA_ESCURA)
  await pintarOChao(page, DENTRO_DA_CLARA, CHAO_CLARO)
  await pintarOChao(page, DENTRO_DA_ESCURA, CHAO_ESCURO)
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('etiqueta-nos-dois-chaos.png') })

  const naClara = await medirONome(page, SALA_CLARA)
  const naEscura = await medirONome(page, SALA_ESCURA)
  const chaoClaro = luminancia(await corNaTela(page, DENTRO_DA_CLARA))
  const chaoEscuro = luminancia(await corNaTela(page, DENTRO_DA_ESCURA))

  expect(
    naClara.contraste,
    `sobre o chão claro ${CHAO_CLARO} o nome "${NOME_DA_CLARA}" sai com contraste ${naClara.contraste.toFixed(2)}:1 (mínimo ${CONTRASTE_MINIMO}:1) — letra branca sobre fundo claro, sem nenhuma etiqueta atrás`,
  ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO)
  expect(
    naEscura.contraste,
    `sobre o chão escuro ${CHAO_ESCURO} o nome "${NOME_DA_ESCURA}" sai com contraste ${naEscura.contraste.toFixed(2)}:1 (mínimo ${CONTRASTE_MINIMO}:1)`,
  ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO)

  // EXISTE ETIQUETA: o que está atrás das letras não pode ser o chão da sala.
  expect(
    Math.abs(naClara.fundo - chaoClaro),
    `na sala de chão claro, o que está atrás do nome "${NOME_DA_CLARA}" (${naClara.fundo.toFixed(2)}) é o próprio chão (${chaoClaro.toFixed(2)}): não há etiqueta nenhuma sob as letras`,
  ).toBeGreaterThanOrEqual(SEPARACAO_MINIMA_DO_CHAO)
  expect(
    Math.abs(naEscura.fundo - chaoEscuro),
    `na sala de chão escuro, o que está atrás do nome "${NOME_DA_ESCURA}" (${naEscura.fundo.toFixed(2)}) é o próprio chão (${chaoEscuro.toFixed(2)}): não há etiqueta nenhuma sob as letras`,
  ).toBeGreaterThanOrEqual(SEPARACAO_MINIMA_DO_CHAO)

  // A prova de que é PÍLULA e não sorte da cor do chão: o que está atrás das
  // letras é o mesmo nos dois, apesar de os chãos serem opostos.
  expect(
    Math.abs(naClara.fundo - naEscura.fundo),
    `o que está atrás do nome muda junto com o chão (${naClara.fundo.toFixed(2)} na sala clara contra ${naEscura.fundo.toFixed(2)} na escura): não existe etiqueta, o nome está solto em cima do chão`,
  ).toBeLessThanOrEqual(VARIACAO_DE_FUNDO_TOLERADA)
})
