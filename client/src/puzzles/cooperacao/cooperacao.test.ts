import { describe, expect, it } from 'vitest'
import { idDoSeloDoPonto, pinoDeMinigameDoMapa, pinosDosDesafios } from '../../lib/desafios'
import { tokenReachesPin } from '../../lib/items'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import { desafioDePuzzleDoMapa } from '../../net/puzzleNoHost'
import type { Desafio } from '../../types/map'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import { VERSAO_DO_PUZZLE } from '../tipos'
import type { ContextoDoMotor, CooperacaoDoPuzzle, ProgressoDoPuzzle, Puzzle, QuemMexe } from '../tipos'
import { cooperacaoPadrao } from './cooperacao'

/**
 * A COOPERAÇÃO EM DOIS LUGARES (28/11): cada ponto só obedece a quem está nele
 * (o host passa o ponto conferido), os lampiões ficam acesos pela janela, e
 * todos acesos ao mesmo tempo abrem. A hora é fixa: o motor não lê relógio.
 */

const LARA: QuemMexe = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }
const BENTO: QuemMexe = { personagemId: 'p-bento', tokenId: 't-bento', nome: 'Bento' }
const T0 = 1_700_000_000_000
const JANELA_S = 5

function contexto(quem: QuemMexe, agora: number, ponto: number | undefined): ContextoDoMotor {
  return { quem, agora, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => 'novo', ...(ponto === undefined ? {} : { ponto }) }
}

function duasAlavancas(mudar: Partial<CooperacaoDoPuzzle> = {}): Puzzle {
  const base = puzzleDoModelo('fonte')
  return { ...base, encaixes: [], futuro: { ...cooperacaoPadrao(), janela: JANELA_S, ...mudar }, desfecho: { ...base.desfecho, abrePorta: true } }
}

/** `conferido`: o ponto que o host conferiu (o da ficha); `null` = nenhum. */
function acionar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, quem: QuemMexe, agora: number, ponto: number, conferido: number | null = ponto) {
  return agirNoPuzzle(puzzle, progresso, [], { tipo: 'apertar', botao: ponto }, contexto(quem, agora, conferido ?? undefined))
}

