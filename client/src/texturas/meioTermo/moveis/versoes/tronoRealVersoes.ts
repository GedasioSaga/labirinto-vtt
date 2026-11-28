/**
 * As VERSÕES do trono (L03 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a 1ª, Real, é o
 * desenho de `MONTADORES` (`../tronoReal.ts`). As outras três têm a mesma pegada, as mesmas alturas e os mesmos lugares
 * de material, e mudam de FORMA:
 *
 * - GELO: o corpo talhado em gelo (facetas claras, a fresta branca entre elas e um brilho frio no chanfro), a crista de
 *   lascas de cristal em leque, os postes viram pilares de cristal com a ponta em pirâmide e os braços acabam num cacho
 *   de cristais. A almofada capitonê fica, e a pedra do medalhão é um cristal azul-claro.
 * - OBSIDIANA: o vidro vulcânico escuro, com o reflexo frio nas beiras, menos lascas e mais altas na crista, e a pedra
 *   do medalhão vermelho-brasa.
 * - OSSOS: a armação de madeira coberta de ossos compridos amarrados com tiras de metal, uma fileira de crânios na
 *   crista, um crânio em cada poste e na ponta de cada braço.
 *
 * O que separa as três a 1x: o branco azulado com pontas (gelo), o escuro com pontas (obsidiana) e o creme com as
 * covas escuras dos olhos (ossos). A almofada vermelha continua dizendo "trono".
 *
 * NA 3/4 vale o perfil do trono (derivado, espessura 0): a FACE do espaldar é desenhada de frente e guardada debaixo
 * do assento na vista de cima, a conta de `../tronoReal.ts` (a mesma fresta, a mesma subida). No gelo e na obsidiana a
 * face tem as pontas em cima; nos ossos, os ossos de pé, as tiras e três crânios na beira.
 *
 * Lugares de material (os do trono): `madeira` (só nos ossos: a armação, o assento e a tábua de trás), `almofada` e
 * `metal` (as borlas, o engaste da pedra e, nos ossos, as tiras). No gelo e na obsidiana o corpo é do material da
 * versão e a madeira não aparece.
 */
import { hash, type Rgb } from '../../../ruido'
import { capsula, caixa, elipse, poligono, uniao, type Forma, type Ponto } from '../formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from '../motor'
import { BURACO, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from '../contexto'
import type { VersoesDesenhadas } from '.'

/** As alturas e as medidas do trono de hoje (`../tronoReal.ts`): a versão tem o mesmo corpo. */
const ALTURA_DO_ASSENTO = 0.46
const ALTURA_DOS_BRACOS = 0.74
const ALTURA_DO_ESPALDAR = 1.55
const ALTURA_DOS_POSTES = 1.72
/** Os pilares de cristal passam um pouco dos postes de madeira: a ponta em pirâmide. */
const ALTURA_DOS_CRISTAIS = 1.86
const LADO_DE_PARTIDA = 1.2
const FRESTA = 0.25
const POSTE = 0.17
const BRACO = 0.16
const FUNDO_DO_ESPALDAR = 0.36
const FUNDO_DA_CRISTA = 0.13
const FRENTE_DO_ASSENTO = 0.07

/** O capitonê da almofada, como no trono de hoje. */
const PASSO_DO_CAPITONE = 7
const LUZ_DO_GOMO = 0.34
const LARGURA_DA_COSTURA = 0.09
const FUNDO_DA_COSTURA = 0.12
const RAIO_DO_BOTAO = 1.1
const FUNDO_DO_BOTAO = 0.26
/** De onde vem a luz, no chão (cima à esquerda): a faceta virada para ela clareia. */
const LUZ_X = -0.62
const LUZ_Y = -0.48

/** As facetas do cristal: o passo das células (px do protótipo), a força da luz de cada uma e a largura da fresta clara. */
const FRESTA_DA_FACETA = 0.09

/** As pedras do medalhão: o cristal de gelo (azul-claro, contido) e a brasa da obsidiana (vinho aceso, sem neon). */
const CRISTAL_AZUL: MaterialDaPeca = { classe: 'metal', rgb: [0x9c, 0xc4, 0xd6] }
const BRASA: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x3c, 0x2c] }

