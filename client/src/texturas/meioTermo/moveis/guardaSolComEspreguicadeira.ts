/**
 * GUARDA-SOL COM ESPREGUIÇADEIRA de cima com volume (lote L11 dos objetos
 * novos, 14/11/2026, "Descanso e brincadeira"): o GUARDA-SOL de oito gomos,
 * alternando a cor do pano e o linho cru, aberto no alto do mastro no canto
 * do noroeste, e ao lado dele, ao leste, a ESPREGUIÇADEIRA de madeira e lona
 * listrada, de encosto deitado para o norte, com a TOALHA enrolada no alto do
 * encosto.
 *
 * O guarda-sol de cima: cada gomo é um plano que desce do meio para a beira,
 * então pega a luz pela direção dele (os do noroeste claros, os do sudeste
 * escuros), com as VARETAS escuras entre os gomos, a SANEFA recortada em
 * meias-luas na beira e a PONTEIRA de madeira no meio. A sombra dele cai longe
 * no chão, para o sudeste, por baixo da espreguiçadeira: é ela que diz que o
 * pano está alto. A 25% de zoom sobram o octógono de gomos e a cadeira
 * listrada ao lado: é o que diz "praia" e não "mesa redonda".
 *
 * Na 3/4 (perfil derivado sem beirada, `espessura: 0`):
 * - o pano é um tampo solto no alto do mastro, e o mastro é uma coluna do chão
 *   até ele. A 3/4 sobe cada peça com a estrutura mais alta que contém o meio
 *   da caixa dela, e pinta a frente de cada coluna com o material da maior
 *   peça dela: a estrutura do pano tem um furo em volta do mastro, para o
 *   miolo do mastro (a peça que dá a madeira à frente dele) ficar na coluna do
 *   mastro; o pano leva a caixa puxada para o noroeste (`naCaixa`), para o
 *   meio dela sair do furo; e a ponteira tem uma estrutura miúda fora do
 *   mastro, com a caixa esticada até depois da beira do pano, para ser pintada
 *   por último, por cima do pano;
 * - o assento da espreguiçadeira é um tampo solto nas quatro pernas (colunas);
 *   o encosto é cortado em fatias de norte a sul (`tampoEmFatias.ts`), cada uma
 *   na altura do encosto naquele ponto, e sai deitado.
 *
 * Desenhado em 2 x 2 casas; as posições saem da pegada (desenho em 112 x 112
 * px) e as alturas, em casas. Materiais: `pano` (o guarda-sol e a lona; as
 * listras são de linho cru, ou de vinho no pano de linho, a conta do toldo) e
 * `madeira` (o mastro e a espreguiçadeira).
 */
import { passoSuave } from '../../ruido'
import { capsula, caixa, dentroDe, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { circulo, emFatias, noAr } from './tampoEmFatias'

/** O tamanho em que o desenho é feito (px do protótipo): 2 x 2 casas. */
const LADO_DO_DESENHO = 112

/** O guarda-sol (px do desenho): o meio, o raio até a ponta de cada gomo e o raio do mastro. */
const MEIO_DO_GUARDA_SOL: Ponto = [-15, -15]
const RAIO_DO_GUARDA_SOL = 40
const RAIO_DO_MASTRO = 1.4
/** Alturas em casas: o pano e a ponteira acima dele. */
const ALTURA_DO_PANO = 1.35
const GOMOS = 8
/** A luz de cada gomo pela direção dele, e a barriga do pano entre duas varetas (luz somada). */
const LUZ_DO_GOMO = 0.13
const BARRIGA_DO_GOMO = 0.05
/** A sanefa: a largura da faixa da beira (px do desenho) e as meias-luas, uma a cada tanto de px ao longo dela. */
const LARGURA_DA_SANEFA = 3.4
const PASSO_DA_SANEFA = 5.6
/** O rumo de onde a luz vem, na tela (o noroeste: as sombras caem para o sudeste). */
const RUMO_DA_LUZ = Math.atan2(-SOMBRA_Y, -SOMBRA_X)

/** A espreguiçadeira (px do desenho): o meio de través, a meia largura, o alto do encosto, a dobra e o pé. */
const X_DA_CADEIRA = 38
const MEIA_CADEIRA = 12.5
const Y_DO_ENCOSTO = -30
const Y_DA_DOBRA = -6
const Y_DO_PE = 52
/** Alturas em casas: o assento e o alto do encosto. */
const ALTURA_DO_ASSENTO = 0.26
const ALTURA_DO_ENCOSTO = 0.7
/** A largura do braço de madeira (o trilho de cada lado) e das pernas (px do desenho). */
const LARGURA_DO_TRILHO = 2.6
const LADO_DA_PERNA = 2.6
const FATIAS_DO_ENCOSTO = 16
/**
 * A lona do encosto fica um tom abaixo da do assento: deitado para trás, o encosto vira a cara para o sul, de
 * costas para a luz do noroeste. É o que separa o encosto do assento de cima e na 3/4.
 */
const TOM_DO_ENCOSTO = 0.86
const SOBRA = 2.4
/** As listras da lona ao comprido, em fração da meia largura da lona: [de, até] de cada lado do meio. */
const LISTRAS_DA_LONA: readonly (readonly [number, number])[] = [
  [0, 0.16],
  [0.48, 0.66],
]

/** A cor das listras: linho cru; no pano de linho, vinho (linho sobre linho dava um pano liso). */
function corDaListra(pano: MaterialDaPeca): MaterialDaPeca {
  return materialDaPeca(pano.fio === 'linho' ? 'vinho' : 'linho')
}

/** A mesma forma com outra caixa de pintura (a 3/4 lê o meio da caixa para saber com quem a peça sobe). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: f.d }
}

/** O octógono do guarda-sol, com uma ponta de gomo em cada vareta. */
function octogono(cx: number, cy: number, R: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < GOMOS; i += 1) {
    const a = (i * 2 * Math.PI) / GOMOS
    pontos.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R])
  }
  return poligono(pontos)
}

