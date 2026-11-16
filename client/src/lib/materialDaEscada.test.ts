import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { mudarMaterialDaEscada } from './materialDaEscada'
import type { MapData, Stair } from '../types/map'

const ESCADA: Stair = { id: 'e1', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 192, y2: 0 }], stepWidth: 64 }

function mapaCom(...stairs: Stair[]): MapData {
  return { ...createEmptyMap('m', 'Mapa', 640, 640, 64), stairs }
}

describe('material da escada no arquivo', () => {
  it('vai e volta do arquivo: o material, o tom e os feitios guardados; "Só linhas" guarda o resto para voltar igual; o que esta versão não conhece cai fora', () => {
    let mapa = mapaCom(ESCADA, { ...ESCADA, id: 'e2' })
    mapa = mudarMaterialDaEscada(mapa, 'e1', { material: 'madeira', tom: 'nogueira' })
    mapa = mudarMaterialDaEscada(mapa, 'e1', { material: 'metal', estadoDoMetal: 'enferrujada' })
    mapa = mudarMaterialDaEscada(mapa, 'e2', { material: 'pedra', feitioDaPedra: 'pedregulhos' })
    const lido = deserializeMap(serializeMap(mapa))
    expect(lido.stairs.find((s) => s.id === 'e1')).toMatchObject({ material: 'metal', tom: 'nogueira', estadoDoMetal: 'enferrujada' })
    expect(lido.stairs.find((s) => s.id === 'e2')).toMatchObject({ material: 'pedra', feitioDaPedra: 'pedregulhos' })

    // "Só linhas" tira só o material: ao ligar "Com textura" de novo, a madeira nogueira e o metal enferrujado continuam lá.
    const soLinhas = deserializeMap(serializeMap(mudarMaterialDaEscada(lido, 'e1', { material: null })))
    const e1 = soLinhas.stairs.find((s) => s.id === 'e1')
    expect(e1?.material).toBeUndefined()
    expect(e1).toMatchObject({ tom: 'nogueira', estadoDoMetal: 'enferrujada' })

    // Mapa velho (sem os campos) abre sem nenhum deles; valor desconhecido (map.json editado, versão mais nova) cai fora.
    const json = JSON.parse(serializeMap(mapaCom(ESCADA, { ...ESCADA, id: 'e3' }))) as { stairs: Record<string, unknown>[] }
    json.stairs[1] = { ...json.stairs[1], material: 'ouro', tom: 'mogno', estadoDoMetal: 'polida', feitioDaPedra: 'areia' }
    const [velha, estranha] = deserializeMap(JSON.stringify(json)).stairs
    for (const campo of ['material', 'tom', 'estadoDoMetal', 'feitioDaPedra']) {
      expect(velha).not.toHaveProperty(campo)
      expect(estranha).not.toHaveProperty(campo)
    }
  })
})
