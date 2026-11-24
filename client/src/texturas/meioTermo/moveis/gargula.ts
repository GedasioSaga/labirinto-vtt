/**
 * GÁRGULA (lote L04 de 24/11/2026, a Fortaleza do ritual; construção nova, do
 * grupo Monumentos e colunas). A gárgula PEQUENA de pedra, AGACHADA num
 * PEDESTAL QUADRADO e vista DE FRENTE, em pé, como a estátua de besta: o
 * corpo compacto, sentado sobre as ancas, com os joelhos dobrados dos lados;
 * os braços retos entre eles, com as MÃOS APOIADAS NA BEIRA do pedestal (os
 * dedos dobrados por cima dela); a cabeça baixa, de CÃO (o focinho que
 * avança, a testa pesada em V, os olhos fundos, as duas presas e as orelhas
 * de ponta, sem chifre); e as duas ASAS FECHADAS, coladas ao corpo: duas
 * gotas altas atrás dos ombros, com a ponta para cima.
 *
 * Revisão do diretor de arte (24/11/2026): a primeira era desenhada DE CIMA
 * (o bicho de costas no bloco) e lia como um besouro com botões nas costas;
 * na mesa virava ruído. De frente ela se lê pela silhueta, como a besta.
 * O que a separa da besta de verdade: a silhueta compacta e de pé (mais alta
 * que larga, sem envergadura), as asas fechadas, o focinho de cão no lugar
 * dos chifres de touro e as mãos na beira do pedestal.
 *
 * A pedra é a do painel (`c.m.pedra`), com o TEMPO fixo por cima, como na
 * estátua de cavalo: o cinza puxado para o verde, manchas de verdete onde a
 * chuva escorre, pintas claras de líquen e musgo nos cantos do pedestal.
 *
 * Figura desenhada de frente nas duas vistas: de cima e na 3/4 é a mesma
 * imagem, e a 3/4 só põe a sombra de baixo (`EM_PE` em `tresQuartos.ts`); o
 * quarto de volta deita a figura, como nos outros em pé. O desenho é feito
 * numa casa de 56 px (y cresce para baixo) e escala com o menor lado.
 *
 * Este arquivo também guarda o que as três estátuas do lote dividem (a pedra
 * com o tempo, o cone de pontas redondas, o musgo, o pedestal visto de
 * frente): a estátua de besta e a estátua encapuzada importam daqui.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

// ---------- o que as três estátuas do lote dividem ----------

/** O lado da casa em que as estátuas são desenhadas (px do protótipo). */
const CASA_DA_ESTATUA = 56
/** O cinza-esverdeado para onde a pedra é puxada e o verdete das manchas (os da estátua de cavalo). */
const VERDE_DO_TEMPO: Rgb = [0x6c, 0x7d, 0x68]
const VERDETE: Rgb = [0x4e, 0x5f, 0x50]
/** O escuro da pedra em que o pixel escuro demais é levantado (sem ele a beira na sombra saía marrom). */
const ESCURO_DA_PEDRA_VELHA: Rgb = [0x40, 0x47, 0x41]
/** O vão escuro dos detalhes (olho, narina, sulco), meio transparente sobre a pedra. */
export const VAO_DA_PEDRA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x39, 0x34] }
/** O líquen: rodelas claras e meio transparentes. */
const LIQUEN_DA_PEDRA: MaterialDaPeca = { classe: 'liso', rgb: [0xb6, 0xb9, 0xa0] }
/**
 * As manchas: o tamanho (px do protótipo por volta do ruído) e o da mancha miúda que recorta a beira delas. O
 * líquen só aparece a partir desta escala.
 */
const TAMANHO_DAS_MANCHAS = 6
const TAMANHO_DA_MANCHA_MIUDA = 3.4
const PESO_DA_MANCHA_MIUDA = 0.24
const ESCALA_DO_LIQUEN = 1
const LIMIAR_DO_LIQUEN = 0.34
const LUZ_DO_LIQUEN = 0.5
/**
 * Quanto do salpico do granito fica na pedra velha: a metade (revisão do diretor de arte, 24/11/2026). Inteiro, por
 * cima das manchas e do escorrido, o grão escuro lia como sujeira, igual nas quatro pedras do lote. O salpico é
 * multiplicado na cor da pedra (`motor.ts`): é sempre o tom escuro dela, nunca preto.
 */
