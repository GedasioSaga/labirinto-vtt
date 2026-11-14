/**
 * MESA DE GUERRA de cima com volume (lote L02 de 14/11/2026, o castelo): a
 * mesa do conselho com o MAPA aberto em cima, um rolo de pergaminho
 * desenrolado (as duas pontas ainda enroladas, com os puxadores de madeira) e
 * preso no canto por uma ADAGA. O mapa é pintado na textura do pergaminho: o
 * mar com as ondinhas junto da costa, a linha da costa, o rio, o bosque em
 * bolinhas, as serras em "^", a fronteira tracejada em vinho, as cidades, a
 * rosa dos ventos e a moldura, tudo a tinta sépia num papel manchado. Por cima
 * dele, os dois EXÉRCITOS (os peões vinho de um lado da fronteira, os azuis do
 * outro, cada um com um cavaleiro), as BANDEIRINHAS fincadas nos alfinetes e o
 * COMPASSO de pontas aberto.
 *
 * O que lê a 25% de zoom é o retângulo claro do pergaminho na mesa escura,
 * com o mar azulado num canto e os pontos vinho e azuis frente a frente. A
 * mesa é a da `mesaComPernas` com as pernas mais grossas, copiada aqui para o
 * desenho só depender do motor; corre ao longo do lado maior (a de partida, 2 x
 * 1,5, deitada), e o mapa estica com ela. Na 3/4 tudo o que está em cima sobe
 * com o tampo; as coisas de cima fazem sombra só no mapa (`projeta`).
 * Material: `madeira` (a mesa, os puxadores e o cabo da adaga); o resto é fixo.
 */
import { caixa, capsula, elipse, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio, type IdDoMaterial } from '../materiais'
import { hash, rgb, type Rgb } from '../../ruido'

// ---------- a mesa (as medidas da `mesaComPernas`, em casas; as pernas, mais grossas) ----------

const ALTURA_DA_MESA = 0.5
const RECUO_DO_TAMPO = 0.075
const LADO_DA_PERNA = 0.14
const LARGURA_DA_TABUA = 0.2
const RAIO_DA_QUINA = 0.04
const ESPESSURA_EMBAIXO = 0.036
const ESPESSURA_A_DIREITA = 0.009
const LARGURA_DA_BORDA_CLARA = 0.055
const LUZ_DA_BORDA_CLARA = 0.2
const SOMBRA_DE_BAIXO_ALEM = 0.025
const FORCA_DA_SOMBRA_DE_BAIXO = 0.4
const FORCA_DA_SOMBRA_DO_TAMPO = 0.22
const FORCA_DO_CONTATO_DA_PERNA = 0.34
const FORCA_DA_SOMBRA_DA_PERNA = 0.3
const TOM_DO_TAMPO = 0.97
const TOM_DA_ESPESSURA = 0.66
const TOM_DA_PERNA = 0.64

// ---------- o mapa ----------

/** A folga entre o mapa e a beira do tampo, ao comprido e de través (casas): por onde a mesa aparece. */
const FOLGA_AO_COMPRIDO = 0.17
const FOLGA_DE_TRAVES = 0.13
/** O mapa fica um pouco torto na mesa (radianos). */
const GIRO_DO_MAPA = -0.035
/** O rolo de cada ponta: o raio (px do protótipo, na casa de 56). */
const RAIO_DO_ROLO = 2.7

const PERGAMINHO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('linho', 1.02)) }
/** As cores da tinta e do mapa. A tinta é sépia; o mar, um verde-azulado apagado, para não estourar a saturação. */
const TINTA: Rgb = [0x5c, 0x46, 0x33]
const MAR: Rgb = [0x9c, 0xae, 0xa6]
const TINTA_DO_MAR: Rgb = [0x4f, 0x6e, 0x73]
const BOSQUE: Rgb = [0x6e, 0x7c, 0x55]
const FRONTEIRA: Rgb = [0x8e, 0x45, 0x40]

