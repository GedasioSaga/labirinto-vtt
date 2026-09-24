import { describe, expect, it } from 'vitest'
import type { DoorState, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { findTokenPath, moveCrossesWall } from './collision'
import { visionSegments, wallLetsSightThrough } from './visibility'

/**
 * JANELA E GRADE, lado da GEOMETRIA: deixam ver, não deixam passar. A visão
 * mora em `visionSegments` (o que vira obstáculo do raio) e o passo em
 * `collision.ts` — os dois lados precisam discordar de propósito aqui.
 */
function parede(id: string, extra: Partial<Wall> = {}): Wall {
  return { id, x1: 500, y1: 250, x2: 500, y2: 350, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function porta(extra: Partial<DoorState>): DoorState {
  return { open: false, locked: false, kind: 'normal', ...extra }
}

function obstaculos(walls: Wall[], peek?: ReadonlySet<string>): number {
  const map = { ...createEmptyMap('m', 'M', 20, 20, 50), walls }
  return visionSegments(map, peek).length
}

const DE = { x: 400, y: 300 }
const PARA = { x: 700, y: 300 }

describe('janela e grade: a visão passa, o passo não', () => {
  it('grade FECHADA (e até trancada) não segura a visão, mas segura a ficha', () => {
    for (const door of [porta({ kind: 'gate' }), porta({ kind: 'gate', locked: true })]) {
      const grade = parede('grade', { door })
      expect(wallLetsSightThrough(grade)).toBe(true)
      expect(obstaculos([grade])).toBe(0)
      expect(moveCrossesWall(DE, PARA, grade)).toBe(true)
      expect(findTokenPath(DE, PARA, [grade])).toBeNull()
    }
  })

  it('porta comum fechada continua segurando a visão (controle)', () => {
    const fechada = parede('p', { door: porta({}) })
    expect(wallLetsSightThrough(fechada)).toBe(false)
    expect(obstaculos([fechada])).toBe(1)
  })

  it("grade SECRETA é parede: nem a visão passa", () => {
    const secreta = parede('g', { door: porta({ kind: 'gate', secret: true }) })
    expect(wallLetsSightThrough(secreta)).toBe(false)
    expect(obstaculos([secreta])).toBe(1)
  })

  it("parede 'Janela' deixa a visão passar e barra o passo", () => {
    const janela = parede('j', { janela: true })
    expect(wallLetsSightThrough(janela)).toBe(true)
    expect(obstaculos([janela])).toBe(0)
    expect(moveCrossesWall(DE, PARA, janela)).toBe(true)
    expect(findTokenPath(DE, PARA, [janela])).toBeNull()
  })

  it('parede comum continua cega (controle)', () => {
    expect(wallLetsSightThrough(parede('w'))).toBe(false)
    expect(obstaculos([parede('w')])).toBe(1)
  })

  it('ESPIAR: a porta espiada deixa a visão passar SÓ na conta de quem espiou', () => {
    const fechada = parede('p', { door: porta({ locked: true }) })
    expect(obstaculos([fechada], new Set(['p']))).toBe(0)
    expect(obstaculos([fechada], new Set(['outra']))).toBe(1)
    expect(obstaculos([fechada])).toBe(1)
    // Espiar não abre nada: a ficha continua barrada.
    expect(moveCrossesWall(DE, PARA, fechada)).toBe(true)
  })

  it('espiar parede sem porta não abre buraco nela', () => {
    expect(obstaculos([parede('w')], new Set(['w']))).toBe(1)
  })
})
