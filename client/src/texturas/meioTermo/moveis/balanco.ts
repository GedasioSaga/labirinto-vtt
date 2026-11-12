/**
 * BALANÇO de cima com volume (lote 11 dos objetos novos, 11/11/2026): o
 * balanço de quintal ou de praça de aldeia, de troncos. Dois CAVALETES em A,
 * cada um de dois troncos que se cruzam no alto, com a TRAVE de tronco
 * deitada no cruzamento; pendurados nela por duas CORDAS cada, dois ASSENTOS
 * de tábua lado a lado. Por baixo de cada assento, o CHÃO GASTO de terra
 * batida, com os sulcos de quem arrasta o pé para frear.
 *
 * De cima, um balanço parado some: o assento fica debaixo da trave. Por isso
 * os assentos estão um pouco puxados para a frente (para o sul), cada um num
 * ponto do vaivém, e as cordas descem inclinadas: de cima elas aparecem em
 * escorço, uma linha curta da trave até a ponta do assento, e a sombra
 * comprida da trave cruza o chão. A 25% de zoom sobram a trave clara de lado a
 * lado, os dois cavaletes abertos nas pontas e as duas tábuas.
 *
 * Na 3/4 o balanço é visto de frente, em pé (`tresQuartos.ts`: cada sombra com
 * altura é uma estrutura, e cada peça sobe com a mais alta que contém o meio
 * da caixa dela):
 * - cada TRONCO do cavalete é inclinado e é cortado em FATIAS ao longo do
 *   comprimento, cada uma um tampo solto na altura dela (a técnica da
 *   banqueta), e cada fatia pinta um pouco além do corte para fechar o degrau
 *   na 3/4. O cavalete é um pouco GUINADO (o pé da frente para fora, o de trás
 *   para dentro): reto, os dois troncos cairiam um atrás do outro na 3/4 e o A
 *   não apareceria;
 * - as CORDAS também são fatias: de cima ficam em escorço, na 3/4 caem a prumo
 *   da trave até o assento;
 * - no GIRO ÍMPAR (90 ou 270, que só a 3/4 pinta: de cima o giro chega sempre
 *   0) os troncos e as cordas correm de lado na tela e a altura sobe de través:
 *   as fatias da planta saíam em degraus (o tronco em vértebras, a corda em
 *   tracinhos). Ali cada fatia é um pedaço da peça desenhado NA TELA, puxado
 *   para baixo pela altura que a 3/4 vai dar a ele (`pedacoNaTela`);
 * - a TRAVE sobe por uma estrutura fina, só o eixo dela (a fatia do tronco que
 *   passa debaixo da trave não pula para a altura dela), e a sombra dela no
 *   chão é pintada à parte, caindo para baixo à direita na tela em qualquer
 *   giro;
 * - cada ASSENTO é um tampo solto na altura dele, com a espessura pintada.
 * O perfil é o derivado sem beirada (`espessura: 0`), o da banqueta e do varal.
 *
 * As posições saem da pegada (desenho em 112 x 56 px, 2 x 1 casas); as alturas
 * e o comprimento das cordas são em casas. Materiais: `lenha` (os troncos e a
 * trave, com casca) e `madeira` (os assentos).
 */
