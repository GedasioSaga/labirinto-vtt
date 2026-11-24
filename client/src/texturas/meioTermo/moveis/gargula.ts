/**
 * GÁRGULA (lote L04 de 24/11/2026, a Fortaleza do ritual; construção nova, do
 * grupo Monumentos e colunas). A gárgula de pedra AGACHADA no seu bloco, de
 * asas FECHADAS, VISTA DE CIMA: a cabeça para a frente (o lado de baixo da
 * pegada), debruçada na beira do bloco, com os dois chifres grossos abertos
 * para os lados e virados para trás; os ombros e os braços descendo até as
 * mãos de três garras cravadas na beira; os joelhos dobrados dos lados; o
 * lombo largo com as vértebras e as duas omoplatas; as duas asas de morcego
 * dobradas e coladas aos flancos, fechando para trás, cada uma com a ponta
 * recortada em rabo de andorinha; e o rabo que sai por baixo delas, contorna
 * o bloco e acaba em ponta de lança.
 *
 * De cima é o que se vê de quem passa embaixo dela: nenhum rosto de frente, só
 * o alto da cabeça, as sobrancelhas e o focinho. Para ler numa casa, são
 * poucas massas grandes em três tons: as asas escuras dos lados, o corpo no
 * tom do meio e a cabeça com os chifres claros, em cima do quadrado do bloco.
 * O que diz "gárgula" é o bicho de costas entre as duas asas fechadas, com a
 * cabeça chifruda na ponta e o rabo de lança do lado.
 *
 * A pedra é a do painel (`c.m.pedra`), com o TEMPO fixo por cima, como na
 * estátua de cavalo: o cinza puxado para o verde, manchas de verdete onde a
 * chuva escorre, pintas claras de líquen e musgo nos cantos do bloco.
 *
 * Figura desenhada de uma vista só: de cima e na 3/4 é a mesma imagem, e a 3/4
 * só põe a sombra de baixo (`EM_PE` em `tresQuartos.ts`, como a âncora e o
 * canhão); o giro gira a imagem inteira, e a gárgula olha para onde o mestre
 * a virar. O desenho é feito numa casa de 56 px e escala com o menor lado.
 *
 * Este arquivo também guarda o que as três estátuas do lote dividem (a pedra
 * com o tempo, o cone de pontas redondas, o musgo, o pedestal visto de
 * frente): a estátua de besta e a estátua encapuzada importam daqui.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
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
/** As manchas: o tamanho (px do protótipo por volta do ruído). O líquen só aparece a partir desta escala. */
const TAMANHO_DAS_MANCHAS = 6
const ESCALA_DO_LIQUEN = 1
const LIMIAR_DO_LIQUEN = 0.34
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
    const n = ruido(x / TAMANHO_DAS_MANCHAS + 13, y / TAMANHO_DAS_MANCHAS) + 0.5 * ruido(x / 2.4 + 7, y / 2.4 + 29)
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
    if (l > LIMIAR_DO_LIQUEN) s[3] += (l - LIMIAR_DO_LIQUEN) * 0.9
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

