/**
 * ESTACA COM CRÂNIO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema
 * Inferno): o aviso na beira do caminho. A ESTACA de madeira velha, fincada num montinho de terra, com a CAVEIRA
 * espetada no alto (sem a mandíbula: ela caiu e está no chão, ao pé), as voltas de CORDA amarrando e o TRAPO escuro
 * pendurado da amarra.
 *
 * DESENHADA DE FRENTE nas duas vistas (perfil `EM_PE`, como o crânio e a lápide): de cima, uma estaca é um ponto; o que
 * diz "estaca com crânio" é a caveira no alto do pau. A caveira é a dos ossos e do crânio de hoje (`cranio.ts`: o mesmo
 * marfim velho, o mesmo grão e as mesmas manchas), de frente, mais simples: a cúpula, as maçãs do rosto, as órbitas
 * fundas com a beira clara de cima, o nariz em pera e a fileira de dentes de cima. `caveiraDeFrente` é exportada: o
 * pilar de ossos (`pilarDeOssos.ts`) usa a mesma.
 *
 * As duas versões (a mesma pegada de 1 x 1 casa):
 * - UMA: a estaca sozinha no meio, a caveira um nada inclinada, a mandíbula e um osso no chão;
 * - TRÊS: três estacas juntas, a do meio mais alta e na frente, as dos lados mais baixas, para trás e tortas para
 *   fora, cada caveira inclinada para um lado.
 *
 * A sombra no chão sai do pé, curta, para baixo à direita; a sombra de baixo forte é a da 3/4 em pé. O desenho é feito
 * em 56 x 56 px (uma casa) e escala com o menor lado. Material: `madeira` (a estaca); o osso, a corda, o trapo e a terra
 * são fixos.
 */
import type { Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, TOM_DA_CORDA, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O lado do desenho (px do protótipo): uma casa. */
const LADO_DO_DESENHO = 56

// ---------- as cores (fixas) ----------

/** O osso velho dos ossos e do crânio de hoje, e a mancha de terra e de tempo. */
const TOM_DO_OSSO: Rgb = [0xd2, 0xc6, 0xaa]
const MANCHA_DO_OSSO: Rgb = [0xa8, 0x93, 0x70]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
/** O escuro de dentro das órbitas, do nariz e da boca. */
const OCO: MaterialDaPeca = { classe: 'liso', rgb: [0x54, 0x47, 0x3a] }
/** O escuro em que o pixel escuro demais é levantado: o pardo acinzentado dos ossos (`cranio.ts`). */
export const ESCURO_DO_OSSO: Rgb = [0x4a, 0x42, 0x3a]
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const TRAPO: MaterialDaPeca = { classe: 'tecido', rgb: [0x6e, 0x46, 0x3c], fio: 'linho' }
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x6c, 0x58] }
const PEDRINHA: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x82, 0x78] }

// ---------- o osso ----------

/** A partir de quanto o ruído vira mancha no osso, a largura da passagem e o quanto a mancha cobre no miolo. */
const LIMIAR_DA_MANCHA = 0.06
const BEIRA_DA_MANCHA = 0.22
const MANCHA_CHEIA = 0.42

/** O osso: o grão miúdo e as manchas de tempo (na escala do desenho, como em `cranio.ts`). */
export function texDoOssoVelho(k: number): Textura {
  return (_u, _v, x, y, p, s) => {
    s[3] += ruido(x * 0.33 + p.su, y * 0.33 + p.sv) * 0.07 + ruido(x * 1.2 + p.sv, y * 1.2) * 0.03
    const suja = ruido((x / k) * 0.12 + p.sv, (y / k) * 0.12 + p.su)
    if (suja <= LIMIAR_DA_MANCHA) return
    const t = Math.min(1, (suja - LIMIAR_DA_MANCHA) / BEIRA_DA_MANCHA) * MANCHA_CHEIA
    s[0] += (MANCHA_DO_OSSO[0] - s[0]) * t
    s[1] += (MANCHA_DO_OSSO[1] - s[1]) * t
    s[2] += (MANCHA_DO_OSSO[2] - s[2]) * t
  }
}

// ---------- as formas ----------

