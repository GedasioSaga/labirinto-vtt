// JORNADA DE USUÁRIO — "arrastar o mouse numa área vazia seleciona tudo que
// está dentro". Escrita para FALHAR hoje (vermelha) e provar a dor pela TELA.
//
// A dor (pedido do usuário): "adoraria a capacidade de selecionar tudo com
// mouse". Hoje o retângulo de seleção só nasce se a pessoa segurar SHIFT no
// pointerdown com a ferramenta Selecionar ativa (pixi/PixiCanvas.tsx, bloco
// `activeTool === 'select' && event.shiftKey`). Sem Shift, o MESMO arrasto no
// vazio cai em `mode = 'panning'` e ainda chama `setSelection(EMPTY_SELECTION)`:
// a vista foge e a seleção some. Ninguém descobre o Shift sozinho.
//
// REGRA DE PROVA DESTE ARQUIVO: toda asserção lê PIXEL DE TELA
// (page.screenshot com clip, comparado byte a byte). Nenhuma leitura de
// `mapStore`, nenhum `data-*`, nenhum estado injetado — nem no arranjo: os 4
// objetos nascem de gesto de ponteiro real na barra de ferramentas, e o mapa
// vazio vem do próprio menu inicial (helpers/enterEditor.ts).
//
// GESTO REAL: page.mouse.move → down → vários move → PAUSA → up. Nada de
// dispatchEvent, evento sintético ou ação de store no lugar do gesto.
//
// POR QUE TRÊS SONDAS, E NÃO UMA: um pixel que "mudou" dentro do retângulo,
// sozinho, não distingue "apareceu um retângulo de seleção" de "a vista
// inteira andou". As três juntas só fecham com marquee:
//   DENTRO   mudou    → alguma coisa foi desenhada ali;
//   FORA     intacto  → o que foi desenhado tem borda, não é a tela toda;
//   REFERÊNCIA intacta → a câmera não andou (a sala de baixo, que fica FORA
//                        do retângulo e portanto não é selecionada, continua
//                        pintada exatamente nos mesmos pixels).
// A sonda REFERÊNCIA é também a asserção 4 do pedido: prova de que não houve
// pan comparando a posição na tela de um objeto conhecido antes e depois.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** O Pixi pinta no próximo tick do ticker: o redraw é síncrono na mutação, a
 *  PINTURA não. Mesma espera dos outros specs de pixel. */
const PAINT_MS = 180
/** Um humano não solta o botão no mesmo frame do último movimento. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150
/**
 * Teto próprio dos dois testes, SOMADO ao do teste (nunca no lugar dele).
 * Cada um desenha o mapa inteiro por gesto (três salas + uma parede) antes do
 * arrasto que é a prova: cinco arrastos de 20 passos de ponteiro e nove fotos
 * recortadas. Com a máquina carregada (22/09/2026, reporter de passos, 1
 * worker), `Mouse move` chegou a 2,9 s cada e o corpo passou dos 30 s do teste
 * nos DOIS testes (vermelho por timeout, verde sozinho). Nenhuma sonda nem
 * asserção muda: é tempo para o MESMO gesto, não tolerância na prova.
 */
const TETO_EXTRA_DO_GESTO_LONGO_MS = 30_000

/** O que `page.screenshot()` devolve. `Buffer` não é tipo declarado no projeto
 *  de tipos dos e2e (sem `@types/node`), então o tipo vem da própria API —
 *  mesma solução de task-jornada-gestos-centrais.spec.ts. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}

// ─────────────────────────────────────────────────────────────
// Geometria, em px de tela RELATIVOS ao canto do canvas.
// Coordenadas dos objetos em múltiplos de 64 (= grade do mapa novo: 30x20,
// grid 64, câmera {0,0,scale:1}) para o snap da ferramenta não mover as
// bordas de lugar e as sondas caírem onde foram planejadas.
// ─────────────────────────────────────────────────────────────
const SALA_A = { de: { x: 384, y: 192 }, ate: { x: 512, y: 320 } }
const SALA_B = { de: { x: 576, y: 192 }, ate: { x: 704, y: 320 } }
const PAREDE_SOLTA = { de: { x: 384, y: 384 }, ate: { x: 704, y: 384 } }
/** Sala de referência: fica FORA do retângulo de seleção de propósito. Não é
 *  selecionada, então seus pixels só mudam se a CÂMERA andar. */
const SALA_REFERENCIA = { de: { x: 384, y: 512 }, ate: { x: 512, y: 640 } }

/** Arrasto no vazio, da esquerda para a direita (modo "contenção total":
 *  entra o que cabe inteiro dentro). Envolve A, B e a parede solta; deixa a
 *  sala de referência de fora. Começa em área livre: à direita do painel da
 *  esquerda (que termina por volta de x=280) e abaixo da barra de cima. */
const MARQUEE = { de: { x: 336, y: 160 }, ate: { x: 768, y: 448 } }

