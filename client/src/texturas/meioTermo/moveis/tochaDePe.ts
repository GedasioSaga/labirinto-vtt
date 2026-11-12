/**
 * TOCHA DE PÉ de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo
 * Templo e masmorra): a tocha alta de salão e de masmorra, solta no chão. Uma
 * HASTE fina de ferro num pé de TRÊS PERNAS (duas abertas para a frente, uma
 * para trás, como o braseiro), com um CESTO de grade no alto e, dentro dele, a
 * CABEÇA da tocha: o pano embebido em óleo, enrolado, com a brasa no miolo.
 *
 * De cima: as três pernas em estrela com o pé de bola, a sombra comprida da
 * haste e do cesto, longe, para baixo à direita (é ela que diz "alta"), e no
 * meio o aro do cesto com a cabeça. Não é o braseiro (a bacia larga e baixa,
 * cheia de carvão) nem o candelabro de chão (o anel de velas).
 *
 * ACESA (variante 0) e APAGADA (variante 1), como o braseiro: a chama é a
 * camada animada do fogo de casa (`lib/mobilia/fogoDeCasa.ts`), e a imagem
 * parada só tem a brasa no miolo da cabeça e o brilho dela; apagada, o pano
 * queimado quase preto, sem brasa, com cinza.
 *
 * NA 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura; cada peça
 * sobe com a mais alta que contém o meio da caixa dela; as estruturas saem pela
 * base da caixa):
 * - o COLAR do pé e a HASTE são colunas, sem peça (o alto some debaixo do cesto);
 * - o CESTO são duas estruturas soltas, as barras do fundo e as da frente NA
 *   TELA, cada uma com a metade dela do aro. A beirada de cada uma é a GRADE:
 *   por isso a espessura do perfil é a altura do cesto (`ALTURA_DO_CESTO_DA_TOCHA`);
 * - a CABEÇA é outra solta, que sai entre as duas metades (a caixa dela fecha
 *   depois da do fundo e antes da da frente); a beirada dela é o rolo de pano;
 * - o cesto não tem fundo pintado: um pino (a estrutura do tamanho de um
 *   ponto) deixava a beirada dele riscada ao lado do cesto, e a grade com a
 *   cabeça dentro já diz "cesto".
 * Por isso o desenho lê `c.giro` (o quarto de volta que a 3/4 pinta).
 *
 * As alturas são em LADOS (o menor lado da pegada): esticada, a tocha cresce
 * junto e a boca do cesto fica onde a chama a procura. Material: `metal`.
 */
import { TOCHA_DE_PE } from '../../../lib/mobilia/fogoDeCasa'
import { limitar01, type Rgb } from '../../ruido'
import { anel, capsula, elipse, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { CINZA, G, type MontarMovel } from './contexto'
import { FOGO_PARADO, texBrasa, texHalo } from './fogoDeCasa'

const GRAUS = Math.PI / 180

/**
 * Alturas em lados (0,6 casa na pegada de partida): o alto do colar do pé e o fundo do cesto (1,15 casa). A
 * haste e a sobra da cabeça moram em `TOCHA_DE_PE` (`lib/mobilia/fogoDeCasa.ts`), com a conta de onde a chama
 * animada nasce (`fogoDaTochaDePe`): a tela lê sem carregar o motor dos móveis.
 */
const ALTURA_DO_COLAR = 0.3
const ALTURA_DA_HASTE = TOCHA_DE_PE.alturaDaHaste
/** Quanto a cabeça passa da boca do cesto, em lados. */
const SOBRA_DA_CABECA = TOCHA_DE_PE.sobraDaCabeca
/**
 * A altura do cesto (px do protótipo). Na 3/4 é a BEIRADA das duas metades do
 * cesto e da cabeça: o perfil da tocha de pé usa este valor como espessura.
 */
export const ALTURA_DO_CESTO_DA_TOCHA = TOCHA_DE_PE.alturaDoCestoEmCasas * G

/** As medidas de cima, em fração do menor meio lado. */
const RAIO_DA_HASTE = 0.075
const RAIO_DO_COLAR = 0.12
const BARRAS = 6
const PRIMEIRA_BARRA = 30
const RAIO_DAS_BARRAS = 0.36
const GROSSURA_DA_BARRA = 0.06
const ARO_DE_FORA = 0.44
const ARO_DE_DENTRO = 0.31
const RAIO_DA_CABECA = 0.27
const RAIO_DA_BRASA = 0.12
/** As pernas: o ângulo de cada uma (90 = a frente), de onde saem, até onde vão, a grossura e a bola do pé. */
const PERNAS: readonly number[] = [30, 150, 270]
const PE_DE = 0.12
const PONTA_DO_PE = 0.86
const GROSSURA_DO_PE = 0.07
const RAIO_DA_BOLA = 0.1
/** Quantas voltas o pano dá do miolo à beira da cabeça (de cima, uma espiral). */
const VOLTAS_DO_PANO = 2.2

const TOM_DO_PE = 0.8
const TOM_DO_ARO = 0.98
const BRILHO_DO_FERRO = 0.3
/** O escuro em que o pixel escuro demais é levantado: o do braseiro (com o piso padrão o ferro saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O pano embebido em óleo: castanho escuro; queimado, quase preto. */
export const PANO_COM_OLEO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x6e, 0x58, 0x40] }
export const PANO_QUEIMADO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x3b, 0x34, 0x2e] }
/** Acesa: o brilho da brasa na cabeça (alfa no meio). */
const ALFA_DO_BRILHO = 0.4
/** Apagada: os flocos de cinza no alto da cabeça (x, y e raio em fração do raio da cabeça). */
const FLOCOS_DE_CINZA: readonly (readonly [number, number, number])[] = [
  [-0.3, -0.2, 0.22],
  [0.25, 0.1, 0.18],
  [-0.05, 0.38, 0.15],
]

