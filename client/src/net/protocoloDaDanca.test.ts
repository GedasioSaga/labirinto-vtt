/**
 * MINIGAME DE DANÇA — a fronteira do protocolo. Do jogador, tudo torto cai e
 * o lote mais cheio cabe no teto do servidor; do mestre, o convite com a
 * música importada passa inteiro e a mensagem torta cai inteira.
 */
import { describe, expect, it } from 'vitest'
import { PLAYER_MESSAGE_MAX_BYTES, parsePlayerMessage } from './protocol'
import { DANCA_EVENTOS_MAX, DANCA_PARTICIPANTES_MAX, DANCA_SESSAO_MAX, parseDancaHostMessage } from './protocoloDaDanca'

const PLACAR = { precisao: 0.9, combo: 4, vida: 64, julgadas: 5 }
const FINAL = { precisao: 0.9, letra: 'A', falhou: false, perfeito: 50, bom: 8, ok: 2, errou: 1, comboMax: 40, segOk: 1, segTotal: 2 }
const TOQUE = { lane: 3, j: 'bom', t: 12.5 }

describe('danca: do jogador para o mestre', () => {
  it('aceita as três formas válidas, só com os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'danca.pronto', sessao: 's', dificuldade: 'diversao', extra: 1 })).toEqual({ type: 'danca.pronto', sessao: 's', dificuldade: 'diversao' })
    expect(parsePlayerMessage({ type: 'danca.toques', sessao: 's', eventos: [TOQUE], placar: PLACAR })).toEqual({ type: 'danca.toques', sessao: 's', eventos: [TOQUE], placar: PLACAR })
    expect(parsePlayerMessage({ type: 'danca.fim', sessao: 's', placar: { ...FINAL, x: 1 } })).toEqual({ type: 'danca.fim', sessao: 's', placar: FINAL })
  })

  it('recusa cada forma torta', () => {
    const tortas: unknown[] = [
      { type: 'danca.pronto', sessao: '', dificuldade: 'expert' },
      { type: 'danca.pronto', sessao: 'x'.repeat(DANCA_SESSAO_MAX + 1), dificuldade: 'expert' },
      { type: 'danca.pronto', sessao: 's', dificuldade: 'facil' },
      { type: 'danca.pronto', dificuldade: 'expert' },
      { type: 'danca.toques', sessao: 's', eventos: Array.from({ length: DANCA_EVENTOS_MAX + 1 }, () => TOQUE), placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: [{ ...TOQUE, lane: 4 }], placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: [{ ...TOQUE, j: 'genial' }], placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: [{ ...TOQUE, t: -1 }], placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: [{ ...TOQUE, t: Number.NaN }], placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: 'muitos', placar: PLACAR },
      { type: 'danca.toques', sessao: 's', eventos: [], placar: { ...PLACAR, precisao: 1.01 } },
      { type: 'danca.toques', sessao: 's', eventos: [], placar: { ...PLACAR, vida: 101 } },
      { type: 'danca.toques', sessao: 's', eventos: [], placar: { ...PLACAR, combo: 1.5 } },
      { type: 'danca.toques', sessao: 's', eventos: [], placar: { ...PLACAR, julgadas: Number.POSITIVE_INFINITY } },
      { type: 'danca.toques', sessao: 's', eventos: [] },
      { type: 'danca.fim', sessao: 's', placar: { ...FINAL, letra: 'E' } },
      { type: 'danca.fim', sessao: 's', placar: { ...FINAL, falhou: 'nao' } },
      { type: 'danca.fim', sessao: 's', placar: { ...FINAL, segOk: 3 } },
      { type: 'danca.fim', sessao: 's', placar: { ...FINAL, errou: -1 } },
      { type: 'danca.fim', sessao: 's' },
    ]
    for (const torta of tortas) expect(parsePlayerMessage(torta)).toBeNull()
  })

  it('o lote mais cheio, com os números mais longos, cabe no teto do servidor', () => {
    const lote = { type: 'danca.toques', sessao: 'x'.repeat(DANCA_SESSAO_MAX), eventos: Array.from({ length: DANCA_EVENTOS_MAX }, () => ({ lane: 3, j: 'perfeito', t: 1199.9999999999998 })), placar: { precisao: 0.12345678901234568, combo: 99999, vida: 99.99999999999999, julgadas: 99999 } }
    expect(parsePlayerMessage(lote)).not.toBeNull()
    expect(new TextEncoder().encode(JSON.stringify(lote)).length).toBeLessThan(PLAYER_MESSAGE_MAX_BYTES)
  })
})

