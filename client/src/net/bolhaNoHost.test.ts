import { describe, expect, it } from 'vitest'
import { MINIGAME_BOLHA_PADRAO, type MinigameBolha } from '../minigames/bolha/tipos'
import { criarBolhaNoHost, textoDoDesfechoDaBolha, type BolhaConvidado, type SaidaDaBolha } from './bolhaNoHost'
import { parseBolhaHostMessage, parseBolhaPlayerMessage, placarDoJogoDaBolha, type BolhaHostMessage, type BolhaPlacar } from './protocoloDaBolha'

const CONVIDADOS: BolhaConvidado[] = [
  { playerId: 'ana', nome: 'Ana' },
  { playerId: 'bia', nome: 'Bia' },
]

const placar = (vitoria: boolean, pontos: number): BolhaPlacar => ({
  vitoria,
  motivo: vitoria ? 'apagou' : 'tempo',
  cenario: 'casa',
  dificuldade: 'normal',
  tempoS: 41.37,
  bolhas: 30,
  acertos: 24,
  precisao: 80,
  focosApagados: 5,
  focosQuePegaram: 1,
  fogoNoFim: vitoria ? 0 : 35,
  pontos,
  estrelas: vitoria ? 3 : 0,
})

function montar(modo: 'solo' | 'equipe', minigame: MinigameBolha = { ...MINIGAME_BOLHA_PADRAO, cenario: 'casa' }) {
  const conectados = new Map([
    ['ana', 'c-ana'],
    ['bia', 'c-bia'],
  ])
  let seq = 0
  const host = criarBolhaNoHost({ conexaoDe: (id) => conectados.get(id) ?? null, randomId: () => `id-${(seq += 1)}` })
  const { resultado } = host.convidar({ pinId: 'p1', minigame }, modo, CONVIDADOS)
  if (!resultado.ok) throw new Error('convite recusado')
  return { host, sessao: resultado.sessao }
}

type MsgDe<T extends BolhaHostMessage['type']> = Extract<BolhaHostMessage, { type: T }>

function ehDoTipo<T extends BolhaHostMessage['type']>(msg: BolhaHostMessage, tipo: T): msg is MsgDe<T> {
  return msg.type === tipo
}

/** As mensagens de um tipo, com a conexão de destino. */
function doTipo<T extends BolhaHostMessage['type']>(saidas: readonly SaidaDaBolha[], tipo: T): { clientId: string; msg: MsgDe<T> }[] {
  return saidas.flatMap((s) => (ehDoTipo(s.msg, tipo) ? [{ clientId: s.clientId, msg: s.msg }] : []))
}

describe('protocolo da bolha', () => {
  it('converte o placar do jogo (snake_case, tempo quebrado, extremo como difícil) e recusa o torto', () => {
    const doJogo = {
      vitoria: true,
      motivo: 'apagou',
      cenario: 'clareira',
      dificuldade: 'extremo',
      semente: 7,
      modo: 'equipe',
      jogador: { id: 'ana', nome: 'Ana' },
      tempo_s: 52.5,
      bolhas: 20,
      acertos: 18,
      precisao: 90,
      focos_apagados: 6,
      focos_que_pegaram: 0,
      fogo_no_fim: 0,
      pontos: 945,
      estrelas: 3,
    }
    expect(placarDoJogoDaBolha(doJogo)).toEqual({
      vitoria: true,
      motivo: 'apagou',
      cenario: 'clareira',
      dificuldade: 'dificil',
      tempoS: 52.5,
      bolhas: 20,
      acertos: 18,
      precisao: 90,
      focosApagados: 6,
      focosQuePegaram: 0,
      fogoNoFim: 0,
      pontos: 945,
      estrelas: 3,
    })
    expect(placarDoJogoDaBolha({ ...doJogo, precisao: 101 })).toBeNull()
    expect(placarDoJogoDaBolha({ ...doJogo, estrelas: 4 })).toBeNull()
    expect(placarDoJogoDaBolha({ ...doJogo, cenario: 'praia' })).toBeNull()
    expect(placarDoJogoDaBolha('nada')).toBeNull()
  })

  it('aceita as mensagens boas do jogador e do mestre e derruba as tortas inteiras', () => {
    expect(parseBolhaPlayerMessage({ type: 'bolha.fim', sessao: 's1', placar: placar(true, 900) })).toEqual({ type: 'bolha.fim', sessao: 's1', placar: placar(true, 900) })
    expect(parseBolhaPlayerMessage({ type: 'bolha.pronto', sessao: 's1', dificuldade: 'extremo' })).toBeNull()
    expect(parseBolhaPlayerMessage({ type: 'bolha.fim', sessao: '', placar: placar(true, 900) })).toBeNull()
    expect(parseBolhaPlayerMessage({ type: 'bolha.desistir', sessao: 's1', motivo: 'cansei' })).toBeNull()
    const comecar = { type: 'bolha.comecar', sessao: 's1', semente: 12, dificuldade: 'facil', cenario: 'casa', modo: 'solo', jogadores: [{ id: 'ana', nome: 'Ana' }] }
    expect(parseBolhaHostMessage(comecar)).toEqual(comecar)
    expect(parseBolhaHostMessage({ ...comecar, semente: -1 })).toBeNull()
    expect(parseBolhaHostMessage({ ...comecar, jogadores: [] })).toBeNull()
  })
})

