/**
 * TORRE DE CERCO de cima com volume (construção do lote L15, 14/11/2026, grupo
 * Fortes e castelos): a torre de tábuas que afina para cima, em três andares
 * com o vigamento na frente (os esteios dos cantos, as travessas e as cruzes
 * de Santo André), as quatro RODAS nos lados, a plataforma de cima com o
 * parapeito de tábuas, e a PONTE erguida na frente, pronta para cair no muro.
 *
 * De cima: a plataforma de tábuas com a sombra do parapeito e da ponte, o
 * parapeito, a ponte de pé na beira da frente, as quatro faces inclinadas em
 * volta (as tábuas correndo ao comprido) e as rodas nos lados.
 *
 * NA 3/4 (`tresQuartos.ts`, perfil derivado com a beirada
 * `ESPESSURA_DA_FIADA_DA_TORRE_DE_CERCO`, a altura de uma fiada de tábuas):
 * - a torre é uma pilha de FIADAS (tampos soltos), de baixo para cima, cada
 *   uma um pouco mais estreita: a frente sobe inclinada, com a junta das
 *   tábuas a cada fiada;
 * - as faces inclinadas da vista de cima sobem com a fiada de baixo (o meio
 *   da caixa na beira dela), e as fiadas de cima as cobrem;
 * - o parapeito é um anel uma fiada acima da plataforma, a ponte é uma pilha
 *   de três fiadas na beira da frente;
 * - o VIGAMENTO da frente são DECALQUES (a conta do portão com grade): peças
 *   desenhadas na planta com o alto para o norte, dentro da pegada e debaixo da
 *   plataforma e das faces, levantadas por um PINO no chão da frente (um por
 *   andar);
 * - as rodas são colunas roliças de pé nos lados (vistas de frente, de quina).
 *
 * Não lê `c.giro`: a torre tem frente (a ponte olha para o sul da planta).
 * Planta em casas (2 x 2 de partida), alturas em casas. Material: `madeira`; o
 * ferro das rodas é fixo.
 */
import { caixa, capsula, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type OpcoesDaPeca } from './motor'
import { G, PREGO, type MontarMovel } from './contexto'
import { caixaArrastada, colunaSemSombra, comMeioEm, emOrdem, pino, solta, texturaComSombra, type QueFazSombra } from './andaimeDaTresQuartos'

/** A altura de uma fiada de tábuas (casas e px do protótipo): a beirada de todo tampo solto da torre. O perfil usa. */
const FIADA_EM_CASAS = 0.3
export const ESPESSURA_DA_FIADA_DA_TORRE_DE_CERCO = FIADA_EM_CASAS * G
/** Quantas fiadas tem a torre, e a meia largura dela no pé e no alto (casas). */
const FIADAS = 9
const MEIA_NO_PE = 0.86
const MEIA_NO_ALTO = 0.64
/** O parapeito (fundo, casas) e a ponte (meia largura, fundo, casas; quantas fiadas de alto). */
const PARAPEITO = 0.09
const PONTE = { l: 0.42, fundo: 0.07, fiadas: 3 }
/** Os andares do vigamento da frente: [de, até] em casas de altura; e o raio das vigas (casas). */
const ANDARES: readonly (readonly [number, number])[] = [[0.06, 0.9], [0.9, 1.8], [1.8, 2.64]]
const RAIO_DA_VIGA = 0.03
/** As rodas: o meio em x (casas, fora do pé), o meio de cada uma em y, o raio e a meia espessura (casas). */
const RODAS = { x: 0.92, y: [-0.46, 0.46], r: 0.3, meia: 0.055 }
/** As tábuas (px). */
const TABUA = 7
/** A sombra no chão e a pintada na plataforma. */
const FORCA_DA_SOMBRA = 0.34
const BORDA_DA_SOMBRA = 2.6
const BORDA_DA_SOMBRA_PINTADA = 1.4
const FORCA_DA_SOMBRA_PINTADA = 0.3

const DA_MADEIRA = texturaDaClasse('madeira')

