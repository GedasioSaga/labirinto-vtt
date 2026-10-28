import type { Point } from '../../pixi/world'
import { casaDoPonto, centroDaCasa, conferirPasso, menorCaminhoEmBlocos, montarMapaDosBlocos, type Casa, type ParedeDoPasso } from './blocos'

/**
 * MOVIMENTO EM BATALHA (fatia B4 de docs/planos/modo-batalha-2026-10-24.md):
 * o veredito do HOST para o passo de uma ficha de jogador numa cena em
 * batalha. O cliente só mostra.
 *
 * - O destino vai para o centro da casa (ficha de tamanho par vai para o
 *   canto da grade, como no encaixe do arrasto).
 * - Os blocos contam sempre como no `chessboard` (diagonal = 1), pelo menor
 *   caminho legal; a diagonal que raspa a quina de uma parede não vale e o
 *   caminho dá a volta (`lib/batalha/blocos.ts`).
 * - Opção D da "Decisão das paredes" do plano: o caminho é o que o JOGADOR
 *   faria com as paredes que conhece (`paredesDoJogador`, o recorte dele), e o
 *   host o anda com TODAS as paredes (`paredesDoHost`). Se algum passo não vale
 *   no host, a ficha para na última casa legal antes dele: a resposta tem
 *   sempre a mesma forma (aceito, com o lugar e os blocos andados), sem dizer
 *   se foi parede invisível, porta ou chão, e revela no máximo a casa onde parou.
 * - O passo máximo da cena (`passoMaximo`) continua valendo: a ficha anda até
 *   o bloco dele no caminho.
 *
 * Só grade quadrada. Puro: sem store, sem rede, sem Pixi.
 */

/**
 * Teto da busca em blocos: um pedido de coordenada hostil nunca vira busca no
 * mapa inteiro. Passa de qualquer passo de batalha de mesa.
 */
export const LIMITE_DA_BUSCA_EM_BLOCOS = 120

export type RecusaEmBatalha = 'wall' | 'outside_floor' | 'occupied'

export type PassoEmBatalha = { ok: true; x: number; y: number; blocos: number } | { ok: false; reason: RecusaEmBatalha }

export interface PedidoEmBatalha {
  /** Tamanho da casa em px de mundo. */
  grid: number
  /** Casas do mapa na horizontal e na vertical (`MapData.width`, `MapData.height`). */
  colunas: number
  linhas: number
  /** Onde a ficha está e onde o jogador pediu, em px de mundo. */
  de: Point
  para: Point
  /** `Token.size`: a ficha de tamanho par fica no canto da grade. */
  tamanho: number
  /** Passo máximo da cena em blocos; `null` = livre. */
  passoMaximo: number | null
  /** Todas as paredes do piso da ficha, como o mestre as tem. */
  paredesDoHost: readonly ParedeDoPasso[]
  /** As paredes que o jogador conhece (o recorte que ele recebeu), no mesmo piso. */
  paredesDoJogador: readonly ParedeDoPasso[]
  /** O ponto está no chão? (sem chão desenhado, tudo é chão). */
  noChao: (p: Point) => boolean
  /** Outra ficha que conta para "Fichas ocupam espaço" está neste ponto? */
  ocupada: (p: Point) => boolean
}

/** Meia casa para a ficha de tamanho par (ela ocupa o canto); zero para a de tamanho ímpar. */
function deslocamentoDaFicha(tamanho: number, grid: number): number {
  return Number.isInteger(tamanho) && tamanho % 2 === 0 ? grid / 2 : 0
}

/** A casa de referência da ficha em `p`: a que contém o ponto (ou a de cima e à esquerda do canto, na ficha par). */
function casaDaFicha(p: Point, deslocamento: number, grid: number): Casa {
  return casaDoPonto({ x: p.x - deslocamento, y: p.y - deslocamento }, grid)
}

function limitarAoMapa(casa: Casa, colunas: number, linhas: number): Casa {
  const ultimaColuna = Math.max(0, Math.ceil(colunas) - 1)
  const ultimaLinha = Math.max(0, Math.ceil(linhas) - 1)
  return { col: Math.min(ultimaColuna, Math.max(0, casa.col)), row: Math.min(ultimaLinha, Math.max(0, casa.row)) }
}

export function passoEmBatalha(pedido: PedidoEmBatalha): PassoEmBatalha {
  const { grid } = pedido
  const deslocamento = deslocamentoDaFicha(pedido.tamanho, grid)
  const pontoDaCasa = (casa: Casa): Point => {
    const centro = centroDaCasa(casa, grid)
    return { x: centro.x + deslocamento, y: centro.y + deslocamento }
  }
  const origem = casaDaFicha(pedido.de, deslocamento, grid)
  const destino = limitarAoMapa(casaDaFicha(pedido.para, deslocamento, grid), pedido.colunas, pedido.linhas)
  if (!pedido.noChao(pontoDaCasa(destino))) return { ok: false, reason: 'outside_floor' }

  // O caminho que o jogador faria com o que conhece: é o da prévia dele (B6).
  const mapaDoJogador = montarMapaDosBlocos(pedido.paredesDoJogador, grid, pedido.colunas, pedido.linhas)
  const conhecido = menorCaminhoEmBlocos(mapaDoJogador, origem, destino, LIMITE_DA_BUSCA_EM_BLOCOS)
  if (conhecido === null) return { ok: false, reason: 'wall' }
  const caminho = conhecido.caminho
  const ultimo = caminho.length - 1
  const ate = pedido.passoMaximo === null ? ultimo : Math.min(ultimo, Math.max(0, Math.floor(pedido.passoMaximo)))

  // O host anda esse caminho com todas as paredes e para antes do primeiro passo que não vale.
  const mapaDoHost = pedido.paredesDoHost === pedido.paredesDoJogador ? mapaDoJogador : montarMapaDosBlocos(pedido.paredesDoHost, grid, pedido.colunas, pedido.linhas)
  let parada = 0
  for (let k = 1; k <= ate; k += 1) {
    const a = caminho[k - 1]
    const b = caminho[k]
    if (a === undefined || b === undefined) break
    if (conferirPasso(mapaDoHost, a, b) !== 'livre' || !pedido.noChao(pontoDaCasa(b))) break
    parada = k
  }

  // A casa PEDIDA ocupada recusa, como fora da batalha (só depois de saber que o caminho chega lá).
  if (parada === ultimo && pedido.ocupada(pontoDaCasa(destino))) return { ok: false, reason: 'occupied' }
  // Parou antes (passo máximo, ou o host barrou): recua até a última casa livre do caminho.
  while (parada > 0) {
    const casa = caminho[parada]
    if (casa === undefined || !pedido.ocupada(pontoDaCasa(casa))) break
    parada -= 1
  }
  const casaFinal = caminho[parada] ?? origem
  const ponto = pontoDaCasa(casaFinal)
  return { ok: true, x: ponto.x, y: ponto.y, blocos: parada }
}
