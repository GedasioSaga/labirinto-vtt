/**
 * QUADRO DE CHAVES (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura): a tábua pregada na
 * parede da guarita, onde o carcereiro pendura as chaves das celas. Desenhado DE FRENTE, como o quadro de avisos e
 * a armadura: visto de cima seria só um risco na parede. A TÁBUA grossa de duas pranchas, com a luz pegando na beira
 * de cima, presa por quatro cravos; em fila, os GANCHOS de ferro, cada um com a plaquinha de latão do número em
 * cima; nos ganchos, as ARGOLAS pequenas com as CHAVES GRANDES penduradas (uma ou duas por argola, abertas em leque
 * para não se embolarem; uma delas de latão). O gancho do meio está VAZIO: a chave dessa cela saiu com alguém.
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
const ALTO_DA_TABUA = -0.92
const BAIXO_DA_TABUA = -0.12
/** Um gancho a cada tanto de px ao comprido. */
const PASSO_DO_GANCHO = 9.4
/** A sombra na parede: o deslocamento (px) e a força (forte o bastante para a peça descolar do chão claro). */
const SOMBRA_NA_PAREDE: Ponto = [2.4, 2.2]
const FORCA_DA_SOMBRA = 0.42
/** A chave: o raio do anel e do furo, o da haste, e o palhetão de três dentes (px). */
const RAIO_DO_ANEL = 2.8
const RAIO_DO_FURO = 1.5
const RAIO_DA_HASTE = 1
const COMPRIMENTO_DO_PALHETAO = 4.6
const ALTURA_DO_DENTE = 4
const FUNDO_DO_DENTE = 2.4
/** Os dentes e os vãos do palhetão, da ponta da haste para cima (px): dente, vão, dente, vão, dente. */
const CORTES_DO_PALHETAO: readonly number[] = [1.1, 0.7, 1, 0.7, 1.1]
/**
 * A argola do molho: baixa, para não competir com o anel das chaves, e um pouco larga, para as duas chaves
 * penderem uma de cada lado sem os anéis se cobrirem (meios eixos de fora e o fio, px).
 */
const ARGOLA: Ponto = [2.5, 1.8]
const FIO_DA_ARGOLA = 0.62
/** Onde as duas chaves de uma argola se penduram, de cada lado do pé dela (px). */
const PE_DA_CHAVE = 2.15
/**
 * As chaves de cada argola (comprimento em px e o balanço em radianos); argola vazia = gancho vazio. No máximo duas
 * por argola, abertas em leque (±0,25): três num molho só viravam um emaranhado cinza.
 */
const MOLHOS: readonly (readonly (readonly [number, number])[])[] = [
  [[13.4, 0.25], [11.8, -0.25]],
  [[15, 0.04]],
  [],
  [[14, 0.25], [12.2, -0.25]],
  [[15.4, -0.05]],
]
/** O tom da chave de latão: abaixo do latão das plaquinhas, para não ser o ponto mais saturado do lote. */
const TOM_DA_CHAVE_DE_LATAO = 0.85

// ---------- os materiais fixos ----------

const LATAO = materialDaPeca('latao')
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1c, 0x17, 0x13] }
const NUMERO: Rgb = [0x3a, 0x30, 0x24]
const TINTA_DO_NUMERO: MaterialDaPeca = { classe: 'liso', rgb: NUMERO }

/**
 * Uma chave pendurada, de cima para baixo: o anel (com o furo onde passa a argola), a gola, a haste e o palhetão
 * de três dentes virado para a direita. (x, y) é onde ela pende da argola; `balanco` gira a chave em volta dali.
 */
