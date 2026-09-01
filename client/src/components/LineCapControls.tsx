import type { DrawingCap } from '../types/map'

const CAP_OPTIONS: Array<{ value: DrawingCap; label: string }> = [
  { value: 'round', label: 'Arredondada' },
  { value: 'butt', label: 'Reta' },
  { value: 'square', label: 'Quadrada' },
]

export interface LineCapControlsProps {
  cap: DrawingCap
  onCapChange: (cap: DrawingCap) => void
}

/**
 * Ponta do traço (`Drawing.cap`, types/map.ts — campo do agente F4-0) de um
 * desenho com traço visível: pincel (freehand), linha ou curva. Pedido
 * literal do usuário: "a linha tem a ponta circular e quer reta".
 *
 * Só apresenta os 3 valores do tipo — não decide a FONTE do valor. Dual,
 * mesmo padrão já usado por `RegionStyleControls` (cor/padrão da região):
 * o chamador liga em `drawCap`/`setDrawCap` (preferência do PRÓXIMO desenho,
 * enquanto a ferramenta Pincel/Linha/Curva está ativa) OU em
 * `selectedDrawing.cap`/`(cap) => setDrawingCap(selectedDrawing.id, cap)`
 * (editando o desenho JÁ SELECIONADO) — ver CONTRATO no relatório do F4-N2.
 * `cap` chega aqui sempre como valor concreto: se `selectedDrawing.cap` for
 * `undefined` (mapa salvo antes do F4-0), o chamador resolve pra `'round'`
 * antes de passar — mesmo default que `drawDrawings.ts` já hardcoda hoje.
 */
export function LineCapControls({ cap, onCapChange }: LineCapControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Ponta da linha</h2>
      <div className="lb-field">
        <div className="lb-seg" role="radiogroup" aria-label="Ponta da linha">
          {CAP_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cap === value}
              className="lb-seg__option"
              onClick={() => onCapChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
