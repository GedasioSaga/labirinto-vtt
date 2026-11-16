import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * SEBE APARADA (Fase 6, 16/11/2026): a cerca viva que saiu do Objeto para o
 * Carimbo ("Carimbo coloque no carimbo tudo que é natural"). O carimbo só
 * guarda tipo, tamanho e giro, e a sebe é comprida, curva e faz canto; então
 * ela não é uma peça comprida, é um MÓDULO: um bloco de buxo aparado que
 * emenda sozinho no vizinho. O mestre desenha a sebe clicando um ao lado do
 * outro (reta, descida, curva, canto, o quadrado fechado do labirinto) e os
 * módulos viram uma massa só.
 *
 * Por que a emenda não aparece:
 * - a FORMA não gira: o pé é sempre o mesmo quadrado no chão, alinhado ao
 *   mapa. O giro do clique é sorteado e só troca as folhas (os oito desenhos);
 * - o TOPO é o quadrado do pé inteiro, sem achatar (a vista de cima das peças
 *   de grade), subido pela altura da frente: o módulo de baixo cobre a frente
 *   do de cima, e a sebe que desce lê como um topo comprido com a frente só na
 *   ponta de baixo, como a sebe de verdade vista do alto;
 * - nada marca a beira do módulo (nem moldura de tufos, nem brilho de quina,
 *   nem degradê): o topo é uma trama miúda de tufos, com a fase sorteada por
 *   desenho, que a borda de folha recorta. O vizinho que entra por cima corta
 *   a trama com a borda recortada dele, e trama cortada por folha lê como
 *   folha (a primeira folha, com tufos presos na borda, lia como ladrilho
 *   emoldurado: `tmp/referencias-2026-11-15/sebe/folha-r2.png`);
 * - a FRENTE é de faixas que correm deitadas (a folha, o pé mais escuro), e
 *   faixa deitada continua de um módulo ao outro.
 *
 * O pé desenhado (0,46 do tamanho) é um nada menor que a PEGADA de "Barra a
 * passagem" (0,5: `MEIA_PEGADA` de `lib/carimbosQueBarram.ts`): o que o olho
 * vê emendado sempre barra emendado, mesmo com os ±6% de tamanho do clique;
 * entre 0,46 e 0,5 de distância aparece uma fresta que ainda barra.
 *
 * A sombra é a `deitada`: o topo é chato, então a silhueta inteira desliza no
 * chão (para baixo e para a direita), sem a cunha que a `baixa` faria no topo
 * comprido. As cores partem do buxo da sebe do Objeto (`texturas/meioTermo/
 * materiais.ts`), um passo mais claras para a sebe ler sobre a grama.
 */

/** O pé da frente, rente ao chão: o verde mais fundo (o contorno fica acima de 0,18 de brilho). */
const PE: Rgb = [40, 70, 50]
/** A frente, de costas para a luz. */
const FRENTE: Rgb = [52, 90, 58]
/** As folhas da frente que pegam o céu. */
const FRENTE_LUZ: Rgb = [62, 102, 62]
/** O fundo entre os tufos do topo: aparece embaixo à direita de cada um. */
const TOPO_FUNDO: Rgb = [62, 104, 62]
/** O topo aparado, de frente para o céu. */
const TOPO: Rgb = [82, 128, 74]
/** O alto dos tufos, onde a luz de cima à esquerda bate em cheio. */
const TOPO_CLARO: Rgb = [106, 146, 86]

/** Meia largura do pé desenhado, em unidades (a meia pegada é 0,25). */
const MEIA = 0.23
/** A altura da frente na tela. */
const ALTURA = 0.2
/** O norte do topo e a aresta aparada (onde o topo encontra a frente). */
const Y_DO_TOPO = -MEIA - ALTURA
const Y_DA_ARESTA = MEIA - ALTURA

