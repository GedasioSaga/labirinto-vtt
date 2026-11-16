/**
 * SOM DO BARRIL: o tique de cada batida (mais agudo no aro de cima, para
 * quem joga de ouvido), o golpe (tum de madeira e o anel de ferro do aro,
 * mais forte com o progresso), o escorregão (raspão de ferro e um clank
 * fosco), o aro soltando, as aduelas caindo com os sinos de quem abriu e o
 * tom descendo do tempo esgotado. Tudo em WebAudio com as peças da base
 * comum; todo ganho de saída nasce em 0. Os picos de cada voz ficam entre
 * 0,1 e 0,3 antes do GANHO, e os sons que caem junto do golpe (aro, abriu)
 * começam um pouco depois dele, para as vozes não somarem no mesmo instante.
 */
import { mtof, rajada, tom } from '../abrir/som'
import type { PassoDaSequencia, Evento } from '../abrir/tipos'
import type { EventoDoBarril } from './sim'

/**
 * Ganho do barramento de efeitos do barril. Começou no 1,7 da pesca e a
 * sequência mediu −22,3 LUFS com pico de −5,6 dBTP (régua do app, 15/11/2026):
 * baixo demais e com folga de pico. 2,5 (+3,3 dB) mira −19 LUFS e ≤ −2 dBTP.
 */
export const GANHO = 2.5

/** Nota do anel de cada aro, em Hz: o de cima mais agudo, como uma contagem descendo. */
const ANEL_DO_ARO = [1180, 990, 830]
/** Tique de madeira de cada aro, em Hz. */
const TIQUE_DO_ARO = [1250, 1050, 880]
/** Razão do segundo parcial do anel: barra de ferro, não sino afinado. */
const PARCIAL_DE_FERRO = 2.76

/** Índice de aro válido a partir do `v` do evento. */
const aroDe = (v: number | undefined): number => Math.min(2, Math.max(0, Math.round(v ?? 0)))

/** Força do golpe (progresso depois dele, 0..1); sem ela, meio termo. */
function forcaDe(ev: Evento): number {
  if ('forca' in ev && typeof ev.forca === 'number') return Math.min(1, Math.max(0, ev.forca))
  return 0.5
}

/** Tique da batida: bloco de madeira curto e baixo. */
function batida(ctx: BaseAudioContext, out: AudioNode, t: number, aro: number): void {
  tom(ctx, out, 'sine', TIQUE_DO_ARO[aro], t, 0.11, 0.002, 0.07)
  rajada(ctx, out, 'bandpass', 2600, 2.5, t, 0.16, 0.001, 0.025)
}

/** Golpe certo: tum grave do barril, pancada abafada e o anel do aro acertado. */
function golpe(ctx: BaseAudioContext, out: AudioNode, t: number, aro: number, forca: number): void {
  const k = 0.65 + 0.35 * forca
  const o = tom(ctx, out, 'sine', 150, t, 0.22 * k, 0.003, 0.2)
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(62, t + 0.16)
  rajada(ctx, out, 'lowpass', 900, 0.8, t, 0.3 * k, 0.002, 0.07)
  const f = ANEL_DO_ARO[aro]
  tom(ctx, out, 'sine', f, t + 0.004, 0.08 * k, 0.002, 0.45)
  tom(ctx, out, 'sine', f * PARCIAL_DE_FERRO, t + 0.004, 0.03 * k, 0.002, 0.22)
}

/** Escorregão: raspão agudo que desce (ferro deslizando) e um clank fosco. */
function escorrega(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const f = rajada(ctx, out, 'bandpass', 5200, 5, t, 0.55, 0.004, 0.16)
  f.frequency.setValueAtTime(5200, t)
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.16)
  tom(ctx, out, 'square', 196, t + 0.012, 0.08, 0.002, 0.09, 900)
  tom(ctx, out, 'sine', 311, t + 0.012, 0.1, 0.002, 0.1)
}

