/**
 * OSSOS de cima com volume (lote 3 dos objetos novos, 11/11/2026): o esqueleto
 * de alguém que caiu ali há muito tempo, já desfeito e meio enterrado no pó. O
 * CRÂNIO rolou para o canto de cima à esquerda, de cara para o alto (as duas
 * órbitas, o nariz, os dentes e uma rachadura), com a MANDÍBULA solta ao lado;
 * dele sai a COLUNA, vértebra por vértebra (faltam duas), com as COSTELAS em
 * arco dos dois lados (duas partidas, uma caída mais longe) até a BACIA. Em
 * volta, os OSSOS COMPRIDOS com as pontas em nó: os braços abertos, um fêmur
 * com a canela dobrada para cima e o outro com a canela partida em dois (as
 * lascas e o miolo oco na quebra), os ossinhos das mãos e de um pé, e lascas
 * soltas. Por baixo, a mancha de PÓ; por cima, os montinhos de pó que cobrem
 * um pedaço de alguns ossos.
 *
 * A 25% de zoom sobra o crânio com os dois olhos escuros, o pente das costelas
 * e os riscos claros com nó nas pontas: é o que diz "ossos" e não "gravetos".
 * O osso é velho (marfim amarelado, com manchas), nunca branco puro, e não há
 * sangue. Sem material no painel: não existe osso na tabela, a cor é fixa.
 *
 * O desenho é feito em 84 x 56 px (1,5 x 1 casas): as posições saem de frações
 * da pegada (o objeto esticado espalha os ossos) e o que é redondo (os raios,
 * o crânio, a bacia), do menor lado.
 *
 * Na vista 3/4 o esqueleto é rente ao chão: sobe inteiro a espessura de um
 * osso (perfil derivado com `alturaSolta` de 0,03 casa) e a sombra fica onde
 * está. Por isso nenhuma sombra daqui tem altura (`sombraDoOsso`).
 */
import { hash, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O tamanho em que o esqueleto é desenhado (px do protótipo): 1,5 x 1 casas. */
const LARGURA_DO_DESENHO = 84
const ALTURA_DO_DESENHO = 56

/** O osso velho: marfim amarelado (saturação 0,19), e a mancha de terra e de tempo que ele pega. */
const TOM_DO_OSSO: Rgb = [0xd2, 0xc6, 0xaa]
const MANCHA_DO_OSSO: Rgb = [0xa8, 0x93, 0x70]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
/** O escuro de dentro das órbitas, do nariz, dos furos da bacia e do miolo oco do osso partido. */
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x47, 0x3a] }
/**
 * O pó: cinza-pardo. O de baixo (a mancha em que o esqueleto está) é mais escuro que a lajota clara e mais cinza
 * que a terra, para o osso claro ler nos dois chãos; o de cima (os montinhos que enterram os ossos) é mais claro.
 */
const PO_DE_BAIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x90, 0x81, 0x6b] }
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9a, 0x82] }
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): pardo acinzentado, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira do osso, na sombra, saía avermelhada.
 */
const ESCURO_DO_OSSO: Rgb = [0x4a, 0x42, 0x3a]

/** A partir de quanto o ruído vira mancha no osso, a largura da passagem e o quanto a mancha cobre no miolo. */
const LIMIAR_DA_MANCHA = 0.06
const BEIRA_DA_MANCHA = 0.22
const MANCHA_CHEIA = 0.45
/** A altura de um osso deitado, em raios dele (a sombra dele no chão é curta), e a borda borrada dessa sombra (px). */
const ALTURA_DO_OSSO = 1.6
const BORDA_DA_SOMBRA_DO_OSSO = 1
/** A altura do crânio (px do desenho): a sombra dele vai mais longe que a dos outros ossos. */
const ALTURA_DO_CRANIO = 7

