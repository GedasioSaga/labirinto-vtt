/**
 * GRADE DE CORREDOR de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a grade
 * do portão com grade levadiça sem a torre): só a fileira de BARRAS de ferro atravessando o vão do corredor, presa nos
 * dois BATENTES chumbados nas paredes. De cima se vê a TRAVESSA do alto, com a PONTA de lança de cada barra furando
 * a travessa, os batentes com os dois chumbadores e, no chão, o sulco onde as barras assentam. O que conta a altura é
 * a SOMBRA: cada barra deita uma faixa comprida no chão e a travessa fecha a escada lá na ponta. Barra a passagem,
 * mas não tapa a visão: entre as barras se vê o chão do outro lado.
 *
 * O que diz "grade" a 25% de zoom é a linha escura pontilhada atravessando o corredor e a sombra em escada no chão.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) cada barra e cada batente é uma coluna da altura da grade e a travessa é um
 * tampo solto no alto, de beirada `ESPESSURA_DA_GRADE_DE_CORREDOR`; as pontas sobem com as barras. O sulco do chão
 * tem o meio num vão entre as barras (`comMeioEm`) e fica no chão.
 *
 * Esticada ao comprido, ganha barras (uma a cada `PASSO_DA_BARRA`), nunca barras mais grossas. Material: `grade` (o
 * ferro). O sulco é fixo.
 */
import type { Rgb } from '../../ruido'
import { caixa, capsula, elipse, poligono, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo) ----------

/** A altura da grade: do chão até o teto baixo do corredor. */
const ALTURA_DA_GRADE = 1.45 * G
/** A beirada da travessa do alto na 3/4 (px). */
export const ESPESSURA_DA_GRADE_DE_CORREDOR = 3.8
/** O passo entre as barras, o raio de cada uma e a meia largura da travessa. */
const PASSO_DA_BARRA = 7
const RAIO_DA_BARRA = 1.35
const MEIA_TRAVESSA = 1.9
/** O batente de cada ponta: o meio lado ao comprido e o de través. */
const BATENTE_AO_COMPRIDO = 2.2
const BATENTE_DE_TRAVES = 3.3
/** A meia largura do sulco no chão e a ponta de lança (meio lado do losango). */
const MEIO_SULCO = 2.7
const PONTA = 2
/** A borda borrada da sombra de cada barra (px): as faixas no chão ficam separadas, como as de uma grade. */
const SUAVE_DA_SOMBRA = 1.7

// ---------- os materiais fixos ----------

const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x30, 0x2c] }
/** O escuro em que o pixel escuro demais é levantado: cinza-ferro frio (com o da nogueira, o ferro saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x40, 0x43, 0x47]

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 decide pela caixa de quem a peça é. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

export const montarGradeDeCorredor: MontarMovel = (c, cena) => {
  const { hw, peca: P } = c
  const ferro = c.m.grade
  const L = cena.partes
  const H = ALTURA_DA_GRADE
  const xb = hw - BATENTE_AO_COMPRIDO - 0.4
  const n = Math.max(3, Math.round((xb * 2) / PASSO_DA_BARRA))
  const barras = Array.from({ length: n - 1 }, (_, i) => -xb + ((i + 1) * xb * 2) / n)
  const travessa = caixa(-xb, -MEIA_TRAVESSA, xb, MEIA_TRAVESSA, 0.8)
  const batentes = [-xb, xb].map((x) => caixa(x - BATENTE_AO_COMPRIDO, -BATENTE_DE_TRAVES, x + BATENTE_AO_COMPRIDO, BATENTE_DE_TRAVES, 0.6))
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- as sombras: cada barra e cada batente (colunas), a travessa no alto (tampo solto) ----------
  // A borda da sombra é curta (`SUAVE_DA_SOMBRA`): com a de sempre (0,09 por px de altura) as faixas das barras se
  // fundiam numa mancha só. Cada barra entra duas vezes: a coluna de força zero só dá a altura da 3/4 (o motor pula
  // a passada) e a faixa no chão já vai arrastada, uma cápsula do pé até a sombra do topo, com z = 0. Arrastada pelo
  // motor, cada barra media a forma 20 vezes por pixel numa caixa quase toda vazia: a grade levava o dobro do teto.
  for (const x of barras) {
    const pe = elipse(x, 0, RAIO_DA_BARRA, RAIO_DA_BARRA)
    const faixa = capsula(x, 0, x + SOMBRA_X * H, SOMBRA_Y * H, RAIO_DA_BARRA)
    cena.sombras.push({ forma: pe, z: H, forca: 0 }, { forma: faixa, z: 0, forca: 0.22, suave: SUAVE_DA_SOMBRA }, contato(pe, 0.3))
  }
  for (const b of batentes) cena.sombras.push({ forma: b, z: H, forca: 0.26, suave: SUAVE_DA_SOMBRA * 1.4 }, contato(b, 0.34))
  cena.sombras.push({ forma: travessa, z: H, solta: true, forca: 0.24, suave: SUAVE_DA_SOMBRA * 1.6 })

  // ---------- o sulco no chão, onde as barras assentam ----------
  const vao = (barras[0] + barras[1]) / 2
  L.push(P(comMeioEm(caixa(-xb, -MEIO_SULCO, xb, MEIO_SULCO, 1), vao, MEIO_SULCO - 0.3), SULCO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.8, semente: 9901 }))

  // ---------- a travessa do alto e as pontas de lança ----------
  L.push(P(travessa, ferro, { tabua: 0, bisel: 1, contorno: 0.32, tom: 0.84, metal: 0.38, semente: 9902, projeta: { dist: 1.2, forca: 0.4 } }))
  barras.forEach((x, i) => {
    const ponta = poligono([[x, -PONTA], [x + PONTA * 0.8, 0], [x, PONTA], [x - PONTA * 0.8, 0]])
    L.push(P(ponta, ferro, { tabua: 0, bisel: 1.1, contorno: 0.34, tom: 1.08, metal: 0.55, semente: 9910 + i, projeta: { dist: 0.9, forca: 0.45 } }))
  })

  // ---------- os batentes e os chumbadores ----------
  batentes.forEach((b, i) => {
    L.push(P(b, ferro, { tabua: 0, bisel: 1, contorno: 0.34, tom: 0.76, metal: 0.35, semente: 9950 + i, projeta: { dist: 1, forca: 0.4 } }))
    const x = i === 0 ? -xb : xb
    for (const y of [-BATENTE_DE_TRAVES * 0.52, BATENTE_DE_TRAVES * 0.52]) {
      L.push(P(elipse(x, y, 0.85, 0.85), ferro, { bisel: 0.6, contorno: 0.3, tom: 1.2, metal: 0.6, semente: 9955 }))
    }
  })
}
