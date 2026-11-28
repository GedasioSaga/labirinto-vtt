/**
 * IGLU (lote L08 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Neve; construção
 * nova). A casa de BLOCOS DE NEVE: a cúpula em fiadas que sobem em espiral, cada fiada com os blocos desencontrados da
 * de baixo e menores para o alto, o bloco do fecho com o RESPIRO no topo, o TÚNEL de entrada para a frente (o sul, no
 * giro 0), em abóbada baixa de blocos, com a boca escura em arco, e a saia de neve socada em volta do pé.
 *
 * De cima o iglu lê pelas juntas: os anéis de blocos encolhendo até o fecho, com a luz de cima à esquerda e o azul da
 * neve do lado da sombra; o túnel sai da cúpula como uma língua de blocos. Na porta, o chão pisado e um bafo de luz
 * quente da lamparina de dentro (a luz de verdade fica com o integrador: `LUZ_DOS_OBJETOS`, sugestão no relatório).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): a cúpula e o túnel são cortes por altura, e as juntas e
 * a luz de cada fatia saem do ponto da superfície em cima dela. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 * Versões: INTEIRO (este desenho, `montarIglu`) e EM RUÍNA (`montarIgluEmRuina`, registrado em
 * `versoes/igluVersoes.ts`): a cúpula caída do lado da frente à direita, só a parede de trás de pé em degraus de
 * blocos, os blocos tombados dentro e fora, o chão de dentro à mostra (a mancha da fogueira apagada e a pele velha) e o
 * túnel sem teto. Sem lugar de material: a neve, a fuligem e a pele são fixas. Barra a passagem e tapa a visão.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, type Fatiador } from './pilhaDeFatias'
import { disco, lisa, sombraVarrida } from './apoioDasReferencias'
import { misturarCor, retanguloGirado, suave } from './muroEmRuina'
import { NEVE, pintarNeve, texDaNeveDeitada, TOM_DA_NEVE_NA_SOMBRA } from './bonecoDeNeve'

/** A cúpula: o raio (fração do menor meio lado), a altura (fração do raio) e o meio, um nada para trás. */
const RAIO_DA_CUPULA = 0.7
const ALTURA_DA_CUPULA = 0.9
const RECUO_DA_CUPULA = 0.12
/** As fiadas da cúpula (o fecho é a última) e o comprimento de partida de um bloco (px). */
const FIADAS = 7
const BLOCO = 19
/** A meia junta entre os blocos (px) e o chanfro escuro da beira de cada bloco (px). */
const MEIA_JUNTA = 0.45
const BEIRA_DO_BLOCO = 2.2
/** O respiro do fecho (px de raio). */
const RESPIRO = 3
/** O túnel: meia largura e altura (frações do menor meio lado) e até onde ele vai além da cúpula. */
const MEIA_LARGURA_DO_TUNEL = 0.18
const ALTURA_DO_TUNEL = 0.27
const ALEM_DA_CUPULA = 0.3
/** As fiadas da abóbada do túnel, de cada lado, e o comprimento dos blocos dela (px). */
const FIADAS_DO_TUNEL = 3
const BLOCO_DO_TUNEL = 12
/** A boca: meia largura e altura do vão, em fração da abóbada. */
const BOCA = { meia: 0.6, alto: 0.78 } as const
/** O passo das fatias (px). */
const PASSO = 1.2

/** A junta: a neve socada mais funda, azul-acinzentada. */
const COR_DA_JUNTA: Rgb = [0x8a, 0x99, 0xab]
/** O escuro de dentro (a boca, o respiro): quente, da lamparina acesa lá dentro. */
const ESCURO_DE_DENTRO: Rgb = [0x4a, 0x3c, 0x33]
/** O bafo de luz da lamparina no chão da porta. */
const BAFO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xae, 0x7a] }
/** O escuro em que o pixel escuro demais é levantado: o da boca. */
const ESCURO_DO_IGLU: Rgb = [0x48, 0x40, 0x3b]

interface Cupula {
  readonly cx: number
  readonly cy: number
  readonly r: number
  readonly h: number
}

interface Tunel {
  readonly meia: number
  readonly alto: number
  readonly y0: number
  readonly y1: number
}

