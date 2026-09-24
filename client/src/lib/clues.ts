import type { HostWorld, PinClueState } from '../net/hostSession'
import type { PartyMember } from './party'
import { PIN_GLYPH, pinMasterLabel } from './pins'

/**
 * O PAINEL PISTAS (aba Jogo): antes do confronto, o mestre olha quem recebeu
 * e quem leu cada pista, em vez de anotar no papel. Uma linha por pino "!" ou
 * "?" de todas as cenas abertas; uma bolinha por jogador. Lógica pura, no
 * molde de `lib/party.ts`: lê o mundo que o host serve, o que a sessão contou
 * (`PinClueState`) e o "Quem vê" de cada pino — nunca a store.
 */

/** A bolinha: vazia (não recebeu), meia (recebeu) ou cheia (leu). */
export type ClueDotState = 'nada' | 'recebeu' | 'leu'

export interface ClueDot {
  playerId: string
  name: string
  /** `#rrggbb` da ficha do jogador; `null` = sem ficha (a bolinha fica neutra). */
  color: string | null
  state: ClueDotState
  /** O "Quem vê" do pino deixa este jogador de fora: a pista está escondida dele. */
  hidden: boolean
}

export interface ClueRow {
  pinId: string
  /** "!" ou "?", o glifo que o mestre vê no mapa. */
  glyph: string
  /** Como o mestre nomeia o pino, igual à lista Pinos (`pinMasterLabel`): o nome só dele, ou o resumo. */
  label: string
  /** Cena do pino; `null` = mapa solto. É o que o "centrar" abre. */
  sceneId: string | null
  sceneName: string | null
  x: number
  y: number
  dots: ClueDot[]
}

function dotState(clue: PinClueState | undefined, playerId: string): ClueDotState {
  if (clue === undefined) return 'nada'
  if (clue.read.includes(playerId)) return 'leu'
  return clue.received.includes(playerId) ? 'recebeu' : 'nada'
}

/**
 * As linhas do painel, na ordem das cenas (a aberta primeiro, como o resto da
 * aba Jogo) e dos pinos dentro de cada uma. Pino de viagem não é pista: fica
 * de fora. As bolinhas seguem a ordem da sala (`members`).
 */
export function clueRows(
  world: HostWorld,
  members: readonly PartyMember[],
  clues: Readonly<Record<string, PinClueState>>,
  audiences: Readonly<Record<string, readonly string[]>>,
): ClueRow[] {
  const rows: ClueRow[] = []
  for (const scene of [world.open, ...world.background]) {
    for (const pin of scene.map.pins) {
      if (pin.kind === 'viagem') continue
      const clue = clues[pin.id]
      const audience = audiences[pin.id]
      rows.push({
        pinId: pin.id,
        glyph: PIN_GLYPH[pin.kind],
        label: pinMasterLabel(pin),
        sceneId: scene.sceneId,
        sceneName: scene.sceneId === null ? null : scene.name,
        x: pin.x,
        y: pin.y,
        dots: members.map((member) => ({
          playerId: member.playerId,
          name: member.name,
          color: member.token === null ? null : member.token.color,
          state: dotState(clue, member.playerId),
          hidden: audience !== undefined && !audience.includes(member.playerId),
        })),
      })
    }
  }
  return rows
}

/**
 * O "Quem vê" novo depois de clicar na bolinha de `playerId`: quem via deixa
 * de ver, quem não via passa a ver. `current === null` é "Todos". Quando todo
 * jogador da sala volta a ver, a lista some (`null`): o pino volta a ser de
 * todos, inclusive de quem entrar depois.
 */
export function toggledAudience(current: readonly string[] | null, everyone: readonly string[], playerId: string): string[] | null {
  const seeing = current === null ? [...everyone] : [...current]
  const next = seeing.includes(playerId) ? seeing.filter((id) => id !== playerId) : [...seeing, playerId]
  const all = everyone.length > 0 && everyone.every((id) => next.includes(id))
  return all ? null : next
}

/** O título do painel, com a contagem que o mestre confere de relance. */
export function cluesHeading(count: number): string {
  return `Pistas (${count})`
}

const DOT_STATE_TEXT: Record<ClueDotState, string> = {
  nada: 'não recebeu',
  recebeu: 'recebeu',
  leu: 'leu',
}

/** Nome da bolinha para o leitor de tela e para o teste: "Gabi: leu". */
export function clueDotLabel(dot: ClueDot): string {
  const base = `${dot.name}: ${DOT_STATE_TEXT[dot.state]}`
  return dot.hidden ? `${base}, escondida` : base
}
