/**
 * TEAR DE PEDAL de cima com volume (objetos de 14/11/2026, grupo Cidade e
 * vila). O tear fica com o fundo para a beira de cima da pegada e o banco do
 * tecelão na de baixo. De cima aparecem, do fundo para a frente: o ROLO DO
 * URDUME (a trave de trás com o fio enrolado e a catraca de ferro na ponta), a
 * folha dos FIOS esticados, as duas varetas da cruz, o CASTELO (a trave alta
 * que segura os liços, atravessada por cima de tudo), os dois QUADROS DE LIÇOS
 * com os arames, o PENTE na batente, o PANO já tecido com as listras, a TRAVE
 * DO PEITO com o pano dobrando por cima dela, a NAVETE deitada no pano com a
 * bobina de fio e, no chão entre o tear e o banco, as pontas dos PEDAIS.
 *
 * O que diz "tear" a 1x: as listras finas dos fios (claras, com a fresta escura
 * entre elas) que acabam num pano liso de outra cor, o quadro de madeira em
 * volta e a navete. O banco na frente diz que alguém senta ali.
 *
 * NA 3/4 (`tresQuartos.ts`, derivado) o plano dos fios é um tampo solto na
 * altura do peito, os trilhos do lado sobem mais, o castelo mais ainda (com os
 * dois montantes como colunas) e o banco é um tampo baixo.
 *
 * Materiais: `madeira` (o quadro, o banco, a navete), `fio` (o urdume e o rolo,
 * um tecido) e `pano` (o que está sendo tecido, outro tecido). O ferro da
 * catraca e os arames dos liços são fixos.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, elipse, poligono, type Forma } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { LENCOL, QUARTO, type MontarMovel } from './contexto'

/** Alturas, em casas: o plano dos fios (a trave do peito), os trilhos do lado, o castelo e o banco. */
const ALTURA_DOS_FIOS = 0.55
const ALTURA_DOS_TRILHOS = 0.7
const ALTURA_DO_CASTELO = 1.05
const ALTURA_DO_BANCO = 0.33

/** As faixas da pegada (fração da altura, do alto): onde cada parte do tear começa e acaba. */
const ROLO = [0.025, 0.105] as const
const CRUZ = [0.165, 0.205] as const
const CASTELO = [0.215, 0.255] as const
const LICOS = [0.285, 0.375] as const
const PENTE = [0.415, 0.45] as const
const BATENTE = [0.45, 0.49] as const
const PEITO = [0.625, 0.69] as const
const PEDAIS = [0.6, 0.79] as const
const BANCO = [0.8, 0.95] as const
/** O fim do quadro (os trilhos do lado acabam na trave do peito). */
const FIM_DO_QUADRO = 0.7

/** As larguras (fração da largura): o trilho do lado, o banco e o vão entre os fios e o trilho. */
const TRILHO = 0.075
const MEIO_BANCO = 0.33
const FOLGA_DOS_FIOS = 0.035

/**
 * Os fios do urdume: o passo (px do protótipo), a luz do meio do fio, a fresta
 * escura entre dois fios e o quanto do passo ela toma. Abaixo de `ESCALA_MIUDA`
 * (pixels da imagem por px; o nível 1 tem 0,89) o passo cai em 2 ou 3 pixels e
 * as listras viram grade: o contraste cai para `CONTRASTE_MIUDO`.
 */
const PASSO_DOS_FIOS = 1.9
const LUZ_DO_FIO = 0.1
const FUNDO_DA_FRESTA = 0.34
const FRESTA = 0.34
const ESCALA_MIUDA = 1.6
const CONTRASTE_MIUDO = 0.55

/** Os arames dos liços e do pente: passo mais miúdo, o arame claro e o vão escuro. */
const PASSO_DOS_ARAMES = 1.5
const FUNDO_DO_VAO_DOS_ARAMES = 0.3

/** O pano tecido: duas listras de fio cru atravessadas (fração da faixa do pano) e a largura delas (px). */
const LISTRAS_DO_PANO = [0.3, 0.62] as const
const LISTRA = 1.7

