export interface LineShapeControlsProps {
  /** kind ATUAL do Drawing selecionado. Componente só faz sentido para os
   *  dois kinds que `convertLineToCurve`/`convertCurveToLine`
   *  (lib/drawingFactory.ts) sabem converter — o chamador decide quando
   *  montar (mesmo padrão de `lineCap` em PropertiesPanel.tsx: `null` quando
   *  não se aplica). */
  kind: 'line' | 'curve'
  /** Sempre disponível quando kind === 'line' — convertLineToCurve nunca
   *  descarta dado (2 pontos vira 2 pontos de controle). */
  onConvertToCurve: () => void
  /**
   * `null` quando a curve selecionada tem mais de 2 pontos de controle
   * (usuário já arrastou o midpoint pelo menos uma vez — ver
   * PixiCanvas.tsx:719, insertCurvePoint): voltar para "Reta" perderia esses
   * pontos em silêncio, o que é proibido (CONTRATO do Agente B, item 1). O
   * botão "Reta" fica desabilitado com `title` explicando o motivo, em vez
   * de escondido — o usuário vê a opção e entende por que não pode usá-la
   * agora, em vez de "sumir" sem explicação.
   */
  onConvertToLine: (() => void) | null
}

/**
 * Pedido literal do usuário (ROADMAP.md N1/B2): "porque eu não consigo
 * dobrar essa linha para ficar ou reta ou arredondado?" — leitura B
 * (curvar/dobrar a LINHA, não a ponta do traço — isso é `LineCapControls`,
 * feature separada). Segmented control no mesmo padrão visual de
 * `LineCapControls.tsx` (`.lb-seg`/`.lb-seg__option`, já estilizados em
 * main.css) — o valor "ativo" reflete o `kind` atual do Drawing, e clicar no
 * outro dispara a conversão correspondente.
 *
 * Não decide a fonte da ação: o chamador liga em
 * `mapStore.convertDrawingToCurve`/inverso equivalente (ver CONTRATO no
 * relatório do Agente B) — este componente só apresenta os 2 estados
 * possíveis e o gesto de trocar entre eles.
 */
export function LineShapeControls({ kind, onConvertToCurve, onConvertToLine }: LineShapeControlsProps) {
  const lineDisabled = kind === 'line' || !onConvertToLine
  const lineTitle = kind === 'curve' && !onConvertToLine
    ? 'Esta curva já tem pontos de controle extras — voltar para reta descartaria esses pontos.'
    : undefined

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Formato da linha</h2>
      <div className="lb-field">
        <div className="lb-seg" role="radiogroup" aria-label="Formato da linha">
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'line'}
            className="lb-seg__option"
            disabled={lineDisabled}
            title={lineTitle}
            onClick={() => onConvertToLine?.()}
          >
            Reta
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'curve'}
            className="lb-seg__option"
            disabled={kind === 'curve'}
            onClick={onConvertToCurve}
          >
            Curva
          </button>
        </div>
      </div>
    </section>
  )
}
