/**
 * CANO de cima com volume (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema
 * Esgotos). O tubo deitado no chão do esgoto, de ferro fundido (ou latão, cobre, inox, ou BARRO cozido), com a luz de
 * través de um cilindro: o lombo claro para o lado da luz (de cima à esquerda), a faixa polida no metal, a barriga
 * escura e a luz que o chão devolve rente à beira de baixo. As JUNTAS dizem "cano" a 25% de zoom: no metal, os
 * FLANGES (o anel mais largo, com as cabeças dos parafusos em cima e as pontas deles saindo da beira); no barro, a
 * BOLSA (a ponta mais larga, onde o cano seguinte entra, com o anel escuro de argamassa). Cada ponta da pegada tem
 * meia junta: dois canos lado a lado fecham o flange duplo (ou a bolsa recebe a ponta lisa do vizinho).
 *
 * As FORMAS (versões no mesmo tipo, `versoes/canoVersoes.ts`): RETO (`montarCano`, a 1ª: estica ao comprido, com uma
 * ABRAÇADEIRA chumbada no chão a cada casa, nunca mais grosso), COTOVELO (`montarCanoCotovelo`: entra pela esquerda e
 * sai por baixo, numa curva de raio longo), JUNÇÃO EM T (`montarCanoJuncaoEmT`: corre de lado a lado e solta o ramal
 * para baixo) e COM VÁLVULA (`montarCanoComValvula`: o corpo bojudo da válvula de gaveta no meio, entre dois flanges,
 * e o VOLANTE de três raios em cima, de tinta vermelha gasta, que deita a sombra no cano). As pontas ficam no meio de
 * cada lado da pegada: em 1 x 1, retos, cotovelos e tês emendam pela grade.
 *
 * O desgaste vem do material: o ferro tem ferrugem escorrendo para a barriga; o latão e o cobre, o verdete; o inox, só
 * as marcas de água; o barro, a umidade escura. Rente ao chão, o filme de limo; embaixo da junta da esquerda, a poça
 * do vazamento.
 *
 * Material: `cano` (o tubo e as juntas). O corpo da válvula e o volante são do mesmo metal (de ferro, no cano de barro);
 * a ferrugem, o verdete, a argamassa, a umidade, o limo, a poça e a tinta são fixos. A grossura sai do menor lado da
 * pegada (o raio é 0,36 do menor meio lado: um palmo e meio de diâmetro em 1 x 1).
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, uniao, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type ClasseDaPeca, type MaterialDaPeca, type Textura } from './motor'
import { G, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo, salvo onde diz) ----------

/** O raio do tubo: fração do menor meio lado da pegada. */
const RAIO_DO_CANO = 0.36
/** O raio do eixo na curva do cotovelo, em raios do tubo (curva longa: o cotovelo de esgoto não dobra seco). */
const RAIO_DA_CURVA = 1.55
/** O flange: o raio (em raios do tubo) e a largura ao longo do tubo; a junta escura entre dois flanges. */
const RAIO_DO_FLANGE = 1.26
const LARGURA_DO_FLANGE = 3.2
const JUNTA_DO_FLANGE = 0.55
/** As cabeças dos parafusos no flange: onde ficam, de través (fração do raio do flange), e o raio delas. */
const PARAFUSOS_DO_FLANGE: readonly number[] = [-0.58, 0.58]
const RAIO_DO_PARAFUSO = 0.95
/** A bolsa do barro: o raio e o comprimento, em raios do tubo. */
const RAIO_DA_BOLSA = 1.2
const COMPRIMENTO_DA_BOLSA = 1.15
/** A abraçadeira do cano reto comprido: uma a cada casa, longe das pontas; a meia largura e o pé que sai do tubo. */
const FOLGA_DA_ABRACADEIRA = 0.6 * G
const MEIA_ABRACADEIRA = 1.2
const PE_DA_ABRACADEIRA = 3.4
/** A válvula: o corpo (meio comprimento e raio de través), o castelo e o volante, em raios do tubo. */
const CORPO_DA_VALVULA = { meio: 1.05, raio: 1.42 } as const
const CASTELO = { meio: 0.62, raio: 0.52 } as const
const VOLANTE = { raio: 1.32, aro: 0.2, cubo: 0.26, raio_do_braco: 0.09 } as const
/** A altura do volante sobre o chão, em raios do tubo: o cano, o castelo e a haste. */
const ALTURA_DO_VOLANTE = 3.6

