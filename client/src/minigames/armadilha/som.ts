/**
 * SOM DAS ARMADILHAS, sintetizado em WebAudio. BOTE da cobra (o susto forte):
 * golpe de ar do salto, baque grave que despenca e o chiado longo, em duas
 * camadas de ruído agudo. ARANHA (o susto menor): baque leve, passinhos secos
 * subindo, um "tss" de ameaça e os passinhos descendo. Todo ganho de saída
 * nasce em 0 (vca), como na pesca do app.
 */
import { QUASE_ZERO, filtro, fonteRuido, rajada, tom, vca } from '../abrir/som'
import type { Evento } from '../abrir/tipos'

/**
 * Ganho do barramento dos sustos. Com 1,7 (o da pesca) a cobra passava do teto
 * (−0,7 dBTP) e ficava 8 LU acima dos jogos; 1,15 deixa o bote uns 3 LU acima
 * do momento mais alto de uma partida: susto forte, sem doer.
 */
export const GANHO_SUSTO = 1.15

/** Chiado sustentado: sobe rápido, segura e cai até o fim. */
function chiado(ctx: BaseAudioContext, out: AudioNode, t: number, pico: number, corpo: number, dur: number, passaAlta: number, passaBaixa: number): void {
  const n = fonteRuido(ctx, t, dur + 0.03)
  const pa = filtro(ctx, 'highpass', passaAlta, 0.7)
  const pb = filtro(ctx, 'lowpass', passaBaixa, 0.7)
  const g = vca(ctx)
  g.gain.setValueAtTime(QUASE_ZERO, t)
  g.gain.exponentialRampToValueAtTime(pico, t + 0.012)
  g.gain.exponentialRampToValueAtTime(corpo, t + dur * 0.65)
  g.gain.exponentialRampToValueAtTime(QUASE_ZERO, t + dur)
  n.connect(pa).connect(pb).connect(g).connect(out)
}

/** Bote da cobra: ~0,8 s, o susto forte. */
export function bote(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  // Golpe de ar do salto (ruído grave que abre o filtro).
  const ar = rajada(ctx, out, 'lowpass', 700, 0.8, t, 0.22, 0.02, 0.12)
  ar.frequency.setValueAtTime(700, t)
  ar.frequency.exponentialRampToValueAtTime(3200, t + 0.1)
  // Baque grave que despenca.
  const baque = tom(ctx, out, 'sine', 150, t, 0.42, 0.004, 0.22)
  baque.frequency.setValueAtTime(150, t)
  baque.frequency.exponentialRampToValueAtTime(46, t + 0.2)
  // Chiado: o "hhhh" largo e o "ssss" fino por cima, um pouco depois.
  chiado(ctx, out, t + 0.01, 0.3, 0.2, 0.78, 2200, 8000)
  chiado(ctx, out, t + 0.05, 0.16, 0.12, 0.7, 5200, 11000)
}

/** Passinhos da aranha: estalos curtos e secos de ruído em banda, irregulares. */
const PASSINHOS: readonly number[] = [0.02, 0.048, 0.071, 0.102, 0.128, 0.157, 0.19, 0.222, 0.95, 0.982, 1.01, 1.046, 1.078, 1.11, 1.15]

/**
 * Aranha: ~1,2 s, o susto menor. Os níveis foram subidos depois da primeira
 * medida (−31 LUFS de curto prazo, quase sumia embaixo do jogo): agora fica
 * audível e ainda bem abaixo da cobra.
 */
export function aranha(ctx: BaseAudioContext, out: AudioNode, t: number): void {
  const baque = tom(ctx, out, 'sine', 220, t, 0.4, 0.006, 0.14)
  baque.frequency.setValueAtTime(220, t)
  baque.frequency.exponentialRampToValueAtTime(150, t + 0.12)
  // Farfalhar baixo enquanto ela sobe e enquanto desce (dá corpo aos passinhos).
  rajada(ctx, out, 'bandpass', 2400, 1.2, t + 0.01, 0.2, 0.03, 0.24)
  rajada(ctx, out, 'bandpass', 2400, 1.2, t + 0.94, 0.18, 0.03, 0.22)
  PASSINHOS.forEach((d, k) => {
    rajada(ctx, out, 'bandpass', 3600 + (k % 3) * 450, 5, t + d, k % 2 ? 0.75 : 0.9, 0.0015, 0.016)
  })
  // Ameaça: um "tss" seco quando as patas da frente sobem.
  rajada(ctx, out, 'highpass', 3800, 0.7, t + 0.34, 0.3, 0.01, 0.16)
}

/* Quanto o som do jogo abaixa enquanto o bicho aparece, e por quanto tempo (s). */
export const ABAFAR = {
  cobra: { fator: 0.35, duracao: 0.8 },
  aranha: { fator: 0.5, duracao: 1.2 },
} as const

/**
 * Abaixa o barramento do jogo durante o susto: o chiado da cobra (ou os
 * passinhos da aranha) passa por cima do resto, e o som de abrir do recipiente
 * não se soma ao bote (era o pior pico de uma partida do barril, −0,9 dBTP,
 * medido em 15/11/2026). `ganho` é o valor normal do barramento.
 */
export function abafarJogo(p: AudioParam, ganho: number, bicho: 'cobra' | 'aranha', t: number): void {
  const { fator, duracao } = ABAFAR[bicho]
  p.cancelScheduledValues(t)
  p.setValueAtTime(ganho, t)
  p.linearRampToValueAtTime(ganho * fator, t + 0.02)
  p.setValueAtTime(ganho * fator, t + duracao - 0.15)
  p.linearRampToValueAtTime(ganho, t + duracao + 0.1)
}

export type NomeDoSomDoSusto = 'bote' | 'aranha'
export const SONS_DO_SUSTO: Readonly<Record<NomeDoSomDoSusto, (ctx: BaseAudioContext, out: AudioNode, t: number) => void>> = { bote, aranha }

/** Toca o som de um evento do susto. Nome desconhecido não toca nada. */
export function tocarSusto(ctx: BaseAudioContext, out: AudioNode, ev: Evento, t: number): void {
  if (ehSomDoSusto(ev.nome)) SONS_DO_SUSTO[ev.nome](ctx, out, t)
}

function ehSomDoSusto(nome: string): nome is NomeDoSomDoSusto {
  return Object.hasOwn(SONS_DO_SUSTO, nome)
}

/** Sequência de prova: a cobra e, depois, a aranha. */
export const SEQUENCIA_SUSTO: readonly (readonly [number, Evento])[] = [[0.1, { nome: 'bote' }], [1.5, { nome: 'aranha' }]]
export const DURACAO_SEQUENCIA_SUSTO = 3
