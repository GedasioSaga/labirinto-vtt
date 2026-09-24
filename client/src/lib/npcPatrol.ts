import type { MapData, RegionPoint, Token, TokenPatrol } from '../types/map'

/**
 * ROTA DE PATRULHA — regras compartilhadas pelo painel do mestre, pelo desenho
 * da rota no editor e pelo recorte do jogador. Puro: sem DOM, sem Pixi, sem store.
 *
 * O mestre marca a rota pondo a ficha do NPC em cima de cada ponto e clicando
 * "Marcar ponto aqui". "Avançar patrulha" leva o NPC ao ponto seguinte ao
 * último alcançado; do último volta ao primeiro (ronda em circuito). O passo é
 * a decisão do mestre sobre onde o NPC está: não pergunta à parede, igual a
 * quando ele arrasta a ficha segurando a regra de movimento de lado.
 */

/** Teto de pontos numa rota: ronda de verdade tem poucos; o teto segura arquivo torto. */
export const PATROL_MAX_POINTS = 64

/** O que o painel pede à rota da ficha. */
export type PatrolOp = 'marcar' | 'desfazer' | 'apagar' | 'avancar'

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readPoint(raw: unknown): RegionPoint | null {
  if (typeof raw !== 'object' || raw === null) return null
  const x: unknown = Reflect.get(raw, 'x')
  const y: unknown = Reflect.get(raw, 'y')
  return finite(x) && finite(y) ? { x, y } : null
}

/**
 * A rota como vale para andar e desenhar. O mapa do disco chega cru
 * (`lib/mapFile.ts`): ponto torto sai, `atual` fora da faixa volta para dentro,
 * e texto enfiado no objeto fica de fora. Sem ponto válido, `null` (ficha comum).
 */
export function readTokenPatrol(raw: unknown): TokenPatrol | null {
  if (typeof raw !== 'object' || raw === null) return null
  const rawPoints: unknown = Reflect.get(raw, 'pontos')
  if (!Array.isArray(rawPoints)) return null
  const pontos = rawPoints.flatMap((p: unknown) => {
    const point = readPoint(p)
    return point === null ? [] : [point]
  }).slice(0, PATROL_MAX_POINTS)
  if (pontos.length === 0) return null
  const rawAtual: unknown = Reflect.get(raw, 'atual')
  const atual = finite(rawAtual) ? Math.min(pontos.length - 1, Math.max(0, Math.round(rawAtual))) : 0
  return { pontos, atual }
}

/** A rota de uma ficha, ou `null` se ela não patrulha. */
export function tokenPatrolOf(token: { patrulha?: unknown }): TokenPatrol | null {
  return readTokenPatrol(token.patrulha)
}

/** A ficha com a rota trocada; `null` tira o campo (a ficha volta a ser comum, sem `patrulha: null` gravado). */
function withPatrol(token: Token, patrol: TokenPatrol | null): Token {
  if (patrol !== null) return { ...token, patrulha: patrol }
  const { patrulha: _rota, ...rest } = token
  return rest
}

/** A ficha depois da operação, ou a MESMA instância quando nada muda. */
function tokenAfterOp(token: Token, op: PatrolOp): Token {
  const patrol = tokenPatrolOf(token)
  switch (op) {
    case 'marcar': {
      const pontos = patrol?.pontos ?? []
      if (pontos.length >= PATROL_MAX_POINTS) return token
      return withPatrol(token, { pontos: [...pontos, { x: token.x, y: token.y }], atual: pontos.length })
    }
    case 'desfazer': {
      if (patrol === null) return token
      const pontos = patrol.pontos.slice(0, -1)
      return withPatrol(token, pontos.length === 0 ? null : { pontos, atual: Math.min(patrol.atual, pontos.length - 1) })
    }
    case 'apagar':
      return 'patrulha' in token ? withPatrol(token, null) : token
    case 'avancar': {
      if (patrol === null || patrol.pontos.length < 2) return token
      const atual = (patrol.atual + 1) % patrol.pontos.length
      const destino = patrol.pontos[atual]
      if (destino === undefined) return token
      return { ...withPatrol(token, { ...patrol, atual }), x: destino.x, y: destino.y }
    }
  }
}

/**
 * Aplica `op` à rota da ficha `tokenId`. Devolve o mapa pela MESMA referência
 * quando nada muda (ficha que não existe, sem rota para andar, rota cheia) —
 * é o que deixa o store não gastar entrada de histórico à toa.
 */
export function applyPatrolOp(map: MapData, tokenId: string, op: PatrolOp): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  const token = map.tokens[index]
  if (token === undefined) return map
  const next = tokenAfterOp(token, op)
  if (next === token) return map
  const tokens = [...map.tokens]
  tokens[index] = next
  return { ...map, tokens }
}

/** A ficha como o jogador pode recebê-la: a rota NUNCA vai. Sem rota, a mesma instância. */
export function tokenPatrolForPlayer(token: Token): Token {
  return 'patrulha' in token ? withPatrol(token, null) : token
}