/** O osso: o grão miúdo e as manchas de tempo, cada peça com as suas (nunca em listras). */
const texDoOsso: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.33 + p.su, y * 0.33 + p.sv) * 0.07 + ruido(x * 1.2 + p.sv, y * 1.2) * 0.03
  const suja = ruido(x * 0.12 + p.sv, y * 0.12 + p.su)
  if (suja <= LIMIAR_DA_MANCHA) return
  const t = Math.min(1, (suja - LIMIAR_DA_MANCHA) / BEIRA_DA_MANCHA) * MANCHA_CHEIA
  s[0] += (MANCHA_DO_OSSO[0] - s[0]) * t
  s[1] += (MANCHA_DO_OSSO[1] - s[1]) * t
  s[2] += (MANCHA_DO_OSSO[2] - s[2]) * t
}

/** O pó: grão em duas escalas e a cobertura falhada (mais cheio aqui, mais ralo ali). */
const texDoPo: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.08 + ruido(x * 1.7, y * 1.7 + p.sv) * 0.04
  s[5] *= 0.82 + ruido(x * 0.16 + p.sv, y * 0.16 + p.su) * 0.36
}

/** As medidas do desenho na pegada. */
interface Regua {
  /** O ponto do desenho (px de 84 x 56) na pegada. */
  readonly em: (x: number, y: number) => Ponto
  /** O que é redondo sai do menor lado: continua redondo no objeto esticado. */
  readonly k: number
}

/** A forma desenhada em volta de (0, 0), aumentada `k`, girada `ang` radianos e levada para (cx, cy). */
function levada(f: Forma, cx: number, cy: number, ang: number, k: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => cx + (x * co - y * si) * k)
  const ys = cantos.map(([x, y]) => cy + (x * si + y * co) * k)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = (x - cx) / k
      const dy = (y - cy) / k
      return f.d(dx * co + dy * si, -dx * si + dy * co) * k
    },
  }
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta): o contrário do `girarPonto` de `tresQuartos.ts`.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/**
 * A sombra de um osso de altura `z` no chão: o contato no pé e a forma afastada para baixo à direita, como o motor
 * afasta a sombra de uma peça dessa altura. As duas vão com altura ZERO de propósito: sombra com altura vira coluna
 * na vista 3/4 (`tresQuartos.ts`), e cada osso subiria sozinho, com uma frente lisa embaixo. Assim o esqueleto
 * inteiro sobe junto, a espessura de um osso, e a sombra fica no chão. Como o afastamento é pintado aqui, ele é
 * desgirado pelo `giro` que a 3/4 pinta: a sombra continua caindo para baixo à direita na tela.
 */
function sombraDoOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, forca = 0.26): void {
  const [dx, dy] = desgirado(SOMBRA_X * z, SOMBRA_Y * z, c.giro)
  cena.sombras.push({ forma: afastada(forma, dx, dy), z: 0, suave: BORDA_DA_SOMBRA_DO_OSSO, forca }, contato(forma, 0.3))
}

/** Põe um osso na cena: a sombra curta dele no chão e a peça, arredondada pelo raio `r`. */
function porOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, r: number, semente: number, tom = 1): void {
  sombraDoOsso(c, cena, forma, r * ALTURA_DO_OSSO)
  cena.partes.push(c.peca(forma, OSSO, { bisel: r * 0.9, tom, contorno: 0.3, textura: texDoOsso, semente }))
}

/** Põe um oco (órbita, furo, miolo) por cima do osso: escuro, com a sombra da beira de cima dentro dele. */
function porOco(c: ContextoDoMovel, cena: Cena, forma: Forma, semente: number): void {
  cena.partes.push(c.peca(forma, OCO, { bisel: 0.4, contorno: 0, recesso: { k: 0.8, forca: 0.3 }, semente }))
}

// ---------- o pó ----------

/** O contorno irregular de uma mancha de pó: `n` pontos em volta de (cx, cy). */
function mancha(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const k = 0.8 + 0.24 * hash(i, sem, 94)
    pontos.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k])
  }
  return pontos
}

