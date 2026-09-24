/**
 * AGIR SOBRE UMA FICHA: o jogador toca na ficha de outro (NPC ou colega) e
 * pede ao mestre uma ação sobre ela. A lista é fechada: o host recusa qualquer
 * outra palavra, e o texto livre vai no campo `text`, não num tipo inventado.
 */

// `as const` só congela a lista em tupla literal (é dela que sai o tipo `TokenAction`); não converte tipo nenhum.
export const TOKEN_ACTIONS = ['falar', 'oferecer', 'pedir', 'empurrar', 'outro'] as const

export type TokenAction = (typeof TOKEN_ACTIONS)[number]

/** Rótulo do botão no cartão do jogador e do pedido na Caixa do mestre. */
export const TOKEN_ACTION_LABELS: Record<TokenAction, string> = {
  falar: 'Falar',
  oferecer: 'Oferecer',
  pedir: 'Pedir ajuda',
  empurrar: 'Empurrar',
  outro: 'Outro',
}

/** O que o campo de texto pergunta em cada ação. */
export const TOKEN_ACTION_PROMPTS: Record<TokenAction, string> = {
  falar: 'O que você diz',
  oferecer: 'O que você oferece, e em troca de quê',
  pedir: 'O que você pede',
  empurrar: 'Para onde, ou como (opcional)',
  outro: 'O que você quer fazer',
}

/** Ações que não fazem sentido sem texto: o botão "Enviar" espera o jogador escrever. */
export const TOKEN_ACTIONS_NEED_TEXT: ReadonlySet<TokenAction> = new Set<TokenAction>(['falar', 'outro'])

/** Teto do texto do pedido, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const TOKEN_ACTION_TEXT_MAX_LENGTH = 120

/**
 * Teto da RESPOSTA do mestre ("o que Severa diz"), em unidades UTF-16: cabe
 * uma fala de NPC, não um capítulo. O campo do aviso e o parser contam igual.
 */
export const TOKEN_ACTION_REPLY_MAX_LENGTH = 280

/**
 * A resposta do mestre aparada e cortada no teto. Não deixa meia letra no fim
 * (emoji partido ao meio vira losango de erro na tela do jogador). `''` = sem resposta.
 */
export function clampTokenActionReply(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= TOKEN_ACTION_REPLY_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, TOKEN_ACTION_REPLY_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return (last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut).trimEnd()
}

export function isTokenAction(value: unknown): value is TokenAction {
  return TOKEN_ACTIONS.some((action) => action === value)
}

/**
 * Por que o host recusou o pedido SEM levar ao mestre. Genérico de propósito,
 * como o do pino de viagem: ficha que não existe, no escuro, em outra cena,
 * escondida pelo mestre ou do próprio jogador respondem todas `unavailable` —
 * um motivo por caso diria o que existe onde ele não vê. `pending`: já há um
 * pedido dele esperando; `too_soon`: pediu de novo antes do intervalo mínimo.
 */
export type TokenActionRejection = 'unavailable' | 'pending' | 'too_soon'

export function isTokenActionRejection(value: unknown): value is TokenActionRejection {
  return value === 'unavailable' || value === 'pending' || value === 'too_soon'
}

/** Distância em casas entre dois pontos do mapa (px de mundo), arredondada: é o que o mestre lê. */
export function distanceInCells(a: { x: number; y: number }, b: { x: number; y: number }, grid: number): number {
  if (!(grid > 0)) return 0
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) / grid)
}

/** "a 1 casa", "a 3 casas", "colado" — o trecho de distância do pedido na Caixa. */
export function distanceLabel(cells: number): string {
  if (cells <= 0) return 'colado'
  return cells === 1 ? 'a 1 casa' : `a ${cells} casas`
}
