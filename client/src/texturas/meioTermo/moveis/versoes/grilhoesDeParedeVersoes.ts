/**
 * As VERSÕES dos grilhões de parede (lote L02 do plano de arte por tema, 28/11/2026): a 1ª, Vazios, é o desenho de
 * `MONTADORES` (as algemas abertas no chão); a 2ª, COM ESQUELETO, é o prisioneiro que ninguém soltou.
 *
 * O ferro é o mesmo do tipo base (as chapas chumbadas, os olhais, as argolas e os elos de `../corrente.ts`, nas mesmas
 * medidas), mas as algemas estão FECHADAS em volta dos pulsos e a corrente é curta, de um ou dois elos: os braços
 * ficaram presos para cima. O esqueleto está sentado no chão, de costas na parede (a beira de cima da pegada): o
 * CRÂNIO encostado nela, de cara para o alto, com a MANDÍBULA caída no peito; a COLUNA e as COSTELAS em arco descendo
 * até a BACIA; os dois BRAÇOS abertos até as algemas (o úmero e os dois ossos do antebraço), com os ossinhos da mão
 * saindo do outro lado do ferro; uma perna dobrada (o joelho para cima, a canela curta vista do alto) e a outra
 * esticada para o lado. Por baixo, a mancha de pó; por cima, dois montinhos dele.
 *
 * O osso é o dos outros esqueletos do app (`../ossos.ts`, `../nichoFunerario.ts`): o marfim velho `#d2c6aa`, as
 * manchas de tempo, o oco escuro `#54473a`, a sombra curta desgirada para cair para baixo à direita na tela. O tipo
 * base não lê material e esta versão também não (o ferro e o osso são fixos). A 3/4 é a do tipo (rente ao chão).
 */
import type { VersoesDesenhadas } from '.'
import { hash, type Rgb } from '../../../ruido'
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from '../formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Textura } from '../motor'
import { G, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { algemaAberta, montarAlgema } from '../grilhoesDeParede'
import { elosAoLongo, texDoElo } from '../corrente'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, rebite, texFerroGasto } from '../cadeiraDeFerro'

// ---------- o ferro (as medidas do tipo base, `../grilhoesDeParede.ts`) ----------

const MEIA_FRENTE = 0.5 * G
const MEIO_FUNDO = 0.25 * G
const CHAPA = { meia: 5, fundo: 3.8 } as const
const PARAFUSO = { afasta: 3.2, raio: 0.95 } as const
const OLHAL = { y: 4.2, rx: 1.55, ry: 1.15, rxD: 0.75, ryD: 0.5 } as const
const ARGOLA = { y: 7.7, rx: 3.9, ry: 2.7, rxD: 2.4, ryD: 1.45 } as const
const PASSO_DOS_ELOS = 4.6
/** A algema fechada no pulso: menor que a aberta do chão (5,25), para o pulso de osso não sumir dentro dela. */
const RAIO_DA_ALGEMA = 3.5
const FAIXA_DA_ALGEMA = 2
const MANCHA_DE_FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x52, 0x40] }

/** Cada conjunto: o meio da chapa ao longo da parede, o meio da algema (o pulso) e o cotovelo, em px da pegada de partida. */
interface Braco {
  readonly x: number
  readonly pulso: Ponto
  readonly cotovelo: Ponto
  readonly ombro: Ponto
  /** Para onde os ossinhos da mão caem, a partir do pulso. */
  readonly mao: Ponto
}

const BRACOS: readonly Braco[] = [
  { x: -13.4, pulso: [-20.4, -0.6], cotovelo: [-13.6, 4.4], ombro: [-7.4, -6.4], mao: [-0.55, 0.84] },
  { x: 13, pulso: [20, -1.4], cotovelo: [13.2, 3.8], ombro: [7.6, -6.6], mao: [0.62, 0.78] },
]

// ---------- o osso (os tons de `../ossos.ts`) ----------

