import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, vizinhos, type Rgb } from './ruido'

/**
 * CASCALHO (pedido CHÃO E CAMINHO de 12/11/2026): pedrinhas soltas e miúdas
 * sobre terra clara batida, o material do caminho de cascalho do Chão
 * (`lib/terrenoDoChao.ts`). Cores do protótipo aprovado
 * (`docs/design/chao-e-caminho/prototipo-chao-e-caminho.html`): a pedra do
 * Meio-Termo (#c3c0b2), a pedrinha da Terra (#a89574) e dois cinzas mais
 * fundos, sobre o fundo de terra e pedra moída. Luz de cima à esquerda, a
 * sombra caindo para baixo à direita, como as pedrinhas da Terra.
 */

const FUNDO: Rgb = [178, 158, 122]
const FUNDO_ESCURO: Rgb = [160, 140, 106]
const TONS: readonly Rgb[] = [rgb('#c3c0b2'), rgb('#a89574'), rgb('#9c968a'), rgb('#b5ad9c')]
/** Lado do ladrilho em casas da grade: 10 pedrinhas por casa (~7 px de mundo na casa de 70 px). */
export const CASCALHO_CASAS = 4
/** Pedrinhas por lado do ladrilho. */
const CELULAS = 40
/** Quantas células ficam sem pedrinha (o fundo aparece entre elas). */
const VAZIAS = 0.14

interface Pedrinha {
  t: number
  nx: number
  ny: number
  tom: Rgb
}

function pedrinhaEm(u: number, v: number): Pedrinha | null {
  let achada: Pedrinha | null = null
  vizinhos(u, v, CELULAS, 501, 0.3, (p) => {
    if (hash(p.ix, p.iy, 502) < VAZIAS) return
    const r = 0.34 + hash(p.ix, p.iy, 503) * 0.22
    const d = Math.hypot(p.dx, p.dy)
    if (d >= r) return
    if (achada === null || d / r < achada.t) {
      achada = { t: d / r, nx: p.dx / r, ny: p.dy / r, tom: TONS[Math.floor(hash(p.ix, p.iy, 504) * TONS.length) % TONS.length] }
    }
  })
  return achada
}

/** A cor do cascalho no ponto (u, v) do ladrilho. */
export function cascalho(u: number, v: number): number {
  let fundo = misturar(FUNDO, FUNDO_ESCURO, passoSuave(0.35, 0.8, fbm(u, v, 6, 3, 505) * 0.5 + 0.5))
  fundo = luz(fundo, (valor(u * 200, v * 200, 200, 506) - 0.5) * 0.08)
  const pedra = pedrinhaEm(u, v)
  if (pedra === null) {
    const sombra = pedrinhaEm(u - 0.004, v - 0.004)
    return empacotar(sombra === null ? fundo : luz(fundo, -0.16 * passoSuave(1, 0.55, sombra.t)))
  }
  const brilho = luzNaInclinacao(pedra.nx * 1.3, pedra.ny * 1.3) - LUZ_NO_PLANO
  const cor = luz(pedra.tom, brilho * 0.35 - pedra.t * pedra.t * 0.06)
  return empacotar(misturar(fundo, cor, passoSuave(1, 0.82, pedra.t)))
}
