// JORNADA DE USUÁRIO — "isso é uma escada, e ela vai pra lá".
//
// A dor do mestre, com as palavras dele: "como eu sei que essa escada vai para
// cima ou para baixo? como eu sei que isso é uma escada... ta meio feio".
//
// Esta jornada não pergunta ao store nem ao painel. Ela faz o que o mestre faz
// — tecla de ferramenta, arrasto com o ponteiro, clique no painel pra dizer que
// UMA das escadas desce, Escape pra largar a seleção — e depois OLHA a tela: lê
// os pixels da foto do canvas, com a escada NÃO selecionada e o painel sem nada
// pra mostrar. Duas afirmações, as duas medidas em pixel:
//
//   1. SENTIDO — duas escadas iguais, uma "Sobe" e outra "Desce", têm de ficar
//      visivelmente diferentes uma da outra. Hoje a única diferença é uma
//      setinha de 10px de mundo trocando de ponta: alguns por cento dos pixels
//      de tinta. O piso exigido (DIFERENCA_SENTIDO_MINIMA) é medido contra o
//      MESMO par antes da troca (têm de ser quase idênticas) e contra um
//      recorte de chão vazio (têm de estourar o piso) — os dois controles saem
//      da mesma tela, na mesma medida.
//
//   2. FORMA — o desenho tem de ter massa de degrau ao longo do lance, não um
//      pente de fios de cabelo. Métrica: fração de colunas do lance cuja coluna
//      de tinta chega à metade da coluna mais cheia. Hoje o degrau é um traço de
//      2px a cada 16px (drawStairs.ts + STAIR_STEP_SPACING), então a fração fica
//      perto de 1/8. Controle positivo do piso: uma PAREDE desenhada na mesma
//      tela, medida pela mesma função, passa folgado.
//
// Nada aqui lê `useMapStore`, `selection`, `Stair.direction` ou o texto do
// painel. A mira do clique que seleciona a escada também sai da foto (linha de
// centroide de tinta), como a mira do mestre sai do que ele enxerga.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

// ------------------------------------------------------------------ pisos e tetos

/** Diferença mínima (fração dos pixels de tinta) entre a escada que sobe e a que
 *  desce. 25% = um quarto do desenho muda; uma setinha trocando de ponta não
 *  chega perto. Controle positivo: escada × chão vazio tem de passar. */
const DIFERENCA_SENTIDO_MINIMA = 0.25

/** Teto da diferença entre dois desenhos que DEVEM ser o mesmo (as duas escadas
 *  antes da troca de sentido; a escada que não foi tocada, antes e depois).
 *  Controle negativo do mesmo número: prova que a medida não grita "diferente"
 *  pra qualquer par. */
const DIFERENCA_IGUAL_MAXIMA = 0.02

/** Fração mínima de colunas "cheias" ao longo do lance — massa de degrau.
 *  Controle positivo: uma parede na mesma tela, mesma função, tem de passar. */
const MASSA_DEGRAU_MINIMA = 0.35

/** Distância de canal (0-255) a partir da qual duas cores contam como
 *  diferentes / a partir da qual um pixel conta como tinta sobre o fundo. */
const LIMIAR_CANAL = 24

/** Altura (px de CSS) do recorte lido em volta do eixo de cada desenho. O lance
 *  nasce com `stepWidth` = 1 célula (64px), então 80 cobre degrau inteiro + folga. */
const ALTURA_RECORTE = 80

// ------------------------------------------------------ onde o mestre desenha

// Coluna da esquerda (inspetor) ocupa até ~280px e a barra de ferramentas o topo
// até ~110px: tudo aqui fica no canvas limpo, à direita e abaixo deles.
const X_INICIO = 400
const X_FIM = 656
/** Recorte um pouco mais largo que o lance: a seta passa da ponta. */
const RECORTE_X0 = 385
const RECORTE_X1 = 675

