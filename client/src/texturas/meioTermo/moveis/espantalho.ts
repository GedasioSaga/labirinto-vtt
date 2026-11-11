/**
 * ESPANTALHO DE ROÇA (lote 3 dos objetos novos, 11/11/2026), EM PÉ, de frente
 * como o boneco de treino e a lápide: visto de cima ele seria um chapéu redondo
 * em cima de uma cruz, e ninguém diria o que é. O POSTE fincado num montinho de
 * terra, com duas pedras de calço; no alto, a TRAVESSA dos braços dentro das
 * mangas da CAMISA velha (o pano azul desbotado, a gola aberta com a palha do
 * peito, os botões, três remendos costurados, um rasgo e a barra em farrapos),
 * com a PALHA saindo pelos punhos amarrados e por baixo da barra; por cima, a
 * CABEÇA de saco com a cara costurada (um olho de botão, o outro em X, o nariz
 * de retalho e a boca em pontos) e o CHAPÉU de palha de aba larga, torto, com
 * a fita e a aba desfiada. No braço direito, um CORVO pousado.
 *
 * O que o separa do boneco de treino a 25% de zoom: o chapéu largo, a camisa
 * azul de mangas caídas (o boneco é um feixe de palha amarrado numa cruz nua),
 * o poste sozinho no chão (o boneco tem a base em X) e o corvo escuro no braço.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * como o boneco, ele passa da pegada para cima (a copa do chapéu, 0,18 casa).
 * A sombra no chão é a do espantalho em pé: o poste arrastado e, soltos, os
 * braços, o corpo, o chapéu e o corvo, cada um na sua altura. A palha, os
 * panos, a corda e o corvo são fixos. Material: `madeira` (o poste e a
 * travessa). O piso de luz é um cinza-escuro frio (`cena.corDoPiso`): com o
 * escuro da nogueira o corvo saía marrom.
 */
import { hash, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** O lado da casa em que o espantalho é desenhado (px do protótipo). */
const CASA = 56

// As alturas do desenho, em y da casa (0 no meio, para baixo cresce).
/** O pé do poste, no montinho de terra. */
const CHAO = 22
/** O meio da travessa dos braços. */
const OMBRO = -11.5
/** A barra da camisa. */
const BARRA = 8.5
/** A amarra do saco no pescoço e o meio da cabeça. */
const PESCOCO = -15.4
const CABECA = -22.2
/** O meio da aba do chapéu e o alto da copa. */
const ABA = -28.4
const COPA = -38

/** Meia largura do poste e da travessa, o meio comprimento da travessa e onde a manga acaba (o punho). */
const MEIO_POSTE = 2.1
const MEIA_TRAVESSA = 1.8
const MEIO_BRACO = 24.4
const PUNHO = 20.6
/** O chapéu fica torto: o lado direito mais alto (radianos, em volta do meio da aba). */
const TOMBO_DO_CHAPEU = -0.1
/** As alturas do corpo em que a sombra dele cai solta, em frações da altura do ombro. */
const ALTURAS_DO_CORPO: readonly number[] = [0.42, 0.6, 0.8]

/** A palha: o amarelo-palha contido do feno, e o fio seco, mais claro. */
const TOM_DA_PALHA: Rgb = [0xc4, 0xa7, 0x69]
const FIO_SECO: Rgb = [0xd4, 0xbd, 0x86]
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: TOM_DA_PALHA }
/** O fio solto é fino demais para a trama da palha: a mesma cor, lisa. */
const FIO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DA_PALHA }
/** O chapéu é palha trançada, mais clara e mais amarela que o saco da cabeça; a fita, um vermelho desbotado. */
const CHAPEU: MaterialDaPeca = { classe: 'palha', rgb: [0xd0, 0xb5, 0x76] }
const FITA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x8c, 0x4e, 0x47] }
/** O saco da cabeça: aniagem, mais parda que o linho do boneco de treino. */
const SACO: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb8, 0xa4, 0x82] }
/** A camisa: azul desbotado (saturação 0,32), que separa o corpo da palha e lê na terra e na lajota. */
const CAMISA: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x64, 0x7a, 0x93] }
const REMENDO_OCRE: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb0, 0x93, 0x5c] }
const REMENDO_VINHO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x86, 0x52, 0x4d] }
/** A linha das costuras (os remendos e a cara) e o escuro de dentro do rasgo. */
const LINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x3b, 0x30] }
const RASGO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x46, 0x55] }
/** Os botões da camisa (osso) e o botão escuro que faz de olho. */
const BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcd, 0xb2] }
const OLHO_DE_BOTAO: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x38, 0x33] }
/** A corda das amarras: sisal mais escuro que a palha. */
const SISAL: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x74, 0x4c] }
/** O montinho de terra revolvida no pé do poste e as pedras de calço. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x64, 0x50] }
const PEDRINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x97, 0x8e] }
/** O corvo: ardósia quase preta, a asa com o brilho azulado das penas, o bico cor de chifre. */
const CORVO: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x43, 0x4d] }
const ASA: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x5e, 0x6e] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0x62, 0x5c, 0x54] }
const BRILHO_DO_OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xd4, 0xc4] }
/** O escuro em que o pixel escuro demais é levantado (luminância linear 0,055): frio, para o corvo não sair marrom. */
const ESCURO_DO_CORVO: Rgb = [0x42, 0x42, 0x48]