const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('vinho', 1.12)) }
const AZUL: MaterialDaPeca = { classe: 'liso', rgb: rgb('#4b648e') }
const LATAO: MaterialDaPeca = materialDaPeca('latao')
const FERRO: MaterialDaPeca = materialDaPeca('ferro')
/** O aço da lâmina, mais claro que o ferro das ferragens. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('metal', 1.25)) }
const MADEIRA_DO_CABO: IdDoMaterial = 'nogueira'

/** A régua da mesa: `u` ao longo (do lado maior), `v` de través. Deitada, u é x; em pé, u é y (como a ponte). */
interface Regua {
  readonly C: number
  readonly A: number
  readonly casa: number
  readonly deitada: boolean
  readonly eixo: number
  readonly pt: (u: number, v: number) => Ponto
  readonly ret: (u0: number, v0: number, u1: number, v1: number, raio: number) => Forma
}

function reguaDa(c: ContextoDoMovel): Regua {
  const deitada = c.w >= c.h
  return {
    C: deitada ? c.hw : c.hh,
    A: deitada ? c.hh : c.hw,
    casa: Math.min(c.g, c.w, c.h),
    deitada,
    eixo: deitada ? 0 : QUARTO,
    pt: (u, v) => (deitada ? [u, v] : [-v, u]),
    ret: (u0, v0, u1, v1, raio) => (deitada ? caixa(u0, v0, u1, v1, raio) : caixa(-v1, u0, -v0, u1, raio)),
  }
}

/** O veio de madeira com a borda clara: a luz cresce do fim da faixa até a quina do tampo. */
function madeiraComBordaClara(forma: Forma, largura: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < largura) s[3] += LUZ_DA_BORDA_CLARA * (1 - (t > 0 ? t : 0) / largura)
  }
}

/** A mesa: as sombras, as pernas, a espessura e o tampo. */
function montarAMesa(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const mad = c.m.madeira
  const { C, A, casa } = r
  const recuo = RECUO_DO_TAMPO * casa
  const tampo = r.ret(-C + recuo, -A + recuo, C - recuo, A - recuo, RAIO_DA_QUINA * casa)
  const alem = SOMBRA_DE_BAIXO_ALEM * casa
  const altura = c.g * ALTURA_DA_MESA
  const lado = LADO_DA_PERNA * casa
  const pernas: Forma[] = []
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const u0 = su < 0 ? -C : C - lado
      const v0 = sv < 0 ? -A : A - lado
      pernas.push(r.ret(u0, v0, u0 + lado, v0 + lado, 0.12 * lado))
    }
  }
  const sombras: Sombra[] = [
    { forma: r.ret(-C + recuo - alem, -A + recuo - alem, C - recuo + alem, A - recuo + alem, RAIO_DA_QUINA * casa + alem), z: 0, suave: alem, forca: FORCA_DA_SOMBRA_DE_BAIXO },
    { forma: tampo, z: altura, solta: true, suave: 1.8, forca: FORCA_DA_SOMBRA_DO_TAMPO },
  ]
  for (const perna of pernas) {
    const b = perna.b
    const folga = 0.08 * (b[2] - b[0])
    sombras.push(contato(caixa(b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga, 0.3 * (b[2] - b[0])), FORCA_DO_CONTATO_DA_PERNA), { forma: perna, z: altura, suave: 0.9, forca: FORCA_DA_SOMBRA_DA_PERNA })
  }
  cena.sombras.push(...sombras)
  pernas.forEach((perna, i) => cena.partes.push(P(perna, mad, { eixo: QUARTO, tabua: 0, bisel: 1, contorno: 0.16, tom: TOM_DA_PERNA, semente: 6104 + i })))
  // A espessura fica embaixo e à direita NA TELA, qualquer que seja a régua.
  cena.partes.push(P(tampo, mad, { eixo: r.eixo, dx: ESPESSURA_A_DIREITA * casa, dy: ESPESSURA_EMBAIXO * casa, tabua: 0, bisel: 0.7, contorno: 0.2, tom: TOM_DA_ESPESSURA, semente: 6103 }))
  cena.partes.push(P(tampo, mad, { eixo: r.eixo, tabua: LARGURA_DA_TABUA * casa, bisel: 1.6, contorno: 0.06, tom: TOM_DO_TAMPO, semente: 6100, textura: madeiraComBordaClara(tampo, LARGURA_DA_BORDA_CLARA * casa) }))
}

