/**
 * A TENDA DE CIRCO (lote L19 de 14/11/2026, item 106 da lista do dia; construção do parque que não barra: entra-se
 * nela). A lona comprida de dois mastros, em listras da cor do `pano` e creme: as pontas são meias-luas, o meio é
 * reto, e as listras descem do cume ao beiral e continuam na parede. Em volta, a sanefa recortada, os paus da beira
 * com as cordas e as estacas; no alto, os dois mastros com as flâmulas e o varal de bandeirinhas entre eles; ao sul,
 * a entrada: o toldo de duas águas com a boca escura, as cortinas presas e a estrela de latão na empena.
 *
 * O que separa da tenda de adivinha (redonda, de um mastro, roxa): a planta comprida de dois cumes, as listras que
 * atravessam o beiral e a parede, os paus da beira e a entrada de toldo. De cima, a lona vista do alto; na 3/4 (as
 * duas vistas de `duasVistasDoParque.ts`), a parede listrada e o telhado de frente. A pegada esticada de pé (mais
 * alta que larga) deita a tenda ao comprido na vertical, com a entrada na ponta do sul.
 *
 * Materiais: `pano` (as listras de cor, as cortinas e a empena) e `madeira` (os mastros, os paus e as estacas).
 */
import { rgb } from '../../ruido'
import { capsula, cadeia, caixa, elipse, poligono, type Ponto } from './formas'
import { TOM_DA_CORDA, type MaterialDaPeca } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { novoPalco, sanefa, type OpcoesDaVista, type P3, type Palco } from './duasVistasDoParque'

// ---------- os materiais fixos ----------

const CREME: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: rgb('#ddd2bb') }
const LATAO = materialDaPeca('latao')
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const DENTRO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2c, 0x28] }
const OCRE: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xb8, 0x92, 0x4e] }
const ANIL: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x4c, 0x5c, 0x84] }
const TAPETE: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x84, 0x44, 0x3e] }

// ---------- as medidas (px do protótipo numa tenda de 4 casas de fundo; crescem com o lado curto) ----------

/** A meia pegada curta de partida (4 casas): `k` = 1 nela. */
const LADO_DE_PARTIDA = 112
/** O beiral: a meia largura (fração da meia pegada curta) e o meio comprimento (fração da meia pegada comprida). */
const BEIRAL_CURTO = 0.78
const BEIRAL_COMPRIDO = 0.86
/** A parede fica isto para dentro do beiral (px). */
const RECUO_DA_PAREDE = 1.6
/** As alturas, em casas (numa tenda de 4 de fundo): o beiral, o cume nos mastros, quanto o cume cede entre eles e a ponta dos mastros. */
const ALTURA_DO_BEIRAL = 0.62
const ALTURA_DO_CUME = 1.85
const CEDE_NO_MEIO = 0.12
const PONTA_DO_MASTRO = 0.8
/** As listras: quantas em cada meia-lua das pontas (as do meio reto saem da mesma largura no beiral). */
const LISTRAS_DA_PONTA = 10
/** A sanefa (px). */
const FAIXA_DA_SANEFA = 4.6
const BICO_DA_SANEFA = 3
/** Os paus da beira: a cada quantas emendas de listra, o raio, quanto passam acima do beiral e a estaca. */
const PAU_A_CADA = 2
const RAIO_DO_PAU = 1.05
const PAU_ACIMA = 3
const RAIO_DA_ESTACA = 1.1
const ALTURA_DA_ESTACA = 3.6
const RAIO_DA_CORDA = 0.5
/** As estacas ficam a esta fração da meia pegada (a corda vai do alto do pau até elas). */
const ESTACA_NA_PEGADA = 0.965
/** A entrada: a meia largura, a altura do beiral e do cume do toldo acima do beiral da tenda, e quanto ele sai (casas). */
const MEIA_ENTRADA = 0.34
const BEIRAL_DA_ENTRADA = 0.6
const CUME_DA_ENTRADA = 0.36
const FUNDO_DA_ENTRADA = 0.68
/** A boca é esta fração da largura da entrada; as cortinas presas sobem até esta fração da altura. */
const BOCA = 0.78
const AMARRA = 0.5
/** As bandeirinhas do varal entre os mastros: quantas, quanto o varal cede e o tamanho de cada uma (px). */
const BANDEIRINHAS = 7
const CEDE_O_VARAL = 6
const BANDEIRINHA = 3.2
/** A tenda vai depois do que está atrás dela; a entrada e os paus da beira, depois da sanefa. */
const DEPOIS_DA_SANEFA = 30
const DEPOIS_DE_TUDO = 1e4

