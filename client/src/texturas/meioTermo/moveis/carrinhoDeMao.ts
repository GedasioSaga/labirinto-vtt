/**
 * CARRINHO DE MÃO de cima com volume (lote 7 dos objetos novos, 11/11/2026):
 * o carrinho de madeira da horta, parado, com a colheita dentro. A CAÇAMBA
 * funda de tábuas, mais larga atrás que na frente: a borda clara em volta, as
 * quatro paredes caindo para o fundo (as duas que dão as costas para a luz,
 * escuras; as duas que olham para ela, claras) e o fundo de tábuas na sombra.
 * Dentro, quatro ABÓBORAS (três laranjas e uma moranga verde), cada uma com os
 * gomos e o talo. Os dois VARAIS passam por baixo da caçamba: atrás viram os
 * CABOS compridos, com o punho roliço, e na frente se fecham em volta da RODA.
 * Ao lado de cada cabo, logo atrás da caçamba, um PÉ.
 *
 * A roda vista do alto é uma tira e, sozinha, parece um toco. As pistas de que
 * aquilo é roda: a banda de ferro do aro, redonda ao comprido (clara em cima,
 * escura onde desce para o chão), com os cravos que se apertam para as pontas;
 * a madeira das pinas aparecendo dos dois lados dela; o cubo, com a virola de
 * ferro em cada ponta, e o eixo atravessados na fresta entre os varais, com a
 * cavilha em cada varal; e a sombra no chão, que é a de um disco em pé (uma
 * lente), e não a de uma tábua.
 *
 * A caçamba e os varais estão no ar (a sombra de cada um cai solta); os pés
 * descem até o chão (a sombra deles é arrastada). O perfil da 3/4 é em pé,
 * como o do canhão: derivada, a roda viraria um bloco varrido até o chão e os
 * cabos ficariam deitados na terra debaixo da caçamba.
 *
 * A 25% de zoom sobram a caixa clara com as bolas laranja dentro, os dois
 * cabos para trás e a barra escura da roda na frente. Material: `madeira`; o
 * ferro e as abóboras são fixos. O comprimento sai da largura da pegada e a
 * largura, da altura dela (1,5 x 0,7 casa de partida); o que é redondo (as
 * abóboras, a grossura dos varais, os cravos) sai do lado que menos esticou.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, caixa, capsula, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo na pegada de partida; as alturas, em casas) ----------

/** A pegada de partida: 1,5 x 0,7 casa. As medidas do desenho valem nela, com o meio em (0, 0), a roda para a direita. */
const LARGURA_DE_PARTIDA = 1.5 * G
const FUNDO_DE_PARTIDA = 0.7 * G

/** A boca da caçamba: de onde a onde vai e a meia largura atrás (do lado dos cabos) e na frente (do lado da roda). */
const TRAS_DA_BOCA = -23
const FRENTE_DA_BOCA = 19
const MEIA_BOCA_ATRAS = 18.2
const MEIA_BOCA_NA_FRENTE = 14.6
/** A grossura das tábuas, que é a largura da borda. */
const TABUA_DA_BORDA = 2.2
/** O fundo, menor que a boca: as paredes caem para dentro, e a da frente é a mais deitada. */
const TRAS_DO_FUNDO = -17.4
const FRENTE_DO_FUNDO = 10.4
const MEIO_FUNDO_ATRAS = 12.4
const MEIO_FUNDO_NA_FRENTE = 9.4
/** A largura de uma tábua do fundo. */
const TABUA_DO_FUNDO = 6.2
/** O tom de cada parede por dentro: a de trás e a de cima dão as costas para a luz; a de baixo e a da frente olham para ela. */
const TOM_DA_PAREDE_DE_TRAS = 0.62
const TOM_DA_PAREDE_DE_CIMA = 0.56
const TOM_DA_PAREDE_DE_BAIXO = 0.96
const TOM_DA_PAREDE_DA_FRENTE = 1.02
const TOM_DO_FUNDO = 0.7