export const SALPICO_DA_PEDRA_VELHA = 0.5
/** O escorrido da chuva: faixas finas de pé (a largura e o comprimento do ruído). */
const LARGURA_DO_ESCORRIDO = 0.7
const COMPRIMENTO_DO_ESCORRIDO = 0.045
/** O musgo: o verde-oliva do Meio-Termo, um pouco puxado para a pedra. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))

const DA_PEDRA = texturaDaClasse('pedra')

/**
 * A pedra com o tempo: manchas grandes de verdete (`manchas`, 0 a 1), pintas claras de líquen e, com `chuva`, o
 * escorrido em faixas de pé (para o que é desenhado de frente; de cima a chuva não escorre em faixa).
 */
export function texDaPedraVelha(manchas: number, chuva = 0): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    s[6] *= SALPICO_DA_PEDRA_VELHA
    const n = ruido(x / TAMANHO_DAS_MANCHAS + 13, y / TAMANHO_DAS_MANCHAS) + PESO_DA_MANCHA_MIUDA * ruido(x / TAMANHO_DA_MANCHA_MIUDA + 7, y / TAMANHO_DA_MANCHA_MIUDA + 29)
    const t = Math.min(1, Math.max(0, (n + 0.1) * 2.2)) * manchas
    if (t > 0) {
      s[0] += (VERDETE[0] - s[0]) * t
      s[1] += (VERDETE[1] - s[1]) * t
      s[2] += (VERDETE[2] - s[2]) * t
    }
    if (chuva > 0) {
      const faixa = ruido(x * LARGURA_DO_ESCORRIDO + 41, y * COMPRIMENTO_DO_ESCORRIDO + 9)
      if (faixa > 0.08) s[3] -= (faixa - 0.08) * chuva
    }
    if (escala < ESCALA_DO_LIQUEN) return
    const l = ruido(x / 1.3 + 51, y / 1.3 + 3)
    if (l > LIMIAR_DO_LIQUEN) s[3] += (l - LIMIAR_DO_LIQUEN) * LUZ_DO_LIQUEN
  }
}

/** A pedra do painel puxada `quanto` (0 a 1) para o cinza-esverdeado do tempo. */
export function pedraDoTempo(pedra: MaterialDaPeca, quanto: number): MaterialDaPeca {
  return { ...pedra, rgb: misturar(pedra.rgb, VERDE_DO_TEMPO, quanto) }
}

/** O musgo no tom da pedra em que ele cresce. */
export function musgoDaPedra(pedra: MaterialDaPeca): MaterialDaPeca {
  return { classe: 'liso', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, 0.3) }
}

/**
 * Cápsula de pontas desiguais (o cone de pontas redondas, a de Inigo Quilez, como no anjo de pedra): raio `ra`
 * em (ax, ay) e `rb` em (bx, by). Faz os chifres, as garras, os dedos das asas e as pregas do pano.
 */
export function conico(ax: number, ay: number, ra: number, bx: number, by: number, rb: number): Forma {
  const b: Caixa = [Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb)]
  const dx = bx - ax
  const dy = by - ay
  const h = Math.hypot(dx, dy)
  if (h <= Math.abs(ra - rb) + 1e-6) {
    const [cx, cy, r] = ra >= rb ? [ax, ay, ra] : [bx, by, rb]
    return { b, d: (x, y) => Math.hypot(x - cx, y - cy) - r }
  }
  const ux = dx / h
  const uy = dy / h
  const k = (ra - rb) / h
  const a = Math.sqrt(1 - k * k)
  return {
    b,
    d(x, y) {
      const px = x - ax
      const py = y - ay
      const aoLongo = px * ux + py * uy
      const atraves = Math.abs(px * uy - py * ux)
      const q = a * aoLongo - k * atraves
      if (q < 0) return Math.sqrt(atraves * atraves + aoLongo * aoLongo) - ra
      if (q > a * h) return Math.sqrt(atraves * atraves + (aoLongo - h) * (aoLongo - h)) - rb
      return atraves * a + aoLongo * k - ra
    },
  }
}

/** Os pontos do lado direito espelhados para o esquerdo. */
export function espelho(pontos: readonly Ponto[]): Ponto[] {
  return pontos.map(([x, y]): Ponto => [-x, y])
}

