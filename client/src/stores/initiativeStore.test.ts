import { beforeEach, describe, expect, it } from 'vitest'
import { advanceTurn, startTurn, useInitiativeStore } from './initiativeStore'

const FICHAS = [
  { id: 'lanterna', name: 'Lanterna' },
  { id: 'machado', name: 'Machado' },
  { id: 'goblin', name: 'Goblin' },
]

function montar(): void {
  const { setValue } = useInitiativeStore.getState()
  setValue('mapa-ponte', 'lanterna', 12)
  setValue('mapa-ponte', 'machado', 17)
  setValue('mapa-ponte', 'goblin', 5)
}

describe('initiativeStore', () => {
  beforeEach(() => {
    useInitiativeStore.getState().reset()
  })

  it('guarda o valor de cada ficha por mapa; vazio (null) tira a ficha', () => {
    montar()
    expect(useInitiativeStore.getState().values['mapa-ponte']).toEqual({ lanterna: 12, machado: 17, goblin: 5 })
    useInitiativeStore.getState().setValue('mapa-ponte', 'goblin', null)
    expect(useInitiativeStore.getState().values['mapa-ponte']).toEqual({ lanterna: 12, machado: 17 })
  })

  it('começar põe a vez no primeiro da ordem; a próxima anda e volta ao primeiro', () => {
    montar()
    expect(useInitiativeStore.getState().turn).toBeNull()
    startTurn('mapa-ponte', FICHAS)
    expect(useInitiativeStore.getState().turn).toEqual({ mapId: 'mapa-ponte', tokenId: 'machado' })
    advanceTurn('mapa-ponte', FICHAS)
    expect(useInitiativeStore.getState().turn?.tokenId).toBe('lanterna')
    advanceTurn('mapa-ponte', FICHAS)
    advanceTurn('mapa-ponte', FICHAS)
    expect(useInitiativeStore.getState().turn?.tokenId).toBe('machado')
  })

  it('a próxima vez sem ordem começada não faz nada, nem em outra cena', () => {
    montar()
    advanceTurn('mapa-ponte', FICHAS)
    expect(useInitiativeStore.getState().turn).toBeNull()
    startTurn('mapa-ponte', FICHAS)
    advanceTurn('outra-cena', FICHAS)
    expect(useInitiativeStore.getState().turn).toEqual({ mapId: 'mapa-ponte', tokenId: 'machado' })
  })

  it('tirar o valor da ficha da vez encerra a vez (ninguém fica destacado sem estar na ordem)', () => {
    montar()
    startTurn('mapa-ponte', FICHAS)
    useInitiativeStore.getState().setValue('mapa-ponte', 'machado', null)
    expect(useInitiativeStore.getState().turn).toBeNull()
  })

  it('encerrar tira a vez e mantém os valores', () => {
    montar()
    startTurn('mapa-ponte', FICHAS)
    useInitiativeStore.getState().stop()
    expect(useInitiativeStore.getState().turn).toBeNull()
    expect(useInitiativeStore.getState().values['mapa-ponte']?.machado).toBe(17)
  })
})
