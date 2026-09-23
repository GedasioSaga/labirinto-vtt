// JORNADA "O TEXTO RECEBE O QUE SE DIGITA" — escrita para SAIR VERMELHA hoje.
//
// O que a pessoa faz: pega a ferramenta Texto (T), clica no mapa e digita
// `SAIDA`. É o gesto de todo editor de desenho — no Excalidraw, a ferramenta de
// texto cria o rótulo já recebendo o teclado, e as letras entram nele.
//
// O que acontece hoje (achado 2 do passeio de 20/09/2026,
// `docs/passeio-2026-09-20.md`): o rótulo nasce escrito "Rótulo"
// (`lib/drawingFactory.ts:529`) e NADA liga o teclado a ele. Cada letra cai no
// mapa de atalhos de ferramenta (`lib/keymap.ts:70-116`): `S` troca para
// Escada, `A` para Polígono, `I` para Chão, `D` para Porta. Ao fim de digitar
// `SAIDA` a pessoa escreveu nada, trocou de ferramenta quatro vezes e nenhum
// aviso apareceu. A guarda que existe (`keymap.ts:163`, `isEditableTarget`) só
// protege INPUT/TEXTAREA/SELECT — e o rótulo é um `PIXI.Text` desenhado no
// canvas (`pixi/drawTextLabels.ts`), não um campo do DOM.
//
// O QUE ESTA JORNADA COBRA, tudo no que APARECE NA TELA:
//   1. a ferramenta ativa continua sendo Texto depois de digitar — digitar não
//      pode ser um atalho de ferramenta disfarçado;
//   2. o desenho do rótulo passa a ser o MESMO desenho de um rótulo cujo texto
//      é `SAIDA` — isto é, as letras entraram no rótulo.
//
// COMO ELA COMPARA SEM SE ENGANAR. A prova 2 não compara contra "qualquer coisa
// diferente": ela compara contra uma REFERÊNCIA colhida na própria jornada — um
// segundo rótulo, no outro ponto, que recebeu `SAIDA` pelo caminho que funciona
// hoje (o campo do painel lateral). Antes disso, duas calibrações provam que a
// comparação entre os dois pontos significa alguma coisa: o fundo vazio dos dois
// é byte a byte igual, e o rótulo recém-criado ("Rótulo") desenha igual nos dois.
//
// POR QUE O RECORTE É PEQUENO E COMEÇA EXATAMENTE NO PONTO. O realce de seleção
// é um retângulo VAZADO em volta do texto, de `x-4` a `x+largura+4`
// (`drawTextLabels.ts:56-59`). Um recorte que começa em `(x, y)` e tem 40x18 px
// fica INTEIRO dentro da tinta das letras: nenhuma borda do realce entra nele.
// Assim as fotos comparam texto com texto, e não "estava selecionado" com "não
// estava" — que é justamente o que muda sozinho quando a tecla troca a
// ferramenta.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Onde cada rótulo é cravado, em px do canvas. Múltiplos de 64 (a célula da
 *  grade), para o snap de parede (`applySnap(..., 'wall')`) devolver o próprio
 *  ponto e os dois rótulos nascerem no mesmo lugar relativo da célula. */
const P_REFERENCIA = { x: 448, y: 256 }
const P_DIGITADO = { x: 448, y: 448 }
/** Recorte da TINTA do rótulo: começa no ponto e não alcança nenhuma borda do
 *  realce de seleção (ver cabeçalho). "Rótulo" e "SAIDA" a 16 px passam dos
 *  40 px de largura, então o recorte nunca cai fora das letras. */
const RECORTE = { width: 40, height: 18 }
/** O que a pessoa digita. Cada letra é também um atalho de ferramenta hoje. */
const PALAVRA = 'SAIDA'
/** Botão parado antes de soltar: é o que separa um toque de pessoa de um clique instantâneo. */
const TOQUE_MS = 160
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 500

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

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

async function caixaDoCanvas(page: Page): Promise<Caixa> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

function barraDeFerramentas(page: Page) {
  return page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
}

function botaoDaFerramenta(page: Page, nome: string) {
  return barraDeFerramentas(page).getByRole('button', { name: nome, exact: true })
}

/** Toque de pessoa: desce, fica parado um instante, sobe. */
async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Foto da tinta do rótulo cravado neste ponto. */
async function fotoDoRotulo(page: Page, caixa: Caixa, ponto: Ponto): Promise<Foto> {
  return page.screenshot({
    clip: { x: caixa.x + ponto.x, y: caixa.y + ponto.y, width: RECORTE.width, height: RECORTE.height },
  })
}

/**
 * Controle negativo obrigatório: parada, a tela é estável. Sem isto, "as fotos
 * saíram diferentes" não provaria nada — bastaria o canvas tremer.
 */
