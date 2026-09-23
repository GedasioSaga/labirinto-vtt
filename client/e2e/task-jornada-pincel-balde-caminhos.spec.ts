// JORNADA VERMELHA — "pincel de blocos com balde + caminhos com cor por caminho".
//
// Escrita ANTES de existir a feature, de propósito: o que ela descreve é o que
// a pessoa quer fazer, não o que o app faz hoje. Hoje ela falha, e falha pelo
// motivo certo — não existe pincel de blocos na grade, não existe balde, e a
// cor do chão é UMA SÓ para o mapa inteiro (`FloorStyle` em
// `src/types/map.ts`, aplicada a todas as peças em `src/pixi/drawFloor.ts`).
//
// COMO ELA PROVA. Mesmo par de técnicas de `task-portao-estilo-minimapa.spec.ts`,
// já verificado neste repositório: uma página `data:` com a cor sólida,
// fotografada em 1x1, dá os MESMOS bytes de PNG que o pixel do canvas quando a
// cor é a mesma. Então "aqui tem chão" e "aqui continua vazio" são comparações
// de Buffer com Buffer, lidas da TELA — nunca da store.
//
// COMO ELA MEDE ALINHAMENTO À GRADE (teste 1). O arrasto passa de propósito
// FORA do centro da célula (`DESVIO_DO_CENTRO`): um pincel preso à grade pinta
// a célula inteira, de borda a borda; um traço livre pintaria uma fita centrada
// no ponteiro, deslocada pelo mesmo desvio. Os dois pixels de controle —
// dentro da célula de cima, antes do ponteiro; e dentro da célula de baixo,
// onde uma fita livre vazaria — separam um do outro.
//
// O QUE ELA NÃO PROVA: não julga qual marrom, não mede a espessura da parede da
// borda (isso é de `task-portao-estilo-minimapa.spec.ts`) e não olha bloqueio de
// token nem de visão — isso é jornada de outro gesto.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Lado da célula do mapa de teste, em px de mundo (`createEmptyMap(..., 64)`). */
const GRADE = 64
/** Fundo do mapa novo — `lib/mapFactory.ts` (`background.src`): "aqui não tem chão". */
const COR_DO_FUNDO = '#2b2b2b'
/** Chão do mapa novo — `lib/mapFile.ts` (`DEFAULT_FLOOR_STYLE.fillColor`). */
const COR_DO_CHAO = '#a8776a'
/** Cores que a pessoa escolhe para cada caminho no teste 4. */
const COR_DO_CAMINHO_A = '#3a7ad9'
const COR_DO_CAMINHO_B = '#d94f3a'

const PAINT_MS = 250
const PAUSA_ANTES_DE_SOLTAR_MS = 120
const PASSOS_DO_ARRASTO = 14
/**
 * Teto próprio de cada teste, SOMADO ao do teste (nunca no lugar dele). Toda
 * pincelada é um gesto de 14 passos de ponteiro, e cada leitura de cor é uma
 * foto. Com a máquina carregada (22/09/2026, CPU em 100% com outras lanes,
 * reporter de passos, 4 workers como o portão roda) cada `Mouse move` custou
 * até 2,7 s, cada `Mouse up` até 5,1 s e cada `Fill` de cor até 5,1 s: o corpo
 * dos testes 1 e 2 (uma ou duas pinceladas) passou dos 30 s do teste, e o do 4
 * (três pinceladas + duas seleções + duas cores) passou de 50 s. O 3 e o 4
 * ganham o dobro. Nenhuma asserção muda: é tempo para o MESMO gesto e as
 * MESMAS fotos, não tolerância na prova.
 */
const TETO_EXTRA_DO_GESTO_MS = 30_000
const TETO_EXTRA_DO_GESTO_LONGO_MS = 60_000
/** Quanto o arrasto passa longe do centro da célula — ver cabeçalho, teste 1. */
const DESVIO_DO_CENTRO = 18

type Foto = Awaited<ReturnType<Page['screenshot']>>
interface Ponto {
  x: number
  y: number
}

/** Referências de cor sólida, uma por cor — o mesmo encoder do screenshot. */
const referencias = new Map<string, Foto>()

