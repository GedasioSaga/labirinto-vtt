import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { TokenHealth } from '../types/map'
import { HEALTH_LIMIT, sameHealth, withCurrentHealth, withMaxHealth } from '../lib/tokenHealth'
import { Toggle } from './Toggle'

export interface TokenHealthControlsProps {
  /** Vida da ficha selecionada, já lida por `readTokenHealth`; `null` = ficha sem barra. */
  health: TokenHealth | null
  /** `null` tira a barra da ficha. */
  onHealthChange: (health: TokenHealth | null) => void
}

/** Setas: um ponto por toque — o golpe mais comum; com Shift, cinco. */
const ARROW_STEP = 1
const ARROW_STEP_SHIFT = 5

/** O número que está digitado no campo; vazio ou lixo = nada a confirmar. Aceita vírgula. */
function parseHealthText(text: string | null): number | null {
  if (text === null || text.trim() === '') return null
  const typed = Number(text.replace(',', '.'))
  return Number.isFinite(typed) ? Math.round(typed) : null
}

interface HealthFieldProps {
  label: string
  /** O número gravado na ficha; `null` = ficha sem vida (campo vazio). */
  value: number | null
  min: number
  max: number
  onCommit: (value: number) => void
}

/**
 * Um campo de pontos de vida. Mesmo contrato do campo Rotação da sala
 * (`RoomControls`): digitar NÃO grava a cada tecla — "173" passaria por 1 e
 * 17, e a barra piscaria três vezes para um número só. Sair do campo (Tab) ou
 * Enter confirma; Esc desiste do que foi digitado. Seta para cima/baixo grava
 * na hora: é o "levou 1 de dano" do meio da luta, sem apagar e redigitar.
 */
function HealthField({ label, value, min, max, onCommit }: HealthFieldProps) {
  const inputId = useId()
  // `null` = ninguém está digitando: o campo mostra o número da ficha.
  const [draft, setDraftState] = useState<string | null>(null)
  // O mesmo rascunho num ref, para a limpeza de desmontagem ler o que estava
  // digitado — o estado ela veria velho.
  const draftRef = useRef<string | null>(null)
  const setDraft = (text: string | null) => {
    draftRef.current = text
    setDraftState(text)
  }
  const onCommitRef = useRef(onCommit)
  useEffect(() => {
    onCommitRef.current = onCommit
  })
  // Número digitado e não confirmado, e o campo SOME: outra ficha foi
  // escolhida no mapa. O clique no mapa seleciona a outra ANTES de o campo
  // perder o foco, então o `blur` gravaria o número na ficha errada — o painel
  // remonta a cada ficha (`key` em `PropertiesPanel`) e é aqui, com o callback
  // do último render DESTE campo, que "sair do campo confirma" vale.
  useEffect(
    () => () => {
      const typed = parseHealthText(draftRef.current)
      if (typed !== null) onCommitRef.current(typed)
    },
    [],
  )

  const commit = () => {
    if (draft === null) return
    const typed = parseHealthText(draft)
    setDraft(null)
    if (typed !== null) onCommit(typed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape' && draft !== null) {
      // Só engole o Esc quando há digitação a desfazer: sem ela, o Esc segue
      // viagem e larga a ficha, como em qualquer campo do painel.
      event.preventDefault()
      event.stopPropagation()
      setDraft(null)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const base = parseHealthText(draft) ?? value
      // Sem número nenhum a seta não inventa vida: fica com o passo nativo do campo.
      if (base === null) return
      event.preventDefault()
      const step = (event.shiftKey ? ARROW_STEP_SHIFT : ARROW_STEP) * (event.key === 'ArrowUp' ? 1 : -1)
      setDraft(null)
      onCommit(base + step)
    }
  }

  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="lb-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft ?? (value === null ? '' : String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </div>
  )
}

/**
 * VIDA da ficha selecionada — o que desenha a barra fina sob ela no mapa.
 * "Ninguém sabe quanto falta para o monstro cair sem o mestre narrar."
 *
 * "Vida atual" e "Vida máxima" lado a lado, separadas por "/", como se anota
 * na ficha de papel (7/10). Ficha sem vida: o primeiro número vale para as duas
 * (`lib/tokenHealth.ts`). Com vida: "Jogadores veem a barra", DESLIGADO de
 * fábrica — a barra de um monstro não vai à mesa antes de o mestre decidir, e
 * mesmo ligada a mesa recebe a proporção, nunca os pontos. O "Oculto para
 * jogadores" de `ItemTransformControls` é outra coisa: esconde a ficha inteira.
 */
export function TokenHealthControls({ health, onHealthChange }: TokenHealthControlsProps) {
  const hintId = `${useId()}-quem-ve`
  // Grava só o que mudou: o Tab que passa pelo campo sem trocar o número não
  // empurra um Ctrl+Z vazio para a pilha do desfazer.
  const change = (next: TokenHealth | null) => {
    if (!sameHealth(health, next)) onHealthChange(next)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Vida</h2>
      <div className="lb-health">
        <HealthField
          label="Vida atual"
          value={health?.current ?? null}
          min={0}
          max={health?.max ?? HEALTH_LIMIT}
          onCommit={(current) => change(withCurrentHealth(health, current))}
        />
        <span className="lb-health__slash" aria-hidden="true">
          /
        </span>
        <HealthField
          label="Vida máxima"
          value={health?.max ?? null}
          min={1}
          max={HEALTH_LIMIT}
          onCommit={(max) => change(withMaxHealth(health, max))}
        />
      </div>
      {health === null ? (
        <p className="lb-field__hint">Preencha a vida e uma barra fina aparece sob a ficha. Os jogadores só a veem se você deixar.</p>
      ) : (
        <>
          <Toggle
            label="Jogadores veem a barra"
            checked={health.shownToPlayers}
            onChange={(shownToPlayers) => change({ ...health, shownToPlayers })}
            describedBy={hintId}
          />
          <p className="lb-field__hint" id={hintId}>
            {health.shownToPlayers ? 'A mesa vê a barra, sem os números.' : 'Só você vê a barra desta ficha.'}
          </p>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onHealthChange(null)}>
            Remover barra de vida
          </button>
        </>
      )}
    </section>
  )
}
