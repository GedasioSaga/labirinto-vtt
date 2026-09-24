import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * SÓ IDA no disco: `semVolta` é só do recorte do jogador (quem monta é o
 * host). Arquivo editado à mão que traga o campo não o põe no mapa do mestre.
 */
describe('mapFile: passagem só de ida', () => {
  it('`semVolta` vindo do arquivo não entra no mapa do mestre, e regravar não o devolve', () => {
    const texto = JSON.stringify({
      id: 'forjado',
      pins: [{ id: 'a', x: 1, y: 2, kind: 'viagem', description: 'Calha', image: null, semVolta: true }],
    })
    const [pino] = deserializeMap(texto).pins
    expect(pino.id).toBe('a')
    expect(pino.semVolta).toBeUndefined()
    expect(serializeMap(deserializeMap(texto))).not.toContain('semVolta')
  })
})
