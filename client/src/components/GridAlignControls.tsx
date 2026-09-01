import { useEffect, useMemo, useState } from 'react'
import type { Point } from '../pixi/world'
import {
  computeGridFromCount,
  detectGridCountFromFilename,
  MAX_DETECTED_DIMENSION,
  type GridAlignResult,
} from '../lib/gridAlign'
import { Toggle } from './Toggle'

export interface GridAlignControlsProps {
  /** Nome do arquivo de fundo (basename, sem path) — só para a sugestão
   *  automática (heurística de nome, `detectGridCountFromFilename`). `null`
   *  quando não há fundo de imagem (`map.background.type !== 'image'`). */
  backgroundFilename: string | null
  /** Dimensões NATURAIS da textura carregada (px), lidas de
   *  `Texture.width`/`Texture.height` em `pixi/PixiCanvas.tsx` depois que
   *  `redrawBackground` resolve — `null` enquanto a imagem não carregou. */
  imageWidth: number | null
  imageHeight: number | null
  /** `MapData.grid` atual. */
  cellSize: number
  /** `MapData.gridOffset` atual — campo NOVO, ver CONTRATO no relatório da
   *  tarefa. */
  offset: Point
  /** Desloca só o offset, mantendo `cellSize`. Commita IMEDIATAMENTE (mesma
   *  convenção de `GridControls.onGridSettingsChange` — sem "Aplicar"
   *  próprio, porque não há ambiguidade de campo parcialmente digitado como
   *  há em colunas/linhas, ver `onApply`). */
  onOffsetChange: (offset: Point) => void
  /** Substitui `cellSize` E `offset` de uma vez (ação atômica — a "Aplicar"
   *  deste painel). Só disparado pelo botão, nunca a cada tecla, porque
   *  colunas e linhas são dois campos independentes: aplicar a cada tecla
   *  computaria um `cellSize` errado com o segundo campo ainda no valor
   *  antigo. */
  onApply: (cellSize: number, offset: Point) => void
  /**
   * Reporta a prévia AO VIVO (ainda não aplicada) derivada de colunas/linhas,
   * para `pixi/drawGridAlignOverlay.ts` desenhar por cima da imagem antes do
   * usuário confirmar. `null` = esconder a prévia (toggle desligado, sem
   * imagem carregada, ou este painel desmontou — ver `useEffect` de limpeza
   * abaixo). Quem decide ONDE desenhar é o integrador; este componente só
   * reporta a intenção, igual ao resto dos painéis desta fase.
   */
  onPreviewChange: (draft: GridAlignResult | null) => void
}

/**
 * Alinhar a grade do editor à grade já desenhada numa imagem de fundo
 * importada — ver `lib/gridAlign.ts` para toda a lógica pura por trás dos
 * três caminhos abaixo, em ordem de valor (docs/PLANO-FASES.md):
 *
 * 1. Colunas x linhas contadas na imagem → deriva `cellSize` (offset 0,0).
 * 2. Sugestão automática pelo NOME do arquivo (heurística de string).
 * 3. Offset fino (x/y), para a maioria das imagens cuja grade não começa
 *    exatamente no pixel (0,0).
 *
 * Painel de mapa, não de item selecionado — mesma classe de `GridControls`/
 * `MapScaleControls`: fica visível independente de seleção ou ferramenta.
 */