/** Os montinhos de pó por cima dos ossos (o meio, os dois raios e o ângulo): cada um enterra um pedaço de osso. */
const MONTES_DE_PO: readonly (readonly [number, number, number, number, number])[] = [
  [-36.2, -4.4, 3.8, 2.9, 0.5],
  [-10, 8, 6.2, 2.2, 0.12],
  [-12, 25, 5, 2.6, -0.06],
  [13, 25.2, 3.9, 2.7, 0],
  [16.2, 13, 3.6, 2.5, 0.4],
  [36.6, -17.4, 3.2, 2.3, -1],
]

function montarPoPorBaixo(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  // A mancha larga e rala e a do meio, mais cheia, as duas de borda desfeita.
  cena.partes.push(P(poligono(mancha(0, 0.02 * hh, hw * 1.02, hh * 0.98, 18, 1)), PO_DE_BAIXO, { bisel: 0, contorno: 0, alfa: 0.42, suave: R * 0.22, textura: texDoPo, semente: 4100 }))
  cena.partes.push(P(poligono(mancha(-0.08 * hw, 0.04 * hh, hw * 0.74, hh * 0.66, 14, 2)), PO_DE_BAIXO, { bisel: 0, contorno: 0, tom: 0.94, alfa: 0.5, suave: R * 0.16, textura: texDoPo, semente: 4101 }))
}

function montarPoPorCima(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  MONTES_DE_PO.forEach(([x, y, rx, ry, ang], i) => {
    const [cx, cy] = em(x, y)
    cena.partes.push(c.peca(elipseGirada(cx, cy, rx * k, ry * k, ang), PO, { bisel: 0, contorno: 0, tom: 1.05, alfa: 0.94, suave: 2.2 * k, textura: texDoPo, semente: 4110 + i }))
  })
}

// ---------- os ossos compridos ----------

interface OssoComprido {
  readonly de: Ponto
  readonly ate: Ponto
  readonly r: number
  /** A ponta `ate` partiu: acaba em lascas, com o miolo oco à vista. */
  readonly partido?: boolean
}

/** Quanto cada côndilo (o nó da ponta) é maior que a haste e quanto fica para o lado do eixo dela, em raios. */
const RAIO_DO_CONDILO = 1.12
const LADO_DO_CONDILO = 0.72

/** Os braços, abertos para cima e para baixo: o úmero e os dois ossos finos do antebraço (o de baixo perdeu um). */
const BRACOS: readonly OssoComprido[] = [
  { de: [-17.5, -14.2], ate: [-4, -22.2], r: 1.7 },
  { de: [-1.6, -23.4], ate: [12.2, -20.2], r: 1 },
  { de: [-1.2, -21.3], ate: [12.8, -17.8], r: 0.95 },
  { de: [-15.5, 11.5], ate: [-21.5, 22.5], r: 1.7 },
  { de: [-19.5, 25.2], ate: [-5, 24.2], r: 1 },
]
/** As pernas: um fêmur com a canela (tíbia e fíbula) dobrada para cima; o outro com a tíbia partida em dois pedaços. */
const PERNAS: readonly OssoComprido[] = [
  { de: [38.4, -10.6], ate: [31.4, -23.6], r: 1.5 },
  { de: [40.4, -11.8], ate: [34.6, -24], r: 0.75 },
  { de: [36.6, 20.4], ate: [40, 12.6], r: 1.5, partido: true },
  { de: [14, 24.8], ate: [23, 25.8], r: 1.5, partido: true },
]
/** Os fêmures saem da bacia e ficam por cima dela. */
const FEMURES: readonly OssoComprido[] = [
  { de: [24.6, 2.4], ate: [37, -7.6], r: 2 },
  { de: [19.6, 15.2], ate: [32.5, 22.2], r: 2 },
]

