import { describe, expect, it } from 'vitest'
import { parseFogoHostMessage, parseFogoPlayerMessage, placarDoJogo } from './protocoloDoFogo'

const ENTRADA = [1, 0, 250, -120, 1, 0, 0]

/** O placar como o jogo manda (snake_case, seção 6 do GDD). */
const PLACAR_DO_JOGO = {
  vitoria: true,
  motivo: 'apagado',
  dificuldade: 'normal',
  semente: 1000,
  pontos: 3195,
  estrelas: 3,
  floresta_viva: 81,
  area_salva: 400,
  area_inicial: 500,
  casas: 3,
  tempo_s: 35,
  por_jogador: [{ id: 'ana', nome: 'Ana', funcao: 'lenhador', funcao_inicial: 'bombeiro', pontos: 1200 }],
}

describe('protocolo do Fogo na Floresta', () => {
  it('aceita cada mensagem válida e converte o placar do jogo', () => {
    const placar = placarDoJogo(PLACAR_DO_JOGO)
    expect(placar).toEqual({ vitoria: true, motivo: 'apagado', pontos: 3195, estrelas: 3, florestaViva: 81, casas: 3, tempoS: 35, porJogador: [{ id: 'ana', funcao: 'bombeiro', pontos: 1200 }] })
    const doJogador = [
      { type: 'fogo.pronto', sessao: 's', funcao: 'socorrista' },
      { type: 'fogo.entradas', sessao: 's', de: 5, lista: [ENTRADA, ENTRADA] },
      { type: 'fogo.hash', sessao: 's', tique: 50, hash: 3908000128 },
      { type: 'fogo.fim', sessao: 's', tique: 353, hash: 3908000128, placar },
      { type: 'fogo.desistir', sessao: 's', motivo: 'recusou' },
      { type: 'fogo.desistir', sessao: 's', motivo: 'erro' },
    ]
    for (const msg of doJogador) expect(parseFogoPlayerMessage(msg)).toEqual(msg)
    const doMestre = [
      { type: 'fogo.comecar', sessao: 's', semente: 1000, dificuldade: 'normal', atraso: 4, jogadores: [{ id: 'ana', nome: 'Ana', funcao: 'bombeiro' }] },
      { type: 'fogo.entradas', sessao: 's', lotes: [{ id: 'bia', de: 5, lista: [ENTRADA] }] },
      { type: 'fogo.sair', sessao: 's', id: 'bia', depoisDe: 0 },
      {
        type: 'fogo.desfecho',
        sessao: 's',
        modo: 'equipe',
        placar: { vitoria: true, motivo: 'apagado', pontos: 3195, estrelas: 3, florestaViva: 81, casas: 3, tempoS: 35 },
        mesa: [{ playerId: 'ana', nome: 'Ana', funcao: 'bombeiro', pontos: 1200, resultado: 'venceu' }],
        seu: { passou: true, premio: { texto: 'Refeição quente' } },
      },
    ]
    for (const msg of doMestre) expect(parseFogoHostMessage(msg)).toEqual(msg)
  })

  it('recusa a mensagem inteira com um campo torto', () => {
    const tortas = [
      { type: 'fogo.pronto', sessao: 's', funcao: 'piloto' },
      { type: 'fogo.entradas', sessao: 's', de: 0, lista: [ENTRADA] },
      { type: 'fogo.entradas', sessao: 's', de: 5, lista: [[1, 0, 0]] },
      { type: 'fogo.entradas', sessao: 's', de: 5, lista: Array.from({ length: 101 }, () => ENTRADA) },
      { type: 'fogo.hash', sessao: 's', tique: 50, hash: 1.5 },
      { type: 'fogo.fim', sessao: 's', tique: 353, hash: 1, placar: { ...PLACAR_DO_JOGO } },
      { type: 'fogo.pronto', sessao: '', funcao: 'bombeiro' },
      { type: 'fogo.desistir', sessao: 's', motivo: 'cansei' },
    ]
    for (const msg of tortas) expect(parseFogoPlayerMessage(msg)).toBeNull()
    expect(parseFogoHostMessage({ type: 'fogo.comecar', sessao: 's', semente: 1, dificuldade: 'normal', atraso: 4, jogadores: Array.from({ length: 7 }, (_, i) => ({ id: `j${i}`, nome: 'X', funcao: 'bombeiro' })) })).toBeNull()
    expect(placarDoJogo({ ...PLACAR_DO_JOGO, floresta_viva: 140 })).toBeNull()
  })
})
