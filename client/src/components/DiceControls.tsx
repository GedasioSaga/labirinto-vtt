import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  DICE_COUNT_MAX,
  DICE_COUNT_MIN,
  DICE_FEED_VISIBLE,
  DICE_MODIFIER_LIMIT,
  DICE_SIDES,
  formatDiceExpression,
  formatDiceTotal,
  isDiceCount,
  isDiceModifier,
  rollerLabel,
  type DiceRequest,
  type DiceSides,
  type HostDiceRoll,
} from '../lib/dice'
import './Dice.css'

/**
 * DADO ROLADO NA SALA, as peças que o mestre (`DiceDock`) e o jogador (aba
 * "Dados" do painel) dividem: o formulário e a lista de rolagens. Nenhuma das
 * duas rola nada — o formulário só PEDE; o resultado vem do host.
 */

/** O dado que o formulário abre marcado: o da maioria das jogadas. */
const DEFAULT_SIDES: DiceSides = 20

type FieldError = 'count' | 'modifier'

const ERROR_TEXT: Record<FieldError, string> = {
  count: `Quantidade de ${DICE_COUNT_MIN} a ${DICE_COUNT_MAX}.`,
  modifier: `Modificador de −${DICE_MODIFIER_LIMIT} a +${DICE_MODIFIER_LIMIT}.`,
}

/** Campo numérico como texto: vazio no modificador vale zero (é o "sem modificador"). */
function parseField(text: string, emptyValue: number | null): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return emptyValue
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function countOf(text: string): number | null {
  const value = parseField(text, null)
  return isDiceCount(value) ? value : null
}

function modifierOf(text: string): number | null {
  const value = parseField(text, 0)
  return isDiceModifier(value) ? value : null
}

export interface DiceFormProps {
  onRoll: (request: DiceRequest, hidden: boolean) => void
  /** Só o mestre: mostra o "Rolar escondido". */
  allowHidden?: boolean
}

/**
 * d4 a d20, Quantidade, Modificador e "Rolar". Escolher o dado NÃO rola:
 * rola o botão, ou Enter num campo. Valor fora da faixa não rola — o aviso
 * fica junto do campo, o que foi digitado continua lá e o foco vai até ele.
 */
export function DiceForm({ onRoll, allowHidden = false }: DiceFormProps) {
  const [sides, setSides] = useState<DiceSides>(DEFAULT_SIDES)
  const [count, setCount] = useState('1')
  const [modifier, setModifier] = useState('0')
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const countRef = useRef<HTMLInputElement | null>(null)
  const modifierRef = useRef<HTMLInputElement | null>(null)
  const baseId = useId()
  const countId = `${baseId}-quantidade`
  const modifierId = `${baseId}-modificador`
  const hiddenId = `${baseId}-escondido`
  const errorId = `${baseId}-erro`

  function changeCount(text: string) {
    setCount(text)
    // O aviso sai assim que o valor fica bom, sem esperar outro "Rolar".
    if (error === 'count' && countOf(text) !== null) setError(null)
  }

  function changeModifier(text: string) {
    setModifier(text)
    if (error === 'modifier' && modifierOf(text) !== null) setError(null)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedCount = countOf(count)
    if (parsedCount === null) {
      setError('count')
      countRef.current?.focus()
      return
    }
    const parsedModifier = modifierOf(modifier)
    if (parsedModifier === null) {
      setError('modifier')
      modifierRef.current?.focus()
      return
    }
    setError(null)
    onRoll({ count: parsedCount, sides, modifier: parsedModifier }, allowHidden && hidden)
  }

  return (
    <form className="lb-dice-form" onSubmit={submit} noValidate>
      <div className="lb-dice-form__dice" role="group" aria-label="Tipo de dado">
        {DICE_SIDES.map((option) => (
          <button
            key={option}
            type="button"
            className="lb-dice-form__die"
            aria-pressed={sides === option}
            onClick={() => setSides(option)}
          >
            d{option}
          </button>
        ))}
      </div>
      <div className="lb-dice-form__fields">
        <div className="lb-dice-form__field">
          <label className="lb-dice-form__label" htmlFor={countId}>
            Quantidade
          </label>
          <input
            ref={countRef}
            id={countId}
            className="lb-dice-form__input"
            type="number"
            inputMode="numeric"
            min={DICE_COUNT_MIN}
            max={DICE_COUNT_MAX}
            step={1}
            value={count}
            aria-invalid={error === 'count'}
            aria-describedby={error === 'count' ? errorId : undefined}
            onChange={(event) => changeCount(event.target.value)}
          />
        </div>
        <div className="lb-dice-form__field">
          <label className="lb-dice-form__label" htmlFor={modifierId}>
            Modificador
          </label>
          {/* Sem `inputMode`: o teclado numérico do celular não tem o sinal de menos. */}
          <input
            ref={modifierRef}
            id={modifierId}
            className="lb-dice-form__input"
            type="number"
            min={-DICE_MODIFIER_LIMIT}
            max={DICE_MODIFIER_LIMIT}
            step={1}
            value={modifier}
            aria-invalid={error === 'modifier'}
            aria-describedby={error === 'modifier' ? errorId : undefined}
            onChange={(event) => changeModifier(event.target.value)}
          />
        </div>
      </div>
      {allowHidden && (
        <div className="lb-dice-form__hidden">
          <input id={hiddenId} type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
          <label htmlFor={hiddenId}>Rolar escondido</label>
        </div>
      )}
      {error !== null && (
        <p id={errorId} className="lb-dice-form__error" role="alert">
          {ERROR_TEXT[error]}
        </p>
      )}
      <button type="submit" className="lb-dice-form__roll">
        Rolar
      </button>
    </form>
  )
}

/** Uma linha da lista: a rolagem da mesa, ou a escondida do mestre (só na tela dele). */
export type DiceFeedRoll = HostDiceRoll

/**
 * As últimas rolagens da mesa, a mais nova embaixo: quem rolou, a expressão e
 * o total (e as faces, quando há mais de um dado). É um `log`: o leitor de
 * tela anuncia a rolagem que chega. A lista existe mesmo vazia — região viva
 * que nasce junto com o primeiro item nem sempre é anunciada.
 */
export function DiceFeed({ rolls, className }: { rolls: readonly DiceFeedRoll[]; className?: string }) {
  const shown = rolls.slice(-DICE_FEED_VISIBLE)
  return (
    <ol className={className === undefined ? 'lb-dice-feed' : `lb-dice-feed ${className}`} role="log" aria-label="Rolagens" aria-live="polite">
      {shown.map((roll) => (
        <li key={roll.id} className={roll.master === true ? 'lb-dice-feed__item lb-dice-feed__item--master' : 'lb-dice-feed__item'}>
          {/* Espaços em texto, e não só no CSS: quem lê o texto (leitor de tela, copiar) lê "Ana 2d6+3 = 12". */}
          <span className="lb-dice-feed__who">{rollerLabel(roll)}</span>{' '}
          <span className="lb-dice-feed__expr">{formatDiceExpression(roll)}</span> <span aria-hidden="true">=</span>{' '}
          <strong className="lb-dice-feed__total">{formatDiceTotal(roll.total)}</strong>
          {roll.count > 1 && (
            <>
              {' '}
              <span className="lb-dice-feed__faces">({roll.results.join(', ')})</span>
            </>
          )}
          {roll.hidden === true && (
            <>
              {' '}
              <span className="lb-dice-feed__hidden">escondido</span>
            </>
          )}
        </li>
      ))}
    </ol>
  )
}
