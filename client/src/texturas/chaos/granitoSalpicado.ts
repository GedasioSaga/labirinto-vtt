import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, vizinhos, type Rgb } from '../ruido'

/**
 * GRANITO SALPICADO (lista de 24/11/2026, item 113; o chão dos corredores da arena do mapa 7): granito cinza-chumbo
 * de grão fino, SEM JUNTA (a pedra corre inteira, como um piso polido e gasto), salpicado de pontos claros (o quartzo
 * e o feldspato), pontos escuros (a mica) e grãos de meio-tom. Por baixo, nuvens largas e fracas, umas mais escuras e
 * outras mais claras, para o corredor comprido não virar uma cor chapada.
 *
 * Os grãos são pontos de célula (`vizinhos`) em duas camadas, a graúda e a miúda, cada um com o tipo, o tamanho, o
 * alongado e o rumo sorteados: nenhum grão sai círculo perfeito e a grade das células não aparece. Em cada ponto
 * vale o grão que mais cobre (a ordem das células não muda a cor).
 *
 * Diferente das vizinhas: o Concreto é liso e pardo, sem grão; o Mármore tem veio; o Cascalho é de pedrinhas
 * soltas. Aqui o desenho é só o salpicado.
 */

const SEMENTE = 11300

/** O cinza-chumbo do granito (um nada azulado, croma 0,03) e as nuvens largas, a escura e a clara. */
const BASE = rgb('#56595d')
const NUVEM_ESCURA = rgb('#4b4e52')
const NUVEM_CLARA = rgb('#606367')
/** Os grãos: o quartzo claro (cinza, nunca branco), a mica escura e o meio-tom. */
const CLARO = rgb('#9b9b96')
const ESCURO = rgb('#2c2e31')
const MEIO = rgb('#73767a')

interface Grao {
  readonly cor: Rgb
  /** O sorteio da célula abaixo deste número cai neste grão (os grãos em ordem, acumulando). */
  readonly ate: number
  /** O raio, em células, e o quanto o grão cobre o fundo no miolo. */
  readonly raio: readonly [number, number]
  readonly forca: number
}

/** A camada graúda: 11 células por casa. */
const GRAUDOS = {
  celulas: 88,
  graos: [
    { cor: CLARO, ate: 0.17, raio: [0.15, 0.28], forca: 0.72 },
    { cor: ESCURO, ate: 0.41, raio: [0.1, 0.2], forca: 0.66 },
    { cor: MEIO, ate: 0.68, raio: [0.14, 0.26], forca: 0.55 },
  ] as readonly Grao[],
} as const
/** A camada miúda: 19 células por casa, mais escura que clara. */
const MIUDOS = {
  celulas: 152,
  graos: [
    { cor: CLARO, ate: 0.1, raio: [0.12, 0.2], forca: 0.6 },
    { cor: ESCURO, ate: 0.36, raio: [0.1, 0.18], forca: 0.55 },
    { cor: MEIO, ate: 0.62, raio: [0.1, 0.2], forca: 0.45 },
  ] as readonly Grao[],
} as const
/** O quanto o ponto do grão foge do meio da célula (0 a 0,5). */
const FOLGA = 0.42
/** As nuvens largas e o grão fino de fundo (pixel a pixel, fraco: abaixo dele é chuvisco). */
const NUVEM = 0.7
const MANCHA = 0.03
const GRAO_FINO = 0.05

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** O fundo coberto pelo grão que mais cobre o ponto, entre os das 3 x 3 células em volta. */
function salpicar(c: Rgb, u: number, v: number, celulas: number, semente: number, graos: readonly Grao[]): Rgb {
  let melhor = 0
  let cor: Rgb = c
  vizinhos(u, v, celulas, semente, FOLGA, (p) => {
    const sorte = hash(p.ix, p.iy, semente + 1)
    let grao: Grao | null = null
    for (const g of graos) {
      if (sorte < g.ate) {
        grao = g
        break
      }
    }
    if (grao === null) return
    const raio = grao.raio[0] + (grao.raio[1] - grao.raio[0]) * hash(p.ix, p.iy, semente + 2)
    // Alongado num rumo sorteado: o grão de pedra nunca sai redondo.
    const rumo = hash(p.ix, p.iy, semente + 3) * Math.PI
    const alonga = 0.65 + 0.8 * hash(p.ix, p.iy, semente + 4)
    const ca = Math.cos(rumo)
    const sa = Math.sin(rumo)
    const ao = p.dx * ca + p.dy * sa
    const atravessado = -p.dx * sa + p.dy * ca
    const d = Math.sqrt((ao * ao) / alonga + atravessado * atravessado * alonga)
    const cobre = passoSuave(raio, raio * 0.45, d) * grao.forca
    if (cobre > melhor) {
      melhor = cobre
      cor = grao.cor
    }
  })
  return melhor > 0 ? misturar(c, cor, melhor) : c
}

/** A cor do granito salpicado no ponto (u, v) do ladrilho de 8 casas. */
export function texturaGranitoSalpicado(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // As nuvens largas: umas puxam para o escuro, outras para o claro (contínuo no zero).
  const nuvem = fbm(uu, vv, 5, 3, SEMENTE)
  let c = misturar(BASE, nuvem > 0 ? NUVEM_ESCURA : NUVEM_CLARA, Math.min(1, Math.abs(nuvem) * 1.2) * NUVEM)
  c = luz(c, fbm(uu, vv, 20, 2, SEMENTE + 1) * MANCHA + (valor(uu * 384, vv * 384, 384, SEMENTE + 2) - 0.5) * GRAO_FINO)
  c = salpicar(c, uu, vv, GRAUDOS.celulas, SEMENTE + 10, GRAUDOS.graos)
  c = salpicar(c, uu, vv, MIUDOS.celulas, SEMENTE + 20, MIUDOS.graos)
  return empacotar(c)
}
