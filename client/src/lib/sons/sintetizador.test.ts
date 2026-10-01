import { describe, expect, it } from 'vitest'
import {
  caminhoAteASaida,
  criarAudioFalso,
  type FonteFalsa,
  type GanhoFalso,
  type NoFalso,
  type OsciladorFalso,
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

  it('o ganho mestre recebe o volume ao quadrado (0.35 -> 0.1225) no instante do disparo', () => {
    const audio = criarAudioFalso({ agora: 3 })
    tocarReceita(audio.saida, RECEITAS.dado, 0.35)
    const [ganho, quando] = primeiraChamada(audio.mestre.gain.setValueAtTime.mock.calls)
    expect(ganho).toBeCloseTo(0.1225, 6)
    expect(quando).toBeGreaterThanOrEqual(3)
    expect(quando).toBeLessThan(3.05)
    // As vozes partem do mesmo instante (ou depois): nada é agendado no passado do mestre.
    const partidas = [...audio.osciladores, ...audio.fontes].map((fonte) => primeiraChamada(fonte.start.mock.calls)[0])
    expect(Math.min(...partidas)).toBeCloseTo(quando, 9)
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
    expect(caminhoAteASaida(passaAlta)).toEqual(['filtro', 'ganho', 'mestre', 'saida'])
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
