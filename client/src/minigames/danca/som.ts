/**
 * SOM DA DANÇA: a faixa demo "Gingado do Salão Fundo" (sintetizada em cada
 * aparelho, igual em todos) e os sons curtos de acerto, erro e metrônomo.
 * Porte fiel do bloco SOM do protótipo; todo nó recebe o contexto e o destino
 * por parâmetro, nada fica guardado entre chamadas além do ruído por contexto.
 */

export const BPM_DEMO = 116
/** Uma semicolcheia da demo, em s. */
export const PASSO_DEMO = 60 / BPM_DEMO / 4
export const COMPASSO_DEMO = PASSO_DEMO * 16
/** Compasso do acorde final. */
export const ULTIMO_COMPASSO_DEMO = 21
export const DURACAO_DEMO = ULTIMO_COMPASSO_DEMO * COMPASSO_DEMO + 2.2
/** Ganho da faixa no render; os sons do jogo saem com o dobro (`GANHO_EFEITOS`). */
export const GANHO_FAIXA = 0.42
export const GANHO_EFEITOS = GANHO_FAIXA * 2

export type InstrumentoSimples = 'baqueta' | 'bumbo' | 'caixa' | 'palma' | 'prato'
export type Instrumento = InstrumentoSimples | 'chimbal' | 'baixo' | 'melodia' | 'batida' | 'tapete'

interface BaseDoEvento {
  /** Instante na faixa, em s. */
  t: number
  /** Compasso (0 = contagem) e semicolcheia dentro dele (0-15). */
  c: number
  p: number
  /** Intensidade, 0-1. */
  v: number
}

/** Um ataque da faixa demo. A coreografia da demo nasce destes mesmos ataques. */
export type EventoDaFaixa =
  | (BaseDoEvento & { inst: InstrumentoSimples })
  | (BaseDoEvento & { inst: 'chimbal'; aberto: boolean })
  | (BaseDoEvento & { inst: 'baixo' | 'melodia'; midi: number; dur: number })
  | (BaseDoEvento & { inst: 'batida'; notas: readonly number[] })
  | (BaseDoEvento & { inst: 'tapete'; notas: readonly number[]; dur: number })

export type SecaoDaDemo = 'contagem' | 'entrada' | 'balanco' | 'pausa' | 'final' | 'fim'

/** Seções: 0 contagem · 1-4 entrada · 5-12 balanço com tema · 13-16 pausa com notas longas · 17-20 final · 21 acorde. */
export function secaoDoCompasso(c: number): SecaoDaDemo {
  if (c === 0) return 'contagem'
  if (c <= 4) return 'entrada'
  if (c <= 12) return 'balanco'
  if (c <= 16) return 'pausa'
  if (c <= 20) return 'final'
  return 'fim'
}

// Mi dórico: Em7 e A se alternando, riff de baixo de dois compassos e um tema pentatônico.
// Cada nota é [semicolcheia, midi, duração em semicolcheias].
type NotaDoTema = readonly [number, number, number]
const RIFF_A: readonly NotaDoTema[] = [[0, 40, 3], [3, 52, 1], [6, 43, 2], [8, 45, 2], [11, 47, 2], [14, 50, 2]]
const RIFF_B: readonly NotaDoTema[] = [[0, 40, 3], [3, 52, 1], [6, 43, 2], [8, 47, 2], [10, 45, 2], [12, 43, 2], [14, 40, 2]]
const FRASE_1: readonly NotaDoTema[] = [
  [0, 64, 2], [2, 67, 2], [4, 69, 3], [7, 71, 1], [8, 69, 2], [10, 67, 2], [12, 64, 4],
  [16, 62, 2], [18, 64, 2], [20, 67, 4], [24, 69, 2], [26, 67, 2], [28, 64, 4],
]
const FRASE_2: readonly NotaDoTema[] = [
  [0, 71, 2], [2, 74, 2], [4, 71, 2], [6, 69, 2], [8, 67, 4], [12, 69, 2], [14, 71, 2],
  [16, 76, 4], [20, 74, 2], [22, 71, 2], [24, 69, 3], [27, 67, 1], [28, 64, 4],
]
const EM7: readonly number[] = [52, 55, 59, 62]
const LA: readonly number[] = [57, 61, 64]
const SOL: readonly number[] = [55, 59, 62]
const RE: readonly number[] = [50, 54, 57]

