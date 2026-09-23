import type { Container } from 'pixi.js'

/**
 * Quem pega o toque na tela do jogador. Só a PRÓPRIA ficha pega: é a única que
 * ele pode mover, e numa sala cheia o dedo caía na do colega — ela andava e o
 * host a devolvia sem explicação. A alheia deixa o toque passar para o palco,
 * que rola o mapa e abre o pino ou a porta que ela cobre.
 */

/** Própria acima das alheias no mesmo lugar: é ela que aparece e que o dedo pega. */
const OWN_TOKEN_Z = 1
const OTHER_TOKEN_Z = 0

/** Camada das fichas: ordena pelo `zIndex` que `applyTokenTouch` dá. */
export function prepareTokenLayer(tokens: Container): void {
  tokens.sortableChildren = true
}

/** Liga ou desliga o toque da ficha conforme ela é do jogador; roda a cada snapshot (a posse muda). */
export function applyTokenTouch(wrapper: Container, own: boolean): void {
  wrapper.eventMode = own ? 'static' : 'none'
  wrapper.cursor = own ? 'grab' : 'default'
  wrapper.zIndex = own ? OWN_TOKEN_Z : OTHER_TOKEN_Z
}
