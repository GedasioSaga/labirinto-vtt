/**
 * TEXTURAS no recorte do jogador: o mestre pintou perto da ficha e longe, na
 * névoa. Sai só o pedaço junto do que ele conhece; o balde só com a forma no
 * recorte; das importadas, só a que um passo dele usa. Nada do resto viaja.
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { filterMapForPlayer } from './fogFilter'

const RAIO = 300
const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }
const POSSE = { p1: ['ana'] }
const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='

const quadrado = (id: string, x: number, y: number, lado: number): Drawing => ({
  id,
  kind: 'polygon',
  points: [
    { x, y },
    { x: x + lado, y },
    { x: x + lado, y: y + lado },
    { x, y: y + lado },
  ],
  color: '#177c5c',
  width: 0,
  filled: true,
  fillAlpha: 1,
})

function cena(): MapData {
  return {
    ...createEmptyMap('m-tex', 'Mundo', 40, 10, 50),
    tokens: [ANA],
    drawings: [quadrado('perto', 50, 50, 100), quadrado('longe', 1700, 50, 100)],
    texturasImportadas: [
      { id: 'importada:musgo', nome: 'Musgo do mestre', imagem: IMAGEM },
      { id: 'importada:lava', nome: 'Lava secreta', imagem: IMAGEM },
    ],
    texturas: [
      { id: 'p1', tipo: 'pincel', textura: 'importada:musgo', forca: 1, raio: 20, pontos: [{ x: 80, y: 120 }, { x: 160, y: 120 }] },
      { id: 'p2', tipo: 'pincel', textura: 'importada:lava', forca: 1, raio: 20, pontos: [{ x: 1600, y: 120 }, { x: 1900, y: 120 }] },
      { id: 'b1', tipo: 'balde', textura: 'floresta', forca: 1, alvo: { tipo: 'desenho', id: 'perto' } },
      { id: 'b2', tipo: 'balde', textura: 'neve', forca: 1, alvo: { tipo: 'desenho', id: 'longe' } },
    ],
  }
}

describe('Texturas no recorte do jogador', () => {
  it('sai o que encosta no conhecido; a pintura da névoa não viaja, nem a importada que só ela usa', () => {
    const view = filterMapForPlayer(cena(), 'p1', POSSE, RAIO)
    expect(view.map.texturas?.map((p) => p.id.split('~')[0])).toEqual(['p1', 'b1'])
    // A importada usada vai (id e imagem, para pintar); o nome é o do arquivo do mestre e fica com ele.
    expect(view.map.texturasImportadas?.map((t) => [t.id, t.imagem])).toEqual([['importada:musgo', IMAGEM]])
    const texto = JSON.stringify(view.map)
    expect(texto).not.toContain('Musgo do mestre')
    expect(texto).not.toContain('Lava secreta')
    expect(texto).not.toContain('importada:lava')
    expect(texto).not.toContain('"neve"')
    expect(texto).not.toContain('1900')
  })

  it('cena sem textura não ganha o campo no recorte', () => {
    const { texturas: _t, texturasImportadas: _i, ...sem } = cena()
    const view = filterMapForPlayer(sem, 'p1', POSSE, RAIO)
    expect(view.map.texturas).toBeUndefined()
    expect(view.map.texturasImportadas).toBeUndefined()
  })
})
