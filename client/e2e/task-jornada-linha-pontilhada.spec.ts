// JORNADA VERMELHA — "passagem secreta e limite sugerido são linha
// PONTILHADA; aqui toda linha sai inteiriça".
//
// Escrita ANTES da feature existir. Nada de produção é tocado aqui.
//
// A DOR. Quem desenha mapa de masmorra usa o traço interrompido para dizer
// "isto é sugestão, não é parede": passagem secreta, limite de área, trilha.
// No app, o único lugar com traço interrompido é a GRADE
// (`src/components/GridControls.tsx:8`, "Tracejada") — e a grade não desenha
// passagem secreta nenhuma. O traço de desenho tem Cor, Espessura,
// Preenchimento (`src/components/DrawingStyleControls.tsx`) e Ponta
// arredondada/reta/quadrada (`src/components/LineCapControls.tsx:3-7`); a
// parede tem Espessura, Grossura e "Ponta e canto"
// (`src/components/WallStyleControls.tsx`). Nenhum dos dois tem estilo de
// TRAÇO, então tudo sai contínuo.
//
// O CONTRATO QUE ESTA JORNADA COBRA: com uma ferramenta de linha ativa, o
// painel oferece o estilo "Pontilhada" ao lado dos controles de traço, e a
// linha desenhada depois disso sai INTERROMPIDA na tela — não é a mesma
// linha cheia de sempre, nem uma linha que sumiu.
//
// COMO ELA PROVA. Régua de pixel em cima da linha: uma faixa de 1 px de
// altura é fotografada ao longo do traço, o PNG é decodificado pelo próprio
// navegador e cada amostra vira "tinta" ou "fundo". Traço contínuo = tinta em
// todas as amostras, zero vãos. Traço pontilhado = tinta e fundo alternando,
// com vários vãos, e ainda assim tinta em boa parte do caminho (senão seria
// linha que não foi desenhada). A store nunca é lida nem escrita.
//
// CONTROLE POSITIVO (teste 1): a MESMA régua, na linha que o app desenha
// hoje, tem de dizer "contínua, zero vãos". É o que separa "a feature não
// existe" de "a régua não sabe medir" — e continua verde depois da feature
// pronta, porque o estilo contínuo vai seguir sendo o padrão.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`). */
const COR_DO_FUNDO = { r: 0x2b, g: 0x2b, b: 0x2b }
/** Cor gritante para a linha: separa tinta de fundo sem depender de nuance. */
const COR_DA_LINHA = '#ff3b30'
/** Distância por canal a partir da qual o pixel conta como tinta da linha. */
const LIMIAR_DE_TINTA = 60

const PINTURA_MS = 300
const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PASSOS_DO_ARRASTO = 14

/** A linha vai daqui até ali, em px de tela relativos ao canvas — bem à
 *  direita do painel (que cobre o canvas até x~240) e longe das bordas. */
const INICIO = { x: 420, y: 380 }
const FIM = { x: 900, y: 380 }
/** Onde a régua percorre: só o miolo, sem as pontas (cap arredondado). */
const MEDIR_DE = INICIO.x + 30
const MEDIR_ATE = FIM.x - 30
/** Canto para onde o ponteiro sai antes de fotografar. */
const LONGE = { x: 1180, y: 120 }

/** Vão mínimo, em px, para contar como interrupção — 1 px isolado é antialias. */
const VAO_MINIMO_PX = 2
/** Quantas interrupções um traço pontilhado precisa ter no miolo medido. */
const VAOS_ESPERADOS = 3

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

