import { describe, expect, it } from 'vitest'
import {
  caminhoAteASaida,
  criarAudioFalso,
  type AudioFalso,
  type FonteFalsa,
  type GanhoFalso,
  type NoFalso,
  type OsciladorFalso,
  type ParametroFalso,
} from './audioFalso.fixture'
import { RECEITAS, type SomId, type VozOscilador } from './receitas'
import { SEGUNDOS_DE_RUIDO, SILENCIO, curvaDeAltura, tocarReceita } from './sintetizador'

const ids = Object.keys(RECEITAS).filter((id): id is SomId => id in RECEITAS)

/** O ganho de envelope de uma fonte: o primeiro nó "ganho" no caminho dela. */
function envelopeDe(fonte: NoFalso, ganhos: readonly GanhoFalso[]): GanhoFalso {
  let atual = fonte.destino
  while (atual !== null) {
    const ganho = ganhos.find((candidato) => candidato === atual)
    if (ganho !== undefined) return ganho
    atual = atual.destino
  }
  throw new Error(`a fonte ${fonte.nome} não passa por um ganho de envelope`)
}

/** O ganho que entrega a fonte ao mestre: onde mora o volume do toque. */
function volumeDoToqueDe(fonte: NoFalso, audio: AudioFalso): GanhoFalso {
  let atual = fonte.destino
  while (atual !== null) {
    if (atual.destino === audio.mestre) {
      const ganho = audio.ganhos.find((candidato) => candidato === atual)
      if (ganho !== undefined) return ganho
    }
    atual = atual.destino
  }
  throw new Error(`a fonte ${fonte.nome} não chega ao mestre por um ganho`)
}

/** Eventos agendados num parâmetro, de qualquer tipo: degrau, rampa ou curva. */
function totalDeEventos(parametro: ParametroFalso): number {
  return (
    parametro.setValueAtTime.mock.calls.length +
    parametro.exponentialRampToValueAtTime.mock.calls.length +
    parametro.setValueCurveAtTime.mock.calls.length
  )
}

function primeiraChamada<T extends unknown[]>(chamadas: T[]): T {
  const chamada = chamadas[0]
  if (chamada === undefined) throw new Error('esperava ao menos uma chamada')
  return chamada
}

function ultimaChamada<T extends unknown[]>(chamadas: T[]): T {
  const chamada = chamadas.at(-1)
  if (chamada === undefined) throw new Error('esperava ao menos uma chamada')
  return chamada
}

