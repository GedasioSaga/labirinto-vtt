import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { PartyMember } from '../lib/party'
import type { HostBridge } from '../net/hostBridge'
import type { ToastKind } from '../stores/toastStore'
import type { Pin } from '../types/map'

/** Um nome da lista "Mostrar agora a…": quem é e a cor da ficha dele. */
export interface ShowPinNowCandidate {
  playerId: string
  name: string
  color: string
}

export interface ShowPinNowControlsProps {
  /** Quem pode receber o cartão agora: conectado, com ficha e nesta cena (`showPinNowCandidates`). */
  candidates: ShowPinNowCandidate[]
  /** Toque no nome: manda o cartão. Quem aplica e avisa se não deu é o App. */
  onShow(playerId: string): void
}

/** O rótulo do botão que abre a lista: é por ele que o teste e o leitor de tela acham a ação. */
export const SHOW_PIN_NOW_LABEL = 'Mostrar agora a…'

/**
 * Quem pode receber o cartão: conectado (sem conexão, nada chega), com ficha
 * (sem ficha não há tela de jogo) e na cena ABERTA no editor — é nela que mora
 * o pino que o mestre está vendo. O host confere tudo de novo; isto só evita
 * oferecer um nome que ele vai recusar.
 */
export function showPinNowCandidates(members: readonly PartyMember[], openSceneId: string | null): ShowPinNowCandidate[] {
  return members.flatMap((member) =>
    member.connected && member.token !== null && member.sceneId === openSceneId
      ? [{ playerId: member.playerId, name: member.name, color: member.token.color }]
      : [],
  )
}

/**
 * O painel do pino oferece "Mostrar agora a…": só com a sala aberta (sem sala
 * não há tela de jogador), só no "!" e no "?", e nunca oculto para jogadores
 * — viagem, alavanca e oculto o host não mostra (`pinCardForPlayer`), e o
 * botão só ensinaria o mestre a errar.
 */
export function canShowPinNow(pin: Pick<Pin, 'kind' | 'secret'>, roomOpen: boolean): boolean {
  return roomOpen && (pin.kind === 'exclamacao' || pin.kind === 'interrogacao') && pin.secret !== true
}

/**
 * Toque no nome: manda o cartão e diz ao mestre se saiu. A lista pode ter
 * ficado aberta enquanto o jogador saía da cena ou caía, então o "não deu"
 * também vira aviso — nunca silêncio.
 */
export function showPinNowWithNotice(
  bridge: Pick<HostBridge, 'showPin'> & { players(): readonly { playerId: string; name: string }[] },
  pinId: string,
  playerId: string,
  notify: (kind: ToastKind, text: string) => void,
): void {
  const name = bridge.players().find((p) => p.playerId === playerId)?.name ?? 'o jogador'
  if (bridge.showPin(playerId, pinId) === true) notify('info', `Cartão aberto na tela de ${name}.`)
  else notify('error', `Não deu para mostrar o cartão a ${name}: saiu desta cena ou perdeu a conexão.`)
}

/**
 * "MOSTRAR AGORA A…" no painel do pino: o botão abre, ali mesmo, um botão por
 * jogador da cena; um toque no nome abre o cartão na tela dele e fecha a
 * lista. É um toque só, sem confirmar: mostrar não desfaz nada nem tira
 * ninguém do lugar, e o mestre lê no aviso que o cartão saiu. Esc fecha sem
 * mandar.
 */
export function ShowPinNowControls({ candidates, onShow }: ShowPinNowControlsProps) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstRef = useRef<HTMLButtonElement | null>(null)
  const listId = `${baseId}-list`

  useEffect(() => {
    if (open) firstRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    openButtonRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem mandar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lb-btn lb-btn--block"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {SHOW_PIN_NOW_LABEL}
      </button>
      {open && (
        <div id={listId} className="lb-party__send" role="group" aria-label="Mostrar o cartão a" onKeyDown={onKeyDown}>
          {candidates.length === 0 ? (
            <span className="lb-label">Ninguém com ficha nesta cena.</span>
          ) : (
            <ul className="lb-gather__list">
              {candidates.map((candidate, index) => (
                <li key={candidate.playerId}>
                  <button
                    ref={index === 0 ? firstRef : undefined}
                    type="button"
                    className="lb-btn lb-btn--block lb-gather__item"
                    onClick={() => {
                      onShow(candidate.playerId)
                      close()
                    }}
                  >
                    <span className="lb-party__dot" style={{ background: candidate.color }} aria-hidden="true" />
                    <span className="lb-party__name">{candidate.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="lb-party__actions">
            {/* Lista vazia: o foco cai aqui, para o Esc e o teclado terem onde estar. */}
            <button ref={candidates.length === 0 ? firstRef : undefined} type="button" className="lb-btn lb-btn--ghost" onClick={close}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
