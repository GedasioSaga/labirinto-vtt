/**
 * BUNKER DE CONCRETO de cima com volume (14/11/2026, lote L16, construções da base militar): a casamata baixa de
 * concreto, meio enterrada. O TETO grosso de laje com as marcas das tábuas da fôrma, a CÚPULA de aço de
 * observação com as frestas de vigia, dois RESPIROS de cano com chapéu, a SETEIRA larga e escura na face da
 * frente com o peitoril claro, o ATERRO de terra com capim que cobre os lados e o fundo, a VALA de entrada no
 * fundo com os degraus descendo até a porta de aço, e na frente a CALÇADA de concreto com dois montes de SACOS
 * DE AREIA nas pontas do aterro.
 *
 * De cima: a laje cinza de quinas arredondadas no meio do aterro marrom e verde (o que diz "bunker" e não laje ou
 * caixa), a cúpula redonda, a risca escura da seteira na beira da frente, os degraus da vala no fundo e a
 * SOMBRA para baixo à direita. Sem material escolhido: o concreto, a terra, o capim, o aço e a lona são fixos.
 *
 * NA 3/4 (`tresQuartos.ts`): o teto é uma coluna até `ALTURA_DO_TETO`; a seteira são tampos escuros que saem um
 * tico da face da frente, com o peitoril claro por baixo; a cúpula e os respiros, tampos empilhados em cima do
 * teto; o aterro, colunas de terra em dois degraus (o de fora baixo, o de dentro alto), em pedaços (oeste,
 * leste, e o fundo partido pela vala) para cada um sair na vez dele, sem pintar por cima do teto. Lê
 * `c.giro` só para a cúpula e os respiros saírem depois do teto; a seteira anda com o objeto (de costas, some atrás).
 *
 * Medidas em fração da meia pegada (o bunker estica nos dois sentidos); alturas em fração do lado MENOR.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, type Forma } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, materialDaPeca, type MontarMovel } from './contexto'
import { comMeioEm, discosQueAlargam, esticadaParaAFrente, faixaQueSai, solta, tingido } from './apoioDasConstrucoes'

/** A beirada dos tampos do bunker (px do protótipo): a grossura da beira da laje e de cada degrau do aterro. O perfil usa este valor. */
export const ESPESSURA_DA_LAJE_DO_BUNKER = 0.12 * 56

/** O teto (fração da meia pegada): de -X a X, de cima (-Y0) à face da frente (Y1). */
const TETO_X = 0.7
const TETO_Y0 = 0.6
const TETO_Y1 = 0.56
/** O aterro: a beira de fora e o degrau do meio, em fração da meia pegada. */
const ATERRO_FORA = 0.97
const ATERRO_MEIO = 0.84
/** A frente do aterro dos lados (fica um nada atrás da face da frente). */
const ATERRO_FRENTE = 0.5
/** A vala de entrada no fundo: o meio e a meia largura (fração da meia largura). */
const VALA_EM = 0.28
const MEIA_VALA = 0.13
const DEGRAUS = 5
/** A calçada da frente: até onde vai. */
const CALCADA_ATE = 0.95
/** Alturas em lados (o lado menor): o teto, os dois degraus do aterro, a cúpula e os respiros acima do teto. */
const ALTURA_DO_TETO = 0.34
const ALTURA_DO_ATERRO_DE_DENTRO = 0.27
const ALTURA_DO_ATERRO_DE_FORA = 0.13
const ALTURA_DA_CUPULA = 0.09
const ALTURA_DO_RESPIRO = 0.07
/** A seteira na face da frente: a meia largura (fração) e a faixa de altura (fração da altura do teto). */
const MEIA_SETEIRA = 0.4
const SETEIRA_DE = 0.46
const SETEIRA_ATE = 0.72
/** Quanto a seteira e o peitoril saem da face (px). */
const SAI_A_SETEIRA = 1.3
const SAI_O_PEITORIL = 2.4
/** A cúpula (x, y, raio, em fração da meia pegada menor) e os dois respiros. */
const CUPULA: readonly [number, number, number] = [0.32, -0.16, 0.15]
const RESPIROS: readonly (readonly [number, number])[] = [[-0.42, -0.3], [-0.16, -0.42]]
const RAIO_DO_RESPIRO = 0.045
/** As tábuas da fôrma no teto (px): o passo e a junta. */
const TABUA_DA_FORMA = 7.5
/** Os sacos de areia nas pontas da frente do aterro: (x, y) em fração, e o meio comprimento e o raio (px). */
const SACOS: readonly (readonly [number, number])[] = [[-0.86, 0.7], [-0.7, 0.8], [-0.86, 0.9], [0.86, 0.7], [0.7, 0.8], [0.86, 0.9]]
const MEIO_SACO = 5.2
const RAIO_DO_SACO = 3

