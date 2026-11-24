/**
 * QUADRO DE CHAVES (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): a tábua pregada na
 * parede da guarita, onde o carcereiro pendura as chaves das celas. Desenhado DE FRENTE, como o quadro de avisos e
 * a armadura: visto de cima seria só um risco na parede. A TÁBUA de madeira, presa por dois cravos grossos; em
 * fila, os GANCHOS de ferro, cada um com a plaquinha de latão do número em cima; nos ganchos, as ARGOLAS com as
 * CHAVES GRANDES penduradas (uma, duas ou três por argola, uma delas de latão). O gancho do meio está VAZIO: a
 * chave dessa cela saiu com alguém.
 *
 * O que diz "quadro de chaves" a 25% de zoom é a faixa de madeira com a fileira de chaves escuras penduradas
 * embaixo e o vão do meio.
 *
 * A sombra é a da parede (a tábua e as chaves a um palmo dela), pintada como peça translúcida deslocada para
 * baixo à direita: nenhuma sombra tem altura, e por isso a 3/4 sai igual (perfil derivado sem estrutura).
 *
 * Esticado, a tábua acompanha a pegada e ganha ganchos (um a cada `PASSO_DO_GANCHO`); as chaves têm o tamanho do
 * menor lado. Materiais: `madeira` (a tábua) e `chaves` (os ganchos, as argolas e as chaves). O latão das
 * plaquinhas e da chave grande é fixo.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, capsula, caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import type { MaterialDaPeca } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo no tamanho de partida, 1 x 0,6 casa) ----------

const LADO_DE_PARTIDA = 0.6 * G
/** A tábua: a sobra de cada ponta, o alto e o baixo (frações da meia altura). */
const SOBRA_DA_TABUA = 2.6
const ALTO_DA_TABUA = -0.88
const BAIXO_DA_TABUA = -0.26
/** Um gancho a cada tanto de px ao comprido. */
const PASSO_DO_GANCHO = 9.4
/** A sombra na parede: o deslocamento (px) e a força. */
const SOMBRA_NA_PAREDE: Ponto = [1.9, 1.5]
const FORCA_DA_SOMBRA = 0.34
/** As chaves de cada argola (comprimento em px e o balanço em radianos); argola vazia = gancho vazio. */
const MOLHOS: readonly (readonly (readonly [number, number])[])[] = [
  [[9.6, 0.1], [7.8, -0.16]],
  [[11.2, 0.04]],
  [],
  [[10.2, 0.14], [8.6, -0.02], [7.1, -0.2]],
  [[11.6, -0.06]],
]

// ---------- os materiais fixos ----------

const LATAO = materialDaPeca('latao')
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1c, 0x17, 0x13] }
const NUMERO: Rgb = [0x3a, 0x30, 0x24]
const TINTA_DO_NUMERO: MaterialDaPeca = { classe: 'liso', rgb: NUMERO }

/** Uma chave pendurada: o anel em cima (no meio da argola), a haste para baixo e o palhetão com dois dentes. */
function chaveDePe(x: number, y: number, comp: number, balanco: number, lado: number, k: number): readonly Forma[] {
  const a = Math.PI / 2 + balanco
  const c = Math.cos(a)
  const s = Math.sin(a)
  const p = (t: number, n: number): Ponto => [x + c * t - s * n * lado, y + s * t + c * n * lado]
  const [ax, ay] = p(1.9 * k, 0)
  const [hx0, hy0] = p(3.6 * k, 0)
  const [hx1, hy1] = p(comp * k, 0)
  const palhetao = poligono([p((comp - 3.2) * k, 0.35 * k), p(comp * k, 0.35 * k), p(comp * k, 3.2 * k), p((comp - 1) * k, 3.2 * k), p((comp - 1) * k, 2.1 * k), p((comp - 2.1) * k, 2.1 * k), p((comp - 2.1) * k, 3.2 * k), p((comp - 3.2) * k, 3.2 * k)])
  return [capsula(hx0, hy0, hx1, hy1, 0.8 * k), palhetao, anel(ax, ay, 2 * k, 2.2 * k, 1 * k, 1.2 * k)]
}