import { barra, capsula, caixa, dentroDe, elipse, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, TOM_DA_CORDA, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O tamanho em que o balanço é desenhado (px do protótipo): 2 x 1 casas. */
const LARGURA_DO_DESENHO = 112
const ALTURA_DO_DESENHO = 56

/** A altura da trave e o comprimento das cordas, em casas. */
const ALTURA_DA_TRAVE = 1.3
const COMPRIMENTO_DA_CORDA = 1.0

/**
 * O cavalete (px do desenho): onde fica o alto, quanto os pés abrem para a frente e para trás, a guinada (o pé
 * da frente para fora, o de trás para dentro), o meio afastamento dos dois troncos no alto, quanto o tronco
 * passa da trave e o raio do tronco. Os dois troncos passam LADO A LADO no alto, sem se cruzar de cima: cruzados,
 * o fim de um tronco caía dentro das fatias do outro e as levava para a altura dele (a 3/4 saía em escada).
 */
const CAVALETE = { x: 46, abertura: 22, guinada: 6, noAlto: 2.3, alem: 0.12, raio: 1.9 } as const
/** A trave: até onde vai para cada lado (passa um pouco dos cavaletes), o raio e o eixo que a sobe na 3/4. */
const TRAVE = { meia: 51.5, raio: 2.3, eixo: 0.6 } as const
/** Os assentos [x do meio, o quanto a corda está inclinada para a frente (radianos)]: cada um num ponto do vaivém. */
const ASSENTOS: readonly (readonly [number, number])[] = [
  [-18, 0.32],
  [18, 0.18],
]
/** A tábua do assento (meia largura e meia fundura), a espessura que aparece embaixo e onde a corda prende. */
const ASSENTO = { meiaLargura: 8.6, meiaFundura: 2.8, espessura: 1.4, corda: 6.6 } as const
const RAIO_DA_CORDA = 0.55

/**
 * As fatias: quantas por tronco e por corda, e quanto cada uma pinta além do corte. Na 3/4 a fatia seguinte
 * sobe o passo dela mais a altura que ganha (no tronco quase 3 vezes o passo): a sobra fecha esse degrau.
 */
const FATIAS_DO_TRONCO = 40
const SOBRA_DO_TRONCO = 1.6
const FATIAS_DA_CORDA = 16
const SOBRA_DA_CORDA = 2.0
/**
 * A sombra de uma peça inclinada, pintada no chão em trechos (do pé para o alto): cada trecho mais borrado e
 * mais fraco, como a sombra que se afasta do pé. [onde começa, onde acaba (frações), borrão, força].
 */
const TRECHOS_DA_SOMBRA: readonly (readonly [number, number, number, number])[] = [
  [0, 0.4, 1.2, 0.26],
  [0.33, 0.72, 2.6, 0.22],
  [0.66, 1, 4.2, 0.18],
]

/** O chão gasto debaixo de cada assento: o meio (y), os raios e os sulcos de arrastar o pé. */
const CHAO_GASTO = { y: 2, rx: 8.5, ry: 13 } as const
const SULCOS: readonly number[] = [-2.6, 2.4]

const TERRA_BATIDA: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x69, 0x4c] }
const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x46, 0x34] }
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }

/** Tons: os troncos de trás na sombra da trave, a espessura do assento. */
const TOM_DO_TRONCO = 0.92
const TOM_DA_ESPESSURA = 0.66

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0), como na banqueta.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A casca do tronco: as fendas correm ao longo da tora e mudam bem devagar ao longo dela. Na 3/4 cada fatia
 * mostra um pedaço da tora deslocado da vizinha; com a casca da classe (que muda depressa ao longo da tora) o
 * tronco saía em anéis, como bambu. `origem` e (ux, uy) = o pé e o rumo do tronco.
 */
function texDaCasca(origem: Ponto, ux: number, uy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const aoLongo = (x - origem[0]) * ux + (y - origem[1]) * uy
    const deTraves = (y - origem[1]) * ux - (x - origem[0]) * uy
    if (p.mat.casca === 'betula') {
      // A bétula, como na casca da classe: branca, com os riscos escuros de través.
      let luz = ruido(aoLongo * 0.08 + p.semente * 3, deTraves * 0.3) * 0.08
      const marca = ruido(aoLongo * 0.55 + p.semente * 9, deTraves * 0.07 + p.semente)
      if (marca > 0.2) luz -= 0.4 * Math.min(1, (marca - 0.2) / 0.08)
      s[3] += luz
      return
    }
    const fenda = ruido(aoLongo * 0.025 + p.semente * 5, deTraves * 1.1 + p.semente)
    let luz = fenda * 0.2 + ruido(aoLongo * 0.04 + 17, deTraves * 0.6 + p.semente) * 0.05
    if (fenda < -0.12) luz -= 0.15
    s[3] += luz
  }
}

/** A textura só dentro da fatia (`de` a `ate` ao longo da peça, a partir de `origem`): fora dela a peça não pinta. */
function soNaFatia(textura: Textura | null, origem: Ponto, ux: number, uy: number, de: number, ate: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const aoLongo = (x - origem[0]) * ux + (y - origem[1]) * uy
    if (aoLongo < de || aoLongo >= ate) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** O assento gasto: a madeira com o meio da tábua mais claro (de tanto sentar) e as pontas mais sujas. */
function texDoAssento(cx: number, meia: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = Math.abs(x - cx) / meia
    s[3] += 0.12 * (1 - t * t) - 0.06 * limitar((t - 0.75) / 0.25, 0, 1)
  }
}