/** A roda: onde fica o eixo, o raio, a meia largura das pinas (a madeira) e a da banda de ferro por cima delas. */
const EIXO_DA_RODA = 31
const RAIO_DA_RODA = 10.4
const MEIA_PINA = 3.1
const MEIO_ARO = 1.8
/** O cubo (o miolo de madeira da roda): o raio, o meio comprimento e a largura da virola de ferro em cada ponta; e o meio comprimento do eixo de ferro. */
const RAIO_DO_CUBO = 2.7
const MEIO_CUBO = 5
const VIROLA_DO_CUBO = 0.9
const MEIO_EIXO = 8.6
/** Os cravos da banda, pelo ângulo em volta do eixo (graus; 0 = o alto da roda): de cima eles se apertam para as pontas. */
const CRAVOS_DO_ARO: readonly number[] = [-64, -39, -13, 13, 39, 64]

/** O varal, de um lado: a ponta do punho (atrás), onde o punho acaba e a ponta da frente, depois do eixo. */
const PUNHO: Ponto = [-41.2, 14.1]
const FIM_DO_PUNHO = -32.6
const PONTA_DO_VARAL: Ponto = [34.4, 6.5]
const LARGURA_DO_VARAL = 3.1
const RAIO_DO_PUNHO = 1.3
/** O pé, ao lado do cabo e logo atrás da caçamba: de onde a onde vai ao comprido e de través (do lado de baixo). */
const PE_DE = -28.4
const PE_ATE = -24.2
const PE_POR_DENTRO = 14.2
const PE_POR_FORA = 18.9

/** Alturas em casas: a boca da caçamba, os varais e os pés. */
const ALTURA_DA_BOCA = 0.42
const ALTURA_DOS_VARAIS = 0.26
const ALTURA_DOS_PES = 0.24

// ---------- os materiais fixos ----------

/** O ferro batido do eixo e das virolas, e o da banda do aro, polido de rodar no chão (mais claro). */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
const FERRO_DO_ARO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.22)) }
/** As abóboras: o laranja contido (saturação 0,55; o da terra do chão é 0,51), o mais claro e a moranga verde. */
const LARANJA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0x88, 0x5a] }
const LARANJA_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xd0, 0x9c, 0x68] }
const MORANGA: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x93, 0x6c] }
/** O talo seco. */
const TALO: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x70, 0x4a] }

/** Uma abóbora: o meio, o raio, quantos gomos, de onde eles começam (radianos) e para onde o talo tomba (em raios). */
interface Abobora {
  readonly x: number
  readonly y: number
  readonly raio: number
  readonly gomos: number
  readonly fase: number
  readonly casca: MaterialDaPeca
  readonly talo: Ponto
}
/** A carga, do fundo para a frente (a de baixo na tela fica por cima): a moranga, a grande, a média e a pequena. */
const ABOBORAS: readonly Abobora[] = [
  { x: 4.2, y: -7, raio: 5, gomos: 8, fase: 0.3, casca: MORANGA, talo: [0.3, -0.16] },
  { x: -9, y: -2.6, raio: 8.4, gomos: 10, fase: 0.1, casca: LARANJA, talo: [0.26, 0.14] },
  { x: 4.4, y: 4.7, raio: 6.6, gomos: 9, fase: 0.7, casca: LARANJA_CLARO, talo: [-0.22, 0.2] },
  { x: -7.6, y: 9.6, raio: 3.9, gomos: 7, fase: 1.1, casca: LARANJA, talo: [0.3, 0.1] },
]
/** Quanto o vinco entre dois gomos entra na abóbora, em raios. */
const FUNDURA_DO_VINCO = 0.08
/** Até onde, em raios, a cova do talo escurece o meio da abóbora. */
const COVA_DO_TALO = 0.3

// ---------- a luz do que é roliço ----------

