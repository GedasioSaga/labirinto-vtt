/**
 * PEÇA DE XADREZ GIGANTE (L03 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a peça de
 * pedra polida do salão de xadrez vivo, da altura de uma pessoa. EM PÉ e DE FRENTE nas duas vistas, como o anjo de
 * pedra e a estátua encapuzada (`EM_PE` em `tresQuartos.ts`): vista do alto, cada peça seria um disco, e só o cavalo
 * se diria o que é. De frente, a silhueta diz a peça de relance.
 *
 * Toda peça tem o mesmo PÉ torneado (o plinto, o toro e o filete) e o CORPO que afina para cima até a GOLA; daí para
 * cima, o que diz a peça: o peão, a bola; a torre, o anel e as ameias, com a seteira; o cavalo, a cabeça de perfil
 * olhando para a esquerda, com a crina, a orelha e o olho; o bispo, a mitra com o corte e a bolinha; a rainha, a coroa
 * de pontas com as bolinhas e a bola no alto; o rei, a coroa e a cruz. A TOMBADA é o rei caído de lado no chão (o
 * xeque-mate), com a sombra rente.
 *
 * A pedra é polida: lisa, com o veio fraco do mármore, a luz do torno (clara à esquerda, a faixa de brilho e a beira
 * da direita na sombra) e um brilho fraco no chanfro. As alturas seguem a proporção do jogo: o peão tem dois terços do
 * rei. O lado da peça sai do material: mármore (as claras) ou ardósia (as escuras).
 *
 * Desenhada na casa da estátua (56 px, 0 no meio, y para baixo, o chão em `CHAO`) e posta no tamanho da pegada
 * (`prepararEstatua` de `gargula.ts`). Material: `pedra`.
 */
import type { Rgb } from '../../ruido'
import { caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { arredondada, espelho, prepararEstatua, reguaDeSombra, VAO_DA_PEDRA } from './gargula'

export type FormaDaPecaDeXadrez = 'peao' | 'torre' | 'cavalo' | 'bispo' | 'rainha' | 'rei' | 'tombada'

/** O chão da casa da estátua (px do quadro de 56): o pé de toda peça em pé. */
const CHAO = 26
/** O escuro em que o pixel escuro demais é levantado: cinza neutro (o da pedra velha puxava a ardósia para o verde). */
const PISO_DA_PEDRA_POLIDA: Rgb = [0x40, 0x41, 0x46]
/** A luz do torno: o quanto a esquerda clareia, o escuro das duas beiras e a faixa de brilho (onde e de que largura). */
const LUZ_DO_TORNO = 0.17
const BEIRA_DO_TORNO = 0.09
const BRILHO_DO_TORNO = 0.1
const ONDE_BRILHA = -0.45
const LARGURA_DO_BRILHO = 0.18
/** O veio fraco da pedra polida. */
const LUZ_DO_VEIO = 0.035
/** O brilho do chanfro da pedra polida (fraco: é pedra, não metal). */
const POLIMENTO = 0.22
/** O rei tombado: o giro (um pouco mais que um quarto de volta, para o pé largo e a cruz pousarem no chão) e a escala. */
const GIRO_DA_TOMBADA = Math.PI / 2 + 0.11
const ESCALA_DA_TOMBADA = 0.86

/** Em que ponto do quadro da peça (o desenho de pé) cai um ponto da imagem, e o contrário. */
interface Quadro {
  readonly paraImagem: (x: number, y: number) => Ponto
  readonly paraPeca: (x: number, y: number) => Ponto
  readonly escala: number
}

const DE_PE: Quadro = { paraImagem: (x, y) => [x, y], paraPeca: (x, y) => [x, y], escala: 1 }

/** O quadro do rei tombado: girado em volta do meio da peça e deitado com o pé à direita, rente ao chão. */
function quadroDaTombada(): Quadro {
  const [c, s] = [Math.cos(GIRO_DA_TOMBADA), Math.sin(GIRO_DA_TOMBADA)]
  const [mx, my] = [0, 0]
  const [tx, ty] = [0, 15.2]
  const e = ESCALA_DA_TOMBADA
  return {
    paraImagem: (x, y) => [(c * (x - mx) - s * (y - my)) * e + tx, (s * (x - mx) + c * (y - my)) * e + ty],
    paraPeca: (x, y) => {
      const [a, b] = [(x - tx) / e, (y - ty) / e]
      return [c * a + s * b + mx, -s * a + c * b + my]
    },
    escala: e,
  }
}

/** A forma desenhada no quadro da peça, posta na imagem (a distância escala junto). */
function noQuadro(f: Forma, q: Quadro): Forma {
  if (q === DE_PE) return f
  const cantos = [q.paraImagem(f.b[0], f.b[1]), q.paraImagem(f.b[2], f.b[1]), q.paraImagem(f.b[0], f.b[3]), q.paraImagem(f.b[2], f.b[3])]
  const xs = cantos.map((p) => p[0])
  const ys = cantos.map((p) => p[1])
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => {
      const [px, py] = q.paraPeca(x, y)
      return f.d(px, py) * q.escala
    },
  }
}

