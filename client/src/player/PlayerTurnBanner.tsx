import type { Token } from '../types/map'

/** Texto que o dono da ficha da vez lê. */
export const YOUR_TURN_TEXT = 'Sua vez'
/** Aviso quando o mestre recusa o arrasto porque não é a vez desta ficha. */
export const WAIT_TURN_TEXT = 'Espere sua vez'
/** Ficha à vista sem nome: não sai "Vez de " pendurado. */
const UNNAMED_TURN_TEXT = 'Vez de outra ficha'

interface PlayerTurnBannerProps {
  /** Id da ficha da vez, como o mestre mandou (só vem o que este jogador vê). */
  turn: string | undefined
  ownTokens: readonly string[]
  /** As fichas do recorte que o jogador recebeu: o nome da vez sai só daqui. */
  tokens: readonly Token[]
}

/**
 * O que a faixa diz. A vez de ficha que NÃO está no recorte do jogador dá o
 * mesmo que ninguém na vez (vazio): "vez do mestre" ou "de outro jogador"
 * contaria que existe alguém escondido agindo agora.
 */
function turnText(turn: string | undefined, ownTokens: readonly string[], tokens: readonly Token[]): string {
  if (turn === undefined) return ''
  if (ownTokens.includes(turn)) return YOUR_TURN_TEXT
  const token = tokens.find((t) => t.id === turn)
  if (token === undefined) return ''
  const name = token.name.trim()
  return name.length > 0 ? `Vez de ${name}` : UNNAMED_TURN_TEXT
}

/**
 * INICIATIVA na tela do jogador: "Sua vez" para o dono da ficha da vez e
 * "Vez de <nome>" quando é de outra ficha que ele vê. A região de anúncio fica
 * montada vazia de propósito: leitor de tela só anuncia o que MUDA dentro de
 * uma região que já existia. Por cima do mapa e fora do fluxo (`position:
 * fixed`): aparecer não redimensiona o canvas nem mexe na câmera.
 */
export function PlayerTurnBanner({ turn, ownTokens, tokens }: PlayerTurnBannerProps) {
  const text = turnText(turn, ownTokens, tokens)
  const mine = text === YOUR_TURN_TEXT
  return (
    <p className={mine ? 'pp-turn' : 'pp-turn pp-turn--other'} role="status" aria-live="polite">
      {text}
    </p>
  )
}

interface TurnWaitNoticeProps {
  /** `id` novo remonta o aviso: a mesma recusa repetida anima e anuncia de novo. */
  notice: { id: number } | undefined
}

/** "Espere sua vez": o mestre recusou o arrasto fora da vez; some sozinho (`playerConnection`). */
export function TurnWaitNotice({ notice }: TurnWaitNoticeProps) {
  if (notice === undefined) return null
  return (
    <p key={notice.id} className="pp-notice" role="status" aria-live="polite">
      {WAIT_TURN_TEXT}
    </p>
  )
}
