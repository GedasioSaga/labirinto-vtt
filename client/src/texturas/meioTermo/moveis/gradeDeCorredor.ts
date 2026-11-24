/**
 * GRADE DE CORREDOR de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a grade
 * do portão com grade levadiça sem a torre): só a fileira de BARRAS de ferro atravessando o vão do corredor, presa nos
 * dois BATENTES grossos chumbados nas paredes. De cima se vê a TRAVESSA do alto, com a CABEÇA redonda de cada barra
 * (uma bola de ferro com o brilho), os batentes com os chumbadores e as CHAPAS DE ANCORAGEM no chão, e o sulco onde as
 * barras assentam. O que conta a altura é a SOMBRA: cada barra deita uma faixa comprida no chão e a travessa fecha a
 * escada lá na ponta. Barra a passagem, mas não tapa a visão: entre as barras se vê o chão do outro lado.
 *
 * O que diz "grade" a 25% de zoom é a linha escura pontilhada atravessando o corredor e a sombra em escada no chão.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) cada barra é de seção quadrada vista pela quina (duas colunas finas lado a
 * lado: a face da esquerda clara, a da direita escura), com a LUVA escura no pé entrando no furo do chão; duas
 * TRAVESSAS rebitadas, a 1/3 e a 2/3 da altura, passam por cima das barras (tampos soltos sem sombra) e a do alto é
 * um tampo solto de beirada grossa (`ESPESSURA_DA_GRADE_DE_CORREDOR`), com as cabeças das barras em cima. As peças
 * que só dão o material de uma estrutura ficam escondidas debaixo da travessa do alto na vista de cima, e as que
 * precisam subir com uma estrutura têm o meio da caixa posto nela (`comMeioEm`); cada travessa do meio tem um pino
 * atrás do batente só para isso. O sulco, os furos e as chapas de ancoragem ficam no chão.
 *
 * Esticada ao comprido, ganha barras (uma a cada `PASSO_DA_BARRA`), nunca barras mais grossas. Material: `grade` (o
 * ferro). O sulco e o furo são fixos.
 */
import type { Rgb } from '../../ruido'
import { caixa, capsula, elipse, uniao, type Forma } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo) ----------

/** A altura da grade: do chão até o teto baixo do corredor. */
const ALTURA_DA_GRADE = 1.45 * G
/** A beirada da travessa do alto (e das do meio) na 3/4 (px): grossa, para a travessa não sumir no alto. */
export const ESPESSURA_DA_GRADE_DE_CORREDOR = 5
/** O passo entre as barras, a meia largura da barra quadrada e a meia fundura dela (px). */
const PASSO_DA_BARRA = 7
const MEIA_BARRA = 1.3
const MEIA_FUNDURA_DA_BARRA = 0.4
/**
 * A travessa do alto (meia largura) e as do meio: o fundo e a frente delas (px; a frente logo à frente das barras,
 * para saírem por cima delas na 3/4) e, de cada uma, a altura (fração da grade) e onde fica o pino (y).
 */
const MEIA_TRAVESSA = 1.6
const FUNDO_DA_TRAVESSA_DO_MEIO = -1.2
const FRENTE_DA_TRAVESSA_DO_MEIO = 0.45
const TRAVESSAS_DO_MEIO: readonly (readonly [number, number])[] = [
  [1 / 3, -5.4],
  [2 / 3, -4.6],
]
/** A luva do pé de cada barra: a meia largura, o fundo e a frente (px) e a altura. */
const MEIA_LUVA = 1.75
const FUNDO_DA_LUVA = -2
const FRENTE_DA_LUVA = 0.6
const ALTURA_DA_LUVA = 2.4
/** O batente de cada ponta: o meio lado ao comprido e o de través (grossos). */
const BATENTE_AO_COMPRIDO = 2.8
const BATENTE_DE_TRAVES = 4
/** A meia largura do sulco no chão e o raio da cabeça de cada barra. */
const MEIO_SULCO = 2.2
const RAIO_DA_CABECA = 1.45
/** A borda borrada da sombra de cada barra (px): as faixas no chão ficam separadas, como as de uma grade. */
const SUAVE_DA_SOMBRA = 1.7

// ---------- os materiais fixos ----------