/** A forma do osso comprido: a haste e os dois côndilos em cada ponta inteira; a ponta partida acaba em três lascas. */
function formaDoOssoComprido([ax, ay]: Ponto, [bx, by]: Ponto, r: number, partido: boolean): Forma {
  const comp = Math.hypot(bx - ax, by - ay) || 1
  const condilos = (x: number): Forma => uniao(elipse(x, -r * LADO_DO_CONDILO, r * RAIO_DO_CONDILO, r * RAIO_DO_CONDILO), elipse(x, r * LADO_DO_CONDILO, r * RAIO_DO_CONDILO, r * RAIO_DO_CONDILO))
  const haste = partido
    ? poligono([[0, -r], [comp - 0.3 * r, -r], [comp + 0.9 * r, -0.5 * r], [comp + 0.1 * r, -0.05 * r], [comp + 1.2 * r, 0.55 * r], [comp - 0.2 * r, r], [0, r]])
    : caixa(0, -r, comp, r, r)
  const inteiro = uniao(haste, condilos(0))
  return levada(partido ? inteiro : uniao(inteiro, condilos(comp)), ax, ay, Math.atan2(by - ay, bx - ax), 1)
}

function montarOssosCompridos(c: ContextoDoMovel, cena: Cena, { em, k }: Regua, ossos: readonly OssoComprido[], semente: number): void {
  ossos.forEach((osso, i) => {
    const de = em(osso.de[0], osso.de[1])
    const ate = em(osso.ate[0], osso.ate[1])
    const r = osso.r * k
    porOsso(c, cena, formaDoOssoComprido(de, ate, r, osso.partido === true), r, semente + i * 2, 0.96 + 0.1 * hash(i, semente, 97))
    if (osso.partido !== true) return
    // O miolo oco na quebra, um pouco para dentro da ponta.
    const ang = Math.atan2(ate[1] - de[1], ate[0] - de[0])
    porOco(c, cena, elipseGirada(ate[0] - Math.cos(ang) * r * 0.1, ate[1] - Math.sin(ang) * r * 0.1, r * 0.5, r * 0.55, ang), semente + i * 2 + 1)
  })
}

// ---------- o miúdo: os ossinhos das mãos e do pé, as lascas ----------

/** Os ossinhos dos dedos (de onde até onde): a mão de cima, a de baixo e o pé da perna dobrada. */
const FALANGES: readonly (readonly [number, number, number, number])[] = [
  [15, -20, 17.6, -21.2],
  [15.6, -18.6, 18.6, -18.8],
  [15.2, -17, 18, -16],
  [19.4, -21.6, 21.2, -22.4],
  [20.2, -18.9, 22.4, -19],
  [-3, 23.2, -0.6, 22.4],
  [-2.6, 24.8, 0.4, 24.9],
  [-3, 26.2, -0.4, 26.8],
  [1.8, 22, 3.6, 21.4],
  [29.4, -24.8, 26.6, -25.4],
  [28.6, -26.5, 26, -26.8],
]
const RAIO_DA_FALANGE = 0.62
/** As lascas e os dentes soltos no pó: o meio, o raio e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-34.5, 3, 0.8, 0.4],
  [-31, 7.5, 0.6, 1.2],
  [8.5, 12.5, 0.9, 2.2],
  [13.5, -9.5, 0.7, -0.6],
  [28.5, 1.5, 0.85, 0.9],
  [2, -12.5, 0.65, 1.8],
  [-9.5, 19, 0.75, -1.1],
  [27, 9.5, 0.6, 0.3],
  [38.5, 3, 0.8, 2.6],
]
/** A costela caída longe do peito e a vértebra solta. */
const COSTELA_SOLTA: readonly Ponto[] = [[-12.6, 17.4], [-9.6, 15.3], [-6, 15], [-3, 16.6]]
const VERTEBRA_SOLTA: Ponto = [6.5, 9.5]

