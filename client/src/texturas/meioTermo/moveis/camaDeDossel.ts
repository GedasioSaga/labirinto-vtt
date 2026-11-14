/**
 * CAMA DE DOSSEL de cima com volume (objetos de 14/11/2026, grupo Castelo:
 * "cama com colunas e cortinas"). A cabeceira fica em cima (o fundo) e os pés
 * embaixo (a frente), como na cama de casal. De cima aparece a cama arrumada
 * (o pano da cabeceira em pregas, que desce do dossel, os dois travesseiros, a
 * almofada redonda da cor da cortina, o lençol dobrado e a colcha adamascada
 * com a barra), e por cima dela o
 * DOSSEL aberto: nos quatro lados, o pano drapeado por cima das réguas em
 * festões (as dobras seguem a curva de cada festão), com a cornija de madeira
 * na beira de fora; em cada canto, a CORTINA franzida em volta da coluna, com
 * a pinha torneada no alto.
 *
 * O dossel é aberto de propósito: com o teto de pano a cama sumiria, e o que
 * diz "dossel" a 1x é a moldura de pano com os quatro feixes nos cantos.
 *
 * NA 3/4 (`tresQuartos.ts`, derivado com a espessura da sanefa,
 * `ESPESSURA_DA_SANEFA_DO_DOSSEL`): cada feixe de cortina é uma coluna do
 * chão ao dossel, e a frente dele sai de pano (a maior peça do feixe); cada
 * lado do dossel é um tampo no ar, e a beirada dele é a sanefa pendurada; o
 * pano da cabeceira é uma coluna do chão ao dossel (a parede de pano atrás dos
 * travesseiros); o colchão sobe pela colcha (a frente dele sai de pano, a
 * colcha caindo) e a peseira pela madeira.
 *
 * As medidas são por casa (a cama esticada ganha colchão, não colunas mais
 * grossas); só uma cama menor que a de partida encolhe tudo junto.
 * Materiais: `madeira`, `cortina` (o dossel, as cortinas e a almofada redonda)
 * e `cobertor` (a colcha). O lençol e os travesseiros são o linho fixo.
 */
import { caixa, elipse, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** Alturas, em casas: o colchão, a peseira e o dossel (o pano da cabeceira desce dele até o chão). */
const ALTURA_DO_COLCHAO = 0.42
const ALTURA_DA_PESEIRA = 0.55
const ALTURA_DO_DOSSEL = 1.95
/** A sanefa pendurada que a 3/4 mostra (px do protótipo): o perfil da cama de dossel usa este valor como espessura. */
export const ESPESSURA_DA_SANEFA_DO_DOSSEL = 0.3 * 56
/** O lado da cama de partida (a menor das medidas), em casas: abaixo dele as medidas por casa encolhem junto. */
const LADO_DE_PARTIDA = 2

/** As medidas de cima, em casas. */
const RAIO_DO_FEIXE = 0.25
const LARGURA_DA_SANEFA = 0.12
const ONDA_DA_SANEFA = 0.07
const PERIODO_DA_SANEFA = 0.5
const CORNIJA = 0.05
const RECUO_DA_CAMA = 0.07
const FUNDO_DA_CABECEIRA = 0.17
const FUNDO_DA_PESEIRA = 0.11
const ALTO_DO_TRAVESSEIRO = 0.34
const DOBRA_DO_LENCOL = 0.17
const RAIO_DA_ALMOFADA = 0.17
const RAIO_DA_PINHA = 0.075

/** As dobras: quantas em volta do feixe, e o passo das dobras da sanefa (px do protótipo), que seguem o festão. */
const DOBRAS_DO_FEIXE = 7
const LUZ_DAS_DOBRAS = 0.13
const PASSO_DAS_DOBRAS = 3.2
/** A barra da colcha (px do protótipo) e o filete claro que a separa do campo. */
const BARRA_DA_COLCHA = 5.5
const FILETE = 0.8
/** O adamascado do campo da colcha: o passo da grade dos florões (px do protótipo) e a luz deles. */
const PASSO_DO_ADAMASCADO = 9
const LUZ_DO_ADAMASCADO = 0.08
/** As pregas do pano da cabeceira, vistas do alto (px do protótipo). */
const PASSO_DAS_PREGAS = 4.2

/** O meio do festão: 0 nas pontas (onde o pano é preso) e 1 no meio (onde ele cai mais). */
function festao(t: number, periodo: number): number {
  const f = t / periodo
  return Math.sin(Math.PI * (f - Math.floor(f)))
}

/**
 * A faixa de sanefa de um lado: a beira de fora reta de A a B e a de dentro
 * em festões, `fundo` px mais `onda` px no meio de cada festão, para dentro
 * pela normal (nx, ny). Distância aproximada (a da caixa no referencial do
 * lado): boa perto da borda, onde o chanfro e o contorno leem.
 */
function sanefa(ax: number, ay: number, bx: number, by: number, nx: number, ny: number, fundo: number, onda: number, periodo: number): Forma {
  const comp = Math.hypot(bx - ax, by - ay)
  const ux = (bx - ax) / comp
  const uy = (by - ay) / comp
  const longe = fundo + onda
  const xs = [ax, bx, ax + nx * longe, bx + nx * longe]
  const ys = [ay, by, ay + ny * longe, by + ny * longe]
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const t = (x - ax) * ux + (y - ay) * uy
      const s = (x - ax) * nx + (y - ay) * ny
      return Math.max(-t, t - comp, -s, s - fundo - onda * festao(t, periodo))
    },
  }
}

