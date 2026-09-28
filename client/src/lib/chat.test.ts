/**
 * NOME DE QUEM JOGA, a parte pura: a limpeza do nome que entra na sala e o
 * rótulo " (jogador)" de quem entrou com um nome que se passa por "Mestre".
 * Caractere especial vai por escape: colado cru, não se vê na revisão.
 */
import { describe, expect, it } from 'vitest'
import { chatSpeakerLabel, cleanPlayerName, nameSkeleton } from './chat'

/** "Mestre" com um invisível colado: um de cada família que a limpeza antiga deixava passar. */
const MESTRE_COM_INVISIVEL = [
  'Mestre\u{00AD}', // hífen suave
  'Mestre\u{034F}', // junção de grafemas
  'Mestre\u{3164}', // preenchimento do hangul
  'Mes\u{115F}tre', // preenchimento do hangul, no meio
  'Mestre\u{FE0F}', // seletor de variação
  'Mestre\u{180E}', // separador de vogal do mongol
  'Mestre\u{E0020}', // tag (U+E0000-E007F)
]

/** "Mestre" escrito com letra que se desenha igual à latina, ou com o branco do Braille no fim. */
const MESTRE_DISFARCADO = [
  'M\u{0435}stre', // "e" cirílico
  '\u{041C}estre', // "M" cirílico
  '\u{041C}\u{0435}\u{0455}\u{0442}\u{0433}\u{0435}', // tudo cirílico
  '\u{039C}estre', // "M" grego
  '\u{039C}\u{0395}STR\u{0395}', // "M" e "E" gregos, em maiúsculas
  '\u{FF2D}estre', // "M" largo
  'Mestre\u{2800}', // branco do Braille
]

describe('chat: quem falou', () => {
  it('nome que imita "Mestre" com um invisível colado ganha " (jogador)"', () => {
    for (const from of MESTRE_COM_INVISIVEL) expect(chatSpeakerLabel(from)).toBe(`${from} (jogador)`)
  })

  it('nome que imita "Mestre" com letra cirílica, grega, larga ou com o branco do Braille ganha " (jogador)"', () => {
    for (const from of MESTRE_DISFARCADO) expect(chatSpeakerLabel(from)).toBe(`${from} (jogador)`)
  })

  it('nome que não é "Mestre" fica como está, mesmo parecido', () => {
    for (const from of ['Ana', 'Mestrado', 'Mestres', 'Maestre', 'M\u{0435}strado']) expect(chatSpeakerLabel(from)).toBe(from)
  })
})

describe('chat: esqueleto do nome', () => {
  it('acento que vem na letra conta: "José" e "Jose" são nomes diferentes', () => {
    expect(nameSkeleton('Jos\u{00E9}')).not.toBe(nameSkeleton('Jose'))
  })

  it('o acento escrito à parte é o mesmo acento da letra', () => {
    expect(nameSkeleton('Jose\u{0301}')).toBe(nameSkeleton('Jos\u{00E9}'))
  })

  it('maiúscula e espaço não contam', () => {
    expect(nameSkeleton(' Ana  Maria ')).toBe(nameSkeleton('anamaria'))
  })

  it('a letra cirílica que imita a latina conta como ela', () => {
    expect(nameSkeleton('\u{0410}na')).toBe(nameSkeleton('Ana'))
  })
})

describe('chat: nome de quem entra', () => {
  it('o invisível que a limpeza antiga deixava passar sai do nome', () => {
    for (const nome of MESTRE_COM_INVISIVEL) expect(cleanPlayerName(nome)).toBe('Mestre')
  })

  it('a letra larga vira a comum, e o acento escrito à parte volta para a letra', () => {
    expect(cleanPlayerName('\u{FF21}na')).toBe('Ana')
    expect(cleanPlayerName('Jose\u{0301}')).toBe('Jos\u{00E9}')
    // O invisível entre a letra e o acento sai antes: o acento não fica solto.
    expect(cleanPlayerName('Jose\u{034F}\u{0301}')).toBe('Jos\u{00E9}')
  })

  it('o branco do Braille vira espaço, como a quebra de linha', () => {
    expect(cleanPlayerName('Ana\u{2800}Maria')).toBe('Ana Maria')
    expect(cleanPlayerName('\u{2800}Ana\u{2800}')).toBe('Ana')
  })

  it('nome feito só de invisível ou de branco do Braille fica vazio: não entra', () => {
    for (const nome of ['\u{3164}\u{115F}\u{FFA0}', '\u{2800}\u{2800}', '\u{00AD}\u{FE0F}\u{E0020}']) expect(cleanPlayerName(nome)).toBe('')
  })

  it('o seletor de variação também sai do emoji: o coração fica, no estilo de texto', () => {
    expect(cleanPlayerName('Ana \u{2764}\u{FE0F}')).toBe('Ana \u{2764}')
  })
})
