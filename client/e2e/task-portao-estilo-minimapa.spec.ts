// COMANDO DA INVARIANTE 1 — "estilo visual obrigatório, minimapa de Resident
// Evil: chão chapado numa cor, parede como linha clara fina, porta como
// retângulo pequeno, fundo escuro, sem grade por padrão. Nunca hachura, nunca
// pergaminho, nunca parede preta grossa."
//
// POR QUE ESTE ARQUIVO EXISTE. A Invariante 1 era a única da bar sem NENHUM
// comando: os passos declarados do portão eram tipos, unidade e três jornadas,
// e nenhum deles olha um pixel de estilo. Invariante sem comando é texto —
// quem julga vira o gosto de quem lê o diff.
//
// COMO ELE MEDE, sem decodificador de PNG no projeto (não há `@types/node`
// nem pngjs aqui): duas técnicas, as duas verificadas em 17/09/2026 neste
// repositório antes de virarem asserção.
//
//   COR EXATA. Uma página `data:` com `background:#rrggbb` fotografada em 1x1
//   dá os MESMOS bytes de PNG que o pixel do canvas quando a cor é a mesma
//   (medido: fundo do editor === referência #2b2b2b, 87 bytes idênticos).
//   Então dá para afirmar cor exata comparando Buffer com Buffer.
//
//   CHAPADO. "Uma cor só, sem trama" vira: a mesma janela fotografada na
//   origem e deslocada (37,23) e (13,41) px dá bytes idênticos. Deslocamento
//   primo em relação ao passo da grade (64 px) e ao da hachura: qualquer
//   linha, trama ou textura muda de fase e os bytes divergem. Medido: fundo
//   chapado = true; com "Mostrar grade" ligada = false; chão da sala = true;
//   com "Hachurado" ligado = false. O detector tem dente PROVADO, e a prova
//   roda junto como controle positivo de cada teste.
//
// O QUE ELE NÃO PROVA, para ninguém confundir verde com beleza: não julga se o
// marrom do chão é o marrom certo, não mede a porta, e não olha o mapa inteiro
// — só o gesto de cada teste. Isso continua sendo trabalho do crítico cego.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Fundo do mapa novo — `lib/mapFactory.ts:createEmptyMap` (`background.src`). */
const COR_DO_FUNDO = '#2b2b2b'
/** Linha de parede — `pixi/drawWalls.ts:56` (`WALL_COLOR = 0xd8d2c4`), clara de propósito. */
const COR_DA_PAREDE = '#d8d2c4'
/**
 * Teto da parede PADRÃO na tela, em px, a 100% de zoom. O desenho de hoje sai
 * com 2 px (`drawWalls.ts`, medido nesta máquina em 17/09/2026); 4 é a folga
 * para antialias de ponta e para meia-espessura em tela de outra densidade.
 *
 * Cuidado ao mexer: o teto é da parede que a pessoa acabou de traçar SEM pedir
 * grossura nenhuma. Parede que o usuário engrossou de propósito ("virar
 * muralha") não passa por aqui — senão este comando proibiria a feature que a
 * bar deste run pede.
 */
const TETO_DA_PAREDE_PADRAO_PX = 4

const PAINT_MS = 200
const PAUSA_ANTES_DE_SOLTAR_MS = 120
const PASSOS_DO_ARRASTO = 12

/** Deslocamentos de fase para provar "uma cor só". Primos com 64 (grade) e com
 *  o passo da hachura — trama nenhuma casa nos dois ao mesmo tempo. */
const DESLOCAMENTOS: Array<[number, number]> = [
  [0, 0],
  [37, 23],
  [13, 41],
]

type Foto = Awaited<ReturnType<Page['screenshot']>>

async function janela(page: Page, x: number, y: number, width: number, height: number): Promise<Foto> {
  return page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width, height } })
}

/** Bytes de PNG de uma cor sólida, produzidos pelo MESMO encoder do screenshot. */
async function referenciaDeCor(page: Page, hex: string): Promise<Foto> {
  const outra = await page.context().newPage()
  try {
    await outra.setViewportSize({ width: 200, height: 200 })
    await outra.goto(`data:text/html,<body style="margin:0;background:%23${hex.slice(1)}">`)
    return await outra.screenshot({ clip: { x: 100, y: 100, width: 1, height: 1 } })
  } finally {
    await outra.close()
  }
}

/** Verdadeiro quando a janela é uma cor só: bytes iguais em três fases diferentes. */
async function estaChapado(page: Page, x: number, y: number, width: number, height: number): Promise<boolean> {
  const fotos: Foto[] = []
  for (const [dx, dy] of DESLOCAMENTOS) fotos.push(await janela(page, x + dx, y + dy, width, height))
  return fotos.every((f) => f.equals(fotos[0]))
}