const TOM_DO_OSSO: Rgb = [0xd2, 0xc6, 0xaa]
const MANCHA_DO_OSSO: Rgb = [0xa8, 0x93, 0x70]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x47, 0x3a] }
const PO_DE_BAIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x90, 0x81, 0x6b] }
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x9a, 0x82] }
/** A altura de um osso deitado, em raios dele, e a do crânio (px de partida): a sombra curta no chão. */
const ALTURA_DO_OSSO = 1.6
const ALTURA_DO_CRANIO = 4.5

const texDoOsso: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.33 + p.su, y * 0.33 + p.sv) * 0.07 + ruido(x * 1.2 + p.sv, y * 1.2) * 0.03
  const suja = ruido(x * 0.12 + p.sv, y * 0.12 + p.su)
  if (suja <= 0.06) return
  const t = Math.min(1, (suja - 0.06) / 0.22) * 0.45
  s[0] += (MANCHA_DO_OSSO[0] - s[0]) * t
  s[1] += (MANCHA_DO_OSSO[1] - s[1]) * t
  s[2] += (MANCHA_DO_OSSO[2] - s[2]) * t
}

const texDoPo: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.08 + ruido(x * 1.7, y * 1.7 + p.sv) * 0.04
  s[5] *= 0.82 + ruido(x * 0.16 + p.sv, y * 0.16 + p.su) * 0.36
}

/** A forma desenhada em volta de (0, 0), aumentada `k`, girada `ang` e levada para (cx, cy) (a de `../ossos.ts`). */
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

/** O deslocamento do desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A sombra curta de um osso de altura `z`: afastada para baixo à direita na tela, sem altura (sobe junto na 3/4). */
function sombraDoOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, z: number, forca = 0.26): void {
  const [dx, dy] = desgirado(SOMBRA_X * z, SOMBRA_Y * z, c.giro)
  const longe: Forma = { b: [forma.b[0] + dx, forma.b[1] + dy, forma.b[2] + dx, forma.b[3] + dy], d: (x, y) => forma.d(x - dx, y - dy) }
  cena.sombras.push({ forma: longe, z: 0, suave: 1, forca }, contato(forma, 0.3))
}

function porOsso(c: ContextoDoMovel, cena: Cena, forma: Forma, r: number, semente: number, tom = 1): void {
  sombraDoOsso(c, cena, forma, r * ALTURA_DO_OSSO)
  cena.partes.push(c.peca(forma, OSSO, { bisel: r * 0.9, tom, contorno: 0.3, textura: texDoOsso, semente }))
}

function porOco(c: ContextoDoMovel, cena: Cena, forma: Forma, semente: number): void {
  cena.partes.push(c.peca(forma, OCO, { bisel: 0.3, contorno: 0, recesso: { k: 0.6, forca: 0.3 }, semente }))
}

/** O osso comprido: a haste e o nó (dois côndilos) em cada ponta, de `de` até `ate`, de raio `r`. */
function ossoComprido([ax, ay]: Ponto, [bx, by]: Ponto, r: number): Forma {
  const comp = Math.hypot(bx - ax, by - ay) || 1
  const condilos = (x: number): Forma => uniao(elipse(x, -r * 0.72, r * 1.12, r * 1.12), elipse(x, r * 0.72, r * 1.12, r * 1.12))
  return levada(uniao(uniao(caixa(0, -r, comp, r, r), condilos(0)), condilos(comp)), ax, ay, Math.atan2(by - ay, bx - ax), 1)
}

/** Os dois ossos do antebraço (rádio e ulna), lado a lado, do cotovelo ao pulso. */
function antebraco(de: Ponto, ate: Ponto, r: number, afasta: number): [Forma, Forma] {
  const ang = Math.atan2(ate[1] - de[1], ate[0] - de[0])
  const [nx, ny] = [-Math.sin(ang) * afasta, Math.cos(ang) * afasta]
  return [ossoComprido([de[0] + nx, de[1] + ny], [ate[0] + nx * 0.6, ate[1] + ny * 0.6], r), ossoComprido([de[0] - nx, de[1] - ny], [ate[0] - nx * 0.6, ate[1] - ny * 0.6], r * 0.82)]
}

