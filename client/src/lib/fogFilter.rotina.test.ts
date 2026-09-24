import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * ROTINA DO NPC no recorte: a agenda do Irmão Tobias diz onde ele estará em
 * cada apito, inclusive noutra cena. Isso é do mestre. A ficha sai para o
 * jogador que a vê (e para quem a segura como ajudante) SEM a rotina.
 */
const tobias: Token = {
  id: 'tobias',
  characterId: null,
  name: 'Irmão Tobias',
  x: 150,
  y: 100,
  size: 1,
  image: null,
  npc: true,
  rotina: {
    estadoId: 'estado_apito_secreto',
    postos: [{ valor: 'MeioSecreto', sceneId: 'cena_confessionario_77', x: 300, y: 250 }],
  },
}
const gabi: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }

function semRotina(texto: string) {
  expect(texto).not.toContain('rotina')
  expect(texto).not.toContain('estado_apito_secreto')
  expect(texto).not.toContain('MeioSecreto')
  expect(texto).not.toContain('cena_confessionario_77')
}

describe('filterMapForPlayer: a rotina do NPC nunca sai', () => {
  it('NPC na visão do jogador: a ficha chega, a rotina não', () => {
    const map = { ...createEmptyMap('m1', 'Capela', 10, 10, 50), tokens: [gabi, tobias] }
    const view = filterMapForPlayer(map, 'p1', { p1: ['gabi'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['gabi', 'tobias'])
    semRotina(JSON.stringify(view))
  })

  it('NPC que o jogador segura (ajudante): nem o dono recebe a rotina', () => {
    const map = { ...createEmptyMap('m1', 'Capela', 10, 10, 50), tokens: [tobias] }
    const view = filterMapForPlayer(map, 'p1', { p1: ['tobias'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['tobias'])
    semRotina(JSON.stringify(view))
  })
})
