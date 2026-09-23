// JORNADA "DUPLO CLIQUE FECHA A FORMA" — escrita para SAIR VERMELHA hoje.
//
// A dica na tela da ferramenta Polígono promete, com todas as letras: "Clique
// para adicionar vértice. Duplo clique fecha (mín. 3 pontos). Esc cancela."
// (`components/labels.ts:101`, desenhada em `components/Toolbar.tsx:525`). A
// Sala livre e o Corredor de chão prometem o mesmo (`labels.ts:92` e `:107`).
//
// O que acontece hoje (achado 3 do passeio de 20/09/2026,
// `docs/passeio-2026-09-20.md`): o app não tem gesto de duplo clique próprio —
// ele escuta o evento `dblclick` do navegador e mais nada
// (`pixi/PixiCanvas.tsx:4492`). O Chromium só emite `dblclick` quando os dois
// cliques caem dentro de uma janela FIXA de ~500 ms, e essa janela não é a da
// pessoa: no Windows, a velocidade do duplo clique é uma régua do sistema que
// vai até perto de 900 ms, e quem a deixou lenta — ou quem simplesmente mira
// com calma no último vértice antes de bater de novo — clica duas vezes no
// mesmo ponto e NÃO fecha nada. Sem aviso, sem forma, sem nada: o segundo
// clique só acrescenta mais um vértice em cima do anterior. MEDIDO em
// 21/09/2026: dois toques no mesmo ponto com 700 ms entre eles deixam o
// rascunho aberto; o `dblclick` do navegador, logo em seguida, fecha.
//
// A convenção que o app quebra é a de todo editor ponto a ponto (Excalidraw):
// bater de novo no último ponto TERMINA o traçado — é o ponto, não o
// cronômetro, que diz "acabou".
//
// O QUE ESTA JORNADA COBRA, tudo no que APARECE NA TELA:
//   1. a dica visível promete que o duplo clique fecha;
//   2. depois de dois toques no último vértice, no ritmo de quem mira, o
//      desenho no primeiro vértice é o de uma forma FECHADA — e não mais a
//      bolinha amarela de rascunho aberto.
//
// COMO ELA COMPARA SEM SE ENGANAR. A jornada não afirma "mudou de cor". Ela
// colhe, no mesmo teste e com a mesma ferramenta, as DUAS cores possíveis
// daquele pixel — a do rascunho aberto e a da forma fechada — desenhando antes
// um polígono gêmeo e fechando-o pelo caminho que funciona (Enter). Depois
// prova que os dois pontos de partida desenham o rascunho igual. Só então cobra
// que o polígono fechado a dedo tenha chegado na cor de "fechado".
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Polígono de referência: nasce e fecha pelo Enter, para colher as duas cores. */
const REFERENCIA = [
  { x: 448, y: 256 },
  { x: 640, y: 256 },
  { x: 640, y: 384 },
]
/** Polígono do gesto julgado: mesma forma, 192 px abaixo. */
const JULGADO = [
  { x: 448, y: 448 },
  { x: 640, y: 448 },
  { x: 640, y: 576 },
]
/** Botão parado antes de soltar: é o que separa um toque de pessoa de um clique instantâneo. */
const TOQUE_MS = 160
/** Folga entre um vértice e o seguinte. */
const ENTRE_VERTICES_MS = 200
/**
 * O ritmo do duplo clique de quem mira. A régua "Velocidade do clique duplo"
 * do Windows vai de ~200 ms a ~900 ms; 700 ms cai dentro do que o sistema
 * operacional chama de duplo clique e fora dos ~500 ms fixos do Chromium.
 */
const ESPERA_ENTRE_OS_TOQUES_MS = 700
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 600
/** Quanto duas cores precisam distar para contar como "outro desenho". */
const MUDANCA_DE_COR = 24
/** Quanto duas cores podem distar e ainda contar como "o mesmo desenho". */
const MESMO_DESENHO = 12

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

interface Ponto {
  x: number
  y: number
}

interface Caixa {
  x: number
  y: number
  width: number
  height: number
}

type Cor = [number, number, number]

