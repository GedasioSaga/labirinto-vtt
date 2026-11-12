/**
 * TIMÃO (lote 12 dos objetos novos, 11/11/2026; a campanha é de piratas), EM
 * PÉ e DE FRENTE NAS DUAS VISTAS, como o alvo de arco e flecha e o boneco de
 * treino: de cima, de verdade, a roda é uma barra fina sobre o pedestal e
 * ninguém diria o que é. A RODA DE LEME de madeira: o ARO, com a grossura
 * aparecendo por cima (a roda está um pouco abaixo de quem olha) e a CINTA DE
 * LATÃO pregada na face; os OITO RAIOS torneados atravessam o aro e acabam nas
 * MALAGUETAS, os punhos torneados de colar, bojo e botão; a de cima é o
 * raio-rei, com a pinha de cabo enrolada que diz ao timoneiro que o leme está
 * a meio. No meio, o CUBO de madeira com a TAMPA DE LATÃO aparafusada. Atrás
 * da roda, o PEDESTAL: a coluna torneada em que entra o eixo, com o anel de
 * baixo, sobre a base de dois degraus aparafusada no convés.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * como o alvo, passa da pegada para cima (a malagueta de cima, 0,14 casa). A
 * sombra no chão é a do timão em pé: a do pedestal, curta, e a do aro, deitada
 * e achatada para baixo à direita. Cada peça torneada (raio, malagueta,
 * coluna), o aro e o cubo levam a luz de cilindro do cano do canhão: o lado
 * virado para o alto à esquerda clareia e o outro escurece, e é isso que os
 * faz redondos a 1x. A 25% de zoom sobram a roda com as oito pontas e o pé.
 *
 * Girado, deita como o alvo: de cima e na 3/4 (perfil em pé) gira a imagem
 * inteira; o desenho não lê `c.giro`. Materiais: `madeira` (a roda e o
 * pedestal) e `ferragens` (a cinta, a tampa do cubo e os parafusos dela); o
 * cabo da pinha e os parafusos da base são fixos.
 */
import { anel, caixa, capsula, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, PREGO, QUARTO, type MontarMovel } from './contexto'

/** O lado da casa em que o timão é desenhado (px do protótipo). */
const CASA = 56
const VOLTA = Math.PI * 2

// ---------- a roda (px da casa, 0 no meio, y para baixo) ----------

/** O meio da roda (o cubo) e os raios do aro, de fora e de dentro. */
const MEIO_DA_RODA = -9.5
const ARO_FORA = 19
const ARO_DENTRO = 15.4
/** O quanto a face de trás do aro e a do cubo aparecem acima das da frente (a roda está um pouco abaixo de quem olha). */
const GROSSURA_DO_ARO = 1.8
const GROSSURA_DO_CUBO = 1.3
/** A cinta de latão na face do aro. */
const CINTA_FORA = 18
const CINTA_DENTRO = 16.5
const RAIOS = 8
/**
 * O perfil torneado de cada raio, do cubo até a ponta da malagueta: [distância ao meio da roda, meia largura]. O
 * pedaço de dentro do aro fica escondido por ele; fora dele, a malagueta: o pescoço, o colar, o bojo do punho,
 * outro pescoço e o botão da ponta.
 */
const PERFIL_DO_RAIO: readonly Ponto[] = [
  [5, 1.5],
  [8.1, 1.5],
  [8.5, 2],
  [9.3, 2],
  [9.7, 1.45],
  [15.6, 1.1],
  [19.9, 1.15],
  [20.3, 1.9],
  [20.9, 1.9],
  [21.25, 1],
  [21.7, 1.2],
  [22.6, 1.65],
  [23.4, 1.8],
  [24.3, 1.6],
  [24.95, 1],
  [25.2, 0.88],
  [25.45, 1.15],
  [25.85, 1.15],
  [26.15, 0.7],
  [26.3, 0.3],
]
/** As voltas da pinha no punho do raio-rei (distância ao meio) e o cabo dela. */
const PINHA: readonly number[] = [22.2, 22.95, 23.7]
const CABO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xac, 0x7e] }
/** O cubo: o disco de madeira, a tampa de latão, o botão do eixo e os parafusos da tampa. */
const CUBO = 6.6
const TAMPA = 4.9
const BOTAO = 2
const PARAFUSOS_DA_TAMPA = 6
const RODA_DOS_PARAFUSOS = 3.5

