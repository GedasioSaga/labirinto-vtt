/**
 * PILAR DE OSSOS (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Inferno): a
 * coluna do ossário, como as das capelas de ossos. A BASE e o CAPITEL de pedra lavrada; entre eles, o FUSTE montado
 * com ossos: fileiras de CABEÇAS DE FÊMUR (os nós redondos que ficam para fora da parede de ossos), a faixa de TRÊS
 * CAVEIRAS no meio, os dois OSSOS COMPRIDOS deitados de lado a lado, mais fileiras de nós; no alto do capitel, a
 * CAVEIRA da coroa, maior. Entre os ossos, o escuro fundo dos vãos.
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`, como o crânio e a estaca com crânio): de cima, um pilar é um
 * quadrado; o que diz "pilar de ossos" são as caveiras e os nós empilhados. O fuste é redondo: o lado da luz (à
 * esquerda) clareia e o de lá escurece por cima dos ossos. As caveiras são a `caveiraDeFrente` da estaca com crânio
 * (`estacaComCranio.ts`), o mesmo marfim velho dos ossos de hoje.
 *
 * A sombra no chão sai do pé, curta, para baixo à direita; a sombra de baixo forte é a da 3/4 em pé. O desenho é feito
 * em 56 x 56 px (uma casa) e escala com o menor lado. Material: `pedra` (a base e o capitel); os ossos são fixos.
 */
import type { Rgb } from '../../ruido'
import { capsula, caixa, elipse, uniao } from './formas'
import type { Cena, MaterialDaPeca, Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { caveiraDeFrente, ESCURO_DO_OSSO, texDoOssoVelho } from './estacaComCranio'

/** O lado do desenho (px do protótipo): uma casa. */
const LADO_DO_DESENHO = 56

// ---------- as medidas (px do desenho, meio da pegada em 0, 0; y para baixo) ----------

/** A base e o capitel: a meia largura, o alto do tampo, onde o tampo vira frente e o pé. */
const BASE = { meia: 12.6, tampo: 18.4, frente: 21, pe: 26 }
const CAPITEL = { meia: 12.2, tampo: -18.2, frente: -15.8, pe: -11.6 }
/** O fuste: a meia largura, de onde (embaixo) até onde (em cima). */
/** Na 1ª folha (28/11/2026) o fuste tinha 11,6 de meia largura e o pilar lia armário de caveiras. */
const FUSTE = { meia: 9.4, pe: 18.8, alto: -12 }
/** As fileiras de nós (cabeças de fêmur): o y de cada uma e se começa meio passo deslocada. */
const FILEIRAS_DE_NOS: readonly (readonly [number, boolean])[] = [
  [16, false],
  [12.6, true],
  [-5.4, false],
  [-8.8, true],
]
const RAIO_DO_NO = 1.75
const NOS_POR_FILEIRA = 5
/** A faixa das três caveiras: o y do meio da cúpula, os x e a escala (unidades do crânio). */
const FAIXA_DAS_CAVEIRAS = { y: 6.2, xs: [-6.1, 0, 6.1], escala: 0.27 }
/** Os dois ossos compridos deitados: o y de cada um e o raio. */
const OSSOS_DEITADOS: readonly number[] = [0.5, -1.9]
const RAIO_DO_OSSO_DEITADO = 1.05
/** A caveira da coroa, no alto do capitel. */
const COROA = { y: -21.9, escala: 0.4 }
/** A altura (px) com que a sombra sai do pé. */
const ALTURA_DA_SOMBRA = 28

// ---------- as cores (fixas) ----------

const TOM_DO_OSSO: Rgb = [0xd2, 0xc6, 0xaa]
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_OSSO }
/** O escuro dos vãos entre os ossos. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x42, 0x3a] }
/** O que escurece o lado de lá do fuste redondo (e clareia o lado da luz). */
const SOMBRA_DO_FUSTE: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x28, 0x24] }
const LUZ_DO_FUSTE: MaterialDaPeca = { classe: 'liso', rgb: [0xf0, 0xe8, 0xd8] }

