// JORNADA DE USUÁRIO — "o Polígono do Desenho termina, e o que eu desenhei
// continua lá". Escrita para FALHAR hoje (vermelha) e provar a dor pela TELA.
//
// A DOR (medida em passeio de usuário): com Desenho > Polígono a pessoa clica
// os vértices e tenta terminar. `Enter` não faz nada. Duplo clique parece só
// acrescentar mais um vértice. `Escape` apaga tudo. Fechando no primeiro
// vértice o contorno aparece na tela — e aí, ao trocar de ferramenta com a
// tecla `v`, o polígono SOME do mapa, sem aviso nenhum. O trabalho evapora
// entre dois gestos que a pessoa acha que são inofensivos.
//
// POR QUE `Enter` É COBRANÇA JUSTA, E NÃO INVENÇÃO DESTE TESTE: o app promete
// essa convenção com todas as letras no texto que ele mesmo mostra —
// "Corredor: clique ponto a ponto, duplo clique ou Enter termina"
// (client/src/components/labels.ts:105) e "Duplo clique ou Enter fecha (mín. 3
// cantos)" na Sala livre (labels.ts:90). Duas ferramentas de traçado ponto a
// ponto terminam com Enter; a terceira, não.
//
// A CAUSA, para quem for consertar (endereço, não palpite):
// `client/src/pixi/PixiCanvas.tsx:4339` — a condição do Enter só olha
// `corridorDraftPoints` e `regionDraftPoints`; `polygonDraftPoints` ficou de
// fora. Como o rascunho nunca é comitado, a troca de ferramenta cai no
// `clearDrafts()` do subscribe de `activeTool` (PixiCanvas.tsx:2144-2148), que
// zera `polygonDraftPoints` (:1862) e limpa o `draftGraphics` (:1876). Não há
// mensagem nenhuma: o desenho simplesmente deixa de existir.
//
// O QUE ESTA JORNADA COBRA: `Enter` fecha o polígono, e ele CONTINUA NA TELA
// depois de trocar de ferramenta com `v`.
//
// REGRA DE PROVA DESTE ARQUIVO: toda asserção lê PIXEL DE TELA (screenshot com
// clip, comparado byte a byte contra a foto do mapa vazio). Nenhuma asserção
// toca `mapStore`. O polígono nasce de cliques de ponteiro reais.
import { expect, test, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import { pickTool } from './helpers/tools'

/** O Pixi pinta no próximo tick do ticker. Mesma espera dos outros specs de pixel. */
const PAINT_MS = 200
/** Um humano não solta o botão no mesmo frame em que desceu. */
const PAUSA_ANTES_DE_SOLTAR_MS = 80

/** O que `page.screenshot()` devolve — sem `@types/node` no tsconfig do e2e,
 *  o tipo vem da própria API (mesma solução de task-jornada-selecao-arrasto). */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}

function mesmoPixel(a: Foto, b: Foto): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ─────────────────────────────────────────────────────────────
// Geometria, em px de tela RELATIVOS ao canto do canvas.
// Mapa novo: 30x20, grid 64, câmera {0,0,scale:1} — ponto de mundo = offset no
// canvas, e coordenada múltipla de 64 não é movida pelo snap de vértice
// (`applySnap(..., 'wall', ...)`, PixiCanvas.tsx:2363).
// x começa em 384 para ficar à direita do painel da esquerda; y começa em 256
// para ficar abaixo da barra de ferramentas e do balão de dica.
// ─────────────────────────────────────────────────────────────
const CANTOS = [
  { x: 384, y: 256 },
  { x: 832, y: 256 },
  { x: 832, y: 576 },
  { x: 384, y: 576 },
]

/** Meio de cada aresta do quadrilátero acima: é por onde a linha do contorno
 *  passa, e é onde as sondas olham. 10x10 centrados no ponto — o traço tem
 *  4 px de largura (`drawWidth`, client/src/stores/mapStore.ts:852). */