function montarMiudo(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  LASCAS.forEach(([x, y, raio, ang], i) => {
    const [cx, cy] = em(x, y)
    const r = raio * k
    porOsso(c, cena, levada(poligono([[-r * 1.5, -r * 0.6], [r * 0.6, -r], [r * 1.5, r * 0.2], [-r * 0.4, r]]), cx, cy, ang, 1), r * 0.7, 4200 + i, 0.92 + 0.14 * hash(i, 3, 98))
  })
  FALANGES.forEach(([ax, ay, bx, by], i) => {
    const [x0, y0] = em(ax, ay)
    const [x1, y1] = em(bx, by)
    porOsso(c, cena, capsula(x0, y0, x1, y1, RAIO_DA_FALANGE * k), RAIO_DA_FALANGE * k, 4220 + i)
  })
  const raioDaCostela = RAIO_DA_COSTELA * k
  porOsso(c, cena, cadeia(COSTELA_SOLTA.map(([x, y]) => em(x, y)), raioDaCostela), raioDaCostela, 4240, 0.94)
  const [vx, vy] = em(VERTEBRA_SOLTA[0], VERTEBRA_SOLTA[1])
  porOsso(c, cena, elipseGirada(vx, vy, 1.5 * k, 1.9 * k, 0.9), 1.4 * k, 4241)
}

// ---------- a coluna, as costelas e a bacia ----------

/** A coluna, do pescoço à bacia, e o vão entre uma vértebra e a seguinte. */
const ESPINHA: readonly Ponto[] = [[-23.5, -4.6], [-17, -2.6], [-9, -2.2], [-1, -0.8], [7, 1.8], [13.5, 5]]
const PASSO_DA_VERTEBRA = 2.75
/** As vértebras que faltam (contadas do pescoço). */
const VERTEBRAS_AUSENTES: readonly number[] = [10, 13]
/** A partir de qual vértebra elas são as da cintura, maiores. */
const PRIMEIRA_LOMBAR = 8
/**
 * As costelas: a vértebra de onde cada par sai, até onde abre para o lado e quanto do arco sobrou em cima e
 * embaixo (1 = inteira; as partidas acabam antes).
 */
const COSTELAS: readonly (readonly [number, number, number, number])[] = [
  [2, 6.4, 1, 1],
  [3, 8.4, 1, 0.5],
  [4, 9.4, 1, 1],
  [5, 9.6, 0.62, 0.36],
  [6, 9, 1, 1],
  [7, 7.4, 1, 0.82],
]
const RAIO_DA_COSTELA = 0.85
/** O arco da costela: em quantos pedaços, o quanto ela abre antes de voltar (radianos) e o quanto a ponta cai para os pés. */
const PASSOS_DA_COSTELA = 8
const ABERTURA_DA_COSTELA = 2
const QUEDA_DA_COSTELA = 0.5

interface Passo {
  readonly x: number
  readonly y: number
  readonly ang: number
}

/** Os pontos a cada `passo` px ao longo do caminho, com a direção dele em cada um. */
function aoLongo(caminho: readonly Ponto[], passo: number): Passo[] {
  const saida: Passo[] = []
  let sobra = 0
  for (let i = 1; i < caminho.length; i += 1) {
    const [ax, ay] = caminho[i - 1]
    const [bx, by] = caminho[i]
    const comp = Math.hypot(bx - ax, by - ay) || 1
    const ang = Math.atan2(by - ay, bx - ax)
    let t = sobra
    for (; t <= comp; t += passo) saida.push({ x: ax + ((bx - ax) * t) / comp, y: ay + ((by - ay) * t) / comp, ang })
    sobra = t - comp
  }
  return saida
}

