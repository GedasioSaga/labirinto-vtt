/**
 * ARADO de cima com volume (lote 10 dos objetos novos, 11/11/2026): o arado de
 * aiveca, de tração animal, parado no fim do sulco que acabou de abrir. Da
 * frente para trás: o BALANCIM deitado no chão (a trave de madeira de través,
 * com a ponteira e o gancho de ferro em cada ponta) e a CORRENTE que o prende
 * ao regulador na ponta do TIMÃO, a viga comprida de madeira que sobe até o
 * corpo, com a ponteira, as abraçadeiras e o grampo da sega em ferro. No corpo,
 * rente ao chão, a RELHA (a ponta de ferro em cunha, o fio claro de tanto
 * cortar terra) e a AIVECA, a chapa de ferro curva que abre para o lado de
 * cima, polida pela terra (o brilho corre na diagonal da torção) e com terra
 * grudada na beira de baixo; do outro lado, o rasto reto e a sabota de
 * madeira. Do corpo para trás abrem as duas RABIÇAS, subindo até os punhos
 * gastos de mão, com a travessa redonda entre elas e a escora de ferro da
 * aiveca. Atrás da relha, o SULCO curto: a vala escura (a parede do lado da luz
 * faz sombra dentro dela) e, do lado da aiveca, a LEIVA revirada em fatias,
 * deitadas como telhas, com os torrões soltos.
 *
 * O perfil da 3/4 é em pé, como o do carrinho de mão: derivada, a aiveca e a
 * sabota virariam colunas e o timão e as rabiças, que estão no ar, ficariam no
 * chão, soltos do corpo. A sombra do que está no ar (o timão, as rabiças, a
 * travessa e a escora) cai no chão andada pela altura de cada ponto; no sulco e
 * na leiva, que cobrem o chão, ela cai por peças sem tinta que só projetam.
 *
 * A 25% de zoom sobram a vara comprida do timão com a trave de través na ponta
 * da frente, o V das rabiças na de trás, a mancha clara e curva da aiveca entre
 * eles e a faixa escura do sulco: é o que diz "arado" e não "carroça" (sem roda
 * nem caixa) nem "carrinho de mão" (sem roda, a ponta de ferro no chão).
 * Material: `madeira` (o balancim, o timão, a sabota, as rabiças e a
 * travessa); o ferro, o aço polido e a terra são fixos. As medidas valem na
 * pegada de partida (2 x 1 casas): o comprimento sai da largura e o de través,
 * da altura; a grossura das varas e o miúdo, do lado que menos esticou.
 */
