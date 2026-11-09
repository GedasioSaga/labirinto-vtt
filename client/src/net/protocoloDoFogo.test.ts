import { describe, expect, it } from 'vitest'
import { parseFogoHostMessage, parseFogoPlayerMessage, placarDoJogo } from './protocoloDoFogo'

/** Uma entrada v2: `[frente, lado, olhar, mx, my, acao, ferramenta]`. */
const ENTRADA = [1, 0, 2048, 1250, -120, 1, 0]

const ALTURA_DO_JOGO = { viva: 72, inicial: 400, vivas_no_fim: 288, queimadas: 90 }

/** O placar como o jogo manda (snake_case, seção 6 do GDD, versão 2). */
const PLACAR_DO_JOGO = {
  vitoria: false,
  motivo: 'vila',
  dificuldade: 'normal',
  semente: 1000,
  modo: 'equipe',
  contam: ['rasteiro', 'tronco', 'copa'],
  pontos: 930,
  estrelas: 0,
  floresta_viva: 61,
  alturas: { rasteiro: ALTURA_DO_JOGO, tronco: { ...ALTURA_DO_JOGO, viva: 55 }, copa: { ...ALTURA_DO_JOGO, viva: 56 } },
  casas: 1,
  tempo_s: 119,
  por_jogador: [
    {
      id: 'ana',
      nome: 'Ana',
      ferramenta: 'mangueira',
      ferramenta_inicial: 'bolha',
      pontos: 120,
      fogo_certo: 31_500,
      apagou: { rasteiro: 0, tronco: 2, copa: 9 },
      agua_usada: 40,
      bolhas_usadas: 12,
      areia_usada: 0,
      desmaios: 0,
    },
  ],
}

describe('protocolo do Fogo na Floresta (ponte v2, primeira pessoa)', () => {
  it('aceita cada mensagem válida e converte o placar do jogo (ferramenta inicial, alturas e fogo certo)', () => {
    const placar = placarDoJogo(PLACAR_DO_JOGO)
    const altura = { viva: 72, inicial: 400, vivasNoFim: 288, queimadas: 90 }
    expect(placar).toEqual({
      vitoria: false,
      motivo: 'vila',
      modo: 'equipe',
      contam: ['rasteiro', 'tronco', 'copa'],
      pontos: 930,
      estrelas: 0,
      florestaViva: 61,
      alturas: { rasteiro: altura, tronco: { ...altura, viva: 55 }, copa: { ...altura, viva: 56 } },
      casas: 1,
      tempoS: 119,
      porJogador: [{ id: 'ana', ferramenta: 'bolha', pontos: 120, fogoCerto: 31_500 }],
    })
    if (placar === null) throw new Error('placar recusado')
    const { porJogador: _porJogador, ...resumo } = placar
    const doJogador = [
      { type: 'fogo.pronto', sessao: 's', ferramenta: 'areia' },
      { type: 'fogo.entradas', sessao: 's', de: 5, lista: [ENTRADA, ENTRADA] },
      { type: 'fogo.hash', sessao: 's', tique: 50, hash: 2594077983 },
      { type: 'fogo.fim', sessao: 's', tique: 1197, hash: 2594077983, placar },
      { type: 'fogo.desistir', sessao: 's', motivo: 'recusou' },
    ]
    for (const msg of doJogador) expect(parseFogoPlayerMessage(msg)).toEqual(msg)
    const doMestre = [
      { type: 'fogo.convite', sessao: 's', pinId: 'p', npc: 'Guarda', fala: 'Socorro', floresta: 'Mata', modo: 'solo', premio: { texto: '' }, consequencia: { texto: '' }, participantes: [{ playerId: 'ana', nome: 'Ana', ferramenta: 'bolha' }] },
      { type: 'fogo.comecar', sessao: 's', semente: 1000, dificuldade: 'normal', atraso: 4, jogadores: [{ id: 'ana', nome: 'Ana', ferramenta: 'mangueira' }] },
      { type: 'fogo.entradas', sessao: 's', lotes: [{ id: 'bia', de: 5, lista: [ENTRADA] }] },
      {
        type: 'fogo.desfecho',
        sessao: 's',
        modo: 'equipe',
        placar: resumo,
        mesa: [{ playerId: 'ana', nome: 'Ana', ferramenta: 'bolha', pontos: 120, fogoCerto: 31_500, resultado: 'perdeu' }],
        seu: { passou: false, consequencia: { texto: 'A estrada fecha' } },
      },
    ]
    for (const msg of doMestre) expect(parseFogoHostMessage(msg)).toEqual(msg)
  })

  it('recusa a mensagem inteira com um campo torto (inclusive a função da v1 no lugar da ferramenta)', () => {
    const tortas = [
      { type: 'fogo.pronto', sessao: 's', funcao: 'bombeiro' },
      { type: 'fogo.pronto', sessao: 's', ferramenta: 'machado' },
      { type: 'fogo.entradas', sessao: 's', de: 0, lista: [ENTRADA] },
      { type: 'fogo.entradas', sessao: 's', de: 5, lista: [[1, 0, 0]] },
      { type: 'fogo.hash', sessao: 's', tique: 50, hash: 1.5 },
      // O placar no formato do JOGO (snake_case) não passa no fio do app.
      { type: 'fogo.fim', sessao: 's', tique: 1197, hash: 1, placar: { ...PLACAR_DO_JOGO } },
    ]
    for (const msg of tortas) expect(parseFogoPlayerMessage(msg)).toBeNull()
    expect(parseFogoHostMessage({ type: 'fogo.comecar', sessao: 's', semente: 1, dificuldade: 'normal', atraso: 4, jogadores: [{ id: 'ana', nome: 'Ana', funcao: 'bombeiro' }] })).toBeNull()
    // Sem uma das 3 alturas, altura que não existe no `contam`, ou % fora de 0 a 100: o placar inteiro cai.
    expect(placarDoJogo({ ...PLACAR_DO_JOGO, alturas: { rasteiro: ALTURA_DO_JOGO, tronco: ALTURA_DO_JOGO } })).toBeNull()
    expect(placarDoJogo({ ...PLACAR_DO_JOGO, contam: ['chao'] })).toBeNull()
    expect(placarDoJogo({ ...PLACAR_DO_JOGO, floresta_viva: 140 })).toBeNull()
  })
})
