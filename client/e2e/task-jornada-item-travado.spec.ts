// Jornada do usuário — "travar movimentação de item" (pedido literal de
// 18/09/2026): ele tinha uma Sala/Região grande fazendo o papel de ILHA em
// cima do chão que fazia o papel de MAR, clicou em algo no meio da sessão e
// arrastou a ilha inteira sem querer. Quer um botão de travar.
//
// O contrato é o mesmo do cadeado de camada, com UMA diferença que é o bug
// desta rodada: item travado continua VISÍVEL e CLICÁVEL — só não se MOVE.
// Clicável importa porque é assim que ele alcança o painel pra destravar; se
// o clique cair no que está EMBAIXO, ele fica sem saída.
//
// Por que a asserção é por PIXEL e não por `map.regions`: o que o usuário
// reclamou foi "eu acabei movendo a ilha", ou seja, a posição que ele vê na
// TELA. Medir o store provaria outra coisa (que a ação não rodou), não que a
// ilha ficou parada — e é justamente na tela que o bug do hit-test aparece,
// porque lá quem se move é a região de BAIXO. Mesma técnica de
// task4-selection-pixel-diff.spec.ts: recorte do canvas, byte a byte.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** Cor padrão de região nova (mapFactory) — fica com o "mar", a região de
 *  baixo. O `#lb-region-color` do painel mostra a cor da região SELECIONADA,
 *  então a cor é o que denuncia, na tela, QUAL das duas o clique pegou. */
const COR_MAR = '#3a7ad0'
/** A "ilha": região menor, desenhada DEPOIS (fica por cima no hit-test). */
const COR_ILHA = '#00ff00'

/** O Pixi pinta no próximo tick do ticker — o redraw é síncrono na mudança, a
 *  PINTURA não. Mesma espera dos outros specs de pixel deste diretório. */
const PAINT_MS = 200

type Ponto = { x: number; y: number }
type Triangulo = readonly [Ponto, Ponto, Ponto]

/**
 * Geometria em coordenadas relativas ao canto do `<canvas>`. Todo ponto mora
 * à DIREITA do inspetor de propósito: o `<canvas>` ocupa a janela inteira e o
 * painel FLUTUA por cima dele, então clique em cima do painel nunca chega no
 * mapa — vértice colocado ali some, o polígono sai degenerado e a jornada
 * passa a medir outra coisa. `canvasBox` mede o painel e falha alto se essa
 * premissa mudar, em vez de deixar passar em silêncio.
 */
const MAR: Triangulo = [
  { x: 340, y: 170 },
  { x: 1220, y: 170 },
  { x: 780, y: 720 },
]
const ILHA: Triangulo = [
  { x: 700, y: 320 },
  { x: 880, y: 320 },
  { x: 790, y: 430 },
]
/** Ponto dentro da ilha (e, portanto, também dentro do mar). */
const DENTRO_DA_ILHA = { x: 790, y: 360 }
/** Para onde o arrasto tenta levar a ilha. */
const DESTINO = { x: 940, y: 500 }
/** Canto vazio, fora das duas: clique aqui limpa a seleção e deixa o
 *  ponteiro SEMPRE no mesmo lugar antes de cada screenshot (hover desenha no
 *  canvas — se o ponteiro parasse em lugares diferentes, o diff acusaria o
 *  hover, não o movimento). */
const VAZIO = { x: 400, y: 620 }

/** Menor x que a jornada clica — o guarda de `canvasBox` confere contra a
 *  borda direita do inspetor. */
const MENOR_X = Math.min(...[...MAR, ...ILHA, DENTRO_DA_ILHA, DESTINO, VAZIO].map((p) => p.x))

function regionColorInput(page: Page) {
  return page.locator('#lb-region-color')
}

/** A linha visível do interruptor (o `<input>` real é 1x1/opacity:0 e
 *  pointer-events:none — ver .lb-switch__input em main.css). */
