import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Region, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { sincronizarParedesDosDesenhos } from './paredesPresas'

/**
 * PAREDES AO REDOR no arquivo: `Drawing.paredes` e `Wall.desenhoId` são campos
 * novos e opcionais. Mapa com as paredes certas faz ida e volta idêntico;
 * valor torto sai na leitura; parede presa a desenho que não existe (ou que
 * não tem as paredes ligadas) perde o vínculo e fica como parede comum.
 */

const retangulo: Drawing = {
  id: 'r1',
  kind: 'rect',
  x: 100,
  y: 100,
  w: 120,
  h: 80,
  color: '#222222',
  width: 4,
  filled: false,
  fillAlpha: 0,
  paredes: { ativo: true, invisivel: true, passagem: 'janela', cor: '#ff8800' },
}

function comPresas(drawings: Drawing[], walls: Wall[] = []): MapData {
  const base = createEmptyMap('arq', 'Arquivo', 20, 15, 64)
  return sincronizarParedesDosDesenhos(base, { ...base, drawings, walls })
}

describe('mapFile — paredes ao redor', () => {
  it('ida e volta preserva o desenho com as paredes e as presas exatamente', () => {
    const map = comPresas([retangulo])
    expect(map.walls).toHaveLength(8)
    expect(deserializeMap(serializeMap(map))).toEqual(map)
  })

  it('paredes tortas no desenho saem; texto perde o campo', () => {
    const json = JSON.stringify({
      id: 'torto',
      drawings: [
        { ...retangulo, paredes: { ativo: 'sim' } },
        { id: 'tx', kind: 'text', x: 0, y: 0, text: 'oi', color: '#fff', fontSize: 16, paredes: { ativo: true, invisivel: false, passagem: 'bloqueia' } },
        { ...retangulo, id: 'r2', paredes: { ativo: true, invisivel: 3, passagem: 'voa', cor: 'laranja' } },
      ],
    })
    const [semParedes, texto, consertado] = deserializeMap(json).drawings
    expect(semParedes).not.toHaveProperty('paredes')
    expect(texto).not.toHaveProperty('paredes')
    expect(consertado.paredes).toEqual({ ativo: true, invisivel: false, passagem: 'bloqueia' })
  })

  it('presa de desenho que não existe, ou sem as paredes ligadas, vira parede comum (não some)', () => {
    const presa: Wall = { id: 'p', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null, desenhoId: 'sumiu' }
    const desligado: Drawing = { ...retangulo, id: 'r9', paredes: { ativo: false, invisivel: false, passagem: 'bloqueia' } }
    const map = { ...createEmptyMap('v', 'V', 5, 5, 64), drawings: [desligado], walls: [presa, { ...presa, id: 'q', desenhoId: 'r9' }] }
    const lido = deserializeMap(serializeMap(map))
    expect(lido.walls.map((w) => w.id)).toEqual(['p', 'q'])
    expect(lido.walls.every((w) => !('desenhoId' in w))).toBe(true)
  })

  it('presa não é puxada para a aresta de uma Sala ao abrir (o dono dela é o desenho)', () => {
    // A Sala bem em cima do anel de fora das paredes do retângulo.
    const sala: Region = {
      id: 's1',
      points: [{ x: 98, y: 98 }, { x: 222, y: 98 }, { x: 222, y: 182 }, { x: 98, y: 182 }],
      tag: '',
      fillColor: '#3a7ad0',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Sala' },
    }
    const map = { ...comPresas([retangulo]), regions: [sala] }
    const lido = deserializeMap(serializeMap(map))
    expect(lido.walls.every((w) => w.desenhoId === 'r1' && w.regionId === undefined)).toBe(true)
  })
})
