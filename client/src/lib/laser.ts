/**
 * Regras do laser do mestre, compartilhadas pelo editor e pelo jogador (sem
 * DOM e sem Pixi). Posições em px de mundo, tempos em ms de `Date.now`.
 */

/** Intervalo mínimo entre dois envios `laser {points}` para os jogadores. */
export const LASER_SEND_INTERVAL_MS = 50
/** Quanto tempo cada ponto do rastro leva para sumir. */
export const LASER_TRAIL_MS = 1000
/** Teto de pontos por mensagem: 50 ms de mouse rápido cabem com folga, lixo maior é descartado. */
export const LASER_MAX_POINTS_PER_MESSAGE = 64
/** Teto do rastro guardado: só protege a memória, o tempo de vida já limpa o resto. */
export const LASER_MAX_TRAIL_POINTS = 256
/** Segurar L menos que isso, sem mexer o mouse, é o atalho antigo da ferramenta Linha. */
export const LASER_KEY_TAP_MS = 200
export const LASER_COLOR = '#ff2d2d'
export const LASER_LABEL = 'Mestre'

export interface LaserPoint {
  x: number
  y: number
  /** Instante em que o ponto entrou no rastro. */
  t: number
}

/** Rastro pronto para desenhar: `on` mantém a ponta acesa mesmo com o mouse parado. */
export interface LaserTrail {
  points: readonly LaserPoint[]
  on: boolean
}

/**
 * Tira os pontos que já sumiram. Com `keepLast`, o último fica mesmo velho:
 * laser ligado com o mouse parado ainda precisa da ponta.
 */
export function pruneLaserTrail(points: readonly LaserPoint[], now: number, keepLast = false): LaserPoint[] {
  const alive = points.filter((p) => now - p.t < LASER_TRAIL_MS)
  const last = points.at(-1)
  if (keepLast && last !== undefined && alive.at(-1) !== last) alive.push(last)
  return alive.length > LASER_MAX_TRAIL_POINTS ? alive.slice(alive.length - LASER_MAX_TRAIL_POINTS) : alive
}

/**
 * Acrescenta um lote ao rastro. Os pontos do lote se espalham por `spanMs`
 * até `now`: chegam juntos a cada envio, e com o mesmo instante o rastro
 * apagaria em degraus de 50 ms em vez de um fio contínuo.
 */
export function appendLaserPoints(points: readonly LaserPoint[], batch: readonly { x: number; y: number }[], now: number, spanMs = 0): LaserPoint[] {
  const step = batch.length > 1 ? spanMs / batch.length : 0
  const stamped = batch.map((p, i) => ({ x: p.x, y: p.y, t: now - (batch.length - 1 - i) * step }))
  return pruneLaserTrail([...points, ...stamped], now, true)
}

/** Forma mínima do evento de teclado, no mesmo espírito de `ShortcutEvent` (lib/keymap.ts). */
export interface LaserKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  targetTagName: string
}

/**
 * L sem Ctrl/Cmd/Alt e fora de campo editável. Digitar "l" no nome de um
 * token não pode ligar o laser nem avisar os jogadores.
 */
export function isLaserKey(evt: LaserKeyEvent): boolean {
  if (evt.key !== 'l' && evt.key !== 'L') return false
  if (evt.ctrlKey || evt.metaKey || evt.altKey) return false
  return evt.targetTagName !== 'INPUT' && evt.targetTagName !== 'TEXTAREA' && evt.targetTagName !== 'SELECT'
}