/** Largura de um fio de palha (px do protótipo) e a fração dos pedaços que é vão escuro entre os fios. */
const LARGURA_DO_FIO = 1.6
const VAO_DA_PALHA = 0.3
/** Abaixo desta escala (pixels da imagem por px do protótipo) o fio fica com menos contraste, como no feno. */
const ESCALA_DO_FIO_INTEIRO = 1.5
const CONTRASTE_DO_FIO_MIUDO = 0.45
/** O raio de um fio de palha solto e o de uma volta de corda (px da casa). */
const RAIO_DO_FIO = 0.48
const RAIO_DA_CORDA = 0.62

/** A palha em feixe: fios de pé, um pouco tortos, cada pedaço com a sua luz e alguns secos, mais claros. */
function texDosFios(semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const torto = x + ruido(y * 0.13 + semente, x * 0.21) * 2.2
    const j = Math.floor(torto / LARGURA_DO_FIO)
    const atraves = torto / LARGURA_DO_FIO - j
    const h = hash(j, Math.floor(y / 6 + hash(j, semente, 71) * 3), semente)
    const contraste = escala < ESCALA_DO_FIO_INTEIRO ? CONTRASTE_DO_FIO_MIUDO : 1
    const fio = h < VAO_DA_PALHA ? -0.1 : -0.04 + (h - VAO_DA_PALHA) * 0.3 * Math.sin(atraves * Math.PI)
    s[3] += fio * contraste + ruido(x * 0.07 + 3, y * 0.07) * 0.06
    if (h <= 0.86) return
    const t = 0.4 * contraste
    s[0] += (FIO_SECO[0] - s[0]) * t
    s[1] += (FIO_SECO[1] - s[1]) * t
    s[2] += (FIO_SECO[2] - s[2]) * t
  }
}

/** Põe na cena uma peça desenhada na casa de 56 px (quem chama a leva para o tamanho da pegada). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => void

const SEM_BORDA: OpcoesDaPeca = { bisel: 0, contorno: 0 }

/** Retângulo girado `ang` radianos em volta do meio (cx, cy), de meias medidas `mx` e `my`. */
function girado(cx: number, cy: number, mx: number, my: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const canto = (x: number, y: number): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  return poligono([canto(-mx, -my), canto(mx, -my), canto(mx, my), canto(-mx, my)])
}

