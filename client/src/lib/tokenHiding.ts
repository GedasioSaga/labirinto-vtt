import type { Token } from '../types/map'

/**
 * ESCONDER-SE na tela do jogador: a própria ficha oculta para jogadores
 * (`secret`) sai esmaecida — é assim que o dono sabe que os outros não o veem.
 * Mesma opacidade do item secreto no editor do mestre (`SECRET_ITEM_ALPHA`).
 */
export const HIDDEN_OWN_TOKEN_ALPHA = 0.5

/**
 * Opacidade de uma ficha na tela do jogador. Só a DELE esmaece: ficha de
 * outro que chegasse marcada sairia inteira — esmaecê-la contaria que ela é
 * segredo.
 */
export function playerTokenAlpha(token: Pick<Token, 'secret'>, own: boolean): number {
  return own && token.secret === true ? HIDDEN_OWN_TOKEN_ALPHA : 1
}