/** A mesma forma deslocada (a sombra dela na parede). */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarQuadroDeChaves: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const ferro = c.m.chaves
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const L = cena.partes
  const x0 = -hw + SOBRA_DA_TABUA
  const x1 = hw - SOBRA_DA_TABUA
  const y0 = ALTO_DA_TABUA * hh
  const y1 = BAIXO_DA_TABUA * hh
  const tabua = caixa(x0, y0, x1, y1, 1.4)
  const [sdx, sdy] = SOMBRA_NA_PAREDE

  // Os ganchos: tantos quanto cabem, centrados; as argolas vão nos ganchos em ordem, e o resto fica vazio.
  const ganchos = Math.max(3, Math.round((x1 - x0 - 6) / (PASSO_DO_GANCHO * k)))
  const passo = (x1 - x0 - 6 * k) / (ganchos - 1)
  const yGancho = y1 - 2.2 * k
  const xs = Array.from({ length: ganchos }, (_, i) => x0 + 3 * k + i * passo)
  const molhos = xs.map((_, i) => MOLHOS[i % MOLHOS.length])

  // ---------- as formas das chaves (antes, para pintar a sombra delas primeiro) ----------
  const argolas: { forma: Forma; chaves: readonly (readonly Forma[])[] }[] = []
  xs.forEach((x, i) => {
    const molho = molhos[i]
    if (molho.length === 0) return
    const ry = 2.6 * k
    const cy = yGancho + 1.6 * k + ry
    const forma = anel(x + 0.4 * k, cy, 2.3 * k, ry, 1.45 * k, ry - 0.9 * k)
    const chaves = molho.map(([comp, balanco], j) => chaveDePe(x + 0.4 * k + (j - (molho.length - 1) / 2) * 1.7 * k, cy + ry - 0.6 * k, comp, balanco, j % 2 === 0 ? 1 : -1, k))
    argolas.push({ forma, chaves })
  })

  // ---------- a sombra na parede: a tábua, os ganchos e as chaves ----------
  L.push(P(deslocada(tabua, sdx, sdy), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 1.4, semente: 9201 }))
  for (const { forma, chaves } of argolas) {
    L.push(P(deslocada(forma, sdx * 0.8, sdy * 0.8), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA * 0.8, suave: 0.9, semente: 9202 }))
    for (const ch of chaves) for (const f of ch) L.push(P(deslocada(f, sdx * 0.8, sdy * 0.8), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA * 0.8, suave: 0.9, semente: 9203 }))
  }

  // ---------- a tábua, os cravos e as plaquinhas ----------
  L.push(P(tabua, mad, { tabua: 0, bisel: 1.5, contorno: 0.32, tom: 0.92, semente: 9210 }))
  L.push(P(caixa(x0 + 0.6, y1 - 1.3, x1 - 0.6, y1 - 0.2, 0.4), mad, { tabua: 0, bisel: 0.3, contorno: 0, tom: 0.7, alfa: 0.7, semente: 9211 }))
  for (const lado of [-1, 1]) {
    const cx = lado * (hw - SOBRA_DA_TABUA - 2.6 * k)
    L.push(P(elipse(cx, (y0 + y1) / 2, 1.5 * k, 1.5 * k), ferro, { bisel: 0.8, contorno: 0.34, tom: 0.92, metal: 0.45, semente: 9212 + lado }))
  }
  xs.forEach((x, i) => {
    const py = y0 + 2.6 * k
    L.push(P(caixa(x - 2.1 * k, py, x + 2.1 * k, py + 2.5 * k, 0.4), LATAO, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.86 + hash(i, 2, 9220) * 0.08, metal: 0.4, semente: 9221 + i }))
    // O número riscado na plaquinha: um, dois ou três traços curtos.
    const tracos = (i % 3) + 1
    for (let t = 0; t < tracos; t += 1) {
      const tx = x + (t - (tracos - 1) / 2) * 0.95 * k
      L.push(P(caixa(tx - 0.24 * k, py + 0.6 * k, tx + 0.24 * k, py + 1.9 * k), TINTA_DO_NUMERO, { bisel: 0, contorno: 0, alfa: 0.75, semente: 9230 }))
    }
  })

  // ---------- os ganchos: a chapinha pregada, a haste e a ponta virada para cima ----------
  xs.forEach((x, i) => {
    L.push(P(caixa(x - 1.2 * k, yGancho - 2.6 * k, x + 1.2 * k, yGancho - 0.3 * k, 0.4), ferro, { tabua: 0, bisel: 0.5, contorno: 0.34, tom: 0.82, semente: 9240 + i }))
    const gancho = capsula(x, yGancho - 1.4 * k, x, yGancho + 1.8 * k, 0.62 * k)
    const ponta = capsula(x, yGancho + 1.8 * k, x + 1.5 * k, yGancho + 0.7 * k, 0.55 * k)
    for (const f of [gancho, ponta]) L.push(P(f, ferro, { tabua: 0, bisel: 0.5, contorno: 0.34, tom: 0.96, metal: 0.5, semente: 9245 + i, projeta: { dist: 0.8, forca: 0.45 } }))
  })

  // ---------- as argolas e as chaves penduradas ----------
  argolas.forEach(({ forma, chaves }, i) => {
    chaves.forEach((ch, j) => {
      const mat = i === argolas.length - 1 && j === 0 ? LATAO : ferro
      const tom = 0.94 + hash(i, j, 9250) * 0.12
      for (const f of ch) L.push(P(f, mat, { tabua: 0, bisel: 0.7, contorno: 0.34, tom, metal: 0.5, semente: 9251 + i * 4 + j, projeta: { dist: 0.8, forca: 0.4 } }))
    })
    L.push(P(forma, ferro, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 1.06, metal: 0.55, semente: 9270 + i, projeta: { dist: 0.8, forca: 0.4 } }))
  })
}
