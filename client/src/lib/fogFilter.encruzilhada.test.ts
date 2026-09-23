import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * ENCRUZILHADA no recorte do jogador: por saída, SÓ o id e o rótulo. Nem o
 * destino, nem o id da cena, nem o do pino par — e o pino de uma saída sai
 * exatamente como antes (sem o campo novo).
 */

const RAIO = 300
const POSSE = { p1: ['heroi'] }

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'heroi', characterId: null, name: 'Herói', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

const ENCRUZILHADA: Pin = {
  id: 'cruz',
  x: 240,
  y: 200,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  destino: { sceneId: 'scene_cripta_secreta', pinId: 'par_da_cripta' },
  rotulo: 'Porta da cripta',
  saidas: [
    { id: 'saida_torre', rotulo: 'Escada da torre', destino: { sceneId: 'scene_torre_secreta', pinId: 'par_da_torre' } },
    { id: 'saida_poco', rotulo: '', destino: { sceneId: 'scene_poco_secreto', pinId: 'par_do_poco' } },
  ],
}

describe('fogFilter: encruzilhada', () => {
  it('manda por saída só { id, rotulo }; rótulo vazio vira "Saída N" pela posição', () => {
    const { map } = filterMapForPlayer(mapaCom([ENCRUZILHADA]), 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([
      {
        id: 'cruz',
        x: 240,
        y: 200,
        kind: 'viagem',
        description: 'Encruzilhada',
        image: null,
        escolhas: [
          { id: 'principal', rotulo: 'Porta da cripta' },
          { id: 'saida_torre', rotulo: 'Escada da torre' },
          { id: 'saida_poco', rotulo: 'Saída 3' },
        ],
      },
    ])
    // Cada escolha tem EXATAMENTE as duas chaves: nada de destino por dentro.
    for (const escolha of map.pins[0].escolhas ?? []) expect(Object.keys(escolha).sort()).toEqual(['id', 'rotulo'])
    const recorte = JSON.stringify(map)
    for (const segredo of ['scene_cripta_secreta', 'scene_torre_secreta', 'scene_poco_secreto', 'par_da_cripta', 'par_da_torre', 'par_do_poco', 'destino', 'saidas']) {
      expect(recorte, `o recorte vazou "${segredo}"`).not.toContain(segredo)
    }
    // O recorte é cópia: o mapa do mestre continua com as saídas inteiras.
    expect(ENCRUZILHADA.saidas?.[0].destino).toEqual({ sceneId: 'scene_torre_secreta', pinId: 'par_da_torre' })
  })

  it('pino de UMA saída sai como antes: sem `escolhas`, sem `rotulo`', () => {
    const umaSo: Pin = { ...ENCRUZILHADA, saidas: undefined }
    const { map } = filterMapForPlayer(mapaCom([umaSo]), 'p1', POSSE, RAIO)
    expect(map.pins).toEqual([{ id: 'cruz', x: 240, y: 200, kind: 'viagem', description: 'Encruzilhada', image: null }])
    expect('escolhas' in map.pins[0]).toBe(false)
    expect('rotulo' in map.pins[0]).toBe(false)
  })

  it('`escolhas` que o mestre trouxesse (arquivo editado à mão) não passa: o recorte monta o seu', () => {
    const forjado: Pin = { ...ENCRUZILHADA, saidas: undefined, escolhas: [{ id: 'x', rotulo: 'scene_cripta_secreta' }] }
    const { map } = filterMapForPlayer(mapaCom([forjado]), 'p1', POSSE, RAIO)
    expect('escolhas' in map.pins[0]).toBe(false)
    expect(JSON.stringify(map)).not.toContain('scene_cripta_secreta')
  })

  it('pino que não é de viagem não ganha escolhas, mesmo com saídas gravadas', () => {
    const exclamacao: Pin = { ...ENCRUZILHADA, kind: 'exclamacao' }
    const { map } = filterMapForPlayer(mapaCom([exclamacao]), 'p1', POSSE, RAIO)
    expect('escolhas' in map.pins[0]).toBe(false)
    expect(JSON.stringify(map)).not.toContain('scene_torre_secreta')
  })
})

describe('fogFilter: o pino do jogador leva só o que é dele', () => {
  // Revisão de segurança (22/09): o recorte fazia "...pin" e apagava uma lista
  // fixa. Campo que o arquivo traz e o app não conhece passava ao jogador.
  it('campo desconhecido vindo do arquivo não chega ao jogador', () => {
    const comSegredo = { ...ENCRUZILHADA, notaSecreta: 'o tesouro está no poço' } as Pin
    const { map } = filterMapForPlayer(mapaCom([comSegredo]), 'p1', POSSE, RAIO)
    const pino = map.pins.find((p) => p.id === 'cruz')
    expect(pino).toBeDefined()
    expect(JSON.stringify(pino)).not.toContain('tesouro')
    expect(Object.keys(pino ?? {}).sort()).toEqual(['description', 'escolhas', 'id', 'image', 'kind', 'x', 'y'])
  })
})
