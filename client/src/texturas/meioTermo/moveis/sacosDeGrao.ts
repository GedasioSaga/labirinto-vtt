/**
 * SACOS DE GRÃO de cima com volume (lote 1 dos objetos novos, 11/11/2026), para
 * o armazém, o celeiro e o porão do navio. A pilha de quatro sacos gordos de
 * pano cru: dois deitados no chão, um terceiro deitado por cima deles, de
 * través, e o quarto em pé, ABERTO, com a boca enrolada para fora e o grão
 * dourado à mostra. Cada saco deitado tem o corpo de almofada, as duas orelhas
 * dos cantos do fundo, a costura (a do lado e a do fundo, com os pontos da
 * linha grossa), o franzido do pano junto da boca, as duas voltas de corda com
 * o nó e as pontas soltas, e a boca aberta em leque depois da amarra. No chão,
 * uns grãos caídos.
 *
 * A 25% de zoom sobram os vultos claros e gordos com o risco escuro da corda
 * em cada boca e a roda dourada do grão: é o que diz "sacos de grão" e não
 * "pedras". O pano, a corda e o grão são fixos (como o feno: um tom só,
 * contido, sem escolha que não muda nada). As medidas saem do menor lado da
 * pegada (1 x 1 casa de partida) e as posições, de frações dela.
 */
import { hash } from '../../ruido'
import { capsula, elipse, elipseGirada, menos, poligono, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

type Rgb3 = readonly [number, number, number]

/**
 * O pano cru (a estopa): bege de juta, mais escuro e mais quente que o linho do lençol (que some na lajota
 * clara) e mais claro e menos vivo que a terra. Saturação HSV ~0,31.
 */
const PANO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xae, 0x86] }
/**
 * O escuro em que o pixel escuro demais é levantado: o tom escuro do próprio pano. Com o piso padrão (a
 * nogueira) o lado da sombra de cada saco saía vermelho-queimado.
 */
const ESCURO_DO_PANO: Rgb3 = [0x5e, 0x4a, 0x36]
/** A linha grossa da costura. */
const TOM_DA_LINHA: Rgb3 = [0x80, 0x69, 0x4a]
/** A corda da amarra: sisal escuro, para riscar o pano claro (a corda clara da cerca sumiria nele). */
const CORDA_DA_AMARRA: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x6c, 0x48] }
const TORCAO_DA_AMARRA: Rgb3 = [0x64, 0x4f, 0x36]
/** O grão: dourado contido (saturação HSV ~0,5, abaixo do teto de 0,62), com o grão mais claro e o mais torrado. */
const GRAO: MaterialDaPeca = { classe: 'liso', rgb: [0xcb, 0xa6, 0x66] }
const GRAO_CLARO: Rgb3 = [0xd8, 0xba, 0x80]
const GRAO_TORRADO: Rgb3 = [0xa8, 0x82, 0x4c]

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5
const CONTRASTE_DO_DETALHE_MIUDO = 0.3

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

// ---------- o pano ----------

/** Largura de um fio da estopa (px do protótipo): a trama grossa, que só se vê de perto. */
const FIO = 1.1

/**
 * A trama da estopa: fios que passam um por cima do outro, cada cruzamento com a sua luz. Fraca: com mais
 * contraste o saco virava cesto de palha.
 */
function trama(u: number, v: number, s: Float32Array, escala: number): void {
  const i = Math.floor(u / FIO)
  const j = Math.floor(v / FIO)
  const atravessa = (((i + j) & 1) === 0 ? v : u) / FIO
  const luz = (Math.sin((atravessa - Math.floor(atravessa)) * Math.PI) - 0.64) * 0.07 + (hash(i, j, 83) - 0.5) * 0.03
  s[3] += escala < ESCALA_DO_DETALHE ? luz * CONTRASTE_DO_DETALHE_MIUDO : luz
}