/** O lado direito de um perfil torneado (de baixo para cima), fechado com o espelho: a silhueta da peça de torno. */
function torneada(direita: readonly Ponto[]): Forma {
  return arredondada(poligono([...direita, ...espelho(direita).reverse()]), 0.4)
}

/** A meia largura do perfil na altura `y` (interpolada entre os pontos; fora deles, a do ponto mais perto). */
function meiaLarguraDe(direita: readonly Ponto[]): (y: number) => number {
  const pontos = [...direita].sort((a, b) => a[1] - b[1])
  return (y) => {
    if (y <= pontos[0][1]) return pontos[0][0]
    for (let i = 1; i < pontos.length; i += 1) {
      const [x1, y1] = pontos[i]
      if (y <= y1) {
        const [x0, y0] = pontos[i - 1]
        return x0 + ((x1 - x0) * (y - y0)) / Math.max(1e-6, y1 - y0)
      }
    }
    return pontos[pontos.length - 1][0]
  }
}

/**
 * A pedra polida torneada: o veio fraco e a luz do torno, pela posição através da peça (`t`, de -1 na beira da
 * esquerda a 1 na da direita, na altura do ponto): clara à esquerda, a faixa de brilho e a beira da direita na sombra.
 * `escalaDaImagem` desfaz o `na` da estátua (o ponto chega em px da pegada; o perfil é do quadro de 56).
 */
function texTorno(q: Quadro, escalaDaImagem: number, meia: (y: number) => number, cx = 0): Textura {
  return (_u, _v, x, y, _p, s) => {
    const [px, py] = q.paraPeca(x / escalaDaImagem, y / escalaDaImagem)
    const t = Math.max(-1.2, Math.min(1.2, (px - cx) / Math.max(1, meia(py))))
    const brilho = Math.exp(-(((t - ONDE_BRILHA) / LARGURA_DO_BRILHO) ** 2))
    s[3] += -LUZ_DO_TORNO * t - BEIRA_DO_TORNO * t * t + BRILHO_DO_TORNO * brilho
    s[3] += LUZ_DO_VEIO * ruido(px * 0.11 + py * 0.04 + 17, py * 0.2 - px * 0.03)
  }
}

