/**
 * TÁBUA DE PREGOS de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): a
 * prancha comprida de tortura, deitada sobre dois CAVALETES baixos. A PRANCHA de duas tábuas grossas, presa nas
 * pontas por CINTAS de ferro e parafusada nos cavaletes; no meio, o CAMPO DE PREGOS de ponta para cima, em fileiras
 * desencontradas, cada ponta com o seu brilho e a sua sombrinha na madeira (uns enferrujados, uns faltando); na
 * cabeceira, as duas ARGOLAS dos pulsos, e nos pés, as duas dos tornozelos, abertas na dobradiça e presas por uma
 * corrente curta a uma chapa. O sangue velho mancha os pregos do meio e pingou no chão.
 *
 * O que diz "tábua de pregos" a 25% de zoom é a prancha comprida pontilhada de claro, com as argolas escuras nas
 * pontas e as pontas dos cavaletes saindo dos lados.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) a prancha é um tampo solto na altura dos cavaletes, de beirada grossa
 * (`ESPESSURA_DA_TABUA_DE_PREGOS`), e cada cavalete, uma coluna; os pregos, as argolas e a mancha sobem com a
 * prancha, e os pingos do chão ficam no chão.
 *
 * Esticada, a prancha e o campo de pregos acompanham a pegada (mais pregos, nunca maiores); as argolas têm o
 * tamanho do menor lado. Materiais: `madeira` (a prancha e os cavaletes) e `ferragens` (os pregos, as cintas, as
 * argolas e as correntes). O sangue velho é fixo.
 */
import { hash } from '../../ruido'
import { capsula, caixa, elipse, elipseGirada, menos, poligono, uniao, type Forma } from './formas'
import { contato, type MaterialDaPeca } from './motor'
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
const CAVALETE = 0.66
const MEIA_TRAVE = 2.3
/** O campo de pregos: até onde vai ao comprido (fração), a margem dos lados (px) e o passo (px). */
const CAMPO = 0.62
const MARGEM_DO_CAMPO = 3.3
const PASSO_DO_PREGO = 4.3
const PASSO_DA_FILEIRA = 3.5
/** O menor lado da pegada de partida (0,75 casa): as argolas são medidas nele. */
const LADO_DE_PARTIDA = 0.75 * G

// ---------- os materiais fixos ----------

const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x27, 0x23] }
const SANGUE_SECO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x40, 0x34] }

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

  // ---------- as sombras: a prancha no alto e os cavaletes (colunas) ----------
  cena.sombras.push({ forma: prancha, z: ALTURA_DA_PRANCHA, solta: true, forca: 0.3 })
  for (const x of xsCavaletes) {
    const trave = caixa(x - MEIA_TRAVE, -hh + 1.4, x + MEIA_TRAVE, hh - 1.4, 0.6)
    cena.sombras.push({ forma: trave, z: ALTURA_DA_PRANCHA, forca: 0.3 })
    for (const sy of [-1, 1]) cena.sombras.push(contato(caixa(x - MEIA_TRAVE - 0.6, sy * (hh - 1.4) - 1.4, x + MEIA_TRAVE + 0.6, sy * (hh - 1.4) + 1.4, 0.6), 0.36))
  }

  // ---------- no chão: os pés dos cavaletes saindo dos lados e os pingos de sangue ----------
  xsCavaletes.forEach((x, i) => {
    for (const sy of [-1, 1]) {
      const pe = caixa(x - MEIA_TRAVE, sy < 0 ? -hh + 1.4 : py - 1, x + MEIA_TRAVE, sy < 0 ? -py + 1 : hh - 1.4, 0.6)
      L.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: 1, contorno: 0.32, tom: 0.78, semente: 9601 + i * 2 + (sy + 1) / 2 }))
    }
  })
  for (const [fx, fy, r] of [[-0.1, 1.24, 1.5], [0.06, 1.3, 1], [-0.22, 1.2, 0.8], [0.16, 1.18, 0.7]] as const) {
    L.push(P(elipseGirada(fx * px, fy * py, r * 1.4, r, 0.2), SANGUE_VELHO, { bisel: 0.4, contorno: 0.1, alfa: 0.72, suave: 0.4, semente: 9605 }))
  }

  // ---------- a prancha: duas tábuas ao comprido ----------
  L.push(P(prancha, mad, { tabua: py, bisel: 1.6, contorno: 0.32, tom: 0.92, semente: 9610 }))
  // A mancha de sangue velho no meio (por baixo dos pregos): a seca em volta e a mais escura no meio.
  const mancha = uniao(uniao(elipse(-0.12 * px, 0.1 * py, 0.2 * px, 0.62 * py), elipse(0.08 * px, -0.12 * py, 0.13 * px, 0.48 * py)), elipse(-0.3 * px, 0.32 * py, 0.09 * px, 0.32 * py))
  L.push(P(mancha, SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 2.6, semente: 9611 }))
  L.push(P(elipseGirada(-0.1 * px, 0.06 * py, 0.12 * px, 0.36 * py, 0.15), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.5, suave: 2, semente: 9612 }))

  // ---------- as cintas das pontas e os parafusos dos cavaletes ----------
  for (const lado of [-1, 1]) {
    const x = lado * (px - 3.4)
    L.push(P(caixa(x - 1.8, -py - 0.4, x + 1.8, py + 0.4, 0.4), fer, { eixo: QUARTO, tabua: 0, bisel: 0.7, contorno: 0.32, tom: 0.8, metal: 0.35, semente: 9615 + lado, projeta: { dist: 0.8, forca: 0.4 } }))
    for (const fy of [-0.5, 0.5]) L.push(P(elipse(x, fy * py, 0.85, 0.85), fer, { bisel: 0.6, contorno: 0.28, tom: 1.2, metal: 0.6, semente: 9617 }))
  }
  for (const x of xsCavaletes) {
    for (const sy of [-1, 1]) L.push(P(elipse(x, sy * (py - 2.4), 1.05, 1.05), fer, { bisel: 0.7, contorno: 0.3, tom: 0.9, metal: 0.45, semente: 9618 }))
  }

  // ---------- o campo de pregos: fileiras desencontradas, uns enferrujados, uns faltando ----------
  const cx = CAMPO * px
  const cy = py - MARGEM_DO_CAMPO
  const fileiras = Math.max(2, Math.round((cy * 2) / PASSO_DA_FILEIRA))
  const passoY = (cy * 2) / fileiras
  for (let j = 0; j <= fileiras; j += 1) {
    const y = -cy + j * passoY
    const desloca = j % 2 === 0 ? 0 : PASSO_DO_PREGO / 2
    const n = Math.floor((cx * 2 - desloca) / PASSO_DO_PREGO)
    for (let i = 0; i <= n; i += 1) {
      const h = hash(i, j, 9620)
      if (h < 0.05) continue
      const x = -cx + desloca + i * PASSO_DO_PREGO + (hash(i, j, 9621) - 0.5) * 0.7
      const ferrugem = h > 0.86
      L.push(P(elipse(x, y + (hash(i, j, 9622) - 0.5) * 0.6, 0.82, 0.82), fer, { bisel: 0.8, contorno: 0.3, tom: ferrugem ? 0.74 : 1.12 + hash(i, j, 9623) * 0.12, metal: ferrugem ? 0.2 : 0.6, semente: 9624, projeta: { dist: 1.15, forca: 0.5, suave: 0.5 } }))
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
