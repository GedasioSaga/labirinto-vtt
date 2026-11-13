import { estaCalado, useSomStore } from '../../stores/somStore'
import { obterSaidaDeSom, quandoOAudioRodar } from './contexto'

/**
 * SOM DA CHUVA (Ambiente, decisão do mestre de 12/11/2026: "ligado e baixo").
 * Ruído rosa filtrado, feito na hora (sem arquivo), num laço; o volume segue a
 * intensidade da chuva e o volume e o mudo da mesa de cada um (`somStore`). O
 * trovão vem só junto do relâmpago. Antes do primeiro gesto o navegador não
 * deixa tocar: o som começa quando o áudio rodar.
 */

/** Os números que se ajustam: o volume da chuva forte (antes do volume da mesa) e o do trovão. */
export const AJUSTE_DO_SOM_DA_CHUVA = {
  volumeMaximo: 0.22,
  volumeDoTrovao: 0.5,
  /** Quanto leva para o volume chegar no alvo (s): sem estalo ao ligar e ao desligar. */
  rampaS: 0.6,
  /** O passa-baixa da chuva (Hz): da garoa à tempestade. */
  filtroHz: [900, 2600],
  duracaoDoLacoS: 3,
} as const

export interface SomDaChuva {
  /** A intensidade da chuva (0 a 1) e se o mestre deixou o som ligado. */
  atualizar: (intensidade: number, ligado: boolean) => void
  /** Um trovão (forca de 0 a 1), com o atraso de quem está longe. */
  trovao: (forca: number) => void
  destruir: () => void
}

/** Ruído rosa (o filtro de Paul Kellet), em `segundos` de amostra. */
function ruidoRosa(taxa: number, segundos: number): Float32Array {
  const amostras = new Float32Array(Math.floor(taxa * segundos))
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < amostras.length; i += 1) {
    const branco = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + branco * 0.0555179
    b1 = 0.99332 * b1 + branco * 0.0750759
    b2 = 0.969 * b2 + branco * 0.153852
    b3 = 0.8665 * b3 + branco * 0.3104856
    b4 = 0.55 * b4 + branco * 0.5329522
    b5 = -0.7616 * b5 - branco * 0.016898
    amostras[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + branco * 0.5362) * 0.11
    b6 = branco * 0.115926
  }
  return amostras
}

/** A saída do app como Web Audio de verdade (laço e rampa macia), ou `null` (sem áudio, ou o contexto falso dos testes). */
function saidaReal(): { ctx: BaseAudioContext; mestre: AudioNode } | null {
  const saida = obterSaidaDeSom()
  if (saida === null || typeof BaseAudioContext === 'undefined') return null
  const ctx: unknown = saida.ctx
  return ctx instanceof BaseAudioContext ? { ctx, mestre: saida.mestre } : null
}

export function criarSomDaChuva(): SomDaChuva {
  let saida: { ctx: BaseAudioContext; mestre: AudioNode } | null = null
  let ganho: GainNode | null = null
  let filtro: BiquadFilterNode | null = null
  let intensidade = 0
  let ligado = false
  let destruido = false

  function volumeDaMesa(): number {
    const preferencia = useSomStore.getState()
    return estaCalado(preferencia) ? 0 : preferencia.volume
  }

  /** Monta o laço na primeira vez que há saída de som; antes do 1º gesto, `false`. */
  function montar(): boolean {
    if (ganho !== null) return true
    saida = saidaReal()
    if (saida === null) return false
    const { ctx, mestre } = saida
    const laco = ctx.createBuffer(1, Math.floor(ctx.sampleRate * AJUSTE_DO_SOM_DA_CHUVA.duracaoDoLacoS), ctx.sampleRate)
    laco.getChannelData(0).set(ruidoRosa(ctx.sampleRate, AJUSTE_DO_SOM_DA_CHUVA.duracaoDoLacoS))
    const fonte = ctx.createBufferSource()
    fonte.buffer = laco
    fonte.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = AJUSTE_DO_SOM_DA_CHUVA.filtroHz[0]
    const g = ctx.createGain()
    g.gain.value = 0
    fonte.connect(f)
    f.connect(g)
    g.connect(mestre)
    fonte.start()
    ganho = g
    filtro = f
    return true
  }

  function aplicar(): void {
    if (destruido) return
    const alvo = ligado ? intensidade * AJUSTE_DO_SOM_DA_CHUVA.volumeMaximo * volumeDaMesa() : 0
    if (alvo <= 0 && ganho === null) return
    if (!montar() || saida === null || ganho === null || filtro === null) return
    const agora = saida.ctx.currentTime
    ganho.gain.setTargetAtTime(alvo, agora, AJUSTE_DO_SOM_DA_CHUVA.rampaS / 3)
    const [baixo, alto] = AJUSTE_DO_SOM_DA_CHUVA.filtroHz
    filtro.frequency.setTargetAtTime(baixo + (alto - baixo) * intensidade, agora, AJUSTE_DO_SOM_DA_CHUVA.rampaS / 3)
  }

  const pararDeOuvirAMesa = useSomStore.subscribe(aplicar)
  const pararDeEsperar = quandoOAudioRodar(aplicar)

  return {
    atualizar(nova, liga) {
      intensidade = Math.min(1, Math.max(0, nova))
      ligado = liga
      aplicar()
    },
    trovao(forca) {
      if (!ligado || destruido || !montar() || saida === null) return
      const volume = volumeDaMesa() * AJUSTE_DO_SOM_DA_CHUVA.volumeDoTrovao * Math.min(1, Math.max(0, forca))
      if (volume <= 0) return
      const { ctx, mestre } = saida
      const duracao = 1.6 + forca * 1.4
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duracao), ctx.sampleRate)
      const dados = buffer.getChannelData(0)
      dados.set(ruidoRosa(ctx.sampleRate, duracao).subarray(0, dados.length))
      const fonte = ctx.createBufferSource()
      fonte.buffer = buffer
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 180
      const g = ctx.createGain()
      // O ronco chega depois do clarão (o som anda mais devagar) e morre devagar.
      const inicio = ctx.currentTime + 0.4 + (1 - forca) * 1.2
      g.gain.value = 0
      g.gain.setTargetAtTime(volume, inicio, 0.05)
      g.gain.setTargetAtTime(0, inicio + 0.3, duracao / 4)
      fonte.connect(f)
      f.connect(g)
      g.connect(mestre)
      fonte.start(inicio)
      fonte.stop(inicio + duracao + 1)
    },
    destruir() {
      destruido = true
      pararDeOuvirAMesa()
      pararDeEsperar()
      if (ganho !== null && saida !== null) ganho.gain.setTargetAtTime(0, saida.ctx.currentTime, 0.05)
      const velho = ganho
      ganho = null
      filtro = null
      if (velho !== null) setTimeout(() => velho.disconnect(), 300)
    },
  }
}