async function telaEstavel(page: Page, caixa: Caixa, ponto: Ponto): Promise<Foto> {
  // Insiste antes de reprovar: logo depois do editor abrir, o Pixi ainda pode
  // estar assentando a primeira pintura, e reprovar nesse instante seria medir
  // a partida e não o app. Se depois de TENTATIVAS a tela ainda mudar sozinha,
  // aí sim não há comparação de foto possível e a jornada para.
  const TENTATIVAS = 8
  await page.waitForTimeout(PINTURA_MS)
  let anterior = await fotoDoRotulo(page, caixa, ponto)
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    await page.waitForTimeout(PINTURA_MS)
    const atual = await fotoDoRotulo(page, caixa, ponto)
    if (atual.equals(anterior)) return atual
    anterior = atual
  }
  expect(
    false,
    `a tela do editor muda sozinha parada em (${ponto.x}, ${ponto.y}), em ${TENTATIVAS} leituras seguidas: ` +
      'nenhuma comparação de fotos provaria a diferença entre dois desenhos',
  ).toBe(true)
  return anterior
}

/** Pega a ferramenta Texto e confere na tela que ela ficou na mão. */
async function pegarFerramentaTexto(page: Page): Promise<void> {
  await botaoDaFerramenta(page, 'Texto').click()
  await expect(
    botaoDaFerramenta(page, 'Texto'),
    'a ferramenta Texto não entrou na mão: a barra não mostra o botão pressionado',
  ).toHaveAttribute('aria-pressed', 'true')
}

/** Crava um rótulo no ponto e confere na tela que o painel dele abriu com "Rótulo". */
async function cravarRotulo(page: Page, caixa: Caixa, ponto: Ponto): Promise<void> {
  await tocarComoPessoa(page, caixa.x + ponto.x, caixa.y + ponto.y)
  await expect(
    page.getByText('Rótulo de texto'),
    `cravar em (${ponto.x}, ${ponto.y}) não abriu o painel do rótulo: nada foi criado`,
  ).toBeVisible({ timeout: 5000 })
  // O campo do painel mostrando "Rótulo" prova DUAS coisas na tela: o rótulo
  // recém-criado é o selecionado, e o foco NÃO ficou preso no campo do rótulo
  // anterior (senão o valor exibido seria o dele).
  await expect(
    page.locator('#lb-text-content'),
    `o painel não está mostrando o rótulo recém-criado em (${ponto.x}, ${ponto.y})`,
  ).toHaveValue('Rótulo')
}

/** Escreve no campo do painel — o caminho que FUNCIONA hoje, usado só como referência. */
async function escreverPeloPainel(page: Page, palavra: string): Promise<void> {
  const campo = page.locator('#lb-text-content')
  await campo.click()
  await campo.press('Control+a')
  await campo.pressSequentially(palavra, { delay: 40 })
  await expect(campo, 'o campo do painel não recebeu o que foi digitado nele').toHaveValue(palavra)
  await page.waitForTimeout(PINTURA_MS)
}

