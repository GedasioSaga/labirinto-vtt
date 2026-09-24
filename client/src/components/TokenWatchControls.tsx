import type { TokenWatch } from '../types/map'
import { WATCH_APERTURES, WATCH_APERTURE_MAX, WATCH_DEFAULT, WATCH_DIRECTIONS, WATCH_RANGES } from '../lib/npcWatch'
import { Toggle } from './Toggle'

export interface TokenWatchControlsProps {
  /** Vigia da ficha selecionada, já lida (`readTokenWatch`); `null` = ficha comum. */
  watch: TokenWatch | null
  /** A vigia inteira nova, ou `null` para desligar. */
  onWatchChange: (watch: TokenWatch | null) => void
}

/** Seta da direção, desenhada na mesma caixa 18×18 das miniaturas do painel. Gira com a direção. */
function DirectionArt({ degrees }: { degrees: number }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <g transform={`rotate(${degrees} 9 9)`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9H15M11 5L15 9L11 13" />
      </g>
    </svg>
  )
}

function apertureLabel(degrees: number): string {
  return degrees >= WATCH_APERTURE_MAX ? 'Em volta' : `${degrees} graus`
}

/**
 * OLHOS DO GUARDA — liga a vigia de uma ficha de NPC e diz como ela olha. O
 * cone aparece na hora no mapa do mestre (`pixi/drawNpcWatch.ts`); quem joga
 * só vê a marca (?, !) em cima do guarda.
 *
 * Interruptor nativo (`Toggle`) para ligar; ligada, três fileiras `lb-seg` de
 * rádio — o mesmo controle do "Tamanho da ficha" (`TokenSizeControls`): um
 * clique por escolha, estado marcado e teclado já prontos. Cada escolha passa
 * pelo histórico (`updateToken`), então Ctrl+Z desfaz.
 */
export function TokenWatchControls({ watch, onWatchChange }: TokenWatchControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Vigia</h2>
      <Toggle label="Esta ficha vigia" checked={watch !== null} onChange={(on) => onWatchChange(on ? WATCH_DEFAULT : null)} />
      {watch !== null && (
        <>
          <span className="lb-label">Para onde olha</span>
          <div className="lb-seg" role="radiogroup" aria-label="Para onde olha">
            {WATCH_DIRECTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={watch.direcao === option.value}
                aria-label={option.label}
                title={option.label}
                className="lb-seg__option"
                onClick={() => onWatchChange({ ...watch, direcao: option.value })}
              >
                <DirectionArt degrees={option.value} />
              </button>
            ))}
          </div>
          <span className="lb-label">Abertura do olhar</span>
          <div className="lb-seg" role="radiogroup" aria-label="Abertura do olhar">
            {WATCH_APERTURES.map((degrees) => (
              <button
                key={degrees}
                type="button"
                role="radio"
                aria-checked={watch.abertura === degrees}
                aria-label={apertureLabel(degrees)}
                className="lb-seg__option"
                onClick={() => onWatchChange({ ...watch, abertura: degrees })}
              >
                {degrees >= WATCH_APERTURE_MAX ? 'Em volta' : `${degrees}°`}
              </button>
            ))}
          </div>
          <span className="lb-label">Alcance</span>
          <div className="lb-seg" role="radiogroup" aria-label="Alcance">
            {WATCH_RANGES.map((squares) => (
              <button
                key={squares}
                type="button"
                role="radio"
                aria-checked={watch.alcance === squares}
                aria-label={`${squares} quadrados`}
                className="lb-seg__option"
                onClick={() => onWatchChange({ ...watch, alcance: squares })}
              >
                {squares}
              </button>
            ))}
          </div>
          {/* O mestre precisa saber o que sai para a mesa e o que fica com ele. */}
          <span className="lb-label">O cone só você vê. Quem joga vê "?" ou "!" em cima do guarda quando ele avista alguém.</span>
        </>
      )}
    </section>
  )
}
