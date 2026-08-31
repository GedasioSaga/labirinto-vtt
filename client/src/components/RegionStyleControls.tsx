import type { Region } from '../types/map'
import { Toggle } from './Toggle'

export interface RegionStyleControlsProps {
  color: string
  onColorChange: (color: string) => void
  pattern: Region['fillPattern']
  onPatternChange: (pattern: Region['fillPattern']) => void
  /**
   * Presente só quando há uma Região selecionada (`selection?.kind === 'region'`)
   * — o chamador decide isso. Preenche as arestas da região sem parede ainda
   * (Regiao solta, ou Sala que perdeu parede apagada) com um clique.
   */
  onLinkWalls?: () => void
  /**
   * Presente só quando há uma Região selecionada — simplifica o contorno
   * (Douglas-Peucker) e arredonda os cantos restantes (Chaikin), transformando
   * um contorno serrilhado/pixelado (ex.: extraído de imagem) numa curva limpa.
   */
  onSmoothRegion?: () => void
}

/**
 * Cor e padrão de preenchimento da região: antes de desenhar (liga em
 * `regionFillColor`/`regionFillPattern`) ou editando a região já selecionada
 * (liga em `setRegionColor`/`setRegionPattern`) — o chamador decide qual fonte
 * usar, este componente só mostra os controles.
 */
export function RegionStyleControls({ color, onColorChange, pattern, onPatternChange, onLinkWalls, onSmoothRegion }: RegionStyleControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Região</h2>
      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-region-color">
          Cor
        </label>
        <input
          id="lb-region-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>
      <Toggle
        label="Hachurado"
        checked={pattern === 'hatch'}
        onChange={(checked) => onPatternChange(checked ? 'hatch' : 'solid')}
      />
      {onLinkWalls && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onLinkWalls}>
          Criar parede na borda
        </button>
      )}
      {onSmoothRegion && (
        <button type="button" className="lb-btn lb-btn--block" onClick={onSmoothRegion}>
          Suavizar contorno
        </button>
      )}
    </section>
  )
}
