/**
 * TÁBUA DE PREGOS de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): a
 * prancha comprida de tortura, deitada sobre dois CAVALETES baixos. A PRANCHA de duas tábuas grossas, presa nas
 * pontas por CINTAS de ferro e parafusada nos cavaletes; no meio, o CAMPO DE PREGOS de ponta para cima numa grade de
 * verdade (todas as fileiras com o mesmo passo, uma sim, uma não deslocada meio passo), cada ponta com o brilho no
 * meio e a sua sombrinha na madeira (uns enferrujados, uns faltando); a cabeceira e os pés ficam livres de pregos,
 * com as duas ARGOLAS dos pulsos e as duas dos tornozelos, abertas na dobradiça e presas por uma corrente curta a uma
 * chapa. O sangue seco cerca os pregos do meio, mais escuro nas pontas deles, e pingou no chão bem na beira.
 *
 * O que diz "tábua de pregos" a 25% de zoom é a prancha comprida pontilhada de claro, com as argolas escuras nas
 * pontas e os pés dos cavaletes saindo dos lados.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) a prancha é um tampo solto na altura dos cavaletes, de beirada grossa
 * (`ESPESSURA_DA_TABUA_DE_PREGOS`), e cada cavalete, uma coluna só debaixo da prancha (dentro da pegada dela); os
 * dois pés de cada cavalete ficam rentes no chão, passando da beira. Os pregos, as argolas e a mancha sobem com a
 * prancha, e os pingos do chão ficam no chão.
 *
 * Esticada, a prancha e o campo de pregos acompanham a pegada (mais pregos, nunca maiores); as argolas têm o
 * tamanho do menor lado. Materiais: `madeira` (a prancha e os cavaletes) e `ferragens` (os pregos, as cintas, as
 * argolas e as correntes). O sangue é fixo.
 */
import { hash } from '../../ruido'
import { capsula, caixa, elipse, elipseGirada, menos, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A altura da prancha (px do protótipo): cavaletes baixos. */
const ALTURA_DA_PRANCHA = 0.34 * G
/** A beirada da prancha na 3/4 (px): a grossura da tábua. */
export const ESPESSURA_DA_TABUA_DE_PREGOS = 0.08 * G
/** A meia largura da prancha (fração da meia altura da pegada) e o quanto ela entra das pontas (px). */
const MEIA_LARGURA = 0.66
const RECUO_DAS_PONTAS = 1.5
/** Os cavaletes: onde ficam (fração do meio comprimento) e a meia grossura da trave (px). */
const CAVALETE = 0.7
const MEIA_TRAVE = 2.3
/**
 * O campo de pregos: até onde vai ao comprido (fração do meio comprimento; a cabeceira e os pés, ~15% de cada
 * ponta, ficam livres para as argolas), a margem dos lados (px), o passo ao comprido e o passo entre fileiras (px).
 */
const CAMPO = 0.64
const MARGEM_DO_CAMPO = 3.4
const PASSO_DO_PREGO = 4.3
const PASSO_DA_FILEIRA = 3.5
/** O prego: o raio da cabeça e o do brilho no meio dela (px). */
const RAIO_DO_PREGO = 0.82
const RAIO_DO_BRILHO = 0.3
/** O menor lado da pegada de partida (0,75 casa): as argolas são medidas nele. */
const LADO_DE_PARTIDA = 0.75 * G

// ---------- os materiais fixos ----------

const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x27, 0x23] }
const SANGUE_SECO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x40, 0x34] }
/** A ponta do prego suja de sangue seco: ferro puxado para o vinho escuro. */
const PONTA_SUJA: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x3c, 0x36] }

/** A argola aberta na dobradiça: o anel com a boca virada para `a`. */
function argolaAberta(cx: number, cy: number, a: number, k: number): Forma {
  const r = 3.1 * k
  const boca = poligono([
    [cx, cy],
    [cx + Math.cos(a - 0.5) * r * 1.6, cy + Math.sin(a - 0.5) * r * 1.6],
    [cx + Math.cos(a + 0.5) * r * 1.6, cy + Math.sin(a + 0.5) * r * 1.6],
  ])
  return menos(menos(elipse(cx, cy, r, r), elipse(cx, cy, r - 1.15 * k, r - 1.15 * k)), boca)
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** O brilho da ponta do prego: um ponto claro de `RAIO_DO_BRILHO` bem no meio da cabeça, sem borrar. */
function texPrego(cx: number, cy: number, forca: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const d = Math.hypot(x - cx, y - cy)
    s[3] += forca * Math.max(0, Math.min(1, (RAIO_DO_BRILHO - d) * escala + 0.5))
  }
}