/** A terra batida: manchada, com a beira desfeita. */
const texDaTerra: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.35 + p.su, y * 0.35 + p.sv) * 0.12 + ruido(x * 1.2, y * 1.2 + p.su) * 0.05
  s[5] *= 0.75 + ruido(x * 0.12 + p.sv, y * 0.12 + p.su) * 0.5
}

/** O que a montagem passa a cada parte. */
interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  /** O ponto do desenho (px de 112 x 56) na pegada, e a escala de cada eixo. */
  readonly em: (x: number, y: number) => Ponto
  readonly sx: number
  readonly sy: number
  /** O tamanho sai do menor lado. */
  readonly k: number
  /** A altura da trave (px). */
  readonly zTrave: number
}

/**
 * Uma peça reta e inclinada (o tronco do cavalete, a corda): o eixo sai de `origem` no `rumo` (unitário); o corpo é
 * a cápsula de raio `raio` de `corpo[0]` a `corpo[1]` (px ao longo do eixo); `altura` dá a altura de cada ponto do
 * eixo, em reta de uma ponta do corpo à outra.
 */
interface Inclinada {
  readonly origem: Ponto
  readonly rumo: readonly [number, number]
  readonly corpo: readonly [number, number]
  readonly raio: number
  readonly altura: (aoLongo: number) => number
}

/** Como cada fatia é pintada: chanfro, tom, semente e a textura, feita para o eixo que a fatia mostra (origem e rumo). */
interface PinturaDaFatia {
  readonly bisel: number
  readonly tom: number
  readonly semente: number
  readonly textura: (origem: Ponto, ux: number, uy: number) => Textura | null
}

/** Quanto cada pedaço pinta além do corte quando a peça é desenhada na tela (giro ímpar), em px por k. */
const SOBRA_NA_TELA = 1.5

/** O quarto de volta que a 3/4 pinta é ímpar (90 ou 270). Só a 3/4 tem giro: de cima ele chega sempre 0. */
function giroImpar(giro: number): boolean {
  return Math.abs(Math.round(giro / 90)) % 2 === 1
}

/** Um pedaço da peça inclinada, de `de` a `ate` ao longo do eixo, que a 3/4 vai subir `z`. */
type PedacoNaTela = (de: number, ate: number, z: number, primeiro: boolean, ultimo: boolean) => Peca

/**
 * A peça inclinada DESENHADA NA TELA, para o giro ímpar. Ali o eixo dela corre de lado na tela e a altura sobe de
 * través: as fatias da planta, cada uma subida inteira, saíam em degraus (o tronco em vértebras, a corda em
 * tracinhos). Aqui cada pedaço é um trecho da cápsula que a peça ocupa NA TELA, puxado para baixo pela altura que
 * a 3/4 vai dar a ele: depois da subida, todos caem na mesma cápsula, com o mesmo chanfro e a mesma textura, sem
 * emenda. A caixa do pedaço fica simétrica em volta do meio dele: puxado para baixo, o meio cai no eixo da planta,
 * dentro da estrutura da própria fatia. De cima isto nunca aparece (a vista de cima chega com giro 0).
 */
function pedacoNaTela(o: Obra, inc: Inclinada, mat: MaterialDaPeca, pintura: PinturaDaFatia): PedacoNaTela {
  const { origem, rumo: [ux, uy], corpo: [a0, a1], raio, altura } = inc
  // O rumo do desenho que sobe na tela depois do quarto de volta.
  const [cx, cy] = desgirado(0, -1, o.c.giro)
  const naTela = (a: number): Ponto => [origem[0] + ux * a + cx * altura(a), origem[1] + uy * a + cy * altura(a)]
  const s0 = naTela(a0)
  const s1 = naTela(a1)
  const comprimento = Math.hypot(s1[0] - s0[0], s1[1] - s0[1])
  const ex = (s1[0] - s0[0]) / comprimento
  const ey = (s1[1] - s0[1]) / comprimento
  const escala = comprimento / (a1 - a0)
  const inteira = capsula(s0[0], s0[1], s1[0], s1[1], raio)
  const textura = pintura.textura(s0, ex, ey)
  const sobra = SOBRA_NA_TELA * o.k
  return (de, ate, z, primeiro, ultimo) => {
    const t0 = primeiro ? -raio - sobra : (de - a0) * escala - sobra
    const t1 = ultimo ? comprimento + raio + sobra : (ate - a0) * escala + sobra
    const meio = ((de + ate) / 2 - a0) * escala
    const meiaCaixa = Math.max(meio - t0, t1 - meio)
    const dx = z * cx
    const dy = z * cy
    const b = capsula(s0[0] + ex * (meio - meiaCaixa), s0[1] + ey * (meio - meiaCaixa), s0[0] + ex * (meio + meiaCaixa), s0[1] + ey * (meio + meiaCaixa), raio).b
    const pedaco: Forma = { b: [b[0] - dx, b[1] - dy, b[2] - dx, b[3] - dy], d: (x, y) => inteira.d(x + dx, y + dy) }
    return o.c.peca(pedaco, mat, {
      eixo: Math.atan2(ey, ex),
      tabua: 0,
      bisel: pintura.bisel,
      contorno: 0.28,
      tom: pintura.tom,
      semente: pintura.semente,
      textura: (_u, _v, x, y, p, s, esc) => {
        const tx = x + dx
        const ty = y + dy
        const t = (tx - s0[0]) * ex + (ty - s0[1]) * ey
        if (t < t0 || t >= t1) {
          s[5] = 0
          return
        }
        if (textura !== null) textura(tx * ex + ty * ey, ty * ex - tx * ey, tx, ty, p, s, esc)
      },
    })
  }
}