/** A costura: até onde a linha vai de cada lado do vinco, a meia largura do vinco e o passo dos pontos (px do protótipo). */
const MEIO_PONTO = 1
const VINCO = 0.5
const PASSO_DO_PONTO = 2.1
/** A parte do passo que o ponto ocupa (o resto é o pano entre um ponto e o outro). */
const MEIA_LARGURA_DO_PONTO = 0.17

/**
 * A costura no ponto: o vinco fino onde o pano foi unido e, por cima, os pontos da linha grossa, em diagonal.
 * `ao` corre ao longo dela e `atr` é a distância a ela (com sinal). No tamanho de mesa os pontos somem (viravam
 * chuvisco) e fica só o vinco.
 */
function costura(s: Float32Array, ao: number, atr: number, escala: number): void {
  const d = Math.abs(atr)
  if (d > MEIO_PONTO) return
  if (d < VINCO) s[3] -= 0.1 * (1 - d / VINCO)
  if (escala < ESCALA_DO_DETALHE) return
  const fase = ao / PASSO_DO_PONTO + atr * 0.35
  if (Math.abs(fase - Math.floor(fase) - 0.5) > MEIA_LARGURA_DO_PONTO) return
  const t = 0.7 * (1 - (d / MEIO_PONTO) ** 2)
  s[0] += (TOM_DA_LINHA[0] - s[0]) * t
  s[1] += (TOM_DA_LINHA[1] - s[1]) * t
  s[2] += (TOM_DA_LINHA[2] - s[2]) * t
}

/** A prega do pano: o fundo dela escurece (ao quadrado: um risco, não uma faixa) e o lombo clareia um pouco. */
function prega(onda: number, fundo: number, lombo: number): number {
  return onda > 0 ? -fundo * onda * onda : -lombo * onda
}

// ---------- o saco deitado ----------

interface SacoDeitado {
  /** O meio do corpo, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** Para onde aponta a boca amarrada (radianos). */
  readonly ang: number
  readonly tom: number
  /** Altura do lombo em casas. */
  readonly z: number
  /** Deitado em cima dos outros: faz sombra neles e não encosta no chão. */
  readonly emCima: boolean
}

/** Os três deitados, de baixo para cima: o da frente (a boca para a esquerda), o do fundo (para a direita) e o de cima, de través. */
const SACOS_DEITADOS: readonly SacoDeitado[] = [
  { x: -0.24, y: 0.45, ang: 3.02, tom: 0.9, z: 0.3, emCima: false },
  { x: 0.2, y: -0.46, ang: -0.1, tom: 0.94, z: 0.3, emCima: false },
  { x: -0.22, y: -0.06, ang: -2.25, tom: 1.02, z: 0.58, emCima: true },
]
/** O corpo do saco: meio comprimento e meia largura, em frações do menor meio lado da pegada. */
const MEIO_COMPRIMENTO = 0.43
const MEIA_LARGURA = 0.31
/** Onde a corda aperta a boca, em meios comprimentos a partir do meio do corpo. */
const LUGAR_DA_AMARRA = 1.02
/**
 * O contorno de meio saco, do fundo à boca: [ao longo, meia largura], em meios comprimentos e meias larguras do
 * corpo. O corpo de almofada, o ombro que cai até a garganta (onde a corda aperta) e a boca que abre em leque.
 */
const PERFIL_DO_SACO: readonly Ponto[] = [
  [-0.97, 0.9],
  [-0.8, 0.97],
  [-0.5, 1],
  [-0.1, 1],
  [0.3, 0.97],
  [0.55, 0.88],
  [0.75, 0.7],
  [0.88, 0.48],
  [0.96, 0.31],
  [LUGAR_DA_AMARRA, 0.22],
  [1.1, 0.27],
  [1.2, 0.41],
  [1.27, 0.5],
]
/**
 * A orelha: a ponta que o canto do fundo faz no saco cheio. Curta: mais comprida, com o chanfro fundo do corpo,
 * o canto virava um bico escuro.
 */