// ---------- a luz do cilindro (a do motor: de cima à esquerda, 52° acima do chão; a conta do canhão) ----------

const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto a luz muda do lombo às beiras: menos no metal escuro (perto do piso de luz), mais no barro. */
export const FORCA_NO_METAL = 0.62
export const FORCA_NO_BARRO = 0.8
/** A faixa polida do metal (a meia largura) e o brilho dela, em tons de 0 a 255. */
const LARGURA_DO_REFLEXO = 0.15
const REFLEXO_DO_TUBO = 46
const REFLEXO_DO_FLANGE = 60
/** A luz que o chão devolve na barriga, um pouco antes da beira de baixo. */
const LUGAR_DA_LUZ_REBATIDA = 0.76
const LARGURA_DA_LUZ_REBATIDA = 0.14
const LUZ_REBATIDA = 0.1

// ---------- os materiais fixos ----------

/** O ferro da válvula do cano de barro (a válvula de barro não existe). */
const FERRO_DA_VALVULA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.96)) }
/** A abraçadeira: ferro batido, um nada mais escuro que o do cano. */
const FERRO_DA_ABRACADEIRA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.88)) }
/** A tinta do volante: vermelho de óxido apagado, gasta (nunca o vermelho vivo de extintor). */
const TINTA_DO_VOLANTE: MaterialDaPeca = { classe: 'metal', rgb: [0x7a, 0x41, 0x35] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }
const VERDETE: MaterialDaPeca = { classe: 'liso', rgb: [0x5f, 0x7b, 0x69] }
const MARCA_DE_AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x8e, 0x88] }
const UMIDO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2b, 0x27] }
const JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x25, 0x24, 0x23] }
const ARGAMASSA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x73, 0x66] }
const LIMO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x58, 0x33] }
const POCA: MaterialDaPeca = { classe: 'liso', rgb: [0x31, 0x39, 0x34] }
const REFLEXO_DA_POCA: MaterialDaPeca = { classe: 'liso', rgb: [0x88, 0x92, 0x8c] }
/** A sombra pintada do volante: o azul-escuro frio da sombra dos objetos. */
export const SOMBRA_PINTADA: MaterialDaPeca = { classe: 'liso', rgb: [0x1a, 0x1e, 0x26] }
/** O escuro em que o pixel escuro demais é levantado: cinza quente de ferro (com a nogueira, a barriga saía marrom). */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

// ---------- o eixo e o cilindro ----------

export type Segmento = readonly [Ponto, Ponto]

/** Uma ponta do cano na beira da pegada: o ponto, o rumo para DENTRO do cano e se ali fica a bolsa (no barro). */
interface Ponta {
  readonly x: number
  readonly y: number
  readonly dx: number
  readonly dy: number
  readonly bolsa: boolean
}

/** O traçado de uma forma: os caminhos do eixo (cada um vira um tubo) e as pontas. */
interface Tracado {
  readonly caminhos: readonly (readonly Ponto[])[]
  readonly pontas: readonly Ponta[]
}

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function segmentosDe(caminhos: readonly (readonly Ponto[])[]): Segmento[] {
  const lista: Segmento[] = []
  for (const caminho of caminhos) for (let i = 1; i < caminho.length; i += 1) lista.push([caminho[i - 1], caminho[i]])
  return lista
}

/**
 * Onde o ponto está no cilindro: `q` de -1 a 1 de través (0 no lombo) e `k`, a parte da luz que atravessa o tubo
 * naquele trecho. Vale para qualquer rumo (o trecho mais perto manda): o reto, o ramal de pé e cada pedaço da curva.
 */
function noCilindro(segmentos: readonly Segmento[], x: number, y: number, r: number): { q: number; k: number } {
  let melhor = Infinity
  let q = 0
  let k = 0
  for (const [[ax, ay], [bx, by]] of segmentos) {
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy || 1
    const t = limitar(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1)
    const px = ax + t * dx
    const py = ay + t * dy
    const d2 = (x - px) * (x - px) + (y - py) * (y - py)
    if (d2 < melhor) {
      melhor = d2
      const l = Math.sqrt(l2)
      const nx = -dy / l
      const ny = dx / l
      q = ((x - px) * nx + (y - py) * ny) / r
      k = LUZ_X * nx + LUZ_Y * ny
    }
  }
  return { q: limitar(q, -1, 1), k }
}

