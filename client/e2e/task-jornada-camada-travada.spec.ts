// JORNADA DE USUÁRIO — "camada travada protege o que está nela, e não arrasta
// mais nada junto". Escrita para FALHAR hoje (vermelha) e provar a dor pela TELA.
//
// A DOR (medida em passeio de usuário): a pessoa trava a camada Tokens pelo
// cadeado do painel CAMADAS justamente para poder arrastar o mapa sem esbarrar
// nos tokens. Aí ela arrasta EM CIMA do token: o token fica parado (certo) —
// e a SALA INTEIRA anda junto com o chão dela, levando luz, escada e rótulo
// para outro lugar. Sem aviso nenhum. Travar uma camada virou um jeito novo
// de estragar o mapa.
//
// A CAUSA, para quem for consertar (endereço, não palpite):
// `client/src/pixi/PixiCanvas.tsx:1639-1643` — `clickSelectMap` REMOVE do mapa
// os tokens da camada travada antes do hit-test. Com o token fora do array,
// `findSelectableAt` (client/src/lib/selectionHitTest.ts:284-316) acerta a
// Region que está EMBAIXO dele e o gesto entra em `mode =
// 'dragging-region-body'` (PixiCanvas.tsx:2766-2772). Travar não bloqueou o
// gesto: só trocou a vítima.
//
// O QUE ESTA JORNADA COBRA: com a camada Tokens travada, arrastar em cima do
// token não move NADA na tela. Não é "o token não se move" — é "nada se move".
//
// REGRA DE PROVA DESTE ARQUIVO: toda asserção lê PIXEL DE TELA (screenshot com
// clip, comparado byte a byte). Nenhuma asserção toca `mapStore`. O cenário
// inteiro nasce de gesto de ponteiro real: a sala vem da ferramenta Sala da
// barra, o token vem do botão "Adicionar token" do painel (a ferramenta Token
// da barra está escondida por `FEATURES.tokenTool`, client/src/lib/features.ts)
// e o cadeado é clicado no painel CAMADAS.
//
// GESTO REAL: mouse.move → down → vários move → PAUSA → up. Nada de
// dispatchEvent, nada de evento sintético, nada de escrita na store.
import { expect, test, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** O Pixi pinta no próximo tick do ticker: o redraw é síncrono na mutação, a
 *  PINTURA não. Mesma espera dos outros specs de pixel deste diretório. */
const PAINT_MS = 200
/** Um humano não solta o botão no mesmo frame do último movimento. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150

/** O que `page.screenshot()` devolve. `Buffer` não é tipo declarado no projeto
 *  de tipos dos e2e (sem `@types/node`), então o tipo vem da própria API —
 *  mesma solução de task-jornada-selecao-arrasto.spec.ts. */
type Foto = Awaited<ReturnType<Page['screenshot']>>

interface Retangulo {
  x: number
  y: number
  width: number
  height: number
}

/** Comparação byte a byte, sem depender de `Buffer.equals` estar tipado aqui. */
function mesmoPixel(a: Foto, b: Foto): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ─────────────────────────────────────────────────────────────
// Geometria, em px de tela RELATIVOS ao canto do canvas.
//
// Mapa novo: 30x20, grid 64, câmera {0,0,scale:1} — então ponto de mundo =
// offset dentro do canvas, e coordenada múltipla de 64 não é movida pelo snap.
// O canvas é `.lb-editor__canvas { inset: 0 }` (client/src/main.css:657-660),
// ou seja, a viewport inteira (1280x800).
// ─────────────────────────────────────────────────────────────

/** A sala. Começa em x=320 para nascer à direita do painel da esquerda
 *  (`--lb-layout-rail-width`, que termina por volta de x=280) e envolve com
 *  folga o centro do canvas, que é onde o token vai nascer. */
const SALA = { de: { x: 320, y: 192 }, ate: { x: 960, y: 576 } }

/** Quanto o arrasto pede de deslocamento: 2 células de grade, para o snap de
 *  corpo (`applySnap(..., 'wall', ...)`) não comer o movimento. */
const DESLOCAMENTO = { x: 128, y: 128 }

/**
 * Sonda que enxerga a SALA ANDANDO PARA A DIREITA, e só isso.
 *
 * Mora 40 px À DIREITA da borda direita da sala: hoje é fundo do mapa. Se a
 * sala andar os 128 px do arrasto, a borda direita passa a 1088 e este ponto
 * vira chão. Os 40 px de afastamento também isolam a sonda do CONTORNO de
 * seleção, que é desenhado em cima da borda antiga — assim um conserto que
 * apenas selecione a sala sem movê-la não pinta esta sonda de vermelho.
 *
 * O `y` fica na FAIXA COMUM às duas posições da sala (320..576 = interseção de
 * 192..576 com 320..704): fora dela a sala escorrega para baixo e a sonda
 * continua vendo fundo depois do arrasto, ficando cega para o deslocamento
 * horizontal — foi o que aconteceu na primeira versão deste arquivo, com y=300.
 */
const SONDA_DIREITA_DA_SALA: Retangulo = { x: SALA.ate.x + 40, y: 448, width: 16, height: 16 }
/** Mesma ideia, no eixo vertical: 40 px ABAIXO da borda de baixo da sala.
 *  x=552 fica longe do rótulo do nome, que é desenhado no meio da sala. */
const SONDA_ABAIXO_DA_SALA: Retangulo = { x: 552, y: SALA.ate.y + 40, width: 16, height: 16 }

/** O token nasce no centro da vista (`viewportCenterWorld`, client/src/App.tsx:999)
 *  e o centro da vista, com câmera {0,0,scale:1}, é o centro do canvas. */
const CENTRO_DO_TOKEN = { x: 640, y: 400 }
/** Miolo do disco do token (raio de mundo 30 px — `tokenRadiusFor`,
 *  client/src/lib/tokenPlacement.ts:39). 16 px no centro ficam bem dentro do
 *  preenchimento, longe do anel de seleção que mora na borda. */
const SONDA_TOKEN: Retangulo = { x: CENTRO_DO_TOKEN.x - 8, y: CENTRO_DO_TOKEN.y - 8, width: 16, height: 16 }
/** Onde o token PRECISA aparecer quando a camada está destravada. 24 px de
 *  lado toleram o snap do arrasto sem deixar de cair dentro do disco. */
const SONDA_DESTINO_DO_TOKEN: Retangulo = {
  x: CENTRO_DO_TOKEN.x + DESLOCAMENTO.x - 12,
  y: CENTRO_DO_TOKEN.y + DESLOCAMENTO.y - 12,
  width: 24,
  height: 24,
}

/** Área vazia para um clique curto que limpa a seleção. Fora da sala, fora da
 *  barra de ferramentas (que é centralizada no topo) e fora do painel. */
const VAZIO_PARA_LIMPAR = { x: 1150, y: 150 }

async function ferramenta(page: Page, label: 'Selecionar' | 'Sala'): Promise<void> {
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

/**
 * A seção CAMADAS do painel da esquerda guarda seu aberto/fechado em
 * localStorage (`CollapsibleSection`, client/src/components/CollapsibleSection.tsx),
 * e o padrão só é "aberta" quando nada está selecionado. Em vez de supor,
 * abre se estiver fechada — é o que a mão do usuário faria.
 */
async function abrirSecaoCamadas(page: Page): Promise<void> {
  const secao = page.getByRole('button', { name: 'Camadas', exact: true })
  await expect(secao).toBeVisible()
  if ((await secao.getAttribute('aria-expanded')) !== 'true') await secao.click()
  await expect(secao).toHaveAttribute('aria-expanded', 'true')
}

/** O cadeado da linha "Tokens" em CAMADAS. O nome acessível descreve a AÇÃO do
 *  próximo clique (client/src/components/LayersPanel.tsx:61), então "Travar
 *  Tokens" só existe enquanto a camada está destravada — e vice-versa. */
async function travarTokens(page: Page): Promise<void> {
  await abrirSecaoCamadas(page)
  await page.getByRole('button', { name: 'Travar Tokens', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Destravar Tokens', exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/**
 * Um clique curto em área vazia com a ferramenta Selecionar: é como o usuário
 * desfaz uma seleção. Necessário antes de voltar ao painel CAMADAS — com algo
 * selecionado, a coluna da esquerda mostra as propriedades do item e o cadeado
 * sai da tela.
 */
async function limparSelecao(page: Page, box: { x: number; y: number }): Promise<void> {
  await page.mouse.click(box.x + VAZIO_PARA_LIMPAR.x, box.y + VAZIO_PARA_LIMPAR.y)
  await page.waitForTimeout(PAINT_MS)
}

async function destravarTokens(page: Page): Promise<void> {
  await abrirSecaoCamadas(page)
  await page.getByRole('button', { name: 'Destravar Tokens', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Travar Tokens', exact: true })).toHaveAttribute('aria-pressed', 'false')
}

/**
 * O mapa que a pessoa tem na frente quando trava a camada: uma sala grande
 * desenhada com a ferramenta Sala e um token no meio dela. Devolve o canto do
 * canvas.
 */
async function salaComTokenDentro(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  // As sondas moram todas dentro desta área: canvas menor que isso significaria
  // medir o lugar errado — melhor falhar dizendo isso do que sair verde à toa.
  if (box.width < 1100 || box.height < 700) {
    throw new Error(`canvas pequeno demais para as sondas: ${Math.round(box.width)}x${Math.round(box.height)}`)
  }

  await ferramenta(page, 'Sala')
  await arrastar(page, { x: box.x + SALA.de.x, y: box.y + SALA.de.y }, { x: box.x + SALA.ate.x, y: box.y + SALA.ate.y })
  // A sala pede o nome num campo sobre o mapa e ele rouba o foco; Esc mantém
  // o nome padrão e devolve o teclado ao canvas.
  await page.getByRole('textbox', { name: 'Nome da sala no mapa' }).press('Escape')
  await page.waitForTimeout(PAINT_MS)

  await ferramenta(page, 'Selecionar')
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome do novo token' }).press('Enter')
  await page.waitForTimeout(PAINT_MS)

  // O token nasce JÁ SELECIONADO (App.tsx:1011) e o anel de seleção é pixel
  // que mudaria sozinho no meio da jornada. Um clique curto em área vazia
  // limpa a seleção — e é também o gesto que devolve a seção CAMADAS ao
  // padrão "aberta".
  await page.mouse.click(box.x + VAZIO_PARA_LIMPAR.x, box.y + VAZIO_PARA_LIMPAR.y)
  await page.waitForTimeout(PAINT_MS)
  return { x: box.x, y: box.y }
}

test.beforeEach(async ({ page }) => {
  await enterEditor(page)
})

test('com a camada Tokens travada, arrastar em cima do token não move nada na tela', async ({ page }) => {
  const box = await salaComTokenDentro(page)
  await travarTokens(page)

  // Prova, na tela, que o cenário existe antes de medir o que não pode
  // acontecer: o token está pintado onde a sonda vai olhar, e a sala ainda
  // não invadiu as duas sondas de fora dela.
  const tokenAntes = await recorte(page, box, SONDA_TOKEN)
  const direitaAntes = await recorte(page, box, SONDA_DIREITA_DA_SALA)
  const abaixoAntes = await recorte(page, box, SONDA_ABAIXO_DA_SALA)
  await expect(page.getByRole('button', { name: 'Destravar Tokens', exact: true })).toBeVisible()

  const de = { x: box.x + CENTRO_DO_TOKEN.x, y: box.y + CENTRO_DO_TOKEN.y }
  const ate = { x: de.x + DESLOCAMENTO.x, y: de.y + DESLOCAMENTO.y }
  await arrastar(page, de, ate)

  const tokenDepois = await recorte(page, box, SONDA_TOKEN)
  const direitaDepois = await recorte(page, box, SONDA_DIREITA_DA_SALA)
  const abaixoDepois = await recorte(page, box, SONDA_ABAIXO_DA_SALA)

  // ── CONTROLE POSITIVO, no MESMO teste (regra do portão: quem afirma "X não
  //    acontece" prova que o mecanismo funciona onde deveria). Destrava a
  //    camada e repete o MESMO arrasto, no MESMO ponto, com as MESMAS sondas
  //    de token: se elas enxergam o token saindo e chegando, então o silêncio
  //    medido acima com a camada travada é comportamento, não sonda cega.
  await limparSelecao(page, box)
  await destravarTokens(page)
  const origemAntesDoControle = await recorte(page, box, SONDA_TOKEN)
  const destinoAntesDoControle = await recorte(page, box, SONDA_DESTINO_DO_TOKEN)
  await arrastar(page, de, ate)
  const origemDepoisDoControle = await recorte(page, box, SONDA_TOKEN)
  const destinoDepoisDoControle = await recorte(page, box, SONDA_DESTINO_DO_TOKEN)

  expect({
    salaNaoAndouParaADireita: mesmoPixel(direitaDepois, direitaAntes),
    salaNaoAndouParaBaixo: mesmoPixel(abaixoDepois, abaixoAntes),
    tokenTravadoFicouParado: mesmoPixel(tokenDepois, tokenAntes),
    controleTokenSaiuDaOrigem: !mesmoPixel(origemDepoisDoControle, origemAntesDoControle),
    controleTokenChegouAoDestino: !mesmoPixel(destinoDepoisDoControle, destinoAntesDoControle),
  }).toEqual({
    salaNaoAndouParaADireita: true,
    salaNaoAndouParaBaixo: true,
    tokenTravadoFicouParado: true,
    controleTokenSaiuDaOrigem: true,
    controleTokenChegouAoDestino: true,
  })
})

// CONTROLE POSITIVO isolado — o mesmo arrasto, no mesmo ponto, com a camada
// Tokens DESTRAVADA (como o mapa nasce). Passa hoje: é o que garante que a
// jornada acima fica vermelha por causa do cadeado, e não por coordenada
// errada, token que não nasceu ou sonda no lugar errado.
test('controle positivo: com a camada Tokens destravada, o mesmo arrasto move o token', async ({ page }) => {
  const box = await salaComTokenDentro(page)
  await abrirSecaoCamadas(page)
  // Sem nenhum clique no cadeado: o nome acessível "Travar Tokens" é a prova,
  // na tela, de que a camada está destravada neste teste.
  await expect(page.getByRole('button', { name: 'Travar Tokens', exact: true })).toHaveAttribute('aria-pressed', 'false')

  const origemAntes = await recorte(page, box, SONDA_TOKEN)
  const destinoAntes = await recorte(page, box, SONDA_DESTINO_DO_TOKEN)

  const de = { x: box.x + CENTRO_DO_TOKEN.x, y: box.y + CENTRO_DO_TOKEN.y }
  await arrastar(page, de, { x: de.x + DESLOCAMENTO.x, y: de.y + DESLOCAMENTO.y })

  const origemDepois = await recorte(page, box, SONDA_TOKEN)
  const destinoDepois = await recorte(page, box, SONDA_DESTINO_DO_TOKEN)

  expect({
    tokenSaiuDaOrigem: !mesmoPixel(origemDepois, origemAntes),
    tokenChegouAoDestino: !mesmoPixel(destinoDepois, destinoAntes),
  }).toEqual({
    tokenSaiuDaOrigem: true,
    tokenChegouAoDestino: true,
  })
})