const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x30, 0x2c] }
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x22, 0x21, 0x20] }
/** O escuro em que o pixel escuro demais é levantado: cinza-ferro frio (com o da nogueira, o ferro saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x40, 0x43, 0x47]

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 decide pela caixa de quem a peça é. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** O material com a cor multiplicada por `f` (a face clara e a escura da barra, a luva). */
function tingido(m: MaterialDaPeca, f: number): MaterialDaPeca {
  const rgb: Rgb = [Math.min(245, m.rgb[0] * f), Math.min(245, m.rgb[1] * f), Math.min(245, m.rgb[2] * f)]
  return { ...m, rgb }
}

export const montarGradeDeCorredor: MontarMovel = (c, cena) => {
  const { hw, peca: P } = c
  const ferro = c.m.grade
  const L = cena.partes
  const H = ALTURA_DA_GRADE
  const xb = hw - BATENTE_AO_COMPRIDO - 0.4
  const n = Math.max(3, Math.round((xb * 2) / PASSO_DA_BARRA))
  const barras = Array.from({ length: n - 1 }, (_, i) => -xb + ((i + 1) * xb * 2) / n)
  const travessa = caixa(-xb, -MEIA_TRAVESSA, xb, MEIA_TRAVESSA, 0.6)
  const batentes = [-xb, xb].map((x) => caixa(x - BATENTE_AO_COMPRIDO, -BATENTE_DE_TRAVES, x + BATENTE_AO_COMPRIDO, BATENTE_DE_TRAVES, 0.6))
  const fb = MEIA_FUNDURA_DA_BARRA
  const naTravessa = MEIA_TRAVESSA - 0.3
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- as sombras: as barras (duas colunas cada), as luvas, os batentes e as travessas ----------
  // A borda da sombra é curta (`SUAVE_DA_SOMBRA`): com a de sempre (0,09 por px de altura) as faixas das barras se
  // fundiam numa mancha só. As colunas e as travessas do meio têm força zero: só dão a altura da 3/4 (o motor pula
  // a passada), e a faixa de cada barra no chão já vai arrastada, uma cápsula do pé até a sombra do topo, com z = 0.
  for (const x of barras) {
    const pe = caixa(x - MEIA_BARRA, -fb, x + MEIA_BARRA, fb)
    const faixa = capsula(x, 0, x + SOMBRA_X * H, SOMBRA_Y * H, MEIA_BARRA)
    cena.sombras.push(
      { forma: caixa(x - MEIA_BARRA, -fb, x, fb), z: H, forca: 0 },
      { forma: caixa(x, -fb, x + MEIA_BARRA, fb), z: H, forca: 0 },
      { forma: caixa(x - MEIA_LUVA, FUNDO_DA_LUVA, x + MEIA_LUVA, FRENTE_DA_LUVA, 0.3), z: ALTURA_DA_LUVA, forca: 0 },
      { forma: faixa, z: 0, forca: 0.22, suave: SUAVE_DA_SOMBRA },
      contato(pe, 0.32),
    )
  }
  for (const b of batentes) cena.sombras.push({ forma: b, z: H, forca: 0.26, suave: SUAVE_DA_SOMBRA * 1.4 }, contato(b, 0.36))
  cena.sombras.push({ forma: travessa, z: H, solta: true, forca: 0.24, suave: SUAVE_DA_SOMBRA * 1.6 })
  // Cada travessa do meio leva um pino escondido atrás do batente: o meio dos rebites dela mora ali.
  const pinos = TRAVESSAS_DO_MEIO.map(([, y]) => [xb - 1, y] as const)
  TRAVESSAS_DO_MEIO.forEach(([f], i) => {
    const corpo = caixa(-xb, FUNDO_DA_TRAVESSA_DO_MEIO, xb, FRENTE_DA_TRAVESSA_DO_MEIO, 0.3)
    cena.sombras.push({ forma: uniao(corpo, elipse(pinos[i][0], pinos[i][1], 0.3, 0.3)), z: H * f, solta: true, forca: 0 })
  })

  // ---------- no chão: o sulco, o furo de cada barra e as chapas de ancoragem dos batentes ----------
  const vao = (barras[0] + barras[1]) / 2
  L.push(P(comMeioEm(caixa(-xb, -MEIO_SULCO, xb, MEIO_SULCO, 1), vao, BATENTE_DE_TRAVES + 0.6), SULCO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.8, semente: 9901 }))
  for (const x of barras) {
    L.push(P(comMeioEm(elipse(x, 0.1, MEIA_LUVA + 0.65, 1), x, BATENTE_DE_TRAVES + 0.6), FURO, { bisel: 0, contorno: 0, alfa: 0.92, suave: 0.3, semente: 9903 }))
  }
  batentes.forEach((_, i) => {
    const x = i === 0 ? -xb : xb
    for (const lado of [-1, 1]) {
      const y0 = lado < 0 ? -BATENTE_DE_TRAVES - 1.7 : BATENTE_DE_TRAVES
      L.push(P(caixa(x - 2.6, y0, x + 2.6, y0 + 1.7, 0.4), ferro, { tabua: 0, bisel: 0.5, contorno: 0.32, tom: 0.78, metal: 0.3, semente: 9904 + i, projeta: { dist: 0.6, forca: 0.35 } }))
      for (const dx of [-1.5, 1.5]) L.push(P(elipse(x + dx, y0 + 0.85, 0.55, 0.55), ferro, { bisel: 0.4, contorno: 0.28, tom: 1.16, metal: 0.55, semente: 9906 }))
    }
  })

  // ---------- escondidas debaixo da travessa do alto: as faces das barras, as luvas e os rebites do meio ----------
  const claro = tingido(ferro, 1.32)
  const escuro = tingido(ferro, 0.8)
  const luva = tingido(ferro, 0.78)
  barras.forEach((x, i) => {
    L.push(P(caixa(x - MEIA_BARRA, -fb, x - 0.02, fb), claro, { tabua: 0, bisel: 0, contorno: 0, metal: 0.4, semente: 9910 + i }))
    L.push(P(caixa(x + 0.02, -fb, x + MEIA_BARRA, fb), escuro, { tabua: 0, bisel: 0, contorno: 0, metal: 0.4, semente: 9930 + i }))
    // A luva sobe com ela: o meio da caixa no fundo da luva, fora da travessa, das barras e das travessas do meio.
    const peDaLuva = caixa(x - MEIA_LUVA, -naTravessa, x + MEIA_LUVA, FRENTE_DA_LUVA, 0.3)
    L.push(P(comMeioEm(peDaLuva, x, FUNDO_DA_LUVA + 0.2), luva, { tabua: 0, bisel: 0, contorno: 0, metal: 0.3, semente: 9950 + i }))
  })
  pinos.forEach(([px, py], i) => {
    const rebites = barras.map((x) => elipse(x, naTravessa - 0.55, 0.55, 0.55)).reduce((soma, r) => uniao(soma, r))
    L.push(P(comMeioEm(rebites, px, py), tingido(ferro, 1.08), { bisel: 0.4, contorno: 0.3, tom: 1.18, metal: 0.6, semente: 9970 + i }))
  })

  // ---------- a travessa do alto e as cabeças redondas das barras, com o brilho ----------
  L.push(P(travessa, ferro, { tabua: 0, bisel: 1, contorno: 0.32, tom: 0.84, metal: 0.38, semente: 9902, projeta: { dist: 1.2, forca: 0.4 } }))
  barras.forEach((x, i) => {
    L.push(P(comMeioEm(elipse(x, 0, RAIO_DA_CABECA, RAIO_DA_CABECA), x, naTravessa), ferro, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 1, metal: 0.6, semente: 9975 + i, projeta: { dist: 0.9, forca: 0.45 } }))
    L.push(P(comMeioEm(elipse(x - 0.45, -0.45, 0.42, 0.42), x, naTravessa), ferro, { bisel: 0, contorno: 0, tom: 1.7, metal: 0.6, alfa: 0.85, semente: 9976 }))
  })

  // ---------- os batentes e os chumbadores ----------
  batentes.forEach((b, i) => {
    L.push(P(b, ferro, { tabua: 0, bisel: 1, contorno: 0.34, tom: 0.76, metal: 0.35, semente: 9990 + i, projeta: { dist: 1, forca: 0.4 } }))
    const x = i === 0 ? -xb : xb
    for (const y of [-BATENTE_DE_TRAVES * 0.55, BATENTE_DE_TRAVES * 0.55]) {
      L.push(P(elipse(x, y, 0.95, 0.95), ferro, { bisel: 0.6, contorno: 0.3, tom: 1.2, metal: 0.6, semente: 9995 }))
    }
  })
}
