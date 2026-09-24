/**
 * RELÓGIO DA CAMPANHA no recorte do jogador: ele recebe o PERÍODO (manhã,
 * tarde, noite) e, só da cena DELE, se está escuro — nunca a hora exata, nem
 * a marca "externa" do mestre dentro do mapa.
 */
import { describe, expect, it } from 'vitest'
import { clockForPlayer, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { MapData } from '../types/map'

describe('clockForPlayer', () => {
  it('noite em cena externa: período e escuro, e nada mais', () => {
    const recorte = clockForPlayer(22, { externa: true })
    expect(recorte).toEqual({ periodo: 'noite', escuro: true })
    expect(Object.keys(recorte ?? {}).sort()).toEqual(['escuro', 'periodo'])
    expect(JSON.stringify(recorte)).not.toContain('22')
  })

  it('cena interna, ou de dia: só o período', () => {
    expect(clockForPlayer(22, {})).toEqual({ periodo: 'noite' })
    expect(clockForPlayer(9, { externa: true })).toEqual({ periodo: 'manha' })
    expect(clockForPlayer(15, {})).toEqual({ periodo: 'tarde' })
  })

  it('sem relógio (mestre antigo, teste): nada', () => {
    expect(clockForPlayer(null, { externa: true })).toBeNull()
  })
})

describe('filterMapForPlayer e a marca de cena externa', () => {
  it('a marca é do mestre: não sai dentro do mapa do jogador', () => {
    const map: MapData = {
      ...createEmptyMap('patio', 'Pátio', 20, 20, 50),
      externa: true,
      tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }],
    }
    const view = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect('externa' in view.map).toBe(false)
  })
})
