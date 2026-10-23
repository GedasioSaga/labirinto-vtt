import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { parseAdventure, serializeAdventure, type Adventure } from './adventure'
import { andar6 } from './__fixtures__/andar6'
import { carimbo, objeto, parede } from './__fixtures__/itensDeCamada'
import { torre } from './__fixtures__/hazardTower'
import legacyMapJson from './__fixtures__/legacy-map.json'
import legacyRoomDoorJson from './__fixtures__/legacy-room-door.json'
import l1Json from '../../../maps/L1.json'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/** Chaves que só um mapa com camadas novas pode ter. */
const CHAVES_NOVAS = ['"ocultasDoJogador"', '"opacidadeDasCamadas"', '"versaoDasCamadas"', '"modeloCamadas"', '"camada"', '"camadaDoTelhado"']


describe('camadas no arquivo: mapa de antes', () => {
  // Todo mapa de fixture/teste do repo: os JSON de arquivo (o L1 real e as duas
  // cópias congeladas) e os montados em código (andar6, torre).
  const fixtures: [string, string][] = [
    ['maps/L1.json', JSON.stringify(l1Json)],
    ['__fixtures__/legacy-map.json', JSON.stringify(legacyMapJson)],
    ['__fixtures__/legacy-room-door.json', JSON.stringify(legacyRoomDoorJson)],
    ['__fixtures__/andar6.ts', serializeMap(andar6())],
    ['__fixtures__/hazardTower.ts', serializeMap(torre())],
  ]

  for (const [nome, bruto] of fixtures) {
    it(`${nome}: deserialize -> serialize reproduz o JSON idêntico e não ganha chave de camada`, () => {
      const uma = serializeMap(deserializeMap(bruto))
      expect(serializeMap(deserializeMap(uma))).toBe(uma)
      for (const chave of CHAVES_NOVAS) expect(uma).not.toContain(chave)
    })
  }
})

describe('camadas no arquivo: campos novos', () => {
  function mapaComTudo(): MapData {
    const base = createEmptyMap('m-camadas', 'Camadas', 10, 10, 64)
    return {
      ...base,
      props: [{ ...objeto, camada: 'livre_moveis' }],
      carimbos: [{ ...carimbo, camada: 'tokens' }],
      walls: [{ ...parede, camada: 'livre_moveis' }],
      ocultasDoJogador: ['tokens', 'livre_moveis'],
      opacidadeDasCamadas: { salas: 0.5, livre_moveis: 0 },
      versaoDasCamadas: 2,
    }
  }

  it('mapa novo com todos os campos faz round-trip idêntico e guarda cada campo de camada', () => {
    // A 1ª leitura normaliza o resto do mapa (padrões de parede, objeto etc.), como em todo mapa novo.
    const uma = serializeMap(deserializeMap(serializeMap(mapaComTudo())))
    expect(serializeMap(deserializeMap(uma))).toBe(uma)
    const lido = deserializeMap(uma)
    expect(lido.ocultasDoJogador).toEqual(['tokens', 'livre_moveis'])
    expect(lido.opacidadeDasCamadas).toEqual({ salas: 0.5, livre_moveis: 0 })
    expect(lido.versaoDasCamadas).toBe(2)
    expect(lido.props[0].camada).toBe('livre_moveis')
    expect(lido.walls[0].camada).toBe('livre_moveis')
    expect(lido.carimbos?.[0].camada).toBe('tokens')
  })

  it('serializeMap tira a cópia em memória do modelo (modeloCamadas)', () => {
    const comModelo: MapData = { ...mapaComTudo(), modeloCamadas: { ordem: [{ id: 'chao' }, { id: 'livre_moveis', nome: 'Móveis' }] } }
    const json = serializeMap(comModelo)
    expect(json).not.toContain('modeloCamadas')
    expect(json).toBe(serializeMap(mapaComTudo()))
    // Arquivo que traga o campo (editado à mão) não o põe no mapa: o modelo mora na aventura.
    const cru = JSON.stringify({ ...JSON.parse(json), modeloCamadas: { ordem: [{ id: 'chao' }] } })
    expect(deserializeMap(cru).modeloCamadas).toBeUndefined()
  })

  it('valor torto é descartado, nunca recusa o mapa', () => {
    const base = JSON.parse(serializeMap(createEmptyMap('m-torto', 'Torto', 10, 10, 64)))
    const torto = {
      ...base,
      ocultasDoJogador: [1, 'tokens', 'livre_', 'grid', 'livre_ok', null],
      opacidadeDasCamadas: { tokens: 2, salas: 0.25, foo: 0.1, paredes: 'meio', livre_ok: 1 },
      versaoDasCamadas: 3,
      props: [{ ...objeto, camada: 5 }, { ...objeto, id: 'o2', camada: 'decoracao' }, { ...objeto, id: 'o3', camada: 'livre de espaço' }],
      carimbos: [{ ...carimbo, camada: { x: 1 } }, { ...carimbo, id: 'c2', camada: 'terreno' }],
    }
    const lido = deserializeMap(JSON.stringify(torto))
    expect(lido.ocultasDoJogador).toEqual(['tokens', 'livre_ok'])
    expect(lido.opacidadeDasCamadas).toEqual({ salas: 0.25, livre_ok: 1 })
    expect('versaoDasCamadas' in lido).toBe(false)
    expect(lido.props.map((p) => ('camada' in p ? p.camada : 'ausente'))).toEqual(['ausente', 'decoracao', 'ausente'])
    expect((lido.carimbos ?? []).map((c) => ('camada' in c ? c.camada : 'ausente'))).toEqual(['ausente', 'terreno'])

    const formaErrada = deserializeMap(JSON.stringify({ ...base, ocultasDoJogador: 'tokens', opacidadeDasCamadas: [0.5] }))
    expect('ocultasDoJogador' in formaErrada).toBe(false)
    expect('opacidadeDasCamadas' in formaErrada).toBe(false)
  })

  it('ocultasDoJogador só com itens tortos FALHA FECHADA: vira ausente (segue hiddenLayers), nunca [] = "o jogador vê tudo"', () => {
    const base = JSON.parse(serializeMap(createEmptyMap('m-fechada', 'Fechada', 10, 10, 64)))
    for (const torta of [[1, null], ['camada_futura'], [{ id: 'tokens' }, 'livre de espaço']]) {
      const lido = deserializeMap(JSON.stringify({ ...base, hiddenLayers: ['tokens'], ocultasDoJogador: torta }))
      expect('ocultasDoJogador' in lido, JSON.stringify(torta)).toBe(false)
      expect(lido.hiddenLayers).toEqual(['tokens'])
    }
    // Lista vazia de verdade é escolha do mestre (nada oculto dos jogadores) e fica.
    expect(deserializeMap(JSON.stringify({ ...base, ocultasDoJogador: [] })).ocultasDoJogador).toEqual([])
    // Descarte parcial mantém os válidos.
    expect(deserializeMap(JSON.stringify({ ...base, ocultasDoJogador: ['camada_futura', 'salas'] })).ocultasDoJogador).toEqual(['salas'])
  })
})

