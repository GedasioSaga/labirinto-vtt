/**
 * TAPEÇARIA DE PAREDE (objetos de 14/11/2026, grupo Castelo: "pano comprido
 * com brasão, rente à parede"). EM PÉ, desenhada DE FRENTE nas duas vistas,
 * como a lápide: rente à parede, vista do alto ela seria um risco. A PAREDE é
 * a beira de cima da pegada (giro 0, como a tocha de parede): ali ficam o
 * gancho e o cordão em V que segura a VARA, e o pano cai para baixo na tela.
 * O giro deita a imagem, como na lápide.
 *
 * De cima para baixo: o gancho, o cordão, a VARA de madeira com as duas
 * ponteiras de metal, as ALÇAS de pano por cima dela, o PANO tecido (o campo
 * com o losangeado miúdo, a BARRA de fio de metal com a corrente de losangos
 * e o filete escuro), o BRASÃO grande no meio (a coroa, o escudo de metal com
 * a flor de lis da cor do pano) e a FRANJA de fio de metal embaixo. O que a
 * separa do tapete a 1x: a vara com as ponteiras saindo dos lados, as alças e
 * a franja só embaixo. A sombra é a de pano pendurado: rasa, colada no pano.
 *
 * Materiais: `pano` (o campo, a cor trocável), `metal` (o fio da barra e da
 * franja, as ponteiras, a coroa e o escudo) e `madeira` (a vara).
 */
import { hash } from '../../ruido'
import { caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

/** As medidas, em fração da largura (x) e da altura (y, de cima para baixo). */
const Y_DA_VARA = 0.1
const MEIA_VARA = 0.49
const MEIO_PANO = 0.42
const Y_DO_PE = 0.88
const FRANJA = 0.07
const BARRA = 0.085
/** As alças de pano em cima da vara. */
const ALCAS = 5
/** O pano pendurado faz pouca sombra: a altura dela (casas) e a força. */
const ALTURA_DA_SOMBRA = 0.06
const FORCA_DA_SOMBRA = 0.3
/** O losangeado do campo e a corrente de losangos da barra (px do protótipo). */
const PASSO_DO_CAMPO = 6
const PASSO_DA_BARRA = 5
const LUZ_DO_DESENHO = 0.07
/** As dobras de pé do pano (px do protótipo) e a luz delas. */
const PASSO_DAS_DOBRAS = 9
const LUZ_DAS_DOBRAS = 0.06
/** A franja: o passo dos fios (px do protótipo) e quanto cada fio pode encurtar (fração da franja). */
const PASSO_DOS_FIOS = 1.5
const ENCURTA = 0.35
/** O brasão: o meio do escudo (fração da altura) e a meia largura (fração da largura, e o teto dela em fração da altura). */
const Y_DO_ESCUDO = 0.52
const MEIO_ESCUDO = 0.22
const MEIO_ESCUDO_PELA_ALTURA = 0.138

/** As dobras de pé do pano que cai da vara, somadas ao tecido. */
function dobras(x: number): number {
  return Math.sin((x / PASSO_DAS_DOBRAS) * 2 * Math.PI) * LUZ_DAS_DOBRAS
}

/** O campo: o tecido com o losangeado miúdo (um ponto claro em cada losango) e as dobras. */
function texCampo(): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const a = (x + y) / PASSO_DO_CAMPO
    const b = (x - y) / PASSO_DO_CAMPO
    const borda = 0.5 - Math.max(Math.abs(a - Math.floor(a) - 0.5), Math.abs(b - Math.floor(b) - 0.5))
    s[3] += (borda < 0.08 ? -LUZ_DO_DESENHO : borda > 0.38 ? LUZ_DO_DESENHO : 0) + dobras(x)
  }
}

/** A barra de fio de metal: a corrente de losangos ao longo da beira (`aoLongo` diz se ela corre em x ou em y). */
function texBarra(meio: number, aoLongo: 'x' | 'y'): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const ao = aoLongo === 'x' ? x : y
    const atravessa = Math.abs((aoLongo === 'x' ? y : x) - meio)
    const f = ao / PASSO_DA_BARRA - Math.floor(ao / PASSO_DA_BARRA)
    const losango = Math.abs(f - 0.5) * PASSO_DA_BARRA + atravessa
    s[3] += (losango < PASSO_DA_BARRA * 0.32 ? -LUZ_DO_DESENHO * 2.2 : 0) + (losango < PASSO_DA_BARRA * 0.14 ? LUZ_DO_DESENHO * 3 : 0) + dobras(x) * 0.6
  }
}

