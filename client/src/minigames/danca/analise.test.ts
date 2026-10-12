import { describe, expect, it } from 'vitest'
import {
  ajustarToques,
  analisar,
  BPM_AJUSTE_MAX,
  prepararMusicaImportada,
  reajustar,
  tempoDosToques,
  tempoMexido,
  type AudioDecodificado,
} from './analise'

/** AudioBuffer de mentira (o jsdom não tem Web Audio): só o que a análise lê. */
function bufferDe(canais: Float32Array[], sampleRate: number): AudioDecodificado {
  const length = canais[0].length
  return { sampleRate, length, duration: length / sampleRate, numberOfChannels: canais.length, getChannelData: (c) => canais[c] }
}

/**
 * Trilho de cliques sintéticos igual ao do protótipo (provas/gerar-provas.cjs):
 * ruído com queda rápida, mais forte nas batidas pares, e um grave de 60 Hz no
 * começo de cada compasso.
 */
function cliques(bpm: number, inicio: number, sr = 44100, dur = 30): AudioDecodificado {
  const d = new Float32Array(sr * dur)
  let s = 1
  const rnd = (): number => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
  for (let k = 0; ; k += 1) {
    const t = inicio + (k * 60) / bpm
    if (t > dur - 0.2) break
    const i0 = Math.round(t * sr)
    for (let i = 0; i < 2000; i += 1) {
      const grave = k % 4 === 0 ? 0.6 * Math.sin((i / sr) * 2 * Math.PI * 60) * Math.exp(-i / 1500) : 0
      d[i0 + i] += (k % 2 ? 0.5 : 0.9) * rnd() * Math.exp(-i / 300) + grave
    }
  }
  return bufferDe([d], sr)
}

/** Erro da primeira batida achada, em ms, módulo a batida (achar uma batida depois também é certo). */
function erroDaFaseMs(achada: number, real: number, bpm: number): number {
  const P = 60 / bpm
  return Math.round(((((achada - real) % P) + P + P / 2) % P - P / 2) * 1000)
}

describe('BPM e primeira batida em cliques sintéticos', () => {
  for (const [bpm, inicio] of [[95, 0.37], [116, 0.52], [140, 0.81]]) {
    it(`${bpm} BPM`, async () => {
      const a = await analisar(cliques(bpm, inicio))
      expect(Math.abs(a.bpm - bpm)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(erroDaFaseMs(a.primeiraBatida, inicio, bpm))).toBeLessThanOrEqual(20)
      expect(a.periodo).toBeCloseTo(60 / a.bpm, 9)
      expect(a.duracao).toBe(30)
      expect(a.confianca).toBeGreaterThanOrEqual(0)
      expect(a.confianca).toBeLessThanOrEqual(1)
      expect(a.fase4).toBeGreaterThanOrEqual(0)
      expect(a.fase4).toBeLessThanOrEqual(3)
    })
  }

  it('mistura os canais e avisa o progresso até 1', async () => {
    const mono = cliques(120, 0.3, 22050, 12)
    const um = mono.getChannelData(0)
    const estereo = bufferDe([um, new Float32Array(um)], 22050)
    const progresso: number[] = []
    const a = await analisar(estereo, (k) => progresso.push(k))
    expect(Math.abs(a.bpm - 120)).toBeLessThanOrEqual(0.5)
    expect(progresso[progresso.length - 1]).toBe(1)
    for (let i = 1; i < progresso.length; i += 1) expect(progresso[i]).toBeGreaterThan(progresso[i - 1])
  })
})

describe('música sem batida nenhuma', () => {
  it('silêncio: analisa sem quebrar, confiança 0 e as coreografias saem vazias', async () => {
    const silencio = bufferDe([new Float32Array(22050 * 5)], 22050)
    const { ritmo, analise } = await prepararMusicaImportada(silencio, 'pino-1')
    expect(Number.isFinite(ritmo.bpm)).toBe(true)
    expect(Number.isFinite(ritmo.primeiraBatida)).toBe(true)
    expect(analise.confianca).toBe(0)
    expect(ritmo.coreografias).toEqual({ diversao: [], expert: [] })
  })

  it('arquivo curtíssimo (menos de 1 s): o ajuste à mão não dá primeira batida negativa', async () => {
    const curto = bufferDe([new Float32Array(22050 * 0.5)], 22050)
    const { analise } = await prepararMusicaImportada(curto, 'pino-1')
    const mexido = tempoMexido(analise, 0.1, 0.01)
    expect(mexido.primeiraBatida).toBe(0)
    expect(reajustar(analise, mexido, 'pino-1').ritmo.coreografias).toEqual({ diversao: [], expert: [] })
  })
})