export const montarTabuaDePregos: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const px = hw - RECUO_DAS_PONTAS
  const py = MEIA_LARGURA * hh
  const prancha = caixa(-px, -py, px, py, 1.6)
  const xsCavaletes = [-CAVALETE * px, CAVALETE * px]
  // O sangue seco dos pregos do meio: lobos tortos, de borda firme (borrado, lia como sombra), descendo até a beira.
  const mx = -0.06 * px
  const mancha = [
    elipseGirada(mx, 0.08 * py, 0.15 * px, 0.5 * py, 0.18),
    elipseGirada(mx + 0.1 * px, -0.22 * py, 0.09 * px, 0.3 * py, -0.5),
    elipseGirada(mx - 0.11 * px, 0.36 * py, 0.08 * px, 0.28 * py, 0.7),
    elipseGirada(mx + 0.05 * px, 0.62 * py, 0.06 * px, 0.36 * py, -0.2),
    elipse(mx - 0.16 * px, -0.3 * py, 0.035 * px, 0.14 * py),
  ].reduce((soma, lobo) => uniao(soma, lobo))

  // ---------- as sombras: a prancha no alto e os cavaletes (colunas só debaixo dela) ----------
  cena.sombras.push({ forma: prancha, z: ALTURA_DA_PRANCHA, solta: true, forca: 0.3 })
  const travessas: Forma[] = []
  for (const x of xsCavaletes) {
    const trave = caixa(x - MEIA_TRAVE, -py + 1, x + MEIA_TRAVE, py - 1, 0.6)
    travessas.push(trave)
    cena.sombras.push({ forma: trave, z: ALTURA_DA_PRANCHA, forca: 0.3 })
    for (const sy of [-1, 1]) cena.sombras.push(contato(caixa(x - MEIA_TRAVE - 0.6, sy * (hh - 1.4) - 1.4, x + MEIA_TRAVE + 0.6, sy * (hh - 1.4) + 1.4, 0.6), 0.36))
  }

  // ---------- no chão: os pés dos cavaletes saindo dos lados e os pingos de sangue na beira ----------
  xsCavaletes.forEach((x, i) => {
    for (const sy of [-1, 1]) {
      const pe = caixa(x - MEIA_TRAVE - 0.4, sy < 0 ? -hh + 1.4 : py - 1, x + MEIA_TRAVE + 0.4, sy < 0 ? -py + 1 : hh - 1.4, 0.6)
      L.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: 1, contorno: 0.32, tom: 0.78, semente: 9601 + i * 2 + (sy + 1) / 2 }))
    }
  })
  // Os pingos: de tamanhos, espaços e formas diferentes (dois compridos), logo abaixo da mancha, rentes à beira.
  const pingos: readonly (readonly [number, number, number, number, number])[] = [
    [mx - 0.02 * px, py + 1.5, 1.6, 1.45, 0],
    [mx + 0.08 * px, py + 0.9, 1.5, 0.6, 0.35],
    [mx - 0.13 * px, py + 2.6, 0.9, 0.85, 0],
    [mx + 0.03 * px, py + 3.4, 0.5, 0.5, 0],
    [mx - 0.2 * px, py + 1.1, 1.1, 0.45, -0.6],
  ]
  L.push(P(elipse(mx - 0.02 * px, py + 1.5, 2.6, 2.1), SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.8, semente: 9604 }))
  for (const [fx, fy, rx, ry, a] of pingos) {
    L.push(P(elipseGirada(fx, fy, rx, ry, a), SANGUE_VELHO, { bisel: 0.3, contorno: 0.1, alfa: 0.78, suave: 0.25, semente: 9605 }))
  }

  // ---------- os cavaletes debaixo da prancha (só na 3/4: de cima, a prancha cobre) e a prancha ----------
  // A peça de madeira dentro de cada coluna dá o material da frente dela na 3/4 (sem ela, a frente sairia de ferro).
  travessas.forEach((t, i) => L.push(P(t, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.3, tom: 0.78, semente: 9606 + i })))
  L.push(P(prancha, mad, { tabua: py, bisel: 1.6, contorno: 0.32, tom: 0.92, semente: 9610 }))
  L.push(P(mancha, SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.46, suave: 0.7, semente: 9611 }))
  L.push(P(elipseGirada(mx + 0.01 * px, 0.12 * py, 0.08 * px, 0.32 * py, 0.18), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.9, semente: 9612 }))

  // ---------- as cintas das pontas e os parafusos dos cavaletes ----------
  for (const lado of [-1, 1]) {
    const x = lado * (px - 3.4)
    L.push(P(caixa(x - 1.8, -py - 0.4, x + 1.8, py + 0.4, 0.4), fer, { eixo: QUARTO, tabua: 0, bisel: 0.7, contorno: 0.32, tom: 0.8, metal: 0.35, semente: 9615 + lado, projeta: { dist: 0.8, forca: 0.4 } }))
    for (const fy of [-0.5, 0.5]) L.push(P(elipse(x, fy * py, 0.85, 0.85), fer, { bisel: 0.6, contorno: 0.28, tom: 1.2, metal: 0.6, semente: 9617 }))
  }
  // Os parafusos sobem com a prancha (o meio da caixa fora da coluna do cavalete, que fica por baixo dela).
  for (const x of xsCavaletes) {
    for (const sy of [-1, 1]) {
      L.push(P(comMeioEm(elipse(x, sy * (py - 2.2), 1.05, 1.05), x + Math.sign(x) * (MEIA_TRAVE + 1.4), sy * (py - 2.2)), fer, { bisel: 0.7, contorno: 0.3, tom: 0.9, metal: 0.45, semente: 9618 }))
    }
  }

  // ---------- o campo de pregos: a grade, uma fileira sim, uma não deslocada meio passo ----------
  const cx = CAMPO * px
  const cy = py - MARGEM_DO_CAMPO
  const colunas = Math.max(2, Math.floor((cx * 2) / PASSO_DO_PREGO))
  const fileiras = Math.max(2, Math.round((cy * 2) / PASSO_DA_FILEIRA))
  const passoY = (cy * 2) / fileiras
  for (let j = 0; j <= fileiras; j += 1) {
    const y = -cy + j * passoY
    const deslocada = j % 2 === 1
    const n = deslocada ? colunas - 1 : colunas
    for (let i = 0; i <= n; i += 1) {
      const h = hash(i, j, 9620)
      if (h < 0.025) continue
      const x = (i - n / 2) * PASSO_DO_PREGO
      const sujo = mancha.d(x, y) < 0.4
      const ferrugem = !sujo && h > 0.9
      if (sujo) L.push(P(elipseGirada(x + 0.3, y + 0.25, 1.5, 1.15, hash(i, j, 9625) * 3), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.35, semente: 9626 }))
      const mat = sujo ? PONTA_SUJA : fer
      const tom = ferrugem ? 0.74 : sujo ? 0.92 : 1.02 + hash(i, j, 9623) * 0.1
      const brilho = ferrugem ? 0 : sujo ? 0.18 : 0.55
      L.push(P(elipse(x, y, RAIO_DO_PREGO, RAIO_DO_PREGO), mat, { textura: texPrego(x, y, brilho), bisel: 0.8, contorno: 0.3, tom, metal: ferrugem ? 0.2 : 0.55, semente: 9624, projeta: { dist: 1.15, forca: 0.5, suave: 0.5 } }))
    }
  }

  // ---------- as argolas: dos pulsos na cabeceira, dos tornozelos nos pés ----------
  const argolas: readonly (readonly [number, number, number])[] = [
    [-px + 8.6 * k, -py + 4.4 * k, -2.2],
    [-px + 8.6 * k, py - 4.4 * k, 2.2],
    [px - 9.2 * k, -3.6 * k, -0.9],
    [px - 9.2 * k, 3.6 * k, 0.9],
  ]
  argolas.forEach(([ax, ay, boca], i) => {
    const lado = ax < 0 ? -1 : 1
    const chapa = caixa(ax + lado * 2.4 * k - 2 * k, ay - 1.6 * k, ax + lado * 2.4 * k + 2 * k, ay + 1.6 * k, 0.5)
    L.push(P(chapa, fer, { tabua: 0, bisel: 0.6, contorno: 0.32, tom: 0.74, metal: 0.3, semente: 9630 + i, projeta: { dist: 0.7, forca: 0.4 } }))
    L.push(P(capsula(ax + lado * 2.2 * k, ay, ax + lado * 0.6 * k, ay, 0.6 * k), fer, { tabua: 0, bisel: 0.4, contorno: 0.32, tom: 0.9, metal: 0.45, semente: 9634 + i }))
    L.push(P(argolaAberta(ax - lado * 1.4 * k, ay, boca, k), fer, { tabua: 0, bisel: 0.7, contorno: 0.34, tom: 0.98, metal: 0.55, semente: 9638 + i, projeta: { dist: 1, forca: 0.45 } }))
  })
}
