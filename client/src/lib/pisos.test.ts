import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { comEscadaNosPisos, comFichaNoPiso, comSelecaoNoPiso, escadaDaFicha, mapaDoPiso, nascemNoPiso, nomeDoPiso, pisoDe, pisoDigitado, pisosDoArquivo, temPisos } from './pisos'
import type { MapData, Region, Stair, Token, Wall } from '../types/map'

/**
 * PISOS NA MESMA CENA — a lógica pura: o recorte de um piso, a escada que liga
 * dois pisos e a leitura do arquivo (campo novo, opcional, sem migração).
 */
function wall(id: string, x1: number, y1: number, x2: number, y2: number, piso?: number): Wall {
  const base: Wall = { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
  return piso === undefined ? base : { ...base, piso }
}

function token(id: string, x: number, y: number, piso?: number): Token {
  const base: Token = { id, characterId: null, name: id, x, y, size: 1, image: null }
  return piso === undefined ? base : { ...base, piso }
}

function escada(id: string, piso: number | undefined, levaAoPiso: number | undefined): Stair {
  const base: Stair = { id, shape: 'straight', direction: 'up', segments: [{ x1: 200, y1: 200, x2: 200, y2: 320 }], stepWidth: 40 }
  return { ...base, ...(piso === undefined ? {} : { piso }), ...(levaAoPiso === undefined ? {} : { levaAoPiso }) }
}

function torre(): MapData {
  return {
    ...createEmptyMap('torre', 'Torre', 20, 20, 40),
    walls: [wall('terreo', 0, 0, 400, 0), wall('primeiro', 0, 100, 400, 100, 1), wall('segundo', 0, 200, 400, 200, 2)],
    tokens: [token('lia', 200, 260), token('caio', 200, 260, 1)],
    stairs: [escada('sobe', undefined, 1), escada('enfeite', 2, undefined)],
  }
}

describe('pisos — recorte de um piso', () => {
  it('mapa sem piso nenhum: o térreo é o próprio mapa (mesmo objeto) e não tem pisos', () => {
    const map = createEmptyMap('m', 'M', 10, 10, 40)
    expect(temPisos(map)).toBe(false)
    expect(mapaDoPiso(map, 0)).toBe(map)
  })

  it('cada piso leva só o que é dele; a escada que liga aparece nos dois pisos', () => {
    const map = torre()
    expect(temPisos(map)).toBe(true)
    const terreo = mapaDoPiso(map, 0)
    expect(terreo.walls.map((w) => w.id)).toEqual(['terreo'])
    expect(terreo.tokens.map((t) => t.id)).toEqual(['lia'])
    expect(terreo.stairs.map((s) => s.id)).toEqual(['sobe'])
    const primeiro = mapaDoPiso(map, 1)
    expect(primeiro.walls.map((w) => w.id)).toEqual(['primeiro'])
    expect(primeiro.tokens.map((t) => t.id)).toEqual(['caio'])
    expect(primeiro.stairs.map((s) => s.id)).toEqual(['sobe'])
    expect(mapaDoPiso(map, 2).stairs.map((s) => s.id)).toEqual(['enfeite'])
  })

  it('a lista que não mudou volta a mesma entre chamadas (o cache da visão é pela referência)', () => {
    const map = torre()
    expect(mapaDoPiso(map, 1).walls).toBe(mapaDoPiso({ ...map }, 1).walls)
  })

  it('pisoDe: ausente é o térreo', () => {
    expect(pisoDe(token('a', 0, 0))).toBe(0)
    expect(pisoDe(token('a', 0, 0, -1))).toBe(-1)
  })

  it('nomeDoPiso: térreo, pisos e subsolos', () => {
    expect(nomeDoPiso(0)).toBe('térreo')
    expect(nomeDoPiso(1)).toBe('1º piso')
    expect(nomeDoPiso(12)).toBe('12º piso')
    expect(nomeDoPiso(-2)).toBe('2º subsolo')
  })
})

describe('pisos — escada da ficha', () => {
  it('ficha em cima da escada que liga: leva ao outro piso, dos dois lados', () => {
    const map = torre()
    const lia = map.tokens[0]
    expect(escadaDaFicha(map, lia)).toEqual({ stairId: 'sobe', destino: 1 })
    const caio = map.tokens[1]
    expect(escadaDaFicha(map, caio)).toEqual({ stairId: 'sobe', destino: 0 })
  })

  it('longe da escada, em escada de enfeite ou em escada secreta: nada', () => {
    const map = torre()
    expect(escadaDaFicha(map, token('longe', 700, 700))).toBeNull()
    expect(escadaDaFicha(map, token('enfeite', 200, 260, 2))).toBeNull()
    const secreta: MapData = { ...map, stairs: [{ ...escada('sobe', undefined, 1), secret: true }] }
    expect(escadaDaFicha(secreta, map.tokens[0])).toBeNull()
  })

  it('escada de outro piso que não chega ao da ficha: nada', () => {
    const map: MapData = { ...torre(), stairs: [escada('alta', 2, 3)] }
    expect(escadaDaFicha(map, map.tokens[0])).toBeNull()
    expect(escadaDaFicha(map, token('no2', 200, 260, 2))).toEqual({ stairId: 'alta', destino: 3 })
  })
})

describe('pisos — o mestre edita', () => {
  it('ficha para o 2º piso e de volta ao térreo (o campo sai)', () => {
    const map = torre()
    const noSegundo = comFichaNoPiso(map, 'lia', 2)
    expect(noSegundo.tokens[0].piso).toBe(2)
    const deVolta = comFichaNoPiso(noSegundo, 'lia', 0)
    expect('piso' in deVolta.tokens[0]).toBe(false)
    expect(comFichaNoPiso(map, 'lia', 0)).toBe(map)
    expect(comFichaNoPiso(map, 'ninguem', 3)).toBe(map)
  })

  it('ficha que sobe leva a tocha presa nela; a luz solta e a de outra ficha ficam', () => {
    const luz = (id: string, attachedTokenId?: string) => ({ id, x: 200, y: 260, radius: 100, color: '#fff', intensity: 1, ...(attachedTokenId === undefined ? {} : { attachedTokenId }) })
    const map: MapData = { ...torre(), lights: [luz('tocha', 'lia'), luz('lustre'), luz('lanterna', 'caio')] }
    const emCima = comFichaNoPiso(map, 'lia', 1)
    expect(emCima.lights.map((l) => [l.id, pisoDe(l)])).toEqual([
      ['tocha', 1],
      ['lustre', 0],
      ['lanterna', 0],
    ])
    // Desce de volta: a tocha volta ao térreo, sem o campo.
    expect('piso' in comFichaNoPiso(emCima, 'lia', 0).lights[0]).toBe(false)
    // Sem luz presa na ficha: a MESMA lista (o editor redesenha luz quando a referência muda).
    const semTocha: MapData = { ...map, lights: [luz('lustre')] }
    expect(comFichaNoPiso(semTocha, 'lia', 1).lights).toBe(semTocha.lights)
  })

  it('escada: liga ao 3º piso, vira enfeite (o campo sai) e muda de piso', () => {
    const map = torre()
    const liga = comEscadaNosPisos(map, 'enfeite', { levaAoPiso: 3 })
    expect(liga.stairs[1].levaAoPiso).toBe(3)
    const desliga = comEscadaNosPisos(liga, 'enfeite', { levaAoPiso: null })
    expect('levaAoPiso' in desliga.stairs[1]).toBe(false)
    expect(comEscadaNosPisos(map, 'sobe', { piso: 4 }).stairs[0].piso).toBe(4)
    expect(comEscadaNosPisos(map, 'sobe', { levaAoPiso: 1 })).toBe(map)
  })

  it('pisoDigitado: inteiro na faixa; fração corta, fora da faixa prende, NaN não vale', () => {
    expect(pisoDigitado(2.7)).toBe(2)
    expect(pisoDigitado(-5000)).toBe(-99)
    expect(pisoDigitado(1e9)).toBe(999)
    expect(pisoDigitado(Number.NaN)).toBeNull()
  })
})

describe('pisos — arquivo', () => {
  it('mapa salvo antes do campo abre igual e sem ganhar chave', () => {
    const antigo = torre()
    const semPisos: MapData = { ...antigo, walls: [wall('w', 0, 0, 10, 0)], tokens: [token('t', 5, 5)], stairs: [] }
    const lido = deserializeMap(serializeMap(semPisos))
    expect(lido).toEqual(semPisos)
    expect(serializeMap(lido)).not.toContain('piso')
  })

  it('piso inteiro volta do disco; torto (texto, fração, NaN, gigante) sai e a coisa volta ao térreo', () => {
    const cru = JSON.parse(serializeMap(torre())) as Record<string, unknown>
    const tokens = cru.tokens as Record<string, unknown>[]
    tokens[0].piso = 'segredo'
    tokens[1].piso = 3
    const walls = cru.walls as Record<string, unknown>[]
    walls[0].piso = 1.5
    walls[1].piso = 1e9
    const stairs = cru.stairs as Record<string, unknown>[]
    stairs[0].levaAoPiso = 'cofre'
    const lido = deserializeMap(JSON.stringify(cru))
    expect(lido.tokens.map((t) => t.piso)).toEqual([undefined, 3])
    expect('piso' in lido.tokens[0]).toBe(false)
    expect(lido.walls.map((w) => w.piso)).toEqual([undefined, undefined, 2])
    expect('levaAoPiso' in lido.stairs[0]).toBe(false)
    expect(lido.stairs[1].piso).toBe(2)
  })

  it('pisosDoArquivo não mexe no mapa sem campo nenhum', () => {
    const map = createEmptyMap('m', 'M', 10, 10, 40)
    expect(pisosDoArquivo(map)).toBe(map)
  })
})

describe('pisos — o editor constrói no piso em edição', () => {
  it('nascemNoPiso: o que o passo criou vai ao piso; o que já existia fica; colado de outro piso vem para o de agora', () => {
    const antes = torre()
    const depois: MapData = { ...antes, walls: [...antes.walls, wall('nova', 0, 300, 400, 300), wall('colada', 0, 320, 400, 320, 2)] }
    const noPrimeiro = nascemNoPiso(antes, depois, 1)
    expect(noPrimeiro.walls.map((w) => [w.id, pisoDe(w)])).toEqual([
      ['terreo', 0],
      ['primeiro', 1],
      ['segundo', 2],
      ['nova', 1],
      ['colada', 1],
    ])
    // Térreo em edição: o colado do 2º piso chega sem a chave (arquivo sem campo inventado).
    const noTerreo = nascemNoPiso(antes, depois, 0)
    expect(noTerreo.walls.find((w) => w.id === 'colada')).not.toHaveProperty('piso')
    expect(noTerreo.walls.find((w) => w.id === 'nova')).toBe(depois.walls[3])
  })

  it('nascemNoPiso: passo que não criou nada devolve o próprio mapa', () => {
    const antes = torre()
    const depois: MapData = { ...antes, walls: antes.walls.map((w) => ({ ...w, blocksLight: false })) }
    expect(nascemNoPiso(antes, depois, 1)).toBe(depois)
    expect(nascemNoPiso(antes, antes, 1)).toBe(antes)
  })

  it('mapaDoPiso pedido de novo no mesmo mapa volta o mesmo objeto (o canvas pede a cada quadro)', () => {
    const map = torre()
    expect(mapaDoPiso(map, 1)).toBe(mapaDoPiso(map, 1))
    expect(mapaDoPiso(map, 1)).not.toBe(mapaDoPiso(map, 0))
  })

  it('comSelecaoNoPiso: a parede de uma sala leva a sala, as sub-salas e todas as paredes; a ficha leva a luz presa a ela', () => {
    const pontos = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]
    const regiao = (id: string, parentId?: string): Region => ({
      id,
      points: pontos,
      tag: '',
      fillColor: '#654',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: id },
      ...(parentId === undefined ? {} : { parentId }),
    })
    const map: MapData = {
      ...createEmptyMap('m', 'M', 20, 20, 40),
      regions: [regiao('mae'), regiao('filha', 'mae'), regiao('vizinha')],
      walls: [{ ...wall('mae-1', 0, 0, 400, 0), regionId: 'mae' }, { ...wall('mae-2', 400, 0, 400, 400), regionId: 'mae' }, { ...wall('filha-1', 0, 0, 10, 0), regionId: 'filha' }, wall('solta', 0, 0, 1, 1)],
      tokens: [token('lia', 10, 10)],
      lights: [{ id: 'tocha', x: 10, y: 10, radius: 100, color: '#fff', intensity: 1, attachedTokenId: 'lia' }, { id: 'lustre', x: 0, y: 0, radius: 100, color: '#fff', intensity: 1 }],
    }
    const next = comSelecaoNoPiso(map, [{ kind: 'wall', id: 'mae-2' }, { kind: 'token', id: 'lia' }], 1)
    expect(next.regions.map((r) => [r.id, pisoDe(r)])).toEqual([
      ['mae', 1],
      ['filha', 1],
      ['vizinha', 0],
    ])
    expect(next.walls.map((w) => [w.id, pisoDe(w)])).toEqual([
      ['mae-1', 1],
      ['mae-2', 1],
      ['filha-1', 1],
      ['solta', 0],
    ])
    expect(next.tokens[0].piso).toBe(1)
    expect(next.lights.map((l) => [l.id, pisoDe(l)])).toEqual([
      ['tocha', 1],
      ['lustre', 0],
    ])
    // Já está lá: nada muda, o próprio mapa.
    expect(comSelecaoNoPiso(next, [{ kind: 'token', id: 'lia' }], 1)).toBe(next)
  })
})
