// JORNADA DO MARCADOR COM ÍCONE — escrita para SAIR VERMELHA hoje.
//
// A feature pedida: marcador de mapa com ÍCONE ESCOLHÍVEL — baú, armadilha,
// chave, perigo, escada, água. Hoje o marcador do editor (a ferramenta Pino,
// "Ponto de interesse") só tem dois tipos e os dois são pontuação: "!" e "?"
// (`lib/pins.ts:PIN_GLYPH`). O mestre que quer dizer "aqui tem um baú" e "aqui
// tem uma armadilha" crava dois marcadores IDÊNTICOS e tem de abrir cada um
// para lembrar qual é qual.
//
// O que esta jornada cobra, tudo no que APARECE NA TELA:
//   1. dá para escolher o ícone de um marcador já cravado, pelo painel dele;
//   2. o desenho do marcador com ícone de BAÚ é diferente do desenho do
//      marcador genérico de hoje, NO MESMO PONTO DA TELA;
//   3. o mesmo vale para ARMADILHA;
//   4. os dois marcadores com ícone são diferentes ENTRE SI — escolher ícone
//      diferente não pode dar o mesmo desenho.
//
// COMO ELA COMPARA SEM SE ENGANAR. Toda comparação decisiva é NO MESMO PONTO:
// o marcador é cravado, fotografado genérico, e só então recebe o ícone e é
// fotografado de novo — mesmo ponto, mesma seleção, mesmo fundo; o que mudou
// foi o ícone. A única comparação entre pontos diferentes (baú x armadilha)
// vem depois de duas calibrações que provam que ponto diferente não muda a
// foto: o fundo vazio dos três pontos é byte a byte igual, e o MESMO marcador
// genérico cravado em dois pontos sai byte a byte igual.
//
// Gesto de ponteiro de verdade (desce, fica parado, sobe) e asserção só no que
// a foto do recorte mostra. Nada de store, nada de `dispatchEvent`, nada de
// `evaluate` que escreve.
//
// Os três pontos ficam longe do painel da esquerda (que cobre o canvas até
// x~240) e afastados 240 px entre si, para os recortes de 80 px nunca se
// tocarem.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Onde cada marcador é cravado, em px do canvas. */
const P1 = { x: 520, y: 380 }
const P2 = { x: 760, y: 380 }
const P3 = { x: 1000, y: 380 }
/** Metade da aresta do recorte. O marcador tem 34 px de altura e cabeça de 11 px de raio. */
const RAIO_DO_RECORTE = 40
/** Botão parado antes de soltar: é o que separa um toque de pessoa de um clique instantâneo. */
const TOQUE_MS = 150
/** Folga para o Pixi terminar de pintar antes da foto. */
const PINTURA_MS = 400

/** A ferramenta de marcador, como a barra pode chamá-la. */
const NOME_DA_FERRAMENTA = /pino|ponto de interesse|marcador/i
/**
 * Os dois ícones que esta jornada escolhe, da lista pedida (baú, armadilha,
 * chave, perigo, escada, água). "Escada" e "Chave" ficam de fora de propósito:
 * "Escada" já é o nome de uma ferramenta da barra e o controle certo ficaria
 * ambíguo. Nenhum controle do editor de hoje casa com estes dois nomes
 * (conferido em 20/09/2026) — é aqui que a jornada sai vermelha.
 */
const ICONE_BAU = /ba[úu]/i
const ICONE_ARMADILHA = /armadilha/i