/** Digita no MAPA, tecla por tecla, como quem acabou de criar o rótulo. */
async function digitarNoMapa(page: Page, palavra: string): Promise<void> {
  for (const letra of palavra) {
    await page.keyboard.press(letra)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(PINTURA_MS)
}

test('CONTROLE POSITIVO: o rótulo aparece onde se clica e o campo do painel muda o que está desenhado', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: os pontos desta jornada não cabem nele`,
  ).toBeGreaterThan(600)

  await pegarFerramentaTexto(page)
  const vazio = await telaEstavel(page, caixa, P_REFERENCIA)

  await cravarRotulo(page, caixa, P_REFERENCIA)
  const comRotulo = await fotoDoRotulo(page, caixa, P_REFERENCIA)
  expect(
    comRotulo.equals(vazio),
    `nada foi desenhado em (${P_REFERENCIA.x}, ${P_REFERENCIA.y}) depois de cravar: a foto do recorte não enxerga rótulo nenhum`,
  ).toBe(false)

  // O caminho que funciona hoje: escrever no campo do painel muda o desenho.
  // É ele que dá à jornada a certeza de que o comparador de foto enxerga uma
  // TROCA DE TEXTO, e não só "apareceu alguma coisa".
  await escreverPeloPainel(page, PALAVRA)
  const comPalavra = await fotoDoRotulo(page, caixa, P_REFERENCIA)
  expect(
    comPalavra.equals(comRotulo),
    `escrever "${PALAVRA}" no campo do painel não mudou o desenho em (${P_REFERENCIA.x}, ${P_REFERENCIA.y}): o comparador de foto é cego para troca de texto`,
  ).toBe(false)

  // E digitar DENTRO de um campo não pode trocar a ferramenta — esta parte já
  // funciona (`keymap.ts:163`) e é o que torna a prova 1 do outro teste justa.
  await expect(
    botaoDaFerramenta(page, 'Texto'),
    'digitar dentro do campo do painel trocou a ferramenta ativa: nem o caminho que funciona hoje está de pé',
  ).toHaveAttribute('aria-pressed', 'true')

  expect(erros, 'o editor jogou erro ao cravar o rótulo ou ao escrever no painel').toEqual([])
})

test('com a ferramenta Texto, digitar no mapa escreve no rótulo e não troca de ferramenta', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  await pegarFerramentaTexto(page)

  // ---------------------------------------------------------------------
  // CALIBRAÇÃO 1 — a tela está parada e o fundo dos dois pontos é o mesmo.
  // É o que autoriza, lá no fim, comparar a foto de um ponto com a de outro.
  // ---------------------------------------------------------------------
  const vazioReferencia = await telaEstavel(page, caixa, P_REFERENCIA)
  const vazioDigitado = await fotoDoRotulo(page, caixa, P_DIGITADO)
  expect(
    vazioDigitado.equals(vazioReferencia),
    'o fundo dos dois pontos do mapa vazio não é igual: comparar o desenho de um ponto com o de outro não provaria nada',
  ).toBe(true)

  // ---------------------------------------------------------------------
  // O GESTO QUE A JORNADA JULGA: cravar e digitar, sem tocar em mais nada.
  // ---------------------------------------------------------------------
  await cravarRotulo(page, caixa, P_DIGITADO)
  const rotuloRecemCriado = await fotoDoRotulo(page, caixa, P_DIGITADO)
  expect(
    rotuloRecemCriado.equals(vazioDigitado),
    `nada foi desenhado em (${P_DIGITADO.x}, ${P_DIGITADO.y}): a foto do recorte não enxerga rótulo nenhum`,
  ).toBe(false)

  await digitarNoMapa(page, PALAVRA)

  // ---------------------------------------------------------------------
  // PROVA 1 — digitar não é trocar de ferramenta.
  // ---------------------------------------------------------------------
  const barra = barraDeFerramentas(page)
  const pressionados = await barra
    .getByRole('button')
    .evaluateAll((botoes) =>
      botoes
        .filter((botao) => botao.getAttribute('aria-pressed') === 'true')
        .map((botao) => botao.getAttribute('aria-label') ?? ''),
    )
  // `soft`: as duas provas são independentes e as duas interessam ao relatório.
  // Com `expect` duro a primeira abortaria o teste e a segunda nunca rodaria.
  expect.soft(
    await botaoDaFerramenta(page, 'Texto').getAttribute('aria-pressed'),
    `digitar "${PALAVRA}" no mapa tirou a ferramenta Texto da mão — cada letra virou atalho de ferramenta. Pressionado(s) agora na barra: ${pressionados.join(' | ') || '(nenhum)'}`,
  ).toBe('true')

  const rotuloDigitado = await fotoDoRotulo(page, caixa, P_DIGITADO)

  // ---------------------------------------------------------------------
  // A REFERÊNCIA — um rótulo com o texto `SAIDA`, escrito pelo caminho que
  // funciona hoje, no OUTRO ponto. Vem depois de propósito: assim o gesto
  // julgado acontece num editor recém-aberto, sem nada antes dele.
  // ---------------------------------------------------------------------
  await pegarFerramentaTexto(page)
  await cravarRotulo(page, caixa, P_REFERENCIA)
  const rotuloReferencia = await fotoDoRotulo(page, caixa, P_REFERENCIA)

  // CALIBRAÇÃO 2 — o MESMO rótulo recém-criado desenha igual nos dois pontos.
  // Sem ela, "as fotos saíram diferentes" poderia ser só o lugar da tela.
  expect(
    rotuloReferencia.equals(rotuloRecemCriado),
    'o mesmo rótulo recém-criado saiu com foto diferente nos dois pontos: a comparação entre pontos não é confiável',
  ).toBe(true)

  await escreverPeloPainel(page, PALAVRA)
  const referenciaComPalavra = await fotoDoRotulo(page, caixa, P_REFERENCIA)
  expect(
    referenciaComPalavra.equals(rotuloReferencia),
    `a referência não mudou ao receber "${PALAVRA}" pelo painel: sem ela não há com o que comparar`,
  ).toBe(false)

  // ---------------------------------------------------------------------
  // PROVA 2 — o rótulo em que a pessoa DIGITOU tem de estar desenhado igual
  // ao rótulo que recebeu a mesma palavra pelo painel.
  // ---------------------------------------------------------------------
  expect(
    rotuloDigitado.equals(referenciaComPalavra),
    `o rótulo em (${P_DIGITADO.x}, ${P_DIGITADO.y}) não ficou com "${PALAVRA}" escrito: ` +
      (rotuloDigitado.equals(rotuloRecemCriado)
        ? 'ele continua exatamente o "Rótulo" que nasceu ali — nenhuma letra entrou'
        : 'ele mudou, mas não virou o mesmo desenho do rótulo que recebeu a palavra pelo painel'),
  ).toBe(true)

  expect(erros, 'o editor jogou erro ao digitar no mapa com a ferramenta Texto').toEqual([])
})