/**
 * O PANO do guarda-sol: a cor de cada gomo (um sim, um não, a do pano e a da listra), a luz do gomo pela direção
 * dele, a barriga entre duas varetas, a vareta escura e a sanefa da beira, da outra cor, recortada em meias-luas.
 */
function texDoGuardaSol(cx: number, cy: number, forma: Forma, listra: MaterialDaPeca): Textura {
  const trama = texturaDaClasse('tecido')
  const passo = (2 * Math.PI) / GOMOS
  return (u, v, x, y, p, s, escala) => {
    if (trama !== null) trama(u, v, x, y, p, s, escala)
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy)
    let a = Math.atan2(dy, dx)
    if (a < 0) a += 2 * Math.PI
    const gomo = Math.floor(a / passo)
    const dentro = a / passo - gomo
    const daBeira = -forma.d(x, y)
    // A sanefa: a faixa da beira, da cor do gomo vizinho, recortada em meias-luas.
    const naSanefa = daBeira < LARGURA_DA_SANEFA
    const outra = (gomo % 2 === 0) === naSanefa
    if (outra) for (let i = 0; i < 3; i += 1) s[i] = listra.rgb[i]
    if (naSanefa) {
      const f = (r * a) / PASSO_DA_SANEFA - Math.floor((r * a) / PASSO_DA_SANEFA)
      const recorte = LARGURA_DA_SANEFA * 0.55 * Math.sin(Math.PI * f)
      if (daBeira < LARGURA_DA_SANEFA * 0.55 - recorte) {
        s[5] = 0
        return
      }
      s[3] -= 0.05
    }
    const meioDoGomo = (gomo + 0.5) * passo
    let luz = LUZ_DO_GOMO * Math.cos(meioDoGomo - RUMO_DA_LUZ) - BARRIGA_DO_GOMO * Math.sin(Math.PI * dentro)
    // A vareta: um risco escuro de meio pixel entre dois gomos.
    const ateVareta = Math.min(dentro, 1 - dentro) * passo * r
    const largura = 0.5 + 0.45 / escala
    if (ateVareta < largura && !naSanefa) luz -= 0.22 * passoSuave(largura, 0, ateVareta)
    s[3] += luz + ruido(x * 0.1 + p.su, y * 0.1) * 0.025
  }
}

/** A LONA da espreguiçadeira: a trama, as listras ao comprido e a barriga (o meio da lona cede). */
function texDaLona(xc: number, meia: number, listra: MaterialDaPeca, yDaDobra: number): Textura {
  const trama = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (trama !== null) trama(u, v, x, y, p, s, escala)
    const q = Math.abs(x - xc) / meia
    const borda = 0.5 / (escala * meia)
    let naListra = 0
    for (const [de, ate] of LISTRAS_DA_LONA) naListra = Math.max(naListra, passoSuave(de - borda, de + borda, q) * (1 - passoSuave(ate - borda, ate + borda, q)))
    for (let i = 0; i < 3; i += 1) s[i] += (listra.rgb[i] - s[i]) * naListra
    s[3] -= 0.06 * (1 - q * q)
    // A dobra entre o encosto e o assento: a lona vinca.
    const ateDobra = Math.abs(y - yDaDobra)
    if (ateDobra < 1.2) s[3] -= 0.16 * (1 - ateDobra / 1.2)
  }
}

interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly em: (x: number, y: number) => Ponto
  readonly k: number
}