/** Pausa (compassos 13-16): notas longas do baixo e o acorde do tapete de cada compasso. */
const PAUSA: readonly { longas: readonly NotaDoTema[]; acorde: readonly number[]; duracao: number }[] = [
  { longas: [[0, 40, 8], [8, 43, 8]], acorde: EM7, duracao: 16 },
  { longas: [[0, 45, 16]], acorde: LA, duracao: 16 },
  { longas: [[0, 43, 8], [8, 47, 8]], acorde: SOL, duracao: 16 },
  { longas: [[0, 50, 8]], acorde: RE, duracao: 8 },
]
const PRIMEIRO_COMPASSO_DA_PAUSA = 13

/** Todos os ataques da faixa demo, em ordem de tempo. Determinístico: é a mesma lista em qualquer aparelho. */
export function eventosDaDemo(): EventoDaFaixa[] {
  const ev: EventoDaFaixa[] = []
  const base = (c: number, p: number, v: number): BaseDoEvento => ({ t: (c * 16 + p) * PASSO_DEMO, c, p, v })
  const simples = (c: number, p: number, inst: InstrumentoSimples, v: number): void => {
    ev.push({ ...base(c, p, v), inst })
  }
  for (let b = 0; b < 4; b += 1) simples(0, b * 4, 'baqueta', b === 0 ? 0.9 : 0.6)
  for (let c = 1; c <= 20; c += 1) {
    const secao = secaoDoCompasso(c)
    const par = c % 2 === 0
    if (secao === 'pausa') {
      const pausa = PAUSA[c - PRIMEIRO_COMPASSO_DA_PAUSA]
      simples(c, 0, 'bumbo', 0.9)
      simples(c, 4, 'palma', 0.8)
      simples(c, 12, 'palma', 0.8)
      for (const p of [2, 6, 10, 14]) ev.push({ ...base(c, p, 0.5), inst: 'chimbal', aberto: true })
      for (const [p, m, d] of pausa.longas) ev.push({ ...base(c, p, 0.85), inst: 'baixo', midi: m, dur: d * PASSO_DEMO * 0.96 })
      ev.push({ ...base(c, 0, 0.8), inst: 'tapete', notas: pausa.acorde, dur: pausa.duracao * PASSO_DEMO })
      if (c === 16) for (let p = 8; p < 16; p += 1) simples(c, p, 'caixa', 0.35 + 0.06 * (p - 8))
      continue
    }
    for (const p of secao === 'entrada' ? [0, 8] : [0, 7, 8, 10]) simples(c, p, 'bumbo', p === 0 ? 1 : 0.85)
    simples(c, 4, 'caixa', 0.9)
    simples(c, 12, 'caixa', 0.9)
    if (secao !== 'entrada') simples(c, 14, 'caixa', 0.22)
    if (secao === 'final') {
      simples(c, 4, 'palma', 0.6)
      simples(c, 12, 'palma', 0.6)
    }
    for (let p = 0; p < 16; p += secao === 'entrada' ? 2 : 1) {
      const v = p % 4 === 0 ? 0.6 : p % 2 === 0 ? 0.42 : 0.22
      ev.push({ ...base(c, p, v), inst: 'chimbal', aberto: p === 14 && !par && secao !== 'entrada' })
    }
    if (c === 5 || c === 9 || c === 17) simples(c, 0, 'prato', 0.8)
    for (const [p, m, d] of par ? RIFF_B : RIFF_A) ev.push({ ...base(c, p, 0.8), inst: 'baixo', midi: m, dur: d * PASSO_DEMO * 0.92 })
    if (c >= 3) for (const p of [2, 6, 10, 14]) ev.push({ ...base(c, p, 0.55), inst: 'batida', notas: par ? LA : EM7 })
    if (secao !== 'entrada') {
      const frase = (c >= 9 && c <= 12) || c >= 19 ? FRASE_2 : FRASE_1
      const metade = (c - 1) % 2
      for (const [p, m, d] of frase) {
        if (Math.floor(p / 16) === metade) ev.push({ ...base(c, p % 16, 0.8), inst: 'melodia', midi: m, dur: d * PASSO_DEMO * 0.95 })
      }
    }
  }
  const u = ULTIMO_COMPASSO_DEMO
  simples(u, 0, 'bumbo', 1)
  simples(u, 0, 'prato', 1)
  ev.push({ ...base(u, 0, 0.9), inst: 'batida', notas: EM7 })
  ev.push({ ...base(u, 0, 0.9), inst: 'baixo', midi: 40, dur: 1.3 })
  ev.push({ ...base(u, 0, 0.9), inst: 'tapete', notas: EM7, dur: 1.6 })
  ev.push({ ...base(u, 0, 0.8), inst: 'melodia', midi: 76, dur: 1.2 })
  return ev.sort((a, b) => a.t - b.t)
}