/** De onde vem a luz (a do motor: de cima à esquerda, 52° acima do chão). */
const LUZ_X = -0.62
const LUZ_Z = 0.62
/** Quanto a luz muda do lombo às beiras: menos no ferro escuro (perto do piso de luz), mais na madeira. */
const FORCA_NO_FERRO = 0.62
const FORCA_NA_MADEIRA = 0.9
/** A faixa polida da banda de ferro: a que distância do lombo fica (para o lado da luz), a meia largura e o brilho (tons de 0 a 255). */
const LUGAR_DO_REFLEXO = 0.38
const LARGURA_DO_REFLEXO = 0.16
const REFLEXO_DO_ARO = 46

/**
 * A sombra de um disco em pé, de raio 1, no chão: a luz do motor leva cada ponto (0,27; 0,21) px para baixo à
 * direita por px de altura, e o círculo vira uma elipse deitada, quase da largura da roda, com o meio a um raio
 * de altura. Os números são os eixos e o giro dessa elipse.
 */
const SOMBRA_DO_DISCO_AO_COMPRIDO = 1.04
const SOMBRA_DO_DISCO_DE_TRAVES = 0.2
const GIRO_DA_SOMBRA_DO_DISCO = 0.055

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/**
 * A textura de um ROLO de eixo atravessado (a roda e o cubo, vistos do alto): `meio` é o x do lombo e `raio`, a
 * distância dele até onde o rolo some. O chanfro do motor só arredonda a beira; a volta inteira vai aqui.
 * `reflexo` = o brilho da faixa polida (0 na madeira). Por baixo, a textura do material.
 */
