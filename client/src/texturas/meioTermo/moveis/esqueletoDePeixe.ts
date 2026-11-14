/**
 * ESQUELETO DE PEIXE GIGANTE de cima com volume (lote L08 dos objetos de 14/11/2026, grupo Mar e piratas; pedido
 * do mestre: "esqueleto de peixe gigante"). O que sobrou de um monstro do mar que a maré jogou na praia, deitado
 * de lado, de cabeça para a direita: o CRÂNIO grande de perfil (a órbita funda, a narina, a tampa da guelra em
 * arco e a BOCA aberta, com os dentes em ponta em cima e embaixo), a COLUNA de vértebras em contas, que afinam até
 * o rabo, as COSTELAS compridas da barriga curvadas para trás, os ESPINHOS de cima, mais curtos, e a NADADEIRA do
 * rabo aberta em forquilha, raio por raio. Por cima, as algas secas presas nas costelas e as cracas no crânio; em
 * volta, duas costelas soltas e uma vértebra que rolou, e os montinhos de areia que enterram um pedaço.
 *
 * A 25% de zoom sobra o pente das costelas em volta do risco das contas, a cabeça grande com o olho escuro e o
 * rabo em V: é o desenho de espinha de peixe que todo mundo conhece, e não os ossos de gente (o crânio redondo,
 * os ossos compridos com nó). O osso é velho e queimado de sol (marfim acinzentado), nunca branco puro.
 *
 * O desenho é feito em 168 x 70 px (3 x 1,25 casas): as posições saem de frações da pegada (esticado, o peixe
 * estica) e o que é redondo (os raios, a órbita, as contas), do menor lado. Como os ossos, o esqueleto é rente ao
 * chão: na 3/4 sobe inteiro a espessura de um osso (derivado com `alturaSolta` de 0,04 casa), e nenhuma sombra
 * daqui tem altura: a sombra de cada osso é pintada afastada para baixo à direita, e lê o `giro` para continuar
 * caindo para esse lado na tela. Escreve `cena.corDoPiso` (o escuro do osso, como os ossos). Sem material.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O tamanho em que o esqueleto é desenhado (px do protótipo): 3 x 1,25 casas. */
const LARGURA_DO_DESENHO = 168
const ALTURA_DO_DESENHO = 70

/** O osso velho, queimado de sol, e a mancha de areia e de tempo que ele pega. */
const TOM_DO_OSSO: Rgb = [0xd8, 0xd0, 0xb8]
const MANCHA_DO_OSSO: Rgb = [0xa6, 0x96, 0x78]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
/** O escuro da órbita, da narina, da boca e dos furos. */
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x47, 0x3c] }
/** A areia: a mancha de baixo, mais escura que a lajota e mais cinza que a terra, e os montinhos, mais claros. */
const AREIA_DE_BAIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x92, 0x84, 0x6c] }
const AREIA: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xa4, 0x86] }
/** A alga seca (verde-oliva escuro) e a craca (cinza de pedra). */
const ALGA: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x66, 0x44] }
const CRACA: MaterialDaPeca = { classe: 'liso', rgb: [0xb0, 0xae, 0xa2] }
/** O escuro em que o pixel escuro demais é levantado: o pardo acinzentado dos ossos (com a nogueira a beira sairia avermelhada). */
const ESCURO_DO_OSSO: Rgb = [0x4a, 0x42, 0x3a]

/** A mancha no osso: a partir de quanto o ruído vira mancha, a passagem e o quanto ela cobre no miolo. */
const LIMIAR_DA_MANCHA = 0.08
const BEIRA_DA_MANCHA = 0.2
const MANCHA_CHEIA = 0.4
/** A altura de um osso deitado, em raios dele (a sombra dele é curta), e a do crânio, em px do desenho. */
const ALTURA_DO_OSSO = 1.6
const ALTURA_DO_CRANIO = 9
const BORDA_DA_SOMBRA = 1