// ---------- o tronco: a coluna, as costelas e a bacia ----------

/** A coluna, do pescoço à bacia (px de partida), e o passo das vértebras. */
const ESPINHA: readonly Ponto[] = [[0.2, -5.6], [0.5, -2.2], [0.7, 1.6]]
const PASSO_DA_VERTEBRA = 1.55
/** As costelas: a vértebra de onde cada par sai, a abertura (px de partida) e quanto do arco sobrou de cada lado. */
const COSTELAS: readonly (readonly [number, number, number, number])[] = [
  [0, 4.6, 1, 1],
  [1, 5.8, 1, 1],
  [2, 6.4, 1, 0.62],
  [3, 6.4, 0.8, 1],
  [4, 5.6, 1, 1],
]
const RAIO_DA_COSTELA = 0.55

interface Passo {
  readonly x: number
  readonly y: number
  readonly ang: number
}

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

/** A costela que sai da vértebra `p` para o `lado`: abre até `larg`, volta e cai para os pés (a de `../ossos.ts`). */
function costela(p: Passo, lado: number, larg: number, ate: number): Ponto[] {
  const co = Math.cos(p.ang)
  const si = Math.sin(p.ang)
  const pontos: Ponto[] = []
  for (let i = 0; i <= 8; i += 1) {
    const s = (i / 8) * ate
    const u = 0.5 * larg * s * s
    const v = lado * larg * Math.sin(s * 2)
    pontos.push([p.x + u * co - v * si, p.y + u * si + v * co])
  }
  return pontos
}

// ---------- as pernas e o miúdo ----------

/** As pernas: a esquerda dobrada (o joelho para cima, a canela curta vista do alto), a direita esticada para o lado. */
const FEMURES: readonly (readonly [Ponto, Ponto])[] = [
  [[-2.4, 4.4], [-8.4, 9.8]],
  [[2.8, 4.6], [9.6, 8.4]],
]
const CANELAS: readonly (readonly [Ponto, Ponto, number])[] = [
  [[-8.4, 9.8], [-7.2, 12.6], 0.95],
  [[9.6, 8.4], [17.2, 11.4], 0.95],
  [[10, 9.2], [16.9, 12.2], 0.55],
]
/** Os ossinhos dos pés (de onde até onde). */
const DEDOS_DOS_PES: readonly (readonly [number, number, number, number])[] = [
  [-7.9, 12.9, -8.6, 13.7],
  [-7, 13, -7.2, 13.8],
  [-6.2, 12.8, -5.7, 13.6],
  [17.9, 11.6, 19.8, 11.9],
  [17.8, 12.3, 19.6, 12.8],
  [17.4, 12.8, 19, 13.5],
]
/** Os montinhos de pó por cima (o meio, os raios e o ângulo). */
const MONTES_DE_PO: readonly (readonly [number, number, number, number, number])[] = [
  [3.6, 5.2, 2.6, 1.5, 0.3],
  [15.2, 11.8, 2.2, 1.3, -0.2],
]

