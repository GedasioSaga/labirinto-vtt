import type { RefObject } from 'react'

export interface MeasureLabelElements {
  /** O rótulo desenhado perto da ponta da régua — só para os olhos. */
  label: HTMLDivElement
  /** A região viva que o leitor de tela ouve — sempre montada, nunca `hidden`. */
  announcer: HTMLDivElement
}

interface PlayerMeasureLabelProps {
  labelRef: RefObject<HTMLDivElement | null>
  announcerRef: RefObject<HTMLDivElement | null>
}

/**
 * Rótulo da régua do jogador, em DOIS elementos:
 *
 * - o VISÍVEL (`pp-measure-label`) aparece e some com a régua e é posicionado
 *   pelo gesto; fica `aria-hidden` para não ser lido duas vezes;
 * - a REGIÃO VIVA (`pp-sr-only`) existe desde a montagem, vazia e fora do
 *   `hidden`. Região viva que nasce escondida e só entra na árvore junto com o
 *   primeiro texto muitas vezes não é anunciada — a primeira medida se perdia.
 *
 * Os dois são escritos por `writeMeasureText`, direto no DOM, sem re-render do
 * React por passo do dedo.
 */
export function PlayerMeasureLabel({ labelRef, announcerRef }: PlayerMeasureLabelProps) {
  return (
    <>
      <div ref={labelRef} className="pp-measure-label" aria-hidden="true" hidden />
      {/* Educado: com o grude na grade o texto só muda a cada quadrado, não a cada pixel.
          Sem `role="status"`: a tela do jogador já tem UM status (a espera, o aviso de
          porta), e quem o procura pelo papel não pode achar dois. `aria-live` basta. */}
      <div ref={announcerRef} className="pp-sr-only" aria-live="polite" aria-atomic="true" />
    </>
  )
}

/**
 * Escreve a medida nos dois elementos; `null` = régua apagada. Só toca no texto
 * quando ele muda: reescrever o mesmo texto faria a região viva repetir a
 * medida a cada quadro do gesto.
 */
export function writeMeasureText({ label, announcer }: MeasureLabelElements, text: string | null): void {
  const next = text ?? ''
  if (label.textContent !== next) label.textContent = next
  if (announcer.textContent !== next) announcer.textContent = next
  // Texto vazio, e não só escondido: a medida apagada não pode continuar legível para ninguém.
  label.hidden = text === null
}