function chaveDePe(x: number, y: number, comp: number, balanco: number, k: number): readonly Forma[] {
  const a = Math.PI / 2 + balanco
  const c = Math.cos(a)
  const s = Math.sin(a)
  // n > 0 vai para a direita da tela quando a chave pende reta.
  const p = (t: number, n: number): Ponto => [x + c * t + s * n, y + s * t - c * n]
  const [ax, ay] = p((RAIO_DO_FURO - 0.2) * k, 0)
  const comecoDaHaste = (RAIO_DO_FURO - 0.2 + RAIO_DO_ANEL - 0.4) * k
  const [hx0, hy0] = p(comecoDaHaste, 0)
  const [hx1, hy1] = p(comp * k, 0)
  const [gx0, gy0] = p(comecoDaHaste + 0.7 * k, -1.35 * k)
  const [gx1, gy1] = p(comecoDaHaste + 0.7 * k, 1.35 * k)
  // O palhetão: a chapa presa na haste, com os dois vãos cortados na beira de fora (três dentes).
  const contorno: Ponto[] = [p(comp * k, 0.5 * k)]
  let t = comp
  CORTES_DO_PALHETAO.forEach((largura, i) => {
    const n = i % 2 === 0 ? ALTURA_DO_DENTE : FUNDO_DO_DENTE
    contorno.push(p(t * k, n * k), p((t - largura) * k, n * k))
    t -= largura
  })
  contorno.push(p((comp - COMPRIMENTO_DO_PALHETAO) * k, 0.5 * k))
  return [
    capsula(hx0, hy0, hx1, hy1, RAIO_DA_HASTE * k),
    poligono(contorno),
    capsula(gx0, gy0, gx1, gy1, 0.45 * k),
    anel(ax, ay, RAIO_DO_ANEL * k, RAIO_DO_ANEL * k, RAIO_DO_FURO * k, RAIO_DO_FURO * k),
  ]
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
  const ym = (y0 + y1) / 2
  const tabua = caixa(x0, y0, x1, y1, 1.4)
  const [sdx, sdy] = SOMBRA_NA_PAREDE

  // Os ganchos: tantos quanto cabem, centrados; as argolas vão nos ganchos em ordem, e o resto fica vazio.
  const ganchos = Math.max(3, Math.round((x1 - x0 - 6) / (PASSO_DO_GANCHO * k)))
  const passo = (x1 - x0 - 6 * k) / (ganchos - 1)
  const yGancho = y1 - 2.4 * k
  const xs = Array.from({ length: ganchos }, (_, i) => x0 + 3 * k + i * passo)
  const molhos = xs.map((_, i) => MOLHOS[i % MOLHOS.length])

  // ---------- as formas das argolas e das chaves (antes, para pintar a sombra delas primeiro) ----------
  const argolas: { forma: Forma; chaves: readonly (readonly Forma[])[] }[] = []
  xs.forEach((x, i) => {
    const molho = molhos[i]
    if (molho.length === 0) return
    const [rx, ry] = [ARGOLA[0] * k, ARGOLA[1] * k]
    const cx = x + 0.4 * k
    const cy = yGancho + 1.5 * k + ry
    const forma = anel(cx, cy, rx, ry, rx - FIO_DA_ARGOLA * k, ry - FIO_DA_ARGOLA * k)
    const chaves = molho.map(([comp, balanco], j) => {
      const lado = molho.length === 1 ? 0 : j === 0 ? -1 : 1
      const px = cx + lado * PE_DA_CHAVE * k
      const py = cy + ry * Math.sqrt(Math.max(0, 1 - (lado * PE_DA_CHAVE * k) ** 2 / (rx * rx))) - 0.3 * k
      return chaveDePe(px, py, comp, balanco, k)
    })
    argolas.push({ forma, chaves })
  })

  // ---------- a sombra na parede: a tábua, os ganchos e as chaves ----------
  L.push(P(deslocada(tabua, sdx, sdy), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA, suave: 1.4, semente: 9201 }))
  for (const { forma, chaves } of argolas) {
    L.push(P(deslocada(forma, sdx * 0.8, sdy * 0.8), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA * 0.8, suave: 0.9, semente: 9202 }))
    for (const ch of chaves) for (const f of ch) L.push(P(deslocada(f, sdx * 0.8, sdy * 0.8), SOMBRA, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA * 0.8, suave: 0.9, semente: 9203 }))
  }

  // ---------- a tábua: duas pranchas ao comprido, a luz na beira de cima, os cravos e as plaquinhas ----------
  L.push(P(caixa(x0, y0, x1, ym + 0.2, 1.4), mad, { tabua: 0, bisel: 1.1, contorno: 0.3, tom: 0.95, semente: 9210 }))
  L.push(P(caixa(x0, ym - 0.2, x1, y1, 1.4), mad, { tabua: 0, bisel: 1.1, contorno: 0.3, tom: 0.88, semente: 9214 }))
  L.push(P(caixa(x0 + 0.8, ym - 0.32, x1 - 0.8, ym + 0.32, 0.2), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3, semente: 9215 }))
  L.push(P(caixa(x0 + 1.2, y0 + 0.45, x1 - 1.2, y0 + 1.5, 0.5), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 1.32, alfa: 0.4, suave: 0.45, semente: 9216 }))
  L.push(P(caixa(x0 + 0.6, y1 - 1.3, x1 - 0.6, y1 - 0.2, 0.4), mad, { tabua: 0, bisel: 0.3, contorno: 0, tom: 0.7, alfa: 0.7, semente: 9211 }))
  for (const lado of [-1, 1]) {
    const cx = lado * (hw - SOBRA_DA_TABUA - 2.6 * k)
    for (const cy of [(y0 + ym) / 2, (ym + y1) / 2]) {
      L.push(P(elipse(cx, cy, 1.25 * k, 1.25 * k), ferro, { bisel: 0.7, contorno: 0.34, tom: 0.92, metal: 0.45, semente: 9212 + lado, projeta: { dist: 0.5, forca: 0.35 } }))
    }
  }
  xs.forEach((x, i) => {
    const py = y0 + 2.1 * k
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

  // ---------- as chaves penduradas e, por cima delas, as argolas ----------
  const ultima = argolas.length - 1
  argolas.forEach(({ forma, chaves }, i) => {
    chaves.forEach((ch, j) => {
      const deLatao = i === ultima && j === 0
      const mat = deLatao ? LATAO : ferro
      const tom = deLatao ? TOM_DA_CHAVE_DE_LATAO : 0.94 + hash(i, j, 9250) * 0.12
      for (const f of ch) L.push(P(f, mat, { tabua: 0, bisel: 0.7, contorno: 0.34, tom, metal: 0.5, semente: 9251 + i * 4 + j, projeta: { dist: 0.8, forca: 0.4 } }))
    })
    L.push(P(forma, ferro, { tabua: 0, bisel: 0.4, contorno: 0.34, tom: 0.98, metal: 0.5, semente: 9270 + i, projeta: { dist: 0.7, forca: 0.4 } }))
  })
}
