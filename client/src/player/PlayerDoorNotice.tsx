import type { DoorRequestHow, DoorToggleRejection } from '../net/protocol'
import type { DoorNotice, DoorRequestPhase } from './playerConnection'

/** Recusa do mestre ao toque na porta, em uma linha curta. */
const DOOR_NOTICE_TEXT: Record<DoorToggleRejection, string> = {
  locked: 'Trancada',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  wrong_side: 'Não dá para abrir por este lado',
}

/** Os três jeitos de pedir ao mestre, na ordem dos botões. */
const DOOR_REQUEST_CHOICES: readonly { how: DoorRequestHow; label: string }[] = [
  { how: 'knock', label: 'Bater' },
  { how: 'force', label: 'Forçar' },
  { how: 'key', label: 'Usar chave' },
]

const DOOR_REQUEST_TEXT: Record<DoorRequestPhase, string> = {
  sent: 'Pedido enviado',
  opened: 'O mestre abriu',
  denied: 'O mestre disse não',
  pending: 'Seu pedido anterior ainda espera o mestre',
  far: 'Chegue mais perto da porta',
  not_visible: 'Você não vê essa porta daqui',
  not_locked: 'Essa porta abre com um toque',
}

/** O aviso do pedido da porta trancada, em uma linha. */
export function doorRequestText(phase: DoorRequestPhase): string {
  return DOOR_REQUEST_TEXT[phase]
}

export interface PlayerDoorNoticeProps {
  notice: DoorNotice
  onRequest(wallId: string, how: DoorRequestHow): void
  /** CHAVE ABRE PORTA: "Usar <chave>". Sem ele, o botão não aparece nem com a chave na mochila. */
  onUseKey?(wallId: string): void
  onClose(): void
}

/**
 * O aviso da porta na tela do jogador. As recusas de sempre continuam uma
 * linha que some sozinha. "Trancada" vira a pergunta "e agora?": com a chave
 * na mochila, "Usar <chave>" abre na hora; Bater, Forçar ou Usar chave levam
 * o pedido ao mestre, e o × fecha sem pedir.
 *
 * `role="group"` com nome, e não `status`: tem botões dentro, e o leitor de
 * tela anuncia o grupo "Porta trancada" ao chegar nele. O texto e os botões
 * são texto do React (sem HTML).
 */
export function PlayerDoorNotice({ notice, onRequest, onUseKey, onClose }: PlayerDoorNoticeProps) {
  const key = notice.key
  if (notice.reason !== 'locked') {
    return (
      <p className="pp-notice" role="status" aria-live="polite">
        {DOOR_NOTICE_TEXT[notice.reason]}
      </p>
    )
  }
  return (
    <div className="pp-notice pp-notice--door" role="group" aria-label="Porta trancada">
      <span className="pp-notice__text" role="status" aria-live="polite">
        {DOOR_NOTICE_TEXT.locked}
      </span>
      {/* Quem tem a chave abre sem pedir: é a ação primeira, antes dos pedidos ao mestre. */}
      {key !== undefined && onUseKey !== undefined && (
        <button type="button" className="pp-notice__action pp-notice__action--primary" onClick={() => onUseKey(notice.wallId)}>
          {`Usar ${key}`}
        </button>
      )}
      {DOOR_REQUEST_CHOICES.map((choice) => (
        <button key={choice.how} type="button" className="pp-notice__action" onClick={() => onRequest(notice.wallId, choice.how)}>
          {choice.label}
        </button>
      ))}
      <button type="button" className="pp-notice__close" aria-label="Fechar aviso" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
