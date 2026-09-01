import type { DoorKind } from '../types/map'
import { DoorIcon } from './icons'

interface KindArtProps {
  size?: number
}

/** Duas folhas arqueando pra fora do centro — distingue de `DoorIcon` (1 folha,
 *  arco de uma ombreira só). Mesma convenção de contorno das demais famílias de
 *  ícone (`components/icons.tsx`): `strokeWidth` 1.6, `viewBox` 24, sem fill. */
function DoubleDoorArt({ size = 18 }: KindArtProps) {
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
      <path d="M7 4v16M17 4v16" />
      <path d="M12 20a5 5 0 005-5M12 20a5 5 0 01-5-5" />
    </svg>
  )
}

/** Barras verticais uniformes entre as ombreiras — grade/portão, sem dobradiça
 *  (não sugere folha que gira, diferente das outras duas). */
function GateArt({ size = 18 }: KindArtProps) {
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
      <path d="M5 4v16M19 4v16" />
      <path d="M9 4v16M12 4v16M15 4v16" />
    </svg>
  )
}

export interface DoorKindControlsProps {
  kind: DoorKind
  onKindChange: (kind: DoorKind) => void
}

const OPTIONS: Array<{ kind: DoorKind; label: string }> = [
  { kind: 'normal', label: 'Normal' },
  { kind: 'double', label: 'Dupla' },
  { kind: 'gate', label: 'Portão' },
]

function KindArt({ kind }: { kind: DoorKind }) {
  if (kind === 'double') return <DoubleDoorArt />
  if (kind === 'gate') return <GateArt />
  return <DoorIcon />
}

/**
 * Escolha do tipo estrutural da porta (`DoorKind` — `normal | double | gate`,
 * ver `types/map.ts`). Cada tipo muda só render (aqui + `pixi/drawDoors.ts`) e
 * o comprimento do vão (`DOOR_LENGTH_BY_KIND`, no store — ver CONTRATO).
 *
 * Mesmo padrão de `WallStyleControls`/`GridShapePicker`: o chamador decide a
 * fonte, este componente só mostra o controle. Duas ligações possíveis —
 *  - preferência da PRÓXIMA porta: `doorKind`/`setDoorKind` (store, sem histórico);
 *  - a porta JÁ SELECIONADA: `selectedWall.door.kind`/`(k) => setWallDoorKind(selectedWall.id, k)` (com histórico).
 */
export function DoorKindControls({ kind, onKindChange }: DoorKindControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Tipo de porta</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Tipo de porta">
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            role="radio"
            aria-checked={kind === option.kind}
            className="lb-seg__option"
            onClick={() => onKindChange(option.kind)}
          >
            <KindArt kind={option.kind} />
            {option.label}
          </button>
        ))}
      </div>
    </section>
  )
}
