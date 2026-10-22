import { beforeEach, describe, expect, it } from 'vitest'
import { chaveDaCorDaPorta, portaComCor } from '../lib/corDaPorta'
import { createEmptyMap } from '../lib/mapFactory'
import type { Wall } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * COR DA PORTA no desfazer (fatia 22): o seletor de "Outra cor…" manda uma cor
 * por quadro do arrasto, e o arrasto inteiro é UM Ctrl+Z — o mesmo caminho que
 * o `handleDoorCorChange` do App faz. Outra mudança no meio separa os passos.
 */
const PORTA: Wall = { id: 'd', x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
const store = () => useMapStore.getState()
const porta = () => store().map.walls[0].door

/** O que o App faz a cada `onCorChange` da ficha (`doSeletor` = veio do arrasto de "Outra cor…"). */
function escolherCor(cor: string | null, doSeletor = false): void {
  const door = porta()
  if (door === null) throw new Error('a parede perdeu a porta')
  store().setWallDoor('d', portaComCor(door, cor), chaveDaCorDaPorta('d', doSeletor))
}

beforeEach(() => {
  store().loadMap({ ...createEmptyMap('m', 'M', 10, 10, 40), walls: [PORTA] })
})

describe('mapStore.setWallDoor: cor da porta no histórico', () => {
  it('arrastar no seletor de cor por vários quadros desfaz de uma vez', () => {
    for (const cor of ['#111111', '#222222', '#333333', '#444444']) escolherCor(cor, true)
    expect(porta()?.cor).toBe('#444444')
    store().undo()
    expect(porta()).toEqual(PORTA.door)
  })

  it('paleta e depois arrasto: o Ctrl+Z desfaz só o arrasto e volta à cor da paleta', () => {
    escolherCor('#79a9cc')
    for (const cor of ['#203040', '#405060', '#e05a9c']) escolherCor(cor, true)
    store().undo()
    expect(porta()?.cor).toBe('#79a9cc')
    store().undo()
    expect(porta()).toEqual(PORTA.door)
  })

  it('duas bolinhas da paleta são dois passos', () => {
    escolherCor('#79a9cc')
    escolherCor('#e2645a')
    store().undo()
    expect(porta()?.cor).toBe('#79a9cc')
  })

  it('"Cor padrão" é um passo próprio: desfazer devolve a cor de antes', () => {
    escolherCor('#79a9cc')
    escolherCor(null)
    expect(porta()?.cor).toBeUndefined()
    store().undo()
    expect(porta()?.cor).toBe('#79a9cc')
  })

  it('trancar no meio separa a cor de antes da cor de depois', () => {
    escolherCor('#79a9cc')
    store().setDoorLocked('d', true)
    escolherCor('#e2645a')
    store().undo()
    expect(porta()).toEqual({ open: false, locked: true, kind: 'normal', cor: '#79a9cc' })
  })

  it('sem chave, como antes: cada mudança da porta é um passo', () => {
    store().setWallDoor('d', { open: true, locked: false, kind: 'normal' })
    store().setWallDoor('d', { open: false, locked: false, kind: 'normal' })
    store().undo()
    expect(porta()?.open).toBe(true)
  })
})