const distanciaCor = (a: Cor, b: Cor): number =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/**
 * Lê pixels da FOTO do canvas — o que o usuário vê —, decodificando o PNG no
 * próprio navegador num canvas 2D descartável. Só LEITURA: nada do app é
 * tocado (mesmo helper de `task-jornada-saida-sem-parede.spec.ts`).
 */
async function corEm(page: Page, ponto: Ponto): Promise<Cor> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const foto: Foto = await canvas.screenshot()
  return page.evaluate(
    async ({ b64, larguraCss, ponto }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const lona = document.createElement('canvas')
      lona.width = bmp.width
      lona.height = bmp.height
      const ctx = lona.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const i = (Math.round(ponto.y * escala) * width + Math.round(ponto.x * escala)) * 4
      return [data[i], data[i + 1], data[i + 2]] as [number, number, number]
    },
    { b64: foto.toString('base64'), larguraCss: caixa.width, ponto },
  )
}

/** Toque de pessoa: desce, fica parado um instante, sobe. */
async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
}

/** Põe o Polígono na mão pelo caminho da barra: setinha do grupo Desenho, opção Polígono. */
async function pegarPoligono(page: Page): Promise<void> {
  const barra = page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
  await barra.getByRole('button', { name: 'Opções de Desenho', exact: true }).click()
  const menu = page.getByRole('group', { name: 'Opções de Desenho' })
  await expect(menu, 'a setinha de Opções de Desenho não abriu o menu de formas').toBeVisible({ timeout: 5000 })
  await menu.getByRole('radio', { name: 'Polígono' }).click()
  await expect(
    barra.getByRole('button', { name: 'Desenho', exact: true }),
    'escolher Polígono no menu não deixou a ferramenta de desenho na mão',
  ).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(PINTURA_MS)
}

/** Clica os vértices, um a um, como quem desenha. */
async function cravarVertices(page: Page, caixa: Caixa, pontos: Ponto[]): Promise<void> {
  for (const ponto of pontos) {
    await tocarComoPessoa(page, caixa.x + ponto.x, caixa.y + ponto.y)
    await page.waitForTimeout(ENTRE_VERTICES_MS)
  }
  await page.waitForTimeout(PINTURA_MS)
}

