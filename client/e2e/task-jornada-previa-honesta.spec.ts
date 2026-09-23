// Jornada de usuário: "a prévia da tela de criação não pode mentir sobre o
// mapa que vai nascer".
//
// O usuário abre "Novo Dungeon Map", escolhe Quadrado, 30 x 20, 64 px, e a
// PRÉVIA à direita mostra a grade desenhada. Clica em "Criar mapa" e o editor
// abre com a área de desenho lisa: nenhuma linha de grade, nenhuma borda. Ele
// desenha no escuro, sem saber onde o mapa acaba.
//
// ESCOPO — esta jornada NÃO cobra que o mapa nasça COM grade. Mapa novo sem
// grade é decisão de estilo do projeto (minimapa do Resident Evil, comentário
// em src/lib/mapFactory.ts:26-28). O que ela cobra é COERÊNCIA: a prévia é um
// SVG separado (src/components/MapPreview.tsx:20-47) que desenha o padrão de
// grade sempre, sem olhar `showGrid`. Quem mente é a prévia, não o editor.
// Passar daqui é escolher um dos dois lados — prévia sem grade, ou mapa novo
// com grade —, nunca os dois ao mesmo tempo.
//
// Tudo é medido por PIXEL, nas duas telas, lendo a foto do que aparece: nada
// de store, nada de `showGrid` lido por evaluate. A régua é a mesma nos dois
// meios (SVG da prévia e canvas do editor) e tem controle positivo: antes de
// julgar, a jornada liga "Mostrar grade" no painel e exige que a régua acuse
// as linhas. Régua que não acusa nada com a grade ligada é régua cega, e aí o
// vermelho seria do teste, não do app.
import { test, expect, type Page, type Locator } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

/**
 * Diferença de luminância (0..255) contra a mediana da faixa que já conta como
 * "tem alguma linha desenhada aqui".
 *
 * Calibrado no app real em 17/09/2026: a grade do mapa novo é preto a 25% por
 * cima do fundo #2b2b2b (mapFactory.ts:33), o que dá luminância 43 no fundo e
 * 32 na linha — degrau de 11. O fundo sem grade é chapado (43 em todos os
 * pixels da faixa, desvio zero). 6 fica no meio: metade do degrau real e ainda
 * assim seis vezes o ruído medido. Na prévia o contraste é bem maior (48 de
 * fundo, 88+ na linha), então o mesmo número serve para os dois meios.
 */
const LIMIAR_LUZ = 6

/** Linhas separadas numa faixa a partir das quais se pode dizer "isto é grade". */
const LINHAS_MIN = 3

/** Faixa horizontal da área de desenho do editor, longe do painel da esquerda. */
const FAIXA_EDITOR = { eixo: 'h', fixo: 0.5, de: 0.32, ate: 0.94 } as const
/** Coluna da área de desenho, longe da barra de cima. x fora de múltiplo de 64
 *  de propósito: assim ela CRUZA as linhas horizontais em vez de deitar em cima
 *  de uma vertical. */
const COLUNA_EDITOR = { eixo: 'v', fixo: 0.53, de: 0.35, ate: 0.97 } as const
/** Miolo da prévia, longe da moldura e do vazio das bordas do SVG. */
const FAIXA_PREVIA = { eixo: 'h', fixo: 0.5, de: 0.2, ate: 0.8 } as const

interface Faixa {
  readonly eixo: 'h' | 'v'
  /** Posição da faixa no outro eixo, em fração do tamanho da foto. */
  readonly fixo: number
  readonly de: number
  readonly ate: number
}

/** O que `locator.screenshot()` devolve — `Buffer` não é tipo declarado no
 *  tsconfig dos e2e (sem @types/node), então o tipo vem da própria API. */
type Foto = Awaited<ReturnType<Locator['screenshot']>>

/**
 * Luminâncias ao longo de uma faixa da FOTO, decodificando o PNG com o próprio
 * decodificador do navegador num canvas 2D descartável. Só lê imagem: nenhum
 * estado do app é tocado.
 */
async function luminancias(page: Page, foto: Foto, faixa: Faixa): Promise<number[]> {
  return page.evaluate(
    async ({ b64, faixa }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const luz = (x: number, y: number) => {
        const i = (y * width + x) * 4
        return Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      }
      const out: number[] = []
      if (faixa.eixo === 'h') {
        const y = Math.min(height - 1, Math.round(faixa.fixo * height))
        for (let x = Math.round(faixa.de * width); x < Math.round(faixa.ate * width); x += 1) out.push(luz(x, y))
      } else {
        const x = Math.min(width - 1, Math.round(faixa.fixo * width))
        for (let y = Math.round(faixa.de * height); y < Math.round(faixa.ate * height); y += 1) out.push(luz(x, y))
      }
      return out
    },
    { b64: foto.toString('base64'), faixa },
  )
}

/**
 * Quantas linhas a faixa atravessa: grupos de pixels seguidos que se afastam da
 * mediana da própria faixa em pelo menos `LIMIAR_LUZ`. A mediana é o fundo — a
 * conta não depende da cor de fundo de cada tela, só do contraste, que é o que
 * o olho vê.
 */
function contarLinhas(valores: number[]): number {
  const ordenado = [...valores].sort((a, b) => a - b)
  const fundo = ordenado[Math.floor(ordenado.length / 2)]
  let linhas = 0
  let dentro = false
  for (const v of valores) {
    const destaca = Math.abs(v - fundo) >= LIMIAR_LUZ
    if (destaca && !dentro) linhas += 1
    dentro = destaca
  }
  return linhas
}