describe('bolha no mestre', () => {
  it('em equipe todos recebem a mesma semente, cenário e dificuldade; o desfecho traz uma linha por jogador', () => {
    const { host, sessao } = montar('equipe')
    host.pronto('ana', { type: 'bolha.pronto', sessao })
    host.pronto('bia', { type: 'bolha.pronto', sessao })
    const comecos = doTipo(host.comecar('dificil') ?? [], 'bolha.comecar')
    expect(comecos.map((c) => c.clientId)).toEqual(['c-ana', 'c-bia'])
    const [primeiro, segundo] = comecos.map((c) => c.msg)
    expect(primeiro).toEqual(segundo)
    expect(primeiro).toMatchObject({ dificuldade: 'dificil', cenario: 'casa', modo: 'equipe', jogadores: [{ id: 'ana', nome: 'Ana' }, { id: 'bia', nome: 'Bia' }] })

    // A primeira terminar não fecha: o desfecho espera a outra.
    expect(doTipo(host.fim('ana', { type: 'bolha.fim', sessao, placar: placar(true, 900) }), 'bolha.desfecho')).toEqual([])
    const desfechos = doTipo(host.fim('bia', { type: 'bolha.fim', sessao, placar: placar(false, 120) }), 'bolha.desfecho')
    const daAna = desfechos.find((d) => d.clientId === 'c-ana')?.msg
    const daBia = desfechos.find((d) => d.clientId === 'c-bia')?.msg
    expect(daAna?.seu).toEqual({ passou: true, premio: MINIGAME_BOLHA_PADRAO.premio })
    expect(daBia?.seu).toEqual({ passou: false, consequencia: MINIGAME_BOLHA_PADRAO.consequencia })
    expect(daAna?.mesa).toEqual([
      { playerId: 'ana', nome: 'Ana', pontos: 900, estrelas: 3, resultado: 'venceu' },
      { playerId: 'bia', nome: 'Bia', pontos: 120, estrelas: 0, resultado: 'perdeu' },
    ])
    const vivo = host.aoVivo()
    expect(vivo?.fase).toBe('fim')
    expect(vivo?.desfecho).toEqual({ apagaram: 1, jogaram: 2, pontos: 1020 })
    expect(vivo === null ? '' : textoDoDesfechoDaBolha(vivo)).toBe("Bolha d'Água: 1 de 2 apagaram o fogo (1020 pontos na mesa).")
  })

  it('sozinho no pino: o Pronto com a dificuldade já começa, e quem sai no meio fica com a consequência', () => {
    let seq = 0
    const host = criarBolhaNoHost({ conexaoDe: (id) => (id === 'ana' ? 'c-ana' : null), randomId: () => `id-${(seq += 1)}` })
    const pedido = host.pedir({ pinId: 'p1', minigame: { ...MINIGAME_BOLHA_PADRAO } }, { playerId: 'ana', nome: 'Ana' })
    if (!pedido.resultado.ok) throw new Error('pedido recusado')
    const sessao = pedido.resultado.sessao
    expect(doTipo(pedido.outbound, 'bolha.convite')[0]?.msg.sozinho).toEqual({ permitida: 'escolha' })
    // Na "escolha", sem a dificuldade nada começa.
    expect(host.pronto('ana', { type: 'bolha.pronto', sessao })).toEqual([])
    const comeco = doTipo(host.pronto('ana', { type: 'bolha.pronto', sessao, dificuldade: 'facil' }), 'bolha.comecar')
    expect(comeco[0]?.msg).toMatchObject({ dificuldade: 'facil', cenario: 'clareira', modo: 'solo', jogadores: [{ id: 'ana', nome: 'Ana' }] })
    const desfecho = doTipo(host.desistir('ana', { type: 'bolha.desistir', sessao, motivo: 'erro' }), 'bolha.desfecho')
    expect(desfecho[0]?.msg.seu).toEqual({ passou: false, consequencia: MINIGAME_BOLHA_PADRAO.consequencia })
    expect(desfecho[0]?.msg.placar).toBeUndefined()
  })
})
