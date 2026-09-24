import type { MapData } from '../types/map'

/**
 * RELÓGIO DA CAMPANHA: a hora do dia, inteira de 0 a 23, que o mestre avança
 * por botão. Não mora em cena nenhuma — é o mesmo relógio para a aventura
 * inteira. A cena marcada como externa (`MapData.externa`) escurece à noite: a
 * visão de quem está nela cai por `NIGHT_VISION_FACTOR`, e o recorte do host
 * encolhe junto (o que ficou no escuro não viaja).
 *
 * O jogador nunca recebe a hora: só o período (`DayPeriod`) e, da cena dele,
 * se está escuro (`clockForPlayer` em `lib/fogFilter.ts`).
 */

export type DayPeriod = 'manha' | 'tarde' | 'noite'

export const DAY_PERIODS: readonly DayPeriod[] = ['manha', 'tarde', 'noite']

export const PERIOD_LABEL: Readonly<Record<DayPeriod, string>> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export const HOURS_PER_DAY = 24
/** Campanha nova começa de manhã. */
export const CLOCK_DEFAULT_HOUR = 8
const MORNING_START = 6
const AFTERNOON_START = 12
const NIGHT_START = 18

/** Quanto sobra do raio de visão numa cena externa à noite. */
export const NIGHT_VISION_FACTOR = 0.5

/** O relógio como o jogador pode recebê-lo: o período e, só quando é o caso, que a cena DELE está escura. */
export interface PlayerClock {
  periodo: DayPeriod
  escuro?: true
}

/** Hora inteira de 0 a 23. Número torto dá a volta; o que não é número vira a hora de começo. */
export function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) return CLOCK_DEFAULT_HOUR
  const whole = Math.trunc(hour) % HOURS_PER_DAY
  return whole < 0 ? whole + HOURS_PER_DAY : whole
}

export function periodOfHour(hour: number): DayPeriod {
  const h = normalizeHour(hour)
  if (h >= MORNING_START && h < AFTERNOON_START) return 'manha'
  if (h >= AFTERNOON_START && h < NIGHT_START) return 'tarde'
  return 'noite'
}

/** "+1 hora" (ou `hours` horas), dando a volta na meia-noite. */
export function advanceHour(hour: number, hours: number): number {
  return normalizeHour(normalizeHour(hour) + hours)
}

/** "Próximo período": o começo do período seguinte. Da noite, a manhã de amanhã. */
export function nextPeriodHour(hour: number): number {
  const period = periodOfHour(hour)
  if (period === 'manha') return AFTERNOON_START
  if (period === 'tarde') return NIGHT_START
  return MORNING_START
}

/** A hora como o mestre lê: `08:00`. */
export function formatHour(hour: number): string {
  return `${String(normalizeHour(hour)).padStart(2, '0')}:00`
}

/** Cena externa à noite: escura. */
export function isDarkAt(hour: number, map: Pick<MapData, 'externa'>): boolean {
  return map.externa === true && periodOfHour(hour) === 'noite'
}

/** O raio de visão nesta cena a esta hora: cai à noite na cena externa, igual no resto. */
export function visionRadiusAtHour(radius: number, hour: number, map: Pick<MapData, 'externa'>): number {
  return isDarkAt(hour, map) ? Math.round(radius * NIGHT_VISION_FACTOR) : radius
}

/** Marca de cena externa: desligar tira o campo, e a cena volta a ser igual a mapa antigo. */
export function setOutdoor(map: MapData, outdoor: boolean): MapData {
  if (outdoor) return map.externa === true ? map : { ...map, externa: true }
  if (map.externa === undefined) return map
  const { externa: _interna, ...rest } = map
  return rest
}

/** `snapshot.relogio` validado, só com os campos conhecidos. `null` = malformado. */
export function readPlayerClock(raw: unknown): PlayerClock | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const periodo: unknown = Reflect.get(raw, 'periodo')
  const escuro: unknown = Reflect.get(raw, 'escuro')
  const period = DAY_PERIODS.find((p) => p === periodo)
  if (period === undefined) return null
  if (escuro === undefined) return { periodo: period }
  return escuro === true ? { periodo: period, escuro: true } : null
}
