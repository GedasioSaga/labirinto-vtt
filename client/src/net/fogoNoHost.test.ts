import { describe, expect, it } from 'vitest'
import { MINIGAME_FOGO_PADRAO } from '../minigames/fogo/tipos'
import { criarFogoNoHost, type SaidaDoFogo } from './fogoNoHost'
import type { FogoLote, FogoPlacar } from './protocoloDoFogo'

const E = (n: number) => [n, 0, 0, 0, 0, 0, 0]

function montar() {
  const conectados = new Map([
    ['ana', 'c-ana'],
    ['bia', 'c-bia'],
    ['caio', 'c-caio'],
  ])
  let seq = 0
  const host = criarFogoNoHost({ conexaoDe: (id) => conectados.get(id) ?? null, randomId: () => `id-${(seq += 1)}` })
  const convidados = [
    { playerId: 'ana', nome: 'Ana', funcao: 'bombeiro' as const },
    { playerId: 'bia', nome: 'Bia', funcao: 'lenhador' as const },
    { playerId: 'caio', nome: 'Caio', funcao: 'socorrista' as const },
  ]
  const { resultado } = host.convidar({ pinId: 'p1', minigame: { ...MINIGAME_FOGO_PADRAO } }, 'equipe', convidados)
  if (!resultado.ok) throw new Error('convite recusado')
  const sessao = resultado.sessao
  for (const c of convidados) host.pronto(c.playerId, { type: 'fogo.pronto', sessao, funcao: c.funcao })
  const comecar = host.comecar('normal') ?? []
  return { host, sessao, conectados, comecar }
}

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

  it('acusa hash diferente no painel e fecha com o placar da equipe quando todos terminam', () => {
    const { host, sessao } = montar()
    host.hash('ana', { type: 'fogo.hash', sessao, tique: 50, hash: 111 })
    host.hash('bia', { type: 'fogo.hash', sessao, tique: 50, hash: 111 })
    expect(host.aoVivo()?.divergencia).toBeUndefined()
    host.hash('caio', { type: 'fogo.hash', sessao, tique: 50, hash: 222 })
    expect(host.aoVivo()?.divergencia).toEqual({ tique: 50, nomes: ['Ana', 'Caio'] })
    host.fim('ana', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    host.fim('bia', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const fim = host.fim('caio', { type: 'fogo.fim', sessao, tique: 353, hash: 7, placar: placar(true) })
    const desfechos = fim.flatMap((s) => (s.msg.type === 'fogo.desfecho' ? [s.msg] : []))
    expect(desfechos).toHaveLength(3)
    expect(desfechos[0].mesa.map((l) => `${l.nome}:${l.resultado}:${l.pontos}`)).toEqual(['Ana:venceu:400', 'Bia:venceu:300', 'Caio:venceu:200'])
    expect(desfechos[0].seu.premio?.texto).toBe(MINIGAME_FOGO_PADRAO.premio.texto)
    expect(host.aoVivo()?.desfecho).toEqual({ vitoria: true, pontos: 900, estrelas: 2, florestaViva: 70 })
  })
})