interface Desenho {
  readonly pedra: MaterialDaPeca
  /** Põe a peça (já no quadro e na pegada). */
  readonly por: (f: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void
  readonly q: Quadro
  readonly e: number
}

/** Uma parte de pedra polida da peça: a forma, a meia largura do torno nela, o tom, o chanfro e a semente. */
function parte(d: Desenho, f: Forma, meia: (y: number) => number, tom: number, bisel: number, semente: number, mais: OpcoesDaPeca = {}): void {
  d.por(noQuadro(f, d.q), d.pedra, { tabua: 0, bisel, tom, contorno: 0.3, metal: POLIMENTO, textura: texTorno(d.q, d.e, meia), semente, ...mais })
}

/** Um vão escuro (a seteira, o olho, o corte da mitra). */
function vao(d: Desenho, f: Forma, alfa: number, semente: number): void {
  d.por(noQuadro(f, d.q), VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
}

const constante = (v: number) => (): number => v

/** O PÉ de toda peça: o plinto, o toro e o filete. */
function pe(d: Desenho): void {
  parte(d, poligono([[-16.5, CHAO], [16.5, CHAO], [16.5, 23.4], [15.6, 22.6], [-15.6, 22.6], [-16.5, 23.4]]), constante(16.5), 0.9, 1, 1)
  parte(d, elipse(0, 21.2, 14.6, 2.3), constante(14.6), 1.02, 1.6, 2, { projeta: { dist: 0.7, forca: 0.26 } })
  parte(d, caixa(-12.2, 18.2, 12.2, 19.7, 0.6), constante(12.2), 0.9, 0.6, 3)
}

/** O CORPO que afina do filete até a gola (lado direito, de baixo para cima) e a gola dupla em cima. */
function corpoEGola(d: Desenho, direita: readonly Ponto[], yGola: number, meiaGola: number): void {
  parte(d, torneada(direita), meiaLarguraDe(direita), 1, 1.2, 4)
  parte(d, elipse(0, yGola, meiaGola, 1.9), constante(meiaGola), 1.06, 1.2, 5, { projeta: { dist: 0.8, forca: 0.28 } })
}

function desenharPeao(d: Desenho): void {
  corpoEGola(d, [[10.6, 18.6], [9.2, 15], [7.6, 9.6], [6.4, 5.8]], 5.4, 9.6)
  parte(d, caixa(-5, 1.8, 5, 4.4, 1), constante(5), 0.9, 0.6, 6)
  parte(d, elipse(0, -4, 7.4, 7.4), constante(7.4), 1.04, 4.2, 7, { projeta: { dist: 1, forca: 0.3 } })
}

function desenharTorre(d: Desenho): void {
  corpoEGola(d, [[11.8, 18.6], [10.7, 12], [9.9, 4], [9.6, -1.6]], -1.6, 10.8)
  // O fundo das ameias (o lado de trás, mais escuro), que aparece pelos vãos.
  parte(d, caixa(-11, -14.8, 11, -11.4), constante(11), 0.62, 0.4, 8, { contorno: 0.1 })
  parte(d, arredondada(poligono([[-9.6, -2.6], [9.6, -2.6], [12.4, -5], [12.4, -6.6], [-12.4, -6.6], [-12.4, -5]]), 0.4), constante(12.4), 1.04, 0.9, 9, { projeta: { dist: 0.9, forca: 0.3 } })
  const ameias: Ponto[] = [[-12.4, -6.4], [12.4, -6.4], [12.4, -15.6], [6.4, -15.6], [6.4, -11.6], [3.4, -11.6], [3.4, -15.6], [-3.4, -15.6], [-3.4, -11.6], [-6.4, -11.6], [-6.4, -15.6], [-12.4, -15.6]]
  parte(d, arredondada(poligono(ameias), 0.3), constante(12.4), 1.02, 1, 10)
  vao(d, capsula(0, 3, 0, 9, 1), 0.85, 11)
}

/** A cabeça do cavalo de perfil, olhando para a esquerda: da gola, pela crina, a orelha, a testa, o focinho e a garganta. */
const CABECA_DO_CAVALO: readonly Ponto[] = [
  [9.6, 5.6], [10.6, 1], [11.6, -4], [11.8, -9], [10.6, -13.6], [8.4, -17.2], [5.6, -19.6],
  [4.6, -21.2], [3.2, -25.6], [1.2, -21],
  [-1.6, -20.6], [-5.2, -19], [-9.2, -16], [-12.8, -12.6], [-14.8, -9.8],
  [-15.4, -7.8], [-14.4, -6.2], [-11.4, -6.2], [-10.2, -5.2],
  [-8.2, -5.6], [-6, -4.8], [-4.6, -2.4], [-5.6, 0.4], [-7.6, 3], [-9.4, 5.6],
]
/** A crina: a beira de trás da cabeça e a de dentro, em dentes (a franja das mechas). */
const CRINA_DE_FORA: readonly Ponto[] = [[10.6, 1], [11.6, -4], [11.8, -9], [10.6, -13.6], [8.4, -17.2], [5.6, -19.6], [4.6, -21.2]]

function desenharCavalo(d: Desenho): void {
  corpoEGola(d, [[11.2, 18.6], [10.2, 12.4], [9.6, 7.6]], 7, 11)
  parte(d, arredondada(poligono(CABECA_DO_CAVALO), 0.5), constante(13.5), 1.02, 1.6, 12, { textura: texTorno(d.q, d.e, constante(13.5), -2), projeta: { dist: 1, forca: 0.3 } })
  const dentro: Ponto[] = CRINA_DE_FORA.map(([x, y], i): Ponto => [x - (i % 2 === 0 ? 3.4 : 2.2), y + 0.6])
  parte(d, poligono([...CRINA_DE_FORA, ...dentro.reverse()]), constante(13.5), 0.84, 0.6, 13, { contorno: 0.2, textura: texTorno(d.q, d.e, constante(13.5), -2) })
  vao(d, elipse(-4.6, -14.4, 1.4, 1.05), 0.9, 14)
  vao(d, elipse(-13.3, -9.4, 0.95, 0.75), 0.75, 15)
  vao(d, capsula(-14.6, -7.1, -11.6, -7.4, 0.35), 0.55, 16)
  vao(d, poligono([[3.1, -24], [3.6, -21.6], [2.2, -21.4]]), 0.4, 17)
}

function desenharBispo(d: Desenho): void {
  corpoEGola(d, [[10.8, 18.6], [9.4, 13], [7.6, 6], [6.4, 0.4]], -0.2, 9.8)
  parte(d, elipse(0, -2.6, 7.6, 1.3), constante(7.6), 0.96, 0.8, 18)
  const mitra: Ponto[] = [[5.8, -3.6], [7.6, -6], [8.4, -9.4], [8, -13], [6.6, -16.4], [4.2, -19.6], [1.4, -21.8], [0, -22.2]]
  const formaDaMitra = torneada(mitra)
  parte(d, formaDaMitra, meiaLarguraDe(mitra), 1.04, 2.6, 19, { projeta: { dist: 0.9, forca: 0.3 } })
  vao(d, dentroDe(capsula(5.6, -16.6, -2, -10, 0.85), formaDaMitra), 0.8, 20)
  parte(d, elipse(0, -24, 2.3, 2.3), constante(2.3), 1.06, 1.4, 21)
}

function desenharRainha(d: Desenho): void {
  corpoEGola(d, [[11.2, 18.6], [9.8, 12], [7.6, 3], [6.6, -4]], -4.4, 10.2)
  parte(d, elipse(0, -6.6, 8, 1.3), constante(8), 0.96, 0.8, 22)
  // A cúpula de dentro da coroa e a bola do alto, atrás das pontas.
  parte(d, elipse(0, -17.4, 6.8, 4.6), constante(6.8), 0.94, 2.4, 23)
  parte(d, elipse(0, -22.9, 2.8, 2.8), constante(2.8), 1.06, 1.6, 24)
  const taca: Ponto[] = [[6.2, -7.4], [7.6, -10.6], [10.4, -14.4], [11.2, -15.4]]
  const pontas: Ponto[] = [[11.2, -18.8], [7.9, -15.4], [5.4, -18.8], [2.7, -15.4], [0, -18.8]]
  const direita: Ponto[] = [...taca, ...pontas]
  parte(d, arredondada(poligono([...direita, ...espelho(direita.slice(0, -1)).reverse()]), 0.3), meiaLarguraDe(taca), 1.02, 1.2, 25, { projeta: { dist: 0.8, forca: 0.28 } })
  for (const [i, x] of [-11.2, -5.4, 0, 5.4, 11.2].entries()) parte(d, elipse(x, -19.4, 1.5, 1.5), constante(1.5), 1.08, 1, 26 + i)
}

function desenharRei(d: Desenho): void {
  corpoEGola(d, [[11.6, 18.6], [10.2, 12], [8, 2], [7, -6]], -6.4, 10.6)
  parte(d, elipse(0, -8.6, 8.2, 1.3), constante(8.2), 0.96, 0.8, 32)
  parte(d, elipse(0, -18.8, 6.6, 3.6), constante(6.6), 0.96, 2, 33)
  const taca: Ponto[] = [[6.6, -9.4], [8.2, -12.6], [10.2, -16], [10.4, -17.2]]
  parte(d, torneada(taca), meiaLarguraDe(taca), 1.02, 1.2, 34)
  parte(d, caixa(-10.7, -18.6, 10.7, -16.4, 0.8), constante(10.7), 1.08, 0.8, 35, { projeta: { dist: 0.8, forca: 0.28 } })
  const cruz = uniao(caixa(-1.8, -27.8, 1.8, -20.6, 0.6), caixa(-5, -25.4, 5, -22.4, 0.6))
  parte(d, cruz, constante(5), 1.08, 0.9, 36, { projeta: { dist: 1, forca: 0.32 } })
}

const DESENHOS: Readonly<Record<Exclude<FormaDaPecaDeXadrez, 'tombada'>, (d: Desenho) => void>> = {
  peao: desenharPeao,
  torre: desenharTorre,
  cavalo: desenharCavalo,
  bispo: desenharBispo,
  rainha: desenharRainha,
  rei: desenharRei,
}

/** O alto de cada peça em pé (px do quadro): a sombra comprida no chão vai até ele. */
const ALTO: Readonly<Record<Exclude<FormaDaPecaDeXadrez, 'tombada'>, number>> = {
  peao: -11.4,
  torre: -15.6,
  cavalo: -25.6,
  bispo: -26.3,
  rainha: -25.7,
  rei: -27.8,
}

/**
 * A sombra comprida vai até o alto do bispo, no máximo: o que passa dele no rei é a cruz, fina, e a sombra dela não
 * conta (com ela, o rei passava a sombra de cima da de baixo no portão das peças em pé).
 */
const ALTO_DA_SOMBRA_COMPRIDA = -26.3

function sombraDePe(cena: Cena, na: (f: Forma) => Forma, escala: number, alto: number): void {
  cena.sombras.push(contato(na(caixa(-17, CHAO - 2, 17, CHAO + 0.4, 0.8)), 0.34))
  cena.sombras.push({ forma: na(reguaDeSombra(CHAO, 0, 14)), z: (CHAO - 19) * escala, forca: 0.26 })
  cena.sombras.push({ forma: na(reguaDeSombra(CHAO, 0, 5.5)), z: (CHAO - Math.max(alto, ALTO_DA_SOMBRA_COMPRIDA)) * escala, forca: 0.2 })
}

function sombraDaTombada(cena: Cena, na: (f: Forma) => Forma, escala: number): void {
  cena.sombras.push(contato(na(caixa(-23, CHAO - 4, 25, CHAO + 0.6, 2.4)), 0.36))
  cena.sombras.push({ forma: na(caixa(-22, CHAO - 5, 24, CHAO - 1, 2)), z: 14 * escala, forca: 0.24 })
}

/** O montador da peça na forma pedida. */
export function montadorDaPecaDeXadrez(forma: FormaDaPecaDeXadrez): MontarMovel {
  return (c: ContextoDoMovel, cena: Cena) => {
    const { por, na, escala } = prepararEstatua(c, cena)
    cena.corDoPiso = PISO_DA_PEDRA_POLIDA
    const pedra: MaterialDaPeca = { classe: 'liso', rgb: c.m.pedra.rgb }
    if (forma === 'tombada') {
      sombraDaTombada(cena, na, escala)
      const d: Desenho = { pedra, por, q: quadroDaTombada(), e: escala }
      pe(d)
      desenharRei(d)
      return
    }
    sombraDePe(cena, na, escala, ALTO[forma])
    const d: Desenho = { pedra, por, q: DE_PE, e: escala }
    pe(d)
    DESENHOS[forma](d)
  }
}

/** A 1ª versão (a de `MONTADORES`): o peão. As outras estão em `versoes/pecaDeXadrezVersoes.ts`. */
export const montarPecaDeXadrez: MontarMovel = montadorDaPecaDeXadrez('peao')