const OPCOES_DO_PANO: OpcoesDaVista = { tabua: 0, bisel: 1.1, contorno: 0.24, ruga: 0.3 }
const OPCOES_DA_CORDA: OpcoesDaVista = { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9 }

interface Medidas {
  readonly k: number
  readonly g: number
  readonly deitado: boolean
  /** Meia pegada comprida e curta. */
  readonly a: number
  readonly b: number
  /** O beiral: meio comprimento, meia largura e meio comprimento do trecho reto (onde ficam os mastros). */
  readonly eu: number
  readonly ev: number
  readonly cu: number
  readonly ze: number
  readonly cume: number
  readonly mastro: number
}

function medir(c: ContextoDoMovel): Medidas {
  const deitado = c.hw >= c.hh
  const a = deitado ? c.hw : c.hh
  const b = deitado ? c.hh : c.hw
  const k = b / LADO_DE_PARTIDA
  const g = G * k
  const ev = BEIRAL_CURTO * b
  const eu = Math.max(ev, BEIRAL_COMPRIDO * a)
  return { k, g, deitado, a, b, eu, ev, cu: eu - ev, ze: ALTURA_DO_BEIRAL * g, cume: ALTURA_DO_CUME * g, mastro: PONTA_DO_MASTRO * g }
}

/** Do referencial da tenda (u ao comprido, v de través) para o do objeto. */
function noObjeto(m: Medidas, u: number, v: number, z: number): P3 {
  return m.deitado ? [u, v, z] : [v, u, z]
}

/** A altura do cume no trecho reto: cede no meio entre os mastros. */
function cumeEm(m: Medidas, u: number): number {
  if (m.cu <= 0) return m.cume
  const t = u / m.cu
  return m.cume - CEDE_NO_MEIO * m.g * (1 - t * t)
}

/** Um pedaço da volta da tenda: as duas pontas no beiral (u, v), a direção de fora e o alto de onde a listra desce. */
interface Pedaco {
  readonly p0: Ponto
  readonly p1: Ponto
  /** O alto da listra: o mastro (ponta) ou o cume sobre cada ponta (meio reto). */
  readonly alto0: P3
  readonly alto1: P3
  readonly ponta: boolean
}

/** A volta do beiral em pedaços, com raio `r` de través: a meia-lua de leste, o lado do sul, a de oeste e o do norte. */
function volta(m: Medidas, r: number): Pedaco[] {
  const passo = Math.PI / LISTRAS_DA_PONTA
  const listrasDoMeio = m.cu > 0 ? Math.max(1, Math.round((2 * m.cu) / (passo * m.ev))) : 0
  const lista: Pedaco[] = []
  const meiaLua = (cx: number, de: number): void => {
    const alto: P3 = [cx, 0, m.cume]
    for (let i = 0; i < LISTRAS_DA_PONTA; i += 1) {
      const a0 = de + i * passo
      const a1 = a0 + passo
      lista.push({ p0: [cx + r * Math.cos(a0), r * Math.sin(a0)], p1: [cx + r * Math.cos(a1), r * Math.sin(a1)], alto0: alto, alto1: alto, ponta: true })
    }
  }
  const reto = (v: number, de: number, ate: number): void => {
    for (let i = 0; i < listrasDoMeio; i += 1) {
      const u0 = de + ((ate - de) * i) / listrasDoMeio
      const u1 = de + ((ate - de) * (i + 1)) / listrasDoMeio
      lista.push({ p0: [u0, v], p1: [u1, v], alto0: [u0, 0, cumeEm(m, u0)], alto1: [u1, 0, cumeEm(m, u1)], ponta: false })
    }
  }
  meiaLua(m.cu, -Math.PI / 2)
  reto(r, m.cu, -m.cu)
  meiaLua(-m.cu, Math.PI / 2)
  reto(-r, -m.cu, m.cu)
  return lista
}

// ---------- a tenda ----------

