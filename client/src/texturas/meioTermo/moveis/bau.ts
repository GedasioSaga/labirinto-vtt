/**
 * BAÚ de cima com volume (`objetos.js:997-1063`). De Frente: a tampa em arco
 * com duas cintas, os rebites, as cantoneiras e o fecho com o buraco da
 * fechadura. De Lado: o corpo, a tampa em arco com a cinta de ferro e a alça.
 * Materiais: `madeira` e `ferragens`.
 *
 * NA 3/4 A FRENTE É DESENHADA (15/11/2026, "o 3/4 do baú é estranho"): antes a
 * tampa subia inteira e a frente era a madeira lisa que a 3/4 varre, do mesmo
 * tamanho que a tampa, com o fecho na beira de cima. Agora a frente mostra a
 * TAMPA (a faixa de cima, de tábuas deitadas) e o CORPO, separados pela fresta
 * com a sombra da tampa; as duas CINTAS descem do tampo até o chão, partidas na
 * fresta, com os rebites; as cantoneiras fecham os quatro cantos. É a frente em
 * faixas do guarda-roupa (`guardaRoupa.ts`), toda guardada debaixo da tampa na
 * vista de cima. O FECHO é uma peça só com a fresta dele, como o puxador do
 * guarda-roupa: de cima fica na beira da frente, como sempre foi; na 3/4 desce
 * pela frente e fica pendurado da tampa sobre o corpo, com a fechadura. Com o
 * baú girado a frente dele fica de lado ou atrás, e o fecho sobe com a tampa,
 * na beira dela, como antes.
 */
import { anel, caixa, dentroDe, elipse, poligono, uniao, type Forma } from './formas'
import { contato, type Cena, type CurvaY, type MaterialDaPeca } from './motor'
import { BURACO, sombraDeLado, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, naFaixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { comMeioEm, quartosDeVolta } from './varalDeBandeirinhas'

/** Altura do baú de lado, em px do protótipo (a sombra). */
const ALTURA_DE_LADO = 12
/** Altura do baú de frente, em casas (a sombra; na 3/4, a frente). */
const ALTURA = 0.55

function montarBauDeLado(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const costura = -hh + h * 0.4
  const raio = costura + hh
  const corpo = caixa(-hw, costura, hw, hh, 0.6)
  const arco = dentroDe(elipse(0, costura, hw, raio), caixa(-hw, -hh - 1, hw, costura + 0.5))
  sombraDeLado(cena, uniao(corpo, arco), ALTURA_DE_LADO)
  const L = cena.partes
  L.push(P(corpo, mad, { tabua: (hh - costura) / 3, bisel: 0.9, semente: 8 }))
  L.push(P(arco, mad, { tabua: raio / 2, bisel: 1, semente: 9 }))
  L.push(P(dentroDe(anel(0, costura, hw, raio, hw - 2.4, raio - 2.4), caixa(-hw, -hh - 1, hw, costura)), fer, { bisel: 0.8, contorno: 0.25 }))
  L.push(P(caixa(-hw, costura - 0.4, hw, costura + 1.6, 0.3), fer, { bisel: 0.6, tom: 0.92 }))
  const ya = costura + (hh - costura) * 0.5
  L.push(P(caixa(-3.4, ya - 3.4, 3.4, ya - 1.6, 0.5), fer, { bisel: 0.6 }))
  L.push(P(anel(0, ya + 0.2, 3.1, 3.1, 1.9, 1.9), fer, { bisel: 0.6, projeta: { dist: 0.8, forca: 0.3 } }))
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    L.push(P(poligono([[xa, hh], [xa - sx * 5, hh], [xa, hh - 5]]), fer, { bisel: 0.6 }))
  }
}