/** A forma engordada `r` px: arredonda as quinas de fora de um polígono (as de dentro continuam vivas). */
export function arredondada(f: Forma, r: number): Forma {
  return { b: [f.b[0] - r, f.b[1] - r, f.b[2] + r, f.b[3] + r], d: (x, y) => f.d(x, y) - r }
}

/** Um osso, um chifre ou um dedo em trechos: cada trecho é um cone do raio de um ponto ao do seguinte (x, y, raio). */
export type Trechos = readonly (readonly [number, number, number])[]

/** Os trechos numa forma só (sem emenda de contorno entre um cone e o seguinte), do lado `lado` (1 ou -1). */
export function emTrechos(pontos: Trechos, lado = 1): Forma {
  let forma: Forma | null = null
  for (let i = 1; i < pontos.length; i += 1) {
    const [ax, ay, ra] = pontos[i - 1]
    const [bx, by, rb] = pontos[i]
    const trecho = conico(lado * ax, ay, ra, lado * bx, by, rb)
    forma = forma === null ? trecho : uniao(forma, trecho)
  }
  if (forma === null) throw new Error('emTrechos: são precisos pelo menos dois pontos')
  return forma
}

/** Põe na cena uma peça desenhada na casa da estátua, já no tamanho da pegada. */
export type PorNaEstatua = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/**
 * O que as estátuas repetem: a escala da pegada, o `por` que já põe a forma no tamanho dela e o piso de luz da
 * pedra. `casa` é o lado do quadro em que o desenho foi feito (a besta é desenhada em duas casas).
 */
export function prepararEstatua(c: ContextoDoMovel, cena: Cena, casa = CASA_DA_ESTATUA): { por: PorNaEstatua; na: (f: Forma) => Forma; escala: number } {
  const e = Math.min(c.w, c.h) / casa
  const na = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por: PorNaEstatua = (f, mat, o) => {
    cena.partes.push(c.peca(na(f), mat, o))
  }
  cena.corDoPiso = ESCURO_DA_PEDRA_VELHA
  return { por, na, escala: e }
}

/** Tufos de musgo: manchas baixas e macias, quase da cor da pedra (o meio e os dois raios de cada um, px do quadro). */
export function musgo(por: PorNaEstatua, cor: MaterialDaPeca, tufos: readonly (readonly [number, number, number, number])[], semente: number): void {
  tufos.forEach(([x, y, rx, ry], i) => por(elipse(x, y, rx, ry), cor, { bisel: 0.4, contorno: 0.12, alfa: 0.7, suave: 0.6, tom: 0.9 + 0.16 * hash(i, 3, semente), semente: semente + i }))
}

/** Pintas de líquen: rodelas claras e meio transparentes (o meio e o raio de cada uma, px do quadro). */
export function liquen(por: PorNaEstatua, pintas: readonly (readonly [number, number, number])[], semente: number): void {
  pintas.forEach(([x, y, r], i) => por(elipse(x, y, r, r * 0.76), LIQUEN_DA_PEDRA, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.5, semente: semente + i }))
}

/**
 * O PEDESTAL VISTO DE FRENTE das estátuas em pé (a besta e a encapuzada), como o do anjo de pedra: o soco (o degrau
 * do pé), o dado com a placa rebaixada e a cornija, que sai do dado e faz sombra nele. Medidas em px do quadro, y
 * para baixo: `chao` é o pé da frente do soco; de cada faixa, a meia largura, onde o tampo dela começa (`topo`) e
 * onde começa a frente (`frente`); o `tampo` é onde a figura pisa.
 */
export interface PedestalDeFrente {
  readonly chao: number
  readonly soco: { readonly meia: number; readonly topo: number; readonly frente: number }
  readonly dado: { readonly meia: number; readonly topo: number; readonly pe: number }
  readonly cornija: { readonly meia: number; readonly frente: number; readonly pe: number }
  readonly tampo: number
  readonly placa: { readonly meia: number; readonly topo: number; readonly pe: number }
}

/** A chuva escorre mais no pedestal que na figura (faixas escuras de pé). */
const CHUVA_NO_PEDESTAL = 0.6
const CHUVA_NO_TAMPO = 0.3
const MANCHAS_NO_PEDESTAL = 0.26

