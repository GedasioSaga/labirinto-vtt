import { describe, expect, it } from 'vitest'
import { createExploration, encodeExploration } from './exploration'
import { doorStateOf, parseSavedExploration, savedDoorOf, type SavedDoor } from './savedTable'

/**
 * RETOMAR A MESA com a aparência da porta lembrada (fatia 22): a cor e a
 * animação que o jogador viu voltam com a memória. Antes, a mesa só guardava
 * aberta/trancada/tipo, e a porta lembrada voltava laranja e sem animação.
 */
function memoriaCom(doors: unknown[]): unknown {
  const exp = createExploration({ width: 1500, height: 500, grid: 50 })
  return { version: 1, seats: [{ name: 'Carla', scenes: [{ mapId: 'm', width: 30, height: 10, grid: 50, explored: encodeExploration(exp), doors }] }] }
}

function portasLidas(doors: unknown[]): SavedDoor[] | undefined {
  return parseSavedExploration(memoriaCom(doors))?.seats[0]?.scenes[0]?.doors
}

describe('savedTable: aparência da porta lembrada', () => {
  it('cor e animação vão e voltam com a memória', () => {
    const gravada = savedDoorOf('p1', { open: false, locked: false, kind: 'normal', animacao: 'girar', cor: '#79a9cc' })
    const lidas = portasLidas([JSON.parse(JSON.stringify(gravada))])
    expect(lidas).toEqual([{ wallId: 'p1', open: false, locked: false, kind: 'normal', animacao: 'girar', cor: '#79a9cc' }])
    expect(lidas?.map(doorStateOf)).toEqual([{ open: false, locked: false, kind: 'normal', animacao: 'girar', cor: '#79a9cc' }])
  })

  it('porta lembrada antes da fatia (sem cor nem animação) volta igual', () => {
    const lidas = portasLidas([{ wallId: 'p1', open: true, locked: false, kind: 'double' }])
    expect(lidas?.map(doorStateOf)).toEqual([{ open: true, locked: false, kind: 'double' }])
  })

  it('aparência torta sai e a porta continua lembrada', () => {
    const lidas = portasLidas([{ wallId: 'p1', open: false, locked: false, kind: 'normal', animacao: 'Em Leque!', cor: 'javascript:alert(1)' }])
    expect(lidas).toEqual([{ wallId: 'p1', open: false, locked: false, kind: 'normal' }])
  })

  it('a mesa nunca grava regra do mestre, só estado e aparência', () => {
    const gravada = savedDoorOf('p1', { open: false, locked: true, kind: 'gate', abreCom: 'Chave', secret: true, opensFrom: 'left', semEspiar: true })
    expect(gravada).toEqual({ wallId: 'p1', open: false, locked: true, kind: 'gate' })
  })
})