/** O osso: o tom do material osso (I0-d), liso, com um grão fino e comprido. */
const TOM_DO_OSSO: Rgb = materialDaPeca('osso').rgb
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }

interface Medidas {
  readonly p: number
  readonly br: number
  readonly yEsp: number
  readonly yCrista: number
  readonly casa: number
  readonly zAssento: number
  readonly zEspaldar: number
}

function medidas(c: ContextoDoMovel): Medidas {
  const { w, h, hh, g } = c
  const casa = g * Math.min(1, Math.min(w, h) / (g * LADO_DE_PARTIDA))
  return {
    p: POSTE * w,
    br: BRACO * w,
    yEsp: -hh + FUNDO_DO_ESPALDAR * h,
    yCrista: -hh + FUNDO_DA_CRISTA * h,
    casa,
    zAssento: casa * ALTURA_DO_ASSENTO,
    zEspaldar: casa * ALTURA_DO_ESPALDAR,
  }
}

function texCapitone(): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const a = (x + y) / PASSO_DO_CAPITONE
    const b = (x - y) / PASSO_DO_CAPITONE
    const fa = a - Math.floor(a) - 0.5
    const fb = b - Math.floor(b) - 0.5
    s[3] += LUZ_DO_GOMO * (LUZ_X * (fa + fb) / 2 + LUZ_Y * (fa - fb) / 2)
    const borda = 0.5 - Math.max(Math.abs(fa), Math.abs(fb))
    if (borda < LARGURA_DA_COSTURA) s[3] -= FUNDO_DA_COSTURA * (1 - borda / LARGURA_DA_COSTURA)
    const canto = Math.hypot(0.5 - Math.abs(fa), 0.5 - Math.abs(fb)) * PASSO_DO_CAPITONE
    if (canto < RAIO_DO_BOTAO) s[3] -= FUNDO_DO_BOTAO * (1 - canto / RAIO_DO_BOTAO)
  }
}

/**
 * O cristal talhado: células (cada uma uma faceta com a sua luz) e a fresta clara entre duas, onde a luz atravessa.
 * `forca` é o quanto as facetas diferem (o gelo é suave; a obsidiana, de fratura viva).
 */
function texFacetas(passo: number, forca: number, luzDaFresta: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const gx = x / passo
    const gy = y / passo
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    let d1 = 9
    let d2 = 9
    let dona = 0.5
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const cx = ix + i + hash(ix + i, iy + j, 171 + p.semente)
        const cy = iy + j + hash(ix + i, iy + j, 293 + p.semente)
        const d = (gx - cx) * (gx - cx) + (gy - cy) * (gy - cy)
        if (d < d1) {
          d2 = d1
          d1 = d
          dona = hash(ix + i, iy + j, 419 + p.semente)
        } else if (d < d2) d2 = d
      }
    }
    const borda = Math.sqrt(d2) - Math.sqrt(d1)
    s[3] += (dona - 0.5) * forca + ruido(x * 0.4, y * 0.4) * 0.03
    if (borda < FRESTA_DA_FACETA) s[3] += luzDaFresta * (1 - borda / FRESTA_DA_FACETA)
  }
}

/** O osso: grão fino ao longo dele e umas manchinhas de tempo. */
function texOsso(): Textura {
  return (u, v, _x, _y, p, s) => {
    s[3] += ruido(u * 0.08 + p.semente, v * 0.9) * 0.05 + ruido(u * 0.5, v * 0.5 + p.semente) * 0.035
  }
}

/** A forma guardada da face (a conta de `../tronoReal.ts`): desce `desce` px, com a caixa espelhada em volta de `meio`. */
function guardada(forma: Forma, desce: number, meio: number): Forma {
  const alcance = Math.max(Math.abs(forma.b[1] + desce - meio), Math.abs(forma.b[3] + desce - meio))
  return { b: [forma.b[0], meio - alcance, forma.b[2], meio + alcance], d: (x, y) => forma.d(x, y - desce) }
}