/** A lona: as listras do cume ao beiral e a parede listrada do beiral ao chão, a mesma cor embaixo de cada listra. */
function lona(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const beiral = volta(m, m.ev)
  const parede = volta(m, m.ev - RECUO_DA_PAREDE * m.k)
  const dentro: P3 = [0, 0, m.ze / 2]
  beiral.forEach((p, i) => {
    const cor = i % 2 === 0 ? c.m.pano : CREME
    const o = { ...OPCOES_DO_PANO, eixo: QUARTO, semente: 100 + i }
    const w = parede[i]
    palco.face([noObjeto(m, w.p0[0], w.p0[1], 0), noObjeto(m, w.p1[0], w.p1[1], 0), noObjeto(m, w.p1[0], w.p1[1], m.ze), noObjeto(m, w.p0[0], w.p0[1], m.ze)], cor, o, { dentro })
    const meio: Ponto = [(p.p0[0] + p.p1[0]) / 2, (p.p0[1] + p.p1[1]) / 2]
    const rumo = Math.atan2(meio[1] - p.alto0[1], meio[0] - p.alto0[0])
    const eixo = m.deitado ? rumo : Math.PI / 2 - rumo
    const pontos: P3[] = p.ponta
      ? [noObjeto(m, ...p.alto0), noObjeto(m, p.p0[0], p.p0[1], m.ze), noObjeto(m, p.p1[0], p.p1[1], m.ze)]
      : [noObjeto(m, ...p.alto0), noObjeto(m, ...p.alto1), noObjeto(m, p.p1[0], p.p1[1], m.ze), noObjeto(m, p.p0[0], p.p0[1], m.ze)]
    palco.face(pontos, cor, { ...OPCOES_DO_PANO, eixo, semente: 200 + i })
  })
  // A sanefa, com as cores trocadas (o bico creme embaixo da listra de cor), e a corda do beiral de cima.
  const contorno = beiral.map((p): Ponto => {
    const [x, y] = noObjeto(m, p.p0[0] * 1.004, p.p0[1] * 1.004, 0)
    return [x, y]
  })
  sanefa(palco, contorno, m.ze, FAIXA_DA_SANEFA * m.k, BICO_DA_SANEFA * m.k, [CREME, c.m.pano], { ...OPCOES_DO_PANO, eixo: QUARTO }, [0, 0, m.ze])
  palco.deCima(cadeia([...contorno, contorno[0]], 0.8 * m.k), OCRE, { tabua: 0, bisel: 0.5, contorno: 0.22, tom: 0.95 }, m.cume + 1)
}

/** Os paus da beira, cada um com a corda até a estaca na beira da pegada. */
function paus(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const r = m.ev + 1.6 * k
  const beiral = volta(m, r)
  const alto = m.ze + PAU_ACIMA * k
  beiral.forEach((p, i) => {
    if (i % PAU_A_CADA !== 0) return
    const [pu, pv] = p.p0
    // Para fora: de través no meio reto; do mastro para fora nas meias-luas.
    const cx = p.ponta ? Math.sign(pu) * m.cu : pu
    const du = pu - cx
    const dv = pv
    const l = Math.hypot(du, dv) || 1
    const fora = Math.min((ESTACA_NA_PEGADA * m.a - Math.abs(pu)) / Math.max(1e-6, Math.abs(du / l)), (ESTACA_NA_PEGADA * m.b - Math.abs(pv)) / Math.max(1e-6, Math.abs(dv / l)))
    const [ex, ey] = [pu + (du / l) * fora, pv + (dv / l) * fora]
    const pe = noObjeto(m, pu, pv, 0)
    const estaca = noObjeto(m, ex, ey, 0)
    const madeira = { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 300 + i }
    palco.costado(pe[0], pe[1], RAIO_DO_PAU * k, 0, alto, c.m.madeira, madeira, { adiante: DEPOIS_DA_SANEFA })
    palco.deCima(elipse(pe[0], pe[1], RAIO_DO_PAU * k * 1.3, RAIO_DO_PAU * k * 1.3), c.m.madeira, madeira, alto)
    const [ax, ay] = palco.naTela([pe[0], pe[1], alto - 0.6 * k])
    const [bx, by] = palco.naTela([estaca[0], estaca[1], ALTURA_DA_ESTACA * k * 0.8])
    palco.deFrente(capsula(ax, ay, bx, by, RAIO_DA_CORDA * k), CORDA, OPCOES_DA_CORDA, (ay + by) / 2 + alto + DEPOIS_DA_SANEFA)
    palco.deCima(capsula(pe[0], pe[1], estaca[0], estaca[1], RAIO_DA_CORDA * k), CORDA, OPCOES_DA_CORDA, alto - 0.1)
    palco.costado(estaca[0], estaca[1], RAIO_DA_ESTACA * k, 0, ALTURA_DA_ESTACA * k, c.m.madeira, madeira, { adiante: DEPOIS_DA_SANEFA })
    palco.deCima(elipse(estaca[0], estaca[1], RAIO_DA_ESTACA * k, RAIO_DA_ESTACA * k), c.m.madeira, madeira, ALTURA_DA_ESTACA * k)
  })
}

