/**
 * GLOBO DE LUZ RUBRA de cima com volume (lote L04 de 24/11/2026, a Fortaleza
 * do ritual; objeto novo). A luz de chão de uma muralha de ritual: o ANEL de
 * ferro batido chumbado no piso, com três parafusos, três GARRAS curtas que
 * seguram o GLOBO de vidro rubro aceso por dentro, e a ORELHA curta do anel,
 * encostada nele, com a CUNHA de travar atravessada. A luz vermelha é do
 * integrador (`LUZ_DOS_OBJETOS`); o desenho só tem o brilho fraco do vidro e
 * um clarão discreto no chão em volta.
 *
 * De cima: a roda rubra de vidro GROSSO dentro do anel escuro, com a orelha e
 * a cunha num canto. É a bola acesa dentro do aro que diz "globo de luz", e
 * não "braseiro" (o carvão em brasa, em três pés) nem "bola de cristal" (a
 * bola clara no pano, em cima da mesa).
 *
 * Revisão do diretor de arte (24/11/2026): o vermelho vivo e igual na bola
 * inteira, com um reflexo branco grande, lia como botão de fliperama ou luz
 * de alarme de plástico; e o pino de cabeça em argola, como alça de panela.
 * Agora o vidro é rubi fundo, com um anel escuro de refração junto do aro, o
 * miolo de luz quente pequeno e desfocado no meio e um reflexo de janela
 * estreito e fraco; o pino virou cunha, e a orelha encurtou. Na hierarquia do
 * lote, o vermelho do globo fica um passo mais escuro que o da gema do fosso.
 *
 * ACESO (variante 0) e APAGADO (variante 1), como o holofote: apagado, o vidro
 * fica vinho escuro, só com o reflexo, e o clarão do chão some.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado SEM beirada, como a bola de
 * cristal): o anel é uma coluna baixa em duas metades (a do norte atrás do
 * globo, a do sul na frente), as duas garras da frente são colunas curtas, e o globo é um
 * tampo solto na altura do meio dele, com o reflexo junto. A orelha fica no
 * chão e a cunha sobe um pouco. O desenho é montado JÁ NA TELA
 * (`montadaNaTela`): o globo é igual dos quatro lados; só a orelha com a cunha
 * anda com o giro.
 *
 * Tudo sai do menor lado da pegada (0,8 x 0,8 casa de partida). Material:
 * `metal` (o anel, as garras e a cunha). O vidro é fixo.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
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
/**
 * A orelha do anel com a cunha: o ângulo sem giro (para baixo à direita) e até onde a orelha vai (curta: encosta no
 * aro). A cunha atravessa a orelha de través: onde fica (fração do menor meio lado), o meio comprimento e a meia
 * grossura da ponta grossa e da fina. `FORA_DE_TUDO` é um ponto da ponta da orelha, além da cunha e do anel: o meio
 * da caixa do que tem de ficar no chão na 3/4.
 */
const ANGULO_DA_ORELHA = 45
const ORELHA_ATE = 1
const MEIA_ORELHA = 0.13
const CUNHA_EM = 0.98
const MEIA_CUNHA = 0.21
const PONTA_GROSSA = 0.075
const PONTA_FINA = 0.032
const FORA_DE_TUDO = 1.1
/** Alturas em casas: o anel, as garras e a cunha. */
const ALTURA_DO_ANEL = 0.07
const ALTURA_DAS_GARRAS = 0.12
const ALTURA_DA_CUNHA = 0.06

/** O ferro velho: os tons e o brilho. */
const TOM_DO_ANEL = 0.98
const TOM_DA_GARRA = 1.12
const TOM_DO_PARAFUSO = 1.3
const TOM_DO_POCO = 0.5
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]

/**
 * O VIDRO GROSSO: o rubi fundo do corpo, a beira, o anel escuro da refração junto do aro e o miolo de luz quente,
 * pequeno e desfocado. O diretor de arte pediu a beira por volta de #8e2a2a; esse tom tem saturação 0,70, e o globo
 * é mais de um terço dos pixels opacos da peça: passaria do teto de 0,62 do portão. Ficam o mesmo rubi fundo com a
 * saturação em 0,60 (a beira) e 0,59 (o corpo). O anel de refração tem luminância linear 0,047, acima do piso de luz.
 */