function sonda(x: number, y: number): Retangulo {
  return { x: x - 5, y: y - 5, width: 10, height: 10 }
}

/**
 * As três arestas que ligam vértices CONSECUTIVOS. O rascunho aberto já as
 * pinta enquanto a pessoa clica, então elas são a régua de sensibilidade: se
 * as três estiverem apagadas, o problema é a sonda, não o app.
 */
const SONDAS_DO_TRACO: Retangulo[] = [
  sonda(608, 256), // de cima: 1º → 2º vértice
  sonda(832, 416), // da direita: 2º → 3º vértice
  sonda(608, 576), // de baixo: 3º → 4º vértice
]

/**
 * A aresta de FECHAMENTO (4º vértice de volta ao 1º). Medida à parte de
 * propósito: é ela que só existe quando o traçado foi de fato FECHADO, e é a
 * outra metade do que `Enter` tem de fazer. O rascunho aberto do Polígono não
 * a desenha hoje — medido nesta mesma jornada.
 */
const SONDA_DE_FECHAMENTO: Retangulo = sonda(384, 416)

/** Recorte do que está DESENHADO na tela, em px de CSS da página. */
async function recorte(page: Page, box: { x: number; y: number }, area: Retangulo): Promise<Foto> {
  return page.screenshot({
    clip: { x: Math.round(box.x + area.x), y: Math.round(box.y + area.y), width: area.width, height: area.height },
  })
}

/** Foto das 3 arestas do traço + a de fechamento, sempre nessa ordem. */
async function fotografarSondas(page: Page, box: { x: number; y: number }): Promise<Foto[]> {
  const fotos: Foto[] = []
  for (const area of SONDAS_DO_TRACO) fotos.push(await recorte(page, box, area))
  fotos.push(await recorte(page, box, SONDA_DE_FECHAMENTO))
  return fotos
}

/** Quantas das 3 arestas do traço estão pintadas com algo que o mapa vazio não tinha. */
function arestasDoTracoPintadas(agora: Foto[], vazio: Foto[]): number {
  let quantas = 0
  for (let i = 0; i < SONDAS_DO_TRACO.length; i += 1) {
    if (!mesmoPixel(agora[i], vazio[i])) quantas += 1
  }
  return quantas
}

/** A aresta de fechamento está pintada? É a última foto do vetor. */
function fechamentoPintado(agora: Foto[], vazio: Foto[]): boolean {
  const ultima = SONDAS_DO_TRACO.length
  return !mesmoPixel(agora[ultima], vazio[ultima])
}

/** Um clique de vértice: ponteiro de verdade, com pausa antes de soltar. */
async function clicarVertice(page: Page, box: { x: number; y: number }, ponto: { x: number; y: number }): Promise<void> {
  await page.mouse.move(box.x + ponto.x, box.y + ponto.y)
  await page.mouse.down()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
}

/**
 * A troca de ferramenta que faz o desenho sumir: a tecla `v` (Selecionar,
 * `TOOL_SHORTCUTS.select`, client/src/lib/keymap.ts). O `aria-pressed` do
 * botão da barra é a prova NA TELA de que a tecla foi entendida — sem ela, um
 * `v` que caiu no vazio faria a jornada passar sem nunca trocar de ferramenta.
 */
