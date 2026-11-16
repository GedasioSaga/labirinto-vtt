/**
 * DA FICHA AO MOTOR — o que a cena entrega ao caminhamento: as paredes do
 * piso da ficha, o raio dela e as outras fichas do mesmo piso.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, Wall } from '../../types/map'
import { createEmptyMap } from '../mapFactory'
import { caminhoAgora, CacheDeMalhas } from './agenda'
import { entradaDaFicha, raioDaFicha } from './daFicha'

function wall(id: string, x1: number, y1: number, x2: number, y2: number, piso?: number): Wall {
  const base: Wall = { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
  return piso === undefined ? base : { ...base, piso }
}

function token(id: string, x: number, y: number, size: number, piso?: number): Token {
  const base: Token = { id, characterId: null, name: id, x, y, size, image: null }
  return piso === undefined ? base : { ...base, piso }
}

describe('entradaDaFicha', () => {
  it('ficha no primeiro andar: só as paredes e as fichas dele, sem ela mesma', () => {
    const map: MapData = {
      ...createEmptyMap('m', 'M', 20, 10, 64),
      walls: [wall('terreo', 320, 0, 320, 640), wall('alto', 640, 0, 640, 640, 1)],
      tokens: [token('npc', 96, 96, 1, 1), token('vizinho', 480, 96, 2, 1), token('embaixo', 160, 96, 1)],
    }
    const entrada = entradaDaFicha(map, 'npc')
    expect(entrada?.mapa.walls.map((w) => w.id)).toEqual(['alto'])
    expect(entrada?.raio).toBe(32)
    expect(entrada?.fichas).toEqual([{ id: 'vizinho', x: 480, y: 96, raio: 64 }])
  })

  it('mapa sem pisos, sem paredes, sem outras fichas e tamanho inválido: térreo, raio padrão, caminho reto', () => {
    const map: MapData = { ...createEmptyMap('m', 'M', 10, 10, 64), tokens: [token('so', 96, 96, Number.NaN)] }
    const entrada = entradaDaFicha(map, 'so')
    expect(entrada).not.toBeNull()
    if (entrada === null) return
    expect(entrada.mapa.walls).toEqual([])
    expect(entrada.fichas).toEqual([])
    expect(entrada.raio).toBe(raioDaFicha({ size: 1 }, 64))
    const r = caminhoAgora(new CacheDeMalhas(), entrada.mapa, entrada.raio, { de: { x: 96, y: 96 }, para: { x: 544, y: 544 }, fichas: entrada.fichas })
    expect(r).toEqual({ tipo: 'caminho', pontos: [{ x: 96, y: 96 }, { x: 544, y: 544 }], comprimento: Math.hypot(448, 448), portas: 0 })
  })

  it('ficha que não está no mapa: null', () => {
    expect(entradaDaFicha(createEmptyMap('m', 'M', 10, 10, 64), 'ninguem')).toBeNull()
  })

  it('ABISMO no meio: a rota do NPC dá a volta na boca, como o passo do jogador ("Abismo no caminho")', () => {
    // Mapa 25 x 25 casas de 40; a boca é o quadrado (400, 400)-(560, 560); o NPC sai à esquerda dela para a direita.
    const boca = [
      { x: 400, y: 400 },
      { x: 560, y: 400 },
      { x: 560, y: 560 },
      { x: 400, y: 560 },
    ]
    const de = { x: 300, y: 480 }
    const para = { x: 700, y: 480 }
    const semAbismo: MapData = { ...createEmptyMap('m', 'M', 25, 25, 40), tokens: [token('npc', de.x, de.y, 1)] }
    const comAbismo: MapData = { ...semAbismo, abismos: [{ id: 'fenda', pontos: boca }] }
    const rota = (map: MapData) => {
      const entrada = entradaDaFicha(map, 'npc')
      if (entrada === null) throw new Error('a ficha do NPC está no mapa')
      return caminhoAgora(new CacheDeMalhas(), entrada.mapa, entrada.raio, { de, para, fichas: entrada.fichas })
    }
    // Controle: sem o abismo, a reta.
    expect(rota(semAbismo)).toMatchObject({ tipo: 'caminho', pontos: [de, para] })
    const r = rota(comAbismo)
    expect(r.tipo).toBe('caminho')
    if (r.tipo !== 'caminho') return
    expect(r.pontos[0]).toEqual(de)
    expect(r.pontos[r.pontos.length - 1]).toEqual(para)
    expect(r.comprimento).toBeGreaterThan(400)
    // Nenhum pedaço da rota passa por dentro da boca (amostra a cada 4 px).
    const dentroDaBoca = (p: { x: number; y: number }) => p.x > 400 && p.x < 560 && p.y > 400 && p.y < 560
    for (let i = 0; i + 1 < r.pontos.length; i += 1) {
      const a = r.pontos[i]
      const b = r.pontos[i + 1]
      const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4))
      for (let k = 0; k <= passos; k += 1) {
        const t = k / passos
        expect(dentroDaBoca({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })).toBe(false)
      }
    }
  })
})
