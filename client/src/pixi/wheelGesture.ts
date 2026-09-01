export interface WheelInput {
  deltaX: number
  deltaY: number
  deltaMode: number
  ctrlKey: boolean
  shiftKey: boolean
}

export type WheelResult =
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'zoom'; deltaY: number }

// Fator de conversão por deltaMode (WheelEvent.DOM_DELTA_*). Trackpad emite
// modo 0 (pixel) e o valor já vem pronto pra usar; mouse de roda tradicional
// emite modo 1 (linha), tipicamente 1 "clique" de roda = ±3 linhas — sem
// normalizar, 3 unidades panariam 3px (imperceptível). Modo 2 (página) é raro
// (Home/End em alguns drivers) e vira, na prática, "salta quase uma tela".
// Valores calibrados pela convenção difundida por normalize-wheel (Basecamp/
// Facebook, usada em dezenas de bibliotecas de canvas): 1 linha ≈ 40px, 1
// página ≈ 800px. Sem essa conversão o pan fica absurdamente lento no modo
// linha (mouse) ou seria instantâneo demais no modo página.
const LINE_HEIGHT_PX = 40
const PAGE_HEIGHT_PX = 800

function normalizeDelta(value: number, deltaMode: number): number {
  if (deltaMode === 1) return value * LINE_HEIGHT_PX
  if (deltaMode === 2) return value * PAGE_HEIGHT_PX
  return value
}

// Roda = pan (reflexo de Figma/Excalidraw/maioria dos editores de canvas);
// Ctrl+roda = zoom — é também o que o navegador emite quando o usuário faz
// pinça no trackpad, então "zoom por pinça" cai de graça no mesmo caminho.
// Shift+roda = pan horizontal: mouse de roda tradicional só emite deltaY
// (nunca deltaX), então sem esse desvio o Shift não teria efeito nenhum nele
// — só em trackpad, que já reporta deltaX sozinho. Quando o dispositivo já
// manda deltaX (trackpad), Shift não rouba o eixo vertical que o próprio
// dispositivo produziu.
export function resolveWheel(evt: WheelInput): WheelResult {
  const dx = normalizeDelta(evt.deltaX, evt.deltaMode)
  const dy = normalizeDelta(evt.deltaY, evt.deltaMode)

  if (evt.ctrlKey) {
    return { kind: 'zoom', deltaY: dy }
  }

  if (evt.shiftKey && dx === 0) {
    return { kind: 'pan', dx: dy, dy: 0 }
  }

  return { kind: 'pan', dx, dy }
}