/** A mistura de `cor` na cor do ponto, com peso `t` (0..1). */
function tingir(s: Float32Array, cor: Rgb, t: number): void {
  if (t <= 0) return
  const k = t > 1 ? 1 : t
  s[0] += (cor[0] - s[0]) * k
  s[1] += (cor[1] - s[1]) * k
  s[2] += (cor[2] - s[2]) * k
}

/** Quanto do traço de meia largura `meia` cobre o ponto a `d` px do meio dele (borda de meio px). */
function traco(d: number, meia: number): number {
  const t = meia + 0.35 - Math.abs(d)
  return t <= 0 ? 0 : t >= 0.7 ? 1 : t / 0.7
}

/** Distância do ponto ao segmento (a, b). */
function aoSegmento(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  let h = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9)
  h = h < 0 ? 0 : h > 1 ? 1 : h
  return Math.hypot(x - ax - dx * h, y - ay - dy * h)
}

/**
 * O desenho do mapa, na régua do mapa (a ao comprido, b de través, centro no
 * meio, meias medidas `mu` e `mv`). `k` = px por casa / 56: a tinta tem a
 * mesma grossura em qualquer tamanho de mesa.
 */
function texDoMapa(r: Regua, mu: number, mv: number, k: number): Textura {
  const co = Math.cos(GIRO_DO_MAPA)
  const si = Math.sin(GIRO_DO_MAPA)
  return (_u, _v, x, y, _p, s) => {
    // Da tela para a régua da mesa e dela para a do mapa (desfaz o giro).
    const um = r.deitada ? x : y
    const vm = r.deitada ? y : -x
    const a = um * co + vm * si
    const b = -um * si + vm * co
    const sa = a / mu
    const sb = b / mv
    // As manchas do papel velho e a beira mais escura.
    const beira = Math.min(mu - Math.abs(a), mv - Math.abs(b))
    s[3] += ruido(a * 0.11 + 31, b * 0.11) * 0.1 + ruido(a * 0.5, b * 0.5) * 0.03
    if (beira < 5 * k) s[3] -= 0.1 * (1 - beira / (5 * k))
    // A costa: o mar no canto de cima à direita.
    const f = sa * 0.8 - sb * 0.55 - 0.32 + ruido(a * 0.09 / k + 5, b * 0.09 / k) * 0.34 + ruido(a * 0.26 / k, b * 0.26 / k) * 0.07
    const passoDaCosta = 0.8 / mu
    if (f > 0) {
      tingir(s, MAR, 0.62)
      // As ondinhas junto da costa, paralelas a ela.
      const fase = f / passoDaCosta / (2.4 * k)
      if (f < 9 * k * passoDaCosta && fase - Math.floor(fase) < 0.22) tingir(s, TINTA_DO_MAR, 0.32)
    }
    tingir(s, TINTA, traco(f / passoDaCosta, 0.5 * k))
    // A moldura de tinta, a 1,8 px da beira.
    tingir(s, TINTA, traco(beira - 1.8 * k, 0.32 * k) * 0.85)
    if (f > -0.02) {
      // A rosa dos ventos, no mar.
      const rx = a - mu * 0.62
      const ry = b + mv * 0.55
      const rr = Math.hypot(rx, ry)
      tingir(s, TINTA_DO_MAR, traco(rr - 2.8 * k, 0.28 * k))
      if (rr < 5 * k) tingir(s, TINTA_DO_MAR, Math.max(traco(rx, 0.3 * k), traco(ry, 0.3 * k)) * (1 - rr / (5 * k)) * 1.6)
      return
    }
    // O rio, da serra até o mar, serpenteando.
    const rio = mv * (0.06 + 0.22 * Math.sin(sa * 3.1 + 0.8)) + ruido(a * 0.15 / k, 3) * 2 * k
    const noRio = traco(b - rio, (0.55 + 0.35 * (sa + 1)) * k)
    if (noRio > 0 && sa > -0.78) {
      tingir(s, TINTA_DO_MAR, noRio)
      return
    }
    // A fronteira tracejada em vinho, de cima a baixo.
    const fronteira = mu * (-0.12 + 0.1 * Math.sin(sb * 2.6)) + ruido(b * 0.12 / k, 9) * 3 * k
    const tracejado = Math.sin(b / k * 1.1) > -0.2 ? 1 : 0
    tingir(s, FRONTEIRA, traco(a - fronteira, 0.45 * k) * tracejado)
    // As cidades: um quadradinho de tinta com o ponto no meio.
    for (const [cs, cb] of CIDADES) {
      const dx = Math.abs(a - cs * mu)
      const dy = Math.abs(b - cb * mv)
      if (dx < 2.2 * k && dy < 2.2 * k) {
        tingir(s, TINTA, Math.max(traco(Math.max(dx, dy) - 1.9 * k, 0.3 * k), dx < 0.7 * k && dy < 0.7 * k ? 1 : 0))
        return
      }
    }
    // O bosque em bolinhas e as serras em "^", cada um na sua região.
    const celula = 3.8 * k
    const ci = Math.floor(a / celula)
    const cj = Math.floor(b / celula)
    if (ruido(a * 0.06 / k + 11, b * 0.06 / k + 3) > 0.1 && f < -0.08) {
      const cx = (ci + 0.3 + 0.4 * hash(ci, cj, 61)) * celula
      const cy = (cj + 0.3 + 0.4 * hash(ci, cj, 62)) * celula
      const d = Math.hypot(a - cx, b - cy)
      tingir(s, BOSQUE, traco(d, 1.15 * k) * 0.9)
      return
    }
    if (ruido(a * 0.05 / k + 21, b * 0.05 / k + 7) > 0.14 && f < -0.08) {
      const cel = 6.2 * k
      const mi = Math.floor(a / cel)
      const mj = Math.floor(b / cel)
      const cx = (mi + 0.5) * cel + (hash(mi, mj, 63) - 0.5) * 1.6 * k
      const cy = (mj + 0.5) * cel + (hash(mi, mj, 64) - 0.5) * 1.6 * k
      const d = Math.min(aoSegmento(a, b, cx - 2.3 * k, cy + 1.4 * k, cx, cy - 1.6 * k), aoSegmento(a, b, cx, cy - 1.6 * k, cx + 2.3 * k, cy + 1.4 * k))
      tingir(s, TINTA, traco(d, 0.36 * k))
    }
  }
}