/** A coluna: de onde a onde (x do desenho), quantas vértebras, o arco dela e o tamanho da conta na cabeça e no rabo. */
const COLUNA_X0 = -58
const COLUNA_X1 = 40
const VERTEBRAS = 19
const ARCO_DA_COLUNA = 4
const CONTA_NA_CABECA = 1.15
const CONTA_NO_RABO = 0.6
/** As costelas da barriga: quantas, de onde a onde, o comprimento na frente e atrás, e a grossura (px do desenho). */
const COSTELAS = 9
const COSTELAS_X0 = 35
const COSTELAS_X1 = -14
const COSTELA_NA_FRENTE = 28
const COSTELA_ATRAS = 16
const RAIO_DA_COSTELA = 1.25
/** Os espinhos de cima e os de baixo do rabo: quantos, de onde a onde, os comprimentos e a grossura. */
const ESPINHOS = 14
const ESPINHO_NA_FRENTE = 18
const ESPINHO_ATRAS = 9
const RAIO_DO_ESPINHO = 0.85
const ESPINHOS_DE_BAIXO = 6
/** Os tufos de alga: onde se prendem (px do desenho), o comprimento das fitas e o rumo em que caem (radianos). */
const ALGAS: readonly (readonly [number, number, number, number])[] = [
  [25, 6, 24, 1.75],
  [-5, -7, 15, -1.9],
  [-30, 4, 12, 1.4],
]
/** A costela que falta (a do meio) e a que partiu (fica curta). */
const COSTELA_QUE_FALTA = 5
const COSTELA_PARTIDA = 2

/** O osso: o grão miúdo e as manchas de tempo, cada peça com as suas. */
const texDoOsso: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.33 + p.su, y * 0.33 + p.sv) * 0.07 + ruido(x * 1.2 + p.sv, y * 1.2) * 0.03
  const suja = ruido(x * 0.1 + p.sv, y * 0.1 + p.su)
  if (suja <= LIMIAR_DA_MANCHA) return
  const t = Math.min(1, (suja - LIMIAR_DA_MANCHA) / BEIRA_DA_MANCHA) * MANCHA_CHEIA
  s[0] += (MANCHA_DO_OSSO[0] - s[0]) * t
  s[1] += (MANCHA_DO_OSSO[1] - s[1]) * t
  s[2] += (MANCHA_DO_OSSO[2] - s[2]) * t
}

/** A areia: o grão em duas escalas e a cobertura falhada. */
const texDaAreia: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.08 + ruido(x * 1.7, y * 1.7 + p.sv) * 0.04
  s[5] *= 0.82 + ruido(x * 0.16 + p.sv, y * 0.16 + p.su) * 0.36
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (a conta dos ossos). */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** As medidas do desenho na pegada: o ponto do desenho na pegada e a escala do que é redondo. */
interface Regua {
  readonly em: (x: number, y: number) => Ponto
  readonly k: number
}

/** A sombra de um osso de altura `z`, pintada no chão com altura zero (a 3/4 não faz dele uma coluna). */
function sombraDoOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, forca = 0.26): void {
  const [dx, dy] = desgirado(SOMBRA_X * z, SOMBRA_Y * z, c.giro)
  cena.sombras.push({ forma: afastada(forma, dx, dy), z: 0, suave: BORDA_DA_SOMBRA, forca }, contato(forma, 0.3))
}

function porOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, r: number, semente: number, tom = 1): void {
  sombraDoOsso(c, cena, forma, r * ALTURA_DO_OSSO)
  cena.partes.push(c.peca(forma, OSSO, { bisel: r * 0.9, tom, contorno: 0.3, textura: texDoOsso, semente }))
}

function porOco(c: ContextoDoMovel, cena: Cena, forma: Forma, semente: number): void {
  cena.partes.push(c.peca(forma, OCO, { bisel: 0.4, contorno: 0, recesso: { k: 0.8, forca: 0.3 }, semente }))
}

/** A altura da coluna em x (do desenho): o lombo arqueia um pouco no meio. */
function yDaColuna(x: number): number {
  return 1 - ARCO_DA_COLUNA * Math.sin((Math.PI * (x - COLUNA_X0)) / (COLUNA_X1 - COLUNA_X0))
}

/** Uma costela ou um espinho: sai de (x, y) para `sentido` (1 para baixo, -1 para cima) e curva para o rabo. */
function curva(x: number, y: number, comp: number, sentido: 1 | -1, dobra: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6
    pontos.push([x - comp * dobra * t * t - comp * 0.12 * t, y + sentido * comp * (t - 0.12 * t * t)])
  }
  return pontos
}

/** O contorno irregular de uma mancha: `n` pontos em volta de (cx, cy). */
function mancha(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const k = 0.8 + 0.24 * hash(i, sem, 95)
    pontos.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k])
  }
  return pontos
}

function montarAreiaPorBaixo(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  cena.partes.push(P(poligono(mancha(0, 0, hw * 1.0, hh * 0.96, 22, 1)), AREIA_DE_BAIXO, { bisel: 0, contorno: 0, alfa: 0.4, suave: R * 0.24, textura: texDaAreia, semente: 8400 }))
  cena.partes.push(P(poligono(mancha(hw * 0.04, 0, hw * 0.78, hh * 0.62, 18, 2)), AREIA_DE_BAIXO, { bisel: 0, contorno: 0, tom: 0.94, alfa: 0.46, suave: R * 0.18, textura: texDaAreia, semente: 8401 }))
}

