import type { BufferDeSom, ContextoDeSom, SaidaDeSom } from '../lib/sons/contexto'
import { obterSaidaDeSom } from '../lib/sons/contexto'
import { estaCalado, useSomStore, type PreferenciaDeSom } from '../stores/somStore'
import type { SomDaAnimacaoDePorta } from './animacoesDePorta'
import type { CurvaBezier } from './curvaBezier'
import { agendarSomDaPortaDoPacote, somDoPacote } from './somDasPortasDoPacote'

/**
 * SOM DA PORTA (fatia 22): rangido de abrir, rangido curto de fechar, trinco e
 * tranca, sintetizados em Web Audio na hora, sem arquivo (e os das cinco
 * animações do pacote, em `somDasPortasDoPacote.ts`). Modelo dos sons da
 * pesca (`minigames/pesca/som.ts`): cada som é uma função que recebe o
 * contexto, o destino e o instante, então o MESMO código toca no app (o
 * contexto único do primeiro gesto, `lib/sons/contexto.ts`) e nas provas (um
 * `OfflineAudioContext`, de onde sai o `.wav` entregue).
 *
 * Volume baixo de propósito: porta é som de interface, ouvido dezenas de vezes
 * por sessão. Meta das provas (`docs/design/porta-som/`): -36 a -26 LUFS e pico
 * verdadeiro até -12 dBTP no volume máximo da mesa.
 */

/**
 * O que toca e quando. `duracaoMs` é o tempo do caminho que a porta vai andar
 * (o que falta, se inverteu no meio); `de` é de onde ela parte (0 = fechada, 1
 * = aberta) e `curva` a do sentido: os sons do pacote marcam pontos do desenho
 * e precisam dos dois. Ausentes = caminho inteiro, na curva de sempre.
 */
export type EventoDeSomDaPorta =
  | { tipo: 'abrir' | 'fechar'; som: SomDaAnimacaoDePorta; duracaoMs: number; de?: number; curva?: CurvaBezier }
  | { tipo: 'trancar' | 'destrancar' }

/**
 * Ganho final da porta, calibrado pela medida das provas: de -38 a -34 LUFS no
 * volume máximo, abaixo dos sons de jogo (docs/design/porta-som/provas/testes.json).
 */
export const GANHO_DA_PORTA = 0.5
/**
 * Onde a folha ASSENTA ao fechar, em fração do tempo: a curva de saída
 * (`easeOutCubic`) chega a 98% do caminho aos 73% do tempo, e é aí que o olho
 * vê a porta bater. O trinco do fechar cai neste ponto, não no fim do relógio.
 */
export const FRACAO_EM_QUE_ASSENTA = 0.75
/** Caminho curto demais (inverteu quase no fim) não tem rangido: só o trinco. */
const RANGIDO_MIN_S = 0.06
/** Folga entre o comando e o som: voz agendada no instante exato pode perder o começo do envelope. */
const ANTECEDENCIA_S = 0.01
/**
 * Intervalo mínimo entre dois toques do MESMO tipo, em ms: uma alavanca que
 * abre cinco portas no mesmo quadro é um rangido, não cinco. Inverter (abrir
 * e logo fechar) é outro tipo e toca.
 */
export const INTERVALO_MINIMO_DA_PORTA_MS = 250

const SEGUNDOS_DE_RUIDO = 1
const SEMENTE_DO_RUIDO = 0x2545f491
const SEMENTE_DO_RANGIDO = 0x9e3779b9
const PONTOS_DA_ENVOLTORIA = 96

const ruidoPorContexto = new WeakMap<object, BufferDeSom>()

/** Sorteio com semente (xorshift): o mesmo som a cada toque, e o `.wav` da prova é o que toca. */
function sorteador(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function bufferDeRuido<N>(ctx: ContextoDeSom<N>): BufferDeSom {
  const pronto = ruidoPorContexto.get(ctx)
  if (pronto !== undefined) return pronto
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * SEGUNDOS_DE_RUIDO), ctx.sampleRate)
  const amostras = buffer.getChannelData(0)
  const sorte = sorteador(SEMENTE_DO_RUIDO)
  for (let i = 0; i < amostras.length; i += 1) amostras[i] = sorte() * 2 - 1
  ruidoPorContexto.set(ctx, buffer)
  return buffer
}

/**
 * Envoltória de `dur` s: sobe em `ataque`, cai exponencial e fecha num
 * cosseno nos últimos 20%, começando e terminando EXATAMENTE em zero (sem
 * degrau, então sem clique nem corte).
 */
