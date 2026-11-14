/**
 * ALVO DE DARDOS (L09 dos objetos novos, 14/11/2026, grupo Taverna e festa),
 * EM PÉ, de frente como a tapeçaria de parede e o alvo de arco e flecha: é
 * coisa de parede, e vista do alto seria um risco. A PAREDE é a beira de cima
 * da pegada (giro 0), como na tapeçaria e na tocha de parede.
 *
 * O ARMÁRIO de taverna aberto: a caixa de madeira com a moldura, o fundo
 * escuro, e as duas PORTAS abertas para os lados, cada uma com a LOUSA de
 * ardósia por dentro: na da esquerda, o placar riscado em giz (as duas colunas
 * dos jogadores e os pontos, uns cortados); na da direita, a contagem em
 * grupos de cinco. No meio, o ALVO de sisal: os vinte gomos alternados, escuro
 * e cru, o anel dos duplos e o dos triplos em vermelho e verde (vermelho nos
 * gomos escuros, verde nos claros), o centro verde com o miolo vermelho, os
 * arames finos que separam tudo e o anel preto dos números em volta (os
 * números são marcas claras: no tamanho de mesa número nenhum se lê). Três
 * DARDOS cravados, saindo do alvo para quem olha: o corpo de latão, a haste e
 * a pena em X de uma cor, cada um com a sombra no alvo. Um toco de giz na
 * beira de baixo.
 *
 * O que separa este do alvo de arco e flecha a 25% de zoom é a roda de gomos
 * (o outro tem anéis) e as duas lousas escuras dos lados. O desenho é feito
 * numa pegada de 1,3 x 0,9 casa e escala com ela; a sombra no chão é a de
 * baixo, que a 3/4 do em pé põe. Material: `madeira` (o armário); o sisal, a
 * tinta, a ardósia, o giz e os dardos são fixos.
 */
import { type Rgb } from '../../ruido'
import { anel, barra, caixa, capsula, elipse, poligono, type Ponto } from './formas'
import { ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** A pegada em que o desenho é feito (px do protótipo): 1,3 x 0,9 casa. */
const LARGURA_DO_DESENHO = 72.8
const ALTURA_DO_DESENHO = 50.4

// ---------- o armário (px do desenho, o meio na origem) ----------

/** A caixa: a meia largura, o alto e o baixo, e a grossura da moldura. */
const CAIXA = { meia: 19, alto: -24.2, baixo: 23.2, moldura: 2.6 } as const
/** As portas abertas: a largura de cada uma, o recuo em cima e embaixo e a grossura da moldura delas. */
const PORTA = { largura: 16.6, recuo: 1, moldura: 2.2 } as const
/** As dobradiças de latão: a altura de cada uma e onde ficam (frações da altura da porta). */
const DOBRADICA = { altura: 3.2, onde: [0.18, 0.82] as readonly number[] } as const

// ---------- o alvo ----------

/** O meio do alvo e os raios: a área de pontos e o anel dos números. */
const MEIO_DO_ALVO: Ponto = [0, -1.6]
const RAIO_DOS_PONTOS = 12.6
const RAIO_DOS_NUMEROS = 15.6
/** Os anéis, em frações do raio dos pontos: o duplo, o triplo, o centro e o miolo. */
const DUPLO = [0.93, 1] as const
const TRIPLO = [0.56, 0.63] as const
const CENTRO = 0.1
const MIOLO = 0.045
const GOMOS = 20
/** As cores do alvo, contidas: o gomo escuro e o cru, o vermelho e o verde dos anéis, o preto dos números. */
const GOMO_ESCURO: Rgb = [0x3c, 0x38, 0x33]
const GOMO_CRU: Rgb = [0xd6, 0xc6, 0x9e]
const VERMELHO: Rgb = [0xa8, 0x4c, 0x42]
const VERDE: Rgb = [0x4e, 0x7c, 0x54]
const PRETO: Rgb = [0x2e, 0x2c, 0x2a]
const NUMERO: Rgb = [0xd8, 0xd2, 0xc2]
/** O arame que separa os gomos e os anéis: a meia largura (px) e a luz. */
const ARAME = { meia: 0.22, luz: 0.22 } as const
const SISAL: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: GOMO_CRU }