/** A forma girada `ang` radianos em volta de (cx, cy): o chapéu, que fica torto. */
function inclinada(f: Forma, cx: number, cy: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => cx + (x - cx) * co - (y - cy) * si)
  const ys = cantos.map(([x, y]) => cy + (x - cx) * si + (y - cy) * co)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => f.d(cx + (x - cx) * co + (y - cy) * si, cy - (x - cx) * si + (y - cy) * co),
  }
}

/** Um fio de palha solto: de onde sai (x, y da casa), o ângulo (radianos) e o comprimento. */
type Fio = readonly [number, number, number, number]

function porFio(por: Por, [ax, ay, ang, comp]: Fio, i: number): void {
  por(capsula(ax, ay, ax + Math.cos(ang) * comp, ay + Math.sin(ang) * comp, RAIO_DO_FIO), FIO, { bisel: 0.3, tom: 0.84 + 0.22 * hash(i, 5, 951), contorno: 0.16, semente: 700 + i })
}

// ---------- o chão e o poste ----------

/** A palha caída no chão, em volta do pé do poste. */
const PALHA_NO_CHAO: readonly Fio[] = [
  [-11.5, CHAO + 2.2, 0.2, 4.2],
  [7.4, CHAO + 3, -0.15, 4.8],
  [12.6, CHAO + 1.2, 0.5, 3.2],
]

/** A terra revolvida no pé do poste: o contorno torto da mancha (sem beira dura: é terra solta, não um disco). */
const TERRA_REVOLVIDA: readonly Ponto[] = [
  [-9.6, CHAO + 0.8],
  [-6.4, CHAO - 1.5],
  [-1.6, CHAO - 2],
  [3.8, CHAO - 1.7],
  [8.6, CHAO - 0.3],
  [10, CHAO + 1.6],
  [6.2, CHAO + 3.4],
  [0.6, CHAO + 3.9],
  [-5.2, CHAO + 3.3],
  [-9, CHAO + 2.4],
]
/** Os torrões em cima da terra revolvida: o meio, os dois raios e o ângulo. */
const TORROES: readonly (readonly [number, number, number, number, number])[] = [
  [-2.8, CHAO + 1.5, 2.1, 1.3, 0.2],
  [2.6, CHAO + 1.2, 1.8, 1.2, -0.3],
  [0.2, CHAO + 2.5, 2.4, 1.2, 0.05],
  [6.6, CHAO + 1.2, 1.3, 0.9, 0.5],
]

function montarPoste(por: Por, mad: MaterialDaPeca): void {
  // A terra revolvida e as duas pedras de calço; a palha caída em volta.
  por(poligono(TERRA_REVOLVIDA), TERRA, { bisel: 0, contorno: 0, tom: 0.9, alfa: 0.86, suave: 1.6, semente: 601 })
  por(elipseGirada(-6, CHAO + 1.5, 2.3, 1.6, 0.3), PEDRINHA, { bisel: 1.2, contorno: 0.3, semente: 602 })
  por(elipseGirada(5, CHAO + 2.3, 1.8, 1.3, -0.4), PEDRINHA, { bisel: 1, tom: 0.9, contorno: 0.3, semente: 603 })
  PALHA_NO_CHAO.forEach((fio, i) => porFio(por, fio, 40 + i))
  // O poste, do chão até dentro do saco da cabeça, e os torrões que sobem um pouco na frente do pé dele.
  por(caixa(-MEIO_POSTE, PESCOCO, MEIO_POSTE, CHAO + 0.6, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 605, projeta: { dist: 1, forca: 0.26 } })
  TORROES.forEach(([x, y, rx, ry, ang], i) => {
    por(elipseGirada(x, y, rx, ry, ang), TERRA, { bisel: 1, tom: 0.98 + 0.14 * hash(i, 7, 954), contorno: 0.24, semente: 606 + i })
  })
  // A travessa dos braços: só as pontas aparecem, para fora dos punhos.
  por(caixa(-MEIO_BRACO, OMBRO - MEIA_TRAVESSA, MEIO_BRACO, OMBRO + MEIA_TRAVESSA, 1), mad, { tabua: 0, bisel: 1.2, semente: 607 })
}

