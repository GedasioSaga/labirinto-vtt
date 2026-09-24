/**
 * RELÓGIO DA CAMPANHA: a hora do dia que o mestre avança por botão. O jogador
 * só lê o período (manhã, tarde, noite); a cena marcada como externa escurece
 * à noite e a visão cai.
 */
import { describe, expect, it } from 'vitest'
import {
  advanceHour,
  CLOCK_DEFAULT_HOUR,
  formatHour,
  isDarkAt,
  NIGHT_VISION_FACTOR,
  nextPeriodHour,
  normalizeHour,
  periodOfHour,
  PERIOD_LABEL,
  setOutdoor,
  visionRadiusAtHour,
} from './campaignClock'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { MapData } from '../types/map'

describe('periodOfHour', () => {
  it('manhã das 6 às 11, tarde das 12 às 17, noite das 18 às 5', () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(periodOfHour)).toEqual(['noite', 'noite', 'manha', 'manha', 'tarde', 'tarde', 'noite', 'noite'])
    expect(PERIOD_LABEL).toEqual({ manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' })
  })
})

describe('avançar o relógio', () => {
  it('+1 hora dá a volta na meia-noite', () => {
    expect(advanceHour(8, 1)).toBe(9)
    expect(advanceHour(23, 1)).toBe(0)
    expect(advanceHour(22, 5)).toBe(3)
  })

  it('"Próximo período" pula para o começo do seguinte (a noite vira a manhã de amanhã)', () => {
    expect(nextPeriodHour(8)).toBe(12)
    expect(nextPeriodHour(12)).toBe(18)
    expect(nextPeriodHour(20)).toBe(6)
    expect(nextPeriodHour(3)).toBe(6)
  })

  it('hora torta vira uma hora inteira de 0 a 23; lixo vira a hora de começo', () => {
    expect(normalizeHour(25)).toBe(1)
    expect(normalizeHour(-1)).toBe(23)
    expect(normalizeHour(7.9)).toBe(7)
    expect(normalizeHour(Number.NaN)).toBe(CLOCK_DEFAULT_HOUR)
    expect(periodOfHour(CLOCK_DEFAULT_HOUR)).toBe('manha')
  })

  it('o mestre lê a hora em HH:00', () => {
    expect(formatHour(8)).toBe('08:00')
    expect(formatHour(21)).toBe('21:00')
  })
})

describe('noite na cena externa', () => {
  const externa: Pick<MapData, 'externa'> = { externa: true }
  const interna: Pick<MapData, 'externa'> = {}

  it('só escurece cena externa, e só à noite', () => {
    expect(isDarkAt(22, externa)).toBe(true)
    expect(isDarkAt(3, externa)).toBe(true)
    expect(isDarkAt(12, externa)).toBe(false)
    expect(isDarkAt(22, interna)).toBe(false)
  })

  it('a visão cai pelo fator da noite; cena interna e dia ficam iguais', () => {
    expect(NIGHT_VISION_FACTOR).toBeGreaterThan(0)
    expect(NIGHT_VISION_FACTOR).toBeLessThan(1)
    expect(visionRadiusAtHour(700, 22, externa)).toBe(Math.round(700 * NIGHT_VISION_FACTOR))
    expect(visionRadiusAtHour(700, 12, externa)).toBe(700)
    expect(visionRadiusAtHour(700, 22, interna)).toBe(700)
  })
})

describe('marca de cena externa', () => {
  it('ligar põe o campo, desligar tira (mapa volta igual a mapa antigo)', () => {
    const map = createEmptyMap('patio', 'Pátio', 10, 10, 50)
    const ligado = setOutdoor(map, true)
    expect(ligado.externa).toBe(true)
    expect(setOutdoor(ligado, true)).toBe(ligado)
    const desligado = setOutdoor(ligado, false)
    expect('externa' in desligado).toBe(false)
    expect(setOutdoor(map, false)).toBe(map)
  })

  it('volta igual do arquivo; mapa antigo ou lixo abre como cena interna', () => {
    const map = setOutdoor(createEmptyMap('patio', 'Pátio', 10, 10, 50), true)
    expect(deserializeMap(serializeMap(map)).externa).toBe(true)
    expect('externa' in deserializeMap(serializeMap(createEmptyMap('sala', 'Sala', 10, 10, 50)))).toBe(false)
    expect('externa' in deserializeMap('{"id": "x", "externa": "sim"}')).toBe(false)
  })
})