/**
 * A textura do TUBO deitado (a conta do canhão, num eixo de vários trechos): a luz de través pelo ponto no cilindro,
 * a faixa polida do metal para o lado da luz e a luz rebatida do chão na barriga. Por baixo, a textura do material.
 */
export function texDoTubo(segmentos: readonly Segmento[], r: number, forca: number, reflexo: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const { q, k } = noCilindro(segmentos, x, y, r)
    s[3] += forca * (k * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (reflexo > 0) {
      const lugar = (0.62 * k) / Math.sqrt(k * k + LUZ_Z * LUZ_Z)
      const polido = (q - lugar) / LARGURA_DO_REFLEXO
      const brilho = reflexo * Math.exp(-polido * polido)
      s[0] += brilho
      s[1] += brilho
      s[2] += brilho
      const rebatida = (q + LUGAR_DA_LUZ_REBATIDA * Math.tanh(k / 0.15)) / LARGURA_DA_LUZ_REBATIDA
      s[3] += LUZ_REBATIDA * Math.exp(-rebatida * rebatida)
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** A textura de um DOMO (o corpo da válvula, o cubo do volante): a normal de um elipsoide visto de cima. */
export function texDoDomo(cx: number, cy: number, rx: number, ry: number, forca: number, reflexo: number, classe: ClasseDaPeca): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const qx = (x - cx) / rx
    const qy = (y - cy) / ry
    const dentro = Math.min(1, qx * qx + qy * qy)
    s[3] += forca * (LUZ_X * qx + LUZ_Y * qy + LUZ_Z * (Math.sqrt(1 - dentro) - 1))
    if (reflexo > 0) {
      const bx = (qx + 0.36) / 0.22
      const by = (qy + 0.3) / 0.22
      const brilho = reflexo * Math.exp(-bx * bx - by * by)
      s[0] += brilho
      s[1] += brilho
      s[2] += brilho
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** Um arco do eixo, em pedaços curtos (a curva do cotovelo). */
function arco(cx: number, cy: number, raio: number, de: number, ate: number, pedacos: number): Ponto[] {
  return Array.from({ length: pedacos + 1 }, (_, i): Ponto => {
    const a = de + ((ate - de) * i) / pedacos
    return [cx + Math.cos(a) * raio, cy + Math.sin(a) * raio]
  })
}

/** A caixa entre dois cantos quaisquer. */
function caixaEntre(ax: number, ay: number, bx: number, by: number, raio = 0): Forma {
  return caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), raio)
}

/** O pedaço de tubo que começa na ponta e entra `comprimento` px, com `meia` px de cada lado do eixo. */
function naPonta(p: Ponta, de: number, ate: number, meia: number, raio = 0): Forma {
  const nx = -p.dy * meia
  const ny = p.dx * meia
  return caixaEntre(p.x + p.dx * de + nx, p.y + p.dy * de + ny, p.x + p.dx * ate - nx, p.y + p.dy * ate - ny, raio)
}

/** O ponto `ao` px para dentro da ponta e `de` px de través (para o lado da normal (-dy, dx)). */
function pontoNaPonta(p: Ponta, ao: number, de: number): Ponto {
  return [p.x + p.dx * ao - p.dy * de, p.y + p.dy * ao + p.dx * de]
}

/** O lado da sombra de um trecho com rumo (dx, dy): a normal que foge da luz. */
function ladoDaSombra(dx: number, dy: number): Ponto {
  const k = LUZ_X * -dy + LUZ_Y * dx
  return k <= 0 ? [-dy, dx] : [dy, -dx]
}

/** O desgaste de cada material: ferrugem no ferro, verdete no latão e no cobre, marca de água no inox, umidade no barro. */
function desgasteDo(m: MaterialDaPeca): MaterialDaPeca {
  if (m.classe !== 'metal') return UMIDO
  const [r, gg, b] = m.rgb
  if (r > b * 1.3) return VERDETE
  return (r + gg + b) / 3 > 130 ? MARCA_DE_AGUA : FERRUGEM
}

// ---------- a montagem comum ----------

interface Tubo {
  readonly r: number
  readonly forma: Forma
  readonly segmentos: readonly Segmento[]
  readonly metal: boolean
}

/** O tubo do traçado, com as sombras, a poça do vazamento, o desgaste, o limo e as juntas das pontas. */
function montarTubo(c: ContextoDoMovel, cena: Cena, tracado: Tracado): Tubo {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const mat = c.m.cano
  const metal = mat.classe === 'metal'
  const r = RAIO_DO_CANO * Math.min(hw, hh)
  const pegada = caixa(-hw, -hh, hw, hh)
  const [primeiro, ...outros] = tracado.caminhos.map((caminho) => cadeia(caminho, r))
  const forma = dentroDe(outros.reduce((soma, t) => uniao(soma, t), primeiro), pegada)
  const segmentos = segmentosDe(tracado.caminhos)
  cena.corDoPiso = ESCURO_DO_FERRO
  cena.sombras.push({ forma, z: 2 * r, forca: 0.3 }, contato(forma, 0.34))

  // ---------- a poça do vazamento, embaixo da junta da 1ª ponta (no chão, por baixo do tubo) ----------
  const p0 = tracado.pontas[0]
  const [sx, sy] = ladoDaSombra(p0.dx, p0.dy)
  const ao = LARGURA_DO_FLANGE + 0.1 * G
  const [px, py] = [p0.x + p0.dx * ao + sx * (r + 0.07 * G), p0.y + p0.dy * ao + sy * (r + 0.07 * G)]
  const poca = uniao(elipseGirada(px, py, 0.16 * G, 0.07 * G, Math.atan2(p0.dy, p0.dx)), elipse(px + p0.dx * 0.09 * G, py + p0.dy * 0.09 * G, 0.06 * G, 0.05 * G))
  L.push(P(poca, UMIDO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.6, semente: 12001 }))
  L.push(P(poca, POCA, { bisel: 0, contorno: 0.1, alfa: 0.62, suave: 0.7, semente: 12002 }))
  L.push(P(dentroDe(elipseGirada(px - 0.03 * G, py - 0.012 * G, 0.07 * G, 0.012 * G, Math.atan2(p0.dy, p0.dx)), poca), REFLEXO_DA_POCA, { bisel: 0, contorno: 0, alfa: 0.45, suave: 0.5, semente: 12003 }))

  // ---------- o tubo ----------
  const classe = mat.classe
  L.push(P(forma, mat, { tabua: 0, bisel: 0.8, tom: 1, contorno: 0.3, metal: metal ? 0.22 : 0, textura: texDoTubo(segmentos, r, metal ? FORCA_NO_METAL : FORCA_NO_BARRO, metal ? REFLEXO_DO_TUBO : 0, classe), semente: 12010 }))

  // ---------- o filme de limo rente ao chão (a beira de baixo de cada trecho) e o desgaste escorrendo ----------
  for (const [[ax, ay], [bx, by]] of segmentos) {
    const l = Math.hypot(bx - ax, by - ay) || 1
    const [nx, ny] = ladoDaSombra((bx - ax) / l, (by - ay) / l)
    const fio = capsula(ax + nx * r * 0.9, ay + ny * r * 0.9, bx + nx * r * 0.9, by + ny * r * 0.9, r * 0.14)
    L.push(P(dentroDe(fio, forma), LIMO, { bisel: 0, contorno: 0, alfa: metal ? 0.24 : 0.34, suave: 0.8, semente: 12020 }))
  }
  // O desgaste nasce na junta e escorre para a barriga: uma mancha na raiz e um fio que afina (no barro, só a mancha
  // larga de umidade). Um por ponta, cada um num lugar: dois fios paralelos liam como listra.
  const desgaste = desgasteDo(mat)
  tracado.pontas.forEach((p, i) => {
    const [nx, ny] = ladoDaSombra(p.dx, p.dy)
    const passo = LARGURA_DO_FLANGE + 1.4 + 2.6 * hash(i, 1, 12031)
    const [cx, cy] = pontoNaPonta(p, passo, 0)
    if (!metal) {
      const mancha = elipseGirada(cx + nx * r * 0.45, cy + ny * r * 0.45, r * 0.5, r * 0.36, Math.atan2(ny, nx))
      L.push(P(dentroDe(mancha, forma), desgaste, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.6, semente: 12034 + i }))
      return
    }
    const raiz = elipse(cx + nx * r * 0.05, cy + ny * r * 0.05, 1.5, 1.5)
    const fio = cadeia(
      [
        [cx + nx * r * 0.05, cy + ny * r * 0.05],
        [cx + p.dx * 0.5 + nx * r * 0.5, cy + p.dy * 0.5 + ny * r * 0.5],
        [cx + p.dx * 0.2 + nx * r * 0.95, cy + p.dy * 0.2 + ny * r * 0.95],
      ],
      0.62 + 0.3 * hash(i, 2, 12032),
    )
    L.push(P(dentroDe(uniao(raiz, fio), forma), desgaste, { bisel: 0, contorno: 0, alfa: 0.3 + 0.1 * hash(i, 3, 12033), suave: 0.7, semente: 12034 + i }))
  })

  // ---------- as juntas das pontas: flange no metal, bolsa ou ponta lisa no barro ----------
  tracado.pontas.forEach((p, i) => {
    if (metal) flangeNaPonta(c, cena, p, r, segmentos, mat, 12040 + i * 4)
    else if (p.bolsa) bolsaNaPonta(c, cena, p, r, segmentos, mat, 12060 + i * 4)
    else L.push(P(naPonta(p, 0, 0.5, r * 0.98), JUNTA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3, semente: 12070 + i }))
  })
  return { r, forma, segmentos, metal }
}

