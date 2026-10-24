/**
 * MESA QUE LÊ COMO MESA, vista de cima com volume (pedido do usuário de
 * 24/10/2026: "a mesa parece um móvel, não uma mesa"). As três formas
 * (retangular, quadrada e redonda) saem daqui, com as mesmas peças:
 *
 * - o TAMPO de tábuas, recuado da pegada, com a quina arredondada (chanfro) e a
 *   BORDA mais clara que o miolo (a quina gasta de mão pega luz);
 * - a ESPESSURA do tampo: o mesmo contorno, mais escuro, aparecendo embaixo
 *   (e um fio à direita), como a face da tábua grossa;
 * - as PERNAS à mostra: nas quinas da pegada, fora do tampo (retangular e
 *   quadrada), ou 4 pontos saindo da borda nas diagonais (redonda), mais
 *   escuras que o tampo (estão na sombra dele), cada uma com o contato no chão
 *   e a sombra arrastada até a altura do tampo;
 * - a SOMBRA DE BAIXO, o escuro do chão debaixo da mesa, logo em volta do
 *   tampo e mais pesada que a SOMBRA DO TAMPO, que cai solta e mais clara para
 *   baixo à direita: a mesa "flutua" sobre as pernas.
 *
 * As medidas são POR CASA (`G`), não pela pegada: a tábua, a perna, o recuo e
 * a borda são os mesmos numa mesa de 2 x 1 e de 3 x 1 (a mais longa ganha mais
 * comprimento, não tábuas mais largas). Só uma pegada menor que uma casa
 * encolhe tudo junto (`k`). Material: `madeira`.
 */
import { caixa, elipse, type Caixa, type Forma } from './formas'
import { contato, texturaDaClasse, type Cena, type Sombra, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel } from './contexto'

/** Altura do tampo, em casas (meia casa, como a mesa do protótipo). */
const ALTURA_EM_CASAS = 0.5
/** Recuo do tampo em relação à pegada, em casas: é por onde as pernas aparecem. */
const RECUO_DO_TAMPO = 0.075
/** Recuo do tampo redondo (as pernas saem pelas diagonais, onde a pegada tem sobra). */
const RECUO_DO_TAMPO_REDONDO = 0.03
/** Lado da perna (retangular e quadrada) e raio da perna redonda, em casas. */
const LADO_DA_PERNA = 0.12
const RAIO_DA_PERNA_REDONDA = 0.06
/** Quanto o centro da perna da mesa redonda fica além da borda do tampo, na diagonal, em casas. */
const PERNA_REDONDA_ALEM = 0.011
/** Largura da tábua do tampo, em casas: 5 tábuas por casa de largura. */
const LARGURA_DA_TABUA = 0.2
/** Raio da quina do tampo retangular, em casas. */
const RAIO_DA_QUINA = 0.04
/** Espessura do tampo que aparece embaixo (e um fio à direita), em casas. */
const ESPESSURA_EMBAIXO = 0.032
const ESPESSURA_A_DIREITA = 0.008
/** A borda clara: largura (em casas) e luz somada na quina, caindo até zero no fim da faixa. */
const LARGURA_DA_BORDA_CLARA = 0.055
const LUZ_DA_BORDA_CLARA = 0.2
/** A sombra de baixo passa do tampo por esta faixa (em casas), com o borrão do mesmo tamanho. */
const SOMBRA_DE_BAIXO_ALEM = 0.025
/** Borrão da sombra do tampo e do rastro da perna (px do protótipo): firmes, para o rastro da perna se ler. */
const SUAVE_DA_SOMBRA_DO_TAMPO = 1.8
const SUAVE_DA_SOMBRA_DA_PERNA = 0.9

/** Força das sombras: a de baixo é a mais pesada; a do tampo, solta, é mais clara. */
const FORCA_DA_SOMBRA_DE_BAIXO = 0.4
const FORCA_DA_SOMBRA_DO_TAMPO = 0.22
const FORCA_DO_CONTATO_DA_PERNA = 0.34
const FORCA_DA_SOMBRA_DA_PERNA = 0.3

/** Tons das peças, sobre o tom do material. */
const TOM_DO_TAMPO = 0.97
const TOM_DA_ESPESSURA = 0.66
const TOM_DA_PERNA = 0.64

/** Onde fica cada peça da mesa, em px do protótipo (centro na origem). Os testes leem isto para achar as pernas. */
export interface GeometriaDaMesa {
  /** Px do protótipo por casa já com o encolhimento de pegada pequena. */
  readonly casa: number
  readonly altura: number
  /** Caixa do tampo (na redonda, a caixa da elipse). */
  readonly tampo: Caixa
  readonly redonda: boolean
  /** Caixa de cada perna, na ordem: em cima à esquerda, em cima à direita, embaixo à esquerda, embaixo à direita. */
  readonly pernas: readonly Caixa[]
  readonly larguraDaTabua: number
  readonly larguraDaBordaClara: number
}

/** Encolhimento de pegada menor que uma casa: as medidas por casa não passam da pegada. */
function casaDa(c: ContextoDoMovel): number {
  return Math.min(c.g, c.w, c.h)
}

const QUINAS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]]