/** A forma desenhada em volta de (0, 0), aumentada `k`, girada `ang` radianos e levada para (cx, cy) (`cranio.ts`). */
export function levada(f: Forma, cx: number, cy: number, ang: number, k: number): Forma {
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

/** A união macia: onde as duas formas chegam perto (menos de `r`), o vão vira curva, sem quina (`cranio.ts`). */
function uniaoMacia(a: Forma, b: Forma, r: number): Forma {
  const folga = r * 0.25
  return {
    b: [Math.min(a.b[0], b.b[0]) - folga, Math.min(a.b[1], b.b[1]) - folga, Math.max(a.b[2], b.b[2]) + folga, Math.max(a.b[3], b.b[3]) + folga],
    d(x, y) {
      const da = a.d(x, y)
      const db = b.d(x, y)
      const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (db - da)) / r))
      return db + (da - db) * h - r * h * (1 - h)
    },
  }
}

// ---------- a caveira de frente (unidades do crânio de `cranio.ts`: ~19 de largura, a boca embaixo) ----------

const CUPULA = { x: 0, y: -3.6, rx: 9.2, ry: 8.6 }
const MAXILAR = { x0: -4.4, x1: 4.4, y0: 1, y1: 8.3, raio: 2.4, emenda: 1.4 }
const MACAS: readonly (readonly [number, number, number, number])[] = [
  [-5.7, 2.9, 2.4, 1.4],
  [5.7, 2.9, 2.4, 1.4],
]
const ORBITAS: readonly (readonly [number, number, number, number, number])[] = [
  [-3.3, 0.5, 2.6, 2.35, -0.16],
  [3.3, 0.5, 2.6, 2.35, 0.16],
]
const NARIZ: readonly Ponto[] = [
  [0, 2.6],
  [0.75, 3.8],
  [1.35, 5.3],
  [0.75, 6],
  [0, 5.5],
  [-0.75, 6],
  [-1.35, 5.3],
  [-0.75, 3.8],
]
const BOCA = { x0: -3.9, x1: 3.9, y0: 7.2, y1: 9.7, raio: 1.1 }
/** Os dentes de cima (x e meia largura); um caiu. O arco volta para trás nos lados. */
const DENTES: readonly (readonly [number, number])[] = [
  [-3.3, 0.42],
  [-2.2, 0.46],
  [-1.1, 0.48],
  [0, 0.48],
  [1.1, 0.48],
  [2.2, 0.46],
  [3.3, 0.42],
]
const DENTE_QUE_FALTA = 4
/** O pé da caveira (onde a estaca entra), nas unidades dela. */
export const PE_DA_CAVEIRA = 8

/**
 * A caveira de frente, sem mandíbula, com o meio da cúpula em (cx, cy), aumentada `e` e girada `ang`: a cúpula com as
 * maçãs e o maxilar numa peça só, as órbitas (a beira clara de cima e o oco fundo), o nariz, a boca e os dentes.
 */
export function caveiraDeFrente(P: CriarPeca, L: Peca[], cx: number, cy: number, e: number, ang: number, semente: number, tom = 1): void {
  const em = (f: Forma): Forma => levada(f, cx, cy, ang, e)
  let cranio = uniaoMacia(elipse(CUPULA.x, CUPULA.y, CUPULA.rx, CUPULA.ry), caixa(MAXILAR.x0, MAXILAR.y0, MAXILAR.x1, MAXILAR.y1, MAXILAR.raio), MAXILAR.emenda)
  for (const [x, y, rx, ry] of MACAS) cranio = uniaoMacia(cranio, elipse(x, y, rx, ry), 2.2)
  L.push(P(em(cranio), OSSO, { bisel: 4.2 * e, tom: 1.03 * tom, contorno: 0.3, textura: texDoOssoVelho(e), semente }))
  for (const [x, y, rx, ry, giro] of ORBITAS) {
    L.push(P(em(elipseGirada(x - 0.3, y - 0.4, rx + 0.5, ry + 0.5, giro)), OSSO, { bisel: 0.6 * e, contorno: 0, tom: 1.1 * tom, alfa: 0.85, semente: semente + 1 }))
    L.push(P(em(elipseGirada(x, y, rx, ry, giro)), OCO, { bisel: 0.4 * e, contorno: 0.2, recesso: { k: 0.9 * e, forca: 0.34 }, semente: semente + 2 }))
  }
  L.push(P(em(poligono(NARIZ)), OCO, { bisel: 0.3 * e, contorno: 0.2, recesso: { k: 0.7 * e, forca: 0.3 }, semente: semente + 3 }))
  L.push(P(em(caixa(BOCA.x0, BOCA.y0, BOCA.x1, BOCA.y1, BOCA.raio)), OCO, { bisel: 0, contorno: 0.2, semente: semente + 4 }))
  DENTES.forEach(([x, meia], i) => {
    if (i === DENTE_QUE_FALTA) return
    const sobe = 0.09 * x * x
    L.push(P(em(caixa(x - meia, BOCA.y0 - 0.2 - sobe * 0.3, x + meia, BOCA.y1 - 0.3 - sobe, Math.min(0.35, meia * 0.7))), OSSO, { bisel: 0.3 * e, tom: 1.06 * tom, contorno: 0.2, textura: texDoOssoVelho(e), semente: semente + 5 + i }))
  })
}

