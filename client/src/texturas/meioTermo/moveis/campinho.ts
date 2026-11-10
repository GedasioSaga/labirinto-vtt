/**
 * CAMPINHO DE FUTEBOL de cima (10/11/2026, pedido do mestre: "um campinho de
 * futebol como objeto"). É um campinho de várzea, não um estádio: o gramado
 * ralo com a TERRA BATIDA aparecendo onde mais se pisa (a boca de cada gol, o
 * meio e uns pontos pelo caminho entre os gols), as linhas de CAL já gastas e
 * duas TRAVES de madeira caiada com a rede atrás.
 *
 * Corre ao longo do lado maior da pegada (10 x 6 casas de partida) e estica
 * com ela: as linhas, as áreas e o círculo saem de frações da pegada, com teto
 * em casas (o campo de 30 casas não ganha um círculo de 10). A beira do
 * gramado é irregular (a grama não acaba numa régua).
 *
 * O campo inteiro é UMA peça com textura própria (grama, terra, cal e a beira
 * num passo só por pixel): em 10 x 6 casas a imagem tem até 1024 px de lado, e
 * uma peça por linha custaria uma distância por linha em cada pixel. Sem
 * sombra no chão (o campo é chão); só as traves fazem sombra, e é por ela que
 * a vista 3/4 as põe em pé (`tresQuartos.ts`). Sem material no painel.
 */
import { rgb, hash, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, elipse, type Forma } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/**
 * O gramado ralo: o verde da grama do Meio-Termo um pouco mais baixo e puxado para a palha (grama de campo
 * pisado, não de jardim). Mais escuro que isto, em cima da grama do mapa o campo lia como um retângulo morto.
 */
const GRAMA: Rgb = [124, 178, 110]
/** A terra batida: a terra do caminho do Meio-Termo mais calma (saturação 0,44). */
const TERRA: Rgb = rgb('#c0966c')
/** A cal das linhas: o branco da vila um pouco baixo, para não estourar no zoom 100%. */
const CAL: Rgb = rgb(tomDoMeio('branco', 0.96))
/** As traves: madeira caiada. */
const TRAVE: MaterialDaPeca = { classe: 'madeira', rgb: rgb(tomDoMeio('branco', 0.93)) }
/** A rede: o linho cru, claro, com a malha vazada. */
const REDE: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('linho', 1.06)) }

/** Meia espessura da linha de cal (px do protótipo): a linha inteira dá ~2 px de mundo na grade de 50. */
const MEIA_LINHA = 1.15
/** Raio das marcas (o centro e o pênalti). */
const RAIO_DA_MARCA = 1.5
/** Altura da trave em casas (o travessão de um gol de pelada, na altura do peito). */
const ALTURA_DA_TRAVE = 0.42
/** Raio do poste e do travessão (px do protótipo). */
const RAIO_DO_POSTE = 2.3
const RAIO_DO_TRAVESSAO = 1.6
/** Lado da malha da rede (px do protótipo). */
const MALHA_DA_REDE = 3.4
/** A rede de longe, sem a malha: o véu que deixa o chão aparecer (a média do fio cheio com o vão aberto). */
const VEU_DA_REDE = 0.4
/** A menor escala (pixels da imagem por px do protótipo) em que a malha ainda se desenha. */
const MALHA_A_PARTIR_DE = 1.2

/** As medidas do campo em px do protótipo, no referencial do campo (X ao longo, Y através). */
interface Medidas {
  /** Do meio até a linha de fundo e até a lateral. */
  readonly a: number
  readonly b: number
  readonly circulo: number
  readonly areaFundo: number
  readonly areaMeia: number
  readonly pequenaFundo: number
  readonly pequenaMeia: number
  /** Da linha de fundo até a marca do pênalti. */
  readonly marca: number
  readonly canto: number
  readonly meioGol: number
  /** Quanto a rede passa da linha de fundo. */
  readonly fundoDaRede: number
}