/** A tampa vista de cima: tábuas em arco, as duas cintas com rebites e as quatro cantoneiras. */
function tampa(c: ContextoDoMovel, cena: Cena, arco: CurvaY): void {
  const { hw, hh, w, h, peca: P } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const L = cena.partes
  L.push(P(caixa(-hw, -hh, hw, hh, 2), mad, { tabua: h / 4, bisel: 1.2, curvaY: arco, semente: 2 }))
  for (const sx of [-1, 1]) {
    const xc = sx * 0.3 * w
    L.push(P(caixa(xc - 0.045 * w, -hh, xc + 0.045 * w, hh, 0.5), fer, { bisel: 0.8, curvaY: arco, projeta: { dist: 0.8, forca: 0.25, suave: 0.7 }, semente: 3 + sx }))
    for (const fy of [-0.32, 0, 0.32]) L.push(P(elipse(xc, fy * h, 0.9, 0.9), fer, { bisel: 0.9, contorno: 0.1, tom: 0.9 }))
  }
  const cw = 0.13 * w
  const ch = 0.2 * h
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const xa = sx * hw
    const ya = sy * hh
    L.push(P(poligono([[xa, ya], [xa - sx * cw, ya], [xa, ya - sy * ch]]), fer, { bisel: 0.7, curvaY: arco, contorno: 0.2 }))
  }
}

// ---------- a frente na 3/4, desenhada de frente ----------

/** Onde a tampa encontra o corpo, em fração da altura a partir do chão (a tampa é o terço de cima). */
const COSTURA = 0.64
/** Os tons da madeira vista de frente: o corpo na sombra da tampa e a frente da tampa, um pouco mais clara. */
const TOM_DO_CORPO = 0.8
const TOM_DA_TAMPA = 0.9
/** A altura da sombra que a tampa faz no alto do corpo (px). */
const ALTO_DA_SOMBRA_DA_TAMPA = 3
/** As cintas (o meio, em fração da largura, e a meia largura) e as alturas dos rebites (frações da altura). */
const CINTA = { meio: 0.3, meiaLargura: 0.045 } as const
const REBITES_DA_FRENTE: readonly number[] = [0.82, 0.46, 0.14]
/** As cantoneiras da frente: o braço deitado (fração da largura) e o de pé (fração da altura). */
const CANTONEIRA_DA_FRENTE = { deitada: 0.13, dePe: 0.22 } as const
/**
 * O fecho: a meia largura (fração da largura), a parte da profundidade que ele ocupa de cima, onde fica a fechadura
 * (fração do fecho a partir da beira) e quanto passa da beira (px). O fundo tem teto em fração da altura do corpo:
 * no baú fundo demais o fecho, pendurado na 3/4, passaria do chão.
 */
const FECHO = { meiaLargura: 0.065, fundo: 0.26, fechadura: 0.46, alem: 0.6, tetoNoCorpo: 0.6 } as const
/** Na 3/4, o alto do fecho fica este tanto acima da fresta da tampa (px): ele pende da tampa sobre o corpo. */
const FECHO_SOBRE_A_TAMPA = 3

/** A frente inteira, de frente (x como na pegada, y = 0 no chão e negativo para cima). */
function desenharFrente(c: ContextoDoMovel, H: number): PecaDaFrente[] {
  const { hw, w } = c
  const mad = c.m.madeira
  const fer = c.m.ferragens
  const pecas: PecaDaFrente[] = []
  const por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente): void => {
    pecas.push({ forma, mat, o })
  }
  const yc = -H * COSTURA
  // O corpo de tábuas deitadas e, no alto dele, a sombra da tampa.
  por(caixa(-hw, yc, hw, 0, 0.8), mad, { eixo: 0, tabua: (H * COSTURA) / 3, bisel: 0.9, tom: TOM_DO_CORPO, semente: 960 })
  por(caixa(-hw + 0.6, yc, hw - 0.6, yc + ALTO_DA_SOMBRA_DA_TAMPA, 0), SOMBRA_DA_MADEIRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.4, semente: 961 })
  // A frente da tampa e a fresta entre ela e o corpo.
  por(caixa(-hw, -H, hw, yc - 0.5, 1.2), mad, { eixo: 0, tabua: (H * (1 - COSTURA)) / 2, bisel: 1.1, tom: TOM_DA_TAMPA, semente: 962 })
  por(caixa(-hw + 0.3, yc - 0.7, hw - 0.3, yc + 0.3), BURACO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 963 })
  // As cintas, do tampo até o chão, partidas na fresta, com os rebites.
  for (const sx of [-1, 1]) {
    const xc = sx * CINTA.meio * w
    const m = CINTA.meiaLargura * w
    por(caixa(xc - m, -H, xc + m, yc - 0.6, 0.4), fer, { bisel: 0.8, contorno: 0.22, semente: 964 })
    por(caixa(xc - m, yc + 0.4, xc + m, 0, 0.4), fer, { bisel: 0.8, contorno: 0.22, tom: 0.92, semente: 965 })
    for (const f of REBITES_DA_FRENTE) por(elipse(xc, -H * f, 0.9, 0.9), fer, { bisel: 0.9, contorno: 0.1, tom: 0.9 })
  }
  // As cantoneiras: as de cima da tampa e as de baixo do corpo.
  const cw = CANTONEIRA_DA_FRENTE.deitada * w
  const ch = CANTONEIRA_DA_FRENTE.dePe * H
  for (const sx of [-1, 1]) {
    const xa = sx * hw
    por(poligono([[xa, -H], [xa - sx * cw, -H], [xa, -H + ch]]), fer, { bisel: 0.7, contorno: 0.2 })
    por(poligono([[xa, 0], [xa - sx * cw, 0], [xa, -ch]]), fer, { bisel: 0.7, contorno: 0.2 })
  }
  return pecas
}