/**
 * Uma peça inclinada cortada em fatias, cada uma um tampo solto na altura `altura(meio da fatia)`. A estrutura
 * de cada fatia é só âncora (sem sombra e de borda mínima, como as frestas do varal): a sombra da peça inteira é
 * pintada à parte (`sombraInclinada`), e centenas de sombras borradas pesavam na conta. No giro par a peça da
 * fatia é a forma inteira da planta, com a textura só dentro da fatia (a técnica da banqueta: a fatia sobe ao
 * longo do próprio eixo e a sobra fecha o degrau); no ímpar, o pedaço desenhado na tela (`pedacoNaTela`).
 */
function emFatias(o: Obra, inc: Inclinada, mat: MaterialDaPeca, fatias: number, sobra: number, pintura: PinturaDaFatia): void {
  const { origem, rumo: [ux, uy], corpo: [a0, a1], raio, altura } = inc
  const no = (a: number): Ponto => [origem[0] + ux * a, origem[1] + uy * a]
  const [x0, y0] = no(a0)
  const [x1, y1] = no(a1)
  const forma = capsula(x0, y0, x1, y1, raio)
  const faixa = (de: number, ate: number): Forma => {
    const [xa, ya] = no(de)
    const [xb, yb] = no(ate)
    return barra(xa, ya, xb, yb, 2 * raio + 2)
  }
  const naTela = giroImpar(o.c.giro) ? pedacoNaTela(o, inc, mat, pintura) : null
  // Na tela as fatias ficam no corpo (o primeiro e o último pedaço levam as pontas redondas); na planta passam delas.
  const [de0, ate0] = naTela === null ? [a0 - raio, a1 + raio] : [a0, a1]
  const passo = (ate0 - de0) / fatias
  const textura = pintura.textura(origem, ux, uy)
  for (let j = 0; j < fatias; j += 1) {
    const de = de0 + j * passo
    const ate = de + passo
    const z = altura((de + ate) / 2)
    // A fatia que pisa não sobe: sem altura não é estrutura, e fica no chão.
    if (z > 0) o.cena.sombras.push({ forma: dentroDe(forma, faixa(de, ate)), z, solta: true, forca: 0, suave: 0.1 })
    if (naTela !== null) {
      o.cena.partes.push(naTela(de, ate, z, j === 0, j === fatias - 1))
      continue
    }
    const fatia: Forma = { b: faixa(de - sobra, ate + sobra).b, d: forma.d }
    o.cena.partes.push(
      o.c.peca(fatia, mat, { eixo: Math.atan2(uy, ux), tabua: 0, bisel: pintura.bisel, contorno: 0.28, tom: pintura.tom, semente: pintura.semente, textura: soNaFatia(textura, origem, ux, uy, de - sobra, ate + sobra) }),
    )
  }
}

/**
 * A sombra no chão de uma peça reta e inclinada, do ponto `a` (altura `za`) ao `b` (altura `zb`): como o
 * afastamento da sombra cresce com a altura, a sombra do eixo é o segmento entre as sombras das duas pontas.
 * Pintada em trechos, cada um mais borrado, e caindo para baixo à direita na tela em qualquer giro.
 */