function medidasDoCampo(c: ContextoDoMovel): Medidas {
  const meioC = Math.max(c.hw, c.hh)
  const meiaL = Math.min(c.hw, c.hh)
  const margem = Math.min(c.g * 0.35, meiaL * 0.16)
  const a = meioC - margem
  const b = meiaL - margem
  const areaFundo = Math.min(c.g * 1.5, a * 0.34)
  const areaMeia = Math.min(c.g * 1.65, b * 0.66)
  return {
    a,
    b,
    circulo: Math.min(c.g * 0.9, b * 0.36),
    areaFundo,
    areaMeia,
    pequenaFundo: areaFundo * 0.4,
    pequenaMeia: areaMeia * 0.58,
    marca: areaFundo * 0.68,
    canto: Math.min(c.g * 0.3, b * 0.12),
    meioGol: Math.min(c.g * 0.8, areaMeia * 0.5),
    fundoDaRede: margem * 0.9,
  }
}

/** Distância a um trecho de reta em pé (X fixo, |Y| até `ateY`): o lado da área que olha para o meio. */
function ateOLadoDaArea(ax: number, ay: number, x: number, ateY: number): number {
  const dx = ax - x
  return ay <= ateY ? Math.abs(dx) : Math.hypot(dx, ay - ateY)
}

/** Distância a um trecho deitado (|Y| fixo, X de `deX` até a linha de fundo `a`): o lado da área que sai do fundo. */
function ateOLadoDeFora(ax: number, ay: number, y: number, deX: number, a: number): number {
  const dy = Math.abs(ay - y)
  if (ax < deX) return Math.hypot(deX - ax, dy)
  return ax > a ? Math.hypot(ax - a, dy) : dy
}

/** A menor distância (px do protótipo) do ponto às linhas de cal. O campo é simétrico: vale o quadrante. */
function distanciaAsLinhas(X: number, Y: number, m: Medidas): number {
  const ax = Math.abs(X)
  const ay = Math.abs(Y)
  // As quatro linhas de fora: a borda do retângulo a x b.
  const qx = ax - m.a
  const qy = ay - m.b
  let d = Math.abs(Math.hypot(qx > 0 ? qx : 0, qy > 0 ? qy : 0) + Math.min(qx > qy ? qx : qy, 0))
  // A linha do meio, o círculo central e a marca do centro.
  if (ay <= m.b) d = Math.min(d, ax)
  const r = Math.hypot(X, Y)
  d = Math.min(d, Math.abs(r - m.circulo), r - RAIO_DA_MARCA + MEIA_LINHA)
  // A grande área e a pequena.
  const xArea = m.a - m.areaFundo
  d = Math.min(d, ateOLadoDaArea(ax, ay, xArea, m.areaMeia), ateOLadoDeFora(ax, ay, m.areaMeia, xArea, m.a))
  const xPequena = m.a - m.pequenaFundo
  d = Math.min(d, ateOLadoDaArea(ax, ay, xPequena, m.pequenaMeia), ateOLadoDeFora(ax, ay, m.pequenaMeia, xPequena, m.a))
  // A marca do pênalti e a meia-lua (o arco só do lado de fora da área).
  const ateAMarca = Math.hypot(ax - (m.a - m.marca), ay)
  d = Math.min(d, ateAMarca - RAIO_DA_MARCA + MEIA_LINHA)
  if (ax < xArea) d = Math.min(d, Math.abs(ateAMarca - m.circulo * 0.92))
  // Os quatro cantos: o quarto de círculo por dentro.
  if (ax <= m.a && ay <= m.b) d = Math.min(d, Math.abs(Math.hypot(ax - m.a, ay - m.b) - m.canto))
  return d
}

