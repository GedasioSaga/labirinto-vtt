import { describe, expect, it } from 'vitest'
import type { StorageLike } from './playerConnection'
import {
  PERSONAL_NOTES_KEY,
  PERSONAL_NOTE_MAX_LENGTH,
  addPersonalNote,
  cleanNoteText,
  loadPersonalNotes,
  notesOnMap,
  personalNoteAtScreen,
  removePersonalNote,
  savePersonalNotes,
  type PersonalNote,
} from './personalNotes'

/** Armazenamento do aparelho em memória: o mesmo contrato do `localStorage`. */
function aparelho(inicial: Record<string, string> = {}): StorageLike & { dados: Map<string, string> } {
  const dados = new Map(Object.entries(inicial))
  return {
    dados,
    getItem: (key) => dados.get(key) ?? null,
    setItem: (key, value) => {
      dados.set(key, value)
    },
    removeItem: (key) => {
      dados.delete(key)
    },
  }
}

const BAU: PersonalNote = { id: 'n1', mapId: 'vila', x: 420, y: 180, text: 'baú trancado aqui' }

describe('personalNotes: a anotação do jogador', () => {
  it('o texto é aparado, sem espaço repetido, e cortado em 40 caracteres', () => {
    expect(PERSONAL_NOTE_MAX_LENGTH).toBe(40)
    expect(cleanNoteText('  baú   trancado\naqui  ')).toBe('baú trancado aqui')
    const longo = 'x'.repeat(55)
    expect(cleanNoteText(longo)).toBe('x'.repeat(40))
    expect(cleanNoteText('   ')).toBe('')
  })

  it('anotar põe a nota na lista; texto vazio não cria nada', () => {
    const depois = addPersonalNote([], BAU)
    expect(depois).toEqual([BAU])
    expect(addPersonalNote(depois, { ...BAU, id: 'n2', text: '   ' })).toBe(depois)
    // Texto que chega longo demais entra já cortado: a regra dos 40 vale também aqui, não só no campo.
    const longa = addPersonalNote([], { ...BAU, id: 'n3', text: 'y'.repeat(60) })
    expect(longa[0]?.text).toBe('y'.repeat(40))
  })

  it('recarregar a página: o que foi salvo no aparelho volta igual', () => {
    const disco = aparelho()
    const outra: PersonalNote = { id: 'n2', mapId: 'masmorra', x: 10, y: 20, text: 'armadilha' }
    savePersonalNotes(disco, [BAU, outra])
    expect(disco.dados.has(PERSONAL_NOTES_KEY)).toBe(true)
    expect(loadPersonalNotes(disco)).toEqual([BAU, outra])
  })

  it('armazenamento vazio, corrompido ou bloqueado: começa sem notas e nunca lança', () => {
    expect(loadPersonalNotes(null)).toEqual([])
    expect(loadPersonalNotes(aparelho())).toEqual([])
    expect(loadPersonalNotes(aparelho({ [PERSONAL_NOTES_KEY]: '{quebrado' }))).toEqual([])
    expect(loadPersonalNotes(aparelho({ [PERSONAL_NOTES_KEY]: '{"a":1}' }))).toEqual([])
    const bloqueado: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(loadPersonalNotes(bloqueado)).toEqual([])
    expect(() => savePersonalNotes(bloqueado, [BAU])).not.toThrow()
  })

  it('entrada estranha no armazenamento é descartada item a item; texto longo volta cortado', () => {
    const cru = JSON.stringify([
      BAU,
      { id: 'n2', mapId: 'vila', x: 'dez', y: 1, text: 'sem x' },
      { id: 'n3', mapId: 'vila', x: 1, y: 2, text: '' },
      { id: 'n4', mapId: 'vila', x: 1, y: 2, text: 'z'.repeat(80) },
      null,
    ])
    const lidas = loadPersonalNotes(aparelho({ [PERSONAL_NOTES_KEY]: cru }))
    expect(lidas.map((n) => n.id)).toEqual(['n1', 'n4'])
    expect(lidas[1]?.text).toBe('z'.repeat(40))
  })

  it('cada cena mostra só as notas dela', () => {
    const outra: PersonalNote = { id: 'n2', mapId: 'masmorra', x: 10, y: 20, text: 'armadilha' }
    expect(notesOnMap([BAU, outra], 'vila')).toEqual([BAU])
    expect(notesOnMap([BAU, outra], 'nenhum')).toEqual([])
  })

  it('apagar tira só a nota pedida', () => {
    const outra: PersonalNote = { id: 'n2', mapId: 'vila', x: 10, y: 20, text: 'poço' }
    expect(removePersonalNote([BAU, outra], 'n1')).toEqual([outra])
    expect(removePersonalNote([BAU, outra], 'nao-existe')).toEqual([BAU, outra])
  })

  it('o toque longo acha a nota pelo ponto de TELA, com a câmera de agora; longe dela, nenhuma', () => {
    const camera = { x: 100, y: 50, scale: 2 }
    // (420, 180) de mundo cai em (940, 410) de tela.
    expect(personalNoteAtScreen([BAU], { x: 940, y: 410 }, camera)).toBe('n1')
    expect(personalNoteAtScreen([BAU], { x: 950, y: 418 }, camera)).toBe('n1')
    expect(personalNoteAtScreen([BAU], { x: 1000, y: 410 }, camera)).toBeNull()
    // Duas perto: ganha a mais próxima do dedo.
    const vizinha: PersonalNote = { ...BAU, id: 'n2', x: 426 }
    expect(personalNoteAtScreen([BAU, vizinha], { x: 950, y: 410 }, camera)).toBe('n2')
  })
})