const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa6, 0xa3, 0x9a] }
const TERRA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x84, 0x6e, 0x55] }
/** O capim do alto do aterro (a leiva que cobre o bunker). */
const LEIVA: MaterialDaPeca = { classe: 'folha', rgb: [0x6a, 0x74, 0x4b] }
const CAPIM: MaterialDaPeca = { classe: 'folha', rgb: [0x5f, 0x6e, 0x45] }
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa9, 0x9e, 0x7c] }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x5c, 0x61, 0x52] }
const FERRO = materialDaPeca('ferro')
const DA_PEDRA = texturaDaClasse('pedra')

/** O teto de laje: o concreto com as juntas das tábuas da fôrma ao comprido, cada tábua num tom. */
const texLaje: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  const fileira = Math.floor(y / TABUA_DA_FORMA)
  const dentro = y - fileira * TABUA_DA_FORMA
  s[3] += (hash(fileira, 7, 1671) - 0.5) * 0.08
  if (dentro < 0.7 && escala >= 0.5) s[3] -= 0.16 * (1 - dentro / 0.7)
}

export const montarBunkerDeConcreto: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const lado = 2 * Math.min(c.hw, c.hh)
  const fx = (v: number): number => v * c.hw
  const fy = (v: number): number => v * c.hh
  const R = Math.min(c.hw, c.hh)
  const H = ALTURA_DO_TETO * lado
  const e = ESPESSURA_DA_LAJE_DO_BUNKER
  const [X, Y0, Y1] = [fx(TETO_X), fy(TETO_Y0), fy(TETO_Y1)]
  /** O que fica em cima do teto sai depois dele: a caixa vai até além da beira do teto, embaixo na tela. */
  const noAlto = (f: Forma): Forma => esticadaParaAFrente(f, Math.max(X, Y0, Y1) + 1, c.giro)
  cena.corDoPiso = [0x4a, 0x47, 0x40]
  const daLuz = (mat: MaterialDaPeca): MaterialDaPeca => tingido(mat, 1.08)
  const daSombra = (mat: MaterialDaPeca): MaterialDaPeca => tingido(mat, 0.86)

  // ---------- no chão: a calçada da frente e o contato do aterro ----------
  S.push(contato(caixa(-fx(ATERRO_FORA), -fy(ATERRO_FORA), fx(ATERRO_FORA), fy(CALCADA_ATE), 6), 0.3))
  L.push(P(caixa(-X - fx(0.06), Y1 - 2, X + fx(0.06), fy(CALCADA_ATE), 2), CONCRETO, { tabua: 0, bisel: 1, tom: 0.9, contorno: 0.24, semente: 16700 }))

  // ---------- o aterro: o degrau de fora e o de dentro, em pedaços; a vala parte o do fundo ----------
  const [xv0, xv1] = [fx(VALA_EM - MEIA_VALA), fx(VALA_EM + MEIA_VALA)]
  /** Um degrau do aterro em quatro pedaços: de `fora` até `dx` (dos lados) e `dy` (no fundo). */
  const degrau = (fora: number, dx: number, dy: number, z: number, mat: MaterialDaPeca, tom: number, semente: number): void => {
    const pedacos: readonly (readonly [Forma, MaterialDaPeca])[] = [
      [caixa(-fx(fora), -fy(fora), xv0, -fy(dy) + 0.01, 3), daLuz(mat)],
      [caixa(xv1, -fy(fora), fx(fora), -fy(dy) + 0.01, 3), daLuz(mat)],
      [caixa(-fx(fora), -fy(dy), -fx(dx) + 0.01, fy(ATERRO_FRENTE), 3), daLuz(mat)],
      [caixa(fx(dx) - 0.01, -fy(dy), fx(fora), fy(ATERRO_FRENTE), 3), daSombra(mat)],
    ]
    pedacos.forEach(([forma, mat], i) => {
      S.push({ forma, z })
      L.push(P(forma, mat, { tabua: 0, bisel: 3, tom, contorno: 0.2, semente: semente + i }))
    })
  }
  degrau(ATERRO_FORA, ATERRO_MEIO, ATERRO_MEIO, ALTURA_DO_ATERRO_DE_FORA * lado, TERRA, 0.92, 16710)
  degrau(ATERRO_MEIO, TETO_X - 0.02, TETO_Y0 - 0.02, ALTURA_DO_ATERRO_DE_DENTRO * lado, LEIVA, 0.96, 16720)
  // O capim em tufos no aterro (sobe com o degrau em que cai).
  for (let i = 0; i < 46; i += 1) {
    const a = hash(i, 1, 1673) * 2 * Math.PI
    const r = 0.74 + 0.22 * hash(i, 2, 1673)
    const [x, y] = [Math.cos(a) * fx(r), Math.sin(a) * fy(r)]
    if (y > fy(ATERRO_FRENTE) - 3 || (x > xv0 - 2 && x < xv1 + 2 && y < 0)) continue
    const raio = 1.6 + 1.6 * hash(i, 3, 1673)
    L.push(P(elipse(x, y, raio, raio * 0.85), CAPIM, { tabua: 0, bisel: raio * 0.6, tom: 0.85 + 0.3 * hash(i, 4, 1673), contorno: 0.24, semente: 16730 + i }))
  }

  // ---------- a vala de entrada no fundo: o chão fundo, os degraus e a porta de aço no fim ----------
  L.push(P(caixa(xv0, -fy(ATERRO_FORA), xv1, -Y0 + 1, 1), TERRA, { tabua: 0, bisel: 0.6, tom: 0.66, contorno: 0.3, recesso: { k: 3, forca: 0.4 }, semente: 16740 }))
  const passo = (fy(ATERRO_FORA) - Y0) / DEGRAUS
  for (let k = 0; k < DEGRAUS; k += 1) {
    const y = -fy(ATERRO_FORA) + passo * (k + 0.5)
    L.push(P(caixa(xv0 + 1, y - passo * 0.32, xv1 - 1, y + passo * 0.32, 0.4), CONCRETO, { tabua: 0, bisel: 0.6, tom: 0.92 - 0.06 * k, contorno: 0.3, semente: 16741 + k }))
  }
  L.push(P(caixa(xv0 + 1.2, -Y0 - 1.6, xv1 - 1.2, -Y0 + 0.4, 0.3), ACO, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.32, metal: 0.3, semente: 16750 }))

  // ---------- o teto: a coluna, a laje com as tábuas da fôrma, a sombra comprida ----------
  const teto = caixa(-X, -Y0, X, Y1, fx(0.08))
  S.push({ forma: teto, z: H })
  L.push(P(teto, CONCRETO, { tabua: 0, bisel: 2.2, tom: 1.04, contorno: 0.28, textura: texLaje, semente: 16760 }))
  // As lascas e as manchas de chuva na beira da laje.
  for (let i = 0; i < 7; i += 1) {
    const t = hash(i, 1, 1677) * 2 - 1
    const [x, y] = i % 2 === 0 ? [t * X * 0.9, Y1 - 2.4] : [-X + 2.4, t * Y0 * 0.8]
    L.push(P(elipse(x, y, 2.2 + 2 * hash(i, 2, 1677), 1.2), CONCRETO, { tabua: 0, bisel: 0, contorno: 0, tom: 0.8, alfa: 0.5, suave: 1, semente: 16770 + i }))
  }

  // ---------- a seteira na face da frente, com o peitoril claro ----------
  const meiaSeteira = fx(MEIA_SETEIRA)
  const [zSet0, zSet1] = [SETEIRA_DE * H, SETEIRA_ATE * H]
  faixaQueSai(P, cena, (sai) => caixa(-meiaSeteira, Y1 - 0.3, meiaSeteira, Y1 + sai), (sai) => [0, Y1 + sai], { sai: SAI_A_SETEIRA, de: zSet0, ate: zSet1, espessura: e }, BURACO, 16782)
  L.push(P(caixa(-meiaSeteira, Y1 + 0.2, meiaSeteira, Y1 + SAI_A_SETEIRA), BURACO, { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.62, semente: 16780 }))
  S.push(solta(caixa(-meiaSeteira - 2, Y1 - 0.3, meiaSeteira + 2, Y1 + SAI_O_PEITORIL), zSet0))
  L.push(P(caixa(-meiaSeteira - 2, Y1 + SAI_O_PEITORIL - 0.9, meiaSeteira + 2, Y1 + SAI_O_PEITORIL), CONCRETO, { tabua: 0, bisel: 0.4, tom: 1.16, contorno: 0.28, semente: 16781 }))

  // ---------- a cúpula de aço de vigia: o colar de concreto, o domo, as frestas e a tampa ----------
  const [cx, cy, cr] = [fx(CUPULA[0]), fy(CUPULA[1]), CUPULA[2] * R]
  discosQueAlargam(P, cena, [cx, cy], cr, 0.35, { de: H, ate: H + ALTURA_DA_CUPULA * lado, espessura: e, forca: 0.24, estica: noAlto }, ACO, 16786)
  // O colar fica no teto: o meio da caixa dele vai para a beira, fora dos discos da cúpula.
  L.push(P(comMeioEm(anel(cx, cy, cr * 1.2, cr * 1.2, cr * 0.9, cr * 0.9), cx + cr * 1.12, cy), CONCRETO, { tabua: 0, bisel: 1, tom: 0.84, contorno: 0.3, semente: 16790 }))
  L.push(P(elipse(cx, cy, cr, cr), ACO, { tabua: 0, bisel: cr * 0.55, contorno: 0.32, metal: 0.34, semente: 16791 }))
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * 2 * Math.PI + 0.3
    L.push(P(capsula(cx + Math.cos(a) * cr * 0.7, cy + Math.sin(a) * cr * 0.7, cx + Math.cos(a + 0.42) * cr * 0.7, cy + Math.sin(a + 0.42) * cr * 0.7, 0.6), BURACO, { tabua: 0, bisel: 0, contorno: 0.1, tom: 0.6, semente: 16792 + k }))
  }
  L.push(P(elipse(cx - cr * 0.12, cy - cr * 0.12, cr * 0.36, cr * 0.36), ACO, { tabua: 0, bisel: 0.8, tom: 1.1, contorno: 0.3, metal: 0.4, projeta: { dist: 0.8, forca: 0.3 }, semente: 16799 }))

  // ---------- os respiros: o cano e o chapéu ----------
  RESPIROS.forEach(([x0, y0], i) => {
    const [x, y, r] = [fx(x0), fy(y0), RAIO_DO_RESPIRO * R * 2]
    discosQueAlargam(P, cena, [x, y], r * 0.6, 0.3, { de: H, ate: H + ALTURA_DO_RESPIRO * lado, espessura: e, forca: 0.24, estica: noAlto }, FERRO, 16802 + i * 4)
    L.push(P(elipse(x, y, r, r), FERRO, { tabua: 0, bisel: r * 0.5, tom: 0.95, contorno: 0.34, metal: 0.36, projeta: { dist: 1, forca: 0.3 }, semente: 16800 + i }))
    L.push(P(elipse(x - r * 0.2, y - r * 0.2, r * 0.3, r * 0.3), FERRO, { tabua: 0, bisel: 0.3, tom: 1.2, contorno: 0, metal: 0.5, semente: 16810 + i }))
  })

  // ---------- os sacos de areia nas pontas da frente do aterro (cada um uma coluna baixa) ----------
  SACOS.forEach(([x0, y0], i) => {
    const [x, y] = [fx(x0), fy(y0)]
    const saco = capsula(x - MEIO_SACO, y, x + MEIO_SACO, y, RAIO_DO_SACO)
    S.push({ forma: saco, z: 0.07 * lado, forca: 0.2 })
    L.push(P(saco, LONA, { tabua: 0, bisel: RAIO_DO_SACO * 0.8, tom: 0.9 + 0.16 * hash(i, 1, 1682), contorno: 0.3, projeta: { dist: 1, forca: 0.3 }, semente: 16820 + i }))
  })
}
