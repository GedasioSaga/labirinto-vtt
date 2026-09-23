import type { DoorMode } from '../types/tools'
import { DoorIcon } from './icons'

interface ArtProps {
  size?: number
}

/**
 * O vão: a MESMA linha de parede das outras duas ombreiras, com um pedaço
 * FALTANDO no meio. Nada é desenhado no lugar do trecho — é essa ausência que
 * o ícone precisa mostrar, porque é literalmente o que a ferramenta faz
 * (`lib/mapFactory.addOpeningOnWall`). Mesma convenção de contorno das demais
 * famílias de ícone (`components/icons.tsx`): `strokeWidth` 1.6, `viewBox` 24,
 * sem fill.
 */
function OpeningArt({ size = 18 }: ArtProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Os dois pedaços de parede que sobram, e o vão entre eles. */}
      <path d="M4 12h5M15 12h5" />
      {/* As ombreiras: onde a parede foi cortada. */}
      <path d="M9 8v8M15 8v8" />
    </svg>
  )
}

export interface DoorModeControlsProps {
  mode: DoorMode
  onModeChange: (mode: DoorMode) => void
}

const OPTIONS: Array<{ mode: DoorMode; label: string }> = [
  { mode: 'porta', label: 'Porta' },
  { mode: 'vao', label: 'Vão aberto' },
]

function ModeArt({ mode }: { mode: DoorMode }) {
  return mode === 'vao' ? <OpeningArt /> : <DoorIcon />
}

/**
 * O que o clique da ferramenta "Porta" abre na parede (`DoorMode`,
 * `types/tools.ts`): a PORTA de sempre — um objeto que fecha, tranca e
 * aparece no desenho — ou o VÃO ABERTO, que tira o trecho da parede e deixa
 * passagem livre ali, sem desenhar nada no lugar.
 *
 * Fica ao lado de `DoorKindControls` de propósito: é a mesma ferramenta e o
 * mesmo gesto (clicar em cima da linha da parede), só muda o que nasce do
 * clique. Com "Vão aberto" escolhido, o painel deixa de oferecer "Tipo de
 * porta" — não existe porta normal/dupla/portão de um buraco.
 *
 * Mesmo padrão de `DoorKindControls`/`WallStyleControls`: o chamador decide a
 * fonte (aqui, sempre `doorMode`/`setDoorMode` do store — é preferência da
 * PRÓXIMA abertura, nunca de algo já criado), este componente só mostra.
 */
export function DoorModeControls({ mode, onModeChange }: DoorModeControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Abrir na parede</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Abrir na parede">
        {OPTIONS.map((option) => (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={mode === option.mode}
            className="lb-seg__option"
            onClick={() => onModeChange(option.mode)}
          >
            <ModeArt mode={option.mode} />
            {option.label}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">
        {mode === 'vao'
          ? 'Clique em cima da linha da parede: o trecho some e a passagem fica livre.'
          : 'Clique em cima da linha da parede: nasce uma porta, que abre, fecha e tranca.'}
      </p>
    </section>
  )
}