const ORELHA: Ponto = [-1.07, 0.9]
/** O fundo costurado, bojudo, entre as duas orelhas (do lado de baixo para o de cima). */
const FUNDO: readonly Ponto[] = [
  [-1.03, 0.66],
  [-1.07, 0.34],
  [-1.08, 0],
  [-1.07, -0.34],
  [-1.03, -0.66],
]
/** A beira da boca, ondulada (do lado de cima para o de baixo). */
const BEIRA_DA_BOCA: readonly Ponto[] = [
  [1.31, -0.3],
  [1.26, -0.13],
  [1.32, 0],
  [1.26, 0.13],
  [1.31, 0.3],
]
/** O franzido junto da amarra: quantas pregas em meia volta, e até onde ele chega (em meias larguras). */
const PREGAS_DO_FRANZIDO = 9
const ALCANCE_DO_FRANZIDO = 1.5
/** As pregas da boca abrem em leque a partir de um ponto um pouco atrás da amarra (em meios comprimentos). */
const PREGAS_DA_BOCA = 12
const RECUO_DO_LEQUE = 0.15
/** A costura do lado (a que fração da meia largura ela corre, e de onde a onde) e a do fundo (em meios comprimentos). */
const LUGAR_DA_COSTURA = 0.5
const COSTURA_DE = -0.88
const COSTURA_ATE = 0.8
const COSTURA_DO_FUNDO = -0.88
/**
 * As listras do saco de grão, ao comprido do lombo: uma faixa de anil desbotado e um filete de cada lado dela.
 * De onde a onde vão (em meios comprimentos; somem antes do franzido), as meias larguras e o lugar do filete
 * (px do protótipo) e quanto do anil entra no pano.
 */
const TOM_DA_LISTRA: Rgb3 = [0x6c, 0x7a, 0x8e]
const LISTRA_DE = -0.94
const LISTRA_ATE = 0.72
const MEIA_FAIXA = 0.75
const LUGAR_DO_FILETE = 1.9
const MEIO_FILETE = 0.3
const ANIL_NO_PANO = 0.42
/** A beira macia da listra (px do protótipo) e o trecho em que ela some antes do franzido (meios comprimentos). */
const BEIRA_DA_LISTRA = 0.3
const SUMICO_DA_LISTRA = 0.2

/** Quanto da listra cobre o ponto a `d` px do meio dela: 1 dentro, 0 fora, com a beira macia. */
function naListra(d: number, meia: number): number {
  return limitar((meia - d) / BEIRA_DA_LISTRA + 0.5, 0, 1)
}
/** A amarra: o raio da corda, o vão entre as duas voltas e o raio do nó (px do protótipo). */
const RAIO_DA_AMARRA = 0.72
const VAO_DAS_VOLTAS = 1.3
const RAIO_DO_NO = 0.95
/** As duas pontas soltas, a partir do nó: [ao longo, de través], em meios comprimentos e meias larguras. */
const PONTAS_DA_AMARRA: readonly Ponto[] = [
  [-0.22, 0.34],
  [0.12, 0.5],
]

/** A meia largura do saco (em meias larguras do corpo) em `t` (meios comprimentos), entre os pontos do perfil. */
function meiaLarguraEm(t: number): number {
  const ultimo = PERFIL_DO_SACO.length - 1
  if (t <= PERFIL_DO_SACO[0][0]) return PERFIL_DO_SACO[0][1]
  for (let i = 1; i <= ultimo; i += 1) {
    const [t1, q1] = PERFIL_DO_SACO[i]
    if (t > t1) continue
    const [t0, q0] = PERFIL_DO_SACO[i - 1]
    return q0 + ((q1 - q0) * (t - t0)) / (t1 - t0)
  }
  return PERFIL_DO_SACO[ultimo][1]
}

/** Onde o saco deitado está: o meio, a direção (cosseno e seno) e o meio comprimento e a meia largura em px. */
interface LugarDoSaco {
  readonly cx: number
  readonly cy: number
  readonly co: number
  readonly si: number
  readonly a: number
  readonly b: number
}