// ---------- os dardos ----------

/** Cada dardo: onde crava (px do desenho) e a cor da pena. */
const DARDOS: readonly (readonly [number, number, Rgb])[] = [
  [1.2, -9.8, [0xa8, 0x4c, 0x42]],
  [-5.2, 1.4, [0x4e, 0x70, 0x98]],
  [4.4, 3.6, [0x4e, 0x7c, 0x54]],
]
/** O dardo sai do alvo para quem olha, para baixo e para a direita: o corpo, a haste e a pena (px). */
const CORPO_DO_DARDO: Ponto = [1.9, 2.9]
const HASTE_DO_DARDO: Ponto = [3.1, 4.8]
const PENA = { meia: 2.3, fina: 0.55 } as const
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xb4, 0x96, 0x5a] }
const HASTE: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x36, 0x34] }

// ---------- o giz ----------

const GIZ: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xe0, 0xd4] }
const ALFA_DO_GIZ = 0.82

/** O alvo ponto a ponto: o gomo, os anéis, os arames e o anel dos números, por cima da trama do sisal. */
function texDoAlvo(cx: number, cy: number): Textura {
  const sisal = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (sisal !== null) sisal(u, v, x, y, p, s, escala)
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy)
    const t = r / RAIO_DOS_PONTOS
    // O gomo: o primeiro fica em pé no alto (o 20 das tavernas), os outros em volta.
    const angulo = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI / GOMOS + 4 * Math.PI) % (2 * Math.PI)
    const fatia = angulo / ((2 * Math.PI) / GOMOS)
    const gomo = Math.floor(fatia)
    const escuro = gomo % 2 === 0
    let cor: Rgb
    if (t > 1) {
      cor = PRETO
      // As marcas dos números, no meio de cada gomo, no anel preto.
      const noMeio = Math.abs(fatia - gomo - 0.5) * ((2 * Math.PI * r) / GOMOS)
      const noAnel = Math.abs(r - (RAIO_DOS_PONTOS + RAIO_DOS_NUMEROS) / 2)
      if (noMeio < 0.6 && noAnel < 0.9) cor = NUMERO
    } else if (t < MIOLO) cor = VERMELHO
    else if (t < CENTRO) cor = VERDE
    else if ((t > TRIPLO[0] && t < TRIPLO[1]) || t > DUPLO[0]) cor = escuro ? VERMELHO : VERDE
    else cor = escuro ? GOMO_ESCURO : GOMO_CRU
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    let luz = ruido(x * 1.3 + p.su, y * 1.3) * 0.04
    // Os arames: nas divisas dos gomos (do centro ao duplo) e na beira de cada anel.
    if (t > CENTRO && t <= 1) {
      const divisa = Math.min(fatia - gomo, 1 - (fatia - gomo)) * ((2 * Math.PI * r) / GOMOS)
      if (divisa < ARAME.meia) luz += ARAME.luz
    }
    for (const anelDoArame of [MIOLO, CENTRO, TRIPLO[0], TRIPLO[1], DUPLO[0], DUPLO[1]]) {
      if (Math.abs(r - anelDoArame * RAIO_DOS_PONTOS) < ARAME.meia) luz += ARAME.luz
    }
    s[3] += luz
  }
}

