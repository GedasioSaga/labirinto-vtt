/**
 * LANTERNA GRADEADA DE PAREDE de cima com volume (lote L04 de 24/11/2026, a
 * Fortaleza do ritual; versão da tocha de parede). A arandela de corredor de
 * prisão: a CHAPA de ferro na parede (a beira de cima da pegada, giro 0), o
 * BRAÇO forjado curto e a LANTERNA quadrada de ferro com vidro âmbar, fechada
 * por uma GRADE em cruz com o botão no meio e um pilarete em cada quina. Luz
 * amarela e parada, sem fumaça (a luz de verdade é do integrador).
 *
 * Feita para ir às dezenas ao longo de um corredor, girada para cada parede:
 * miúda, sem sombra no chão (ela é a luz) e lida pelo quadrado claro cortado
 * pela cruz escura na ponta de um braço curto. Não é tocha (a cabeça de pano
 * redonda com a brasa) nem lampião (o poste com a cúpula redonda).
 *
 * ACESA (variante 0) e APAGADA (variante 1), como a tocha: apagada, o vidro
 * fica cor de âmbar sujo, com um risco de reflexo, e o brilho do chão some.
 *
 * NA 3/4 a lanterna sobe POUCO, pela mesma conta da tocha de parede
 * (`SUBIDA_DA_TOCHA_DE_PAREDE`, a decisão 27 do mestre: a parede do app é uma
 * linha sem altura, e a chapa continua na linha dela). A chapa é um tampo e o
 * braço sobe com ela; a lanterna é outro tampo, mais alto, com o vidro, a
 * grade e os pilaretes em cima. A beirada dos tampos é
 * `ESPESSURA_DA_LANTERNA_GRADEADA` (o perfil da 3/4 usa): a cara de ferro do
 * pé da lanterna. Na parede de BAIXO (giro 180) a chapa sobe como coluna, para
 * não ficar fresta até a linha, como na tocha.
 *
 * As alturas são em lados (o menor lado da pegada). Material: `metal` (a
 * chapa, o braço e a lanterna). O vidro é fixo.
 */
import { SUBIDA_DA_TOCHA_DE_PAREDE, TOCHA_DE_PAREDE } from '../../../lib/mobilia/fogoDeCasa'
import { limitar01, misturar, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, type Forma } from './formas'
import { ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { texHalo } from './fogoDeCasa'

/** A beirada de cada tampo (px do protótipo): a cara de ferro do pé da lanterna. O perfil da 3/4 usa este valor. */
export const ESPESSURA_DA_LANTERNA_GRADEADA = 0.3 * G * SUBIDA_DA_TOCHA_DE_PAREDE

/**
 * As medidas de cima, em fração do menor meio lado; o `y` conta da parede (a beira de cima da pegada). A chapa
 * é a da tocha de parede (`TOCHA_DE_PAREDE`): as duas prendem na parede do mesmo jeito.
 */
const MEIA_LARGURA_DA_CHAPA = TOCHA_DE_PAREDE.meiaLarguraDaChapa
const GROSSURA_DA_CHAPA = TOCHA_DE_PAREDE.grossuraDaChapa
const RAIO_DO_BRACO = 0.085
/**
 * A lanterna: onde fica o meio dela, o meio lado da caixa, a moldura de ferro, a meia barra da grade, o pilarete e
 * o botão. A barra tem 0,078 (era 0,055) e é mais escura que a moldura (`TOM_DA_GRADE`), e o botão é menor: no
 * tamanho de mesa a cruz da grade quase sumia no vidro aceso e a lanterna virava um ponto amarelo (conferido na
 * revisão do diretor de arte, 24/11/2026).
 */
const LANTERNA_EM = 1.06
const MEIO_LADO = 0.56
const MOLDURA = 0.13
const MEIA_BARRA = 0.078
const PILARETE = 0.15
const BOTAO = 0.13
/** O brilho no chão, na frente da lanterna (o meio além dela, os raios e o alfa), e o halo em volta dela. */
const BRILHO_NO_CHAO_ALEM = 0.62
const BRILHO_NO_CHAO: readonly [number, number] = [1, 0.78]
const ALFA_DO_BRILHO_NO_CHAO = 0.15
const HALO = 0.98
const ALFA_DO_HALO = 0.3

/** Alturas em lados, já com a subida da tocha de parede: a chapa e o alto da lanterna. De cima não pintam nada. */
const ALTURA_DA_CHAPA = TOCHA_DE_PAREDE.alturaDaChapa * SUBIDA_DA_TOCHA_DE_PAREDE
const ALTURA_DA_LANTERNA = 1.5 * SUBIDA_DA_TOCHA_DE_PAREDE
/** O giro (graus, `ContextoDoMovel.giro`) da lanterna presa na parede de baixo: a chapa fica embaixo na tela. */
const GIRO_DA_PAREDE_DE_BAIXO = 180

const TOM_DA_CHAPA = 0.92
const TOM_DO_BRACO = 1.04
const TOM_DA_MOLDURA = 0.94
const TOM_DA_GRADE = 0.86
const TOM_DO_PILARETE = 1.18
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/**
 * O vidro: o miolo claro e a beira âmbar (saturação 0,58, abaixo do teto de 0,62: o vidro é boa parte dos pixels
 * opacos da peça). Apagado, o âmbar sujo e o reflexo.
 */
const MIOLO_ACESO: Rgb = [0xfd, 0xec, 0xb8]
const BEIRA_ACESA: Rgb = [0xdc, 0xac, 0x5c]
const VIDRO_APAGADO: Rgb = [0x7c, 0x6c, 0x50]
const REFLEXO: Rgb = [0xd8, 0xce, 0xb4]
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: BEIRA_ACESA }