const DO_TECIDO = texturaDaClasse('tecido')

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto (x, y) do desenho NA TELA, depois do quarto de volta que a 3/4 pinta. */
function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** O ponto do desenho que cai em (x, y) NA TELA (o avesso de `naTela`). */
function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa centrada em (mx, my): o desenho não muda, mas a peça sobe com o que está ali. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** Os pontos redondos de raio `r` numa forma só (as barras do cesto vistas de cima). */
function pontos(centros: readonly Ponto[], r: number): Forma {
  const xs = centros.map((p) => p[0])
  const ys = centros.map((p) => p[1])
  return {
    b: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d: (x, y) => Math.min(...centros.map(([px, py]) => Math.hypot(x - px, y - py))) - r,
  }
}

/** O pano enrolado: a trama do tecido, a costura escura entre uma volta e outra e o queimado do miolo. */
export function texPanoDaTocha(cx: number, cy: number, rCabeca: number, queimado: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_TECIDO !== null) DO_TECIDO(u, v, x, y, p, s, escala)
    const r = Math.hypot(x - cx, y - cy) / rCabeca
    const volta = r * VOLTAS_DO_PANO + Math.atan2(y - cy, x - cx) / (2 * Math.PI)
    s[3] -= 0.2 * limitar01(1 - Math.abs(volta - Math.floor(volta) - 0.5) * 5)
    s[3] -= queimado * limitar01(1.1 - r) + ruido(x * 0.9 + 5, y * 0.9) * 0.06
  }
}