/** O pano da sanefa: o tecido do material com as dobras que acompanham a curva de cada festão. */
function texSanefa(ax: number, ay: number, ux: number, uy: number, nx: number, ny: number, onda: number, periodo: number): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const t = (x - ax) * ux + (y - ay) * uy
    const fundo = (x - ax) * nx + (y - ay) * ny - onda * festao(t, periodo)
    s[3] += Math.sin((fundo / PASSO_DAS_DOBRAS) * 2 * Math.PI) * LUZ_DAS_DOBRAS * 0.6
  }
}

/** O feixe da cortina franzida: o tecido com as dobras em leque em volta da coluna (cx, cy). */
function texFeixe(cx: number, cy: number): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const a = Math.atan2(y - cy, x - cx)
    s[3] += Math.sin(a * DOBRAS_DO_FEIXE + Math.hypot(x - cx, y - cy) * 0.35) * LUZ_DAS_DOBRAS
  }
}

/**
 * A colcha: o pano do material com a barra mais escura em volta, separada do
 * campo por um filete claro, e o campo adamascado (a grade de florões claros,
 * com um ponto entre quatro deles). Só luz: a cor é a do material.
 */
function texColcha(colcha: Forma): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const dentro = -colcha.d(x, y)
    if (dentro < BARRA_DA_COLCHA) s[3] -= 0.1
    else if (dentro < BARRA_DA_COLCHA + FILETE) s[3] += 0.1
    else {
      const q = Math.cos((x / PASSO_DO_ADAMASCADO) * 2 * Math.PI) * Math.cos((y / PASSO_DO_ADAMASCADO) * 2 * Math.PI)
      if (q > 0.55) s[3] += LUZ_DO_ADAMASCADO
      else if (q < -0.85) s[3] += LUZ_DO_ADAMASCADO * 0.7
    }
  }
}

/** O pano da cabeceira visto do alto: o tecido com as pregas de pé, que correm de lado a lado. */
function texPregas(): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    s[3] += Math.sin((x / PASSO_DAS_PREGAS) * 2 * Math.PI) * LUZ_DAS_DOBRAS
  }
}