// ---------- a estaca ----------

/** Uma estaca: o pé (x, y), a altura até o meio da caveira, o quanto ela tomba (px no alto), a escala e o giro da caveira. */
interface Estaca {
  readonly x: number
  readonly pe: number
  readonly alto: number
  readonly tomba: number
  readonly escala: number
  readonly giro: number
}

const SO_UMA: readonly Estaca[] = [{ x: 0, pe: 22.5, alto: -13.5, tomba: 1.2, escala: 0.7, giro: -0.08 }]
/** As três: as dos lados antes (mais para trás e mais baixas), a do meio por último (na frente). */
const AS_TRES: readonly Estaca[] = [
  { x: -14, pe: 18, alto: -5, tomba: -3.4, escala: 0.6, giro: -0.2 },
  { x: 14.5, pe: 19, alto: -3, tomba: 3.2, escala: 0.56, giro: 0.24 },
  { x: 0.5, pe: 23.5, alto: -15.5, tomba: 0.8, escala: 0.68, giro: 0.06 },
]

/** A estaca: o pau afinando para cima, os nós, as voltas de corda, o trapo e a caveira espetada no alto. */
function estaca(c: ContextoDoMovel, cena: Cena, k: number, e: Estaca, i: number): void {
  const P = c.peca
  const L = cena.partes
  const semente = 9400 + i * 40
  const topoX = e.x + e.tomba
  const caveiraY = e.alto
  const peDaCaveira = caveiraY + PE_DA_CAVEIRA * e.escala
  const naAltura = (y: number): number => e.x + (e.tomba * (e.pe - y)) / (e.pe - caveiraY)
  // O pau: mais grosso embaixo, afinando; o veio corre de pé.
  const pau = poligono([[(e.x - 1.6) * k, e.pe * k], [(e.x + 1.6) * k, e.pe * k], [(topoX + 1.1) * k, peDaCaveira * k], [(topoX - 1.1) * k, peDaCaveira * k]])
  L.push(P(pau, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 1.1 * k, tom: 0.92, contorno: 0.3, semente, projeta: { dist: 0.8 * k, forca: 0.3 } }))
  for (const t of [0.3, 0.62]) {
    const y = e.pe + (peDaCaveira - e.pe) * t
    L.push(P(elipse(naAltura(y) * k + 0.3 * k, y * k, 0.55 * k, 0.4 * k), OCO, { bisel: 0, contorno: 0, alfa: 0.6, semente: semente + 1 }))
  }
  // O trapo pendurado da amarra (atrás das voltas de corda), com a beira esfarrapada.
  const amarra = peDaCaveira + 3.4 * e.escala * 1.4
  const ax = naAltura(amarra)
  const trapo = poligono([[(ax + 0.4) * k, amarra * k], [(ax + 2.6) * k, (amarra + 0.4) * k], [(ax + 3.4) * k, (amarra + 6.4) * k], [(ax + 2.6) * k, (amarra + 5.4) * k], [(ax + 2.2) * k, (amarra + 7.8) * k], [(ax + 1.4) * k, (amarra + 6) * k], [(ax + 0.7) * k, (amarra + 7.2) * k], [(ax + 0.2) * k, (amarra + 2) * k]])
  L.push(P(trapo, TRAPO, { bisel: 0.5 * k, contorno: 0.3, semente: semente + 2, projeta: { dist: 0.6 * k, forca: 0.3 } }))
  // As voltas de corda, um nada tortas, e a ponta solta.
  for (let j = 0; j < 3; j += 1) {
    const y = amarra - 1 + j * 1.05
    const x = naAltura(y)
    L.push(P(capsula((x - 1.5) * k, (y + 0.25) * k, (x + 1.5) * k, (y - 0.25) * k, 0.42 * k), CORDA, { bisel: 0.3 * k, contorno: 0.25, semente: semente + 3 + j }))
  }
  L.push(P(cadeia([[(ax - 1.2) * k, (amarra + 1.6) * k], [(ax - 1.9) * k, (amarra + 3.6) * k], [(ax - 1.6) * k, (amarra + 5) * k]], 0.3 * k), CORDA, { bisel: 0, contorno: 0.25, semente: semente + 6 }))
  caveiraDeFrente(P, L, topoX * k, caveiraY * k, e.escala * k, e.giro, semente + 10)
}