/** A corda torcida da amarra: faixas em diagonal da cor da torção. */
const texDaAmarra: Textura = (u, v, _x, _y, _p, s) => {
  const t = limitar((Math.sin(u * 2.4 + v * 1.6) - 0.2) / 0.8, 0, 1)
  s[0] += (TORCAO_DA_AMARRA[0] - s[0]) * t
  s[1] += (TORCAO_DA_AMARRA[1] - s[1]) * t
  s[2] += (TORCAO_DA_AMARRA[2] - s[2]) * t
}

/**
 * O pano do corpo do saco deitado: a trama, as manchas largas, o franzido que converge na amarra (as pregas
 * saem dela em leque e somem no corpo), as listras do lombo e as duas costuras.
 */
function texDoSaco({ cx, cy, co, si, a, b }: LugarDoSaco, sem: number): Textura {
  const xAmarra = LUGAR_DA_AMARRA * a
  return (u, v, x, y, _p, s, escala) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    trama(u, v, s, escala)
    s[3] += ruido(x * 0.1 + sem, y * 0.1) * 0.08
    const dx = xAmarra - lx
    const perto = 1 - Math.hypot(dx, ly) / (b * ALCANCE_DO_FRANZIDO)
    if (dx > 0 && perto > 0) s[3] += perto * perto * prega(Math.sin(Math.atan2(ly, dx) * PREGAS_DO_FRANZIDO + ruido(lx * 0.25 + sem, ly * 0.25) * 1.6), 0.34, 0.08)
    const t = lx / a
    if (t > LISTRA_DE && t < LISTRA_ATE) {
      const d = Math.abs(ly)
      // No tamanho de mesa o filete tem menos de 1 pixel e vira chuvisco: fica só a faixa.
      const filete = escala < ESCALA_DO_DETALHE ? 0 : naListra(Math.abs(d - LUGAR_DO_FILETE), MEIO_FILETE)
      const anil = ANIL_NO_PANO * Math.max(naListra(d, MEIA_FAIXA), filete) * limitar((LISTRA_ATE - t) / SUMICO_DA_LISTRA, 0, 1)
      s[0] += (TOM_DA_LISTRA[0] - s[0]) * anil
      s[1] += (TOM_DA_LISTRA[1] - s[1]) * anil
      s[2] += (TOM_DA_LISTRA[2] - s[2]) * anil
    }
    if (t > COSTURA_DE && t < COSTURA_ATE) costura(s, lx, ly - meiaLarguraEm(t) * b * LUGAR_DA_COSTURA, escala)
    if (Math.abs(ly) < b * 0.8) costura(s, ly, lx - a * COSTURA_DO_FUNDO, escala)
  }
}

/** O pano da boca, depois da amarra: a trama e as pregas abrindo em leque. */
function texDaBoca({ cx, cy, co, si, a }: LugarDoSaco, sem: number): Textura {
  const xLeque = (LUGAR_DA_AMARRA - RECUO_DO_LEQUE) * a
  return (u, v, x, y, _p, s, escala) => {
    const lx = (x - cx) * co + (y - cy) * si
    const ly = -(x - cx) * si + (y - cy) * co
    trama(u, v, s, escala)
    s[3] += prega(Math.sin(Math.atan2(ly, lx - xLeque) * PREGAS_DA_BOCA + sem), 0.26, 0.08)
  }
}