/**
 * UMA aba de referência por worker, reaproveitada para todas as cores.
 *
 * Antes cada cor nova abria e fechava uma aba (`context().newPage()` + `goto`
 * de `data:`): uma aba nova é um processo de renderização novo, e com a
 * máquina carregada isso mediu até 7,4 s no `Create page` e 8,9 s no
 * `Navigate` — duas a quatro vezes por teste (fundo, chão, caminho A e B),
 * dentro do orçamento do teste. Agora a aba nasce uma vez, fora do contexto
 * do teste (vive com o navegador do worker), e cada cor é só um
 * `setContent`. A foto continua saindo do MESMO encoder de screenshot do
 * mesmo navegador; e se um dia os bytes não baterem, os controles positivos
 * de cada teste (`corNaTela(..., COR_DO_FUNDO)` num ponto vazio) ficam
 * vermelhos — erro de referência não vira verde.
 */
let abaDeReferencia: Page | null = null

async function abaDeReferenciaDoWorker(page: Page): Promise<Page> {
  if (abaDeReferencia && !abaDeReferencia.isClosed()) return abaDeReferencia
  const navegador = page.context().browser()
  // Sem navegador (contexto persistente), fica no contexto do teste e fecha com ele.
  const aba = navegador ? await navegador.newPage() : await page.context().newPage()
  await aba.setViewportSize({ width: 200, height: 200 })
  abaDeReferencia = aba
  return aba
}

async function referenciaDeCor(page: Page, hex: string): Promise<Foto> {
  const guardada = referencias.get(hex)
  if (guardada) return guardada
  const aba = await abaDeReferenciaDoWorker(page)
  await aba.setContent(`<body style="margin:0;background:${hex}"></body>`)
  const foto = await aba.screenshot({ clip: { x: 100, y: 100, width: 1, height: 1 } })
  referencias.set(hex, foto)
  return foto
}

/** Ponto de tela para a coordenada de mundo, com o canvas medido AGORA: abrir a
 *  setinha de variantes rola o editor alguns px (nota de `task-floor-pieces`). */
async function naTela(page: Page, mundo: Ponto): Promise<Ponto> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x + mundo.x, y: box.y + mundo.y }
}

/** Centro da célula (coluna, linha) em px de mundo. */
function centro(coluna: number, linha: number): Ponto {
  return { x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 }
}

/** Verdadeiro quando o pixel de mundo tem exatamente a cor `hex`. */
async function corNaTela(page: Page, mundo: Ponto, hex: string): Promise<boolean> {
  const p = await naTela(page, mundo)
  const foto = await page.screenshot({ clip: { x: Math.round(p.x), y: Math.round(p.y), width: 1, height: 1 } })
  return foto.equals(await referenciaDeCor(page, hex))
}

async function temChao(page: Page, mundo: Ponto): Promise<boolean> {
  return !(await corNaTela(page, mundo, COR_DO_FUNDO))
}

