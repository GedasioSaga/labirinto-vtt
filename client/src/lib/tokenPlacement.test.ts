import { describe, expect, it } from 'vitest'
import { findTokenSpawn, tokenRadiusFor, wallClearanceForScale } from './tokenPlacement'
import type { Wall } from '../types/map'

function parede(id: string, x1: number, y1: number, x2: number, y2: number, blocksMove = true): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove, door: null }
}

/** Sala fechada 0,0 → 400,400, as quatro paredes do contorno. */
const SALA: Wall[] = [
  parede('topo', 0, 0, 400, 0),
  parede('direita', 400, 0, 400, 400),
  parede('baixo', 400, 400, 0, 400),
  parede('esquerda', 0, 400, 0, 0),
]

/** Grade de 64 px, token tamanho 1: o mesmo raio que `tokensRenderer` desenha. */
const RAIO = tokenRadiusFor(64, 1)

function distanciaAteParede(ponto: { x: number; y: number }, wall: Wall): number {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const t = Math.max(0, Math.min(1, ((ponto.x - wall.x1) * dx + (ponto.y - wall.y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(ponto.x - (wall.x1 + dx * t), ponto.y - (wall.y1 + dy * t))
}

describe('tokenRadiusFor', () => {
  it('repete a conta do desenho do token: (grade * tamanho) / 2 - 2', () => {
    expect(tokenRadiusFor(64, 1)).toBe(30)
    expect(tokenRadiusFor(64, 2)).toBe(62)
  })

  it('nunca devolve raio zero ou negativo com grade minúscula', () => {
    expect(tokenRadiusFor(2, 1)).toBeGreaterThan(0)
  })
})

describe('wallClearanceForScale', () => {
  it('folga cresce quando a câmera afasta, porque a parede é traçada em px de tela', () => {
    expect(wallClearanceForScale(1)).toBeCloseTo(2.5)
    expect(wallClearanceForScale(0.5)).toBeCloseTo(5)
    expect(wallClearanceForScale(4)).toBeCloseTo(0.625)
  })

  it('escala inválida não vira divisão por zero nem folga negativa', () => {
    expect(wallClearanceForScale(0)).toBeCloseTo(2.5)
    expect(wallClearanceForScale(-3)).toBeCloseTo(2.5)
  })
})

describe('findTokenSpawn', () => {
  it('mapa sem parede nenhuma: a peça nasce exatamente onde foi pedido', () => {
    expect(findTokenSpawn({ x: 123, y: 456 }, [], { radius: RAIO })).toEqual({ x: 123, y: 456 })
  })

  it('ponto já livre no meio do cômodo: nada muda', () => {
    expect(findTokenSpawn({ x: 200, y: 200 }, SALA, { radius: RAIO })).toEqual({ x: 200, y: 200 })
  })

  it('ponto EM CIMA da linha da parede: o disco sai de cima dela', () => {
    const ponto = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO })
    expect(ponto).not.toBeNull()
    if (ponto === null) return
    for (const wall of SALA) {
      expect(distanciaAteParede(ponto, wall), `encostou em ${wall.id}`).toBeGreaterThanOrEqual(RAIO + wallClearanceForScale(1))
    }
  })

  it('ponto em cima da parede: a peça fica PERTO do que o usuário pediu, não jogada longe', () => {
    const ponto = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO })
    expect(ponto).not.toBeNull()
    if (ponto === null) return
    expect(Math.hypot(ponto.x - 200, ponto.y - 400)).toBeLessThan(RAIO * 3)
  })

  it('peça encostada na parede por dentro não pula para fora do cômodo', () => {
    const ponto = findTokenSpawn({ x: 200, y: 395 }, SALA, { radius: RAIO })
    expect(ponto).not.toBeNull()
    if (ponto === null) return
    expect(ponto.x).toBeGreaterThan(0)
    expect(ponto.x).toBeLessThan(400)
    expect(ponto.y).toBeGreaterThan(0)
    expect(ponto.y).toBeLessThan(400)
  })

  it('porta ABERTA não segura a peça do lado de dentro: o vão é passagem legítima', () => {
    // Cômodo com um pedaço da parede de baixo virado porta aberta. O ponto
    // pedido está em cima da parede da direita, e o lugar livre mais perto
    // pode ficar do outro lado do vão sem que isso seja "atravessar parede".
    const comVao: Wall[] = [
      parede('topo', 0, 0, 400, 0),
      parede('esquerda', 0, 400, 0, 0),
      { ...parede('baixo-esq', 0, 400, 180, 400) },
      { ...parede('vao', 180, 400, 220, 400), door: { open: true, locked: false, kind: 'normal' } },
      { ...parede('baixo-dir', 220, 400, 400, 400) },
      parede('direita', 400, 0, 400, 400),
    ]
    const ponto = findTokenSpawn({ x: 200, y: 398 }, comVao, { radius: RAIO })
    expect(ponto).not.toBeNull()
    if (ponto === null) return
    for (const wall of comVao) {
      expect(distanciaAteParede(ponto, wall), `encostou em ${wall.id}`).toBeGreaterThanOrEqual(RAIO + wallClearanceForScale(1))
    }
  })

  it('parede que não bloqueia movimento continua sendo evitada — a pergunta aqui é visual', () => {
    const decorativa = [parede('so-visual', 0, 200, 400, 200, false)]
    const ponto = findTokenSpawn({ x: 200, y: 200 }, decorativa, { radius: RAIO })
    expect(ponto).not.toBeNull()
    if (ponto === null) return
    expect(distanciaAteParede(ponto, decorativa[0])).toBeGreaterThanOrEqual(RAIO + wallClearanceForScale(1))
  })

  it('folga maior (câmera afastada) empurra a peça mais para longe da linha', () => {
    const perto = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO, clearance: 1 })
    const longe = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO, clearance: 40 })
    expect(perto).not.toBeNull()
    expect(longe).not.toBeNull()
    if (perto === null || longe === null) return
    expect(distanciaAteParede(longe, SALA[2])).toBeGreaterThan(distanciaAteParede(perto, SALA[2]))
  })

  it('sem lugar livre no alcance da busca devolve null — quem chama tem de avisar na tela', () => {
    // Raio absurdo para o tamanho da sala: não cabe disco nenhum aqui dentro,
    // e a busca para em 2 anéis de 10 px em vez de sair varrendo o mapa.
    expect(findTokenSpawn({ x: 200, y: 200 }, SALA, { radius: 500, step: 10, maxRings: 2 })).toBeNull()
  })

  it('sempre devolve o mesmo ponto para a mesma entrada (sem sorteio)', () => {
    const a = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO })
    const b = findTokenSpawn({ x: 200, y: 400 }, SALA, { radius: RAIO })
    expect(a).toEqual(b)
  })
})