/** O montinho de terra onde as estacas entram, as pedrinhas e o que caiu: a mandíbula e um osso. */
function chao(c: ContextoDoMovel, cena: Cena, k: number, tres: boolean): void {
  const P = c.peca
  const L = cena.partes
  const monte = tres ? elipse(0, 20.5 * k, 21 * k, 4.4 * k) : elipse(0, 22.4 * k, 8.6 * k, 3 * k)
  L.push(P(monte, TERRA, { bisel: 2.4 * k, contorno: 0.1, alfa: 0.9, suave: 0.6 * k, semente: 9500 }))
  const pedrinhas: readonly (readonly [number, number, number])[] = tres
    ? [[-18, 21.6, 1.1], [-6.5, 23.2, 0.9], [9, 22.8, 1.2], [19.5, 21, 0.9]]
    : [[-6.4, 23, 0.9], [5.6, 23.6, 1.1]]
  pedrinhas.forEach(([x, y, r], i) => L.push(P(elipse(x * k, y * k, r * k, r * 0.75 * k), PEDRINHA, { bisel: 0.5 * k, contorno: 0.25, semente: 9501 + i })))
  // A mandíbula caída, em U aberto, e um osso comprido, deitados na frente.
  const mx = tres ? -7.5 : 6.5
  const my = tres ? 24.6 : 24.4
  const queixo: Ponto[] = [[mx - 3.2, my - 1.4], [mx - 2.4, my + 0.3], [mx, my + 1], [mx + 2.4, my + 0.3], [mx + 3.2, my - 1.4]]
  L.push(P(levada(cadeia(queixo, 0.75), 0, 0, 0, k), OSSO, { bisel: 0.5 * k, contorno: 0.3, textura: texDoOssoVelho(k), semente: 9506 }))
  const [ox, oy] = tres ? [10.5, 25] : [-7.2, 25.2]
  const osso = uniao(capsula((ox - 4) * k, (oy + 0.6) * k, (ox + 4) * k, (oy - 0.6) * k, 0.62 * k), uniao(elipse((ox - 4.1) * k, (oy + 0.6) * k, 1.1 * k, 0.95 * k), elipse((ox + 4.1) * k, (oy - 0.6) * k, 1.1 * k, 0.95 * k)))
  L.push(P(osso, OSSO, { bisel: 0.6 * k, contorno: 0.3, textura: texDoOssoVelho(k), semente: 9507, projeta: { dist: 0.5 * k, forca: 0.3 } }))
}

function estacas(lista: readonly Estaca[], tres: boolean): MontarMovel {
  return (c, cena) => {
    const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
    cena.corDoPiso = ESCURO_DO_OSSO
    const base = tres ? elipse(0, 21 * k, 20 * k, 3.6 * k) : elipse(0, 22.6 * k, 8 * k, 2.4 * k)
    // O contato fraco: a sombra de baixo forte é a da 3/4 em pé (`tresQuartos.ts`), que a folha confere.
    cena.sombras.push(contato(base, 0.14), { forma: base, z: (tres ? 26 : 30) * k, suave: 1.4, forca: 0.22 })
    chao(c, cena, k, tres)
    lista.forEach((e, i) => estaca(c, cena, k, e, i))
  }
}

/** UMA: a 1ª versão, o desenho de `MONTADORES`. */
export const montarEstacaComCranio: MontarMovel = estacas(SO_UMA, false)
/** TRÊS: as três estacas juntas. */
export const montarEstacaComCranioTres: MontarMovel = estacas(AS_TRES, true)
