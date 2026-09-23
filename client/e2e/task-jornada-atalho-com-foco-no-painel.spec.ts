// JORNADA VERMELHA — "apertei a tecla e nada aconteceu".
//
// Achados 10 e 11 do passeio de 20/09/2026 (`docs/passeio-2026-09-20.md`):
//   10. depois de clicar no painel CAMADAS, a tecla W (Parede) não faz nada
//       até alguém clicar no mapa;
//   11. no painel PONTO DE INTERESSE, a tecla ? não troca o tipo do pino —
//       só o clique no botão troca.
//
// DECISÃO que esta régua cobra: atalho de uma tecla funciona com o foco em
// qualquer lugar que NÃO seja campo de texto (input, textarea, contenteditable,
// select). Dentro de campo de texto, a letra continua sendo texto.
//
// MEDIDO em 22/09/2026, no código de hoje:
//   - clicar no TÍTULO "Camadas" (um <button>) e apertar W FUNCIONA — virou
//     controle abaixo. O que reproduz o achado 10 é clicar no interruptor
//     "Mostrar grade", o primeiro controle da seção CAMADAS: ele é um
//     <input type="checkbox">, e `isEditableTarget` (`src/lib/keymap.ts`)
//     trata TODO INPUT como campo de texto, então `resolveShortcut` devolve
//     null para a letra;
//   - não existe atalho "?" para o tipo do pino em lugar nenhum: nem com o
//     foco no mapa. `resolveShortcut` devolve null para qualquer tecla com
//     Shift, e não há ação de tipo de pino no mapa de teclas. O caso (b) cobra
//     a decisão inteira: com o painel do pino em foco, "?" troca o tipo.
//
// CONTROLES:
//   - positivo: com o foco no mapa, W põe a Parede na mão (a tecla e a leitura
//     de `aria-pressed` funcionam — sem isto, (a) vermelho podia ser a leitura);
//   - anti-regressão: W digitado no campo de nome de uma sala vira letra no
//     campo e NÃO troca de ferramenta. É a metade da decisão que já vale hoje
//     e não pode quebrar quando (a) e (b) forem consertados.
//
// REGRAS DE JORNADA: clique real de ponteiro e tecla real; nenhum `evaluate`
// que mude estado na ação sob teste (o mapa vazio de partida vem do
// `loadMap`, como nas vizinhas); toda afirmação é sobre o que está na tela.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

const PAUSA_ANTES_DE_SOLTAR_MS = 150
const PINTURA_MS = 300
const PASSOS_DO_ARRASTO = 12
const TELA_MS = 15_000

interface Ponto {
  x: number
  y: number
}

/** Pontos em coordenada do canvas, longe dos painéis e da barra. */
const VAZIO: Ponto = { x: 760, y: 560 }
const ONDE_CRAVAR_O_PINO: Ponto = { x: 620, y: 360 }
const SALA = { x0: 480, y0: 260, x1: 800, y1: 480 }

const barra = (page: Page) => page.getByRole('toolbar', { name: 'Ferramentas do mapa' })
const botaoDaParede = (page: Page) => barra(page).getByRole('button', { name: 'Parede', exact: true })

async function caixaDoCanvas(page: Page): Promise<Ponto> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return { x: box.x, y: box.y }
}

/** Clique de pessoa: move, pausa, desce, pausa, sobe. */
async function clicarNoMapa(page: Page, ponto: Ponto): Promise<void> {
  const c = await caixaDoCanvas(page)
  await page.mouse.move(c.x + ponto.x, c.y + ponto.y)
  await page.waitForTimeout(80)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

async function resetMap(page: Page) {
  await page.evaluate(async () => {
    const mapFactory = await import('/src/lib/mapFactory.ts')
    const mod = await import('/src/stores/mapStore.ts')
    mod.useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_e2e_atalho_painel', 'E2E', 30, 20, 64))
    mod.useMapStore.getState().setActiveTool('select')
  })
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
  await resetMap(page)
})

test('CONTROLE POSITIVO: com o foco no mapa, W põe a Parede na mão', async ({ page }) => {
  test.setTimeout(60_000)
  await expect(botaoDaParede(page)).not.toHaveAttribute('aria-pressed', 'true')

  await clicarNoMapa(page, VAZIO)
  await page.keyboard.press('w')

  await expect(botaoDaParede(page), 'W com o foco no mapa não pôs a Parede na mão').toHaveAttribute('aria-pressed', 'true', {
    timeout: TELA_MS,
  })
})