describe('tempo batido à mão', () => {
  it('8 toques ~116 BPM dão 116 BPM', () => {
    const r = ajustarToques([0.512, 1.03, 1.548, 2.061, 2.583, 3.098, 3.61, 4.131])
    expect(r).not.toBeNull()
    if (r === null) return
    expect(Math.abs(60 / r.periodo - 116)).toBeLessThan(1)
  })

  it('toque pulado conta como 2 batidas, não estraga o tempo', () => {
    const r = ajustarToques([0, 0.5, 1, 2, 2.5, 3])
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.periodo).toBeCloseTo(0.5, 9)
    expect(r.fase).toBeCloseTo(0, 9)
  })

  it('menos de 4 toques, ou tempo fora de 40-240 BPM, não vale', () => {
    expect(ajustarToques([0, 0.5, 1])).toBeNull()
    expect(ajustarToques([0, 0.1, 0.2, 0.3, 0.4])).toBeNull()
    expect(ajustarToques([0, 2, 4, 6])).toBeNull()
  })

  it('vira BPM arredondado a 0,1 e primeira batida dentro da primeira batida da música', () => {
    const r = tempoDosToques([3.02, 3.52, 4.02, 4.52, 5.02, 5.52, 6.02, 6.52])
    expect(r).not.toBeNull()
    if (r === null) return
    expect(r.bpm).toBe(120)
    expect(r.primeiraBatida).toBeGreaterThanOrEqual(0)
    expect(r.primeiraBatida).toBeLessThan(0.5)
    expect(r.primeiraBatida).toBeCloseTo(0.02, 6)
    expect(tempoDosToques([0, 1])).toBeNull()
  })
})

describe('música importada no pino', () => {
  it('prepara ritmo e as duas coreografias, iguais para a mesma semente', async () => {
    const buffer = cliques(116, 0.52)
    const a = await prepararMusicaImportada(buffer, 'pino-1')
    const b = await prepararMusicaImportada(buffer, 'pino-1')
    expect(a.ritmo).toEqual(b.ritmo)
    expect(Math.abs(a.ritmo.bpm - 116)).toBeLessThanOrEqual(0.5)
    expect(a.ritmo.duracaoS).toBe(30)
    expect(a.ritmo.primeiraBatida).toBe(a.analise.primeiraBatida)
    expect(a.ritmo.fase4).toBe(a.analise.fase4)
    expect(a.ritmo.coreografias.diversao.length).toBeGreaterThan(0)
    expect(a.ritmo.coreografias.expert.length).toBeGreaterThan(0)
    for (const n of a.ritmo.coreografias.diversao) expect(n.sub).toBe(4)
    // O ritmo é o que vai para o pino: só números e setas, nada de Float32Array.
    expect(JSON.parse(JSON.stringify(a.ritmo))).toEqual(a.ritmo)
    const outra = await prepararMusicaImportada(buffer, 'pino-2')
    expect(outra.ritmo.coreografias.expert).not.toEqual(a.ritmo.coreografias.expert)
  })

  it('reajustar refaz as setas com o tempo novo e não mexe na análise recebida', async () => {
    const { analise, ritmo } = await prepararMusicaImportada(cliques(116, 0.52), 'pino-1')
    const bpmAntes = analise.bpm
    const novo = reajustar(analise, { bpm: 100, primeiraBatida: 0.3 }, 'pino-1')
    expect(analise.bpm).toBe(bpmAntes)
    expect(novo.ritmo.bpm).toBe(100)
    expect(novo.analise.periodo).toBeCloseTo(0.6, 9)
    expect(novo.ritmo.primeiraBatida).toBe(0.3)
    expect(novo.ritmo.fase4).toBe(ritmo.fase4)
    expect(novo.ritmo.coreografias.diversao).not.toEqual(ritmo.coreografias.diversao)
    // Na Diversão toda seta cai numa batida: múltiplo inteiro de 0,6 s a partir de 0,3 s.
    for (const n of novo.ritmo.coreografias.diversao) {
      const batidas = (n.t - 0.3) / 0.6
      expect(Math.abs(batidas - Math.round(batidas))).toBeLessThan(1e-6)
    }
  })

  it('reajustar recusa BPM ou primeira batida inválidos', async () => {
    const { analise } = await prepararMusicaImportada(cliques(116, 0.52, 22050, 10), 'pino-1')
    expect(() => reajustar(analise, { bpm: 0, primeiraBatida: 0 }, 'p')).toThrow(RangeError)
    expect(() => reajustar(analise, { bpm: Number.NaN, primeiraBatida: 0 }, 'p')).toThrow(RangeError)
    expect(() => reajustar(analise, { bpm: 120, primeiraBatida: -1 }, 'p')).toThrow(RangeError)
  })

  it('±0,1 BPM e ±10 ms arredondam e ficam dentro dos limites', async () => {
    const { analise } = await prepararMusicaImportada(cliques(116, 0.52, 22050, 10), 'pino-1')
    const mais = tempoMexido(analise, 0.1, 0.01)
    expect(mais.bpm).toBe(Math.round((analise.bpm + 0.1) * 10) / 10)
    expect(mais.primeiraBatida).toBeCloseTo(analise.primeiraBatida + 0.01, 9)
    expect(tempoMexido({ ...analise, bpm: 219.98 }, 0.1, 0).bpm).toBe(BPM_AJUSTE_MAX)
    expect(tempoMexido(analise, 0, -100).primeiraBatida).toBe(0)
    expect(tempoMexido(analise, 0, 100).primeiraBatida).toBe(analise.duracao - 1)
  })
})