type NaFace = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

/**
 * Guarda a FACE do espaldar desenhada por `desenhar` (entre `yTopo`, o alto do espaldar na 3/4, e `yBase`, onde o
 * assento a cobre), e põe a fresta no meio do assento: só no giro 0, como no trono de hoje.
 */
function guardarFace(c: ContextoDoMovel, cena: Cena, m: Medidas, desenhar: (naFace: NaFace, x0: number, x1: number, yTopo: number, yBase: number) => void): void {
  if (c.giro !== 0) return
  const { hw, hh, peca: P } = c
  const yTopo = m.yEsp - m.zEspaldar
  const yBase = m.yEsp - m.zAssento
  const subida = (-hh - yTopo + (hh - yBase)) / 2
  const yFresta = (m.yEsp + hh) / 2
  const meio = yFresta + FRESTA / 2
  const naFace: NaFace = (forma, mat, o) => {
    cena.partes.push(P(guardada(forma, subida, meio), mat, o))
  }
  desenhar(naFace, -hw + m.p, hw - m.p, yTopo, yBase)
  cena.sombras.push({ forma: caixa(-hw + m.p + 0.5, yFresta, hw - m.p - 0.5, yFresta + FRESTA), z: subida, solta: true, forca: 0 })
}

/** As alturas do trono: o contato, o espaldar, o assento, os postes (ou cristais) e os braços. */
function sombrasDoTrono(c: ContextoDoMovel, cena: Cena, m: Medidas, alturaDosPostes: number): void {
  const { hw, hh } = c
  cena.sombras.push(
    contato(caixa(-hw, -hh, hw, hh, 1.5), 0.32),
    { forma: caixa(-hw + m.p, -hh, hw - m.p, m.yEsp), z: m.zEspaldar },
    { forma: caixa(-hw + m.br, m.yEsp, hw - m.br, hh), z: m.zAssento },
  )
  for (const x0 of [-hw, hw - m.p]) cena.sombras.push({ forma: caixa(x0, -hh, x0 + m.p, -hh + m.p), z: m.casa * alturaDosPostes })
  for (const x0 of [-hw, hw - m.br]) cena.sombras.push({ forma: caixa(x0, -hh + m.p, x0 + m.br, hh), z: m.casa * ALTURA_DOS_BRACOS })
}

/** O ASSENTO: a caixa (do corpo da versão), a almofada capitonê por cima e as duas borlas de metal. */
function assento(c: ContextoDoMovel, L: Peca[], m: Medidas, corpo: MaterialDaPeca, oCorpo: OpcoesDaPeca, capitone: Textura): void {
  const { hw, hh, h, peca: P } = c
  L.push(P(caixa(-hw + m.br - 1, m.yEsp - 3, hw - m.br + 1, hh, 1.2), corpo, { tabua: 0, bisel: 1.2, tom: 0.9, ...oCorpo, semente: 10 }))
  const yAlmofada = hh - FRENTE_DO_ASSENTO * h
  L.push(P(caixa(-hw + m.br + 0.8, m.yEsp - 1, hw - m.br - 0.8, yAlmofada, 3), c.m.almofada, { bisel: 2.6, contorno: 0.24, textura: capitone, semente: 11, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } }))
  for (const [i, x] of [-hw + m.br + 3.4, hw - m.br - 3.4].entries()) {
    const borla = uniao(elipse(x, yAlmofada - 0.6, 1.3, 1.1), poligono([[x - 1.2, yAlmofada], [x + 1.2, yAlmofada], [x + 1.7, yAlmofada + 3.3], [x - 1.7, yAlmofada + 3.3]]))
    L.push(P(borla, c.m.metal, { bisel: 0.8, contorno: 0.24, semente: 12 + i, projeta: { dist: 0.8, forca: 0.3 } }))
  }
}

// ---------- gelo e obsidiana: o trono de cristal ----------

