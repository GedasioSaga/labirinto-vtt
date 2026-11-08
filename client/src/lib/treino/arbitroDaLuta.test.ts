/**
 * O ÁRBITRO E O MESTRE COMO JUDGE (Arena multijogador, fatia F3; aceite em
 * docs/planos/arena-multijogador-2026-11-07.md §5): o desfazer do árbitro
 * devolve as fichas, sobe o `seq` e risca a linha com o nome dele; jogada na
 * pausa volta `pausada`. E o mestre como Judge: o lado dele leva o Judge e os
 * inimigos, e fora 3 min o robô assume e joga até a vez de gente.
 */
import { describe, expect, it } from 'vitest'
import { cartaDaVez } from '../batalha/turnos'
import type { Personagem } from '../personagem'
import { arbitrarNaLuta, NOME_DO_ARBITRO, ultimaNaoRiscada } from './arbitroDaLuta'
import { VOLTA_DO_AUSENTE_MS, type JogadaDoDuelo, type MotorDoDuelo } from './duelo'
import { LIA, MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { ajustesPadraoDoJuiz, ID_DO_JUIZ } from './juiz'
import { aplicarJogadaNaLuta, criarLuta, marcarAusenteNaLuta, tirarAusentes, type EstadoDaLuta, type InscricaoNaLuta } from './luta'
import type { LadoDaLuta } from './mesaEmMemoria'
import { jogadaDoRobo } from './robo'
import { criarSorteio } from './sorteio'
import { lutaParaAConta } from './vistaDaLuta'

function motorDaSemente(semente: number): MotorDoDuelo {
  const sorteio = criarSorteio(semente)
  return { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
}

/** Quem joga, com a ficha como o servidor a guarda (o doc completo, com o dono). */
function jogador(contaId: string, nome: string, lado: LadoDaLuta, ficha: Personagem): InscricaoNaLuta {
  return { contaId, nome, papel: 'jogador', lado, fichas: [{ ...ficha, dono: contaId }] }
}

const ARBITRO: InscricaoNaLuta = { contaId: 'conta_mestre', nome: 'Mestre', papel: 'arbitro', lado: null, fichas: [] }

/** Ana (Zé) contra Bia (Lia), com o mestre arbitrando. */
function lutaComArbitro(motor: MotorDoDuelo): EstadoDaLuta {
  const criada = criarLuta({ id: 'luta_arbitro', modo: 'times', inscricoes: [jogador('conta_ana', 'Ana', 'a', ze(60)), jogador('conta_bia', 'Bia', 'b', LIA), ARBITRO] }, motor)
  if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
  return criada.luta
}

/** A conta dona da vaga do token. */
function contaDoToken(luta: EstadoDaLuta, tokenId: string | undefined): string {
  const contaId = luta.lutadores.vagas.find((vaga) => vaga.tokenId === tokenId)?.contaId
  if (contaId === undefined) throw new Error(`token ${String(tokenId)} sem conta`)
  return contaId
}

/** A vez de agora, como a tela a manda. */
function vezDe(luta: EstadoDaLuta): { cartaId: string; rodada: number } {
  const { vez, rodada } = luta.cena.turnos
  if (vez === null) throw new Error('a luta está sem vez')
  return { cartaId: vez, rodada }
}

/** A próxima jogada aceita que o robô faria pela conta dona da ficha que reage ou está na vez. */
function jogadaDoRoboAceita(luta: EstadoDaLuta, motor: MotorDoDuelo): EstadoDaLuta {
  const { turnos, regras } = luta.cena
  const jogada = jogadaDoRobo({ turnos, regras, vagas: luta.lutadores.vagas, personagens: luta.lutadores.personagens, sistema: SISTEMA_DO_TESTE, golpesNaVez: 0 })
  if (jogada === null) throw new Error('o robô ficou sem vez')
  const { seq } = luta
  const contaId = contaDoToken(luta, jogada.tipo === 'reagir' ? jogada.pedido.tokenId : jogada.tokenId)
  const jogadas: JogadaDoDuelo[] =
    jogada.tipo === 'reagir'
      ? [{ tipo: 'reagir', seq, pedido: jogada.pedido }]
      : [...jogada.golpes.map((pedido): JogadaDoDuelo => ({ tipo: 'agir', seq, vez: jogada.esperado, pedido })), { tipo: 'passar', seq, vez: jogada.esperado }]
  for (const tentativa of jogadas) {
    const feito = aplicarJogadaNaLuta(luta, motor, contaId, tentativa)
    if (feito.ok) return feito.luta
  }
  throw new Error('nenhuma jogada do robô foi aceita')
}

/** Os recursos (HP, SP, Escudo) de cada cópia, na ordem das vagas. */
function recursosDasFichas(luta: EstadoDaLuta): Readonly<Record<string, number>>[] {
  return luta.lutadores.personagens.map((personagem) => personagem.recursos)
}

describe('o árbitro da luta (F3)', () => {
  it('o desfazer do árbitro devolve as fichas, sobe o seq e risca a linha com o nome dele', () => {
    const motor = motorDaSemente(7)
    // As jogadas, uma a uma, até a primeira que mexe nas fichas (o custo ou o dano).
    const inicio = lutaComArbitro(motor)
    const estados = [inicio]
    let luta = inicio
    for (let passo = 0; passo < 40 && JSON.stringify(recursosDasFichas(luta)) === JSON.stringify(recursosDasFichas(inicio)); passo += 1) {
      luta = jogadaDoRoboAceita(luta, motor)
      estados.push(luta)
    }
    const ultima = ultimaNaoRiscada(luta.cena.registro)
    if (ultima === null) throw new Error('o registro ficou vazio')
    // As fichas de antes da linha: o último estado em que ela ainda não existia.
    const antesDaLinha = [...estados].reverse().find((estado) => !estado.cena.registro.some((linha) => linha.id === ultima.id))
    if (antesDaLinha === undefined) throw new Error('a linha já estava na luta nova')
    expect(recursosDasFichas(luta)).not.toEqual(recursosDasFichas(antesDaLinha))

    const desfeito = arbitrarNaLuta(luta, motor, 'conta_mestre', { tipo: 'desfazer', seq: luta.seq }, 1_000)
    if (!desfeito.ok) throw new Error(`desfazer recusado: ${desfeito.motivo}`)
    expect(desfeito.luta.seq).toBe(luta.seq + 1)
    expect(recursosDasFichas(desfeito.luta)).toEqual(recursosDasFichas(antesDaLinha))
    expect(desfeito.luta.cena.registro.find((linha) => linha.id === ultima.id)?.desfeita?.por).toBe(NOME_DO_ARBITRO)
    // Riscada também no fio do árbitro; e quem joga não arbitra.
    expect(lutaParaAConta(desfeito.luta, 'conta_mestre', SISTEMA_DO_TESTE)?.registro.find((linha) => linha.id === ultima.id)?.desfeita).toEqual({ por: NOME_DO_ARBITRO })
    expect(arbitrarNaLuta(desfeito.luta, motor, 'conta_ana', { tipo: 'desfazer', seq: desfeito.luta.seq }, 2_000)).toEqual({ ok: false, motivo: 'naoArbitra' })
  })

  it('jogada na pausa volta pausada; retomada, a mesma jogada passa', () => {
    const motor = motorDaSemente(7)
    const luta = lutaComArbitro(motor)
    const pausada = arbitrarNaLuta(luta, motor, 'conta_mestre', { tipo: 'pausar', seq: luta.seq }, 5_000)
    if (!pausada.ok) throw new Error(`pausa recusada: ${pausada.motivo}`)
    expect(pausada.luta.pausada).toBe(true)
    expect(pausada.luta.marcos).toEqual([{ seq: luta.seq + 1, tipo: 'pausar', quando: 5_000 }])
    const dono = contaDoToken(luta, cartaDaVez(luta.cena.turnos)?.tokenId)
    const passar = (estado: EstadoDaLuta): JogadaDoDuelo => ({ tipo: 'passar', seq: estado.seq, vez: vezDe(estado) })
    expect(aplicarJogadaNaLuta(pausada.luta, motor, dono, passar(pausada.luta))).toEqual({ ok: false, motivo: 'pausada' })

    const retomada = arbitrarNaLuta(pausada.luta, motor, 'conta_mestre', { tipo: 'retomar', seq: pausada.luta.seq }, 6_000)
    if (!retomada.ok) throw new Error(`retomada recusada: ${retomada.motivo}`)
    expect(retomada.luta.pausada).toBeUndefined()
    expect(aplicarJogadaNaLuta(retomada.luta, motor, dono, passar(retomada.luta)).ok).toBe(true)
  })
})

describe('o mestre como Judge (F3)', () => {
  it('o lado dele leva o Judge e os inimigos; fora 3 min, o robô assume e joga até a vez de gente', () => {
    const motor = motorDaSemente(7)
    const mestre: InscricaoNaLuta = { contaId: 'conta_mestre', nome: 'Mestre', papel: 'juiz', lado: 'b', fichas: [MARINHEIRO], juiz: { ajustes: ajustesPadraoDoJuiz(), base: null } }
    const criada = criarLuta({ id: 'luta_judge', modo: 'times', inscricoes: [jogador('conta_ana', 'Ana', 'a', ze(60)), mestre] }, motor)
    if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
    const doMestre = criada.luta.lutadores.vagas.filter((vaga) => vaga.contaId === 'conta_mestre')
    expect(doMestre.map((vaga) => [vaga.lado, vaga.origem])).toEqual([
      ['b', ID_DO_JUIZ],
      ['b', MARINHEIRO.id],
    ])

    // O mestre some; passados 3 min, o robô assume as fichas dele (que seguem na luta).
    const assumida = tirarAusentes(marcarAusenteNaLuta(criada.luta, 'conta_mestre', 0), motor, VOLTA_DO_AUSENTE_MS)
    expect(assumida.participantes.find((participante) => participante.contaId === 'conta_mestre')?.robo).toBe(true)
    expect(assumida.lutadores.vagas.some((vaga) => vaga.fora === true)).toBe(false)

    // O Zé (Agilidade 40) abre a ordem; a Ana passa, e o robô joga o Marinheiro e o Judge até a vez dela.
    const tokenDaAna = criada.luta.lutadores.vagas.find((vaga) => vaga.contaId === 'conta_ana')?.tokenId
    expect(cartaDaVez(assumida.cena.turnos)?.tokenId).toBe(tokenDaAna)
    const passou = aplicarJogadaNaLuta(assumida, motor, 'conta_ana', { tipo: 'passar', seq: assumida.seq, vez: vezDe(assumida) })
    if (!passou.ok) throw new Error(`passar recusado: ${passou.motivo}`)
    const { turnos } = passou.luta.cena
    const golpeNaAna = (turnos.golpes ?? []).some((golpe) => golpe.alvos.some((alvo) => alvo.tokenId === tokenDaAna && alvo.danoFinal === undefined))
    expect(golpeNaAna || cartaDaVez(turnos)?.tokenId === tokenDaAna).toBe(true)
    expect(passou.luta.seq).toBe(assumida.seq + 2)
    expect(passou.luta.passos).toBeGreaterThan(assumida.passos + 1)
  })
})
