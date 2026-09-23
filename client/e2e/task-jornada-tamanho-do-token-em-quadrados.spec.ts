// JORNADA DO TAMANHO DO TOKEN EM QUADRADOS — escrita para SAIR VERMELHA hoje.
//
// A feature pedida (candidata 4 de `docs/features-candidatas-2026-09-21.md`):
// o painel da ficha traz o TAMANHO EM QUADRADOS (1, 2, 3), para o dragão não
// ficar do tamanho do rato. O campo `Token.size` já existe no arquivo do mapa
// (`types/map.ts:320`) e o desenho já o obedece (`pixi/tokensRenderer.ts:322`,
// `radius = gridSize * token.size / 2 - 2`), mas não há NENHUM controle que o
// mestre possa mexer: com uma ficha selecionada, o painel só oferece Nome,
// Imagem do token, Rotação, Travar e Ocultar (`components/PropertiesPanel.tsx:
// 383-400`). Só dá para puxar o canto, no olhômetro, sem número.
//
// O QUE ESTA JORNADA COBRA, TUDO EM PIXEL DA TELA (nenhuma asserção lê a store;
// o `evaluate` só DECODIFICA a foto, nunca escreve no app):
//
//   PROVA 1 — existe, no painel da ficha, um controle de tamanho em quadrados,
//             e dá para escolher 2 nele;
//   PROVA 2 — depois disso a ficha OCUPA O DOBRO na tela: o disco medido de
//             ponta a ponta na linha do centro fica entre 1,7x e 2,3x o que
//             media antes;
//   PROVA 3 — e ela continua sendo uma ficha desenhada, não uma mancha: o
//             centro segue destacado do chão e o disco segue centrado no mesmo
//             ponto (cresceu para os dois lados, não escorreu para um).
//
// COMO A LARGURA É MEDIDA. A foto da tela é decodificada e a jornada percorre a
// LINHA do centro da ficha procurando o primeiro e o último pixel que destoam
// do chão. Isso é a largura que o olho vê, sem perguntar nada ao app. A ficha é
// medida SEM SELEÇÃO nas duas vezes (o realce de seleção é mais grosso,
// `drawTokens.ts:17`, e mediria coisa diferente em cada foto).
//
// O CONTROLE POSITIVO mede a ficha recém-colocada e prova que ela ocupa MAIS OU
// MENOS UM QUADRADO (a grade é de 64 px) — é o que garante que a régua de pixel
// funciona e que o "dobro" da prova 2 é dobro de alguma coisa de verdade. Sem
// ele, uma medição que sempre devolvesse zero faria qualquer razão passar.
//
// MEDIDO NO CÓDIGO DE HOJE, 21/09/2026, antes de escrever este arquivo: a ficha
// de tamanho 1 mede 64 px de ponta a ponta com o chão em 35,35,35.
//
// COMO A JORNADA NÃO DITA A IMPLEMENTAÇÃO. `escolherTamanhoEmQuadrados` aceita
// as três formas plausíveis — botões/rádios "1 2 3" (o mesmo desenho de
// `components/StairControls.tsx:116`), campo numérico, ou lista — e recusa de
// propósito os controles de "Tamanho" que JÁ existem e são de outra coisa
// (tamanho da fonte, do pincel, do dente, da escada, da célula).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Onde a ficha é medida (centro de célula: 32 + 64k). */
const PONTO_DA_FICHA = { x: 736, y: 416 }
/** Chão vazio na mesma linha, longe da ficha: é dali que sai a cor do fundo. */
const CHAO_NA_LINHA = { x: PONTO_DA_FICHA.x - 280, y: PONTO_DA_FICHA.y }
/** Até onde a régua varre, para cada lado do centro. Cabe uma ficha de 4 quadrados. */
const ALCANCE_DA_REGUA = 220
/** Onde a ficha nasce: o centro da vista (`App.tsx:criarToken`). */
const ONDE_A_FICHA_NASCE = { x: 640, y: 400 }
/** Canto vazio do canvas: clique que tira a seleção antes de medir. */
const VAZIO = { x: 1150, y: 720 }

