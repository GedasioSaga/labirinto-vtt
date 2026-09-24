/**
 * TEXTO DE CHEGADA DA CENA no recorte: o texto mora no mapa do mestre, mas
 * NUNCA sai no snapshot — quem já está na cena o receberia de novo a cada
 * broadcast, e a tela da mesa o mostraria a todos. Ele viaja só no
 * `scene.changed` de quem chega (`net/hostSession.ts`).
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { setArrivalText } from './arrivalText'
import { createEmptyMap } from './mapFactory'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'

const TEXTO = 'Um cheiro de enxofre sobe da escada.'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function cripta(worldMap: boolean): MapData {
  const base: MapData = { ...createEmptyMap('m-cripta', 'Cripta', 20, 10, 50), tokens: [ficha('heroi', 100, 100)] }
  const comTexto = setArrivalText(base, TEXTO)
  return worldMap ? { ...comTexto, worldMap: true } : comTexto
}

describe('recorte do jogador: o texto de chegada não sai', () => {
  it('o mapa do mestre tem o texto (controle)', () => {
    expect(cripta(false).textoChegada).toBe(TEXTO)
  })

  it('filterMapForPlayer: nem o campo, nem o texto em lugar nenhum do recorte', () => {
    const view = filterMapForPlayer(cripta(false), 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.id).toBe('m-cripta')
    expect('textoChegada' in view.map).toBe(false)
    expect(JSON.stringify(view)).not.toContain(TEXTO)
  })

  it('tela da mesa (grupo): mesma regra', () => {
    const view = filterMapForGroup(cripta(false), [{ tokenIds: ['heroi'], visionRadius: 700 }])
    expect(view.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect('textoChegada' in view.map).toBe(false)
    expect(JSON.stringify(view)).not.toContain(TEXTO)
  })

  it('cena que é andar de prédio E tem texto: nenhum dos dois campos do mestre sai', () => {
    // União com MAPA POR ANDARES: os dois tiram campo no MESMO destructure do
    // recorte; resolver a junção pegando um lado só vazaria o outro.
    const predio = 'Delegacia de Raccoon'
    const mapa: MapData = { ...cripta(false), andar: { predio, rotulo: '2F' } }
    for (const view of [
      filterMapForPlayer(mapa, 'p1', { p1: ['heroi'] }, 700),
      filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: 700 }]),
    ]) {
      expect(view.map.id).toBe('m-cripta')
      expect('textoChegada' in view.map).toBe(false)
      expect('andar' in view.map).toBe(false)
      const json = JSON.stringify(view)
      expect(json).not.toContain(TEXTO)
      expect(json).not.toContain(predio)
    }
  })

  it('mapa-mundi (caravana): mesma regra', () => {
    const view = filterMapForPlayer(cripta(true), 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.worldMap).toBe(true)
    expect('textoChegada' in view.map).toBe(false)
    expect(JSON.stringify(view)).not.toContain(TEXTO)
  })
})
