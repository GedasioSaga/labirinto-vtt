/**
 * PILHA DE BALAS DE CANHÃO de cima com volume (14/11/2026, o cerco e a
 * defesa): a pirâmide de balas de ferro do pátio da muralha, de base
 * quadrada, dentro do QUADRO de madeira que segura a primeira camada. Três
 * por três no chão, dois por dois no vão delas e uma em cima (catorze balas,
 * grandes o bastante para cada uma ter o brilho dela). O quadro tem as duas vigas compridas por cima das curtas, as
 * cantoneiras de ferro com os parafusos nos quatro cantos. Cada bala tem a
 * cúpula de ferro com o brilho do lado da luz, as manchas de ferrugem e os
 * furinhos da fundição; as de cima fazem sombra nas de baixo.
 *
 * O que separa esta pilha das dez balas do canhão (o triângulo deitado ao
 * lado da carreta) é a base quadrada, o quadro e o tamanho: aqui é o estoque
 * da bateria. A 25% de zoom sobram o quadro claro de madeira e os degraus
 * escuros da pirâmide, cada camada mais clara que a de baixo.
 *
 * Esticada, a pirâmide vira um telhado (a de cima é uma fileira, como nos
 * pátios de verdade): o raio sai do lado menor e o lado maior ganha balas.
 * Material: `madeira` (o quadro); o ferro das balas, a ferrugem e as
 * cantoneiras são fixos.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, elipse, poligono, uniao, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O ferro fundido das balas (o mesmo das balas do canhão) e o das cantoneiras, um pouco mais claro. */
const BALA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.8)) }
const CANTONEIRA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
/**
 * A ferrugem das balas: um marrom mais apagado que o da âncora. Com o laranja de lá, o brilho do metal em
 * cima da mancha fazia a bala parecer de cobre.
 */
const FERRUGEM: Rgb = rgb('#84604c')
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão. Com o piso padrão (a
 * nogueira) a barriga das balas, na sombra, saía marrom como madeira.
 */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

/**
 * Quantas balas a camada de baixo tem no lado menor da pegada. Com quatro (trinta balas) a pirâmide virava
 * uma grade miúda no tamanho de mesa; com três (catorze) cada bala tem o brilho dela.
 */
const BALAS_NO_LADO = 3
/** A sobra entre a pegada e o quadro (fração do lado), e a largura da viga do quadro (fração do menor lado). */
const SOBRA = 0.02
const VIGA = 0.085
/** As alturas, em casas: a viga do quadro. */
const ALTURA_DA_VIGA = 0.1
/** Quanto sobe cada camada, em raios: a bala de cima assenta no vão de quatro de baixo (raiz de 2). */
const SUBIDA_DA_CAMADA = Math.SQRT2
/** O tom de cada camada: as de cima pegam mais luz, e o degrau de uma para a outra é o que mostra a pirâmide. */
const TOM_DA_CAMADA = [0.76, 0.94, 1.12, 1.2]
/** O brilho do ferro fundido, menor que o do metal novo (0,42 por padrão): a bala é áspera. */
const BRILHO_DA_BALA = 0.27
/** Quanto da bala a ferrugem come, no máximo (no miolo da mancha ainda sobra um pouco do ferro). */
const FERRUGEM_CHEIA = 0.6
/** O tamanho da mancha de ferrugem e dos furinhos da fundição (em px do protótipo, a frequência do ruído). */
const ESCALA_DA_MANCHA = 0.22
const ESCALA_DO_FURO = 1.3

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * O ferro da bala: a ferrugem em manchas (mais na barriga, do lado da sombra, onde a umidade fica), os
 * furinhos da fundição e um grão que tira o liso de plástico.
 */
function texDaBala(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const barriga = limitar(((x - cx) * 0.6 + (y - cy) * 0.8) / r, -1, 1) * 0.18
    const mancha = ruido(x * ESCALA_DA_MANCHA + p.su, y * ESCALA_DA_MANCHA + p.sv) * 1.6 + ruido(x * 0.7 + p.sv, y * 0.7 + p.su) * 0.7
    const q = (mancha + barriga - 0.2) / 0.4
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    const furo = ruido(x * ESCALA_DO_FURO + p.su * 3, y * ESCALA_DO_FURO)
    s[3] += (furo < -0.36 ? -0.14 : 0) + ruido(x * 0.4 + p.sv, y * 0.4) * 0.06 - t * 0.12
  }
}

/** Onde cada coisa fica: o quadro (por fora e por dentro) e o raio das balas. */
interface Medidas {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly v: number
  readonly r: number
}

function medir(c: ContextoDoMovel): Medidas {
  const x1 = c.hw * (1 - SOBRA)
  const y1 = c.hh * (1 - SOBRA)
  const v = Math.min(c.w, c.h) * VIGA
  const r = (Math.min(x1, y1) - v) / BALAS_NO_LADO
  return { x0: -x1, y0: -y1, x1, y1, v, r }
}

