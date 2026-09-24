import { describe, expect, it } from 'vitest'
import type { DoorState, MapData, Token, Wall } from '../types/map'
import { keyForDoor, readDoorKey, setDoorKey } from './doorKey'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/** CHAVE ABRE PORTA — regras puras: que item abre a porta, como o nome volta do disco e o que o jogador recebe. */

const CHAVE = 'Chave do Escudo'
const trancada: DoorState = { open: false, locked: true, kind: 'normal' }

function ficha(id: string, mochila?: Token['mochila']): Token {
  const t: Token = { id, characterId: null, name: id, x: 460, y: 200, size: 1, image: null }
  return mochila === undefined ? t : { ...t, mochila }
}

function mapaComPorta(door: DoorState): MapData {
  const porta: Wall = { id: 'escritorio', x1: 500, y1: 180, x2: 500, y2: 220, blocksLight: false, blocksMove: true, door }
  return { ...createEmptyMap('m', 'Mansão', 1000, 1000, 40), walls: [porta], tokens: [ficha('diego', [{ id: 'i1', nome: CHAVE }])] }
}

describe('keyForDoor', () => {
  it('acha a ficha e o item que abrem a porta, sem diferença de maiúscula e espaço', () => {
    const diego = ficha('diego', [{ id: 'i0', nome: 'Tocha' }, { id: 'i1', nome: CHAVE }])
    const achou = keyForDoor({ ...trancada, abreCom: '  chave do ESCUDO' }, [ficha('ana'), diego])
    expect(achou?.token.id).toBe('diego')
    expect(achou?.item).toEqual({ id: 'i1', nome: CHAVE })
  })

  it('porta sem "Abre com", item de outro nome ou mochila vazia: ninguém abre', () => {
    const diego = ficha('diego', [{ id: 'i1', nome: CHAVE }])
    expect(keyForDoor(trancada, [diego])).toBeNull()
    expect(keyForDoor({ ...trancada, abreCom: 'Chave da Cripta' }, [diego])).toBeNull()
    expect(keyForDoor({ ...trancada, abreCom: CHAVE }, [ficha('ana')])).toBeNull()
    expect(keyForDoor({ ...trancada, abreCom: CHAVE }, [])).toBeNull()
  })
})

describe('setDoorKey', () => {
  it('grava o nome aparado; nome vazio tira o campo inteiro (porta volta a abrir só pelo mestre)', () => {
    expect(setDoorKey(trancada, `  ${CHAVE}  `)).toEqual({ ...trancada, abreCom: CHAVE })
    const semChave = setDoorKey({ ...trancada, abreCom: CHAVE }, '   ')
    expect(semChave).toEqual(trancada)
    expect('abreCom' in semChave).toBe(false)
  })
})

describe('readDoorKey (disco)', () => {
  it('texto vira nome aparado; vazio, número e lixo voltam ausentes', () => {
    expect(readDoorKey(` ${CHAVE} `)).toBe(CHAVE)
    expect(readDoorKey('   ')).toBeUndefined()
    expect(readDoorKey(42)).toBeUndefined()
    expect(readDoorKey({ nome: CHAVE })).toBeUndefined()
  })

  it('o mapa salvo guarda o "Abre com" e a porta sem ele abre igual a antes', () => {
    const lido = deserializeMap(serializeMap(mapaComPorta({ ...trancada, abreCom: CHAVE })))
    expect(lido.walls[0]?.door).toEqual({ ...trancada, abreCom: CHAVE })
    const antigo = deserializeMap(serializeMap(mapaComPorta(trancada)))
    expect(antigo.walls[0]?.door).toEqual(trancada)
    expect('abreCom' in (antigo.walls[0]?.door ?? {})).toBe(false)
  })

  it('"Abre com" que não é texto no arquivo sai; a porta continua trancada', () => {
    const cru = JSON.parse(serializeMap(mapaComPorta(trancada))) as { walls: { door: Record<string, unknown> }[] } // JSON do próprio serializeMap, forma conhecida
    const primeira = cru.walls[0]
    if (primeira === undefined) throw new Error('esperava a porta')
    primeira.door.abreCom = { hack: true }
    const lido = deserializeMap(JSON.stringify(cru))
    expect(lido.walls[0]?.door).toEqual(trancada)
  })
})

describe('fogFilter: o jogador não recebe o "Abre com"', () => {
  it('a porta vista sai sem o campo, também para quem carrega a chave', () => {
    const map = mapaComPorta({ ...trancada, abreCom: CHAVE })
    const vista = filterMapForPlayer(map, 'p1', { p1: ['diego'] }, 700)
    expect(vista.visibleDoorIds).toEqual(['escritorio'])
    expect(vista.map.walls[0]?.door).toEqual({ open: false, locked: false, kind: 'normal' })
    expect(JSON.stringify(vista.map.walls)).not.toContain('abreCom')
  })
})