/** A franja: fios de pé, cada um de comprimento sorteado; entre os fios o pano não pinta. */
function texFranja(yTopo: number, alto: number): Textura {
  const doPano = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doPano !== null) doPano(u, v, x, y, p, s, escala)
    const k = Math.floor(x / PASSO_DOS_FIOS)
    const f = x / PASSO_DOS_FIOS - k
    const comprimento = alto * (1 - ENCURTA * hash(k, 7, 913))
    const noFio = f > 0.2 && f < 0.8 && y - yTopo < comprimento
    s[3] += noFio ? (f - 0.5) * -0.3 : 0
    if (!noFio) s[5] = 0
  }
}

/** O escudo de beira reta em cima e bico embaixo, recuado `k` px. */
function escudo(cy: number, me: number, k: number): Forma {
  const alto = me * 2.3
  return poligono([[-me + k, cy - alto * 0.45 + k], [me - k, cy - alto * 0.45 + k], [me - k, cy + alto * 0.05], [me * 0.55 - k * 0.6, cy + alto * 0.36 - k * 0.4], [0, cy + alto * 0.55 - k * 1.3], [-me * 0.55 + k * 0.6, cy + alto * 0.36 - k * 0.4], [-me + k, cy + alto * 0.05]])
}

/**
 * As metades da direita da flor de lis, em fração da meia altura (x para fora, y para baixo): a pétala de lado,
 * que sobe para fora e cai na ponta em voluta, e a folhinha de baixo da cinta.
 */
const PETALA_DE_LADO: readonly Ponto[] = [[0.1, 0], [0.26, -0.34], [0.5, -0.52], [0.74, -0.44], [0.82, -0.16], [0.7, 0.02], [0.66, -0.22], [0.52, -0.3], [0.34, -0.14], [0.2, 0.06]]
const FOLHA_DE_BAIXO: readonly Ponto[] = [[0.1, 0.2], [0.34, 0.3], [0.44, 0.5], [0.3, 0.44], [0.08, 0.3]]

/** A flor de lis de meio (cx, cy) e meia altura `a`: a pétala do meio, as duas de lado em voluta, a cinta e o pé. */
function florDeLis(cx: number, cy: number, a: number): Forma {
  const em = (pontos: readonly Ponto[], lado: number): Forma => poligono(pontos.map(([x, y]): Ponto => [cx + lado * x * a, cy + y * a]))
  const meio = poligono([[cx, cy - a], [cx + a * 0.2, cy - a * 0.62], [cx + a * 0.25, cy - a * 0.28], [cx + a * 0.14, cy + a * 0.02], [cx, cy + a * 0.1], [cx - a * 0.14, cy + a * 0.02], [cx - a * 0.25, cy - a * 0.28], [cx - a * 0.2, cy - a * 0.62]])
  const cinta = caixa(cx - a * 0.42, cy + a * 0.03, cx + a * 0.42, cy + a * 0.19, a * 0.05)
  const pe = poligono([[cx - a * 0.1, cy + a * 0.19], [cx + a * 0.1, cy + a * 0.19], [cx + a * 0.06, cy + a * 0.52], [cx, cy + a * 0.62], [cx - a * 0.06, cy + a * 0.52]])
  const lados = uniao(uniao(em(PETALA_DE_LADO, 1), em(PETALA_DE_LADO, -1)), uniao(em(FOLHA_DE_BAIXO, 1), em(FOLHA_DE_BAIXO, -1)))
  return uniao(uniao(meio, cinta), uniao(pe, lados))
}