export function montarPedestalDeFrente(por: PorNaEstatua, pedra: MaterialDaPeca, m: PedestalDeFrente, semente: number): void {
  const forte = texDaPedraVelha(MANCHAS_NO_PEDESTAL, CHUVA_NO_PEDESTAL)
  const fraca = texDaPedraVelha(MANCHAS_NO_PEDESTAL, CHUVA_NO_TAMPO)
  // O soco: a frente e o tampo dele, na frente do dado.
  por(caixa(-m.soco.meia, m.soco.frente, m.soco.meia, m.chao, 0.5), pedra, { bisel: 1, tom: 0.78, contorno: 0.28, textura: fraca, semente })
  por(caixa(-m.soco.meia, m.soco.topo, m.soco.meia, m.soco.frente + 0.2, 0.4), pedra, { bisel: 0.7, tom: 1, contorno: 0.26, textura: fraca, semente: semente + 1 })
  // O dado, com a placa rebaixada.
  por(caixa(-m.dado.meia, m.dado.topo, m.dado.meia, m.dado.pe, 0.4), pedra, { bisel: 1.1, tom: 0.86, contorno: 0.28, textura: forte, semente: semente + 2 })
  por(caixa(-m.placa.meia, m.placa.topo, m.placa.meia, m.placa.pe, 0.4), pedra, { bisel: 0.5, tom: 0.9, contorno: 0.2, recesso: { k: 1.2, forca: 0.32 }, textura: forte, semente: semente + 3 })
  // A cornija, que sai do dado e faz sombra nele, e o tampo dela, onde a figura pisa.
  por(caixa(-m.cornija.meia, m.cornija.frente, m.cornija.meia, m.cornija.pe, 0.5), pedra, { bisel: 0.9, tom: 0.92, contorno: 0.28, textura: fraca, semente: semente + 4, projeta: { dist: 1.1, forca: 0.3 } })
  por(caixa(-m.cornija.meia, m.tampo, m.cornija.meia, m.cornija.frente + 0.2, 0.4), pedra, { bisel: 0.7, tom: 1.06, contorno: 0.26, textura: fraca, semente: semente + 5 })
}

/**
 * O pé da sombra de uma parte da figura em pé (o corpo, a cabeça, uma asa): uma régua deitada de pontas redondas na
 * linha do chão, de meio em `x` e meia largura `meia`, que o motor arrasta até a altura da parte. É caixa, e não
 * elipse: a distância da elipse muito chata é aproximada, e a sombra arrastada dela saía em faixas.
 */
export function reguaDeSombra(chao: number, x: number, meia: number, raio = 1.8): Forma {
  return caixa(x - meia, chao - 1 - raio, x + meia, chao - 1 + raio, raio)
}

/** A sombra no chão do pedestal visto de frente: o soco rente e o bloco arrastado do chão até o tampo. */
export function sombraDoPedestalDeFrente(cena: Cena, na: (f: Forma) => Forma, m: PedestalDeFrente, escala: number): void {
  cena.sombras.push(contato(na(caixa(-m.soco.meia - 0.4, m.chao - 1.8, m.soco.meia + 0.4, m.chao + 0.4, 0.6)), 0.32))
  cena.sombras.push({ forma: na(caixa(-m.soco.meia, m.chao - 1.4, m.soco.meia, m.chao + 0.2, 0.6)), z: (m.chao - m.tampo) * escala, forca: 0.3 })
}

// ---------- a gárgula (px da casa: 0 no meio, y cresce para baixo; o lado direito, o esquerdo é o espelho) ----------

/**
 * O pedestal QUADRADO visto de frente: quase tão alto quanto largo, com a placa lisa rebaixada. O chão fica em 24,5
 * (o da estátua encapuzada), e não em 25: no nível 3 da imagem, 25 px caem em cima de uma linha de pixels, e a
 * beira do soco saía meio transparente; com a sombra de baixo da 3/4 por trás, essa linha passava a contar como
 * peça e a soma da sombra CAÍA (o portão da sombra de baixo reprovava com qualquer força, medido na folha).
 */