describe('tocarReceita', () => {
  it('item: 8 osciladores (2 notas x 4 parciais), cada um ligado até a saída passando pelo ganho mestre', () => {
    const audio = criarAudioFalso()
    expect(tocarReceita(audio.saida, RECEITAS.item, 0.35)).toBe(true)
    expect(audio.osciladores).toHaveLength(8)
    for (const oscilador of audio.osciladores) {
      expect(oscilador.type).toBe('sine')
      const caminho = caminhoAteASaida(oscilador)
      expect(caminho.slice(-2)).toEqual(['mestre', 'saida'])
      expect(caminho).toContain('ganho')
    }
  })

  it('o volume ao quadrado (0.35 -> 0.1225) vai num ganho só deste toque, posto no disparo, antes de qualquer voz soar', () => {
    const audio = criarAudioFalso({ agora: 3 })
    tocarReceita(audio.saida, RECEITAS.dado, 0.35)
    const fontes: (OsciladorFalso | FonteFalsa)[] = [...audio.osciladores, ...audio.fontes]
    const [umaFonte] = fontes
    if (umaFonte === undefined) throw new Error('o dado não criou fontes')
    const volume = volumeDoToqueDe(umaFonte, audio)
    // Uma porta só até o mestre: todas as vozes do toque passam pelo mesmo volume.
    for (const fonte of fontes) expect(volumeDoToqueDe(fonte, audio)).toBe(volume)
    expect(totalDeEventos(volume.gain)).toBe(1)
    const [ganho, quando] = primeiraChamada(volume.gain.setValueAtTime.mock.calls)
    expect(ganho).toBeCloseTo(0.1225, 6)
    expect(quando).toBeGreaterThanOrEqual(3)
    expect(quando).toBeLessThan(3.05)
    // As vozes partem do mesmo instante (ou depois): nenhuma soa antes de o volume estar posto.
    const partidas = fontes.map((fonte) => primeiraChamada(fonte.start.mock.calls)[0])
    expect(Math.min(...partidas)).toBeCloseTo(quando, 9)
  })

  it('aviso a 0.35 ainda soando quando a barra sobe para 1 e o dado dispara: o mestre comum não muda e o aviso acaba no volume dele', () => {
    const audio = criarAudioFalso({ agora: 3 })
    tocarReceita(audio.saida, RECEITAS.aviso, 0.35)
    const doAviso: (OsciladorFalso | FonteFalsa)[] = [...audio.osciladores, ...audio.fontes]
    audio.avancar(0.5)
    tocarReceita(audio.saida, RECEITAS.dado, 1)
    const doDado = [...audio.osciladores, ...audio.fontes].filter((fonte) => !doAviso.includes(fonte))
    expect(doDado).toHaveLength(RECEITAS.dado.length)

    // O cenário do achado: o dado dispara no meio da cauda do aviso.
    const fimDoAviso = Math.max(...doAviso.map((fonte) => primeiraChamada(fonte.stop.mock.calls)[0]))
    const disparoDoDado = Math.min(...doDado.map((fonte) => primeiraChamada(fonte.start.mock.calls)[0]))
    expect(disparoDoDado).toBeLessThan(fimDoAviso)

    // O mestre é de todos os sons: um degrau nele aqui seria +18 dB instantâneos na cauda do aviso, um clique.
    expect(totalDeEventos(audio.mestre.gain)).toBe(0)

    // Cada toque leva o seu volume, parado do começo ao fim.
    const [umDoAviso] = doAviso
    const [umDoDado] = doDado
    if (umDoAviso === undefined || umDoDado === undefined) throw new Error('toque sem fontes')
    const volumeDoAviso = volumeDoToqueDe(umDoAviso, audio)
    const volumeDoDado = volumeDoToqueDe(umDoDado, audio)
    expect(volumeDoDado).not.toBe(volumeDoAviso)
    for (const fonte of doAviso) expect(volumeDoToqueDe(fonte, audio)).toBe(volumeDoAviso)
    for (const fonte of doDado) expect(volumeDoToqueDe(fonte, audio)).toBe(volumeDoDado)
    expect(totalDeEventos(volumeDoAviso.gain)).toBe(1)
    expect(primeiraChamada(volumeDoAviso.gain.setValueAtTime.mock.calls)[0]).toBeCloseTo(0.1225, 6)
    expect(totalDeEventos(volumeDoDado.gain)).toBe(1)
    expect(primeiraChamada(volumeDoDado.gain.setValueAtTime.mock.calls)[0]).toBe(1)
  })

  it.each(ids)('%s: envelope sem clique (sai do silêncio quando a fonte liga e só para depois de voltar a ele)', (id) => {
    const audio = criarAudioFalso()
    expect(tocarReceita(audio.saida, RECEITAS[id], 1)).toBe(true)
    const fontes: (OsciladorFalso | FonteFalsa)[] = [...audio.osciladores, ...audio.fontes]
    expect(fontes).toHaveLength(RECEITAS[id].length)
    for (const fonte of fontes) {
      expect(caminhoAteASaida(fonte).slice(-2)).toEqual(['mestre', 'saida'])
      const envelope = envelopeDe(fonte, audio.ganhos).gain
      const [valorInicial, inicioDoEnvelope] = primeiraChamada(envelope.setValueAtTime.mock.calls)
      const [valorFinal, fimDoEnvelope] = ultimaChamada(envelope.exponentialRampToValueAtTime.mock.calls)
      const [ligaEm] = primeiraChamada(fonte.start.mock.calls)
      const [paraEm] = primeiraChamada(fonte.stop.mock.calls)
      expect(valorInicial).toBe(SILENCIO)
      expect(valorFinal).toBe(SILENCIO)
      expect(ligaEm).toBe(inicioDoEnvelope)
      expect(paraEm).toBeGreaterThanOrEqual(fimDoEnvelope)
      for (const [valor] of envelope.exponentialRampToValueAtTime.mock.calls) expect(valor).toBeGreaterThan(0)
    }
  })

  it('voz com filtro passa por ele antes do envelope', () => {
    const audio = criarAudioFalso()
    tocarReceita(audio.saida, RECEITAS.portaAbre, 1)
    expect(audio.filtros.length).toBeGreaterThan(0)
    const passaAlta = audio.filtros.find((filtro) => filtro.type === 'highpass')
    if (passaAlta === undefined) throw new Error('portaAbre tem o clique em passa-alta')
    expect(primeiraChamada(passaAlta.frequency.setValueAtTime.mock.calls)[0]).toBeGreaterThan(1000)
    // filtro -> envelope da voz -> volume do toque -> mestre -> saída
    expect(caminhoAteASaida(passaAlta)).toEqual(['filtro', 'ganho', 'ganho', 'mestre', 'saida'])
  })

  it('ruído: um buffer só por contexto, reaproveitado entre vozes e entre toques, sem passar do fim', () => {
    const audio = criarAudioFalso({ taxa: 44100 })
    tocarReceita(audio.saida, RECEITAS.dado, 0.5)
    tocarReceita(audio.saida, RECEITAS.dado, 0.5)
    expect(audio.createBuffer).toHaveBeenCalledTimes(1)
    expect(audio.createBuffer).toHaveBeenCalledWith(1, 44100 * SEGUNDOS_DE_RUIDO, 44100)
    expect(audio.fontes.length).toBeGreaterThan(1)
    const [primeiraFonte] = audio.fontes
    if (primeiraFonte === undefined || primeiraFonte.buffer === null) throw new Error('fonte de ruído sem buffer')
    const buffer = primeiraFonte.buffer
    for (const fonte of audio.fontes) expect(fonte.buffer).toBe(buffer)
    const amostras = Array.from(buffer.getChannelData(0))
    expect(Math.max(...amostras.map(Math.abs))).toBeLessThanOrEqual(1)
    expect(amostras.some((amostra) => amostra !== 0)).toBe(true)
    for (const fonte of audio.fontes) {
      const [ligaEm, deslocamento = 0] = primeiraChamada(fonte.start.mock.calls)
      const [paraEm] = primeiraChamada(fonte.stop.mock.calls)
      expect(deslocamento).toBeGreaterThanOrEqual(0)
      expect(deslocamento + (paraEm - ligaEm)).toBeLessThanOrEqual(SEGUNDOS_DE_RUIDO + 1e-9)
    }
  })

  it('vibrato vira uma curva única de altura (o Web Audio recusa outro evento no meio dela); glissando sem vibrato vira rampa exponencial', () => {
    const audio = criarAudioFalso()
    tocarReceita(audio.saida, RECEITAS.passagem, 1)
    const vozesDeOscilador = RECEITAS.passagem.filter((voz): voz is VozOscilador => voz.fonte === 'osc')
    expect(audio.osciladores).toHaveLength(vozesDeOscilador.length)
    expect(vozesDeOscilador.some((voz) => voz.vibrato !== undefined)).toBe(true)
    vozesDeOscilador.forEach((voz, indice) => {
      const oscilador = audio.osciladores.at(indice)
      if (oscilador === undefined) throw new Error(`sem oscilador para a voz ${indice}`)
      const altura = oscilador.frequency
      const [ligaEm] = primeiraChamada(oscilador.start.mock.calls)
      if (voz.vibrato !== undefined) {
        const [curva, quando, duracao] = primeiraChamada(altura.setValueCurveAtTime.mock.calls)
        expect(Math.min(...curva)).toBeGreaterThan(0)
        expect(quando).toBe(ligaEm)
        expect(duracao).toBe(voz.duracao)
        expect(altura.setValueAtTime).not.toHaveBeenCalled()
        expect(altura.exponentialRampToValueAtTime).not.toHaveBeenCalled()
        return
      }
      expect(altura.setValueCurveAtTime).not.toHaveBeenCalled()
      expect(altura.setValueAtTime).toHaveBeenCalledWith(voz.hzIni, ligaEm)
      if (voz.hzFim !== undefined) expect(altura.exponentialRampToValueAtTime).toHaveBeenCalledWith(voz.hzFim, ligaEm + voz.duracao)
    })
  })

  it('contexto que lança ao criar um nó devolve false, sem lançar', () => {
    const audio = criarAudioFalso()
    audio.ctx.createOscillator = () => {
      throw new Error('nó recusado')
    }
    expect(() => tocarReceita(audio.saida, RECEITAS.item, 0.35)).not.toThrow()
    expect(tocarReceita(audio.saida, RECEITAS.item, 0.35)).toBe(false)
  })
})