/** A borda de folha: o raio das bolinhas e o passo entre elas (o vão entre duas é a folha recortada). */
const RAIO_DA_BORDA = 0.028
const PASSO_DA_BORDA = 0.045
/** A trama dos tufos do topo: o passo (as fileiras em quincôncio), o raio e o tremido. */
const PASSO_DOS_TUFOS = 0.12
const RAIO_DO_TUFO = 0.064
const TREMIDO_DO_TUFO = 0.02
/** Onde o fundo aparece (embaixo à direita) e para onde o tufo se puxa (a luz), em unidades. */
const FUNDO_DO_TUFO = { x: 0.018, y: 0.022 } as const
const PUXA_DO_TUFO = { x: -0.004, y: -0.005 } as const
/** O claro de cada tufo: o raio (fração do tufo), o deslocamento para a luz e em quantos dos tufos. */
const RAIO_DO_CLARO = 0.32
const CLARO_DO_TUFO = { x: -0.022, y: -0.026 } as const
const COM_CLARO = 0.45
/** Os tufos pendurados na aresta aparada (a folha que passou da tesoura). */
const PENDURADOS = 5
/** O pé escuro da frente (fração da altura) e as folhas claras dela. */
const PE_ESCURO = 0.3
const LUZES_DA_FRENTE = 5

type Bolinha = readonly [number, number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Bolinhas de folha ao longo do lado (x0, y0)-(x1, y1): o passo, o raio e o lugar tremidos, para a borda não sair em contas. */
function bordaDeFolha(lista: Bolinha[], x0: number, y0: number, x1: number, y1: number, s: number, base: number, raio = RAIO_DA_BORDA): void {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / PASSO_DA_BORDA))
  for (let i = 0; i <= n; i++) {
    const t = Math.min(1, Math.max(0, (i + (i === 0 || i === n ? 0 : (sorteio(s, base + i * 3) - 0.5) * 0.5)) / n))
    lista.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, raio * (0.75 + 0.5 * sorteio(s, base + i * 3 + 1))])
  }
}

/** O retângulo de dentro e as bolinhas da borda num caminho só: tudo no sentido do relógio, então o preenchimento é a união. */
function caminho(g: CanvasRenderingContext2D, retangulo: readonly [number, number, number, number] | null, bolinhas: readonly Bolinha[]): void {
  g.beginPath()
  if (retangulo !== null) {
    const [x0, y0, x1, y1] = retangulo
    g.moveTo(x0, y0)
    g.lineTo(x1, y0)
    g.lineTo(x1, y1)
    g.lineTo(x0, y1)
    g.closePath()
  }
  for (const [x, y, r] of bolinhas) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
}

function preencher(g: CanvasRenderingContext2D, cor: Rgb, retangulo: readonly [number, number, number, number] | null, bolinhas: readonly Bolinha[]): void {
  if (retangulo === null && bolinhas.length === 0) return
  g.fillStyle = css(cor)
  caminho(g, retangulo, bolinhas)
  g.fill()
}

/** A frente: a folha na sombra (a borda recortada dos lados e de baixo), o pé mais escuro e umas folhas que pegam o céu. */
function desenharFrente(g: CanvasRenderingContext2D, s: number): void {
  const lado = MEIA - RAIO_DA_BORDA
  const chao = MEIA - RAIO_DA_BORDA
  const borda: Bolinha[] = []
  bordaDeFolha(borda, -lado, Y_DA_ARESTA, -lado, chao, s, 10)
  bordaDeFolha(borda, lado, Y_DA_ARESTA, lado, chao, s, 40)
  bordaDeFolha(borda, -lado, chao, lado, chao, s, 70)
  preencher(g, FRENTE, [-lado, Y_DA_ARESTA - 0.03, lado, chao], borda)

  // O pé: uma faixa deitada (continua no vizinho) de borda de cima bem recortada, que desce até a borda de baixo.
  const yDoPe = MEIA - ALTURA * PE_ESCURO
  const pe: Bolinha[] = []
  bordaDeFolha(pe, -lado, yDoPe, lado, yDoPe, s, 120, RAIO_DA_BORDA * 0.8)
  for (const [x, y, r] of borda) if (y > yDoPe) pe.push([x, y, r * 0.9])
  preencher(g, PE, [-lado, yDoPe, lado, chao], pe)

  // As folhas claras: soltas na metade de cima da frente, de pouco contraste.
  const luzes: Bolinha[] = []
  for (let i = 0; i < LUZES_DA_FRENTE; i++) {
    const x = -lado + (2 * lado * (i + sorteio(s, 200 + i))) / LUZES_DA_FRENTE
    const y = Y_DA_ARESTA + ALTURA * (0.15 + 0.4 * sorteio(s, 220 + i))
    luzes.push([x, y, RAIO_DA_BORDA * (0.5 + 0.4 * sorteio(s, 240 + i))])
  }
  preencher(g, FRENTE_LUZ, null, luzes)
}