export const montarGrilhoesComEsqueleto: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = hw / MEIA_FRENTE
  const sy = hh / MEIO_FUNDO
  const k = Math.min(sx, sy)
  const em = ([x, y]: Ponto): Ponto => [x * sx, y * sy]
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const sombra = (f: Forma, forca: number): void => {
    cena.sombras.push(contato(f, forca))
  }
  const osso = (f: Forma, r: number, semente: number, tom = 1): void => porOsso(c, cena, f, r, semente, tom)

  // ---------- o pó por baixo: a mancha rala e larga e a do meio, mais cheia ----------
  L.push(P(elipse(0, 3.2 * sy, 18 * sx, 9.6 * sy), PO_DE_BAIXO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 3.2 * k, textura: texDoPo, semente: 24800 }))
  L.push(P(elipse(0.6 * sx, 4.2 * sy, 10.5 * sx, 6.4 * sy), PO_DE_BAIXO, { bisel: 0, contorno: 0, tom: 0.94, alfa: 0.44, suave: 2.2 * k, textura: texDoPo, semente: 24801 }))

  // ---------- o ferro da parede: a chapa, os parafusos, o olhal e a argola de cada lado ----------
  const argolas = BRACOS.map((b, n) => {
    const s = 24700 + n * 100
    const x = b.x * sx
    const yArgola = -hh + ARGOLA.y * k
    const chapa = caixa(x - CHAPA.meia * k, -hh, x + CHAPA.meia * k, -hh + CHAPA.fundo * k, 0.8 * k)
    sombra(chapa, 0.32)
    L.push(P(chapa, FERRO_DA_PRISAO, { dx: 0.3 * k, dy: 0.8 * k, tabua: 0, bisel: 0.5 * k, tom: 0.56, contorno: 0.3, semente: s + 1 }))
    L.push(P(chapa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.9 * k, tom: 0.92, metal: 0.34, contorno: 0.28, textura: texFerroGasto(chapa, 1), semente: s + 2 }))
    for (const lado of [-1, 1]) L.push(rebite(P, x + lado * PARAFUSO.afasta * k, -hh + CHAPA.fundo * k * 0.46, PARAFUSO.raio * k, s + 3 + lado, 1.14))
    const olhal = anel(x, -hh + OLHAL.y * k, OLHAL.rx * k, OLHAL.ry * k, OLHAL.rxD * k, OLHAL.ryD * k)
    sombra(olhal, 0.3)
    L.push(P(olhal, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: 1.06, metal: 0.42, contorno: 0.3, semente: s + 5 }))
    const argola = anel(x, yArgola, ARGOLA.rx * k, ARGOLA.ry * k, ARGOLA.rxD * k, ARGOLA.ryD * k)
    sombra(argola, 0.34)
    L.push(P(argola, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7 * k, tom: 1.04, metal: 0.45, contorno: 0.3, textura: texFerroGasto(argola, 0, 0.3), semente: s + 6, projeta: { dist: 0.8 * k, forca: 0.28 } }))
    return [x, yArgola + ARGOLA.ryD * k] as Ponto
  })

  // ---------- o tronco: as costelas por baixo da coluna, as vértebras, a bacia ----------
  const vertebras = aoLongo(ESPINHA.map(em), PASSO_DA_VERTEBRA * k)
  const rc = RAIO_DA_COSTELA * k
  COSTELAS.forEach(([indice, larg, esquerda, direita], i) => {
    const p = vertebras[indice]
    if (p === undefined) return
    osso(cadeia(costela(p, -1, larg * k, esquerda), rc), rc, 24810 + i * 2, 0.96 + 0.08 * hash(i, 1, 248))
    osso(cadeia(costela(p, 1, larg * k, direita), rc), rc, 24811 + i * 2, 0.92 + 0.08 * hash(i, 2, 248))
  })
  vertebras.forEach((p, i) => {
    const grande = i >= vertebras.length - 2 ? 1.14 : 1
    osso(elipseGirada(p.x, p.y, 0.78 * k * grande, 1.1 * k * grande, p.ang), 0.7 * k, 24830 + i, 0.98 + 0.08 * hash(i, 4, 248))
  })
  const [bx, by] = em([0.4, 3.3])
  const naBacia = (f: Forma): Forma => levada(f, bx, by, Math.PI / 2, 0.58 * k)
  const asas = uniao(elipseGirada(-1.6, -4.9, 3.1, 3.9, 0.35), elipseGirada(-1.6, 4.9, 3.1, 3.9, -0.35))
  const arcos = uniao(elipse(3.5, -2.7, 2.8, 2.5), elipse(3.5, 2.7, 2.8, 2.5))
  osso(naBacia(uniao(uniao(asas, arcos), caixa(-3.4, -2.2, 2.4, 2.2, 1.2))), 0.9 * k, 24850)
  for (const lado of [-1, 1]) porOco(c, cena, naBacia(elipse(3.7, lado * 2.7, 1.45, 1.25)), 24851 + lado)

  // ---------- as pernas: os fêmures saem de debaixo da bacia, o joelho e as canelas, os dedos dos pés ----------
  CANELAS.forEach(([de, ate, r], i) => osso(ossoComprido(em(de), em(ate), r * k), r * k, 24860 + i, 0.95 + 0.08 * hash(i, 5, 248)))
  FEMURES.forEach(([de, ate], i) => osso(ossoComprido(em(de), em(ate), 1.15 * k), 1.15 * k, 24870 + i, 0.98 + 0.06 * hash(i, 6, 248)))
  for (const [i, [, joelho]] of FEMURES.entries()) {
    const [jx, jy] = em(joelho)
    osso(elipse(jx + 0.3 * k, jy + 0.2 * k, 1.05 * k, 0.95 * k), 0.9 * k, 24875 + i, 1.06)
  }
  DEDOS_DOS_PES.forEach(([ax, ay, bx2, by2], i) => {
    const [x0, y0] = em([ax, ay])
    const [x1, y1] = em([bx2, by2])
    osso(capsula(x0, y0, x1, y1, 0.42 * k), 0.42 * k, 24880 + i)
  })

  // ---------- os braços: a clavícula, o úmero e o antebraço até o pulso ----------
  const [px, py] = em([0.2, -5.9])
  BRACOS.forEach((b, n) => {
    const ombro = em(b.ombro)
    const cotovelo = em(b.cotovelo)
    const pulso = em(b.pulso)
    osso(capsula(px + (ombro[0] - px) * 0.16, py, ombro[0], ombro[1], 0.5 * k), 0.5 * k, 24900 + n * 10)
    for (const f of antebraco(cotovelo, pulso, 0.6 * k, 0.55 * k)) osso(f, 0.6 * k, 24901 + n * 10)
    osso(ossoComprido(ombro, cotovelo, 0.92 * k), 0.92 * k, 24903 + n * 10, 1.02)
    osso(elipse(ombro[0], ombro[1], 1.25 * k, 1.15 * k), 1 * k, 24904 + n * 10, 1.04)
  })

  // ---------- o crânio encostado na parede, de cara para o alto, e a mandíbula caída no peito ----------
  const [cx, cy] = em([0.5, -9.2])
  const noCranio = (f: Forma): Forma => levada(f, cx, cy, 0.2, 0.52 * k)
  const cranio = noCranio(uniao(uniao(elipse(0, -2.2, 6.8, 6.6), caixa(-4.2, 0.4, 4.2, 9.4, 2.2)), uniao(elipse(-5.1, 2.4, 1.8, 1.5), elipse(5.1, 2.4, 1.8, 1.5))))
  sombraDoOsso(c, cena, cranio, ALTURA_DO_CRANIO * k, 0.3)
  L.push(P(cranio, OSSO, { bisel: 1.9 * k, tom: 1.04, contorno: 0.3, textura: texDoOsso, semente: 24920 }))
  for (const lado of [-1, 1]) porOco(c, cena, noCranio(elipseGirada(lado * 2.75, 0.3, 2.15, 1.95, lado * 0.3)), 24921 + lado)
  porOco(c, cena, noCranio(poligono([[0, 2.8], [1.3, 5.4], [0, 4.9], [-1.3, 5.4]])), 24923)
  L.push(P(noCranio(caixa(-3.5, 6.5, 3.5, 9.3, 0.5)), OCO, { bisel: 0, contorno: 0, semente: 24924 }))
  for (const x of [-2.75, -1.65, -0.55, 0.55, 1.65, 2.75]) L.push(P(noCranio(caixa(x - 0.45, 6.7, x + 0.45, 9.1, 0.3)), OSSO, { bisel: 0.3, tom: 1.06, contorno: 0.2, semente: 24925 }))
  const [mx, my] = em([1.4, -2.9])
  const naMandibula = (f: Forma): Forma => levada(f, mx, my, 0.35, 0.5 * k)
  osso(naMandibula(menos(menos(elipse(0, 0, 4.8, 5.2), elipse(0, -1.4, 3.1, 4.6)), caixa(-6, -7, 6, -2.4))), 0.6 * k, 24930, 0.97)

  // ---------- as algemas fechadas nos pulsos, a corrente curta até a argola e a mão saindo do ferro ----------
  BRACOS.forEach((b, n) => {
    const s = 24940 + n * 100
    const [wx, wy] = em(b.pulso)
    const [ax, ay] = argolas[n]
    const rumo = Math.atan2(ay - wy, ax - wx)
    const algema = algemaAberta(wx, wy, RAIO_DA_ALGEMA * k, FAIXA_DA_ALGEMA * k, rumo, 0)
    const meio: Ponto = [(ax + algema.saida[0]) / 2 + 0.4 * k * Math.sign(b.x), (ay + algema.saida[1]) / 2 + 0.9 * k]
    const elos = elosAoLongo([[ax, ay], meio, algema.saida], PASSO_DOS_ELOS * k, false)
    // A ferrugem que escorreu no chão debaixo do pulso.
    L.push(P(elipse(wx, wy + 2.2 * k, 4.2 * k, 2.6 * k), MANCHA_DE_FERRUGEM, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.36, suave: 1.6 * k, semente: s }))
    montarAlgema(P, L, sombra, algema, FAIXA_DA_ALGEMA * k, s + 10)
    elos.filter((e) => e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.32)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.12, tom: 0.98, metal: 0.45, contorno: 0.3, textura: texDoElo(e, 0.8), semente: s + 30 + i }))
    })
    elos.filter((e) => !e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.36)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.17, tom: 1.08, metal: 0.5, contorno: 0.3, textura: texDoElo(e, 0.65), semente: s + 60 + i }))
    })
    // A mão pendurada do lado de fora da algema: o punhado dos ossinhos do pulso e quatro dedos curvos (o osso da
    // palma e a falange dobrada para dentro), juntos, não em leque.
    const [dx, dy] = b.mao
    const rumoDaMao = Math.atan2(dy, dx)
    const base = RAIO_DA_ALGEMA * k * 0.9
    const [qx, qy] = [wx + Math.cos(rumoDaMao) * base, wy + Math.sin(rumoDaMao) * base]
    osso(elipseGirada(qx, qy, 1.2 * k, 0.9 * k, rumoDaMao), 0.7 * k, s + 79)
    const curva = Math.sign(b.x) * -0.5
    for (let d = 0; d < 4; d += 1) {
      const a = rumoDaMao + (d - 1.5) * 0.2
      const palma = (1.9 + 0.4 * hash(d, n, 249)) * k
      const falange = (1.4 + 0.3 * hash(d, n, 250)) * k
      const x0 = qx + Math.cos(a) * 0.6 * k
      const y0 = qy + Math.sin(a) * 0.6 * k
      const x1 = x0 + Math.cos(a) * palma
      const y1 = y0 + Math.sin(a) * palma
      osso(capsula(x0, y0, x1, y1, 0.36 * k), 0.36 * k, s + 80 + d)
      osso(capsula(x1, y1, x1 + Math.cos(a + curva) * falange, y1 + Math.sin(a + curva) * falange, 0.3 * k), 0.3 * k, s + 84 + d)
    }
  })

  // ---------- os montinhos de pó por cima ----------
  MONTES_DE_PO.forEach(([x, y, rx, ry, ang], i) => {
    const [ox, oy] = em([x, y])
    L.push(P(elipseGirada(ox, oy, rx * k, ry * k, ang), PO, { bisel: 0, contorno: 0, tom: 1.04, alfa: 0.9, suave: 1.4 * k, textura: texDoPo, semente: 24990 + i }))
  })
}

export const versoesDoGrilhoesDeParede: VersoesDesenhadas = {
  comEsqueleto: montarGrilhoesComEsqueleto,
}
