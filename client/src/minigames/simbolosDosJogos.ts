/**
 * O SÍMBOLO DE CADA JOGO, no selo do desafio (mapa do mestre e do jogador,
 * `pixi/drawPins.ts`) e na página Jogos (`components/livro/IconeDoJogo.tsx`).
 * Desenho do protótipo aprovado em 15/11/2026
 * (`tmp/minigame-bau-2026-11-15/prototipo-mestre`, os ícones `danca`,
 * `pesca`, `tiro`, `fogo` e `bolha`), passado para o quadrado normalizado dos
 * símbolos do pino (-1..1, y para baixo): uma forma só para as duas telas.
 */
import type { PinSymbolShape } from '../lib/pins'
import type { JogoDoMinigame } from './tipos'

/** Nota musical: a haste dupla e as duas cabeças. */
const DANCA: PinSymbolShape = {
  strokes: [
    {
      points: [
        { x: -0.25, y: 0.625 },
        { x: -0.25, y: -0.725 },
        { x: 0.8125, y: -0.975 },
        { x: 0.8125, y: 0.375 },
      ],
    },
  ],
  rings: [
    { x: -0.525, y: 0.625, r: 0.275 },
    { x: 0.5375, y: 0.375, r: 0.275 },
  ],
}

/** Anzol: a haste, a curva e a farpa, com o olho em cima. */
const PESCA: PinSymbolShape = {
  strokes: [
    {
      points: [
        { x: 0.375, y: -0.725 },
        { x: 0.375, y: 0.25 },
        { x: 0.3, y: 0.53 },
        { x: 0.094, y: 0.7375 },
        { x: -0.1875, y: 0.8125 },
        { x: -0.469, y: 0.7375 },
        { x: -0.675, y: 0.53 },
        { x: -0.75, y: 0.25 },
        { x: -0.75, y: -0.0375 },
        { x: -0.45, y: 0.2375 },
      ],
    },
  ],
  rings: [{ x: 0.375, y: -0.9625, r: 0.2125 }],
}

/** Alvo: dois anéis e o miolo. */
const TIRO: PinSymbolShape = {
  strokes: [],
  rings: [
    { x: 0, y: 0, r: 0.9375 },
    { x: 0, y: 0, r: 0.5 },
  ],
  dots: [{ x: 0, y: 0, r: 0.16 }],
}

/** Chama: o contorno com a lambida de dentro. */
const FOGO: PinSymbolShape = {
  strokes: [
    {
      closed: true,
      points: [
        { x: 0, y: -1.0625 },
        { x: 0.1875, y: -0.75 },
        { x: 0.475, y: -0.425 },
        { x: 0.6, y: 0.1 },
        { x: 0.525, y: 0.4 },
        { x: 0.3, y: 0.6125 },
        { x: 0, y: 0.7 },
        { x: -0.3, y: 0.6125 },
        { x: -0.525, y: 0.4 },
        { x: -0.6, y: 0.1 },
        { x: -0.525, y: -0.175 },
        { x: -0.3125, y: -0.5 },
        { x: -0.2, y: -0.3 },
        { x: -0.075, y: -0.1125 },
        { x: -0.1, y: -0.4625 },
        { x: -0.05, y: -0.8 },
      ],
    },
  ],
}

/** Bolhas: a grande com o brilho e a pequena subindo. */
const BOLHA: PinSymbolShape = {
  strokes: [
    {
      points: [
        { x: -0.525, y: 0 },
        { x: -0.45, y: -0.175 },
        { x: -0.275, y: -0.2625 },
      ],
    },
  ],
  rings: [
    { x: -0.1875, y: 0.1875, r: 0.6875 },
    { x: 0.6875, y: -0.65, r: 0.3 },
  ],
}

/**
 * Alavanca da ponte (20/11/2026): o sarilho de lado, com os raios e o cubo,
 * e a manivela saindo para cima e à direita. Pela silhueta: a roda com o braço
 * não se confunde com a mira do tiro nem com as bolhas.
 */
const ALAVANCA: PinSymbolShape = {
  strokes: [
    { points: [{ x: -0.72, y: 0.25 }, { x: 0.22, y: 0.25 }] },
    { points: [{ x: -0.25, y: -0.22 }, { x: -0.25, y: 0.72 }] },
    {
      points: [
        { x: -0.25, y: 0.25 },
        { x: 0.55, y: -0.55 },
        { x: 0.88, y: -0.55 },
      ],
    },
  ],
  rings: [
    { x: -0.25, y: 0.25, r: 0.55 },
    { x: -0.25, y: 0.25, r: 0.13 },
  ],
}

/**
 * Peça de quebra-cabeça: o corpo quadrado com o pino em cima e o do lado
 * (puzzles, 19/11/2026). Pela silhueta, não pelo detalhe: não se confunde
 * com a chave nem com o baú dos símbolos do pino, mesmo numa cabeça pequena.
 */
const PUZZLE: PinSymbolShape = {
  strokes: [
    {
      closed: true,
      points: [
        { x: -0.8, y: -0.4 },
        { x: -0.32, y: -0.4 },
        { x: -0.32, y: -0.472 },
        { x: -0.408, y: -0.56 },
        { x: -0.44, y: -0.68 },
        { x: -0.408, y: -0.8 },
        { x: -0.32, y: -0.888 },
        { x: -0.2, y: -0.92 },
        { x: -0.08, y: -0.888 },
        { x: 0.008, y: -0.8 },
        { x: 0.04, y: -0.68 },
        { x: 0.008, y: -0.56 },
        { x: -0.08, y: -0.472 },
        { x: -0.08, y: -0.4 },
        { x: 0.4, y: -0.4 },
        { x: 0.4, y: 0.08 },
        { x: 0.472, y: 0.08 },
        { x: 0.56, y: -0.008 },
        { x: 0.68, y: -0.04 },
        { x: 0.8, y: -0.008 },
        { x: 0.888, y: 0.08 },
        { x: 0.92, y: 0.2 },
        { x: 0.888, y: 0.32 },
        { x: 0.8, y: 0.408 },
        { x: 0.68, y: 0.44 },
        { x: 0.56, y: 0.408 },
        { x: 0.472, y: 0.32 },
        { x: 0.4, y: 0.32 },
        { x: 0.4, y: 0.8 },
        { x: -0.8, y: 0.8 },
      ],
    },
  ],
}

export const SIMBOLO_DO_JOGO: { readonly [J in JogoDoMinigame]: PinSymbolShape } = {
  danca: DANCA,
  pesca: PESCA,
  tiro: TIRO,
  fogo: FOGO,
  bolha: BOLHA,
  alavanca: ALAVANCA,
  puzzle: PUZZLE,
}