function envoltoria(pico: number, dur: number, ataque: number): Float32Array {
  const curva = new Float32Array(PONTOS_DA_ENVOLTORIA)
  const tau = Math.max(0.004, (dur - ataque) / 3.2)
  for (let i = 0; i < PONTOS_DA_ENVOLTORIA; i += 1) {
    const fracao = i / (PONTOS_DA_ENVOLTORIA - 1)
    const x = fracao * dur
    const subida = x < ataque ? x / ataque : Math.exp(-(x - ataque) / tau)
    const fecho = fracao > 0.8 ? Math.cos(((fracao - 0.8) / 0.2) * (Math.PI / 2)) : 1
    curva[i] = pico * subida * fecho
  }
  curva[0] = 0
  curva[PONTOS_DA_ENVOLTORIA - 1] = 0
  return curva
}

/** Envoltória que sobe devagar e segura (o rangido "arrasta"), fechando em zero do mesmo jeito. */
function envoltoriaArrastada(pico: number, dur: number, ataque: number): Float32Array {
  const curva = new Float32Array(PONTOS_DA_ENVOLTORIA)
  for (let i = 0; i < PONTOS_DA_ENVOLTORIA; i += 1) {
    const fracao = i / (PONTOS_DA_ENVOLTORIA - 1)
    const x = fracao * dur
    const subida = x < ataque ? Math.sin((x / ataque) * (Math.PI / 2)) : 1
    const queda = fracao > 0.55 ? Math.cos(((fracao - 0.55) / 0.45) * (Math.PI / 2)) : 1
    curva[i] = pico * subida * queda
  }
  curva[0] = 0
  curva[PONTOS_DA_ENVOLTORIA - 1] = 0
  return curva
}

/** Ganho que fica em 0 até a envoltória começar: o padrão do GainNode é 1. */
function envelope<N>(ctx: ContextoDeSom<N>, destino: N, t: number, curva: Float32Array, dur: number) {
  const ganho = ctx.createGain()
  ganho.gain.setValueAtTime(0, Math.max(0, t - 0.002))
  ganho.gain.setValueCurveAtTime(curva, t, dur)
  ganho.connect(destino)
  return ganho
}

interface Rajada {
  dur: number
  tipo: BiquadFilterType
  hz: number
  hzFim?: number
  q: number
  pico: number
  ataque: number
}

/** Ruído filtrado com envoltória: o estalo da lingueta, o raspar do ferrolho. */
function rajada<N>(ctx: ContextoDeSom<N>, destino: N, t: number, r: Rajada, deslocamento: number): void {
  const fonte = ctx.createBufferSource()
  fonte.buffer = bufferDeRuido(ctx)
  const filtro = ctx.createBiquadFilter()
  filtro.type = r.tipo
  filtro.frequency.setValueAtTime(r.hz, t)
  if (r.hzFim !== undefined) filtro.frequency.exponentialRampToValueAtTime(r.hzFim, t + r.dur)
  filtro.Q.setValueAtTime(r.q, t)
  fonte.connect(filtro)
  filtro.connect(envelope(ctx, destino, t, envoltoria(r.pico, r.dur, r.ataque), r.dur))
  fonte.start(t, deslocamento % (SEGUNDOS_DE_RUIDO - r.dur - 0.02))
  fonte.stop(t + r.dur + 0.01)
}

interface Tom {
  dur: number
  forma: OscillatorType
  hz: number
  hzFim?: number
  pico: number
  ataque: number
}

/** Tom curto com queda de altura: o baque da folha, o anel do metal. */
function tom<N>(ctx: ContextoDeSom<N>, destino: N, t: number, o: Tom): void {
  const oscilador = ctx.createOscillator()
  oscilador.type = o.forma
  oscilador.frequency.setValueAtTime(o.hz, t)
  if (o.hzFim !== undefined) oscilador.frequency.exponentialRampToValueAtTime(o.hzFim, t + o.dur)
  oscilador.connect(envelope(ctx, destino, t, envoltoria(o.pico, o.dur, o.ataque), o.dur))
  oscilador.start(t)
  oscilador.stop(t + o.dur + 0.01)
}

/**
 * TRINCO: a lingueta que solta (abrindo) ou entra no batente (fechando). Dois
 * estalos de ruído com um anel curto de metal; fechando, a folha bate antes:
 * um baque grave e abafado por baixo.
 */