/** DENTRO do retângulo, em área vazia: no vão entre as duas salas
 *  (x 512..576) e entre o pé delas (y 320) e a parede solta (y 384). */
const SONDA_DENTRO: Retangulo = { x: 540, y: 348, width: 8, height: 8 }
/** FORA do retângulo (x > 768), em área vazia e longe de todo objeto. */
const SONDA_FORA: Retangulo = { x: 820, y: 200, width: 12, height: 12 }
/** A sala de referência inteira, com folga: se a vista andar um pixel que
 *  seja, as bordas dela saem do recorte e os bytes mudam. */
const SONDA_REFERENCIA: Retangulo = { x: 368, y: 496, width: 160, height: 160 }
/** Faixa vertical no VÃO entre as duas salas, cruzando a linha onde o
 *  contorno do grupo selecionado (topo do bounding box, y=192) tem de
 *  aparecer depois de soltar. Vazia hoje; nenhuma parede desenha aqui. */
const FAIXA_DO_CONTORNO: Retangulo = { x: 532, y: 160, width: 24, height: 140 }

/** Ponto vazio de clique para limpar a seleção antes de medir. */
const VAZIO_PARA_LIMPAR = { x: 860, y: 600 }

async function ferramenta(page: Page, label: 'Selecionar' | 'Sala' | 'Parede'): Promise<void> {
  const botao = page.getByRole('button', { name: label, exact: true })
  await botao.click()
  await expect(botao).toHaveAttribute('aria-pressed', 'true')
}

/** Arrasto de gente: desce, anda em vários passos, PARA, e só então solta. */
async function arrastar(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + (ate.x - de.x) * 0.3, de.y + (ate.y - de.y) * 0.3, { steps: 6 })
  await page.mouse.move(de.x + (ate.x - de.x) * 0.7, de.y + (ate.y - de.y) * 0.7, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
}

/** Recorte do que está DESENHADO na tela, em px de CSS da página. */
async function recorte(page: Page, box: { x: number; y: number }, area: Retangulo): Promise<Foto> {
  return page.screenshot({
    clip: { x: Math.round(box.x + area.x), y: Math.round(box.y + area.y), width: area.width, height: area.height },
  })
}

/** Desenha uma sala com a ferramenta Sala e fecha o campo de nome que nasce
 *  em cima dela (Esc mantém o nome padrão, como faz task-jornada-porta-sem-buraco). */
async function desenharSala(page: Page, box: { x: number; y: number }, sala: typeof SALA_A): Promise<void> {
  await ferramenta(page, 'Sala')
  await arrastar(page, { x: box.x + sala.de.x, y: box.y + sala.de.y }, { x: box.x + sala.ate.x, y: box.y + sala.ate.y })
  await page.getByRole('textbox', { name: 'Nome da sala no mapa' }).press('Escape')
  await page.waitForTimeout(PAINT_MS)
}

/**
 * O mapa que a pessoa desenhou antes de tentar selecionar: 2 salas, 1 parede
 * solta (os 3 objetos que o retângulo tem de pegar) e 1 sala de referência
 * embaixo, fora do retângulo. Devolve o canto do canvas.
 */