/** O GUARDA-SOL: a sombra no chão, o mastro (coluna com o miolo), o pano no alto e a ponteira. */
function montarGuardaSol(o: Obra, listra: MaterialDaPeca): void {
  const { c, cena, k } = o
  const P = c.peca
  const [cx, cy] = o.em(...MEIO_DO_GUARDA_SOL)
  const R = RAIO_DO_GUARDA_SOL * k
  const rm = RAIO_DO_MASTRO * k
  const zPano = c.g * ALTURA_DO_PANO
  const pano = octogono(cx, cy, R)
  // A sombra do pano, caída longe, e a do mastro, do pé até debaixo do pano.
  cena.sombras.push({ forma: octogono(cx + SOMBRA_X * zPano, cy + SOMBRA_Y * zPano, R), z: 0, suave: 3.2, forca: 0.26 })
  const mastro = circulo(cx, cy, rm)
  cena.sombras.push({ forma: mastro, z: zPano }, contato(circulo(cx, cy, rm * 1.6), 0.4))
  // O miolo do mastro: escondido debaixo do pano nas duas vistas, só dá a madeira à frente da coluna na 3/4.
  cena.partes.push(P(mastro, c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: rm, contorno: 0.3, semente: 6700 }))
  // O pano: a estrutura com o furo do mastro; a peça com a caixa puxada para o noroeste, fora do furo.
  cena.sombras.push({ forma: menos(pano, circulo(cx, cy, rm + 1)), z: zPano, solta: true, forca: 0, suave: 0.1 })
  const b = pano.b
  const puxa = 8 * k
  cena.partes.push(P(naCaixa(pano, [b[0] - puxa, b[1] - puxa, b[2], b[3]]), c.m.pano, { tabua: 0, bisel: 2.4 * k, contorno: 0.26, semente: 6701, textura: texDoGuardaSol(cx, cy, pano, listra) }))
  // A ponteira: a estrutura miúda fica fora do mastro e esticada até depois da beira do pano (pintada por último).
  const rp = 2.8 * k
  const desvio = 1.4 * k
  cena.sombras.push({ forma: naCaixa(circulo(cx - desvio, cy - desvio, 0.7 * k), [cx - rp, cy - rp, cx + rp, b[3] + 1]), z: zPano + 2 * k, solta: true, forca: 0, suave: 0.1 })
  cena.partes.push(P(naCaixa(circulo(cx, cy, rp), [cx - rp - 2 * desvio, cy - rp - 2 * desvio, cx + rp, cy + rp]), c.m.madeira, { tabua: 0, bisel: rp, contorno: 0.3, tom: 1.05, semente: 6702, projeta: { dist: 1.4, forca: 0.36, suave: 1 } }))
}