function montarSacoDeitado(c: ContextoDoMovel, cena: Cena, saco: SacoDeitado, k: number): void {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const lugar: LugarDoSaco = { cx: saco.x * c.hw, cy: saco.y * c.hh, co: Math.cos(saco.ang), si: Math.sin(saco.ang), a: R * MEIO_COMPRIMENTO, b: R * MEIA_LARGURA }
  const { cx, cy, co, si, a, b } = lugar
  /** Do saco (x ao longo dele, y de través, em px) para a pegada. */
  const noMapa = (lx: number, ly: number): Ponto => [cx + lx * co - ly * si, cy + lx * si + ly * co]
  const doPerfil = ([t, q]: Ponto): Ponto => noMapa(t * a, q * b)
  const contorno: readonly Ponto[] = [
    [ORELHA[0], -ORELHA[1]],
    ...PERFIL_DO_SACO.map(([t, q]): Ponto => [t, -q]),
    ...BEIRA_DA_BOCA,
    ...[...PERFIL_DO_SACO].reverse(),
    ORELHA,
    ...FUNDO,
  ]
  const forma = poligono(contorno.map(doPerfil))
  cena.sombras.push({ forma, z: c.g * saco.z, forca: saco.emCima ? 0.24 : 0.3 })
  if (!saco.emCima) cena.sombras.push(contato(forma, 0.3))
  const sem = 3200 + k * 10
  L.push(P(forma, PANO, { eixo: saco.ang, bisel: b * 0.86, tom: saco.tom, contorno: 0.26, ruga: 1, textura: texDoSaco(lugar, sem), semente: sem, projeta: saco.emCima ? { dist: 3, forca: 0.38, suave: 1.4 } : undefined }))

  // A boca depois da amarra: uma peça só dela, rasa e clara (no chanfro fundo do corpo ela saía escura, de outro pano).
  const daBoca = PERFIL_DO_SACO.filter(([t]) => t >= LUGAR_DA_AMARRA)
  const boca = poligono([...daBoca.map(([t, q]): Ponto => [t, -q]), ...BEIRA_DA_BOCA, ...[...daBoca].reverse()].map(doPerfil))
  L.push(P(boca, PANO, { eixo: saco.ang, bisel: 0.9, tom: saco.tom * 1.03, contorno: 0.26, textura: texDaBoca(lugar, sem), semente: sem + 6 }))

  // A amarra: duas voltas de corda apertando a garganta, o nó em cima e as duas pontas soltas.
  const xAmarra = LUGAR_DA_AMARRA * a
  const garganta = meiaLarguraEm(LUGAR_DA_AMARRA) * b + 0.5
  for (const [i, dx] of [0, VAO_DAS_VOLTAS].entries()) {
    const [x0, y0] = noMapa(xAmarra + dx, -garganta)
    const [x1, y1] = noMapa(xAmarra + dx, garganta)
    L.push(P(capsula(x0, y0, x1, y1, RAIO_DA_AMARRA), CORDA_DA_AMARRA, { eixo: saco.ang + QUARTO, bisel: RAIO_DA_AMARRA, contorno: 0.14, textura: texDaAmarra, semente: sem + 1 + i, projeta: { dist: 0.5, forca: 0.24 } }))
  }
  const [nx, ny] = noMapa(xAmarra + VAO_DAS_VOLTAS / 2, 0)
  PONTAS_DA_AMARRA.forEach(([t, q], i) => {
    const [px, py] = noMapa(xAmarra + t * a, q * b)
    L.push(P(capsula(nx, ny, px, py, RAIO_DA_AMARRA * 0.62), CORDA_DA_AMARRA, { eixo: Math.atan2(py - ny, px - nx), bisel: RAIO_DA_AMARRA * 0.62, tom: 0.94, contorno: 0.14, textura: texDaAmarra, semente: sem + 3 + i }))
  })
  L.push(P(elipse(nx, ny, RAIO_DO_NO, RAIO_DO_NO), CORDA_DA_AMARRA, { bisel: RAIO_DO_NO, tom: 1.06, contorno: 0.14, semente: sem + 5 }))
}

// ---------- o saco aberto ----------