/** A costela que sai de `p` para o lado `lado`: abre até `larg`, volta um pouco e cai para os pés; `ate` = quanto do arco sobrou. */
function costela(p: Passo, lado: number, larg: number, ate: number): Ponto[] {
  const co = Math.cos(p.ang)
  const si = Math.sin(p.ang)
  const pontos: Ponto[] = []
  for (let i = 0; i <= PASSOS_DA_COSTELA; i += 1) {
    const s = (i / PASSOS_DA_COSTELA) * ate
    const u = QUEDA_DA_COSTELA * larg * s * s
    const v = lado * larg * Math.sin(s * ABERTURA_DA_COSTELA)
    pontos.push([p.x + u * co - v * si, p.y + u * si + v * co])
  }
  return pontos
}

function montarTronco(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const vertebras = aoLongo(ESPINHA.map(([x, y]) => em(x, y)), PASSO_DA_VERTEBRA * k)
  const r = RAIO_DA_COSTELA * k
  // As costelas por baixo da coluna: a raiz de cada uma some debaixo da vértebra.
  for (const [k0, [indice, larg, emCima, embaixo]] of COSTELAS.entries()) {
    const p = vertebras[indice]
    if (p === undefined) continue
    porOsso(c, cena, cadeia(costela(p, -1, larg * k, emCima), r), r, 4300 + k0 * 2, 0.96 + 0.08 * hash(k0, 1, 99))
    porOsso(c, cena, cadeia(costela(p, 1, larg * k, embaixo), r), r, 4301 + k0 * 2, 0.92 + 0.08 * hash(k0, 2, 99))
  }
  vertebras.forEach((p, i) => {
    if (VERTEBRAS_AUSENTES.includes(i)) return
    const grande = i >= PRIMEIRA_LOMBAR ? 1.16 : 1
    porOsso(c, cena, elipseGirada(p.x, p.y, 1.22 * k * grande, 1.8 * k * grande, p.ang), 1.1 * k, 4320 + i, 0.98 + 0.08 * hash(i, 4, 99))
  })
}

/** A bacia: onde fica, virada no rumo da coluna. */
const BACIA = { x: 19.2, y: 7.8, ang: 0.46 }

function montarBacia(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const [cx, cy] = em(BACIA.x, BACIA.y)
  const noLugar = (f: Forma): Forma => levada(f, cx, cy, BACIA.ang, k)
  // As duas asas abertas para os lados, o sacro no meio e os dois arcos de baixo, cada um com o seu furo.
  const asas = uniao(elipseGirada(-1.6, -4.9, 3.1, 3.9, 0.35), elipseGirada(-1.6, 4.9, 3.1, 3.9, -0.35))
  const arcos = uniao(elipse(3.5, -2.7, 2.8, 2.5), elipse(3.5, 2.7, 2.8, 2.5))
  porOsso(c, cena, noLugar(uniao(uniao(asas, arcos), caixa(-3.4, -2.2, 2.4, 2.2, 1.2))), 1.5 * k, 4340)
  for (const lado of [-1, 1]) porOco(c, cena, noLugar(elipse(3.7, lado * 2.7, 1.45, 1.25)), 4341 + lado)
}

// ---------- o crânio e a mandíbula ----------

/** O crânio: onde fica e o quanto está virado (rolou para o lado); a mandíbula, solta ao lado dele. */
const CRANIO = { x: -30.5, y: -12.5, ang: -0.5 }
const MANDIBULA = { x: -25.5, y: 5.2, ang: 0.6 }
/** As órbitas (meia distância entre elas e a altura) e os dentes de cima (o x de cada um, meia largura e de onde até onde). */
const ORBITAS = 2.75
const ALTURA_DAS_ORBITAS = 0.3
const DENTES: readonly number[] = [-2.75, -1.65, -0.55, 0.55, 1.65, 2.75]
const MEIO_DENTE = 0.45
const DENTE_DE = 6.7
const DENTE_ATE = 9.1
/** A rachadura no alto do crânio. */
const RACHADURA: readonly Ponto[] = [[1.6, -8.6], [0.6, -6.4], [1.9, -4.8], [0.9, -3.1]]