/** Quanto a terra aparece no ponto (0 grama, 1 terra): a boca dos gols, o meio e a faixa entre eles, com ruído. */
function desgaste(X: number, Y: number, x: number, y: number, m: Medidas): number {
  const ax = Math.abs(X)
  const ay = Math.abs(Y)
  const bx = (ax - (m.a - m.areaFundo * 0.3)) / (m.areaFundo * 0.85)
  const by = ay / (m.meioGol * 1.7)
  const boca = 1 - bx * bx - by * by
  const rc = Math.hypot(X, Y) / (m.circulo * 0.85)
  const meio = 0.9 * (1 - rc * rc)
  const fy = ay / (m.b * 0.5)
  const faixa = 0.26 * (1 - fy * fy)
  const pisado = Math.max(boca, meio, faixa)
  const n = ruido(x * 0.04 + 31, y * 0.04 + 7) * 1.4 + ruido(x * 0.15 + 5, y * 0.15 + 43) * 0.45
  const t = (pisado + n - 0.34) / 0.26
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

/**
 * A pintura do campo num passo só: a grama manchada (sem listra de cortador), a terra onde se pisa, a cal
 * por cima (mais fraca na terra, onde a linha some primeiro) e a beira irregular (o alfa).
 */
function texDoCampo(c: ContextoDoMovel, m: Medidas): Textura {
  const deitado = c.w >= c.h
  const { hw, hh } = c
  return (_u, _v, x, y, _p, s, escala) => {
    const X = deitado ? x : y
    const Y = deitado ? y : x
    const t = desgaste(X, Y, x, y, m)
    // A transição é salpicada (tufos na terra, falhas na grama), não um degradê liso.
    const salpico = hash(Math.floor(x * 1.1), Math.floor(y * 1.1), 17)
    const k = t <= 0 ? 0 : t >= 1 ? 1 : t + (salpico - 0.5) * 0.7 > 0.5 ? 0.86 : 0.1
    let r = GRAMA[0] + (TERRA[0] - GRAMA[0]) * k
    let g = GRAMA[1] + (TERRA[1] - GRAMA[1]) * k
    let b = GRAMA[2] + (TERRA[2] - GRAMA[2]) * k
    let luz = ruido(x * 0.12 + 3, y * 0.12 + 19) * 0.09 + ruido(x * 0.5 + 11, y * 0.5) * (0.07 - 0.03 * k)
    // Folhas e pedrinhas: pontos soltos, um tom acima ou abaixo.
    const ponto = hash(Math.floor(x * 0.85), Math.floor(y * 0.85), 41)
    if (ponto > 0.93) luz -= 0.07
    else if (ponto < 0.05) luz += 0.05
    // A cal: borda suave de 1 pixel da imagem, gasta por manchas e mais fraca sobre a terra.
    const d = distanciaAsLinhas(X, Y, m)
    const naLinha = (MEIA_LINHA - d) * escala + 0.5
    if (naLinha > 0) {
      const gasta = 0.66 + 0.34 * Math.min(1, Math.max(0, ruido(x * 0.21 + 57, y * 0.21 + 3) * 1.7 + 0.62))
      const q = Math.min(1, naLinha) * gasta * (1 - 0.5 * k) * 0.92
      r += (CAL[0] - r) * q
      g += (CAL[1] - g) * q
      b += (CAL[2] - b) * q
      luz *= 1 - q
    }
    s[0] = r
    s[1] = g
    s[2] = b
    s[3] += luz
    // A beira: o gramado recua até ~3 px da pegada, em ondas e tufos.
    const beira = Math.min(hw - Math.abs(x), hh - Math.abs(y)) - 1.7 + ruido(x * 0.33 + 71, y * 0.33 + 13) * 3.2 + ruido(x * 1.2 + 9, y * 1.2) * 1.2
    if (beira < 1) {
      s[5] = beira <= 0 ? 0 : beira
      s[3] -= 0.06 * (1 - s[5])
    }
  }
}

/** A malha da rede em losangos: o fio cheio e o vão quase todo aberto (o chão aparece por ele). */
const texDaRede: Textura = (_u, _v, x, y, _p, s, escala) => {
  // Abaixo de 1,2 pixel por px do protótipo o fio tem menos de 1 pixel e a malha vira chuvisco: a rede sai
  // como um véu liso. (O campo de 10 casas aproximado fica em ~1,4: a imagem tem teto de 1024 px de lado.)
  if (escala < MALHA_A_PARTIR_DE) {
    s[5] = VEU_DA_REDE
    return
  }
  const p = (x + y) / MALHA_DA_REDE
  const q = (x - y) / MALHA_DA_REDE
  const dp = Math.abs(p - Math.round(p)) * MALHA_DA_REDE
  const dq = Math.abs(q - Math.round(q)) * MALHA_DA_REDE
  const fio = Math.min(dp, dq)
  s[5] = fio < 0.38 ? 0.9 : fio < 0.7 ? 0.9 - ((fio - 0.38) / 0.32) * 0.64 : 0.26
}

export const montarCampinho: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const m = medidasDoCampo(c)
  const deitado = c.w >= c.h
  /** Do referencial do campo (X ao longo, Y através) para o da peça. */
  const ponto = (X: number, Y: number): [number, number] => (deitado ? [X, Y] : [Y, X])
  const retangulo = (X0: number, Y0: number, X1: number, Y1: number, raio: number): Forma => {
    const [x0, y0] = ponto(Math.min(X0, X1), Math.min(Y0, Y1))
    const [x1, y1] = ponto(Math.max(X0, X1), Math.max(Y0, Y1))
    return caixa(x0, y0, x1, y1, raio)
  }
  const L = cena.partes
  // O campo: sem chanfro nem contorno (a beira é da textura).
  L.push(P(caixa(-hw, -hh, hw, hh, 4), { classe: 'liso', rgb: GRAMA }, { bisel: 0, contorno: 0, textura: texDoCampo(c, m), semente: 2101 }))

  const altura = g * ALTURA_DA_TRAVE
  for (const lado of [-1, 1] as const) {
    const fundo = lado * m.a
    const atras = lado * (m.a + m.fundoDaRede)
    // A rede atrás da linha e a barra de trás dela, no chão.
    const rede = retangulo(fundo, -m.meioGol, atras, m.meioGol, 1.2)
    cena.sombras.push({ forma: rede, z: 0, suave: 2.2, forca: 0.1 })
    L.push(P(rede, REDE, { bisel: 0, contorno: 0.16, textura: texDaRede, semente: 2110 }))
    L.push(P(retangulo(atras - lado * 1.5, -m.meioGol, atras, m.meioGol, 0.7), TRAVE, { tabua: 0, bisel: 0.7, tom: 0.9, contorno: 0.24, semente: 2112 }))
    // O travessão (o tampo no ar) e os dois postes (as colunas).
    const [ax, ay] = ponto(fundo, -m.meioGol)
    const [bx, by] = ponto(fundo, m.meioGol)
    const travessao = capsula(ax, ay, bx, by, RAIO_DO_TRAVESSAO)
    cena.sombras.push({ forma: travessao, z: altura, solta: true, forca: 0.2 })
    L.push(P(travessao, TRAVE, { eixo: deitado ? Math.PI / 2 : 0, tabua: 0, bisel: RAIO_DO_TRAVESSAO, contorno: 0.26, semente: 2114, projeta: { dist: 1.4, forca: 0.24 } }))
    for (const [px, py] of [[ax, ay], [bx, by]] as const) {
      const poste = elipse(px, py, RAIO_DO_POSTE, RAIO_DO_POSTE)
      cena.sombras.push({ forma: poste, z: altura, forca: 0.24 })
      L.push(P(poste, TRAVE, { tabua: 0, bisel: RAIO_DO_POSTE * 0.8, tom: 1.04, contorno: 0.3, semente: 2116 }))
    }
  }
}