interface Cristal {
  readonly corpo: MaterialDaPeca
  /** A textura das facetas e o brilho do chanfro. */
  readonly facetas: Textura
  readonly brilho: number
  /** A altura de cada lasca da crista (fração do fundo da crista), da esquerda para a direita. */
  readonly lascas: readonly number[]
  /** A meia base de cada lasca, em fração do passo entre elas (mais de 0,5 = as lascas se encostam). */
  readonly meiaBase: number
  readonly pedra: MaterialDaPeca
  /** O quanto a metade na luz e a metade na sombra de cada lasca diferem. */
  readonly contraste: number
  /** O escuro em que o pixel escuro demais é levantado (ausente = o marrom quente da nogueira, que sujava a obsidiana). */
  readonly piso?: Rgb
}

/**
 * O cristal é LISO (sem o grão de pedra do material): a beirada que a 3/4 pinta com a classe do material saía granito
 * pontilhado. O tom é o do material da versão (I0-d).
 */
function cristalDe(id: 'gelo' | 'obsidiana'): MaterialDaPeca {
  return { classe: 'liso', rgb: materialDaPeca(id).rgb }
}

const GELO: Cristal = {
  corpo: cristalDe('gelo'),
  facetas: texFacetas(8, 0.1, 0.05),
  brilho: 0.32,
  lascas: [0.46, 0.74, 0.58, 1, 0.58, 0.74, 0.46],
  meiaBase: 0.62,
  pedra: CRISTAL_AZUL,
  contraste: 0.16,
}

const OBSIDIANA: Cristal = {
  corpo: cristalDe('obsidiana'),
  facetas: texFacetas(7, 0.15, 0.09),
  brilho: 0.55,
  lascas: [0.62, 0.86, 1, 0.8, 0.56],
  meiaBase: 0.6,
  pedra: BRASA,
  contraste: 0.26,
  piso: [0x4c, 0x49, 0x52],
}

/**
 * Uma lasca de cristal vista do alto, deitada para trás: o triângulo inteiro (com o contorno) e as duas metades por
 * cima, a da esquerda na luz e a da direita na sombra, que é o que faz a aresta do meio.
 */
function lasca(por: NaFace, k: Cristal, base: readonly [Ponto, Ponto], ponta: Ponto, semente: number): void {
  const [a, b] = base
  const meio: Ponto = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  por(poligono([a, ponta, b]), k.corpo, { tabua: 0, bisel: 0.9, contorno: 0.3, metal: k.brilho, textura: k.facetas, semente, projeta: { dist: 1.4, forca: 0.3, suave: 0.8 } })
  por(poligono([a, ponta, meio]), k.corpo, { tabua: 0, bisel: 0, contorno: 0, tom: 1 + k.contraste, textura: k.facetas, semente: semente + 1 })
  por(poligono([meio, ponta, b]), k.corpo, { tabua: 0, bisel: 0, contorno: 0, tom: 1 - k.contraste * 0.7, textura: k.facetas, semente: semente + 2 })
}

/**
 * A ponta de um cristal de seis lados vista do alto: o hexágono (com o contorno) e as seis facetas da pirâmide, cada
 * uma com a luz da direção para onde olha (a de cima à esquerda clara, a de baixo à direita escura).
 */
