import { describe, expect, it } from 'vitest'
import { MY_NOTES_MAX, parsePersonalNoteList, readPersonalNoteList } from '../lib/minhasNotas'
import {
  PERSONAL_NOTE_MAX_LENGTH,
  addPersonalNote,
  cleanNoteText,
  groupNotesByMap,
  notesOnMap,
  personalNoteAtScreen,
  removePersonalNote,
  type PersonalNote,
} from './personalNotes'

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

  it('com o caderno no teto, anotar não cria nada: o host recusaria a lista inteira', () => {
    const cheio = Array.from({ length: MY_NOTES_MAX }, (_, i): PersonalNote => ({ ...BAU, id: `n${i}` }))
    expect(addPersonalNote(cheio, { ...BAU, id: 'uma-a-mais' })).toBe(cheio)
  })

  it('a lista que o jogador manda ao host é rígida: nota torta, id repetido ou acima do teto recusam tudo', () => {
    expect(parsePersonalNoteList([BAU])).toEqual([BAU])
    expect(parsePersonalNoteList([])).toEqual([])
    expect(parsePersonalNoteList([BAU, { ...BAU, text: 'outra' }])).toBeNull()
    expect(parsePersonalNoteList([BAU, { id: 'n2', mapId: 'vila', x: 'dez', y: 1, text: 'sem x' }])).toBeNull()
    expect(parsePersonalNoteList([{ ...BAU, text: 'z'.repeat(41) }])).toBeNull()
    expect(parsePersonalNoteList([{ ...BAU, text: '   ' }])).toBeNull()
    expect(parsePersonalNoteList([{ ...BAU, x: Number.POSITIVE_INFINITY }])).toBeNull()
    expect(parsePersonalNoteList([{ ...BAU, mapId: 'm'.repeat(129) }])).toBeNull()
    expect(parsePersonalNoteList([{ ...BAU, id: 'i'.repeat(65) }])).toBeNull()
    expect(parsePersonalNoteList(Array.from({ length: MY_NOTES_MAX + 1 }, (_, i) => ({ ...BAU, id: `n${i}` })))).toBeNull()
    expect(parsePersonalNoteList('nada')).toBeNull()
  })

  it('o arquivo da mesa é tolerante: nota torta cai sozinha, e o texto sai limpo', () => {
    const lidas = readPersonalNoteList([
      BAU,
      { id: 'n2', mapId: 'vila', x: 'dez', y: 1, text: 'sem x' },
      { id: 'n3', mapId: 'vila', x: 1, y: 2, text: '' },
      { id: 'n4', mapId: 'vila', x: 1, y: 2, text: '  poço   seco ' },
      { ...BAU, text: 'repetida' },
      null,
    ])
    expect(lidas.map((n) => n.id)).toEqual(['n1', 'n4'])
    expect(lidas[1]?.text).toBe('poço seco')
    expect(readPersonalNoteList({ a: 1 })).toEqual([])
  })

  it('cada cena mostra só as notas dela', () => {
    const outra: PersonalNote = { id: 'n2', mapId: 'masmorra', x: 10, y: 20, text: 'armadilha' }
    expect(notesOnMap([BAU, outra], 'vila')).toEqual([BAU])
    expect(notesOnMap([BAU, outra], 'nenhum')).toEqual([])
  })

  it('o Caderno agrupa por mapa: o da tela primeiro, os outros pela nota mais nova, a mais nova em cima', () => {
    const armadilha: PersonalNote = { id: 'n2', mapId: 'masmorra', x: 10, y: 20, text: 'armadilha' }
    const poco: PersonalNote = { id: 'n3', mapId: 'vila', x: 30, y: 40, text: 'poço' }
    const porta: PersonalNote = { id: 'n4', mapId: 'torre', x: 5, y: 5, text: 'porta falsa' }
    const grupos = groupNotesByMap([BAU, armadilha, poco, porta], 'vila')
    expect(grupos.map((g) => [g.mapId, g.here, g.notes.map((n) => n.id)])).toEqual([
      ['vila', true, ['n3', 'n1']],
      ['torre', false, ['n4']],
      ['masmorra', false, ['n2']],
    ])
    expect(groupNotesByMap([], 'vila')).toEqual([])
    // Sem mapa na tela (sala fechada): todos são "outro lugar".
    expect(groupNotesByMap([BAU], undefined)[0]?.here).toBe(false)
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
