import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, ParedesDoDesenho, Token } from '../types/map'
import { moveCrossesWall } from './collision'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { sincronizarParedesDosDesenhos } from './paredesPresas'

/**
 * PAREDES AO REDOR do lado do jogador: as presas são `Wall` comuns, então
 * visão, passo e envio já funcionam. "Invisível" = o jogador não recebe a
 * parede, mas ela esconde o que está atrás (com "Não vê nem passa") e segura
 * a ficha; "Vê mas não passa" = o jogador enxerga através, mas a ficha bate.
 */
function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

/** Um risco de pincel de cima a baixo, entre o herói e o espião. */
function risco(paredes: ParedesDoDesenho): Drawing {
  return { id: 'risco', kind: 'line', x1: 500, y1: 0, x2: 500, y2: 1000, color: '#ffffff', width: 4, paredes }
}

function mapa(paredes: ParedesDoDesenho): MapData {
  const base = createEmptyMap('m', 'M', 1000, 1000, 40)
  return sincronizarParedesDosDesenhos(base, {
    ...base,
    drawings: [risco(paredes)],
    tokens: [token('heroi', 200, 200), token('espiao', 800, 200)],
  })
}

const presas = (map: MapData) => map.walls.filter((w) => w.desenhoId === 'risco')
const atravessaAlguma = (map: MapData) => presas(map).some((w) => moveCrossesWall({ x: 400, y: 200 }, { x: 600, y: 200 }, w))

describe('paredes ao redor — o que o jogador recebe', () => {
  it('visível, "Não vê nem passa": chegam ao jogador, escondem o espião e seguram a ficha', () => {
    const map = mapa({ ativo: true, invisivel: false, passagem: 'bloqueia' })
    const vista = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
    // A névoa manda só as que o herói alcança com o olhar: as do lado dele.
    expect(vista.walls.filter((w) => w.desenhoId === 'risco').length).toBeGreaterThan(0)
    expect(vista.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(atravessaAlguma(map)).toBe(true)
  })

  it('invisível e "Não vê nem passa": o jogador não recebe nenhuma, e mesmo assim não vê o espião nem passa', () => {
    const map = mapa({ ativo: true, invisivel: true, passagem: 'bloqueia' })
    const vista = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
    expect(vista.walls.filter((w) => w.desenhoId === 'risco')).toEqual([])
    expect(vista.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(atravessaAlguma(map)).toBe(true)
  })

  it('invisível e "Vê mas não passa": o jogador não recebe nenhuma, vê o espião, mas a ficha bate', () => {
    const map = mapa({ ativo: true, invisivel: true, passagem: 'janela' })
    const vista = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
    expect(vista.walls.filter((w) => w.desenhoId === 'risco')).toEqual([])
    expect(vista.tokens.map((t) => t.id).sort()).toEqual(['espiao', 'heroi'])
    expect(atravessaAlguma(map)).toBe(true)
  })

  it('visível e "Vê mas não passa": chegam ao jogador, ele vê o espião, a ficha bate', () => {
    const map = mapa({ ativo: true, invisivel: false, passagem: 'janela' })
    const vista = filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700).map
    expect(vista.walls.filter((w) => w.desenhoId === 'risco').length).toBeGreaterThan(0)
    expect(vista.tokens.map((t) => t.id).sort()).toEqual(['espiao', 'heroi'])
    expect(atravessaAlguma(map)).toBe(true)
  })
})
