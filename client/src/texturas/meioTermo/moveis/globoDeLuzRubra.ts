/**
 * GLOBO DE LUZ RUBRA de cima com volume (lote L04 de 24/11/2026, a Fortaleza
 * do ritual; objeto novo). A luz de chão de uma muralha de ritual: o ANEL de
 * ferro batido chumbado no piso, com três parafusos, três GARRAS curtas que
 * seguram o GLOBO de vidro rubro aceso por dentro, e a ORELHA do anel com o
 * PINO de travar, de cabeça em argola. A luz vermelha é do integrador
 * (`LUZ_DOS_OBJETOS`); o desenho só tem o brilho fraco do vidro e um clarão
 * discreto no chão em volta.
 *
 * De cima: a roda rubra de miolo claro dentro do anel escuro, com a orelha e
 * o pino num canto. É a bola acesa dentro do aro que diz "globo de luz", e
 * não "braseiro" (o carvão em brasa, em três pés) nem "bola de cristal" (a
 * bola clara no pano, em cima da mesa).
 *
 * ACESO (variante 0) e APAGADO (variante 1), como o holofote: apagado, o vidro
 * fica vinho escuro, só com o reflexo, e o clarão do chão some.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado SEM beirada, como a bola de
 * cristal): o anel é uma coluna baixa em duas metades (a do norte atrás do
 * globo, a do sul na frente), as duas garras da frente são colunas curtas, e o globo é um
 * tampo solto na altura do meio dele, com o reflexo junto. A orelha fica no
 * chão e a cabeça do pino sobe um pouco. O desenho é montado JÁ NA TELA
 * (`montadaNaTela`): o globo é igual dos quatro lados; só a orelha com o pino
 * anda com o giro.
 *
 * Tudo sai do menor lado da pegada (0,8 x 0,8 casa de partida). Material:
 * `metal` (o anel, as garras e o pino). O vidro é fixo.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { colunaSemSombra, comMeioEm, montadaNaTela, solta } from './andaimeDaTresQuartos'
import { quartosDoGiro } from './pipaDeitada'

const GRAUS = Math.PI / 180

/** O anel, em fração do menor meio lado: por fora, por dentro e a roda dos parafusos. */
const ANEL_DE_FORA = 0.9
const ANEL_DE_DENTRO = 0.63
const RAIO_DOS_PARAFUSOS = 0.765
/** Os parafusos ficam entre as garras (graus). */
const PARAFUSOS: readonly number[] = [90, 210, 330]
const RAIO_DO_PARAFUSO = 0.07
/** O globo: o raio (fração do menor meio lado) e a altura do meio dele na 3/4 (em raios do globo). */
const GLOBO = 0.56
const ALTURA_DO_GLOBO = 0.72
/** As garras: os ângulos (90 = a frente), de onde até onde vão (fração) e a meia largura. */
const GARRAS: readonly number[] = [30, 150, 270]
const GARRA: readonly [number, number] = [0.5, 0.7]
const MEIA_GARRA = 0.07
/** A orelha do anel com o pino: o ângulo sem giro (para baixo à direita), até onde vai e as medidas do pino. */
const ANGULO_DA_ORELHA = 45
const ORELHA_ATE = 1.16
const MEIA_ORELHA = 0.15
const PINO_EM = 1.02
const CABECA_DO_PINO = 0.105
const FURO_DA_CABECA = 0.045
/** Alturas em casas: o anel, as garras e a cabeça do pino. */
const ALTURA_DO_ANEL = 0.07
const ALTURA_DAS_GARRAS = 0.12
const ALTURA_DO_PINO = 0.1

/** O ferro velho: os tons e o brilho. */
const TOM_DO_ANEL = 0.98
const TOM_DA_GARRA = 1.12
const TOM_DO_PARAFUSO = 1.3
const TOM_DO_POCO = 0.5
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/**
 * O vidro: o miolo claro (a luz de dentro), o rubi e a beira funda. Contidos: o rubi tem saturação 0,57 e a
 * beira 0,6, abaixo do teto de 0,62 (o globo é quase metade dos pixels opacos da peça).
 */
const MIOLO_ACESO: Rgb = [0xf2, 0xb8, 0xa8]
const RUBI_ACESO: Rgb = [0xc0, 0x52, 0x58]
const BEIRA_ACESA: Rgb = [0x82, 0x34, 0x40]
const RUBI_APAGADO: Rgb = [0x72, 0x3a, 0x42]
const BEIRA_APAGADA: Rgb = [0x56, 0x2c, 0x34]
const REFLEXO: Rgb = [0xff, 0xf0, 0xea]
/** Onde o miolo claro fica (fração do raio, puxado para a luz), o reflexo da janela e o reflexo pequeno do outro lado. */
const MIOLO_EM: Ponto = [-0.12, -0.14]
const REFLEXO_EM: Ponto = [-0.38, -0.42]
const REFLEXO_PEQUENO_EM: Ponto = [0.44, 0.5]
/** O clarão no chão em volta (raio em fração do menor meio lado e alfa no pé do anel) e o que pega o anel por dentro. */
const RAIO_DO_CLARAO = 1.3
const ALFA_DO_CLARAO = 0.2
const ALFA_DO_CLARAO_NO_ANEL = 0.22
const CLARAO: Rgb = [0xe0, 0x6c, 0x68]

