import { MAX_PATH_WIDTH_CELLS, MIN_PATH_WIDTH_CELLS } from '../lib/drawingFactory'

export interface PathStyleControlsProps {
  /** Cor do PRÓXIMO caminho (`pathColor` no mapStore). */
  color: string
  onColorChange: (color: string) => void
  /** Largura do PRÓXIMO caminho, em células da grade. */
  widthCells: number
  onWidthCellsChange: (widthCells: number) => void
}

/** Passo do controle: meia célula é a menor diferença que o olho separa numa
 *  trilha, e evita larguras quebradas que ninguém pediu. */
const WIDTH_STEP_CELLS = 0.5

/** "1 célula" / "2,5 células" — vírgula decimal, que é como se lê em pt-BR. */
function larguraEmTexto(widthCells: number): string {
  const numero = widthCells.toLocaleString('pt-BR')
  return `${numero} ${widthCells === 1 ? 'célula' : 'células'}`
}

/**
 * Cor e largura do PRÓXIMO caminho, com a ferramenta "Caminho" na mão.
 *
 * O ponto da seção é a ORDEM: a cor é escolhida ANTES do primeiro ponto, e
 * fica gravada naquele caminho (`Drawing.color`). É isso que separa esta
 * seção de "Cor do chão" (`FloorStyleControls`), que repinta o mapa inteiro:
 * aqui, traçar o caminho de pedra não mexe no de terra que já está na planta.
 *
 * Caminho JÁ traçado não se edita aqui — clicar nele com Selecionar abre
 * "Estilo do desenho selecionado", que já tem cor e espessura.
 */
export function PathStyleControls({ color, onColorChange, widthCells, onWidthCellsChange }: PathStyleControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Caminho</h2>

      <div className="lb-section__row">
        <label className="lb-label" htmlFor="lb-path-color">
          Cor deste caminho
        </label>
        <input
          id="lb-path-color"
          className="lb-swatch"
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-path-width">
            Largura
          </label>
          <span className="lb-num">{larguraEmTexto(widthCells)}</span>
        </div>
        <input
          id="lb-path-width"
          className="lb-range"
          type="range"
          min={MIN_PATH_WIDTH_CELLS}
          max={MAX_PATH_WIDTH_CELLS}
          step={WIDTH_STEP_CELLS}
          value={widthCells}
          onChange={(event) => onWidthCellsChange(Number(event.target.value))}
        />
        {/* Amostra na cor e na proporção escolhidas — a mesma ideia da
            `.lb-stroke-preview` do Estilo de desenho, para a largura em
            células deixar de ser um número abstrato. */}
        <div className="lb-stroke-preview">
          <span
            className="lb-stroke-preview__line"
            style={{ height: Math.max(2, widthCells * 8), background: color, borderRadius: 999 }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