export function geometriaDaMesa(c: ContextoDoMovel, redonda: boolean): GeometriaDaMesa {
  const casa = casaDa(c)
  const { hw, hh } = c
  const base = { casa, altura: c.g * ALTURA_EM_CASAS, redonda, larguraDaTabua: LARGURA_DA_TABUA * casa, larguraDaBordaClara: LARGURA_DA_BORDA_CLARA * casa }
  if (redonda) {
    const recuo = RECUO_DO_TAMPO_REDONDO * casa
    const rx = hw - recuo
    const ry = hh - recuo
    const r = RAIO_DA_PERNA_REDONDA * casa
    const alem = PERNA_REDONDA_ALEM * casa
    const pernas = QUINAS.map(([sx, sy]): Caixa => {
      const px = sx * (rx + alem) * Math.SQRT1_2
      const py = sy * (ry + alem) * Math.SQRT1_2
      return [px - r, py - r, px + r, py + r]
    })
    return { ...base, tampo: [-rx, -ry, rx, ry], pernas }
  }
  const recuo = RECUO_DO_TAMPO * casa
  const lado = LADO_DA_PERNA * casa
  const pernas = QUINAS.map(([sx, sy]): Caixa => {
    const x0 = sx < 0 ? -hw : hw - lado
    const y0 = sy < 0 ? -hh : hh - lado
    return [x0, y0, x0 + lado, y0 + lado]
  })
  return { ...base, tampo: [-hw + recuo, -hh + recuo, hw - recuo, hh - recuo], pernas }
}

/** O contorno do tampo (ou dele crescido por `alem`, a sombra de baixo). */
export function formaDoTampo(g: GeometriaDaMesa, alem = 0): Forma {
  const [x0, y0, x1, y1] = g.tampo
  if (g.redonda) return elipse(0, 0, (x1 - x0) / 2 + alem, (y1 - y0) / 2 + alem)
  return caixa(x0 - alem, y0 - alem, x1 + alem, y1 + alem, RAIO_DA_QUINA * g.casa + alem)
}

function formaDaPerna(g: GeometriaDaMesa, b: Caixa): Forma {
  if (g.redonda) return elipse((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, (b[2] - b[0]) / 2, (b[3] - b[1]) / 2)
  return caixa(b[0], b[1], b[2], b[3], 0.12 * (b[2] - b[0]))
}

/** O veio de madeira com a borda clara: a luz cresce do fim da faixa até a quina do tampo. */
function madeiraComBordaClara(forma: Forma, largura: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < largura) s[3] += LUZ_DA_BORDA_CLARA * (1 - (t > 0 ? t : 0) / largura)
  }
}

/** As sombras no chão: a de baixo (pesada, logo em volta do tampo), a do tampo (solta) e as de cada perna. */
function sombrasDaMesa(g: GeometriaDaMesa, pernas: readonly Forma[]): Sombra[] {
  const alem = SOMBRA_DE_BAIXO_ALEM * g.casa
  const sombras: Sombra[] = [
    { forma: formaDoTampo(g, alem), z: 0, suave: alem, forca: FORCA_DA_SOMBRA_DE_BAIXO },
    { forma: formaDoTampo(g), z: g.altura, solta: true, suave: SUAVE_DA_SOMBRA_DO_TAMPO, forca: FORCA_DA_SOMBRA_DO_TAMPO },
  ]
  for (const perna of pernas) {
    const b = perna.b
    const folga = 0.08 * (b[2] - b[0])
    sombras.push(contato(caixa(b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga, 0.3 * (b[2] - b[0])), FORCA_DO_CONTATO_DA_PERNA), { forma: perna, z: g.altura, suave: SUAVE_DA_SOMBRA_DA_PERNA, forca: FORCA_DA_SOMBRA_DA_PERNA })
  }
  return sombras
}

/**
 * A mesa inteira. `semente` separa o veio de cada tipo (a retangular, a
 * quadrada e a redonda não têm as mesmas tábuas). As tábuas correm ao longo do
 * lado maior; na redonda, em faixas.
 */
export function montarMesaComPernas(c: ContextoDoMovel, cena: Cena, redonda: boolean, semente: number): void {
  const g = geometriaDaMesa(c, redonda)
  const P = c.peca
  const mad = c.m.madeira
  const tampo = formaDoTampo(g)
  const pernas = g.pernas.map((b) => formaDaPerna(g, b))
  const eixo = c.w >= c.h ? 0 : QUARTO
  cena.sombras.push(...sombrasDaMesa(g, pernas))
  // A última peça da lista fica por cima: as pernas, a espessura do tampo e o tampo.
  pernas.forEach((perna, i) => cena.partes.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, contorno: 0.16, tom: TOM_DA_PERNA, semente: semente + 4 + i })))
  cena.partes.push(P(tampo, mad, { eixo, dx: ESPESSURA_A_DIREITA * g.casa, dy: ESPESSURA_EMBAIXO * g.casa, tabua: 0, bisel: 0.7, contorno: 0.2, tom: TOM_DA_ESPESSURA, semente: semente + 3 }))
  cena.partes.push(P(tampo, mad, { eixo, tabua: g.larguraDaTabua, bisel: 1.6, contorno: 0.06, tom: TOM_DO_TAMPO, semente, textura: madeiraComBordaClara(tampo, g.larguraDaBordaClara) }))
}