describe('curvaDeAltura', () => {
  it('desce de hzIni a hzFim tremendo em volta, com resolução de pelo menos 1 ponto a cada 10 ms', () => {
    const voz: VozOscilador = {
      fonte: 'osc',
      forma: 'sawtooth',
      hzIni: 100,
      hzFim: 50,
      vibrato: { hz: 10, profundidade: 5 },
      inicio: 0,
      ataque: 0.05,
      duracao: 0.5,
      pico: 0.2,
    }
    const curva = curvaDeAltura(voz)
    expect(curva.length).toBeGreaterThanOrEqual(0.5 * 100)
    expect(curva[0]).toBeCloseTo(100, 3)
    expect(curva.at(-1)).toBeCloseTo(50, 2)
    expect(Math.max(...curva)).toBeLessThanOrEqual(105 + 1e-3)
    expect(Math.min(...curva)).toBeGreaterThanOrEqual(45 - 1e-3)
  })

  it('sem glissando nem vibrato a altura fica parada', () => {
    const voz: VozOscilador = { fonte: 'osc', forma: 'sine', hzIni: 220, inicio: 0, ataque: 0.01, duracao: 0.2, pico: 0.1 }
    expect(new Set(curvaDeAltura(voz))).toEqual(new Set([220]))
  })
})
