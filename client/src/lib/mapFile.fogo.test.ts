import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { trocarTamanhoDoFogo } from './mapFactory'
import { tamanhoDoFogo } from './mobilia/fogo'

/**
 * OBJETO FOGO no disco: o tipo e o tamanho (a pegada) atravessam salvar e
 * abrir; mapa antigo, sem o tipo, abre igual a antes.
 */

const objeto = (extra: string): string => `{"id": "o1", "src": "", "x": 300, "y": 200, "width": 50, "height": 50, "linkedMapPath": null${extra}}`

describe('mapFile: objeto Fogo', () => {
  it('salvar e abrir mantém o tipo e o tamanho escolhido no painel', () => {
    const novo = deserializeMap(`{"id": "vila", "grid": 50, "props": [${objeto(', "mobilia": "fogo"')}]}`)
    expect(novo.props[0].mobilia).toBe('fogo')
    expect(tamanhoDoFogo(novo.props[0].width, novo.props[0].height, novo.grid)).toBe('chama')

    // "Incêndio" no painel: 4 x 3 casas, centro no lugar.
    const queimando = trocarTamanhoDoFogo(novo, 'o1', 'incendio')
    expect(queimando.props[0]).toMatchObject({ mobilia: 'fogo', x: 300, y: 200, width: 200, height: 150 })
    // O mesmo tamanho de novo devolve o MESMO mapa (o desfazer não ganha passo vazio).
    expect(trocarTamanhoDoFogo(queimando, 'o1', 'incendio')).toBe(queimando)

    const reaberto = deserializeMap(serializeMap(queimando))
    expect(reaberto.props[0]).toMatchObject({ id: 'o1', mobilia: 'fogo', x: 300, y: 200, width: 200, height: 150 })
    expect(tamanhoDoFogo(reaberto.props[0].width, reaberto.props[0].height, reaberto.grid)).toBe('incendio')
  })

  it('mapa antigo, sem o tipo novo, abre igual (a fogueira continua fogueira)', () => {
    const antigo = `{"id": "antigo", "grid": 50, "props": [${objeto(', "mobilia": "fogueira"')}]}`
    const lido = deserializeMap(antigo)
    expect(lido.props).toHaveLength(1)
    expect(lido.props[0]).toMatchObject({ id: 'o1', mobilia: 'fogueira', width: 50, height: 50 })
    expect(serializeMap(lido)).not.toContain('"fogo"')
    expect(deserializeMap(serializeMap(lido))).toEqual(lido)
  })
})
