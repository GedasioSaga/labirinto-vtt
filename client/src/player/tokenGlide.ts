/**
 * Deslize curto da ficha na tela do jogador: quando a ficha de alguém muda de
 * lugar (o mestre arrastou, outro jogador andou), ela vai do ponto antigo ao
 * novo em linha reta em vez de piscar de um ao outro.
 *
 * Lógica pura, sem Pixi: o render (PlayerView) pergunta "onde desenho esta
 * ficha agora?" a cada redraw e a cada quadro do ticker. Os casos em que a
 * ficha NÃO desliza são decididos por quem chama (`animate: false`): troca de
 * cena, ficha que acabou de aparecer, a ficha sob o dedo e movimento reduzido.
 */

/** Duração do deslize: dentro da faixa de 150-250 ms pedida pela feature. */
export const TOKEN_GLIDE_MS = 240

/** Deslocamento menor que isto não anima: é o arredondamento do fim do próprio arrasto. */
const MIN_GLIDE_DISTANCE = 1

export interface GlidePoint {
  x: number
  y: number
}

export interface GlideTrack {
  fromX: number
  fromY: number
  toX: number
  toY: number
  /** Instante de início, no mesmo relógio de `now` (performance.now()). */
  start: number
}

/** Fichas em deslize agora, por id. Ficha parada não tem entrada. */
export type TokenGlides = Map<string, GlideTrack>

export function createTokenGlides(): TokenGlides {
  return new Map()
}

/** Sai rápido e assenta devagar: começa a andar no mesmo quadro em que o movimento chega. */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/** Onde o deslize está em `now`; `done` quando já chegou. */
export function glidePosition(track: GlideTrack, now: number): GlidePoint & { done: boolean } {
  const elapsed = now - track.start
  if (elapsed >= TOKEN_GLIDE_MS) return { x: track.toX, y: track.toY, done: true }
  const k = easeOutQuad(Math.max(0, elapsed) / TOKEN_GLIDE_MS)
  return { x: track.fromX + (track.toX - track.fromX) * k, y: track.fromY + (track.toY - track.fromY) * k, done: false }
}

export interface GlideSync {
  /** Onde a ficha está desenhada agora; `null` se ela não estava na tela (acabou de aparecer). */
  shown: GlidePoint | null
  /** Onde o mapa diz que a ficha está. */
  target: GlidePoint
  now: number
  /** `false` = vai direto ao alvo (troca de cena, ficha sob o dedo, movimento reduzido). */
  animate: boolean
}

/**
 * Novo alvo de uma ficha, vindo do mapa. Devolve onde desenhá-la agora.
 * Alvo igual ao do deslize em curso não recomeça nada (um movimento chega em
 * até três redraws: otimista, aceito, snapshot); alvo novo no meio do caminho
 * parte de onde a ficha está desenhada, sem voltar.
 */
export function syncGlide(glides: TokenGlides, id: string, sync: GlideSync): GlidePoint {
  const { shown, target, now, animate } = sync
  if (!animate || shown === null) {
    glides.delete(id)
    return { x: target.x, y: target.y }
  }
  const current = glides.get(id)
  if (current !== undefined && current.toX === target.x && current.toY === target.y) {
    const at = glidePosition(current, now)
    if (at.done) glides.delete(id)
    return { x: at.x, y: at.y }
  }
  if (Math.hypot(target.x - shown.x, target.y - shown.y) < MIN_GLIDE_DISTANCE) {
    glides.delete(id)
    return { x: target.x, y: target.y }
  }
  glides.set(id, { fromX: shown.x, fromY: shown.y, toX: target.x, toY: target.y, start: now })
  return { x: shown.x, y: shown.y }
}

/**
 * Um quadro do ticker: a posição de cada ficha em deslize. As que chegaram
 * saem do mapa já neste quadro, na posição final.
 */
export function stepGlides(glides: TokenGlides, now: number): Array<{ id: string } & GlidePoint> {
  const moved: Array<{ id: string } & GlidePoint> = []
  for (const [id, track] of glides) {
    const at = glidePosition(track, now)
    if (at.done) glides.delete(id)
    moved.push({ id, x: at.x, y: at.y })
  }
  return moved
}
