import { describe, expect, it } from 'vitest'
import { MINIGAME_FOGO_PADRAO } from '../minigames/fogo/tipos'
import { criarFogoNoHost, type SaidaDoFogo } from './fogoNoHost'
import type { FogoLote, FogoPlacar } from './protocoloDoFogo'

const E = (n: number) => [n, 0, 0, 0, 0, 0, 0]

const CONVIDADOS = [
  { playerId: 'ana', nome: 'Ana', funcao: 'bombeiro' as const },
  { playerId: 'bia', nome: 'Bia', funcao: 'lenhador' as const },
  { playerId: 'caio', nome: 'Caio', funcao: 'socorrista' as const },
]

/** Os três chamados para o mesmo incêndio, ainda no convite. */
function convidar() {
  const conectados = new Map([
    ['ana', 'c-ana'],
    ['bia', 'c-bia'],
    ['caio', 'c-caio'],
  ])
  let seq = 0
  const host = criarFogoNoHost({ conexaoDe: (id) => conectados.get(id) ?? null, randomId: () => `id-${(seq += 1)}` })
  const { resultado } = host.convidar({ pinId: 'p1', minigame: { ...MINIGAME_FOGO_PADRAO } }, 'equipe', CONVIDADOS)
  if (!resultado.ok) throw new Error('convite recusado')
  return { host, sessao: resultado.sessao, conectados }
}

/** Os três prontos e jogando. */
function montar() {
  const { host, sessao, conectados } = convidar()
  for (const c of CONVIDADOS) host.pronto(c.playerId, { type: 'fogo.pronto', sessao, funcao: c.funcao })
  const comecar = host.comecar('normal') ?? []
  return { host, sessao, conectados, comecar }
}

const statusNoPainel = (host: ReturnType<typeof criarFogoNoHost>) => host.aoVivo()?.participantes.map((p) => `${p.playerId}:${p.status}`)

/** Os lotes que cada conexão recebeu, de quem e de que tiques. */
function recebidos(saidas: readonly SaidaDoFogo[]): Map<string, FogoLote[]> {
  const porConexao = new Map<string, FogoLote[]>()
  for (const s of saidas) if (s.msg.type === 'fogo.entradas') porConexao.set(s.clientId, [...(porConexao.get(s.clientId) ?? []), ...s.msg.lotes])
  return porConexao
}

const placar = (vitoria: boolean): FogoPlacar => ({
  vitoria,
  motivo: vitoria ? 'apagado' : 'vila',
  pontos: 900,
  estrelas: 2,
  florestaViva: 70,
  casas: 3,
  tempoS: 60,
  porJogador: [
    { id: 'ana', funcao: 'bombeiro', pontos: 400 },
    { id: 'bia', funcao: 'lenhador', pontos: 300 },
    { id: 'caio', funcao: 'socorrista', pontos: 200 },
  ],
})

