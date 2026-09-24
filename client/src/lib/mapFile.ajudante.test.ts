import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * AJUDANTE CONTRATADO no disco: o acordo mora na sessão do host (junto da
 * posse), nunca no arquivo. Mapa antigo abre igual; `contrato` que um arquivo
 * trouxer (editado à mão) é descartado na leitura e não volta a ser gravado.
 */

const ficha = (extra: string): string => `{"id": "tiziu", "characterId": null, "name": "Tiziu", "x": 1, "y": 2, "size": 1, "image": null${extra}}`

describe('mapFile: contrato do ajudante', () => {
  it('mapa antigo abre com a ficha inteira e sem o campo', () => {
    const antigo = deserializeMap(`{"id": "antigo", "tokens": [${ficha(', "npc": true')}]}`)
    expect(antigo.tokens[0]).toMatchObject({ id: 'tiziu', name: 'Tiziu', npc: true })
    expect('contrato' in antigo.tokens[0]).toBe(false)
  })

  it('contrato gravado no arquivo é descartado na leitura e some da próxima gravação', () => {
    const lido = deserializeMap(`{"id": "torto", "tokens": [${ficha(', "contrato": {"tarefa": "vigiar", "ate": null, "visao": true}')}]}`)
    expect(lido.tokens[0].name).toBe('Tiziu')
    expect('contrato' in lido.tokens[0]).toBe(false)
    expect(serializeMap(lido)).not.toContain('contrato')
  })
})