/** O ferro da catraca e o arame dos liços. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
const ARAME: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.25)) }

/** Listras ao longo de y, de passo `passo`: claro no meio de cada uma, escuro na fresta. */
function texDeListras(passo: number, luz: number, fundo: number, fresta: number): Textura {
  return (_u, _v, x, _y, _p, s, escala) => {
    const f = x / passo - Math.floor(x / passo)
    const doMeio = Math.abs(f - 0.5) * 2
    const forca = escala < ESCALA_MIUDA ? CONTRASTE_MIUDO : 1
    s[3] += forca * (doMeio > 1 - fresta ? -fundo : luz * (1 - doMeio))
  }
}

/** O pano tecido: a trama do tecido e a batida da trama, finas listras de través (o fio de cada passada). */
function texDoPano(): Textura {
  const doTecido = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (doTecido !== null) doTecido(u, v, x, y, p, s, escala)
    s[3] += Math.sin(y * 2.4) * (escala < ESCALA_MIUDA ? 0.015 : 0.035)
  }
}

export const montarTearDePedal: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const fio = c.m.fio
  const pano = c.m.pano
  const L = cena.partes
  const y = (t: number): number => -hh + t * h
  const trilho = TRILHO * w
  const xDentro = hw - trilho
  const xFios = xDentro - FOLGA_DOS_FIOS * w
  const yFim = y(FIM_DO_QUADRO)

  // As alturas: os montantes dos cantos e do castelo são colunas; os fios, os trilhos, o castelo e o banco, tampos.
  const lado = trilho
  cena.sombras.push(
    contato(caixa(-hw, y(0), hw, yFim, 2), 0.2),
    { forma: caixa(-xDentro, y(ROLO[0]), xDentro, y(PEITO[1]), 1), z: g * ALTURA_DOS_FIOS, solta: true, forca: 0.16 },
    { forma: caixa(-hw, y(CASTELO[0]), hw, y(CASTELO[1]), 1), z: g * ALTURA_DO_CASTELO, solta: true, forca: 0.3 },
    { forma: caixa(-MEIO_BANCO * w, y(BANCO[0]), MEIO_BANCO * w, y(BANCO[1]), 1.5), z: g * ALTURA_DO_BANCO, solta: true, forca: 0.3 },
  )
  for (const x0 of [-hw, hw - trilho]) {
    cena.sombras.push({ forma: caixa(x0, y(0), x0 + trilho, yFim), z: g * ALTURA_DOS_TRILHOS, solta: true, forca: 0.3 })
    for (const y0 of [y(0), yFim - lado]) cena.sombras.push({ forma: caixa(x0, y0, x0 + lado, y0 + lado), z: g * ALTURA_DOS_TRILHOS }, contato(caixa(x0, y0, x0 + lado, y0 + lado), 0.32))
    cena.sombras.push({ forma: caixa(x0, y(CASTELO[0]), x0 + lado, y(CASTELO[1])), z: g * ALTURA_DO_CASTELO })
  }
  for (const x0 of [-MEIO_BANCO * w, MEIO_BANCO * w - lado]) cena.sombras.push(contato(caixa(x0, y(BANCO[0]) + 1, x0 + lado, y(BANCO[1]) - 1), 0.3))

  // Os PEDAIS no chão: só as pontas aparecem entre a trave do peito e o banco.
  for (let i = 0; i < 4; i += 1) {
    const x = (i - 1.5) * 0.11 * w
    L.push(P(caixa(x - 0.032 * w, y(PEDAIS[0]), x + 0.032 * w, y(PEDAIS[1]), 1), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 0.72, semente: 10 + i }))
  }

  // Os TRILHOS do lado, com os montantes nas pontas (a cabeça da cavilha, mais clara).
  for (const [i, x0] of [-hw, hw - trilho].entries()) {
    L.push(P(caixa(x0, y(0), x0 + trilho, yFim, 1.2), mad, { eixo: QUARTO, tabua: 0, bisel: 1.4, tom: 0.96, semente: 20 + i, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } }))
    for (const [j, y0] of [y(0) + lado / 2, yFim - lado / 2].entries()) {
      L.push(P(elipse(x0 + trilho / 2, y0, trilho * 0.22, trilho * 0.22), mad, { tabua: 0, bisel: 0.6, tom: 1.18, contorno: 0.3, semente: 22 + i * 2 + j }))
    }
  }

  // Os FIOS do urdume, esticados do rolo até a batente, e as duas varetas da cruz.
  const urdume = texDeListras(PASSO_DOS_FIOS, LUZ_DO_FIO, FUNDO_DA_FRESTA, FRESTA)
  L.push(P(caixa(-xFios, y(ROLO[1]) - 1, xFios, y(BATENTE[0]) + 1), fio, { eixo: QUARTO, tabua: 0, bisel: 0.4, contorno: 0.2, textura: urdume, semente: 30 }))
  for (const [i, t] of [CRUZ[0], CRUZ[1]].entries()) {
    L.push(P(capsula(-xFios - 1.5, y(t), xFios + 1.5, y(t), 0.85), mad, { tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.26, semente: 32 + i, projeta: { dist: 0.8, forca: 0.3 } }))
  }

  // O ROLO DO URDUME: a trave de trás, o fio enrolado nela e a catraca de ferro na ponta da direita.
  const yRolo = (y(ROLO[0]) + y(ROLO[1])) / 2
  const rRolo = (y(ROLO[1]) - y(ROLO[0])) / 2
  L.push(P(caixa(-xDentro - 1, y(ROLO[0]), xDentro + 1, y(ROLO[1]), rRolo * 0.6), mad, { tabua: 0, bisel: 1, tom: 0.9, curvaY: { c: yRolo, r: rRolo, forca: 0.5 }, semente: 40 }))
  L.push(P(caixa(-xFios, y(ROLO[0]) + 0.6, xFios, y(ROLO[1]) - 0.6, rRolo * 0.7), fio, { tabua: 0, bisel: 0.8, tom: 1.04, contorno: 0.22, curvaY: { c: yRolo, r: rRolo, forca: 0.55 }, semente: 41 }))
  L.push(P(elipse(xDentro - 2.4, yRolo, 2.6, rRolo * 1.05), FERRO, { bisel: 0.8, contorno: 0.3, metal: 0.5, semente: 42 }))
  L.push(P(elipse(xDentro - 2.4, yRolo, 1, 1), mad, { bisel: 0.4, tom: 0.8, contorno: 0.3, semente: 43 }))

  // Os dois QUADROS DE LIÇOS: os arames entre duas réguas de madeira, um quadro atrás do outro.
  const aramesDosLicos = texDeListras(PASSO_DOS_ARAMES, 0.08, FUNDO_DO_VAO_DOS_ARAMES, 0.4)
  const meioLicos = (LICOS[0] + LICOS[1]) / 2
  for (const [i, [t0, t1]] of ([[LICOS[0], meioLicos - 0.004], [meioLicos + 0.004, LICOS[1]]] as const).entries()) {
    L.push(P(caixa(-xFios - 0.5, y(t0) + 1, xFios + 0.5, y(t1) - 1), ARAME, { eixo: QUARTO, tabua: 0, bisel: 0.3, contorno: 0.16, textura: aramesDosLicos, semente: 50 + i }))
    for (const [j, t] of [t0, t1].entries()) {
      L.push(P(capsula(-xFios - 1, y(t) + (j === 0 ? 0.9 : -0.9), xFios + 1, y(t) + (j === 0 ? 0.9 : -0.9), 0.9), mad, { tabua: 0, bisel: 0.5, tom: 1.02, contorno: 0.24, semente: 52 + i * 2 + j, projeta: { dist: 0.7, forca: 0.26 } }))
    }
  }

  // O PANO tecido entre a batente e a trave do peito, com as listras de fio cru, e a parte que dobra por cima da trave.
  const yPano0 = y(BATENTE[1])
  const yPano1 = y(PEITO[0])
  const texPano = texDoPano()
  L.push(P(caixa(-xFios, yPano0 - 1, xFios, yPano1 + 1), pano, { tabua: 0, bisel: 0.6, contorno: 0.22, textura: texPano, semente: 60 }))
  for (const [i, t] of LISTRAS_DO_PANO.entries()) {
    const yl = yPano0 + t * (yPano1 - yPano0)
    L.push(P(caixa(-xFios + 0.3, yl - LISTRA / 2, xFios - 0.3, yl + LISTRA / 2), LENCOL, { tabua: 0, bisel: 0, contorno: 0, tom: 0.96, textura: texPano, semente: 61 + i }))
  }

  // A TRAVE DO PEITO, redonda, de ponta a ponta do quadro, e o pano dobrando por cima dela.
  const yPeito = (y(PEITO[0]) + y(PEITO[1])) / 2
  const rPeito = (y(PEITO[1]) - y(PEITO[0])) / 2
  L.push(P(caixa(-hw + 0.5, y(PEITO[0]), hw - 0.5, y(PEITO[1]), rPeito * 0.7), mad, { tabua: 0, bisel: 1.2, tom: 1.04, curvaY: { c: yPeito, r: rPeito, forca: 0.5 }, semente: 64, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } }))
  L.push(P(caixa(-xFios, y(PEITO[0]) - 0.4, xFios, y(PEITO[1]) - 0.8, rPeito * 0.5), pano, { tabua: 0, bisel: 0.8, contorno: 0.24, tom: 1.02, curvaY: { c: yPeito, r: rPeito, forca: 0.5 }, textura: texPano, semente: 65 }))

  // O PENTE e a BATENTE: os arames finos do pente atrás da régua pesada que bate a trama.
  const aramesDoPente = texDeListras(PASSO_DOS_ARAMES * 0.8, 0.1, FUNDO_DO_VAO_DOS_ARAMES, 0.38)
  L.push(P(caixa(-xFios - 1, y(PENTE[0]), xFios + 1, y(PENTE[1])), ARAME, { eixo: QUARTO, tabua: 0, bisel: 0.3, contorno: 0.2, textura: aramesDoPente, semente: 66 }))
  L.push(P(caixa(-xDentro + 0.5, y(BATENTE[0]), xDentro - 0.5, y(BATENTE[1]), 1), mad, { tabua: 0, bisel: 1.3, tom: 0.98, semente: 67, projeta: { dist: 1.4, forca: 0.32, suave: 0.7 } }))

  // A NAVETE deitada no pano, de través, com a bobina de fio cru no vão do meio.
  const xNav = xFios * 0.42
  const yNav = yPano0 + (yPano1 - yPano0) * 0.48
  const comp = 0.21 * w
  const navete: Forma = poligono([[xNav - comp, yNav + 0.6], [xNav - comp * 0.55, yNav - 2.1], [xNav + comp * 0.55, yNav - 2.1], [xNav + comp, yNav - 0.6], [xNav + comp * 0.55, yNav + 2.1], [xNav - comp * 0.55, yNav + 2.1]])
  L.push(P(navete, mad, { tabua: 0, bisel: 1.2, tom: 1.22, contorno: 0.3, semente: 70, projeta: { dist: 1.2, forca: 0.36, suave: 0.6 } }))
  L.push(P(elipse(xNav, yNav, comp * 0.42, 1.3), fio, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.26, semente: 71 }))

  // O CASTELO por cima de tudo: a trave alta com as duas roldanas dos liços.
  L.push(P(caixa(-hw, y(CASTELO[0]), hw, y(CASTELO[1]), 1.2), mad, { tabua: 0, bisel: 1.5, tom: 1.08, semente: 80, projeta: { dist: 2.2, forca: 0.34, suave: 1 } }))
  for (const [i, x] of [-xFios * 0.5, xFios * 0.5].entries()) {
    L.push(P(elipse(x, (y(CASTELO[0]) + y(CASTELO[1])) / 2, 2.4, 1.5), mad, { tabua: 0, bisel: 0.8, tom: 0.86, contorno: 0.3, semente: 81 + i }))
  }

  // O BANCO do tecelão, de tábuas ao comprido, com dois novelos na ponta da esquerda.
  L.push(P(caixa(-MEIO_BANCO * w, y(BANCO[0]), MEIO_BANCO * w, y(BANCO[1]), 1.6), mad, { tabua: 7, bisel: 1.4, tom: 1, semente: 90, projeta: { dist: 1.4, forca: 0.3, suave: 0.7 } }))
  const yNovelo = (y(BANCO[0]) + y(BANCO[1])) / 2
  const rNovelo = 0.045 * Math.min(w, h)
  L.push(P(elipse(-MEIO_BANCO * w + rNovelo * 1.5, yNovelo, rNovelo, rNovelo), pano, { tabua: 0, bisel: rNovelo * 0.8, contorno: 0.26, semente: 91, projeta: { dist: 1, forca: 0.32 } }))
  L.push(P(elipse(-MEIO_BANCO * w + rNovelo * 3.4, yNovelo + 0.6, rNovelo * 0.85, rNovelo * 0.85), fio, { tabua: 0, bisel: rNovelo * 0.7, contorno: 0.26, semente: 92, projeta: { dist: 1, forca: 0.32 } }))
}
