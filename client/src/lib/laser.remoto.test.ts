/** Rastro de laser de OUTRO jogador: um por jogador, some sozinho ao soltar ou ao calar. */
import { describe, expect, it } from 'vitest'
import { LASER_TRAIL_MS, MAX_REMOTE_LASERS, REMOTE_LASER_IDLE_MS, applyRemoteLaser, isRemoteLaserLit, pruneRemoteLasers, remoteLaserTrail } from './laser'

const ANA = { key: 'Ana', label: 'Ana', color: '#3cff00' }
const CAIO = { key: 'Caio', label: 'Caio', color: '#2850ff' }

describe('lasers remotos', () => {
  it('um rastro por jogador; lote novo de quem já aponta cresce o mesmo rastro', () => {
    let lasers = applyRemoteLaser([], ANA, { points: [{ x: 1, y: 1 }] }, 0)
    lasers = applyRemoteLaser(lasers, CAIO, { points: [{ x: 9, y: 9 }] }, 10)
    lasers = applyRemoteLaser(lasers, ANA, { points: [{ x: 2, y: 2 }] }, 20)
    expect(lasers.map((l) => l.key).sort()).toEqual(['Ana', 'Caio'])
    expect(lasers.find((l) => l.key === 'Ana')?.trail.points.map((p) => p.x)).toEqual([1, 2])
  })

  it('off apaga a ponta e o rastro some depois de LASER_TRAIL_MS; off de quem não aponta não cria nada', () => {
    expect(applyRemoteLaser([], ANA, { off: true }, 0)).toEqual([])
    let lasers = applyRemoteLaser([], ANA, { points: [{ x: 1, y: 1 }] }, 0)
    lasers = applyRemoteLaser(lasers, ANA, { off: true }, 100)
    expect(lasers[0] && isRemoteLaserLit(lasers[0], 100)).toBe(false)
    expect(pruneRemoteLasers(lasers, 100)).toHaveLength(1)
    expect(pruneRemoteLasers(lasers, LASER_TRAIL_MS + 1)).toEqual([])
  })

  it('sem mensagem por REMOTE_LASER_IDLE_MS a ponta apaga mesmo sem off', () => {
    const lasers = applyRemoteLaser([], ANA, { points: [{ x: 1, y: 1 }] }, 0)
    const laser = lasers[0]
    if (laser === undefined) throw new Error('esperava laser')
    expect(remoteLaserTrail(laser, REMOTE_LASER_IDLE_MS - 1).on).toBe(true)
    expect(remoteLaserTrail(laser, REMOTE_LASER_IDLE_MS).on).toBe(false)
    expect(pruneRemoteLasers(lasers, REMOTE_LASER_IDLE_MS)).toEqual([])
  })

  it('guarda no máximo MAX_REMOTE_LASERS', () => {
    let lasers = applyRemoteLaser([], ANA, { points: [{ x: 1, y: 1 }] }, 0)
    for (let i = 0; i < MAX_REMOTE_LASERS + 3; i += 1) lasers = applyRemoteLaser(lasers, { key: `j${i}`, label: `j${i}`, color: '#000000' }, { points: [{ x: i, y: i }] }, 0)
    expect(lasers).toHaveLength(MAX_REMOTE_LASERS)
  })
})
