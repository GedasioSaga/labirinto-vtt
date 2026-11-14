/**
 * BANCOS DE CAPELA de cima com volume (lote L02 de 14/11/2026, o castelo): a
 * fileira de bancos de igreja, um atrás do outro, todos virados para baixo na
 * tela (quem senta olha para o lado de baixo, onde fica o altar). Cada banco,
 * de trás para a frente:
 *
 * - o GENUFLEXÓRIO no chão, atrás do encosto (é de quem senta no banco de
 *   trás): a tábua baixa com a almofada do lugar `estofado` em cima;
 * - o ENCOSTO maciço, a tábua alta com o corrimão claro em cima, que faz
 *   sombra no assento;
 * - o ASSENTO de duas tábuas ao comprido, com a beira da frente boleada;
 * - as duas CABECEIRAS, as tábuas grossas das pontas: altas atrás, com a
 *   voluta redonda e a rosácea entalhada, e baixas na frente (o braço).
 * Num banco, um livro de orações esquecido no assento.
 *
 * O que lê a 25% de zoom são as faixas claras dos encostos, paralelas, presas
 * entre as cabeceiras escuras com a bola da voluta: fileira de bancos. A
 * fileira corre ao longo de x; esticada para baixo ganha mais bancos (um a cada
 * `PASSO_DO_BANCO` casa), esticada para o lado, bancos mais compridos. Na 3/4
 * as alturas saem das sombras: o genuflexório e as cabeceiras são colunas, e o
 * assento e o encosto, tampos no ar (o chão aparece debaixo deles).
 * Materiais: `madeira` e `estofado`.
 */
import { caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato } from './motor'
import { materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** Um banco (com o genuflexório de trás) a cada tanto de casa. */
const PASSO_DO_BANCO = 0.64
/** Alturas em casas: o genuflexório, o assento, o encosto, a voluta da cabeceira e o braço dela. */
const ALTURA_DO_GENUFLEXORIO = 0.1
const ALTURA_DO_ASSENTO = 0.3
const ALTURA_DO_ENCOSTO = 0.64
const ALTURA_DA_VOLUTA = 0.74
const ALTURA_DO_BRACO = 0.44
/** As faixas de um banco, em fração do passo, de trás (0) para a frente (1). */
const FAIXA_DO_GENUFLEXORIO = [0.02, 0.17] as const
const FAIXA_DO_ENCOSTO = [0.2, 0.34] as const
const FAIXA_DO_ASSENTO = [0.31, 0.86] as const
const FAIXA_DA_CABECEIRA = [0.17, 0.89] as const
/** Onde a cabeceira desce da voluta para o braço (fração do passo). */
const FIM_DA_VOLUTA = 0.46
/** A grossura da cabeceira e quanto a voluta é mais larga que ela, em casas. */
const GROSSURA_DA_CABECEIRA = 0.1
const VOLUTA_ALEM = 0.04
/** O genuflexório é mais curto que o banco: fica entre as cabeceiras, com esta folga (casas). */
const FOLGA_DO_GENUFLEXORIO = 0.05
/** Quanto da diferença de altura vira distância da sombra que a peça de cima faz na de baixo (a regra do banco de praça). */
const SOMBRA_POR_ALTURA = 0.3
/** Os tons: o corrimão do encosto pega mais luz (é ele que diz "banco"), o assento um pouco menos. */
const TOM_DO_CORRIMAO = 1.14
const TOM_DO_ENCOSTO = 0.94
const TOM_DO_ASSENTO = 1.02
const TOM_DA_CABECEIRA = 0.86
const TOM_DO_GENUFLEXORIO = 0.78

/** O livro de orações: a capa de couro escuro e as folhas, creme. */
const CAPA = materialDaPeca('vinho')
const FOLHAS = materialDaPeca('linho')

/** Retângulo de meias medidas (mx, my) girado `giro` radianos em volta do meio (o livro torto no assento). */
function retanguloGirado(cx: number, cy: number, mx: number, my: number, giro: number): Forma {
  const co = Math.cos(giro)
  const si = Math.sin(giro)
  const canto = (sx: number, sy: number): Ponto => [cx + sx * mx * co - sy * my * si, cy + sx * mx * si + sy * my * co]
  return poligono([canto(-1, -1), canto(1, -1), canto(1, 1), canto(-1, 1)])
}

export const montarBancosDeCapela: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const estofado = c.m.estofado
  const L = cena.partes
  const n = Math.max(1, Math.round(c.h / (PASSO_DO_BANCO * g)))
  const passo = c.h / n
  const casa = Math.min(g, c.w)
  const grossura = GROSSURA_DA_CABECEIRA * casa
  const xFora = hw - 0.5
  const xDentro = xFora - grossura
  const zGenu = g * ALTURA_DO_GENUFLEXORIO
  const zAssento = g * ALTURA_DO_ASSENTO
  const zEncosto = g * ALTURA_DO_ENCOSTO
  const zVoluta = g * ALTURA_DA_VOLUTA
  const zBraco = g * ALTURA_DO_BRACO

  for (let b = 0; b < n; b += 1) {
    const topo = -hh + b * passo
    const y = (f: number): number => topo + f * passo

    // O genuflexório: a tábua baixa e a almofada por cima, entre as cabeceiras.
    const xGenu = xDentro - FOLGA_DO_GENUFLEXORIO * casa
    const genu = caixa(-xGenu, y(FAIXA_DO_GENUFLEXORIO[0]), xGenu, y(FAIXA_DO_GENUFLEXORIO[1]), 1)
    cena.sombras.push({ forma: genu, z: zGenu }, contato(genu, 0.3))
    L.push(P(genu, mad, { tabua: 0, bisel: 0.9, tom: TOM_DO_GENUFLEXORIO, contorno: 0.24, semente: 5000 + b }))
    const almofada = caixa(-xGenu + 1.2, y(FAIXA_DO_GENUFLEXORIO[0]) + 0.9, xGenu - 1.2, y(FAIXA_DO_GENUFLEXORIO[1]) - 0.9, 1.6)
    L.push(P(almofada, estofado, { bisel: 1.8, contorno: 0.2, ruga: 0.4, semente: 5010 + b }))

    // A sombra de baixo do banco: o escuro do chão debaixo do assento.
    const yA0 = y(FAIXA_DO_ASSENTO[0])
    const yA1 = y(FAIXA_DO_ASSENTO[1])
    cena.sombras.push({ forma: caixa(-xDentro, yA0, xDentro, yA1 + 1.2, 1.5), z: 0, suave: 1.5, forca: 0.32 })

    // O assento: duas tábuas ao comprido, a da frente mais boleada, entre as cabeceiras.
    const assento = caixa(-xDentro - 0.6, yA0, xDentro + 0.6, yA1, 1.2)
    cena.sombras.push({ forma: assento, z: zAssento, solta: true })
    const meioDoAssento = (yA0 + yA1) / 2
    L.push(P(caixa(-xDentro - 0.6, yA0, xDentro + 0.6, meioDoAssento + 0.3, 0.8), mad, { tabua: 0, bisel: 1, tom: TOM_DO_ASSENTO, contorno: 0.22, semente: 5020 + b }))
    L.push(P(caixa(-xDentro - 0.6, meioDoAssento - 0.3, xDentro + 0.6, yA1, 1.2), mad, { tabua: 0, bisel: 2, tom: TOM_DO_ASSENTO * 1.04, contorno: 0.22, semente: 5030 + b }))

    // O livro de orações aberto no assento, torto, num banco sim, outro não: a capa e as duas páginas claras.
    if (b % 2 === 0) {
      const xl = (b % 4 === 0 ? -0.42 : 0.3) * xDentro
      const yl = meioDoAssento + 0.2
      const giro = b % 4 === 0 ? -0.3 : 0.22
      L.push(P(retanguloGirado(xl, yl, 5.6, 3.7, giro), CAPA, { bisel: 0.6, contorno: 0.28, tom: 0.7, semente: 5040 + b, projeta: { dist: 0.9, forca: 0.32, suave: 0.6 } }))
      for (const lado of [-1, 1]) {
        const cx = xl + lado * 2.6 * Math.cos(giro)
        const cy = yl + lado * 2.6 * Math.sin(giro)
        L.push(P(retanguloGirado(cx, cy, 2.45, 3.2, giro), FOLHAS, { bisel: 0.9, contorno: 0.16, tom: lado < 0 ? 1.04 : 0.96, semente: 5045 + b + lado }))
      }
    }

    // O encosto e o corrimão claro em cima dele, fazendo sombra no assento. O encosto é um tampo no ar (a
    // beirada da 3/4 é a tábua dele): como coluna, a frente descia até o chão e a fileira virava uma cômoda.
    const yE0 = y(FAIXA_DO_ENCOSTO[0])
    const yE1 = y(FAIXA_DO_ENCOSTO[1])
    const encosto = caixa(-xDentro - 0.4, yE0, xDentro + 0.4, yE1, 0.8)
    cena.sombras.push({ forma: encosto, z: zEncosto, solta: true })
    L.push(P(encosto, mad, { tabua: 0, bisel: 1, tom: TOM_DO_ENCOSTO, contorno: 0.24, semente: 5050 + b, projeta: { dist: (zEncosto - zAssento) * SOMBRA_POR_ALTURA, forca: 0.34, suave: 1.3 } }))
    const corrimao = caixa(-xDentro - 0.4, yE0 - 0.5, xDentro + 0.4, yE0 + (yE1 - yE0) * 0.62, 1.2)
    L.push(P(corrimao, mad, { tabua: 0, bisel: 1.5, tom: TOM_DO_CORRIMAO, contorno: 0.16, semente: 5060 + b }))

    // As cabeceiras: o braço baixo na frente e a voluta alta atrás, com a rosácea entalhada.
    const yC0 = y(FAIXA_DA_CABECEIRA[0])
    const yC1 = y(FAIXA_DA_CABECEIRA[1])
    const yV = y(FIM_DA_VOLUTA)
    for (const lado of [-1, 1]) {
      const x0 = lado < 0 ? -xFora : xDentro
      const x1 = lado < 0 ? -xDentro : xFora
      const xm = (x0 + x1) / 2
      const braco = caixa(x0, yV - 1, x1, yC1, grossura * 0.48)
      const rV = grossura / 2 + VOLUTA_ALEM * casa
      const voluta = uniao(caixa(x0, yC0 + rV * 0.6, x1, yV, grossura * 0.3), elipse(xm, yC0 + rV, rV, rV))
      cena.sombras.push({ forma: braco, z: zBraco }, { forma: voluta, z: zVoluta }, contato(uniao(braco, voluta), 0.32))
      L.push(P(braco, mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: TOM_DA_CABECEIRA * 1.06, contorno: 0.26, semente: 5070 + b * 2 + lado }))
      L.push(P(voluta, mad, { eixo: QUARTO, tabua: 0, bisel: 1.6, tom: TOM_DA_CABECEIRA, contorno: 0.28, semente: 5080 + b * 2 + lado, projeta: { dist: (zVoluta - zBraco) * SOMBRA_POR_ALTURA, forca: 0.3, suave: 1.2 } }))
      L.push(P(elipse(xm, yC0 + rV, rV * 0.52, rV * 0.52), mad, { tabua: 0, bisel: 0.7, tom: TOM_DA_CABECEIRA * 0.84, contorno: 0.12, recesso: { k: 0.9, forca: 0.3 }, semente: 5090 + b }))
      L.push(P(elipse(xm, yC0 + rV, rV * 0.2, rV * 0.2), mad, { tabua: 0, bisel: 0.5, tom: TOM_DA_CABECEIRA * 1.18, contorno: 0.1, semente: 5095 + b }))
    }
  }
}