/**
 * A frente toda guardada debaixo da tampa (sem faixa de cima: de cima o baú é a tampa, como sempre foi): o corpo
 * até a frente, as cantoneiras, as frestas das faixas e a do fecho na beira, e as cópias da frente, que vêm antes da
 * tampa na lista para ela as cobrir de cima.
 */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number, altoDoFecho: number): void {
  const { hw, hh, h } = c
  const { faixas, frente } = fatiar(H, 0, 0, h, hh)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 2), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const zDoFecho = altoDoFecho - (frente - H * COSTURA - FECHO_SOBRE_A_TAMPA)
  cena.sombras.push({ forma: caixa(-0.15, hh - FRESTA, 0.15, hh), z: zDoFecho, solta: true, forca: 0 })
  const desenho = desenharFrente(c, H)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

export const montarBau: MontarMovel = (c, cena) => {
  if (c.lado === 'lado') {
    montarBauDeLado(c, cena)
    return
  }
  const { hw, hh, w, h, g, peca: P } = c
  const H = g * ALTURA
  const corpo = caixa(-hw, -hh, hw, hh, 2)
  const fundoDoFecho = Math.min(FECHO.fundo * h, FECHO.tetoNoCorpo * H * COSTURA)
  const altoDoFecho = hh - fundoDoFecho
  // Sem giro, a frente desenhada. Girado, ela fica de lado ou atrás na 3/4, que só varre a madeira, como antes: a
  // frente guardada ali só deixaria um fio dela na beira da lateral.
  const deFrente = quartosDeVolta(c.giro) === 0
  if (deFrente) guardarAFrente(c, cena, H, altoDoFecho)
  else cena.sombras.push({ forma: corpo, z: H })
  cena.sombras.push(contato(corpo))
  tampa(c, cena, { c: 0, r: hh, forca: 0.55 })
  // O fecho na frente, com o buraco da fechadura. Sem giro, o meio da caixa dos dois fica na fresta do fecho, que os
  // sobe só até a altura dele na frente: na 3/4 ele pende da tampa sobre o corpo. Girado, ele sobe com a tampa, na
  // beira dela, como se vê de cima.
  const yDoFecho = hh - FRESTA / 2
  const naFresta = (f: Forma): Forma => (deFrente ? comMeioEm(f, 0, yDoFecho) : f)
  const mf = FECHO.meiaLargura * w
  cena.partes.push(P(naFresta(caixa(-mf, altoDoFecho, mf, hh + FECHO.alem, 0.8)), c.m.ferragens, { bisel: 0.9, projeta: { dist: 0.9, forca: 0.3 } }))
  cena.partes.push(P(naFresta(elipse(0, hh - FECHO.fechadura * fundoDoFecho, 0.75, 1.15)), BURACO, { bisel: 0, contorno: 0 }))
}