export function trinco<N>(ctx: ContextoDeSom<N>, destino: N, t: number, fechando: boolean): void {
  // Fechando, o baque e o estalo somam no mesmo instante: cada um mais baixo para o pico ficar abaixo de -12 dBTP.
  if (fechando) tom(ctx, destino, t, { dur: 0.09, forma: 'sine', hz: 150, hzFim: 82, pico: 0.3, ataque: 0.004 })
  rajada(ctx, destino, t, { dur: 0.022, tipo: 'bandpass', hz: fechando ? 2900 : 3300, q: 4, pico: fechando ? 0.55 : 0.9, ataque: 0.002 }, 0.11)
  tom(ctx, destino, t + 0.002, { dur: 0.04, forma: 'triangle', hz: fechando ? 1150 : 1300, hzFim: 900, pico: 0.12, ataque: 0.002 })
  rajada(ctx, destino, t + 0.024, { dur: 0.03, tipo: 'bandpass', hz: fechando ? 1500 : 1800, q: 5, pico: 0.45, ataque: 0.003 }, 0.37)
}

/**
 * RANGIDO: a dobradiça seca. Fricção de agarra-e-solta é um trem de pulsos
 * irregular (dente de serra de 35 a 95 Hz com a altura tremida pelo
 * sorteio), passado por duas ressonâncias de madeira. Abrir arrasta mais
 * grave e mais longo; fechar é curto e sobe no fim.
 */
function rangido<N>(ctx: ContextoDeSom<N>, destino: N, t: number, dur: number, fechando: boolean): void {
  const pontos = Math.max(8, Math.round(dur * 120))
  const altura = new Float32Array(pontos)
  const sorte = sorteador(SEMENTE_DO_RANGIDO ^ (fechando ? 0xa5a5 : 0))
  const [de, ate] = fechando ? [70, 92] : [42, 64]
  for (let i = 0; i < pontos; i += 1) {
    const fracao = i / (pontos - 1)
    // Sobe e desce uma vez (a folha acelera e freia) e treme 18% ao redor.
    const base = de + (ate - de) * Math.sin(fracao * Math.PI * (fechando ? 0.5 : 1))
    altura[i] = base * (1 + (sorte() - 0.5) * 0.36)
  }
  const pulsos = ctx.createOscillator()
  pulsos.type = 'sawtooth'
  pulsos.frequency.setValueCurveAtTime(altura, t, dur)
  // O de abrir é mais grave, e o passa-baixa da mesa come menos dele: precisa de mais ganho para soar igual.
  const ganho = envelope(ctx, destino, t, envoltoriaArrastada(fechando ? 0.5 : 1.4, dur, fechando ? 0.02 : 0.05), dur)
  for (const [hz, q, nivel] of fechando ? [[1250, 9, 1], [2500, 7, 0.45]] : [[880, 10, 1], [1900, 7, 0.4]]) {
    const ressonancia = ctx.createBiquadFilter()
    ressonancia.type = 'bandpass'
    ressonancia.frequency.setValueAtTime(hz, t)
    ressonancia.Q.setValueAtTime(q, t)
    const mistura = ctx.createGain()
    mistura.gain.setValueAtTime(nivel, t)
    pulsos.connect(ressonancia)
    ressonancia.connect(mistura)
    mistura.connect(ganho)
  }
  pulsos.start(t)
  pulsos.stop(t + dur + 0.01)
}

/**
 * TRANCA: o ferrolho que corre e bate. Trancando, raspa subindo e bate seco;
 * destrancando, bate primeiro (a chave gira) e raspa descendo.
 */
export function tranca<N>(ctx: ContextoDeSom<N>, destino: N, t: number, trancando: boolean): void {
  const batida = trancando ? t + 0.075 : t
  const raspa = trancando ? t : t + 0.03
  rajada(ctx, destino, raspa, { dur: 0.07, tipo: 'bandpass', hz: trancando ? 1400 : 2200, hzFim: trancando ? 2200 : 1400, q: 3, pico: 0.32, ataque: 0.012 }, 0.53)
  rajada(ctx, destino, batida, { dur: 0.04, tipo: 'bandpass', hz: trancando ? 1000 : 1150, q: 2.5, pico: 0.55, ataque: 0.002 }, 0.71)
  tom(ctx, destino, batida, { dur: 0.07, forma: 'sine', hz: trancando ? 360 : 420, hzFim: trancando ? 240 : 300, pico: 0.28, ataque: 0.003 })
  tom(ctx, destino, batida + 0.002, { dur: 0.06, forma: 'triangle', hz: 2350, hzFim: 2000, pico: 0.07, ataque: 0.002 })
}

/**
 * Agenda o som de um evento em `t0` (s, no relógio do contexto) e devolve o
 * instante em que o último nó termina. Abrir com rangido: o trinco solta e a
 * dobradiça range pelo caminho. Fechar: rangido curto e o trinco no ponto em
 * que a folha assenta (`FRACAO_EM_QUE_ASSENTA`). Porta de correr (`trinco`):
 * só a lingueta.
 */