describe('danca: do mestre para o jogador', () => {
  const convite = {
    type: 'danca.convite',
    sessao: 's',
    pinId: 'p',
    npc: 'Dona Ziza',
    fala: 'Ginga?',
    permitida: 'escolha',
    notaMin: 'B',
    premio: { tipo: 'item', texto: 'Chave' },
    musica: {
      tipo: 'arquivo',
      midia: `midia:${'f'.repeat(64)}.ogg`,
      nome: 'Faixa',
      bpm: 120,
      primeiraBatida: 0.5,
      fase4: 1,
      duracaoS: 60,
      coreografias: { diversao: [{ t: 1, lane: 0, len: 0, sub: 4 }], expert: [{ t: 1, lane: 2, len: 1, sub: 16 }] },
    },
    participantes: [{ playerId: 'a', nome: 'Ana' }],
  }

  it('o convite com música importada passa inteiro; a demo também', () => {
    expect(parseDancaHostMessage(convite)).toEqual(convite)
    expect(parseDancaHostMessage({ ...convite, musica: { tipo: 'demo' } })?.type).toBe('danca.convite')
  })

  it('convite torto cai inteiro', () => {
    const tortos: unknown[] = [
      { ...convite, musica: { ...convite.musica, midia: 'C:/musica.mp3' } },
      { ...convite, musica: { ...convite.musica, midia: `midia:${'f'.repeat(64)}.png` } },
      { ...convite, musica: { ...convite.musica, coreografias: { diversao: [{ t: 1, lane: 7, len: 0, sub: 4 }], expert: [] } } },
      { ...convite, musica: { ...convite.musica, bpm: 0 } },
      { ...convite, participantes: [] },
      { ...convite, participantes: Array.from({ length: DANCA_PARTICIPANTES_MAX + 1 }, (_, i) => ({ playerId: `p${i}`, nome: 'X' })) },
      { ...convite, notaMin: 'F' },
      { ...convite, premio: { tipo: 'ouro', texto: '' } },
      { ...convite, permitida: 'facil' },
    ]
    for (const torto of tortos) expect(parseDancaHostMessage(torto)).toBeNull()
  })

  it('as outras mensagens: válidas passam, tortas caem', () => {
    expect(parseDancaHostMessage({ type: 'danca.estado', sessao: 's', fase: 'musica', participantes: [{ playerId: 'a', status: 'saiu' }] })).not.toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.estado', sessao: 's', fase: 'fim', participantes: [] })).toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.estado', sessao: 's', fase: 'convite', participantes: [{ playerId: 'a', status: 'dormindo' }] })).toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.comecar', sessao: 's', emMs: 3000, participantes: [{ playerId: 'a', nome: 'Ana', dificuldade: 'expert' }] })).not.toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.comecar', sessao: 's', emMs: 3000, participantes: [{ playerId: 'a', nome: 'Ana' }] })).toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.encerra', sessao: 's', motivo: 'saiu' })).toEqual({ type: 'danca.encerra', sessao: 's', motivo: 'saiu' })
    expect(parseDancaHostMessage({ type: 'danca.encerra', sessao: 's', motivo: 'tédio' })).toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.colegas', sessao: 's', playerId: 'b', eventos: [TOQUE], placar: PLACAR })).not.toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.colegas', sessao: 's', eventos: [TOQUE], placar: PLACAR })).toBeNull()
    const desfecho = { type: 'danca.desfecho', sessao: 's', todosPassaram: false, portaAberta: false, mesa: [{ playerId: 'a', nome: 'Ana', letra: 'Saiu', precisao: 0 }], seu: { passou: false, consequencia: { tipo: 'teste', texto: '-2' } } }
    expect(parseDancaHostMessage(desfecho)).toEqual(desfecho)
    expect(parseDancaHostMessage({ ...desfecho, seu: { passou: false, consequencia: { tipo: 'multa', texto: '' } } })).toBeNull()
    expect(parseDancaHostMessage({ type: 'danca.pausa' })).toBeNull()
  })
})
