/**
 * MINHAS NOTAS DA MESA no disco do mestre: chave própria por mesa, leitura
 * tolerante (nota torta cai sozinha, nome vazio cai, jogador sem nota não
 * entra) e gravação que nunca derruba a sala.
 */
import { describe, expect, it } from 'vitest'
import type { PersonalNote } from './minhasNotas'
import { loadSavedMyNotes, parseSavedMyNotes, savedMyNotesKey, SAVED_MY_NOTES_VERSION, storeSavedMyNotes, type TableStorage } from './savedTable'

const BAU: PersonalNote = { id: 'n1', mapId: 'm-taverna', x: 120, y: 140, text: 'baú trancado' }

function memoria(): TableStorage & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return {
    dados,
    getItem: (key) => dados.get(key) ?? null,
    setItem: (key, value) => {
      dados.set(key, value)
    },
  }
}

describe('savedTable: Minhas notas da mesa', () => {
  it('grava e lê de volta, na chave da mesa', () => {
    const disco = memoria()
    storeSavedMyNotes(disco, 'mesa-1', { version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Ana', notes: [BAU] }] })
    expect(disco.dados.has(savedMyNotesKey('mesa-1'))).toBe(true)
    expect(loadSavedMyNotes(disco, 'mesa-1')).toEqual({ version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Ana', notes: [BAU] }] })
    expect(loadSavedMyNotes(disco, 'outra-mesa')).toBeNull()
  })

  it('arquivo adulterado: nota torta cai sozinha, nome vazio e jogador sem nota não entram, versão errada não vale', () => {
    expect(
      parseSavedMyNotes({
        version: SAVED_MY_NOTES_VERSION,
        seats: [
          { name: 'Ana', notes: [BAU, { id: 'n2', mapId: 'm', x: 'dez', y: 0, text: 'torta' }] },
          { name: '  ', notes: [BAU] },
          { name: 'Bruno', notes: [] },
          { name: 'Carla', notes: 'nada' },
        ],
      }),
    ).toEqual({ version: SAVED_MY_NOTES_VERSION, seats: [{ name: 'Ana', notes: [BAU] }] })
    expect(parseSavedMyNotes({ version: 99, seats: [{ name: 'Ana', notes: [BAU] }] })).toBeNull()
    expect(parseSavedMyNotes(null)).toBeNull()
  })

  it('storage quebrado, bloqueado ou cheio: lê nada e grava sem lançar', () => {
    const quebrado = memoria()
    quebrado.dados.set(savedMyNotesKey('mesa-1'), '{não é json')
    expect(loadSavedMyNotes(quebrado, 'mesa-1')).toBeNull()
    const bloqueado: TableStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadSavedMyNotes(bloqueado, 'mesa-1')).toBeNull()
    expect(() => storeSavedMyNotes(bloqueado, 'mesa-1', { version: SAVED_MY_NOTES_VERSION, seats: [] })).not.toThrow()
    expect(loadSavedMyNotes(null, 'mesa-1')).toBeNull()
  })
})