function sombraInclinada(o: Obra, a: Ponto, za: number, b: Ponto, zb: number, raio: number, forca = 1): void {
  const [ax, ay] = desgirado(SOMBRA_X * za, SOMBRA_Y * za, o.c.giro)
  const [bx, by] = desgirado(SOMBRA_X * zb, SOMBRA_Y * zb, o.c.giro)
  const p0: Ponto = [a[0] + ax, a[1] + ay]
  const p1: Ponto = [b[0] + bx, b[1] + by]
  for (const [de, ate, suave, f] of TRECHOS_DA_SOMBRA) {
    const ponto = (t: number): Ponto => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]
    const [x0, y0] = ponto(de)
    const [x1, y1] = ponto(ate)
    o.cena.sombras.push({ forma: capsula(x0, y0, x1, y1, raio), z: 0, suave: suave * o.k, forca: f * forca })
  }
}

/** O CHÃO GASTO debaixo de cada assento: a terra batida e os dois sulcos de arrastar o pé. */
function montarChao(o: Obra, xDoAssento: number, semente: number): void {
  const { k } = o
  const [cx, cy] = o.em(xDoAssento, CHAO_GASTO.y)
  o.cena.partes.push(o.c.peca(elipse(cx, cy, CHAO_GASTO.rx * o.sx, CHAO_GASTO.ry * o.sy), TERRA_BATIDA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 3 * k, textura: texDaTerra, semente }))
  SULCOS.forEach((dx, i) => {
    const [x, y0] = o.em(xDoAssento + dx, CHAO_GASTO.y - CHAO_GASTO.ry * 0.62)
    const [, y1] = o.em(0, CHAO_GASTO.y + CHAO_GASTO.ry * 0.7)
    o.cena.partes.push(o.c.peca(capsula(x, y0, x + (i - 0.5) * 0.8 * k, y1, 0.6 * k), SULCO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.6 * k, semente: semente + 1 + i }))
  })
}

/** Um CAVALETE: os dois troncos guinados, do pé até um pouco além do cruzamento (onde a trave deita). */
function montarCavalete(o: Obra, lado: number, semente: number): void {
  const { c, k, zTrave } = o
  const lenha = c.m.lenha
  const raio = CAVALETE.raio * k
  // O de trás primeiro, o da frente depois (por cima, na lista).
  for (const [i, frente] of [-1, 1].entries()) {
    const pe = o.em(lado * (CAVALETE.x + frente * CAVALETE.guinada), frente * CAVALETE.abertura)
    const alto = o.em(lado * (CAVALETE.x + frente * CAVALETE.noAlto), 0)
    const dx = alto[0] - pe[0]
    const dy = alto[1] - pe[1]
    const comprimento = Math.hypot(dx, dy)
    const ux = dx / comprimento
    const uy = dy / comprimento
    const ponta: Ponto = [alto[0] + dx * CAVALETE.alem, alto[1] + dy * CAVALETE.alem]
    o.cena.sombras.push(contato(elipse(pe[0], pe[1], raio * 1.2, raio * 1.2), 0.34))
    sombraInclinada(o, pe, 0, ponta, zTrave * (1 + CAVALETE.alem), raio)
    const tronco: Inclinada = {
      origem: pe,
      rumo: [ux, uy],
      corpo: [0, comprimento * (1 + CAVALETE.alem)],
      raio,
      altura: (aoLongo) => zTrave * limitar(aoLongo / comprimento, 0, 1 + CAVALETE.alem),
    }
    emFatias(o, tronco, lenha, FATIAS_DO_TRONCO, SOBRA_DO_TRONCO * k, { bisel: raio * 0.8, tom: TOM_DO_TRONCO + i * 0.06, semente: semente + i, textura: texDaCasca })
  }
}

