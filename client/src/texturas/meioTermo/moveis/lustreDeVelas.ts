/**
 * LUSTRE DE VELAS de cima com volume (objetos de 14/11/2026, grupo Castelo:
 * "roda de ferro com velas, ilumina"). O lustre de salão de castelo, pendurado
 * do teto: a RODA de ferro torcido com oito VELAS ACESAS em pratinhos, as
 * folhas de ferro batido para fora entre elas e as quatro CORRENTES que sobem
 * da roda até a ARGOLA do meio (vistas do alto, elas correm da roda ao meio
 * como raios). A sombra no chão fica deslocada para baixo à direita, longe da
 * roda: é o que diz "pendurado" na vista de cima.
 *
 * A LUZ, como no candelabro de chão: as chamas e os halos são pintura; a luz de
 * verdade é a linha do integrador, com o centro no MEIO da pegada (a argola).
 *
 * NA 3/4 (`tresQuartos.ts`, derivado com a espessura da vela,
 * `ALTURA_DA_VELA_DO_LUSTRE`) o lustre inteiro fica no ar, `ALTURA_DA_RODA`
 * acima do chão: a roda, as correntes e os pratinhos sobem com a ARGOLA (a
 * caixa de cada peça é centrada no meio, `comMeioEm`), e cada vela é um tampo
 * um pouco mais alto, cuja beirada é o corpo de cera (a caixa da pegada
 * inteira, `naOrdemDaFrente`, põe as velas depois da roda). As correntes não
 * sobem até o teto: a 3/4 não tem como pintá-las de pé.
 *
 * As chamas apontam para cima NA TELA (`desgirado`, a conta do candelabro).
 * Tudo tem o tamanho do menor lado (o lustre é redondo). Material: `metal`
 * (ferro ou latão). A cera, o pavio e as chamas são fixos.
 */
import type { Rgb } from '../../ruido'
import { anel, capsula, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, G, type MontarMovel } from './contexto'

/** A altura da roda, em casas (pendurada abaixo do teto, acima da cabeça de quem passa). */
const ALTURA_DA_RODA = 1.5
/** A altura da vela (px do protótipo): na 3/4 é a beirada do tampo de cada vela, a espessura do perfil do lustre. */
export const ALTURA_DA_VELA_DO_LUSTRE = 0.1 * G

/** As medidas de cima, em fração do menor meio lado. */
const RAIO_DA_RODA = 0.72
const MEIA_GROSSURA_DA_RODA = 0.055
const RAIO_DO_PRATO = 0.15
const RAIO_DA_VELA = 0.085
const RAIO_DA_ARGOLA = 0.15
const MEIA_GROSSURA_DA_ARGOLA = 0.045
const MEIA_GROSSURA_DA_CORRENTE = 0.035
/** As folhas de ferro entre as velas: até onde vão com a bolinha (fração do meio lado), a meia largura e o raio da bolinha. */
const PONTA_DA_FOLHA = 0.98
const MEIA_FOLHA = 0.06
const RAIO_DA_BOLINHA = 0.045
const VELAS = 8
const CORRENTES = 4
/** O elo da corrente (px do protótipo): o passo e a fresta escura entre dois elos. */
const PASSO_DO_ELO = 2.4
const FRESTA_DO_ELO = 0.3
/** A torção da roda de ferro (px do protótipo): o passo das voltas em diagonal. */
const PASSO_DA_TORCAO = 2.6

/** A sombra no chão: o borrão (px do protótipo) e a força. */
const SUAVE_DA_SOMBRA = 4.5
const FORCA_DA_SOMBRA = 0.15

/** A cera: creme, sem brilho; a do corpo (que só a 3/4 pinta, na frente, vezes 0,74) um pouco mais clara. */
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
const LUZ_DO_CORPO_DA_VELA = 0.92 / 0.74
const CERA_DO_CORPO: MaterialDaPeca = { classe: 'liso', rgb: [CERA.rgb[0] * LUZ_DO_CORPO_DA_VELA, CERA.rgb[1] * LUZ_DO_CORPO_DA_VELA, CERA.rgb[2] * LUZ_DO_CORPO_DA_VELA] }