// ---------- a camisa ----------

/** A palha que sai por baixo da camisa: o feixe em volta do poste e a franja de fios. */
const FEIXE_DE_BAIXO: readonly Ponto[] = [
  [-7, BARRA - 3],
  [7, BARRA - 3],
  [6.2, BARRA + 3.4],
  [4.4, BARRA + 2.2],
  [2.6, BARRA + 4.4],
  [0.6, BARRA + 2.8],
  [-1.4, BARRA + 4.8],
  [-3.4, BARRA + 2.6],
  [-5.2, BARRA + 4],
  [-6.4, BARRA + 2.4],
]
const FRANJA: readonly Fio[] = [
  [-6.2, BARRA + 2.4, 1.86, 3.6],
  [-4.2, BARRA + 3.2, 1.62, 4.4],
  [-1.8, BARRA + 3.6, 1.74, 3.4],
  [0.8, BARRA + 3.4, 1.44, 4.6],
  [3.2, BARRA + 3.4, 1.58, 3.6],
  [5.4, BARRA + 2.6, 1.3, 4.2],
]
/** O leque de palha que sai de cada punho: a altura de onde o fio sai (a partir do ombro), o ângulo (0 = reto para fora, positivo desce) e o comprimento. */
const LEQUE_DO_PUNHO: readonly (readonly [number, number, number])[] = [
  [-1.6, -0.95, 3.6],
  [-0.6, -0.5, 5],
  [0.6, -0.16, 6],
  [1.8, 0.2, 5.4],
  [3, 0.55, 5.2],
  [4, 1, 4],
]
/** A manga do lado direito (a esquerda é o espelho): do ombro ao punho, com a barriga do pano caindo embaixo. */
const MANGA: readonly Ponto[] = [
  [7, OMBRO - 3.7],
  [PUNHO, OMBRO - 2.7],
  [PUNHO + 0.8, OMBRO + 1],
  [PUNHO - 0.4, OMBRO + 4.9],
  [15, OMBRO + 7.4],
  [7, OMBRO + 5.2],
]
/** O corpo da camisa: mais largo embaixo (o pano pende solto do ombro) e a barra em farrapos. */
const CORPO_DA_CAMISA: readonly Ponto[] = [
  [-8.4, OMBRO - 3.9],
  [8.4, OMBRO - 3.9],
  [9.3, OMBRO + 4],
  [10.9, BARRA - 1.6],
  [8.2, BARRA + 0.5],
  [5.6, BARRA - 1.3],
  [3, BARRA + 0.8],
  [0.4, BARRA - 0.9],
  [-2.4, BARRA + 0.9],
  [-5.2, BARRA - 1.1],
  [-8, BARRA + 0.7],
  [-10.9, BARRA - 1.6],
  [-9.3, OMBRO + 4],
]
/** A gola aberta: o V por onde a palha do peito aparece e as duas abas da gola, viradas para fora. */
const FUNDO_DA_GOLA = OMBRO + 6.4
const ABERTURA_DA_GOLA: readonly Ponto[] = [[-3.4, OMBRO - 3.9], [3.4, OMBRO - 3.9], [0.4, FUNDO_DA_GOLA]]
const ABA_DA_GOLA: readonly Ponto[] = [[4.9, OMBRO - 4.2], [3.1, OMBRO - 4.2], [0.6, FUNDO_DA_GOLA], [3.6, OMBRO + 2.4]]
/** Os botões que sobraram, abaixo da gola (y da casa). */
const BOTOES: readonly number[] = [OMBRO + 9.6, OMBRO + 13.6]