/** Sorteio fixo de 0 a 1 por índice: o mesmo pilar em toda tela. */
function sorteio(i: number, semente: number): number {
  const s = Math.sin(i * 127.1 + semente * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O fuste redondo: escurece do meio para a direita (o lado de lá da luz). */
function texSombraDoFuste(k: number): Textura {
  return (_u, _v, x, _y, _p, s) => {
    const t = Math.min(1, Math.max(0, (x / k + 1) / (FUSTE.meia + 1)))
    s[5] *= t * t * 0.5
  }
}

/** O lado da luz do fuste: a faixa clara à esquerda do meio, que some para os dois lados. */
function texLuzDoFuste(k: number): Textura {
  return (_u, _v, x, _y, _p, s) => {
    const d = (x / k + 6) / 4.2
    s[5] *= Math.max(0, 1 - d * d) * 0.16
  }
}

/** A base e o capitel de pedra: a frente mais escura, o tampo mais claro. */
function pedras(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  for (const [i, p] of [BASE, CAPITEL].entries()) {
    cena.partes.push(P(caixa(-p.meia * k, p.frente * k, p.meia * k, p.pe * k, 0.8 * k), c.m.pedra, { bisel: 1.2 * k, tabua: 0, tom: 0.82, contorno: 0.3, semente: 9600 + i }))
    cena.partes.push(P(caixa(-p.meia * k, p.tampo * k, p.meia * k, (p.frente + 0.4) * k, 0.8 * k), c.m.pedra, { bisel: 0.9 * k, tabua: 0, tom: 1.08, contorno: 0.28, semente: 9602 + i, projeta: { dist: 1 * k, forca: 0.3 } }))
  }
}

/** Os ossos do fuste: o fundo escuro dos vãos, as fileiras de nós, as caveiras e os ossos deitados, e a luz redonda. */
function fuste(c: ContextoDoMovel, cena: Cena, k: number): void {
  const P = c.peca
  const L = cena.partes
  const corpo = caixa(-FUSTE.meia * k, FUSTE.alto * k, FUSTE.meia * k, FUSTE.pe * k, 1.2 * k)
  L.push(P(corpo, VAO, { bisel: 1.2 * k, contorno: 0.3, semente: 9610 }))
  const osso = texDoOssoVelho(k)
  const passo = (2 * (FUSTE.meia - RAIO_DO_NO)) / (NOS_POR_FILEIRA - 1)
  FILEIRAS_DE_NOS.forEach(([y, meio], f) => {
    const n = meio ? NOS_POR_FILEIRA - 1 : NOS_POR_FILEIRA
    for (let i = 0; i < n; i += 1) {
      const x = -FUSTE.meia + RAIO_DO_NO + passo * (i + (meio ? 0.5 : 0))
      const r = RAIO_DO_NO * (0.92 + 0.16 * sorteio(f * 10 + i, 1))
      // O nó é a cabeça dupla do fêmur: duas bolas coladas, uma um nada maior.
      const no = uniao(elipse((x - 0.35) * k, y * k, r * k, r * 0.92 * k), elipse((x + 0.55) * k, (y + 0.2) * k, r * 0.78 * k, r * 0.74 * k))
      L.push(P(no, OSSO, { bisel: r * 0.9 * k, tom: 0.92 + 0.14 * sorteio(f * 10 + i, 2), contorno: 0.28, textura: osso, semente: 9620 + f * 10 + i, projeta: { dist: 0.5 * k, forca: 0.32 } }))
    }
  })
  for (const [i, y] of OSSOS_DEITADOS.entries()) {
    const r = RAIO_DO_OSSO_DEITADO
    const ponta = FUSTE.meia - 1.2
    const deitado = uniao(capsula(-ponta * k, y * k, ponta * k, y * k, r * k), uniao(elipse(-ponta * k, y * k, r * 1.45 * k, r * 1.3 * k), elipse(ponta * k, y * k, r * 1.45 * k, r * 1.3 * k)))
    L.push(P(deitado, OSSO, { bisel: r * 0.9 * k, tom: 0.97 + i * 0.05, contorno: 0.28, textura: osso, semente: 9670 + i, projeta: { dist: 0.5 * k, forca: 0.32 } }))
  }
  FAIXA_DAS_CAVEIRAS.xs.forEach((x, i) => {
    caveiraDeFrente(P, L, x * k, FAIXA_DAS_CAVEIRAS.y * k, FAIXA_DAS_CAVEIRAS.escala * k, (i - 1) * 0.05, 9680 + i * 20, 0.96)
  })
  L.push(P(corpo, SOMBRA_DO_FUSTE, { bisel: 0, contorno: 0, textura: texSombraDoFuste(k), semente: 9740 }))
  L.push(P(corpo, LUZ_DO_FUSTE, { bisel: 0, contorno: 0, textura: texLuzDoFuste(k), semente: 9741 }))
}

/** PILAR DE OSSOS (sem versões): a base, o fuste de ossos, o capitel e a caveira da coroa. */
export const montarPilarDeOssos: MontarMovel = (c, cena) => {
  const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
  cena.corDoPiso = ESCURO_DO_OSSO
  // Sem contato, mais estreita que a base e saindo de dentro dela: a sombra de baixo é a da 3/4 em pé
  // (`tresQuartos.ts`, que a folha confere). Larga como a base, o arrasto cobria todo o chão logo abaixo do pé e a
  // sombra de baixo (que soma pelo máximo) não aparecia (1ª e 2ª folhas, 28/11/2026).
  const base = elipse(0, (BASE.pe - 4) * k, (FUSTE.meia + 1) * k, 2 * k)
  cena.sombras.push({ forma: base, z: ALTURA_DA_SOMBRA * k, suave: 1.4, forca: 0.18 })
  fuste(c, cena, k)
  pedras(c, cena, k)
  caveiraDeFrente(c.peca, cena.partes, 0.4 * k, COROA.y * k, COROA.escala * k, -0.06, 9760)
}