function pontaDeCristal(c: ContextoDoMovel, L: Peca[], k: Cristal, cx: number, cy: number, r: number, semente: number): void {
  const P = c.peca
  const canto = (i: number): Ponto => {
    const a = (i * Math.PI) / 3 + Math.PI / 6
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const cantos = Array.from({ length: 6 }, (_, i) => canto(i))
  L.push(P(poligono(cantos), k.corpo, { tabua: 0, bisel: r * 0.25, contorno: 0.32, metal: k.brilho, textura: k.facetas, semente, projeta: { dist: 1.3, forca: 0.32, suave: 0.8 } }))
  for (let i = 0; i < 6; i += 1) {
    const am = (i * Math.PI) / 3 + Math.PI / 3
    const voltada = Math.cos(am) * LUZ_X + Math.sin(am) * LUZ_Y
    const tom = 1 + k.contraste * 1.3 * voltada
    L.push(P(poligono([[cx, cy], canto(i), canto(i + 1)]), k.corpo, { tabua: 0, bisel: 0, contorno: 0, tom, textura: k.facetas, semente: semente + 1 + i }))
  }
}

function montarTronoDeCristal(k: Cristal): MontarMovel {
  return (c, cena) => {
    const { w, hw, hh, peca: P } = c
    const L = cena.partes
    const m = medidas(c)
    const capitone = texCapitone()
    const oCorpo: OpcoesDaPeca = { textura: k.facetas, metal: k.brilho, contorno: 0.28 }
    const noChao: NaFace = (forma, mat, o) => {
      L.push(P(forma, mat, o))
    }

    // A FACE do espaldar para a 3/4: a laje de cristal, as lascas de pé por cima (a metade na luz e a na sombra) e a
    // pedra no meio.
    if (k.piso !== undefined) cena.corDoPiso = k.piso
    guardarFace(c, cena, m, (naFace, x0, x1, yTopo, yBase) => {
      const alto = yBase - yTopo
      const n = k.lascas.length
      const yOmbro = yTopo + alto * 0.24
      naFace(caixa(x0, yOmbro, x1, yBase + 2, 1.2), k.corpo, { tabua: 0, bisel: 1.4, tom: 0.9, contorno: 0.28, metal: k.brilho, textura: k.facetas, semente: 50 })
      const passo = (x1 - x0) / n
      const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => k.lascas[a] - k.lascas[b])
      for (const i of ordem) {
        const xc = x0 + passo * (i + 0.5)
        const meia = passo * k.meiaBase * 0.9
        lasca(naFace, k, [[xc - meia, yOmbro + alto * 0.08], [xc + meia, yOmbro + alto * 0.08]], [xc, yOmbro - (yOmbro - yTopo) * k.lascas[i]], 53 + i * 3)
      }
      const ym = yTopo + alto * 0.42
      naFace(elipse(0, ym, 2.6, 3), c.m.metal, { bisel: 1.2, contorno: 0.28, metal: 0.55, semente: 51 })
      naFace(elipse(0, ym, 1.5, 1.9), k.pedra, { bisel: 0.9, contorno: 0.2, metal: 0.7, semente: 52 })
    })

    sombrasDoTrono(c, cena, m, ALTURA_DOS_CRISTAIS)

    // O fundo do espaldar, inteiro (a 3/4 girada varre esta peça) e o ASSENTO.
    L.push(P(caixa(-hw + m.p, -hh, hw - m.p, m.yEsp), k.corpo, { tabua: 0, bisel: 1, tom: 0.84, textura: k.facetas, semente: 9 }))
    assento(c, L, m, k.corpo, oCorpo, capitone)

    // O ESPALDAR de cristal, inclinado: a laje com as facetas e a beira de baixo mais clara, onde a luz atravessa.
    L.push(P(caixa(-hw + m.p * 0.8, m.yCrista - 1, hw - m.p * 0.8, m.yEsp + 1.5, 2), k.corpo, { tabua: 0, bisel: 2.2, tom: 0.96, ...oCorpo, semente: 14 }))
    L.push(P(caixa(-hw + m.p * 1.3, m.yEsp - 2.2, hw - m.p * 1.3, m.yEsp + 0.6, 1), k.corpo, { tabua: 0, bisel: 0.6, tom: 1.14, contorno: 0, textura: k.facetas, semente: 15 }))

    // Os BRAÇOS: o bloco de cristal e o cacho de três cristais na ponta da frente.
    for (const [i, x0] of [-hw, hw - m.br].entries()) {
      const xm = x0 + m.br / 2
      const yPonta = hh - m.br * 0.62
      L.push(P(caixa(x0, -hh + m.p * 0.7, x0 + m.br, yPonta + m.br * 0.2, m.br * 0.3), k.corpo, { tabua: 0, bisel: 1.6, ...oCorpo, semente: 20 + i * 8, projeta: { dist: 1.6, forca: 0.32, suave: 0.8 } }))
      const lado = i === 0 ? -1 : 1
      pontaDeCristal(c, L, k, xm - lado * m.br * 0.18, yPonta - m.br * 0.5, m.br * 0.3, 21 + i * 8 + 100)
      pontaDeCristal(c, L, k, xm, yPonta, m.br * 0.5, 21 + i * 8)
    }

    // Os POSTES viram pilares de cristal, com a ponta em pirâmide.
    for (const [i, x0] of [-hw, hw - m.p].entries()) pontaDeCristal(c, L, k, x0 + m.p / 2, -hh + m.p / 2, m.p * 0.62, 30 + i * 10)

    // A CRISTA: as lascas em leque, deitadas para trás, das de fora para a do meio (a mais alta fica por cima).
    const xa = -hw + m.p - 1
    const xb = hw - m.p + 1
    const n = k.lascas.length
    const passo = (xb - xa) / n
    const yBase = m.yCrista + 1.2
    const yAlto = -hh + 0.3
    const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => k.lascas[a] - k.lascas[b])
    for (const i of ordem) {
      const xc = xa + passo * (i + 0.5)
      const meia = passo * k.meiaBase
      const pende = (xc / hw) * passo * 0.35
      const yPonta = yBase - (yBase - yAlto) * k.lascas[i]
      lasca(noChao, k, [[xc - meia, yBase], [xc + meia, yBase]], [xc + pende, yPonta], 40 + i * 4)
    }
    // O engaste de metal na base da lasca do meio e a pedra dele.
    const rm = Math.max(2, 0.07 * w)
    L.push(P(elipse(0, m.yCrista - 0.5, rm * 1.15, rm), c.m.metal, { bisel: rm * 0.5, contorno: 0.28, metal: 0.55, semente: 70, projeta: { dist: 1, forca: 0.3 } }))
    L.push(P(elipse(0, m.yCrista - 0.5, rm * 0.55, rm * 0.5), k.pedra, { bisel: rm * 0.3, contorno: 0.2, metal: 0.7, semente: 71 }))
  }
}