interface Remendo {
  readonly x: number
  readonly y: number
  readonly mx: number
  readonly my: number
  readonly ang: number
  readonly pano: MaterialDaPeca
}
/** Os três remendos: o do peito, o de perto da barra e o da manga esquerda. */
const REMENDOS: readonly Remendo[] = [
  { x: -5, y: OMBRO + 10.2, mx: 2.7, my: 2.5, ang: 0.16, pano: REMENDO_OCRE },
  { x: 5.8, y: BARRA - 4.6, mx: 2.3, my: 2, ang: -0.22, pano: REMENDO_VINHO },
  { x: -14, y: OMBRO + 1.7, mx: 2.4, my: 2, ang: 0.1, pano: LENCOL },
]
/** Os pontos de costura na beira do remendo: onde ficam (em meias medidas dele) e para que lado atravessam a beira. */
const PONTOS_DO_REMENDO: readonly (readonly [number, number, number, number])[] = [
  [-0.5, -1, 0, -1],
  [0.5, -1, 0, -1],
  [1, -0.5, 1, 0],
  [1, 0.5, 1, 0],
  [0.5, 1, 0, 1],
  [-0.5, 1, 0, 1],
  [-1, 0.5, -1, 0],
  [-1, -0.5, -1, 0],
]
/** Quanto cada ponto de costura entra no remendo e quanto sai dele (px da casa). */
const PONTO_PARA_DENTRO = 0.9
const PONTO_PARA_FORA = 0.8

function porRemendo(por: Por, r: Remendo, k: number): void {
  por(girado(r.x, r.y, r.mx, r.my, r.ang), r.pano, { bisel: 0.5, contorno: 0.3, semente: 640 + k })
  const co = Math.cos(r.ang)
  const si = Math.sin(r.ang)
  const noPano = (x: number, y: number): Ponto => [r.x + x * co - y * si, r.y + x * si + y * co]
  for (const [fx, fy, nx, ny] of PONTOS_DO_REMENDO) {
    const [ax, ay] = noPano(fx * r.mx - nx * PONTO_PARA_DENTRO, fy * r.my - ny * PONTO_PARA_DENTRO)
    const [bx, by] = noPano(fx * r.mx + nx * PONTO_PARA_FORA, fy * r.my + ny * PONTO_PARA_FORA)
    por(capsula(ax, ay, bx, by, 0.27), LINHA, { ...SEM_BORDA, semente: 644 + k })
  }
}

