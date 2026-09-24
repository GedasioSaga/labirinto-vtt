import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ALARM_MAX_LENGTH } from '../net/protocol'
import type { SceneListItem } from '../stores/adventureStore'

/** O alarme soando, como o painel precisa: o texto e as cenas escolhidas. */
export interface ActiveAlarmView {
  text: string
  sceneIds: readonly string[]
}

export interface SceneAlarmControlsProps {
  scenes: SceneListItem[]
  /** O alarme soando; `null` = nenhum. */
  alarm: ActiveAlarmView | null
  /** Soa `text` nas `sceneIds`. Devolve quantos receberam agora, ou `null` se não deu. */
  onAlarm(sceneIds: string[], text: string): number | null
  onEndAlarm(): void
}

/** Quanto tempo o aviso "Alarme soou…" fica abaixo do botão. */
export const ALARM_FEEDBACK_MS = 4000

/** O aviso depois de soar: quantos receberam, ou que ninguém está lá ainda (o alarme fica para quem chegar). */
export function alarmFeedbackText(sent: number | null): string {
  if (sent === null) return 'Não deu para soar: a sala não está aberta.'
  if (sent === 0) return 'Ninguém está nessas cenas agora: quem chegar verá o alarme'
  return sent === 1 ? 'Alarme soou para 1 jogador' : `Alarme soou para ${sent} jogadores`
}

/** As cenas onde dá para soar: da aventura (não o mapa solto) e com o arquivo aberto. */
function alarmableIds(scenes: readonly SceneListItem[]): string[] {
  return scenes.filter((scene) => scene.id !== '' && scene.available).map((scene) => scene.id)
}

interface AlarmFormProps {
  scenes: SceneListItem[]
  onSend(sceneIds: string[], text: string): void
  onCancel(): void
}

/**
 * O formulário do alarme: o aviso, as cenas (uma caixa por cena, mais "Todas
 * as cenas" para o andar inteiro) e "Soar alarme". Ctrl+Enter soa; Esc
 * cancela de qualquer ponto do formulário.
 */
function AlarmForm({ scenes, onSend, onCancel }: AlarmFormProps) {
  const baseId = useId()
  const [text, setText] = useState('')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const allRef = useRef<HTMLInputElement | null>(null)
  const ids = alarmableIds(scenes)
  const picked = ids.filter((id) => chosen.has(id))
  const allPicked = ids.length > 0 && picked.length === ids.length
  const ready = picked.length > 0 && text.trim().length > 0

  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  // "Todas" meio marcada quando só parte do andar está escolhida.
  useEffect(() => {
    if (allRef.current !== null) allRef.current.indeterminate = picked.length > 0 && !allPicked
  }, [picked.length, allPicked])

  const toggle = (sceneId: string, on: boolean) => {
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(sceneId)
      else next.delete(sceneId)
      return next
    })
  }

  const send = () => {
    // Na ordem da lista, não na dos cliques: é a ordem que o painel mostra depois.
    if (ready) onSend(picked, text)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      // Esc fecha sem soar; não pode chegar ao canvas (Esc lá troca a ferramenta).
      event.preventDefault()
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      send()
    }
  }

  return (
    <form className="lb-alarme__form" aria-label="Soar alarme" onSubmit={submit} onKeyDown={onKeyDown}>
      <label className="lb-label" htmlFor={`${baseId}-texto`}>
        Aviso de alarme
      </label>
      <textarea
        id={`${baseId}-texto`}
        ref={fieldRef}
        className="lb-input lb-cenas__recado-campo"
        rows={2}
        value={text}
        maxLength={ALARM_MAX_LENGTH}
        placeholder="O sino da torre tocou!"
        onChange={(event) => setText(event.target.value)}
      />
      <fieldset className="lb-alarme__cenas">
        <legend className="lb-label">Soar em</legend>
        <ul className="lb-gather__list">
          <li>
            <label className="lb-gather__item">
              <input
                ref={allRef}
                type="checkbox"
                className="lb-gather__check"
                checked={allPicked}
                disabled={ids.length === 0}
                onChange={(event) => setChosen(new Set(event.target.checked ? ids : []))}
              />
              <span>Todas as cenas</span>
            </label>
          </li>
          {scenes
            .filter((scene) => scene.id !== '')
            .map((scene) => (
              <li key={scene.id}>
                <label className="lb-gather__item" title={scene.available ? undefined : 'O arquivo desta cena não foi encontrado'}>
                  <input
                    type="checkbox"
                    className="lb-gather__check"
                    checked={chosen.has(scene.id)}
                    disabled={!scene.available}
                    onChange={(event) => toggle(scene.id, event.target.checked)}
                  />
                  <span>{scene.name}</span>
                </label>
              </li>
            ))}
        </ul>
      </fieldset>
      <div className="lb-cenas__acoes">
        <span className="lb-cenas__recado-conta" aria-hidden="true">
          {text.length}/{ALARM_MAX_LENGTH}
        </span>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="lb-btn lb-btn--danger" disabled={!ready}>
          Soar alarme
        </button>
      </div>
    </form>
  )
}

/**
 * ALARME PARA VÁRIAS CENAS, no fim da seção Cenas: aviso urgente que o mestre
 * soa para várias cenas de uma vez (ou o andar inteiro) e que fica na tela dos
 * jogadores até "Encerrar alarme". Enquanto soa, o painel mostra o texto e
 * onde, com o botão de encerrar logo ao lado.
 */
export function SceneAlarmControls({ scenes, alarm, onAlarm, onEndAlarm }: SceneAlarmControlsProps) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const openButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (feedback === null) return
    const timer = setTimeout(() => setFeedback(null), ALARM_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])

  const close = () => {
    setOpen(false)
    // Depois do render: o foco volta a quem abriu o formulário.
    requestAnimationFrame(() => openButtonRef.current?.focus())
  }

  const send = (sceneIds: string[], text: string) => {
    setFeedback(alarmFeedbackText(onAlarm(sceneIds, text)))
    close()
  }

  const names = alarm === null ? '' : scenes.filter((scene) => alarm.sceneIds.includes(scene.id)).map((scene) => scene.name).join(', ')

  return (
    <div className="lb-alarme">
      {alarm !== null && (
        <div className="lb-alarme__ativo">
          <span className="lb-alarme__selo">Alarme soando</span>
          <p className="lb-alarme__texto">{alarm.text}</p>
          {names !== '' && <p className="lb-alarme__onde">Em: {names}</p>}
          <button type="button" className="lb-btn lb-btn--danger" onClick={onEndAlarm}>
            Encerrar alarme
          </button>
        </div>
      )}
      <button
        ref={openButtonRef}
        type="button"
        className="lb-btn lb-btn--block"
        aria-expanded={open}
        title="Aviso urgente para várias cenas: fica na tela dos jogadores até você encerrar"
        onClick={() => {
          if (open) {
            close()
            return
          }
          setFeedback(null)
          setOpen(true)
        }}
      >
        Alarme…
      </button>
      {open && <AlarmForm scenes={scenes} onSend={send} onCancel={close} />}
      {feedback !== null && (
        <p className="lb-cenas__recado-aviso" role="status">
          {feedback}
        </p>
      )}
    </div>
  )
}
