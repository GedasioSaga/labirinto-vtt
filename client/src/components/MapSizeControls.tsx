import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isValidMapSide } from '../lib/mapFactory'

export interface MapSizeControlsProps {
  /** `MapData.width` atual, em quadros. */
  width: number
  /** `MapData.height` atual, em quadros. */
  height: number
  /** Troca o tamanho do mapa inteiro (`mapStore.setMapSize`, 1 Ctrl+Z desfaz).
   *  Só no Aplicar ou no Enter, nunca a cada tecla: largura e altura são dois
   *  campos, e cada tecla viraria uma entrada de undo e um envio aos jogadores. */
  onApply: (width: number, height: number) => void
}

const SIDE_ERROR = 'Use um número inteiro de 1 para cima.'

/** Texto do campo como lado do mapa; `null` = vazio, zero, negativo, fração ou lixo. */
function parseSide(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return isValidMapSide(value) ? value : null
}

/**
 * "Tamanho do mapa" na janela Configurações do mapa. Aumentar põe quadros
 * novos à direita e embaixo e deixa tudo o que existe no mesmo lugar — e é
 * esse "mesmo lugar" que deixa o explorado de cada jogador onde estava
 * (`hostSession.existingMemory`), com a faixa nova preta.
 */
export function MapSizeControls({ width, height, onApply }: MapSizeControlsProps) {
  const [widthText, setWidthText] = useState(String(width))
  const [heightText, setHeightText] = useState(String(height))
  // Erro só depois de tentar aplicar: não reprovar a cada tecla da digitação.
  const [showErrors, setShowErrors] = useState(false)
  const widthRef = useRef<HTMLInputElement>(null)
  const heightRef = useRef<HTMLInputElement>(null)
  const applyRef = useRef<HTMLButtonElement>(null)

  // O mapa mudou de tamanho por fora (aplicado aqui, outra cena aberta): os
  // campos voltam a dizer o tamanho de verdade.
  useEffect(() => {
    setWidthText(String(width))
    setHeightText(String(height))
    setShowErrors(false)
  }, [width, height])

  const nextWidth = parseSide(widthText)
  const nextHeight = parseSide(heightText)
  const widthError = showErrors && nextWidth === null
  const heightError = showErrors && nextHeight === null
  const unchanged = nextWidth === width && nextHeight === height

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (nextWidth === null || nextHeight === null) {
      setShowErrors(true)
      ;(nextWidth === null ? widthRef : heightRef).current?.focus()
      return
    }
    if (unchanged) return
    // O botão desabilita quando o tamanho novo chega: o foco não pode ficar
    // num botão desabilitado (cai no body e sai da janela).
    if (document.activeElement === applyRef.current) widthRef.current?.focus()
    onApply(nextWidth, nextHeight)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Tamanho do mapa</h2>
      <form onSubmit={apply} noValidate>
        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-mapsize-width">
            Largura (quadros)
          </label>
          <input
            ref={widthRef}
            id="lb-mapsize-width"
            className="lb-input"
            type="number"
            min={1}
            step={1}
            value={widthText}
            aria-invalid={widthError || undefined}
            aria-describedby={widthError ? 'lb-mapsize-width-error lb-mapsize-hint' : 'lb-mapsize-hint'}
            onChange={(event) => setWidthText(event.target.value)}
          />
          {widthError && (
            <p id="lb-mapsize-width-error" className="lb-field__error">
              {SIDE_ERROR}
            </p>
          )}
        </div>

        <div className="lb-field">
          <label className="lb-label" htmlFor="lb-mapsize-height">
            Altura (quadros)
          </label>
          <input
            ref={heightRef}
            id="lb-mapsize-height"
            className="lb-input"
            type="number"
            min={1}
            step={1}
            value={heightText}
            aria-invalid={heightError || undefined}
            aria-describedby={heightError ? 'lb-mapsize-height-error lb-mapsize-hint' : 'lb-mapsize-hint'}
            onChange={(event) => setHeightText(event.target.value)}
          />
          {heightError && (
            <p id="lb-mapsize-height-error" className="lb-field__error">
              {SIDE_ERROR}
            </p>
          )}
        </div>

        <p id="lb-mapsize-hint" className="lb-field__hint">
          Aumentar põe quadros novos à direita e embaixo: o que já está desenhado fica no mesmo lugar, e o que os
          jogadores exploraram também. Diminuir tira quadros da direita e de baixo.
        </p>

        <button
          ref={applyRef}
          id="lb-mapsize-apply"
          type="submit"
          className="lb-btn lb-btn--primary lb-btn--block"
          disabled={unchanged}
        >
          {nextWidth !== null && nextHeight !== null ? `Aplicar ${nextWidth} × ${nextHeight}` : 'Aplicar tamanho'}
        </button>
      </form>
    </section>
  )
}
