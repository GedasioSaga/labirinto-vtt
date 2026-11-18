/**
 * O ABISMO PARA NA PAREDE (17/11/2026, `lib/abismoNaParede.ts`): "Rente à
 * parede, nos dois modos". O buraco chega até a parede com a beira reta, nunca
 * passa para o outro lado, e o abismo que já existia é cortado na hora de ler.
 *
 * Geometria (px de mundo, mapa 25 x 25 casas de 40): a quina de uma sala em L,
 * a parede da direita em x = 560 (de y = 360 a 760, com uma porta ABERTA de
 * 520 a 600 no meio) e a de cima em y = 360 (de x = 160 a 560). A sala fica à
 * esquerda e embaixo; o corredor, à direita de x = 560.
 */
import { describe, expect, it } from 'vitest'
import type { Abismo, MapData, RegionPoint, Token, Wall } from '../types/map'
import { pontoNoAbismo } from './abismo'
import { centrosDoMesmoLado, contornadosRentesAParede, ladosNaParede, trechosQueParam } from './abismoNaParede'
import { abismoPintadoVazio, abismosDoMapa, bocasDoAbismoPintado, comAbismoPintado, pincelarAbismo } from './abismoPintado'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove } from './moveValidation'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const MEDIO = 1.3

function parede(id: string, x1: number, y1: number, x2: number, y2: number, aberta = false): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: !aberta, door: aberta ? { open: true, locked: false, kind: 'normal' } : null }
}

const PAREDES: Wall[] = [
  parede('direita-cima', 560, 360, 560, 520),
  parede('porta', 560, 520, 560, 600, true),
  parede('direita-baixo', 560, 600, 560, 760),
  parede('cima', 160, 360, 560, 360),
]
const BASE: MapData = { ...createEmptyMap('m', 'M', 25, 25, GRADE), walls: PAREDES }
/** O abismo contornado à mão antes desta mudança: atravessa a parede da direita (e a porta). */
const ATRAVESSA: Abismo = { id: 'velho', pontos: [{ x: 400, y: 480 }, { x: 640, y: 480 }, { x: 640, y: 640 }, { x: 400, y: 640 }], brilho: 'brasa' }

function heroi(x: number, y: number): Token {
  return { id: 'heroi', characterId: null, name: 'heroi', x, y, size: 1, image: null }
}

describe('o abismo contornado para na parede', () => {
  it('o que atravessa a parede (e a porta aberta) fica do lado maior, com a beira reta em cima dela; ler de novo não muda', () => {
    const [cortado] = contornadosRentesAParede([ATRAVESSA], PAREDES) ?? []
    expect(cortado.id).toBe('velho')
    expect(Math.max(...cortado.pontos.map((p) => p.x))).toBeCloseTo(560, 0)
    expect(pontoNoAbismo(cortado, { x: 555, y: 560 })).toBe(true)
    // Do outro lado da parede, inclusive no vão da porta aberta: chão.
    expect(pontoNoAbismo(cortado, { x: 600, y: 500 })).toBe(false)
    expect(pontoNoAbismo(cortado, { x: 600, y: 560 })).toBe(false)
    // O desenho faz o corte limpo só no lado em cima da parede.
    const lados = ladosNaParede(cortado.pontos, trechosQueParam(PAREDES, 0))
    expect(lados.filter((rente) => rente).length).toBeGreaterThan(0)
    lados.forEach((rente, i) => {
      const a = cortado.pontos[i]
      const b = cortado.pontos[(i + 1) % cortado.pontos.length]
      expect(rente).toBe(Math.abs(a.x - 560) < 1 && Math.abs(b.x - 560) < 1)
    })
    // Idempotente: o recorte do jogador chega cortado e é lido de novo com as paredes dele.
    expect(contornadosRentesAParede([cortado], PAREDES)).toEqual([cortado])
    // O mapa sem parede dentro do buraco devolve a PRÓPRIA lista.
    const longe = [{ ...ATRAVESSA, id: 'longe', pontos: ATRAVESSA.pontos.map((p) => ({ x: p.x - 300, y: p.y })) }]
    expect(contornadosRentesAParede(longe, PAREDES)).toBe(longe)
  })

  it('a ficha do corredor anda rente à parede por onde o buraco velho passava; na sala ele ainda segura', () => {
    const mapa: MapData = { ...BASE, abismos: [ATRAVESSA], tokens: [heroi(600, 420)] }
    expect(validateTokenMove(mapa, { playerId: 'p1', tokenId: 'heroi', x: 600, y: 700 }, POSSE, { isHost: false }).ok).toBe(true)
    const naSala: MapData = { ...mapa, tokens: [heroi(480, 420)] }
    expect(validateTokenMove(naSala, { playerId: 'p1', tokenId: 'heroi', x: 480, y: 600 }, POSSE, { isHost: false })).toEqual({ ok: false, reason: 'abismo' })
  })
})

describe('o abismo pintado para na parede', () => {
  // O traço do pincel Médio da sala até a quina: sem parede, cavaria quadrados dos dois lados.
  const TRACO: RegionPoint[] = []
  for (let k = 0; k <= 8; k += 1) TRACO.push({ x: 440 + k * 12.5, y: 480 - k * 12.5 })

  it('o pincel não cava através da parede, e o buraco chega rente às duas paredes da quina, sem chão no canto', () => {
    const pintado = pincelarAbismo(abismoPintadoVazio(BASE), TRACO, MEDIO, false, null, 0, PAREDES)
    expect(pintado.quadrados.length).toBeGreaterThan(4)
    expect(pintado.quadrados.every((c) => (c.x + 0.5) * GRADE < 560 && (c.y + 0.5) * GRADE > 360)).toBe(true)
    const bocas = bocasDoAbismoPintado(pintado, PAREDES)
    expect(bocas).toHaveLength(1)
    const [boca] = bocas
    expect(boca.pontos.every((p) => p.x <= 560.5 && p.y >= 359.5)).toBe(true)
    // A quina da sala e a beira ao longo das duas paredes são buraco: nada de chão entre ele e a parede.
    for (const p of [{ x: 557, y: 363 }, { x: 557, y: 395 }, { x: 525, y: 363 }]) expect(pontoNoAbismo(boca, p)).toBe(true)
    // Sem parede, a mesma pintura arredonda a quina (o que o mestre via): o canto fica de chão.
    const semParede = pincelarAbismo(abismoPintadoVazio(BASE), TRACO, MEDIO, false, null, 0)
    const [solto] = bocasDoAbismoPintado(semParede)
    expect(solto.pontos.some((p) => p.x > 560.5)).toBe(true)
    // A fonte única já entrega o buraco rente.
    expect(abismosDoMapa(comAbismoPintado(BASE, pintado))).toEqual(bocas)
  })

  it('a mão que passa da parede deixa de cavar e volta a cavar ao voltar para o lado de cá', () => {
    const vai: RegionPoint[] = [{ x: 520, y: 440 }, { x: 600, y: 440 }, { x: 620, y: 470 }, { x: 530, y: 470 }]
    const { ficam, ancora } = centrosDoMesmoLado({ x: 500, y: 440 }, vai, PAREDES, 0)
    expect(ficam).toEqual([{ x: 520, y: 440 }, { x: 530, y: 470 }])
    expect(ancora).toEqual({ x: 530, y: 470 })
  })
})