const DO_METAL = texturaDaClasse('metal')

/** A mesma forma com a caixa centrada em (mx, my): o desenho não muda, mas a peça sobe com o que está ali. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** O ferro torcido do braço: a textura do metal com as voltas da torção em diagonal. */
const texTorcido: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  s[3] += 0.13 * Math.sin((x + y) * 2.3)
}

/** O vidro aceso: do miolo claro (cx, cy) à beira âmbar, quase todo emissão; apagado, o âmbar sujo com o risco do reflexo. */
function texDoVidro(cx: number, cy: number, meio: number, acesa: boolean): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.max(Math.abs(x - cx), Math.abs(y - cy)) / meio
    if (acesa) {
      const cor = misturar(MIOLO_ACESO, BEIRA_ACESA, limitar01(q * 1.05 + ruido(x * 0.6 + 3, y * 0.6 + 9) * 0.2) ** 1.4)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
      s[4] = 0.9
      return
    }
    // O risco do reflexo em diagonal, de cima à esquerda.
    const risco = limitar01(1 - Math.abs((x - cx + (y - cy)) / meio + 0.5) / 0.22) * 0.5
    s[0] = VIDRO_APAGADO[0] + (REFLEXO[0] - VIDRO_APAGADO[0]) * risco
    s[1] = VIDRO_APAGADO[1] + (REFLEXO[1] - VIDRO_APAGADO[1]) * risco
    s[2] = VIDRO_APAGADO[2] + (REFLEXO[2] - VIDRO_APAGADO[2]) * risco
    s[3] += ruido(x * 0.5 + 3, y * 0.5 + 9) * 0.1 - 0.12 * q
  }
}

/** O amarelo do halo e do brilho no chão. */
const AMARELO: Rgb = [0xff, 0xdf, 0x8e]

/** O halo amarelo: o `texHalo` do fogo de casa com o tom do vidro (lá ele é o laranja da brasa). */
function texHaloAmarelo(cx: number, cy: number, rx: number, ry: number, alfa: number): Textura {
  const doFogo = texHalo(cx, cy, rx, ry, alfa)
  return (u, v, x, y, p, s, escala) => {
    doFogo(u, v, x, y, p, s, escala)
    s[0] = AMARELO[0]
    s[1] = AMARELO[1]
    s[2] = AMARELO[2]
  }
}

