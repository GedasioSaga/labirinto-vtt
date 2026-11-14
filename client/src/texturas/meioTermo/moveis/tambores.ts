/**
 * TAMBORES de cima com volume (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa; pedido do mestre:
 * "tambores"). Três tambores de festa de pé, de tamanhos diferentes, e um PANDEIRO deitado no chão:
 * - cada tambor mostra de cima a PELE de couro cru esticada (clara, com a mancha gasta no meio, onde se bate), o
 *   ARO de madeira que a prende e a CORDA de tensão que passa por cima do aro em zigue-zague (os pares de cordas
 *   em V, como nos tambores de corda medievais). O casco pintado (vermelho, azul e ocre) fica escondido debaixo
 *   do aro de cima e aparece na frente da 3/4;
 * - no tambor grande, as duas BAQUETAS cruzadas, com a ponta em bola;
 * - o pandeiro: o aro fino de madeira com as PLATINELAS de latão nos rasgos e a pele clara.
 *
 * Não é o barril (as aduelas e os aros de ferro) nem a tina: a pele clara dentro do aro escuro, com as cordas em
 * volta e o X das baquetas, é o que diz "tambor" a 25% de zoom.
 *
 * Na 3/4 (perfil derivado) cada tambor é uma coluna da altura dele; o casco é a maior peça (um nada maior que o
 * aro, por baixo dele), então a frente sai pintada. Material: `madeira` (os aros, as baquetas e o pandeiro;
 * nogueira de partida). A pele, a corda, as tintas do casco e o latão são fixos. As posições saem de frações da
 * pegada (1 x 1 casa de partida) e os raios do menor meio lado.
 */
import { anel, capsula, caixa, elipse, menos, type Forma } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Um tambor: o meio (frações da meia pegada), o raio (fração do menor meio lado), a altura (casas) e o casco. */
interface Tambor {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly altura: number
  readonly casco: MaterialDaPeca
  /** Pares de corda em volta do aro. */
  readonly cordas: number
  readonly baquetas: boolean
}

const CASCO_VERMELHO: MaterialDaPeca = { classe: 'madeira', rgb: [0x9a, 0x50, 0x46] }
const CASCO_AZUL: MaterialDaPeca = { classe: 'madeira', rgb: [0x52, 0x64, 0x88] }
const CASCO_OCRE: MaterialDaPeca = { classe: 'madeira', rgb: [0xb0, 0x88, 0x50] }

/** Do fundo para a frente (a ordem de pintura): o grande atrás à esquerda, o médio à direita, o pequeno na frente. */
const TAMBORES: readonly Tambor[] = [
  { x: -0.34, y: -0.34, r: 0.57, altura: 0.78, casco: CASCO_VERMELHO, cordas: 10, baquetas: true },
  { x: 0.61, y: -0.43, r: 0.36, altura: 0.58, casco: CASCO_AZUL, cordas: 7, baquetas: false },
  { x: -0.43, y: 0.61, r: 0.33, altura: 0.44, casco: CASCO_OCRE, cordas: 7, baquetas: false },
]
/** O pandeiro deitado na frente à direita: o meio, o raio e a altura do aro (casas). */
const PANDEIRO = { x: 0.47, y: 0.53, r: 0.36, altura: 0.07, platinelas: 5 } as const

/** A pele de couro cru e a corda de tensão. */
const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xcc, 0xa8] }
const CORDA: MaterialDaPeca = materialDaPeca('corda')
const LATAO = materialDaPeca('latao')
/** A baqueta: freixo claro, e a bola da ponta de feltro escuro. */
const FREIXO: MaterialDaPeca = { classe: 'madeira', rgb: [0xc6, 0xa8, 0x78] }
const FELTRO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x6e, 0x5a, 0x4c] }

/** A largura do aro, em fração do raio do tambor, e quanto a pele fica abaixo dele (o recesso). */
const ARO = 0.13

/**
 * A pele: o couro manchado (duas escalas de ruído), a mancha gasta e mais escura no meio, onde a baqueta bate, e o
 * pouco de sombra junto do aro.
 */
function texPele(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const q = Math.hypot(x - cx, y - cy) / r
    const gasta = Math.max(0, 1 - q / 0.42)
    s[3] += ruido(x * 0.16 + p.su, y * 0.16 + p.sv) * 0.07 + ruido(x * 0.6, y * 0.6) * 0.025 - gasta * gasta * 0.16 - (q > 0.86 ? (q - 0.86) * 0.9 : 0)
  }
}

/** Os pares de corda em V por cima do aro: cada perna sai de fora do aro e sobe até a beira da pele. */
function cordasDoAro(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, r: number, pares: number, sem: number): void {
  const fio = { tabua: 0, bisel: 0.35, contorno: 0.3, semente: sem, projeta: { dist: 0.5, forca: 0.3 } }
  const abre = (Math.PI / pares) * 0.42
  for (let i = 0; i < pares; i += 1) {
    const a = (i / pares) * Math.PI * 2 + 0.3
    const de = r * 1.03
    const ate = r * (1 - ARO) * 1.01
    for (const lado of [-1, 1]) {
      const af = a + lado * abre
      L.push(c.peca(capsula(cx + Math.cos(af) * de, cy + Math.sin(af) * de, cx + Math.cos(a) * ate, cy + Math.sin(a) * ate, 0.42), CORDA, { ...fio, eixo: a }))
    }
  }
}

