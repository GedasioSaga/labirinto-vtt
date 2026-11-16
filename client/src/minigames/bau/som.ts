/**
 * SOM DO BAÚ: um som por evento da simulação (fecho, emperrou, travado,
 * aviso, segurou, solavanco, range, abriu, tempo), sintetizado em WebAudio
 * com as peças de comum/som.ts. Todo ganho de saída nasce em 0 (vca). Todo nó
 * recebe o contexto e o destino por parâmetro, para o mesmo código tocar ao
 * vivo e renderizar offline nas provas.
 */
import { QUASE_ZERO, filtro, mtof, osc, rajada, tom, vca } from '../abrir/som'
import type { Evento, PassoDaSequencia } from '../abrir/tipos'

/**
 * Ganho do barramento de efeitos do baú (os sons saem baixos e o mestre fica em 1). Voltou a 1,7, o
 * da pesca: com 1,9 a sequência ficava em −19,7 LUFS, mas a pior de 8 partidas do robô (Difícil,
 * 4 fechos tocados em sequência rápida) chegava a −0,6 dBTP, acima do teto de −1 dBTP (medido no
 * Edge offline em 15/11/2026, ferramentas/provas.cjs --so=som).
 */
export const GANHO = 1.7

/** Um som do baú; `v` é o índice do fecho ou a altura da tampa (range), quando o som usa. */
export type SomDoBau = (ctx: BaseAudioContext, out: AudioNode, t: number, v?: number) => void

/** Clack de latão: estalo seco e um "tlin" curto de metal; cada fecho soa um pouco diferente. */
function fecho(ctx: BaseAudioContext, out: AudioNode, t: number, v = 0): void {
  // Estalo de ruído baixo e corpo tonal longo: o estalo só dá pico; quem dá volume é o "tlin".
  // O corpo grave entra 6 ms depois: atacando junto, os picos somavam e o fecho passava de 0 dBFS.
  rajada(ctx, out, 'bandpass', 2600, 2.5, t, 0.5, 0.001, 0.035)
  tom(ctx, out, 'triangle', 1480 + 140 * v, t, 0.2, 0.002, 0.16, 5000)
  tom(ctx, out, 'sine', 240, t + 0.006, 0.18, 0.002, 0.08)
}

/** Emperrou: "tunc" abafado e grave, e um rangido curto de mola presa. */
function emperrou(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  rajada(ctx, out, 'lowpass', 520, 0.8, t, 0.6, 0.002, 0.09)
  const o = tom(ctx, out, 'sine', 150, t, 0.26, 0.003, 0.12)
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(85, t + 0.12)
  const r = tom(ctx, out, 'sawtooth', 210, t + 0.07, 0.24, 0.02, 0.2, 1400)
  r.frequency.setValueAtTime(210, t + 0.07)
  r.frequency.exponentialRampToValueAtTime(265, t + 0.13)
  r.frequency.exponentialRampToValueAtTime(190, t + 0.25)
}

/** Travado: tic seco e baixo; o fecho preso não responde. */
function travado(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  rajada(ctx, out, 'bandpass', 1100, 3, t, 1.1, 0.001, 0.025)
  tom(ctx, out, 'sine', 320, t, 0.2, 0.001, 0.04)
}

/** Aviso: chocalho de mola (tiques rápidos que somem) e um "boing" que treme. */
function aviso(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  for (let k = 0; k < 5; k++) rajada(ctx, out, 'bandpass', 3000 + 300 * (k % 2), 4, t + k * 0.04, 0.9 * (1 - k * 0.16), 0.001, 0.03)
  const b = tom(ctx, out, 'triangle', 520, t, 0.26, 0.005, 0.3)
  b.frequency.setValueAtTime(520, t)
  for (let j = 1; j <= 6; j++) b.frequency.exponentialRampToValueAtTime(j % 2 === 1 ? 600 : 470, t + j * 0.04)
}

/** Segurou: clique firme e um tom curto subindo (deu certo). */
function segurou(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  rajada(ctx, out, 'bandpass', 1800, 2, t, 0.8, 0.001, 0.03)
  const o = tom(ctx, out, 'triangle', mtof(76), t + 0.01, 0.36, 0.005, 0.2)
  o.frequency.setValueAtTime(mtof(76), t + 0.01)
  o.frequency.exponentialRampToValueAtTime(mtof(83), t + 0.09)
}

/** Solavanco: baque de madeira (ruído abafado, corpo grave e a batida da tábua). */
function solavanco(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  rajada(ctx, out, 'lowpass', 700, 0.9, t, 0.5, 0.002, 0.16)
  // Grave a 0,2 (era 0,34): dava o pico mais alto do jogo sem somar volume percebido.
  const o = tom(ctx, out, 'sine', 100, t, 0.2, 0.003, 0.2)
  o.frequency.setValueAtTime(100, t)
  o.frequency.exponentialRampToValueAtTime(50, t + 0.2)
  rajada(ctx, out, 'bandpass', 380, 3, t + 0.005, 1.2, 0.002, 0.08)
}

/** Rangido: pico, ataque e queda, em s, e o passa-baixa do dente de serra, em Hz. */
const RANGE_PICO = 0.24
const RANGE_ATAQUE = 0.04
const RANGE_QUEDA = 0.22
const RANGE_CORTE = 1800
/** Piso do ataque do rangido e quanto ele leva para chegar lá, em s (antes do primeiro pulso que se ouve). */
const RANGE_PISO = 0.02
const RANGE_ATE_O_PISO = 0.004