// ------------------------------------------------------------------ nós

const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
/** Rampa exponencial não aceita 0: "silêncio" é um ganho desprezível. */
const QUASE_ZERO = 0.0001
/** Semente do xorshift do ruído: o mesmo chiado em todo aparelho. */
const SEMENTE_DO_RUIDO = 0x2545f491
/** Passo pelo buffer de ruído: cada ataque lê um trecho diferente, até 0,7 s. */
const PASSO_NO_RUIDO = 0.173
const TRECHO_DO_RUIDO = 0.7

/** Ruído de 1 s por contexto e o ponto de leitura: por contexto, para dois renders saírem iguais. */
const ruidoPorContexto = new WeakMap<BaseAudioContext, { buffer: AudioBuffer; giro: number }>()

function ruidoDe(ctx: BaseAudioContext): { buffer: AudioBuffer; giro: number } {
  const pronto = ruidoPorContexto.get(ctx)
  if (pronto !== undefined) return pronto
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = buffer.getChannelData(0)
  let s = SEMENTE_DO_RUIDO
  for (let i = 0; i < d.length; i += 1) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    d[i] = ((s >>> 0) / 4294967296) * 2 - 1
  }
  const novo = { buffer, giro: 0 }
  ruidoPorContexto.set(ctx, novo)
  return novo
}

function envelope(p: AudioParam, t: number, pico: number, ataque: number, queda: number): void {
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(pico, t + ataque)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + ataque + queda)
}

function fonteRuido(ctx: BaseAudioContext, t: number, dur: number): AudioBufferSourceNode {
  const ruido = ruidoDe(ctx)
  const n = ctx.createBufferSource()
  n.buffer = ruido.buffer
  n.loop = true
  ruido.giro = (ruido.giro + PASSO_NO_RUIDO) % TRECHO_DO_RUIDO
  n.start(t, ruido.giro)
  n.stop(t + dur)
  return n
}

function filtro(ctx: BaseAudioContext, tipo: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ctx.createBiquadFilter()
  b.type = tipo
  b.frequency.value = f
  b.Q.value = q
  return b
}

function osc(ctx: BaseAudioContext, tipo: OscillatorType, f: number): OscillatorNode {
  const o = ctx.createOscillator()
  o.type = tipo
  o.frequency.value = f
  return o
}

/**
 * Ganho que nasce em 0. O padrão do GainNode é 1: quando o início cai bem numa
 * amostra, o som passava 1 amostra cheia antes do envelope valer, e isso era o
 * estalo de 7,5 s da faixa demo.
 */
export function vca(ctx: BaseAudioContext): GainNode {
  const g = ctx.createGain()
  g.gain.value = 0
  return g
}

// ------------------------------------------------------------------ instrumentos

function bumbo(ctx: BaseAudioContext, out: AudioNode, t: number, v: number): void {
  const o = osc(ctx, 'sine', 150)
  const g = vca(ctx)
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(46, t + 0.12)
  envelope(g.gain, t, 0.9 * v, 0.003, 0.36)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.42)
  const n = fonteRuido(ctx, t, 0.03)
  const f = filtro(ctx, 'lowpass', 2600)
  const gn = vca(ctx)
  envelope(gn.gain, t, 0.2 * v, 0.001, 0.016)
  n.connect(f).connect(gn).connect(out)
}