async function mapaDesenhadoComGesto(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  // As sondas moram todas dentro desta área: se o canvas for menor que isso,
  // o teste estaria medindo o lugar errado — melhor falhar dizendo isso.
  if (box.width < 900 || box.height < 700) {
    throw new Error(`canvas pequeno demais para as sondas: ${Math.round(box.width)}x${Math.round(box.height)}`)
  }

  await desenharSala(page, box, SALA_A)
  await desenharSala(page, box, SALA_B)

  await ferramenta(page, 'Parede')
  await arrastar(
    page,
    { x: box.x + PAREDE_SOLTA.de.x, y: box.y + PAREDE_SOLTA.de.y },
    { x: box.x + PAREDE_SOLTA.ate.x, y: box.y + PAREDE_SOLTA.ate.y },
  )

  await desenharSala(page, box, SALA_REFERENCIA)

  // Ferramenta Selecionar ativa e nada selecionado: um clique curto (sem
  // arrasto) em área vazia é o jeito da interface de limpar a seleção.
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + VAZIO_PARA_LIMPAR.x, box.y + VAZIO_PARA_LIMPAR.y)
  await page.waitForTimeout(PAINT_MS)
  return { x: box.x, y: box.y }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('arrastar no vazio com Selecionar (sem Shift) desenha o retângulo e seleciona os 3 objetos, sem mover a vista', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_LONGO_MS)
  const box = await mapaDesenhadoComGesto(page)

  const dentroAntes = await recorte(page, box, SONDA_DENTRO)
  const foraAntes = await recorte(page, box, SONDA_FORA)
  const referenciaAntes = await recorte(page, box, SONDA_REFERENCIA)
  const faixaAntes = await recorte(page, box, FAIXA_DO_CONTORNO)

  // ── O gesto: ponteiro real, área vazia, SEM Shift. A foto do meio do gesto
  //    é tirada com o botão AINDA APERTADO.
  const de = { x: box.x + MARQUEE.de.x, y: box.y + MARQUEE.de.y }
  const ate = { x: box.x + MARQUEE.ate.x, y: box.y + MARQUEE.ate.y }
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + (ate.x - de.x) * 0.3, de.y + (ate.y - de.y) * 0.3, { steps: 6 })
  await page.mouse.move(de.x + (ate.x - de.x) * 0.7, de.y + (ate.y - de.y) * 0.7, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)

  const dentroDurante = await recorte(page, box, SONDA_DENTRO)
  const foraDurante = await recorte(page, box, SONDA_FORA)
  const referenciaDurante = await recorte(page, box, SONDA_REFERENCIA)

  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)

  // Durante o arrasto o usuário precisa VER o retângulo de seleção — e só ele:
  // nada de a tela inteira escorregar junto.
  expect({
    retanguloDesenhadoDentro: !dentroDurante.equals(dentroAntes),
    foraDoRetanguloIntacto: foraDurante.equals(foraAntes),
    vistaParadaDuranteOArrasto: referenciaDurante.equals(referenciaAntes),
  }).toEqual({
    retanguloDesenhadoDentro: true,
    foraDoRetanguloIntacto: true,
    vistaParadaDuranteOArrasto: true,
  })

  const referenciaDepois = await recorte(page, box, SONDA_REFERENCIA)
  const faixaDepois = await recorte(page, box, FAIXA_DO_CONTORNO)

  // Ao soltar: a vista continua onde estava (a sala de referência, que ficou
  // de fora do retângulo, está pintada nos mesmos pixels) E o contorno do
  // grupo selecionado aparece cruzando o vão entre as duas salas.
  expect({
    vistaParadaDepoisDeSoltar: referenciaDepois.equals(referenciaAntes),
    contornoDoGrupoAoRedorDosObjetos: !faixaDepois.equals(faixaAntes),
  }).toEqual({
    vistaParadaDepoisDeSoltar: true,
    contornoDoGrupoAoRedorDosObjetos: true,
  })
})

// CONTROLE POSITIVO — mesmíssimas sondas, mesmíssimo gesto, só que segurando
// Shift (o caminho escondido que HOJE existe). Passa hoje: é o que garante
// que a jornada acima fica vermelha por causa do comportamento, não por
// coordenada errada, recorte no lugar errado ou sonda cega.
test('controle positivo: o mesmo arrasto COM Shift já desenha o retângulo e o contorno (as sondas enxergam)', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + TETO_EXTRA_DO_GESTO_LONGO_MS)
  const box = await mapaDesenhadoComGesto(page)

  const dentroAntes = await recorte(page, box, SONDA_DENTRO)
  const foraAntes = await recorte(page, box, SONDA_FORA)
  const referenciaAntes = await recorte(page, box, SONDA_REFERENCIA)
  const faixaAntes = await recorte(page, box, FAIXA_DO_CONTORNO)

  const de = { x: box.x + MARQUEE.de.x, y: box.y + MARQUEE.de.y }
  const ate = { x: box.x + MARQUEE.ate.x, y: box.y + MARQUEE.ate.y }
  await page.keyboard.down('Shift')
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(de.x + (ate.x - de.x) * 0.3, de.y + (ate.y - de.y) * 0.3, { steps: 6 })
  await page.mouse.move(de.x + (ate.x - de.x) * 0.7, de.y + (ate.y - de.y) * 0.7, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 8 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)

  const dentroDurante = await recorte(page, box, SONDA_DENTRO)
  const foraDurante = await recorte(page, box, SONDA_FORA)
  const referenciaDurante = await recorte(page, box, SONDA_REFERENCIA)

  await page.mouse.up()
  await page.waitForTimeout(PAINT_MS)
  await page.keyboard.up('Shift')

  const referenciaDepois = await recorte(page, box, SONDA_REFERENCIA)
  const faixaDepois = await recorte(page, box, FAIXA_DO_CONTORNO)

  expect({
    retanguloDesenhadoDentro: !dentroDurante.equals(dentroAntes),
    foraDoRetanguloIntacto: foraDurante.equals(foraAntes),
    vistaParadaDuranteOArrasto: referenciaDurante.equals(referenciaAntes),
    vistaParadaDepoisDeSoltar: referenciaDepois.equals(referenciaAntes),
    contornoDoGrupoAoRedorDosObjetos: !faixaDepois.equals(faixaAntes),
  }).toEqual({
    retanguloDesenhadoDentro: true,
    foraDoRetanguloIntacto: true,
    vistaParadaDuranteOArrasto: true,
    vistaParadaDepoisDeSoltar: true,
    contornoDoGrupoAoRedorDosObjetos: true,
  })
})
