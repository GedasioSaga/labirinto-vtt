import type { Graphics } from 'pixi.js'
import type { LadoNoCampo } from '../lib/batalha/marcasNoCampo'
import { parseHexColor } from '../lib/tokenColor'

/**
 * CAMPO DE BATALHA (protótipo aprovado em 19/11/2026,
 * docs/design/campo-de-batalha/prototipo.html): o desenho das marcas da ficha
 * na batalha, o mesmo no mestre (`tokensRenderer.ts`) e no jogador
 * (`player/PlayerView.tsx`). Toda marca é a cor entre contornos escuros: lê
 * sobre o chão claro, a pedra, o telhado e a névoa, sem traço branco.
 * Px de mundo, como a ficha (o anel acompanha o disco no zoom).
 */

/** O contorno escuro de toda marca (a tinta do app, quase opaca). */
export const CONTORNO_DO_CAMPO = 0x0c0c0e
const CONTORNO_ALPHA = 0.9
/** Latão (quem age), latão claro (a mira) e brasa (o golpe): as cores do tema (`theme.ts`). */
export const LATAO = 0xe0a44a
export const LATAO_CLARO = 0xf3ba66
export const BRASA = 0xe2645a

/** O anel do lado: 3 de cor com 1,5 de escuro de cada lado, colado no disco. */
const LADO_LARGURA = 3
const LADO_CONTORNO = 1.5
/** O anel de quem age: 3 de latão sobre 6 de escuro, com um vão até o anel do lado. */
const ANEL_LARGURA = 3
const ANEL_CONTORNO = 6
const ANEL_VAO = 2.5
/** Tracejado de quem espera: traços e vãos iguais, quantos cabem na volta. */
const ANEL_TRACOS = 18
/** Os cantos do alvo: um pouco por fora da casa (33/28 da meia casa) com braço de 11/28. */
const CANTO_FORA = 33 / 28
const CANTO_BRACO = 11 / 28
const CANTO_LARGURA = 3
const CANTO_CONTORNO = 6.5

/** O raio de fora das marcas coladas no disco (o anel do lado), a partir do raio do disco. */
export function raioDoLado(raioDoDisco: number): number {
  return raioDoDisco + LADO_LARGURA + LADO_CONTORNO
}

/** O raio do meio do anel de quem age, solto por fora do disco (e do anel do lado, se tem). */
export function raioDoAnel(raioDoDisco: number, temLado: boolean): number {
  const fora = temLado ? raioDoLado(raioDoDisco) : raioDoDisco
  return fora + ANEL_VAO + ANEL_CONTORNO / 2
}

/** A cor do lado em número; cor inválida (veio do fio sem passar pela régua) = nenhuma. */
export function corDoLado(lado: LadoNoCampo | null): number | null {
  return lado === null ? null : parseHexColor(lado.cor)
}

/** O anel do lado: escuro, cor, colado na borda do disco. */
export function desenharLado(g: Graphics, raioDoDisco: number, cor: number): void {
  const meio = raioDoDisco + LADO_LARGURA / 2
  g.circle(0, 0, meio).stroke({ width: LADO_LARGURA + 2 * LADO_CONTORNO, color: CONTORNO_DO_CAMPO, alpha: CONTORNO_ALPHA })
  g.circle(0, 0, meio).stroke({ width: LADO_LARGURA, color: cor })
}

function tracejar(g: Graphics, raio: number): void {
  const fatia = (Math.PI * 2) / ANEL_TRACOS
  for (let i = 0; i < ANEL_TRACOS; i += 1) {
    const inicio = i * fatia
    g.moveTo(Math.cos(inicio) * raio, Math.sin(inicio) * raio)
    g.arc(0, 0, raio, inicio, inicio + fatia / 2)
  }
}

/** O anel de quem age (cheio) ou de quem tem a vez mas espera (tracejado), no raio do meio `raio`. */
export function desenharAnel(g: Graphics, raio: number, tracejado: boolean): void {
  if (tracejado) {
    tracejar(g, raio)
    g.stroke({ width: ANEL_CONTORNO, color: CONTORNO_DO_CAMPO, alpha: CONTORNO_ALPHA, cap: 'butt' })
    tracejar(g, raio)
    g.stroke({ width: ANEL_LARGURA, color: LATAO, cap: 'butt' })
    return
  }
  g.circle(0, 0, raio).stroke({ width: ANEL_CONTORNO, color: CONTORNO_DO_CAMPO, alpha: CONTORNO_ALPHA })
  g.circle(0, 0, raio).stroke({ width: ANEL_LARGURA, color: LATAO })
}

function quatroCantos(g: Graphics, c: number, b: number): void {
  g.moveTo(-c, -c + b).lineTo(-c, -c).lineTo(-c + b, -c)
  g.moveTo(c - b, -c).lineTo(c, -c).lineTo(c, -c + b)
  g.moveTo(c, c - b).lineTo(c, c).lineTo(c - b, c)
  g.moveTo(-c + b, c).lineTo(-c, c).lineTo(-c, c - b)
}

/** Os cantos da casa do alvo (em brasa: o golpe já saiu), centrados na ficha; `meiaCasa` = metade do lado ocupado pela ficha. */
export function desenharCantos(g: Graphics, meiaCasa: number, cor: number): void {
  const c = meiaCasa * CANTO_FORA
  const b = meiaCasa * CANTO_BRACO
  quatroCantos(g, c, b)
  g.stroke({ width: CANTO_CONTORNO, color: CONTORNO_DO_CAMPO, alpha: 0.85, cap: 'round', join: 'round' })
  quatroCantos(g, c, b)
  g.stroke({ width: CANTO_LARGURA, color: cor, cap: 'round', join: 'round' })
}

/** O sinal do lado no nome: ponto (jogadores) ou losango (o outro), o segundo canal além da cor. */
export function desenharSinalDoLado(g: Graphics, forma: LadoNoCampo['forma'], cor: number, raio: number): void {
  g.clear()
  if (forma === 'ponto') g.circle(0, 0, raio)
  else g.poly([0, -raio * 1.2, raio * 1.2, 0, 0, raio * 1.2, -raio * 1.2, 0])
  g.fill({ color: cor }).stroke({ width: Math.max(0.5, raio * 0.35), color: CONTORNO_DO_CAMPO, alpha: 0.8 })
}

/** Quanto o alvo que espera a reação pisca: 1 a 0,35 e volta, em 1,4 s (o `pulso` do protótipo). */
export const PULSO_DO_ALVO_MS = 1400
export const PULSO_DO_ALVO_MINIMO = 0.35
/** Movimento reduzido: o alvo que espera fica parado um pouco apagado, sem piscar. */
export const ALVO_PARADO_ALPHA = 0.8

export function alphaDoPulso(agora: number): number {
  const t = (agora % PULSO_DO_ALVO_MS) / PULSO_DO_ALVO_MS
  // ease-in-out por cosseno: 1 no começo e no fim, o mínimo no meio.
  const onda = (1 - Math.cos(2 * Math.PI * t)) / 2
  return 1 - (1 - PULSO_DO_ALVO_MINIMO) * onda
}
