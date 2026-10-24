/**
 * LUZ QUE ACENDE SOZINHA (Luz L3) no disco: `Light.acesaEm` é campo NOVO e
 * OPCIONAL. Luz de antes abre e salva byte a byte igual; a lista de períodos
 * volta lida (sem repetição, na ordem dia, tarde, noite); valor torto some e a
 * luz volta a ser a de sempre, sem derrubar o arquivo.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

function luz(extra: Partial<Light> = {}): Light {
  return { id: 'lampiao', x: 120, y: 80, radius: 175, color: '#ffba7b', intensity: 0.85, ...extra }
}

function mapaCom(lights: Light[]): MapData {
  return { ...createEmptyMap('m', 'Vila', 20, 20, 50), externa: true, lights }
}

function luzLidaDe(json: string): Light | undefined {
  return deserializeMap(json).lights[0]
}

describe('acesaEm no arquivo', () => {
  it('luz de antes (sem o campo): abre e salva byte a byte igual', () => {
    // `apagada` depois de `vistaDeLonge`: o leitor sempre a pôs no fim (desde o ESTADO DO MUNDO, antes da L3).
    const json = serializeMap(mapaCom([luz(), luz({ id: 'tocha', vistaDeLonge: true, apagada: true })]))
    expect(serializeMap(deserializeMap(json))).toBe(json)
    expect(json).not.toContain('acesaEm')
  })

  it('a lista volta lida e salva de novo igual', () => {
    const json = serializeMap(mapaCom([luz({ acesaEm: ['tarde', 'noite'] })]))
    expect(luzLidaDe(json)?.acesaEm).toEqual(['tarde', 'noite'])
    expect(serializeMap(deserializeMap(json))).toBe(json)
  })

  it('[] (nunca acesa) também volta', () => {
    expect(luzLidaDe(serializeMap(mapaCom([luz({ acesaEm: [] })])))?.acesaEm).toEqual([])
  })

  it('arquivo editado à mão: repetição e ordem trocada saem arrumadas', () => {
    const json = serializeMap(mapaCom([luz()])).replace('"intensity": 0.85', '"intensity": 0.85, "acesaEm": ["noite", "tarde", "noite"]')
    expect(luzLidaDe(json)?.acesaEm).toEqual(['tarde', 'noite'])
  })

  it('valor torto some e a luz fica como a de sempre, sem derrubar o arquivo', () => {
    for (const torto of ['"noite"', '0', 'null', 'true', '{}', '["madrugada"]', '["noite",1]']) {
      const json = serializeMap(mapaCom([luz()])).replace('"intensity": 0.85', `"intensity": 0.85, "acesaEm": ${torto}`)
      expect(json, torto).toContain('acesaEm')
      const lida = luzLidaDe(json)
      expect(lida, torto).toEqual(luz())
      expect(lida !== undefined && 'acesaEm' in lida, torto).toBe(false)
    }
  })
})
