import type { CamadaId, MapData } from '../types/map'
import { contextoDoJogador } from '../lib/camadas/doJogador'
import { ehCamadaPadrao } from '../lib/camadas/padrao'

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
 *
 * CAMADA ESCONDIDA APAGA O AVISTAMENTO (decisão do usuário, fatias 3b/4b): a
 * ficha que some porque o mestre escondeu a camada dela dos jogadores não vira
 * contorno, e o contorno que já existia some. A camada sumiu quando sai da
 * lista do pacote (`camadasDoJogador`; ausente = só as padrão, menos as de
 * `hiddenLayers` no mapa de antes). Livre que esvazia também sai da lista: a
 * ficha que era a única dela e saiu da visão perde o contorno (nada vaza).
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
  /**
   * A camada de cada ficha lembrada (vista ou contorno), por id: a do pacote
   * em que chegou por último. Fora do contorno de propósito: ele é só a forma.
   */
  readonly camadas: ReadonlyMap<string, CamadaId>
}

export const EMPTY_LAST_SEEN: LastSeenMemory = { mapId: null, seen: new Map(), ghosts: new Map(), camadas: new Map() }

/** A camada da ficha sem camada escolhida. */
const CAMADA_DAS_FICHAS: CamadaId = 'tokens'

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

/** Os campos do pacote que dizem que camadas o jogador vê. */
type CamposDoPacote = Pick<MapData, 'camadasDoJogador'> & Partial<Pick<MapData, 'hiddenLayers'>>

/** A camada ainda está no pacote: na lista dele, ou (lista ausente) é padrão e não está oculta no sentido antigo. */
function camadaNoPacote(camada: CamadaId, pacote: CamposDoPacote): boolean {
  const lista = pacote.camadasDoJogador
  if (lista !== undefined) return lista.some((c) => c.id === camada)
  // `hiddenLayers` ausente (pacote sem o campo) = nada oculto no sentido antigo.
  return ehCamadaPadrao(camada) && !(pacote.hiddenLayers ?? []).includes(camada)
}

/**
 * Lembra o pacote que acabou de chegar. Ficha alheia que estava no pacote
 * anterior e não está neste vira contorno; a que voltou apaga o dela; a do
 * próprio jogador nunca entra. Cena nova começa do zero: o contorno é de um
 * ponto DESTA cena. A ficha (ou o contorno) cuja camada saiu do pacote não
 * fica como contorno: camada escondida apaga o avistamento.
 */
export function rememberSnapshot(
  memory: LastSeenMemory,
  snapshot: Pick<MapData, 'id' | 'tokens'> & CamposDoPacote,
  ownTokenIds: readonly string[],
  now: number,
): LastSeenMemory {
  const own = new Set(ownTokenIds)
  const sameScene = memory.mapId === snapshot.id
  const before = sameScene ? memory.seen : new Map<string, SeenToken>()
  const camadasAntes = sameScene ? memory.camadas : new Map<string, CamadaId>()
  // Toda ficha lembrada tem camada; uma que não tenha (não deveria acontecer) vale a padrão das fichas.
  const camadaAntes = (id: string): CamadaId => camadasAntes.get(id) ?? CAMADA_DAS_FICHAS
  const seen = new Map<string, SeenToken>()
  const camadas = new Map<string, CamadaId>()
  const contexto = contextoDoJogador(snapshot)
  for (const token of snapshot.tokens) {
    if (own.has(token.id)) continue
    seen.set(token.id, { name: token.name, x: token.x, y: token.y, size: token.size, heading: headingOf(before.get(token.id), token.x, token.y) })
    camadas.set(token.id, contexto.camadaDe('ficha', token))
  }
  const ghosts = new Map<string, LastSeenGhost>()
  const guardar = (ghost: LastSeenGhost): void => {
    ghosts.set(ghost.tokenId, ghost)
    camadas.set(ghost.tokenId, camadaAntes(ghost.tokenId))
  }
  if (sameScene) {
    for (const [id, ghost] of memory.ghosts) {
      if (!seen.has(id) && !own.has(id) && isLive(ghost, now) && camadaNoPacote(camadaAntes(id), snapshot)) guardar(ghost)
    }
  }
  for (const [id, last] of before) {
    if (seen.has(id) || own.has(id) || !camadaNoPacote(camadaAntes(id), snapshot)) continue
    guardar({ tokenId: id, ...last, lostAt: now })
  }
  return { mapId: snapshot.id, seen, ghosts, camadas }
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
export function lastSeenLabel(ghost: Pick<LastSeenGhost, 'name' | 'lostAt'>, now: number, showName: boolean): string {
  const seconds = Math.max(0, Math.floor((now - ghost.lostAt) / MS_PER_SECOND))
  const age = seconds < SECONDS_PER_MINUTE ? `há ${seconds} s` : `há ${Math.floor(seconds / SECONDS_PER_MINUTE)} min`
  return showName && ghost.name !== '' ? `${ghost.name} · ${age}` : age
}