export const montarTorreDeCerco: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh)
  const q = (v: number): number => v * k
  const madeira = c.m.madeira
  const L = cena.partes
  const S = cena.sombras
  const e = q(FIADA_EM_CASAS)
  const daMadeira = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1, contorno: 0.3, semente, ...mais })
  const zAlto = e * FIADAS
  /** A meia largura da torre na altura h (px): afina por igual do pé ao alto. */
  const meiaEm = (h: number): number => q(MEIA_NO_PE) + (q(MEIA_NO_ALTO) - q(MEIA_NO_PE)) * Math.min(1, Math.max(0, h / zAlto))
  const [pe, alto] = [q(MEIA_NO_PE), q(MEIA_NO_ALTO)]
  const fundo = q(PARAPEITO)
  const [pl, pf] = [q(PONTE.l), q(PONTE.fundo)]
  const rodas = RODAS.y.flatMap((y) => [-1, 1].map((s) => ({ s, y: q(y), forma: capsula(s * q(RODAS.x), q(y) - q(RODAS.r) + q(RODAS.meia), s * q(RODAS.x), q(y) + q(RODAS.r) - q(RODAS.meia), q(RODAS.meia)) })))

  // ---------- as sombras no chão ----------
  S.push(contato(caixa(-pe, -pe, pe, pe), 0.36))
  S.push({ forma: caixaArrastada(-alto, -alto, alto, alto, zAlto + e), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  S.push({ forma: caixaArrastada(-pe, -pe, pe, pe, zAlto * 0.5), z: 0, suave: BORDA_DA_SOMBRA, forca: FORCA_DA_SOMBRA })
  for (const r of rodas) S.push(contato(r.forma, 0.3))

  // ---------- as estruturas da 3/4, na ordem de pintura ----------
  const estruturas: { forma: Forma; z: number; coluna: boolean }[] = []
  const pore = (forma: Forma, z: number, coluna = false): void => {
    estruturas.push({ forma, z, coluna })
  }
  for (const r of rodas) if (r.y < 0) pore(r.forma, q(RODAS.r) * 2, true)
  for (let i = 0; i < FIADAS; i += 1) {
    const m = meiaEm(e * i)
    pore(caixa(-m, -m, m, m), e * (i + 1))
  }
  pore(anelQuadrado(alto, fundo), zAlto + e)
  for (let i = 0; i < PONTE.fiadas; i += 1) pore(caixa(-pl, alto - pf, pl, alto), zAlto + e * (i + 1))
  for (const r of rodas) if (r.y > 0) pore(r.forma, q(RODAS.r) * 2, true)
  // Os pinos dos decalques do vigamento: no chão da frente, um por andar.
  const pinos: Ponto[] = ANDARES.map((_, i) => [q(-0.3 + 0.3 * i), pe + q(0.06)])
  ANDARES.forEach(([de], i) => pore(pino(pinos[i][0], pinos[i][1]), q(de)))
  const naOrdem = emOrdem(
    estruturas.map((x) => x.forma),
    c.hh + 1,
  )
  estruturas.forEach((x, i) => S.push(x.coluna ? colunaSemSombra(naOrdem[i], x.z) : solta(naOrdem[i], x.z)))

  // ---------- o vigamento da frente (decalques: debaixo da plataforma e das faces na vista de cima) ----------
  ANDARES.forEach(([de, ate], i) => {
    const [h0, h1] = [q(de), q(ate)]
    /** O ponto da planta que aparece em (x, h) na frente da torre, com o pino deste andar. */
    const naFrente = (x: number, h: number): Ponto => [x, meiaEm(h) - h + h0]
    const rv = q(RAIO_DA_VIGA)
    const viga = (a: Ponto, b: Ponto, r: number): Forma => comMeioEm(capsula(a[0], a[1], b[0], b[1], r), pinos[i][0], pinos[i][1])
    const opcoes = (semente: number, tom: number): OpcoesDaPeca => daMadeira(semente, { tabua: 0, bisel: 0.8, tom, projeta: { dist: 1, forca: 0.3 } })
    // A cruz de Santo André entre os esteios.
    const [m0, m1] = [meiaEm(h0) - rv * 2.5, meiaEm(h1) - rv * 2.5]
    L.push(P(viga(naFrente(-m0, h0 + rv), naFrente(m1, h1 - rv), rv), madeira, opcoes(18910 + i * 6, 0.82)))
    L.push(P(viga(naFrente(m0, h0 + rv), naFrente(-m1, h1 - rv), rv), madeira, opcoes(18911 + i * 6, 0.86)))
    // A travessa de cima do andar e os dois esteios dos cantos.
    L.push(P(viga(naFrente(-meiaEm(h1) + rv, h1 - rv), naFrente(meiaEm(h1) - rv, h1 - rv), rv * 1.2), madeira, opcoes(18912 + i * 6, 0.92)))
    for (const s of [-1, 1]) {
      L.push(P(viga(naFrente(s * (meiaEm(h0) - rv * 1.2), h0), naFrente(s * (meiaEm(h1) - rv * 1.2), h1), rv * 1.2), madeira, opcoes(18913 + i * 6 + (s + 1) / 2, 0.9)))
    }
  })

  // ---------- as rodas (de cima: a banda de rodagem com o aro de ferro e o cubo) ----------
  rodas.forEach((r, i) => {
    L.push(P(r.forma, madeira, daMadeira(18930 + i, { tabua: 0, tom: 0.78, bisel: q(RODAS.meia) * 0.8, eixo: Math.PI / 2 })))
    const x = r.s * q(RODAS.x)
    L.push(P(caixa(x - q(RODAS.meia) - 0.6, r.y - 1.8, x + q(RODAS.meia) + 0.6, r.y + 1.8, 0.8), PREGO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.4, semente: 18934 + i }))
  })

  // ---------- as quatro faces inclinadas (sobem com a fiada de baixo: as de cima as cobrem na 3/4) ----------
  const faces: readonly (readonly [Ponto[], number, number, number])[] = [
    [[[-pe, -pe], [pe, -pe], [alto, -alto], [-alto, -alto]], 0, -pe + 0.6, 0.86],
    [[[-pe, -pe], [-alto, -alto], [-alto, alto], [-pe, pe]], -pe + 0.6, 0, 0.8],
    [[[pe, -pe], [pe, pe], [alto, alto], [alto, -alto]], pe - 0.6, 0, 0.92],
    [[[-pe, pe], [-alto, alto], [alto, alto], [pe, pe]], 0, pe - 0.6, 0.96],
  ]
  faces.forEach(([pontos, mx, my, tom], i) => {
    const deLado = i === 1 || i === 2
    L.push(P(comMeioEm(poligono(pontos), mx, my), madeira, daMadeira(18940 + i, { tabua: TABUA, tom, eixo: deLado ? Math.PI / 2 : 0, bisel: 0.8 })))
  })

  // ---------- a plataforma com a sombra do parapeito e da ponte, o parapeito e a ponte ----------
  const sombrasNaPlataforma: QueFazSombra[] = [
    { forma: anelQuadrado(alto, fundo), de: 0, ate: e },
    { forma: caixa(-pl, alto - pf, pl, alto), de: 0, ate: e * PONTE.fiadas },
  ]
  const comSombra = texturaComSombra(DA_MADEIRA, sombrasNaPlataforma, BORDA_DA_SOMBRA_PINTADA, FORCA_DA_SOMBRA_PINTADA)
  L.push(P(caixa(-alto, -alto, alto, alto, 1), madeira, daMadeira(18950, { tabua: TABUA, textura: comSombra, bisel: 1.2 })))
  // O alçapão da escada de dentro, num canto de trás.
  L.push(P(caixa(-alto + fundo + q(0.08), -alto + fundo + q(0.08), -alto + fundo + q(0.4), -alto + fundo + q(0.34), 0.6), madeira, daMadeira(18951, { tabua: TABUA, tom: 0.7, eixo: Math.PI / 2 })))
  const lados = [
    caixa(-alto, -alto, alto, -alto + fundo, 0.6),
    caixa(-alto, alto - fundo, alto, alto, 0.6),
    caixa(-alto, -alto, -alto + fundo, alto, 0.6),
    caixa(alto - fundo, -alto, alto, alto, 0.6),
  ]
  lados.forEach((lado, i) => {
    // O meio de cada lado do parapeito longe da ponte (que é mais alta).
    const [x0, y0, x1, y1] = lado.b
    const [mx, my] = i < 2 ? [x0 + (x1 - x0) * 0.1, (y0 + y1) / 2] : [(x0 + x1) / 2, y0 + (y1 - y0) * 0.3]
    L.push(P(comMeioEm(lado, mx, my), madeira, daMadeira(18952 + i, { tabua: 0, tom: 1.06, eixo: i < 2 ? 0 : Math.PI / 2, bisel: 0.8 })))
  })
  L.push(P(caixa(-pl, alto - pf, pl, alto, 0.5), madeira, daMadeira(18956, { tabua: TABUA, tom: 1.1, eixo: Math.PI / 2, bisel: 0.6 })))
}

/** O anel quadrado do parapeito: o quadrado de meia largura `meia` menos o de dentro, `fundo` px menor. */
function anelQuadrado(meia: number, fundo: number): Forma {
  const fora = caixa(-meia, -meia, meia, meia)
  const dentro = caixa(-meia + fundo, -meia + fundo, meia - fundo, meia - fundo)
  return { b: fora.b, d: (x, y) => Math.max(fora.d(x, y), -dentro.d(x, y)) }
}