const Y_ESCADA_SOBE = 300
const Y_ESCADA_DESCE = 500
const Y_PAREDE = 700
/** Faixa de busca de cada desenho: o snap de grade pode empurrar o eixo até
 *  meia célula pra qualquer lado, e a faixa dá ±60px de folga. */
const FAIXAS = {
  sobe: { y0: Y_ESCADA_SOBE - 60, y1: Y_ESCADA_SOBE + 60 },
  desce: { y0: Y_ESCADA_DESCE - 60, y1: Y_ESCADA_DESCE + 60 },
  parede: { y0: Y_PAREDE - 40, y1: Y_PAREDE + 40 },
  /** Chão vazio entre a escada de baixo e a parede — controle positivo da diferença. */
  vazio: { y0: 570, y1: 650 },
} as const

const CANTO_LONGE = { x: 1220, y: 770 }

// --------------------------------------------------------------- leitura da tela

interface Faixa {
  nome: string
  y0: number
  y1: number
}

interface Recorte {
  nome: string
  largura: number
  altura: number
  /** Linha (px de CSS, relativa ao canvas) do centroide de tinta da faixa. */
  linhaCentro: number
  /** Quantos pixels do recorte são tinta (diferentes do fundo). */
  tinta: number
  /** rgb empacotado (r<<16|g<<8|b), linha a linha. */
  pixels: number[]
}

/**
 * Decodifica a FOTO do canvas no próprio navegador (canvas 2D descartável) e
 * devolve, por faixa, um recorte de altura fixa centrado no centroide de tinta
 * daquela faixa. Centroide, e não "linha mais clara": um desenho de escada é
 * simétrico em torno do eixo tanto subindo quanto descendo, então o centroide é
 * uma âncora que continua valendo depois de qualquer redesenho. Nenhum estado do
 * app é lido ou tocado aqui — é só a imagem.
 */
async function lerRecortes(page: Page, foto: Foto, larguraCss: number, faixas: Faixa[]): Promise<Recorte[]> {
  return page.evaluate(
    async ({ b64, larguraCss, faixas, x0, x1, altura, limiar }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss

      const corEm = (xCss: number, yCss: number): number => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(xCss * escala)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(yCss * escala)))
        const i = (cy * width + cx) * 4
        return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
      }
      const dist = (a: number, b: number): number =>
        Math.max(
          Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)),
          Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)),
          Math.abs((a & 255) - (b & 255)),
        )

      const larguraRecorte = x1 - x0
      return faixas.map((faixa) => {
        // Fundo da faixa = cor mais frequente dela (o chão do mapa).
        const contagem = new Map<number, number>()
        for (let y = faixa.y0; y < faixa.y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            const c = corEm(x, y)
            contagem.set(c, (contagem.get(c) ?? 0) + 1)
          }
        }
        let fundo = 0
        let maior = -1
        for (const [cor, n] of contagem) {
          if (n > maior) {
            maior = n
            fundo = cor
          }
        }

        let peso = 0
        let somaY = 0
        for (let y = faixa.y0; y < faixa.y1; y += 1) {
          for (let x = x0; x < x1; x += 1) {
            if (dist(corEm(x, y), fundo) > limiar) {
              peso += 1
              somaY += y
            }
          }
        }
        // Faixa sem tinta (controle de chão vazio): âncora no meio da faixa.
        const linhaCentro = peso === 0 ? Math.round((faixa.y0 + faixa.y1) / 2) : Math.round(somaY / peso)

        const topo = linhaCentro - Math.floor(altura / 2)
        const pixels: number[] = []
        let tinta = 0
        for (let dy = 0; dy < altura; dy += 1) {
          for (let dx = 0; dx < larguraRecorte; dx += 1) {
            const c = corEm(x0 + dx, topo + dy)
            pixels.push(c)
            if (dist(c, fundo) > limiar) tinta += 1
          }
        }
        return { nome: faixa.nome, largura: larguraRecorte, altura, linhaCentro, tinta, pixels }
      })
    },
    { b64: foto.toString('base64'), larguraCss, faixas: faixas as Faixa[], x0: RECORTE_X0, x1: RECORTE_X1, altura: ALTURA_RECORTE, limiar: LIMIAR_CANAL },
  )
}