/** A chama: quase branca no pé, amarela no meio, laranja contido na ponta (as do candelabro de chão). */
const PE_DA_CHAMA: Rgb = [0xff, 0xf4, 0xcf]
const MEIO_DA_CHAMA: Rgb = [0xf6, 0xd0, 0x7e]
const PONTA_DA_CHAMA: Rgb = [0xe4, 0x9a, 0x52]
const CHAMA: MaterialDaPeca = { classe: 'liso', rgb: PE_DA_CHAMA }
const LARGURA_DA_CHAMA = 0.05
const COMPRIMENTO_DA_CHAMA = 0.1
const SUBIDA_DA_CHAMA = 0.75
const GOTA_DA_CHAMA: readonly (readonly [number, number])[] = [[-1, 0.35], [-0.7, 0.8], [-0.3, 1], [0.15, 0.85], [0.6, 0.45], [1, 0]]
/** O halo de cada chama: a cor, o alfa no meio e o raio (fração do meio lado). */
const COR_DO_HALO: Rgb = [226, 170, 96]
const ALFA_DO_HALO = 0.38
const RAIO_DO_HALO = 0.32

function polar(raio: number, angulo: number): Ponto {
  return [raio * Math.cos(angulo), raio * Math.sin(angulo)]
}

/** A mesma forma com a caixa de pintura centrada em (mx, my): é o meio da caixa que a 3/4 lê (a conta do candelabro). */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A mesma forma com a caixa da pegada inteira: a 3/4 pinta as velas depois da roda, em qualquer giro. */
function naOrdemDaFrente(forma: Forma, R: number): Forma {
  return { b: [-R, -R, R, R], d: (x, y) => forma.d(x, y) }
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (a conta do altar). */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

function texHalo(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = Math.min(1, ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r))
    s[0] = COR_DO_HALO[0]
    s[1] = COR_DO_HALO[1]
    s[2] = COR_DO_HALO[2]
    s[4] = 1
    s[5] = ALFA_DO_HALO * (1 - q) * (1 - q)
  }
}

function gotaDaChama(cx: number, cy: number, ux: number, uy: number, comprida: number, larga: number): Forma {
  const em = (ao: number, de: number): Ponto => [cx + ao * comprida * ux - de * larga * uy, cy + ao * comprida * uy + de * larga * ux]
  const direita = GOTA_DA_CHAMA.map(([ao, de]) => em(ao, de))
  const esquerda = GOTA_DA_CHAMA.slice(0, -1).reverse().map(([ao, de]) => em(ao, -de))
  return poligono([...direita, ...esquerda])
}

function texChama(px: number, py: number, ux: number, uy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.max(0, Math.min(1, ((x - px) * ux + (y - py) * uy) / comprimento)) * 2
    const naPonta = t >= 1
    const de = naPonta ? MEIO_DA_CHAMA : PE_DA_CHAMA
    const para = naPonta ? PONTA_DA_CHAMA : MEIO_DA_CHAMA
    const k = naPonta ? t - 1 : t
    s[0] = de[0] + (para[0] - de[0]) * k
    s[1] = de[1] + (para[1] - de[1]) * k
    s[2] = de[2] + (para[2] - de[2]) * k
    s[4] = 1
  }
}

/**
 * A roda de ferro torcido: voltas em diagonal pela roda de raio `raio`, num
 * número inteiro delas, para a volta fechar sem emenda onde o ângulo pula.
 */
function texTorcao(raio: number): Textura {
  const voltas = Math.max(1, Math.round((2 * Math.PI * raio) / PASSO_DA_TORCAO))
  return (_u, _v, x, y, _p, s) => {
    const f = (Math.atan2(y, x) * voltas) / (2 * Math.PI) + Math.hypot(x, y) / PASSO_DA_TORCAO
    s[3] += f - Math.floor(f) < 0.3 ? -0.16 : 0.05
  }
}

