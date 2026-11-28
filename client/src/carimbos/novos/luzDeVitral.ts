import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Luz de vitral (lote L03 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas Castelo,
 * Capela e Templo): a luz do sol que atravessa o vitral e pousa no chão. É o desenho da janela deitado no chão e
 * esticado no rumo da luz, como as pedras, visto de cima e um pouco de frente: duas lancetas de arco quebrado e a
 * rosácea em cima. Cada vidro é um tom claro (mel, rosa-velho, azul de céu, verde-sálvia, ouro pálido); o chumbo entre
 * os vidros é, no chão, o fio sem luz entre eles, e o mainel de pedra entre as lancetas é a faixa sem luz mais larga.
 * Em volta, o halo fraco da luz que espalha, e o miolo um nada mais claro.
 *
 * Luz não escurece: todo vidro é um tom MAIS CLARO que o chão de pedra, meio transparente, para clarear e tingir
 * qualquer chão (pedra, madeira, tapete). A semente troca as cores dos vidros (o vitral de cada janela) e a rosácea
 * (redonda ou de quatro folhas); o giro deita a luz noutro rumo (a janela noutra parede). É do chão
 * (`sombra: 'nenhuma'`).
 *
 * SEM `brilho` de propósito: o brilho dos carimbos pulsa como brasa (`pixi/brilhoDosCarimbos.ts`), e a luz do sol
 * pelo vidro não treme. A luz de verdade, no escuro, é a entrada parada em `LUZ_DOS_CARIMBOS` que o relatório sugere.
 */

type P = readonly [number, number]

/** O chão visto de cima e um pouco de frente (o mesmo das Runas no chão). */
const ACHATA = 0.58
/** O meio da luz no quadro: com o giro que for, a luz e o halo ficam entre y -0,55 e 0,27 (o quadro vai até 0,3). */
const MEIO_Y = -0.14
/** A janela (unidades dela) vezes isto dá a luz no quadro. */
const ESCALA = 1
/** O sol entra de lado e de cima: o quanto o alto da janela anda de través no chão, e o quanto a luz estica. */
const VIES = 0.3
const ESTICA = 1.05

/**
 * A janela, em unidades dela (x de través, y para cima a partir do peitoril): a meia largura das duas lancetas
 * juntas, a meia largura do mainel, a altura do ombro do arco, a rosácea e a altura do meio (o meio da luz).
 */
const JANELA = { meiaLargura: 0.215, mainel: 0.035, ombro: 0.55, rosaY: 0.86, rosaR: 0.1, meio: 0.48 } as const
/** As fileiras de vidro das lancetas, do peitoril ao ombro (o arco é o vidro de cima). */
const FILEIRAS = [0, 0.14, 0.28, 0.42, 0.55] as const
/** A meia grossura do chumbo (unidades da janela) e o halo em volta. */
const CHUMBO = 0.007
const HALO = 0.045
/** Pontos por arco (o arco quebrado e a rosácea). */
const PONTOS_DO_ARCO = 7
const PONTOS_DO_CIRCULO = 22

/** Os vidros: tons claros, nunca de tinta (a régua "não estoura" vale para a luz também). */
const VIDROS: readonly Rgb[] = [
  [236, 206, 150],
  [226, 172, 162],
  [172, 192, 226],
  [182, 212, 170],
  [238, 224, 182],
]
/** A luz que espalha em volta e o miolo. */
const HALO_COR: Rgb = [238, 226, 194]
const MIOLO: Rgb = [244, 236, 212]
const ALFA = { vidro: 0.5, haloLonge: 0.04, haloFora: 0.07, haloDentro: 0.09, miolo: 0.1 } as const
/** A chance de um vidro sair na cor de destaque da janela. */
const CHANCE_DO_DESTAQUE = 0.18

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Da janela (wx, wy) para o quadro: a janela deita no chão (o alto cai mais longe), gira com o giro e o chão achata. */
function naTela(wx: number, wy: number, cos: number, sen: number): P {
  const dy = wy - JANELA.meio
  const fx = (wx + VIES * dy) * ESCALA
  const fy = -dy * ESTICA * ESCALA
  return [fx * cos - fy * sen, MEIO_Y + (fx * sen + fy * cos) * ACHATA]
}

/** O arco quebrado sobre [x0, x1] a partir do ombro `y0` (os dois arcos de raio igual ao vão, do peitoril para cima). */
function arcoQuebrado(x0: number, x1: number, y0: number): P[] {
  const vao = x1 - x0
  const pontos: P[] = [[x0, y0]]
  for (let i = 1; i <= PONTOS_DO_ARCO; i += 1) {
    const a = Math.PI - (Math.PI / 3) * (i / PONTOS_DO_ARCO)
    pontos.push([x1 + vao * Math.cos(a), y0 + vao * Math.sin(a)])
  }
  for (let i = 1; i <= PONTOS_DO_ARCO; i += 1) {
    const a = Math.PI / 3 - (Math.PI / 3) * (i / PONTOS_DO_ARCO)
    pontos.push([x0 + vao * Math.cos(a), y0 + vao * Math.sin(a)])
  }
  return pontos
}

