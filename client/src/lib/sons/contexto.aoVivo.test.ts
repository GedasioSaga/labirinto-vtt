/**
 * A ENTRADA DOS SONS AO VIVO no contexto (`contexto.ts`): vai direto ao
 * destination, sem o passa-baixa de 4 kHz dos sons de clima, que continuam
 * passando por ele; e o aviso de "o áudio destravou" que o motor ao vivo
 * (`aoVivo/motor.ts`) usa para começar o que esperava o gesto.
 */
import { describe, expect, it, vi } from 'vitest'
import { criarAudioFalso, type NoFalso } from './audioFalso.fixture'
import { ABAFADOR_HZ, criarMotorDeSom, type ContextoDeSom } from './contexto'
import { RECEITAS } from './receitas'
import { tocarReceita } from './sintetizador'

/** Os nós de `no` até a ponta solta (a saída), em ordem. */
function nosAteASaida(no: NoFalso): NoFalso[] {
  const nos: NoFalso[] = []
  let atual: NoFalso | null = no
  // Teto contra ciclo acidental no grafo.
  while (atual !== null && nos.length < 12) {
    nos.push(atual)
    atual = atual.destino
  }
  return nos
}

function montar(estado: AudioContextState = 'suspended') {
  const audio = criarAudioFalso({ estado })
  const motor = criarMotorDeSom((): ContextoDeSom<NoFalso> | null => audio.ctx)
  const alvo = new EventTarget()
  motor.destravarNoPrimeiroGesto(alvo)
  const gesto = (tipo = 'pointerup'): void => {
    alvo.dispatchEvent(new Event(tipo))
  }
  return { audio, motor, gesto }
}

/** Deixa a promessa do resume() (resolvida ou recusada) assentar. */
const assentar = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('saída dos sons ao vivo', () => {
  it('a entrada aoVivo vai DIRETO ao destination, sem o passa-baixa; o som de clima continua passando pelo passa-baixa', () => {
    const { audio, motor, gesto } = montar()
    gesto()
    const saida = motor.obterSaida()
    const aoVivo = motor.obterEntradaAoVivo()
    if (saida === null || aoVivo === null) throw new Error('sem saída depois do gesto')
    const [abafador] = audio.filtros
    if (abafador === undefined) throw new Error('sem passa-baixa geral')
    expect(abafador.frequency.setValueAtTime).toHaveBeenCalledWith(ABAFADOR_HZ, expect.any(Number))

    expect(aoVivo).not.toBe(saida.mestre)
    expect(nosAteASaida(aoVivo)).toEqual([aoVivo, audio.destination])

    // O caminho de hoje, intacto: o ganho do toque de clima -> mestre -> passa-baixa -> destination.
    expect(tocarReceita(saida, RECEITAS.item, 0.5)).toBe(true)
    const volumeDoToque = audio.ganhos.find((ganho) => ganho.destino === saida.mestre)
    if (volumeDoToque === undefined) throw new Error('o toque de clima não ligou no mestre')
    expect(nosAteASaida(volumeDoToque)).toEqual([volumeDoToque, saida.mestre, abafador, audio.destination])
  })
})

describe('aviso de que o áudio destravou', () => {
  it('contexto suspenso: avisa quando o resume() do gesto deixa rodando, uma vez; o gesto seguinte, já rodando, não avisa', async () => {
    const { motor, gesto } = montar('suspended')
    const ouvinte = vi.fn()
    motor.quandoRodar(ouvinte)
    gesto()
    expect(ouvinte).not.toHaveBeenCalled()
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
    gesto('click')
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('contexto que nasce rodando dentro do gesto avisa na hora', () => {
    const { motor, gesto } = montar('running')
    const ouvinte = vi.fn()
    motor.quandoRodar(ouvinte)
    gesto()
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('contexto que volta a rodar FORA de gesto (o bipe do mestre o retoma por evento de rede) avisa quem espera, uma vez', async () => {
    const { audio, motor, gesto } = montar('running')
    gesto()
    const ouvinte = vi.fn()
    motor.quandoRodar(ouvinte)
    audio.definirEstado('suspended')
    expect(ouvinte).not.toHaveBeenCalled()
    void audio.ctx.resume() // o bipe, sem gesto nenhum
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
    gesto()
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('resume recusado não avisa; o próximo gesto que destrava avisa; o ouvinte tirado não ouve mais', async () => {
    const { audio, motor, gesto } = montar('suspended')
    const ouvinte = vi.fn()
    const tirar = motor.quandoRodar(ouvinte)
    audio.resume.mockRejectedValueOnce(new Error('sem ativação do usuário'))
    gesto('keydown')
    await assentar()
    expect(ouvinte).not.toHaveBeenCalled()
    gesto()
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)

    tirar()
    audio.definirEstado('suspended')
    gesto()
    await assentar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })
})