export const montarCamaDeDossel: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const cortina: MaterialDaPeca = c.m.cortina
  const L = cena.partes
  // Medidas por casa; a cama menor que a de partida encolhe tudo junto.
  const casa = g * Math.min(1, Math.min(c.w, c.h) / (g * LADO_DE_PARTIDA))
  const rf = RAIO_DO_FEIXE * casa
  const recuo = RECUO_DA_CAMA * casa
  const [x0, x1, y0, y1] = [-hw + recuo, hw - recuo, -hh + recuo, hh - recuo]
  const yCab = y0 + FUNDO_DA_CABECEIRA * casa
  const yPe = y1 - FUNDO_DA_PESEIRA * casa
  const zDossel = g * ALTURA_DO_DOSSEL
  const cantos: readonly (readonly [number, number])[] = [[-hw + rf * 0.85, -hh + rf * 0.85], [hw - rf * 0.85, -hh + rf * 0.85], [-hw + rf * 0.85, hh - rf * 0.85], [hw - rf * 0.85, hh - rf * 0.85]]
  const larg = LARGURA_DA_SANEFA * casa
  const onda = ONDA_DA_SANEFA * casa

  // As alturas: o pano da cabeceira (do dossel ao chão), o colchão e a peseira; os quatro feixes do chão ao dossel;
  // e os lados do dossel, no ar.
  cena.sombras.push(
    contato(caixa(x0, y0, x1, y1, 1.5), 0.3),
    { forma: caixa(x0 + rf, y0, x1 - rf, yCab), z: zDossel },
    { forma: caixa(x0, yCab, x1, yPe), z: g * ALTURA_DO_COLCHAO },
    { forma: caixa(x0 + rf, yPe, x1 - rf, y1), z: g * ALTURA_DA_PESEIRA },
  )
  for (const [cx, cy] of cantos) cena.sombras.push({ forma: elipse(cx, cy, rf, rf), z: zDossel }, contato(elipse(cx, cy, rf, rf), 0.3))
  const lados = [
    caixa(-hw, -hh, hw, -hh + larg + onda),
    caixa(-hw, hh - larg - onda, hw, hh),
    caixa(-hw, -hh, -hw + larg + onda, hh),
    caixa(hw - larg - onda, -hh, hw, hh),
  ]
  for (const lado of lados) cena.sombras.push({ forma: lado, z: zDossel, solta: true, forca: 0.12, suave: 3.5 })

  // A CAMA: a armação, a colcha com a barra, o lençol dobrado, os travesseiros e a almofada redonda.
  L.push(P(caixa(x0, yCab - 2, x1, yPe + 2, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: 0.9, semente: 60 }))
  const yDobra = yCab + ALTO_DO_TRAVESSEIRO * casa + 2.4
  const colcha = caixa(x0 + 1.4, yDobra, x1 - 1.4, yPe + 0.6, 2)
  L.push(P(colcha, c.m.cobertor, { bisel: 2, contorno: 0.22, textura: texColcha(colcha), semente: 61 }))
  L.push(P(caixa(x0 + 1, yDobra - 0.8, x1 - 1, yDobra + DOBRA_DO_LENCOL * casa, 1.6), LENCOL, { bisel: 1.6, contorno: 0.2, semente: 62, projeta: { dist: 1, forca: 0.26 } }))
  const meio = (x0 + x1) / 2
  const folga = 2.2
  for (const [i, [a, b]] of ([[x0 + folga, meio - folga / 2], [meio + folga / 2, x1 - folga]] as const).entries()) {
    const desce = i === 1 ? 0.9 : 0
    L.push(P(caixa(a, yCab + folga + desce, b, yCab + ALTO_DO_TRAVESSEIRO * casa + desce, 3.4), LENCOL, { bisel: 3.4, tom: 1.02, contorno: 0.22, semente: 63 + i, projeta: { dist: 1.4, forca: 0.3, suave: 0.8 } }))
  }
  const ra = RAIO_DA_ALMOFADA * casa
  L.push(P(elipse(meio, yDobra - ra * 0.2, ra, ra * 0.92), cortina, { bisel: ra * 0.5, contorno: 0.24, textura: texFeixe(meio, yDobra - ra * 0.2), semente: 66, projeta: { dist: 1.4, forca: 0.3 } }))

  // O pano da cabeceira, que desce do dossel atrás dos travesseiros (do alto, a beira de cima dele, em pregas;
  // na 3/4, a parede de pano até o chão), e a peseira, entre os feixes.
  L.push(P(caixa(x0 + rf * 0.6, y0, x1 - rf * 0.6, yCab, 1.2), cortina, { bisel: 1.6, tom: 0.9, contorno: 0.26, textura: texPregas(), semente: 70, projeta: { dist: 2.2, forca: 0.32, suave: 1 } }))
  L.push(P(caixa(x0 + rf * 0.6, yPe, x1 - rf * 0.6, y1, 1), mad, { tabua: 0, bisel: 1.3, semente: 75 }))

  // O DOSSEL: em cada lado, o pano em festões por cima da régua e a cornija de madeira na beira de fora.
  const faixas: readonly (readonly [number, number, number, number, number, number])[] = [
    [-hw, -hh, hw, -hh, 0, 1],
    [hw, hh, -hw, hh, 0, -1],
    [-hw, hh, -hw, -hh, 1, 0],
    [hw, -hh, hw, hh, -1, 0],
  ]
  for (const [i, [ax, ay, bx, by, nx, ny]] of faixas.entries()) {
    const comp = Math.hypot(bx - ax, by - ay) - 2 * rf
    const ux = (bx - ax) / (comp + 2 * rf)
    const uy = (by - ay) / (comp + 2 * rf)
    // Os festões vão de feixe a feixe, num número inteiro de vezes.
    const [sx, sy] = [ax + ux * rf, ay + uy * rf]
    const periodo = comp / Math.max(1, Math.round(comp / (PERIODO_DA_SANEFA * casa)))
    const forma = sanefa(sx, sy, sx + ux * comp, sy + uy * comp, nx, ny, larg, onda, periodo)
    L.push(P(forma, cortina, { eixo: Math.atan2(uy, ux), bisel: 1.4, contorno: 0.26, textura: texSanefa(sx, sy, ux, uy, nx, ny, onda, periodo), semente: 80 + i, projeta: { dist: 1.8, forca: 0.34, suave: 0.9 } }))
    const cornija = caixa(Math.min(ax, bx + nx * CORNIJA * casa), Math.min(ay, by + ny * CORNIJA * casa), Math.max(ax, bx + nx * CORNIJA * casa), Math.max(ay, by + ny * CORNIJA * casa), 0.6)
    L.push(P(cornija, mad, { eixo: Math.atan2(uy, ux), tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.24, semente: 84 + i }))
  }

  // As CORTINAS franzidas em cada canto, em volta da coluna, e a pinha torneada no alto dela.
  for (const [i, [cx, cy]] of cantos.entries()) {
    // O feixe cai um pouco para fora do canto: três gomos de pano em volta da coluna.
    const fx = Math.sign(cx) * rf * 0.18
    const fy = Math.sign(cy) * rf * 0.18
    const feixe = uniao(uniao(elipse(cx, cy, rf, rf * 0.94), elipse(cx + fx, cy - fy * 0.6, rf * 0.8, rf * 0.72)), elipse(cx - fx * 0.6, cy + fy, rf * 0.72, rf * 0.8))
    L.push(P(feixe, cortina, { bisel: rf * 0.55, contorno: 0.28, textura: texFeixe(cx, cy), semente: 90 + i * 3, projeta: { dist: 1.6, forca: 0.34, suave: 0.8 } }))
    const rp = RAIO_DA_PINHA * casa
    L.push(P(caixa(cx - rp * 1.3, cy - rp * 1.3, cx + rp * 1.3, cy + rp * 1.3, rp * 0.4), mad, { tabua: 0, bisel: 1, tom: 0.95, contorno: 0.26, semente: 91 + i * 3 }))
    L.push(P(elipse(cx, cy, rp, rp), mad, { tabua: 0, bisel: rp * 0.8, tom: 1.12, contorno: 0.24, semente: 92 + i * 3 }))
  }
}