/** O saco em pé: o meio (frações da meia pegada), o raio do bojo (fração do menor meio lado) e a altura em casas. */
const SACO_ABERTO = { x: 0.52, y: 0.46, raio: 0.4, z: 0.62 } as const
/** A boca enrolada para fora (o rolo de pano) e o grão dentro dela, em raios do bojo. */
const ROLO_POR_FORA = 0.84
const ROLO_POR_DENTRO = 0.58
const RAIO_DO_GRAO = 0.64
/** Pontos do contorno de cada roda torta. */
const PONTOS_DA_RODA = 32
/** As pregas em volta do bojo e do rolo (em uma volta), e onde corre a costura de pé do bojo (radianos). */
const PREGAS_DO_BOJO = 11
const PREGAS_DO_ROLO = 17
const COSTURA_DO_BOJO = 2.3
/** O tamanho de um grão (px do protótipo): a célula em que cada um mora. */
const GRAO_PX = 1.5

/** A roda torta em volta de (cx, cy): o raio muda devagar com o ruído (um saco cheio não é um círculo). */
function roda(cx: number, cy: number, raio: number, torto: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < PONTOS_DA_RODA; i += 1) {
    const t = (i / PONTOS_DA_RODA) * Math.PI * 2
    const r = raio * (1 + torto * 2 * ruido(Math.cos(t) * 1.3 + sem, Math.sin(t) * 1.3 + sem * 0.7))
    pontos.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r])
  }
  return pontos
}

/** O pano visto do alto em volta de (cx, cy): a trama, as pregas que saem do meio e, no bojo, a costura de pé. */
function texDoPanoEmRoda(cx: number, cy: number, pregas: number, comCostura: boolean, sem: number): Textura {
  return (u, v, x, y, _p, s, escala) => {
    const dx = x - cx
    const dy = y - cy
    const angulo = Math.atan2(dy, dx)
    trama(u, v, s, escala)
    s[3] += ruido(x * 0.1 + sem, y * 0.1) * 0.08 + prega(Math.sin(angulo * pregas + ruido(dx * 0.2 + sem, dy * 0.2) * 2), 0.17, 0.05)
    if (!comCostura) return
    let volta = angulo - COSTURA_DO_BOJO
    volta -= Math.round(volta / (Math.PI * 2)) * Math.PI * 2
    const longe = Math.hypot(dx, dy)
    costura(s, longe, volta * longe, escala)
  }
}

/**
 * O grão à mostra: cada grão numa célula, o mais perto do ponto manda (um miolo claro e o vão escuro entre
 * ele e o vizinho); uns mais claros, outros mais torrados.
 */
const texDoGrao: Textura = (_u, _v, x, y, _p, s, escala) => {
  const gx = x / GRAO_PX
  const gy = y / GRAO_PX
  const ix = Math.floor(gx)
  const iy = Math.floor(gy)
  let perto = Infinity
  let segundo = Infinity
  let sorte = 0.5
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const d = Math.hypot(gx - (ix + i + hash(ix + i, iy + j, 91)), gy - (iy + j + hash(ix + i, iy + j, 92)))
      if (d < perto) {
        segundo = perto
        perto = d
        sorte = hash(ix + i, iy + j, 93)
      } else if (d < segundo) segundo = d
    }
  }
  const contraste = escala < ESCALA_DO_DETALHE ? CONTRASTE_DO_DETALHE_MIUDO : 1
  s[3] += contraste * ((sorte - 0.5) * 0.12 + (0.45 - perto) * 0.3 - Math.max(0, 0.1 - (segundo - perto)) * 2.6)
  const cor = sorte > 0.72 ? GRAO_CLARO : sorte < 0.24 ? GRAO_TORRADO : null
  if (cor === null) return
  s[0] += (cor[0] - s[0]) * 0.6 * contraste
  s[1] += (cor[1] - s[1]) * 0.6 * contraste
  s[2] += (cor[2] - s[2]) * 0.6 * contraste
}

