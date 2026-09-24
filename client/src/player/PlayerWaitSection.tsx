import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { NAME_MAX_LENGTH } from '../net/protocol'
import { ESPERA_MINUTOS_OPCOES, ESPERA_MINUTOS_PADRAO, ESPERA_ONDE_MAX_LENGTH, textoDaEspera } from '../lib/encontroMarcado'
import type { OwnWait } from './playerConnection'

/**
 * ENCONTRO MARCADO no painel do jogador: "Esperar aqui" com quem, onde e até
 * quando. Esperando, a frase com o que falta e "Parar de esperar". Quem
 * confirma a espera é o mestre: a frase só aparece com o `wait.state` dele.
 */

/** De quanto em quanto a frase relê o relógio. O texto muda por minuto; alguns segundos de atraso não se notam. */
const RELOGIO_MS = 5_000

function rotuloDoPrazo(minutos: number): string {
  return minutos === 60 ? '1 hora' : `${minutos} min`
}

export interface PlayerWaitSectionProps {
  /** A espera confirmada pelo mestre; `undefined` = não espera. */
  wait: OwnWait | undefined
  /** "Esperar aqui": prazo em minutos, colega e lugar como digitados (o cliente de rede apara). */
  onStart: (minutes: number, who: string, where: string) => void
  onStop: () => void
}

export function PlayerWaitSection({ wait, onStart, onStop }: PlayerWaitSectionProps) {
  const whoId = useId()
  const whereId = useId()
  const untilId = useId()
  const [who, setWho] = useState('')
  const [where, setWhere] = useState('')
  const [minutes, setMinutes] = useState<number>(ESPERA_MINUTOS_PADRAO)
  // Só o relógio anda: o tique força a frase a reler `Date.now()`, e só enquanto há espera.
  const [, setTick] = useState(0)

  useEffect(() => {
    if (wait === undefined) return
    const timer = setInterval(() => setTick((n) => n + 1), RELOGIO_MS)
    return () => clearInterval(timer)
  }, [wait])

  function submit(event: FormEvent<HTMLFormElement>) {
    // Enter num campo recarregaria a página.
    event.preventDefault()
    onStart(minutes, who, where)
  }

  if (wait !== undefined) {
    return (
      <div className="pp-wait">
        <p className="pp-wait__status" role="status">
          {textoDaEspera(wait, wait.until - Date.now())}
        </p>
        <button type="button" className="pp-button" onClick={onStop}>
          Parar de esperar
        </button>
      </div>
    )
  }

  return (
    <form className="pp-wait" onSubmit={submit}>
      <div className="pp-field">
        <label className="pp-label" htmlFor={whoId}>
          Por quem
        </label>
        <input
          id={whoId}
          className="pp-input"
          type="text"
          value={who}
          maxLength={NAME_MAX_LENGTH}
          placeholder="Nome do colega (opcional)"
          autoComplete="off"
          onChange={(event) => setWho(event.target.value)}
        />
      </div>
      <div className="pp-field">
        <label className="pp-label" htmlFor={whereId}>
          Onde
        </label>
        <input
          id={whereId}
          className="pp-input"
          type="text"
          value={where}
          maxLength={ESPERA_ONDE_MAX_LENGTH}
          placeholder="Ex.: no portão (opcional)"
          autoComplete="off"
          onChange={(event) => setWhere(event.target.value)}
        />
      </div>
      <div className="pp-field">
        <label className="pp-label" htmlFor={untilId}>
          Até
        </label>
        <select id={untilId} className="pp-input" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
          {ESPERA_MINUTOS_OPCOES.map((opcao) => (
            <option key={opcao} value={opcao}>
              {rotuloDoPrazo(opcao)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="pp-button">
        Esperar aqui
      </button>
    </form>
  )
}