/** Aro soltando: tilintar descendo, como ferro frouxo quicando (depois do golpe que o soltou). */
function aro(ctx: BaseAudioContext, out: AudioNode, t: number, i: number): void {
  const t0 = t + 0.09
  const base = 2350 - 120 * i
  ;[1, 0.84, 0.71, 0.6].forEach((r, k) => tom(ctx, out, 'triangle', base * r, t0 + k * 0.075, 0.12 - k * 0.018, 0.002, 0.22))
}

/** Abriu: quatro baques de aduela caindo e, depois, sinos subindo. */
function abriu(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  ;[0.08, 0.17, 0.28, 0.37].forEach((d, k) => {
    rajada(ctx, out, 'lowpass', 700 - k * 80, 0.9, t + d, 0.28, 0.002, 0.09)
    const o = tom(ctx, out, 'sine', 180 - k * 18, t + d, 0.15, 0.003, 0.12)
    o.frequency.setValueAtTime(180 - k * 18, t + d)
    o.frequency.exponentialRampToValueAtTime(85, t + d + 0.1)
  })
  ;[76, 79, 83, 88].forEach((m, k) => tom(ctx, out, 'sine', mtof(m), t + 0.5 + k * 0.08, 0.13, 0.004, 0.6))
}

/** Tempo esgotado: tom que desce uma oitava, sem drama. */
function tempo(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const o = tom(ctx, out, 'triangle', 392, t, 0.24, 0.01, 0.7)
  o.frequency.setValueAtTime(392, t)
  o.frequency.exponentialRampToValueAtTime(196, t + 0.6)
  const s = tom(ctx, out, 'sine', 196, t + 0.02, 0.12, 0.01, 0.6)
  s.frequency.setValueAtTime(196, t + 0.02)
  s.frequency.exponentialRampToValueAtTime(98, t + 0.6)
}

/** Nomes de evento que o barril emite e que têm som. */
export const NOMES_DOS_SONS: readonly string[] = ['batida', 'golpe', 'escorrega', 'aro', 'abriu', 'tempo']

/** Toca o som de um evento em `t` (s do relógio do contexto). Nome desconhecido não toca nada. */
export function tocar(ctx: BaseAudioContext, out: AudioNode, ev: Evento, t: number): void {
  switch (ev.nome) {
    case 'batida': return batida(ctx, out, t, aroDe(ev.v))
    case 'golpe': return golpe(ctx, out, t, aroDe(ev.v), forcaDe(ev))
    case 'escorrega': return escorrega(ctx, out, t)
    case 'aro': return aro(ctx, out, t, aroDe(ev.v))
    case 'abriu': return abriu(ctx, out, t)
    case 'tempo': return tempo(ctx, out, t)
  }
}

/** Intervalo entre batidas da sequência de prova (o andamento do Normal). */
const BATIDA_DA_SEQUENCIA = 0.65

/**
 * Sequência de prova, como numa partida curta: nove batidas com golpe (um
 * deles escorrega), dois aros soltando, o golpe final que abre e, por último,
 * o tempo esgotado de outra tentativa.
 */
function montarSequencia(): PassoDaSequencia[] {
  const seq: PassoDaSequencia[] = []
  const golpeEm = (aroDoGolpe: number, forca: number): EventoDoBarril => ({ nome: 'golpe', v: aroDoGolpe, forca })
  const N = 9
  let certos = 0
  for (let k = 0; k <= N; k++) {
    const t = 0.3 + k * BATIDA_DA_SEQUENCIA
    const a = k % 3
    seq.push([t, { nome: 'batida', v: a }])
    if (k === 2) {
      seq.push([t + 0.2, { nome: 'escorrega' }])
      continue
    }
    certos++
    seq.push([t + 0.01, golpeEm(a, certos / N)])
    if (certos === 3 || certos === 6) seq.push([t + 0.01, { nome: 'aro', v: certos / 3 - 1 }])
    if (certos === N) seq.push([t + 0.01, { nome: 'abriu' }])
  }
  seq.push([7.3, { nome: 'tempo' }])
  return seq
}

/** Todos os sons do barril numa linha do tempo, para o render offline e o .wav. */
export const SEQUENCIA: readonly PassoDaSequencia[] = montarSequencia()
/** Duração da sequência, em s, com a cauda do último som. */
export const DURACAO_SEQUENCIA = 8.2