/** A forma do lado direito espelhada para o esquerdo (para o que não é feito de pontos: a asa recortada). */
function espelhada(f: Forma): Forma {
  return { b: [-f.b[2], f.b[1], -f.b[0], f.b[3]], d: (x, y) => f.d(-x, y) }
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

// ---------- a gárgula (px da casa: o meio do bloco no 0, 0; a frente é para baixo) ----------

/** O bloco: o meio lado do soco e o do tampo, mais estreito (um degrau em volta). As asas, a cabeça e o rabo sobram dele. */
const SOCO = 19.5
const TAMPO = 17
/** Quanto de verde vai na pedra da figura e na do bloco, e a força das manchas de cada uma. */
const VERDE_NA_FIGURA = 0.26
const VERDE_NO_BLOCO = 0.14
const MANCHAS_NA_FIGURA = 0.34
const MANCHAS_NO_BLOCO = 0.26
/** Os três tons da figura: as asas, o corpo e a cabeça com os chifres. */
const TOM_DA_ASA = 0.66
const TOM_DO_CORPO = 0.92
const TOM_DA_CABECA = 1.08
const TOM_DO_CHIFRE = 1.2

/** O rabo: sai de trás, por baixo das pontas das asas, contorna o bloco pelo lado direito e acaba em ponta de lança. */
const RABO: readonly Ponto[] = [[0.6, -17], [5, -22.4], [12, -24.6], [18.8, -22], [22.8, -16], [23.6, -8.4], [22.2, -1.6]]
const PONTA_DO_RABO: readonly Ponto[] = [[19, -1.2], [25.2, -0.2], [21.4, 6]]
/** A perna direita (a esquerda é o espelho): a coxa dobrada, do quadril ao joelho, e o pé na quina da frente do bloco. */
const COXA: readonly [number, number, number, number, number, number] = [11.6, 3.4, 4.7, 15.4, 12.2, 3.7]
const PE = { x: 16, y: 16.2, rx: 3, ry: 2.5 }
/** O lombo, entre as duas asas: largo nos ombros e fechando para o rabo (o raio nas duas pontas); as vértebras ao longo da espinha e as omoplatas, de onde as asas saem. */
const LOMBO = { ombros: 4.6, raioNosOmbros: 8.8, ancas: -15.6, raioNasAncas: 5 }
const VERTEBRAS: readonly number[] = [-17, -12.8, -8.6, -4.4, -0.2, 4]
const OMOPLATA = { x: 5.2, y: 3, rx: 2.5, ry: 3.7 }
/**
 * A asa direita, dobrada e colada ao flanco (a esquerda é o espelho): uma folha comprida e estreita, do ombro para
 * trás, fechando para a espinha, com a ponta recortada por uma mordida redonda (as duas pontas da membrana).
 */
const ASA = { x: 12.8, y: -6.6, rx: 5.7, ry: 16.8, giro: -0.2 }
const MORDIDA: readonly [number, number, number] = [9, -27.2, 4.7]
/** O punho da asa (na frente, ao lado do ombro) e as varetas da membrana, em relevo baixo: as duas das pontas e a do meio. */
const PUNHO_DA_ASA: Ponto = [15.2, 7.6]
const VARETAS: readonly Ponto[] = [[13, -20.6], [9.6, -21.4], [6.4, -21.4]]
/** Os ombros, os braços (do ombro ao pulso), as mãos e as três garras de cada uma, cravadas na beira do bloco. */
const OMBRO = { x: 6.8, y: 9.4, rx: 4, ry: 3.6 }
const BRACO: readonly [number, number, number, number, number, number] = [7, 10, 2.8, 10.4, 17.2, 2.3]
const MAO = { x: 10.7, y: 18.7, rx: 2.9, ry: 2.2 }
const GARRAS: readonly (readonly [number, number, number, number])[] = [[8.9, 19.6, 8.4, 22.9], [10.7, 20.2, 10.9, 23.6], [12.5, 19.6, 13.3, 22.7]]
/** O pescoço, o crânio, o focinho debruçado na beira, os chifres grossos virados para trás e as sobrancelhas. */
const PESCOCO = { y: 10.2, rx: 4.6, ry: 3.6 }
const CRANIO = { y: 15.6, rx: 6.5, ry: 5.9 }
const FOCINHO = { y: 21.3, rx: 3.8, ry: 3.7 }
const CHIFRE: Trechos = [[4.4, 13.4, 2.3], [9.2, 11.2, 1.9], [12.8, 7.6, 1.25], [13.8, 3.4, 0.45]]
const SOBRANCELHA: readonly [number, number, number, number, number, number] = [0.7, 18.3, 0.8, 5, 16, 1.25]
const OLHO = { x: 2.9, y: 18.9, rx: 1.2, ry: 0.55, giro: -0.42 }
const NARINA = { x: 1.2, y: 23.3, r: 0.48 }
/** As alturas da figura (px da casa), para a sombra no chão: o bloco e o lombo. */
const ALTURA_DO_BLOCO = 14
const ALTURA_DO_LOMBO = 32
/** O musgo nos cantos do bloco e o líquen na figura (o meio e os raios). */
const MUSGO_DO_BLOCO: readonly (readonly [number, number, number, number])[] = [
  [-17.8, -17.4, 1.9, 1.4],
  [-18, 17.6, 1.5, 1.9],
  [17.4, 18.2, 1.8, 1.2],
]
const LIQUENS: readonly (readonly [number, number, number])[] = [[-11.6, -11, 1.4], [13.2, -4.4, 1.1], [-5.6, 14.2, 0.9], [-15.6, 6.4, 1]]

export const montarGargula: MontarMovel = (c, cena) => {
  const { por, na, escala } = prepararEstatua(c, cena)
  const figura = pedraDoTempo(c.m.pedra, VERDE_NA_FIGURA)
  const bloco = pedraDoTempo(c.m.pedra, VERDE_NO_BLOCO)
  const TEX = texDaPedraVelha(MANCHAS_NA_FIGURA)
  const TEX_DO_BLOCO = texDaPedraVelha(MANCHAS_NO_BLOCO)
  const o = (semente: number, tom: number, bisel: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel, tom, contorno: 0.3, textura: TEX, semente, ...mais })
  const sombra = (dist: number, forca = 0.28): OpcoesDaPeca => ({ projeta: { dist, forca } })
  const vao = (f: Forma, alfa: number, semente: number): void => por(f, VAO_DA_PEDRA, { bisel: 0, contorno: 0, alfa, semente })
  const cone = (m: readonly [number, number, number, number, number, number], lado: number): Forma => conico(lado * m[0], m[1], m[2], lado * m[3], m[4], m[5])
  const LADOS = [-1, 1] as const
  /** O lado da luz (a esquerda) um pouco mais claro que o outro. */
  const peloLado = (lado: number, tom: number): number => tom * (lado < 0 ? 1.04 : 0.96)

  // ---------- as sombras no chão: o bloco e a figura agachada em cima dele ----------
  const soco = caixa(-SOCO, -SOCO, SOCO, SOCO, 1.6)
  cena.sombras.push(contato(na(soco), 0.32), { forma: na(soco), z: ALTURA_DO_BLOCO * escala, forca: 0.3 })
  cena.sombras.push({ forma: na(elipse(0, -2, 16, 19)), z: ALTURA_DO_LOMBO * escala, forca: 0.26 })

  // ---------- o bloco: o soco, o tampo e o musgo dos cantos ----------
  por(soco, bloco, { bisel: 1.6, tom: 0.76, contorno: 0.3, textura: TEX_DO_BLOCO, semente: 3701 })
  por(caixa(-TAMPO, -TAMPO, TAMPO, TAMPO, 1.2), bloco, { bisel: 1.5, tom: 0.98, contorno: 0.26, textura: TEX_DO_BLOCO, semente: 3702, projeta: { dist: 1.4, forca: 0.26 } })
  musgo(por, musgoDaPedra(bloco), MUSGO_DO_BLOCO, 3705)

  // ---------- o rabo, por baixo das asas, e a ponta de lança ----------
  por(cadeia(RABO, 1.8), figura, o(3710, 0.86, 1.5, sombra(1.6, 0.3)))
  por(arredondada(poligono(PONTA_DO_RABO), 0.5), figura, o(3711, 0.94, 1.2, sombra(1.6, 0.3)))

  // ---------- as pernas dobradas, saindo de debaixo das asas, com o pé na quina da frente ----------
  for (const lado of LADOS) {
    por(elipse(lado * PE.x, PE.y, PE.rx, PE.ry), figura, o(3720, peloLado(lado, 0.9), 1.5, sombra(1.2, 0.26)))
    por(cone(COXA, lado), figura, o(3722, peloLado(lado, 0.86), 2.4, sombra(1.6)))
  }

  // ---------- o lombo, entre as asas, com as omoplatas e as vértebras ----------
  por(conico(0, LOMBO.ombros, LOMBO.raioNosOmbros, 0, LOMBO.ancas, LOMBO.raioNasAncas), figura, o(3730, TOM_DO_CORPO, 3.4, sombra(1.8)))
  for (const lado of LADOS) por(elipse(lado * OMOPLATA.x, OMOPLATA.y, OMOPLATA.rx, OMOPLATA.ry), figura, o(3738, peloLado(lado, TOM_DO_CORPO * 1.03), 2, { contorno: 0.08 }))
  VERTEBRAS.forEach((y, i) => por(elipse(0, y, 1.15, 1.45), figura, o(3731 + i, 1.1, 0.9, { contorno: 0.22 })))

  // ---------- as asas dobradas: a folha escura de ponta recortada e as varetas em relevo baixo ----------
  const asaDireita = menos(elipseGirada(ASA.x, ASA.y, ASA.rx, ASA.ry, ASA.giro), elipse(MORDIDA[0], MORDIDA[1], MORDIDA[2], MORDIDA[2]))
  for (const lado of LADOS) {
    const asa = lado > 0 ? asaDireita : espelhada(asaDireita)
    por(asa, figura, o(3740, peloLado(lado, TOM_DA_ASA), 2.2, sombra(2, 0.34)))
    VARETAS.forEach(([x, y], i) => {
      por(dentroDe(conico(lado * PUNHO_DA_ASA[0], PUNHO_DA_ASA[1], 1.25, lado * x, y, 0.5), asa), figura, o(3742 + i, peloLado(lado, TOM_DA_ASA * 1.2), 0.9, { contorno: 0.14 }))
    })
  }

  // ---------- os braços e as garras cravadas na beira do bloco ----------
  for (const lado of LADOS) {
    GARRAS.forEach(([ax, ay, bx, by], i) => por(conico(lado * ax, ay, 0.9, lado * bx, by, 0.34), figura, o(3760 + i, 1.02, 0.7, sombra(0.8, 0.26))))
    por(elipse(lado * MAO.x, MAO.y, MAO.rx, MAO.ry), figura, o(3764, peloLado(lado, 1), 1.4, sombra(1.1)))
    por(cone(BRACO, lado), figura, o(3765, peloLado(lado, TOM_DO_CORPO), 1.9, sombra(1.5)))
    por(elipse(lado * OMBRO.x, OMBRO.y, OMBRO.rx, OMBRO.ry), figura, o(3767, peloLado(lado, 1), 2.2, sombra(1.5)))
  }

  // ---------- a cabeça: o pescoço, o crânio com o focinho, os chifres e as sobrancelhas ----------
  por(elipse(0, PESCOCO.y, PESCOCO.rx, PESCOCO.ry), figura, o(3770, TOM_DO_CORPO, 2, sombra(1.4)))
  const cabeca = uniao(elipse(0, CRANIO.y, CRANIO.rx, CRANIO.ry), elipse(0, FOCINHO.y, FOCINHO.rx, FOCINHO.ry))
  por(cabeca, figura, o(3772, TOM_DA_CABECA, 2.6, sombra(2.4, 0.34)))
  for (const lado of LADOS) {
    por(emTrechos(CHIFRE, lado), figura, o(3774, peloLado(lado, TOM_DO_CHIFRE), 1.5, { contorno: 0.32, ...sombra(1.8, 0.34) }))
    por(cone(SOBRANCELHA, lado), figura, o(3777, TOM_DA_CABECA * 1.08, 0.9, { contorno: 0.2, ...sombra(0.7, 0.32) }))
    vao(elipseGirada(lado * OLHO.x, OLHO.y, OLHO.rx, OLHO.ry, lado * OLHO.giro), 0.78, 3778)
    vao(elipse(lado * NARINA.x, NARINA.y, NARINA.r, NARINA.r), 0.7, 3779)
  }
  // O sulco do focinho, do meio das sobrancelhas à ponta.
  vao(capsula(0, 19.6, 0, 22.8, 0.26), 0.3, 3780)

  liquen(por, LIQUENS, 3790)
}