interface LeituraDoTraco {
  /** Fração das amostras com tinta, de 0 a 1. */
  fracaoComTinta: number
  /** Quantas interrupções de pelo menos `VAO_MINIMO_PX` o traço tem. */
  vaos: number
  /** Desenho do que a régua viu, para a mensagem de falha (`#` tinta, `.` fundo). */
  mapa: string
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
 * Lê uma fileira de pixels de 1 px de altura direto da TELA: fotografa,
 * decodifica o PNG com o decodificador do próprio navegador e devolve o RGB
 * de cada coluna. Só leitura — nenhum estado do app é tocado.
 */
async function fileiraDePixels(page: Page, y: number, de: number, ate: number): Promise<Rgb[]> {
  const canvas = await caixaDoCanvas(page)
  const largura = Math.round(ate - de)
  const foto: Foto = await page.screenshot({
    clip: { x: Math.round(canvas.x + de), y: Math.round(canvas.y + y), width: largura, height: 1 },
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
    const { data } = ctx.getImageData(0, 0, bitmap.width, 1)
    const cores: Array<{ r: number; g: number; b: number }> = []
    for (let i = 0; i < data.length; i += 4) cores.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    return cores
  }, foto.toString('base64'))
}

/** Percorre o traço e conta tinta, fundo e interrupções. */
async function lerOTraco(page: Page, y: number): Promise<LeituraDoTraco> {
  const cores = await fileiraDePixels(page, y, MEDIR_DE, MEDIR_ATE)
  const temTinta = cores.map((cor) => distancia(cor, COR_DO_FUNDO) >= LIMIAR_DE_TINTA)

  let vaos = 0
  let corrida = 0
  for (const tinta of temTinta) {
    if (tinta) {
      if (corrida >= VAO_MINIMO_PX) vaos += 1
      corrida = 0
    } else {
      corrida += 1
    }
  }
  if (corrida >= VAO_MINIMO_PX) vaos += 1

  return {
    fracaoComTinta: temTinta.filter(Boolean).length / temTinta.length,
    vaos,
    mapa: temTinta.map((tinta) => (tinta ? '#' : '.')).join(''),
  }
}

/** Tira o ponteiro e qualquer rascunho da frente antes de medir. */
async function limparAVista(page: Page): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await page.keyboard.press('Escape')
  await page.mouse.move(canvas.x + LONGE.x, canvas.y + LONGE.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Arrasto de ponteiro de verdade: desce, anda em passos, PAUSA, sobe. */
async function arrastar(page: Page, de: Ponto, ate: Ponto): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await page.mouse.move(canvas.x + de.x, canvas.y + de.y)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(canvas.x + de.x + (ate.x - de.x) * t, canvas.y + de.y + (ate.y - de.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Deixa a linha gritante e grossa o bastante para a régua não depender de nuance. */
async function ajustarOTraco(page: Page): Promise<void> {
  await page.locator('#lb-draw-color').fill(COR_DA_LINHA)
  await page.locator('#lb-draw-width').fill('7')
  await page.waitForTimeout(PINTURA_MS)
}

/**
 * As seções do painel onde mora o estilo do traço: a que tem a Cor do desenho
 * e a da Ponta da linha. A grade fica DE FORA de propósito — ela já tem
 * "Tracejada" (`GridControls.tsx:8`) e tracejar a grade não desenha passagem
 * secreta nenhuma.
 */
function secoesDoTraco(page: Page): Locator {
  return page
    .locator('section')
    .filter({ has: page.locator('#lb-draw-color') })
    .or(page.locator('section').filter({ has: page.getByText('Ponta da linha', { exact: true }) }))
}

/** Todo nome acessível de controle na tela — só para a mensagem de falha
 *  ajudar quem for implementar. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], option')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('CONTROLE POSITIVO: a ferramenta Linha existe e a régua confirma que o traço de hoje sai CONTÍNUO, sem nenhum vão', async ({
  page,
}) => {
  await pickTool(page, 'Linha')
  await ajustarOTraco(page)
  await arrastar(page, INICIO, FIM)
  await limparAVista(page)

  const traco = await lerOTraco(page, INICIO.y)
  expect(traco.fracaoComTinta, `a régua não achou a linha desenhada: ${traco.mapa}`).toBeGreaterThan(0.9)
  expect(traco.vaos, `a régua viu buraco numa linha que hoje é contínua — ela está medindo errado: ${traco.mapa}`).toBe(0)
})

test('escolher "Pontilhada" no painel e desenhar dá um traço INTERROMPIDO na tela, não a mesma linha inteiriça de sempre', async ({
  page,
}, testInfo) => {
  await pickTool(page, 'Linha')
  await ajustarOTraco(page)

  const pontilhada = secoesDoTraco(page)
    .getByRole('radio', { name: /pontilhad|tracejad/i })
    .or(secoesDoTraco(page).getByRole('button', { name: /pontilhad|tracejad/i }))
    .or(secoesDoTraco(page).getByRole('option', { name: /pontilhad|tracejad/i }))

  if ((await pontilhada.count()) === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(
      0,
      `com a ferramenta Linha ativa, o painel não oferece estilo de traço pontilhado: só dá para mudar Cor, Espessura e Ponta, então passagem secreta e limite sugerido saem iguais a uma linha de verdade. O que a tela oferece hoje: ${existentes.join(' | ')}`,
    ).toBeGreaterThan(0)
  }
  await pontilhada.first().click()
  await page.waitForTimeout(PINTURA_MS)

  await arrastar(page, INICIO, FIM)
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('linha-pontilhada.png') })

  const traco = await lerOTraco(page, INICIO.y)
  expect(
    traco.vaos,
    `o traço saiu sem interrupção depois de escolher o estilo pontilhado — na tela ele é a mesma linha cheia de sempre: ${traco.mapa}`,
  ).toBeGreaterThanOrEqual(VAOS_ESPERADOS)
  expect(
    traco.fracaoComTinta,
    `sobrou tinta demais: um pontilhado tem mais fundo que isso entre os pontos (${Math.round(traco.fracaoComTinta * 100)}% do caminho com tinta): ${traco.mapa}`,
  ).toBeLessThan(0.85)
  expect(
    traco.fracaoComTinta,
    `a linha praticamente sumiu em vez de virar pontilhada (${Math.round(traco.fracaoComTinta * 100)}% do caminho com tinta): ${traco.mapa}`,
  ).toBeGreaterThan(0.15)
})