/** O contorno do topo: a borda de folha no norte e nos lados, e uns tufos pendurados na aresta aparada. */
function caminhoDoTopo(g: CanvasRenderingContext2D, s: number): void {
  const lado = MEIA - RAIO_DA_BORDA
  const norte = Y_DO_TOPO + RAIO_DA_BORDA
  const borda: Bolinha[] = []
  bordaDeFolha(borda, -lado, norte, lado, norte, s, 300)
  bordaDeFolha(borda, -lado, norte, -lado, Y_DA_ARESTA, s, 340)
  bordaDeFolha(borda, lado, norte, lado, Y_DA_ARESTA, s, 380)
  for (let i = 0; i < PENDURADOS; i++) {
    const x = -lado + (2 * lado * (i + 0.2 + 0.6 * sorteio(s, 420 + i))) / PENDURADOS
    const r = RAIO_DA_BORDA * (0.55 + 0.4 * sorteio(s, 430 + i))
    borda.push([x, Y_DA_ARESTA - r * 0.3, r])
  }
  caminho(g, [-lado, norte, lado, Y_DA_ARESTA], borda)
}

/** Os tufos do topo: uma trama em quincôncio com a fase do desenho, solta das bordas (a borda do topo a recorta). */
function tufosDoTopo(s: number): Bolinha[] {
  const passoY = PASSO_DOS_TUFOS * 0.87
  const faseX = sorteio(s, 500) * PASSO_DOS_TUFOS
  const faseY = sorteio(s, 501) * passoY
  const tufos: Bolinha[] = []
  let i = 0
  let fileira = 0
  for (let y = Y_DO_TOPO - RAIO_DO_TUFO + faseY; y < Y_DA_ARESTA + RAIO_DO_TUFO; y += passoY, fileira += 1) {
    const recuo = fileira % 2 === 0 ? 0 : PASSO_DOS_TUFOS / 2
    for (let x = -MEIA - RAIO_DO_TUFO + faseX + recuo; x < MEIA + RAIO_DO_TUFO; x += PASSO_DOS_TUFOS) {
      i += 1
      tufos.push([
        x + (sorteio(s, 520 + i) - 0.5) * 2 * TREMIDO_DO_TUFO,
        y + (sorteio(s, 600 + i) - 0.5) * 2 * TREMIDO_DO_TUFO,
        RAIO_DO_TUFO * (0.85 + 0.3 * sorteio(s, 680 + i)),
      ])
    }
  }
  return tufos
}

/** O topo: o tom chapado e, recortada por ele, a trama: o fundo embaixo à direita de cada tufo, o tufo e o claro de alguns. */
function desenharTopo(g: CanvasRenderingContext2D, s: number): void {
  g.fillStyle = css(TOPO)
  caminhoDoTopo(g, s)
  g.fill()
  g.save()
  caminhoDoTopo(g, s)
  g.clip()
  const tufos = tufosDoTopo(s)
  preencher(
    g,
    TOPO_FUNDO,
    null,
    tufos.map(([x, y, r]): Bolinha => [x + FUNDO_DO_TUFO.x, y + FUNDO_DO_TUFO.y, r]),
  )
  preencher(
    g,
    TOPO,
    null,
    tufos.map(([x, y, r]): Bolinha => [x + PUXA_DO_TUFO.x, y + PUXA_DO_TUFO.y, r * 0.95]),
  )
  preencher(
    g,
    TOPO_CLARO,
    null,
    tufos.filter((_, i) => sorteio(s, 760 + i) < COM_CLARO).map(([x, y, r]): Bolinha => [x + CLARO_DO_TUFO.x, y + CLARO_DO_TUFO.y, r * RAIO_DO_CLARO]),
  )
  g.restore()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O giro só escolhe as folhas: a forma fica alinhada ao mapa para emendar no vizinho.
  const s = semente * 7 + Math.round(giro * 8) * 3 + 1
  desenharFrente(g, s)
  desenharTopo(g, s)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'sebe-aparada', nome: 'Sebe aparada', tamanho: 8, sombra: 'deitada', desenhar }

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [PE, FRENTE, FRENTE_LUZ, TOPO_FUNDO, TOPO, TOPO_CLARO]
