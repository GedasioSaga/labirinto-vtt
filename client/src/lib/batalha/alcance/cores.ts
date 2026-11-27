/**
 * ALCANCE: AS TINTAS DAS CASAS (plano docs/design/habilidades/ALCANCE.md §8; as cores do
 * protótipo aprovado, `fonte.html`, `CORES`). Um lugar só para a camada Pixi da mesa
 * (`pixi/alcanceDoGolpe.ts`) e o Testar do editor (`components/batalha/alcance/TestarDoAlcance.tsx`):
 * a mesma casa acesa tem a mesma cor nos dois. Quem decide azul ou verde é `cor.ts`.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { CorDoAlcance } from './cor'

export interface TintaDoAlcance {
  /** A casa acesa (`0xrrggbb`). */
  base: number
  baseAlpha: number
  /** A casa sob o mouse ou com um alvo. */
  forte: number
  forteAlpha: number
  /** O fio claro da borda da forma. */
  borda: number
  /** O contorno escuro de cada casa. */
  contorno: number
  contornoAlpha: number
  /** O brilho do degradê, em `r, g, b` para o `rgba()` do canvas. */
  brilho: string
}

export const TINTAS_DO_ALCANCE: Readonly<Record<CorDoAlcance, TintaDoAlcance>> = {
  azul: { base: 0x1664ec, baseAlpha: 0.6, forte: 0x3088ff, forteAlpha: 0.84, borda: 0xcdeeff, contorno: 0x06122e, contornoAlpha: 0.6, brilho: '168, 222, 255' },
  verde: { base: 0x68de68, baseAlpha: 0.58, forte: 0x96f28c, forteAlpha: 0.86, borda: 0xecffe2, contorno: 0x0a280e, contornoAlpha: 0.62, brilho: '214, 255, 204' },
}

/**
 * A casa acesa onde está o alvo que o golpe de dano acerta (pedido do dono, 27/11/2026: "quando os
 * quadrados azuis acertarem um inimigo deixe o quadrado vermelho"). As mesmas alfas e o mesmo
 * desenho do azul: só a cor troca. O vermelho é um pouco mais claro que o azul (`0xe8362c`) para
 * ler igual sobre o chão escuro, e o contorno e a borda seguem o par do azul (escuro quente e rosa
 * claro).
 */
export const TINTA_DO_ALVO_ATINGIDO: TintaDoAlcance = { base: 0xe8362c, baseAlpha: 0.6, forte: 0xff5a48, forteAlpha: 0.84, borda: 0xffd9d2, contorno: 0x2e0806, contornoAlpha: 0.6, brilho: '255, 196, 184' }

/** A tinta como o canvas 2D a pede (`fillStyle`, `strokeStyle`). */
export interface TintaDoCanvas {
  base: string
  forte: string
  borda: string
  contorno: string
}

const BYTE = 0xff

/** `0xrrggbb` e a opacidade em `rgba(r, g, b, a)`. */
export function rgbaDaCor(cor: number, alpha: number): string {
  return `rgba(${(cor >> 16) & BYTE}, ${(cor >> 8) & BYTE}, ${cor & BYTE}, ${alpha})`
}

/** `0xrrggbb` em `#rrggbb`. */
export function hexDaCor(cor: number): string {
  return `#${cor.toString(16).padStart(6, '0')}`
}

function tintaDoCanvas(tinta: TintaDoAlcance): TintaDoCanvas {
  return { base: rgbaDaCor(tinta.base, tinta.baseAlpha), forte: rgbaDaCor(tinta.forte, tinta.forteAlpha), borda: hexDaCor(tinta.borda), contorno: rgbaDaCor(tinta.contorno, tinta.contornoAlpha) }
}

export const TINTAS_DO_CANVAS: Readonly<Record<CorDoAlcance, TintaDoCanvas>> = {
  azul: tintaDoCanvas(TINTAS_DO_ALCANCE.azul),
  verde: tintaDoCanvas(TINTAS_DO_ALCANCE.verde),
}