const PEDESTAL: PedestalDeFrente = {
  chao: 24.5,
  soco: { meia: 13.6, topo: 21.2, frente: 22.3 },
  dado: { meia: 11.6, topo: 12.6, pe: 21.6 },
  cornija: { meia: 13.2, frente: 10.4, pe: 13 },
  tampo: 8.2,
  placa: { meia: 7.2, topo: 14.6, pe: 20 },
}
/**
 * A força da sombra de baixo da gárgula na 3/4 (o perfil dela em `tresQuartos.ts` usa:
 * `{ modo: 'em-pe', forcaDaSombraDeBaixo: FORCA_DA_SOMBRA_DE_BAIXO_DA_GARGULA }`), a mesma da besta. Com a de sempre
 * (0,34) ela quase some debaixo da sombra do pedestal: a soma da sombra sobe só 2,15%, rente ao mínimo de 2% do
 * portão; com 0,44 sobe 7%. (Medido no nível 3: 0,34 dá 1,0215; 0,44 dá 1,0715; 0,5 dá 1,0524.)
 */
export const FORCA_DA_SOMBRA_DE_BAIXO_DA_GARGULA = 0.44
/** Quanto de verde vai na pedra da figura e na do pedestal, as manchas e a chuva da figura. */
const VERDE_NA_FIGURA = 0.26
const VERDE_NO_PEDESTAL = 0.14
const MANCHAS_NA_FIGURA = 0.3
const CHUVA_NA_FIGURA = 0.2
/** Os três tons da figura (vezes o da pedra): as asas, o corpo e a cabeça; e as garras, o mais claro. */
const TOM_DA_ASA = 0.62
const TOM_DO_CORPO = 0.92
const TOM_DA_CABECA = 1.08
const TOM_DA_GARRA = 1.18

/** Um cone de pontas redondas: x, y e raio de uma ponta, x, y e raio da outra. */
type Cone = readonly [number, number, number, number, number, number]
/** A asa FECHADA: uma gota alta atrás do ombro (o bojo embaixo, a ponta em cima); e o osso dela, pela beira de fora. */
const ASA: Cone = [7.1, -7.4, 5, 8.7, -25, 0.8]
const OSSO_DA_ASA: Cone = [10.8, -8.8, 1.15, 9, -24.2, 0.5]
/** O tronco: o peito e a barriga. */
const PEITO = { y: -4.6, rx: 6.9, ry: 6.6 }
const BARRIGA = { y: 2.8, rx: 5.5, ry: 5.2 }
/** A perna dobrada: a coxa (do quadril ao joelho, que sobe e abre), a canela, o pé e as três garras na beira do pedestal. */
const COXA: Cone = [5.2, 4.2, 4.3, 10.6, -1.8, 3.6]
const CANELA: Cone = [10.8, -1.4, 3.1, 9.3, 6.2, 2.3]
const PE = { x: 9.5, y: 7.2, rx: 3.5, ry: 1.7 }
const GARRAS_DO_PE: readonly (readonly [number, number, number, number])[] = [[7.5, 7.8, 7.1, 10.5], [9.5, 8.1, 9.5, 10.9], [11.5, 7.8, 12, 10.5]]
/** O braço reto, do ombro à mão apoiada na beira do pedestal, entre os joelhos; e os três dedos dobrados por cima da beira. */
const OMBRO = { x: 6.2, y: -8.6, rx: 3.4, ry: 3.2 }
const BRACO: Cone = [5.9, -7.4, 2.6, 3.6, 5.4, 1.9]
const MAO = { x: 3.5, y: 7.1, rx: 2.4, ry: 1.6 }
const DEDOS: readonly (readonly [number, number, number, number])[] = [[2, 7.7, 1.8, 10.5], [3.5, 7.9, 3.5, 10.8], [5, 7.7, 5.3, 10.5]]
/**
 * A cabeça baixa, de cão: o crânio, o focinho que avança (o que fica mais perto de quem olha, e mais claro), a
 * mandíbula, o nariz, a boca, as duas presas, a testa pesada em V com os olhos fundos debaixo dela e as orelhas de
 * ponta. Sem chifre: é o que a separa da besta.
 */