function medidas(hw: number, hh: number): { cupula: Cupula; tunel: Tunel } {
  const m = Math.min(hw, hh)
  const r = m * RAIO_DA_CUPULA
  const cupula: Cupula = { cx: 0, cy: -m * RECUO_DA_CUPULA, r, h: r * ALTURA_DA_CUPULA }
  const tunel: Tunel = { meia: m * MEIA_LARGURA_DO_TUNEL, alto: m * ALTURA_DO_TUNEL, y0: cupula.cy + r * 0.55, y1: cupula.cy + r + m * ALEM_DA_CUPULA }
  return { cupula, tunel }
}

/** Quantos blocos tem a fiada `k` da cúpula (no meio dela, pela volta) e quanto ela gira (a espiral e o desencontro). */
function blocosDaFiada(c: Cupula, k: number): number {
  const e = ((k + 0.5) / FIADAS) * (Math.PI / 2)
  return Math.max(3, Math.round((2 * Math.PI * c.r * Math.cos(e)) / BLOCO))
}

function giroDaFiada(k: number): number {
  return k * 0.5 + 0.18 * k * k + hash(k, 1, 6601) * 0.3
}

/**
 * Pinta a junta e o bloco no ponto da cúpula de elevação `e` e rumo `a`: a junta azul, o chanfro escuro na beira de
 * cada bloco e o tom de cada bloco. Devolve a fiada (o fecho é a última).
 */
function blocoDaCupula(s: Float32Array, c: Cupula, e: number, a: number, raioAqui: number): number {
  const u = (e / (Math.PI / 2)) * FIADAS
  const k = Math.min(FIADAS - 1, Math.floor(u))
  const altoDaFiada = (Math.PI / 2 / FIADAS) * (c.r + c.h) * 0.5
  let junta = Math.min(u - k, k + 1 - u) * altoDaFiada
  let j = 0
  if (k < FIADAS - 1) {
    const n = blocosDaFiada(c, k)
    const ua = ((a / (2 * Math.PI) + giroDaFiada(k) / n) * n) % n
    const uu = ua < 0 ? ua + n : ua
    j = Math.floor(uu)
    const fa = uu - j
    junta = Math.min(junta, Math.min(fa, 1 - fa) * ((2 * Math.PI * raioAqui) / n))
  } else junta = (1 - u + k) * altoDaFiada
  s[3] += 0.06 * (hash(j, k, 6602) - 0.5) - 0.09 * suave(BEIRA_DO_BLOCO, MEIA_JUNTA, junta)
  misturarCor(s, COR_DA_JUNTA, 0.8 * suave(MEIA_JUNTA + 0.5, MEIA_JUNTA - 0.2, junta))
  return k
}

/** A cúpula inteira em fatias, com o respiro no fecho. */
function cupulaEmFatias(f: Fatiador, c: Cupula): void {
  const q = f.q
  for (const z of alturas(0, c.h, PASSO)) {
    const t = z / c.h
    const r = c.r * Math.sqrt(Math.max(0, 1 - t * t))
    if (r < 0.5) continue
    const tex: Textura = (_u, _v, x, y, _p, s) => {
      const dx = x - c.cx
      const dy = y - c.cy
      const d = Math.hypot(dx, dy)
      const zs = c.h * Math.sqrt(Math.max(0, 1 - (d * d) / (c.r * c.r)))
      const gx = dx / (c.r * c.r)
      const gy = dy / (c.r * c.r)
      const gz = zs / (c.h * c.h)
      const n = Math.hypot(gx, gy, gz) || 1
      pintarNeve(s, x, y + z, gx / n, gy / n, gz / n, q)
      const k = blocoDaCupula(s, c, Math.atan2(zs / c.h, d / c.r), Math.atan2(dx, dy), d)
      if (k === FIADAS - 1 && d < RESPIRO + 1) {
        misturarCor(s, ESCURO_DE_DENTRO, 0.9 * suave(RESPIRO + 0.6, RESPIRO - 0.4, d))
        s[3] -= 0.08 * suave(RESPIRO + 0.6, RESPIRO - 0.4, d)
      }
    }
    f.fatia(0, z, disco(c.cx, c.cy, r), NEVE, lisa(1, tex, 6610))
  }
}