const CORPO_ACESO: Rgb = [0x8f, 0x3f, 0x3a]
const BEIRA_ACESA: Rgb = [0x84, 0x38, 0x35]
const REFRACAO_ACESA: Rgb = [0x62, 0x2e, 0x2d]
const MIOLO_ACESO: Rgb = [0xe8, 0x8a, 0x6a]
const CORPO_APAGADO: Rgb = [0x64, 0x3c, 0x3e]
const BEIRA_APAGADA: Rgb = [0x5c, 0x38, 0x3a]
const REFRACAO_APAGADA: Rgb = [0x54, 0x34, 0x36]
const REFLEXO: Rgb = [0xf6, 0xdc, 0xd4]
/** O anel da refração: onde fica (fração do raio do globo), a meia largura e a força; e de onde a beira começa. */
const REFRACAO_EM = 0.78
const MEIA_REFRACAO = 0.14
const FORCA_DA_REFRACAO = 0.9
const BEIRA_DESDE = 0.86
/** O miolo de luz: onde fica (fração do raio, quase no meio), o raio e a força; cai como um sino, sem beira. */
const MIOLO_EM: Ponto = [-0.03, -0.04]
const RAIO_DO_MIOLO = 0.27
const FORCA_DO_MIOLO = 0.86
/**
 * O reflexo da janela: estreito e fraco (alfa até 0,33), deitado ao longo da beira de cima à esquerda (o meio, os
 * dois meios eixos e o giro em graus); e o reflexo pequeno do outro lado, mais fraco ainda.
 */
const REFLEXO_EM: Ponto = [-0.4, -0.45]
const JANELA: readonly [number, number] = [0.25, 0.055]
const GIRO_DA_JANELA = -40
const ALFA_DA_JANELA = 0.33
const REFLEXO_PEQUENO_EM: Ponto = [0.46, 0.52]
const ALFA_DO_REFLEXO_PEQUENO = 0.14
/** Quanto do vidro é luz própria (o resto pega a luz e a sombra do chanfro, que dão o volume da bola). */
const EMISSAO_DO_VIDRO_ACESO = 0.66
const EMISSAO_DO_VIDRO_APAGADO = 0.3
/**
 * O clarão no chão em volta (raio em fração do menor meio lado e alfa no pé do anel) e o que pega o anel por dentro.
 * Fracos: são quatro globos num mapa, e o vermelho mais vivo do lote é o da gema do fosso.
 */
const RAIO_DO_CLARAO = 1.3
const ALFA_DO_CLARAO = 0.12
const ALFA_DO_CLARAO_NO_ANEL = 0.14
const CLARAO: Rgb = [0xcc, 0x66, 0x5e]

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

/**
 * O vidro grosso do globo, de dentro para fora: o corpo de rubi fundo, o anel escuro da refração e a beira; aceso,
 * o miolo de luz quente, pequeno e desfocado, no meio. Por cima, o reflexo estreito da janela e o pequeno do outro lado.
 */
