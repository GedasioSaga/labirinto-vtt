/**
 * A LUTA AUTOMÁTICA DO TREINO (LOBBY v2, fatia T3; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): o 2×1 com a semente 7
 * acaba com vencedor (não por tempo); a mesma semente duas vezes dá o mesmo
 * resumo; a luta pausada na rodada 3, gravada em JSON e retomada termina
 * igual; o robô sem SP ataca com a arma (e com SP usa a técnica que paga,
 * nunca a de dano à mão). Da revisão da T3: a arma de dano ilegível não
 * trava o robô (Atacar sem arma) e a técnica vai com o selo que a mira sugere.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../batalha/combate'
import { personagemDoArquivo, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { comecarLuta, lutaAutomatica, retomarLuta, type LutaEmAndamento, type LutaGravada, type PedidoDeLuta } from './lutaAutomatica'
import { montarLutadores, type EscolhaDaVaga } from './mesaEmMemoria'

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

function cartao(id: string, nome: string, campos: Record<string, string>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, nome, campos, ...extra }
}

const ESPADA = cartao('arma_espada', 'Espada', { dano: '20' })

const ZE = ficha({
  id: 'pers_ze',
  tipo: 'jogador',
  nome: 'Zé',
  recursos: { hp: 300, sp: 100 },
  maximos: { hp: 300, sp: 100 },
  atributos: { forca: 60, agilidade: 40 },
  abas: { armas: [ESPADA], habilidades: [cartao('tec_corte', 'Corte Duplo', { acao: 'Simples', custo: '30 SP', tempo: '2', dano: 'Força + 60' })] },
})

const LIA = ficha({
  id: 'pers_lia',
  tipo: 'jogador',
  nome: 'Lia',
  recursos: { hp: 250, sp: 0 },
  maximos: { hp: 250, sp: 60 },
  atributos: { forca: 50, agilidade: 70 },
  abas: { armas: [cartao('arma_bastao', 'Bastão', { dano: '15' })] },
})

const MARINHEIRO = ficha({
  id: 'pers_marinheiro',
  tipo: 'npc',
  nome: 'Marinheiro',
  recursos: { hp: 600, sp: 0 },
  maximos: { hp: 600, sp: 0 },
  atributos: { forca: 80, agilidade: 30 },
  abas: { armas: [cartao('arma_sabre', 'Sabre', { dano: '30' })] },
})

/** A Vera do livro com o SP pedido: a Névoa custa 50 SP e bate mais que a Espada; o Golpe Livre (à mão) bate mais que tudo; o Grito não tem conta. */
function vera(sp: number): Personagem {
  return ficha({
    id: 'pers_vera',
    tipo: 'npc',
    nome: 'Vera',
    recursos: { hp: 400, sp },
    maximos: { hp: 400, sp: 100 },
    atributos: { forca: 40, agilidade: 90 },
    abas: {
      armas: [ESPADA],
      habilidades: [
        cartao('tec_livre', 'Golpe Livre', { acao: 'Simples', dano: 'Força + 500' }, { aMao: true }),
        cartao('tec_grito', 'Grito', { acao: 'Simples', dano: 'bem forte' }),
        cartao('tec_nevoa', 'Névoa', { acao: 'Simples', custo: '50 SP', dano: 'Força + 100' }),
      ],
    },
  })
}

/** O Rui: Força 60, com as armas e as técnicas pedidas. */
function rui(sp: number, armas: readonly Record<string, unknown>[], habilidades: readonly Record<string, unknown>[] = []): Personagem {
  return ficha({
    id: 'pers_rui',
    tipo: 'jogador',
    nome: 'Rui',
    recursos: { hp: 300, sp },
    maximos: { hp: 300, sp: 100 },
    atributos: { forca: 60, agilidade: 40 },
    abas: { armas, habilidades },
  })
}

function pedidoDe(escolhas: readonly EscolhaDaVaga[], semente: number): PedidoDeLuta {
  const montagem = montarLutadores(escolhas)
  if (!montagem.ok) throw new Error(`montagem recusada: lado ${montagem.lado} ${montagem.motivo}`)
  return { sistema: SISTEMA_ONE_PIECE, lutadores: montagem.lutadores, semente }
}

const DOIS_CONTRA_UM: readonly EscolhaDaVaga[] = [
  { ficha: ZE, lado: 'a' },
  { ficha: LIA, lado: 'a' },
  { ficha: MARINHEIRO, lado: 'b' },
]

/** O primeiro golpe que o token dá na luta (passo a passo, no teto de passos). */
function primeiroGolpeDe(luta: LutaEmAndamento, tokenId: string): PedidoDeAcao | null {
  for (let feito = luta.passo(); feito !== null; feito = luta.passo()) {
    if (feito.tipo === 'agir' && feito.tokenId === tokenId) return feito.pedido
  }
  return null
}