import { hash, limitar01, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** Quanto a sombra de uma peça anda por px de altura (a mesma luz do chão, na régua do `projeta`). */
const SOMBRA_POR_ALTURA = Math.hypot(SOMBRA_X, SOMBRA_Y)

// ---------- as medidas (px do protótipo na pegada de partida; as alturas, em casas) ----------

/** A pegada de partida: 2 x 1 casas, com o meio em (0, 0). O arado é puxado para a esquerda; a relha e o sulco ficam à direita. */
const LARGURA_DE_PARTIDA = 2 * G
const FUNDO_DE_PARTIDA = G
/** A linha do arado, de través: um pouco abaixo do meio (a leiva e a aiveca abrem para cima). Os pontos abaixo são medidos a partir dela. */
const Y_DO_ARADO = 2

/** O balancim deitado de través: onde fica ao comprido, a meia largura, a meia grossura de ponta a ponta, a ponteira de ferro e a altura (casas). */
const X_DO_BALANCIM = -51.4
const MEIO_BALANCIM = 17
const MEIAS_DO_BALANCIM: readonly number[] = [1.5, 2, 2.3, 2, 1.5]
const PONTEIRA_DO_BALANCIM = 3
const ALTURA_DO_BALANCIM = 0.07
/** O gancho de cada ponta e o olhal do meio: o raio de fora e o do furo. */
const ARGOLA: readonly [number, number] = [1.65, 0.8]
/** A corrente, do olhal do balancim ao regulador do timão: o comprimento do elo, a meia largura e quanto ela barriga para o lado. */
const ELO = 3.1
const MEIO_ELO = 1.25
const BARRIGA_DA_CORRENTE = 2.4

/** O timão: de onde a onde vai ao comprido, a meia grossura na frente e atrás, quanto verga para o lado, os lances e a altura (casas) dele na frente e atrás. */
const TIMAO_DE = -30
const TIMAO_ATE = 21
const MEIA_DO_TIMAO_NA_FRENTE = 2.2
const MEIA_DO_TIMAO_ATRAS = 3.1
const VERGA_DO_TIMAO = 1.1
const LANCES_DO_TIMAO = 8
const ALTURA_DO_TIMAO_NA_FRENTE = 0.12
const ALTURA_DO_TIMAO_ATRAS = 0.33
/** O regulador (a chapa de ferro de través com os furos, na ponta do timão), a ponteira, as abraçadeiras e o grampo da sega. */
const REGULADOR = { de: -32.6, ate: -29.4, meia: 3.6, furos: 3 } as const
const PONTEIRA_DO_TIMAO: readonly [number, number] = [-30, -26.4]
const ABRACADEIRAS: readonly number[] = [-13, 15.5]
const GRAMPO_DA_SEGA = { de: -1.6, ate: 2.4, sobra: 1.1 } as const

/** O corpo, a partir da linha do arado (y para baixo): a relha em cunha, o fio dela, a aiveca, o brilho dela, o rasto e a sabota. */
const RELHA: readonly Ponto[] = [[4, 2.6], [8.6, -2.6], [15, -9], [16.9, -8.4], [17.6, 2.9]]
const FIO_DA_RELHA: readonly Ponto[] = [[4.8, 1.6], [14.6, -8.4]]
const AIVECA: readonly Ponto[] = [
  [15, -9],
  [19.5, -12.2],
  [25, -14.8],
  [31, -16.9],
  [35.6, -17.6],
  [36.6, -15.5],
  [35.2, -12.2],
  [31, -8.2],
  [26.6, -4.2],
  [22, -0.8],
  [17.6, 2.9],
  [16.9, -8.4],
]
const BRILHO_DA_AIVECA: readonly Ponto[] = [[18.6, -7], [34.4, -15.2]]
const MEIA_DO_BRILHO = 2.1
const RASTO: readonly Ponto[] = [[6, 2.9], [37.6, 3.2]]
const MEIA_DO_RASTO = 1.05
const SABOTA: readonly Ponto[] = [[16, -1.6], [33.5, -6.4], [37.4, 0.4], [37, 3.6], [17.4, 3.6]]
/** As alturas (casas): a relha e o rasto rente ao chão, a beira de cima da aiveca e a sabota. */
const ALTURA_RENTE = 0.04
const ALTURA_DA_AIVECA = 0.23
const ALTURA_DA_SABOTA = 0.28
/** A terra grudada na relha e na aiveca: o meio, os raios e o giro de cada mancha. */
const TERRA_GRUDADA: readonly (readonly [number, number, number, number, number])[] = [
  [21.6, -1.6, 2.2, 1.3, -0.6],
  [27.4, -5.6, 1.9, 1.1, -0.75],
  [32.8, -10.4, 1.5, 0.9, -0.9],
]
/** A dobra da aiveca: a beira de baixo, onde a chapa encontra a sabota e fica na sombra da própria curva (a meia largura e o escuro). */
const DOBRA_DA_AIVECA: readonly Ponto[] = [[17.6, 2.9], [22, -0.8], [26.6, -4.2], [31, -8.2], [35.2, -12.2]]
const MEIA_DA_DOBRA = 1.8
const TOM_DA_DOBRA = 0.62

/** As rabiças: os pontos de cada uma, do corpo ao punho; a meia grossura ao longo dela; a altura (casas) no corpo e no punho; o punho gasto (px). */
const RABICAS: readonly (readonly Ponto[])[] = [
  [[17, -1.2], [26, -5.2], [35, -9], [44, -12.8], [53, -16.6]],
  [[19, 2.8], [28, 6.8], [37, 10.4], [46, 14], [54.6, 17.6]],
]
const MEIAS_DA_RABICA: readonly number[] = [2, 1.85, 1.7, 1.6, 1.9]
const ALTURA_NO_CORPO = 0.3
const ALTURA_NO_PUNHO = 0.64
const PUNHO = 7.5
const ESCURO_DO_PUNHO = 0.18
/** A travessa entre as rabiças (onde ela pega em cada uma, de 0 no corpo a 1 no punho) e a meia grossura. */
const LUGAR_DA_TRAVESSA = 0.6
const MEIA_DA_TRAVESSA = 1.3
/** A escora de ferro: da beira de cima da aiveca até a rabiça de cima (o lugar nela) e a largura. */
const ESCORA_DE: Ponto = [33.4, -15.4]
const LUGAR_DA_ESCORA = 0.5
const LARGURA_DA_ESCORA = 1.3
/** A força da sombra do que está no ar, no chão e no sulco (as duas iguais: a sombra não muda de tom ao passar do chão para a terra). */
const FORCA_DA_SOMBRA_NO_AR = 0.27

/** O sulco atrás da relha: a vala (de x a x, de y a y) e a leiva revirada do lado da aiveca, com a altura dela (casas). */
const VALA = { de: 17, ate: 54.5, cima: -8.6, baixo: 3.8 } as const
const LEIVA = { de: 31, ate: 54.4, cima: -22, baixo: -6.4 } as const
const ALTURA_DA_LEIVA = 0.06
/**
 * As fatias da leiva (os torrões grandes que a aiveca revirou), da direita para a esquerda: cada uma cobre a da
 * direita e faz sombra nela. O meio ao comprido e o giro; a meia grossura ao comprido do sulco, quanto da largura
 * da leiva cada uma cobre, o arredondado dos cantos e o tom (alternado).
 */
const FATIAS: readonly (readonly [number, number])[] = [
  [51.8, -0.42],
  [46.8, -0.36],
  [41.8, -0.44],
  [36.8, -0.38],
  [32.2, -0.4],
]
const MEIA_DA_FATIA = 3.3
const LARGURA_DA_FATIA = 0.9
const CANTO_DA_FATIA = 1.3
const TONS_DAS_FATIAS: readonly number[] = [1.1, 1]
/** Os torrões: o meio e o tamanho (na beira da leiva, caídos da aiveca e no fundo da vala). */
const TORROES: readonly (readonly [number, number, number])[] = [
  [36.5, -21.4, 1.5],
  [43.6, -22.6, 1.2],
  [50.2, -21.2, 1.6],
  [53.8, -16.2, 1.1],
  [29, -19.6, 1.3],
  [25.4, -18.2, 1],
  [32.5, -21.6, 0.9],
  [41.5, -1.6, 1],
  [48.8, 0.6, 1.2],
  [53.2, -3.4, 0.9],
  [39, -6.6, 1.2],
  [46.5, -6.2, 1.4],
]
/**
 * O tom da vala (a terra do fundo, mais escura), o recesso dela (a parede do lado da luz faz sombra dentro) e a
 * parede de lá, do lado do rasto, virada para a luz: um fio claro ao comprido (a largura e o tom).
 */
const TOM_DA_VALA = 0.78
const RECESSO_DA_VALA = { k: 3, forca: 0.42 } as const
const PAREDE_DA_VALA = { largura: 2.6, tom: 1.2 } as const
/** O grão da terra: a grade (px), o raio do grão (ao quadrado, em casas da grade) e o quanto cada grão clareia ou escurece (some pela metade na sombra). */
const GRADE_DO_GRAO = 0.9
const RAIO_DO_GRAO2 = 0.12
const GRAO_CLARO = 0.1
const GRAO_ESCURO = -0.2

// ---------- os materiais fixos ----------

/** O ferro das ferragens, o aço polido da relha e da aiveca e a terra (a mesma da horta). */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.86)) }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.2)) }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.9)) }

