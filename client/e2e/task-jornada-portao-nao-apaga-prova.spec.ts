// JORNADA DO PORTÃO — "rodar uma jornada não pode escrever dentro do
// repositório, nem apagar a prova da corrida anterior".
//
// POR QUE ESTE ARQUIVO EXISTE. O Playwright LIMPA o `outputDir` inteiro no
// começo de cada invocação: screenshot de falha, trace e error-context da
// corrida anterior somem antes de alguém olhar. O `playwright.config.ts` já
// tratava disso para quem roda PELO PORTÃO (`PORTAO_ARTEFATOS`, uma pasta por
// passo em %TEMP%), e só para esse caminho — o `else` era `./test-results`,
// dentro de `client/`. Quem roda o comando declarado de uma jornada na mão
// (`npx playwright test e2e/task-jornada-x.spec.ts`, que é como as jornadas
// desta noite foram declaradas) caía no `else`: duas jornadas em sequência, e
// a prova da primeira era apagada ao começar a segunda. O mesmo bug que o
// portão dizia ter consertado, mas só para si mesmo.
//
// O CONTRATO QUE ESTA JORNADA COBRA: seja qual for o caminho (pelo portão ou
// pela mão), a pasta em que esta corrida escreve a prova está FORA da árvore
// do cliente. Nada do repositório é tocado por rodar teste.
//
// COMO ELA PROVA. `test.info().outputDir` é o caminho ABSOLUTO em que o
// Playwright vai gravar screenshot, trace e anexo desta corrida, e
// `test.info().project.testDir` é o caminho absoluto de `client/e2e` — os dois
// vêm do runtime, não de uma string digitada aqui. Se o primeiro estiver
// dentro do segundo (menos o `/e2e`), a prova está no repositório.
//
// CONTROLE POSITIVO (teste 1): antes de afirmar qualquer coisa sobre pasta, a
// jornada prova que o APP responde a gesto de gente — ferramenta escolhida na
// barra, ponteiro que desce, anda, pausa e sobe, e régua de pixel lendo a
// linha na TELA. Sem isso, uma asserção sobre caminho de arquivo passaria com
// o editor morto, que é exatamente o tipo de verde que este portão recusa.
import { test, expect, type Page } from '@playwright/test'
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

/** A linha vai daqui até ali, em px de tela relativos ao canvas — à direita do
 *  painel (que cobre o canvas até x~240) e longe das bordas. */
const INICIO = { x: 420, y: 380 }
const FIM = { x: 900, y: 380 }
/** Onde a régua percorre: só o miolo, sem as pontas (cap arredondado). */
const MEDIR_DE = INICIO.x + 30
const MEDIR_ATE = FIM.x - 30
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
 * decodifica o PNG com o decodificador do próprio navegador e devolve o RGB de
 * cada coluna. Só leitura — nenhum estado do app é tocado.
 */
async function fileiraDePixels(page: Page, y: number, de: number, ate: number): Promise<Rgb[]> {
  const canvas = await caixaDoCanvas(page)
  const foto: Foto = await page.screenshot({
    clip: { x: Math.round(canvas.x + de), y: Math.round(canvas.y + y), width: Math.round(ate - de), height: 1 },
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

/** Quantas colunas do miolo têm tinta — a prova de que o traço chegou à tela. */
async function colunasComTinta(page: Page, y: number): Promise<number> {
  const cores = await fileiraDePixels(page, y, MEDIR_DE, MEDIR_ATE)
  return cores.filter((cor) => distancia(cor, COR_DO_FUNDO) >= LIMIAR_DE_TINTA).length
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

/** Tira o ponteiro e qualquer rascunho da frente antes de medir. */
async function limparAVista(page: Page): Promise<void> {
  const canvas = await caixaDoCanvas(page)
  await page.keyboard.press('Escape')
  await page.mouse.move(canvas.x + LONGE.x, canvas.y + LONGE.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Deixa a linha gritante e grossa o bastante para a régua não depender de nuance. */
async function ajustarOTraco(page: Page): Promise<void> {
  await page.locator('#lb-draw-color').fill(COR_DA_LINHA)
  await page.locator('#lb-draw-width').fill('7')
  await page.waitForTimeout(PINTURA_MS)
}

/** A raiz do CLIENTE, deduzida do caminho que o próprio runner declara para os
 *  testes (`<raiz>/client/e2e`). Nada digitado à mão: em worktree o caminho
 *  muda, e um literal daria verde na árvore errada. */
function raizDoCliente(): string {
  return test.info().project.testDir.replace(/[\\/]e2e[\\/]?$/, '')
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('CONTROLE POSITIVO: o editor abre pelo menu, a barra traz a ferramenta Linha e o arrasto de ponteiro deixa tinta na tela', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toBeVisible()
  await pickTool(page, 'Linha')
  await ajustarOTraco(page)
  await arrastar(page, INICIO, FIM)
  await limparAVista(page)

  const tinta = await colunasComTinta(page, INICIO.y)
  expect(tinta, 'a régua não achou a linha desenhada pelo ponteiro: o gesto não chegou ao app').toBeGreaterThan(
    Math.round((MEDIR_ATE - MEDIR_DE) * 0.9),
  )
})

test('a prova desta corrida é escrita FORA do repositório: rodar jornada não mexe em arquivo do projeto', async ({ page }) => {
  // O mesmo gesto do controle positivo, para a afirmação sobre a pasta valer
  // sobre uma corrida que REALMENTE desenhou alguma coisa — e não sobre um
  // editor que nunca abriu.
  await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toBeVisible()
  await pickTool(page, 'Linha')
  await ajustarOTraco(page)
  await arrastar(page, INICIO, FIM)

  const pastaDaProva = test.info().outputDir
  const cliente = raizDoCliente()
  // Controle positivo da própria régua: caminho vazio aprovaria qualquer coisa.
  expect(pastaDaProva.length, 'o runner não declarou pasta de artefato nenhuma').toBeGreaterThan(0)
  expect(cliente.length, 'não deu para deduzir a raiz do cliente a partir de project.testDir').toBeGreaterThan(0)
  // E o controle NEGATIVO, que é o contrato: a pasta não pode morar no cliente.
  expect(
    pastaDaProva.toLowerCase().startsWith(cliente.toLowerCase()),
    `a prova desta corrida está DENTRO do repositório (${pastaDaProva}), e a próxima invocação vai apagá-la`,
  ).toBe(false)
})
