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

  it('a ficha que troca de id leva junto o valor e a vez, só naquele mapa', () => {
    montar()
    useInitiativeStore.getState().setValue('mapa-cripta', 'machado', 3)
    startTurn('mapa-ponte', FICHAS)
    useInitiativeStore.getState().renameToken('mapa-ponte', 'machado', 'machado-2')
    const { values, turn } = useInitiativeStore.getState()
    expect(values['mapa-ponte']).toEqual({ lanterna: 12, 'machado-2': 17, goblin: 5 })
    expect(turn).toEqual({ mapId: 'mapa-ponte', tokenId: 'machado-2' })
    // A ficha de mesmo id em outro mapa não é a mesma ficha.
    expect(values['mapa-cripta']).toEqual({ machado: 3 })
  })

  it('trocar o id de ficha sem valor nem vez não mexe em nada', () => {
    montar()
    startTurn('mapa-ponte', FICHAS)
    const antes = useInitiativeStore.getState()
    useInitiativeStore.getState().renameToken('mapa-ponte', 'orc', 'orc-2')
    useInitiativeStore.getState().renameToken('mapa-vazio', 'machado', 'machado-2')
    const depois = useInitiativeStore.getState()
    expect(depois.values).toBe(antes.values)
    expect(depois.turn).toBe(antes.turn)
  })
})
