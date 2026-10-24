import type { MapData, Token } from '../types/map'
import type { Point } from '../pixi/world'
import { caminhoConhecido, isPointKnown, type KnownArea } from './knownPath'
import { MAX_PATH_SAMPLES } from './moveValidation'
import { findOccupant, tokensOccupy } from './movementRules'

/**
 * CLICAR PARA ANDAR (CAMINHOS F2). O jogador clica no chão e a ficha anda até
 * lá pelo que ele conhece; o caminho sai daqui (cliente) e o host valida cada
 * trecho, que vai MARCADO (`caminhada: true`). A marca só acrescenta recusas
 * no host: a chave da cena desligada e o trecho fora do conhecido.
 *
 * A chave é do mestre, por cena (`MapData.cliqueParaAndar`): ausente = ligada.
 */

/** As recusas que só o trecho marcado recebe do host. */
export type MotivoDaCaminhada = 'caminhada_desligada' | 'nevoa'

/** Por que o clique não virou caminhada (o aviso do rodapé). */
export type AvisoDoClique = 'caminhada_desligada' | 'caminho_desconhecido' | 'occupied'

export type PlanoDaCaminhada = { tipo: 'andar'; trechos: Point[]; destino: Point } | { tipo: 'aviso'; motivo: AvisoDoClique }

/** Casas em volta do destino ocupado onde se procura uma livre (anel quadrado). */
const RAIO_DA_BUSCA_EM_CASAS = 2
/** Teto de buscas de caminho para as casas livres: cada uma custa uma consulta ao motor. */
const MAX_CASAS_TENTADAS = 8
/** Amostras do trecho por casa: o passo com que o host confere o chão (`moveValidation`). */
const AMOSTRAS_POR_CASA = 4

/** Ausente = ligada: só `false` desliga. */
export function cliqueParaAndarLigado(map: Pick<MapData, 'cliqueParaAndar'>): boolean {
  return map.cliqueParaAndar !== false
}

/**
 * A cena com a chave em `ligado`. Ligar TIRA o campo (o mapa volta ao de
 * antes, e o arquivo salva igual); o mesmo valor devolve o mesmo mapa (sem
 * passo vazio no desfazer).
 */
export function comCliqueParaAndar(map: MapData, ligado: boolean): MapData {
  if (ligado) {
    if (map.cliqueParaAndar === undefined) return map
    const { cliqueParaAndar: _antes, ...resto } = map
    return resto
  }
  return map.cliqueParaAndar === false ? map : { ...map, cliqueParaAndar: false }
}

/**
 * O trecho de `de` até `para` fica todo no que o jogador conhece (visão de
 * agora ou memória, fora de zona oculta)? É a conferência do HOST no trecho
 * marcado: amostra no mesmo passo do chão (`moveValidation`), sem a origem
 * (a ficha já está lá). Mais frouxa que a máscara do cliente (que confere os
 * cantos de cada amostra), então trecho que o cliente calculou passa.
 */
export function trechoNoConhecido(map: Pick<MapData, 'grid'>, de: Point, para: Point, area: KnownArea): boolean {
  if (![de.x, de.y, para.x, para.y].every(Number.isFinite)) return false
  const passo = Math.max(map.grid / AMOSTRAS_POR_CASA, 1)
  const querido = Math.ceil(Math.hypot(para.x - de.x, para.y - de.y) / passo)
  // Coordenada hostil (longe demais) não vira laço gigante no host: além do teto, recusa.
  if (!Number.isFinite(querido) || querido > MAX_PATH_SAMPLES) return false
  const amostras = Math.max(1, querido)
  for (let k = 1; k <= amostras; k += 1) {
    const t = k / amostras
    if (!isPointKnown(area, { x: de.x + (para.x - de.x) * t, y: de.y + (para.y - de.y) * t })) return false
  }
  return true
}

/**
 * Centros das casas a até `RAIO_DA_BUSCA_EM_CASAS` da casa do `alvo`, do mais
 * perto ao mais longe do ponto clicado (empate: a ordem da varredura, de cima
 * para baixo e da esquerda para a direita).
 */
function casasEmVolta(map: Pick<MapData, 'grid' | 'width' | 'height'>, alvo: Point): Point[] {
  const coluna = Math.floor(alvo.x / map.grid)
  const linha = Math.floor(alvo.y / map.grid)
  const casas: Point[] = []
  for (let dy = -RAIO_DA_BUSCA_EM_CASAS; dy <= RAIO_DA_BUSCA_EM_CASAS; dy += 1) {
    for (let dx = -RAIO_DA_BUSCA_EM_CASAS; dx <= RAIO_DA_BUSCA_EM_CASAS; dx += 1) {
      const c = coluna + dx
      const l = linha + dy
      if (c < 0 || l < 0 || c >= map.width || l >= map.height) continue
      casas.push({ x: (c + 0.5) * map.grid, y: (l + 0.5) * map.grid })
    }
  }
  return casas.sort((a, b) => Math.hypot(a.x - alvo.x, a.y - alvo.y) - Math.hypot(b.x - alvo.x, b.y - alvo.y))
}

/**
 * O plano do clique em `alvo` para a ficha `quemAnda`, só com o que a tela
 * conhece. Chave desligada: aviso. Destino ocupado (a cena liga "Fichas ocupam
 * espaço" e há ficha VISTA ali): a casa livre mais próxima do clique que tem
 * caminho conhecido, em vez da recusa `occupied` do host.
 */
export function planejarCaminhada(map: MapData, quemAnda: Token, alvo: Point, area: KnownArea): PlanoDaCaminhada {
  if (!cliqueParaAndarLigado(map)) return { tipo: 'aviso', motivo: 'caminhada_desligada' }
  const ocupado = (p: Point): boolean => tokensOccupy(map) && findOccupant(map.tokens, quemAnda.id, p, map.grid) !== undefined
  const destinoPedido = { x: Math.round(alvo.x), y: Math.round(alvo.y) }
  if (!ocupado(destinoPedido)) {
    const r = caminhoConhecido(map, quemAnda, destinoPedido, area)
    return r.tipo === 'caminho' ? { tipo: 'andar', trechos: r.trechos, destino: destinoPedido } : { tipo: 'aviso', motivo: 'caminho_desconhecido' }
  }
  let tentadas = 0
  for (const casa of casasEmVolta(map, alvo)) {
    if (tentadas >= MAX_CASAS_TENTADAS) break
    const destino = { x: Math.round(casa.x), y: Math.round(casa.y) }
    if (ocupado(destino) || !isPointKnown(area, destino)) continue
    tentadas += 1
    const r = caminhoConhecido(map, quemAnda, destino, area)
    if (r.tipo === 'caminho') return { tipo: 'andar', trechos: r.trechos, destino }
  }
  return { tipo: 'aviso', motivo: 'occupied' }
}
