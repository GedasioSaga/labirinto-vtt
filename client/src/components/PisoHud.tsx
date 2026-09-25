import { PISO_MAX, PISO_MIN, nomeDoPiso } from '../lib/pisos'
import './PisoHud.css'

export interface PisoHudProps {
  /** O piso que o editor mostra e em que ele constrói (0 = térreo). */
  piso: number
  onPisoChange: (piso: number) => void
}

/** "Térreo", "1º piso": o nome do piso com a inicial maiúscula, para o rótulo solto no canto. */
function rotuloDoPiso(piso: number): string {
  const nome = nomeDoPiso(piso)
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/**
 * PISOS NA MESMA CENA — o piso em edição, no canto do canvas, acima do zoom.
 * O editor desenha e mira só este piso, e tudo que o mestre cria nasce nele;
 * os botões sobem e descem um piso (o de cima pode estar vazio: é assim que
 * um piso novo começa). Plano em `docs/planos/pisos-na-mesma-cena.md`.
 */
export function PisoHud({ piso, onPisoChange }: PisoHudProps) {
  const acima = piso + 1
  const abaixo = piso - 1
  return (
    <div className="lb-panel lb-pisohud" role="group" aria-label="Piso em edição">
      <button
        type="button"
        className="lb-pisohud__step"
        disabled={abaixo < PISO_MIN}
        onClick={() => onPisoChange(abaixo)}
        aria-label={`Editar o ${nomeDoPiso(abaixo)}`}
        title={`Editar o ${nomeDoPiso(abaixo)}`}
      >
        <span aria-hidden="true">▼</span>
      </button>
      <span className="lb-pisohud__value" aria-live="polite">
        {rotuloDoPiso(piso)}
      </span>
      <button
        type="button"
        className="lb-pisohud__step"
        disabled={acima > PISO_MAX}
        onClick={() => onPisoChange(acima)}
        aria-label={`Editar o ${nomeDoPiso(acima)}`}
        title={`Editar o ${nomeDoPiso(acima)}`}
      >
        <span aria-hidden="true">▲</span>
      </button>
    </div>
  )
}
