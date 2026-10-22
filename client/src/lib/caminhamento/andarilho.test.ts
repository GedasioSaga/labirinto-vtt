/**
 * ANDARILHO — o anti-trava: todo trecho termina em CHEGOU ou em DESISTIU com
 * o motivo, nunca em espera sem fim; e no caminho não cruza parede, não
 * encosta em ficha, abre a porta diante de si e a fecha atrás.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { GRID, mapa, parede, paredeComVao, porta } from './caminho.fixture'
import { type Trecho, simularTrecho } from './simulacao.fixture'

const R1 = GRID / 2
const corredorEstreito = [parede('n', 0, 256, 960, 256), parede('s', 0, 320, 960, 320)]

function trecho(walls: Wall[], de: Point, para: Point, extra: Partial<Trecho> = {}): Trecho {
  return { mapa: mapa(walls), de, para, raio: R1, maxTiques: 400, ...extra }
}

describe('andarilho: termina sempre, com motivo', () => {
  it('corredor com NPC parado e sem outra volta: desiste, ocupado, dizendo quem', () => {
    const r = simularTrecho(trecho(corredorEstreito, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: () => [{ id: 't', x: 480, y: 288, raio: R1 }] }))
    expect(r.fim).toEqual({ tipo: 'desistiu', motivo: 'ocupado', portas: [], fichas: ['t'] })
    expect(r.tiques).toBeLessThanOrEqual(60)
    expect(r.violacoes).toEqual([])
  })

  it('corredor com NPC parado e outra volta: vai pela volta e chega', () => {
    // Parede em x=480 com um vão de uma casa (y 256..320), onde está a ficha, e a passagem de baixo livre.
    const walls = [parede('cima', 480, 0, 480, 256), parede('meio', 480, 320, 480, 576)]
    const r = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: () => [{ id: 't', x: 480, y: 288, raio: R1 }] }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.violacoes).toEqual([])
  })

  it('porta trancada sem outra volta: desiste, porta trancada, com a porta', () => {
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta({ locked: true }) }), { x: 224, y: 96 }, { x: 608, y: 96 }))
    expect(r.fim).toEqual({ tipo: 'desistiu', motivo: 'porta-trancada', portas: ['vao'], fichas: [] })
    expect(r.tiques).toBeLessThanOrEqual(20)
  })

  it('o mestre destranca enquanto ele espera: segue, abre, passa, fecha e chega', () => {
    const destrancar = (tique: number, paredes: readonly Wall[]) =>
      tique === 4 ? paredes.map((w) => (w.door !== null ? { ...w, door: { ...w.door, locked: false } } : w)) : null
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta({ locked: true }) }), { x: 224, y: 96 }, { x: 608, y: 96 }, { aoTique: destrancar }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.acoes.map((a) => a.acao)).toEqual([
      { tipo: 'abrir', wallId: 'vao' },
      { tipo: 'fechar', wallId: 'vao' },
    ])
    expect(r.deixouAbertas).toEqual([])
    expect(r.violacoes).toEqual([])
  })

  it('porta fechada: abre diante dela, passa, fecha atrás de si', () => {
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta() }), { x: 224, y: 96 }, { x: 608, y: 96 }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    const [abrir, fechar] = r.acoes
    expect(abrir?.acao).toEqual({ tipo: 'abrir', wallId: 'vao' })
    expect(fechar?.acao).toEqual({ tipo: 'fechar', wallId: 'vao' })
    expect((fechar?.tique ?? 0) - (abrir?.tique ?? 0)).toBeGreaterThan(0)
    expect(r.paredes.find((w) => w.id === 'vao')?.door?.open).toBe(false)
    expect(r.violacoes).toEqual([])
  })

  it('preso no canto (nicho) por uma ficha na saída: desiste, ocupado', () => {
    // Nicho de uma casa de largura em x 0..64, y 0..256, aberto embaixo; a ficha fica na boca.
    const walls = [parede('nicho', 64, 0, 64, 256)]
    const r = simularTrecho(trecho(walls, { x: 32, y: 96 }, { x: 480, y: 480 }, { fichas: () => [{ id: 'boca', x: 32, y: 288, raio: R1 }] }))
    expect(r.fim).toMatchObject({ tipo: 'desistiu', motivo: 'ocupado', fichas: ['boca'] })
    expect(r.violacoes).toEqual([])
  })

  it('quina em L: dobra a quina sem travar nem raspar', () => {
    const walls = [parede('v', 384, 128, 384, 320), parede('h', 384, 320, 576, 320)]
    const r = simularTrecho(trecho(walls, { x: 352, y: 352 }, { x: 416, y: 288 }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.violacoes).toEqual([])
  })

  it('sala fechada: desiste, sem caminho', () => {
    const walls = [parede('n', 256, 128, 576, 128), parede('s', 256, 448, 576, 448), parede('o', 256, 128, 256, 448), parede('l', 576, 128, 576, 448)]
    const r = simularTrecho(trecho(walls, { x: 96, y: 96 }, { x: 416, y: 288 }))
    expect(r.fim).toMatchObject({ tipo: 'desistiu', motivo: 'sem-caminho' })
    expect(r.tiques).toBeLessThanOrEqual(20)
  })
})

describe('andarilho: desvio das fichas', () => {
  it('ficha que aparece na frente no meio do caminho: replaneja, contorna, chega', () => {
    const intruso = (tique: number) => (tique >= 5 ? [{ id: 'intruso', x: 608, y: 288, raio: R1 }] : [])
    const r = simularTrecho(trecho([], { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: intruso }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.pedidos).toBeGreaterThanOrEqual(2)
    expect(r.violacoes).toEqual([])
  })

  it('ficha que se põe na frente de novo e de novo: termina mesmo assim, sem encostar', () => {
    const destino = { x: 864, y: 288 }
    const teimosa = (_tique: number, aqui: Point) => {
      const d = Math.hypot(destino.x - aqui.x, destino.y - aqui.y)
      if (d < 3 * GRID) return []
      const k = (2 * GRID) / d
      return [{ id: 'teimosa', x: aqui.x + (destino.x - aqui.x) * k, y: aqui.y + (destino.y - aqui.y) * k, raio: R1 }]
    }
    const r = simularTrecho(trecho(corredorEstreito, { x: 96, y: 288 }, destino, { fichas: teimosa, maxTiques: 600 }))
    expect(r.fim).not.toBeNull()
    expect(r.violacoes).toEqual([])
  })

  it('mesmo mundo, mesmo trecho: determinístico', () => {
    const fichas = () => [{ id: 't', x: 480, y: 288, raio: R1 }]
    const walls = [parede('cima', 480, 0, 480, 256), parede('meio', 480, 320, 480, 576)]
    const a = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas }))
    const b = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas }))
    expect([a.fim, a.tiques, a.acoes, a.primeira]).toEqual([b.fim, b.tiques, b.acoes, b.primeira])
  })
})
