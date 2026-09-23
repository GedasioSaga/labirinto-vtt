import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { PARTY_CENTER_LABEL, type PartyDestination } from '../lib/party'

/** Valor do `<select>` de chegada que quer dizer "centro da cena" (id de pino nunca é vazio). */
const CENTER = ''

export interface SceneSendFormProps {
  /** Título visível: "Mandar Ana para…", "Levar Zumbi para…". */
  title: string
  /** Nome acessível do formulário. */
  ariaLabel: string
  /** O botão que confirma: "Mandar", "Levar". */
  submitLabel: string
  /** O aviso quando a confirmação não deu. */
  failedText: string
  /** As cenas oferecidas, na ordem da lista; a primeira já vem escolhida. */
  destinations: PartyDestination[]
  /** Confirmado. `false` = não deu, e o formulário fica aberto com o aviso. */
  onSend(sceneId: string, pinId: string | null): boolean
  onClose(): void
}

/**
 * Cena e chegada em duas listas nativas (teclado e leitor de tela de graça),
 * "Centro da cena" já escolhido — é o destino que sempre existe. Enter envia
 * (é um `<form>`); Esc cancela. Serve ao "Mandar para…" do Grupo (jogador) e
 * ao "Levar para…" do painel da ficha (NPC): o mesmo gesto, as mesmas teclas.
 */
export function SceneSendForm({ title, ariaLabel, submitLabel, failedText, destinations, onSend, onClose }: SceneSendFormProps) {
  const baseId = useId()
  const [sceneId, setSceneId] = useState(destinations[0]?.sceneId ?? '')
  const [arrival, setArrival] = useState(CENTER)
  const [failed, setFailed] = useState(false)
  const sceneRef = useRef<HTMLSelectElement | null>(null)
  const scene = destinations.find((destination) => destination.sceneId === sceneId)

  useEffect(() => {
    sceneRef.current?.focus()
  }, [])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (scene === undefined) return
    if (onSend(scene.sceneId, arrival === CENTER ? null : arrival)) onClose()
    else setFailed(true)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem mandar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <form className="lb-party__send" aria-label={ariaLabel} onSubmit={submit} onKeyDown={onKeyDown}>
      <span className="lb-label">{title}</span>
      <label className="lb-label" htmlFor={`${baseId}-scene`}>
        Cena
      </label>
      <select
        id={`${baseId}-scene`}
        ref={sceneRef}
        className="lb-input"
        value={sceneId}
        onChange={(event) => {
          setSceneId(event.target.value)
          // O pino escolhido era da outra cena: a chegada volta ao centro.
          setArrival(CENTER)
          setFailed(false)
        }}
      >
        {destinations.map((destination) => (
          <option key={destination.sceneId} value={destination.sceneId}>
            {destination.name}
          </option>
        ))}
      </select>
      <label className="lb-label" htmlFor={`${baseId}-arrival`}>
        Chegada
      </label>
      <select
        id={`${baseId}-arrival`}
        className="lb-input"
        value={arrival}
        onChange={(event) => {
          setArrival(event.target.value)
          setFailed(false)
        }}
      >
        <option value={CENTER}>{PARTY_CENTER_LABEL}</option>
        {(scene?.arrivals ?? []).map((pin) => (
          <option key={pin.pinId} value={pin.pinId}>
            {pin.label}
          </option>
        ))}
      </select>
      {failed && (
        <p className="lb-room__error" role="alert">
          {failedText}
        </p>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