function montarCamisa(por: Por): void {
  // A palha por baixo da barra e a que sai dos punhos (as mangas e o corpo a cobrem na raiz).
  por(poligono(FEIXE_DE_BAIXO), PALHA, { bisel: 1, contorno: 0.24, textura: texDosFios(611), semente: 611 })
  FRANJA.forEach((fio, i) => porFio(por, fio, i))
  for (const lado of [-1, 1]) {
    LEQUE_DO_PUNHO.forEach(([dy, ang, comp], i) => {
      const x = lado * (PUNHO - 0.6)
      const y = OMBRO + dy
      por(capsula(x, y, x + lado * Math.cos(ang) * comp, y + Math.sin(ang) * comp, RAIO_DO_FIO), FIO, { bisel: 0.3, tom: 0.84 + 0.22 * hash(i, lado + 2, 952), contorno: 0.16, semente: 720 + i })
    })
  }
  // As mangas, caídas da travessa, e a amarra de corda em cada punho.
  for (const lado of [-1, 1]) {
    por(poligono(MANGA.map(([x, y]): Ponto => [lado * x, y])), CAMISA, { bisel: 2, ruga: 0.9, tom: lado < 0 ? 1.02 : 0.95, contorno: 0.26, semente: 620 + lado })
    for (const volta of [0, 1.3]) {
      const x = lado * (PUNHO - 1.6 - volta)
      por(capsula(x, OMBRO - 3, x, OMBRO + 4.9, RAIO_DA_CORDA), SISAL, { bisel: 0.6, contorno: 0.24, semente: 624 + lado })
    }
  }
  // O corpo, a gola aberta com a palha do peito e as duas abas dela.
  por(poligono(CORPO_DA_CAMISA), CAMISA, { bisel: 2.6, ruga: 1, contorno: 0.26, semente: 630, projeta: { dist: 1.2, forca: 0.24 } })
  por(poligono(ABERTURA_DA_GOLA), PALHA, { bisel: 0.5, tom: 0.92, contorno: 0.3, recesso: { k: 1, forca: 0.3 }, textura: texDosFios(631), semente: 631 })
  for (const lado of [-1, 1]) {
    por(poligono(ABA_DA_GOLA.map(([x, y]): Ponto => [0.4 + lado * (x - 0.4), y])), CAMISA, { bisel: 0.6, tom: 1.14, contorno: 0.3, semente: 633 + lado })
  }
  // A carreira dos botões: a beira do pano, mais escura, e os dois botões que sobraram.
  por(capsula(0.5, FUNDO_DA_GOLA, 0.8, BARRA - 2, 0.3), CAMISA, { ...SEM_BORDA, tom: 0.66, semente: 636 })
  for (const y of BOTOES) por(elipse(0.65, y, 0.78, 0.78), BOTAO, { bisel: 0.5, contorno: 0.34, semente: 637 })
  REMENDOS.forEach((remendo, k) => porRemendo(por, remendo, k))
  // O rasgo no lado direito, com dois fios de palha escapando por ele.
  por(capsula(7, OMBRO + 6.4, 8.4, OMBRO + 10.2, 0.42), RASGO, { ...SEM_BORDA, semente: 650 })
  porFio(por, [8.2, OMBRO + 9.6, 0.9, 2.6], 30)
  porFio(por, [7.8, OMBRO + 8.4, 0.4, 2.2], 31)
}

// ---------- a cabeça e o chapéu ----------

/** A boca: os pontos por onde a linha passa (um sorriso torto) e o meio comprimento de cada ponto de costura que a cruza. */
const BOCA: readonly Ponto[] = [
  [-4, CABECA + 3.5],
  [-2, CABECA + 4.6],
  [0.2, CABECA + 4.9],
  [2.4, CABECA + 4.5],
  [4.2, CABECA + 3.3],
]
const MEIO_PONTO_DA_BOCA = 0.85
/** Os dois olhos (x de cada um) e a altura deles; o braço do X do olho direito. */
const OLHOS = 2.9
const ALTURA_DOS_OLHOS = CABECA - 0.3
const BRACO_DO_X = 1.25

function montarCabeca(por: Por): void {
  // A sobra do saco abaixo da amarra, por cima da gola, e o saco: largo em cima, estreito no pescoço.
  por(poligono([[-3.6, PESCOCO - 0.4], [3.6, PESCOCO - 0.4], [5.4, PESCOCO + 3.2], [2.4, PESCOCO + 2.4], [0.2, PESCOCO + 3.6], [-2.6, PESCOCO + 2.5], [-5.4, PESCOCO + 3.2]]), SACO, { bisel: 0.8, tom: 0.88, contorno: 0.26, semente: 660 })
  por(uniao(elipse(0, CABECA - 0.6, 7, 6.6), elipse(0, CABECA + 3.4, 5.2, 4.2)), SACO, { bisel: 4.4, ruga: 0.8, contorno: 0.26, semente: 661 })
  // A cara costurada: o olho de botão, o outro em X (o botão caiu), o nariz de retalho e a boca em pontos.
  por(elipse(-OLHOS, ALTURA_DOS_OLHOS, 1.35, 1.35), OLHO_DE_BOTAO, { bisel: 0.7, contorno: 0.2, metal: 0.3, semente: 662 })
  for (const sobe of [-1, 1]) {
    por(capsula(OLHOS - BRACO_DO_X, ALTURA_DOS_OLHOS - sobe * BRACO_DO_X, OLHOS + BRACO_DO_X, ALTURA_DOS_OLHOS + sobe * BRACO_DO_X, 0.34), LINHA, { ...SEM_BORDA, semente: 663 })
  }
  por(poligono([[0.1, CABECA + 0.5], [1.4, CABECA + 2.9], [-1.2, CABECA + 2.8]]), REMENDO_VINHO, { bisel: 0.4, contorno: 0.3, semente: 664 })
  por(cadeia(BOCA, 0.3), LINHA, { ...SEM_BORDA, semente: 665 })
  for (const [x, y] of BOCA) por(capsula(x, y - MEIO_PONTO_DA_BOCA, x, y + MEIO_PONTO_DA_BOCA, 0.27), LINHA, { ...SEM_BORDA, semente: 666 })
  // A amarra do pescoço, com as duas pontas da corda caídas no ombro direito.
  por(capsula(3.4, PESCOCO + 0.4, 5.2, PESCOCO + 3.8, 0.5), SISAL, { bisel: 0.5, contorno: 0.24, semente: 667 })
  por(capsula(4.4, PESCOCO + 0.2, 7, PESCOCO + 2.6, 0.5), SISAL, { bisel: 0.5, tom: 0.92, contorno: 0.24, semente: 668 })
  por(capsula(-4.3, PESCOCO, 4.3, PESCOCO, 0.95), SISAL, { bisel: 0.9, contorno: 0.26, semente: 669 })
}