/** Tira o ponteiro e a seleção da frente antes de medir pixel. */
async function limparAVista(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  const longe = await naTela(page, { x: 1100, y: 120 })
  await page.mouse.move(longe.x, longe.y)
  await page.waitForTimeout(PAINT_MS)
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Chão'): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/**
 * Procura a ferramenta pelo NOME QUE A PESSOA VÊ — primeiro um botão da barra,
 * depois um rádio dentro de "Opções de Chão" (o caminho de UI das variantes de
 * chão que já existe). Não achou em lugar nenhum: vermelho honesto, com o nome
 * procurado na mensagem.
 */
async function escolherNoChao(page: Page, nome: RegExp, oQueElaProcura: string): Promise<void> {
  const naBarra = page.getByRole('button', { name: nome })
  if ((await naBarra.count()) > 0) {
    await naBarra.first().click()
    return
  }
  await page.getByRole('button', { name: 'Opções de Chão', exact: true }).click()
  const opcao = page.getByRole('group', { name: 'Opções de Chão' }).getByRole('radio', { name: nome })
  await expect(opcao, `${oQueElaProcura}: nada chamado ${nome.source} na barra nem em "Opções de Chão"`).toHaveCount(1)
  await opcao.click()
}

async function pegarOPincelDeBlocos(page: Page, blocos: 1 | 2 | 3): Promise<void> {
  await ferramenta(page, 'Chão')
  await escolherNoChao(page, /Pincel de blocos|Pincel de chão|Blocos/, 'o pincel de blocos da grade')
  await escolherNoChao(page, new RegExp(`${blocos} bloco`), `o tamanho de ${blocos} bloco(s) do pincel`)
}

async function pegarOBalde(page: Page): Promise<void> {
  await ferramenta(page, 'Chão')
  await escolherNoChao(page, /Balde|Preencher área/, 'o balde que preenche a área fechada')
}

/** Arrasto de ponteiro DE VERDADE, com pausa antes de soltar. */
async function pintar(page: Page, de: Ponto, ate: Ponto, botao: 'left' | 'right' = 'left'): Promise<void> {
  const a = await naTela(page, de)
  const b = await naTela(page, ate)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down({ button: botao })
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up({ button: botao })
  await page.waitForTimeout(PAINT_MS)
}

async function clicar(page: Page, mundo: Ponto): Promise<void> {
  const p = await naTela(page, mundo)
  await page.mouse.move(p.x, p.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
}

/**
 * O swatch de cor DA PEÇA selecionada. Deliberadamente sem depender do rótulo
 * que a feature vai escolher: é qualquer `input[type=color]` do painel que não
 * seja um dos que já existem hoje — e o que existe hoje para chão é
 * `#lb-floor-fill-color`, "Cor do chão", que vale para o mapa INTEIRO.
 */
function corDaPecaSelecionada(page: Page) {
  return page.locator(
    '.lb-inspector__body input[type="color"]' +
      ':not(#lb-floor-fill-color):not(#lb-floor-stroke-color)' +
      ':not(#lb-draw-color):not(#lb-grid-color):not(#lb-text-color)' +
      ':not(#lb-region-color):not(#lb-light-color)',
  )
}

async function pintarCaminhoComCor(page: Page, de: Ponto, ate: Ponto, hex: string): Promise<void> {
  await pegarOPincelDeBlocos(page, 1)
  await pintar(page, de, ate)
  await ferramenta(page, 'Selecionar')
  await clicar(page, de)
  const swatch = corDaPecaSelecionada(page)
  await expect(swatch, `o caminho selecionado não tem cor própria — só existe "Cor do chão", do mapa inteiro`).toHaveCount(1)
  await swatch.fill(hex)
  await page.waitForTimeout(PAINT_MS)
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_pincel_balde', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('1. arrastar com o pincel pinta uma fita de blocos presa à grade, e fora do traço não nasce chão', async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_MS)
  await pegarOPincelDeBlocos(page, 1)

  // O arrasto passa FORA do centro da linha 5 — é isso que separa "preso à
  // grade" de "fita livre centrada no ponteiro".
  const y = 5 * GRADE + GRADE / 2 + DESVIO_DO_CENTRO
  await pintar(page, { x: 6 * GRADE + DESVIO_DO_CENTRO, y }, { x: 10 * GRADE + DESVIO_DO_CENTRO, y })
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('pincel-fita.png') })

  // A célula inteira pintou, inclusive o canto ANTES de onde o ponteiro entrou.
  expect(await temChao(page, { x: 6 * GRADE + 8, y: 5 * GRADE + 8 }), 'o canto da primeira célula ficou sem chão').toBe(true)
  expect(await corNaTela(page, centro(8, 5), COR_DO_CHAO), 'o meio da fita não tem a cor do chão').toBe(true)
  expect(await temChao(page, centro(10, 5)), 'a última célula do arrasto ficou sem chão').toBe(true)

  // CONTROLE POSITIVO: fora do traço continua vazio. O primeiro ponto é onde
  // uma fita livre (deslocada pelo desvio) vazaria para a linha de baixo.
  expect(await corNaTela(page, { x: 8 * GRADE + 32, y: 6 * GRADE + 12 }, COR_DO_FUNDO), 'a fita vazou para a célula de baixo').toBe(true)
  expect(await corNaTela(page, centro(8, 7), COR_DO_FUNDO), 'nasceu chão duas linhas abaixo do traço').toBe(true)
  expect(await corNaTela(page, centro(12, 5), COR_DO_FUNDO), 'nasceu chão depois do fim do arrasto').toBe(true)
})