const DO_METAL = texturaDaClasse('metal')

/** O ponto (x, y) do desenho NA TELA depois de `quartos` quartos de volta. */
function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** O ferro batido: as covinhas do martelo por cima da textura do metal e, aceso, o clarão rubro do lado de dentro do anel. */
function texDoAnel(R: number, aceso: boolean): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2
    if (!aceso) return
    const t = limitar01((ANEL_DE_FORA - Math.hypot(x, y) / R) / (ANEL_DE_FORA - ANEL_DE_DENTRO))
    const a = ALFA_DO_CLARAO_NO_ANEL * t * t
    s[0] += (CLARAO[0] - s[0]) * a
    s[1] += (CLARAO[1] - s[1]) * a
    s[2] += (CLARAO[2] - s[2]) * a
  }
}

/** O vidro do globo: do miolo claro à beira funda, com a névoa de dentro e os dois reflexos. Aceso, quase todo emissão. */
function texDoGlobo(r: number, aceso: boolean): Textura {
  const rubi = aceso ? RUBI_ACESO : RUBI_APAGADO
  const beira = aceso ? BEIRA_ACESA : BEIRA_APAGADA
  return (_u, _v, x, y, _p, s) => {
    const q = Math.hypot(x, y) / r
    const doMiolo = Math.hypot(x / r - MIOLO_EM[0], y / r - MIOLO_EM[1])
    const nevoa = ruido(x * 0.22 + 7, y * 0.22 + 19) * 0.16
    // Da beira para dentro: a beira funda (o vidro grosso de lado), o rubi e, aceso, o miolo claro.
    let cor = misturar(rubi, beira, limitar01((q - 0.45) / 0.55) ** 1.4)
    if (aceso) cor = misturar(cor, MIOLO_ACESO, limitar01(1 - doMiolo / 0.62 + nevoa) ** 1.5 * 0.9)
    else cor = misturar(cor, beira, limitar01(0.3 + nevoa))
    const janela = limitar01(1.3 - Math.hypot((x / r - REFLEXO_EM[0]) / 0.2, (y / r - REFLEXO_EM[1]) / 0.13)) * 0.85
    const pequeno = limitar01(1.3 - Math.hypot(x / r - REFLEXO_PEQUENO_EM[0], y / r - REFLEXO_PEQUENO_EM[1]) / 0.09) * 0.4
    const reflexo = janela > pequeno ? janela : pequeno
    s[0] = cor[0] + (REFLEXO[0] - cor[0]) * reflexo
    s[1] = cor[1] + (REFLEXO[1] - cor[1]) * reflexo
    s[2] = cor[2] + (REFLEXO[2] - cor[2]) * reflexo
    s[4] = aceso ? 0.88 : 0.35
  }
}

/** O clarão no chão: o tom do vidro com alfa que cai do pé do anel até o raio. */
function texDoClarao(R: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar01((Math.hypot(x, y) / R - GLOBO) / (RAIO_DO_CLARAO - GLOBO))
    s[0] = CLARAO[0]
    s[1] = CLARAO[1]
    s[2] = CLARAO[2]
    s[4] = 1
    s[5] = ALFA_DO_CLARAO * (1 - q) * (1 - q)
  }
}

