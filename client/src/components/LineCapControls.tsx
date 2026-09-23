import type { DrawingCap, DrawingDash } from '../types/map'

const CAP_OPTIONS: Array<{ value: DrawingCap; label: string }> = [
  { value: 'round', label: 'Arredondada' },
  { value: 'butt', label: 'Reta' },
  { value: 'square', label: 'Quadrada' },
]

/**
 * Mesmo vocabulário que a Grade já usa ("Tracejada | Pontilhada",
 * `GridControls.tsx`), para o usuário não ter de aprender duas palavras para
 * a mesma ideia. "Contínua" no lugar de "Sólida" porque o que é sólido aqui
 * é o traço, não a malha.
 */
const DASH_OPTIONS: Array<{ value: DrawingDash; label: string }> = [
  { value: 'solid', label: 'Contínua' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
]

/** Estilo do traço — mesma estrutura dual de `cap` (ver docstring abaixo):
 *  preferência do PRÓXIMO desenho ou edição do desenho já selecionado. */
export interface LineDashField {
  dash: DrawingDash
  onDashChange: (dash: DrawingDash) => void
}

export interface LineCapControlsProps {
  cap: DrawingCap
  onCapChange: (cap: DrawingCap) => void
  /**
   * `null`/ausente = a forma ativa não tem estilo de traço e o campo some.
   * É o caso do Pincel: a aparência do traço livre já é a `texture`
   * (caneta/lápis/marcador) e cruzar as duas coisas não foi pedido — melhor
   * esconder do que oferecer um controle que não faz nada.
   */
  dash?: LineDashField | null
}

/**
 * Traço de um desenho com linha visível: pincel (freehand), linha ou curva.
 *
 * Dois campos, mesma seção porque são a mesma decisão ("como este traço
 * sai"):
 * - ESTILO DO TRAÇO (`Drawing.dash`): contínuo, tracejado ou pontilhado. É o
 *   que separa "isto é parede" de "isto é passagem secreta, limite de área ou
 *   caminho sugerido" — antes disso tudo saía inteiriço e a única coisa
 *   interrompida no app era a grade, que não desenha passagem nenhuma.
 * - PONTA DA LINHA (`Drawing.cap`, campo do agente F4-0). Pedido literal do
 *   usuário: "a linha tem a ponta circular e quer reta".
 *
 * Só apresenta os valores dos tipos — não decide a FONTE do valor. Dual,
 * mesmo padrão já usado por `RegionStyleControls` (cor/padrão da região):
 * o chamador liga em `drawCap`/`setDrawCap` e `drawDash`/`setDrawDash`
 * (preferência do PRÓXIMO desenho, enquanto a ferramenta Pincel/Linha/Curva
 * está ativa) OU no desenho JÁ SELECIONADO (`selectedDrawing.cap` /
 * `setDrawingCap`, `selectedDrawing.dash` / `setDrawingDash`).
 * `cap` e `dash` chegam aqui sempre como valor concreto: se o campo for
 * `undefined` (mapa salvo antes de existir), o chamador resolve para
 * `'round'`/`'solid'` antes de passar — os mesmos defaults que o render
 * aplica (`drawDrawings.ts`, `lib/dashPattern.ts`).
 */
export function LineCapControls({ cap, onCapChange, dash = null }: LineCapControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Traço da linha</h2>

      {dash && (
        <div className="lb-field">
          <span className="lb-label">Estilo do traço</span>
          <div className="lb-seg" role="radiogroup" aria-label="Estilo do traço">
            {DASH_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={dash.dash === value}
                className="lb-seg__option"
                onClick={() => dash.onDashChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="lb-field">
        <span className="lb-label">Ponta da linha</span>
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