const distanciaCanal = (a: number, b: number): number =>
  Math.max(
    Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)),
    Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)),
    Math.abs((a & 255) - (b & 255)),
  )

function fundoDe(recorte: Recorte): number {
  const contagem = new Map<number, number>()
  for (const c of recorte.pixels) contagem.set(c, (contagem.get(c) ?? 0) + 1)
  let fundo = 0
  let maior = -1
  for (const [cor, n] of contagem) {
    if (n > maior) {
      maior = n
      fundo = cor
    }
  }
  return fundo
}

/**
 * Fração dos pixels de TINTA (união dos dois recortes) em que os dois desenhos
 * discordam. Denominador é a tinta, não o retângulo inteiro: um retângulo é
 * quase todo chão, e dividir pelo chão faria qualquer diferença parecer zero.
 */
function fracaoDiferente(a: Recorte, b: Recorte): number {
  if (a.largura !== b.largura || a.altura !== b.altura) throw new Error(`recortes de tamanhos diferentes: ${a.nome} x ${b.nome}`)
  const fundoA = fundoDe(a)
  const fundoB = fundoDe(b)
  let uniao = 0
  let diferentes = 0
  for (let i = 0; i < a.pixels.length; i += 1) {
    const ehTinta = distanciaCanal(a.pixels[i], fundoA) > LIMIAR_CANAL || distanciaCanal(b.pixels[i], fundoB) > LIMIAR_CANAL
    if (!ehTinta) continue
    uniao += 1
    if (distanciaCanal(a.pixels[i], b.pixels[i]) > LIMIAR_CANAL) diferentes += 1
  }
  return uniao === 0 ? 0 : diferentes / uniao
}

/**
 * Massa de degrau: fração das colunas do lance cuja coluna de tinta chega à
 * metade da coluna mais cheia. Pente de fios finos (traço de 2px a cada 16px)
 * dá perto de 1/8; um desenho com degrau de verdade dá muito mais. O
 * denominador é a extensão do próprio desenho (primeira à última coluna com
 * tinta), então o resultado não depende da margem do recorte.
 */
function fracaoMassaDegrau(recorte: Recorte): number {
  const fundo = fundoDe(recorte)
  const massa: number[] = []
  for (let x = 0; x < recorte.largura; x += 1) {
    let m = 0
    for (let y = 0; y < recorte.altura; y += 1) {
      if (distanciaCanal(recorte.pixels[y * recorte.largura + x], fundo) > LIMIAR_CANAL) m += 1
    }
    massa.push(m)
  }
  const maisCheia = Math.max(...massa)
  if (maisCheia === 0) return 0
  const primeira = massa.findIndex((m) => m > 0)
  let ultima = primeira
  for (let x = 0; x < massa.length; x += 1) if (massa[x] > 0) ultima = x
  let cheias = 0
  for (let x = primeira; x <= ultima; x += 1) if (massa[x] >= maisCheia / 2) cheias += 1
  return cheias / (ultima - primeira + 1)
}

// ------------------------------------------------------------------- o gesto

/** Foto do canvas depois que a tela para de mudar (duas fotos seguidas iguais). */
async function fotoEstavel(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  let anterior = await canvas.screenshot()
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    await page.waitForTimeout(100)
    const atual = await canvas.screenshot()
    if (atual.equals(anterior)) return { foto: atual, largura: caixa.width }
    anterior = atual
  }
  throw new Error('a tela não parou de mudar: não dá para medir pixel de uma tela instável')
}

/** Arrasto de verdade: aperta, anda em passos, PAUSA antes de soltar, solta. */
async function arrastar(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 8 })
  await page.mouse.move(x1, y1, { steps: 8 })
  await page.waitForTimeout(120)
  await page.mouse.up()
}

