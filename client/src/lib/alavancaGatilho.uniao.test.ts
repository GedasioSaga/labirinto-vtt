/**
 * UNIÃO ALAVANCA + GATILHO DE ÁREA. As duas peças mexem nos mesmos arquivos
 * (disco, recorte do jogador, cliente do jogador) e só se encontram aqui:
 *
 * - no disco, o pino alavanca com `portaLigada` e os `gatilhos` do mapa
 *   convivem no mesmo `map.json` (o `mapFile.ts` foi o conflito da união);
 * - no recorte, a alavanca que abre a porta da sala ao lado faz o gatilho
 *   REVELADO daquela sala chegar ao jogador — e nem o id da porta ligada nem
 *   o id do gatilho vazam por isso.
 */
import { describe, expect, it } from 'vitest'
import type { AreaTrigger, MapData, Pin } from '../types/map'
import { ficha, torre } from './__fixtures__/hazardTower'
import { filterMapForPlayer } from './fogFilter'
import { pullLever } from './lever'
import { buildPin } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

const DONOS = { p1: ['ana'] }
const RAIO = 700

/** Alavanca na sala B, ao lado da Ana, ligada à porta fechada B|C. */
function alavancaBC(): Pin {
  return { ...buildPin('alav', { x: 760, y: 200 }, 'alavanca'), portaLigada: 'porta-bc' }
}

const armadilhaC: AreaTrigger = { id: 'g-armadilha-secreta', kind: 'armadilha', regionId: 'sala-c', revealed: true }

/** Torre com a Ana na sala B, a alavanca da porta B|C e uma armadilha revelada na sala C. */
function cenario(): MapData {
  return { ...torre({ tokens: [ficha('ana', 750, 200)] }), pins: [alavancaBC()], gatilhos: [armadilhaC] }
}

describe('união alavanca + gatilho de área', () => {
  it('disco: a alavanca ligada e o gatilho voltam juntos, nenhum apaga o outro', () => {
    const lido = deserializeMap(serializeMap(cenario()))
    expect(lido.pins).toHaveLength(1)
    expect(lido.pins[0]?.kind).toBe('alavanca')
    expect(lido.pins[0]?.portaLigada).toBe('porta-bc')
    expect(lido.gatilhos).toEqual([armadilhaC])
  })

  it('a alavanca abre a porta B|C e a armadilha revelada da sala C passa a chegar ao jogador', () => {
    const antes = cenario()
    expect(filterMapForPlayer(antes, 'p1', DONOS, RAIO).gatilhos).toEqual([])

    const depois = pullLever(antes, 'alav')
    expect(depois.walls.find((w) => w.id === 'porta-bc')?.door?.open).toBe(true)
    const view = filterMapForPlayer(depois, 'p1', DONOS, RAIO)
    expect(view.gatilhos.map((g) => g.kind)).toEqual(['armadilha'])

    // SEGURANÇA: o que chega é o tipo e o polígono, nunca a ligação da
    // alavanca nem o id do gatilho.
    const pacote = JSON.stringify(view)
    expect(pacote).toContain('"alavanca"')
    expect(pacote).not.toContain('portaLigada')
    expect(pacote).not.toContain('g-armadilha-secreta')
  })

  it('gatilho NÃO revelado continua fora mesmo com a porta aberta pela alavanca', () => {
    const escondido: MapData = { ...cenario(), gatilhos: [{ ...armadilhaC, revealed: false }] }
    const view = filterMapForPlayer(pullLever(escondido, 'alav'), 'p1', DONOS, RAIO)
    expect(view.gatilhos).toEqual([])
    expect(JSON.stringify(view)).not.toContain('armadilha')
  })
})
