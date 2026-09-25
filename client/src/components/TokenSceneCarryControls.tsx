import { useId, useRef, useState } from 'react'
import type { PartyDestination } from '../lib/party'
import { SceneSendForm } from './SceneSendForm'

export interface TokenSceneCarryControlsProps {
  /** Nome da ficha selecionada, para o título do formulário. */
  tokenName: string
  /** As cenas para onde levar: todas as que abriram, menos a aberta. Vazio = nada a mostrar. */
  destinations: PartyDestination[]
  /** A ficha é de um jogador: quem a leva é o "Mandar para…" do Grupo, que também avisa ele e a sessão. */
  owned: boolean
  /** "Levar" confirmado. `false` = não deu, e o formulário fica aberto com o aviso. */
  onCarry(sceneId: string, pinId: string | null): boolean
}

/** O rótulo do botão que abre o formulário. */
export const CARRY_TO_LABEL = 'Levar para…'

export const CARRY_FAILED = 'Não deu para levar: a cena ou a ficha mudou. Escolha de novo.'

/** Por que a ficha de jogador não tem o botão: o caminho dela é outro. */
export const CARRY_OWNED_HINT = 'Ficha de jogador: leve pelo "Mandar para…" do Grupo, na aba Jogo.'

/**
 * "Levar para…" da ficha SEM DONO (NPC, monstro): muda a ficha de cena sem
 * apagar e recriar — id, nome, cor e foto viajam juntos. É o mesmo formulário
 * do "Mandar para…" do Grupo (`SceneSendForm`): cena e chegada, Enter leva,
 * Esc cancela, e o foco volta ao botão.
 */
export function TokenSceneCarryControls({ tokenName, destinations, owned, onCarry }: TokenSceneCarryControlsProps) {
  const formId = useId()
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const name = tokenName.trim() === '' ? 'a ficha' : tokenName.trim()

  if (destinations.length === 0) return null
  if (owned) {
    return (
      <section className="lb-section">
        <p className="lb-field__hint">{CARRY_OWNED_HINT}</p>
      </section>
    )
  }

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => {
      // Levada a ficha, o painel dela some junto com o botão: não há para onde voltar.
      if (openerRef.current?.isConnected === true) openerRef.current.focus()
    })
  }

  return (
    <section className="lb-section">
      <div className="lb-party__actions">
        <button
          ref={openerRef}
          type="button"
          className="lb-btn"
          aria-expanded={open}
          aria-controls={open ? formId : undefined}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {CARRY_TO_LABEL}
        </button>
      </div>
      {open && (
        <div id={formId}>
          <SceneSendForm
            title={`Levar ${name} para…`}
            ariaLabel={`Levar ${name} para outra cena`}
            submitLabel="Levar"
            failedText={CARRY_FAILED}
            destinations={destinations}
            onSend={onCarry}
            onClose={close}
          />
        </div>
      )}
    </section>
  )
}
