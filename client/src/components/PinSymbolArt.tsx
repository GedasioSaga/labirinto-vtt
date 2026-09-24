import type { PinIcon } from '../types/map'
import { PIN_LEVER_SYMBOL, PIN_SYMBOLS, PIN_TRAVEL_SYMBOL, type PinSymbolPoint, type PinSymbolShape } from '../lib/pins'

interface PinShapeArtProps {
  shape: PinSymbolShape
  size?: number
}

interface PinSymbolArtProps {
  icon: PinIcon
  size?: number
}

/** Meio lado do `viewBox` de 24 — o mesmo enquadramento de `components/icons.tsx`. */
const CENTRO = 12
/**
 * Quanto do meio-lado o símbolo ocupa. Igual ao `SYMBOL_RADIUS` de
 * `pixi/drawPins.ts` em proporção: a forma que o mestre escolhe aqui é, ponto
 * por ponto, a que ele vê cravada no mapa.
 */
const ESCALA = 9.2

function paraTela(ponto: PinSymbolPoint): string {
  return `${(CENTRO + ponto.x * ESCALA).toFixed(2)},${(CENTRO + ponto.y * ESCALA).toFixed(2)}`
}

/**
 * Uma forma de `lib/pins.ts` como SVG, para o painel do mestre e para o
 * cartão do jogador. A geometria não mora aqui: vem da mesma fonte que
 * `pixi/drawPins.ts` usa no mapa — o desenho do controle e o desenho do mapa
 * não têm como divergir.
 *
 * Decorativo de propósito (`aria-hidden`): quem carrega o nome acessível é
 * sempre o botão ou o rótulo que contém a arte, do mesmo jeito que em
 * `components/icons.tsx`.
 */
export function PinShapeArt({ shape, size = 18 }: PinShapeArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape.strokes.map((stroke, i) =>
        stroke.closed === true ? (
          <polygon key={`s${i}`} points={stroke.points.map(paraTela).join(' ')} />
        ) : (
          <polyline key={`s${i}`} points={stroke.points.map(paraTela).join(' ')} />
        ),
      )}
      {(shape.rings ?? []).map((ring, i) => (
        <circle key={`r${i}`} cx={CENTRO + ring.x * ESCALA} cy={CENTRO + ring.y * ESCALA} r={ring.r * ESCALA} />
      ))}
      {(shape.dots ?? []).map((dot, i) => (
        <circle
          key={`d${i}`}
          cx={CENTRO + dot.x * ESCALA}
          cy={CENTRO + dot.y * ESCALA}
          r={dot.r * ESCALA}
          fill="currentColor"
          stroke="none"
        />
      ))}
    </svg>
  )
}

/** O símbolo que o mestre escolhe para o marcador (baú, armadilha…). */
export function PinSymbolArt({ icon, size = 18 }: PinSymbolArtProps) {
  return <PinShapeArt shape={PIN_SYMBOLS[icon]} size={size} />
}

/** A passagem do pino de viagem: a seta entrando no vão da porta. */
export function PinTravelArt({ size = 18 }: { size?: number }) {
  return <PinShapeArt shape={PIN_TRAVEL_SYMBOL} size={size} />
}

/** A alavanca: base, haste inclinada e punho. */
export function PinLeverArt({ size = 18 }: { size?: number }) {
  return <PinShapeArt shape={PIN_LEVER_SYMBOL} size={size} />
}