/** Interruptor da barra lateral (`components/Toggle.tsx`): o input real fica
 *  escondido atrás do trilho, então o gesto é no rótulo, como o da pessoa. */
function interruptor(page: Page, rotulo: string) {
  return page.locator('label.lb-switch').filter({ hasText: rotulo }).locator('input')
}

async function ferramenta(page: Page, label: 'Selecionar' | 'Parede' | 'Sala'): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

async function arrastar(page: Page, de: { x: number; y: number }, para: { x: number; y: number }): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(de.x + (para.x - de.x) * t, de.y + (para.y - de.y) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('1. mapa novo nasce com fundo escuro chapado e SEM grade (e o portão sabe ver grade quando ela aparece)', async ({ page }) => {
  const fundo = await janela(page, 900, 200, 1, 1)
  const referencia = await referenciaDeCor(page, COR_DO_FUNDO)
  expect(fundo.equals(referencia), `o fundo do editor deixou de ser ${COR_DO_FUNDO}`).toBe(true)

  expect(await estaChapado(page, 880, 180, 140, 100), 'o fundo do mapa novo não é uma cor só').toBe(true)

  // CONTROLE POSITIVO: a mesma medida tem de REPROVAR com a grade ligada.
  // Sem isto, "chapado" passaria igual com o detector cego.
  const grade = interruptor(page, 'Mostrar grade')
  await grade.check({ force: true })
  await page.waitForTimeout(PAINT_MS)
  expect(await estaChapado(page, 880, 180, 140, 100), 'a medida de chapado não enxerga nem uma grade desenhada').toBe(false)

  await grade.uncheck({ force: true })
  await page.waitForTimeout(PAINT_MS)
  expect(await estaChapado(page, 880, 180, 140, 100)).toBe(true)
})

test('2. parede recém-traçada é linha CLARA e FINA: banda estreita, toda na cor da parede, nunca preta', async ({ page }) => {
  await ferramenta(page, 'Parede')
  await arrastar(page, { x: 600, y: 400 }, { x: 800, y: 400 })
  // Sem seleção por cima: o realce amarelo entraria na medida da banda.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(PAINT_MS)

  const referenciaFundo = await referenciaDeCor(page, COR_DO_FUNDO)
  const referenciaParede = await referenciaDeCor(page, COR_DA_PAREDE)

  // Corte perpendicular à parede: px a px, quais não são fundo.
  const banda: number[] = []
  const forasDaCor: number[] = []
  for (let y = 380; y <= 420; y++) {
    const p = await janela(page, 700, y, 1, 1)
    if (p.equals(referenciaFundo)) continue
    banda.push(y)
    if (!p.equals(referenciaParede)) forasDaCor.push(y)
  }

  // Controle positivo primeiro: sem parede desenhada a banda é 0 e qualquer
  // teto passaria sozinho.
  expect(banda.length, 'não há parede nenhuma na perpendicular medida').toBeGreaterThan(0)
  expect(banda.length, `a parede padrão ocupa ${banda.length} px de tela (linhas ${banda.join(',')})`).toBeLessThanOrEqual(
    TETO_DA_PAREDE_PADRAO_PX,
  )
  expect(forasDaCor, `px da parede fora de ${COR_DA_PAREDE} (linhas ${forasDaCor.join(',')})`).toEqual([])
})

test('3. chão da sala é chapado — e o portão reprova a hachura, que a Invariante 1 proíbe', async ({ page }) => {
  await ferramenta(page, 'Sala')
  await arrastar(page, { x: 400, y: 300 }, { x: 900, y: 700 })

  // Janela bem dentro da sala: as três fases do teste de chapado continuam
  // dentro dela, longe da borda e do rótulo do nome no centro.
  const dentro = { x: 450, y: 360, width: 100, height: 60 }
  expect(
    await estaChapado(page, dentro.x, dentro.y, dentro.width, dentro.height),
    'o chão da sala não é uma cor só',
  ).toBe(true)

  // CONTROLE POSITIVO: ligar "Hachurado" é exatamente o visual proibido.
  const hachura = interruptor(page, 'Hachurado')
  await hachura.check({ force: true })
  await page.waitForTimeout(PAINT_MS)
  expect(
    await estaChapado(page, dentro.x, dentro.y, dentro.width, dentro.height),
    'a medida de chapado não enxerga nem a hachura ligada no painel',
  ).toBe(false)

  await hachura.uncheck({ force: true })
  await page.waitForTimeout(PAINT_MS)
  expect(await estaChapado(page, dentro.x, dentro.y, dentro.width, dentro.height)).toBe(true)
})