function texDeRolo(meio: number, raio: number, forca: number, reflexo: number, classe: 'metal' | 'madeira'): Textura {
  const doMaterial = texturaDaClasse(classe)
  return (u, v, x, y, p, s, escala) => {
    const q = limitar((x - meio) / raio, -1, 1)
    s[3] += forca * (LUZ_X * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1))
    if (reflexo > 0) {
      const polido = (q + LUGAR_DO_REFLEXO) / LARGURA_DO_REFLEXO
      const brilho = reflexo * Math.exp(-polido * polido)
      s[0] += brilho
      s[1] += brilho
      s[2] += brilho
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

// ---------- a régua ----------

/** As medidas do desenho na pegada: `X` ao comprido (da largura), `Y` de través (da altura). */
interface Regua {
  readonly X: (x: number) => number
  readonly Y: (y: number) => number
  /** O que é redondo sai do lado que menos esticou: continua redondo no objeto esticado. */
  readonly k: number
}

// ---------- a roda ----------

function montarRoda(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const x = X(EIXO_DA_RODA)
  const R = X(RAIO_DA_RODA)
  const pina = caixa(x - R + 0.3, -k * MEIA_PINA, x + R - 0.3, k * MEIA_PINA, 1)
  const sombraDoDisco = elipseGirada(x + SOMBRA_X * R, SOMBRA_Y * R, R * SOMBRA_DO_DISCO_AO_COMPRIDO, R * SOMBRA_DO_DISCO_DE_TRAVES + k, GIRO_DA_SOMBRA_DO_DISCO)
  cena.sombras.push({ forma: sombraDoDisco, z: 0, suave: 1.3, forca: 0.3 }, contato(pina, 0.32))

  // O eixo de ferro e, em volta dele, o cubo de madeira: os dois atravessam a fresta entre os varais.
  L.push(P(capsula(x, -Y(MEIO_EIXO), x, Y(MEIO_EIXO), k * 0.95), FERRO, { bisel: k * 0.9, contorno: 0.26, metal: 0.3, semente: 7300 }))
  const cubo = k * RAIO_DO_CUBO
  L.push(P(caixa(x - cubo, -Y(MEIO_CUBO), x + cubo, Y(MEIO_CUBO), 1.2), c.m.madeira, { eixo: QUARTO, tabua: 0, bisel: 0.8, tom: 0.94, contorno: 0.3, textura: texDeRolo(x, cubo, FORCA_NA_MADEIRA, 0, 'madeira'), semente: 7301 }))
  // A virola: o anel de ferro que aperta cada ponta do cubo.
  for (const lado of [-1, 1]) {
    const [de, ate] = [lado * Y(MEIO_CUBO), lado * (Y(MEIO_CUBO) - k * VIROLA_DO_CUBO)]
    L.push(P(caixa(x - cubo - 0.2, Math.min(de, ate), x + cubo + 0.2, Math.max(de, ate), 0.3), FERRO, { tabua: 0, bisel: 0.4, contorno: 0.2, metal: 0.16, textura: texDeRolo(x, cubo, FORCA_NO_FERRO, 0, 'metal'), semente: 7305 }))
  }
  // As pinas (a madeira da roda) e, por cima, a banda de ferro do aro, mais estreita: a madeira aparece dos dois lados.
  L.push(P(pina, c.m.madeira, { eixo: 0, tabua: 0, bisel: 0.8, tom: 0.84, contorno: 0.3, textura: texDeRolo(x, R, FORCA_NA_MADEIRA, 0, 'madeira'), semente: 7302, projeta: { dist: 1.4, forca: 0.3 } }))
  L.push(P(caixa(x - R, -k * MEIO_ARO, x + R, k * MEIO_ARO, 0.7), FERRO_DO_ARO, { tabua: 0, bisel: 0.6, contorno: 0.26, metal: 0.16, textura: texDeRolo(x, R, FORCA_NO_FERRO, REFLEXO_DO_ARO, 'metal'), semente: 7303 }))
  for (const graus of CRAVOS_DO_ARO) {
    const ang = (graus * Math.PI) / 180
    // O cravo no lombo é redondo; para as pontas, onde a banda desce, ele achata.
    L.push(P(elipse(x + R * Math.sin(ang), 0, Math.max(0.3, k * 0.6 * Math.cos(ang)), k * 0.6), PREGO, { bisel: 0.4, tom: 0.8, contorno: 0.2, metal: 0.2, semente: 7304 }))
  }
}

// ---------- os pés e os varais ----------

function montarVarais(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  /** O y do meio do varal (do lado de baixo) no x pedido: ele vem do punho, atrás, fechando até a ponta. */
  const yDoVaral = (x: number): number => PUNHO[1] + ((x - PUNHO[0]) * (PONTA_DO_VARAL[1] - PUNHO[1])) / (PONTA_DO_VARAL[0] - PUNHO[0])
  const r = k * RAIO_DO_PUNHO
  for (const lado of [-1, 1]) {
    // O pé desce do varal até o chão: de cima sobra o toco ao lado do cabo, e a sombra dele é arrastada.
    const pe = caixa(X(PE_DE), Math.min(lado * Y(PE_POR_DENTRO), lado * Y(PE_POR_FORA)), X(PE_ATE), Math.max(lado * Y(PE_POR_DENTRO), lado * Y(PE_POR_FORA)), 0.7)
    cena.sombras.push({ forma: pe, z: c.g * ALTURA_DOS_PES, forca: 0.3 }, contato(pe, 0.32))
    L.push(P(pe, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: 0.76, contorno: 0.3, semente: 7310 + lado }))

    const [ax, ay] = [X(FIM_DO_PUNHO), lado * Y(yDoVaral(FIM_DO_PUNHO))]
    const [bx, by] = [X(PONTA_DO_VARAL[0]), lado * Y(PONTA_DO_VARAL[1])]
    const eixo = Math.atan2(by - ay, bx - ax)
    const varal = barra(ax, ay, bx, by, k * LARGURA_DO_VARAL)
    const punho = capsula(X(PUNHO[0]) + r, lado * Y(PUNHO[1]), ax + 1, ay, r)
    // O varal e o punho estão no ar: a sombra cai solta, para baixo à direita.
    cena.sombras.push({ forma: varal, z: c.g * ALTURA_DOS_VARAIS, solta: true, forca: 0.26 }, { forma: punho, z: c.g * ALTURA_DOS_VARAIS, solta: true, forca: 0.26 })
    // O punho roliço, escurecido pela mão, e o varal de seção quadrada por cima do começo dele.
    L.push(P(punho, mad, { eixo, tabua: 0, bisel: r, tom: 0.8, contorno: 0.3, semente: 7314 + lado }))
    L.push(P(varal, mad, { eixo, tabua: 0, bisel: 1, tom: 0.92, contorno: 0.26, semente: 7318 + lado, projeta: { dist: 1.2, forca: 0.24 } }))
    // A cavilha: a ponta do eixo que atravessa o varal.
    L.push(P(elipse(X(EIXO_DA_RODA), lado * Y(yDoVaral(EIXO_DA_RODA)), k * 1.05, k * 1.05), PREGO, { bisel: 0.7, tom: 1.1, contorno: 0.14, metal: 0.3, semente: 7322 }))
  }
}

// ---------- a caçamba ----------

function montarCacamba(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  const naPegada = ([x, y]: Ponto): Ponto => [X(x), Y(y)]
  const t = TABUA_DA_BORDA
  // Os quatro cantos de cada contorno, na mesma ordem: atrás em cima, na frente em cima, na frente embaixo, atrás embaixo.
  const cantosDaBoca: readonly Ponto[] = [[TRAS_DA_BOCA, -MEIA_BOCA_ATRAS], [FRENTE_DA_BOCA, -MEIA_BOCA_NA_FRENTE], [FRENTE_DA_BOCA, MEIA_BOCA_NA_FRENTE], [TRAS_DA_BOCA, MEIA_BOCA_ATRAS]]
  const cantosDeDentro: readonly Ponto[] = [[TRAS_DA_BOCA + t, t - MEIA_BOCA_ATRAS], [FRENTE_DA_BOCA - t, t - MEIA_BOCA_NA_FRENTE], [FRENTE_DA_BOCA - t, MEIA_BOCA_NA_FRENTE - t], [TRAS_DA_BOCA + t, MEIA_BOCA_ATRAS - t]]
  const cantosDoFundo: readonly Ponto[] = [[TRAS_DO_FUNDO, -MEIO_FUNDO_ATRAS], [FRENTE_DO_FUNDO, -MEIO_FUNDO_NA_FRENTE], [FRENTE_DO_FUNDO, MEIO_FUNDO_NA_FRENTE], [TRAS_DO_FUNDO, MEIO_FUNDO_ATRAS]]
  const boca = cantosDaBoca.map(naPegada)
  const dentro = cantosDeDentro.map(naPegada)
  const fundo = cantosDoFundo.map(naPegada)

  // A caçamba está no ar, em cima dos varais: a sombra dela cai solta.
  const formaDaBoca = poligono(boca)
  cena.sombras.push({ forma: formaDaBoca, z: c.g * ALTURA_DA_BOCA, solta: true, forca: 0.3 })
  // A borda (o alto das quatro tábuas) e, dentro dela, o fundo na sombra das paredes de trás e de cima.
  L.push(P(formaDaBoca, mad, { tabua: 0, bisel: 1.1, tom: 1.06, contorno: 0.28, semente: 7330 }))
  L.push(P(poligono(fundo), mad, { tabua: Y(TABUA_DO_FUNDO), bisel: 0.4, tom: TOM_DO_FUNDO, contorno: 0.1, recesso: { k: 3 * k, forca: 0.36 }, semente: 7331 }))
  // As quatro paredes, da borda de dentro até o fundo: [os cantos, o veio, o tom].
  const paredes: readonly (readonly [readonly Ponto[], number, number])[] = [
    [[dentro[0], fundo[0], fundo[3], dentro[3]], QUARTO, TOM_DA_PAREDE_DE_TRAS],
    [[dentro[0], dentro[1], fundo[1], fundo[0]], 0, TOM_DA_PAREDE_DE_CIMA],
    [[fundo[3], fundo[2], dentro[2], dentro[3]], 0, TOM_DA_PAREDE_DE_BAIXO],
    [[fundo[1], dentro[1], dentro[2], fundo[2]], QUARTO, TOM_DA_PAREDE_DA_FRENTE],
  ]
  paredes.forEach(([cantos, eixo, tom], i) => {
    L.push(P(poligono(cantos), mad, { eixo, tabua: 0, bisel: 0.5, tom, contorno: 0.2, semente: 7332 + i }))
  })
  // Um prego em cada canto da borda, onde as tábuas se encontram.
  const recuo = 1.2
  for (const [x, y] of [[TRAS_DA_BOCA + recuo, MEIA_BOCA_ATRAS - recuo * 1.2], [FRENTE_DA_BOCA - recuo, MEIA_BOCA_NA_FRENTE - recuo * 1.2]] as const) {
    for (const lado of [-1, 1]) L.push(P(elipse(X(x), lado * Y(y), k * 0.6, k * 0.6), PREGO, { bisel: 0.5, contorno: 0.14, metal: 0.3, semente: 7338 }))
  }
}

// ---------- a carga ----------

/** O contorno da abóbora: redondo, com um vinco entre cada dois gomos. */
function abobora(cx: number, cy: number, r: number, gomos: number, fase: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      const gomo = Math.abs(Math.cos(((Math.atan2(dy, dx) + fase) * gomos) / 2))
      return Math.sqrt(dx * dx + dy * dy) - r * (1 - FUNDURA_DO_VINCO * (1 - gomo))
    },
  }
}