function linhaTravado(page: Page) {
  return page.locator('label.lb-switch').filter({ hasText: 'Travado' })
}

/** Clicar no trilho é o clique que o usuário dá: elemento visível, dentro do
 *  `<label>`, então o toggle nativo do checkbox acontece pelo navegador. */
async function clicarTravado(page: Page) {
  await linhaTravado(page).locator('.lb-switch__track').click()
}

function checkboxTravado(page: Page) {
  return linhaTravado(page).locator('input[type="checkbox"]')
}

async function selecionarFerramenta(page: Page, label: 'Selecionar' | 'Região') {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** Desenha um triângulo: 3 cliques nos vértices + duplo clique no último
 *  fecha o polígono (mesmo gesto de task-region-color.spec.ts). */
async function desenharTriangulo(
  page: Page,
  origem: Ponto,
  vertices: Triangulo,
) {
  for (const v of vertices) {
    await page.mouse.click(origem.x + v.x, origem.y + v.y)
  }
  const ultimo = vertices[2]
  await page.mouse.dblclick(origem.x + ultimo.x, origem.y + ultimo.y)
}

/**
 * Cenário do pedido: um "mar" grande (cor padrão) e, por cima dele, uma
 * "ilha" menor e verde. As duas se sobrepõem no ponto do clique de propósito
 * — é só assim que dá pra provar que o clique na ilha TRAVADA não escorrega
 * pro mar de baixo.
 */
async function desenharMarEIlha(page: Page, origem: Ponto) {
  await selecionarFerramenta(page, 'Região')
  await expect(regionColorInput(page)).toHaveValue(COR_MAR)
  await desenharTriangulo(page, origem, MAR)

  // Prova, ANTES de desenhar a ilha, que o mar cobre o ponto combinado: é o
  // que faz "o clique caiu no que está embaixo" ser uma falha possível mais
  // adiante. Sem isto, um polígono degenerado (vértice que caiu no painel
  // flutuante em vez do canvas) passaria despercebido e a jornada mediria
  // outra coisa.
  await selecionarFerramenta(page, 'Selecionar')
  await page.mouse.click(origem.x + DENTRO_DA_ILHA.x, origem.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_MAR)
  await largarNoVazio(page, origem)

  await selecionarFerramenta(page, 'Região')
  await regionColorInput(page).fill(COR_ILHA)
  await desenharTriangulo(page, origem, ILHA)

  // E a ilha, desenhada depois, fica POR CIMA: o mesmo clique agora pega ela.
  await selecionarFerramenta(page, 'Selecionar')
  await page.mouse.click(origem.x + DENTRO_DA_ILHA.x, origem.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_ILHA)
  await largarNoVazio(page, origem)
}

/**
 * Limpa a seleção, devolve o ponteiro ao mesmo canto vazio de sempre e espera
 * a PINTURA. O redraw do Pixi é síncrono na mudança, a pintura não — sem esta
 * espera o screenshot logo abaixo pode pegar o frame anterior. Mesma espera de
 * task-jornada-camada-travada.spec.ts.
 */
async function largarNoVazio(page: Page, origem: Ponto) {
  await page.mouse.click(origem.x + VAZIO.x, origem.y + VAZIO.y)
  await expect(regionColorInput(page)).toHaveCount(0)
  await page.waitForTimeout(PAINT_MS)
}

/**
 * Arrasto de verdade: down, vários move, PAUSA parado antes de soltar (o
 * `up` no mesmo tick do último `move` não representa a mão de ninguém e
 * esconde bug de estado de gesto).
 */
async function arrastar(
  page: Page,
  origem: Ponto,
  de: Ponto,
  para: Ponto,
) {
  await page.mouse.move(origem.x + de.x, origem.y + de.y)
  await page.mouse.down()
  await page.mouse.move(origem.x + (de.x + para.x) / 2, origem.y + (de.y + para.y) / 2, { steps: 8 })
  await page.mouse.move(origem.x + para.x, origem.y + para.y, { steps: 8 })
  await page.waitForTimeout(250)
  await page.mouse.up()
}

async function canvasBox(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  if (box.width < 1270 || box.height < 790) {
    throw new Error(`canvas pequeno demais pro cenário: ${box.width}x${box.height}`)
  }
  const painel = await page.locator('.lb-inspector').boundingBox()
  if (!painel) throw new Error('inspetor sem bounding box')
  const bordaDoPainel = painel.x + painel.width - box.x
  if (MENOR_X <= bordaDoPainel) {
    throw new Error(`o inspetor cobre x=${MENOR_X}: ele vai até x=${bordaDoPainel}, mova a geometria pra direita`)
  }
  return box
}

/** Recorte que contém a ilha parada (x 700..880, y 320..430) E o lugar pra
 *  onde o arrasto a levaria (x 850..1030, y 460..570). O canto vazio onde o
 *  ponteiro descansa fica FORA do recorte de propósito. */
function recorteDaIlha(origem: Ponto) {
  return { x: origem.x + 680, y: origem.y + 300, width: 370, height: 290 }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('ilha travada não se move no arrasto; destravada volta a mover', async ({ page }) => {
  const box = await canvasBox(page)
  await desenharMarEIlha(page, box)

  await page.mouse.click(box.x + DENTRO_DA_ILHA.x, box.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_ILHA)

  // O botão que o usuário pediu — hoje o painel de Região/Sala não tem
  // nenhum, por isso ele não teve como se defender no meio da sessão.
  await expect(linhaTravado(page)).toBeVisible()
  await expect(checkboxTravado(page)).not.toBeChecked()
  await clicarTravado(page)
  await expect(checkboxTravado(page)).toBeChecked()

  await largarNoVazio(page, box)
  const antes = await page.screenshot({ clip: recorteDaIlha(box) })

  await arrastar(page, box, DENTRO_DA_ILHA, DESTINO)

  await largarNoVazio(page, box)
  const depoisDeTravada = await page.screenshot({ clip: recorteDaIlha(box) })
  // Nada pode ter se mexido: nem a ilha travada, nem o mar debaixo dela
  // (arrastar "através" da ilha travada e levar o mar junto é o mesmo
  // acidente de sessão, só que pior — ele nem veria o que pegou).
  expect(depoisDeTravada.equals(antes)).toBe(true)

  // Destravar: o caminho de volta passa por clicar na ilha TRAVADA.
  await page.mouse.click(box.x + DENTRO_DA_ILHA.x, box.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_ILHA)
  await expect(checkboxTravado(page)).toBeChecked()
  await clicarTravado(page)
  await expect(checkboxTravado(page)).not.toBeChecked()

  await largarNoVazio(page, box)
  const antesDeDestravada = await page.screenshot({ clip: recorteDaIlha(box) })

  await arrastar(page, box, DENTRO_DA_ILHA, DESTINO)

  await largarNoVazio(page, box)
  const depoisDeDestravada = await page.screenshot({ clip: recorteDaIlha(box) })
  expect(depoisDeDestravada.equals(antesDeDestravada)).toBe(false)
})

test('ilha travada continua clicável — o clique nela não cai no mar de baixo', async ({ page }) => {
  const box = await canvasBox(page)
  await desenharMarEIlha(page, box)

  await page.mouse.click(box.x + DENTRO_DA_ILHA.x, box.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_ILHA)
  await clicarTravado(page)
  await expect(checkboxTravado(page)).toBeChecked()

  await largarNoVazio(page, box)

  // O bug: com a ilha fora do hit-test, este clique seleciona o MAR (cor
  // padrão) em vez da ilha — e o painel passa a editar a região errada,
  // sem nenhum caminho de volta pra destravar a ilha.
  await page.mouse.click(box.x + DENTRO_DA_ILHA.x, box.y + DENTRO_DA_ILHA.y)
  await expect(regionColorInput(page)).toHaveValue(COR_ILHA)
  await expect(checkboxTravado(page)).toBeChecked()
})