test('ANTI-REGRESSÃO: W digitado no nome de uma sala vira letra e não troca de ferramenta', async ({ page }) => {
  test.setTimeout(60_000)
  const c = await caixaDoCanvas(page)
  await pickTool(page, 'Sala')
  await page.mouse.move(c.x + SALA.x0, c.y + SALA.y0)
  await page.mouse.down()
  for (let passo = 1; passo <= PASSOS_DO_ARRASTO; passo++) {
    const t = passo / PASSOS_DO_ARRASTO
    await page.mouse.move(c.x + SALA.x0 + (SALA.x1 - SALA.x0) * t, c.y + SALA.y0 + (SALA.y1 - SALA.y0) * t)
  }
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()

  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  await expect(campo, 'desenhar a sala tinha de abrir o campo do nome sobre o mapa').toBeFocused({ timeout: TELA_MS })
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Wyrm')

  await expect(campo, 'o W digitado no nome da sala não ficou no campo').toHaveValue('Wyrm')
  await expect(botaoDaParede(page), 'o W digitado no nome da sala trocou a ferramenta para Parede').not.toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('CONTROLE: depois de clicar no título CAMADAS (um botão do painel), W já põe a Parede na mão', async ({ page }) => {
  test.setTimeout(60_000)
  await expect(botaoDaParede(page)).not.toHaveAttribute('aria-pressed', 'true')

  const tituloCamadas = page.getByRole('button', { name: 'Camadas', exact: true })
  await tituloCamadas.hover()
  await page.waitForTimeout(80)
  await tituloCamadas.click()
  await page.keyboard.press('w')

  await expect(botaoDaParede(page), 'W com o foco no título CAMADAS não pôs a Parede na mão').toHaveAttribute('aria-pressed', 'true', {
    timeout: TELA_MS,
  })
})

test('(a) depois de clicar no interruptor "Mostrar grade" do painel CAMADAS, W põe a Parede na mão', async ({ page }) => {
  test.setTimeout(60_000)
  await expect(botaoDaParede(page)).not.toHaveAttribute('aria-pressed', 'true')

  // O gesto do passeio: a pessoa mexe no painel CAMADAS e, sem voltar ao mapa,
  // aperta W. O interruptor é uma caixa de marcar, não um campo de texto.
  const interruptor = page.getByRole('group', { name: 'Grade' }).getByText('Mostrar grade', { exact: true })
  await interruptor.scrollIntoViewIfNeeded()
  await interruptor.hover()
  await page.waitForTimeout(80)
  await interruptor.click()
  await expect(page.getByRole('checkbox', { name: 'Mostrar grade' }), 'o clique não chegou ao interruptor da grade').toBeFocused()
  await page.keyboard.press('w')

  await expect(
    botaoDaParede(page),
    'W depois de clicar no interruptor "Mostrar grade" (caixa de marcar, não campo de texto) não pôs a Parede na mão',
  ).toHaveAttribute('aria-pressed', 'true', { timeout: TELA_MS })
})

test('(b) com o pino selecionado e o foco no painel dele, ? troca o tipo do pino', async ({ page }) => {
  test.setTimeout(60_000)
  await pickTool(page, 'Pino')
  await clicarNoMapa(page, ONDE_CRAVAR_O_PINO)
  await pickTool(page, 'Selecionar')
  await clicarNoMapa(page, ONDE_CRAVAR_O_PINO)

  const tipo = page.getByRole('radiogroup', { name: 'Tipo do pino' })
  await expect(tipo, 'tocar o pino com Selecionar não abriu o painel dele').toBeVisible({ timeout: TELA_MS })
  const exclamacao = tipo.getByRole('radio', { name: 'Exclamação (!)' })
  const interrogacao = tipo.getByRole('radio', { name: 'Interrogação (?)' })
  await expect(exclamacao, 'o pino recém-cravado não nasceu do tipo "!"').toHaveAttribute('aria-checked', 'true')
  // O painel é mesmo o DO pino selecionado: o campo de descrição só existe com pino concreto.
  await expect(page.getByLabel('Descrição')).toBeVisible()

  // Foco no painel, FORA de campo de texto: o título "Ponto de interesse".
  const titulo = page.getByRole('heading', { name: 'Ponto de interesse', exact: true })
  await titulo.hover()
  await page.waitForTimeout(80)
  await titulo.click()
  // "?" como o dedo aperta: Shift + a tecla da barra.
  await page.keyboard.press('Shift+Slash')

  await expect(
    interrogacao,
    '? com o foco no painel do pino não trocou o tipo: o painel continua marcando "!"',
  ).toHaveAttribute('aria-checked', 'true', { timeout: TELA_MS })
})
