// @vitest-environment node
/**
 * A LEITURA DA LUTA DE N LADOS NO SITE (Arena multijogador F5) com a forma
 * que o servidor manda de verdade: a luta montada pelo motor (`criarLuta`),
 * recortada por conta (`lutaParaAConta`) e resumida para o histórico
 * (`resumoDaLuta`), pela ida e volta do JSON e pelo leitor do canal. O canal
 * só separa o frame (`luta.fio`); o torto vira `luta.torta` e nunca derruba a
 * conexão (que voltaria a receber o mesmo frame sem fim).
 */
import { describe, expect, it } from 'vitest'
import type { Personagem } from '../../lib/personagem'
import { arbitrarNaLuta } from '../../lib/treino/arbitroDaLuta'
import type { MotorDoDuelo } from '../../lib/treino/duelo'
import { LIA, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../../lib/treino/fichasDeTreino.testkit'
import { criarLuta, type EstadoDaLuta, type InscricaoNaLuta } from '../../lib/treino/luta'
import { resumoDaLuta } from '../../lib/treino/lutaDoLobby'
import type { LadoDaLuta } from '../../lib/treino/mesaEmMemoria'
import { criarSorteio } from '../../lib/treino/sorteio'
import { lutaParaAConta } from '../../lib/treino/vistaDaLuta'
import { lerFrameDaLuta } from './fioDaLuta'
import { lerMensagemDoServidor } from './mensagens'

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

/** O frame como chega pelo canal: JSON, o leitor da fonte e o leitor das lutas. */
function peloCanal(frame: object) {
  const lida = lerMensagemDoServidor(JSON.stringify(frame))
  if (lida?.t !== 'luta.fio') throw new Error(`o canal não separou o frame: ${JSON.stringify(lida)}`)
  return lerFrameDaLuta(lida.bruto)
}

describe('leitura da luta de N lados no site', () => {
  it('luta.estado do jogador e do árbitro entra inteiro (três lados, a vista só para quem joga)', () => {
    const luta = lutaDeTres(motorDaSemente(11))
    const daBia = lutaParaAConta(luta, 'conta_bia', SISTEMA_DO_TESTE)
    const doMestre = lutaParaAConta(luta, 'conta_mestre', SISTEMA_DO_TESTE)
    if (daBia === null || doMestre === null) throw new Error('a luta não tem recorte para a conta')

    const lidaDaBia = peloCanal({ t: 'luta.estado', luta: daBia })
    const lidaDoMestre = peloCanal({ t: 'luta.estado', luta: doMestre })
    if (lidaDaBia.t !== 'luta.estado' || lidaDoMestre.t !== 'luta.estado') throw new Error(`luta.estado recusado: ${lidaDaBia.t} / ${lidaDoMestre.t}`)

    expect(lidaDaBia.luta).toMatchObject({ id: 'luta_de_tres', seq: daBia.seq, modo: 'todos', olhar: 'jogador', tamanho: daBia.tamanho })
    expect(new Set(lidaDaBia.luta.lutadores.vagas.map((vaga) => vaga.lado))).toEqual(new Set(['a', 'b', 'c']))
    expect(lidaDaBia.luta.participantes.map((participante) => participante.contaId).sort()).toEqual(daBia.participantes.map((participante) => participante.contaId).sort())
    expect(Object.keys(lidaDaBia.luta.posicoes).sort()).toEqual(Object.keys(daBia.posicoes).sort())
    expect(lidaDaBia.luta.vista).not.toBeNull()
    expect(lidaDoMestre.luta.olhar).toBe('arbitro')
  })

  it('luta.historico com o resumo real; item torto sai da lista e o frame torto vira luta.torta', () => {
    const motor = motorDaSemente(12)
    const luta = lutaDeTres(motor)
    const encerrada = arbitrarNaLuta(luta, motor, 'conta_mestre', { tipo: 'encerrar', vencedor: 'c', seq: luta.seq }, 9_000)
    if (!encerrada.ok) throw new Error(`o árbitro não encerrou: ${encerrada.motivo}`)
    const resumo = resumoDaLuta(encerrada.luta, 9_000)
    if (resumo === null) throw new Error('a luta encerrada não tem resumo')

    const lida = peloCanal({ t: 'luta.historico', lista: [resumo, { id: 'torta', fim: 'ontem' }], temMais: false })
    if (lida.t !== 'luta.historico') throw new Error(`luta.historico recusado: ${lida.t}`)
    expect(lida.lista).toHaveLength(1)
    expect(lida.lista[0]).toMatchObject({ id: 'luta_de_tres', modo: 'todos', vencedor: 'c', motivo: 'arbitro', rodadas: resumo.rodadas })
    expect(lida.lista[0]?.lados.map((lado) => lado.lado)).toEqual(resumo.lados.map((lado) => lado.lado))

    expect(peloCanal({ t: 'luta.estado', luta: { id: 'sem_nada' } }).t).toBe('luta.torta')
  })
})