/** A estrela de cinco pontas, de pé (o miolo a esta fração do raio). */
function estrela(cx: number, cy: number, r: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const raio = i % 2 === 0 ? r : r * 0.45
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio])
  }
  return pontos
}

/**
 * A entrada, ao sul do objeto: o toldo de duas águas listrado que sai da parede, a empena com a estrela, a boca
 * escura, as cortinas presas dos lados, os dois paus da frente e o tapete no chão. O palco gira tudo com o objeto
 * (de lado, a empena e a boca ficam de quina; de costas, atrás da tenda).
 */
function entrada(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const g = m.g
  const w = MEIA_ENTRADA * g
  const y0 = (m.deitado ? m.ev : m.eu) - RECUO_DA_PAREDE * k - 3 * k
  const yf = Math.min(y0 + FUNDO_DA_ENTRADA * g, (m.deitado ? m.b : m.a) * ESTACA_NA_PEGADA - 2 * k)
  const ze = BEIRAL_DA_ENTRADA * g
  const zc = m.ze + CUME_DA_ENTRADA * g
  const a = { adiante: DEPOIS_DA_SANEFA + 10 }
  // As duas águas, em três listras cada, do cume ao beiral.
  const listras = 3
  for (const lado of [-1, 1]) {
    for (let j = 0; j < listras; j += 1) {
      const ya = y0 + ((yf - y0) * j) / listras
      const yb = y0 + ((yf - y0) * (j + 1)) / listras
      palco.face([[lado * w, ya, ze], [0, ya, zc], [0, yb, zc], [lado * w, yb, ze]], (j + (lado > 0 ? 1 : 0)) % 2 === 0 ? c.m.pano : CREME, { ...OPCOES_DO_PANO, eixo: QUARTO, semente: 400 + j + lado }, { dentro: [0, (y0 + yf) / 2, 0], ...a })
    }
  }
  // A frente: a boca escura, as cortinas presas, a empena com a estrela e os paus.
  const dentro: P3 = [0, y0, ze / 2]
  palco.face([[-w * BOCA, yf, 0], [w * BOCA, yf, 0], [w * BOCA, yf, ze], [-w * BOCA, yf, ze]], DENTRO, { tabua: 0, bisel: 0.4, contorno: 0.3 }, { dentro, luz: 0, ...a })
  for (const lado of [-1, 1]) {
    palco.face(
      [[lado * w, yf, 0], [lado * w * 0.72, yf, 0], [lado * w * 0.5, yf, ze * AMARRA], [lado * w * 0.72, yf, ze], [lado * w, yf, ze]],
      c.m.pano,
      { ...OPCOES_DO_PANO, eixo: QUARTO, tom: 1.06, semente: 410 + lado },
      { dentro, adiante: a.adiante + 1 },
    )
  }
  palco.face([[-w * 1.06, yf, ze], [0, yf, zc + 0.6 * k], [w * 1.06, yf, ze]], CREME, { ...OPCOES_DO_PANO, eixo: QUARTO, semente: 420 }, { dentro, adiante: a.adiante + 1 })
  const [sx, sy] = palco.naTela([0, yf, ze + (zc - ze) * 0.36])
  if (palco.q === 0) palco.deFrente(poligono(estrela(sx, sy, 3.2 * k)), LATAO, { tabua: 0, bisel: 0.7, contorno: 0.26, metal: 0.5 }, yf + zc + a.adiante + 3)
  for (const lado of [-1, 1]) palco.costado(lado * w, yf, 1.1 * k, 0, ze + 1.2 * k, c.m.madeira, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9 }, { adiante: a.adiante + 2 })
  // O tapete da entrada, no chão (de cima ele espia por baixo do toldo).
  const fim = (m.deitado ? m.b : m.a) * 0.995
  if (fim - y0 > 4 * k) palco.plano(caixa(-w * 0.55, y0, w * 0.55, fim, 0.6), 0.3, TAPETE, { tabua: 0, bisel: 0.5, contorno: 0.2, eixo: QUARTO, semente: 430 }, { adiante: -DEPOIS_DE_TUDO })
}