/** O flange na ponta: o anel mais largo, a junta escura na beira, as cabeças dos parafusos e as pontas deles. */
function flangeNaPonta(c: ContextoDoMovel, cena: Cena, p: Ponta, r: number, segmentos: readonly Segmento[], mat: MaterialDaPeca, semente: number): void {
  const P = c.peca
  const rf = RAIO_DO_FLANGE * r
  const forma = naPonta(p, 0, LARGURA_DO_FLANGE, rf, 0.8)
  cena.sombras.push(contato(forma, 0.3))
  cena.partes.push(P(forma, mat, { tabua: 0, bisel: 0.7, tom: 0.94, contorno: 0.32, metal: 0.3, textura: texDoTubo(segmentos, rf, FORCA_NO_METAL, REFLEXO_DO_FLANGE, mat.classe), semente, projeta: { dist: 0.9, forca: 0.35, suave: 0.6 } }))
  cena.partes.push(P(naPonta(p, 0, JUNTA_DO_FLANGE, rf), JUNTA, { bisel: 0, contorno: 0, alfa: 0.75, suave: 0.2, semente: semente + 1 }))
  for (const o of PARAFUSOS_DO_FLANGE) {
    const [bx, by] = pontoNaPonta(p, LARGURA_DO_FLANGE * 0.56, o * rf)
    cena.partes.push(P(elipse(bx, by, RAIO_DO_PARAFUSO, RAIO_DO_PARAFUSO), mat, { bisel: 0.6, tom: 1.18, contorno: 0.34, metal: 0.5, semente: semente + 2, projeta: { dist: 0.6, forca: 0.35 } }))
  }
  for (const lado of [-1, 1]) {
    const [bx, by] = pontoNaPonta(p, LARGURA_DO_FLANGE * 0.56, lado * (rf + 0.55))
    cena.partes.push(P(elipse(bx, by, 0.75, 0.75), mat, { bisel: 0.4, tom: 0.86, contorno: 0.34, metal: 0.4, semente: semente + 3 }))
  }
}

