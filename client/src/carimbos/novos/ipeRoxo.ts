import type { DefinicaoDeCarimbo, Rgb } from '../embutidos'
import { desenharIpe, paletaDoIpe, type TonsDoIpe } from './_ipe'

/**
 * Ipê roxo (item 120 dos carimbos de 14/11/2026): o desenho em `_ipe.ts`.
 * O roxo puxa para o violeta (e não para o rosa da cerejeira), com a sombra
 * num vinho apagado.
 */

const TONS: TonsDoIpe = { escuro: [112, 66, 110], medio: [156, 98, 156], claro: [200, 150, 196] }

export const carimbo: DefinicaoDeCarimbo = {
  id: 'ipe-roxo',
  nome: 'Ipê roxo',
  tamanho: 15,
  sombra: 'em-pe',
  desenhar: (g, giro, semente) => desenharIpe(g, giro, semente, TONS),
}

export const paleta: readonly Rgb[] = paletaDoIpe(TONS)
