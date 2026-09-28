import type { FloorPiece } from '../types/map'

/**
 * CHÃO POR CAMADA (pedido de 28/09/2026: "um chão é mar e outro é chão
 * normal"). Cada peça de chão já tem cor própria (`FloorPiece.fillColor`) e a
 * ordem da lista já decide quem fica por cima (`buildColorLayers`). O que
 * faltava era escolher a camada ANTES de pintar e ver as camadas numa lista.
 * Não há campo novo no mapa: a camada de uma peça é a cor dela, e o jogador
 * continua recebendo só a cor que já recebia.
 */
export type CamadaDoChao = 'chao' | 'mar' | 'grama' | 'terra' | 'pedra' | 'lava'

export interface CamadaDoChaoInfo {
  id: CamadaDoChao
  label: string
  /** `null` = a peça segue a "Cor do chão" do mapa. */
  color: string | null
  description: string
}

export const CAMADAS_DO_CHAO: readonly CamadaDoChaoInfo[] = [
  { id: 'chao', label: 'Chão', color: null, description: 'A peça usa a cor do chão do mapa.' },
  { id: 'mar', label: 'Mar', color: '#2f6690', description: 'Água azul, por baixo ou ao lado do chão.' },
  { id: 'grama', label: 'Grama', color: '#4a6b35', description: 'Chão verde de campo.' },
  { id: 'terra', label: 'Terra', color: '#7a5a3c', description: 'Chão de terra batida.' },
  { id: 'pedra', label: 'Pedra', color: '#6e6e72', description: 'Piso cinza de pedra.' },
  { id: 'lava', label: 'Lava', color: '#b0431c', description: 'Rio ou poça de lava.' },
]

export function corDaCamada(camada: CamadaDoChao): string | null {
  return CAMADAS_DO_CHAO.find((c) => c.id === camada)?.color ?? null
}

/** Peça nova pintada na camada escolhida. Buraco (`subtract`) não tem cor. */
export function pecaNaCamada(piece: FloorPiece, camada: CamadaDoChao): FloorPiece {
  const color = corDaCamada(camada)
  if (color === null || piece.op !== 'add') return piece
  return { ...piece, fillColor: color }
}

/** Nome da camada de uma peça: o da camada cuja cor ela tem, ou "Chão" / "Cor própria". */
export function nomeDaCamadaDaPeca(piece: FloorPiece): string {
  if (piece.op === 'subtract') return 'Buraco'
  if (piece.fillColor === undefined) return 'Chão'
  const cor = piece.fillColor.toLowerCase()
  return CAMADAS_DO_CHAO.find((c) => c.color !== null && c.color.toLowerCase() === cor)?.label ?? 'Cor própria'
}

export interface LinhaDeCamada {
  id: string
  /** "Mar", "Mar 2"... — o número separa peças da mesma camada. */
  nome: string
  op: FloorPiece['op']
  /** Cor que aparece na tela (a do mapa quando a peça não tem cor própria). */
  cor: string
  locked: boolean
  /** Posição na ordem de aplicação (0 = primeira, a de baixo). */
  index: number
}

/**
 * Linhas da lista "Camadas do chão", DE CIMA PARA BAIXO: a primeira linha é a
 * última peça aplicada, a que aparece por cima — como numa lista de camadas
 * de editor de imagem.
 */
export function linhasDeCamada(floor: readonly FloorPiece[], corDoChao: string): LinhaDeCamada[] {
  const vistos = new Map<string, number>()
  const linhas = floor.map((piece, index) => {
    const base = nomeDaCamadaDaPeca(piece)
    const n = (vistos.get(base) ?? 0) + 1
    vistos.set(base, n)
    return {
      id: piece.id,
      nome: n === 1 ? base : `${base} ${n}`,
      op: piece.op,
      cor: piece.fillColor ?? corDoChao,
      locked: piece.locked === true,
      index,
    }
  })
  return linhas.reverse()
}