/** A ESPREGUIÇADEIRA: as pernas, o assento (tampo), o encosto em fatias e a toalha enrolada no alto. */
function montarEspreguicadeira(o: Obra, listra: MaterialDaPeca): void {
  const { c, cena, k } = o
  const P = c.peca
  const mad = c.m.madeira
  const [xc, y0] = o.em(X_DA_CADEIRA, Y_DO_ENCOSTO)
  const [, yd] = o.em(X_DA_CADEIRA, Y_DA_DOBRA)
  const [, y1] = o.em(X_DA_CADEIRA, Y_DO_PE)
  const meia = MEIA_CADEIRA * k
  const lt = LARGURA_DO_TRILHO * k
  const zAssento = c.g * ALTURA_DO_ASSENTO
  const zEncosto = c.g * ALTURA_DO_ENCOSTO
  const alturaDoEncosto = (y: number): number => zAssento + (zEncosto - zAssento) * Math.max(0, Math.min(1, (yd - y) / (yd - y0)))

  // As pernas: colunas até o assento, duas na dobra e duas no pé.
  for (const [i, y] of [yd + 2 * k, y1 - 2.5 * k].entries()) {
    for (const lado of [-1, 1]) {
      const x = xc + lado * (meia - lt / 2)
      const perna = caixa(x - LADO_DA_PERNA * k / 2, y - LADO_DA_PERNA * k / 2, x + LADO_DA_PERNA * k / 2, y + LADO_DA_PERNA * k / 2, 0.5)
      cena.sombras.push({ forma: perna, z: zAssento }, contato(perna, 0.34))
      cena.partes.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.8, contorno: 0.28, tom: 0.8, semente: 6710 + i * 2 + (lado + 1) / 2 }))
    }
  }

  // A sombra do encosto no chão, caída da altura de cada ponta.
  const sombraDoEncosto = poligono([
    [xc - meia + SOMBRA_X * zEncosto, y0 + SOMBRA_Y * zEncosto],
    [xc + meia + SOMBRA_X * zEncosto, y0 + SOMBRA_Y * zEncosto],
    [xc + meia + SOMBRA_X * zAssento, yd + SOMBRA_Y * zAssento],
    [xc - meia + SOMBRA_X * zAssento, yd + SOMBRA_Y * zAssento],
  ])
  cena.sombras.push({ forma: sombraDoEncosto, z: 0, suave: 2, forca: 0.24 })

  // O assento: a lona e os dois trilhos, um tampo solto (a sombra dele é a do motor, caída da altura).
  const assento = caixa(xc - meia, yd, xc + meia, y1, 0)
  cena.sombras.push({ forma: assento, z: zAssento, solta: true, forca: 0.24 })
  cena.partes.push(P(caixa(xc - meia + lt * 0.6, yd - 0.5, xc + meia - lt * 0.6, y1 - 0.4, 0.6), c.m.pano, { eixo: QUARTO, tabua: 0, bisel: 1.2, contorno: 0.22, semente: 6720, textura: texDaLona(xc, meia - lt, listra, yd) }))
  for (const lado of [-1, 1]) {
    const x = xc + lado * (meia - lt / 2)
    cena.partes.push(P(caixa(x - lt / 2, yd, x + lt / 2, y1, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1, contorno: 0.28, semente: 6722 + lado }))
  }
  // A travessa do pé.
  cena.partes.push(P(caixa(xc - meia, y1 - 2.2 * k, xc + meia, y1, 0.7), mad, { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 0.94, semente: 6725 }))

  // O encosto: a lona e os trilhos em fatias, de norte (alto) a sul (na dobra).
  const fatias = { eixo: 'y' as const, de: y0 - 1, ate: yd + 0.5, altura: alturaDoEncosto, fatias: FATIAS_DO_ENCOSTO, sobra: SOBRA }
  for (const lado of [-1, 1]) {
    const x = xc + lado * (meia - lt / 2)
    emFatias(c, cena, caixa(x - lt / 2, y0, x + lt / 2, yd + 0.5, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1, contorno: 0.28, tom: 1.06, semente: 6730 + lado }, fatias)
  }
  emFatias(c, cena, caixa(xc - meia + lt * 0.6, y0 + 0.4, xc + meia - lt * 0.6, yd + 0.5, 0.6), c.m.pano, { eixo: QUARTO, tabua: 0, bisel: 1.2, contorno: 0.22, tom: TOM_DO_ENCOSTO, semente: 6733, textura: texDaLona(xc, meia - lt, listra, yd) }, fatias)
  // A travessa do alto do encosto.
  emFatias(c, cena, caixa(xc - meia, y0, xc + meia, y0 + 2.2 * k, 0.7), mad, { tabua: 0, bisel: 0.9, contorno: 0.28, tom: 1.04, semente: 6735 }, fatias)

  // A toalha enrolada no alto do encosto, com as listras da beira: faz sombra na lona. A estrutura dela é miúda e
  // fica fora do meio de través: inteira, ela conteria o meio das fatias do encosto e as subiria junto.
  const yt = y0 + 4.6 * k
  const rt = 2.6 * k
  const zToalha = alturaDoEncosto(yt) + 2.4 * k
  const xt = xc + 4 * k
  noAr(cena, circulo(xt, yt, 0.8 * k), zToalha)
  const rolo = capsula(xc - meia * 0.78, yt, xc + meia * 0.78, yt, rt)
  cena.partes.push(P(comMeioEm(rolo, xt), LENCOL, { eixo: 0, tabua: 0, bisel: rt * 0.9, contorno: 0.26, ruga: 0.5, semente: 6740, projeta: { dist: 1.6, forca: 0.34, suave: 1 } }))
  for (const lado of [-1, 1]) {
    const faixa = dentroDe(rolo, caixa(xc + lado * meia * 0.56 - 1.1 * k, yt - rt, xc + lado * meia * 0.56 + 1.1 * k, yt + rt))
    cena.partes.push(P(comMeioEm(faixa, xt), c.m.pano, { eixo: QUARTO, bisel: rt * 0.7, contorno: 0.2, semente: 6741 + lado }))
  }
}

/** A forma com a caixa esticada de um lado até o meio de través dela cair em `x` (a estrutura da toalha). */
function comMeioEm(f: Forma, x: number): Forma {
  const [x0, y0, x1, y1] = f.b
  return naCaixa(f, (x0 + x1) / 2 < x ? [x0, y0, 2 * x - x0, y1] : [2 * x - x1, y0, x1, y1])
}

export const montarGuardaSolComEspreguicadeira: MontarMovel = (c, cena) => {
  const sx = c.w / LADO_DO_DESENHO
  const sy = c.h / LADO_DO_DESENHO
  const o: Obra = { c, cena, em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) }
  const listra = corDaListra(c.m.pano)
  montarEspreguicadeira(o, listra)
  montarGuardaSol(o, listra)
}