function caixa(ctx: BaseAudioContext, out: AudioNode, t: number, v: number): void {
  const n = fonteRuido(ctx, t, 0.22)
  const f = filtro(ctx, 'highpass', 1100)
  const g = vca(ctx)
  envelope(g.gain, t, 0.42 * v, 0.002, 0.16)
  n.connect(f).connect(g).connect(out)
  const o = osc(ctx, 'triangle', 196)
  const go = vca(ctx)
  o.frequency.setValueAtTime(196, t)
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08)
  envelope(go.gain, t, 0.34 * v, 0.002, 0.08)
  o.connect(go).connect(out)
  o.start(t)
  o.stop(t + 0.12)
}

function palma(ctx: BaseAudioContext, out: AudioNode, t: number, v: number): void {
  const n = fonteRuido(ctx, t, 0.24)
  const f = filtro(ctx, 'bandpass', 1450, 1.3)
  const g = vca(ctx)
  const p = g.gain
  p.setValueAtTime(QUASE_ZERO, t)
  // Três estalos de mão quase juntos e a cauda: é o que faz soar palma, não ruído.
  for (let i = 0; i < 3; i += 1) {
    const ti = t + i * 0.011
    p.exponentialRampToValueAtTime(0.5 * v, ti + 0.001)
    p.exponentialRampToValueAtTime(0.06 * v, ti + 0.009)
  }
  p.exponentialRampToValueAtTime(0.32 * v, t + 0.035)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + 0.2)
  n.connect(f).connect(g).connect(out)
}

function chimbal(ctx: BaseAudioContext, out: AudioNode, t: number, v: number, aberto: boolean): void {
  const d = aberto ? 0.24 : 0.04
  const n = fonteRuido(ctx, t, d + 0.05)
  const f = filtro(ctx, 'highpass', 7200)
  const g = vca(ctx)
  envelope(g.gain, t, 0.15 * v, 0.001, d)
  n.connect(f).connect(g).connect(out)
}

function prato(ctx: BaseAudioContext, out: AudioNode, t: number, v: number): void {
  const n = fonteRuido(ctx, t, 1.9)
  const f = filtro(ctx, 'highpass', 3800)
  const g = vca(ctx)
  envelope(g.gain, t, 0.13 * v, 0.002, 1.7)
  n.connect(f).connect(g).connect(out)
}

/** Parciais da baqueta da contagem: [Hz, pico]. */
const PARCIAIS_DA_BAQUETA: readonly (readonly [number, number])[] = [[1850, 0.3], [2750, 0.12]]

function baqueta(ctx: BaseAudioContext, out: AudioNode, t: number, v: number): void {
  for (const [f, a] of PARCIAIS_DA_BAQUETA) {
    const o = osc(ctx, 'sine', f)
    const g = vca(ctx)
    envelope(g.gain, t, a * v, 0.001, 0.06)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + 0.08)
  }
}

function baixo(ctx: BaseAudioContext, out: AudioNode, t: number, v: number, midi: number, duracao: number): void {
  const f0 = mtof(midi)
  const dur = Math.max(0.1, duracao)
  const o = osc(ctx, 'sawtooth', f0)
  const s = osc(ctx, 'sine', f0)
  const lp = filtro(ctx, 'lowpass', 1500, 5)
  lp.frequency.setValueAtTime(1500, t)
  lp.frequency.exponentialRampToValueAtTime(320, t + 0.14)
  const g = vca(ctx)
  const p = g.gain
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(0.3 * v, t + 0.005)
  p.exponentialRampToValueAtTime(0.2 * v, t + 0.1)
  p.setValueAtTime(0.2 * v, t + dur)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + dur + 0.05)
  const gs = vca(ctx)
  gs.gain.value = 0.9
  o.connect(lp)
  s.connect(gs).connect(lp)
  lp.connect(g).connect(out)
  const fim = t + dur + 0.07
  o.start(t)
  s.start(t)
  o.stop(fim)
  s.stop(fim)
}