export const montarTapecariaDeParede: MontarMovel = (c, cena) => {
  const { w, h, hh, g, peca: P } = c
  const pano: MaterialDaPeca = c.m.pano
  const metal = c.m.metal
  const fio: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: metal.rgb }
  const L = cena.partes
  const y = (f: number): number => -hh + f * h
  const yVara = y(Y_DA_VARA)
  const yPe = y(Y_DO_PE)
  const mp = MEIO_PANO * w
  const barra = BARRA * w
  const rv = Math.max(1.3, 0.024 * h)

  // A sombra de pano pendurado: o pano inteiro, raso, e o contato do pé da franja na parede.
  const panoInteiro = caixa(-mp, yVara, mp, yPe, 0.8)
  cena.sombras.push({ forma: panoInteiro, z: g * ALTURA_DA_SOMBRA, forca: FORCA_DA_SOMBRA, suave: 1.6 }, contato(caixa(-mp, yVara, mp, yPe + FRANJA * h * 0.6), 0.14))

  // O GANCHO na parede e o CORDÃO em V até as pontas da vara.
  const yGancho = -hh + 1.2
  for (const [i, lado] of [-1, 1].entries()) {
    L.push(P(capsula(0, yGancho, lado * mp * 0.92, yVara, 0.5), metal, { bisel: 0.4, contorno: 0.24, tom: 0.85, semente: 130 + i }))
  }
  L.push(P(elipse(0, yGancho, 1.4, 1.4), metal, { bisel: 0.9, contorno: 0.28, metal: 0.55, semente: 132 }))

  // O PANO: o campo, a barra de fio de metal nos lados e embaixo, o filete escuro por dentro dela.
  L.push(P(panoInteiro, pano, { bisel: 0.8, contorno: 0.22, textura: texCampo(), semente: 133 }))
  const lados: readonly (readonly [Forma, number, 'x' | 'y'])[] = [
    [caixa(-mp, yVara, -mp + barra, yPe, 0.4), -mp + barra / 2, 'y'],
    [caixa(mp - barra, yVara, mp, yPe, 0.4), mp - barra / 2, 'y'],
    [caixa(-mp, yPe - barra, mp, yPe, 0.4), yPe - barra / 2, 'x'],
  ]
  for (const [i, [forma, meio, ao]] of lados.entries()) L.push(P(forma, fio, { bisel: 0.5, contorno: 0.1, textura: texBarra(meio, ao), semente: 134 + i }))
  const filete = menos(caixa(-mp + barra, yVara, mp - barra, yPe - barra), caixa(-mp + barra + 0.9, yVara - 1, mp - barra - 0.9, yPe - barra - 0.9))
  L.push(P(filete, pano, { bisel: 0, tom: 0.6, contorno: 0, semente: 137 }))

  // A FRANJA de fio de metal embaixo.
  const alto = FRANJA * h
  L.push(P(caixa(-mp + 0.6, yPe - 0.4, mp - 0.6, yPe + alto), fio, { bisel: 0, contorno: 0, tom: 0.95, textura: texFranja(yPe, alto), semente: 138 }))

  // O BRASÃO: o escudo de metal com a flor de lis da cor do pano e a coroa em cima.
  const ye = y(Y_DO_ESCUDO)
  // A tapeçaria esticada na largura não ganha um escudo maior que o pano: a altura também manda.
  const me = Math.min(MEIO_ESCUDO * w, MEIO_ESCUDO_PELA_ALTURA * h)
  L.push(P(escudo(ye, me, 0), metal, { bisel: 1, contorno: 0.3, metal: 0.5, semente: 139, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(escudo(ye, me, 1.6), metal, { bisel: 0.6, tom: 0.9, contorno: 0.12, metal: 0.35, semente: 140 }))
  L.push(P(florDeLis(0, ye + me * 0.08, me * 0.78), pano, { bisel: 0.6, tom: 0.78, contorno: 0.2, semente: 141 }))
  const yCoroa = ye - me * 2.3 * 0.45 - 2
  const coroa = poligono([
    [-me * 0.7, yCoroa], [me * 0.7, yCoroa], [me * 0.8, yCoroa - me * 0.55], [me * 0.42, yCoroa - me * 0.28], [0, yCoroa - me * 0.68],
    [-me * 0.42, yCoroa - me * 0.28], [-me * 0.8, yCoroa - me * 0.55],
  ])
  L.push(P(coroa, metal, { bisel: 0.8, contorno: 0.28, metal: 0.55, semente: 142, projeta: { dist: 0.8, forca: 0.28 } }))

  // A VARA, as ALÇAS de pano dando a volta nela e as duas ponteiras de metal saindo dos lados.
  const meiaVara = MEIA_VARA * w - rv * 1.2
  L.push(P(capsula(-meiaVara, yVara, meiaVara, yVara, rv), c.m.madeira, { tabua: 0, bisel: rv * 0.7, contorno: 0.26, semente: 150, projeta: { dist: 0.8, forca: 0.3 } }))
  const passo = (2 * mp) / ALCAS
  for (let i = 0; i < ALCAS; i += 1) {
    const xa = -mp + passo * (i + 0.5)
    L.push(P(caixa(xa - passo * 0.22, yVara - rv * 1.5, xa + passo * 0.22, yVara + rv * 1.9, rv * 0.6), pano, { bisel: 0.9, tom: 0.88, contorno: 0.24, semente: 143 + i, projeta: { dist: 0.7, forca: 0.26 } }))
  }
  for (const [i, lado] of [-1, 1].entries()) {
    L.push(P(elipse(lado * meiaVara, yVara, rv * 1.5, rv * 1.5), metal, { bisel: rv, contorno: 0.28, metal: 0.6, semente: 151 + i }))
  }
}
