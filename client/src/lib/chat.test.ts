/**
 * NOME DE QUEM JOGA, a parte pura: a limpeza do nome que entra na sala e o
 * rótulo " (jogador)" de quem entrou com um nome que se passa por "Mestre".
 * Caractere especial vai por escape: colado cru, não se vê na revisão.
 */
import { describe, expect, it } from 'vitest'
import { chatFacesByName, chatSpeakerLabel, cleanChatText, cleanPlayerName, findMentions, nameSkeleton } from './chat'

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

describe('chatFacesByName: a foto de quem falou, só do que a tela já tem', () => {
  const FOTO_ANA = 'data:image/png;base64,QU5B'
  const FOTO_BIA = 'data:image/png;base64,QklB'

  it('a primeira ficha da pessoa que tem foto, na ordem da posse; sem foto ou sem ficha à vista, o nome não entra', () => {
    const tokens = [
      { id: 'ana-1', imageData: null },
      { id: 'ana-2', imageData: FOTO_ANA },
      { id: 'bia', imageData: FOTO_BIA },
      { id: 'cris', imageData: '' },
    ]
    const faces = chatFacesByName(
      [
        { name: 'Ana', tokenIds: ['ana-1', 'ana-2'] },
        { name: 'Bia', tokenIds: ['bia'] },
        { name: 'Cris', tokenIds: ['cris'] },
        { name: 'Dora', tokenIds: ['longe-daqui'] },
      ],
      tokens,
    )
    expect([...faces]).toEqual([
      ['Ana', FOTO_ANA],
      ['Bia', FOTO_BIA],
    ])
  })

  it('nome repetido vale o primeiro: ninguém troca a foto de outro escrevendo o mesmo nome', () => {
    const faces = chatFacesByName(
      [
        { name: 'Ana', tokenIds: ['ana'] },
        { name: 'Ana', tokenIds: ['bia'] },
      ],
      [
        { id: 'ana', imageData: FOTO_ANA },
        { id: 'bia', imageData: FOTO_BIA },
      ],
    )
    expect(faces.get('Ana')).toBe(FOTO_ANA)
  })
})

describe('chat: a junção de largura zero (ZWJ) só fica dentro de emoji composto', () => {
  /** Emoji composto por ZWJ, com o seletor de variação ou o tom de pele no meio. */
  const EMOJI_COMPOSTO = [
    '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}', // bandeira pirata
    '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}', // família: homem, mulher e menina
    '\u{1F9D1}\u{1F3FD}\u{200D}\u{1F680}', // astronauta, tom de pele médio
  ]

  it('o emoji composto chega inteiro, sozinho ou no meio da frase', () => {
    for (const emoji of EMOJI_COMPOSTO) {
      expect(cleanChatText(emoji)).toBe(emoji)
      expect(cleanChatText(`  oi ${emoji} @Ana  `)).toBe(`oi ${emoji} @Ana`)
    }
  })

  it('fora de emoji o ZWJ sai: entre letras, no começo, no fim e colado numa menção', () => {
    const CASOS: readonly (readonly [string, string])[] = [
      ['ad\u{200D}min', 'admin'], // entre letras
      ['\u{200D}oi', 'oi'], // no começo
      ['\u{200D}\u{1F680} oi', '\u{1F680} oi'], // no começo, com emoji só depois
      ['oi \u{1F680}\u{200D}', 'oi \u{1F680}'], // no fim, com emoji só antes
      ['@\u{200D}Ana oi', '@Ana oi'], // colado no @
      ['oi @Ana\u{200D}', 'oi @Ana'], // colado no fim da menção
      ['\u{1F3F4}\u{200D}@Ana', '\u{1F3F4}@Ana'], // entre emoji e @
    ]
    for (const [bruto, limpo] of CASOS) expect(cleanChatText(bruto)).toBe(limpo)
    // A menção disfarçada volta a ser menção.
    expect(findMentions(cleanChatText('@\u{200D}Ana oi'), ['Ana'])).toEqual(['Ana'])
  })
})
