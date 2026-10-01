import { describe, expect, it, vi } from 'vitest'
import { criarAudioFalso, type AudioFalso, type NoFalso } from './audioFalso.fixture'
import {
  ABAFADOR_HZ,
  criarMotorDeSom,
  destravarAudioNoPrimeiroGesto,
  obterContexto,
  obterSaidaDeSom,
  type ContextoDeSom,
} from './contexto'

function gesto(alvo: EventTarget, tipo: string): void {
  alvo.dispatchEvent(new Event(tipo))
}

function montar(audio: AudioFalso = criarAudioFalso({ estado: 'suspended' })) {
  const fabrica = vi.fn((): ContextoDeSom<NoFalso> | null => audio.ctx)
  const motor = criarMotorDeSom(fabrica)
  const alvo = new EventTarget()
  const parar = motor.destravarNoPrimeiroGesto(alvo)
  return { audio, fabrica, motor, alvo, parar }
}

/** Deixa a promessa do resume() (resolvida ou recusada) assentar. */
const assentar = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('contexto de som', () => {
  it('sem AudioContext (jsdom): o gesto não lança e não há contexto nem saída', () => {
    const alvo = new EventTarget()
    const parar = destravarAudioNoPrimeiroGesto(alvo)
    expect(() => gesto(alvo, 'pointerup')).not.toThrow()
    expect(obterContexto()).toBeNull()
    expect(obterSaidaDeSom()).toBeNull()
    parar()
  })

  it('antes de qualquer gesto nada é criado: nada toca antes do destravamento', () => {
    const { fabrica, motor } = montar()
    expect(motor.obterContexto()).toBeNull()
    expect(motor.obterSaida()).toBeNull()
    expect(fabrica).not.toHaveBeenCalled()
  })

  it('pointerdown não destrava (no toque ele não ativa o usuário); pointerup cria, toca 1 amostra muda e retoma', () => {
    const { audio, fabrica, motor, alvo } = montar()
    gesto(alvo, 'pointerdown')
    expect(fabrica).not.toHaveBeenCalled()

    gesto(alvo, 'pointerup')
    expect(fabrica).toHaveBeenCalledTimes(1)
    expect(motor.obterContexto()).toBe(audio.ctx)
    expect(audio.resume).toHaveBeenCalledTimes(1)
    expect(audio.ctx.state).toBe('running')
    // Exigência do iOS: um som começado dentro do gesto, aqui um buffer de 1 amostra.
    expect(audio.createBuffer).toHaveBeenCalledWith(1, 1, audio.ctx.sampleRate)
    const [silencio] = audio.fontes
    if (silencio === undefined) throw new Error('o gesto não tocou o buffer mudo')
    expect(silencio.destino).toBe(audio.destination)
    expect(silencio.start).toHaveBeenCalled()
  })

  it.each(['touchend', 'click', 'keydown'])('%s também destrava', (tipo) => {
    const { audio, motor, alvo } = montar()
    gesto(alvo, tipo)
    expect(motor.obterContexto()).toBe(audio.ctx)
    expect(audio.resume).toHaveBeenCalledTimes(1)
  })

  it('resume recusado no 1º gesto (Esc não ativa) é tentado de novo no 2º; já rodando, o 3º não retoma nem cria outro contexto', async () => {
    const { audio, fabrica, alvo } = montar()
    audio.resume.mockRejectedValueOnce(new Error('sem ativação do usuário'))
    gesto(alvo, 'keydown')
    await assentar()
    expect(audio.ctx.state).toBe('suspended')

    gesto(alvo, 'pointerup')
    await assentar()
    expect(audio.ctx.state).toBe('running')

    gesto(alvo, 'click')
    expect(audio.resume).toHaveBeenCalledTimes(2)
    expect(fabrica).toHaveBeenCalledTimes(1)
  })

  it('contexto que já nasce rodando dentro do gesto não precisa de retomada', () => {
    const { audio, motor, alvo } = montar(criarAudioFalso({ estado: 'running' }))
    gesto(alvo, 'pointerup')
    expect(motor.obterContexto()).toBe(audio.ctx)
    expect(audio.resume).not.toHaveBeenCalled()
  })

  it('iOS suspendeu de novo (tela bloqueada): o próximo gesto retoma', () => {
    const { audio, alvo } = montar()
    gesto(alvo, 'pointerup')
    audio.definirEstado('suspended')
    gesto(alvo, 'touchend')
    expect(audio.resume).toHaveBeenCalledTimes(2)
    expect(audio.ctx.state).toBe('running')
  })

  it('a saída passa pelo ganho mestre e por um passa-baixa geral de 4 kHz antes do destination', () => {
    const { audio, motor, alvo } = montar()
    gesto(alvo, 'pointerup')
    const saida = motor.obterSaida()
    if (saida === null) throw new Error('sem saída depois do gesto')
    expect(saida.ctx).toBe(audio.ctx)
    const [abafador] = audio.filtros
    if (abafador === undefined) throw new Error('sem passa-baixa geral')
    expect(ABAFADOR_HZ).toBe(4000)
    expect(abafador.type).toBe('lowpass')
    expect(abafador.frequency.setValueAtTime).toHaveBeenCalledWith(4000, expect.any(Number))
    expect(saida.mestre.destino).toBe(abafador)
    expect(abafador.destino).toBe(audio.destination)
  })

  it('fábrica sem Web Audio (null) ou que lança: o gesto não lança e os ouvintes saem', () => {
    const semAudio = vi.fn((): ContextoDeSom<NoFalso> | null => null)
    const alvoSemAudio = new EventTarget()
    criarMotorDeSom(semAudio).destravarNoPrimeiroGesto(alvoSemAudio)
    gesto(alvoSemAudio, 'pointerup')
    gesto(alvoSemAudio, 'pointerup')
    expect(semAudio).toHaveBeenCalledTimes(1)

    const quebrada = vi.fn((): ContextoDeSom<NoFalso> | null => {
      throw new Error('sem saída de áudio')
    })
    const alvoQuebrado = new EventTarget()
    const motor = criarMotorDeSom(quebrada)
    motor.destravarNoPrimeiroGesto(alvoQuebrado)
    expect(() => gesto(alvoQuebrado, 'click')).not.toThrow()
    gesto(alvoQuebrado, 'click')
    expect(quebrada).toHaveBeenCalledTimes(1)
    expect(motor.obterContexto()).toBeNull()
  })

  it('a função devolvida tira os ouvintes: gesto depois dela não cria nada', () => {
    const { fabrica, alvo, parar } = montar()
    parar()
    gesto(alvo, 'pointerup')
    gesto(alvo, 'keydown')
    expect(fabrica).not.toHaveBeenCalled()
  })
})