function montarCranio(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const P = c.peca
  const [cx, cy] = em(CRANIO.x, CRANIO.y)
  const noLugar = (f: Forma): Forma => levada(f, cx, cy, CRANIO.ang, k)
  // A caixa do crânio, as maçãs do rosto e o queixo de cima (mais estreito) numa peça só.
  const caixaDoCranio = uniao(elipse(0, -2.2, 6.8, 6.6), caixa(-4.2, 0.4, 4.2, 9.4, 2.2))
  const macas = uniao(elipse(-5.1, 2.4, 1.8, 1.5), elipse(5.1, 2.4, 1.8, 1.5))
  const cranio = noLugar(uniao(caixaDoCranio, macas))
  sombraDoOsso(c, cena, cranio, ALTURA_DO_CRANIO * k, 0.3)
  cena.partes.push(P(cranio, OSSO, { bisel: 3.4 * k, tom: 1.03, contorno: 0.3, textura: texDoOsso, semente: 4401 }))
  for (const lado of [-1, 1]) porOco(c, cena, noLugar(elipseGirada(lado * ORBITAS, ALTURA_DAS_ORBITAS, 2.15, 1.95, lado * 0.3)), 4402 + lado)
  porOco(c, cena, noLugar(poligono([[0, 2.8], [1.3, 5.4], [0, 4.9], [-1.3, 5.4]])), 4404)
  // Os dentes: a faixa escura da boca e, por cima, cada dente (o escuro que sobra entre eles é o vão).
  cena.partes.push(P(noLugar(caixa(DENTES[0] - MEIO_DENTE - 0.3, DENTE_DE - 0.2, -DENTES[0] + MEIO_DENTE + 0.3, DENTE_ATE + 0.2, 0.5)), OCO, { bisel: 0, contorno: 0, semente: 4406 }))
  for (const x of DENTES) cena.partes.push(P(noLugar(caixa(x - MEIO_DENTE, DENTE_DE, x + MEIO_DENTE, DENTE_ATE, 0.3)), OSSO, { bisel: 0.4, tom: 1.06, contorno: 0.2, semente: 4407 }))
  cena.partes.push(P(noLugar(cadeia(RACHADURA, 0.26)), OCO, { bisel: 0, contorno: 0, semente: 4405 }))

  // A mandíbula: o arco em U, aberto para trás, com três riscos de dente na frente.
  const [mx, my] = em(MANDIBULA.x, MANDIBULA.y)
  const naMandibula = (f: Forma): Forma => levada(f, mx, my, MANDIBULA.ang, k)
  const arco = menos(menos(elipse(0, 0, 4.8, 5.2), elipse(0, -1.4, 3.1, 4.6)), caixa(-6, -7, 6, -2.4))
  porOsso(c, cena, naMandibula(arco), 1.2 * k, 4410, 0.97)
  for (const x of [-1.3, 0, 1.3]) cena.partes.push(P(naMandibula(capsula(x, 3.5, x, 5, 0.22)), OCO, { bisel: 0, contorno: 0, semente: 4411 }))
}

export const montarOssos: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DO_DESENHO
  const sy = c.h / ALTURA_DO_DESENHO
  const regua: Regua = { em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) }
  cena.corDoPiso = ESCURO_DO_OSSO
  montarPoPorBaixo(c, cena)
  montarMiudo(c, cena, regua)
  montarOssosCompridos(c, cena, regua, BRACOS, 4500)
  montarOssosCompridos(c, cena, regua, PERNAS, 4520)
  montarTronco(c, cena, regua)
  montarBacia(c, cena, regua)
  montarOssosCompridos(c, cena, regua, FEMURES, 4540)
  montarCranio(c, cena, regua)
  montarPoPorCima(c, cena, regua)
}