// ---------- ossos ----------

/** Um osso comprido de (ax, ay) a (bx, by): a haste e as duas cabeças dobradas em cada ponta. */
function ossoComprido(c: ContextoDoMovel, L: Peca[], ax: number, ay: number, bx: number, by: number, r: number, semente: number, tom = 1): void {
  const P = c.peca
  const comp = Math.hypot(bx - ax, by - ay)
  const [ux, uy] = [(bx - ax) / comp, (by - ay) / comp]
  const [nx, ny] = [-uy, ux]
  const cabeca = (x: number, y: number): Forma => uniao(elipse(x + nx * r * 0.72, y + ny * r * 0.72, r * 0.95, r * 0.95), elipse(x - nx * r * 0.72, y - ny * r * 0.72, r * 0.95, r * 0.95))
  const forma = uniao(capsula(ax + ux * r, ay + uy * r, bx - ux * r, by - uy * r, r * 0.62), uniao(cabeca(ax + ux * r * 0.6, ay + uy * r * 0.6), cabeca(bx - ux * r * 0.6, by - uy * r * 0.6)))
  L.push(P(forma, OSSO, { eixo: Math.atan2(uy, ux), tabua: 0, bisel: r * 0.7, contorno: 0.3, tom, textura: texOsso(), semente, projeta: { dist: 0.9, forca: 0.3, suave: 0.6 } }))
}

