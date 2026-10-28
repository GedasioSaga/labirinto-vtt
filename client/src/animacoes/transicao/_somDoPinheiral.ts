import type { KitDeSom } from '../../transicoes/tipos'
import { easeInOutSine, span } from '../../transicoes/curvas'
import { semente } from '../../transicoes/texturas'
import { CADENCIA, DURACAO, fogoEm, passoEm, rajadaEm, tremorEm, type VarianteDaTrilha } from './_roteiroDoPinheiral'

/*
 * Som da "Trilha do pinheiral", todo sintetizado (o pacote não leva arquivo de
 * áudio). Dia: vento nos pinheiros, passos na terra e um corvo ao longe.
 * Chamas: os mesmos passos, vento mais baixo, rugido grave do fogo e estalos.
 * As pistas seguem o tempo da cena (o motor escala a duração e o som vai junto).
 */

const MIXAGEM = 1.6
const PASSO = 0.42
const CORVO = 0.07
const RUGIDO = 0.34
const ESTALO = 0.2
/** Último contato de pé antes do fim. */
const PASSOS = Math.floor(CADENCIA * DURACAO)

/** Entra com o fade e sai antes do fim: o motor fecha o som em 7 s e não pode cortar nada. */
function envelopeGeralEm(t: number): number {
  return easeInOutSine(span(t, 0, 0.45)) * (1 - easeInOutSine(span(t, 6.3, 6.92)))
}

/** Grão de passo na terra: estalinhos de cascalho no calcanhar e de novo na planta do pé. */
function passoNaTerra(ctx: BaseAudioContext, k: number): AudioBuffer {
  const taxa = ctx.sampleRate
  const n = Math.ceil(taxa * 0.22)
  const buffer = ctx.createBuffer(1, n, taxa)
  const dados = buffer.getChannelData(0)
  const rnd = semente(8101 + k * 613)
  for (let g = 0; g < 64; g++) {
    const em = g < 40 ? rnd() * rnd() * 0.08 : 0.06 + rnd() * 0.1
    const dur = 0.0015 + rnd() * 0.004
    const amp = (0.25 + rnd() * 0.75) * Math.exp(-em * 14)
    const i0 = Math.floor(em * taxa)
    const i1 = Math.min(n, i0 + Math.max(2, Math.floor(dur * taxa)))
    for (let i = i0; i < i1; i++) {
      const u = (i - i0) / (i1 - i0)
      dados[i] += (rnd() * 2 - 1) * amp * Math.min(1, u * 12) * Math.exp(-u * 5)
    }
  }
  let pico = 0
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(dados[i]))
  // Fim em zero: nada de clique no último grão.
  for (let i = 0; i < n; i++) dados[i] = (dados[i] / (pico || 1)) * Math.min(1, (n - 1 - i) / (taxa * 0.01))
  return buffer
}

interface Estalo {
  em: number
  grande: boolean
  amp: number
  pan: number
  freq: number
  dur: number
  deslocamento: number
}

/** Estalos do fogo, sorteados uma vez: miúdos e frequentes, com um pipoco grande de vez em quando. */
function estalosDoFogo(): Estalo[] {
  const rnd = semente(6607)
  const lista: Estalo[] = []
  let t = 0.15
  while (t < 6.5) {
    const grande = rnd() < 0.12
    lista.push({
      em: t,
      grande,
      amp: grande ? 0.7 + rnd() * 0.3 : 0.25 + rnd() * 0.6,
      pan: (rnd() - 0.5) * 1.4,
      freq: grande ? 700 + rnd() * 600 : 1600 + rnd() * 3200,
      dur: grande ? 0.03 + rnd() * 0.04 : 0.003 + rnd() * 0.01,
      deslocamento: rnd() * 1.8,
    })
    t += -Math.log(1 - rnd() * 0.98) / (12 + 8 * fogoEm(t))
  }
  return lista
}