/** A corrente: elos ao longo dela, com a fresta escura entre dois e o elo de lado mais estreito e escuro. */
function texCorrente(ax: number, ay: number, ux: number, uy: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = (x - ax) * ux + (y - ay) * uy
    const k = Math.floor(t / PASSO_DO_ELO)
    const f = t / PASSO_DO_ELO - k
    const atravessa = Math.abs((x - ax) * -uy + (y - ay) * ux)
    if (f < FRESTA_DO_ELO) s[3] -= 0.32
    else if (k % 2 === 1 && atravessa > 0.45) s[3] -= 0.22
    else s[3] += 0.06
  }
}

export const montarLustreDeVelas: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const metal = c.m.metal
  const L = cena.partes
  const zRoda = g * ALTURA_DA_RODA
  const rRoda = RAIO_DA_RODA * R
  const mgRoda = MEIA_GROSSURA_DA_RODA * R
  const angulos = Array.from({ length: VELAS }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / VELAS)
  const noMeio = (f: Forma): Forma => comMeioEm(f, 0, 0)

  // A sombra no chão, longe da roda (presa ao chão, z = 0: com altura viraria estrutura), e a altura da argola,
  // que leva a roda inteira para o ar na 3/4 (sem sombra própria).
  const [sx, sy] = [SOMBRA_X * zRoda, SOMBRA_Y * zRoda]
  cena.sombras.push(
    { forma: anel(sx, sy, rRoda + mgRoda * 1.4, rRoda + mgRoda * 1.4, rRoda - mgRoda * 1.4, rRoda - mgRoda * 1.4), z: 0, suave: SUAVE_DA_SOMBRA, forca: FORCA_DA_SOMBRA },
    { forma: elipse(sx, sy, R * 0.28, R * 0.28), z: 0, suave: SUAVE_DA_SOMBRA, forca: FORCA_DA_SOMBRA * 0.6 },
    { forma: elipse(0, 0, 0.6, 0.6), z: zRoda, solta: true, forca: 0 },
  )

  // As FOLHAS de ferro batido para fora, entre as velas, por baixo da roda: a folha deitada ao longo do raio e a
  // bolinha na ponta (com a ponta fina elas liam como espinhos, e a roda como arma).
  for (const [i, a] of angulos.entries()) {
    const m = a + Math.PI / VELAS
    const comprida = (PONTA_DA_FOLHA * R - rRoda) / 2
    const [mx, my] = polar(rRoda + comprida * 0.8, m)
    const [tx, ty] = polar(PONTA_DA_FOLHA * R - RAIO_DA_BOLINHA * R, m)
    L.push(P(noMeio(elipseGirada(mx, my, comprida, MEIA_FOLHA * R, m)), metal, { eixo: m, bisel: MEIA_FOLHA * R * 0.8, tom: 0.92, contorno: 0.28, semente: 200 + i }))
    L.push(P(noMeio(elipse(tx, ty, RAIO_DA_BOLINHA * R, RAIO_DA_BOLINHA * R)), metal, { bisel: RAIO_DA_BOLINHA * R * 0.8, contorno: 0.26, metal: 0.55, semente: 400 + i }))
  }

  // A RODA de ferro torcido e os PRATINHOS das velas, com a cera que escorreu.
  L.push(P(noMeio(anel(0, 0, rRoda + mgRoda, rRoda + mgRoda, rRoda - mgRoda, rRoda - mgRoda)), metal, { bisel: mgRoda * 0.9, contorno: 0.3, textura: texTorcao(rRoda), semente: 210, projeta: { dist: 1.1, forca: 0.3 } }))
  const rPrato = RAIO_DO_PRATO * R
  for (const [i, a] of angulos.entries()) {
    const [x, y] = polar(rRoda, a)
    L.push(P(noMeio(elipse(x, y, rPrato, rPrato)), metal, { bisel: rPrato * 0.35, contorno: 0.28, semente: 220 + i, projeta: { dist: 1.2, forca: 0.3 } }))
    L.push(P(noMeio(elipse(x, y, rPrato * 0.72, rPrato * 0.72)), metal, { bisel: 0, tom: 0.78, contorno: 0.1, recesso: { k: 0.9, forca: 0.3 }, semente: 230 + i }))
    const escorre = i % 2 === 0 ? 1 : -1
    L.push(P(noMeio(elipse(x + escorre * rPrato * 0.3, y + rPrato * 0.28, rPrato * 0.4, rPrato * 0.32)), CERA, { bisel: rPrato * 0.12, tom: 0.9, contorno: 0.14, semente: 240 + i }))
  }

  // As CORRENTES, da roda à argola, entre as velas; a ARGOLA e o gancho no meio.
  const rArgola = RAIO_DA_ARGOLA * R
  for (let i = 0; i < CORRENTES; i += 1) {
    const a = -Math.PI / 2 + Math.PI / VELAS + (i * 2 * Math.PI) / CORRENTES
    const [ax, ay] = polar(rRoda, a)
    const [bx, by] = polar(rArgola, a)
    const comp = Math.hypot(bx - ax, by - ay)
    L.push(P(noMeio(capsula(ax, ay, bx, by, MEIA_GROSSURA_DA_CORRENTE * R)), metal, { eixo: a, bisel: MEIA_GROSSURA_DA_CORRENTE * R * 0.8, contorno: 0.28, textura: texCorrente(ax, ay, (bx - ax) / comp, (by - ay) / comp), semente: 250 + i, projeta: { dist: 1, forca: 0.3 } }))
  }
  const mgArgola = MEIA_GROSSURA_DA_ARGOLA * R
  L.push(P(anel(0, 0, rArgola + mgArgola, rArgola + mgArgola, rArgola - mgArgola, rArgola - mgArgola), metal, { bisel: mgArgola * 0.9, contorno: 0.3, metal: 0.55, semente: 260, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(elipse(0, 0, mgArgola * 1.3, mgArgola * 1.3), BURACO, { bisel: 0, contorno: 0, semente: 261 }))
  L.push(P(capsula(0, -mgArgola * 1.2, 0, mgArgola * 1.2, mgArgola * 0.8), metal, { bisel: mgArgola * 0.6, contorno: 0.26, metal: 0.6, semente: 262 }))

  // As VELAS, do fundo para a frente: o alto de cera com a cova e o pavio, o halo e a chama.
  const rVela = RAIO_DA_VELA * R
  const rHalo = RAIO_DO_HALO * R
  const [ux, uy] = desgirado(0, -1, c.giro)
  const [comprida, larga] = [COMPRIMENTO_DA_CHAMA * R, LARGURA_DA_CHAMA * R]
  const centros = angulos.map((a) => polar(rRoda, a)).sort((p, q) => p[1] - q[1])
  for (const [i, [x, y]] of centros.entries()) {
    const alto = elipse(x, y, rVela, rVela)
    cena.sombras.push({ forma: naOrdemDaFrente(alto, R), z: zRoda + ALTURA_DA_VELA_DO_LUSTRE, solta: true, forca: 0, suave: 0.5 })
    L.push(P(alto, CERA, { bisel: rVela * 0.4, contorno: 0.2, semente: 270 + i }))
    L.push(P(elipse(x, y, rVela * 0.56, rVela * 0.56), CERA, { bisel: 0, tom: 0.92, contorno: 0, recesso: { k: 0.5, forca: 0.2 }, semente: 280 + i }))
    L.push(P(elipse(x, y, rVela * 0.2, rVela * 0.2), BURACO, { bisel: 0, contorno: 0, semente: 290 + i }))
    const [cx, cy] = [x + ux * SUBIDA_DA_CHAMA * comprida, y + uy * SUBIDA_DA_CHAMA * comprida]
    L.push(P(comMeioEm(elipse(cx, cy, rHalo, rHalo), x, y), CERA_DO_CORPO, { bisel: 0, contorno: 0, textura: texHalo(cx, cy, rHalo), semente: 300 + i }))
    const textura = texChama(cx - ux * comprida, cy - uy * comprida, ux, uy, 2 * comprida)
    L.push(P(comMeioEm(gotaDaChama(cx, cy, ux, uy, comprida, larga), x, y), CHAMA, { bisel: 0, contorno: 0, suave: 0.6, textura, semente: 310 + i }))
  }
}