/** O tamanho que o mestre escolhe no painel. */
const TAMANHO_ESCOLHIDO = 2
/** Lado do quadrado da grade, em px — o mapa novo nasce com 64. */
const QUADRADO = 64
/** Quanto a cor precisa destoar do chão para contar como "tem ficha aqui". */
const DESTOA_DO_CHAO = 40
/** Razão mínima e máxima aceitas para "passou a ocupar o dobro". */
const DOBRO_MINIMO = 1.7
const DOBRO_MAXIMO = 2.3
/** Quanto o centro do disco pode escorregar entre as duas medições, em px. */
const ESCORREGAO_MAXIMO = 8

/** Botão parado antes de soltar: é o que separa um arrasto de pessoa de um clique. */
const PAUSA_MS = 200
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400

/** Rótulos de "Tamanho" que já existem na interface e NÃO são o da ficha. */
const TAMANHO_QUE_NAO_E_DO_TOKEN = /fonte|pincel|dente|escada|c[eé]lula|mapa|imagem|janela/i
/** Como o controle pedido pode se chamar. */
const NOME_DO_TAMANHO = /tamanho|quadrado/i

type Cor = [number, number, number]

interface Ponto {
  x: number
  y: number
}

interface Medida {
  /** Primeiro x da linha em que a tela destoa do chão. */
  inicio: number
  /** Último x. */
  fim: number
  /** Largura de ponta a ponta, em px de tela. */
  largura: number
  /** Meio do trecho medido — para saber se o disco cresceu para os dois lados. */
  meio: number
  /** Cor lida no centro, e a cor do chão, para a mensagem de falha. */
  centro: Cor
  chao: Cor
}

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

const emTexto = (cor: Cor): string => cor.join(',')

/**
 * Mede, NA FOTO DA TELA, de onde até onde a linha do centro da ficha destoa do
 * chão. Decodifica o PNG num canvas 2D descartável dentro do navegador: só
 * LEITURA, nada do app é tocado (mesmo helper de
 * `task-jornada-saida-sem-parede.spec.ts`).
 */
async function medirNaLinha(page: Page, foto: Foto, centro: Ponto, chao: Ponto, alcance: number, limiar: number): Promise<Medida> {
  return page.evaluate(
    async ({ b64, centro, chao, alcance, limiar }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const em = (x: number, y: number): [number, number, number] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const distancia = (a: [number, number, number], b: [number, number, number]): number =>
        Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
      const corDoChao = em(chao.x, chao.y)
      let inicio = -1
      let fim = -1
      for (let dx = -alcance; dx <= alcance; dx += 1) {
        if (distancia(em(centro.x + dx, centro.y), corDoChao) > limiar) {
          if (inicio < 0) inicio = centro.x + dx
          fim = centro.x + dx
        }
      }
      return {
        inicio,
        fim,
        largura: inicio < 0 ? 0 : fim - inicio + 1,
        meio: inicio < 0 ? 0 : (inicio + fim) / 2,
        centro: em(centro.x, centro.y),
        chao: corDoChao,
      }
    },
    { b64: foto.toString('base64'), centro, chao, alcance, limiar },
  )
}

/** Mede a ficha agora, com nada selecionado. */
async function medirAFicha(page: Page): Promise<Medida> {
  return medirNaLinha(page, await page.screenshot(), PONTO_DA_FICHA, CHAO_NA_LINHA, ALCANCE_DA_REGUA, DESTOA_DO_CHAO)
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

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, input, select, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"], [role="radiogroup"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => {
          const id = elemento.getAttribute('id')
          const marcado = id ? document.querySelector(`label[for="${id}"]`) : null
          return elemento.getAttribute('aria-label') ?? marcado?.textContent?.trim() ?? elemento.textContent?.trim() ?? ''
        })
        .filter((nome) => nome !== ''),
    )
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

