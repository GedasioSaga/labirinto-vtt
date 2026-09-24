import type { RegionPoint, Token } from '../types/map'
import type { TokenAction, TokenActionRejection } from '../lib/tokenActions'

/**
 * CARTÃO DA FICHA ALHEIA: o toque curto numa ficha que não é do jogador abre o
 * cartão dela. As fichas alheias não pegam o toque (`tokenTouch.ts`: ele passa
 * para o palco, que rola o mapa); é o palco que pergunta, no toque parado,
 * se havia uma ficha alheia sob o dedo.
 */

/** O raio desenhado da ficha, o mesmo de `PlayerView` (meia casa por tamanho, nunca menos de 4 px). */
function tokenRadius(token: Token, grid: number): number {
  return Math.max((grid / 2) * token.size, 4)
}

/**
 * Ficha ALHEIA sob o ponto do mundo, da desenhada por último para a primeira
 * (a de cima ganha). `tolerance` engorda o alvo para o dedo, em px de mundo.
 * A própria nunca: ela é arrastada, não lida.
 */
export function findOtherTokenAt(tokens: readonly Token[], ownTokens: readonly string[], point: RegionPoint, grid: number, tolerance: number): Token | null {
  const own = new Set(ownTokens)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (own.has(token.id)) continue
    if (Math.hypot(point.x - token.x, point.y - token.y) <= tokenRadius(token, grid) + tolerance) return token
  }
  return null
}

/** O nome no cartão: o que o jogador vê. O mestre escondeu o nome ("Nome para os jogadores" vazio)? "Alguém". */
export function tokenCardName(token: Token): string {
  const name = token.name.trim()
  return name === '' ? 'Alguém' : name
}

/**
 * Onde está o pedido de ação: esperando o mestre, ou a resposta. `waiting`
 * fica até a resposta; as outras somem sozinhas. `targetName` é o nome que o
 * JOGADOR viu no cartão — o host nunca manda o nome de volta. `reply`: o que o
 * mestre escreveu só para ele (o que o NPC responde); com ele, a resposta vira
 * cartão e fica até o jogador fechar.
 */
export type TokenActionNotice =
  | { id: number; phase: 'waiting'; action: TokenAction; targetName: string }
  | { id: number; phase: 'accepted' | 'refused'; action: TokenAction; targetName: string; reply?: string }
  | { id: number; phase: 'rejected'; reason: TokenActionRejection; action: TokenAction; targetName: string }

/** A ação dita com a ficha, como frase: "Falar com Severa", "Empurrar Severa". */
export function tokenActionPhrase(action: TokenAction, targetName: string): string {
  switch (action) {
    case 'falar':
      return `Falar com ${targetName}`
    case 'oferecer':
      return `Oferecer a ${targetName}`
    case 'pedir':
      return `Pedir ajuda a ${targetName}`
    case 'empurrar':
      return `Empurrar ${targetName}`
    case 'outro':
      return `Agir sobre ${targetName}`
  }
}

const REJECTION_TEXT: Record<TokenActionRejection, string> = {
  unavailable: 'Não dá para fazer isso agora.',
  pending: 'Você já tem um pedido esperando o mestre.',
  too_soon: 'Espere um instante antes de pedir de novo.',
}

/** O texto do mestre, quando a resposta trouxe um; `null` = só o aviso curto. */
export function tokenActionReply(notice: TokenActionNotice): string | null {
  return (notice.phase === 'accepted' || notice.phase === 'refused') && notice.reply !== undefined ? notice.reply : null
}

/** O aviso de baixo da tela para cada fase do pedido (e o título do cartão da resposta em texto). */
export function tokenActionNoticeText(notice: TokenActionNotice): string {
  const phrase = tokenActionPhrase(notice.action, notice.targetName)
  switch (notice.phase) {
    case 'waiting':
      return `Pedido ao mestre: ${phrase}. Aguardando…`
    case 'accepted':
      return `O mestre aceitou: ${phrase}`
    case 'refused':
      return `O mestre recusou: ${phrase}`
    case 'rejected':
      return REJECTION_TEXT[notice.reason]
  }
}