const CRANIO = { y: -13.6, rx: 5.5, ry: 4.9 }
const FOCINHO = { y: -9.5, rx: 3.2, ry: 3.4 }
const MANDIBULA = { y: -5.7, rx: 2.5, ry: 1.3 }
const NARIZ = { y: -8.1, rx: 1.35, ry: 0.85 }
const BOCA: readonly Ponto[] = [[-2.7, -7.3], [-1.3, -6.5], [0, -6.8], [1.3, -6.5], [2.7, -7.3]]
const PRESA: Cone = [1.6, -6.7, 0.55, 1.7, -5, 0.15]
const TESTA: Cone = [0.5, -13.1, 0.8, 4.3, -14.7, 1.05]
const OLHO = { x: 2.6, y: -12.3, rx: 1.3, ry: 0.62, giro: -0.4 }
const ORELHA: readonly Ponto[] = [[3.4, -16.6], [8.8, -20.8], [6, -13]]
const CONCHA_DA_ORELHA: readonly Ponto[] = [[4.8, -16.4], [7.5, -19.2], [6, -14.8]]
/**
 * As alturas da figura (y da casa) para a sombra no chão: os ombros, o alto da cabeça e a ponta das asas. A sombra
 * conta só `PARTE_DA_ALTURA` delas, como na besta: inteira, a de uma figura de uma casa passava da casa vizinha.
 */
const ALTURA_DOS_OMBROS = -9
const ALTO_DA_CABECA = -18
const PONTA_DA_ASA = -24
const PARTE_DA_ALTURA = 0.8

/** O musgo do pedestal e o líquen (o meio e os raios, px da casa). */
const MUSGO_DO_PEDESTAL: readonly (readonly [number, number, number, number])[] = [
  [-12.2, 10, 1.4, 0.7],
  [-12.8, 23.8, 1.7, 0.8],
  [12.2, 23.9, 1.9, 0.7],
  [10.4, 21.4, 1.2, 0.6],
]
const LIQUENS: readonly (readonly [number, number, number])[] = [[-8.6, -16, 1.1], [9.4, -4.2, 0.9], [-4.4, 1.6, 0.9], [8.6, 17.4, 1.1], [-9.4, 16, 0.9]]

