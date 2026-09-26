import type { MapData } from '../types/map'

/**
 * ONDE VI O COLEGA PELA ÚLTIMA VEZ. A ficha alheia que sai do pacote do
 * jogador (andou para fora da visão, entrou atrás de uma porta, foi para outra
 * cena) deixa um contorno apagado no último ponto em que ele a RECEBEU, com
 * "há N s", até ela voltar, a cena mudar ou passarem 2 minutos.
 *
 * A memória é só do cliente: nada novo sai do host, e o que fica guardado é o
 * que o recorte (`lib/fogFilter.ts`) já entregou — posição, tamanho e o nome
 * público que chegaram. Por isso o contorno nunca conta onde a ficha está
 * AGORA, nem o que a névoa, a zona oculta ou o mestre esconderam.
 */

/** Quanto tempo o contorno fica na tela depois que a ficha sai da visão. */
export const LAST_SEEN_TTL_MS = 120_000

/** Rótulo da camada no `world` da PlayerView: é por ele que o teste a acha. */
export const LAST_SEEN_LAYER_LABEL = 'ultimo-avistamento'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/** Como a ficha estava no último pacote em que chegou. */
export interface SeenToken {
  /** O nome como chegou (o público; `''` = sem rótulo). */
  readonly name: string
  readonly x: number
  readonly y: number
  readonly size: number
  /** Direção do último passo visto, em radianos (`atan2`, y para baixo); `null` = nunca a viu andar. */
  readonly heading: number | null
}

export interface LastSeenGhost extends SeenToken {
  readonly tokenId: string
  /** `Date.now()` do pacote em que a ficha deixou de chegar. */
  readonly lostAt: number
}

export interface LastSeenMemory {
  /** Cena dos pacotes lembrados; `null` = nenhum ainda. */
  readonly mapId: string | null
  /** Fichas alheias do último pacote, por id. */
  readonly seen: ReadonlyMap<string, SeenToken>
  /** Fichas que saíram do pacote nesta cena, por id. */
  readonly ghosts: ReadonlyMap<string, LastSeenGhost>
}

export const EMPTY_LAST_SEEN: LastSeenMemory = { mapId: null, seen: new Map(), ghosts: new Map() }

function headingOf(before: SeenToken | undefined, x: number, y: number): number | null {
  if (before === undefined) return null
  const dx = x - before.x
  const dy = y - before.y
  // Parada entre dois pacotes: vale o passo de antes.
  if (dx === 0 && dy === 0) return before.heading
  return Math.atan2(dy, dx)
}

function isLive(ghost: LastSeenGhost, now: number): boolean {
  return now - ghost.lostAt < LAST_SEEN_TTL_MS
}

/**
 * Lembra o pacote que acabou de chegar. Ficha alheia que estava no pacote
 * anterior e não está neste vira contorno; a que voltou apaga o dela; a do
 * próprio jogador nunca entra. Cena nova começa do zero: o contorno é de um
 * ponto DESTA cena.
 */
export function rememberSnapshot(
  memory: LastSeenMemory,
  snapshot: Pick<MapData, 'id' | 'tokens'>,
  ownTokenIds: readonly string[],
  now: number,
): LastSeenMemory {
  const own = new Set(ownTokenIds)
  const sameScene = memory.mapId === snapshot.id
  const before = sameScene ? memory.seen : new Map<string, SeenToken>()
  const seen = new Map<string, SeenToken>()
  for (const token of snapshot.tokens) {
    if (own.has(token.id)) continue
    seen.set(token.id, { name: token.name, x: token.x, y: token.y, size: token.size, heading: headingOf(before.get(token.id), token.x, token.y) })
  }
  const ghosts = new Map<string, LastSeenGhost>()
  if (sameScene) {
    for (const [id, ghost] of memory.ghosts) {
      if (!seen.has(id) && !own.has(id) && isLive(ghost, now)) ghosts.set(id, ghost)
    }
  }
  for (const [id, last] of before) {
    if (seen.has(id) || own.has(id)) continue
    ghosts.set(id, { tokenId: id, ...last, lostAt: now })
  }
  return { mapId: snapshot.id, seen, ghosts }
}

/** Tira da memória os contornos vencidos; nada vencido = a mesma memória (o chamador compara por referência). */
export function forgetExpired(memory: LastSeenMemory, now: number): LastSeenMemory {
  const live = liveGhosts(memory, now)
  if (live.length === memory.ghosts.size) return memory
  return { ...memory, ghosts: new Map(live.map((ghost) => [ghost.tokenId, ghost])) }
}

/** Contornos ainda na tela neste instante. */
export function liveGhosts(memory: LastSeenMemory, now: number): LastSeenGhost[] {
  return [...memory.ghosts.values()].filter((ghost) => isLive(ghost, now))
}

/** "Ana · há 12 s", "há 1 min": o nome só quando existe e os nomes estão ligados. */
export function lastSeenLabel(ghost: LastSeenGhost, now: number, showName: boolean): string {
  const seconds = Math.max(0, Math.floor((now - ghost.lostAt) / MS_PER_SECOND))
  const age = seconds < SECONDS_PER_MINUTE ? `há ${seconds} s` : `há ${Math.floor(seconds / SECONDS_PER_MINUTE)} min`
  return showName && ghost.name !== '' ? `${ghost.name} · ${age}` : age
}