/** O quadro: as duas vigas curtas embaixo, as compridas por cima delas e uma cantoneira de ferro em cada canto. */
function montarQuadro(c: ContextoDoMovel, cena: Cena, { x0, y0, x1, y1, v }: Medidas): void {
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const H = c.g * ALTURA_DA_VIGA
  const porFora = caixa(x0, y0, x1, y1, 0.8)
  cena.sombras.push({ forma: porFora, z: H, forca: 0.26 }, contato(porFora, 0.32))
  // As curtas (de través), entre as compridas: o veio de pé.
  L.push(P(caixa(x0, y0 + v * 0.5, x0 + v, y1 - v * 0.5, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.88, contorno: 0.3, semente: 8100 }))
  L.push(P(caixa(x1 - v, y0 + v * 0.5, x1, y1 - v * 0.5, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.86, contorno: 0.3, semente: 8101 }))
  // As compridas por cima, com a ponta passando um nada das curtas (o encaixe à meia madeira).
  L.push(P(caixa(x0, y0, x1, y0 + v, 0.7), mad, { tabua: 0, bisel: 1.1, tom: 1.02, contorno: 0.3, semente: 8102, projeta: { dist: 0.9, forca: 0.26 } }))
  L.push(P(caixa(x0, y1 - v, x1, y1, 0.7), mad, { tabua: 0, bisel: 1.1, tom: 0.98, contorno: 0.3, semente: 8103, projeta: { dist: 0.9, forca: 0.26 } }))
  // A cantoneira: a chapa em L dobrada por cima do canto, com dois parafusos.
  const a = v * 1.9
  const e = v * 0.62
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const cx = sx < 0 ? x0 : x1
    const cy = sy < 0 ? y0 : y1
    const ix = cx - sx * a
    const iy = cy - sy * a
    const ex = cx - sx * e
    const ey = cy - sy * e
    const chapa: Forma = poligono([[cx, cy], [ix, cy], [ix, ey], [ex, ey], [ex, iy], [cx, iy]])
    L.push(P(chapa, CANTONEIRA, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.24, semente: 8110 + sx + sy * 3, projeta: { dist: 0.5, forca: 0.24 } }))
    for (const [px, py] of [[cx - sx * a * 0.66, cy - sy * e * 0.5], [cx - sx * e * 0.5, cy - sy * a * 0.66]]) {
      L.push(P(elipse(px, py, 0.65, 0.65), PREGO, { bisel: 0.65, tom: 1.15, contorno: 0, metal: 0.3 }))
    }
  }
}

/** As camadas da pirâmide, de baixo para cima: cada uma no vão da de baixo, até sobrar uma fileira ou uma bala. */
function montarBalas(c: ContextoDoMovel, cena: Cena, { x1, y1, v, r }: Medidas): void {
  const P = c.peca
  const nx0 = Math.max(1, Math.floor((x1 - v) / r + 0.001))
  const ny0 = Math.max(1, Math.floor((y1 - v) / r + 0.001))
  for (let i = 0; nx0 - i >= 1 && ny0 - i >= 1; i += 1) {
    const nx = nx0 - i
    const ny = ny0 - i
    const formas: Forma[] = []
    const centros: [number, number][] = []
    for (let a = 0; a < nx; a += 1) {
      for (let b = 0; b < ny; b += 1) {
        const bx = (a - (nx - 1) / 2) * 2 * r
        const by = (b - (ny - 1) / 2) * 2 * r
        formas.push(elipse(bx, by, r, r))
        centros.push([bx, by])
      }
    }
    const todas = formas.reduce(uniao)
    cena.sombras.push({ forma: todas, z: r * (2 + i * SUBIDA_DA_CAMADA), forca: i === 0 ? 0.3 : 0.24 })
    if (i === 0) cena.sombras.push(contato(todas, 0.36))
    const tom = TOM_DA_CAMADA[Math.min(i, TOM_DA_CAMADA.length - 1)]
    formas.forEach((forma, j) => {
      const [bx, by] = centros[j]
      cena.partes.push(P(forma, BALA, {
        tabua: 0,
        bisel: r,
        tom: tom * (0.96 + ((j * 7 + i * 3) % 5) * 0.02),
        contorno: 0.32,
        metal: BRILHO_DA_BALA,
        textura: texDaBala(bx, by, r),
        semente: 8200 + i * 40 + j,
        projeta: i > 0 ? { dist: r * 0.3, forca: 0.36, suave: 0.9 } : undefined,
      }))
    })
    if (nx === 1 || ny === 1) break
  }
}

export const montarPilhaDeBalasDeCanhao: MontarMovel = (c, cena) => {
  const medidas = medir(c)
  cena.corDoPiso = ESCURO_DO_FERRO
  montarQuadro(c, cena, medidas)
  montarBalas(c, cena, medidas)
}
