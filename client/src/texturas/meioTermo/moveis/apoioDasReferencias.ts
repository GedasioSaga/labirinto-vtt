/**
 * APOIO do lote L2 das referências (16/11/2026): o que a coluna quebrada, o altar redondo, o carro antigo, a cadeira
 * de espaldar alto, a prateleira de toalhas e o centro de mesa usam para montar as duas vistas na pilha de fatias
 * (`pilhaDeFatias.ts`). Não é um objeto: não tem registro nem ficha.
 */
import type { Rgb } from '../../ruido'
import { poligono, type Forma, type Ponto } from './formas'
import type { MaterialDaPeca, Sombra, Textura } from './motor'
import { naTela, rumoDaSombra, type OpcoesDaFatia } from './pilhaDeFatias'

/**
 * O escuro da pedra (o do altar e do pilar): um cinza quente, de luminância linear 0,056. Com o escuro de sempre (o
 * da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
export const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** A cera da vela, a mesma do altar retangular: creme, sem brilho. */
export const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }

/** A chama: o miolo quente; a textura dela é toda emissão (não pega luz nem sombra). */
export const CHAMA: MaterialDaPeca = { classe: 'liso', rgb: [0xff, 0xc8, 0x70] }

/**
 * A luz de uma face de normal (nx, ny, nz) no objeto, NA TELA (`q` = o quarto de volta que as duas vistas pintam):
 * vem de cima à esquerda, como a do motor, e de cima. A frente da 3/4 (a face virada para baixo na tela) sai mais
 * escura, como o `TOM_DA_FRENTE` das colunas.
 */
export function luzDaNormal(nx: number, ny: number, nz: number, q: number): number {
  const [sx, sy] = naTela(nx, ny, q)
  return -0.11 * sx - 0.07 * sy + 0.05 * nz
}

/** O círculo com a distância exata (uma raiz só). */
export function disco(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.hypot(x - cx, y - cy) - r }
}

/** A fatia de dentro da pilha: sem chanfro nem contorno (cada corte ganharia um risco), com a luz na textura. */
export function lisa(tom: number, textura: Textura | undefined, semente: number): OpcoesDaFatia {
  return textura === undefined ? { tabua: 0, bisel: 0, contorno: 0, tom, semente } : { tabua: 0, bisel: 0, contorno: 0, tom, textura, semente }
}

/**
 * A sombra no chão de uma peça alta e fina (o espaldar, a estante): o retângulo (x0, y0)-(x1, y1) do objeto VARRIDO
 * do pé até a sombra do alto `z`, sem buraco no meio. A `sombraNoAr` só leva o retângulo para longe, e a sombra de um
 * espaldar virava um risco solto ao lado da cadeira.
 */
export function sombraVarrida(x0: number, y0: number, x1: number, y1: number, z: number, q: number, forca: number, suave: number): Sombra {
  const [rx, ry] = rumoDaSombra(q)
  const [dx, dy] = [rx * z, ry * z]
  const cantos: Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  return { forma: poligono(envoltoria([...cantos, ...cantos.map(([x, y]): Ponto => [x + dx, y + dy])])), z: 0, forca, suave }
}

/** O contorno convexo dos pontos (a cadeia monótona), na ordem da volta. */
function envoltoria(pontos: readonly Ponto[]): Ponto[] {
  const ordem = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const vira = (o: Ponto, a: Ponto, b: Ponto) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]) => {
    const h: Ponto[] = []
    for (const p of lista) {
      while (h.length >= 2 && vira(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop()
      h.push(p)
    }
    h.pop()
    return h
  }
  return [...metade(ordem), ...metade([...ordem].reverse())]
}

/** A textura que é só emissão (a chama, o brilho do cristal): `forca` da cor que não pega luz. */
export function acesa(forca: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[4] = forca
  }
}