/** A bolsa do barro: a ponta mais larga com o ombro redondo, o anel escuro da junta e a argamassa borrada. */
function bolsaNaPonta(c: ContextoDoMovel, cena: Cena, p: Ponta, r: number, segmentos: readonly Segmento[], mat: MaterialDaPeca, semente: number): void {
  const P = c.peca
  const rb = RAIO_DA_BOLSA * r
  const comprimento = COMPRIMENTO_DA_BOLSA * r
  const forma = naPonta(p, 0, comprimento, rb, rb * 0.45)
  cena.sombras.push(contato(forma, 0.3))
  cena.partes.push(P(forma, mat, { tabua: 0, bisel: 0.9, tom: 0.97, contorno: 0.3, textura: texDoTubo(segmentos, rb, FORCA_NO_BARRO, 0, mat.classe), semente, projeta: { dist: 1, forca: 0.32, suave: 0.8 } }))
  cena.partes.push(P(naPonta(p, 0, 0.7, rb), JUNTA, { bisel: 0, contorno: 0, alfa: 0.8, suave: 0.25, semente: semente + 1 }))
  cena.partes.push(P(dentroDe(naPonta(p, 0.5, 1.9, rb * 0.96, 0.4), forma), ARGAMASSA, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.6, semente: semente + 2 }))
}

