/**
 * MAPA POR ANDARES no recorte: o prédio e o rótulo do andar são do mestre no
 * mapa (`MapData.andar`) e não saem dentro do mapa do jogador — o rótulo viaja
 * à parte, só quando o host decide. E a memória de outro andar é só a planta
 * que o jogador já explorou: nenhuma ficha, porque ninguém dele está lá.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { createExploration, markAll } from './exploration'
import { filterFloorMemory, filterMapForPlayer } from './fogFilter'
import type { MapData, Token } from '../types/map'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

const porao: MapData = {
  ...createEmptyMap('m-porao', 'Porao Umido', 20, 10, 50),
  andar: { predio: 'Mansao Spencer', rotulo: 'B1' },
  tokens: [ficha('heroi', 100, 100), ficha('zumbi', 200, 100)],
}

describe('recorte do jogador e o andar do prédio', () => {
  it('o mapa do jogador sai sem `andar` (o nome do prédio fica no mestre)', () => {
    const view = filterMapForPlayer(porao, 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.andar).toBeUndefined()
    expect(JSON.stringify(view.map)).not.toContain('Mansao Spencer')
    expect(view.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'zumbi'])
  })

  it('memória de outro andar: planta explorada, sem ficha nenhuma, sem nome e sem prédio', () => {
    const exp = createExploration({ width: porao.width * porao.grid, height: porao.height * porao.grid, grid: porao.grid })
    markAll(exp)
    const memoria = filterFloorMemory(porao, exp, new Map())
    expect(memoria.map.tokens).toEqual([])
    expect(memoria.map.name).toBe('')
    expect(memoria.map.andar).toBeUndefined()
    expect(memoria.concealed).toEqual([])
    const texto = JSON.stringify(memoria)
    for (const segredo of ['Porao Umido', 'Mansao Spencer', 'zumbi', 'heroi']) expect(texto, segredo).not.toContain(segredo)
  })
})