// ---------- ajudantes ----------

/** As medidas do desenho na pegada: cada ponto (x ao comprido, y a partir da linha do arado) e o miúdo, do lado que menos esticou. */
interface Regua {
  readonly noArado: (p: Ponto) => Ponto
  readonly k: number
}

/** Uma vara no ar (o timão, uma rabiça): a forma, a sombra no chão, os pontos da linha do meio e a altura de cada um. */
interface Vara {
  readonly forma: Forma
  readonly sombra: Forma
  readonly pontos: readonly Ponto[]
  readonly alturas: readonly number[]
}

/** A forma com a beira torta: a distância empurrada pelo ruído, até `amplitude` px para cada lado. */
function torta(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  return {
    b: [f.b[0] - amplitude, f.b[1] - amplitude, f.b[2] + amplitude, f.b[3] + amplitude],
    d: (x, y) => f.d(x, y) + ruido(x * escala + semente, y * escala + semente * 0.37) * 2 * amplitude,
  }
}

/** A forma engordada `r` px para fora (a cinta de ferro em volta da madeira). */
function engrossada(f: Forma, r: number): Forma {
  return { b: [f.b[0] - r, f.b[1] - r, f.b[2] + r, f.b[3] + r], d: (x, y) => f.d(x, y) - r }
}

/** A linha de `pontos` engrossada: cada ponto com a meia largura dele, um lado na ida e o outro na volta. */
function fita(pontos: readonly Ponto[], meias: readonly number[]): Forma {
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  const ultimo = pontos.length - 1
  pontos.forEach(([x, y], k) => {
    const [xa, ya] = pontos[Math.max(0, k - 1)]
    const [xb, yb] = pontos[Math.min(ultimo, k + 1)]
    const l = Math.hypot(xb - xa, yb - ya) || 1
    const nx = (-(yb - ya) / l) * meias[k]
    const ny = ((xb - xa) / l) * meias[k]
    ida.push([x + nx, y + ny])
    volta.push([x - nx, y - ny])
  })
  return poligono([...ida, ...volta.reverse()])
}