/** Um crânio visto do alto e um pouco de frente (a cara para baixo na tela): o casco, a cara, as covas e o nariz. */
function cranio(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, r: number, semente: number, tom = 1): void {
  const P = c.peca
  const cabeca = uniao(elipse(cx, cy, r, r * 0.9), elipse(cx, cy + r * 0.52, r * 0.68, r * 0.55))
  L.push(P(cabeca, OSSO, { tabua: 0, bisel: r * 0.55, contorno: 0.32, tom, textura: texOsso(), semente, projeta: { dist: 1.1, forca: 0.32, suave: 0.7 } }))
  for (const [i, lado] of [-1, 1].entries()) {
    L.push(P(elipse(cx + lado * r * 0.37, cy + r * 0.36, r * 0.26, r * 0.23), BURACO, { bisel: 0, contorno: 0.1, recesso: { k: 0.6, forca: 0.3 }, semente: semente + 1 + i }))
  }
  L.push(P(poligono([[cx, cy + r * 0.56], [cx + r * 0.12, cy + r * 0.76], [cx - r * 0.12, cy + r * 0.76]]), BURACO, { bisel: 0, contorno: 0, semente: semente + 3 }))
}

/** A tira de metal que amarra os ossos, de través. */
function tira(c: ContextoDoMovel, L: Peca[], x0: number, x1: number, y: number, semente: number): void {
  L.push(c.peca(caixa(x0, y - 0.9, x1, y + 0.9, 0.5), c.m.metal, { bisel: 0.6, contorno: 0.26, metal: 0.45, semente, projeta: { dist: 0.6, forca: 0.3 } }))
}