function montarTambor(c: ContextoDoMovel, cena: Cena, t: Tambor, R: number, sem: number): void {
  const P = c.peca
  const L = cena.partes
  const cx = t.x * c.hw
  const cy = t.y * c.hh
  const r = t.r * R
  const pegada = elipse(cx, cy, r * 1.03, r * 1.03)
  cena.sombras.push({ forma: pegada, z: c.g * t.altura }, contato(pegada, 0.32))
  // O casco: a maior peça do tambor (a frente da 3/4 sai pintada), quase todo escondido debaixo do aro.
  L.push(P(elipse(cx, cy, r * 1.035, r * 1.035), t.casco, { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.9, semente: sem }))
  // O aro de madeira, com o veio correndo em volta, e a pele um pouco abaixo dele.
  L.push(P(anel(cx, cy, r, r, r * (1 - ARO), r * (1 - ARO)), c.m.madeira, { polar: { cx, cy, r }, tabua: 0, bisel: r * ARO * 0.45, contorno: 0.3, tom: 1.02, semente: sem + 1 }))
  const rPele = r * (1 - ARO) + 0.2
  L.push(P(elipse(cx, cy, rPele, rPele), PELE, { tabua: 0, bisel: 0.4, contorno: 0.12, textura: texPele(cx, cy, rPele), recesso: { k: 1.6, forca: 0.32 }, semente: sem + 2 }))
  cordasDoAro(c, L, cx, cy, r, t.cordas, sem + 3)
  if (!t.baquetas) return
  // As duas baquetas cruzadas em cima da pele, com a bola de feltro na ponta.
  const baqueta = (a: number, desvio: number, s: number): void => {
    const meio = r * 0.92
    const x0 = cx - Math.cos(a) * meio + Math.sin(a) * desvio
    const y0 = cy - Math.sin(a) * meio - Math.cos(a) * desvio
    const x1 = cx + Math.cos(a) * meio * 0.8 + Math.sin(a) * desvio
    const y1 = cy + Math.sin(a) * meio * 0.8 - Math.cos(a) * desvio
    L.push(P(capsula(x0, y0, x1, y1, 0.85), FREIXO, { tabua: 0, eixo: a, bisel: 0.7, contorno: 0.3, metal: 0.1, semente: s, projeta: { dist: 1.3, forca: 0.4, suave: 0.8 } }))
    L.push(P(elipse(x1, y1, 1.55, 1.55), FELTRO, { tabua: 0, bisel: 1.2, contorno: 0.3, semente: s + 1, projeta: { dist: 1.2, forca: 0.38 } }))
  }
  baqueta(0.62, 1.2, sem + 40)
  baqueta(2.3, -0.6, sem + 42)
}

/** O pandeiro deitado: o aro fino com os rasgos das platinelas, a pele e as platinelas de latão em pares. */
function montarPandeiro(c: ContextoDoMovel, cena: Cena, R: number, sem: number): void {
  const P = c.peca
  const L = cena.partes
  const cx = PANDEIRO.x * c.hw
  const cy = PANDEIRO.y * c.hh
  const r = PANDEIRO.r * R
  const pegada = elipse(cx, cy, r, r)
  cena.sombras.push({ forma: pegada, z: c.g * PANDEIRO.altura }, contato(pegada, 0.3))
  const largura = r * 0.12
  let aro: Forma = anel(cx, cy, r, r, r - largura, r - largura)
  const rasgos: Forma[] = []
  for (let i = 0; i < PANDEIRO.platinelas; i += 1) {
    const a = (i / PANDEIRO.platinelas) * Math.PI * 2 - 0.4
    const rasgo = elipse(cx + Math.cos(a) * (r - largura / 2), cy + Math.sin(a) * (r - largura / 2), largura * 1.4, largura * 1.4)
    rasgos.push(rasgo)
    aro = menos(aro, rasgo)
  }
  L.push(P(elipse(cx, cy, r - largura + 0.3, r - largura + 0.3), PELE, { tabua: 0, bisel: 0.3, contorno: 0.12, tom: 1.04, textura: texPele(cx, cy, r - largura), semente: sem }))
  L.push(P(aro, c.m.madeira, { polar: { cx, cy, r }, tabua: 0, bisel: largura * 0.4, contorno: 0.3, tom: 1.1, semente: sem + 1, projeta: { dist: 0.6, forca: 0.3 } }))
  rasgos.forEach((rasgo, i) => {
    const [x0, y0, x1, y1] = rasgo.b
    const mx = (x0 + x1) / 2
    const my = (y0 + y1) / 2
    const rp = largura * 1.2
    // Duas platinelas por rasgo, uma um pouco por cima da outra.
    L.push(P(elipse(mx + 0.4, my + 0.4, rp, rp), LATAO, { tabua: 0, bisel: rp * 0.6, contorno: 0.3, metal: 0.5, tom: 0.9, semente: sem + 10 + i }))
    L.push(P(elipse(mx - 0.2, my - 0.2, rp, rp), LATAO, { tabua: 0, bisel: rp * 0.6, contorno: 0.3, metal: 0.55, semente: sem + 20 + i, projeta: { dist: 0.5, forca: 0.3 } }))
    L.push(P(caixa(mx - 0.25, my - 0.25, mx + 0.25, my + 0.25), LATAO, { tabua: 0, bisel: 0, contorno: 0.4, tom: 0.6, semente: sem + 30 + i }))
  })
}

export const montarTambores: MontarMovel = (c, cena) => {
  const R = Math.min(c.hw, c.hh)
  montarPandeiro(c, cena, R, 4300)
  TAMBORES.forEach((t, i) => montarTambor(c, cena, t, R, 4400 + i * 60))
}