function batida(ctx: BaseAudioContext, out: AudioNode, t: number, v: number, notas: readonly number[]): void {
  const f = filtro(ctx, 'bandpass', 1700, 0.8)
  const g = vca(ctx)
  f.frequency.setValueAtTime(900, t)
  f.frequency.exponentialRampToValueAtTime(2300, t + 0.05)
  envelope(g.gain, t, 0.07 * v, 0.002, 0.11)
  f.connect(g).connect(out)
  for (const m of notas) {
    const o = osc(ctx, 'square', mtof(m))
    o.detune.value = ((m % 3) - 1) * 6
    o.connect(f)
    o.start(t)
    o.stop(t + 0.14)
  }
}

function melodia(ctx: BaseAudioContext, out: AudioNode, t: number, v: number, midi: number, dur: number): void {
  const f0 = mtof(midi)
  const o = osc(ctx, 'square', f0)
  const tri = osc(ctx, 'triangle', f0 * 2)
  const vib = osc(ctx, 'sine', 5.5)
  const gv = vca(ctx)
  gv.gain.setValueAtTime(0, t)
  gv.gain.linearRampToValueAtTime(7, t + Math.min(0.25, dur))
  vib.connect(gv)
  gv.connect(o.detune)
  gv.connect(tri.detune)
  const lp = filtro(ctx, 'lowpass', 2600, 0.6)
  const g = vca(ctx)
  const p = g.gain
  const gt = vca(ctx)
  gt.gain.value = 0.35
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(0.085 * v, t + 0.01)
  p.setValueAtTime(0.085 * v, t + dur)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + dur + 0.08)
  o.connect(lp)
  tri.connect(gt).connect(lp)
  lp.connect(g).connect(out)
  const fim = t + dur + 0.1
  for (const x of [o, tri, vib]) {
    x.start(t)
    x.stop(fim)
  }
}

function tapete(ctx: BaseAudioContext, out: AudioNode, t: number, v: number, notas: readonly number[], dur: number): void {
  const lp = filtro(ctx, 'lowpass', 1100, 0.5)
  const g = vca(ctx)
  const p = g.gain
  p.setValueAtTime(QUASE_ZERO, t)
  p.exponentialRampToValueAtTime(0.045 * v, t + 0.3)
  p.setValueAtTime(0.045 * v, t + dur)
  p.exponentialRampToValueAtTime(QUASE_ZERO, t + dur + 0.45)
  lp.connect(g).connect(out)
  for (const m of notas) {
    for (const d of [-8, 8]) {
      const o = osc(ctx, 'sawtooth', mtof(m))
      o.detune.value = d
      o.connect(lp)
      o.start(t)
      o.stop(t + dur + 0.5)
    }
  }
}

/** Toca um ataque da faixa no instante `t` (tempo do contexto). */
export function tocarEvento(ctx: BaseAudioContext, out: AudioNode, t: number, e: EventoDaFaixa): void {
  switch (e.inst) {
    case 'bumbo': return bumbo(ctx, out, t, e.v)
    case 'caixa': return caixa(ctx, out, t, e.v)
    case 'palma': return palma(ctx, out, t, e.v)
    case 'prato': return prato(ctx, out, t, e.v)
    case 'baqueta': return baqueta(ctx, out, t, e.v)
    case 'chimbal': return chimbal(ctx, out, t, e.v, e.aberto)
    case 'baixo': return baixo(ctx, out, t, e.v, e.midi, e.dur)
    case 'melodia': return melodia(ctx, out, t, e.v, e.midi, e.dur)
    case 'batida': return batida(ctx, out, t, e.v, e.notas)
    case 'tapete': return tapete(ctx, out, t, e.v, e.notas, e.dur)
  }
}

/** Abertura no estéreo de cada instrumento; o que não está aqui sai no centro. */
const PAN: Partial<Record<Instrumento, number>> = { chimbal: 0.3, batida: -0.25, melodia: 0.12, prato: -0.15, palma: 0.08 }