/** Os fios desfiados na beira da aba do chapéu (com o chapéu ainda direito). */
const DESFIADO_DA_ABA: readonly Fio[] = [
  [-13, ABA + 0.4, 2.7, 2.6],
  [-12.2, ABA + 1.6, 2.2, 2.2],
  [-6.4, ABA + 2.5, 1.9, 1.8],
  [5.2, ABA + 2.7, 1.2, 2],
  [12.8, ABA + 0.8, 0.5, 2.4],
]
/** A mordida que falta na beira da aba, do lado direito. */
const MORDIDA_DA_ABA: readonly Ponto[] = [[8.6, ABA + 3.6], [10.2, ABA + 1], [12, ABA + 3.4]]
/** A copa: o contorno de cima e dos lados (a base é o arco, redondo para a frente) e a altura da fita. */
const CONTORNO_DA_COPA: readonly Ponto[] = [
  [-6.6, ABA - 0.6],
  [-6.1, COPA + 3.6],
  [-4.7, COPA + 1],
  [-2.4, COPA],
  [2.4, COPA],
  [4.7, COPA + 1],
  [6.1, COPA + 3.6],
  [6.6, ABA - 0.6],
]
const ALTURA_DA_FITA = 2.6

function montarChapeu(por: Por): void {
  const torto = (f: Forma): Forma => inclinada(f, 0, ABA, TOMBO_DO_CHAPEU)
  // A aba por cima da testa (faz sombra na cara), com a mordida e os fios desfiados.
  DESFIADO_DA_ABA.forEach(([ax, ay, ang, comp], i) => {
    por(torto(capsula(ax, ay, ax + Math.cos(ang) * comp, ay + Math.sin(ang) * comp, RAIO_DO_FIO)), FIO, { bisel: 0.3, tom: 0.9 + 0.2 * hash(i, 9, 953), contorno: 0.16, semente: 740 + i })
  })
  por(torto(menos(elipse(0, ABA, 13.6, 2.9), poligono(MORDIDA_DA_ABA))), CHAPEU, { bisel: 1.2, contorno: 0.28, semente: 670, projeta: { dist: 1.8, forca: 0.32 } })
  // A copa, com a base redonda assentada no meio da aba, e a fita em volta dela.
  const base = elipse(0, ABA - 0.6, 6.6, 1.5)
  const copa = uniao(poligono(CONTORNO_DA_COPA), base)
  por(torto(copa), CHAPEU, { bisel: 2.2, tom: 1.04, contorno: 0.26, semente: 671, projeta: { dist: 0.8, forca: 0.2 } })
  const acimaDaFita = uniao(caixa(-9, COPA - 2, 9, ABA - 0.6 - ALTURA_DA_FITA), elipse(0, ABA - 0.6 - ALTURA_DA_FITA, 7, 1.5))
  por(torto(menos(copa, acimaDaFita)), FITA, { bisel: 0.5, contorno: 0.24, semente: 672 })
}