function texDoGlobo(r: number, aceso: boolean): Textura {
  const corpo = aceso ? CORPO_ACESO : CORPO_APAGADO
  const beira = aceso ? BEIRA_ACESA : BEIRA_APAGADA
  const refracao = aceso ? REFRACAO_ACESA : REFRACAO_APAGADA
  const [cosJ, sinJ] = [Math.cos(GIRO_DA_JANELA * GRAUS), Math.sin(GIRO_DA_JANELA * GRAUS)]
  return (_u, _v, x, y, _p, s) => {
    const [qx, qy] = [x / r, y / r]
    const q = Math.hypot(qx, qy)
    const nevoa = ruido(x * 0.22 + 7, y * 0.22 + 19) * 0.12
    let cor = misturar(corpo, beira, (q - BEIRA_DESDE) / (1 - BEIRA_DESDE))
    const naRefracao = limitar01(1 - Math.abs(q - REFRACAO_EM) / MEIA_REFRACAO)
    cor = misturar(cor, refracao, naRefracao * naRefracao * (3 - 2 * naRefracao) * FORCA_DA_REFRACAO)
    if (aceso) {
      const doMiolo = Math.hypot(qx - MIOLO_EM[0], qy - MIOLO_EM[1]) / RAIO_DO_MIOLO
      cor = misturar(cor, MIOLO_ACESO, Math.exp(-doMiolo * doMiolo * 1.5) * (FORCA_DO_MIOLO + nevoa))
    } else {
      cor = misturar(cor, refracao, limitar01(0.25 + nevoa * 2))
    }
    const [jx, jy] = [qx - REFLEXO_EM[0], qy - REFLEXO_EM[1]]
    const janela = limitar01(1.2 - Math.hypot((jx * cosJ + jy * sinJ) / JANELA[0], (-jx * sinJ + jy * cosJ) / JANELA[1])) * ALFA_DA_JANELA
    const pequeno = limitar01(1.3 - Math.hypot(qx - REFLEXO_PEQUENO_EM[0], qy - REFLEXO_PEQUENO_EM[1]) / 0.08) * ALFA_DO_REFLEXO_PEQUENO
    const reflexo = janela > pequeno ? janela : pequeno
    s[0] = cor[0] + (REFLEXO[0] - cor[0]) * reflexo
    s[1] = cor[1] + (REFLEXO[1] - cor[1]) * reflexo
    s[2] = cor[2] + (REFLEXO[2] - cor[2]) * reflexo
    s[4] = aceso ? EMISSAO_DO_VIDRO_ACESO : EMISSAO_DO_VIDRO_APAGADO
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

  // ---------- no chão: o clarão e a orelha do anel, com a cunha atravessada ----------
  if (aceso) {
    const rc = RAIO_DO_CLARAO * R
    L.push(P(elipse(0, 0, rc, rc), { classe: 'liso', rgb: CLARAO }, { bisel: 0, contorno: 0, textura: texDoClarao(R), semente: 3401 }))
  }
  const [ox, oy] = naTela(Math.cos(ANGULO_DA_ORELHA * GRAUS), Math.sin(ANGULO_DA_ORELHA * GRAUS), quartos)
  const orelha = capsula(ox * ANEL_DE_FORA * 0.9 * R, oy * ANEL_DE_FORA * 0.9 * R, ox * ORELHA_ATE * R, oy * ORELHA_ATE * R, MEIA_ORELHA * R)
  // O ponto da ponta da orelha, além da cunha e do anel: o que tem o meio da caixa nele fica no chão na 3/4.
  const [foraX, foraY] = [ox * FORA_DE_TUDO * R, oy * FORA_DE_TUDO * R]
  cena.sombras.push(contato(orelha, 0.3))
  L.push(P(comMeioEm(orelha, foraX, foraY), ferro, doFerro(0.84, MEIA_ORELHA * R * 0.5, 3402, texDoAnel(R, false))))
  // A cunha: atravessa a orelha de través, rente ao aro, com a ponta grossa de um lado e a fina do outro.
  const naCunha = (aoLongo: number, deTraves: number): Ponto => [(ox * (CUNHA_EM + deTraves) - oy * aoLongo) * R, (oy * (CUNHA_EM + deTraves) + ox * aoLongo) * R]
  const cunha = poligono([naCunha(-MEIA_CUNHA, -PONTA_GROSSA), naCunha(MEIA_CUNHA, -PONTA_FINA), naCunha(MEIA_CUNHA, PONTA_FINA), naCunha(-MEIA_CUNHA, PONTA_GROSSA)])
  cena.sombras.push({ forma: cunha, z: g * ALTURA_DA_CUNHA, suave: 1 })
  L.push(P(cunha, ferro, { ...doFerro(1.22, PONTA_GROSSA * R * 0.6, 3403), projeta: { dist: 0.9, forca: 0.34 } }))

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
  L.push(P(comMeioEm(elipse(0, 0, ANEL_DE_DENTRO * R * 1.02, ANEL_DE_DENTRO * R * 1.02), foraX, foraY), ferro, { tabua: 0, bisel: 0, tom: TOM_DO_POCO, contorno: 0, semente: 3411 }))
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
  L.push(P(globo, { classe: 'liso', rgb: aceso ? CORPO_ACESO : CORPO_APAGADO }, { bisel: r * 0.34, contorno: 0.32, textura: texDoGlobo(r, aceso), projeta: { dist: 1.4, forca: 0.26 }, semente: 3440 }))
}

/** Montado na tela e devolvido ao referencial do objeto: igual dos quatro lados; a orelha com o pino anda com o giro. */
export const montarGloboDeLuzRubra: MontarMovel = montadaNaTela(montar)