/** Rangido da tampa subindo; mais agudo quanto mais alta (`v` = tampa, 0..1). */
function range(ctx: BaseAudioContext, out: AudioNode, t: number, v = 0): void {
  const f = 150 + 170 * v
  // Ataque mais queda (0,26 s) cabe no intervalo de 0,3 s entre rangidos: um não pisa no outro.
  // Pico 0,24 (era 0,35): na partida real o rangido somado ao clique do fecho passava do
  // teto (−0,4 dBTP, medido em 15/11/2026), e ele toca ~30 vezes por partida.
  // Ataque em dois trechos (ajuste 2): de quase zero ao piso em 4 ms, e do piso ao pico. Indo
  // direto de quase zero ao pico, o volume subia 10x a cada pulso do dente de serra, e um pulso
  // perto do pico ficava sem vizinho parecido quando o clack de um fecho caía logo depois; o
  // medidor lia esse pulso como estalo solto (5 em 48 partidas do robô). Do piso, sobe uns 2x por
  // pulso. Rampa linear também resolvia, mas punha volume cedo demais e o rangido somado ao fecho e
  // ao aviso passava mais do teto.
  const o = osc(ctx, 'sawtooth', f)
  const g = vca(ctx)
  g.gain.setValueAtTime(QUASE_ZERO, t)
  g.gain.exponentialRampToValueAtTime(RANGE_PISO, t + RANGE_ATE_O_PISO)
  g.gain.exponentialRampToValueAtTime(RANGE_PICO, t + RANGE_ATAQUE)
  g.gain.exponentialRampToValueAtTime(QUASE_ZERO, t + RANGE_ATAQUE + RANGE_QUEDA)
  o.connect(filtro(ctx, 'lowpass', RANGE_CORTE)).connect(g)
  g.connect(out)
  o.start(t)
  o.stop(t + RANGE_ATAQUE + RANGE_QUEDA + 0.03)
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * 1.12, t + 0.12)
  o.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.24)
}

/** Abriu: a dobradiça range e quatro sinos sobem (mi, sol, si, mi). */
function abriu(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const d = tom(ctx, out, 'sawtooth', 120, t, 0.16, 0.06, 0.4, 1200)
  d.frequency.setValueAtTime(120, t)
  d.frequency.exponentialRampToValueAtTime(190, t + 0.25)
  d.frequency.exponentialRampToValueAtTime(140, t + 0.46)
  ;[76, 79, 83, 88].forEach((m, i) => tom(ctx, out, 'sine', mtof(m), t + 0.18 + i * 0.07, 0.24, 0.004, 0.55))
}

/** Tempo: os fechos batem fechando, um depois do outro, e um tom desce. */
function tempo(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  for (let k = 0; k < 3; k++) rajada(ctx, out, 'bandpass', 2000 - k * 300, 2.5, t + k * 0.08, 0.9, 0.001, 0.04)
  const o = tom(ctx, out, 'triangle', 440, t + 0.2, 0.4, 0.01, 0.5)
  o.frequency.setValueAtTime(440, t + 0.2)
  o.frequency.exponentialRampToValueAtTime(196, t + 0.7)
}

/** Nomes dos sons do baú, iguais aos nomes dos eventos da simulação. */
export type NomeDoSom = 'fecho' | 'emperrou' | 'travado' | 'aviso' | 'segurou' | 'solavanco' | 'range' | 'abriu' | 'tempo'

/** Som de cada evento. */
export const SONS: Readonly<Record<NomeDoSom, SomDoBau>> = { fecho, emperrou, travado, aviso, segurou, solavanco, range, abriu, tempo }

/** O nome é de um som do baú. */
export const ehSom = (nome: string): nome is NomeDoSom => Object.prototype.hasOwnProperty.call(SONS, nome)

/** Toca o som de um evento em `t` (s do relógio do contexto); evento sem som é ignorado. */
export function tocar(ctx: BaseAudioContext, out: AudioNode, ev: Evento, t: number): void {
  if (ehSom(ev.nome)) SONS[ev.nome](ctx, out, t, ev.v)
}

/**
 * Sequência das provas, como numa partida: abre os três fechos, a tampa
 * range, um aviso salvo, um toque cedo que emperra e um toque no preso, um
 * solavanco, a tampa sobe até abrir; o "tempo" fecha a lista para ter todos
 * os sons. Vozes espaçadas (no máximo duas soando juntas).
 */
export const SEQUENCIA: readonly PassoDaSequencia[] = [
  [0.2, { nome: 'fecho', v: 0 }],
  [0.5, { nome: 'fecho', v: 1 }],
  [0.8, { nome: 'fecho', v: 2 }],
  [1.1, { nome: 'range', v: 0.08 }],
  [1.4, { nome: 'range', v: 0.15 }],
  [1.7, { nome: 'range', v: 0.22 }],
  [2.0, { nome: 'aviso', v: 1 }],
  [2.35, { nome: 'segurou', v: 1 }],
  [2.7, { nome: 'range', v: 0.3 }],
  [3.0, { nome: 'range', v: 0.37 }],
  [3.3, { nome: 'fecho', v: 0 }],
  [3.6, { nome: 'emperrou', v: 2 }],
  [3.9, { nome: 'travado', v: 2 }],
  [4.2, { nome: 'aviso', v: 0 }],
  [4.6, { nome: 'solavanco', v: 0 }],
  [5.0, { nome: 'fecho', v: 0 }],
  [5.3, { nome: 'range', v: 0.5 }],
  [5.6, { nome: 'range', v: 0.7 }],
  [5.9, { nome: 'range', v: 0.9 }],
  [6.2, { nome: 'abriu' }],
  [7.4, { nome: 'tempo' }],
]

/** Duração da sequência das provas, em s (o "tempo" termina perto de 8,2 s). */
export const DURACAO_SEQUENCIA = 8.4