// ---------- o pedestal ----------

/** O convés, onde pisa a base. */
const CHAO = 24.6
/**
 * O perfil da coluna, do meio da roda para baixo: [distância abaixo do meio, meia largura]. O colar de cima (atrás
 * do cubo), o fuste que engrossa para baixo, o anel e a saia que abre sobre a base.
 */
const PERFIL_DA_COLUNA: readonly Ponto[] = [
  [0, 4.6],
  [3, 4.6],
  [3.4, 3.9],
  [18.6, 4.7],
  [19, 5.8],
  [20.4, 5.8],
  [20.8, 4.8],
  [23, 5.3],
  [25, 7],
  [26.7, 7.2],
]
/**
 * A coluna fica na sombra da roda e mais escura que ela: a malagueta de baixo passa na frente dela, e no mesmo
 * tom as duas viravam um balaústre só.
 */
const TOM_DA_COLUNA = 0.74
/** Os dois degraus da base, de cima para baixo: a meia largura, o alto da face de cima (a que se vê), o da frente e o pé. */
const DEGRAUS: readonly { readonly meia: number; readonly tampo: number; readonly frente: number; readonly pe: number }[] = [
  { meia: 8.6, tampo: 16.6, frente: 17.8, pe: 20.2 },
  { meia: 12, tampo: 20.2, frente: 21.4, pe: CHAO },
]

// ---------- a luz das peças redondas (a do cano do canhão) ----------

const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A luz de um ponto de superfície redonda: `q` de -1 a 1 de través, `paraALuz` = o quanto o lado positivo olha para a luz. */
function luzRedonda(q: number, paraALuz: number): number {
  return paraALuz * q + LUZ_Z * (Math.sqrt(1 - q * q) - 1)
}

/** A meia largura do perfil na distância `r` (reta entre os nós; fora dele, a da ponta mais perto). */
function meiaLargura(perfil: readonly Ponto[], r: number): number {
  if (r <= perfil[0][0]) return perfil[0][1]
  for (let i = 1; i < perfil.length; i += 1) {
    const [r1, m1] = perfil[i]
    if (r > r1) continue
    const [r0, m0] = perfil[i - 1]
    return m0 + ((m1 - m0) * (r - r0)) / (r1 - r0 || 1e-9)
  }
  return perfil[perfil.length - 1][1]
}

/** A peça torneada que sai de (cx, cy) no rumo `ang`, com o perfil dos dois lados: uma forma só, sem emenda. */
function torneado(cx: number, cy: number, ang: number, perfil: readonly Ponto[]): Forma {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const ida = perfil.map(([r, m]): Ponto => [cx + dx * r - dy * m, cy + dy * r + dx * m])
  const volta = perfil.map(([r, m]): Ponto => [cx + dx * r + dy * m, cy + dy * r - dx * m]).reverse()
  return poligono([...ida, ...volta])
}