/** A abóbada do túnel em fatias, com os blocos em fiadas ao comprido e a boca escura em arco na frente. */
function tunelEmFatias(f: Fatiador, t: Tunel, aberto: boolean): void {
  const q = f.q
  for (const z of alturas(0, t.alto, PASSO)) {
    const tz = z / t.alto
    const w = t.meia * Math.sqrt(Math.max(0, 1 - tz * tz))
    if (w < 0.6) continue
    const tex: Textura = (_u, _v, x, y, _p, s) => {
      const ax = Math.abs(x)
      const zs = t.alto * Math.sqrt(Math.max(0, 1 - (ax * ax) / (t.meia * t.meia)))
      const gx = x / (t.meia * t.meia)
      const gz = zs / (t.alto * t.alto)
      // A face da frente (a boca) olha para o sul; o resto é o cano deitado da abóbada.
      const naFrente = t.y1 - y < 1.6
      const n = Math.hypot(gx, gz) || 1
      pintarNeve(s, x, y + z, naFrente ? 0 : gx / n, naFrente ? 1 : 0, naFrente ? 0.15 : gz / n, q)
      // As fiadas da abóbada pelo ângulo do corte, e os blocos ao comprido, desencontrados de uma fiada à outra.
      const e = Math.atan2(zs / t.alto, ax / t.meia)
      const u = (e / (Math.PI / 2)) * FIADAS_DO_TUNEL
      const k = Math.min(FIADAS_DO_TUNEL - 1, Math.floor(u))
      const altoDaFiada = ((Math.PI / 2) / FIADAS_DO_TUNEL) * (t.meia + t.alto) * 0.5
      const ao = (y - t.y0 + (k % 2) * BLOCO_DO_TUNEL * 0.5 + (x < 0 ? 3.7 : 0)) / BLOCO_DO_TUNEL
      const fa = ao - Math.floor(ao)
      const junta = Math.min(Math.min(u - k, k + 1 - u) * altoDaFiada, Math.min(fa, 1 - fa) * BLOCO_DO_TUNEL)
      s[3] += 0.06 * (hash(Math.floor(ao), k + (x < 0 ? 7 : 0), 6620) - 0.5) - 0.09 * suave(BEIRA_DO_BLOCO, MEIA_JUNTA, junta)
      misturarCor(s, COR_DA_JUNTA, 0.8 * suave(MEIA_JUNTA + 0.5, MEIA_JUNTA - 0.2, junta))
      if (naFrente && aberto && ax < t.meia * BOCA.meia * Math.sqrt(Math.max(0, 1 - (z / (t.alto * BOCA.alto)) ** 2))) {
        misturarCor(s, ESCURO_DE_DENTRO, 0.92)
        s[3] -= 0.1
      }
      // O pé da abóbada, junto do chão, um nada mais escuro (a neve socada rente ao chão).
      s[3] -= 0.05 * suave(3, 0, z)
    }
    f.fatia(0, z, caixa(-w, t.y0, w, t.y1, Math.min(w, 1.5)), NEVE, lisa(1, tex, 6630))
  }
}

/** A saia de neve socada em volta do pé (rente ao chão, por baixo de tudo): o contorno macio e torto. */
function saia(f: Fatiador, c: Cupula, t: Tunel, semente: number): void {
  const pontos: Ponto[] = []
  const n = 40
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const r = c.r + 5 + 3.2 * (ruido(Math.cos(a) * 2.3 + semente, Math.sin(a) * 2.3 + 4.1) + 0.5)
    pontos.push([c.cx + Math.sin(a) * r, c.cy + Math.cos(a) * r])
  }
  const tunel = caixa(-t.meia - 4, t.y0, t.meia + 4, t.y1 + 2.5, 4)
  f.fatia(0, 0.05, uniao(poligono(pontos), tunel), NEVE, lisa(0.97, texDaNeveDeitada(f.q, 3.5), 6640))
}

/** A boca acesa: o chão pisado na frente da porta e o bafo de luz quente da lamparina, rentes ao chão. */
function portaAcesa(f: Fatiador, t: Tunel): void {
  const pisado: Forma = elipse(0, t.y1 + 3, t.meia * 0.95, 5.5)
  const daPisada: Textura = (_u, _v, x, y, _p, s) => {
    misturarCor(s, TOM_DA_NEVE_NA_SOMBRA, 0.22 + 0.18 * (ruido(x * 0.5 + 3, y * 0.5 + 9) + 0.5))
  }
  f.fatia(0, 0.08, pisado, NEVE, lisa(0.96, daPisada, 6641))
  f.fatia(0, 0.09, elipse(0, t.y1 + 2.4, t.meia * 0.62, 4.2), BAFO, { ...lisa(1, undefined, 6642), alfa: 0.22, suave: 2.4 })
}