describe('fogo no host: o repasse do lockstep', () => {
  it('repassa cada entrada a todos os outros uma vez, nunca ao dono, e o sair leva o último tique repassado', () => {
    const { host, sessao, conectados, comecar } = montar()
    // O mesmo começar para os três, na ordem da sala.
    const ordens = comecar.flatMap((s) => (s.msg.type === 'fogo.comecar' ? [s.msg.jogadores.map((j) => j.id).join(',')] : []))
    expect(ordens).toEqual(['ana,bia,caio', 'ana,bia,caio', 'ana,bia,caio'])
    host.entradas('ana', { type: 'fogo.entradas', sessao, de: 5, lista: [E(1), E(2)] })
    host.entradas('ana', { type: 'fogo.entradas', sessao, de: 6, lista: [E(2), E(3)] }) // o 6 repetido não conta
    host.entradas('bia', { type: 'fogo.entradas', sessao, de: 5, lista: [E(9)] })
    const r1 = recebidos(host.repassar())
    expect(r1.get('c-ana')).toEqual([{ id: 'bia', de: 5, lista: [E(9)] }])
    expect(r1.get('c-bia')).toEqual([{ id: 'ana', de: 5, lista: [E(1), E(2), E(3)] }])
    expect(r1.get('c-caio')).toEqual([
      { id: 'ana', de: 5, lista: [E(1), E(2), E(3)] },
      { id: 'bia', de: 5, lista: [E(9)] },
    ])
    // Nada novo: nada sai (uma vez só).
    expect(host.repassar()).toEqual([])
    // Bia manda o 6 e cai antes do repasse: o 6 morre, e o sair diz 5.
    host.entradas('bia', { type: 'fogo.entradas', sessao, de: 6, lista: [E(8)] })
    conectados.delete('bia')
    const queda = host.caiu('bia')
    const sairs = queda.flatMap((s) => (s.msg.type === 'fogo.sair' ? [[s.clientId, s.msg.id, s.msg.depoisDe].join(':')] : []))
    expect(sairs).toEqual(['c-ana:bia:5', 'c-caio:bia:5'])
    expect(recebidos(host.repassar()).size).toBe(0)
  })

  it('fecha com o placar da equipe quando todos mandam o mesmo fim', () => {
    const { host, sessao } = montar()
    for (const id of ['ana', 'bia', 'caio']) host.hash(id, { type: 'fogo.hash', sessao, tique: 50, hash: 111 })
    expect(host.aoVivo()?.divergencia).toBeUndefined()
    host.fim('ana', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    host.fim('bia', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const fim = host.fim('caio', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const desfechos = fim.flatMap((s) => (s.msg.type === 'fogo.desfecho' ? [s.msg] : []))
    expect(desfechos).toHaveLength(3)
    expect(desfechos[0].mesa.map((l) => `${l.nome}:${l.resultado}:${l.pontos}`)).toEqual(['Ana:venceu:400', 'Bia:venceu:300', 'Caio:venceu:200'])
    expect(desfechos[0].seu.premio?.texto).toBe(MINIGAME_FOGO_PADRAO.premio.texto)
    expect(host.aoVivo()?.desfecho).toEqual({ vitoria: true, pontos: 900, estrelas: 2, florestaViva: 70 })
  })

  it('hash diferente no meio, ou um fim diferente (vitória forjada com o hash certo), fecha como divergiu, sem prêmio', () => {
    /** O que sai quando o último termina: só o encerra `divergiu`, a quem jogou, e nenhum desfecho. */
    const fechamento = (saidas: readonly SaidaDoFogo[]) => saidas.map((s) => `${s.clientId}:${s.msg.type}:${s.msg.type === 'fogo.encerra' ? s.msg.motivo : ''}`)
    const esperado = ['c-ana:fogo.encerra:divergiu', 'c-bia:fogo.encerra:divergiu', 'c-caio:fogo.encerra:divergiu']

    // 1. O hash do Caio diverge no tique 50; os fins vêm iguais, mas o placar de um aparelho não vale mais.
    const a = montar()
    a.host.hash('ana', { type: 'fogo.hash', sessao: a.sessao, tique: 50, hash: 111 })
    a.host.hash('caio', { type: 'fogo.hash', sessao: a.sessao, tique: 50, hash: 222 })
    expect(a.host.aoVivo()?.divergencia).toEqual({ tique: 50, nomes: ['Ana', 'Caio'] })
    a.host.fim('ana', { type: 'fogo.fim', sessao: a.sessao, tique: 353, hash: 7, placar: placar(false) })
    a.host.fim('bia', { type: 'fogo.fim', sessao: a.sessao, tique: 353, hash: 7, placar: placar(false) })
    expect(fechamento(a.host.fim('caio', { type: 'fogo.fim', sessao: a.sessao, tique: 353, hash: 7, placar: placar(false) }))).toEqual(esperado)
    expect(a.host.aoVivo()?.fase).toBe('encerrada')
    expect(a.host.aoVivo()?.desfecho).toBeUndefined()

    // 2. Nenhum hash diverge, mas a Bia manda vitória onde os outros perderam: a diferença vai para o painel.
    const b = montar()
    b.host.fim('ana', { type: 'fogo.fim', sessao: b.sessao, tique: 353, hash: 7, placar: placar(false) })
    b.host.fim('bia', { type: 'fogo.fim', sessao: b.sessao, tique: 353, hash: 7, placar: placar(true) })
    expect(fechamento(b.host.fim('caio', { type: 'fogo.fim', sessao: b.sessao, tique: 353, hash: 7, placar: placar(false) }))).toEqual(esperado)
    expect(b.host.aoVivo()?.divergencia).toEqual({ tique: 353, nomes: ['Ana', 'Bia'] })
    expect(b.host.aoVivo()?.participantes.every((p) => p.resultado === undefined)).toBe(true)
  })
})

describe('fogo no host: quem desiste', () => {
  it('no convite, "Agora não" deixa de fora e o jogo que não carregou volta a Convidado; o começar não chama nenhum dos dois', () => {
    const { host, sessao } = convidar()
    for (const c of CONVIDADOS) host.pronto(c.playerId, { type: 'fogo.pronto', sessao, funcao: c.funcao })
    // Bia tocou em Pronto e depois em "Agora não"; o jogo do Caio não carregou.
    const recusa = host.desistir('bia', { type: 'fogo.desistir', sessao, motivo: 'recusou' })
    // O estado vai a quem segue no convite, não a quem fechou a tela.
    expect(recusa.map((s) => s.clientId)).toEqual(['c-ana', 'c-caio'])
    host.desistir('caio', { type: 'fogo.desistir', sessao, motivo: 'erro' })
    expect(statusNoPainel(host)).toEqual(['ana:pronto', 'bia:fora', 'caio:convidado'])
    // Um erro depois do "Agora não" não traz a Bia de volta.
    expect(host.desistir('bia', { type: 'fogo.desistir', sessao, motivo: 'erro' })).toEqual([])
    const comecar = host.comecar('normal') ?? []
    const jogadores = comecar.flatMap((s) => (s.msg.type === 'fogo.comecar' ? [`${s.clientId}:${s.msg.jogadores.map((j) => j.id).join(',')}`] : []))
    expect(jogadores).toEqual(['c-ana:ana'])
    // Só o Caio (ainda Convidado) ouve o "começou sem você"; a Bia já tinha saído.
    expect(comecar.flatMap((s) => (s.msg.type === 'fogo.encerra' ? [`${s.clientId}:${s.msg.motivo}`] : []))).toEqual(['c-caio:fora'])
  })

  it('no jogo, quem desiste sai como quem caiu: os colegas recebem o sair e o desfecho sai sem esperar por ele', () => {
    const { host, sessao } = montar()
    host.entradas('caio', { type: 'fogo.entradas', sessao, de: 1, lista: [E(1), E(2)] })
    host.repassar()
    const saida = host.desistir('caio', { type: 'fogo.desistir', sessao, motivo: 'erro' })
    expect(saida.flatMap((s) => (s.msg.type === 'fogo.sair' ? [`${s.clientId}:${s.msg.id}:${s.msg.depoisDe}`] : []))).toEqual(['c-ana:caio:2', 'c-bia:caio:2'])
    // Repetida (o "Voltar ao mapa" depois do erro) não muda nada.
    expect(host.desistir('caio', { type: 'fogo.desistir', sessao, motivo: 'recusou' })).toEqual([])
    host.fim('ana', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const fim = host.fim('bia', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const desfechos = fim.flatMap((s) => (s.msg.type === 'fogo.desfecho' ? [`${s.clientId}:${s.msg.mesa.map((l) => `${l.nome}:${l.resultado}`).join(',')}`] : []))
    expect(desfechos).toEqual(['c-ana:Ana:venceu,Bia:venceu,Caio:saiu', 'c-bia:Ana:venceu,Bia:venceu,Caio:saiu', 'c-caio:Ana:venceu,Bia:venceu,Caio:saiu'])
  })
})