/** A luz de cilindro da peça torneada (px da cena): de través pela meia largura do perfil naquele ponto. */
function texDoTorneado(cx: number, cy: number, ang: number, perfil: readonly Ponto[], forca: number, doMaterial: Textura | null): Textura {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const paraALuz = -dy * LUZ_X + dx * LUZ_Y
  return (u, v, x, y, p, s, escala) => {
    const px = x - cx
    const py = y - cy
    const meia = meiaLargura(perfil, px * dx + py * dy)
    s[3] += forca * luzRedonda(limitar((py * dx - px * dy) / meia, -1, 1), paraALuz)
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** A luz do aro redondo (px da cena): de través pela distância ao meio da largura dele. */
function texDoAro(cx: number, cy: number, rMeio: number, meia: number, forca: number, doMaterial: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    const px = x - cx
    const py = y - cy
    const d = Math.hypot(px, py) || 1e-9
    s[3] += forca * luzRedonda(limitar((d - rMeio) / meia, -1, 1), (px * LUZ_X + py * LUZ_Y) / d)
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

/** A luz da cúpula (o cubo e a tampa): do meio para a beira, clara do lado da luz. */
function texDaCupula(cx: number, cy: number, raio: number, forca: number, doMaterial: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    const px = x - cx
    const py = y - cy
    const d = Math.hypot(px, py) || 1e-9
    s[3] += forca * luzRedonda(limitar(d / raio, 0, 1), (px * LUZ_X + py * LUZ_Y) / d)
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, escala)
  }
}

export const montarTimao: MontarMovel = (c, cena) => {
  const { peca: P } = c
  const mad = c.m.madeira
  const ferragens = c.m.ferragens
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  /** O perfil no tamanho da pegada (a textura lê o ponto da cena). */
  const naCena = (perfil: readonly Ponto[]): Ponto[] => perfil.map(([r, m]): Ponto => [r * e, m * e])
  const daMadeira = texturaDaClasse(mad.classe)
  const doMetal = texturaDaClasse(ferragens.classe)
  const L = cena.partes
  const yRoda = MEIO_DA_RODA

  // A sombra do timão em pé: o contato da base, a do pedestal, curta, e a do aro, deitada e achatada.
  cena.sombras.push(contato(naPegada(caixa(-12, CHAO - 1, 12, CHAO + 0.5, 0.5)), 0.34))
  cena.sombras.push({ forma: naPegada(capsula(1, CHAO + 0.6, 13, CHAO + 3.6, 4.2)), z: 0, suave: 1.8, forca: 0.2 })
  cena.sombras.push({ forma: naPegada(menos(elipseGirada(10, CHAO + 2.6, 18, 4.4, 0.18), elipseGirada(10, CHAO + 2.6, 13.6, 2.6, 0.18))), z: 0, suave: 1.6, forca: 0.22 })

  // A base de dois degraus: a face de cima, clara, e a da frente, na sombra; dois parafusos de convés no degrau de baixo.
  DEGRAUS.forEach((d, i) => {
    L.push(P(naPegada(caixa(-d.meia, d.tampo, d.meia, d.frente + 0.4, 0.5)), mad, { tabua: 0, bisel: 0.6 * e, tom: 1.1, contorno: 0.24, semente: 7600 + i * 2 }))
    L.push(P(naPegada(caixa(-d.meia, d.frente, d.meia, d.pe, 0.6)), mad, { tabua: 0, bisel: 0.9 * e, tom: 0.8, contorno: 0.28, semente: 7601 + i * 2 }))
  })
  const fundo = DEGRAUS[DEGRAUS.length - 1]
  for (const lado of [-1, 1]) {
    L.push(P(naPegada(elipse(lado * (fundo.meia - 2.4), (fundo.frente + fundo.pe) / 2, 0.75, 0.75)), PREGO, { bisel: 0.6 * e, tom: 1.05, contorno: 0.2, metal: 0.35 }))
  }

  // A coluna torneada, de pé sobre a base, com o colar de cima escondido atrás do cubo.
  L.push(
    P(naPegada(torneado(0, yRoda, QUARTO, PERFIL_DA_COLUNA)), mad, {
      eixo: QUARTO,
      tabua: 0,
      bisel: 1 * e,
      tom: TOM_DA_COLUNA,
      contorno: 0.28,
      textura: texDoTorneado(0, yRoda * e, QUARTO, naCena(PERFIL_DA_COLUNA), 0.5, daMadeira),
      semente: 7605,
    }),
  )

  // A face de trás do aro e a do cubo, mais escuras: é a grossura da roda vista um pouco de cima.
  const arco = { cx: 0, cy: yRoda * e, r: ((ARO_FORA + ARO_DENTRO) / 2) * e, a0: 0 }
  L.push(P(naPegada(anel(0, yRoda - GROSSURA_DO_ARO, ARO_FORA, ARO_FORA, ARO_DENTRO, ARO_DENTRO)), mad, { tabua: 0, bisel: 0.8 * e, tom: 0.62, contorno: 0.26, arco, semente: 7610 }))
  L.push(P(naPegada(elipse(0, yRoda - GROSSURA_DO_CUBO, CUBO, CUBO)), mad, { tabua: 0, bisel: 0.8 * e, tom: 0.62, contorno: 0.26, semente: 7611 }))

  // Os oito raios com as malaguetas, do cubo para fora, cada um com a sombra no que está atrás.
  const perfilDoRaio = naCena(PERFIL_DO_RAIO)
  for (let i = 0; i < RAIOS; i += 1) {
    const ang = -QUARTO + (i * VOLTA) / RAIOS
    L.push(
      P(naPegada(torneado(0, yRoda, ang, PERFIL_DO_RAIO)), mad, {
        eixo: ang,
        tabua: 0,
        bisel: 0.7 * e,
        tom: 1.02,
        contorno: 0.3,
        textura: texDoTorneado(0, yRoda * e, ang, perfilDoRaio, 0.55, daMadeira),
        semente: 7620 + i,
        projeta: { dist: 0.9, forca: 0.3 },
      }),
    )
  }
  // A pinha do raio-rei (o de cima): três voltas de cabo claro no punho.
  PINHA.forEach((r, j) => {
    const meia = meiaLargura(PERFIL_DO_RAIO, r) + 0.3
    L.push(P(naPegada(capsula(-meia, yRoda - r, meia, yRoda - r, 0.4)), CABO, { bisel: 0.35 * e, tom: 1.04 - j * 0.05, contorno: 0.22, semente: 7630 + j }))
  })

  // O aro da frente, com o veio pelo arco e a luz de redondo, e as emendas das cambotas entre os raios.
  const rMeio = (ARO_FORA + ARO_DENTRO) / 2
  L.push(
    P(naPegada(anel(0, yRoda, ARO_FORA, ARO_FORA, ARO_DENTRO, ARO_DENTRO)), mad, {
      tabua: 0,
      bisel: 1 * e,
      contorno: 0.3,
      arco,
      textura: texDoAro(0, yRoda * e, rMeio * e, ((ARO_FORA - ARO_DENTRO) / 2) * e, 0.5, daMadeira),
      semente: 7640,
      projeta: { dist: 1, forca: 0.3 },
    }),
  )
  for (let i = 0; i < RAIOS; i += 1) {
    const a = -QUARTO + ((i + 0.5) * VOLTA) / RAIOS
    const co = Math.cos(a)
    const si = Math.sin(a)
    const de = ARO_DENTRO + 0.4
    const ate = ARO_FORA - 0.4
    L.push(P(naPegada(capsula(co * de, yRoda + si * de, co * ate, yRoda + si * ate, 0.22)), BURACO, { bisel: 0, contorno: 0, alfa: 0.5 }))
  }

  // A cinta de latão na face do aro, presa com um parafuso na ponta de cada raio.
  L.push(P(naPegada(anel(0, yRoda, CINTA_FORA, CINTA_FORA, CINTA_DENTRO, CINTA_DENTRO)), ferragens, { tabua: 0, bisel: 0.5 * e, tom: 1.04, contorno: 0.24, metal: 0.5, semente: 7650 }))
  const rDaCinta = (CINTA_FORA + CINTA_DENTRO) / 2
  for (let i = 0; i < RAIOS; i += 1) {
    const a = -QUARTO + (i * VOLTA) / RAIOS
    L.push(P(naPegada(elipse(Math.cos(a) * rDaCinta, yRoda + Math.sin(a) * rDaCinta, 0.42, 0.42)), ferragens, { bisel: 0.4 * e, tom: 0.72, contorno: 0.2, metal: 0.4 }))
  }

  // O cubo: o disco de madeira, a tampa de latão com os parafusos e o botão do eixo.
  L.push(P(naPegada(elipse(0, yRoda, CUBO, CUBO)), mad, { tabua: 0, bisel: 1.3 * e, tom: 0.96, contorno: 0.3, textura: texDaCupula(0, yRoda * e, CUBO * e, 0.3, daMadeira), semente: 7660, projeta: { dist: 1.2, forca: 0.32 } }))
  L.push(P(naPegada(elipse(0, yRoda, TAMPA, TAMPA)), ferragens, { tabua: 0, bisel: 1.2 * e, contorno: 0.3, metal: 0.5, textura: texDaCupula(0, yRoda * e, TAMPA * e, 0.4, doMetal), semente: 7661, projeta: { dist: 0.6, forca: 0.26 } }))
  for (let i = 0; i < PARAFUSOS_DA_TAMPA; i += 1) {
    const a = -QUARTO + (i * VOLTA) / PARAFUSOS_DA_TAMPA
    L.push(P(naPegada(elipse(Math.cos(a) * RODA_DOS_PARAFUSOS, yRoda + Math.sin(a) * RODA_DOS_PARAFUSOS, 0.5, 0.5)), ferragens, { bisel: 0.45 * e, tom: 0.76, contorno: 0.22, metal: 0.45 }))
  }
  L.push(P(naPegada(elipse(0, yRoda, BOTAO, BOTAO)), ferragens, { bisel: BOTAO * e, tom: 1.12, contorno: 0.3, metal: 0.6, semente: 7662 }))
}
