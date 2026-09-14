import type { FloorPiece, MapFrame } from '../src/types/map'
import type { Crop } from './compareMasks'
import { MAPA1_PIECES } from './pieces/mapa1'
import { MAPA2_PIECES } from './pieces/mapa2'
import { MAPA3_PIECES } from './pieces/mapa3'

export interface RecreateTarget {
  /** Nome de saída em `Tentativa/`. */
  name: string
  /** Arquivo em `Objetivo/`. */
  file: string
  width: number
  height: number
  /** Área comparada: a imagem inteira ("frame por frame"). */
  crop: Crop
  /** Onde as ferramentas de vetorizar olham: o conteúdo do mapa, sem a moldura. */
  traceRect: Crop
  frame: MapFrame | null
  /** Peças escritas à mão; vazio = vetoriza a imagem com a ferramenta do app. */
  pieces: FloorPiece[]
}

export const TARGETS: RecreateTarget[] = [
  {
    name: 'mapa1',
    file: 'Mapa1.png',
    width: 836,
    height: 866,
    crop: { x: 0, y: 0, w: 836, h: 866 },
    traceRect: { x: 36, y: 1, w: 798, h: 862 },
    // Janela medida pixel a pixel: ver lib/mapFrame.ts (MINIMAP_FRAME_STYLE).
    frame: { title: 'Village Lake', x: 36, y: 1, w: 798, h: 862 },
    pieces: MAPA1_PIECES,
  },
  {
    name: 'mapa2',
    file: 'mapa2.png',
    width: 525,
    height: 766,
    crop: { x: 0, y: 0, w: 525, h: 766 },
    traceRect: { x: 0, y: 0, w: 525, h: 766 },
    frame: null,
    pieces: MAPA2_PIECES,
  },
  {
    name: 'mapa3',
    file: 'Mapa3.png',
    width: 574,
    height: 939,
    crop: { x: 0, y: 0, w: 574, h: 939 },
    traceRect: { x: 0, y: 0, w: 574, h: 939 },
    frame: null,
    pieces: MAPA3_PIECES,
  },
]

/** Critério da etapa 1 (silhueta), decidido com o usuário: "tem que ser realmente igual". */
export const SILHOUETTE_MIN_IOU = 0.97
