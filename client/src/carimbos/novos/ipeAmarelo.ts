import type { DefinicaoDeCarimbo, Rgb } from '../embutidos'
import { desenharIpe, paletaDoIpe, type TonsDoIpe } from './_ipe'

/**
 * Ipê amarelo (item 120 dos carimbos de 14/11/2026): o desenho em `_ipe.ts`.
 * O amarelo é o ouro do ipê, contido (saturação abaixo do teto), puxando
 * para o ocre na sombra para não estourar no verde do mapa.
 */

const TONS: TonsDoIpe = { escuro: [168, 128, 58], medio: [210, 170, 76], claro: [232, 208, 132] }

export const carimbo: DefinicaoDeCarimbo = {
  id: 'ipe-amarelo',
  nome: 'Ipê amarelo',
  tamanho: 15,
  sombra: 'em-pe',
  desenhar: (g, giro, semente) => desenharIpe(g, giro, semente, TONS),
}

export const paleta: readonly Rgb[] = paletaDoIpe(TONS)