/** A casca: o vinco escuro entre os gomos, sumindo na cova do talo, que é mais escura; cada gomo com o lombo um pouco claro. */
function texDaAbobora(cx: number, cy: number, r: number, gomos: number, fase: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    const dy = y - cy
    const gomo = Math.abs(Math.cos(((Math.atan2(dy, dx) + fase) * gomos) / 2))
    const foraDaCova = limitar(Math.sqrt(dx * dx + dy * dy) / (r * COVA_DO_TALO), 0, 1)
    const vinco = 1 - gomo
    s[3] += -0.24 * vinco * vinco * vinco * foraDaCova + 0.05 * gomo - 0.14 * (1 - foraDaCova) + ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 0.05
  }
}

function montarCarga(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  ABOBORAS.forEach((a, i) => {
    const cx = X(a.x)
    const cy = Y(a.y)
    const r = k * a.raio
    L.push(P(abobora(cx, cy, r, a.gomos, a.fase), a.casca, { bisel: r * 0.82, contorno: 0.3, textura: texDaAbobora(cx, cy, r, a.gomos, a.fase), semente: 7340 + i, projeta: { dist: 2.4 * k, forca: 0.34, suave: 1.1 } }))
    // O talo seco, tombado para um lado, com o corte claro na ponta.
    const [tx, ty] = [cx + r * a.talo[0], cy + r * a.talo[1]]
    const grossura = Math.max(0.7, r * 0.14)
    L.push(P(capsula(cx, cy, tx, ty, grossura), TALO, { bisel: grossura, contorno: 0.32, semente: 7350 + i, projeta: { dist: 0.8, forca: 0.26 } }))
    L.push(P(elipse(tx, ty, grossura * 0.62, grossura * 0.62), TALO, { bisel: 0.3, tom: 1.3, contorno: 0, semente: 7360 + i }))
  })
}

export const montarCarrinhoDeMao: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / FUNDO_DE_PARTIDA
  const regua: Regua = { X: (x) => x * sx, Y: (y) => y * sy, k: Math.min(sx, sy) }
  montarRoda(c, cena, regua)
  montarVarais(c, cena, regua)
  montarCacamba(c, cena, regua)
  montarCarga(c, cena, regua)
}