test('o mestre sabe pela TELA que aquilo é uma escada e para que lado ela vai, sem abrir painel nenhum', async ({ page }) => {
  await enterEditor(page)
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  const naTela = (x: number, y: number) => ({ x: caixa.x + x, y: caixa.y + y })

  // Clique no vazio só para tirar o foco do botão que abriu o editor — daqui em
  // diante as teclas de ferramenta valem.
  await page.mouse.click(naTela(CANTO_LONGE.x, CANTO_LONGE.y).x, naTela(CANTO_LONGE.x, CANTO_LONGE.y).y)

  // --- duas escadas iguais, feitas com o mesmo gesto, e uma parede de controle
  await page.keyboard.press('s')
  await arrastar(page, naTela(X_INICIO, Y_ESCADA_SOBE).x, naTela(X_INICIO, Y_ESCADA_SOBE).y, naTela(X_FIM, Y_ESCADA_SOBE).x, naTela(X_FIM, Y_ESCADA_SOBE).y)
  await arrastar(page, naTela(X_INICIO, Y_ESCADA_DESCE).x, naTela(X_INICIO, Y_ESCADA_DESCE).y, naTela(X_FIM, Y_ESCADA_DESCE).x, naTela(X_FIM, Y_ESCADA_DESCE).y)
  await page.keyboard.press('w')
  await arrastar(page, naTela(X_INICIO, Y_PAREDE).x, naTela(X_INICIO, Y_PAREDE).y, naTela(X_FIM, Y_PAREDE).x, naTela(X_FIM, Y_PAREDE).y)

  await page.keyboard.press('Escape')
  await page.mouse.move(naTela(CANTO_LONGE.x, CANTO_LONGE.y).x, naTela(CANTO_LONGE.x, CANTO_LONGE.y).y)

  const antes = await fotoEstavel(page)
  const [subindoAntes, descendoAntes, parede, vazio] = await lerRecortes(page, antes.foto, antes.largura, [
    { nome: 'escada de cima (antes)', ...FAIXAS.sobe },
    { nome: 'escada de baixo (antes)', ...FAIXAS.desce },
    { nome: 'parede (controle de massa)', ...FAIXAS.parede },
    { nome: 'chão vazio (controle de diferença)', ...FAIXAS.vazio },
  ])

  // Os dois desenhos existem mesmo (senão qualquer medida abaixo é vácuo).
  expect(subindoAntes.tinta, 'escada de cima não desenhou nada').toBeGreaterThan(500)
  expect(descendoAntes.tinta, 'escada de baixo não desenhou nada').toBeGreaterThan(500)
  expect(parede.tinta, 'parede de controle não desenhou nada').toBeGreaterThan(200)
  expect(vazio.tinta, 'o recorte de controle deveria ser chão vazio').toBeLessThan(200)

  // CONTROLE NEGATIVO da medida de diferença: as duas escadas ainda são o mesmo
  // desenho (as duas sobem), então a medida tem de dizer "iguais".
  const difIguais = fracaoDiferente(subindoAntes, descendoAntes)
  console.log(`[medida] duas escadas iguais, antes da troca: ${(difIguais * 100).toFixed(1)}% dos pixels de tinta diferem (teto ${DIFERENCA_IGUAL_MAXIMA * 100}%)`)
  expect(difIguais, 'as duas escadas foram desenhadas com o mesmo gesto: deviam estar iguais nesta hora').toBeLessThan(DIFERENCA_IGUAL_MAXIMA)

  // CONTROLE POSITIVO da mesma medida: escada contra chão vazio estoura o piso.
  const difControle = fracaoDiferente(subindoAntes, vazio)
  console.log(`[controle+] escada x chão vazio: ${(difControle * 100).toFixed(1)}% (piso ${DIFERENCA_SENTIDO_MINIMA * 100}%)`)
  expect(difControle, 'controle positivo: se nem escada x chão vazio passa do piso, o piso é inalcançável').toBeGreaterThanOrEqual(DIFERENCA_SENTIDO_MINIMA)

  // --- o mestre diz que a de baixo DESCE, pelo painel, e depois larga a seleção
  await page.keyboard.press('v')
  // A mira sai da FOTO: o eixo lido na tela, não uma coordenada adivinhada.
  await page.mouse.click(naTela((X_INICIO + X_FIM) / 2, descendoAntes.linhaCentro).x, naTela((X_INICIO + X_FIM) / 2, descendoAntes.linhaCentro).y)
  await page.getByRole('radiogroup', { name: 'Sentido da escada' }).getByRole('radio', { name: 'Desce', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.mouse.move(naTela(CANTO_LONGE.x, CANTO_LONGE.y).x, naTela(CANTO_LONGE.x, CANTO_LONGE.y).y)

  const depois = await fotoEstavel(page)
  const [subindo, descendo] = await lerRecortes(page, depois.foto, depois.largura, [
    { nome: 'escada que sobe', ...FAIXAS.sobe },
    { nome: 'escada que desce', ...FAIXAS.desce },
  ])
  expect(descendo.tinta, 'a escada de baixo sumiu da tela depois da troca').toBeGreaterThan(500)

  // Ninguém está selecionado: a escada de cima, que o mestre não tocou, tem de
  // estar EXATAMENTE como estava — se houvesse contorno de seleção sobrando,
  // este número subiria e a comparação de sentido estaria contaminada.
  const difNaoTocada = fracaoDiferente(subindoAntes, subindo)
  console.log(`[medida] escada não tocada, antes x depois: ${(difNaoTocada * 100).toFixed(1)}% (teto ${DIFERENCA_IGUAL_MAXIMA * 100}%)`)
  expect(difNaoTocada, 'sobrou seleção/realce na tela: a comparação de sentido não seria honesta').toBeLessThan(DIFERENCA_IGUAL_MAXIMA)

  // 1) SENTIDO NA TELA — sobe e desce têm de ser visivelmente diferentes.
  const difSentido = fracaoDiferente(subindo, descendo)
  console.log(`[JORNADA 1] sobe x desce, sem seleção e sem painel: ${(difSentido * 100).toFixed(1)}% dos pixels de tinta diferem (piso ${DIFERENCA_SENTIDO_MINIMA * 100}%)`)
  // `expect.soft` nas duas afirmacoes da jornada (so nelas): o mestre tem DOIS
  // problemas na mesma tela, e uma rodada so tem de mostrar os dois. Guardas e
  // controles continuam duros — se um deles cai, a medida nao vale e o resto
  // nao interessa.
  expect.soft(
    difSentido,
    'na tela, a escada que sobe e a que desce são praticamente o mesmo desenho: o mestre não tem como saber o sentido sem abrir o painel',
  ).toBeGreaterThanOrEqual(DIFERENCA_SENTIDO_MINIMA)

  // 2) FORMA DE ESCADA — massa de degrau ao longo do lance.
  const massaParede = fracaoMassaDegrau(parede)
  console.log(`[controle+] massa da parede: ${(massaParede * 100).toFixed(1)}% (piso ${MASSA_DEGRAU_MINIMA * 100}%)`)
  expect(massaParede, 'controle positivo: se nem uma parede cheia passa do piso de massa, o piso é inalcançável').toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)

  const massaSobe = fracaoMassaDegrau(subindo)
  const massaDesce = fracaoMassaDegrau(descendo)
  console.log(`[JORNADA 2] massa de degrau: sobe ${(massaSobe * 100).toFixed(1)}%, desce ${(massaDesce * 100).toFixed(1)}% (piso ${MASSA_DEGRAU_MINIMA * 100}%)`)
  expect.soft(massaSobe, 'o lance é um pente de traços finos com chão no meio: não lê como escada').toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
  expect.soft(massaDesce, 'o lance é um pente de traços finos com chão no meio: não lê como escada').toBeGreaterThanOrEqual(MASSA_DEGRAU_MINIMA)
})