export function GridAlignControls({
  backgroundFilename,
  imageWidth,
  imageHeight,
  cellSize,
  offset,
  onOffsetChange,
  onApply,
  onPreviewChange,
}: GridAlignControlsProps) {
  const [cols, setCols] = useState(20)
  const [rows, setRows] = useState(20)
  const [previewEnabled, setPreviewEnabled] = useState(true)

  const hasImage = imageWidth !== null && imageHeight !== null

  const suggestion = useMemo(
    () => (backgroundFilename ? detectGridCountFromFilename(backgroundFilename) : null),
    [backgroundFilename],
  )

  const draft = useMemo(
    () => (hasImage ? computeGridFromCount(imageWidth, imageHeight, cols, rows) : null),
    [hasImage, imageWidth, imageHeight, cols, rows],
  )

  // Mantém o integrador informado da prévia ao vivo enquanto o usuário digita
  // colunas/linhas — e limpa (null) ao desmontar, senão a prévia fica
  // "grudada" no canvas depois que o painel troca de aba (mesmo bug que o
  // comentário de MeasurementIndicatorRenderer.hide documenta pro
  // indicador de régua).
  useEffect(() => {
    onPreviewChange(previewEnabled ? draft : null)
    return () => onPreviewChange(null)
    // eslint-disable-next-line -- projeto não usa eslint (ver CLAUDE.md §2e); mantido só como nota de intenção do array de dependências abaixo.
  }, [draft, previewEnabled, onPreviewChange])

  function useSuggestion() {
    if (!suggestion) return
    setCols(suggestion.cols)
    setRows(suggestion.rows)
  }

  function applyCount() {
    if (!draft) return
    onApply(draft.cellSize, draft.offset)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Alinhar grade à imagem</h2>

      {!hasImage && (
        <div className="lb-empty">
          <span>Importe uma imagem de fundo para alinhar a grade a ela.</span>
        </div>
      )}

      {suggestion && (
        <div className="lb-section__row">
          <span className="lb-label">
            Nome sugere {suggestion.cols} x {suggestion.rows}
          </span>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={useSuggestion}>
            Usar
          </button>
        </div>
      )}

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-gridalign-cols">
          Colunas
        </label>
        <input
          id="lb-gridalign-cols"
          className="lb-input"
          type="number"
          min={1}
          max={MAX_DETECTED_DIMENSION}
          step={1}
          value={cols}
          onChange={(event) => setCols(Math.max(1, Number(event.target.value)))}
        />
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-gridalign-rows">
          Linhas
        </label>
        <input
          id="lb-gridalign-rows"
          className="lb-input"
          type="number"
          min={1}
          max={MAX_DETECTED_DIMENSION}
          step={1}
          value={rows}
          onChange={(event) => setRows(Math.max(1, Number(event.target.value)))}
        />
      </div>

      {draft && (
        <div className="lb-section__row">
          <span className="lb-label">Célula resultante</span>
          <span className="lb-num">{Math.round(draft.cellSize)} px</span>
        </div>
      )}

      <button type="button" className="lb-btn lb-btn--primary lb-btn--block" disabled={!draft} onClick={applyCount}>
        Aplicar {cols} x {rows}
      </button>

      <Toggle label="Mostrar prévia" checked={previewEnabled} onChange={setPreviewEnabled} />

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-gridalign-offsetx">
          Deslocamento X
        </label>
        <div className="lb-inputgroup">
          <input
            id="lb-gridalign-offsetx"
            className="lb-input"
            type="number"
            step={1}
            value={Math.round(offset.x)}
            onChange={(event) => onOffsetChange({ ...offset, x: Number(event.target.value) })}
          />
          <span className="lb-inputgroup__suffix">px</span>
        </div>
      </div>

      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-gridalign-offsety">
          Deslocamento Y
        </label>
        <div className="lb-inputgroup">
          <input
            id="lb-gridalign-offsety"
            className="lb-input"
            type="number"
            step={1}
            value={Math.round(offset.y)}
            onChange={(event) => onOffsetChange({ ...offset, y: Number(event.target.value) })}
          />
          <span className="lb-inputgroup__suffix">px</span>
        </div>
      </div>

      <button
        type="button"
        className="lb-btn lb-btn--ghost lb-btn--block"
        disabled={offset.x === 0 && offset.y === 0}
        onClick={() => onOffsetChange({ x: 0, y: 0 })}
      >
        Zerar deslocamento
      </button>

      <div className="lb-section__row">
        <span className="lb-label">Tamanho de célula atual</span>
        <span className="lb-num">{Math.round(cellSize)} px</span>
      </div>
    </section>
  )
}
