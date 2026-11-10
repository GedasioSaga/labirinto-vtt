/**
 * O FOGO É LUZ no recorte do jogador (pedido do mestre de 09/11/2026: "na
 * gameplay isso não ilumina nada os jogadores"). À noite a visão cai para o
 * raio do período; além dele só chega o claro das luzes na linha de visão.
 * O objeto Fogo passou a contar como luz (`lib/luzDoFogo.ts`): antes, o fogo
 * fora do raio curto nem chegava ao jogador. Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Prop, Token } from '../types/map'
import { filterMapForPlayer, raioDaNoite } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const GRID = 50
const HEROI = { x: 1000, y: 1000 }
/** 3 casas: o raio da noite da cena. */
const noite = raioDaNoite(() => 3 * GRID)
const SO_ANA: Record<string, string[]> = { ana: ['heroi'] }

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function fogo(id: string, x: number, y: number, extra: Partial<Prop> = {}): Prop {
  return { id, src: '', x, y, width: GRID, height: GRID, linkedMapPath: null, mobilia: 'fogo', ...extra }
}

/** A fogueira a 10 casas do herói e o guarda a 2 casas dela, os dois fora do raio da noite. */
function clareira(fogueira: Prop): MapData {
  return {
    ...createEmptyMap('clareira', 'Clareira', 40, 40, GRID),
    externa: true,
    tokens: [ficha('heroi', HEROI.x, HEROI.y), ficha('guarda', HEROI.x + 10 * GRID, HEROI.y + 2 * GRID)],
    props: [fogueira],
  }
}

function oQueChega(map: MapData, raio: number | ((id: string) => number)): { fichas: string[]; objetos: string[] } {
  const recorte = filterMapForPlayer(map, 'ana', SO_ANA, raio).map
  return { fichas: recorte.tokens.map((t) => t.id).sort(), objetos: recorte.props.map((p) => p.id) }
}

describe('à noite o objeto Fogo clareia como um lampião', () => {
  it('a fogueira longe e quem está no claro dela chegam ao jogador', () => {
    const map = clareira(fogo('fogueira', HEROI.x + 10 * GRID, HEROI.y))
    expect(oQueChega(map, noite)).toEqual({ fichas: ['guarda', 'heroi'], objetos: ['fogueira'] })
  })

  it('fogo escondido do jogador não clareia nada, e de dia curto a regra é a de antes', () => {
    const escondido = clareira(fogo('fogueira', HEROI.x + 10 * GRID, HEROI.y, { hidden: true }))
    expect(oQueChega(escondido, noite)).toEqual({ fichas: ['heroi'], objetos: [] })
    // O mesmo raio sem a marca da noite: o fogo fora do raio não revela nada.
    const map = clareira(fogo('fogueira', HEROI.x + 10 * GRID, HEROI.y))
    expect(oQueChega(map, 3 * GRID)).toEqual({ fichas: ['heroi'], objetos: [] })
  })
})