/** Os mastros: a vara acima da lona, a bola, a flâmula, e o varal de bandeirinhas de um ao outro. */
function mastros(palco: Palco, c: ContextoDoMovel, m: Medidas): void {
  const k = m.k
  const topo = m.cume + m.mastro
  const pontas = m.cu > 2 * k ? [-m.cu, m.cu] : [0]
  const madeira = { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.92 }
  pontas.forEach((u, i) => {
    const [x, y] = noObjeto(m, u, 0, 0)
    palco.costado(x, y, 1.5 * k, m.cume - 6 * k, topo, c.m.madeira, { ...madeira, semente: 500 + i }, { adiante: DEPOIS_DE_TUDO })
    palco.plano(elipse(x, y, 2.4 * k, 2.4 * k), topo, LATAO, { bisel: 1.2 * k, contorno: 0.28, metal: 0.6 }, { acima: 2, adiante: DEPOIS_DE_TUDO + 2 })
    const flamula = i % 2 === 0 ? c.m.pano : ANIL
    const [bx, by] = palco.naTela([x, y, topo - 3 * k])
    palco.deFrente(poligono([[bx + 1.2 * k, by - 3 * k], [bx + 9 * k, by - 1.2 * k], [bx + 17 * k, by + 0.6 * k], [bx + 9 * k, by + 1.8 * k], [bx + 1.2 * k, by + 3 * k]]), flamula, { tabua: 0, bisel: 0.6, contorno: 0.26, tom: 0.95 }, DEPOIS_DE_TUDO + 3)
    palco.deCima(poligono([[x + 2 * k, y - 1.3 * k], [x + 10 * k, y - 0.5 * k], [x + 18 * k, y + 0.7 * k], [x + 10 * k, y + 1.4 * k], [x + 2 * k, y + 1.3 * k]]), flamula, { tabua: 0, bisel: 0.5, contorno: 0.25 }, topo + 1)
  })
  if (pontas.length < 2) return
  // O varal de bandeirinhas de um mastro ao outro, cedendo no meio: na 3/4 de pé, de cima deitado ao longo do cume.
  const zVaral = topo - 4 * k
  const n = BANDEIRINHAS + 1
  const fio: Ponto[] = []
  const fioDeCima: Ponto[] = []
  for (let j = 0; j <= n; j += 1) {
    const u = -m.cu + (2 * m.cu * j) / n
    const cede = CEDE_O_VARAL * k * (1 - Math.pow((2 * j) / n - 1, 2))
    const p = noObjeto(m, u, 0, zVaral - cede)
    fio.push(palco.naTela(p))
    fioDeCima.push([p[0], p[1]])
  }
  palco.deFrente(cadeia(fio, 0.35 * k), CORDA, OPCOES_DA_CORDA, DEPOIS_DE_TUDO + 4)
  palco.deCima(cadeia(fioDeCima, 0.35 * k), CORDA, OPCOES_DA_CORDA, topo)
  const cores = [OCRE, CREME, c.m.pano]
  for (let j = 1; j < n; j += 1) {
    const [fx, fy] = fio[j]
    const [tx, ty] = fioDeCima[j]
    const cor = cores[j % cores.length]
    const b = BANDEIRINHA * k
    palco.deFrente(poligono([[fx - b * 0.7, fy], [fx + b * 0.7, fy], [fx, fy + b * 1.4]]), cor, { tabua: 0, bisel: 0.4, contorno: 0.24 }, DEPOIS_DE_TUDO + 5)
    palco.deCima(poligono([[tx - b * 0.7, ty - b * 0.5], [tx + b * 0.7, ty - b * 0.5], [tx, ty + b * 0.9]]), cor, { tabua: 0, bisel: 0.4, contorno: 0.24 }, topo + 0.5)
  }
}

export const montarTendaDeCirco: MontarMovel = (c, cena) => {
  const m = medir(c)
  const palco = novoPalco(c.peca, cena, c.giro)
  // A sombra no chão: a parede no pé, o beiral e a ponta dos mastros, caídos pela altura; e o contato da parede.
  const pontos: P3[] = []
  for (const p of volta(m, m.ev)) pontos.push(noObjeto(m, p.p0[0], p.p0[1], m.ze), noObjeto(m, p.p0[0], p.p0[1], 0))
  for (const u of [-m.cu, m.cu]) pontos.push(noObjeto(m, u, 0, m.cume + m.mastro))
  palco.sombra(pontos, 0.3, 2.8)
  const pe = volta(m, m.ev - RECUO_DA_PAREDE * m.k).map((p): Ponto => {
    const [x, y] = noObjeto(m, p.p0[0], p.p0[1], 0)
    return [x, y]
  })
  palco.contato(poligono(pe), 0.34)
  paus(palco, c, m)
  lona(palco, c, m)
  entrada(palco, c, m)
  mastros(palco, c, m)
  palco.fechar()
}