/** As cidades do mapa, em fração das meias medidas (a, b). */
const CIDADES: readonly Ponto[] = [[-0.55, -0.42], [0.08, 0.5], [0.42, 0.62], [-0.3, 0.68]]

/** Os peões de cada exército e os cavaleiros, em fração das meias medidas do mapa. */
const PEOES_VERMELHOS: readonly Ponto[] = [[-0.5, -0.12], [-0.38, 0.12], [-0.6, 0.3], [-0.32, -0.42]]
const PEOES_AZUIS: readonly Ponto[] = [[0.12, -0.05], [0.24, 0.24], [0.06, 0.34]]
const CAVALEIRO_VERMELHO: Ponto = [-0.24, -0.16]
const CAVALEIRO_AZUL: Ponto = [0.36, 0.06]
/** As bandeirinhas: onde o alfinete entra e de quem é. */
const BANDEIRAS: readonly (readonly [number, number, MaterialDaPeca])[] = [[-0.7, -0.58, VERMELHO], [-0.1, 0.56, VERMELHO], [0.46, 0.2, AZUL], [0.08, 0.5, AZUL]]

export const montarMesaDeGuerra: MontarMovel = (c, cena) => {
  const r = reguaDa(c)
  if (!(r.C > 0) || !(r.A > 0)) return
  const P = c.peca
  const L = cena.partes
  const { C, A, casa } = r
  const k = casa / c.g
  montarAMesa(c, cena, r)

  // O mapa: as meias medidas, o giro e o ponto (a, b) do mapa na tela.
  const mu = C - (RECUO_DO_TAMPO + FOLGA_AO_COMPRIDO) * casa
  const mv = A - (RECUO_DO_TAMPO + FOLGA_DE_TRAVES) * casa
  const co = Math.cos(GIRO_DO_MAPA)
  const si = Math.sin(GIRO_DO_MAPA)
  const noMapa = (a: number, b: number): Ponto => r.pt(a * co - b * si, a * si + b * co)
  const formaNoMapa = (pontos: readonly Ponto[]): Forma => poligono(pontos.map(([a, b]) => noMapa(a, b)))
  const sombra = (dist: number, forca = 0.32): OpcoesDaPeca['projeta'] => ({ dist: dist * k, forca, suave: 0.6 * k })

  L.push(P(formaNoMapa([[-mu, -mv], [mu, -mv], [mu, mv], [-mu, mv]]), PERGAMINHO, { bisel: 0.6, contorno: 0.2, semente: 6200, textura: texDoMapa(r, mu, mv, k), projeta: sombra(1, 0.3) }))
  // Os rolos das duas pontas, com o puxador de madeira saindo de cada lado.
  const rolo = RAIO_DO_ROLO * k
  for (const ponta of [-1, 1]) {
    const a = ponta * (mu + rolo * 0.55)
    for (const lado of [-1, 1]) {
      const [x, y] = noMapa(a, lado * (mv + rolo * 0.9))
      L.push(P(elipse(x, y, rolo * 0.62, rolo * 0.62), materialDaPeca(MADEIRA_DO_CABO), { tabua: 0, bisel: rolo * 0.5, contorno: 0.26, semente: 6210 + ponta + lado * 3 }))
    }
    const [ax, ay] = noMapa(a, -mv - rolo * 0.2)
    const [bx, by] = noMapa(a, mv + rolo * 0.2)
    L.push(P(capsula(ax, ay, bx, by, rolo), PERGAMINHO, { bisel: rolo, contorno: 0.24, tom: 0.9, semente: 6220 + ponta, projeta: sombra(1.4, 0.3) }))
  }

  // O compasso de pontas aberto, de latão.
  const [jx, jy] = noMapa(0.3 * mu, 0.62 * mv)
  for (const [pa, pb] of [[0.12, 0.86], [0.5, 0.84]] as const) {
    const [px, py] = noMapa(pa * mu, pb * mv)
    L.push(P(capsula(jx, jy, px, py, 0.55 * k), LATAO, { bisel: 0.5 * k, metal: 0.55, contorno: 0.24, semente: 6230, projeta: sombra(0.7, 0.3) }))
  }
  L.push(P(elipse(jx, jy, 1.3 * k, 1.3 * k), LATAO, { bisel: 1 * k, metal: 0.6, contorno: 0.24, semente: 6232, projeta: sombra(0.8, 0.3) }))

  // Os exércitos: peões (a base e a cabeça) e um cavaleiro de cada lado (a base e o pescoço do cavalo).
  const peao = (a: number, b: number, mat: MaterialDaPeca, semente: number): void => {
    const [x, y] = noMapa(a * mu, b * mv)
    L.push(P(elipse(x, y, 2.5 * k, 2.5 * k), mat, { bisel: 1.1 * k, contorno: 0.28, tom: 0.86, semente, projeta: sombra(1.4, 0.36) }))
    L.push(P(elipse(x - 0.2 * k, y - 0.2 * k, 1.45 * k, 1.45 * k), mat, { bisel: 1.4 * k, contorno: 0.16, tom: 1.12, semente: semente + 1 }))
  }
  const cavaleiro = (a: number, b: number, mat: MaterialDaPeca, lado: number, semente: number): void => {
    const [x, y] = noMapa(a * mu, b * mv)
    L.push(P(elipse(x, y, 2.9 * k, 2.9 * k), mat, { bisel: 1.1 * k, contorno: 0.28, tom: 0.82, semente, projeta: sombra(1.6, 0.36) }))
    const [qx, qy] = r.pt(lado * 1.5 * k, -0.6 * k)
    L.push(P(elipseGirada(x + qx * 0.2, y + qy * 0.2, 2.2 * k, 1.1 * k, r.deitada ? lado * 0.5 : QUARTO + lado * 0.5), mat, { bisel: 1 * k, contorno: 0.2, tom: 1.1, semente: semente + 1 }))
    L.push(P(elipse(x + qx, y + qy, 1.1 * k, 1.1 * k), mat, { bisel: 0.9 * k, contorno: 0.2, tom: 1.18, semente: semente + 2 }))
  }
  PEOES_VERMELHOS.forEach(([a, b], i) => peao(a, b, VERMELHO, 6300 + i * 2))
  PEOES_AZUIS.forEach(([a, b], i) => peao(a, b, AZUL, 6320 + i * 2))
  cavaleiro(...CAVALEIRO_VERMELHO, VERMELHO, 1, 6340)
  cavaleiro(...CAVALEIRO_AZUL, AZUL, -1, 6350)

  // As bandeirinhas: o alfinete e o pano triangular para o lado, mais alto que tudo (a sombra vai mais longe).
  BANDEIRAS.forEach(([a, b, mat], i) => {
    const pa = a * mu
    const pb = b * mv
    L.push(P(formaNoMapa([[pa, pb - 0.4 * k], [pa + 6 * k, pb + 1.3 * k], [pa, pb + 3 * k]]), mat, { bisel: 0.5 * k, contorno: 0.26, tom: 1.04, semente: 6400 + i, projeta: sombra(2.6, 0.34) }))
    const [x, y] = noMapa(pa, pb)
    L.push(P(elipse(x, y, 0.85 * k, 0.85 * k), FERRO, { bisel: 0.6 * k, metal: 0.5, contorno: 0.2, semente: 6410 + i, projeta: sombra(2.4, 0.3) }))
  })

  // A adaga prendendo o canto de baixo à esquerda: a lâmina, a guarda, o cabo e o pomo.
  adaga(c, L, noMapa, -mu + 15 * k, mv - 9 * k, k, sombra)
}

