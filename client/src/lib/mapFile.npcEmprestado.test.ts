import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * NPC EMPRESTADO no disco: `emprestada` é marca de FIO (o recorte a põe na
 * ficha de NPC que o jogador segura). A posse mora na sessão do host, nunca no
 * arquivo: a marca que um arquivo trouxer (editado à mão) é descartada.
 */

const ficha = (extra: string): string => `{"id": "menino", "characterId": null, "name": "Menino", "x": 1, "y": 2, "size": 1, "image": null${extra}}`

describe('mapFile: marca emprestada', () => {
  it('"emprestada" gravada no arquivo é descartada na leitura e some da próxima gravação', () => {
    const lido = deserializeMap(`{"id": "torto", "tokens": [${ficha(', "npc": true, "emprestada": true')}]}`)
    expect(lido.tokens[0]).toMatchObject({ id: 'menino', name: 'Menino', npc: true })
    expect('emprestada' in lido.tokens[0]).toBe(false)
    expect(serializeMap(lido)).not.toContain('emprestada')
  })
})