export const montarAlvoDeDardos: MontarMovel = (c, cena) => {
  const k = Math.min(c.w / LARGURA_DO_DESENHO, c.h / ALTURA_DO_DESENHO)
  const P = c.peca
  const L = cena.partes
  const mad = c.m.madeira
  const ardosia = materialDaPeca('ardosia')
  const em = (x: number, y: number): Ponto => [x * k, y * k]
  const caixaEm = (x0: number, y0: number, x1: number, y1: number, raio = 0) => caixa(x0 * k, y0 * k, x1 * k, y1 * k, raio * k)
  const { meia, alto, baixo, moldura } = CAIXA
  const fora = meia + PORTA.largura

  // As PORTAS abertas, cada uma com a lousa por dentro e as dobradiças.
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? -fora : meia
    const x1 = lado < 0 ? -meia : fora
    const y0 = alto + PORTA.recuo
    const y1 = baixo - PORTA.recuo
    L.push(P(caixaEm(x0, y0, x1, y1, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1 * k, contorno: 0.26, tom: 0.92, semente: 9905 + lado }))
    const m = PORTA.moldura
    L.push(P(caixaEm(x0 + m, y0 + m, x1 - m, y1 - m, 0.4), ardosia, { bisel: 0.5 * k, contorno: 0.2, tom: 0.62, recesso: { k: 1.2 * k, forca: 0.3 }, semente: 9908 + lado }))
    for (const t of DOBRADICA.onde) {
      const y = y0 + (y1 - y0) * t
      const xd = lado < 0 ? -meia : meia
      L.push(P(caixaEm(xd - 1.2, y - DOBRADICA.altura / 2, xd + 1.2, y + DOBRADICA.altura / 2, 0.3), LATAO, { bisel: 0.4 * k, contorno: 0.26, metal: 0.5, semente: 9911 }))
    }
  }

  // O giz das lousas. Na da esquerda: a linha de cima, a do meio e os pontos (riscos curtos), uns cortados.
  const giz = (ax: number, ay: number, bx: number, by: number, sem: number): void => {
    const [x0, y0] = em(ax, ay)
    const [x1, y1] = em(bx, by)
    L.push(P(barra(x0, y0, x1, y1, 0.65 * k), GIZ, { bisel: 0, contorno: 0, alfa: ALFA_DO_GIZ, semente: sem }))
  }
  const esq0 = -fora + PORTA.moldura + 1.4
  const esq1 = -meia - PORTA.moldura - 1.4
  const meioEsq = (esq0 + esq1) / 2
  giz(esq0, alto + 7, esq1, alto + 7, 9920)
  giz(meioEsq, alto + 4, meioEsq, baixo - 4.5, 9921)
  for (let i = 0; i < 6; i += 1) {
    const y = alto + 10 + i * 4.6
    for (const [de, larg] of [[esq0 + 0.6, 3.6 - (i % 3) * 0.6], [meioEsq + 1, 3 + ((i + 1) % 3) * 0.6]] as const) {
      if (i > 3 && de > meioEsq) continue
      // O número: dois riscos curtos e tortos, como a mão escreve com giz.
      giz(de, y - 0.9, de + larg * 0.45, y + 0.9, 9922 + i)
      giz(de + larg * 0.55, y + 0.9, de + larg, y - 0.7, 9926 + i)
      // Os pontos de antes, riscados por cima quando o placar desceu.
      if (i < 2) giz(de - 0.5, y + 0.1, de + larg + 0.5, y - 0.1, 9930 + i)
    }
  }
  // Na da direita: a contagem em grupos de cinco (quatro riscos de pé e o corte).
  const dir0 = meia + PORTA.moldura + 2
  for (let grupo = 0; grupo < 5; grupo += 1) {
    const gx = dir0 + (grupo % 2) * 6.6
    const gy = alto + 6 + Math.floor(grupo / 2) * 12
    const riscos = grupo === 4 ? 3 : 4
    for (let i = 0; i < riscos; i += 1) giz(gx + i * 1.3, gy, gx + i * 1.3 + 0.3, gy + 6, 9940 + grupo)
    if (grupo < 4) giz(gx - 0.6, gy + 5, gx + 4.6, gy + 1, 9950 + grupo)
  }

  // O ARMÁRIO: o fundo escuro, afundado, e a moldura em volta.
  L.push(P(caixaEm(-meia, alto, meia, baixo, 0.8), mad, { tabua: 5 * k, eixo: QUARTO, bisel: 0.6 * k, contorno: 0.26, tom: 0.62, recesso: { k: 2.4 * k, forca: 0.36 }, semente: 9960 }))
  const molduras: readonly (readonly [number, number, number, number, number])[] = [
    [-meia, alto, meia, alto + moldura, 0],
    [-meia, baixo - moldura, meia, baixo, 0],
    [-meia, alto, -meia + moldura, baixo, QUARTO],
    [meia - moldura, alto, meia, baixo, QUARTO],
  ]
  molduras.forEach(([x0, y0, x1, y1, eixo], i) => {
    L.push(P(caixaEm(x0, y0, x1, y1, 0.5), mad, { eixo, tabua: 0, bisel: 1.1 * k, contorno: 0.28, luz: 0.04, semente: 9961 + i, projeta: { dist: 1.2 * k, forca: 0.3 } }))
  })
  // O toco de giz na beira de baixo da moldura.
  L.push(P(caixaEm(9, baixo - moldura - 1.1, 13.4, baixo - moldura + 0.3, 0.6), GIZ, { bisel: 0.5 * k, contorno: 0.2, semente: 9966, projeta: { dist: 0.8 * k, forca: 0.3 } }))

  // O ALVO: o anel preto dos números e a área de pontos numa peça só, com a borda arredondada.
  const [ax, ay] = em(MEIO_DO_ALVO[0], MEIO_DO_ALVO[1])
  const rN = RAIO_DOS_NUMEROS * k
  L.push(P(elipse(ax, ay, rN, rN), SISAL, { bisel: 2 * k, contorno: 0.3, textura: texDoAlvo(ax, ay), semente: 9970, projeta: { dist: 1.6 * k, forca: 0.36, suave: 1 } }))
  // A argola de arame da beira dos números (o aro que segura o sisal).
  L.push(P(anel(ax, ay, rN, rN, rN - 0.55 * k, rN - 0.55 * k), { classe: 'metal', rgb: [0x9a, 0x98, 0x94] }, { bisel: 0.3 * k, contorno: 0.2, metal: 0.5, semente: 9971 }))

  // Os DARDOS: o corpo de latão, a haste escura e a pena em X, cada um com a sombra no alvo.
  DARDOS.forEach(([dx, dy, cor], i) => {
    const [px, py] = em(MEIO_DO_ALVO[0] + dx, MEIO_DO_ALVO[1] + dy)
    const [bx, by] = [px + CORPO_DO_DARDO[0] * k, py + CORPO_DO_DARDO[1] * k]
    const [hx, hy] = [px + HASTE_DO_DARDO[0] * k, py + HASTE_DO_DARDO[1] * k]
    const sombra = { dist: 1.6 * k, forca: 0.4, suave: 0.8 }
    L.push(P(capsula(px, py, bx, by, 0.75 * k), LATAO, { eixo: Math.atan2(by - py, bx - px), bisel: 0.6 * k, contorno: 0.28, metal: 0.55, semente: 9980 + i, projeta: sombra }))
    L.push(P(capsula(bx, by, hx, hy, 0.38 * k), HASTE, { bisel: 0.3 * k, contorno: 0.24, semente: 9983 + i, projeta: sombra }))
    // A pena em X, de frente: dois losangos cruzados, um mais claro (pega a luz) que o outro.
    const p = PENA.meia * k
    const f = PENA.fina * k
    const pena = { classe: 'liso', rgb: cor } as const
    L.push(P(poligono([[hx - p, hy - p], [hx + f, hy - f], [hx + p, hy + p], [hx - f, hy + f]]), pena, { bisel: 0.3 * k, contorno: 0.26, tom: 0.86, semente: 9986 + i, projeta: sombra }))
    L.push(P(poligono([[hx + p, hy - p], [hx + f, hy + f], [hx - p, hy + p], [hx - f, hy - f]]), pena, { bisel: 0.3 * k, contorno: 0.26, tom: 1.08, semente: 9989 + i, projeta: sombra }))
  })
}