test('CONTROLE POSITIVO: a dica promete o duplo clique, e o Enter realmente fecha o polígono', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: os pontos desta jornada não cabem nele`,
  ).toBeGreaterThan(600)

  await pegarPoligono(page)

  // A promessa, lida na tela antes de qualquer clique no mapa — a dica some no
  // primeiro `pointerdown` do canvas (`Toolbar.tsx:361`).
  await expect(
    page.locator('.lb-hint'),
    'a dica da ferramenta Polígono não está visível: não dá para cobrar uma promessa que a tela não faz',
  ).toContainText('Duplo clique fecha', { timeout: 5000 })

  const vazio = await corEm(page, REFERENCIA[0])
  await cravarVertices(page, caixa, REFERENCIA)

  const rascunho = await corEm(page, REFERENCIA[0])
  expect(
    distanciaCor(vazio, rascunho),
    `nada foi desenhado em (${REFERENCIA[0].x}, ${REFERENCIA[0].y}) depois de três cliques: a foto não enxerga rascunho nenhum`,
  ).toBeGreaterThan(MUDANCA_DE_COR)

  await page.keyboard.press('Enter')
  await page.waitForTimeout(PINTURA_MS)

  const fechado = await corEm(page, REFERENCIA[0])
  expect(
    distanciaCor(rascunho, fechado),
    `o Enter não mudou nada em (${REFERENCIA[0].x}, ${REFERENCIA[0].y}): rascunho=${rascunho.join(',')}, depois=${fechado.join(',')} — ` +
      'sem este contraste a jornada não teria como distinguir forma aberta de forma fechada',
  ).toBeGreaterThan(MUDANCA_DE_COR)

  expect(erros, 'o editor jogou erro ao desenhar e fechar o polígono pelo Enter').toEqual([])
})

test('dois toques no último vértice fecham a forma, como a dica da tela promete', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  await pegarPoligono(page)

  await expect(
    page.locator('.lb-hint'),
    'a dica da ferramenta Polígono não está visível: não dá para cobrar uma promessa que a tela não faz',
  ).toContainText('Duplo clique fecha', { timeout: 5000 })

  // ---------------------------------------------------------------------
  // AS DUAS CORES DAQUELE PIXEL, colhidas no próprio teste. Sem elas, "a cor
  // mudou" e "a cor não mudou" seriam as duas igualmente fáceis de forjar.
  // ---------------------------------------------------------------------
  await cravarVertices(page, caixa, REFERENCIA)
  const corDeRascunho = await corEm(page, REFERENCIA[0])
  await page.keyboard.press('Enter')
  await page.waitForTimeout(PINTURA_MS)
  const corDeFechado = await corEm(page, REFERENCIA[0])
  expect(
    distanciaCor(corDeRascunho, corDeFechado),
    `rascunho aberto e forma fechada desenham a mesma coisa em (${REFERENCIA[0].x}, ${REFERENCIA[0].y}) ` +
      `(${corDeRascunho.join(',')} x ${corDeFechado.join(',')}): esta jornada não teria como julgar nada`,
  ).toBeGreaterThan(MUDANCA_DE_COR)

  // ---------------------------------------------------------------------
  // CALIBRAÇÃO — o segundo polígono desenha o rascunho igual ao primeiro.
  // É o que autoriza comparar a cor de um ponto com a colhida no outro.
  // ---------------------------------------------------------------------
  await cravarVertices(page, caixa, JULGADO)
  const rascunhoJulgado = await corEm(page, JULGADO[0])
  expect(
    distanciaCor(rascunhoJulgado, corDeRascunho),
    `o rascunho do segundo polígono saiu com cor diferente do primeiro em (${JULGADO[0].x}, ${JULGADO[0].y}): ` +
      'a comparação entre os dois pontos não é confiável',
  ).toBeLessThanOrEqual(MESMO_DESENHO)

  // ---------------------------------------------------------------------
  // O GESTO JULGADO — dois toques no ÚLTIMO vértice, no ritmo de quem mira.
  // ---------------------------------------------------------------------
  const ultimo = JULGADO[JULGADO.length - 1]
  await tocarComoPessoa(page, caixa.x + ultimo.x, caixa.y + ultimo.y)
  await page.waitForTimeout(ESPERA_ENTRE_OS_TOQUES_MS)
  await tocarComoPessoa(page, caixa.x + ultimo.x, caixa.y + ultimo.y)
  await page.waitForTimeout(PINTURA_MS)

  const depoisDosToques = await corEm(page, JULGADO[0])

  // Diagnóstico colhido ANTES de julgar, só para a mensagem da falha poder
  // dizer se a forma seguia aberta ou se os toques fizeram outra coisa.
  await page.keyboard.press('Enter')
  await page.waitForTimeout(PINTURA_MS)
  const depoisDoEnter = await corEm(page, JULGADO[0])
  const oEnterAindaTinhaOQueFechar = distanciaCor(depoisDosToques, depoisDoEnter) > MUDANCA_DE_COR

  expect(
    distanciaCor(depoisDosToques, corDeFechado),
    `dois toques no último vértice (${ultimo.x}, ${ultimo.y}), com ${ESPERA_ENTRE_OS_TOQUES_MS} ms entre eles, não fecharam a forma: ` +
      `em (${JULGADO[0].x}, ${JULGADO[0].y}) a tela mostra ${depoisDosToques.join(',')}, e forma fechada é ${corDeFechado.join(',')} ` +
      `(rascunho aberto é ${corDeRascunho.join(',')}). ` +
      (oEnterAindaTinhaOQueFechar
        ? 'O Enter, dado logo depois, ainda tinha o que fechar — o rascunho seguia aberto e os dois toques não fizeram nada.'
        : 'O Enter, dado logo depois, também não mudou nada.'),
  ).toBeLessThanOrEqual(MESMO_DESENHO)

  expect(erros, 'o editor jogou erro ao tentar fechar a forma com dois toques').toEqual([])
})
