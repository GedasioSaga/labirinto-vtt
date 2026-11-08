// @vitest-environment node
/**
 * O OLHAR DE QUEM ARBITRA E DE QUEM ASSISTE NA TELA (Arena multijogador F5,
 * correção da revisão) com a forma que o servidor manda de verdade: a luta do
 * motor (`criarLuta`), recortada por conta (`lutaParaAConta`), pela ida e volta
 * do JSON e pelo leitor do canal.
 *  - o árbitro recebe todas as fichas como "eu" e a vista diz `minhaVez`: a
 *    faixa dele diz de quem é a vez, nunca "Sua vez";
 *  - quem assiste recebe a luta pelo mesmo `luta.estado` de quem joga: a tela
 *    separa a assistida da luta "sua".
 */
import { describe, expect, it } from 'vitest'
import { linhasDoJogador } from '../../../components/batalha/dadosDaFaixa'
import type { Personagem } from '../../../lib/personagem'
import { cartaDaVez } from '../../../lib/batalha/turnos'
import { arbitrarNaLuta } from '../../../lib/treino/arbitroDaLuta'
import type { MotorDoDuelo } from '../../../lib/treino/duelo'
import { LIA, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../../../lib/treino/fichasDeTreino.testkit'
import { aplicarJogadaNaLuta, criarLuta, type EstadoDaLuta, type InscricaoNaLuta } from '../../../lib/treino/luta'
import type { LadoDaLuta } from '../../../lib/treino/mesaEmMemoria'
import { criarSorteio } from '../../../lib/treino/sorteio'
import { lutaParaAConta } from '../../../lib/treino/vistaDaLuta'
import { lerFrameDaLuta, type LutaRecebida } from '../../dados/fioDaLuta'
import { lerMensagemDoServidor } from '../../dados/mensagens'
import { faixaDaArena, fichasDaLuta } from '../treino/hudDaLuta'
import { lutasDaConta } from './lutasDaConta'

function motorDaSemente(semente: number): MotorDoDuelo {
  const sorteio = criarSorteio(semente)
  return { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
}

function jogador(contaId: string, nome: string, lado: LadoDaLuta, ficha: Personagem): InscricaoNaLuta {
  return { contaId, nome, papel: 'jogador', lado, fichas: [{ ...ficha, dono: contaId }] }
}

/** Todos contra todos, três lados, com o mestre arbitrando. */
function lutaDeTres(motor: MotorDoDuelo): EstadoDaLuta {
  const criada = criarLuta(
    {
      id: 'luta_de_tres',
      modo: 'todos',
      inscricoes: [
        jogador('conta_ana', 'Ana', 'a', ze(60)),
        jogador('conta_bia', 'Bia', 'b', LIA),
        jogador('conta_caio', 'Caio', 'c', MARINHEIRO),
        { contaId: 'conta_mestre', nome: 'Mestre', papel: 'arbitro', lado: null, fichas: [] },
      ],
    },
    motor,
  )
  if (!criada.ok) throw new Error(`luta recusada: ${criada.motivo}`)
  return criada.luta
}

/** O recorte da conta como chega pelo canal: JSON, o leitor da fonte e o leitor das lutas. */
function recebidaPor(luta: EstadoDaLuta, contaId: string): LutaRecebida {
  const recorte = lutaParaAConta(luta, contaId, SISTEMA_DO_TESTE)
  if (recorte === null) throw new Error(`a luta não tem recorte para ${contaId}`)
  const lida = lerMensagemDoServidor(JSON.stringify({ t: 'luta.estado', luta: recorte }))
  if (lida?.t !== 'luta.fio') throw new Error('o canal não separou o frame')
  const frame = lerFrameDaLuta(lida.bruto)
  if (frame.t !== 'luta.estado') throw new Error(`luta.estado recusado: ${frame.t}`)
  return frame.luta
}

/** Quem tem a vez passa: o registro ganha uma linha, a que o árbitro desfaz. */
function comUmaJogada(luta: EstadoDaLuta, motor: MotorDoDuelo): EstadoDaLuta {
  const carta = cartaDaVez(luta.cena.turnos)
  const vaga = luta.lutadores.vagas.find((candidata) => candidata.tokenId === carta?.tokenId)
  if (carta === null || vaga?.contaId === undefined) throw new Error('a luta começou sem ninguém na vez')
  const feita = aplicarJogadaNaLuta(luta, motor, vaga.contaId, { tipo: 'passar', seq: luta.seq, vez: { cartaId: carta.id, rodada: luta.cena.turnos.rodada } })
  if (!feita.ok) throw new Error(`a jogada foi recusada: ${feita.motivo}`)
  return feita.luta
}

describe('o olhar de quem arbitra e de quem assiste', () => {
  it('a faixa do árbitro diz de quem é a vez e mostra os números de todos; o registro dele traz o Desfazer', () => {
    const motor = motorDaSemente(21)
    const luta = comUmaJogada(lutaDeTres(motor), motor)
    const doMestre = recebidaPor(luta, 'conta_mestre')
    const { vista } = doMestre
    if (vista === null) throw new Error('o árbitro ficou sem a vista')

    // A forma real que causava o "Sua vez": a vista do árbitro diz que a vez é dele.
    expect(vista.minhaVez).toBe(true)

    // Como a Arena monta: o árbitro não tem cópias suas (`meus` vazio).
    const faixa = faixaDaArena({ vista, fio: doMestre, fichas: fichasDaLuta(doMestre, false), meus: [], sistema: SISTEMA_DO_TESTE, arbitra: true })
    expect(faixa.minhaVez).toBe(false)
    expect(faixa.cartas.some((carta) => carta.minha)).toBe(false)
    expect(faixa.cartas.find((carta) => carta.id === faixa.vez)?.nome).toBeTruthy()
    expect(faixa.depois).toMatch(/^Depois: /)
    // Os números de todas as fichas (nunca "Sem vida na ficha").
    expect(faixa.cartas.map((carta) => carta.vida)).toEqual(faixa.cartas.map(() => 'numeros'))

    // O registro do árbitro chega com o Desfazer na última linha: a faixa precisa ligá-lo ao arbitrar.
    const desfaziveis = linhasDoJogador(vista.registro).filter((linha) => linha.podeDesfazer)
    expect(desfaziveis.map((linha) => linha.id)).toEqual([luta.cena.registro.at(-1)?.id])
  })

  it('quem assiste fica com a luta assistida, não com "a sua"; a acabada sai das duas', () => {
    const motor = motorDaSemente(22)
    const comecada = lutaDeTres(motor)
    // Como o servidor faz no `luta.assistir`: a conta entra como espectadora, o `seq` fica.
    const assistida = { ...comecada, participantes: [...comecada.participantes, { contaId: 'conta_dani', nome: 'Dani', papel: 'espectador' as const, lado: null, ausenteDesde: null }] }

    const daDani = recebidaPor(assistida, 'conta_dani')
    expect(daDani.olhar).toBe('assistindo')
    expect(lutasDaConta([daDani])).toEqual({ minha: undefined, assistida: daDani })

    const doMestre = recebidaPor(assistida, 'conta_mestre')
    const daBia = recebidaPor(assistida, 'conta_bia')
    expect(lutasDaConta([doMestre]).minha?.olhar).toBe('arbitro')
    expect(lutasDaConta([daBia])).toEqual({ minha: daBia, assistida: undefined })

    const encerrada = arbitrarNaLuta(assistida, motor, 'conta_mestre', { tipo: 'encerrar', vencedor: null, seq: assistida.seq }, 9_000)
    if (!encerrada.ok) throw new Error(`o árbitro não encerrou: ${encerrada.motivo}`)
    expect(lutasDaConta([recebidaPor(encerrada.luta, 'conta_dani')])).toEqual({ minha: undefined, assistida: undefined })
  })
})