function montarSacoAberto(c: ContextoDoMovel, cena: Cena): void {
  const P = c.peca
  const L = cena.partes
  const r = Math.min(c.hw, c.hh) * SACO_ABERTO.raio
  const cx = SACO_ABERTO.x * c.hw
  const cy = SACO_ABERTO.y * c.hh
  // O bojo: o saco cheio, em pé, mais largo que a boca.
  const bojo = poligono(roda(cx, cy, r, 0.07, 5))
  cena.sombras.push({ forma: bojo, z: c.g * SACO_ABERTO.z }, contato(bojo, 0.3))
  L.push(P(bojo, PANO, { eixo: 0.3, bisel: r * 0.42, tom: 0.88, contorno: 0.26, ruga: 0.8, textura: texDoPanoEmRoda(cx, cy, PREGAS_DO_BOJO, true, 3260), semente: 3260, projeta: { dist: 2, forca: 0.32, suave: 1.2 } }))
  // A boca fica um pouco para o lado da luz (o saco cheio pende). O grão por baixo, em monte, e o rolo de pano em volta.
  const bx = cx - r * 0.05
  const by = cy - r * 0.06
  L.push(P(elipse(bx, by, r * RAIO_DO_GRAO, r * RAIO_DO_GRAO), GRAO, { bisel: r * 0.28, tom: 0.96, contorno: 0, textura: texDoGrao, semente: 3261 }))
  const rolo = menos(poligono(roda(bx, by, r * ROLO_POR_FORA, 0.04, 9)), poligono(roda(bx, by, r * ROLO_POR_DENTRO, 0.05, 13)))
  L.push(P(rolo, PANO, { eixo: 1.1, bisel: (r * (ROLO_POR_FORA - ROLO_POR_DENTRO)) / 2, tom: 1, contorno: 0.24, textura: texDoPanoEmRoda(bx, by, PREGAS_DO_ROLO, false, 3262), semente: 3262, projeta: { dist: 1.5, forca: 0.36, suave: 1 } }))
}

// ---------- os grãos caídos ----------

/** Os grãos no chão, na frente da pilha: quantos, e a mancha em que caem (meio e raios, em frações da meia pegada). */
const GRAOS_CAIDOS = 14
const MANCHA_DOS_GRAOS = { x: 0.02, y: 0.9, rx: 0.32, ry: 0.06 } as const
/** Um grão: meio comprimento e meia largura (px do protótipo). */
const MEIO_GRAO = 0.95
const MEIA_LARGURA_DO_GRAO = 0.56

function montarGraosCaidos(c: ContextoDoMovel, cena: Cena): void {
  for (let i = 0; i < GRAOS_CAIDOS; i += 1) {
    // Mais juntos no meio da mancha (a raiz do sorteio espalharia por igual; o sorteio cru junta no meio).
    const longe = hash(i, 1, 951)
    const volta = hash(i, 2, 951) * Math.PI * 2
    const x = (MANCHA_DOS_GRAOS.x + Math.cos(volta) * longe * MANCHA_DOS_GRAOS.rx) * c.hw
    const y = (MANCHA_DOS_GRAOS.y + Math.sin(volta) * longe * MANCHA_DOS_GRAOS.ry) * c.hh
    const grao = elipseGirada(x, y, MEIO_GRAO, MEIA_LARGURA_DO_GRAO, hash(i, 3, 951) * Math.PI)
    cena.sombras.push(contato(grao, 0.2))
    cena.partes.push(c.peca(grao, GRAO, { bisel: MEIA_LARGURA_DO_GRAO, tom: 0.9 + 0.2 * hash(i, 4, 951), contorno: 0.24, semente: 3270 + i }))
  }
}

export const montarSacosDeGrao: MontarMovel = (c, cena) => {
  cena.corDoPiso = ESCURO_DO_PANO
  // De baixo para cima: os grãos no chão, os dois sacos deitados, o aberto em pé e o deitado por cima.
  montarGraosCaidos(c, cena)
  SACOS_DEITADOS.forEach((saco, k) => {
    if (!saco.emCima) montarSacoDeitado(c, cena, saco, k)
  })
  montarSacoAberto(c, cena)
  SACOS_DEITADOS.forEach((saco, k) => {
    if (saco.emCima) montarSacoDeitado(c, cena, saco, k)
  })
}
