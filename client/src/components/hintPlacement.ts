export interface HintPlacementInput {
  /** Centro do ícone que ancora o balão, em px de viewport. */
  anchorCenter: number
  /** Borda esquerda do elemento que posiciona o balão, em px de viewport. */
  originLeft: number
  /** Largura já renderizada do balão. */
  hintWidth: number
  viewportWidth: number
  /** Primeiro x livre à esquerda — depois do painel lateral. */
  minLeft: number
  /** Respiro mínimo até a borda direita da janela. */
  edgeGap: number
}

export interface HintPlacement {
  /** Deslocamento horizontal do balão, relativo à origem. */
  left: number
  /** Ponta da seta, em px a partir da borda esquerda do balão. */
  arrow: number
}

/** A seta nunca encosta no canto arredondado do balão. */
const ARROW_INSET = 12

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * Posiciona o balão de dica centrado no ícone da ferramenta ativa, recuando
 * quando ele não caberia — e nesse caso deslizando a seta dentro do balão para
 * que ela continue apontando o ícone. É o par "shift + arrow" que o Figma e o
 * Owlbear usam: o balão pode se mover, a seta não perde o alvo.
 */
export function placeHint(input: HintPlacementInput): HintPlacement {
  const { anchorCenter, originLeft, hintWidth, viewportWidth, minLeft, edgeGap } = input

  const maxLeft = viewportWidth - edgeGap - hintWidth
  // Numa janela estreita demais para respeitar os dois limites, o esquerdo
  // vence: cobrir o painel lateral é pior que encostar na borda direita.
  const left = clamp(anchorCenter - hintWidth / 2, minLeft, Math.max(minLeft, maxLeft))
  const arrow = clamp(anchorCenter - left, ARROW_INSET, Math.max(ARROW_INSET, hintWidth - ARROW_INSET))

  return { left: left - originLeft, arrow }
}
