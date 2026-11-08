/**
 * A LUTA DE N LADOS (Arena multijogador, fatia F2; aceite em
 * docs/planos/arena-multijogador-2026-11-07.md §5): 4 robôs em todos contra
 * todos com a semente 7 acabam com 1 vencedor, e a mesma semente duas vezes dá
 * o mesmo resumo; quem assiste recebe a luta sem o combate e sem os
 * contra-ataques de ninguém (e não joga), enquanto o dono do contra-ataque o
 * recebe.
 */
import { describe, expect, it } from 'vitest'
import type { Personagem } from '../personagem'
import type { JogadaDoDuelo, MotorDoDuelo } from './duelo'
import { LIA, MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { aplicarJogadaNaLuta, criarLuta, type EstadoDaLuta, type InscricaoNaLuta } from './luta'
import { lutaAutomatica } from './lutaAutomatica'
import { montarLutadoresDaLuta, type LadoDaLuta } from './mesaEmMemoria'
import { jogadaDoRobo } from './robo'
import { criarSorteio } from './sorteio'
import { lutaParaTodos } from './vistaDaLuta'

const QUATRO: readonly { ficha: Personagem; lado: LadoDaLuta }[] = [
  { ficha: ze(60), lado: 'a' },
  { ficha: LIA, lado: 'b' },
  { ficha: MARINHEIRO, lado: 'c' },
  { ficha: ze(90), lado: 'd' },
]

/** A ficha como o servidor a guarda: o doc completo, com o dono. */
function daConta(ficha: Personagem, contaId: string): Personagem {
  return { ...ficha, dono: contaId }
}

/** A próxima jogada que o robô faria pela conta dona da ficha que reage ou está na vez; `null` = sem vez. */
function proximaDoRobo(luta: EstadoDaLuta): { contaId: string; jogadas: JogadaDoDuelo[] } | null {
  const { turnos, regras } = luta.cena
  const jogada = jogadaDoRobo({ turnos, regras, vagas: luta.lutadores.vagas, personagens: luta.lutadores.personagens, sistema: SISTEMA_DO_TESTE, golpesNaVez: 0 })
  if (jogada === null) return null
  const tokenId = jogada.tipo === 'reagir' ? jogada.pedido.tokenId : jogada.tokenId
  const contaId = luta.lutadores.vagas.find((vaga) => vaga.tokenId === tokenId)?.contaId
  if (contaId === undefined) throw new Error(`token ${tokenId} sem conta`)
  const { seq } = luta
  if (jogada.tipo === 'reagir') return { contaId, jogadas: [{ tipo: 'reagir', seq, pedido: jogada.pedido }] }
  return { contaId, jogadas: [...jogada.golpes.map((pedido): JogadaDoDuelo => ({ tipo: 'agir', seq, vez: jogada.esperado, pedido })), { tipo: 'passar', seq, vez: jogada.esperado }] }
}

describe('luta de N lados (F2)', () => {
  it('4 robôs todos contra todos, semente 7: 1 vencedor, e o mesmo resumo duas vezes', () => {
    const montagem = montarLutadoresDaLuta(QUATRO)
    if (!montagem.ok) throw new Error(`montagem recusada: ${montagem.motivo}`)
    const pedido = { sistema: SISTEMA_DO_TESTE, lutadores: montagem.lutadores, semente: 7 }
    const primeira = lutaAutomatica(pedido)
    const segunda = lutaAutomatica(pedido)
    expect(segunda).toEqual(primeira)
    expect(primeira.fim.tipo).toBe('vitoria')
    const ladosDePe = new Set(primeira.lutadores.filter((lutador) => lutador.vida === null || lutador.vida.atual > 0).map((lutador) => lutador.lado))
    expect(ladosDePe.size).toBe(1)
    expect(primeira.fim).toEqual({ tipo: 'vitoria', vencedor: [...ladosDePe][0] })
  })

  it('quem assiste recebe sem o combate e sem os contra-ataques, e não joga', () => {
    const sorteio = criarSorteio(7)
    const motor: MotorDoDuelo = { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
    const jogador = (contaId: string, nome: string, { ficha, lado }: { ficha: Personagem; lado: LadoDaLuta }): InscricaoNaLuta => ({ contaId, nome, papel: 'jogador', lado, fichas: [daConta(ficha, contaId)] })
    const [ana, bia, caio] = QUATRO
    if (ana === undefined || bia === undefined || caio === undefined) throw new Error('faltou ficha')
    const inscricoes: InscricaoNaLuta[] = [
      jogador('conta_ana', 'Ana', ana),
      jogador('conta_bia', 'Bia', bia),
      jogador('conta_caio', 'Caio', caio),
      { contaId: 'conta_eva', nome: 'Eva', papel: 'espectador', lado: null, fichas: [] },
    ]
    const criada = criarLuta({ id: 'luta_1', modo: 'todos', inscricoes }, motor)
    if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
    let luta = criada.luta
    // O robô joga pelas contas até alguém agir (o combate nasce na primeira ação).
    for (let passo = 0; passo < 20 && Object.keys(luta.cena.turnos.combate ?? {}).length === 0; passo += 1) {
      const proxima = proximaDoRobo(luta)
      if (proxima === null) break
      const aceita = proxima.jogadas.map((jogada) => aplicarJogadaNaLuta(luta, motor, proxima.contaId, jogada)).find((resultado) => resultado.ok)
      if (aceita === undefined || !aceita.ok) throw new Error('nenhuma jogada do robô foi aceita')
      luta = aceita.luta
    }
    expect(Object.keys(luta.cena.turnos.combate ?? {}).length).toBeGreaterThan(0)
    // Um contra-ataque ganho pela ficha da Ana (o d20 20 é raro: entra à mão no estado do servidor).
    const daAna = luta.lutadores.vagas.find((vaga) => vaga.contaId === 'conta_ana')
    const daBia = luta.lutadores.vagas.find((vaga) => vaga.contaId === 'conta_bia')
    if (daAna === undefined || daBia === undefined) throw new Error('vagas sem conta')
    const contra = { golpeId: 'golpe_teste', tokenId: daAna.tokenId, personagemId: daAna.personagemId, atacanteTokenId: daBia.tokenId, rodada: luta.cena.turnos.rodada }
    luta = { ...luta, cena: { ...luta.cena, turnos: { ...luta.cena.turnos, contras: [contra] } } }

    const todas = lutaParaTodos(luta, SISTEMA_DO_TESTE)
    const deEva = todas.get('conta_eva')
    const deAna = todas.get('conta_ana')
    const deBia = todas.get('conta_bia')
    if (deEva === undefined || deAna === undefined || deBia === undefined) throw new Error('faltou destinatário')
    expect(deEva.olhar).toBe('assistindo')
    expect(deEva.turnos.combate).toBeUndefined()
    expect(deEva.turnos.contras).toBeUndefined()
    expect(deEva.vista.meus ?? []).toEqual([])
    expect(deEva.vista.contras ?? []).toEqual([])
    expect(deEva.vista.cartas.every((carta) => carta.lado === 'outro')).toBe(true)
    // O dono do contra-ataque o recebe; o outro jogador, não.
    expect(deAna.turnos.contras).toEqual([contra])
    expect(deBia.turnos.contras).toEqual([])
    // Quem assiste não joga.
    expect(aplicarJogadaNaLuta(luta, motor, 'conta_eva', { tipo: 'passar', seq: luta.seq, vez: { cartaId: luta.cena.turnos.vez ?? '', rodada: luta.cena.turnos.rodada } })).toEqual({ ok: false, motivo: 'naoJoga' })
  })
})