/** A TRAVE: o tronco deitado de cavalete a cavalete, a estrutura fina que a sobe e a sombra dela pintada no chão. */
function montarTrave(o: Obra): void {
  const { c, cena, k, zTrave } = o
  const [x0, y] = o.em(-TRAVE.meia, 0)
  const [x1] = o.em(TRAVE.meia, 0)
  const raio = TRAVE.raio * k
  const trave = capsula(x0, y, x1, y, raio)
  const eixo = capsula(x0, y, x1, y, TRAVE.eixo * k)
  cena.sombras.push({ forma: { b: trave.b, d: eixo.d }, z: zTrave, solta: true, forca: 0 })
  const [sx, sy] = desgirado(SOMBRA_X * zTrave, SOMBRA_Y * zTrave, c.giro)
  cena.sombras.push({ forma: capsula(x0 + sx, y + sy, x1 + sx, y + sy, raio), z: 0, suave: 0.8 + 0.09 * zTrave, forca: Math.max(0.16, 0.34 - 0.0022 * zTrave) })
  cena.partes.push(c.peca(trave, c.m.lenha, { eixo: 0, tabua: 0, bisel: raio * 0.8, contorno: 0.28, tom: 1.02, semente: 7120, textura: texDaCasca([x0, y], 1, 0) }))
}

/** Um ASSENTO pendurado: as duas cordas em fatias da trave até as pontas da tábua, a tábua e os nós. */
function montarAssento(o: Obra, xDoAssento: number, inclinacao: number, semente: number): void {
  const { c, cena, k, zTrave } = o
  const comprimento = c.g * COMPRIMENTO_DA_CORDA
  const zAssento = zTrave - comprimento * Math.cos(inclinacao)
  const avanco = comprimento * Math.sin(inclinacao)
  const [cx, yDaTrave] = o.em(xDoAssento, 0)
  const cy = yDaTrave + avanco
  const mx = ASSENTO.meiaLargura * k
  const my = ASSENTO.meiaFundura * k
  const tabua = caixa(cx - mx, cy - my, cx + mx, cy + my, 0.8 * k)
  const raioDaCorda = RAIO_DA_CORDA * k
  // A tábua, solta na altura dela (a sombra é a do motor, caída da altura), com a espessura embaixo.
  cena.sombras.push({ forma: tabua, z: zAssento, solta: true, forca: 0.26 })
  cena.partes.push(c.peca(tabua, c.m.madeira, { dx: 0.3 * k, dy: ASSENTO.espessura * k, eixo: 0, tabua: 0, bisel: 0.6 * k, contorno: 0.24, tom: TOM_DA_ESPESSURA, semente }))
  cena.partes.push(c.peca(tabua, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.1 * k, contorno: 0.2, tom: 1, semente: semente + 1, textura: texDoAssento(cx, mx) }))
  // As cordas: da trave (y da trave, altura da trave) até a ponta da tábua (y do assento, altura do assento).
  for (const [i, ponta] of [-1, 1].entries()) {
    const x = cx + ponta * ASSENTO.corda * k
    // A volta da corda na trave.
    cena.partes.push(c.peca(capsula(x, yDaTrave - 2.8 * k, x, yDaTrave + 2.8 * k, 0.75 * k), CORDA, { eixo: Math.PI / 2, bisel: 0.6 * k, contorno: 0.24, semente: semente + 2 + i }))
    sombraInclinada(o, [x, cy], zAssento, [x, yDaTrave], zTrave, raioDaCorda, 0.55)
    const corda: Inclinada = {
      origem: [x, yDaTrave],
      rumo: [0, 1],
      corpo: [0, avanco],
      raio: raioDaCorda,
      altura: (aoLongo) => zTrave - (zTrave - zAssento) * limitar(aoLongo / avanco, 0, 1),
    }
    emFatias(o, corda, CORDA, FATIAS_DA_CORDA, SOBRA_DA_CORDA * k, { bisel: raioDaCorda * 0.9, tom: 1, semente: semente + 4 + i, textura: () => texturaDaClasse('corda') })
    // O nó em cima da tábua.
    cena.partes.push(c.peca(elipse(x, cy, 1.05 * k, 1.05 * k), CORDA, { bisel: 0.8 * k, contorno: 0.26, ruga: 0.6, semente: semente + 6 + i, projeta: { dist: 0.5 * k, forca: 0.3 } }))
  }
}

export const montarBalanco: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DO_DESENHO
  const sy = c.h / ALTURA_DO_DESENHO
  const o: Obra = { c, cena, em: (x, y) => [x * sx, y * sy], sx, sy, k: Math.min(sx, sy), zTrave: c.g * ALTURA_DA_TRAVE }
  ASSENTOS.forEach(([x], i) => montarChao(o, x, 7000 + i * 10))
  montarCavalete(o, -1, 7100)
  montarCavalete(o, 1, 7110)
  montarTrave(o)
  ASSENTOS.forEach(([x, inclinacao], i) => montarAssento(o, x, inclinacao, 7200 + i * 20))
}