export const montarTochaDePe: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const ferro = c.m.metal
  const acesa = c.variante !== 1
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const disco = (f: number, x = 0, y = 0): Forma => elipse(x, y, f * R, f * R)
  const zColar = ALTURA_DO_COLAR * lado
  const zFundo = ALTURA_DA_HASTE * lado
  const zAro = zFundo + ALTURA_DO_CESTO_DA_TOCHA
  const zCabeca = zAro + SOBRA_DA_CABECA * lado

  // ---------- as sombras: o pé no chão, a haste comprida, o cesto lá longe e as colunas ----------
  const [hx, hy] = doDesenho(SOMBRA_X * zFundo, SOMBRA_Y * zFundo, quartos)
  const [cx, cy] = doDesenho(SOMBRA_X * zAro, SOMBRA_Y * zAro, quartos)
  cena.sombras.push(
    contato(disco(RAIO_DO_COLAR * 1.3), 0.32),
    { forma: capsula(0, 0, hx, hy, RAIO_DA_HASTE * R * 1.3), z: 0, suave: 1.3, forca: 0.36 },
    { forma: deslocada(disco(ARO_DE_FORA), cx, cy), z: 0, suave: bordaDaSombra({ z: zAro }), forca: 0.3 },
    { forma: disco(RAIO_DO_COLAR), z: zColar, forca: 0 },
    { forma: disco(RAIO_DA_HASTE), z: zFundo, forca: 0 },
  )

  // ---------- no chão: as três pernas com o pé de bola ----------
  PERNAS.forEach((graus, i) => {
    const co = Math.cos(graus * GRAUS)
    const si = Math.sin(graus * GRAUS)
    const [tx, ty] = [co * PONTA_DO_PE * R, si * PONTA_DO_PE * R]
    const perna = capsula(co * PE_DE * R, si * PE_DE * R, tx, ty, GROSSURA_DO_PE * R)
    const bola = disco(RAIO_DA_BOLA, tx, ty)
    cena.sombras.push(contato(uniao(perna, bola), 0.3))
    L.push(P(comMeioEm(perna, tx, ty), ferro, { tabua: 0, bisel: GROSSURA_DO_PE * R, tom: TOM_DO_PE, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: 17500 + i * 2 }))
    L.push(P(bola, ferro, { tabua: 0, bisel: RAIO_DA_BOLA * R * 0.9, tom: TOM_DO_PE * 1.12, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: 17501 + i * 2 }))
  })

  // ---------- o cesto: as barras do fundo e as da frente NA TELA, cada metade com o seu aro ----------
  const barras = Array.from({ length: BARRAS }, (_, i): Ponto => {
    const a = (PRIMEIRA_BARRA + (i * 360) / BARRAS) * GRAUS
    return [Math.cos(a) * RAIO_DAS_BARRAS * R, Math.sin(a) * RAIO_DAS_BARRAS * R]
  })
  const naFrente = (p: Ponto): boolean => naTela(p[0], p[1], quartos)[1] > -0.05 * R
  const doFundo = barras.filter((p) => !naFrente(p))
  const daFrente = barras.filter(naFrente)
  const rBarra = GROSSURA_DA_BARRA * R
  const aro = anel(0, 0, ARO_DE_FORA * R, ARO_DE_FORA * R, ARO_DE_DENTRO * R, ARO_DE_DENTRO * R)
  const metadeDoAro = (frente: boolean): Forma => ({ b: aro.b, d: (x, y) => Math.max(aro.d(x, y), (frente ? -1 : 1) * naTela(x, y, quartos)[1]) })
  const opcoesDoAro = (semente: number) => ({ tabua: 0, bisel: 1, tom: TOM_DO_ARO, metal: BRILHO_DO_FERRO, contorno: 0.28, projeta: { dist: 1, forca: 0.3 }, semente })
  cena.sombras.push({ forma: pontos(doFundo, rBarra), z: zAro, solta: true, forca: 0 })
  L.push(P(comMeioEm(metadeDoAro(false), doFundo[0][0], doFundo[0][1]), ferro, opcoesDoAro(17510)))


  // ---------- a cabeça: o rolo de pano, com a brasa e o brilho (acesa) ou a cinza (apagada) ----------
  const rCabeca = RAIO_DA_CABECA * R
  cena.sombras.push({ forma: disco(RAIO_DA_CABECA), z: zCabeca, solta: true, forca: 0 })
  L.push(P(disco(RAIO_DA_CABECA), acesa ? PANO_COM_OLEO : PANO_QUEIMADO, { tabua: 0, bisel: rCabeca * 0.8, contorno: 0.26, textura: texPanoDaTocha(0, 0, rCabeca, acesa ? 0.34 : 0.2), semente: 17520 }))
  if (acesa) {
    L.push(P(disco(RAIO_DA_BRASA), FOGO_PARADO, { bisel: 0, contorno: 0, suave: 0.4, textura: texBrasa(0, 0, RAIO_DA_BRASA * R), semente: 17521 }))
    L.push(P(disco(RAIO_DA_CABECA * 0.96), FOGO_PARADO, { bisel: 0, contorno: 0, textura: texHalo(0, 0, rCabeca * 0.96, rCabeca * 0.96, ALFA_DO_BRILHO), semente: 17522 }))
  } else {
    FLOCOS_DE_CINZA.forEach(([fx, fy, f], i) => {
      L.push(P(elipse(fx * rCabeca, fy * rCabeca, f * rCabeca, f * rCabeca * 0.8), CINZA, { tabua: 0, bisel: 0, tom: 1.25, contorno: 0, alfa: 0.75, suave: 0.4, semente: 17523 + i }))
    })
  }

  // ---------- a metade da frente do cesto, por cima da cabeça na 3/4 ----------
  cena.sombras.push({ forma: pontos(daFrente, rBarra), z: zAro, solta: true, forca: 0 })
  L.push(P(comMeioEm(metadeDoAro(true), daFrente[0][0], daFrente[0][1]), ferro, opcoesDoAro(17530)))
}