test('2. botão DIREITO no mesmo traço apaga o chão que o esquerdo pintou', async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_MS)
  await pegarOPincelDeBlocos(page, 1)
  const y = centro(0, 5).y
  await pintar(page, { x: centro(6, 5).x, y }, { x: centro(10, 5).x, y })
  await limparAVista(page)

  // CONTROLE POSITIVO: sem chão pintado, apagar passaria com o app morto.
  expect(await corNaTela(page, centro(8, 5), COR_DO_CHAO), 'o traço do botão esquerdo não pintou nada para apagar').toBe(true)

  await pegarOPincelDeBlocos(page, 1)
  await pintar(page, { x: centro(6, 5).x, y }, { x: centro(10, 5).x, y }, 'right')
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('pincel-apagado.png') })

  expect(await corNaTela(page, centro(6, 5), COR_DO_FUNDO), 'o começo do traço continua com chão depois do botão direito').toBe(true)
  expect(await corNaTela(page, centro(8, 5), COR_DO_FUNDO), 'o meio do traço continua com chão depois do botão direito').toBe(true)
  expect(await corNaTela(page, centro(10, 5), COR_DO_FUNDO), 'o fim do traço continua com chão depois do botão direito').toBe(true)
})

test('3. balde clicado dentro de uma área fechada enche a área inteira e não vaza para fora', async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_LONGO_MS)
  await pegarOPincelDeBlocos(page, 1)
  // Anel fechado: colunas 6..11, linhas 4..9. O miolo (7..10 x 5..8) fica vazio.
  await pintar(page, centro(6, 4), centro(11, 4))
  await pintar(page, centro(6, 9), centro(11, 9))
  await pintar(page, centro(6, 4), centro(6, 9))
  await pintar(page, centro(11, 4), centro(11, 9))
  await limparAVista(page)

  // CONTROLE POSITIVO, os dois lados: o anel existe e o miolo ainda está vazio.
  expect(await temChao(page, centro(6, 4)), 'o anel não foi desenhado').toBe(true)
  expect(await corNaTela(page, centro(8, 6), COR_DO_FUNDO), 'o miolo já nasceu cheio — o balde não teria o que provar').toBe(true)

  await pegarOBalde(page)
  await clicar(page, centro(8, 6))
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('balde-preenchido.png') })

  expect(await corNaTela(page, centro(8, 6), COR_DO_CHAO), 'o balde não encheu o ponto clicado').toBe(true)
  expect(await temChao(page, centro(7, 5)), 'o balde não chegou ao canto de cima do miolo').toBe(true)
  expect(await temChao(page, centro(10, 8)), 'o balde não chegou ao canto de baixo do miolo').toBe(true)

  // CONTROLE POSITIVO: fora da área fechada continua vazio — o balde não vazou.
  expect(await corNaTela(page, centro(13, 6), COR_DO_FUNDO), 'o balde vazou para a direita do anel').toBe(true)
  expect(await corNaTela(page, centro(8, 11), COR_DO_FUNDO), 'o balde vazou para baixo do anel').toBe(true)
})

test('4. dois caminhos com cores diferentes no mesmo mapa aparecem cada um com a SUA cor, e o chão continua com a dele', async ({ page }, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_LONGO_MS)
  // Chão de verdade primeiro: pincel de 3 blocos, uma passada só.
  await pegarOPincelDeBlocos(page, 3)
  await pintar(page, centro(6, 5), centro(11, 5))
  await limparAVista(page)
  expect(await corNaTela(page, centro(8, 5), COR_DO_CHAO), 'o chão base não foi pintado').toBe(true)

  await pintarCaminhoComCor(page, centro(6, 8), centro(11, 8), COR_DO_CAMINHO_A)
  await pintarCaminhoComCor(page, centro(6, 10), centro(11, 10), COR_DO_CAMINHO_B)
  await limparAVista(page)
  await page.screenshot({ path: testInfo.outputPath('caminhos-com-cor.png') })

  expect(await corNaTela(page, centro(8, 8), COR_DO_CAMINHO_A), `o caminho A não está em ${COR_DO_CAMINHO_A}`).toBe(true)
  expect(await corNaTela(page, centro(8, 10), COR_DO_CAMINHO_B), `o caminho B não está em ${COR_DO_CAMINHO_B}`).toBe(true)
  // O que hoje é impossível: pintar um caminho não pode repintar o chão nem o outro caminho.
  expect(await corNaTela(page, centro(8, 5), COR_DO_CHAO), 'a cor de um caminho arrastou o chão junto').toBe(true)
})