/** Espera a tela parar de mudar: duas fotos seguidas idênticas. */
async function esperarTelaParar(alvo: Locator): Promise<void> {
  let anterior = ''
  await expect
    .poll(
      async () => {
        const atual = (await alvo.screenshot()).toString('base64')
        const igual = atual.length > 0 && atual === anterior
        anterior = atual
        return igual
      },
      { timeout: 10_000, intervals: [150, 150, 250, 250, 500] },
    )
    .toBe(true)
}

async function linhasNaFaixa(page: Page, alvo: Locator, faixa: Faixa): Promise<number> {
  return contarLinhas(await luminancias(page, await alvo.screenshot(), faixa))
}

test('a prévia da criação promete a mesma grade que o editor entrega', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Criar Mapas' }).click()

  // O passeio que gerou a dor: Quadrado, 30 x 20, 64 px.
  await page.getByRole('radio', { name: 'Quadrado' }).click()
  await page.getByLabel('Largura (quadros)').fill('30')
  await page.getByLabel('Altura (quadros)').fill('20')
  await page.getByLabel('Tamanho do quadro').fill('64')

  const previa = page.getByRole('img', { name: /^Prévia do mapa/ })
  await expect(previa).toBeVisible()
  await esperarTelaParar(previa)
  const linhasPrevia = await linhasNaFaixa(page, previa, FAIXA_PREVIA)
  const previaTemGrade = linhasPrevia >= LINHAS_MIN

  await page.getByRole('button', { name: 'Criar mapa', exact: true }).click()

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await esperarTelaParar(canvas)
  const fotoEditor = await canvas.screenshot()
  const linhasEditor = contarLinhas(await luminancias(page, fotoEditor, FAIXA_EDITOR))
  const linhasColuna = contarLinhas(await luminancias(page, fotoEditor, COLUNA_EDITOR))
  const editorTemGrade = linhasEditor >= LINHAS_MIN

  // CONTROLE POSITIVO, antes de julgar qualquer coisa: com "Mostrar grade"
  // ligado pelo painel, a mesma régua, no mesmo canvas e com o mesmo limiar,
  // tem de acusar linhas nas duas faixas. Se não acusar, o vermelho lá embaixo
  // seria cegueira da régua, não defeito do app.
  const interruptorGrade = page.locator('label.lb-switch', { hasText: 'Mostrar grade' })
  await expect(interruptorGrade).toBeVisible()
  await interruptorGrade.locator('.lb-switch__track').click()
  await esperarTelaParar(canvas)
  const fotoComGrade = await canvas.screenshot()
  const linhasComGrade = contarLinhas(await luminancias(page, fotoComGrade, FAIXA_EDITOR))
  const colunaComGrade = contarLinhas(await luminancias(page, fotoComGrade, COLUNA_EDITOR))
  expect(
    linhasComGrade,
    `régua cega: com "Mostrar grade" ligado a faixa horizontal do canvas devia mostrar linhas e mostrou ${linhasComGrade} (limiar ${LIMIAR_LUZ})`,
  ).toBeGreaterThanOrEqual(LINHAS_MIN)
  expect(
    colunaComGrade,
    `régua cega: com "Mostrar grade" ligado a coluna do canvas devia mostrar linhas e mostrou ${colunaComGrade} (limiar ${LIMIAR_LUZ})`,
  ).toBeGreaterThanOrEqual(LINHAS_MIN)

  // Devolve a tela ao estado em que o usuário a recebeu, e confere que a
  // leitura de antes não era um quadro velho: desligar apaga as linhas de novo.
  await interruptorGrade.locator('.lb-switch__track').click()
  await esperarTelaParar(canvas)
  const linhasDeVolta = await linhasNaFaixa(page, canvas, FAIXA_EDITOR)
  expect(
    linhasDeVolta,
    `a mesma faixa mediu ${linhasEditor} linha(s) ao abrir o editor e ${linhasDeVolta} depois de ligar e desligar a grade — leitura instável, não dá para julgar`,
  ).toBe(linhasEditor)

  // 1 e 2 medidos, 3: as duas telas têm de dar a MESMA resposta.
  expect
    .soft(
      editorTemGrade,
      `a prévia mente: na tela de criação a faixa do meio atravessa ${linhasPrevia} linha(s) de grade` +
        ` (${previaTemGrade ? 'grade desenhada' : 'sem grade'}) e, no mapa que esse mesmo botão criou, a faixa` +
        ` equivalente do editor atravessa ${linhasEditor} (${editorTemGrade ? 'grade desenhada' : 'sem grade'}).` +
        ' As duas telas precisam concordar: grade nas duas, ou sem grade nas duas.',
    )
    .toBe(previaTemGrade)

  // 4: sem grade, o editor ainda tem de dizer onde o mapa acaba. Mapa de
  // 30 x 20 de 64 px = 1920 x 1280 px de mundo numa janela de 1280 x 800, com a
  // câmera em 1:1 na origem: a borda de baixo e a da direita ficam fora da
  // tela, e as de cima e da esquerda ficam debaixo das barras. Varro a faixa e
  // a coluna inteiras da área de desenho à procura de QUALQUER marca.
  const marcasNoVazio = linhasEditor + linhasColuna
  expect
    .soft(
      marcasNoVazio,
      'área de desenho sem nenhuma referência: varri a faixa horizontal e a coluna do canvas com a grade desligada' +
        ` e nenhum pixel se afastou ${LIMIAR_LUZ} da mediana — nem linha de grade, nem borda do mapa.` +
        ' O usuário desenha sem ver onde o mapa acaba.',
    )
    .toBeGreaterThan(0)
})