// ---------- o corvo ----------

/** Onde o corvo pisa: o alto da manga direita. */
const POLEIRO = OMBRO - 2.9

function montarCorvo(por: Por): void {
  for (const x of [15.5, 17.9]) por(capsula(x, POLEIRO - 2.6, x, POLEIRO + 0.2, 0.36), BICO, { bisel: 0.3, contorno: 0.2, semente: 680 })
  // O rabo para trás e para baixo, o corpo, a asa fechada, a cabeça virada para fora, o bico e o olho.
  por(poligono([[13.4, POLEIRO - 4.6], [9, POLEIRO - 1.2], [10, POLEIRO + 0.4], [11.6, POLEIRO - 0.2], [14.6, POLEIRO - 2.6]]), CORVO, { bisel: 0.7, tom: 0.92, contorno: 0.3, semente: 681 })
  por(elipseGirada(16.6, POLEIRO - 5, 5, 3.3, -0.42), CORVO, { bisel: 2.4, contorno: 0.3, semente: 682, projeta: { dist: 1, forca: 0.26 } })
  por(elipseGirada(15.4, POLEIRO - 4.6, 3.7, 1.9, -0.3), ASA, { bisel: 1.2, contorno: 0.24, semente: 683 })
  por(poligono([[22.2, POLEIRO - 9.1], [25.6, POLEIRO - 7.7], [22.3, POLEIRO - 6.8]]), BICO, { bisel: 0.5, contorno: 0.3, semente: 684 })
  por(elipse(20.4, POLEIRO - 8.2, 2.5, 2.4), CORVO, { bisel: 1.6, tom: 1.04, contorno: 0.3, semente: 685 })
  por(elipse(21.2, POLEIRO - 8.7, 0.5, 0.5), BRILHO_DO_OLHO, { ...SEM_BORDA, semente: 686 })
}

export const montarEspantalho: MontarMovel = (c, cena) => {
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por: Por = (forma, mat, o) => {
    cena.partes.push(c.peca(naPegada(forma), mat, o))
  }
  cena.corDoPiso = ESCURO_DO_CORVO

  // A sombra do espantalho em pé: o poste arrastado do chão ao ombro e, soltos, os braços, o corpo, o chapéu e o corvo.
  const zOmbro = (CHAO - OMBRO) * e
  cena.sombras.push(contato(naPegada(elipse(0.2, CHAO + 1.6, 6.4, 1.9)), 0.24))
  cena.sombras.push({ forma: naPegada(caixa(-MEIO_POSTE, CHAO - 1.2, MEIO_POSTE, CHAO + 0.8)), z: zOmbro, forca: 0.3 })
  cena.sombras.push({ forma: naPegada(caixa(-MEIO_BRACO, CHAO - 1.2, MEIO_BRACO, CHAO + 1.2, 1)), z: zOmbro, solta: true, forca: 0.26 })
  for (const f of ALTURAS_DO_CORPO) cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 9.8, 2.4)), z: zOmbro * f, solta: true, forca: 0.28 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO, 13, 2.6)), z: (CHAO - ABA) * e, solta: true, forca: 0.26 })
  cena.sombras.push({ forma: naPegada(elipse(17, CHAO, 4.4, 1.5)), z: (CHAO - POLEIRO + 5) * e, solta: true, forca: 0.24 })

  montarPoste(por, c.m.madeira)
  montarCamisa(por)
  montarCabeca(por)
  montarChapeu(por)
  montarCorvo(por)
}