function circulo(cx: number, cy: number, r: number, de = 0, ate = Math.PI * 2): P[] {
  const pontos: P[] = []
  const passos = Math.max(3, Math.round((PONTOS_DO_CIRCULO * (ate - de)) / (Math.PI * 2)))
  for (let i = 0; i <= passos; i += 1) {
    const a = de + ((ate - de) * i) / passos
    pontos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pontos
}

/** Um vidro da rosácea redonda: o quarto entre `de` e `ate`, com o chumbo em volta. */
function quartoDaRosa(de: number, ate: number): P[] {
  const folga = CHUMBO / JANELA.rosaR
  const meio = (de + ate) / 2
  // O canto do meio recua do cruzamento do chumbo, no rumo do meio do quarto.
  const canto: P = [Math.cos(meio) * CHUMBO * 1.6, JANELA.rosaY + Math.sin(meio) * CHUMBO * 1.6]
  return [canto, ...circulo(0, JANELA.rosaY, JANELA.rosaR - CHUMBO, de + folga, ate - folga)]
}

interface Vidro {
  readonly pontos: readonly P[]
  readonly cor: Rgb
}

/** Os vidros da janela de semente `semente`, em unidades da janela. */
function vidrosDa(semente: number): Vidro[] {
  const principal = Math.floor(sorteio(semente, 1) * VIDROS.length) % VIDROS.length
  const segunda = (principal + 1 + Math.floor(sorteio(semente, 2) * (VIDROS.length - 1))) % VIDROS.length
  let destaque = (segunda + 1 + Math.floor(sorteio(semente, 3) * (VIDROS.length - 1))) % VIDROS.length
  if (destaque === principal) destaque = (destaque + 1) % VIDROS.length
  const corDo = (n: number, par: boolean): Rgb => VIDROS[sorteio(semente, 10 + n) < CHANCE_DO_DESTAQUE ? destaque : par ? principal : segunda]
  const vidros: Vidro[] = []
  let n = 0
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -JANELA.meiaLargura : JANELA.mainel
    const x1 = lado < 0 ? -JANELA.mainel : JANELA.meiaLargura
    const xm = (x0 + x1) / 2
    for (let f = 0; f + 1 < FILEIRAS.length; f += 1) {
      const y0 = FILEIRAS[f] + CHUMBO
      const y1 = FILEIRAS[f + 1] - CHUMBO
      vidros.push({ pontos: [[x0 + CHUMBO, y0], [xm - CHUMBO, y0], [xm - CHUMBO, y1], [x0 + CHUMBO, y1]], cor: corDo(n++, (f + lado) % 2 === 0) })
      vidros.push({ pontos: [[xm + CHUMBO, y0], [x1 - CHUMBO, y0], [x1 - CHUMBO, y1], [xm + CHUMBO, y1]], cor: corDo(n++, (f + lado) % 2 !== 0) })
    }
    vidros.push({ pontos: arcoQuebrado(x0 + CHUMBO, x1 - CHUMBO, JANELA.ombro + CHUMBO), cor: VIDROS[destaque] })
  }
  if (sorteio(semente, 4) < 0.5) {
    // A rosácea redonda, em quatro quartos.
    for (let q = 0; q < 4; q += 1) vidros.push({ pontos: quartoDaRosa((q * Math.PI) / 2 + Math.PI / 4, ((q + 1) * Math.PI) / 2 + Math.PI / 4), cor: VIDROS[q % 2 === 0 ? principal : destaque] })
  } else {
    // A de quatro folhas: quatro lóbulos em cruz e o botão no meio.
    const r = JANELA.rosaR * 0.42
    for (let q = 0; q < 4; q += 1) {
      const a = (q * Math.PI) / 2
      vidros.push({ pontos: circulo(Math.cos(a) * r * 1.25, JANELA.rosaY + Math.sin(a) * r * 1.25, r - CHUMBO), cor: VIDROS[q % 2 === 0 ? destaque : segunda] })
    }
    vidros.push({ pontos: circulo(0, JANELA.rosaY, r * 0.5), cor: VIDROS[principal] })
  }
  return vidros
}

/** A silhueta da janela inteira (as duas lancetas, o mainel e a rosácea), crescida de `folga`. */
function silhueta(folga: number): P[] {
  const x0 = -JANELA.meiaLargura - folga
  const x1 = JANELA.meiaLargura + folga
  // O arco grande sobre as duas lancetas, que cobre a rosácea.
  return [[x0, -folga], [x1, -folga], ...arcoQuebrado(x0, x1, JANELA.ombro).reverse()]
}

function preencher(g: CanvasRenderingContext2D, pontos: readonly P[], cos: number, sen: number): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => {
    const [tx, ty] = naTela(x, y, cos, sen)
    if (i === 0) g.moveTo(tx, ty)
    else g.lineTo(tx, ty)
  })
  g.closePath()
  g.fill()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const cos = Math.cos(giro)
  const sen = Math.sin(giro)
  // O halo: a luz que espalha em volta, em três passos para a beira sair macia.
  g.fillStyle = css(HALO_COR, ALFA.haloLonge)
  preencher(g, silhueta(HALO * 1.8), cos, sen)
  g.fillStyle = css(HALO_COR, ALFA.haloFora)
  preencher(g, silhueta(HALO), cos, sen)
  g.fillStyle = css(HALO_COR, ALFA.haloDentro)
  preencher(g, silhueta(0), cos, sen)
  // Os vidros, cada um no tom dele; o chumbo e o mainel são o que fica sem vidro.
  for (const vidro of vidrosDa(semente)) {
    g.fillStyle = css(vidro.cor, ALFA.vidro)
    preencher(g, vidro.pontos, cos, sen)
  }
  // O miolo um nada mais claro: o meio das lancetas, onde a luz chega mais inteira.
  g.fillStyle = css(MIOLO, ALFA.miolo)
  preencher(g, circulo(0, JANELA.meio - 0.06, JANELA.meiaLargura * 0.8), cos, sen)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'luz-de-vitral', nome: 'Luz de vitral', tamanho: 22, sombra: 'nenhuma', desenhar }

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [...VIDROS, HALO_COR, MIOLO]