async function trocarParaSelecionarComATecla(page: Page): Promise<void> {
  await page.keyboard.press('v')
  await expect(page.getByRole('button', { name: 'Selecionar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(PAINT_MS)
}

async function cantoDoCanvas(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  if (box.width < 900 || box.height < 700) {
    throw new Error(`canvas pequeno demais para as sondas: ${Math.round(box.width)}x${Math.round(box.height)}`)
  }
  return { x: box.x, y: box.y }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('Polígono do Desenho: Enter fecha o traçado e o polígono continua na tela depois de trocar de ferramenta', async ({
  page,
}) => {
  const box = await cantoDoCanvas(page)
  const mapaVazio = await fotografarSondas(page, box)

  await pickTool(page, 'Polígono')
  for (const canto of CANTOS) await clicarVertice(page, box, canto)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(PAINT_MS)

  // CONTROLE POSITIVO, no MESMO teste: antes de trocar de ferramenta as três
  // arestas do traço ESTÃO pintadas. É o que prova que as sondas enxergam o
  // polígono — sem esta linha, "sumiu" e "nunca foi desenhado" dariam o mesmo
  // verde.
  const antes = await fotografarSondas(page, box)

  await trocarParaSelecionarComATecla(page)
  const depois = await fotografarSondas(page, box)

  expect({
    arestasDoTracoVisiveisAntesDeTrocarDeFerramenta: arestasDoTracoPintadas(antes, mapaVazio),
    arestasDoTracoVisiveisDepoisDeTrocarDeFerramenta: arestasDoTracoPintadas(depois, mapaVazio),
    arestaDeFechamentoVisivelDepoisDeTrocarDeFerramenta: fechamentoPintado(depois, mapaVazio),
  }).toEqual({
    arestasDoTracoVisiveisAntesDeTrocarDeFerramenta: SONDAS_DO_TRACO.length,
    arestasDoTracoVisiveisDepoisDeTrocarDeFerramenta: SONDAS_DO_TRACO.length,
    arestaDeFechamentoVisivelDepoisDeTrocarDeFerramenta: true,
  })
})

// RÉGUA — a MESMA sequência (clicar canto a canto, Enter, trocar de ferramenta
// com `v`) numa ferramenta que já cumpre a convenção hoje: Sala livre, cuja
// própria dica promete "Duplo clique ou Enter fecha" (labels.ts:90). Mesmos
// cantos, mesmas sondas, mesma tecla. Passa hoje — e é o que garante que o
// vermelho da jornada acima é do Polígono, e não das coordenadas, do Enter que
// não chegou ao canvas ou de sonda no lugar errado.
test('régua: em Sala livre a mesma sequência fecha o traçado e a sala continua na tela depois de trocar de ferramenta', async ({
  page,
}) => {
  const box = await cantoDoCanvas(page)
  const mapaVazio = await fotografarSondas(page, box)

  const botao = page.getByRole('button', { name: 'Sala livre', exact: true })
  await botao.click()
  await expect(botao).toHaveAttribute('aria-pressed', 'true')
  for (const canto of CANTOS) await clicarVertice(page, box, canto)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(PAINT_MS)

  // A sala pede o nome num campo sobre o mapa, que rouba o foco; Esc mantém o
  // nome padrão e devolve o teclado ao canvas. Se não aparecer, segue em frente.
  const campo = page.getByRole('textbox', { name: 'Nome da sala no mapa' })
  const pediuNome = await campo.waitFor({ state: 'visible', timeout: 2000 }).then(
    () => true,
    () => false,
  )
  if (pediuNome) await campo.press('Escape')
  await page.waitForTimeout(PAINT_MS)

  const antes = await fotografarSondas(page, box)
  await trocarParaSelecionarComATecla(page)
  const depois = await fotografarSondas(page, box)

  expect({
    arestasDoTracoVisiveisAntesDeTrocarDeFerramenta: arestasDoTracoPintadas(antes, mapaVazio),
    arestasDoTracoVisiveisDepoisDeTrocarDeFerramenta: arestasDoTracoPintadas(depois, mapaVazio),
    arestaDeFechamentoVisivelDepoisDeTrocarDeFerramenta: fechamentoPintado(depois, mapaVazio),
  }).toEqual({
    arestasDoTracoVisiveisAntesDeTrocarDeFerramenta: SONDAS_DO_TRACO.length,
    arestasDoTracoVisiveisDepoisDeTrocarDeFerramenta: SONDAS_DO_TRACO.length,
    arestaDeFechamentoVisivelDepoisDeTrocarDeFerramenta: true,
  })
})