/**
 * A saída de cada instrumento em `destino`, com a abertura no estéreo dele
 * (um panorama por instrumento, criado na primeira vez). O agendador ao vivo
 * da tela (`tela/agendadorDaFaixa.ts`) usa a mesma, para soar igual ao render.
 */
export function saidasDaFaixa(ctx: BaseAudioContext, destino: AudioNode): (inst: Instrumento) => AudioNode {
  const bus = new Map<Instrumento, AudioNode>()
  return (inst) => {
    const pronta = bus.get(inst)
    if (pronta !== undefined) return pronta
    const pan = PAN[inst]
    // Safari antigo não tem StereoPanner: aí tudo sai no centro.
    const nova = pan !== undefined && typeof ctx.createStereoPanner === 'function' ? panorama(ctx, destino, pan) : destino
    bus.set(inst, nova)
    return nova
  }
}

/** Agenda a lista inteira a partir de `t0` (tempo do contexto). */
export function agendarEventos(ctx: BaseAudioContext, destino: AudioNode, lista: readonly EventoDaFaixa[], t0: number): void {
  const saidaDe = saidasDaFaixa(ctx, destino)
  for (const e of lista) tocarEvento(ctx, saidaDe(e.inst), t0 + e.t, e)
}

function panorama(ctx: BaseAudioContext, destino: AudioNode, pan: number): StereoPannerNode {
  const p = ctx.createStereoPanner()
  p.pan.value = pan
  p.connect(destino)
  return p
}

/** Fábrica do contexto offline: o padrão é o do navegador; o teste pode trocar. */
export type CriarContextoOffline = (canais: number, quadros: number, taxa: number) => OfflineAudioContext

const contextoOfflineDoNavegador: CriarContextoOffline = (canais, quadros, taxa) => new OfflineAudioContext(canais, quadros, taxa)

/**
 * Renderiza a faixa demo inteira, em estéreo. Caro: 23 s no Edge sem janela
 * (12/10/2026; o bloco do protótipo, 33 s). Comece cedo, em segundo plano, e
 * guarde o buffer. Dois renders saem iguais (o ruído é por contexto).
 */
export function renderizarDemo(taxa = 48000, criar: CriarContextoOffline = contextoOfflineDoNavegador): Promise<AudioBuffer> {
  const off = criar(2, Math.ceil(taxa * DURACAO_DEMO), taxa)
  const g = off.createGain()
  g.gain.value = GANHO_FAIXA
  g.connect(off.destination)
  agendarEventos(off, g, eventosDaDemo(), 0)
  return off.startRendering()
}

// ------------------------------------------------------------------ sons do jogo

/** "Toc" curto de madeira no acerto. Baixo de propósito: não pode cobrir a música. */
export function somDeAcerto(ctx: BaseAudioContext, out: AudioNode, t: number, forte: boolean): void {
  const o = osc(ctx, 'sine', forte ? 1568 : 1319)
  const g = vca(ctx)
  envelope(g.gain, t, 0.16, 0.001, 0.05)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.07)
}

/** "Tum" abafado no erro; na Diversão (`gentil`) sai mais baixo. */
export function somDeErro(ctx: BaseAudioContext, out: AudioNode, t: number, gentil: boolean): void {
  const o = osc(ctx, 'triangle', 170)
  const lp = filtro(ctx, 'lowpass', 700)
  const g = vca(ctx)
  o.frequency.setValueAtTime(170, t)
  o.frequency.exponentialRampToValueAtTime(85, t + 0.13)
  envelope(g.gain, t, gentil ? 0.1 : 0.18, 0.004, 0.14)
  o.connect(lp).connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.18)
}

/** Clique do metrônomo (ajuste de atraso, conferir o tempo da música); `forte` marca o começo do compasso. */
export function somDeClique(ctx: BaseAudioContext, out: AudioNode, t: number, forte: boolean): void {
  const o = osc(ctx, 'sine', forte ? 1760 : 1175)
  const g = vca(ctx)
  envelope(g.gain, t, forte ? 0.3 : 0.2, 0.001, 0.05)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + 0.07)
}
