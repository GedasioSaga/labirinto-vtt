/**
 * CORREIO DE BILHETES no protocolo: o que vem do jogador é hostil (texto
 * aparado, dentro do teto, meio conhecido, nome de colega na forma da sala), e
 * o que vai a ele sai só com os campos conhecidos.
 */
import { describe, expect, it } from 'vitest'
import { LETTER_TEXT_MAX_LENGTH } from '../lib/correio'
import { parseLetterMessage, parseNotebook, parsePlayerMessage, parseSceneNote } from './protocol'

describe('letter.send (jogador -> mestre)', () => {
  it('apara o texto e devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'letter.send', to: 'Bruno', via: 'capsula', text: '  oi  ', sceneId: 's-x' })).toEqual({
      type: 'letter.send',
      to: 'Bruno',
      via: 'capsula',
      text: 'oi',
    })
    expect(parsePlayerMessage(JSON.stringify({ type: 'letter.peers', extra: 1 }))).toEqual({ type: 'letter.peers' })
  })

  it('recusa texto vazio, acima do teto, meio desconhecido e destinatário fora da forma', () => {
    expect(parsePlayerMessage({ type: 'letter.send', to: 'Bruno', via: 'pombo', text: '   ' })).toBeNull()
    expect(parsePlayerMessage({ type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'x'.repeat(LETTER_TEXT_MAX_LENGTH + 1) })).toBeNull()
    expect(parsePlayerMessage({ type: 'letter.send', to: 'Bruno', via: 'corvo', text: 'oi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'letter.send', to: '', via: 'pombo', text: 'oi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'letter.send', to: 7, via: 'pombo', text: 'oi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'letter.send', via: 'pombo', text: 'oi' })).toBeNull()
  })
})

describe('bilhete entregue (scene.note com from e via)', () => {
  it('guarda quem escreveu e o meio; sem os dois é recado do mestre', () => {
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', at: 5, from: 'Ana', via: 'tubo', sceneId: 's-x' })).toEqual({
      type: 'scene.note',
      id: 'n1',
      text: 'oi',
      at: 5,
      from: 'Ana',
      via: 'tubo',
    })
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi' })).toEqual({ type: 'scene.note', id: 'n1', text: 'oi' })
  })

  it('um só dos dois, ou meio desconhecido, recusa o recado inteiro', () => {
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', from: 'Ana' })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', via: 'pombo' })).toBeNull()
    expect(parseSceneNote({ type: 'scene.note', id: 'n1', text: 'oi', from: 'Ana', via: 'corvo' })).toBeNull()
  })

  it('o caderno leva o remetente de cada bilhete', () => {
    const book = parseNotebook({
      type: 'notes.book',
      notes: [
        { id: 'n1', text: 'recado', at: 1 },
        { id: 'n2', text: 'bilhete', at: 2, from: 'Ana', via: 'pombo', sceneId: 's-x' },
      ],
    })
    expect(book).toEqual({
      type: 'notes.book',
      notes: [
        { id: 'n1', text: 'recado', at: 1 },
        { id: 'n2', text: 'bilhete', at: 2, from: 'Ana', via: 'pombo' },
      ],
    })
    expect(parseNotebook({ type: 'notes.book', notes: [{ id: 'n2', text: 'b', at: 2, from: 'Ana', via: 'corvo' }] })).toBeNull()
  })

  it('o caderno marca o bilhete entregue fora do jogo como não lido, só entre os ids que ele traz', () => {
    const notes = [
      { id: 'n1', text: 'recado', at: 1 },
      { id: 'n2', text: 'bilhete', at: 2, from: 'Ana', via: 'pombo' },
    ]
    expect(parseNotebook({ type: 'notes.book', notes, unread: ['n2', 'n-fantasma'] })).toEqual({ type: 'notes.book', notes, unread: ['n2'] })
    // Sem o campo, o caderno é só história, como sempre foi.
    expect(parseNotebook({ type: 'notes.book', notes })).toEqual({ type: 'notes.book', notes })
    // Campo com forma errada recusa o caderno inteiro, como um item ruim.
    expect(parseNotebook({ type: 'notes.book', notes, unread: 'n2' })).toBeNull()
    expect(parseNotebook({ type: 'notes.book', notes, unread: [7] })).toBeNull()
  })
})

describe('parseLetterMessage (mestre -> jogador)', () => {
  it('lista de colegas e resultado do envio, só com os campos conhecidos', () => {
    expect(parseLetterMessage({ type: 'letter.peers', names: ['Bruno', 'Caio'], scenes: ['s-x'] })).toEqual({ type: 'letter.peers', names: ['Bruno', 'Caio'] })
    expect(parseLetterMessage({ type: 'letter.send.result', to: 'Bruno', ok: true })).toEqual({ type: 'letter.send.result', to: 'Bruno', ok: true })
    expect(parseLetterMessage({ type: 'letter.send.result', to: 'Bruno', ok: false, reason: 'full' })).toEqual({
      type: 'letter.send.result',
      to: 'Bruno',
      ok: false,
      reason: 'full',
    })
    // Motivo que este jogador não conhece vira a recusa comum.
    expect(parseLetterMessage({ type: 'letter.send.result', to: 'Bruno', ok: false, reason: 'novo' })).toEqual({ type: 'letter.send.result', to: 'Bruno', ok: false })
  })

  it('recusa forma errada', () => {
    expect(parseLetterMessage({ type: 'letter.peers', names: [7] })).toBeNull()
    expect(parseLetterMessage({ type: 'letter.peers' })).toBeNull()
    expect(parseLetterMessage({ type: 'letter.send.result', to: 'Bruno' })).toBeNull()
    expect(parseLetterMessage({ type: 'scene.note', id: 'n1', text: 'oi' })).toBeNull()
    expect(parseLetterMessage(null)).toBeNull()
  })
})