export function somDaTrilha(kit: KitDeSom, variante: VarianteDaTrilha) {
  const { ctx } = kit
  const chamas = variante === 'chamas'
  const mixagem = ctx.createGain()
  mixagem.gain.value = MIXAGEM
  mixagem.connect(kit.destino)
  const geral = ctx.createGain()
  geral.gain.value = 0
  geral.connect(mixagem)

  // Vento nos pinheiros: chiado das agulhas por cima, corpo no meio, grave por baixo.
  const ruido = kit.ruido(2)
  const vento = ctx.createGain()
  vento.gain.value = 0
  vento.connect(geral)
  const VENTO = chamas ? 0.1 : 0.2
  const camadas = [
    { tipo: 'bandpass' as BiquadFilterType, freq: 480, q: 0.7, pan: -0.5, ganho: 1, inicio: 0 },
    { tipo: 'bandpass' as BiquadFilterType, freq: 860, q: 0.8, pan: 0.5, ganho: 0.8, inicio: 0.7 },
    { tipo: 'bandpass' as BiquadFilterType, freq: 2600, q: 0.6, pan: 0.15, ganho: 0.32, inicio: 1.1 },
    { tipo: 'lowpass' as BiquadFilterType, freq: 150, q: 0.7, pan: 0, ganho: 0.55, inicio: 1.5 },
  ].map((c) => {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruido
    fonte.loop = true
    const filtro = ctx.createBiquadFilter()
    filtro.type = c.tipo
    filtro.frequency.value = c.freq
    filtro.Q.value = c.q
    const ganho = ctx.createGain()
    ganho.gain.value = c.ganho
    const pan = ctx.createStereoPanner()
    pan.pan.value = c.pan
    fonte.connect(filtro).connect(ganho).connect(pan).connect(vento)
    return { fonte, filtro, freq: c.freq, inicio: c.inicio }
  })

  // Rugido do fogo (só nas chamas): grave abafado com um meio que respira.
  const rugido = ctx.createGain()
  rugido.gain.value = 0
  rugido.connect(geral)
  const fontesDoRugido: AudioBufferSourceNode[] = []
  if (chamas) {
    for (const c of [
      { tipo: 'lowpass' as BiquadFilterType, freq: 170, q: 0.8, ganho: 1, inicio: 0.3 },
      { tipo: 'bandpass' as BiquadFilterType, freq: 420, q: 0.8, ganho: 0.45, inicio: 0.9 },
    ]) {
      const fonte = ctx.createBufferSource()
      fonte.buffer = ruido
      fonte.loop = true
      const filtro = ctx.createBiquadFilter()
      filtro.type = c.tipo
      filtro.frequency.value = c.freq
      filtro.Q.value = c.q
      const ganho = ctx.createGain()
      ganho.gain.value = c.ganho
      fonte.connect(filtro).connect(ganho).connect(rugido)
      fontesDoRugido.push(fonte)
    }
  }
  const estalos = chamas ? estalosDoFogo() : []
  const graos = Array.from({ length: PASSOS + 1 }, (_, k) => passoNaTerra(ctx, k))
  const corvos = chamas ? [] : [{ em: 2.2, pan: -0.6 }, { em: 2.62, pan: -0.6 }, { em: 4.45, pan: 0.5 }]

  function tocarPasso(at: number, k: number) {
    const pan = ctx.createStereoPanner()
    pan.pan.value = k % 2 === 0 ? -0.1 : 0.1
    pan.connect(geral)
    const fonte = ctx.createBufferSource()
    fonte.buffer = graos[k]
    const banda = ctx.createBiquadFilter()
    banda.type = 'bandpass'
    banda.frequency.value = 1300 + (k % 3) * 150
    banda.Q.value = 0.6
    const abafar = ctx.createBiquadFilter()
    abafar.type = 'lowpass'
    abafar.frequency.value = 3800
    const volume = ctx.createGain()
    volume.gain.value = PASSO
    fonte.connect(banda).connect(abafar).connect(volume).connect(pan)
    fonte.start(at)
    // Baque surdo do calcanhar na terra.
    const baque = ctx.createOscillator()
    baque.type = 'sine'
    baque.frequency.setValueAtTime(90, at)
    baque.frequency.exponentialRampToValueAtTime(48, at + 0.1)
    const corpo = ctx.createGain()
    corpo.gain.setValueAtTime(0.0001, at)
    corpo.gain.exponentialRampToValueAtTime(0.22, at + 0.01)
    corpo.gain.exponentialRampToValueAtTime(0.0001, at + 0.15)
    baque.connect(corpo).connect(pan)
    baque.start(at)
    baque.stop(at + 0.17)
  }

  function tocarCorvo(at: number, lado: number) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(600, at)
    o.frequency.linearRampToValueAtTime(520, at + 0.08)
    o.frequency.exponentialRampToValueAtTime(410, at + 0.3)
    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.frequency.value = 1150
    f1.Q.value = 2.5
    const f2 = ctx.createBiquadFilter()
    f2.type = 'bandpass'
    f2.frequency.value = 2300
    f2.Q.value = 3.5
    const g2 = ctx.createGain()
    g2.gain.value = 0.6
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(CORVO, at + 0.025)
    env.gain.exponentialRampToValueAtTime(CORVO * 0.75, at + 0.2)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)
    const longe = ctx.createBiquadFilter()
    longe.type = 'lowpass'
    longe.frequency.value = 2800
    const pan = ctx.createStereoPanner()
    pan.pan.value = lado
    o.connect(f1).connect(env)
    o.connect(f2).connect(g2).connect(env)
    env.connect(longe).connect(pan).connect(geral)
    o.start(at)
    o.stop(at + 0.36)
  }

  function tocarEstalo(at: number, e: Estalo) {
    const fonte = ctx.createBufferSource()
    fonte.buffer = ruido
    const filtro = ctx.createBiquadFilter()
    filtro.type = e.grande ? 'bandpass' : 'highpass'
    filtro.frequency.value = e.freq
    filtro.Q.value = e.grande ? 1.2 : 0.7
    const env = ctx.createGain()
    env.gain.setValueAtTime(ESTALO * e.amp, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + e.dur)
    const pan = ctx.createStereoPanner()
    pan.pan.value = e.pan
    fonte.connect(filtro).connect(env).connect(pan).connect(geral)
    fonte.start(at, e.deslocamento, e.dur + 0.01)
    if (!e.grande) return
    // Pipoco: um tum grave por baixo do estalo.
    const tum = ctx.createOscillator()
    tum.type = 'sine'
    tum.frequency.setValueAtTime(140, at)
    tum.frequency.exponentialRampToValueAtTime(55, at + 0.08)
    const corpo = ctx.createGain()
    corpo.gain.setValueAtTime(0.0001, at)
    corpo.gain.exponentialRampToValueAtTime(0.16 * e.amp, at + 0.006)
    corpo.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
    tum.connect(corpo).connect(pan)
    tum.start(at)
    tum.stop(at + 0.12)
  }

  /** Corre o parâmetro para o alvo só quando o alvo muda (arredondado): poucas automações por segundo. */
  const ultimos = new Map<AudioParam, number>()
  function levar(param: AudioParam, alvo: number, constante: number, casas = 1000) {
    const a = Math.round(alvo * casas) / casas
    if (ultimos.get(param) === a) return
    ultimos.set(param, a)
    param.setTargetAtTime(a, ctx.currentTime, constante)
  }

  let ligado = false
  let ultimoPasso = 0
  let proximoEstalo = 0
  let proximoCorvo = 0
  return {
    atualizar(t: number) {
      if (!ligado) {
        ligado = true
        const agora = ctx.currentTime
        for (const c of camadas) c.fonte.start(agora, c.inicio)
        fontesDoRugido.forEach((f, i) => f.start(agora, 0.3 + i * 0.6))
      }
      levar(geral.gain, envelopeGeralEm(t), 0.04)
      const rajada = rajadaEm(t)
      levar(vento.gain, VENTO * (0.4 + 0.6 * rajada), 0.18)
      for (const c of camadas) levar(c.filtro.frequency, c.freq * (0.8 + 0.45 * rajada), 0.25, 1)
      if (chamas) levar(rugido.gain, RUGIDO * fogoEm(t) * (0.8 + 0.2 * tremorEm(t, 0.7, false)), 0.12)

      const k = passoEm(t)
      if (k > ultimoPasso && k >= 1 && k <= PASSOS) {
        ultimoPasso = k
        tocarPasso(ctx.currentTime, k)
      }
      while (proximoEstalo < estalos.length && t >= estalos[proximoEstalo].em) tocarEstalo(ctx.currentTime, estalos[proximoEstalo++])
      while (proximoCorvo < corvos.length && t >= corvos[proximoCorvo].em) tocarCorvo(ctx.currentTime, corvos[proximoCorvo++].pan)
    },
    reiniciar: () => {
      ultimoPasso = 0
      proximoEstalo = 0
      proximoCorvo = 0
      ultimos.clear()
    },
  }
}