/** O ponto no chão onde cai a sombra de (x, y) à altura `z`. */
function andado([x, y]: Ponto, z: number): Ponto {
  return [x + SOMBRA_X * z, y + SOMBRA_Y * z]
}

/** O ponto e a altura a uma fração `t` da vara (0 no primeiro ponto, 1 no último). */
function lugarNaVara(v: Vara, t: number): readonly [Ponto, number] {
  const s = t * (v.pontos.length - 1)
  const i = Math.min(v.pontos.length - 2, Math.floor(s))
  const f = s - i
  const [ax, ay] = v.pontos[i]
  const [bx, by] = v.pontos[i + 1]
  return [[ax + (bx - ax) * f, ay + (by - ay) * f], v.alturas[i] + (v.alturas[i + 1] - v.alturas[i]) * f]
}

/** Um torrão: um polígono torto de seis lados em volta de (x, y). */
function torrao(x: number, y: number, r: number, semente: number): Forma {
  const lados = 6
  const giro = hash(semente, 0, 9150) * VOLTA
  const pontos: Ponto[] = []
  for (let i = 0; i < lados; i += 1) {
    const t = giro + (i / lados) * VOLTA
    const q = r * (0.72 + 0.42 * hash(semente, i + 1, 9150))
    pontos.push([x + Math.cos(t) * q, y + Math.sin(t) * q * 0.86])
  }
  return poligono(pontos)
}

// ---------- texturas ----------

/** A terra revirada: grãos miúdos e redondos, claros e escuros, sorteados numa grade, e manchas largas de luz (os torrões miúdos). */
const texDaTerra: Textura = (_u, _v, x, y, p, s) => {
  const gx = x / GRADE_DO_GRAO
  const gy = y / GRADE_DO_GRAO
  const ix = Math.floor(gx)
  const iy = Math.floor(gy)
  const h = hash(ix, iy, 9190)
  const dx = gx - ix - 0.5
  const dy = gy - iy - 0.5
  if ((h > 0.8 || h < 0.2) && dx * dx + dy * dy < RAIO_DO_GRAO2) s[6] = h > 0.8 ? GRAO_CLARO : GRAO_ESCURO
  s[3] += ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 0.16
}

/** O fundo da vala: a terra e os riscos compridos que o rasto alisou, ao comprido do sulco. */
const texDaVala: Textura = (u, v, x, y, p, s, escala) => {
  texDaTerra(u, v, x, y, p, s, escala)
  s[3] += ruido(x * 0.08 + p.su, y * 1.3) * 0.1
}

/** A rabiça: o veio da madeira e o punho escurecido pela mão no fim dela. `a` mede do corpo para o punho. */
function texDaRabica(inicio: Ponto, dir: Ponto, comprimento: number, punho: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const a = (x - inicio[0]) * dir[0] + (y - inicio[1]) * dir[1]
    s[3] -= ESCURO_DO_PUNHO * limitar01((a - (comprimento - punho)) / punho)
  }
}

// ---------- as medidas das varas no ar ----------

function medirTimao(c: ContextoDoMovel, { noArado, k }: Regua): Vara {
  const pontos: Ponto[] = []
  const meias: number[] = []
  const alturas: number[] = []
  for (let i = 0; i <= LANCES_DO_TIMAO; i += 1) {
    const t = i / LANCES_DO_TIMAO
    pontos.push(noArado([TIMAO_DE + (TIMAO_ATE - TIMAO_DE) * t, VERGA_DO_TIMAO * Math.sin(Math.PI * t)]))
    meias.push((MEIA_DO_TIMAO_NA_FRENTE + (MEIA_DO_TIMAO_ATRAS - MEIA_DO_TIMAO_NA_FRENTE) * t) * k)
    alturas.push(c.g * (ALTURA_DO_TIMAO_NA_FRENTE + (ALTURA_DO_TIMAO_ATRAS - ALTURA_DO_TIMAO_NA_FRENTE) * t))
  }
  return { forma: fita(pontos, meias), sombra: fita(pontos.map((p, i) => andado(p, alturas[i])), meias), pontos, alturas }
}

function medirRabica(c: ContextoDoMovel, { noArado, k }: Regua, desenho: readonly Ponto[]): Vara {
  const pontos = desenho.map((p) => noArado(p))
  const ultimo = pontos.length - 1
  const alturas = pontos.map((_, i) => c.g * (ALTURA_NO_CORPO + ((ALTURA_NO_PUNHO - ALTURA_NO_CORPO) * i) / ultimo))
  const meias = MEIAS_DA_RABICA.map((m) => m * k)
  return { forma: fita(pontos, meias), sombra: fita(pontos.map((p, i) => andado(p, alturas[i])), meias), pontos, alturas }
}