/** A sombra da cúpula no chão: o pé dela varrido até a sombra de duas alturas, em anéis que encolhem com a altura. */
function sombraDaCupula(cena: Cena, c: Cupula, q: number): void {
  for (const t of [0.35, 0.7]) {
    const r = c.r * Math.sqrt(1 - t * t)
    cena.sombras.push(sombraVarrida(c.cx - r, c.cy - r, c.cx + r, c.cy + r, c.h * t, q, 0.16, 6))
  }
}

/** O INTEIRO: a cúpula fechada, o túnel com a boca acesa, a saia de neve e o respiro. */
export const montarIglu: MontarMovel = (c, cena) => {
  const f = novoFatiador(c.peca, cena, c.giro)
  cena.corDoPiso = ESCURO_DO_IGLU
  const { cupula, tunel } = medidas(c.hw, c.hh)
  saia(f, cupula, tunel, 3.3)
  portaAcesa(f, tunel)
  cupulaEmFatias(f, cupula)
  tunelEmFatias(f, tunel, true)
  f.fechar()
  sombraDaCupula(cena, cupula, f.q)
  cena.sombras.push(
    sombraVarrida(-tunel.meia, tunel.y0, tunel.meia, tunel.y1, tunel.alto * 0.8, f.q, 0.24, 3),
    contato(disco(cupula.cx, cupula.cy, cupula.r), 0.3),
    contato(caixa(-tunel.meia, tunel.y0, tunel.meia, tunel.y1, 2), 0.26),
  )
}

// ---------- em ruína ----------

/** A espessura da parede que sobrou (px) e a altura de uma fiada (fração da altura da cúpula). */
const PAREDE = 9
/** O rumo (graus, 0 = a frente, positivo para o leste) do meio do desmoronamento e a meia abertura da porta. */
const RUMO_DO_DESABAMENTO = 55
const MEIA_PORTA = 15

/** O setor de anel de `r0` a `r1` entre os rumos `a0` e `a1` (radianos, 0 = a frente), no meio (cx, cy). */
function setor(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): Forma {
  const pontos: Ponto[] = []
  const n = Math.max(2, Math.ceil(((a1 - a0) * r1) / 3))
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n
    pontos.push([cx + Math.sin(a) * r1, cy + Math.cos(a) * r1])
  }
  for (let i = n; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / n
    pontos.push([cx + Math.sin(a) * r0, cy + Math.cos(a) * r0])
  }
  return poligono(pontos)
}

/** Distância de rumos em graus, de 0 a 180. */
function longeDoRumo(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 540) % 360 - 180)
  return d
}

/** O bloco `j` da fiada `k` ficou de pé? A frente à direita caiu; o fundo fica mais alto, em degraus. */
function ficouDePe(k: number, j: number, rumo: number): boolean {
  if (k === 0) return longeDoRumo(rumo, 0) > MEIA_PORTA
  const doDesabamento = longeDoRumo(rumo, RUMO_DO_DESABAMENTO)
  const daFrente = longeDoRumo(rumo, 0)
  const sorte = hash(j, k, 6650)
  if (k === 1) return daFrente > MEIA_PORTA && (doDesabamento > 45 || sorte < 0.25)
  if (k === 2) return daFrente > 28 && doDesabamento > 70 && sorte < 0.88
  if (k === 3) return doDesabamento > 105 && sorte < 0.78
  if (k === 4) return doDesabamento > 130 && sorte < 0.62
  return doDesabamento > 150 && sorte < 0.45
}

/** Um bloco tombado: o prisma baixo de planta girada, com o alto mais claro e a beira chanfrada. */
function blocoCaido(f: Fatiador, x: number, y: number, a: number, b: number, alto: number, angulo: number, semente: number): void {
  const planta = poligono(retanguloGirado(x, y, a, b, angulo))
  const q = f.q
  for (const z of alturas(0.2, alto, PASSO)) {
    const tex: Textura = (_u, _v, px, py, p, s) => {
      const d = p.forma.d(px, py)
      const gx = p.forma.d(px + 0.4, py) - d
      const gy = p.forma.d(px, py + 0.4) - d
      const l = Math.hypot(gx, gy) || 1
      const emCima = z >= alto - 1e-6
      pintarNeve(s, px, py + z, emCima ? 0 : gx / l, emCima ? 0 : gy / l, emCima ? 1 : 0.1, q)
      if (emCima) s[3] -= 0.08 * suave(-1.6, 0, d)
    }
    f.fatia(1, z, planta, NEVE, lisa(z >= alto - 1e-6 ? 1.02 : 0.98, tex, semente))
  }
}

const FULIGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x4c, 0x46] }
const TICAO: MaterialDaPeca = { classe: 'liso', rgb: [0x46, 0x3a, 0x32] }
/** A pele velha esquecida no chão: pardo de caribu, contido. */
const PELE: MaterialDaPeca = { classe: 'tecido', rgb: [0x7a, 0x66, 0x52], fio: 'la' }

/** O EM RUÍNA: a parede de trás de pé em degraus, os blocos tombados, o chão de dentro e o túnel sem teto. */
export const montarIgluEmRuina: MontarMovel = (c, cena) => {
  const f = novoFatiador(c.peca, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_IGLU
  const { cupula, tunel } = medidas(c.hw, c.hh)
  const altoDaFiada = cupula.h / FIADAS
  saia(f, cupula, tunel, 5.9)

  // O chão de dentro: a neve pisada e cinzenta, a mancha da fogueira apagada com dois tições e a pele velha.
  const dentro = cupula.r - PAREDE + 0.5
  const doChao: Textura = (_u, _v, x, y, _p, s) => {
    misturarCor(s, TOM_DA_NEVE_NA_SOMBRA, 0.3 + 0.2 * (ruido(x * 0.35 + 5, y * 0.35 + 2) + 0.5))
    s[3] += ruido(x * 1.1 + 1, y * 1.1 + 3) * 0.04
  }
  f.fatia(0, 0.1, disco(cupula.cx, cupula.cy, dentro), NEVE, lisa(0.95, doChao, 6660))
  const fogo = { x: cupula.cx - 8, y: cupula.cy - 4 }
  f.fatia(0, 0.14, elipse(fogo.x, fogo.y, 9, 7.5), FULIGEM, { ...lisa(1, undefined, 6661), alfa: 0.55, suave: 2.6 })
  f.fatia(1, 0.6, poligono(retanguloGirado(fogo.x - 1, fogo.y + 0.5, 6, 0.9, 0.5)), TICAO, { tabua: 0, bisel: 0.6, contorno: 0.2, semente: 6662 })
  f.fatia(1, 0.7, poligono(retanguloGirado(fogo.x + 1.5, fogo.y - 1, 5, 0.8, -0.7)), TICAO, { tabua: 0, bisel: 0.6, contorno: 0.2, semente: 6663 })
  f.fatia(1, 1.2, elipse(cupula.cx + 14, cupula.cy - 16, 11, 6.5), PELE, { tabua: 0, bisel: 2.4, contorno: 0.24, ruga: 0.5, semente: 6664 })

  // A parede: cada bloco de pé é um setor de anel nas fatias da fiada dele.
  for (let k = 0; k < FIADAS - 1; k += 1) {
    const n = blocosDaFiada(cupula, k)
    const giro = giroDaFiada(k)
    for (let j = 0; j < n; j += 1) {
      const a0 = ((j - giro) / n) * 2 * Math.PI
      const a1 = ((j + 1 - giro) / n) * 2 * Math.PI
      const rumo = (((a0 + a1) / 2) * 180) / Math.PI
      if (!ficouDePe(k, j, rumo)) continue
      const z0 = k * altoDaFiada
      const z1 = (k + 1) * altoDaFiada
      for (const z of alturas(z0 + (k === 0 ? 0 : 0.01), z1, PASSO)) {
        const tz = Math.min(1, z / cupula.h)
        const r1 = cupula.r * Math.sqrt(Math.max(0, 1 - tz * tz))
        const r0 = Math.max(1, r1 - PAREDE)
        const gap = MEIA_JUNTA / Math.max(4, r1)
        const emCima = z >= z1 - 1e-6
        const tex: Textura = (_u, _v, x, y, _p, s) => {
          const dx = x - cupula.cx
          const dy = y - cupula.cy
          const d = Math.hypot(dx, dy) || 1
          // Por fora, a cúpula; por dentro, a face que olha para o meio; o alto do bloco, deitado.
          const deFora = d > (r0 + r1) / 2
          const nz = emCima ? 1 : deFora ? (z / cupula.h) * 0.8 : 0.1
          const nx = emCima ? 0 : ((deFora ? 1 : -1) * dx) / d
          const ny = emCima ? 0 : ((deFora ? 1 : -1) * dy) / d
          const l = Math.hypot(nx, ny, nz) || 1
          pintarNeve(s, x, y + z, nx / l, ny / l, nz / l, q)
          // O chanfro na beira de cada bloco e a junta escura no pé da fiada (na 3/4).
          const ao = Math.atan2(dx, dy)
          const meioDoBloco = (a0 + a1) / 2
          const dAng = Math.abs(Math.atan2(Math.sin(ao - meioDoBloco), Math.cos(ao - meioDoBloco)))
          const beira = ((a1 - a0) / 2 - dAng) * d
          s[3] += 0.06 * (hash(j, k, 6602) - 0.5) - 0.09 * suave(BEIRA_DO_BLOCO, 0, beira)
          if (z - z0 < 0.9 && k > 0) misturarCor(s, COR_DA_JUNTA, 0.6)
          if (emCima) s[3] -= 0.07 * suave(1.6, 0, Math.min(d - r0, r1 - d))
        }
        f.fatia(0, z, setor(cupula.cx, cupula.cy, r0, r1, a0 + gap, a1 - gap), NEVE, lisa(emCima ? 1.03 : 1, tex, 6670 + k))
      }
      // A sombra do bloco no chão, pelo alto dele.
      const am = (a0 + a1) / 2
      const rm = cupula.r * Math.sqrt(Math.max(0, 1 - (z1 / cupula.h) ** 2)) - PAREDE / 2
      const bx = cupula.cx + Math.sin(am) * rm
      const by = cupula.cy + Math.cos(am) * rm
      const meio = Math.max(4, ((a1 - a0) * rm) / 2)
      cena.sombras.push(sombraVarrida(bx - meio, by - meio, bx + meio, by + meio, z1, q, 0.2, 2.2))
    }
  }

  // O túnel sem teto: só a fiada de baixo das duas paredes, com falhas, e os blocos do teto caídos dentro.
  const blocosDoTunel = Math.max(2, Math.round((tunel.y1 - tunel.y0) / BLOCO_DO_TUNEL))
  for (const lado of [-1, 1]) {
    for (let i = 0; i < blocosDoTunel; i += 1) {
      if (hash(i, lado + 3, 6680) < 0.22) continue
      const y0 = tunel.y0 + ((tunel.y1 - tunel.y0) * i) / blocosDoTunel + MEIA_JUNTA
      const y1 = tunel.y0 + ((tunel.y1 - tunel.y0) * (i + 1)) / blocosDoTunel - MEIA_JUNTA
      const x = lado * (tunel.meia - 3.2)
      blocoCaido(f, x, (y0 + y1) / 2, 3.2, (y1 - y0) / 2, tunel.alto * (0.38 + 0.12 * hash(i, lado, 6681)), 0.03 * lado, 6682 + i)
    }
  }
  // Os blocos tombados: dentro do anel, no túnel e fora, para o lado do desabamento.
  const desabamento = (RUMO_DO_DESABAMENTO * Math.PI) / 180
  const caidos: readonly (readonly [number, number, number])[] = [
    [0.35, -0.2, 0.4], [0.55, 0.15, 1.3], [0.62, 0.45, 2.2], [0.95, -0.3, 0.9], [1.1, 0.25, 2.8], [1.22, -0.05, 1.7], [0.2, 0.6, 2.5],
  ]
  caidos.forEach(([longe, desvio, angulo], i) => {
    const a = desabamento + desvio
    const x = cupula.cx + Math.sin(a) * cupula.r * longe
    const y = cupula.cy + Math.cos(a) * cupula.r * longe
    blocoCaido(f, x, y, 6.5 + 2 * hash(i, 1, 6690), 4 + 1.5 * hash(i, 2, 6690), 4.5 + 2 * hash(i, 3, 6690), angulo, 6691 + i)
    cena.sombras.push(contato(poligono(retanguloGirado(x, y, 6.5, 4, angulo)), 0.22))
  })
  blocoCaido(f, 2, (tunel.y0 + tunel.y1) / 2 + 4, 6, 4.2, 4.4, 0.7, 6699)
  f.fechar()
  cena.sombras.push(contato(disco(cupula.cx, cupula.cy, cupula.r), 0.28))
}