/** A direção da adaga no mapa, da ponta para o pomo: para baixo à esquerda (a ponta aponta para o meio do mapa). */
const RUMO_DA_ADAGA: Ponto = [-0.82, 0.57]

/** A adaga deitada em diagonal, da ponta (no mapa, apontando para o meio) ao pomo (no canto, fora do papel). */
function adaga(c: ContextoDoMovel, L: Peca[], noMapa: (a: number, b: number) => Ponto, a0: number, b0: number, k: number, sombra: (dist: number, forca?: number) => OpcoesDaPeca['projeta']): void {
  const P = c.peca
  const [ra, rb] = RUMO_DA_ADAGA
  /** O ponto a `t` px da ponta ao longo da adaga e `n` px para o lado. */
  const em = (t: number, n: number): Ponto => noMapa(a0 + (ra * t - rb * n) * k, b0 + (rb * t + ra * n) * k)
  L.push(P(poligono([em(0, 0), em(11, -1.5), em(11, 1.5)]), ACO, { bisel: 0.9 * k, metal: 0.7, contorno: 0.26, semente: 6500, projeta: sombra(0.8, 0.32) }))
  L.push(P(capsula(...em(10.8, -3.4), ...em(10.8, 3.4), 0.75 * k), LATAO, { bisel: 0.6 * k, metal: 0.55, contorno: 0.26, semente: 6501, projeta: sombra(1, 0.32) }))
  L.push(P(capsula(...em(11.6, 0), ...em(16, 0), 1.05 * k), materialDaPeca(MADEIRA_DO_CABO), { tabua: 0, bisel: 0.9 * k, contorno: 0.26, semente: 6502, projeta: sombra(1, 0.32) }))
  L.push(P(elipse(...em(16.9, 0), 1.35 * k, 1.35 * k), LATAO, { bisel: 1.1 * k, metal: 0.6, contorno: 0.26, semente: 6503, projeta: sombra(1, 0.32) }))
}