export const montarGargula: MontarMovel = (c, cena) => {
  const { por, na, escala } = prepararEstatua(c, cena)
  const figura = pedraDoTempo(c.m.pedra, VERDE_NA_FIGURA)
  const base = pedraDoTempo(c.m.pedra, VERDE_NO_PEDESTAL)
  const TEX = texDaPedraVelha(MANCHAS_NA_FIGURA, CHUVA_NA_FIGURA)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel, tom, contorno: 0.3, textura: TEX, semente, ...mais })
  const sombra = (dist: number, forca = 0.28): OpcoesDaPeca => ({ projeta: { dist, forca } })
  const vao = (f: Forma, alfa: number, semente: number): void => por(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  const cone = (m: Cone, lado: number): Forma => conico(lado * m[0], m[1], m[2], lado * m[3], m[4], m[5])
  const LADOS = [-1, 1] as const
  /** O lado da luz (a esquerda) um pouco mais claro que o outro. */
  const peloLado = (lado: number, tom: number): number => tom * (lado < 0 ? 1.04 : 0.96)

  // ---------- a sombra no chão: o pedestal, o corpo agachado, a cabeça e a ponta das duas asas ----------
  const altura = (y: number): number => (PEDESTAL.chao - y) * PARTE_DA_ALTURA * escala
  sombraDoPedestalDeFrente(cena, na, PEDESTAL, escala)
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 11)), z: altura(ALTURA_DOS_OMBROS), forca: 0.28 })
  cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, 0, 5.4)), z: altura(ALTO_DA_CABECA), forca: 0.28 })
  for (const lado of LADOS) cena.sombras.push({ forma: na(reguaDeSombra(PEDESTAL.chao, lado * 8.2, 2.6)), z: altura(PONTA_DA_ASA), forca: 0.24 })

  // ---------- o pedestal quadrado, com a placa lisa, e o musgo dos cantos ----------
  montarPedestalDeFrente(por, base, PEDESTAL, 3701)
  musgo(por, musgoDaPedra(base), MUSGO_DO_PEDESTAL, 3708)

  // ---------- as asas fechadas, atrás de tudo: a gota escura e o osso em relevo pela beira de fora ----------
  for (const lado of LADOS) {
    por(cone(ASA, lado), figura, o(3712, peloLado(lado, TOM_DA_ASA), 2.4))
    por(cone(OSSO_DA_ASA, lado), figura, o(3714, peloLado(lado, TOM_DA_ASA * 1.36), 0.9, { contorno: 0.16, ...sombra(0.8, 0.22) }))
  }

  // ---------- o tronco: a barriga e o peito ----------
  por(elipse(0, BARRIGA.y, BARRIGA.rx, BARRIGA.ry), figura, o(3720, TOM_DO_CORPO * 0.9, 3, sombra(1.6, 0.3)))
  por(elipse(0, PEITO.y, PEITO.rx, PEITO.ry), figura, o(3721, TOM_DO_CORPO * 0.97, 3.4, sombra(1.8, 0.3)))

  // ---------- as pernas dobradas, com os pés de garras na beira do pedestal ----------
  for (const lado of LADOS) {
    por(cone(COXA, lado), figura, o(3730, peloLado(lado, TOM_DO_CORPO * 0.94), 2.6, sombra(1.6, 0.3)))
    GARRAS_DO_PE.forEach(([ax, ay, bx, by], i) => por(conico(lado * ax, ay, 0.85, lado * bx, by, 0.3), figura, o(3732 + i, TOM_DA_GARRA, 0.6, sombra(0.7, 0.28))))
    por(elipse(lado * PE.x, PE.y, PE.rx, PE.ry), figura, o(3735, peloLado(lado, TOM_DO_CORPO * 1.04), 1.4, sombra(1, 0.28)))
    por(cone(CANELA, lado), figura, o(3736, peloLado(lado, TOM_DO_CORPO * 1.03), 2.2, sombra(1.5, 0.3)))
  }

  // ---------- os braços retos, entre os joelhos, com as mãos apoiadas na beira do pedestal ----------
  // O braço com a mão é uma forma só, como na besta: em rodas soltas ele lia de boneco.
  for (const lado of LADOS) {
    DEDOS.forEach(([ax, ay, bx, by], i) => por(conico(lado * ax, ay, 0.8, lado * bx, by, 0.32), figura, o(3740 + i, TOM_DA_GARRA, 0.6, sombra(0.7, 0.28))))
    por(uniao(cone(BRACO, lado), elipse(lado * MAO.x, MAO.y, MAO.rx, MAO.ry)), figura, o(3745, peloLado(lado, TOM_DO_CORPO * 1.08), 1.9, sombra(1.5, 0.3)))
    por(elipse(lado * OMBRO.x, OMBRO.y, OMBRO.rx, OMBRO.ry), figura, o(3746, peloLado(lado, TOM_DO_CORPO * 1.04), 2.4, sombra(1.5, 0.3)))
  }

  // ---------- a cabeça de cão: as orelhas, o crânio, a mandíbula com as presas, o focinho, a testa e os olhos ----------
  for (const lado of LADOS) {
    por(arredondada(poligono(lado > 0 ? ORELHA : espelho(ORELHA)), 0.4), figura, o(3750, peloLado(lado, TOM_DO_CORPO * 1.02), 1.2, sombra(1.1, 0.28)))
    vao(poligono(lado > 0 ? CONCHA_DA_ORELHA : espelho(CONCHA_DA_ORELHA)), 0.34, 3751)
  }
  por(elipse(0, CRANIO.y, CRANIO.rx, CRANIO.ry), figura, o(3752, TOM_DA_CABECA * 0.96, 2.8, sombra(2.2, 0.34)))
  por(elipse(0, MANDIBULA.y, MANDIBULA.rx, MANDIBULA.ry), figura, o(3753, TOM_DA_CABECA * 0.84, 0.9, sombra(1, 0.3)))
  for (const lado of LADOS) por(cone(PRESA, lado), figura, o(3754, TOM_DA_GARRA, 0.5, { contorno: 0.2 }))
  por(elipse(0, FOCINHO.y, FOCINHO.rx, FOCINHO.ry), figura, o(3756, TOM_DA_CABECA * 1.06, 2, sombra(1.5, 0.36)))
  vao(elipse(0, NARIZ.y, NARIZ.rx, NARIZ.ry), 0.74, 3757)
  vao(cadeia(BOCA, 0.3), 0.6, 3758)
  for (const lado of LADOS) {
    por(cone(TESTA, lado), figura, o(3760, TOM_DA_CABECA * 1.1, 1.1, { contorno: 0.2, ...sombra(1, 0.4) }))
    vao(elipseGirada(lado * OLHO.x, OLHO.y, OLHO.rx, OLHO.ry, lado * OLHO.giro), 0.82, 3762)
  }

  liquen(por, LIQUENS, 3790)
}