// ---------- as formas ----------

/** O traçado do RETO: de lado a lado pelo meio, a bolsa na ponta da esquerda. */
function tracadoReto(hw: number): Tracado {
  return {
    caminhos: [
      [
        [-hw, 0],
        [hw, 0],
      ],
    ],
    pontas: [
      { x: -hw, y: 0, dx: 1, dy: 0, bolsa: true },
      { x: hw, y: 0, dx: -1, dy: 0, bolsa: false },
    ],
  }
}

/** RETO (a 1ª forma): o tubo de lado a lado e, no cano comprido, uma abraçadeira a cada casa. */
export const montarCano: MontarMovel = (c, cena) => {
  const { hw, peca: P } = c
  const tubo = montarTubo(c, cena, tracadoReto(hw))
  const r = tubo.r
  for (let k = Math.ceil((-hw + FOLGA_DA_ABRACADEIRA) / G); k * G <= hw - FOLGA_DA_ABRACADEIRA; k += 1) {
    const x = k * G
    for (const lado of [-1, 1]) {
      const y0 = lado * (r + 0.3)
      const y1 = lado * (r + PE_DA_ABRACADEIRA)
      const pe = caixaEntre(x - MEIA_ABRACADEIRA - 0.9, y0, x + MEIA_ABRACADEIRA + 0.9, y1, 0.5)
      cena.sombras.push(contato(pe, 0.3))
      cena.partes.push(P(pe, FERRO_DA_ABRACADEIRA, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.3, metal: 0.3, semente: 12080 + k }))
      cena.partes.push(P(elipse(x, (y0 + y1) / 2 + lado * 0.5, 0.7, 0.7), FERRO_DA_ABRACADEIRA, { bisel: 0.45, tom: 1.2, contorno: 0.32, metal: 0.5, semente: 12081 }))
    }
    const cinta = caixa(x - MEIA_ABRACADEIRA, -r - 0.6, x + MEIA_ABRACADEIRA, r + 0.6, 0.5)
    cena.partes.push(P(cinta, FERRO_DA_ABRACADEIRA, { tabua: 0, bisel: 0.5, tom: 0.95, contorno: 0.32, metal: 0.3, textura: texDoTubo(tubo.segmentos, r + 0.6, FORCA_NO_METAL, REFLEXO_DO_FLANGE * 0.7, 'metal'), semente: 12082 + k, projeta: { dist: 0.7, forca: 0.32 } }))
  }
}

/** COTOVELO: entra pela esquerda e sai por baixo, numa curva de raio longo. */
export const montarCanoCotovelo: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const r = RAIO_DO_CANO * Math.min(hw, hh)
  const rc = Math.min(RAIO_DA_CURVA * r, Math.min(hw, hh) * 0.92)
  const caminho: Ponto[] = [[-hw, 0], ...arco(-rc, rc, rc, -Math.PI / 2, 0, 14), [0, hh]]
  montarTubo(c, cena, {
    caminhos: [caminho],
    pontas: [
      { x: -hw, y: 0, dx: 1, dy: 0, bolsa: true },
      { x: 0, y: hh, dx: 0, dy: -1, bolsa: false },
    ],
  })
}

/** JUNÇÃO EM T: o tubo de lado a lado e o ramal descendo do meio até a beira de baixo. */
export const montarCanoJuncaoEmT: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  montarTubo(c, cena, {
    caminhos: [
      [
        [-hw, 0],
        [hw, 0],
      ],
      [
        [0, 0],
        [0, hh],
      ],
    ],
    pontas: [
      { x: -hw, y: 0, dx: 1, dy: 0, bolsa: true },
      { x: hw, y: 0, dx: -1, dy: 0, bolsa: false },
      { x: 0, y: hh, dx: 0, dy: -1, bolsa: false },
    ],
  })
}