// ---------- as partes ----------

/** O sulco: a vala, a leiva com as fatias e os torrões. Tudo no chão, por baixo do arado. */
function montarSulco(c: ContextoDoMovel, cena: Cena, { noArado, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const [ax, ay] = noArado([VALA.de, VALA.cima])
  const [bx, by] = noArado([VALA.ate, VALA.baixo])
  const vala = torta(caixa(ax, ay, bx, by, 4 * k), 0.7 * k, 0.32, 3)
  L.push(P(vala, TERRA, { bisel: 0, tom: TOM_DA_VALA, contorno: 0.16, recesso: { k: RECESSO_DA_VALA.k * k, forca: RECESSO_DA_VALA.forca }, textura: texDaVala, semente: 9101 }))
  const parede = dentroDe(vala, caixa(ax, by - PAREDE_DA_VALA.largura * k, bx, by + 2 * k))
  L.push(P(parede, TERRA, { bisel: 0, contorno: 0, tom: PAREDE_DA_VALA.tom, alfa: 0.85, suave: 0.6 * k, textura: texDaTerra, semente: 9104 }))
  const [lx0, ly0] = noArado([LEIVA.de, LEIVA.cima])
  const [lx1, ly1] = noArado([LEIVA.ate, LEIVA.baixo])
  const raio = (ly1 - ly0) / 2
  const meio = (ly0 + ly1) / 2
  const monte = torta(capsula(lx0 + raio, meio, lx1 - raio, meio, raio), 1.2 * k, 0.3, 7)
  cena.sombras.push({ forma: monte, z: c.g * ALTURA_DA_LEIVA, forca: 0.22 }, contato(monte, 0.24))
  L.push(P(monte, TERRA, { bisel: raio * 0.7, tom: 0.84, contorno: 0.2, textura: texDaTerra, semente: 9102 }))
  // Cada fatia: um bloco de cantos redondos, girado, de beira torta.
  const canto = CANTO_DA_FATIA * k
  const a = MEIA_DA_FATIA * k - canto
  const b = raio * LARGURA_DA_FATIA - canto
  FATIAS.forEach(([fx, giro], i) => {
    const [x] = noArado([fx, 0])
    const co = Math.cos(giro)
    const si = Math.sin(giro)
    const cantos: readonly Ponto[] = [[-a, -b], [a, -b], [a, b], [-a, b]]
    const bloco = engrossada(poligono(cantos.map(([u, v]): Ponto => [x + u * co - v * si, meio + u * si + v * co])), canto)
    L.push(P(torta(bloco, 0.8 * k, 0.5, 11 + i), TERRA, { bisel: 2.2 * k, tom: TONS_DAS_FATIAS[i % 2], contorno: 0.24, textura: texDaTerra, semente: 9105 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  })
  TORROES.forEach(([tx, ty, r], i) => {
    const [x, y] = noArado([tx, ty])
    const forma = torrao(x, y, r * k, 9110 + i)
    cena.sombras.push(contato(forma, 0.28))
    L.push(P(forma, TERRA, { bisel: r * k * 0.7, tom: 0.92 + 0.16 * hash(i, 1, 9110), contorno: 0.24, textura: texDaTerra, semente: 9111 + i, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  })
}

/** A sombra de cada coisa no ar: no chão e, por uma peça sem tinta que só projeta, no sulco (que cobre o chão). */
function montarSombrasNoAr(c: ContextoDoMovel, cena: Cena, sombras: readonly Forma[]): void {
  sombras.forEach((forma, i) => {
    cena.sombras.push({ forma, z: 0, suave: 1.7, forca: FORCA_DA_SOMBRA_NO_AR })
    cena.partes.push(c.peca(forma, TERRA, { alfa: 0, projeta: { dist: 0, forca: FORCA_DA_SOMBRA_NO_AR, suave: 1.2 }, semente: 9180 + i }))
  })
}

/** O balancim deitado de través, com as ponteiras, os ganchos e o olhal, e a corrente até o regulador do timão. */
function montarBalancim(c: ContextoDoMovel, cena: Cena, { noArado, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const n = MEIAS_DO_BALANCIM.length - 1
  const pontos = MEIAS_DO_BALANCIM.map((_, i) => noArado([X_DO_BALANCIM, -MEIO_BALANCIM + (2 * MEIO_BALANCIM * i) / n]))
  const trave = fita(pontos, MEIAS_DO_BALANCIM.map((m) => m * k))
  cena.sombras.push(contato(trave, 0.32), { forma: trave, z: c.g * ALTURA_DO_BALANCIM, forca: 0.26 })
  L.push(P(trave, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.5 * k, tom: 0.96, contorno: 0.28, semente: 9201 }))
  const [xb, yb] = noArado([X_DO_BALANCIM, 0])
  const argola = (x: number, y: number): Forma => anel(x, y, ARGOLA[0] * k, ARGOLA[0] * k, ARGOLA[1] * k, ARGOLA[1] * k)
  for (const lado of [-1, 1] as const) {
    const [, yp] = noArado([X_DO_BALANCIM, lado * MEIO_BALANCIM])
    const ya = yp - lado * PONTEIRA_DO_BALANCIM * k
    const yc = yp + lado * k
    const ponteira = dentroDe(engrossada(trave, 0.35 * k), caixa(xb - 4 * k, Math.min(ya, yc), xb + 4 * k, Math.max(ya, yc)))
    L.push(P(ponteira, FERRO, { tabua: 0, bisel: 0.7 * k, contorno: 0.26, metal: 0.42, semente: 9203 + lado }))
    const gancho = argola(xb - 2.6 * k, yp - lado * 1.2 * k)
    cena.sombras.push(contato(gancho, 0.3))
    L.push(P(gancho, FERRO, { bisel: 0.5 * k, contorno: 0.28, metal: 0.42, semente: 9206 + lado }))
  }
  // O olhal do meio e a argola do regulador, e a corrente entre os dois, barrigando no chão.
  L.push(P(caixa(xb + 0.8 * k, yb - 2.4 * k, xb + 3.2 * k, yb + 2.4 * k, 0.5 * k), FERRO, { tabua: 0, bisel: 0.6 * k, contorno: 0.26, metal: 0.42, semente: 9208 }))
  const [xr] = noArado([REGULADOR.de, 0])
  const deX = xb + 4.6 * k
  const ateX = xr - 1.4 * k
  for (const [x, i] of [[deX, 0], [ateX, 1]] as const) {
    const forma = argola(x, yb)
    cena.sombras.push(contato(forma, 0.3))
    L.push(P(forma, FERRO, { bisel: 0.5 * k, contorno: 0.28, metal: 0.42, semente: 9209 + i }))
  }
  const comp = ateX - deX - 2 * ARGOLA[1] * k
  const ponto = (t: number): Ponto => [deX + ARGOLA[1] * k + comp * t, yb + BARRIGA_DA_CORRENTE * k * Math.sin(Math.PI * t)]
  const elos = Math.max(2, Math.round(comp / (ELO * 0.8 * k)))
  cena.sombras.push(contato(cadeia([ponto(0), ponto(0.25), ponto(0.5), ponto(0.75), ponto(1)], 1.1 * k), 0.3))
  for (let i = 0; i < elos; i += 1) {
    const t = (i + 0.5) / elos
    const [cx, cy] = ponto(t)
    const [ax, ay] = ponto(t - 0.02)
    const [bx, by] = ponto(t + 0.02)
    const ang = Math.atan2(by - ay, bx - ax)
    const meio = (ELO / 2) * k
    // Um elo deitado (o furo à mostra) e o seguinte de pé (um risco de ferro), alternados.
    const elo =
      i % 2 === 0
        ? menos(elipseGirada(cx, cy, meio, MEIO_ELO * k, ang), elipseGirada(cx, cy, meio - 0.8 * k, (MEIO_ELO - 0.65) * k, ang))
        : capsula(cx - Math.cos(ang) * meio * 0.9, cy - Math.sin(ang) * meio * 0.9, cx + Math.cos(ang) * meio * 0.9, cy + Math.sin(ang) * meio * 0.9, 0.55 * k)
    L.push(P(elo, FERRO, { bisel: 0.45 * k, contorno: 0.3, metal: 0.45, semente: 9220 + i }))
  }
}

/** O corpo rente ao chão: o rasto, a sabota, a relha com o fio e a aiveca com o brilho e a terra grudada. */
function montarCorpo(c: ContextoDoMovel, cena: Cena, { noArado, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const [r0, r1] = RASTO.map((p) => noArado(p))
  const rasto = barra(r0[0], r0[1], r1[0], r1[1], 2 * MEIA_DO_RASTO * k)
  cena.sombras.push(contato(rasto, 0.34), { forma: rasto, z: c.g * ALTURA_RENTE, forca: 0.28 })
  L.push(P(rasto, FERRO, { tabua: 0, bisel: 0.6 * k, tom: 0.84, contorno: 0.28, metal: 0.4, semente: 9301 }))
  const sabota = poligono(SABOTA.map((p) => noArado(p)))
  cena.sombras.push({ forma: sabota, z: c.g * ALTURA_DA_SABOTA, forca: 0.3 })
  L.push(P(sabota, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.2 * k, tom: 0.8, contorno: 0.28, semente: 9302, projeta: { dist: 1.6 * k, forca: 0.3 } }))
  const relha = poligono(RELHA.map((p) => noArado(p)))
  cena.sombras.push(contato(relha, 0.34), { forma: relha, z: c.g * ALTURA_RENTE, forca: 0.28 })
  L.push(P(relha, FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.92, contorno: 0.3, metal: 0.5, semente: 9303 }))
  const [f0, f1] = FIO_DA_RELHA.map((p) => noArado(p))
  L.push(P(dentroDe(capsula(f0[0], f0[1], f1[0], f1[1], 0.75 * k), relha), ACO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.3, alfa: 0.9, metal: 0.7, semente: 9304 }))
  const aiveca = poligono(AIVECA.map((p) => noArado(p)))
  const zAiveca = c.g * ALTURA_DA_AIVECA
  cena.sombras.push({ forma: aiveca, z: zAiveca, forca: 0.3 }, contato(aiveca, 0.3))
  L.push(P(aiveca, ACO, { tabua: 0, bisel: 2.4 * k, tom: 0.96, contorno: 0.3, metal: 0.55, semente: 9305, projeta: { dist: zAiveca * SOMBRA_POR_ALTURA * 0.7, forca: 0.3, suave: 1.2 } }))
  L.push(P(dentroDe(cadeia(DOBRA_DA_AIVECA.map((p) => noArado(p)), MEIA_DA_DOBRA * k), aiveca), ACO, { bisel: 0, contorno: 0, tom: TOM_DA_DOBRA, alfa: 0.55, suave: 1.2 * k, metal: 0.4, semente: 9307 }))
  const [b0, b1] = BRILHO_DA_AIVECA.map((p) => noArado(p))
  L.push(P(dentroDe(capsula(b0[0], b0[1], b1[0], b1[1], MEIA_DO_BRILHO * k), aiveca), ACO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.34, alfa: 0.55, suave: 1.4 * k, metal: 0.7, semente: 9306 }))
  const ferro = uniao(aiveca, relha)
  TERRA_GRUDADA.forEach(([x, y, rx, ry, giro], i) => {
    const [cx, cy] = noArado([x, y])
    const mancha = dentroDe(torta(elipseGirada(cx, cy, rx * k, ry * k, giro), 0.5 * k, 0.7, 20 + i), ferro)
    L.push(P(mancha, TERRA, { bisel: 0.7 * k, tom: 0.86, contorno: 0.16, alfa: 0.94, textura: texDaTerra, semente: 9310 + i }))
  })
}

/** O timão, com o regulador e os furos dele, a ponteira, as abraçadeiras e o grampo da sega com os parafusos. */
function montarTimao(c: ContextoDoMovel, cena: Cena, { noArado, k }: Regua, timao: Vara): void {
  const P = c.peca
  const L = cena.partes
  L.push(P(timao.forma, c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.6 * k, tom: 0.94, contorno: 0.28, semente: 9401, projeta: { dist: 2.2 * k, forca: 0.3 } }))
  const [q0x, q0y] = noArado([REGULADOR.de, -REGULADOR.meia])
  const [q1x, q1y] = noArado([REGULADOR.ate, REGULADOR.meia])
  L.push(P(caixa(q0x, q0y, q1x, q1y, 0.6 * k), FERRO, { tabua: 0, bisel: 0.7 * k, contorno: 0.28, metal: 0.4, semente: 9402 }))
  for (let i = 0; i < REGULADOR.furos; i += 1) {
    const y = -REGULADOR.meia * 0.6 + (1.2 * REGULADOR.meia * i) / (REGULADOR.furos - 1)
    const [hx, hy] = noArado([(REGULADOR.de + REGULADOR.ate) / 2, y])
    L.push(P(elipse(hx, hy, 0.5 * k, 0.5 * k), BURACO, { bisel: 0, contorno: 0, semente: 9403 + i }))
  }
  // As cintas de ferro em volta da madeira: a ponteira, as abraçadeiras e o grampo da sega.
  const [, y0, , y1] = timao.forma.b
  const cinta = (de: number, ate: number, folga: number): Forma => {
    const [x0] = noArado([de, 0])
    const [x1] = noArado([ate, 0])
    return dentroDe(engrossada(timao.forma, folga * k), caixa(x0, y0 - 2 * k, x1, y1 + 2 * k))
  }
  L.push(P(cinta(PONTEIRA_DO_TIMAO[0], PONTEIRA_DO_TIMAO[1], 0.3), FERRO, { tabua: 0, bisel: 0.8 * k, tom: 0.92, contorno: 0.26, metal: 0.42, semente: 9410 }))
  ABRACADEIRAS.forEach((x, i) => {
    L.push(P(cinta(x - 0.9, x + 0.9, 0.4), FERRO, { tabua: 0, bisel: 0.5 * k, contorno: 0.26, metal: 0.42, semente: 9411 + i }))
  })
  const { de, ate, sobra } = GRAMPO_DA_SEGA
  L.push(P(cinta(de, ate, sobra), FERRO, { tabua: 0, bisel: 0.8 * k, tom: 0.86, contorno: 0.28, metal: 0.4, semente: 9415 }))
  // Os parafusos do grampo, um de cada lado do timão.
  const t = ((de + ate) / 2 - TIMAO_DE) / (TIMAO_ATE - TIMAO_DE)
  const [[xMeio, yMeio]] = lugarNaVara(timao, t)
  const meia = MEIA_DO_TIMAO_NA_FRENTE + (MEIA_DO_TIMAO_ATRAS - MEIA_DO_TIMAO_NA_FRENTE) * t
  for (const lado of [-1, 1] as const) {
    L.push(P(elipse(xMeio, yMeio + lado * (meia + 0.4) * k, 0.75 * k, 0.75 * k), PREGO, { bisel: 0.5 * k, contorno: 0.22, metal: 0.4, semente: 9417 + lado }))
  }
}

/** A escora e a travessa (por baixo das rabiças), as duas rabiças com o punho gasto e os parafusos das juntas. */
function montarRabicas(c: ContextoDoMovel, cena: Cena, { noArado, k }: Regua, rabicas: readonly Vara[]): void {
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const [pe] = lugarNaVara(rabicas[0], LUGAR_DA_ESCORA)
  const de = noArado(ESCORA_DE)
  L.push(P(barra(de[0], de[1], pe[0], pe[1], LARGURA_DA_ESCORA * k), FERRO, { tabua: 0, bisel: 0.5 * k, contorno: 0.28, metal: 0.4, semente: 9501 }))
  const [pa] = lugarNaVara(rabicas[0], LUGAR_DA_TRAVESSA)
  const [pb] = lugarNaVara(rabicas[1], LUGAR_DA_TRAVESSA)
  L.push(P(capsula(pa[0], pa[1], pb[0], pb[1], MEIA_DA_TRAVESSA * k), mad, { eixo: Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), tabua: 0, bisel: 1.1 * k, tom: 1.04, contorno: 0.28, semente: 9502 }))
  rabicas.forEach((v, i) => {
    const [ax, ay] = v.pontos[0]
    const [bx, by] = v.pontos[v.pontos.length - 1]
    const comp = Math.hypot(bx - ax, by - ay)
    const dir: Ponto = [(bx - ax) / comp, (by - ay) / comp]
    L.push(P(v.forma, mad, { eixo: Math.atan2(dir[1], dir[0]), tabua: 0, bisel: 1.4 * k, tom: 0.98, contorno: 0.28, textura: texDaRabica([ax, ay], dir, comp, PUNHO * k), semente: 9510 + i }))
  })
  for (const [i, [x, y]] of [pa, pb, pe, de].entries()) {
    L.push(P(elipse(x, y, 0.7 * k, 0.7 * k), PREGO, { bisel: 0.5 * k, contorno: 0.22, metal: 0.4, semente: 9520 + i }))
  }
}

export const montarArado: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / FUNDO_DE_PARTIDA
  const regua: Regua = { noArado: ([x, y]) => [x * sx, (Y_DO_ARADO + y) * sy], k: Math.min(sx, sy) }
  const timao = medirTimao(c, regua)
  const rabicas = RABICAS.map((desenho) => medirRabica(c, regua, desenho))
  // A travessa e a escora no ar: a sombra de cada ponta anda pela altura dela.
  const [pa, za] = lugarNaVara(rabicas[0], LUGAR_DA_TRAVESSA)
  const [pb, zb] = lugarNaVara(rabicas[1], LUGAR_DA_TRAVESSA)
  const [pe, ze] = lugarNaVara(rabicas[0], LUGAR_DA_ESCORA)
  const sa = andado(pa, za)
  const sb = andado(pb, zb)
  const sd = andado(regua.noArado(ESCORA_DE), c.g * ALTURA_DA_AIVECA)
  const se = andado(pe, ze)
  montarSulco(c, cena, regua)
  montarSombrasNoAr(c, cena, [
    timao.sombra,
    ...rabicas.map((v) => v.sombra),
    capsula(sa[0], sa[1], sb[0], sb[1], MEIA_DA_TRAVESSA * regua.k),
    barra(sd[0], sd[1], se[0], se[1], LARGURA_DA_ESCORA * regua.k),
  ])
  montarBalancim(c, cena, regua)
  montarCorpo(c, cena, regua)
  montarTimao(c, cena, regua, timao)
  montarRabicas(c, cena, regua, rabicas)
}