export function agendarSomDePorta<N>(ctx: ContextoDeSom<N>, destino: N, t0: number, evento: EventoDeSomDaPorta): number {
  // Os do pacote têm o volume calibrado à parte (perto de -32 LUFS): não passam pelo `GANHO_DA_PORTA`.
  if ('som' in evento && somDoPacote(evento.som)) {
    const abrindo = evento.tipo === 'abrir'
    const caminho = { abrindo, duracaoS: Math.max(0, evento.duracaoMs) / 1000, de: evento.de ?? (abrindo ? 0 : 1), ...(evento.curva === undefined ? {} : { curva: evento.curva }) }
    return agendarSomDaPortaDoPacote(ctx, destino, t0, evento.som, caminho)
  }
  const saida = ctx.createGain()
  saida.gain.setValueAtTime(GANHO_DA_PORTA, Math.max(0, t0 - 0.002))
  saida.connect(destino)
  // Só o abrir e o fechar levam `som`: sem ele é a tranca.
  if (!('som' in evento)) {
    tranca(ctx, saida, t0, evento.tipo === 'trancar')
    return t0 + 0.2
  }
  const dur = Math.max(0, evento.duracaoMs) / 1000
  const comRangido = evento.som === 'rangido' && dur >= RANGIDO_MIN_S
  if (evento.tipo === 'abrir') {
    trinco(ctx, saida, t0, false)
    if (comRangido) rangido(ctx, saida, t0 + 0.02, dur * 0.95, false)
    return Math.max(t0 + 0.07, comRangido ? t0 + 0.02 + dur * 0.95 + 0.01 : 0)
  }
  const assenta = t0 + dur * FRACAO_EM_QUE_ASSENTA
  if (comRangido) rangido(ctx, saida, t0, Math.max(RANGIDO_MIN_S, dur * FRACAO_EM_QUE_ASSENTA), true)
  trinco(ctx, saida, assenta, true)
  return assenta + 0.1
}

export interface OpcoesDoTocadorDePorta<N> {
  /** A saída do contexto criado no primeiro gesto; `null` antes dele. NUNCA cria contexto. */
  obterSaida: () => SaidaDeSom<N> | null
  lerPreferencia: () => PreferenciaDeSom
  /** Movimento reduzido deixa a porta muda: ela troca na hora, e o som de um caminho que não houve mentiria. */
  reduzido: () => boolean
  /** Relógio em ms, monotônico. */
  agora: () => number
}

export type TocarSomDePorta = (evento: EventoDeSomDaPorta) => boolean

/**
 * O tocador da porta: respeita mudo e volume da mesa (`ControleDeSom`,
 * `estaCalado`), o movimento reduzido e o intervalo mínimo; antes do primeiro
 * gesto não há saída e nada toca. O volume vai num ganho só deste toque, ao
 * quadrado como nos sons de clima (`tocarReceita`). Nunca lança: devolve se tocou.
 */
export function criarTocadorDePorta<N>({ obterSaida, lerPreferencia, reduzido, agora }: OpcoesDoTocadorDePorta<N>): TocarSomDePorta {
  const ultimoToque = new Map<EventoDeSomDaPorta['tipo'], number>()
  return (evento) => {
    try {
      if (reduzido()) return false
      const preferencia = lerPreferencia()
      if (estaCalado(preferencia)) return false
      const instante = agora()
      const anterior = ultimoToque.get(evento.tipo)
      if (anterior !== undefined && instante - anterior < INTERVALO_MINIMO_DA_PORTA_MS) return false
      const saida = obterSaida()
      if (saida === null || saida.ctx.state !== 'running') return false
      const { ctx } = saida
      const disparo = ctx.currentTime + ANTECEDENCIA_S
      const volumeDoToque = ctx.createGain()
      volumeDoToque.gain.setValueAtTime(preferencia.volume * preferencia.volume, disparo)
      volumeDoToque.connect(saida.mestre)
      agendarSomDePorta(ctx, volumeDoToque, disparo, evento)
      ultimoToque.set(evento.tipo, instante)
      return true
    } catch {
      // Nó recusado ou contexto fechado no meio: a porta segue sem som, nunca com erro.
      return false
    }
  }
}

/**
 * A preferência que deixa a porta muda. Exportada para o jogador ler a MESMA
 * (`player/sonsDoJogador.ts`): com ela ligada, o rangido de clima toca no
 * lugar, e as duas pontas não podem discordar (seria som em dobro ou nenhum).
 */
export function prefereMovimentoReduzido(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

/** O tocador do app (mestre e jogador): o contexto único de `lib/sons/contexto.ts` e a preferência da mesa. */
export const tocarSomDePorta: TocarSomDePorta = criarTocadorDePorta({
  obterSaida: obterSaidaDeSom,
  lerPreferencia: () => useSomStore.getState(),
  reduzido: prefereMovimentoReduzido,
  agora: () => performance.now(),
})
