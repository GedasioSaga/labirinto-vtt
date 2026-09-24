import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { PROP_PLAYER_LABEL_MAX } from './propPlayerLook'
import type { MapData, Prop } from '../types/map'

/**
 * OBJETO COM RÓTULO OU IMAGEM, no ARQUIVO. Os dois campos são novos e
 * opcionais: mapa salvo antes deles abre idêntico, e o que o arquivo trouxer
 * fora da forma (texto enorme, caminho no lugar da imagem) volta limpo em vez
 * de ir parar na tela do jogador.
 */

const IMAGEM_DO_PIANO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function objeto(extra: Partial<Prop> = {}): Prop {
  return { id: 'piano', src: 'C:/m/piano.png', x: 300, y: 300, width: 80, height: 60, linkedMapPath: null, ...extra }
}

function comObjetos(props: Prop[]): MapData {
  return { ...createEmptyMap('m1', 'Mansão', 10, 10, 40), props }
}

/** O objeto como o arquivo cru o traria (campo com qualquer valor). */
function arquivoCom(prop: Record<string, unknown>): string {
  const cru: Record<string, unknown> = JSON.parse(serializeMap(comObjetos([])))
  return JSON.stringify({ ...cru, props: [prop] })
}

describe('mapFile — rótulo e imagem do objeto para o jogador', () => {
  it('ida e volta guarda "Guarda-roupa" e a imagem do piano exatamente', () => {
    const mapa = comObjetos([objeto({ id: 'guarda-roupa', playerLabel: 'Guarda-roupa' }), objeto({ playerImage: IMAGEM_DO_PIANO, rotation: 30 })])
    const lido = deserializeMap(serializeMap(mapa))
    expect(lido.props).toEqual(mapa.props)
    expect(lido.props[0].playerLabel).toBe('Guarda-roupa')
  })

  it('mapa salvo antes dos campos abre sem inventar nenhum dos dois', () => {
    const lido = deserializeMap(serializeMap(comObjetos([objeto()])))
    expect(lido.props).toHaveLength(1)
    expect(lido.props[0]).not.toHaveProperty('playerLabel')
    expect(lido.props[0]).not.toHaveProperty('playerImage')
  })

  it('arquivo editado à mão: caminho no lugar da imagem e rótulo que não é texto somem', () => {
    const lido = deserializeMap(arquivoCom({ ...objeto(), playerImage: 'C:\\Users\\mestre\\piano.png', playerLabel: 12 }))
    expect(lido.props).toHaveLength(1)
    expect(lido.props[0]).not.toHaveProperty('playerImage')
    expect(lido.props[0]).not.toHaveProperty('playerLabel')
  })

  it('rótulo gigante volta cortado no teto de rótulo curto', () => {
    const lido = deserializeMap(arquivoCom({ ...objeto(), playerLabel: 'Piano '.repeat(40) }))
    const rotulo = lido.props[0].playerLabel ?? ''
    expect(rotulo.length).toBeLessThanOrEqual(PROP_PLAYER_LABEL_MAX)
    expect(rotulo.startsWith('Piano Piano')).toBe(true)
  })
})
