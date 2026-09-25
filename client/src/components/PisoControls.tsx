import { useEffect, useId, useState } from 'react'
import { PISO_MAX, PISO_MIN, nomeDoPiso, pisoDigitado } from '../lib/pisos'

export interface PisoControlsProps {
  /** O piso da ficha ou da escada selecionada (0 = térreo). */
  piso: number
  onPisoChange: (piso: number) => void
  /**
   * Só na escada: o piso a que ela leva (`null` = de enfeite). Ausente = o
   * campo "Leva ao piso" não aparece (ficha).
   */
  levaAoPiso?: number | null
  onLevaAoPisoChange?: (piso: number | null) => void
  /** O piso em edição no editor: decide qual lado da escada é "o outro". */
  pisoAtivo?: number
  /** Só na escada que liga pisos: "Editar o 1º piso" leva o editor ao outro lado dela. */
  onEditarPiso?: (piso: number) => void
}

export const PISO_HINT = 'O jogador vê só o piso da ficha dele. 0 é o térreo; negativo, subsolo.'
export const LEVA_AO_PISO_HINT = 'Vazio: escada de enfeite. Com número, a ficha encostada nela ganha "Subir"/"Descer" e troca de piso no mesmo ponto.'

interface CampoDePisoProps {
  label: string
  value: number | null
  /** Aceita apagar o campo (vira `null`)? Só o "Leva ao piso". */
  podeFicarVazio: boolean
  describedBy: string
  onCommit: (value: number | null) => void
}

/**
 * Campo numérico que guarda o que está sendo digitado ("-" antes do "-2") e só
 * grava número que serve como piso (`pisoDigitado`). Ao sair do campo, o texto
 * volta ao valor gravado: o que não virou piso não fica fingindo que virou.
 */
function CampoDePiso({ label, value, podeFicarVazio, describedBy, onCommit }: CampoDePisoProps) {
  const id = useId()
  const gravado = value === null ? '' : String(value)
  const [texto, setTexto] = useState(gravado)
  // Desfazer, outra seleção ou o jogador subindo: o campo mostra o valor novo.
  useEffect(() => setTexto(gravado), [gravado])
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="lb-input"
        type="number"
        inputMode="numeric"
        step={1}
        min={PISO_MIN}
        max={PISO_MAX}
        value={texto}
        placeholder={podeFicarVazio ? 'nenhum' : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value
          setTexto(raw)
          if (raw.trim() === '') {
            if (podeFicarVazio) onCommit(null)
            return
          }
          const piso = pisoDigitado(Number(raw))
          if (piso !== null) onCommit(piso)
        }}
        onBlur={() => setTexto(gravado)}
      />
    </div>
  )
}

/**
 * PISOS NA MESMA CENA — o piso da ficha ou da escada selecionada e, na escada,
 * o piso a que ela leva. Efeito imediato, com Ctrl+Z (quem grava passa por
 * `withHistory`). Plano em `docs/planos/pisos-na-mesma-cena.md`.
 */
export function PisoControls({ piso, onPisoChange, levaAoPiso, onLevaAoPisoChange, pisoAtivo, onEditarPiso }: PisoControlsProps) {
  const hintId = useId()
  const levaHintId = useId()
  const escada = levaAoPiso !== undefined && onLevaAoPisoChange !== undefined
  // O outro lado da escada, visto do piso em edição: é para lá que o mestre vai construir.
  const outroLado = levaAoPiso === undefined || levaAoPiso === null || levaAoPiso === piso ? null : pisoAtivo === levaAoPiso ? piso : levaAoPiso
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Piso</h2>
      <CampoDePiso
        label="Piso"
        value={piso}
        podeFicarVazio={false}
        describedBy={hintId}
        onCommit={(value) => {
          if (value !== null) onPisoChange(value)
        }}
      />
      <p className="lb-field__hint" id={hintId}>
        {PISO_HINT}
      </p>
      {escada && (
        <>
          <CampoDePiso label="Leva ao piso" value={levaAoPiso} podeFicarVazio describedBy={levaHintId} onCommit={onLevaAoPisoChange} />
          <p className="lb-field__hint" id={levaHintId}>
            {LEVA_AO_PISO_HINT}
          </p>
          {outroLado !== null && onEditarPiso !== undefined && (
            <button type="button" className="lb-btn lb-btn--block" onClick={() => onEditarPiso(outroLado)}>
              {`Editar o ${nomeDoPiso(outroLado)}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export interface LevarAoPisoControlsProps {
  /** O piso em edição (a seleção está nele). */
  pisoAtivo: number
  /** Leva a seleção inteira ao piso dado; o editor vai junto. */
  onLevar: (piso: number) => void
}

export const LEVAR_AO_PISO_HINT = 'A sala vai com as paredes e as sub-salas; a ficha, com a luz que carrega. O editor passa a mostrar o piso de destino.'

/**
 * PISOS NA MESMA CENA — "Levar ao piso" da seleção: qualquer coisa
 * selecionada (parede, sala, peça de chão, luz, objeto, desenho, ficha,
 * escada) sobe ou desce um piso, num passo só do Ctrl+Z.
 */
export function LevarAoPisoControls({ pisoAtivo, onLevar }: LevarAoPisoControlsProps) {
  const hintId = useId()
  const acima = pisoAtivo + 1
  const abaixo = pisoAtivo - 1
  return (
    <section className="lb-section">
      <button type="button" className="lb-btn lb-btn--block" aria-describedby={hintId} disabled={acima > PISO_MAX} onClick={() => onLevar(acima)}>
        {`Levar ao ${nomeDoPiso(acima)}`}
      </button>
      <button type="button" className="lb-btn lb-btn--block" aria-describedby={hintId} disabled={abaixo < PISO_MIN} onClick={() => onLevar(abaixo)}>
        {`Levar ao ${nomeDoPiso(abaixo)}`}
      </button>
      <p className="lb-field__hint" id={hintId}>
        {LEVAR_AO_PISO_HINT}
      </p>
    </section>
  )
}