const montar: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const ferro = c.m.metal
  const aceso = c.variante !== 1
  const quartos = quartosDoGiro(c.giro)
  const L: Peca[] = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const zAnel = g * ALTURA_DO_ANEL
  const doFerro = (tom: number, bisel: number, semente: number, textura?: Textura) => ({ tabua: 0, bisel, tom, metal: BRILHO_DO_FERRO, contorno: 0.3, textura, semente })

  // ---------- no chão: o clarão, a orelha do anel e o pino ----------
  if (aceso) {
    const rc = RAIO_DO_CLARAO * R
    L.push(P(elipse(0, 0, rc, rc), { classe: 'liso', rgb: CLARAO }, { bisel: 0, contorno: 0, textura: texDoClarao(R), semente: 3401 }))
  }
  const [ox, oy] = naTela(Math.cos(ANGULO_DA_ORELHA * GRAUS), Math.sin(ANGULO_DA_ORELHA * GRAUS), quartos)
  const orelha = capsula(ox * ANEL_DE_FORA * 0.9 * R, oy * ANEL_DE_FORA * 0.9 * R, ox * ORELHA_ATE * R, oy * ORELHA_ATE * R, MEIA_ORELHA * R)
  const [pinoX, pinoY] = [ox * PINO_EM * R, oy * PINO_EM * R]
  cena.sombras.push(contato(orelha, 0.3))
  // O meio da caixa da orelha fica na ponta dela, fora do anel: ela não sobe com ele.
  L.push(P(comMeioEm(orelha, ox * ORELHA_ATE * R, oy * ORELHA_ATE * R), ferro, doFerro(0.84, MEIA_ORELHA * R * 0.5, 3402, texDoAnel(R, false))))
  const cabeca = elipse(pinoX, pinoY, CABECA_DO_PINO * R, CABECA_DO_PINO * R)
  cena.sombras.push({ forma: cabeca, z: g * ALTURA_DO_PINO, suave: 1 })
  L.push(P(cabeca, ferro, { ...doFerro(1.2, CABECA_DO_PINO * R * 0.8, 3403), projeta: { dist: 1, forca: 0.34 } }))
  L.push(P(elipse(pinoX, pinoY, FURO_DA_CABECA * R, FURO_DA_CABECA * R), ferro, { tabua: 0, bisel: 0, tom: 0.5, contorno: 0, recesso: { k: 0.8, forca: 0.4 }, semente: 3404 }))

  // ---------- o anel: duas metades na tela (a do norte atrás do globo, a do sul na frente) ----------
  const aro = anel(0, 0, ANEL_DE_FORA * R, ANEL_DE_FORA * R, ANEL_DE_DENTRO * R, ANEL_DE_DENTRO * R)
  const LONGE = 4096
  const metades: readonly (readonly [Forma, number])[] = [
    [caixa(-LONGE, -LONGE, LONGE, 0), -1],
    [caixa(-LONGE, 0, LONGE, LONGE), 1],
  ]
  cena.sombras.push(contato(elipse(0, 0, ANEL_DE_FORA * R, ANEL_DE_FORA * R), 0.32))
  // O poço escuro dentro do anel, debaixo do globo: fica no chão.
  const meioDoAnel = ((ANEL_DE_FORA + ANEL_DE_DENTRO) / 2) * R
  for (const [metade, lado] of metades) {
    cena.sombras.push({ forma: dentroDe(aro, metade), z: zAnel })
    const forma: Forma = { b: dentroDe(aro, metade).b, d: (x, y) => aro.d(x, y) }
    // O meio da caixa de cada metade: no lombo do anel, longe das garras (a de trás fica bem no eixo).
    L.push(P(comMeioEm(forma, meioDoAnel * 0.6, lado * meioDoAnel * 0.8), ferro, { ...doFerro(TOM_DO_ANEL, 1.5, 3410, texDoAnel(R, aceso)), projeta: { dist: 1, forca: 0.3 } }))
  }
  L.push(P(comMeioEm(elipse(0, 0, ANEL_DE_DENTRO * R * 1.02, ANEL_DE_DENTRO * R * 1.02), ox * ORELHA_ATE * R, oy * ORELHA_ATE * R), ferro, { tabua: 0, bisel: 0, tom: TOM_DO_POCO, contorno: 0, semente: 3411 }))
  PARAFUSOS.forEach((graus, i) => {
    const [x, y] = [Math.cos(graus * GRAUS) * RAIO_DOS_PARAFUSOS * R, Math.sin(graus * GRAUS) * RAIO_DOS_PARAFUSOS * R]
    L.push(P(elipse(x, y, RAIO_DO_PARAFUSO * R, RAIO_DO_PARAFUSO * R), ferro, { tabua: 0, bisel: RAIO_DO_PARAFUSO * R * 0.9, tom: TOM_DO_PARAFUSO, metal: 0.5, contorno: 0.22, semente: 3420 + i }))
  })

  // ---------- as garras: colunas curtas; a de trás some atrás do globo, as da frente passam na frente ----------
  const zGarra = g * ALTURA_DAS_GARRAS
  GARRAS.forEach((graus, i) => {
    const [co, si] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    const garra = capsula(co * GARRA[0] * R, si * GARRA[0] * R, co * GARRA[1] * R, si * GARRA[1] * R, MEIA_GARRA * R)
    // Só as da frente são colunas (a de trás, de pé, apareceria por cima do globo como uma antena), com a caixa
    // esticada para o sul: saem depois do globo na ordem da 3/4.
    if (si > 0) cena.sombras.push(colunaSemSombra({ b: [garra.b[0], garra.b[1], garra.b[2], Math.max(garra.b[3], GLOBO * R + 0.5 + i * 0.05)], d: garra.d }, zGarra))
    L.push(P(garra, ferro, { ...doFerro(TOM_DA_GARRA, MEIA_GARRA * R * 0.9, 3430 + i), projeta: { dist: 0.9, forca: 0.3 } }))
  })

  // ---------- o globo: o tampo solto na altura do meio dele ----------
  const r = GLOBO * R
  const globo = elipse(0, 0, r, r)
  cena.sombras.push(solta(globo, r * ALTURA_DO_GLOBO), { forma: globo, z: 0, suave: 2.2, forca: 0.3 })
  L.push(P(globo, { classe: 'liso', rgb: aceso ? RUBI_ACESO : RUBI_APAGADO }, { bisel: r * 0.34, contorno: 0.32, textura: texDoGlobo(r, aceso), projeta: { dist: 1.4, forca: 0.26 }, semente: 3440 }))
}

/** Montado na tela e devolvido ao referencial do objeto: igual dos quatro lados; a orelha com o pino anda com o giro. */
export const montarGloboDeLuzRubra: MontarMovel = montadaNaTela(montar)
