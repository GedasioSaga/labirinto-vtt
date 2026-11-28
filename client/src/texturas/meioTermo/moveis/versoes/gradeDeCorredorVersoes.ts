/**
 * As versões da GRADE DE CORREDOR (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`;
 * temas Esgotos e Prisão). A 1ª, INTEIRA, é o desenho de `MONTADORES` (`montarGradeDeCorredor`). Aqui fica a
 * ARROMBADA: alguém forçou a passagem pelo meio. A TRAVESSA do alto partiu entre duas barras (as pontas rasgadas, com
 * o brilho claro da fratura); as duas barras do meio sumiram do lugar (no furo de uma ficou o TOCO partido, a outra
 * deixou o furo vazio) e as duas vizinhas ficaram ENVERGADAS para fora e para os lados, abrindo o vão. Um PEDAÇO de
 * barra caiu deitado no chão do lado de fora, em diagonal; em volta, as lascas de ferrugem, uma porca solta e os
 * RISCOS claros no chão de quando as barras foram arrastadas. A sombra conta o resto: a escada de faixas no chão
 * tem um buraco no meio.
 *
 * Mesma pegada e mesmo lugar de material do tipo (`grade`). As medidas são as de `moveis/gradeDeCorredor.ts` (lá não
 * são exportadas, salvo a espessura da 3/4: copiadas aqui, com o mesmo nome), e a montagem da 3/4 é a mesma (as faces
 * das barras e as luvas escondidas debaixo da travessa, com o meio da caixa posto nela).
 */
import type { VersoesDesenhadas } from '.'
import { hash, type Rgb } from '../../../ruido'
import { caixa, cadeia, capsula, elipse, poligono, type Forma, type Ponto } from '../formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca } from '../motor'
import { G, type MontarMovel } from '../contexto'

// ---------- as medidas de `gradeDeCorredor.ts` ----------

const ALTURA_DA_GRADE = 1.45 * G
const PASSO_DA_BARRA = 7
const MEIA_BARRA = 1.3
const MEIA_FUNDURA_DA_BARRA = 0.4
const MEIA_TRAVESSA = 1.6
const FUNDO_DA_TRAVESSA_DO_MEIO = -1.2
const FRENTE_DA_TRAVESSA_DO_MEIO = 0.45
const TRAVESSAS_DO_MEIO: readonly number[] = [1 / 3, 2 / 3]
const MEIA_LUVA = 1.75
const FUNDO_DA_LUVA = -2
const FRENTE_DA_LUVA = 0.6
const ALTURA_DA_LUVA = 2.4
const BATENTE_AO_COMPRIDO = 2.8
const BATENTE_DE_TRAVES = 4
const MEIO_SULCO = 2.2
const RAIO_DA_CABECA = 1.45
const SUAVE_DA_SOMBRA = 1.7

// ---------- as medidas do arrombamento ----------

/** Quanto as barras envergadas saem para fora (y) e para o lado (x), em px. */
const ENVERGA_PARA_FORA = 5.6
const ENVERGA_PARA_O_LADO = 1.9
/** O pedaço de barra caído no chão: as duas pontas (px, a partir do vão) e o meio, um nada torto. */
const PEDACO_CAIDO: readonly Ponto[] = [
  [-3, 6.4],
  [22, 9.2],
  [46, 12.6],
]

// ---------- os materiais fixos ----------

const SULCO: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x30, 0x2c] }
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x22, 0x21, 0x20] }
const ESCURO_DO_FERRO: Rgb = [0x40, 0x43, 0x47]
/** A fratura do ferro partido: o cinza claro do aço por dentro, sem chegar ao branco. */
const FRATURA: MaterialDaPeca = { classe: 'metal', rgb: [0xa4, 0xa6, 0xa6] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x56, 0x3d] }
const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0xa4, 0x98] }

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

function tingido(m: MaterialDaPeca, f: number): MaterialDaPeca {
  const rgb: Rgb = [Math.min(245, m.rgb[0] * f), Math.min(245, m.rgb[1] * f), Math.min(245, m.rgb[2] * f)]
  return { ...m, rgb }
}

/** A ponta rasgada de uma metade da travessa: um triângulo de bico, para o lado do vão (`rumo` = -1 ou 1). */
function pontaRasgada(x: number, rumo: number): Forma {
  return poligono([
    [x, -MEIA_TRAVESSA],
    [x + rumo * 1.6, -MEIA_TRAVESSA * 0.3],
    [x + rumo * 0.7, 0.2],
    [x + rumo * 2.1, MEIA_TRAVESSA * 0.7],
    [x, MEIA_TRAVESSA],
  ])
}