/** O rabo: a placa da base e os raios da forquilha, seis em cada lobo. */
function montarRabo(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const [bx, by] = em(COLUNA_X0 - 3, yDaColuna(COLUNA_X0))
  const lobos: readonly (readonly [Ponto, Ponto])[] = [
    [[-70, -3], [-84, -31]],
    [[-70, 5], [-84, 32]],
  ]
  lobos.forEach(([dentro, ponta], j) => {
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5
      const [ex, ey] = em(dentro[0] + (ponta[0] - dentro[0]) * t, dentro[1] + (ponta[1] - dentro[1]) * t)
      const [mx, my] = [bx + (ex - bx) * 0.55 - 1.2 * k, by + (ey - by) * 0.5]
      porOsso(c, cena, cadeia([[bx, by], [mx, my], [ex, ey]], 0.75 * k), 0.75 * k, 8410 + j * 6 + i, 0.96 + 0.06 * t)
    }
  })
  const placa = poligono([em(-56, -5), em(-66, -9), em(-68, 1), em(-66, 11), em(-56, 7)])
  porOsso(c, cena, placa, 2 * k, 8424)
}

function montarCostelasEEspinhos(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  // Os espinhos de cima, ao longo de quase toda a coluna, mais curtos para o rabo.
  for (let i = 0; i < ESPINHOS; i += 1) {
    const t = i / (ESPINHOS - 1)
    const x = COLUNA_X1 - 2 - t * (COLUNA_X1 - COLUNA_X0 - 8)
    const comp = ESPINHO_NA_FRENTE + (ESPINHO_ATRAS - ESPINHO_NA_FRENTE) * t
    const pontos = curva(x, yDaColuna(x) - 2, comp, -1, 0.5).map(([px, py]) => em(px, py))
    porOsso(c, cena, cadeia(pontos, RAIO_DO_ESPINHO * k), RAIO_DO_ESPINHO * k, 8430 + i, 1.02)
  }
  // Os espinhos de baixo do rabo, depois da barriga.
  for (let i = 0; i < ESPINHOS_DE_BAIXO; i += 1) {
    const t = i / (ESPINHOS_DE_BAIXO - 1)
    const x = COSTELAS_X1 - 7 - t * 30
    const comp = 13 - 5 * t
    const pontos = curva(x, yDaColuna(x) + 2, comp, 1, 0.55).map(([px, py]) => em(px, py))
    porOsso(c, cena, cadeia(pontos, RAIO_DO_ESPINHO * k), RAIO_DO_ESPINHO * k, 8450 + i, 0.98)
  }
  // As costelas da barriga: a do meio caiu, uma partiu no meio.
  for (let i = 0; i < COSTELAS; i += 1) {
    if (i === COSTELA_QUE_FALTA) continue
    const t = i / (COSTELAS - 1)
    const x = COSTELAS_X0 - t * (COSTELAS_X0 - COSTELAS_X1)
    const comp = (COSTELA_NA_FRENTE + (COSTELA_ATRAS - COSTELA_NA_FRENTE) * t) * (i === COSTELA_PARTIDA ? 0.55 : 1)
    const pontos = curva(x, yDaColuna(x) + 2.4, comp, 1, 0.42).map(([px, py]) => em(px, py))
    porOsso(c, cena, cadeia(pontos, RAIO_DA_COSTELA * k), RAIO_DA_COSTELA * k, 8460 + i)
  }
}

/** A coluna: o cordão por baixo e as contas, que afinam até o rabo, cada uma com o furo do meio. */
function montarColuna(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const cordao: Ponto[] = []
  for (let i = 0; i <= 12; i += 1) {
    const x = COLUNA_X0 + ((COLUNA_X1 - COLUNA_X0) * i) / 12
    cordao.push(em(x, yDaColuna(x)))
  }
  porOsso(c, cena, cadeia(cordao, 1.1 * k), 1.1 * k, 8480, 0.86)
  for (let i = 0; i < VERTEBRAS; i += 1) {
    const t = i / (VERTEBRAS - 1)
    const x = COLUNA_X1 - t * (COLUNA_X1 - COLUNA_X0)
    const s = CONTA_NA_CABECA + (CONTA_NO_RABO - CONTA_NA_CABECA) * t
    const [vx, vy] = em(x, yDaColuna(x))
    const conta = elipse(vx, vy, 2.2 * s * k, 3.1 * s * k)
    porOsso(c, cena, conta, 2.2 * s * k, 8490 + i, 1.04)
    if (s > 0.8) porOco(c, cena, elipse(vx, vy, 0.6 * s * k, 0.8 * s * k), 8510 + i)
  }
}

