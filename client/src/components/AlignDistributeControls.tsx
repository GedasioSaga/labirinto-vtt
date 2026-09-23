import type { ReactNode } from 'react'
import type { AlignEdge, DistributeAxis } from '../lib/alignDistribute'
import './AlignDistributeControls.css'

export interface AlignDistributeControlsProps {
  /**
   * Quantos BLOCOS independentes a seleção tem (`selectAlignableUnitCount`:
   * Sala + paredes dela = 1), não quantas entradas. Menos de 2: a seção não aparece.
   */
  count: number
  onAlign: (edge: AlignEdge) => void
  onDistribute: (axis: DistributeAxis) => void
}

/** Distribuir só faz sentido com um item no meio de duas pontas. */
const MIN_ITEMS_TO_DISTRIBUTE = 3

/** Mesmo traço da família de `icons.tsx` (contorno em `currentColor`). */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Cada ícone: a linha-guia e duas barras de tamanhos diferentes encostadas nela. */
const ALIGN_BUTTONS: ReadonlyArray<{ edge: AlignEdge; label: string; icon: ReactNode }> = [
  {
    edge: 'left',
    label: 'Alinhar à esquerda',
    icon: (
      <>
        <path d="M4 3v18" />
        <rect x="4" y="6" width="14" height="4" rx="1" />
        <rect x="4" y="14" width="9" height="4" rx="1" />
      </>
    ),
  },
  {
    edge: 'center',
    label: 'Alinhar ao centro',
    icon: (
      <>
        <path d="M12 3v18" />
        <rect x="5" y="6" width="14" height="4" rx="1" />
        <rect x="7.5" y="14" width="9" height="4" rx="1" />
      </>
    ),
  },
  {
    edge: 'right',
    label: 'Alinhar à direita',
    icon: (
      <>
        <path d="M20 3v18" />
        <rect x="6" y="6" width="14" height="4" rx="1" />
        <rect x="11" y="14" width="9" height="4" rx="1" />
      </>
    ),
  },
  {
    edge: 'top',
    label: 'Alinhar ao topo',
    icon: (
      <>
        <path d="M3 4h18" />
        <rect x="6" y="4" width="4" height="14" rx="1" />
        <rect x="14" y="4" width="4" height="9" rx="1" />
      </>
    ),
  },
  {
    edge: 'middle',
    label: 'Alinhar ao meio',
    icon: (
      <>
        <path d="M3 12h18" />
        <rect x="6" y="5" width="4" height="14" rx="1" />
        <rect x="14" y="7.5" width="4" height="9" rx="1" />
      </>
    ),
  },
  {
    edge: 'bottom',
    label: 'Alinhar à base',
    icon: (
      <>
        <path d="M3 20h18" />
        <rect x="6" y="6" width="4" height="14" rx="1" />
        <rect x="14" y="11" width="4" height="9" rx="1" />
      </>
    ),
  },
]

/** As duas pontas paradas e o item do meio a passo igual entre elas. */
const DISTRIBUTE_BUTTONS: ReadonlyArray<{ axis: DistributeAxis; label: string; icon: ReactNode }> = [
  {
    axis: 'horizontal',
    label: 'Distribuir na horizontal',
    icon: (
      <>
        <path d="M3 3v18M21 3v18" />
        <rect x="9" y="7" width="6" height="10" rx="1" />
      </>
    ),
  },
  {
    axis: 'vertical',
    label: 'Distribuir na vertical',
    icon: (
      <>
        <path d="M3 3h18M3 21h18" />
        <rect x="7" y="9" width="10" height="6" rx="1" />
      </>
    ),
  },
]

/**
 * Alinhar e distribuir (item 19 de docs/features-candidatas-2026-09-21.md).
 * Aparece junto do resumo da seleção quando há 2 ou mais itens: seis botões de
 * alinhar e, com 3 ou mais, os dois de distribuir (com 2 eles ficam visíveis
 * mas desabilitados, com o motivo logo abaixo). Cada clique é UM passo do
 * desfazer — quem garante isso é a store (`alignSelection`/`distributeSelection`).
 */
export function AlignDistributeControls({ count, onAlign, onDistribute }: AlignDistributeControlsProps) {
  if (count < 2) return null
  const canDistribute = count >= MIN_ITEMS_TO_DISTRIBUTE

  return (
    <section className="lb-section lb-align">
      <h2 className="lb-eyebrow">Alinhar e distribuir</h2>
      <div className="lb-align__row" role="group" aria-label="Alinhar">
        {ALIGN_BUTTONS.map(({ edge, label, icon }) => (
          <button
            key={edge}
            type="button"
            className="lb-iconbtn lb-iconbtn--sm"
            aria-label={label}
            title={label}
            onClick={() => onAlign(edge)}
          >
            <Glyph>{icon}</Glyph>
          </button>
        ))}
      </div>
      <div className="lb-align__row" role="group" aria-label="Distribuir">
        {DISTRIBUTE_BUTTONS.map(({ axis, label, icon }) => (
          <button
            key={axis}
            type="button"
            className="lb-iconbtn lb-iconbtn--sm"
            aria-label={label}
            title={label}
            disabled={!canDistribute}
            onClick={() => onDistribute(axis)}
          >
            <Glyph>{icon}</Glyph>
          </button>
        ))}
      </div>
      {!canDistribute && <p className="lb-field__hint">Distribuir precisa de 3 ou mais itens selecionados.</p>}
    </section>
  )
}