/** ARROMBADA: a travessa partida, duas barras fora, duas envergadas e um pedaço caído no chão. */
const montarGradeArrombada: MontarMovel = (c, cena) => {
  const { hw, peca: P } = c
  const ferro = c.m.grade
  const L = cena.partes
  const H = ALTURA_DA_GRADE
  const xb = hw - BATENTE_AO_COMPRIDO - 0.4
  const n = Math.max(3, Math.round((xb * 2) / PASSO_DA_BARRA))
  const todas = Array.from({ length: n - 1 }, (_, i) => -xb + ((i + 1) * xb * 2) / n)
  // O vão no meio: as duas barras do meio saíram; as vizinhas envergaram.
  const g = Math.max(1, Math.floor((todas.length - 1) / 2))
  const sumidas = [todas[g], todas[g + 1]]
  const envergadas = [todas[g - 1], todas[g + 2]]
  const inteiras = todas.filter((x) => !sumidas.includes(x) && !envergadas.includes(x))
  const fimEsquerdo = (todas[g - 1] + todas[g]) / 2
  const fimDireito = (todas[g + 1] + todas[g + 2]) / 2
  const metades = [caixa(-xb, -MEIA_TRAVESSA, fimEsquerdo, MEIA_TRAVESSA, 0.6), caixa(fimDireito, -MEIA_TRAVESSA, xb, MEIA_TRAVESSA, 0.6)]
  const batentes = [-xb, xb].map((x) => caixa(x - BATENTE_AO_COMPRIDO, -BATENTE_DE_TRAVES, x + BATENTE_AO_COMPRIDO, BATENTE_DE_TRAVES, 0.6))
  const fb = MEIA_FUNDURA_DA_BARRA
  const naTravessa = MEIA_TRAVESSA - 0.3
  cena.corDoPiso = ESCURO_DO_FERRO

  // ---------- as sombras: as barras de pé (inteiras e envergadas), os batentes e as metades da travessa ----------
  for (const x of [...inteiras, ...envergadas]) {
    const pe = caixa(x - MEIA_BARRA, -fb, x + MEIA_BARRA, fb)
    cena.sombras.push(
      { forma: caixa(x - MEIA_BARRA, -fb, x, fb), z: H, forca: 0 },
      { forma: caixa(x, -fb, x + MEIA_BARRA, fb), z: H, forca: 0 },
      { forma: caixa(x - MEIA_LUVA, FUNDO_DA_LUVA, x + MEIA_LUVA, FRENTE_DA_LUVA, 0.3), z: ALTURA_DA_LUVA, forca: 0 },
      contato(pe, 0.32),
    )
    // A faixa no chão: a da barra envergada sai torta, para o lado que ela foi.
    const torta = envergadas.includes(x) ? (x < 0 ? -1 : 1) * ENVERGA_PARA_O_LADO * 1.6 : 0
    const faixa = cadeia(
      [
        [x, 0],
        [x + SOMBRA_X * H * 0.5 + torta, SOMBRA_Y * H * 0.5 + (torta === 0 ? 0 : ENVERGA_PARA_FORA * 0.5)],
        [x + SOMBRA_X * H, SOMBRA_Y * H],
      ],
      MEIA_BARRA,
    )
    cena.sombras.push({ forma: faixa, z: 0, forca: 0.22, suave: SUAVE_DA_SOMBRA })
  }
  for (const b of batentes) cena.sombras.push({ forma: b, z: H, forca: 0.26, suave: SUAVE_DA_SOMBRA * 1.4 }, contato(b, 0.36))
  for (const m of metades) cena.sombras.push({ forma: m, z: H, solta: true, forca: 0.24, suave: SUAVE_DA_SOMBRA * 1.6 })
  TRAVESSAS_DO_MEIO.forEach((f) => {
    cena.sombras.push(
      { forma: caixa(-xb, FUNDO_DA_TRAVESSA_DO_MEIO, fimEsquerdo, FRENTE_DA_TRAVESSA_DO_MEIO, 0.3), z: H * f, solta: true, forca: 0 },
      { forma: caixa(fimDireito, FUNDO_DA_TRAVESSA_DO_MEIO, xb, FRENTE_DA_TRAVESSA_DO_MEIO, 0.3), z: H * f, solta: true, forca: 0 },
    )
  })
  // O pedaço de barra caído no chão.
  const caido = cadeia(
    PEDACO_CAIDO.map(([x, y]): Ponto => [x, y]),
    MEIA_BARRA,
  )
  cena.sombras.push({ forma: caido, z: 2 * MEIA_BARRA, forca: 0.3 }, contato(caido, 0.34))

  // ---------- no chão: o sulco, os furos (os vazios mais escuros), os riscos, a ferrugem e as chapas ----------
  L.push(P(comMeioEm(caixa(-xb, -MEIO_SULCO, xb, MEIO_SULCO, 1), (todas[0] + todas[1]) / 2, BATENTE_DE_TRAVES + 0.6), SULCO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.8, semente: 9901 }))
  for (const x of todas) {
    const vazio = sumidas.includes(x)
    L.push(P(comMeioEm(elipse(x, 0.1, MEIA_LUVA + 0.65, 1), x, BATENTE_DE_TRAVES + 0.6), FURO, { bisel: 0, contorno: 0, alfa: vazio ? 1 : 0.92, suave: 0.3, semente: 9903 }))
  }
  // Os riscos claros no chão, de quando arrastaram as barras para fora, e as lascas de ferrugem.
  for (let k = 0; k < 3; k += 1) {
    const x0 = sumidas[0] - 2 + k * 2.2
    L.push(P(capsula(x0, 2.4 + k * 0.4, x0 + 7 + k * 3, 6 + k * 1.2, 0.28), RISCO, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.25, semente: 9920 + k }))
  }
  for (let k = 0; k < 6; k += 1) {
    const x = (sumidas[0] + sumidas[1]) / 2 + (hash(k, 1, 9925) - 0.5) * 14
    const y = 1.5 + hash(k, 2, 9925) * 4
    L.push(P(elipse(x, y, 0.45 + hash(k, 3, 9925) * 0.35, 0.4), FERRUGEM, { bisel: 0, contorno: 0.1, alfa: 0.85, semente: 9926 }))
  }
  batentes.forEach((_, i) => {
    const x = i === 0 ? -xb : xb
    for (const lado of [-1, 1]) {
      const y0 = lado < 0 ? -BATENTE_DE_TRAVES - 1.7 : BATENTE_DE_TRAVES
      L.push(P(caixa(x - 2.6, y0, x + 2.6, y0 + 1.7, 0.4), ferro, { tabua: 0, bisel: 0.5, contorno: 0.32, tom: 0.78, metal: 0.3, semente: 9904 + i, projeta: { dist: 0.6, forca: 0.35 } }))
      for (const dx of [-1.5, 1.5]) L.push(P(elipse(x + dx, y0 + 0.85, 0.55, 0.55), ferro, { bisel: 0.4, contorno: 0.28, tom: 1.16, metal: 0.55, semente: 9906 }))
    }
  })
  // O toco partido no furo da primeira barra que sumiu, com a fratura clara.
  L.push(P(caixa(sumidas[0] - MEIA_BARRA, -fb - 0.4, sumidas[0] + MEIA_BARRA, fb + 0.4, 0.3), ferro, { tabua: 0, bisel: 0.5, contorno: 0.32, tom: 0.92, metal: 0.4, semente: 9908, projeta: { dist: 0.6, forca: 0.4 } }))
  L.push(P(elipse(sumidas[0] - 0.2, -0.1, 0.75, 0.5), FRATURA, { bisel: 0, contorno: 0.1, alfa: 0.85, semente: 9909 }))

  // ---------- o pedaço de barra caído e a porca solta ----------
  L.push(P(caido, ferro, { tabua: 0, bisel: MEIA_BARRA, tom: 0.96, contorno: 0.32, metal: 0.4, semente: 9910, projeta: { dist: 0.8, forca: 0.4 } }))
  const [px, py] = PEDACO_CAIDO[0]
  L.push(P(elipse(px - 0.2, py, 0.8, 1.1), FRATURA, { bisel: 0, contorno: 0.12, alfa: 0.8, semente: 9911 }))
  L.push(P(elipse(PEDACO_CAIDO[2][0] + 1.1, PEDACO_CAIDO[2][1], RAIO_DA_CABECA, RAIO_DA_CABECA), ferro, { bisel: 0.8, contorno: 0.34, tom: 1, metal: 0.6, semente: 9912, projeta: { dist: 0.7, forca: 0.4 } }))
  const porca = poligono(Array.from({ length: 6 }, (_, k): Ponto => [fimDireito + 9 + Math.cos(k * (Math.PI / 3)) * 1.1, 4.2 + Math.sin(k * (Math.PI / 3)) * 1.1]))
  L.push(P(porca, ferro, { tabua: 0, bisel: 0.5, contorno: 0.34, tom: 1.08, metal: 0.5, semente: 9913, projeta: { dist: 0.5, forca: 0.35 } }))
  L.push(P(elipse(fimDireito + 9, 4.2, 0.4, 0.4), FURO, { bisel: 0, contorno: 0, alfa: 0.9, semente: 9914 }))

  // ---------- escondidas debaixo da travessa: as faces e as luvas das barras de pé ----------
  const claro = tingido(ferro, 1.32)
  const escuro = tingido(ferro, 0.8)
  const luva = tingido(ferro, 0.78)
  inteiras.forEach((x, i) => {
    L.push(P(caixa(x - MEIA_BARRA, -fb, x - 0.02, fb), claro, { tabua: 0, bisel: 0, contorno: 0, metal: 0.4, semente: 9930 + i }))
    L.push(P(caixa(x + 0.02, -fb, x + MEIA_BARRA, fb), escuro, { tabua: 0, bisel: 0, contorno: 0, metal: 0.4, semente: 9950 + i }))
    const peDaLuva = caixa(x - MEIA_LUVA, -naTravessa, x + MEIA_LUVA, FRENTE_DA_LUVA, 0.3)
    L.push(P(comMeioEm(peDaLuva, x, FUNDO_DA_LUVA + 0.2), luva, { tabua: 0, bisel: 0, contorno: 0, metal: 0.3, semente: 9970 + i }))
  })

  // ---------- as barras envergadas: a curva que sai de debaixo da travessa, para fora e para o lado ----------
  envergadas.forEach((x, k) => {
    const lado = x < 0 ? -1 : 1
    const curva = cadeia(
      [
        [x, 0],
        [x + lado * ENVERGA_PARA_O_LADO * 0.35, ENVERGA_PARA_FORA * 0.5],
        [x + lado * ENVERGA_PARA_O_LADO, ENVERGA_PARA_FORA],
      ],
      MEIA_BARRA,
    )
    L.push(P(curva, ferro, { tabua: 0, bisel: MEIA_BARRA, tom: 0.98, contorno: 0.32, metal: 0.45, semente: 9990 + k, projeta: { dist: 1, forca: 0.42 } }))
  })

  // ---------- as metades da travessa, as pontas rasgadas e as cabeças das barras que ficaram ----------
  metades.forEach((m, k) => L.push(P(m, ferro, { tabua: 0, bisel: 1, contorno: 0.32, tom: 0.84, metal: 0.38, semente: 9902 + k, projeta: { dist: 1.2, forca: 0.4 } })))
  for (const [x, rumo] of [[fimEsquerdo, 1], [fimDireito, -1]] as const) {
    L.push(P(pontaRasgada(x, rumo), ferro, { tabua: 0, bisel: 0.6, contorno: 0.32, tom: 0.84, metal: 0.38, semente: 9915, projeta: { dist: 1.2, forca: 0.4 } }))
    L.push(P(elipse(x + rumo * 0.9, 0, 0.7, MEIA_TRAVESSA * 0.7), FRATURA, { bisel: 0, contorno: 0, alfa: 0.7, semente: 9916 }))
  }
  ;[...inteiras, ...envergadas].forEach((x, i) => {
    L.push(P(comMeioEm(elipse(x, 0, RAIO_DA_CABECA, RAIO_DA_CABECA), x, naTravessa), ferro, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 1, metal: 0.6, semente: 9975 + i, projeta: { dist: 0.9, forca: 0.45 } }))
    L.push(P(comMeioEm(elipse(x - 0.45, -0.45, 0.42, 0.42), x, naTravessa), ferro, { bisel: 0, contorno: 0, tom: 1.7, metal: 0.6, alfa: 0.85, semente: 9976 }))
  })

  // ---------- os batentes e os chumbadores ----------
  batentes.forEach((b, i) => {
    L.push(P(b, ferro, { tabua: 0, bisel: 1, contorno: 0.34, tom: 0.76, metal: 0.35, semente: 9980 + i, projeta: { dist: 1, forca: 0.4 } }))
    const x = i === 0 ? -xb : xb
    for (const y of [-BATENTE_DE_TRAVES * 0.55, BATENTE_DE_TRAVES * 0.55]) {
      L.push(P(elipse(x, y, 0.95, 0.95), ferro, { bisel: 0.6, contorno: 0.3, tom: 1.2, metal: 0.6, semente: 9985 }))
    }
  })
}

export const versoesDoGradeDeCorredor: VersoesDesenhadas = {
  arrombada: montarGradeArrombada,
}