/** COM VÁLVULA: o reto com a válvula de gaveta no meio (o corpo, dois flanges, o castelo) e o volante em cima. */
export const montarCanoComValvula: MontarMovel = (c, cena) => {
  const { hw, peca: P } = c
  const tubo = montarTubo(c, cena, tracadoReto(hw))
  const r = tubo.r
  const ferro = tubo.metal ? c.m.cano : FERRO_DA_VALVULA
  const L = cena.partes

  // O corpo bojudo e os dois flanges dele.
  const meio = CORPO_DA_VALVULA.meio * r
  const raioDoCorpo = CORPO_DA_VALVULA.raio * r
  for (const lado of [-1, 1]) {
    const p: Ponta = { x: lado * (meio + LARGURA_DO_FLANGE * 0.9), y: 0, dx: -lado, dy: 0, bolsa: false }
    flangeNaPonta(c, cena, p, r, tubo.segmentos, ferro, 12100 + (lado + 1))
  }
  const corpo = elipse(0, 0, meio, raioDoCorpo)
  cena.sombras.push({ forma: corpo, z: 2 * raioDoCorpo, forca: 0.3 }, contato(corpo, 0.34))
  L.push(P(corpo, ferro, { tabua: 0, bisel: 0.9, tom: 0.92, contorno: 0.32, metal: 0.25, textura: texDoDomo(0, 0, meio, raioDoCorpo, FORCA_NO_METAL, 40, 'metal'), semente: 12110, projeta: { dist: 1.2, forca: 0.36, suave: 0.8 } }))

  // O castelo (a tampa aparafusada de onde sobe a haste), com os quatro parafusos.
  const cx = CASTELO.meio * r
  const cy = CASTELO.raio * r
  const castelo = caixa(-cx, -cy, cx, cy, 1.2)
  L.push(P(castelo, ferro, { tabua: 0, bisel: 0.8, tom: 1.02, contorno: 0.32, metal: 0.3, semente: 12111, projeta: { dist: 1.4, forca: 0.4, suave: 0.7 } }))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    L.push(P(elipse(sx * (cx - 1.1), sy * (cy - 1.1), 0.7, 0.7), ferro, { bisel: 0.45, tom: 1.22, contorno: 0.34, metal: 0.5, semente: 12112 }))
  }

  // O volante: o aro de tinta gasta, os três braços e o cubo, alto sobre o cano (a sombra cai no cano e no chão).
  const rv = VOLANTE.raio * r
  const aro = anel(0, 0, rv, rv, rv - VOLANTE.aro * r * 1.7, rv - VOLANTE.aro * r * 1.7)
  const bracos = [0, 1, 2].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + 0.35
    return barra(0, 0, Math.cos(a) * (rv - 0.6), Math.sin(a) * (rv - 0.6), VOLANTE.raio_do_braco * r * 2)
  })
  const roda = bracos.reduce((soma, b) => uniao(soma, b), aro)
  // A sombra do volante vai PINTADA no cano e no chão: como sombra solta, a 3/4 derivada a levantava numa coluna
  // cheia do chão até o volante (a haste é fina, não um pilar).
  const z = ALTURA_DO_VOLANTE * r
  L.push(P(roda, SOMBRA_PINTADA, { dx: SOMBRA_X * z, dy: SOMBRA_Y * z, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.1, semente: 12119 }))
  for (const b of bracos) L.push(P(b, ferro, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.32, metal: 0.4, semente: 12120, projeta: { dist: 3.2, forca: 0.34, suave: 0.9 } }))
  L.push(P(aro, TINTA_DO_VOLANTE, { tabua: 0, bisel: 0.8, tom: 1, contorno: 0.34, metal: 0.25, semente: 12121, projeta: { dist: 3.2, forca: 0.36, suave: 0.9 } }))
  // A tinta lascada: o ferro aparecendo em três pontos do aro.
  for (let i = 0; i < 3; i += 1) {
    const a = 0.6 + i * 2.1 + hash(i, 3, 12122) * 0.5
    L.push(P(dentroDe(elipseGirada(Math.cos(a) * rv * 0.92, Math.sin(a) * rv * 0.92, 1.4, 0.8, a + Math.PI / 2), aro), ferro, { bisel: 0, contorno: 0.1, tom: 0.9, metal: 0.3, alfa: 0.85, semente: 12123 + i }))
  }
  const rc = VOLANTE.cubo * r
  L.push(P(elipse(0, 0, rc, rc), ferro, { tabua: 0, bisel: rc, tom: 1, contorno: 0.34, metal: 0.4, textura: texDoDomo(0, 0, rc, rc, FORCA_NO_METAL, 50, 'metal'), semente: 12124, projeta: { dist: 1.2, forca: 0.35 } }))
  L.push(P(elipse(0, 0, rc * 0.35, rc * 0.35), JUNTA, { bisel: 0, contorno: 0, alfa: 0.7, semente: 12125 }))
}
