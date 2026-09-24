/**
 * Regras do laser (do mestre e do jogador), compartilhadas pelo editor e pelo
 * jogador (sem DOM e sem Pixi). Posições em px de mundo, tempos em ms de `Date.now`.
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

/**
 * LASER DO JOGADOR, visto por OUTRA tela (a do mestre ou a de outro jogador da
 * mesma cena). `key` separa um laser do outro (o nome do jogador na sala, que o
 * host já torna único); `label` e `color` são o que a tela escreve e pinta.
 */
export interface LaserOrigin {
  key: string
  label: string
  color: string
}

/** Rastro de um jogador: `lastAt` é quando chegou a última mensagem dele. */
export interface RemoteLaser extends LaserOrigin {
  trail: LaserTrail
  lastAt: number
}

/**
 * Sem nenhuma mensagem por este tempo, a ponta de quem aponta se apaga mesmo
 * sem o `off`: o `off` se perde quando a pessoa cai, troca de cena no meio do
 * gesto ou sai da visão de quem olha, e uma ponta acesa para sempre mentiria.
 */
export const REMOTE_LASER_IDLE_MS = 3000

/** Teto de lasers de jogador guardados ao mesmo tempo: só protege a memória. */
export const MAX_REMOTE_LASERS = 16

/** Lote de pontos (ou o fim do gesto) de um jogador, já validado. */
export type RemoteLaserUpdate = { points: readonly { x: number; y: number }[] } | { off: true }

/** Ponta acesa: o jogador ainda está com o botão apertado e falou há pouco. */
export function isRemoteLaserLit(laser: RemoteLaser, now: number): boolean {
  return laser.trail.on && now - laser.lastAt < REMOTE_LASER_IDLE_MS
}

/** O rastro como o desenho o quer: `on` já descontado do silêncio longo. */
export function remoteLaserTrail(laser: RemoteLaser, now: number): LaserTrail {
  return { points: laser.trail.points, on: isRemoteLaserLit(laser, now) }
}

/**
 * Acrescenta o lote de `origin` (ou o fim do gesto) à lista. `off` de quem não
 * está na lista não cria nada: não há rastro a terminar. Nome e cor seguem o
 * mais recente (o mestre pode ter trocado a cor da ficha no meio).
 */
export function applyRemoteLaser(lasers: readonly RemoteLaser[], origin: LaserOrigin, update: RemoteLaserUpdate, now: number): RemoteLaser[] {
  const current = lasers.find((l) => l.key === origin.key)
  const others = lasers.filter((l) => l.key !== origin.key)
  if ('off' in update) {
    if (current === undefined) return [...lasers]
    return [...others, { ...current, trail: { points: pruneLaserTrail(current.trail.points, now), on: false }, lastAt: now }]
  }
  const points = appendLaserPoints(current?.trail.points ?? [], update.points, now, LASER_SEND_INTERVAL_MS)
  const next = [...others, { key: origin.key, label: origin.label, color: origin.color, trail: { points, on: true }, lastAt: now }]
  return next.length > MAX_REMOTE_LASERS ? next.slice(next.length - MAX_REMOTE_LASERS) : next
}

/** Tira o que já sumiu da tela: ponta apagada e nenhum ponto vivo. */
export function pruneRemoteLasers(lasers: readonly RemoteLaser[], now: number): RemoteLaser[] {
  const next: RemoteLaser[] = []
  for (const laser of lasers) {
    const lit = isRemoteLaserLit(laser, now)
    const points = pruneLaserTrail(laser.trail.points, now, lit)
    if (!lit && points.length === 0) continue
    next.push({ ...laser, trail: { points, on: laser.trail.on && lit } })
  }
  return next
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