/**
 * Arrasto de pessoa: pega, espera o "pegar" registrar, caminha em passos, PARA
 * em cima do destino e só então solta.
 */
async function arrastarComoPessoa(page: Page, de: Ponto, para: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.move((de.x + para.x) / 2, (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(para.x, para.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Tira a seleção: o realce é mais grosso que o contorno normal e mediria outra coisa. */
async function limparSelecao(page: Page): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(VAZIO.x, VAZIO.y)
  await page.waitForTimeout(PINTURA_MS)
}

/** Clica na ficha para abrir o painel dela. */
async function selecionarFicha(page: Page, onde: Ponto): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(onde.x, onde.y)
  await expect(
    page.getByRole('button', { name: 'Apagar token selecionado' }),
    `clicar em (${onde.x}, ${onde.y}) não selecionou ficha nenhuma: o painel do token não abriu`,
  ).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(PINTURA_MS)
}

/**
 * Escolhe o tamanho da ficha SELECIONADA, em quadrados, sem ditar a forma do
 * controle: botões/rádios "1 2 3", campo numérico ou lista. Nenhum deles existe
 * hoje no painel do token — a falha lista o que a tela oferece.
 */
async function escolherTamanhoEmQuadrados(page: Page, quantos: number, oQueEra: string): Promise<void> {
  const rotuloDoNumero = new RegExp(`^${quantos}( quadrados?)?$`, 'i')

  const porBotao = page
    .getByRole('radiogroup', { name: NOME_DO_TAMANHO })
    .getByRole('radio', { name: rotuloDoNumero })
    .or(page.getByRole('radio', { name: new RegExp(`^${quantos} quadrados?$`, 'i') }))
    .or(page.getByRole('button', { name: new RegExp(`^${quantos} quadrados?$`, 'i') }))
  if ((await porBotao.count()) > 0) {
    await porBotao.first().click()
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const porCampo = page
    .getByRole('spinbutton', { name: NOME_DO_TAMANHO })
    .or(page.getByRole('textbox', { name: NOME_DO_TAMANHO }))
  const campos = await porCampo.count()
  for (let i = 0; i < campos; i += 1) {
    const campo = porCampo.nth(i)
    const rotulo = (await campo.getAttribute('aria-label')) ?? (await campo.inputValue().catch(() => '')) ?? ''
    if (TAMANHO_QUE_NAO_E_DO_TOKEN.test(rotulo)) continue
    await campo.fill(String(quantos))
    await campo.press('Enter')
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const porLista = page.getByRole('combobox', { name: NOME_DO_TAMANHO })
  if ((await porLista.count()) > 0) {
    await porLista.first().selectOption({ label: String(quantos) })
    await page.waitForTimeout(PINTURA_MS)
    return
  }

  const controles = await nomesDeControleNaTela(page)
  expect(
    0,
    `${oQueEra}: com a ficha selecionada não há como dizer que ela ocupa ${quantos} quadrados. ` +
      `Nenhum botão, campo ou lista com nome ${String(NOME_DO_TAMANHO)} (descontados os de ${String(TAMANHO_QUE_NAO_E_DO_TOKEN)}). ` +
      `O que a tela oferece hoje: ${controles.join(' | ')}`,
  ).toBeGreaterThan(0)
}

test('CONTROLE POSITIVO: a ficha colocada pela interface aparece e ocupa mais ou menos um quadrado da grade', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: os pontos desta jornada (até x=1150, y=720) não cabem nele`,
  ).toBeGreaterThan(600)

  await ferramenta(page, 'Selecionar')
  await colocarFicha(page, 'Ra')
  await arrastarComoPessoa(page, ONDE_A_FICHA_NASCE, PONTO_DA_FICHA)
  await limparSelecao(page)

  const medida = await medirAFicha(page)
  const leitura = `centro=${emTexto(medida.centro)}, chão=${emTexto(medida.chao)}, de x=${medida.inicio} a x=${medida.fim}`
  expect(
    medida.largura,
    `a régua não achou ficha nenhuma na linha y=${PONTO_DA_FICHA.y} (${leitura})`,
  ).toBeGreaterThan(QUADRADO * 0.6)
  expect(
    medida.largura,
    `a ficha de um quadrado mediu ${medida.largura} px, mais que um quadrado e meio da grade de ${QUADRADO} px (${leitura}): a régua está lendo outra coisa junto`,
  ).toBeLessThan(QUADRADO * 1.5)
  expect(
    Math.abs(medida.meio - PONTO_DA_FICHA.x),
    `o trecho medido está centrado em x=${medida.meio}, longe da ficha em x=${PONTO_DA_FICHA.x} (${leitura})`,
  ).toBeLessThan(ESCORREGAO_MAXIMO)

  expect(erros, 'o editor jogou erro ao colocar a ficha').toEqual([])
})

test('o mestre escolhe 2 quadrados no painel e a ficha passa a ocupar o dobro na tela', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  await ferramenta(page, 'Selecionar')
  await colocarFicha(page, 'Dr')
  await arrastarComoPessoa(page, ONDE_A_FICHA_NASCE, PONTO_DA_FICHA)
  await limparSelecao(page)

  // Calibração: a régua enxerga a ficha antes de mexer em nada.
  const antes = await medirAFicha(page)
  expect(
    antes.largura,
    `a régua não achou a ficha antes de escolher o tamanho: centro=${emTexto(antes.centro)}, chão=${emTexto(antes.chao)}`,
  ).toBeGreaterThan(QUADRADO * 0.6)

  // ------------------------------------------------------------------
  // PROVA 1 — o painel da ficha deixa dizer, em quadrados, que ela é grande.
  // ------------------------------------------------------------------
  await selecionarFicha(page, PONTO_DA_FICHA)
  await escolherTamanhoEmQuadrados(page, TAMANHO_ESCOLHIDO, 'tamanho em quadrados, no painel do token')
  await limparSelecao(page)

  const depois = await medirAFicha(page)
  const leitura =
    `antes ${antes.largura} px (x=${antes.inicio}..${antes.fim}), ` +
    `depois ${depois.largura} px (x=${depois.inicio}..${depois.fim}), chão=${emTexto(depois.chao)}`

  // ------------------------------------------------------------------
  // PROVA 3 — continua sendo uma ficha desenhada, no mesmo lugar.
  // ------------------------------------------------------------------
  expect(
    Math.max(
      Math.abs(depois.centro[0] - depois.chao[0]),
      Math.abs(depois.centro[1] - depois.chao[1]),
      Math.abs(depois.centro[2] - depois.chao[2]),
    ),
    `depois de escolher ${TAMANHO_ESCOLHIDO} quadrados não há ficha desenhada em (${PONTO_DA_FICHA.x}, ${PONTO_DA_FICHA.y}): ${leitura}`,
  ).toBeGreaterThan(DESTOA_DO_CHAO)
  expect(
    Math.abs(depois.meio - PONTO_DA_FICHA.x),
    `a ficha maior não cresceu para os dois lados: o trecho medido ficou centrado em x=${depois.meio}, e a ficha está em x=${PONTO_DA_FICHA.x} (${leitura})`,
  ).toBeLessThan(ESCORREGAO_MAXIMO)

  // ------------------------------------------------------------------
  // PROVA 2 — e ela ocupa o DOBRO.
  // ------------------------------------------------------------------
  expect(
    depois.largura / antes.largura,
    `escolher ${TAMANHO_ESCOLHIDO} quadrados não dobrou a ficha na tela: ${leitura}`,
  ).toBeGreaterThan(DOBRO_MINIMO)
  expect(
    depois.largura / antes.largura,
    `a ficha de ${TAMANHO_ESCOLHIDO} quadrados ficou maior que o dobro: ${leitura}`,
  ).toBeLessThan(DOBRO_MAXIMO)

  expect(erros, 'o editor jogou erro ao escolher o tamanho da ficha').toEqual([])
})
