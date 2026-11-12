import type { OffFloor } from '../lib/offFloor'
import { SCENE_VISION_CELLS_MAX, SCENE_VISION_CELLS_MIN, readSceneVisionCells } from '../lib/sceneVision'
import { Toggle } from './Toggle'

export interface SceneVisionControlsProps {
  /** "Visão nesta cena", em quadrados; `undefined` = sem valor. */
  visionCells: number | undefined
  onVisionCellsChange: (cells: number | undefined) => void
  /** "Cena escura" (`MapData.dark`). Ausente omite o toggle. */
  dark?: boolean
  onDarkChange?: (dark: boolean) => void
  /**
   * "Fora do Chão" da cena (`MapData.offFloor`, `lib/offFloor.ts`), já
   * resolvido: cena sem o campo chega aqui como `'blocked'`. Sem
   * `onOffFloorChange` o controle não aparece.
   */
  offFloor?: OffFloor
  onOffFloorChange?: (offFloor: OffFloor) => void
  /** A cena tem alguma peça de Chão? Sem nenhuma não há borda para barrar, e o controle fica desligado. */
  temChao?: boolean
}

const OPCOES_DO_FORA_DO_CHAO: readonly { valor: OffFloor; rotulo: string }[] = [
  { valor: 'blocked', rotulo: 'Bloqueado' },
  { valor: 'free', rotulo: 'Livre' },
]

/** A linha embaixo do "Fora do Chão": o que a escolha faz, ou por que não há o que escolher. */
function dicaDoForaDoChao(offFloor: OffFloor, temChao: boolean): string {
  if (!temChao) return 'Esta cena não tem Chão: a ficha já anda e enxerga em qualquer lugar.'
  return offFloor === 'free'
    ? 'A ficha anda e enxerga em qualquer lugar. O que está fora do Chão passa a aparecer para o jogador. Só parede, porta, escuridão e o alcance da visão limitam.'
    : 'A ficha do jogador só anda e enxerga dentro do Chão desta cena.'
}

/**
 * "Visão nesta cena": até onde o jogador enxerga nesta cena, em quadrados.
 * Mapa-mundi longe, mina perto — o mestre acerta uma vez por cena, não o raio
 * de cada jogador a cada viagem. O "Fator de visão" de cada jogador (painel
 * Sala) multiplica este número. Vazio = o raio em px de cada jogador, como antes.
 *
 * "Cena escura": o jogador só vê a casa em volta da ficha e o que uma Luz
 * ilumina, mesmo além do raio (`lib/darkness.ts`).
 *
 * "Fora do Chão" (pedido de 12/11/2026): Bloqueado, a ficha do jogador só anda
 * e enxerga dentro das peças de Chão da cena; Livre, o Chão vira só pintura
 * (`lib/offFloor.ts`). Escolha única no padrão `lb-seg` do "Tipo de mapa".
 */
export function SceneVisionControls({
  visionCells,
  onVisionCellsChange,
  dark,
  onDarkChange,
  offFloor,
  onOffFloorChange,
  temChao = true,
}: SceneVisionControlsProps) {
  function change(text: string) {
    if (text.trim() === '') {
      onVisionCellsChange(undefined)
      return
    }
    // Número fora da faixa (0, fração, negativo) não grava: o campo volta ao valor que vale.
    const cells = readSceneVisionCells(Number(text))
    if (cells !== undefined) onVisionCellsChange(cells)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Visão dos jogadores</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-scene-vision">
          Visão nesta cena (quadrados)
        </label>
        <input
          id="lb-scene-vision"
          className="lb-input"
          type="number"
          inputMode="numeric"
          min={SCENE_VISION_CELLS_MIN}
          max={SCENE_VISION_CELLS_MAX}
          step={1}
          placeholder="Sem valor"
          value={visionCells ?? ''}
          aria-describedby="lb-scene-vision-hint"
          onChange={(event) => change(event.target.value)}
        />
        <p id="lb-scene-vision-hint" className="lb-field__hint">
          Vale para todo jogador nesta cena, vezes o fator de visão dele (painel Sala). Vazio: cada um usa o raio em px de sempre.
        </p>
      </div>
      {dark !== undefined && onDarkChange !== undefined && (
        <>
          <Toggle label="Cena escura" checked={dark} onChange={onDarkChange} describedBy="lb-scene-dark-hint" />
          <p id="lb-scene-dark-hint" className="lb-field__hint">
            O jogador só vê a casa em volta da ficha e o que uma Luz ilumina, mesmo de longe. Você continua vendo tudo.
          </p>
        </>
      )}
      {offFloor !== undefined && onOffFloorChange !== undefined && (
        <div className="lb-field">
          <span className="lb-label">Fora do Chão</span>
          <div className="lb-seg" role="radiogroup" aria-label="Fora do Chão" aria-describedby="lb-scene-offfloor-hint">
            {OPCOES_DO_FORA_DO_CHAO.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                role="radio"
                // Sem Chão nenhuma opção acende: o marcado pintaria de latão um controle que não vale nada aqui.
                aria-checked={temChao && offFloor === opcao.valor}
                className="lb-seg__option"
                disabled={!temChao}
                onClick={() => onOffFloorChange(opcao.valor)}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
          <p id="lb-scene-offfloor-hint" className="lb-field__hint">
            {dicaDoForaDoChao(offFloor, temChao)}
          </p>
        </div>
      )}
    </section>
  )
}