const montarTronoDeOssos: MontarMovel = (c, cena) => {
  const { w, hw, hh, peca: P } = c
  const L = cena.partes
  const m = medidas(c)
  const mad = c.m.madeira
  const capitone = texCapitone()

  // A FACE do espaldar para a 3/4: a tábua, os ossos de pé, as duas tiras e três crânios na beira de cima.
  guardarFace(c, cena, m, (naFace, x0, x1, yTopo, yBase) => {
    const alto = yBase - yTopo
    naFace(caixa(x0, yTopo + alto * 0.1, x1, yBase + 2, 1), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.7, contorno: 0.26, semente: 50 })
    const n = 6
    const passo = (x1 - x0 - 2) / n
    for (let i = 0; i < n; i += 1) {
      const x = x0 + 1 + passo * (i + 0.5)
      const r = passo * 0.34
      const forma = uniao(capsula(x, yTopo + alto * 0.16, x, yBase, r * 0.6), uniao(elipse(x - r * 0.6, yTopo + alto * 0.15, r * 0.9, r * 0.9), elipse(x + r * 0.6, yTopo + alto * 0.15, r * 0.9, r * 0.9)))
      naFace(forma, OSSO, { eixo: QUARTO, tabua: 0, bisel: r * 0.6, contorno: 0.3, tom: 0.96, textura: texOsso(), semente: 51 + i })
    }
    for (const [i, f] of [0.42, 0.74].entries()) naFace(caixa(x0 - 0.5, yTopo + alto * f - 0.9, x1 + 0.5, yTopo + alto * f + 0.9, 0.5), c.m.metal, { bisel: 0.6, contorno: 0.26, metal: 0.45, semente: 60 + i })
    for (const [i, [x, r]] of ([[0, 0.13], [-(x1 - x0) * 0.3, 0.1], [(x1 - x0) * 0.3, 0.1]] as const).entries()) {
      const rr = r * w
      const cy = yTopo + rr * 0.6
      naFace(uniao(elipse(x, cy, rr, rr * 0.95), elipse(x, cy + rr * 0.7, rr * 0.7, rr * 0.5)), OSSO, { tabua: 0, bisel: rr * 0.5, contorno: 0.32, textura: texOsso(), semente: 62 + i * 4 })
      for (const lado of [-1, 1]) naFace(elipse(x + lado * rr * 0.38, cy + rr * 0.4, rr * 0.27, rr * 0.25), BURACO, { bisel: 0, contorno: 0.1, semente: 63 + i * 4 })
      naFace(poligono([[x, cy + rr * 0.62], [x + rr * 0.13, cy + rr * 0.86], [x - rr * 0.13, cy + rr * 0.86]]), BURACO, { bisel: 0, contorno: 0, semente: 64 + i * 4 })
    }
  })

  sombrasDoTrono(c, cena, m, ALTURA_DOS_POSTES)

  // A armação de madeira atrás (a 3/4 girada varre esta peça) e o ASSENTO de madeira com a almofada.
  L.push(P(caixa(-hw + m.p, -hh, hw - m.p, m.yEsp), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.78, semente: 9 }))
  assento(c, L, m, mad, {}, capitone)

  // O ESPALDAR: os ossos compridos de pé, lado a lado sobre a tábua escura, e as duas tiras de metal.
  const xa = -hw + m.p * 0.8
  const xb = hw - m.p * 0.8
  L.push(P(caixa(xa, m.yCrista - 1, xb, m.yEsp + 1.5, 1.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.62, contorno: 0.26, semente: 14 }))
  const n = 6
  const passo = (xb - xa - 1.6) / n
  for (let i = 0; i < n; i += 1) {
    const x = xa + 0.8 + passo * (i + 0.5)
    const r = passo * 0.4
    ossoComprido(c, L, x, m.yCrista + r * 0.4, x, m.yEsp + 0.6, r, 80 + i * 2, i % 2 === 0 ? 1 : 0.94)
  }
  for (const [i, f] of [0.38, 0.72].entries()) tira(c, L, xa + 0.4, xb - 0.4, m.yCrista + (m.yEsp - m.yCrista) * f, 96 + i)

  // Os BRAÇOS: dois ossos lado a lado na madeira, a tira perto da ponta e um crânio olhando para a frente.
  for (const [i, x0] of [-hw, hw - m.br].entries()) {
    const yPonta = hh - m.br * 0.56
    L.push(P(caixa(x0 + 0.4, -hh + m.p * 0.7, x0 + m.br - 0.4, yPonta, m.br * 0.3), mad, { eixo: QUARTO, tabua: 0, bisel: 1.2, tom: 0.7, contorno: 0.26, semente: 20 + i * 10 }))
    for (const [j, f] of [0.3, 0.7].entries()) {
      const x = x0 + m.br * f
      ossoComprido(c, L, x, -hh + m.p * 0.9, x, yPonta - m.br * 0.2, m.br * 0.2, 21 + i * 10 + j * 2, j === 0 ? 1.02 : 0.95)
    }
    tira(c, L, x0, x0 + m.br, yPonta - m.br * 0.9, 25 + i * 10)
    cranio(c, L, x0 + m.br / 2, yPonta - m.br * 0.12, m.br * 0.5, 26 + i * 10)
  }

  // Os POSTES: a madeira escura com um crânio em cima.
  for (const [i, x0] of [-hw, hw - m.p].entries()) {
    L.push(P(caixa(x0, -hh, x0 + m.p, -hh + m.p, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, tom: 0.8, semente: 30 + i * 6, projeta: { dist: 1.4, forca: 0.3 } }))
    cranio(c, L, x0 + m.p / 2, -hh + m.p * 0.42, m.p * 0.5, 31 + i * 6)
  }

  // A CRISTA: a régua de madeira e a fileira de crânios, o do meio maior, todos olhando para a frente.
  L.push(P(caixa(-hw + m.p - 1, -hh + 0.6, hw - m.p + 1, m.yCrista, 1), mad, { eixo: 0, tabua: 0, bisel: 1.4, tom: 0.84, contorno: 0.26, semente: 40, projeta: { dist: 2.2, forca: 0.34, suave: 1.2 } }))
  const yc = (-hh + 0.6 + m.yCrista) / 2
  const crista: readonly (readonly [number, number])[] = [[-0.25, 0.085], [0.25, 0.085], [-0.13, 0.095], [0.13, 0.095], [0, 0.12]]
  for (const [i, [fx, fr]] of crista.entries()) cranio(c, L, fx * w, yc + (fr - 0.085) * w * 0.5, fr * w, 42 + i * 4, i === 4 ? 1.04 : 0.97)
}

export const versoesDoTronoReal: VersoesDesenhadas = {
  gelo: montarTronoDeCristal(GELO),
  obsidiana: montarTronoDeCristal(OBSIDIANA),
  ossos: montarTronoDeOssos,
}
