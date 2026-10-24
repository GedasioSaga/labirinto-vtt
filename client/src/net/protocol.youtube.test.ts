import { describe, expect, it } from 'vitest'
import { midiasDaMensagem } from './liberacaoDosSons'
import { parseSomFalhou, parseSomHostMessage, SOM_DESLOCAMENTO_MAX_S } from './protocol'

// SONS AO VIVO, fatia F6: o YouTube na rede é SÓ o id do vídeo (11 caracteres
// da forma do YouTube) e o trecho em segundos. O jogador (e a TV) passa tudo
// pelo mesmo `parseSomHostMessage`: o que não é id não vira endereço de iframe.

const VIDEO = 'dQw4w9WgXcQ'
const TOCAR = { type: 'som.tocar', instancia: 'som-1', fonte: { tipo: 'youtube', video: VIDEO }, volume: 0.6, loop: true }

describe('som.tocar com YouTube', () => {
  it('passa só com id e trecho, e a cópia leva só os campos conhecidos', () => {
    expect(parseSomHostMessage(TOCAR)).toEqual(TOCAR)
    const comTrecho = { ...TOCAR, fonte: { tipo: 'youtube', video: VIDEO, inicioS: 42, fimS: 90 } }
    expect(parseSomHostMessage(comTrecho)).toEqual(comTrecho)
    const comLixo = { ...TOCAR, fonte: { tipo: 'youtube', video: VIDEO, url: `https://youtu.be/${VIDEO}`, nome: 'Bardo' } }
    expect(parseSomHostMessage(comLixo)).toEqual(TOCAR)
  })

  it.each([
    ['id curto', 'dQw4w9WgXc'],
    ['id longo', 'dQw4w9WgXcQQ'],
    ['id com caractere fora da forma', 'dQw4w9WgX!Q'],
    ['id com HTML', '<img src=x>'],
    ['link no lugar do id', `https://youtu.be/${VIDEO}`],
    ['link do watch', `https://www.youtube.com/watch?v=${VIDEO}`],
    ['javascript:', 'javascript:1'],
    ['número', 12345678901],
    ['nulo', null],
  ])('recusa inteiro o vídeo torto: %s', (_caso, video) => {
    expect(parseSomHostMessage({ ...TOCAR, fonte: { tipo: 'youtube', video } })).toBeNull()
  })

  it.each([
    ['início negativo', { inicioS: -1 }],
    ['início NaN', { inicioS: Number.NaN }],
    ['início em texto', { inicioS: '42' }],
    ['início acima do teto', { inicioS: SOM_DESLOCAMENTO_MAX_S + 1 }],
    ['fim igual ao início', { inicioS: 10, fimS: 10 }],
    ['fim antes do início', { inicioS: 10, fimS: 5 }],
    ['fim zero', { fimS: 0 }],
    ['fim infinito', { fimS: Number.POSITIVE_INFINITY }],
  ])('recusa inteiro o trecho torto: %s', (_caso, trecho) => {
    expect(parseSomHostMessage({ ...TOCAR, fonte: { tipo: 'youtube', video: VIDEO, ...trecho } })).toBeNull()
  })

  it('o YouTube não libera nada no servidor da sala (não passa por /sons)', () => {
    expect(midiasDaMensagem(TOCAR)).toEqual([])
  })

  it('o jogador conta ao mestre o vídeo bloqueado e o indisponível', () => {
    expect(parseSomFalhou({ type: 'som.falhou', instancia: 'som-1', motivo: 'youtube-bloqueado' })).toEqual({ type: 'som.falhou', instancia: 'som-1', motivo: 'youtube-bloqueado' })
    expect(parseSomFalhou({ type: 'som.falhou', instancia: 'som-1', motivo: 'youtube-indisponivel' })).toEqual({ type: 'som.falhou', instancia: 'som-1', motivo: 'youtube-indisponivel' })
    expect(parseSomFalhou({ type: 'som.falhou', instancia: 'som-1', motivo: 'erro-150' })).toBeNull()
  })
})