describe('cooperação em dois lugares', () => {
  it('os dois pontos dentro da janela abrem a porta; fora da janela, não', () => {
    const puzzle = duasAlavancas()
    // Lara puxa, Bento puxa 6 s depois: a de Lara já apagou.
    const lara = acionar(puzzle, progressoInicial(puzzle), LARA, T0, 0)
    expect(lara.progresso.resolvido).toBeNull()
    const tarde = acionar(puzzle, lara.progresso, BENTO, T0 + 6_000, 1)
    expect(tarde.progresso.resolvido).toBeNull()
    expect(tarde.efeitos.some((efeito) => efeito.tipo === 'entregar')).toBe(false)
    // Lara puxa de novo 2 s depois de Bento: os dois acesos, abre.
    const junto = acionar(puzzle, tarde.progresso, LARA, T0 + 8_000, 0)
    expect(junto.progresso.resolvido).toEqual({ por: 'Lara', em: T0 + 8_000 })
    expect(junto.efeitos).toContainEqual(expect.objectContaining({ tipo: 'entregar', desfecho: expect.objectContaining({ abrePorta: true }) }))
    // A janela é do mestre: com 10 s, os 6 s de antes já bastariam.
    const larga = duasAlavancas({ janela: 10 })
    expect(acionar(larga, acionar(larga, progressoInicial(larga), LARA, T0, 0).progresso, BENTO, T0 + 6_000, 1).progresso.resolvido).not.toBeNull()
    // Uma pessoa só não segura os dois: indo ao outro ponto, solta o primeiro.
    const sozinha = acionar(puzzle, acionar(puzzle, progressoInicial(puzzle), LARA, T0, 0).progresso, LARA, T0 + 1_000, 1)
    expect(sozinha.progresso.resolvido).toBeNull()
    expect(sozinha.progresso.acionados?.[0]).toBeNull()
  })

  it('só quem está no ponto pode usar: o selo de cada ponto tem a régua dele, e o motor recusa o ponto alheio', () => {
    const puzzle = duasAlavancas()
    const desafio: Desafio = {
      id: 'd-coop',
      nome: 'Duas alavancas',
      lugar: { tipo: 'ponto', x: 100, y: 100 },
      minigame: { jogo: 'puzzle', versao: VERSAO_DO_PUZZLE, npc: '', modeloId: null, puzzle },
      outrosLugares: [{ lugar: { tipo: 'ponto', x: 1500, y: 100 } }],
    }
    const map = { desafios: [desafio], props: [], pins: [] }
    const grade = 50
    const seloB = idDoSeloDoPonto(desafio.id, 1)
    // Os dois selos no mapa (o do mestre e o do jogador), e o do ponto 2 leva ao mesmo puzzle.
    expect(pinosDosDesafios(map, 'mesa').map((pino) => [pino.id, pino.x, pino.y])).toEqual([
      ['d-coop', 100, 100],
      [seloB, 1500, 100],
    ])
    expect(desafioDePuzzleDoMapa(map, seloB)?.id).toBe('d-coop')
    const pinoA = pinoDeMinigameDoMapa(map, desafio.id)
    const pinoB = pinoDeMinigameDoMapa(map, seloB)
    if (pinoA === undefined || pinoB === undefined) throw new Error('os selos dos dois pontos precisam existir')
    // A ficha de Lara está na sala do ponto 1: alcança o selo dela e não o do ponto 2 (a mesma conta do host).
    const fichaDaLara = { x: 130, y: 110, size: 1 }
    expect(tokenReachesPin(fichaDaLara, pinoA, grade)).toBe(true)
    expect(tokenReachesPin(fichaDaLara, pinoB, grade)).toBe(false)
    // Um ponto que o puzzle não tem não vira selo.
    expect(pinoDeMinigameDoMapa(map, idDoSeloDoPonto(desafio.id, 2))).toBeUndefined()

    // Entrando pelo ponto 1, Lara não aciona o 2, e no jogo sem ponto conferido nada vale.
    const progresso = progressoInicial(puzzle)
    expect(acionar(puzzle, progresso, LARA, T0, 1, 0).efeitos).toEqual([{ tipo: 'recusado', motivo: 'longe' }])
    expect(acionar(puzzle, progresso, LARA, T0, 0, null).efeitos).toEqual([{ tipo: 'recusado', motivo: 'longe' }])
    // No teste do editor, o mestre sozinho aciona os dois.
    const noTeste = (agora: number, ponto: number, antes: ProgressoDoPuzzle) => agirNoPuzzle(puzzle, antes, [], { tipo: 'apertar', botao: ponto }, { ...contexto(LARA, agora, undefined), modo: 'teste' })
    expect(noTeste(T0 + 1_000, 1, noTeste(T0, 0, progresso).progresso).progresso.resolvido).not.toBeNull()
  })

  it('sincroniza: os dois pontos veem os mesmos lampiões pelo fio, cada um com o seu, e o fio não leva lugar nem id', () => {
    const puzzle = duasAlavancas({ pontos: [{ arte: 'alavanca', rotulo: 'Cripta' }, { arte: 'placa', rotulo: '' }] })
    const progresso = acionar(puzzle, progressoInicial(puzzle), BENTO, T0, 1).progresso
    const pelaRede = (ponto: number, agora: number) => {
      const selo = idDoSeloDoPonto('d-coop', ponto)
      const fio = JSON.stringify(vistaDoPuzzle({ desafioId: selo, puzzle, progresso, mochila: [], agora, ponto }))
      expect(fio).not.toMatch(/tokenId|personagemId|outrosLugares|"x"|"em"/)
      return lerVistaDoPuzzle(JSON.parse(fio))
    }
    const daLara = pelaRede(0, T0 + 2_000)
    const doBento = pelaRede(1, T0 + 2_000)
    expect(daLara?.desafioId).toBe('d-coop')
    expect(doBento?.desafioId).toBe(idDoSeloDoPonto('d-coop', 1))
    expect(daLara?.cooperacao?.meuPonto).toBe(0)
    expect(doBento?.cooperacao?.meuPonto).toBe(1)
    // Os mesmos lampiões dos dois lados: o do Bento aceso, com 3 s de janela, e o nome de quem acionou.
    const esperado = [
      { arte: 'alavanca', rotulo: 'Cripta', aceso: false, restaMs: 0, por: '' },
      { arte: 'placa', rotulo: 'Ponto 2', aceso: true, restaMs: 3_000, por: 'Bento' },
    ]
    expect(daLara?.cooperacao?.pontos).toEqual(esperado)
    expect(doBento?.cooperacao?.pontos).toEqual(esperado)
    // Passada a janela, apaga sem ninguém gravar nada.
    expect(pelaRede(0, T0 + 5_001)?.cooperacao?.pontos[1]).toMatchObject({ aceso: false, restaMs: 0, por: '' })
    expect(daLara?.encaixes).toEqual([])
    expect(daLara?.troca).toBeNull()
  })
})