/** O crânio de perfil: a caixa com o maxilar, a mandíbula aberta, os dentes, a órbita, a narina e a guelra. */
function montarCranio(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const P = c.peca
  const mandibula = poligono([em(44, 9), em(56, 8.6), em(70, 7), em(80, 6.6), em(81, 9.2), em(70, 14), em(56, 18.4), em(46, 19.4), em(41, 16)])
  sombraDoOsso(c, cena, mandibula, ALTURA_DO_CRANIO * 0.5 * k)
  // A boca aberta: o escuro entre o maxilar e a mandíbula, com os dentes por cima.
  const boca = poligono([em(50, 3), em(66, 2.2), em(79, 2.4), em(79.5, 7), em(68, 8), em(52, 9.4)])
  cena.partes.push(P(boca, OCO, { bisel: 0, contorno: 0, alfa: 0.86, suave: 0.8 * k, semente: 8520 }))
  cena.partes.push(P(mandibula, OSSO, { bisel: 2.2 * k, contorno: 0.3, tom: 0.96, textura: texDoOsso, semente: 8521 }))
  for (let i = 0; i < 6; i += 1) {
    const x = 54 + i * 4.4
    const alto = 3.4 - i * 0.25
    const dente = poligono([em(x - 1.3, 8.2 - i * 0.24), em(x + 1.3, 8 - i * 0.26), em(x + 0.5, 8 - alto - i * 0.25)])
    cena.partes.push(P(dente, OSSO, { bisel: 0.4 * k, contorno: 0.24, tom: 1.08, textura: texDoOsso, semente: 8522 + i }))
  }
  const cranio = poligono([
    em(41, -15), em(47, -19.6), em(56, -21), em(66, -18.4), em(74, -12.6), em(80, -6.6), em(83, -2.2),
    em(80, 2.4), em(72, 2.8), em(60, 3.6), em(50, 4.6), em(43, 8), em(39.5, 0),
  ])
  sombraDoOsso(c, cena, cranio, ALTURA_DO_CRANIO * k, 0.3)
  cena.partes.push(P(cranio, OSSO, { bisel: 3.4 * k, contorno: 0.3, textura: texDoOsso, semente: 8530 }))
  for (let i = 0; i < 7; i += 1) {
    const x = 52 + i * 4.3
    const alto = 3.8 - i * 0.3
    const dente = poligono([em(x - 1.4, 3.4 - i * 0.12), em(x + 1.4, 3 - i * 0.1), em(x + 0.4, 3.4 + alto - i * 0.1)])
    cena.partes.push(P(dente, OSSO, { bisel: 0.4 * k, contorno: 0.24, tom: 1.1, textura: texDoOsso, semente: 8540 + i }))
  }
  // A tampa da guelra: o arco levantado atrás do olho, com a beira escura de dentro.
  const guelra = cadeia([em(47, -16), em(50.5, -8), em(51.5, 0), em(50, 8), em(46, 14)], 1.6 * k)
  cena.partes.push(P(guelra, OSSO, { bisel: 1.4 * k, contorno: 0.28, tom: 1.08, textura: texDoOsso, projeta: { dist: 1.1 * k, forca: 0.32 }, semente: 8550 }))
  // A órbita funda, a narina e o sulco do focinho.
  porOco(c, cena, elipseGirada(...em(62, -9), 5.6 * k, 5 * k, 0.3), 8551)
  cena.partes.push(P(elipse(...em(60.6, -10.6), 1.6 * k, 1.2 * k), OSSO, { bisel: 0.6 * k, contorno: 0, tom: 0.7, alfa: 0.5, semente: 8552 }))
  porOco(c, cena, elipseGirada(...em(74.5, -6.6), 1.5 * k, 1 * k, 0.6), 8553)
  cena.partes.push(P(cadeia([em(66, -15), em(72, -11), em(77.5, -5)], 0.4 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.45, semente: 8554 }))
  // As cracas no alto da cabeça.
  for (const [i, [x, y, r]] of ([[55, -16, 1.5], [58.6, -17.2, 1.1], [69, -13, 1.2]] as const).entries()) {
    const [cx, cy] = em(x, y)
    cena.partes.push(P(anel(cx, cy, r * k, r * k, r * 0.45 * k, r * 0.45 * k), CRACA, { bisel: 0.5 * k, contorno: 0.26, semente: 8560 + i, projeta: { dist: 0.6 * k, forca: 0.26 } }))
  }
}