describe('camadas na aventura (adventure.json)', () => {
  const aventura: Adventure = {
    version: 1,
    id: 'adv_1',
    name: 'Aventura',
    startSceneId: 'c1',
    scenes: [{ id: 'c1', name: 'Cena', file: 'scenes/c1/map.json' }],
  }

  it('aventura de antes continua sem a chave', () => {
    const json = serializeAdventure(aventura)
    expect(serializeAdventure(parseAdventure(json))).toBe(json)
    expect(json).not.toContain('camadas')
  })

  it('o modelo de camadas faz round-trip sem mudar ADVENTURE_VERSION', () => {
    const comModelo: Adventure = { ...aventura, camadas: { ordem: [{ id: 'chao' }, { id: 'livre_a1', nome: 'Armadilhas' }, { id: 'tokens' }] } }
    const json = serializeAdventure(comModelo)
    expect(serializeAdventure(parseAdventure(json))).toBe(json)
    expect(parseAdventure(json).version).toBe(1)
  })

  it('entrada torta ou repetida sai; forma errada vira ausente', () => {
    const torto = { ...aventura, camadas: { ordem: [{ id: 'chao' }, { id: 'chao' }, { id: 'nada' }, 7, { id: 'livre_b', nome: 3 }, { id: 'tokens', nome: 'Fichas' }] } }
    expect(parseAdventure(JSON.stringify(torto)).camadas).toEqual({ ordem: [{ id: 'chao' }, { id: 'livre_b' }, { id: 'tokens', nome: 'Fichas' }] })
    expect('camadas' in parseAdventure(JSON.stringify({ ...aventura, camadas: 'tudo' }))).toBe(false)
    expect('camadas' in parseAdventure(JSON.stringify({ ...aventura, camadas: { ordem: 'x' } }))).toBe(false)
  })

  it('ordem só com entradas tortas vira ausente, não { ordem: [] }', () => {
    expect('camadas' in parseAdventure(JSON.stringify({ ...aventura, camadas: { ordem: [7, { id: 'nada' }, null, { nome: 'sem id' }] } }))).toBe(false)
  })

  it('nome de camada livre: aparado, no teto de 40 caracteres; em branco depois de aparar descarta a entrada', () => {
    const comprido = 'Covil do Lich e das Catacumbas Esquecidas do Norte'
    const torto = {
      ...aventura,
      camadas: { ordem: [{ id: 'livre_c', nome: '  Covil  ' }, { id: 'livre_d', nome: comprido }, { id: 'livre_e', nome: '   ' }, { id: 'tokens', nome: ' ' }] },
    }
    expect(parseAdventure(JSON.stringify(torto)).camadas).toEqual({
      ordem: [{ id: 'livre_c', nome: 'Covil' }, { id: 'livre_d', nome: comprido.slice(0, 40).trimEnd() }, { id: 'tokens' }],
    })
  })
})