export const montarLanternaGradeada: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const ferro = c.m.metal
  const acesa = c.variante !== 1
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const parede = -c.hh
  const yL = parede + LANTERNA_EM * R
  const m = MEIO_LADO * R
  const solta = (forma: Forma, alto: number) => ({ forma, z: alto * lado, solta: true, forca: 0 })
  const doFerro = (tom: number, bisel: number, semente: number, textura?: Textura) => ({ tabua: 0, bisel, tom, metal: BRILHO_DO_FERRO, contorno: 0.3, textura, semente })

  // ---------- no chão: o brilho amarelo na frente (apagada, invisível) ----------
  const by = yL + BRILHO_NO_CHAO_ALEM * R
  const [brx, bry] = [BRILHO_NO_CHAO[0] * R, Math.max(0.1, Math.min(BRILHO_NO_CHAO[1] * R, c.hh - by))]
  // O meio da caixa fica na ponta de baixo do brilho, fora da lanterna: ele não sobe com ela.
  if (acesa) L.push(P(comMeioEm(elipse(0, by, brx, bry), 0, by + bry * 0.9), VIDRO, { bisel: 0, contorno: 0, textura: texHaloAmarelo(0, by, brx, bry, ALFA_DO_BRILHO_NO_CHAO), semente: 3301 }))

  // ---------- a chapa na parede, com o braço torcido por cima ----------
  const chapa = caixa(-MEIA_LARGURA_DA_CHAPA * R, parede, MEIA_LARGURA_DA_CHAPA * R, parede + GROSSURA_DA_CHAPA * R, 0.5)
  const naChapa: readonly [number, number] = [MEIA_LARGURA_DA_CHAPA * R * 0.6, parede + GROSSURA_DA_CHAPA * R * 0.5]
  cena.sombras.push(c.giro === GIRO_DA_PAREDE_DE_BAIXO ? { forma: chapa, z: ALTURA_DA_CHAPA * lado, forca: 0 } : solta(chapa, ALTURA_DA_CHAPA))
  L.push(P(chapa, ferro, doFerro(TOM_DA_CHAPA, 0.6, 3305)))
  const braco = capsula(0, parede + GROSSURA_DA_CHAPA * R * 0.5, 0, yL - m, RAIO_DO_BRACO * R)
  L.push(P(comMeioEm(braco, naChapa[0], naChapa[1]), ferro, { ...doFerro(TOM_DO_BRACO, 0.8, 3306, texTorcido), projeta: { dist: 0.8, forca: 0.3 } }))

  // ---------- a lanterna: o halo, a moldura de ferro, o vidro, a grade em cruz, os pilaretes e o botão ----------
  const corpo = caixa(-m, yL - m, m, yL + m, 0.9)
  cena.sombras.push(solta(corpo, ALTURA_DA_LANTERNA))
  if (acesa) {
    const rh = HALO * R
    L.push(P(elipse(0, yL, rh, rh), VIDRO, { bisel: 0, contorno: 0, textura: texHaloAmarelo(0, yL, rh, rh, ALFA_DO_HALO), semente: 3310 }))
  }
  // A moldura é a maior peça da lanterna: o material dela é o da cara que a 3/4 varre.
  L.push(P(corpo, ferro, doFerro(TOM_DA_MOLDURA, 1, 3311)))
  const v = m - MOLDURA * R
  L.push(P(caixa(-v, yL - v, v, yL + v, 0.5), VIDRO, { bisel: 0, contorno: 0.14, recesso: { k: 1.1, forca: acesa ? 0.2 : 0.36 }, textura: texDoVidro(0, yL, v, acesa), semente: 3312 }))
  const barra = MEIA_BARRA * R
  const grade = { ...doFerro(TOM_DA_GRADE, barra * 0.8, 3313), contorno: 0.34, projeta: { dist: 0.7, forca: acesa ? 0.16 : 0.3 } }
  L.push(P(caixa(-barra, yL - m + 0.4, barra, yL + m - 0.4, barra * 0.6), ferro, grade))
  L.push(P(caixa(-m + 0.4, yL - barra, m - 0.4, yL + barra, barra * 0.6), ferro, { ...grade, semente: 3314 }))
  const p = PILARETE * R
  let k = 0
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const [x, y] = [sx * (m - p * 0.75), yL + sy * (m - p * 0.75)]
      L.push(P(caixa(x - p, y - p, x + p, y + p, p * 0.5), ferro, { ...doFerro(TOM_DO_PILARETE, p * 0.7, 3320 + k), projeta: { dist: 0.6, forca: 0.26 } }))
      k += 1
    }
  }
  const b = BOTAO * R
  L.push(P(elipse(0, yL, b, b), ferro, { ...doFerro(TOM_DO_PILARETE, b * 0.85, 3330), metal: 0.5, projeta: { dist: 0.7, forca: 0.26 } }))
}