/** As algas secas presas nas costelas, a vértebra que rolou, as duas costelas soltas e os montinhos de areia. */
function montarPorCima(c: ContextoDoMovel, cena: Cena, { em, k }: Regua): void {
  const P = c.peca
  // As algas: cada tufo são três fitas finas que caem da costela onde ficaram presas, ondulando, de comprimentos
  // diferentes (uma fita só, grossa e em zigue-zague, parecia um raio verde).
  ALGAS.forEach(([x0, y0, comp, rumo], i) => {
    for (let j = 0; j < 3; j += 1) {
      const pontos: Ponto[] = []
      const fim = comp * (0.6 + 0.4 * hash(j, i, 8571))
      const r = rumo + (j - 1) * 0.28
      for (let t = 0; t <= 1.001; t += 0.125) {
        const onda = Math.sin(t * 7 + j * 2 + i) * 1.6 * t
        pontos.push(em(x0 + Math.cos(r) * fim * t - Math.sin(r) * onda, y0 + Math.sin(r) * fim * t + Math.cos(r) * onda))
      }
      cena.partes.push(P(cadeia(pontos, (0.55 - j * 0.08) * k), ALGA, { bisel: 0.4 * k, contorno: 0.22, alfa: 0.8, tom: 0.9 + 0.12 * j, projeta: { dist: 0.6 * k, forca: 0.26 }, semente: 8570 + i * 3 + j }))
    }
  })
  const soltas: readonly (readonly [number, number, number, number])[] = [
    [10, 30, 14, 0.2],
    [-30, -27, 11, -0.3],
  ]
  // Cada costela solta é uma costela da barriga deitada de lado (girada um quarto de volta, mais `ang`).
  soltas.forEach(([x, y, comp, ang], i) => {
    const a = ang - Math.PI / 2
    const pontos = curva(0, 0, comp, 1, 0.4).map(([px, py]) => em(x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)))
    porOsso(c, cena, cadeia(pontos, RAIO_DA_COSTELA * k), RAIO_DA_COSTELA * k, 8580 + i, 0.98)
  })
  const [vx, vy] = em(-40, 26)
  porOsso(c, cena, elipseGirada(vx, vy, 2.4 * k, 1.8 * k, 0.5), 2 * k, 8585)
  const montes: readonly (readonly [number, number, number, number, number])[] = [
    [-80, 27, 6, 3, 0.4],
    [16, 22, 6.4, 2.6, 0.1],
    [-24, -14, 5, 2.4, -0.3],
    [62, 19, 5, 2.4, 0.2],
  ]
  montes.forEach(([x, y, rx, ry, ang], i) => {
    const [cx, cy] = em(x, y)
    cena.partes.push(P(elipseGirada(cx, cy, rx * k, ry * k, ang), AREIA, { bisel: 0, contorno: 0, tom: 1.04, alfa: 0.94, suave: 2.2 * k, textura: texDaAreia, semente: 8590 + i }))
  })
}

export const montarEsqueletoDePeixe: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DO_DESENHO
  const sy = c.h / ALTURA_DO_DESENHO
  const regua: Regua = { em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) }
  cena.corDoPiso = ESCURO_DO_OSSO
  montarAreiaPorBaixo(c, cena)
  montarRabo(c, cena, regua)
  montarCostelasEEspinhos(c, cena, regua)
  montarColuna(c, cena, regua)
  montarCranio(c, cena, regua)
  montarPorCima(c, cena, regua)
  // A ponta da costela partida, lascada, com o miolo oco à vista.
  const t = COSTELA_PARTIDA / (COSTELAS - 1)
  const x = COSTELAS_X0 - t * (COSTELAS_X0 - COSTELAS_X1)
  const comp = (COSTELA_NA_FRENTE + (COSTELA_ATRAS - COSTELA_NA_FRENTE) * t) * 0.55
  const [px, py] = curva(x, yDaColuna(x) + 2.4, comp, 1, 0.42)[6]
  porOco(c, cena, elipse(...regua.em(px, py), 0.6 * regua.k, 0.6 * regua.k), 8599)
  cena.partes.push(c.peca(capsula(...regua.em(px - 1, py + 1), ...regua.em(px - 2.6, py + 3.4), 0.5 * regua.k), OSSO, { bisel: 0.4 * regua.k, contorno: 0.24, textura: texDoOsso, semente: 8598 }))
}
