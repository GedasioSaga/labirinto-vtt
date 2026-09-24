import { describe, expect, it } from 'vitest'
import type { MapData, Pin, PinLock, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { isLockClosed, lockAccepts, lockDoorOptions, normalizeLockAnswer, openPinLock, publicLockOf, readPinLock } from './pinLock'

/**
 * FECHADURA COM SEGREDO — a parte pura: normalizar a tentativa, conferir, o
 * que o jogador pode saber da fechadura (forma e número de casas, nunca a
 * resposta) e o efeito de abrir (o pino e a porta ligada a ele).
 */

function cofre(extra: Partial<Pin> = {}): Pin {
  return { id: 'cofre', x: 100, y: 100, kind: 'exclamacao', description: 'Cofre de parede', image: null, ...extra }
}

function porta(locked: boolean): Wall {
  return { id: 'porta', x1: 300, y1: 0, x2: 300, y2: 50, blocksLight: true, blocksMove: true, door: { open: false, locked, kind: 'normal' } }
}

function mapa(pins: Pin[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap('m', 'M', 500, 500, 50), pins, walls }
}

describe('normalizeLockAnswer', () => {
  it('ignora espaço, traço, ponto, barra e caixa', () => {
    expect(normalizeLockAnswer(' 6-12 / 18 ')).toBe('61218')
    expect(normalizeLockAnswer('Lua.Negra')).toBe('luanegra')
    expect(normalizeLockAnswer('')).toBe('')
  })
})

describe('lockAccepts', () => {
  it('confere pela forma normalizada e recusa tentativa vazia', () => {
    const lock: PinLock = { resposta: '9-3-8-2', forma: 'volantes' }
    expect(lockAccepts(lock, '9382')).toBe(true)
    expect(lockAccepts(lock, '9 3 8 2')).toBe(true)
    expect(lockAccepts(lock, '9383')).toBe(false)
    expect(lockAccepts({ resposta: ' - ', forma: 'teclado' }, '')).toBe(false)
  })
})

describe('isLockClosed', () => {
  it('fechada só com resposta de verdade e sem a marca de aberta', () => {
    expect(isLockClosed(cofre({ segredo: { resposta: '12', forma: 'teclado' } }))).toBe(true)
    expect(isLockClosed(cofre({ segredo: { resposta: '12', forma: 'teclado', aberta: true } }))).toBe(false)
    expect(isLockClosed(cofre({ segredo: { resposta: ' ', forma: 'teclado' } }))).toBe(false)
    expect(isLockClosed(cofre())).toBe(false)
  })
})

describe('publicLockOf', () => {
  it('dá a forma e o número de casas, nunca a resposta', () => {
    const pub = publicLockOf(cofre({ segredo: { resposta: '9-3-8-2', forma: 'volantes', abrePorta: 'porta' } }))
    expect(pub).toEqual({ forma: 'volantes', casas: 4 })
    expect(JSON.stringify(pub)).not.toContain('9382')
  })

  it('volantes com resposta que não é só número vira teclado (o volante só tem 0 a 9)', () => {
    expect(publicLockOf(cofre({ segredo: { resposta: 'lua', forma: 'volantes' } }))).toEqual({ forma: 'teclado', casas: 3 })
  })

  it('fechadura aberta ou sem resposta não sai', () => {
    expect(publicLockOf(cofre({ segredo: { resposta: '12', forma: 'teclado', aberta: true } }))).toBeNull()
    expect(publicLockOf(cofre())).toBeNull()
  })
})

describe('readPinLock (do disco)', () => {
  it('aceita a forma certa e descarta o que não conhece', () => {
    expect(readPinLock({ resposta: '12', forma: 'volantes', aberta: true, abrePorta: 'porta', lixo: 1 })).toEqual({
      resposta: '12',
      forma: 'volantes',
      aberta: true,
      abrePorta: 'porta',
    })
    expect(readPinLock({ resposta: '12', forma: 'estranha' })).toEqual({ resposta: '12', forma: 'teclado' })
    expect(readPinLock({ resposta: '12', forma: 'teclado', aberta: 'sim', abrePorta: 3 })).toEqual({ resposta: '12', forma: 'teclado' })
  })

  it('sem resposta em texto, não há fechadura', () => {
    expect(readPinLock(undefined)).toBeUndefined()
    expect(readPinLock({ forma: 'teclado' })).toBeUndefined()
    expect(readPinLock('1234')).toBeUndefined()
  })
})

describe('lockDoorOptions', () => {
  function portaEm(id: string, x: number, locked: boolean): Wall {
    return { id, x1: x, y1: 75, x2: x, y2: 125, blocksLight: true, blocksMove: true, door: { open: false, locked, kind: 'normal' } }
  }

  it('só as trancadas, da mais perto para a mais longe, pela distância em quadros', () => {
    const parede: Wall = { id: 'parede', x1: 150, y1: 0, x2: 150, y2: 50, blocksLight: true, blocksMove: true, door: null }
    const m = mapa([cofre()], [portaEm('longe', 450, true), portaEm('livre', 200, false), portaEm('perto', 200, true), parede])
    expect(lockDoorOptions(m, cofre())).toEqual([
      { id: 'perto', label: 'Porta trancada a 2 quadros' },
      { id: 'longe', label: 'Porta trancada a 7 quadros' },
    ])
  })

  it('a já ligada entra mesmo destrancada', () => {
    const pino = cofre({ segredo: { resposta: '1', forma: 'teclado', abrePorta: 'livre' } })
    const m = mapa([pino], [portaEm('livre', 150, false)])
    expect(lockDoorOptions(m, pino)).toEqual([{ id: 'livre', label: 'Porta a 1 quadro (já destrancada)' }])
  })
})

describe('openPinLock', () => {
  it('marca a fechadura aberta e destranca a porta ligada, sem abrir a porta', () => {
    const antes = mapa([cofre({ segredo: { resposta: '12', forma: 'teclado', abrePorta: 'porta' } })], [porta(true)])
    const depois = openPinLock(antes, 'cofre')
    expect(depois.pins[0].segredo).toEqual({ resposta: '12', forma: 'teclado', abrePorta: 'porta', aberta: true })
    expect(depois.walls[0].door).toEqual({ open: false, locked: false, kind: 'normal' })
    // O original não muda: é transformação pura (entra também nos passos do desfazer).
    expect(antes.pins[0].segredo?.aberta).toBeUndefined()
    expect(antes.walls[0].door?.locked).toBe(true)
  })

  it('pino sem fechadura, já aberto ou inexistente devolve o mesmo mapa', () => {
    const semFechadura = mapa([cofre()])
    expect(openPinLock(semFechadura, 'cofre')).toBe(semFechadura)
    const jaAberto = mapa([cofre({ segredo: { resposta: '12', forma: 'teclado', aberta: true } })])
    expect(openPinLock(jaAberto, 'cofre')).toBe(jaAberto)
    expect(openPinLock(semFechadura, 'nenhum')).toBe(semFechadura)
  })

  it('porta ligada que sumiu do mapa não impede abrir o pino', () => {
    const antes = mapa([cofre({ segredo: { resposta: '12', forma: 'teclado', abrePorta: 'sumiu' } })])
    expect(openPinLock(antes, 'cofre').pins[0].segredo?.aberta).toBe(true)
  })
})
