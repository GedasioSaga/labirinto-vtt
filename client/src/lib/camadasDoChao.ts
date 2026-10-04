import type { FloorPiece } from '../types/map'

/**
 * CHÃO POR CAMADA (pedido de 28/09/2026: "um chão é mar e outro é chão
 * normal"). Cada peça de chão já tem cor própria (`FloorPiece.fillColor`) e a
 * ordem da lista já decide quem fica por cima (`buildColorLayers`). O que
 * faltava era escolher a camada ANTES de pintar e ver as camadas numa lista.
 * A "tinta" de uma peça é a cor dela, e o jogador continua recebendo só a
 * cor que já recebia. As camadas do pincel (03/10/2026, mais abaixo) somam
 * só `FloorPiece.nome`, que o recorte do jogador tira.
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

/**
 * CAMADA DO PINCEL (pedido de 03/10/2026: "crie camadas para as ferramentas
 * de pincel, uma fica em cima da outra"). Cada camada é UMA peça de blocos que
 * soma chão: o pincel e o balde pintam nela, e a ordem da lista — a mesma de
 * sempre — decide quem cobre quem. Não há estrutura paralela: a lista
 * "Camadas do chão" já era a lista das peças.
 */
export function ehCamadaDoPincel(piece: FloorPiece): boolean {
  return piece.shape.kind === 'blocos' && piece.op === 'add'
}

const PREFIXO_DE_CAMADA = 'Camada'
const NOME_DE_CAMADA = /^Camada (\d+)$/

/**
 * Nome da camada do pincel na tela: o que o mestre deu (`nome`) ou "Camada N",
 * com N pela posição entre as camadas do pincel, de baixo para cima — a folha
 * única de um mapa antigo vira "Camada 1".
 */
function nomesDasCamadasDoPincel(floor: readonly FloorPiece[]): Map<string, string> {
  const nomes = new Map<string, string>()
  let n = 0
  for (const piece of floor) {
    if (!ehCamadaDoPincel(piece)) continue
    n += 1
    nomes.set(piece.id, piece.nome ?? `${PREFIXO_DE_CAMADA} ${n}`)
  }
  return nomes
}

/** Nome de uma camada nova: "Camada N", um a mais que o maior N que já aparece. */
export function proximoNomeDeCamada(floor: readonly FloorPiece[]): string {
  let maior = 0
  for (const nome of nomesDasCamadasDoPincel(floor).values()) {
    const numero = NOME_DE_CAMADA.exec(nome)
    if (numero) maior = Math.max(maior, Number(numero[1]))
  }
  return `${PREFIXO_DE_CAMADA} ${maior + 1}`
}

/** Nome que a peça mostra na lista e nos avisos. */
export function nomeDaPeca(floor: readonly FloorPiece[], piece: FloorPiece): string {
  return linhasDeCamada(floor, '').find((linha) => linha.id === piece.id)?.nome ?? nomeDaCamadaDaPeca(piece)
}

export interface LinhaDeCamada {
  id: string
  /** "Camada 2", "Mar", "Mar 2"... — o número separa peças da mesma camada. */
  nome: string
  op: FloorPiece['op']
  /** Cor que aparece na tela (a do mapa quando a peça não tem cor própria). */
  cor: string
  locked: boolean
  hidden: boolean
  /** Camada do pincel: é nela que o pincel e o balde podem pintar. */
  pincel: boolean
  /** Posição na ordem de aplicação (0 = primeira, a de baixo). */
  index: number
}

/**
 * Linhas da lista "Camadas do chão", DE CIMA PARA BAIXO: a primeira linha é a
 * última peça aplicada, a que aparece por cima — como numa lista de camadas
 * de editor de imagem.
 */
export function linhasDeCamada(floor: readonly FloorPiece[], corDoChao: string): LinhaDeCamada[] {
  const doPincel = nomesDasCamadasDoPincel(floor)
  const vistos = new Map<string, number>()
  const linhas = floor.map((piece, index) => {
    const automatico = (): string => {
      const base = nomeDaCamadaDaPeca(piece)
      const n = (vistos.get(base) ?? 0) + 1
      vistos.set(base, n)
      return n === 1 ? base : `${base} ${n}`
    }
    return {
      id: piece.id,
      nome: doPincel.get(piece.id) ?? piece.nome ?? automatico(),
      op: piece.op,
      cor: piece.fillColor ?? corDoChao,
      locked: piece.locked === true,
      hidden: piece.hidden === true,
      pincel: doPincel.has(piece.id),
      index,
    }
  })
  return linhas.reverse()
}