/** O tipo da foto vem da própria API: o tsconfig dos e2e não carrega os tipos do Node. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Ponto {
  x: number
  y: number
}

function recorteAoRedor(ponto: Ponto): { x: number; y: number; width: number; height: number } {
  return {
    x: ponto.x - RAIO_DO_RECORTE,
    y: ponto.y - RAIO_DO_RECORTE,
    width: RAIO_DO_RECORTE * 2,
    height: RAIO_DO_RECORTE * 2,
  }
}

/** Toque de pessoa: desce, fica parado um instante, sobe. */
async function tocarComoPessoa(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(TOQUE_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Todo nome acessível de controle na tela — só para a falha dizer o que EXISTE hoje. */
async function nomesDeControleNaTela(page: Page): Promise<string[]> {
  return page
    .locator('button, [role="radio"], [role="menuitemradio"], [role="checkbox"], [role="tab"]')
    .evaluateAll((elementos) =>
      elementos
        .map((elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? '')
        .filter((nome) => nome !== ''),
    )
}

/**
 * Um controle com este nome acessível, em qualquer papel plausível (a barra usa
 * `button` com `aria-label`, o painel de ferramenta usa `radio`, a setinha de
 * variantes usa `menuitemradio`). Falha listando o que a tela oferece hoje.
 */
async function controlePorNome(page: Page, nome: RegExp, oQueEra: string): Promise<Locator> {
  const alvo = page
    .getByRole('button', { name: nome })
    .or(page.getByRole('radio', { name: nome }))
    .or(page.getByRole('menuitemradio', { name: nome }))
    .or(page.getByRole('checkbox', { name: nome }))
    .or(page.getByRole('tab', { name: nome }))
  const quantos = await alvo.count()
  if (quantos === 0) {
    const existentes = await nomesDeControleNaTela(page)
    expect(
      quantos,
      `${oQueEra}: nenhum controle com nome ${String(nome)} na tela. O que a tela oferece hoje: ${existentes.join(' | ')}`,
    ).toBeGreaterThan(0)
  }
  return alvo.first()
}

/** Caixa do `<canvas>` do editor (os painéis flutuam por cima dele). */
async function caixaDoCanvas(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return caixa
}

/** Foto do recorte em volta de um ponto do canvas. */
async function foto(page: Page, caixa: { x: number; y: number }, ponto: Ponto): Promise<Foto> {
  const recorte = recorteAoRedor({ x: caixa.x + ponto.x, y: caixa.y + ponto.y })
  return page.screenshot({ clip: recorte })
}

/**
 * Controle negativo obrigatório: parada, a tela é estável. Sem isto,
 * "as fotos saíram diferentes" não provaria nada — bastaria o canvas tremer.
 */
async function telaEstavel(page: Page, caixa: { x: number; y: number }, ponto: Ponto): Promise<Foto> {
  await page.waitForTimeout(PINTURA_MS)
  const primeira = await foto(page, caixa, ponto)
  await page.waitForTimeout(PINTURA_MS)
  const segunda = await foto(page, caixa, ponto)
  expect(
    primeira.equals(segunda),
    'a tela do editor muda sozinha parada: nenhuma comparação de fotos provaria a diferença entre dois desenhos',
  ).toBe(true)
  return segunda
}

/** Põe a ferramenta de marcador na mão. */
async function pegarFerramentaDeMarcador(page: Page): Promise<void> {
  const ferramenta = await controlePorNome(page, NOME_DA_FERRAMENTA, 'ferramenta de marcador na barra do mestre')
  await ferramenta.click()
}

/** Crava um marcador no ponto e confere que o painel dele abriu. */
async function cravarMarcador(page: Page, caixa: { x: number; y: number }, ponto: Ponto): Promise<void> {
  await tocarComoPessoa(page, caixa.x + ponto.x, caixa.y + ponto.y)
  await expect(
    page.getByRole('heading', { name: NOME_DA_FERRAMENTA }),
    `cravar em (${ponto.x}, ${ponto.y}) não abriu o painel do marcador: nada foi criado`,
  ).toBeVisible({ timeout: 5000 })
}

test('CONTROLE POSITIVO: o mapa abre e o marcador genérico de hoje aparece onde o mestre crava', async ({ page }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  expect(
    Math.min(caixa.width, caixa.height),
    `o canvas veio ${Math.round(caixa.width)}x${Math.round(caixa.height)}: os pontos desta jornada (até x=1000) não cabem nele`,
  ).toBeGreaterThan(600)

  await pegarFerramentaDeMarcador(page)
  const vazio = await telaEstavel(page, caixa, P1)

  await cravarMarcador(page, caixa, P1)

  const comMarcador = await foto(page, caixa, P1)
  expect(
    comMarcador.equals(vazio),
    `nada foi desenhado em (${P1.x}, ${P1.y}) depois de cravar: a foto do recorte não enxerga marcador nenhum`,
  ).toBe(false)

  expect(erros, 'o editor jogou erro ao cravar o marcador genérico').toEqual([])
})

test('dois marcadores com ícones diferentes desenham diferente entre si e diferente do marcador genérico', async ({ page }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))

  await enterEditor(page)
  const caixa = await caixaDoCanvas(page)
  await pegarFerramentaDeMarcador(page)

  // ---------------------------------------------------------------------
  // CALIBRAÇÃO 1 — a tela está parada e o fundo dos três pontos é o mesmo.
  // É o que autoriza, lá no fim, comparar a foto de um ponto com a de outro.
  // ---------------------------------------------------------------------
  const vazioP1 = await telaEstavel(page, caixa, P1)
  const vazioP2 = await foto(page, caixa, P2)
  const vazioP3 = await foto(page, caixa, P3)
  expect(
    vazioP2.equals(vazioP1) && vazioP3.equals(vazioP1),
    'o fundo dos três pontos do mapa vazio não é igual: comparar o desenho de um ponto com o de outro não provaria nada',
  ).toBe(true)

  // ---------------------------------------------------------------------
  // PISO — o marcador genérico de hoje aparece, e aparece IGUAL em dois
  // pontos. Sem este piso, "as fotos saíram diferentes" poderia ser só o
  // lugar da tela, e "saíram iguais" poderia ser a foto não ver marcador
  // nenhum.
  // ---------------------------------------------------------------------
  await cravarMarcador(page, caixa, P1)
  const genericoP1 = await foto(page, caixa, P1)
  expect(
    genericoP1.equals(vazioP1),
    `nada foi desenhado em (${P1.x}, ${P1.y}): a foto do recorte não enxerga marcador nenhum`,
  ).toBe(false)

  await cravarMarcador(page, caixa, P2)
  const genericoP2 = await foto(page, caixa, P2)
  expect(
    genericoP2.equals(genericoP1),
    'o MESMO marcador genérico cravado em dois pontos saiu com foto diferente: a comparação entre pontos não é confiável',
  ).toBe(true)

  // ---------------------------------------------------------------------
  // PROVA 1 e 2 — escolher o ícone BAÚ muda o desenho do marcador de P2.
  // Mesmo ponto, mesma seleção, mesmo fundo: o que mudou foi o ícone.
  // ---------------------------------------------------------------------
  const bau = await controlePorNome(page, ICONE_BAU, 'ícone de baú no painel do marcador')
  await bau.click()
  await page.waitForTimeout(PINTURA_MS)
  const bauP2 = await foto(page, caixa, P2)
  expect(
    bauP2.equals(genericoP2),
    `escolher o ícone de baú não mudou nada no desenho em (${P2.x}, ${P2.y}): o marcador continua o genérico`,
  ).toBe(false)

  // ---------------------------------------------------------------------
  // PROVA 3 — o mesmo para ARMADILHA, em P3.
  // ---------------------------------------------------------------------
  await cravarMarcador(page, caixa, P3)
  const genericoP3 = await foto(page, caixa, P3)
  expect(
    genericoP3.equals(genericoP1),
    'o marcador genérico cravado no terceiro ponto saiu com foto diferente dos outros dois: a comparação entre pontos não é confiável',
  ).toBe(true)

  const armadilha = await controlePorNome(page, ICONE_ARMADILHA, 'ícone de armadilha no painel do marcador')
  await armadilha.click()
  await page.waitForTimeout(PINTURA_MS)
  const armadilhaP3 = await foto(page, caixa, P3)
  expect(
    armadilhaP3.equals(genericoP3),
    `escolher o ícone de armadilha não mudou nada no desenho em (${P3.x}, ${P3.y}): o marcador continua o genérico`,
  ).toBe(false)

  // ---------------------------------------------------------------------
  // PROVA 4 — e os dois ícones não podem desenhar a mesma coisa.
  // ---------------------------------------------------------------------
  expect(
    bauP2.equals(armadilhaP3),
    'o marcador de baú e o de armadilha desenham exatamente a mesma coisa: escolher o ícone não muda o que o mestre vê no mapa',
  ).toBe(false)

  expect(erros, 'o editor jogou erro ao escolher o ícone do marcador').toEqual([])
})