describe('luta automática do treino', () => {
  it('2×1 com a semente 7 acaba com vencedor, não por tempo', () => {
    const resumo = lutaAutomatica(pedidoDe(DOIS_CONTRA_UM, 7))
    expect(resumo.fim.tipo, `acabou em ${JSON.stringify(resumo.fim)} na rodada ${resumo.rodada}`).toBe('vitoria')
    const perdedor = resumo.fim.tipo === 'vitoria' ? (resumo.fim.vencedor === 'a' ? 'b' : 'a') : null
    expect(resumo.lutadores.filter((lutador) => lutador.lado === perdedor).every((lutador) => lutador.vida?.atual === 0)).toBe(true)
  })

  it('a mesma semente duas vezes (sobre o mesmo pedido) dá o mesmo resumo; a semente 8 dá outro', () => {
    const pedido = pedidoDe(DOIS_CONTRA_UM, 7)
    const primeira = lutaAutomatica(pedido)
    expect(lutaAutomatica(pedido)).toEqual(primeira)
    expect(primeira.registro.length).toBeGreaterThan(10)
    expect(lutaAutomatica({ ...pedido, semente: 8 })).not.toEqual(primeira)
  })

  it('pausada na rodada 3, gravada em JSON e retomada, a luta termina igual à inteira', () => {
    const inteira = lutaAutomatica(pedidoDe(DOIS_CONTRA_UM, 7))
    const luta = comecarLuta(pedidoDe(DOIS_CONTRA_UM, 7))
    while (luta.fim() === null && luta.relogio().rodada < 3) luta.passo()
    expect(luta.fim()).toBeNull()
    expect(luta.relogio().rodada).toBe(3)
    // JSON.parse devolve any; quem confere a forma na volta é o próprio retomarLuta (e o sorteio e a mesa, os deles).
    const gravada: LutaGravada = JSON.parse(JSON.stringify(luta.gravar()))
    expect(retomarLuta(gravada, SISTEMA_ONE_PIECE).terminar()).toEqual(inteira)
  })
})

describe('robô do treino', () => {
  it('sem SP ataca com a arma; com SP usa a técnica que paga, nunca a de dano à mão nem a sem conta', () => {
    const contra: EscolhaDaVaga = { ficha: MARINHEIRO, lado: 'b' }
    // Vera é a vaga a1: token treino_tok_a1; o alvo é o único do Lado B.
    const semSp = primeiroGolpeDe(comecarLuta(pedidoDe([{ ficha: vera(0), lado: 'a' }, contra], 7)), 'treino_tok_a1')
    expect(semSp).toEqual({ tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: 'treino_tok_b1', dano: 60 }], surpresa: false, perfurante: false })
    const comSp = primeiroGolpeDe(comecarLuta(pedidoDe([{ ficha: vera(100), lado: 'a' }, contra], 7)), 'treino_tok_a1')
    expect(comSp).toMatchObject({ tipo: 'habilidade', cartaoId: 'tec_nevoa', alvos: [{ tokenId: 'treino_tok_b1', dano: 140 }] })
  })

  it('com a arma de dano que a conta não lê (1d6, Escudo sem dano), ataca sem arma, pela Força', () => {
    const contra: EscolhaDaVaga = { ficha: MARINHEIRO, lado: 'b' }
    const semArma: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: 'treino_tok_b1', dano: 60 }], surpresa: false, perfurante: false }
    for (const arma of [cartao('arma_adaga', 'Adaga', { dano: '1d6' }), cartao('arma_escudo', 'Escudo', {})]) {
      const golpe = primeiroGolpeDe(comecarLuta(pedidoDe([{ ficha: rui(0, [arma]), lado: 'a' }, contra], 3)), 'treino_tok_a1')
      expect(golpe, `com ${String(arma.nome)}`).toEqual(semArma)
    }
  })

  it('a técnica de atordoar vai com o selo que a mira sugere (sem natureza nem cartaoId, que o host tira)', () => {
    const pancada = cartao('tec_pancada', 'Pancada', { acao: 'Simples', custo: '10 SP', dano: 'Força + 50', efeito: 'Atordoado por 1 turno' })
    const golpe = primeiroGolpeDe(comecarLuta(pedidoDe([{ ficha: rui(100, [], [pancada]), lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }], 3)), 'treino_tok_a1')
    expect(golpe).toMatchObject({ tipo: 'habilidade', cartaoId: 'tec_pancada', alvos: [{ tokenId: 'treino_tok_b1', dano: 110 }] })
    expect(golpe?.tipo === 'habilidade' ? golpe.selo : undefined).toEqual({ nome: 'Atordoado', turnos: 1 })
  })
})
